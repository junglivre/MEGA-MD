import { beforeEach, describe, expect, it, vi } from 'vitest';

// The vault persists through lightweight_store settings; keep it in memory here,
// round-tripping through JSON like the SQLite backend does.
const settings = new Map();
vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting: vi.fn(async (_scope, key) => (settings.has(key) ? JSON.parse(settings.get(key)) : null)),
        saveSetting: vi.fn(async (_scope, key, value) => settings.set(key, JSON.stringify(value)))
    }
}));
const downloadContentFromMessage = vi.fn();
vi.mock('@whiskeysockets/baileys', async (importOriginal) => ({
    ...(await importOriginal()),
    downloadContentFromMessage: (...args) => downloadContentFromMessage(...args)
}));

const {
    findViewOnceMedia, rememberViewOnce, resetViewOnceVault, resolveQuotedViewOnce,
    reviveBuffers, downloadViewOnce, ViewOnceExpiredError, RETENTION_MS
} = await import('../../lib/viewOnce.js');

const KEY = Buffer.from('0123456789abcdef0123456789abcdef');
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 23, 12);

// A reply to a view-once message, as WhatsApp delivers it: the quoted copy has
// viewOnce but no download key.
function replyTo(quotedMessage, stanzaId = 'ORIG1') {
    return {
        key: { remoteJid: 'chat@g.us', id: 'CMD1' },
        message: {
            extendedTextMessage: {
                text: '.vo',
                contextInfo: { stanzaId, participant: 'sender@lid', quotedMessage }
            }
        }
    };
}

function received(id, sentAt, media = { viewOnce: true, mediaKey: KEY, directPath: '/v/t62/x', mimetype: 'image/jpeg', jpegThumbnail: Buffer.alloc(9000) }) {
    return { key: { remoteJid: 'chat@g.us', id, participant: 'sender@lid' }, messageTimestamp: Math.floor(sentAt / 1000), message: { imageMessage: media } };
}

const emptySock = () => ({ store: { loadMessage: vi.fn(async () => null) } });

beforeEach(() => {
    settings.clear();
    resetViewOnceVault();
    downloadContentFromMessage.mockReset();
});

describe('findViewOnceMedia', () => {
    it('finds flagged media and media inside view-once wrappers', () => {
        expect(findViewOnceMedia({ imageMessage: { viewOnce: true } })?.type).toBe('image');
        expect(findViewOnceMedia({ viewOnceMessageV2: { message: { videoMessage: {} } } })?.type).toBe('video');
        expect(findViewOnceMedia({ viewOnceMessageV2Extension: { message: { audioMessage: { ptt: true } } } })?.type).toBe('audio');
        expect(findViewOnceMedia({ ephemeralMessage: { message: { viewOnceMessage: { message: { imageMessage: {} } } } } })?.kind).toBe('imageMessage');
    });

    it('ignores normal media', () => {
        expect(findViewOnceMedia({ imageMessage: { mimetype: 'image/jpeg' } })).toBeNull();
        expect(findViewOnceMedia({ ephemeralMessage: { message: { videoMessage: {} } } })).toBeNull();
        expect(findViewOnceMedia(undefined)).toBeNull();
    });
});

describe('reviveBuffers', () => {
    it('turns JSON-serialized Buffers back into Buffers', () => {
        const revived = reviveBuffers(JSON.parse(JSON.stringify({ a: { mediaKey: KEY, list: [KEY] } })));
        expect(revived.a.mediaKey.equals(KEY)).toBe(true);
        expect(Buffer.isBuffer(revived.a.list[0])).toBe(true);
    });
});

describe('view-once vault', () => {
    it('recovers a view-once that already left the 70-message store, keeping only download fields', async () => {
        await rememberViewOnce([received('ORIG1', NOW - DAY)], NOW);
        resetViewOnceVault(); // simulate a restart: reload from persisted settings

        const result = await resolveQuotedViewOnce(emptySock(), replyTo({ imageMessage: { viewOnce: true } }), 'chat@g.us', NOW);

        expect(result.status).toBe('ok');
        expect(result.media.mediaKey.equals(KEY)).toBe(true);
        expect(result.media.jpegThumbnail).toBeUndefined();
        expect(result.key).toMatchObject({ id: 'ORIG1', participant: 'sender@lid' });
    });

    it('reports media older than 7 days as expired, even after its key is dropped', async () => {
        await rememberViewOnce([received('OLD1', NOW - 8 * DAY)], NOW - 8 * DAY + 1000);

        const result = await resolveQuotedViewOnce(emptySock(), replyTo({ imageMessage: { viewOnce: true } }, 'OLD1'), 'chat@g.us', NOW);

        expect(result.status).toBe('expired');
        expect(settings.get('viewOnceVault')).not.toContain(KEY.toString('base64'));
    });

    it('forgets tombstones after 30 days', async () => {
        await rememberViewOnce([received('ANCIENT', NOW - 40 * DAY)], NOW - 40 * DAY + 1000);
        const result = await resolveQuotedViewOnce(emptySock(), replyTo({ imageMessage: { viewOnce: true } }, 'ANCIENT'), 'chat@g.us', NOW);
        expect(result.status).toBe('notStored');
    });

    it('ignores view-once that arrived without a key', async () => {
        await rememberViewOnce([received('NOKEY', NOW, { viewOnce: true })], NOW);
        expect(settings.has('viewOnceVault')).toBe(false);
    });
});

describe('resolveQuotedViewOnce fallback to the message store', () => {
    const stored = (message, sentAt) => JSON.parse(JSON.stringify({ key: { remoteJid: 'chat@g.us', id: 'ORIG1' }, messageTimestamp: Math.floor(sentAt / 1000), message }));
    const sockWith = (msg) => ({ store: { loadMessage: vi.fn(async (jid, id) => (jid === 'chat@g.us' && id === 'ORIG1' ? msg : null)) } });

    it('uses a stored original received before the vault existed', async () => {
        const sock = sockWith(stored({ imageMessage: { viewOnce: true, mediaKey: KEY, directPath: '/v/x' } }, NOW - DAY));
        const result = await resolveQuotedViewOnce(sock, replyTo({ imageMessage: { viewOnce: true } }), 'chat@g.us', NOW);
        expect(result.status).toBe('ok');
        expect(Buffer.isBuffer(result.media.mediaKey)).toBe(true);
    });

    it('treats a stored original older than the retention as expired', async () => {
        const sock = sockWith(stored({ imageMessage: { viewOnce: true, mediaKey: KEY, directPath: '/v/x' } }, NOW - RETENTION_MS - DAY));
        const result = await resolveQuotedViewOnce(sock, replyTo({ imageMessage: { viewOnce: true } }), 'chat@g.us', NOW);
        expect(result.status).toBe('expired');
    });

    it('reports an original that arrived without a download key', async () => {
        const sock = sockWith(stored({ imageMessage: { viewOnce: true } }, NOW));
        const result = await resolveQuotedViewOnce(sock, replyTo({ imageMessage: { viewOnce: true } }), 'chat@g.us', NOW);
        expect(result.status).toBe('unavailable');
    });

    it('ignores replies to normal media and messages without a reply', async () => {
        const sock = emptySock();
        expect((await resolveQuotedViewOnce(sock, replyTo({ imageMessage: { mediaKey: KEY } }), 'chat@g.us', NOW)).status).toBe('none');
        expect((await resolveQuotedViewOnce(sock, { message: { conversation: '.vo' } }, 'chat@g.us', NOW)).status).toBe('none');
        expect(sock.store.loadMessage).not.toHaveBeenCalled();
    });
});

describe('downloadViewOnce', () => {
    const found = { kind: 'imageMessage', type: 'image', media: { mediaKey: KEY, directPath: '/v/x' }, key: { id: 'ORIG1' } };
    const stream = (bytes) => (async function* () { yield bytes; })();
    const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

    it('asks the phone to re-upload when the CDN copy is gone', async () => {
        downloadContentFromMessage
            .mockRejectedValueOnce(httpError(410))
            .mockResolvedValueOnce(stream(Buffer.from('fresh')));
        const sock = { updateMediaMessage: vi.fn(async (msg) => msg) };

        const bytes = await downloadViewOnce(sock, found);

        expect(bytes.toString()).toBe('fresh');
        expect(sock.updateMediaMessage).toHaveBeenCalledOnce();
    });

    it('reports expiry when the phone refuses the re-upload', async () => {
        downloadContentFromMessage.mockRejectedValueOnce(httpError(404));
        const sock = { updateMediaMessage: vi.fn(async () => { throw new Error('Media re-upload failed by device (NOT_FOUND)'); }) };

        await expect(downloadViewOnce(sock, found)).rejects.toBeInstanceOf(ViewOnceExpiredError);
    });

    it('does not mistake other failures for expiry', async () => {
        downloadContentFromMessage.mockRejectedValueOnce(new Error('socket hang up'));
        await expect(downloadViewOnce({ updateMediaMessage: vi.fn() }, found)).rejects.toThrow('socket hang up');
    });
});
