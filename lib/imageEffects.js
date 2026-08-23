import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import { getAlternateJid, normalizeJid, participantMatches } from './jid.js';

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
    if (error?.code === 'NO_PROFILE_PICTURE')
        return 'noProfilePicture';
    if (error?.code === 'ANIMATED_STICKER')
        return 'animatedSticker';
    return 'failed';
}

export function imageErrorReply(error, t, failedKey = 'p.imagefx.failed') {
    const key = imageErrorKey(error);
    return {
        key,
        text: key === 'failed' ? `❌ ${t(failedKey)}` : t(`p.imagefx.${key}`)
    };
}

export function getMentionedJids(message) {
    const current = message.message || {};
    const contexts = [
        current.extendedTextMessage?.contextInfo,
        current.imageMessage?.contextInfo,
        current.videoMessage?.contextInfo,
        current.documentMessage?.contextInfo,
        current.stickerMessage?.contextInfo
    ].filter(Boolean);
    const mentions = [];
    for (const context of contexts) {
        if (Array.isArray(context.mentionedJid))
            mentions.push(...context.mentionedJid);
    }
    if (Array.isArray(current.extendedTextMessage?.mentionedJid))
        mentions.push(...current.extendedTextMessage.mentionedJid);
    if (Array.isArray(current.mentionedJid))
        mentions.push(...current.mentionedJid);
    return [...new Set(mentions.filter(Boolean).map(normalizeJid))];
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

async function profilePictureCandidates(sock, mentionedJid, chatId) {
    const candidates = [mentionedJid, getAlternateJid(mentionedJid)];
    if (sock.store?.contacts) {
        for (const [jid, contact] of Object.entries(sock.store.contacts)) {
            if (normalizeJid(contact?.lid) === mentionedJid || normalizeJid(jid) === mentionedJid)
                candidates.push(jid, contact?.lid);
        }
    }
    if (chatId?.endsWith('@g.us')) {
        try {
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata?.participants?.find(item => participantMatches(item, mentionedJid));
            if (participant)
                candidates.push(participant.phoneNumber, participant.id, participant.lid);
        }
        catch {
            // The original mention may still be resolvable without group metadata.
        }
    }
    return [...new Set(candidates.filter(Boolean).map(normalizeJid))];
}

async function downloadProfilePicture(sock, mentionedJid, chatId) {
    const candidates = await profilePictureCandidates(sock, mentionedJid, chatId);
    let profileUrl = null;
    for (const candidate of candidates) {
        try {
            profileUrl = await sock.profilePictureUrl(candidate, 'image');
            if (profileUrl)
                break;
        }
        catch {
            // Try another known representation of the same PN/LID identity.
        }
    }
    if (!profileUrl)
        throw new ImageInputError('NO_PROFILE_PICTURE', 'Mentioned user has no available profile picture');
    try {
        const signal = /* global AbortSignal */ AbortSignal.timeout(15_000);
        const response = await fetch(profileUrl, { signal });
        if (!response.ok)
            throw new Error(`Profile picture request returned ${response.status}`);
        const contentLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_BYTES)
            throw new Error('Profile picture exceeds the size limit');
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > MAX_MEDIA_BYTES)
            throw new Error('Profile picture is empty or exceeds the size limit');
        return buffer;
    }
    catch (error) {
        if (error instanceof ImageInputError)
            throw error;
        throw new ImageInputError('NO_PROFILE_PICTURE', 'Mentioned user profile picture could not be downloaded');
    }
}

export async function resolveImageInput(sock, message, chatId) {
    const mentionedJid = getMentionedJids(message)[0];
    if (mentionedJid)
        return downloadProfilePicture(sock, mentionedJid, chatId);
    return downloadImage(message);
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

export async function createPrideOverlayImage(input, opacity = 0.14) {
    const { data, info } = await normalizedImage(input);
    const safeOpacity = Math.max(0.08, Math.min(0.35, Number(opacity) || 0.14));
    const colours = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'];
    const stripes = colours.map((colour, index) => (
        `<rect x="0" y="${index * 100 / colours.length}%" width="100%" `
        + `height="${100 / colours.length + 0.2}%" fill="${colour}"/>`
    )).join('');
    const overlay = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">`
        + `<g opacity="${safeOpacity}">${stripes}</g></svg>`
    );
    return sharp(data).composite([{ input: overlay, blend: 'over' }]).png().toBuffer();
}

export async function createPerfectImage(input, templateInput) {
    if (!templateInput)
        throw new TypeError('A perfect meme template is required');
    const template = await sharp(templateInput, { limitInputPixels: MAX_INPUT_PIXELS })
        .ensureAlpha()
        .png()
        .toBuffer({ resolveWithObject: true });
    const photoWidth = Math.min(231, template.info.width);
    const photoHeight = Math.min(231, template.info.height);
    const photo = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(photoWidth, photoHeight, { fit: 'cover', position: 'attention' })
        .png()
        .toBuffer();
    return sharp(template.data).composite([{
        input: photo,
        left: Math.max(0, template.info.width - photoWidth),
        top: Math.min(85, Math.max(0, template.info.height - photoHeight))
    }]).png().toBuffer();
}

async function createPlacedTemplateImage(input, templateInput, placement) {
    if (!templateInput)
        throw new TypeError('An image effect template is required');
    const template = await sharp(templateInput, { limitInputPixels: MAX_INPUT_PIXELS })
        .ensureAlpha()
        .png()
        .toBuffer({ resolveWithObject: true });
    const left = Math.max(0, Math.min(placement.left, template.info.width - 1));
    const top = Math.max(0, Math.min(placement.top, template.info.height - 1));
    const width = Math.max(1, Math.min(placement.width, template.info.width - left));
    const height = Math.max(1, Math.min(placement.height, template.info.height - top));
    const photo = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(width, height, { fit: 'cover', position: 'attention' })
        .png()
        .toBuffer();
    return sharp(template.data).composite([{ input: photo, left, top }]).png().toBuffer();
}

export async function createMorrePragaImage(input, templateInput) {
    return createPlacedTemplateImage(input, templateInput, {
        left: 114,
        top: 188,
        width: 313,
        height: 305
    });
}

export async function createScaredImage(input, templateInput) {
    return createPlacedTemplateImage(input, templateInput, {
        left: 61,
        top: 139,
        width: 83,
        height: 60
    });
}

export async function createRipLifeImage(input, templateInput) {
    return createPlacedTemplateImage(input, templateInput, {
        left: 133,
        top: 0,
        width: 133,
        height: 133
    });
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

export async function createToBeContinuedImage(input, overlayInput) {
    if (!overlayInput)
        throw new TypeError('A to-be-continued overlay is required');
    const { data, info } = await normalizedImage(input);
    const overlayWidth = Math.max(1, Math.round(info.width * 0.58));
    const overlay = await sharp(overlayInput, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize({ width: overlayWidth, fit: 'inside' })
        .png()
        .toBuffer({ resolveWithObject: true });
    const margin = Math.max(2, Math.round(info.width * 0.012));
    const left = Math.max(0, info.width - overlay.info.width - margin);
    const top = Math.max(0, info.height - overlay.info.height - margin);
    const shadow = await sharp(overlay.data)
        .tint('#000000')
        .blur(Math.max(0.5, info.width * 0.004))
        .png()
        .toBuffer();
    return sharp(data)
        .recomb([
            [0.393, 0.769, 0.189],
            [0.349, 0.686, 0.168],
            [0.272, 0.534, 0.131]
        ])
        .composite([
            { input: shadow, left: Math.min(info.width - overlay.info.width, left + 2), top: Math.min(info.height - overlay.info.height, top + 2) },
            { input: overlay.data, left, top }
        ])
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

export async function createSamImage(input, overlayInput) {
    if (!overlayInput)
        throw new TypeError('A SAM overlay is required');
    const { data, info } = await normalizedImage(input);
    const diameter = Math.max(72, Math.min(260, Math.round(Math.min(info.width, info.height) * 0.34)));
    const badge = await sharp(overlayInput, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize({ width: diameter, height: diameter, fit: 'inside' })
        .png()
        .toBuffer({ resolveWithObject: true });
    const margin = Math.max(8, Math.round(diameter * 0.1));
    return sharp(data).composite([{
        input: badge.data,
        left: Math.max(0, info.width - badge.info.width - margin),
        top: Math.max(0, info.height - badge.info.height - margin)
    }]).png().toBuffer();
}

function pixelEnergy(data, width, height, x, y) {
    const left = Math.max(0, x - 1);
    const right = Math.min(width - 1, x + 1);
    const up = Math.max(0, y - 1);
    const down = Math.min(height - 1, y + 1);
    let energy = 0;
    for (let channel = 0; channel < 3; channel++) {
        energy += Math.abs(data[(y * width + left) * 4 + channel] - data[(y * width + right) * 4 + channel]);
        energy += Math.abs(data[(up * width + x) * 4 + channel] - data[(down * width + x) * 4 + channel]);
    }
    return energy;
}

function removeVerticalSeam(image) {
    const { data, width, height } = image;
    if (width <= 1)
        return image;
    const costs = new Float64Array(width * height);
    const parents = new Int8Array(width * height);
    for (let x = 0; x < width; x++)
        costs[x] = pixelEnergy(data, width, height, x, 0);
    for (let y = 1; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let bestX = x;
            let bestCost = costs[(y - 1) * width + x];
            if (x > 0 && costs[(y - 1) * width + x - 1] < bestCost) {
                bestX = x - 1;
                bestCost = costs[(y - 1) * width + x - 1];
            }
            if (x + 1 < width && costs[(y - 1) * width + x + 1] < bestCost) {
                bestX = x + 1;
                bestCost = costs[(y - 1) * width + x + 1];
            }
            const index = y * width + x;
            costs[index] = pixelEnergy(data, width, height, x, y) + bestCost;
            parents[index] = bestX - x;
        }
    }
    let seamX = 0;
    for (let x = 1; x < width; x++) {
        if (costs[(height - 1) * width + x] < costs[(height - 1) * width + seamX])
            seamX = x;
    }
    const seam = new Int32Array(height);
    for (let y = height - 1; y >= 0; y--) {
        seam[y] = seamX;
        if (y > 0)
            seamX += parents[y * width + seamX];
    }
    const output = Buffer.alloc((width - 1) * height * 4);
    for (let y = 0; y < height; y++) {
        let outputX = 0;
        for (let x = 0; x < width; x++) {
            if (x === seam[y])
                continue;
            const source = (y * width + x) * 4;
            const target = (y * (width - 1) + outputX) * 4;
            output[target] = data[source];
            output[target + 1] = data[source + 1];
            output[target + 2] = data[source + 2];
            output[target + 3] = data[source + 3];
            outputX++;
        }
    }
    return { data: output, width: width - 1, height };
}

function transposeImage(image) {
    const output = Buffer.alloc(image.data.length);
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            const source = (y * image.width + x) * 4;
            const target = (x * image.height + y) * 4;
            output[target] = image.data[source];
            output[target + 1] = image.data[source + 1];
            output[target + 2] = image.data[source + 2];
            output[target + 3] = image.data[source + 3];
        }
    }
    return { data: output, width: image.height, height: image.width };
}

export async function createContentAwareScaleImage(input, reduction = 0.35) {
    const safeReduction = Math.max(0.1, Math.min(0.5, Number(reduction) || 0.35));
    const display = await normalizedImage(input);
    const raw = await sharp(display.data)
        .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const workingWidth = raw.info.width;
    const workingHeight = raw.info.height;
    const targetWidth = Math.max(Math.min(32, workingWidth), Math.round(workingWidth * (1 - safeReduction)));
    const targetHeight = Math.max(Math.min(32, workingHeight), Math.round(workingHeight * (1 - safeReduction)));
    let image = { data: raw.data, width: workingWidth, height: workingHeight };
    let verticalTurn = true;
    while (image.width > targetWidth || image.height > targetHeight) {
        if (image.width > targetWidth && (verticalTurn || image.height <= targetHeight)) {
            image = removeVerticalSeam(image);
        }
        else if (image.height > targetHeight) {
            image = transposeImage(removeVerticalSeam(transposeImage(image)));
        }
        verticalTurn = !verticalTurn;
    }
    return sharp(image.data, {
        raw: { width: image.width, height: image.height, channels: 4 }
    }).resize(display.info.width, display.info.height, { fit: 'fill' }).png().toBuffer();
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

export async function createPetPetGif(input, overlayGifInput) {
    if (!overlayGifInput)
        throw new TypeError('A petpet hand animation is required');
    const overlayMetadata = await sharp(overlayGifInput, { animated: true }).metadata();
    const size = overlayMetadata.pageHeight || overlayMetadata.height;
    const frameCount = Math.min(5, overlayMetadata.pages || 1);
    const source = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(size, size, { fit: 'cover', position: 'attention' })
        .png()
        .toBuffer();
    const poses = [
        { left: 14, top: 20, width: 85, height: 90 },
        { left: 12, top: 28, width: 89, height: 82 },
        { left: 8, top: 39, width: 96, height: 71 },
        { left: 10, top: 29, width: 92, height: 81 },
        { left: 12, top: 22, width: 88, height: 88 }
    ].slice(0, frameCount);
    const frames = [];
    for (const [index, pose] of poses.entries()) {
        const avatar = await sharp(source)
            .resize(pose.width, pose.height, { fit: 'fill' })
            .png()
            .toBuffer();
        const hand = await sharp(overlayGifInput, { page: index })
            .png()
            .toBuffer({ resolveWithObject: true });
        frames.push(await sharp({
            create: {
                width: size,
                height: size,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        }).composite([
            { input: avatar, left: pose.left, top: pose.top },
            { input: hand.data, left: Math.round((size - hand.info.width) / 2), top: 0 }
        ]).png().toBuffer());
    }
    const strip = sharp({
        create: {
            width: size,
            height: size * frames.length,
            pageHeight: size,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    }).composite(frames.map((frame, index) => ({ input: frame, left: 0, top: size * index })));
    const delays = Array.isArray(overlayMetadata.delay)
        ? overlayMetadata.delay.slice(0, frameCount).map(delay => delay || 70)
        : poses.map(() => 70);
    return strip.gif({ loop: overlayMetadata.loop || 0, delay: delays, effort: 3, colours: 128 }).toBuffer();
}

export async function gifToMp4(gifBuffer) {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const id = crypto.randomUUID();
    const inputPath = path.join(tempDir, `image-effect-${id}.gif`);
    const outputPath = path.join(tempDir, `image-effect-${id}.mp4`);
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
