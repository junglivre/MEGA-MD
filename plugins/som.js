// .som: add sound to an image, sticker, GIF or video, in two steps.
//
// Reply to the picture (or the audio) with .som; the bot asks for the other
// part, and the sender's next audio (or picture) in that chat completes it.
// Pending requests are per chat+sender, like .video -custom, so someone else's
// media in a group never gets picked up. handleSoundStickerReply() is called
// from lib/messageHandler.js for every message; it is a Map lookup when nobody
// has a pending request.
import fs from 'fs';
import path from 'path';
import { TEMP_DIR } from '../lib/paths.js';
import { channelInfo } from '../lib/messageConfig.js';
import { extractStickerAudio, sendSoundSticker, unwrapSoundSticker, MAX_SOUND_SECONDS } from '../lib/soundSticker.js';
import { downloadStickerSource, parseStickerArgs, renderSticker, resolveStickerTarget } from './sticker.js';

const PENDING_TTL_MS = 2 * 60 * 1000;
const CUSTOM_FLAGS = new Set(['-custom', '-p']);
const OFFSET_RE = /^(?:(\d{1,3}):([0-5]?\d)|(\d{1,4}))$/;
const pending = new Map();

const pendingKey = (chatId, senderId) => `${chatId}:${senderId}`;

/** Splits the start offset ("5", "1:30") from the sticker flags. Tokens after -p/-custom belong to it. */
export function parseSomArgs(args) {
    let start = 0;
    let found = false;
    const rest = [];
    let inCustom = false;
    for (const arg of args) {
        if (CUSTOM_FLAGS.has(arg.toLowerCase()))
            inCustom = true;
        else if (arg.startsWith('-'))
            inCustom = false;
        const match = !found && !inCustom && arg.match(OFFSET_RE);
        if (match) {
            start = match[3] !== undefined ? Number(match[3]) : Number(match[1]) * 60 + Number(match[2]);
            found = true;
            continue;
        }
        rest.push(arg);
    }
    return { start, sticker: parseStickerArgs(rest) };
}

/** What a message offers: {kind:'visual'|'audio', target, media}, or null. */
export function classifyMedia(target) {
    const content = target?.message || {};
    const sound = unwrapSoundSticker(content);
    if (sound)
        return { kind: 'visual', target: { key: target.key, message: { stickerMessage: sound.sticker } }, media: sound.sticker };
    for (const kind of ['imageMessage', 'stickerMessage', 'videoMessage']) {
        if (content[kind])
            return { kind: 'visual', target, media: content[kind] };
    }
    if (content.audioMessage)
        return { kind: 'audio', target, media: content.audioMessage };
    const doc = content.documentMessage || content.documentWithCaptionMessage?.message?.documentMessage;
    const docTarget = doc && { key: target.key, message: { documentMessage: doc } };
    if (doc?.mimetype?.startsWith('audio/'))
        return { kind: 'audio', target: docTarget, media: doc };
    if (/^(image|video)\//.test(doc?.mimetype || ''))
        return { kind: 'visual', target: docTarget, media: doc };
    return null;
}

async function build(sock, chatId, { visual, audio, request, quoted, t }) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const dir = fs.mkdtempSync(path.join(TEMP_DIR, 'som_'));
    try {
        const [visualBuffer, audioBuffer] = await Promise.all([
            downloadStickerSource(sock, visual.target),
            downloadStickerSource(sock, audio.target)
        ]);
        const audioIn = path.join(dir, 'audio_in');
        fs.writeFileSync(audioIn, audioBuffer);
        const clip = await extractStickerAudio(audioIn, path.join(dir, 'audio.ogg'), MAX_SOUND_SECONDS, request.start);
        if (!clip) {
            await sock.sendMessage(chatId, { text: `⚠️ ${t('p.som.noAudio')}` }, { quoted });
            return;
        }
        const { buffer, animated } = await renderSticker({
            mediaBuffer: visualBuffer,
            mediaMessage: visual.media,
            isExistingSticker: !!visual.target.message?.stickerMessage,
            parsed: request.sticker,
            tempInput: path.join(dir, 'visual_in'),
            tempOutput: path.join(dir, 'sticker.webp')
        });
        await sendSoundSticker(sock, chatId, {
            sticker: buffer,
            audio: fs.readFileSync(clip.path),
            seconds: clip.seconds,
            animated,
            contextInfo: channelInfo?.contextInfo,
            quoted
        });
    }
    catch (error) {
        console.error('Error in som command:', error.message);
        await sock.sendMessage(chatId, { text: `❌ ${t('p.som.failed')}` }, { quoted });
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/** Completes a pending .som with the sender's next audio or picture. Returns true when it consumed the message. */
export async function handleSoundStickerReply(sock, chatId, senderId, message) {
    const key = pendingKey(chatId, senderId);
    const request = pending.get(key);
    if (!request)
        return false;
    const offered = classifyMedia({ key: message.key, message: message.message });
    if (!offered || offered.kind === request.have.kind)
        return false;
    clearTimeout(request.timer);
    pending.delete(key);
    const [visual, audio] = offered.kind === 'audio' ? [request.have, offered] : [offered, request.have];
    await build(sock, chatId, { visual, audio, request, quoted: message, t: request.t });
    return true;
}

export default {
    command: 'som',
    aliases: ['figsom', 'addsom'],
    category: 'stickers',
    description: 'Add sound to an image, sticker, GIF or video (two steps)',
    usage: '.som [start seconds|m:ss] [sticker flags] (reply to an image/sticker/video, then send the audio; or the other way round)',
    async handler(sock, message, args, context) {
        const { t, senderId } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const have = classifyMedia(resolveStickerTarget(message, chatId).targetMessage);
        if (!have) {
            return sock.sendMessage(chatId, { text: t('p.som.usage') }, { quoted: message });
        }
        const key = pendingKey(chatId, senderId);
        clearTimeout(pending.get(key)?.timer);
        const timer = setTimeout(() => {
            if (pending.get(key)?.timer !== timer)
                return;
            pending.delete(key);
            sock.sendMessage(chatId, { text: `⌛ ${t('p.som.expired')}` }, { quoted: message }).catch(() => {});
        }, PENDING_TTL_MS);
        timer.unref?.();
        pending.set(key, { have, ...parseSomArgs(args), t, timer });
        const ask = have.kind === 'visual' ? 'askAudio' : 'askVisual';
        await sock.sendMessage(chatId, { text: t(`p.som.${ask}`, { seconds: MAX_SOUND_SECONDS }) }, { quoted: message });
    }
};
