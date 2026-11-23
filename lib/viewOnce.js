// View-once media: finding it in a message, keeping its download key, and
// recovering it when someone replies with a command (.vo, .sticker).
//
// Even on a mobile companion (DEVICE_TYPE=mobile), the copy WhatsApp embeds in
// a reply's contextInfo keeps only `viewOnce: true`, without mediaKey or
// directPath. The original message, as received, does carry them.
//
// The general message store only holds the last 70 messages per chat, which a
// busy group pushes out in minutes, so every view-once received is also kept in
// a small vault by time (RETENTION_MS): just the fields needed to download and
// re-send it, no thumbnails. After that the key is dropped and the entry
// becomes a tombstone, so a late command can say "expired" instead of
// "not found"; tombstones go away after TOMBSTONE_MS.
//
// Pre-link history does not help: on 2026-11-23 the phone's history sync
// delivered 75 old view-once messages, none with a download key.
import { downloadContentFromMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import store from './lightweight_store.js';

export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const TOMBSTONE_MS = 30 * 24 * 60 * 60 * 1000;
const REUPLOAD_TIMEOUT_MS = 20000;
const VAULT_SCOPE = 'global';
const VAULT_KEY = 'viewOnceVault';

const MEDIA_KINDS = [
    ['imageMessage', 'image'],
    ['videoMessage', 'video'],
    ['audioMessage', 'audio']
];
const WRAPPERS = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage'];
const VIEW_ONCE_WRAPPERS = new Set(['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']);
const BUFFER_FIELDS = ['mediaKey', 'fileEncSha256', 'fileSha256'];
const NUMBER_FIELDS = ['fileLength', 'mediaKeyTimestamp', 'seconds', 'width', 'height'];
const PLAIN_FIELDS = ['url', 'directPath', 'mimetype', 'caption', 'gifPlayback', 'ptt'];

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

const toNumber = (value) => (value == null ? NaN : Number(value.toString?.() ?? value));

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

// ---------------------------------------------------------------- vault

let vault = null;
let vaultWrites = Promise.resolve();

function packMedia(media) {
    const out = {};
    for (const field of PLAIN_FIELDS) {
        if (media[field] != null)
            out[field] = media[field];
    }
    for (const field of NUMBER_FIELDS) {
        const value = toNumber(media[field]);
        if (Number.isFinite(value))
            out[field] = value;
    }
    for (const field of BUFFER_FIELDS) {
        if (media[field]?.length)
            out[field] = Buffer.from(media[field]).toString('base64');
    }
    return out;
}

function unpackMedia(media) {
    const out = { ...media };
    for (const field of BUFFER_FIELDS) {
        if (typeof media[field] === 'string')
            out[field] = Buffer.from(media[field], 'base64');
    }
    return out;
}

async function loadVault() {
    if (!vault)
        vault = (await store.getSetting(VAULT_SCOPE, VAULT_KEY)) || {};
    return vault;
}

function persistVault() {
    const snapshot = { ...vault };
    vaultWrites = vaultWrites
        .then(() => store.saveSetting(VAULT_SCOPE, VAULT_KEY, snapshot))
        .catch((error) => console.error('[viewOnce] Failed to persist vault:', error.message));
    return vaultWrites;
}

function pruneVault(entries, now) {
    let changed = false;
    for (const [id, entry] of Object.entries(entries)) {
        const age = now - entry.receivedAt;
        if (age > TOMBSTONE_MS) {
            delete entries[id];
            changed = true;
        }
        else if (age > RETENTION_MS && entry.media) {
            entries[id] = { receivedAt: entry.receivedAt, expired: true };
            changed = true;
        }
    }
    return changed;
}

/** Keeps the download key of each view-once media in `messages` (from messages.upsert). */
export async function rememberViewOnce(messages, now = Date.now()) {
    const found = [];
    for (const msg of messages || []) {
        const media = msg?.key?.id && findViewOnceMedia(msg.message);
        if (media && hasDownloadKey(media.media))
            found.push([msg, media]);
    }
    if (!found.length)
        return;
    const entries = await loadVault();
    pruneVault(entries, now);
    for (const [msg, { kind, type, media }] of found) {
        const sentAt = toNumber(msg.messageTimestamp) * 1000;
        entries[msg.key.id] = {
            receivedAt: Number.isFinite(sentAt) && sentAt > 0 ? sentAt : now,
            key: { remoteJid: msg.key.remoteJid, id: msg.key.id, fromMe: !!msg.key.fromMe, participant: msg.key.participant || undefined },
            kind,
            type,
            media: packMedia(media)
        };
    }
    await persistVault();
}

async function lookupVault(id, now) {
    const entries = await loadVault();
    if (pruneVault(entries, now))
        persistVault();
    const entry = entries[id];
    if (!entry)
        return null;
    if (entry.expired || !entry.media)
        return { status: 'expired' };
    return { status: 'ok', kind: entry.kind, type: entry.type, media: unpackMedia(entry.media), key: entry.key };
}

/** Test hook: drop the in-memory vault so the next call reloads it from the store. */
export function resetViewOnceVault() {
    vault = null;
    vaultWrites = Promise.resolve();
}

// ---------------------------------------------------------------- resolve

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
 * status: 'none' (no quoted view-once), 'notStored' (never received with a key,
 * e.g. sent before the bot linked), 'expired' (older than RETENTION_MS),
 * 'unavailable' (WhatsApp sent no download key), or 'ok' with {kind, type, media, key}.
 */
export async function resolveQuotedViewOnce(sock, message, chatId, now = Date.now()) {
    const context = quotedContext(message);
    const quoted = context && findViewOnceMedia(context.quotedMessage);
    if (!quoted)
        return { status: 'none' };
    if (hasDownloadKey(quoted.media))
        return { status: 'ok', ...quoted, key: { remoteJid: chatId, id: context.stanzaId, participant: context.participant } };
    const kept = await lookupVault(context.stanzaId, now);
    if (kept)
        return kept;
    // Fallback for view-once received before the vault existed.
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
    if (now - toNumber(original.messageTimestamp) * 1000 > RETENTION_MS)
        return { status: 'expired' };
    return { status: 'ok', ...found, key: original.key };
}

// ---------------------------------------------------------------- download

export class ViewOnceExpiredError extends Error {
    constructor(cause) {
        super('View-once media is no longer available on WhatsApp');
        this.cause = cause;
    }
}

async function fetchBytes(media, type) {
    const chunks = [];
    for await (const chunk of await downloadContentFromMessage(media, type))
        chunks.push(chunk);
    return Buffer.concat(chunks);
}

/**
 * Downloads the decrypted media bytes exactly as sent (no re-encoding). When the
 * CDN copy is gone (404/410) it asks the phone to re-upload once; if that fails
 * too, throws ViewOnceExpiredError.
 */
export async function downloadViewOnce(sock, { kind, type, media, key }) {
    try {
        return await fetchBytes(media, type);
    }
    catch (error) {
        const status = error?.status ?? error?.output?.statusCode;
        if (status !== 404 && status !== 410)
            throw error;
        try {
            const refreshed = await Promise.race([
                sock.updateMediaMessage({ key, message: { [kind]: media } }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('re-upload timed out')), REUPLOAD_TIMEOUT_MS))
            ]);
            return await fetchBytes(refreshed.message[kind], type);
        }
        catch (retryError) {
            throw new ViewOnceExpiredError(retryError);
        }
    }
}
