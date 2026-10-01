// Shared YouTube download helper backed by the local `yt-dlp` binary.
//
// Replaces the previous reliance on a third-party HTTP API: that API's
// "downloadUrl" started redirecting through an ad network instead of
// serving media bytes, breaking `.play`/`.song`/`.video` entirely. yt-dlp
// runs locally (ffmpeg is already a hard dependency of this project) and
// uses YouTube cookies to look like a logged-in browser — on datacenter
// VPS IPs this isn't optional, every anonymous client gets LOGIN_REQUIRED.
//
// Cookies can come from two places, DB profiles take priority:
//   1. `.ytcookies set [label]` (owner command) — one or more labeled
//      cookie profiles stored via lightweight_store, rotated round-robin
//      on each download to spread load across accounts. Survives
//      redeploys even on platforms with an ephemeral filesystem.
//   2. `YOUTUBE_COOKIES_FILE` env var — a single static Netscape-format
//      cookies.txt path on disk, used only when no DB profile exists yet.
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../config.js';
import store from './lightweight_store.js';
import { createTranslator } from './i18n.js';
import { cleanJid } from './isOwner.js';
import { TEMP_DIR } from './paths.js';

const SETTINGS_SCOPE = 'global';
const PROFILES_KEY = 'youtubeCookies';
const ROTATION_KEY = 'youtubeCookieRotation';
const FILE_ALERT_KEY = 'youtubeCookieAlert'; // only used for the YOUTUBE_COOKIES_FILE fallback
const COOKIE_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // avoid spamming the owner every single download
const DEFAULT_LABEL = 'default';
const MAX_LABEL_LENGTH = 24;
// Exact wording yt-dlp uses (yt_dlp/extractor/youtube/_base.py) when a
// previously-working cookie jar gets rejected mid-session.
const COOKIE_INVALID_RE = /youtube account cookies are no longer valid/i;

function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR))
        fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function randomTempPath(ext) {
    ensureTempDir();
    return path.join(TEMP_DIR, `ytdlp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`);
}

export function normalizeCookieLabel(label) {
    const normalized = String(label || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, MAX_LABEL_LENGTH);
    return normalized || DEFAULT_LABEL;
}

async function loadCookieProfiles() {
    const value = await store.getSetting(SETTINGS_SCOPE, PROFILES_KEY);
    return Array.isArray(value) ? value : [];
}

async function saveCookieProfiles(profiles) {
    await store.saveSetting(SETTINGS_SCOPE, PROFILES_KEY, profiles.length ? profiles : null);
}

export async function saveCookiesSetting(content, label = DEFAULT_LABEL) {
    const normalizedLabel = normalizeCookieLabel(label);
    const profiles = await loadCookieProfiles();
    const entry = { label: normalizedLabel, content, updatedAt: Date.now(), invalid: false, invalidAt: null, lastAlertAt: null };
    const idx = profiles.findIndex((p) => p.label === normalizedLabel);
    if (idx === -1)
        profiles.push(entry);
    else
        profiles[idx] = entry;
    await saveCookieProfiles(profiles);
    return entry;
}

export async function removeCookiesProfile(label) {
    const normalizedLabel = normalizeCookieLabel(label);
    const profiles = await loadCookieProfiles();
    const next = profiles.filter((p) => p.label !== normalizedLabel);
    const removed = next.length !== profiles.length;
    await saveCookieProfiles(next);
    return removed;
}

export async function clearCookiesSetting() {
    await saveCookieProfiles([]);
    await store.saveSetting(SETTINGS_SCOPE, ROTATION_KEY, null);
    await store.saveSetting(SETTINGS_SCOPE, FILE_ALERT_KEY, null);
}

export async function listCookieProfiles() {
    const profiles = await loadCookieProfiles();
    return profiles.map(({ label, updatedAt, invalid, invalidAt }) => ({ label, updatedAt, invalid, invalidAt }));
}

const materializedPaths = new Map(); // label -> { path, updatedAt }

function materializeProfile(profile) {
    const cached = materializedPaths.get(profile.label);
    if (cached?.updatedAt === profile.updatedAt)
        return cached.path;
    ensureTempDir();
    const filePath = path.join(TEMP_DIR, `youtube_cookies.${profile.label}.txt`);
    fs.writeFileSync(filePath, profile.content, { mode: 0o600 });
    materializedPaths.set(profile.label, { path: filePath, updatedAt: profile.updatedAt });
    return filePath;
}

async function pickCookieProfile() {
    const profiles = await loadCookieProfiles();
    if (!profiles.length)
        return null;
    const candidates = profiles.filter((p) => !p.invalid);
    const pool = candidates.length ? candidates : profiles;
    const rotation = (await store.getSetting(SETTINGS_SCOPE, ROTATION_KEY)) || { index: 0 };
    const index = rotation.index % pool.length;
    await store.saveSetting(SETTINGS_SCOPE, ROTATION_KEY, { index: (index + 1) % pool.length });
    const profile = pool[index];
    return { filePath: materializeProfile(profile), label: profile.label };
}

async function resolveCookies() {
    const picked = await pickCookieProfile();
    if (picked)
        return picked;
    const envPath = process.env.YOUTUBE_COOKIES_FILE;
    if (envPath && fs.existsSync(envPath))
        return { filePath: envPath, label: 'file' };
    return null;
}

async function notifyOwnerCookieInvalid(label, sock) {
    try {
        const t = createTranslator(config.defaultLanguage);
        const ownerJid = `${cleanJid(config.ownerNumber)}@s.whatsapp.net`;
        if (sock)
            await sock.sendMessage(ownerJid, { text: t('p.ytcookies.invalidAlert', { label }) });
    }
    catch (err) {
        console.error('[ytdlp] Failed to notify owner about invalid cookies:', err.message);
    }
}

async function markCookiesInvalid(label, sock) {
    const now = Date.now();
    if (label === 'file') {
        const alert = await store.getSetting(SETTINGS_SCOPE, FILE_ALERT_KEY);
        if (alert?.notifiedAt && (now - alert.notifiedAt) < COOKIE_ALERT_COOLDOWN_MS)
            return;
        await store.saveSetting(SETTINGS_SCOPE, FILE_ALERT_KEY, { notifiedAt: now });
        await notifyOwnerCookieInvalid(label, sock);
        return;
    }
    const profiles = await loadCookieProfiles();
    const idx = profiles.findIndex((p) => p.label === label);
    if (idx === -1)
        return;
    const profile = profiles[idx];
    const recentlyNotified = profile.lastAlertAt && (now - profile.lastAlertAt) < COOKIE_ALERT_COOLDOWN_MS;
    profiles[idx] = { ...profile, invalid: true, invalidAt: profile.invalidAt || now, lastAlertAt: recentlyNotified ? profile.lastAlertAt : now };
    await saveCookieProfiles(profiles);
    if (!recentlyNotified)
        await notifyOwnerCookieInvalid(label, sock);
}

function lastErrorLine(stderr) {
    const lines = String(stderr || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const errorLine = [...lines].reverse().find((l) => l.startsWith('ERROR:'));
    return (errorLine || lines[lines.length - 1] || '').replace(/^ERROR:\s*/, '');
}

function runYtDlp(args, { timeout = 120000 } = {}) {
    return new Promise((resolve) => {
        execFile('yt-dlp', args, { timeout, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
            resolve({ stdout: stdout || '', stderr: stderr || '', code: error ? (error.code ?? 1) : 0, error });
        });
    });
}

function parsePrintedFields(stdout) {
    const fields = {};
    for (const line of stdout.split('\n')) {
        const match = line.match(/^(FILE|TITLE|THUMB):(.*)$/);
        if (match)
            fields[match[1].toLowerCase()] = match[2];
    }
    return fields;
}

async function download(url, { sock, args, timeout }) {
    const cookies = await resolveCookies();
    const fullArgs = [
        '--no-playlist', '--no-warnings', '--no-progress',
        ...(cookies ? ['--cookies', cookies.filePath] : []),
        ...args,
        '--', url
    ];
    const { stdout, stderr, code, error } = await runYtDlp(fullArgs, { timeout });
    if (cookies && COOKIE_INVALID_RE.test(stderr))
        await markCookiesInvalid(cookies.label, sock);
    if (error?.code === 'ENOENT')
        throw new Error('yt-dlp is not installed on this server');
    if (code !== 0)
        throw new Error(lastErrorLine(stderr) || error?.message || 'yt-dlp failed');
    const { file, title, thumb } = parsePrintedFields(stdout);
    if (!file || !fs.existsSync(file))
        throw new Error('yt-dlp did not produce an output file');
    return {
        filePath: file,
        title: title || undefined,
        thumbnail: thumb && thumb !== 'NA' ? thumb : undefined,
        cleanup: () => fs.promises.unlink(file).catch(() => {})
    };
}

export async function downloadAudio(url, { sock } = {}) {
    const outputPath = randomTempPath('audio.%(ext)s');
    return download(url, {
        sock,
        timeout: 180000,
        args: [
            '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '5',
            '--print', 'after_move:FILE:%(filepath)s',
            '--print', 'after_move:TITLE:%(title)s',
            '--print', 'after_move:THUMB:%(thumbnail)s',
            '-o', outputPath
        ]
    });
}

export async function downloadVideo(url, { sock, maxHeight = 480 } = {}) {
    const outputPath = randomTempPath('video.%(ext)s');
    return download(url, {
        sock,
        timeout: 240000,
        args: [
            '-f', `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]/best`,
            '--merge-output-format', 'mp4',
            '--print', 'after_move:FILE:%(filepath)s',
            '--print', 'after_move:TITLE:%(title)s',
            '--print', 'after_move:THUMB:%(thumbnail)s',
            '-o', outputPath
        ]
    });
}

export async function isCookiesConfigured() {
    const profiles = await loadCookieProfiles();
    if (profiles.length)
        return { configured: true, source: 'db', count: profiles.length };
    const envPath = process.env.YOUTUBE_COOKIES_FILE;
    if (envPath && fs.existsSync(envPath))
        return { configured: true, source: 'file', path: envPath };
    return { configured: false };
}

export function validateCookiesContent(content) {
    const text = String(content || '').trim();
    if (!text)
        return false;
    const dataLines = text.split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !(line.startsWith('#') && !line.startsWith('#HttpOnly_')));
    if (dataLines.length === 0)
        return false;
    let hasYoutubeDomain = false;
    for (const line of dataLines) {
        const fields = line.replace(/^#HttpOnly_/, '').split('\t');
        if (fields.length !== 7)
            return false;
        if (/(^|\.)(youtube|google)\.com$/i.test(fields[0]))
            hasYoutubeDomain = true;
    }
    return hasYoutubeDomain;
}
