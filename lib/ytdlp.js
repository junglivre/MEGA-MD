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
import { randomTempPath, createCookieManager, createDownloader, createMetadataFetcher, PRINT_ARGS } from './ytdlpCore.js';

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
const PLAYER_CLIENT_ARGS = ['--extractor-args', 'youtube:player_client=default,web_embedded'];
const download = createDownloader(cookieManager, PLAYER_CLIENT_ARGS);
const fetchMetadata = createMetadataFetcher(cookieManager, PLAYER_CLIENT_ARGS);

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

export async function downloadVideo(url, { sock, maxHeight = 480 } = {}) {
    const outputPath = randomTempPath('video.%(ext)s');
    return download(url, {
        sock,
        timeout: 240000,
        args: [
            '-f', `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]/best`,
            '--merge-output-format', 'mp4',
            ...PRINT_ARGS,
            '-o', outputPath
        ]
    });
}

export { cookieManager };
