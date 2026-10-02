// TikTok download helper backed by the local `yt-dlp` binary, replacing the
// discardapi.onrender.com dependency in plugins/tiktok.js. Cookies are
// optional for TikTok (most public videos download fine anonymously) but
// help with age/region-gated content and reduce rate limiting.
//
// TikTok has no single documented "cookie rotated" error string like
// YouTube's, so invalid-cookie detection here is best-effort: it matches
// yt-dlp's generic login/auth-required hint. A profile may occasionally get
// flagged on an unrelated failure (deleted video, TikTok-side rate limit);
// `.dlcookies tiktok set <label>` again clears the flag.
import { randomTempPath, createCookieManager, createDownloader, PRINT_ARGS } from './ytdlpCore.js';

const AUTH_HINT_RE = /for the authentication|login required|verify you.{0,15}human|captcha/i;

const cookieManager = createCookieManager({
    site: 'tiktok',
    siteLabel: 'TikTok',
    envVar: 'TIKTOK_COOKIES_FILE',
    domainPattern: /(^|\.)tiktok\.com$/i,
    invalidPattern: AUTH_HINT_RE
});

const download = createDownloader(cookieManager);

export async function downloadTikTok(url, { sock } = {}) {
    const outputPath = randomTempPath('video.%(ext)s');
    return download(url, {
        sock,
        timeout: 120000,
        args: [
            '-f', 'bv*+ba/b',
            '--merge-output-format', 'mp4',
            ...PRINT_ARGS,
            '--print', 'after_move:UPLOADER:%(uploader)s',
            '--print', 'after_move:LIKES:%(like_count)s',
            '--print', 'after_move:COMMENTS:%(comment_count)s',
            '--print', 'after_move:SHARES:%(repost_count)s',
            '--print', 'after_move:VIEWS:%(view_count)s',
            '--print', 'after_move:TRACK:%(track)s',
            '-o', outputPath
        ]
    });
}

export { cookieManager };
