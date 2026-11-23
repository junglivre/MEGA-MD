// Finds the original of a quoted view-once message so it can be downloaded.
//
// Even on a mobile companion (DEVICE_TYPE=mobile), the copy WhatsApp embeds in
// a reply's contextInfo keeps only `viewOnce: true`, without mediaKey or
// directPath. The original message, as received, does carry them, and
// lightweight_store keeps it, so commands look it up by the quoted stanzaId.
import { downloadContentFromMessage, jidNormalizedUser } from '@whiskeysockets/baileys';

const MEDIA_KINDS = [
    ['imageMessage', 'image'],
    ['videoMessage', 'video'],
    ['audioMessage', 'audio']
];
const WRAPPERS = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage'];
const VIEW_ONCE_WRAPPERS = new Set(['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']);

/** Returns the view-once media inside a message, or null when it is not a view-once image/video/audio. */
export function findViewOnceMedia(message) {
    let content = message;
    let wrapped = false;
    for (let depth = 0; content && depth < 5; depth++) {
        const wrapper = WRAPPERS.find((name) => content[name]?.message);
        if (!wrapper)
            break;
        wrapped = wrapped || VIEW_ONCE_WRAPPERS.has(wrapper);
        content = content[wrapper].message;
    }
    for (const [kind, type] of MEDIA_KINDS) {
        const media = content?.[kind];
        if (media && (media.viewOnce || wrapped))
            return { kind, type, media };
    }
    return null;
}

function hasDownloadKey(media) {
    return !!(media?.mediaKey && (media.directPath || media.url));
}

// SQLite/Mongo/etc. persist messages as JSON, which turns Buffers into
// {type:'Buffer', data:[...]}; the media decryption needs real Buffers back.
export function reviveBuffers(value) {
    if (!value || typeof value !== 'object')
        return value;
    if (Buffer.isBuffer(value) || value instanceof Uint8Array)
        return value;
    if (value.type === 'Buffer' && Array.isArray(value.data))
        return Buffer.from(value.data);
    if (Array.isArray(value))
        return value.map(reviveBuffers);
    const out = {};
    for (const [key, inner] of Object.entries(value))
        out[key] = reviveBuffers(inner);
    return out;
}

function quotedContext(message) {
    const content = message?.message || {};
    for (const inner of Object.values(content)) {
        if (inner?.contextInfo?.quotedMessage)
            return inner.contextInfo;
    }
    return null;
}

/**
 * Resolves the view-once media a command message replies to.
 * status: 'none' (no quoted view-once), 'notStored' (original not in the store),
 * 'unavailable' (WhatsApp sent no download key), or 'ok' with {kind, type, media, key}.
 */
export async function resolveQuotedViewOnce(sock, message, chatId) {
    const context = quotedContext(message);
    const quoted = context && findViewOnceMedia(context.quotedMessage);
    if (!quoted)
        return { status: 'none' };
    if (hasDownloadKey(quoted.media))
        return { status: 'ok', ...quoted, key: { remoteJid: chatId, id: context.stanzaId, participant: context.participant } };
    const jids = [...new Set([chatId, context.remoteJid, chatId && jidNormalizedUser(chatId)].filter(Boolean))];
    let original = null;
    for (const jid of jids) {
        original = await sock.store?.loadMessage(jid, context.stanzaId);
        if (original)
            break;
    }
    if (!original)
        return { status: 'notStored' };
    const found = findViewOnceMedia(reviveBuffers(original.message));
    if (!found || !hasDownloadKey(found.media))
        return { status: 'unavailable' };
    return { status: 'ok', ...found, key: original.key };
}

/** Downloads the decrypted media bytes exactly as sent (no re-encoding). */
export async function downloadViewOnce({ media, type }) {
    const chunks = [];
    for await (const chunk of await downloadContentFromMessage(media, type))
        chunks.push(chunk);
    return Buffer.concat(chunks);
}
