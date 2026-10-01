// Shared YouTube download helper backed by the local `yt-dlp` binary.
//
// Replaces the previous reliance on a third-party HTTP API: that API's
// "downloadUrl" started redirecting through an ad network instead of
// serving media bytes, breaking `.play`/`.song`/`.video` entirely. yt-dlp
// runs locally (ffmpeg is already a hard dependency of this project) and
// optionally uses YouTube cookies to look like a logged-in browser, which
// helps avoid "Sign in to confirm you're not a bot" throttling.
//
// Cookies can come from two places, DB takes priority:
//   1. `.ytcookies set` (owner command) — stored via lightweight_store so it
//      survives redeploys even on platforms with an ephemeral filesystem.
//   2. `YOUTUBE_COOKIES_FILE` env var — a static Netscape-format cookies.txt
//      path on disk, used when no DB value is set yet.
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
const COOKIES_KEY = 'youtubeCookies';
const COOKIE_ALERT_KEY = 'youtubeCookieAlert';
const COOKIE_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // avoid spamming the owner every single download
const MATERIALIZED_COOKIES_PATH = path.join(TEMP_DIR, 'youtube_cookies.materialized.txt');
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

export async function loadCookiesSetting() {
    return store.getSetting(SETTINGS_SCOPE, COOKIES_KEY);
}

export async function saveCookiesSetting(content) {
    const entry = { content, updatedAt: Date.now() };
    await store.saveSetting(SETTINGS_SCOPE, COOKIES_KEY, entry);
    // Give the new cookies a clean slate before the next invalid-cookie alert.
    await store.saveSetting(SETTINGS_SCOPE, COOKIE_ALERT_KEY, null);
    return entry;
}

export async function clearCookiesSetting() {
    await store.saveSetting(SETTINGS_SCOPE, COOKIES_KEY, null);
    await store.saveSetting(SETTINGS_SCOPE, COOKIE_ALERT_KEY, null);
}

let materializedUpdatedAt = null;

async function resolveCookiesFile() {
    const setting = await loadCookiesSetting();
    if (setting?.content) {
        if (materializedUpdatedAt !== setting.updatedAt) {
            ensureTempDir();
            fs.writeFileSync(MATERIALIZED_COOKIES_PATH, setting.content, { mode: 0o600 });
            materializedUpdatedAt = setting.updatedAt;
        }
        return MATERIALIZED_COOKIES_PATH;
    }
    const envPath = process.env.YOUTUBE_COOKIES_FILE;
    if (envPath && fs.existsSync(envPath))
        return envPath;
    return null;
}

export async function notifyOwnerCookiesInvalidOnce(sock) {
    try {
        const alert = await store.getSetting(SETTINGS_SCOPE, COOKIE_ALERT_KEY);
        const now = Date.now();
        if (alert?.notifiedAt && (now - alert.notifiedAt) < COOKIE_ALERT_COOLDOWN_MS)
            return;
        await store.saveSetting(SETTINGS_SCOPE, COOKIE_ALERT_KEY, { notifiedAt: now });
        if (!sock)
            return;
        const t = createTranslator(config.defaultLanguage);
        const ownerJid = `${cleanJid(config.ownerNumber)}@s.whatsapp.net`;
        await sock.sendMessage(ownerJid, { text: t('p.ytcookies.invalidAlert') });
    }
    catch (err) {
        console.error('[ytdlp] Failed to notify owner about invalid cookies:', err.message);
    }
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
    const cookiesFile = await resolveCookiesFile();
    const fullArgs = [
        '--no-playlist', '--no-warnings', '--no-progress',
        ...(cookiesFile ? ['--cookies', cookiesFile] : []),
        ...args,
        '--', url
    ];
    const { stdout, stderr, code, error } = await runYtDlp(fullArgs, { timeout });
    if (cookiesFile && COOKIE_INVALID_RE.test(stderr))
        await notifyOwnerCookiesInvalidOnce(sock);
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
    const setting = await loadCookiesSetting();
    if (setting?.content)
        return { configured: true, source: 'db', updatedAt: setting.updatedAt };
    const envPath = process.env.YOUTUBE_COOKIES_FILE;
    if (envPath && fs.existsSync(envPath))
        return { configured: true, source: 'file', path: envPath };
    return { configured: false };
}

export async function getCookieAlertState() {
    return store.getSetting(SETTINGS_SCOPE, COOKIE_ALERT_KEY);
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
