import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import webp from 'node-webpmux';
import sharp from 'sharp';
import { getStickerAuthor, getStickerPackName } from '../lib/stickerMetadata.js';
import config from '../config.js';
import { downloadViewOnce, resolveQuotedViewOnce, ViewOnceExpiredError } from '../lib/viewOnce.js';
import { downloadStickerAudio, extractStickerAudio, loadQuotedSoundSticker, sendSoundSticker, unwrapSoundSticker } from '../lib/soundSticker.js';

// Matches a single (possibly ZWJ-joined, variation-selector-terminated) emoji,
// and nothing else in the token.
const EMOJI_RE = /^\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\ufe0f?$/u;

function isEmojiToken(tok) {
    return EMOJI_RE.test(tok.trim());
}

const SILENT_LOGGER = { trace() {}, debug() {}, info() {}, warn() {}, error() {}, child() { return SILENT_LOGGER; } };

const STRETCH_FLAGS = new Set(['-s', '-stretch', '-esticado', '-full', '-f']);
const CROP_FLAGS = new Set(['-crop', '-c']);
const CIRCLE_FLAGS = new Set(['-rounded', '-circle', '-r']);
const CUSTOM_FLAGS = new Set(['-custom', '-p']);
const NO_AUDIO_FLAGS = new Set(['-sa', '-semaudio', '-na', '-noaudio']);

// Recognizes the shape flags (-s/-stretch/-esticado/-full/-f, -crop/-c,
// -rounded/-circle/-r), -sa/-semaudio/-na/-noaudio (no sound) and
// -custom/-p <author>|<pack> (branding). Anything else is left over as plain
// text: emoji tokens become the sticker's categories, remaining text becomes
// the pack name when renaming an existing sticker.
export function parseStickerArgs(args) {
    let shape = null;
    let noAudio = false;
    let customValue = null;
    const rest = [];
    for (let i = 0; i < args.length; i++) {
        const low = args[i].toLowerCase();
        if (STRETCH_FLAGS.has(low)) {
            shape = 'stretch';
            continue;
        }
        if (NO_AUDIO_FLAGS.has(low)) {
            noAudio = true;
            continue;
        }
        if (CROP_FLAGS.has(low)) {
            shape = 'crop';
            continue;
        }
        if (CIRCLE_FLAGS.has(low)) {
            shape = 'circle';
            continue;
        }
        if (CUSTOM_FLAGS.has(low)) {
            const parts = [];
            let j = i + 1;
            while (j < args.length && !args[j].startsWith('-')) {
                parts.push(args[j]);
                j++;
            }
            customValue = parts.join(' ');
            i = j - 1;
            continue;
        }
        rest.push(args[i]);
    }
    // customAuthor: null = use the default author; '' = no author at all.
    let customAuthor = null;
    let customPack = null;
    if (customValue) {
        const idx = customValue.indexOf('|');
        if (idx === -1) {
            // "-custom Pack" sets the pack and drops the author line.
            customPack = customValue.trim() || null;
            customAuthor = '';
        }
        else {
            customAuthor = customValue.slice(0, idx).trim();
            customPack = customValue.slice(idx + 1).trim() || null;
        }
    }
    const emojiTokens = rest.filter(isEmojiToken);
    const bareText = rest.filter((t) => !isEmojiToken(t)).join(' ').trim();
    return { shape, noAudio, customAuthor, customPack, emojiTokens, bareText };
}

function runFfmpeg(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (error) => (error ? reject(error) : resolve()));
    });
}

// Builds the -vf filter chain for a given shape. Every result fits in 512x512
// with a transparent (rgba) background.
function buildFilter(shape, animated) {
    const fps = animated ? ',fps=15' : '';
    switch (shape) {
        case 'stretch':
            // Exactly 512x512: no crop, no border, the image is stretched to fill.
            return `scale=512:512${fps},format=rgba`;
        case 'crop':
            // Center-crop to a square, nothing stretched (-crop/-c; also .igsc).
            return `crop=min(iw\\,ih):min(iw\\,ih),scale=512:512${fps},format=rgba`;
        case 'circle':
            // Square crop, then a geq alpha mask carves out a real circle
            // (transparent corners), instead of just a square thumbnail.
            return `crop=min(iw\\,ih):min(iw\\,ih),scale=512:512${fps},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(pow(X-256\\,2)+pow(Y-256\\,2)\\,65536)\\,255\\,0)'`;
        case 'padded':
            // Original proportions on a transparent 512x512 canvas. Used for
            // animated "original": some GIFs fail as non-square animated stickers.
            return `scale=512:512:force_original_aspect_ratio=decrease${fps},format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000`;
        default:
            // "original": original proportions, only scaled down to fit 512.
            return `scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease${fps},format=rgba`;
    }
}

// No shape flag keeps the original proportions (no crop, no stretch); animated
// media gets an invisible transparent border instead of a non-square canvas.
export function getStickerShape(shape, animated) {
    return shape || (animated ? 'padded' : 'original');
}

// RIFF....WEBP with a VP8X header whose animation flag (0x02) is set. The
// quoted sticker's isAnimated is not always present, so the bytes decide.
export function isAnimatedWebp(buffer) {
    return buffer.length > 20
        && buffer.toString('latin1', 0, 4) === 'RIFF'
        && buffer.toString('latin1', 8, 16) === 'WEBPVP8X'
        && (buffer[20] & 0x02) !== 0;
}

// ffmpeg (6.1 on prod) cannot decode animated WebP. libvips (sharp) can, and
// composites each frame; the frames go to ffmpeg as PNGs through a concat list
// that keeps every frame's delay. Returns the ffmpeg input arguments.
async function explodeAnimatedWebp(inputPath, framesDir) {
    const { data, info } = await sharp(inputPath, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { delay = [] } = await sharp(inputPath, { animated: true }).metadata();
    const { width, pageHeight = info.height, channels } = info;
    const frameBytes = width * pageHeight * channels;
    const frames = Math.floor(data.length / frameBytes);
    fs.mkdirSync(framesDir, { recursive: true });
    const list = ['ffconcat version 1.0'];
    for (let i = 0; i < frames; i++) {
        const file = path.join(framesDir, `${String(i).padStart(5, '0')}.png`);
        await sharp(data.subarray(i * frameBytes, (i + 1) * frameBytes), { raw: { width, height: pageHeight, channels } }).png({ compressionLevel: 0 }).toFile(file);
        // A 0 ms delay means "as fast as possible"; players show ~100 ms.
        list.push(`file '${file}'`, `duration ${(delay[i] > 0 ? delay[i] : 100) / 1000}`);
    }
    // concat ignores the last duration unless the last file is listed again.
    list.push(list[list.length - 2]);
    const listPath = path.join(framesDir, 'frames.ffconcat');
    fs.writeFileSync(listPath, `${list.join('\n')}\n`);
    return `-f concat -safe 0 -i "${listPath}"`;
}

// Returns how many seconds of an animated input the sticker covers: always 6,
// shrunk by compressing harder (lower fps/quality/bitrate) instead of cutting
// the clip, so a sound sticker's audio always matches the visible loop.
async function convertToSticker(inputPath, outputPath, shape, animated) {
    const filter = buildFilter(shape, animated);
    if (!animated) {
        await runFfmpeg(`ffmpeg -y -i "${inputPath}" -vf "${filter}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${outputPath}"`);
        return null;
    }
    const framesDir = `${outputPath}.frames`;
    try {
        const input = isAnimatedWebp(fs.readFileSync(inputPath))
            ? await explodeAnimatedWebp(inputPath, framesDir)
            : `-i "${inputPath}"`;
        return await encodeAnimatedSticker(input, outputPath, filter);
    }
    finally {
        fs.rmSync(framesDir, { recursive: true, force: true });
    }
}

// WhatsApp rejects animated stickers over ~1MB. Each step keeps the full 6s
// but encodes harder; the last step is kept even if still over the limit.
const COMPRESSION_STEPS = [
    { fps: 15, quality: 65 },
    { fps: 15, quality: 50, bitrate: '250k' },
    { fps: 12, quality: 40, bitrate: '150k' },
    { fps: 10, quality: 28, bitrate: '100k' },
    { fps: 8, quality: 20, bitrate: '70k' }
];

async function encodeAnimatedSticker(input, outputPath, filter) {
    for (const { fps, quality, bitrate } of COMPRESSION_STEPS) {
        const stepFilter = filter.replace(/fps=\d+/, `fps=${fps}`);
        const bv = bitrate ? ` -b:v ${bitrate}` : '';
        await runFfmpeg(`ffmpeg -y ${input} -t 6 -vf "${stepFilter}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality ${quality} -compression_level 6${bv} "${outputPath}"`);
        const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
        if (stat && stat.size <= 900 * 1024)
            break;
    }
    return 6;
}

async function addExifToBuffer(buffer, packname, author, emojis) {
    const img = new webp.Image();
    await img.load(buffer);
    const json = {
        'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': emojis && emojis.length ? emojis : ['🤖']
    };
    const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    img.exif = exif;
    return await img.save(null);
}

// Standalone helper (also used by igsc.js) for turning an already-downloaded
// buffer into a cropped sticker without going through a WhatsApp message at all.
export async function stickercropFromBuffer(inputBuffer, isAnimated) {
    const tmpDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tmpDir))
        fs.mkdirSync(tmpDir, { recursive: true });
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tempInput = path.join(tmpDir, `cropbuf_${stamp}`);
    const tempOutput = path.join(tmpDir, `cropbuf_out_${stamp}.webp`);
    fs.writeFileSync(tempInput, inputBuffer);
    try {
        await convertToSticker(tempInput, tempOutput, 'crop', isAnimated);
        const pack = getStickerPackName();
        return await addExifToBuffer(fs.readFileSync(tempOutput), pack, getStickerAuthor(), ['✂️']);
    }
    finally {
        for (const f of [tempInput, tempOutput]) {
            try {
                if (fs.existsSync(f))
                    fs.unlinkSync(f);
            }
            catch {
                // best-effort cleanup
            }
        }
    }
}

export function resolveStickerTarget(message, chatId) {
    let targetMessage = message;
    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedInfo = message.message.extendedTextMessage.contextInfo;
        targetMessage = {
            key: {
                remoteJid: chatId,
                id: quotedInfo.stanzaId,
                participant: quotedInfo.participant
            },
            message: quotedInfo.quotedMessage
        };
    }
    // A sound sticker wraps a regular sticker; work on that sticker and keep its clip.
    const sound = unwrapSoundSticker(targetMessage.message);
    if (sound)
        targetMessage = { key: targetMessage.key, message: { stickerMessage: sound.sticker } };
    const mediaMessage = targetMessage.message?.imageMessage
        || targetMessage.message?.videoMessage
        || targetMessage.message?.documentMessage
        || targetMessage.message?.stickerMessage;
    return { targetMessage, mediaMessage, soundAudio: sound?.audio || null };
}

/** Downloads the media of a target message (quoted or own), re-uploading expired media. */
export async function downloadStickerSource(sock, targetMessage) {
    return downloadMediaMessage(targetMessage, 'buffer', {}, {
        // Baileys logs through ctx.logger before re-uploading expired media.
        logger: SILENT_LOGGER,
        reuploadRequest: sock.updateMediaMessage
    });
}

/**
 * Turns downloaded media into the final sticker WebP. An existing sticker
 * without a shape flag only gets new metadata (pixels untouched, what .take
 * used to do); anything else is converted. Returns whether the result is
 * animated and, for converted animations, how many seconds it covers.
 */
export async function renderSticker({ mediaBuffer, mediaMessage, isExistingSticker, parsed, tempInput, tempOutput }) {
    const { shape, customAuthor, customPack, emojiTokens, bareText } = parsed;
    const author = customAuthor === null ? getStickerAuthor() : customAuthor;
    if (isExistingSticker && !shape) {
        const pack = getStickerPackName(customPack || bareText);
        return { buffer: await addExifToBuffer(mediaBuffer, pack, author, emojiTokens), animated: !!mediaMessage.isAnimated, clipSeconds: null };
    }
    const animated = !!(mediaMessage.mimetype?.includes('gif')
        || mediaMessage.mimetype?.includes('video')
        || (mediaMessage.mimetype === 'image/webp' && (mediaMessage.isAnimated || isAnimatedWebp(mediaBuffer)))
        || mediaMessage.seconds > 0);
    fs.writeFileSync(tempInput, mediaBuffer);
    const clipSeconds = await convertToSticker(tempInput, tempOutput, getStickerShape(shape, animated), animated);
    if (!fs.existsSync(tempOutput) || fs.statSync(tempOutput).size === 0) {
        throw new Error('ffmpeg produced no output');
    }
    const pack = getStickerPackName(customPack);
    return { buffer: await addExifToBuffer(fs.readFileSync(tempOutput), pack, author, emojiTokens), animated, clipSeconds };
}

export default {
    command: 'sticker',
    aliases: ['stik', 's', 'fig', 'figurinha', 'stiker', 'f', 'st'],
    category: 'stickers',
    description: 'Create or edit a sticker from an image, video, GIF or another sticker',
    usage: '.sticker [emoji] [-s|-f|-stretch|-esticado|-full] [-c|-crop] [-r|-rounded|-circle] [-sa|-semaudio|-na|-noaudio] [-p|-custom author|pack] (reply to image/video/gif/document/sticker)',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const resolved = resolveStickerTarget(message, chatId);
        let { targetMessage, mediaMessage, soundAudio } = resolved;
        // The quoted copy of a sound sticker comes without its clip; the stored original has it.
        if (!soundAudio && targetMessage.message?.stickerMessage)
            soundAudio = (await loadQuotedSoundSticker(sock, message, chatId))?.audio || null;
        // The quoted copy of a view-once media never carries its download key;
        // on a mobile companion the stored original does (see lib/viewOnce.js).
        const viewOnce = await resolveQuotedViewOnce(sock, message, chatId);
        if (viewOnce.status !== 'none') {
            if (config.deviceType !== 'mobile') {
                await sock.sendMessage(chatId, { text: t('p.sticker.viewOnce'), ...channelInfo }, { quoted: message });
                return;
            }
            if (viewOnce.status !== 'ok') {
                const prefix = viewOnce.status === 'expired' ? '⌛ ' : '⚠️ ';
                await sock.sendMessage(chatId, { text: prefix + t(`p.viewonce.${viewOnce.status}`), ...channelInfo }, { quoted: message });
                return;
            }
            targetMessage = { key: viewOnce.key, message: { [viewOnce.kind]: viewOnce.media } };
            mediaMessage = viewOnce.type === 'audio' ? null : viewOnce.media;
        }
        if (!mediaMessage) {
            await sock.sendMessage(chatId, {
                text: t('p.sticker.needMedia'),
                ...channelInfo
            }, { quoted: message });
            return;
        }
        const parsed = parseStickerArgs(args);
        const isExistingSticker = !!targetMessage.message?.stickerMessage;
        const tmpDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tmpDir))
            fs.mkdirSync(tmpDir, { recursive: true });
        const stamp = Date.now();
        const tempInput = path.join(tmpDir, `sticker_in_${stamp}`);
        const tempOutput = path.join(tmpDir, `sticker_out_${stamp}.webp`);
        const tempAudio = path.join(tmpDir, `sticker_audio_${stamp}.ogg`);
        try {
            const mediaBuffer = viewOnce.status === 'ok'
                ? await downloadViewOnce(sock, viewOnce)
                : await downloadStickerSource(sock, targetMessage);
            if (!mediaBuffer) {
                await sock.sendMessage(chatId, { text: t('p.sticker.downloadFailed'), ...channelInfo }, { quoted: message });
                return;
            }
            const { buffer: finalBuffer, animated, clipSeconds } = await renderSticker({ mediaBuffer, mediaMessage, isExistingSticker, parsed, tempInput, tempOutput });
            // Sound: keep a sound sticker's own clip, or take it from a video
            // (not from GIFs, which WhatsApp sends as silent videos).
            let audio = null;
            if (!parsed.noAudio && soundAudio) {
                audio = { buffer: await downloadStickerAudio(soundAudio), seconds: Number(soundAudio.seconds) || 1 };
            }
            else if (!parsed.noAudio && clipSeconds && mediaMessage.mimetype?.startsWith('video/') && !mediaMessage.gifPlayback) {
                const clip = await extractStickerAudio(tempInput, tempAudio, clipSeconds);
                if (clip)
                    audio = { buffer: fs.readFileSync(clip.path), seconds: clip.seconds };
            }
            if (audio) {
                await sendSoundSticker(sock, chatId, {
                    sticker: finalBuffer,
                    audio: audio.buffer,
                    seconds: audio.seconds,
                    animated,
                    contextInfo: channelInfo?.contextInfo,
                    quoted: message
                });
            }
            else {
                await sock.sendMessage(chatId, { sticker: finalBuffer, ...channelInfo }, { quoted: message });
            }
        }
        catch (error) {
            if (error instanceof ViewOnceExpiredError) {
                await sock.sendMessage(chatId, { text: `⌛ ${t('p.viewonce.expired')}`, ...channelInfo }, { quoted: message });
                return;
            }
            console.error('Sticker command error:', error);
            await sock.sendMessage(chatId, { text: t('p.sticker.createFailed'), ...channelInfo }, { quoted: message });
        }
        finally {
            for (const f of [tempInput, tempOutput, `${tempOutput}.small.webp`, tempAudio]) {
                try {
                    if (fs.existsSync(f))
                        fs.unlinkSync(f);
                }
                catch {
                    // best-effort cleanup
                }
            }
        }
    }
};
