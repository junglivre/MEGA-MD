import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TEMP_DIR } from './paths.js';

const MAX_ITEMS = 20;
const MAX_BYTES = 150 * 1024 * 1024;
const TIMEOUT_MS = 180000;
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);

export function normalizeInstagramUrl(input) {
    if (typeof input !== 'string' || !/^https?:\/\/\S+$/i.test(input.trim()))
        throw new Error('Invalid Instagram URL');
    const url = new URL(input.trim());
    if (!['instagram.com', 'www.instagram.com', 'instagr.am', 'www.instagr.am'].includes(url.hostname.toLowerCase()) ||
        url.username || url.password || url.port || /[\\\s]/.test(input))
        throw new Error('Invalid Instagram URL');
    const match = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)\/?$/i);
    if (!match)
        throw new Error('Invalid Instagram post URL');
    const kind = match[1].toLowerCase() === 'reels' ? 'reel' : match[1].toLowerCase();
    return `https://www.instagram.com/${kind}/${match[2]}/`;
}

function checkDownloadSize(directory) {
    let total = 0;
    for (const name of fs.readdirSync(directory)) {
        const stat = fs.lstatSync(path.join(directory, name));
        if (!stat.isFile() || stat.isSymbolicLink())
            throw new Error('Unexpected Instagram download entry');
        total += stat.size;
        if (total > MAX_BYTES)
            throw new Error('Instagram download exceeds the 150 MiB batch limit');
    }
}

function runDownloader(binary, args, directory, timeout) {
    if (timeout <= 0)
        throw new Error('Instagram download timed out');
    return new Promise((resolve, reject) => {
        let limitError;
        const child = execFile(binary, args, {
            timeout,
            killSignal: 'SIGKILL',
            maxBuffer: 4 * 1024 * 1024,
            windowsHide: true
        }, (error, stdout) => {
            clearInterval(monitor);
            if (limitError)
                reject(limitError);
            else if (error)
                // Do not log stderr: it can include signed CDN URLs or cookie data.
                reject(new Error(error.code === 'ENOENT'
                    ? `${binary} is not installed`
                    : error.killed || error.signal
                        ? 'Instagram download timed out or was interrupted'
                        : 'Instagram extraction/download failed (login, rate limit, or unavailable media)', { cause: error.code }));
            else
                resolve(stdout || '');
        });
        // Content-Length can be absent; enforce a batch cap while bytes are written.
        // The CLI rate limit bounds overshoot between these checks to about 1 MiB.
        const monitor = setInterval(() => {
            try {
                checkDownloadSize(directory);
            }
            catch (error) {
                limitError = error;
                child.kill('SIGKILL');
            }
        }, 100);
        monitor.unref();
    });
}

function collectMedia(directory, maxItems) {
    checkDownloadSize(directory);
    const names = fs.readdirSync(directory);
    const metadataFiles = names.filter((name) => /^\d+\.(jpg|jpeg|png|webp|mp4|mov|webm)\.json$/.test(name));
    if (!metadataFiles.length || metadataFiles.length > maxItems || names.length !== metadataFiles.length * 2)
        throw new Error('Instagram returned no complete downloadable media batch');
    let expectedCount;
    const media = metadataFiles.map((name) => {
        const metadata = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
        const index = metadata.num ?? 1;
        const count = metadata.count;
        const extension = name.split('.')[1];
        const filePath = path.join(directory, name.slice(0, -5));
        const stat = fs.lstatSync(filePath);
        if (!Number.isInteger(index) || index < 1 || !Number.isInteger(count) || count < 1 ||
            (expectedCount !== undefined && expectedCount !== count) || !stat.isFile() || stat.isSymbolicLink() || !stat.size)
            throw new Error('Instagram returned inconsistent media metadata');
        expectedCount = count;
        const isVideo = VIDEO_EXTENSIONS.has(extension);
        if ((!isVideo && !IMAGE_EXTENSIONS.has(extension)) ||
            (!isVideo && (metadata.video_url || metadata.typename === 'GraphVideo' || metadata.type === 'reel')))
            throw new Error('Instagram returned a video preview instead of the video');
        const header = Buffer.alloc(12);
        const fd = fs.openSync(filePath, 'r');
        try {
            fs.readSync(fd, header, 0, header.length, 0);
        }
        finally {
            fs.closeSync(fd);
        }
        const valid = isVideo
            ? (extension === 'webm' ? header.readUInt32BE(0) === 0x1a45dfa3 : header.toString('ascii', 4, 8) === 'ftyp')
            : extension === 'png' ? header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                : extension === 'webp' ? header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
                    : header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
        if (!valid)
            throw new Error('Instagram returned invalid media bytes');
        return { path: filePath, type: isVideo ? 'video' : 'image', mimetype: isVideo ? `video/${extension === 'mov' ? 'quicktime' : extension}` : `image/${extension === 'jpg' ? 'jpeg' : extension}`, index };
    }).sort((a, b) => a.index - b.index);
    if (media.length !== Math.min(expectedCount, maxItems) || media.some((item, i) => item.index !== i + 1))
        throw new Error('Instagram download is incomplete');
    return media;
}

async function downloadSingleVideo(url, directory, cookiesFile, deadline) {
    const commonArgs = [
        '--ignore-config', '--no-cache-dir', '--no-warnings', '--no-progress',
        '--no-playlist', '--retries', '1', '--socket-timeout', '30',
        '--max-filesize', String(MAX_BYTES), '--limit-rate', '8M',
        ...(cookiesFile ? ['--cookies', cookiesFile] : [])
    ];
    // Instagram often serves separate DASH video/audio; merge into H.264/AAC MP4.
    const formatArgs = ['-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b', '--merge-output-format', 'mp4'];
    const stdout = await runDownloader('yt-dlp', [
        ...commonArgs, '--dump-single-json', '--skip-download', ...formatArgs, url
    ], directory, Math.min(45000, deadline - Date.now()));
    const info = JSON.parse(stdout);
    // A carousel can contain photos and videos. Never accept only the video
    // subset that a video extractor might return, even for a one-entry playlist.
    // yt-dlp often leaves duration empty until the DASH manifest is parsed, so
    // require a real video format instead; photo posts error and carousels are playlists.
    if (!info || (info._type && info._type !== 'video') || info.entries ||
        !Array.isArray(info.formats) ||
        !info.formats.some((format) => format.ext === 'mp4' && format.vcodec && format.vcodec !== 'none' &&
            (format.height > 0 || format.width > 0)))
        throw new Error('Instagram fallback requires a complete single video, not a photo or carousel');
    const infoPath = path.join(directory, 'native-info.json');
    fs.writeFileSync(infoPath, stdout, { mode: 0o600 });
    await runDownloader('yt-dlp', [
        ...commonArgs, '--load-info-json', infoPath, ...formatArgs,
        '-o', path.join(directory, '1.%(ext)s')
    ], directory, deadline - Date.now());
    fs.unlinkSync(infoPath);
    fs.writeFileSync(path.join(directory, '1.mp4.json'), JSON.stringify({
        num: 1, count: 1, video_url: true
    }));
}

/** Extract and download on the same machine; local files live only inside consume(). */
export async function withInstagramMedia(input, { maxItems = MAX_ITEMS, cookiesFile = process.env.INSTAGRAM_COOKIES_FILE } = {}, consume) {
    const url = normalizeInstagramUrl(input);
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_ITEMS)
        throw new Error('Instagram media limit must be between 1 and 20');
    if (typeof consume !== 'function')
        throw new TypeError('Instagram media consumer is required');
    if (cookiesFile && !fs.statSync(cookiesFile).isFile())
        throw new Error('Instagram cookies file is not a regular file');
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const root = fs.mkdtempSync(path.join(TEMP_DIR, 'instagram_'));
    const directory = path.join(root, 'media');
    const deadline = Date.now() + TIMEOUT_MS;
    try {
        fs.mkdirSync(directory);
        // yt-dlp can update its cookie jar on exit. Never mutate the source.
        const privateCookies = cookiesFile ? path.join(root, 'cookies.txt') : undefined;
        if (privateCookies) {
            fs.copyFileSync(cookiesFile, privateCookies);
            fs.chmodSync(privateCookies, 0o600);
        }
        let media;
        try {
            await runDownloader('gallery-dl', [
                '--config-ignore', '--no-input', '--no-colors', '--quiet',
                '--directory', directory, '--filename', '{media_id}.{extension}',
                '--write-metadata', '--range', `1-${maxItems}`,
                '--filesize-max', String(MAX_BYTES), '--limit-rate', '8M',
                '--http-timeout', '30', '--retries', '1',
                '-o', 'extractor.instagram.videos=merged',
                '-o', 'extractor.instagram.previews=false',
                '-o', 'extractor.instagram.audio=false',
                '-o', 'extractor.instagram.order-files=asc',
                ...(privateCookies ? ['--cookies', privateCookies] : []),
                url
            ], directory, Math.min(90000, deadline - Date.now()));
            media = collectMedia(directory, maxItems);
        }
        catch (error) {
            // Metadata is written only after a successful gallery download.
            // Never hide a partial carousel failure with a video-only fallback.
            if (fs.readdirSync(directory).some((name) => name.endsWith('.json')))
                throw error;
            checkDownloadSize(directory);
            fs.rmSync(directory, { recursive: true, force: true });
            fs.mkdirSync(directory);
            await downloadSingleVideo(url, directory, privateCookies, deadline);
            media = collectMedia(directory, maxItems);
        }
        return await consume(media);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}
