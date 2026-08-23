import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const MAX_INPUT_PIXELS = 25_000_000;

export class ImageInputError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'ImageInputError';
        this.code = code;
    }
}

export function imageErrorKey(error) {
    if (error?.code === 'NO_IMAGE')
        return 'noImage';
    if (error?.code === 'ANIMATED_STICKER')
        return 'animatedSticker';
    return 'failed';
}

export function getImageMedia(message) {
    const current = message.message || {};
    const quoted = current.extendedTextMessage?.contextInfo?.quotedMessage || {};
    const image = current.imageMessage || quoted.imageMessage;
    if (image)
        return { media: image, type: 'image' };
    const sticker = current.stickerMessage || quoted.stickerMessage;
    if (sticker)
        return { media: sticker, type: 'sticker' };
    return null;
}

export async function downloadImage(message) {
    const target = getImageMedia(message);
    if (!target)
        throw new ImageInputError('NO_IMAGE', 'No image or sticker was provided');
    if (target.type === 'sticker' && target.media.isAnimated)
        throw new ImageInputError('ANIMATED_STICKER', 'Animated stickers are not supported');

    const stream = await downloadContentFromMessage(target.media, target.type);
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of stream) {
        totalBytes += chunk.length;
        if (totalBytes > MAX_MEDIA_BYTES)
            throw new ImageInputError('IMAGE_TOO_LARGE', 'Image exceeds the size limit');
        chunks.push(chunk);
    }
    if (totalBytes === 0)
        throw new ImageInputError('INVALID_IMAGE', 'Downloaded image is empty');
    return Buffer.concat(chunks);
}

async function normalizedImage(input, maxDimension = 1280) {
    return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({
            width: maxDimension,
            height: maxDimension,
            fit: 'inside',
            withoutEnlargement: true
        })
        .ensureAlpha()
        .png()
        .toBuffer({ resolveWithObject: true });
}

export async function mirrorImage(input, side) {
    if (side !== 'left' && side !== 'right')
        throw new TypeError('Mirror side must be left or right');
    const { data, info } = await normalizedImage(input);
    const halfWidth = Math.ceil(info.width / 2);
    const sourceLeft = side === 'left' ? 0 : info.width - halfWidth;
    const targetLeft = info.width - halfWidth;
    const half = await sharp(data)
        .extract({ left: sourceLeft, top: 0, width: halfWidth, height: info.height })
        .png()
        .toBuffer();
    const flipped = await sharp(half).flop().png().toBuffer();
    const layers = side === 'left'
        ? [{ input: half, left: 0, top: 0 }, { input: flipped, left: targetLeft, top: 0 }]
        : [{ input: flipped, left: 0, top: 0 }, { input: half, left: targetLeft, top: 0 }];
    return sharp({
        create: {
            width: info.width,
            height: info.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    }).composite(layers).png().toBuffer();
}

export async function invertImage(input) {
    const { data } = await normalizedImage(input);
    return sharp(data).negate({ alpha: false }).png().toBuffer();
}

function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

export async function createAsciiImage(input, { columns = 72, invert = false } = {}) {
    const safeColumns = Math.max(24, Math.min(120, Number(columns) || 72));
    const normalized = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: safeColumns, height: 72, fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const ramp = invert ? ' .:-=+*#%@' : '@%#*+=-:. ';
    const lines = [];
    for (let y = 0; y < normalized.info.height; y++) {
        let line = '';
        for (let x = 0; x < normalized.info.width; x++) {
            const value = normalized.data[y * normalized.info.width + x];
            line += ramp[Math.round((value / 255) * (ramp.length - 1))];
        }
        lines.push(line.trimEnd());
    }
    const fontSize = 12;
    const lineHeight = 12;
    const padding = 16;
    const width = Math.max(160, Math.ceil(normalized.info.width * 7.25) + padding * 2);
    const height = Math.max(80, lines.length * lineHeight + padding * 2);
    const text = lines.map((line, index) => (
        `<text x="${padding}" y="${padding + fontSize + index * lineHeight}">${escapeXml(line || ' ')}</text>`
    )).join('');
    const svg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
        + '<rect width="100%" height="100%" fill="#101216"/>'
        + `<g fill="#f4f4f5" font-family="DejaVu Sans Mono,monospace" font-size="${fontSize}px" xml:space="preserve">${text}</g>`
        + '</svg>'
    );
    return sharp(svg).png().toBuffer();
}

export async function createToBeContinuedImage(input, label = 'TO BE CONTINUED') {
    const { data, info } = await normalizedImage(input);
    const fontSize = Math.max(22, Math.min(64, Math.round(info.width * 0.065)));
    const bandHeight = Math.max(64, Math.min(150, Math.round(info.height * 0.24)));
    const top = info.height - bandHeight;
    const safeLabel = escapeXml(label.toUpperCase());
    const overlay = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">`
        + `<rect x="0" y="${top}" width="100%" height="${bandHeight}" fill="#17120d" fill-opacity="0.68"/>`
        + `<line x1="${Math.round(info.width * 0.07)}" y1="${top + Math.round(bandHeight * 0.3)}" `
        + `x2="${Math.round(info.width * 0.93)}" y2="${top + Math.round(bandHeight * 0.3)}" stroke="#f3dfaa" stroke-width="3"/>`
        + `<text x="${Math.round(info.width * 0.07)}" y="${top + Math.round(bandHeight * 0.72)}" `
        + `font-family="DejaVu Serif,serif" font-size="${fontSize}" font-weight="700" font-style="italic" `
        + `fill="#f3dfaa">${safeLabel}</text>`
        + `<path d="M ${Math.round(info.width * 0.79)} ${top + Math.round(bandHeight * 0.72)} `
        + `H ${Math.round(info.width * 0.92)} L ${Math.round(info.width * 0.87)} ${top + Math.round(bandHeight * 0.55)} `
        + `M ${Math.round(info.width * 0.92)} ${top + Math.round(bandHeight * 0.72)} `
        + `L ${Math.round(info.width * 0.87)} ${top + Math.round(bandHeight * 0.89)}" `
        + 'fill="none" stroke="#f3dfaa" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        + '</svg>'
    );
    return sharp(data)
        .recomb([
            [0.393, 0.769, 0.189],
            [0.349, 0.686, 0.168],
            [0.272, 0.534, 0.131]
        ])
        .composite([{ input: overlay }])
        .png()
        .toBuffer();
}

export async function createForgivenessImage(input, labels = {}) {
    const question = escapeXml(labels.question || 'UM MONSTRO DESSES MERECE PERDÃO?');
    const no = escapeXml(labels.no || 'NÃO');
    const yes = escapeXml(labels.yes || 'SIM');
    const { data, info } = await normalizedImage(input);
    const panelHeight = Math.max(105, Math.min(210, Math.round(info.width * 0.28)));
    const desiredFontSize = Math.max(16, Math.min(42, Math.round(info.width * 0.045)));
    const fittedFontSize = Math.floor((info.width * 0.88) / (Math.max(1, [...question].length) * 0.72));
    const fontSize = Math.max(14, Math.min(desiredFontSize, fittedFontSize));
    const buttonFontSize = Math.max(16, Math.round(fontSize * 0.85));
    const panel = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${panelHeight}">`
        + '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
        + '<stop offset="0" stop-color="#111936"/><stop offset="1" stop-color="#341852"/></linearGradient></defs>'
        + '<rect width="100%" height="100%" fill="url(#bg)"/>'
        + '<rect x="0" y="0" width="100%" height="5" fill="#a78bfa"/>'
        + `<text x="50%" y="${Math.round(panelHeight * 0.34)}" text-anchor="middle" `
        + `font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" `
        + `fill="white">${question}</text>`
        + `<rect x="${Math.round(info.width * 0.08)}" y="${Math.round(panelHeight * 0.53)}" `
        + `width="${Math.round(info.width * 0.37)}" height="${Math.round(panelHeight * 0.32)}" rx="10" fill="#b91c1c"/>`
        + `<rect x="${Math.round(info.width * 0.55)}" y="${Math.round(panelHeight * 0.53)}" `
        + `width="${Math.round(info.width * 0.37)}" height="${Math.round(panelHeight * 0.32)}" rx="10" fill="#15803d"/>`
        + `<text x="${Math.round(info.width * 0.265)}" y="${Math.round(panelHeight * 0.75)}" text-anchor="middle" `
        + `font-family="DejaVu Sans,Arial,sans-serif" font-size="${buttonFontSize}" font-weight="900" fill="white">${no}</text>`
        + `<text x="${Math.round(info.width * 0.735)}" y="${Math.round(panelHeight * 0.75)}" text-anchor="middle" `
        + `font-family="DejaVu Sans,Arial,sans-serif" font-size="${buttonFontSize}" font-weight="900" fill="white">${yes}</text>`
        + '</svg>'
    );
    return sharp({
        create: {
            width: info.width,
            height: info.height + panelHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
    }).composite([
        { input: data, left: 0, top: 0 },
        { input: panel, left: 0, top: info.height }
    ]).png().toBuffer();
}

function triggeredLabel(width, height) {
    const fontSize = Math.max(28, Math.floor(height * 0.7));
    return Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
        + '<rect width="100%" height="100%" fill="#d71920"/>'
        + `<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" `
        + `font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="900" font-style="italic" `
        + 'fill="white" stroke="black" stroke-width="3" paint-order="stroke">TRIGGERED</text></svg>'
    );
}

export async function createTriggeredGif(input) {
    const { data, info } = await normalizedImage(input, 720);
    const frameWidth = info.width;
    const imageHeight = info.height;
    const labelHeight = Math.max(42, Math.min(96, Math.round(frameWidth * 0.15)));
    const frameHeight = imageHeight + labelHeight;
    const shake = Math.max(2, Math.round(Math.min(frameWidth, imageHeight) * 0.025));
    const offsets = [
        [0, shake], [shake * 2, 0], [shake, shake * 2],
        [shake * 2, shake], [0, 0], [shake, 0]
    ];
    const enlarged = await sharp(data)
        .resize(frameWidth + shake * 2, imageHeight + shake * 2, { fit: 'fill' })
        .modulate({ saturation: 1.35 })
        .png()
        .toBuffer();
    const tint = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${imageHeight}">`
        + '<rect width="100%" height="100%" fill="#ff0000" fill-opacity="0.28"/></svg>'
    );
    const label = triggeredLabel(frameWidth, labelHeight);
    const frames = [];
    for (const [left, top] of offsets) {
        const imageFrame = await sharp(enlarged)
            .extract({ left, top, width: frameWidth, height: imageHeight })
            .composite([{ input: tint, blend: 'over' }])
            .png()
            .toBuffer();
        frames.push(await sharp({
            create: {
                width: frameWidth,
                height: frameHeight,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1 }
            }
        }).composite([
            { input: imageFrame, left: 0, top: 0 },
            { input: label, left: 0, top: imageHeight }
        ]).png().toBuffer());
    }
    const strip = sharp({
        create: {
            width: frameWidth,
            height: frameHeight * frames.length,
            pageHeight: frameHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
    }).composite(frames.map((frame, index) => ({ input: frame, left: 0, top: frameHeight * index })));
    return strip.gif({ loop: 0, delay: offsets.map(() => 70), effort: 3, colours: 128 }).toBuffer();
}

export async function gifToMp4(gifBuffer) {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const id = crypto.randomUUID();
    const inputPath = path.join(tempDir, `triggered-${id}.gif`);
    const outputPath = path.join(tempDir, `triggered-${id}.mp4`);
    try {
        await fs.writeFile(inputPath, gifBuffer);
        await execFileAsync('ffmpeg', [
            '-loglevel', 'error', '-y', '-i', inputPath,
            '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', outputPath
        ], { timeout: 60_000, maxBuffer: 1024 * 1024 });
        return await fs.readFile(outputPath);
    }
    finally {
        await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
    }
}
