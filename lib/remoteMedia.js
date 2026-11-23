// Downloads a resolved list of media URLs (from OGInstagram / FxTwitter) into a
// private temp directory, checks every file's real bytes, hands the local files
// to `consume`, and always deletes them afterwards.
import fs from 'fs';
import path from 'path';
import { TEMP_DIR } from './paths.js';

export const MAX_BATCH_BYTES = 150 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function sniff(header) {
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff)
        return { kind: 'image', mimetype: 'image/jpeg', ext: 'jpg' };
    if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        return { kind: 'image', mimetype: 'image/png', ext: 'png' };
    if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP')
        return { kind: 'image', mimetype: 'image/webp', ext: 'webp' };
    if (header.toString('ascii', 4, 8) === 'ftyp')
        return { kind: 'video', mimetype: 'video/mp4', ext: 'mp4' };
    return null;
}

function hostAllowed(url, allowedHosts) {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
    return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

async function downloadOne(item, filePath, { allowedHosts, budget, deadline }) {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
        throw new Error('Media download timed out');
    const res = await fetch(item.url, {
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(Math.min(remaining, 90000))
    });
    if (!res.ok)
        throw new Error(`Media download failed with HTTP ${res.status}`);
    // The resolver hands out its own redirector URL; the bytes must come from the platform CDN.
    if (!hostAllowed(res.url, allowedHosts))
        throw new Error('Media redirected to an untrusted host');
    const declared = Number(res.headers.get('content-length'));
    if (declared && declared > budget.left)
        throw new Error('Media exceeds the 150 MiB batch limit');
    const out = fs.createWriteStream(filePath, { mode: 0o600 });
    let written = 0;
    try {
        for await (const chunk of res.body) {
            written += chunk.length;
            if (written > budget.left)
                throw new Error('Media exceeds the 150 MiB batch limit');
            if (!out.write(chunk))
                await new Promise((resolve) => out.once('drain', resolve));
        }
    }
    finally {
        await new Promise((resolve) => out.end(resolve));
    }
    budget.left -= written;
    if (!written)
        throw new Error('Media download was empty');
    const header = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    try {
        fs.readSync(fd, header, 0, header.length, 0);
    }
    finally {
        fs.closeSync(fd);
    }
    const detected = sniff(header);
    // A video slot that returns an image is a thumbnail, never the media itself.
    if (!detected || detected.kind !== (item.type === 'image' ? 'image' : 'video'))
        throw new Error(`Media ${item.index} is not a valid ${item.type}`);
    const finalPath = `${filePath}.${detected.ext}`;
    fs.renameSync(filePath, finalPath);
    return { path: finalPath, type: item.type, mimetype: detected.mimetype, index: item.index, bytes: written };
}

/**
 * @param {{url: string, type: 'image'|'video'|'gif', index: number}[]} items in send order
 * @param {{prefix: string, allowedHosts: string[], deadline: number}} options
 * @param {(media: {path: string, type: string, mimetype: string, index: number, bytes: number}[]) => Promise<any>} consume
 */
export async function withDownloadedMedia(items, { prefix, allowedHosts, deadline }, consume) {
    if (!items.length)
        throw new Error('No media to download');
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const root = fs.mkdtempSync(path.join(TEMP_DIR, `${prefix}_`));
    try {
        const budget = { left: MAX_BATCH_BYTES };
        const media = [];
        // Sequential keeps the byte budget exact and avoids hammering the CDN.
        for (const item of items)
            media.push(await downloadOne(item, path.join(root, String(item.index)), { allowedHosts, budget, deadline }));
        return await consume(media);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}
