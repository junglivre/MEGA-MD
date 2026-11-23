// Instagram posts/reels resolved through the public OGInstagram service
// (https://oginstagram.com, github.com/seirenkr/OGInstagram). Instagram sends
// datacenter IPs to its login wall; OGInstagram fetches from its own egress pool
// and exposes each post item as an ActivityStreams Note. We only resolve URLs
// there: the bytes come straight from Instagram's public CDN.
import { withDownloadedMedia } from './remoteMedia.js';

const OG_BASE = 'https://oginstagram.com';
const MAX_ITEMS = 20;
// OGInstagram clamps a requested item index to the post's length, so asking for
// the largest index it accepts returns the last item and, in its id, the total.
const OG_MAX_INDEX = 50;
const TIMEOUT_MS = 180000;
const METADATA_TIMEOUT_MS = 20000;
const METADATA_CONCURRENCY = 4;
const CDN_HOSTS = ['cdninstagram.com', 'fbcdn.net', 'oginstagram.com'];

export class InstagramError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function parseInstagramUrl(input) {
    if (typeof input !== 'string' || !/^https?:\/\/\S+$/i.test(input.trim()))
        throw new Error('Invalid Instagram URL');
    const url = new URL(input.trim());
    if (!['instagram.com', 'www.instagram.com', 'instagr.am', 'www.instagr.am'].includes(url.hostname.toLowerCase()) ||
        url.username || url.password || url.port || /[\\\s]/.test(input))
        throw new Error('Invalid Instagram URL');
    const match = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]{1,24})\/?$/i);
    if (!match)
        throw new Error('Invalid Instagram post URL');
    const type = match[1].toLowerCase();
    // OGInstagram routes /p/ and /reel/; IGTV shortcodes are ordinary post shortcodes.
    return { kind: type.startsWith('reel') ? 'reel' : 'p', code: match[2] };
}

export function normalizeInstagramUrl(input) {
    const { kind, code } = parseInstagramUrl(input);
    return `https://www.instagram.com/${kind}/${code}/`;
}

async function fetchItem(kind, code, index, deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
        throw new InstagramError('unavailable', 'Instagram lookup timed out');
    let res;
    try {
        res = await fetch(`${OG_BASE}/${kind}/${code}/${index}`, {
            headers: { Accept: 'application/activity+json' },
            signal: AbortSignal.timeout(Math.min(remaining, METADATA_TIMEOUT_MS))
        });
    }
    catch (error) {
        throw new InstagramError('unavailable', `OGInstagram request failed: ${error.message}`);
    }
    if (res.status === 404)
        throw new InstagramError('notFound', 'Instagram post not found');
    if (res.status === 451)
        throw new InstagramError('restricted', 'Instagram post is private or restricted');
    if (!res.ok)
        throw new InstagramError('unavailable', `OGInstagram returned HTTP ${res.status}`);
    const note = await res.json().catch(() => null);
    const idMatch = typeof note?.id === 'string' && note.id.match(/^https:\/\/oginstagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)\/(\d+)$/);
    const attachment = Array.isArray(note?.attachment) && note.attachment.length === 1 ? note.attachment[0] : null;
    if (note?.type !== 'Note' || !idMatch || idMatch[2] !== code || !attachment ||
        typeof attachment.url !== 'string' || !attachment.url.startsWith(`${OG_BASE}/`) ||
        !['image/jpeg', 'video/mp4'].includes(attachment.mediaType))
        throw new InstagramError('unavailable', 'OGInstagram returned an unexpected item');
    return {
        index: Number(idMatch[3]),
        url: attachment.url,
        type: attachment.mediaType === 'video/mp4' ? 'video' : 'image'
    };
}

/** Resolve a post's items in order, download them here, and keep the files only inside consume(). */
export async function withInstagramMedia(input, { maxItems = MAX_ITEMS } = {}, consume) {
    const { kind, code } = parseInstagramUrl(input);
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_ITEMS)
        throw new Error('Instagram media limit must be between 1 and 20');
    if (typeof consume !== 'function')
        throw new TypeError('Instagram media consumer is required');
    const deadline = Date.now() + TIMEOUT_MS;
    const last = await fetchItem(kind, code, OG_MAX_INDEX, deadline);
    const total = last.index;
    const count = Math.min(total, maxItems);
    const items = new Array(count);
    if (count === total)
        items[total - 1] = last;
    const pending = [];
    for (let i = 1; i <= count; i++) {
        if (!items[i - 1])
            pending.push(i);
    }
    while (pending.length) {
        const batch = pending.splice(0, METADATA_CONCURRENCY);
        const fetched = await Promise.all(batch.map((i) => fetchItem(kind, code, i, deadline)));
        for (const item of fetched) {
            if (item.index < 1 || item.index > count || items[item.index - 1])
                throw new InstagramError('unavailable', 'OGInstagram returned inconsistent item indexes');
            items[item.index - 1] = item;
        }
    }
    return withDownloadedMedia(items, { prefix: 'instagram', allowedHosts: CDN_HOSTS, deadline }, consume);
}
