import { describe, expect, it, vi } from 'vitest';
import { findViewOnceMedia, resolveQuotedViewOnce, reviveBuffers } from '../../lib/viewOnce.js';

const KEY = Buffer.from('0123456789abcdef0123456789abcdef');

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

// Stored messages come back from SQLite JSON, where Buffers are {type, data}.
const stored = (message) => JSON.parse(JSON.stringify({ key: { remoteJid: 'chat@g.us', id: 'ORIG1' }, message }));

function sockWith(messages) {
    return { store: { loadMessage: vi.fn(async (jid, id) => messages[`${jid}/${id}`] ?? null) } };
}

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
        expect(Buffer.isBuffer(revived.a.mediaKey)).toBe(true);
        expect(revived.a.mediaKey.equals(KEY)).toBe(true);
        expect(Buffer.isBuffer(revived.a.list[0])).toBe(true);
    });
});

describe('resolveQuotedViewOnce', () => {
    it('loads the stored original and restores its download key', async () => {
        const sock = sockWith({
            'chat@g.us/ORIG1': stored({ imageMessage: { viewOnce: true, mediaKey: KEY, directPath: '/v/t62/x', mimetype: 'image/jpeg' } })
        });
        const result = await resolveQuotedViewOnce(sock, replyTo({ imageMessage: { viewOnce: true } }), 'chat@g.us');

        expect(result.status).toBe('ok');
        expect(result.type).toBe('image');
        expect(Buffer.isBuffer(result.media.mediaKey)).toBe(true);
        expect(result.key.id).toBe('ORIG1');
    });

    it('reports a view-once reply whose original is no longer stored', async () => {
        const result = await resolveQuotedViewOnce(sockWith({}), replyTo({ videoMessage: { viewOnce: true } }), 'chat@g.us');
        expect(result.status).toBe('notStored');
    });

    it('reports an original that arrived without a download key', async () => {
        const sock = sockWith({ 'chat@g.us/ORIG1': stored({ imageMessage: { viewOnce: true } }) });
        const result = await resolveQuotedViewOnce(sock, replyTo({ imageMessage: { viewOnce: true } }), 'chat@g.us');
        expect(result.status).toBe('unavailable');
    });

    it('ignores replies to normal media and messages without a reply', async () => {
        const sock = sockWith({});
        expect((await resolveQuotedViewOnce(sock, replyTo({ imageMessage: { mediaKey: KEY } }), 'chat@g.us')).status).toBe('none');
        expect((await resolveQuotedViewOnce(sock, { message: { conversation: '.vo' } }, 'chat@g.us')).status).toBe('none');
        expect(sock.store.loadMessage).not.toHaveBeenCalled();
    });
});
