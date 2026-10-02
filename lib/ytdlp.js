// YouTube download helper backed by the local `yt-dlp` binary.
//
// Replaces the previous reliance on a third-party HTTP API: that API's
// "downloadUrl" started redirecting through an ad network instead of
// serving media bytes, breaking `.play`/`.song`/`.video` entirely. yt-dlp
// runs locally (ffmpeg is already a hard dependency of this project) and
// uses YouTube cookies to look like a logged-in browser — on datacenter
// VPS IPs this isn't optional, every anonymous client gets LOGIN_REQUIRED.
//
// Cookies can come from two places, DB profiles take priority:
//   1. `.dlcookies youtube set [label]` (owner command) — one or more labeled
//      cookie profiles stored via lightweight_store, rotated round-robin
//      on each download to spread load across accounts. Survives
//      redeploys even on platforms with an ephemeral filesystem.
//   2. `YOUTUBE_COOKIES_FILE` env var — a single static Netscape-format
//      cookies.txt path on disk, used only when no DB profile exists yet.
//
// Generic cookie-profile storage/rotation/invalid-detection lives in
// lib/ytdlpCore.js, shared with lib/tiktokDownload.js and lib/twitterDownload.js.
import fs from 'fs';
import { randomTempPath, createCookieManager, createDownloader, createMetadataFetcher, createFormatLister, PRINT_ARGS } from './ytdlpCore.js';

// Exact wording yt-dlp uses (yt_dlp/extractor/youtube/_base.py) when a
// previously-working cookie jar gets rejected mid-session.
const COOKIE_INVALID_RE = /youtube account cookies are no longer valid/i;

const cookieManager = createCookieManager({
    site: 'youtube',
    siteLabel: 'YouTube',
    envVar: 'YOUTUBE_COOKIES_FILE',
    domainPattern: /(^|\.)(youtube|google)\.com$/i,
    invalidPattern: COOKIE_INVALID_RE
});

// Workaround for yt-dlp/yt-dlp#17389 (open as of 2026-09-27, confirmed by a
// yt-dlp maintainer): when cookies are attached, yt-dlp defaults to the
// "tv_downgraded" client, whose TVHTML5 player JS uses a signatureTimestamp
// that yt-dlp-ejs can't solve yet. Every format comes back UNPLAYABLE and
// yt-dlp raises the generic "The page needs to be reloaded." error. Forcing
// `default,web_embedded` keeps the normal client list but adds a working
// fallback, matching the maintainer-confirmed fix in that issue.
//
// `lang=pt` works around a separate yt-dlp default: when no `lang` arg is
// given, yt-dlp sends `hl=en` to YouTube's API (yt_dlp/extractor/youtube/
// _base.py: `hl: self._preferred_lang or 'en'`). For channels that opted
// into YouTube's translated-metadata feature, that silently swaps the
// original (often Portuguese) title/description for the English version.
// `pt` matches this bot's audience and avoids that default.
const PLAYER_CLIENT_ARGS = ['--extractor-args', 'youtube:player_client=default,web_embedded;lang=pt'];
const download = createDownloader(cookieManager, PLAYER_CLIENT_ARGS);
const fetchMetadata = createMetadataFetcher(cookieManager, PLAYER_CLIENT_ARGS);
const listFormats = createFormatLister(cookieManager, PLAYER_CLIENT_ARGS);

// Lightweight `--skip-download` lookup for title/uploader/upload date/thumbnail,
// used to show video info before and after the real download (e.g. plugins/video.js).
export async function getVideoMetadata(url, { sock } = {}) {
    const fields = await fetchMetadata(url, [
        'TITLE:%(title)s',
        'UPLOADER:%(uploader)s',
        'UPLOADDATE:%(upload_date)s',
        'THUMB:%(thumbnail)s'
    ], { sock });
    const uploadDate = fields.uploaddate && /^\d{8}$/.test(fields.uploaddate)
        ? `${fields.uploaddate.slice(6, 8)}/${fields.uploaddate.slice(4, 6)}/${fields.uploaddate.slice(0, 4)}`
        : undefined;
    return {
        title: fields.title && fields.title !== 'NA' ? fields.title : undefined,
        uploader: fields.uploader && fields.uploader !== 'NA' ? fields.uploader : undefined,
        uploadDate,
        thumbnail: fields.thumb && fields.thumb !== 'NA' ? fields.thumb : undefined
    };
}

export async function downloadAudio(url, { sock } = {}) {
    const outputPath = randomTempPath('audio.%(ext)s');
    return download(url, {
        sock,
        timeout: 180000,
        args: [
            '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '5',
            ...PRINT_ARGS,
            '-o', outputPath
        ]
    });
}

// Standard height tiers tried in order; `.video <link> <quality>` picks the
// starting tier, the 150MB cap (see downloadVideo) steps further down from there.
export const VIDEO_QUALITY_TIERS = [1080, 720, 480, 360, 240, 144];

// `bv*[height<=X]+ba/b[height<=X]/best` (the old selector) let yt-dlp pick
// whatever has the best bitrate at that height, which on current YouTube is
// often AV1 video + Opus audio remuxed into a ".mp4" that only behaves
// because lenient players (VLC, desktop Chrome) decode it despite the
// extension — WhatsApp's mobile player does not, so the file "works on PC,
// not on phone". `[vcodec^=avc1]` + `[acodec^=mp4a]` forces H.264 + AAC,
// the one combo every platform's MP4 decoder actually supports.
function videoFormatSelector(height) {
    return `bv*[vcodec^=avc1][height<=${height}]+ba[acodec^=mp4a]/b[vcodec^=avc1][height<=${height}]/best[height<=${height}]`;
}

/**
 * Downloads at the highest available tier up to `maxHeight` (default 1080p,
 * YouTube's effective ceiling for H.264), stepping down through
 * VIDEO_QUALITY_TIERS while the resulting file exceeds `maxSizeMB` (default
 * 150MB) — checked against the real downloaded file, not an estimate.
 */
export async function downloadVideo(url, { sock, maxHeight = 1080, maxSizeMB = 150 } = {}) {
    const tiers = VIDEO_QUALITY_TIERS.filter((h) => h <= maxHeight);
    if (!tiers.length)
        tiers.push(VIDEO_QUALITY_TIERS[VIDEO_QUALITY_TIERS.length - 1]);
    let result;
    for (let i = 0; i < tiers.length; i++) {
        const outputPath = randomTempPath('video.%(ext)s');
        result = await download(url, {
            sock,
            timeout: 240000,
            args: [
                '-f', videoFormatSelector(tiers[i]),
                '--merge-output-format', 'mp4',
                ...PRINT_ARGS,
                '-o', outputPath
            ]
        });
        const sizeMB = fs.statSync(result.filePath).size / (1024 * 1024);
        const isLastTier = i === tiers.length - 1;
        if (sizeMB <= maxSizeMB || isLastTier)
            return result;
        await result.cleanup();
    }
    return result;
}

/**
 * Lists the H.264 (avc1) heights actually available for this specific video,
 * capped at 1080p — used by `.video -custom` to show real options instead of
 * the static VIDEO_QUALITY_TIERS list (which may include heights this video
 * doesn't have, or miss an odd one it does). Falls back to any codec's
 * heights if the video has no avc1 formats at all (rare).
 */
export async function getAvailableQualities(url, { sock } = {}) {
    const data = await listFormats(url, { sock });
    const formats = Array.isArray(data?.formats) ? data.formats : [];
    const collect = (predicate) => {
        const heights = new Set();
        for (const f of formats) {
            if (f.height && predicate(f))
                heights.add(f.height);
        }
        return heights;
    };
    let heights = collect((f) => typeof f.vcodec === 'string' && f.vcodec.startsWith('avc1'));
    if (!heights.size)
        heights = collect(() => true);
    return [...heights].filter((h) => h <= 1080).sort((a, b) => b - a);
}

export { cookieManager };
