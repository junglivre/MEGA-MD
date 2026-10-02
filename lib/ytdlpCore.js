// Generic engine behind the `yt-dlp`-backed download plugins (YouTube,
// TikTok, Twitter). Site-specific modules (lib/ytdlp.js, lib/tiktokDownload.js,
// lib/twitterDownload.js) each create a cookie manager here and build their
// own download() wrapper with the right yt-dlp format args.
//
// Multi-profile cookies: `.dlcookies <site> set` (owner, via WhatsApp) stores
// one or more labeled Netscape cookies.txt blobs in lightweight_store,
// rotated round-robin on each download. `<SITE>_COOKIES_FILE` env var is a
// static fallback used only when no DB profile exists yet.
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
const DEFAULT_LABEL = 'default';
const MAX_LABEL_LENGTH = 24;
const COOKIE_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // avoid spamming the owner every single download

export function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR))
        fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export function randomTempPath(ext) {
    ensureTempDir();
    return path.join(TEMP_DIR, `ytdlp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`);
}

export function normalizeCookieLabel(label) {
    const normalized = String(label || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, MAX_LABEL_LENGTH);
    return normalized || DEFAULT_LABEL;
}

export function lastErrorLine(stderr) {
    const lines = String(stderr || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const errorLine = [...lines].reverse().find((l) => l.startsWith('ERROR:'));
    return (errorLine || lines[lines.length - 1] || '').replace(/^ERROR:\s*/, '');
}

export function runYtDlp(args, { timeout = 120000 } = {}) {
    return new Promise((resolve) => {
        execFile('yt-dlp', args, { timeout, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
            resolve({ stdout: stdout || '', stderr: stderr || '', code: error ? (error.code ?? 1) : 0, error });
        });
    });
}

export function parsePrintedFields(stdout) {
    const fields = {};
    for (const line of stdout.split('\n')) {
        const match = line.match(/^([A-Z][A-Z0-9_]*):(.*)$/);
        if (match)
            fields[match[1].toLowerCase()] = match[2];
    }
    return fields;
}

/**
 * Creates a multi-profile cookie manager for one site (youtube/tiktok/twitter/...).
 *
 * @param {object} opts
 * @param {string} opts.site - short key, e.g. 'youtube' -> settings keys `youtubeCookies` etc.
 * @param {string} opts.siteLabel - human-readable name for messages, e.g. 'YouTube'.
 * @param {string} opts.envVar - env var name for the static file fallback, e.g. 'YOUTUBE_COOKIES_FILE'.
 * @param {RegExp} opts.domainPattern - matched against a cookie line's domain field to validate content.
 * @param {RegExp} opts.invalidPattern - stderr pattern that means "this profile's cookie is dead".
 */
export function createCookieManager({ site, siteLabel, envVar, domainPattern, invalidPattern }) {
    const profilesKey = `${site}Cookies`;
    const rotationKey = `${site}CookieRotation`;
    const fileAlertKey = `${site}CookieAlert`;
    const materializedPaths = new Map(); // label -> { path, updatedAt }

    async function loadCookieProfiles() {
        const value = await store.getSetting(SETTINGS_SCOPE, profilesKey);
        return Array.isArray(value) ? value : [];
    }

    async function saveCookieProfiles(profiles) {
        await store.saveSetting(SETTINGS_SCOPE, profilesKey, profiles.length ? profiles : null);
    }

    async function saveCookiesSetting(content, label = DEFAULT_LABEL) {
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

    async function removeCookiesProfile(label) {
        const normalizedLabel = normalizeCookieLabel(label);
        const profiles = await loadCookieProfiles();
        const next = profiles.filter((p) => p.label !== normalizedLabel);
        const removed = next.length !== profiles.length;
        await saveCookieProfiles(next);
        return removed;
    }

    async function clearCookiesSetting() {
        await saveCookieProfiles([]);
        await store.saveSetting(SETTINGS_SCOPE, rotationKey, null);
        await store.saveSetting(SETTINGS_SCOPE, fileAlertKey, null);
    }

    async function listCookieProfiles() {
        const profiles = await loadCookieProfiles();
        return profiles.map(({ label, updatedAt, invalid, invalidAt }) => ({ label, updatedAt, invalid, invalidAt }));
    }

    function materializeProfile(profile) {
        const cached = materializedPaths.get(profile.label);
        if (cached?.updatedAt === profile.updatedAt)
            return cached.path;
        ensureTempDir();
        const filePath = path.join(TEMP_DIR, `${site}_cookies.${profile.label}.txt`);
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
        const rotation = (await store.getSetting(SETTINGS_SCOPE, rotationKey)) || { index: 0 };
        const index = rotation.index % pool.length;
        await store.saveSetting(SETTINGS_SCOPE, rotationKey, { index: (index + 1) % pool.length });
        const profile = pool[index];
        return { filePath: materializeProfile(profile), label: profile.label };
    }

    async function resolveCookies() {
        const picked = await pickCookieProfile();
        if (picked)
            return picked;
        const envPath = process.env[envVar];
        if (envPath && fs.existsSync(envPath))
            return { filePath: envPath, label: 'file' };
        return null;
    }

    async function notifyOwnerCookieInvalid(label, sock) {
        try {
            const t = createTranslator(config.defaultLanguage);
            const ownerJid = `${cleanJid(config.ownerNumber)}@s.whatsapp.net`;
            if (sock)
                await sock.sendMessage(ownerJid, { text: t('p.dlcookies.invalidAlert', { site: siteLabel, label }) });
        }
        catch (err) {
            console.error(`[${site}dlp] Failed to notify owner about invalid cookies:`, err.message);
        }
    }

    async function markCookiesInvalid(label, sock) {
        const now = Date.now();
        if (label === 'file') {
            const alert = await store.getSetting(SETTINGS_SCOPE, fileAlertKey);
            if (alert?.notifiedAt && (now - alert.notifiedAt) < COOKIE_ALERT_COOLDOWN_MS)
                return;
            await store.saveSetting(SETTINGS_SCOPE, fileAlertKey, { notifiedAt: now });
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

    async function isCookiesConfigured() {
        const profiles = await loadCookieProfiles();
        if (profiles.length)
            return { configured: true, source: 'db', count: profiles.length };
        const envPath = process.env[envVar];
        if (envPath && fs.existsSync(envPath))
            return { configured: true, source: 'file', path: envPath };
        return { configured: false };
    }

    function validateContent(content) {
        const text = String(content || '').trim();
        if (!text)
            return false;
        const dataLines = text.split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !(line.startsWith('#') && !line.startsWith('#HttpOnly_')));
        if (dataLines.length === 0)
            return false;
        let hasDomain = false;
        for (const line of dataLines) {
            const fields = line.replace(/^#HttpOnly_/, '').split('\t');
            if (fields.length !== 7)
                return false;
            if (domainPattern.test(fields[0]))
                hasDomain = true;
        }
        return hasDomain;
    }

    /** Checks stderr for this site's "cookie is dead" signal and flags+alerts if matched. */
    async function checkInvalid(cookies, stderr, sock) {
        if (cookies && invalidPattern.test(stderr))
            await markCookiesInvalid(cookies.label, sock);
    }

    return {
        saveCookiesSetting,
        removeCookiesProfile,
        clearCookiesSetting,
        listCookieProfiles,
        isCookiesConfigured,
        validateContent,
        resolveCookies,
        checkInvalid
    };
}

/**
 * Builds a download(url, {sock, args, timeout}) bound to a cookie manager,
 * running yt-dlp with --cookies attached when a profile is available.
 */
export function createDownloader(cookieManager, extraArgs = []) {
    return async function download(url, { sock, args, timeout }) {
        const cookies = await cookieManager.resolveCookies();
        const fullArgs = [
            '--no-playlist', '--no-warnings', '--no-progress',
            ...extraArgs,
            ...(cookies ? ['--cookies', cookies.filePath] : []),
            ...args,
            '--', url
        ];
        const { stdout, stderr, code, error } = await runYtDlp(fullArgs, { timeout });
        await cookieManager.checkInvalid(cookies, stderr, sock);
        if (error?.code === 'ENOENT')
            throw new Error('yt-dlp is not installed on this server');
        if (code !== 0)
            throw new Error(lastErrorLine(stderr) || error?.message || 'yt-dlp failed');
        const fields = parsePrintedFields(stdout);
        if (!fields.file || !fs.existsSync(fields.file))
            throw new Error('yt-dlp did not produce an output file');
        return {
            filePath: fields.file,
            title: fields.title || undefined,
            thumbnail: fields.thumb && fields.thumb !== 'NA' ? fields.thumb : undefined,
            fields,
            cleanup: () => fs.promises.unlink(fields.file).catch(() => {})
        };
    };
}

/**
 * Builds a fetchMetadata(url, printFields, {sock, timeout}) bound to a cookie
 * manager, for `--skip-download` lookups (title/uploader/date/thumbnail)
 * without actually downloading anything. `printFields` are plain
 * `%(field)s` templates (no `after_move:` stage prefix — nothing is moved).
 */
export function createMetadataFetcher(cookieManager, extraArgs = []) {
    return async function fetchMetadata(url, printFields, { sock, timeout = 20000 } = {}) {
        const cookies = await cookieManager.resolveCookies();
        const fullArgs = [
            '--skip-download', '--no-playlist', '--no-warnings',
            ...extraArgs,
            ...(cookies ? ['--cookies', cookies.filePath] : []),
            ...printFields.flatMap((f) => ['--print', f]),
            '--', url
        ];
        const { stdout, stderr, code, error } = await runYtDlp(fullArgs, { timeout });
        await cookieManager.checkInvalid(cookies, stderr, sock);
        if (error?.code === 'ENOENT')
            throw new Error('yt-dlp is not installed on this server');
        if (code !== 0)
            throw new Error(lastErrorLine(stderr) || error?.message || 'yt-dlp failed');
        return parsePrintedFields(stdout);
    };
}

export const PRINT_ARGS = [
    '--print', 'after_move:FILE:%(filepath)s',
    '--print', 'after_move:TITLE:%(title)s',
    '--print', 'after_move:THUMB:%(thumbnail)s'
];

// Raw yt-dlp/yt-dlp-core errors are English CLI output full of wiki links and
// flag hints ("Use --cookies-from-browser or --cookies for the
// authentication. See https://...") — not fit to show a WhatsApp user.
// Classifies the message into a short key so each plugin can render it via
// `t('p.ytdlpErrors.<key>')` in the chat's language, keeping any leading
// `[site] id:` prefix (useful for the owner to know which video failed).
const ERROR_PATTERNS = [
    [/sign in to confirm|for the authentication|only available for registered users|login.?required/i, 'loginRequired'],
    [/account cookies are no longer valid/i, 'cookieExpired'],
    [/private video/i, 'private'],
    [/video unavailable|this video is not available|has been removed/i, 'unavailable'],
    [/not available in your country|geo.?restrict/i, 'geoBlocked'],
    [/http error 429|rate.?limit/i, 'rateLimited'],
    [/no video could be found/i, 'noVideo'],
    [/unsupported url|is not a valid url/i, 'invalidUrl']
];

export function sanitizeYtDlpError(message) {
    const raw = String(message || '');
    const prefixMatch = raw.match(/^(\[[\w:]+\]\s*[\w-]+:\s*)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const rest = prefixMatch ? raw.slice(prefixMatch[1].length) : raw;
    const found = ERROR_PATTERNS.find(([pattern]) => pattern.test(rest));
    return { prefix, key: found ? found[1] : 'generic' };
}

/** Convenience wrapper: sanitize + translate in one call for plugin catch blocks. */
export function formatYtDlpError(err, t) {
    const { prefix, key } = sanitizeYtDlpError(err?.message);
    return `${prefix}${t(`p.ytdlpErrors.${key}`)}`;
}
