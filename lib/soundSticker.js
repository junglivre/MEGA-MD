// Sound stickers: an animated WebP sticker plus a separate Opus clip, sent as
// Message.audioStickerMessage (see lib/protoExtensions.js for the layout).
// Clients without the feature show the sticker without sound.
import { execFile } from 'child_process';
import { promisify } from 'util';
import { downloadContentFromMessage, generateWAMessageFromContent, prepareWAMessageMedia } from '@whiskeysockets/baileys';
import { applyProtoExtensions } from './protoExtensions.js';

applyProtoExtensions();

const run = promisify(execFile);
export const SOUND_STICKER_MIMETYPE = 'audio/ogg; codecs=opus';
// Longest clip tested on 2026-11-24: 60 s played in full (static and animated stickers).
export const MAX_SOUND_SECONDS = 60;

/** The sticker inside a sound sticker message, with its audio, or null. */
export function unwrapSoundSticker(message) {
    const sticker = message?.audioStickerMessage?.message?.stickerMessage;
    return sticker ? { sticker, audio: sticker.audioMessage || null } : null;
}

async function hasAudioStream(inputPath) {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', inputPath]);
    return stdout.trim().length > 0;
}

async function probeSeconds(path) {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]);
    return Number.parseFloat(stdout);
}

/**
 * Encodes `seconds` of the input's audio, starting at `start`, as mono 48 kHz
 * Opus, the format of the sound stickers WhatsApp sends. Returns null when the
 * input has no audio track or nothing after `start`.
 */
export async function extractStickerAudio(inputPath, outputPath, seconds, start = 0) {
    if (!(await hasAudioStream(inputPath)))
        return null;
    await run('ffmpeg', ['-y', '-v', 'error', ...(start > 0 ? ['-ss', String(start)] : []), '-i', inputPath, '-t', String(Math.min(seconds, MAX_SOUND_SECONDS)), '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', '-f', 'ogg', outputPath]);
    const duration = await probeSeconds(outputPath);
    if (!(duration > 0))
        return null;
    return { path: outputPath, seconds: Math.max(1, Math.round(duration)) };
}

/** Downloads the clip of a received sound sticker. */
export async function downloadStickerAudio(audioMessage) {
    const chunks = [];
    for await (const chunk of await downloadContentFromMessage(audioMessage, 'audio'))
        chunks.push(chunk);
    return Buffer.concat(chunks);
}

/**
 * Uploads the sticker and the clip separately and sends them as one sound sticker.
 * `contextInfo` (forwarding/channel info) and `quoted` behave like sock.sendMessage.
 */
export async function sendSoundSticker(sock, jid, { sticker, audio, seconds, animated, contextInfo, quoted }) {
    const options = { upload: sock.waUploadToServer, logger: sock.logger };
    const { stickerMessage } = await prepareWAMessageMedia({ sticker }, options);
    const { audioMessage } = await prepareWAMessageMedia({ audio, mimetype: SOUND_STICKER_MIMETYPE, seconds }, options);
    // Built as a plain sticker first so Baileys fills in the reply context.
    const full = generateWAMessageFromContent(jid, {
        stickerMessage: { ...stickerMessage, isAnimated: !!animated, ...(contextInfo ? { contextInfo: { ...contextInfo } } : {}) }
    }, { quoted, userJid: sock.user.id });
    const inner = full.message.stickerMessage;
    inner.audioMessage = audioMessage;
    full.message = { audioStickerMessage: { message: { stickerMessage: inner } } };
    await sock.relayMessage(jid, full.message, { messageId: full.key.id });
    return full;
}
