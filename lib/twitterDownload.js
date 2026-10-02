// Twitter/X download helper backed by the local `yt-dlp` binary, replacing
// the discardapi.dpdns.org dependency in plugins/twitter.js. Cookies help
// with age-restricted, NSFW-marked and protected-account tweets, which
// otherwise return "This video is only available for registered users".
//
// Like TikTok, Twitter has no precise "cookie rotated" string; this reuses
// yt-dlp's generic login/auth-required hint as a best-effort signal.
import { randomTempPath, createCookieManager, createDownloader, PRINT_ARGS } from './ytdlpCore.js';

const AUTH_HINT_RE = /for the authentication|only available for registered users|http error 401/i;

const cookieManager = createCookieManager({
    site: 'twitter',
    siteLabel: 'Twitter/X',
    envVar: 'TWITTER_COOKIES_FILE',
    domainPattern: /(^|\.)(twitter|x)\.com$/i,
    invalidPattern: AUTH_HINT_RE
});

const download = createDownloader(cookieManager);

export async function downloadTwitterMedia(url, { sock } = {}) {
    const outputPath = randomTempPath('video.%(ext)s');
    return download(url, {
        sock,
        timeout: 120000,
        args: [
            '-f', 'bv*+ba/b',
            '--merge-output-format', 'mp4',
            ...PRINT_ARGS,
            '-o', outputPath
        ]
    });
}

export { cookieManager };
