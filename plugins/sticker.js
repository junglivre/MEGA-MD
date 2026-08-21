import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import webp from 'node-webpmux';
import config from '../config.js';

// Matches a single (possibly ZWJ-joined, variation-selector-terminated) emoji,
// and nothing else in the token.
const EMOJI_RE = /^\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\ufe0f?$/u;

function isEmojiToken(tok) {
    return EMOJI_RE.test(tok.trim());
}

// Recognizes -crop / -full / -rounded / -circle (shape) and -custom <author>|<pack>
// (branding). Anything else is left over as plain text: emoji tokens become the
// sticker's category, remaining text becomes the legacy ".take <packname>" style
// bare pack name when replying to an existing sticker.
function parseStickerArgs(args) {
    let shape = null;
    let customValue = null;
    const rest = [];
    for (let i = 0; i < args.length; i++) {
        const low = args[i].toLowerCase();
        if (low === '-crop') {
            shape = 'crop';
            continue;
        }
        if (low === '-full') {
            shape = 'full';
            continue;
        }
        if (low === '-rounded' || low === '-circle') {
            shape = 'circle';
            continue;
        }
        if (low === '-custom') {
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
    let customAuthor = null;
    let customPack = null;
    if (customValue) {
        const idx = customValue.indexOf('|');
        if (idx === -1) {
            // No "author|pack" separator given: a lone -custom value sets the pack
            // name only (the part people actually see in WhatsApp's sticker tray).
            customPack = customValue.trim() || null;
        }
        else {
            customAuthor = customValue.slice(0, idx).trim() || null;
            customPack = customValue.slice(idx + 1).trim() || null;
        }
    }
    const emojiTokens = rest.filter(isEmojiToken);
    const bareText = rest.filter((t) => !isEmojiToken(t)).join(' ').trim();
    return { shape, customAuthor, customPack, emojiTokens, bareText };
}

function runFfmpeg(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (error) => (error ? reject(error) : resolve()));
    });
}

// Builds the -vf filter chain for a given shape. All of them land on a 512x512
// canvas with a transparent (rgba) background, matching what every other sticker
// plugin in this bot already outputs.
function buildFilter(shape, animated) {
    const fps = animated ? ',fps=15' : '';
    switch (shape) {
        case 'full':
            // Preserve the original aspect ratio, no crop and no padding - just
            // scaled down to fit. No distortion, but the result may not be square.
            return `scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease${fps},format=rgba`;
        case 'crop':
            // Center-crop to a square first, so nothing gets stretched.
            return `crop=min(iw\\,ih):min(iw\\,ih),scale=512:512${fps},format=rgba`;
        case 'circle':
            // Same square crop, then a geq alpha mask carves out a real circle
            // (transparent corners), instead of just a square thumbnail.
            return `crop=min(iw\\,ih):min(iw\\,ih),scale=512:512${fps},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(pow(X-256\\,2)+pow(Y-256\\,2)\\,65536)\\,255\\,0)'`;
        default:
            // "pad": scale down preserving aspect ratio, then pad with a
            // transparent border up to 512x512. The safe default - never
            // stretches and never crops anything out.
            return `scale=512:512:force_original_aspect_ratio=decrease${fps},format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000`;
    }
}

async function convertToSticker(inputPath, outputPath, shape, animated) {
    const filter = buildFilter(shape, animated);
    if (!animated) {
        await runFfmpeg(`ffmpeg -y -i "${inputPath}" -vf "${filter}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${outputPath}"`);
        return;
    }
    await runFfmpeg(`ffmpeg -y -i "${inputPath}" -t 6 -vf "${filter}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 65 -compression_level 6 "${outputPath}"`);
    // WhatsApp rejects animated stickers over ~1MB - shrink harder if we went over.
    const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
    if (stat && stat.size > 900 * 1024) {
        const fallback = `${outputPath}.small.webp`;
        try {
            await runFfmpeg(`ffmpeg -y -i "${inputPath}" -t 3 -vf "${filter.replace('fps=15', 'fps=10')}" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 40 -compression_level 6 -b:v 120k "${fallback}"`);
            if (fs.existsSync(fallback) && fs.statSync(fallback).size > 0) {
                fs.renameSync(fallback, outputPath);
            }
        }
        catch {
            // Keep the first (larger) result if the shrink pass itself fails.
        }
    }
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
        const pack = config.packname || 'MEGA-MD';
        return await addExifToBuffer(fs.readFileSync(tempOutput), pack, config.author || 'MEGA-MD', ['✂️']);
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

function resolveTarget(message, chatId) {
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
    const mediaMessage = targetMessage.message?.imageMessage
        || targetMessage.message?.videoMessage
        || targetMessage.message?.documentMessage
        || targetMessage.message?.stickerMessage;
    return { targetMessage, mediaMessage };
}

export default {
    command: 'sticker',
    aliases: [
        // legacy commands this one replaces - kept working exactly as before
        'stik', 's', 'sticker2', 's2', 'stik2', 'crop', 'stickercrop', 'scrop', 'take', 'steal', 'wm',
        // extra friendly aliases
        'fig', 'figurinha', 'stiker', 'f', 'st', 'rename', 'renomear'
    ],
    category: 'stickers',
    description: 'Create or edit a sticker from an image, video, GIF or another sticker',
    usage: '.sticker [emoji] [-crop|-full|-rounded|-circle] [-custom author|pack] (reply to image/video/gif/document/sticker)',
    async handler(sock, message, args, context) {
        const { chatId, config, channelInfo, t } = context;
        const { targetMessage, mediaMessage } = resolveTarget(message, chatId);
        if (!mediaMessage) {
            await sock.sendMessage(chatId, {
                text: t('p.sticker.needMedia'),
                ...channelInfo
            }, { quoted: message });
            return;
        }
        const { shape, customAuthor, customPack, emojiTokens, bareText } = parseStickerArgs(args);
        const isExistingSticker = !!targetMessage.message?.stickerMessage;
        const tmpDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tmpDir))
            fs.mkdirSync(tmpDir, { recursive: true });
        const stamp = Date.now();
        const tempInput = path.join(tmpDir, `sticker_in_${stamp}`);
        const tempOutput = path.join(tmpDir, `sticker_out_${stamp}.webp`);
        try {
            const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, {
                logger: undefined,
                reuploadRequest: sock.updateMediaMessage
            });
            if (!mediaBuffer) {
                await sock.sendMessage(chatId, { text: t('p.sticker.downloadFailed'), ...channelInfo }, { quoted: message });
                return;
            }
            const author = customAuthor || config.author || 'MEGA-MD';
            let finalBuffer;
            if (isExistingSticker && !shape) {
                // Rename-only mode (what .take used to do): rewrite the EXIF pack/author
                // in place, no re-encoding, so the sticker's pixels never change.
                const pack = customPack || bareText || config.packname || 'MEGA-MD';
                finalBuffer = await addExifToBuffer(mediaBuffer, pack, author, emojiTokens);
            }
            else {
                // Create mode (also used to re-shape an existing sticker when a
                // shape flag is explicitly given).
                const isAnimated = mediaMessage.mimetype?.includes('gif')
                    || mediaMessage.mimetype?.includes('video')
                    || (mediaMessage.mimetype === 'image/webp' && targetMessage.message?.stickerMessage?.isAnimated)
                    || mediaMessage.seconds > 0;
                fs.writeFileSync(tempInput, mediaBuffer);
                await convertToSticker(tempInput, tempOutput, shape || 'pad', isAnimated);
                if (!fs.existsSync(tempOutput) || fs.statSync(tempOutput).size === 0) {
                    throw new Error('ffmpeg produced no output');
                }
                const pack = customPack || config.packname || 'MEGA-MD';
                finalBuffer = await addExifToBuffer(fs.readFileSync(tempOutput), pack, author, emojiTokens);
            }
            await sock.sendMessage(chatId, { sticker: finalBuffer, ...channelInfo }, { quoted: message });
        }
        catch (error) {
            console.error('Sticker command error:', error);
            await sock.sendMessage(chatId, { text: t('p.sticker.createFailed'), ...channelInfo }, { quoted: message });
        }
        finally {
            for (const f of [tempInput, tempOutput, `${tempOutput}.small.webp`]) {
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
