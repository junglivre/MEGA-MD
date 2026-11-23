// X/Twitter posts resolved through the public FxTwitter API (FxEmbed,
// https://docs.fxembed.com). It returns photos, videos and GIFs with direct
// twimg CDN URLs, which download fine from any IP; no cookies or yt-dlp needed.
import { withDownloadedMedia } from './remoteMedia.js';

const FX_API = 'https://api.fxtwitter.com/2/status';
const TIMEOUT_MS = 180000;
const METADATA_TIMEOUT_MS = 20000;
// Pick the best H.264 MP4 whose estimated size fits; the batch cap still applies.
const VIDEO_TARGET_BYTES = 100 * 1024 * 1024;
const TWEET_HOSTS = /^(?:www\.|mobile\.)?(?:twitter|x|fxtwitter|fixupx|vxtwitter|fixvx)\.com$/i;

export class TwitterError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

export function parseTweetId(input) {
    if (typeof input !== 'string' || !/^https?:\/\/\S+$/i.test(input.trim()))
        throw new TwitterError('invalidUrl', 'Invalid X/Twitter URL');
    const url = new URL(input.trim());
    if (!TWEET_HOSTS.test(url.hostname) || url.username || url.password || url.port)
        throw new TwitterError('invalidUrl', 'Invalid X/Twitter URL');
    const match = url.pathname.match(/^\/(?:[A-Za-z0-9_]{1,15}|i|i\/web)\/status(?:es)?\/(\d{1,20})(?:\/(?:photo|video)\/\d)?\/?$/);
    if (!match)
        throw new TwitterError('invalidUrl', 'Not an X/Twitter post URL');
    return match[1];
}

function pickVideoUrl(media) {
    const mp4 = (media.formats || [])
        .filter((f) => f.container === 'mp4' && typeof f.url === 'string' && Number(f.bitrate) > 0)
        .sort((a, b) => b.bitrate - a.bitrate);
    if (!mp4.length)
        return media.url;
    const duration = Number(media.duration) || 0;
    const fitting = mp4.find((f) => !duration || (f.bitrate * duration) / 8 <= VIDEO_TARGET_BYTES);
    return (fitting || mp4[mp4.length - 1]).url;
}

async function fetchStatus(id) {
    let res;
    try {
        res = await fetch(`${FX_API}/${id}`, { signal: AbortSignal.timeout(METADATA_TIMEOUT_MS) });
    }
    catch (error) {
        throw new TwitterError('unavailable', `FxTwitter request failed: ${error.message}`);
    }
    const body = await res.json().catch(() => null);
    // FxTwitter mirrors the real outcome in `code`, even when the HTTP status is 200.
    const code = Number(body?.code ?? res.status);
    if (code === 404)
        throw new TwitterError('notFound', 'Post not found');
    if (code === 401 || code === 403)
        throw new TwitterError('private', 'Post is private or restricted');
    if (code !== 200 || !body?.status)
        throw new TwitterError('unavailable', `FxTwitter returned ${code}`);
    return body.status;
}

/** Resolve a post's media in order, download it here, and keep the files only inside consume(). */
export async function withTweetMedia(input, consume) {
    if (typeof consume !== 'function')
        throw new TypeError('Tweet media consumer is required');
    const id = parseTweetId(input);
    const deadline = Date.now() + TIMEOUT_MS;
    const status = await fetchStatus(id);
    const all = Array.isArray(status.media?.all) ? status.media.all : [];
    const items = all
        .filter((m) => ['photo', 'video', 'gif'].includes(m?.type) && typeof m.url === 'string')
        .map((m, i) => ({
            index: i + 1,
            type: m.type === 'photo' ? 'image' : m.type,
            url: m.type === 'photo' ? m.url : pickVideoUrl(m)
        }));
    if (!items.length)
        throw new TwitterError('noMedia', 'Post has no photo or video');
    const meta = { author: status.author?.screen_name || '', text: status.text || '' };
    return withDownloadedMedia(items, { prefix: 'twitter', allowedHosts: ['twimg.com'], deadline }, (media) => consume(media, meta));
}
