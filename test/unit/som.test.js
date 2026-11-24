import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'som-test-'));
vi.mock('../../lib/paths.js', () => ({ TEMP_DIR: tempRoot }));
vi.mock('../../lib/messageConfig.js', () => ({ channelInfo: { contextInfo: {} } }));
const sendSoundSticker = vi.fn();
vi.mock('../../lib/soundSticker.js', async (importOriginal) => ({
    ...(await importOriginal()),
    sendSoundSticker: (...args) => sendSoundSticker(...args)
}));
const downloads = new Map();
const renderSticker = vi.fn(async () => ({ buffer: Buffer.from('webp'), animated: false, clipSeconds: null }));
vi.mock('../../plugins/sticker.js', async (importOriginal) => ({
    ...(await importOriginal()),
    downloadStickerSource: vi.fn(async (_sock, target) => downloads.get(target.key.id)),
    renderSticker: (...args) => renderSticker(...args)
}));

const { default: som, handleSoundStickerReply, parseSomArgs, classifyMedia } = await import('../../plugins/som.js');

// 10 s of tone, so start offsets can be checked against the clip length.
const AUDIO = (() => {
    const file = path.join(tempRoot, 'tone.ogg');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10', '-c:a', 'libopus', file]);
    return fs.readFileSync(file);
})();

const CHAT = 'group@g.us';
const ALICE = 'alice@lid';
const BOB = 'bob@lid';
const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
const msg = (id, content) => ({ key: { remoteJid: CHAT, id }, message: content });
const reply = (id, quotedId, quotedMessage) => msg(id, { extendedTextMessage: { text: '.som', contextInfo: { stanzaId: quotedId, quotedMessage } } });

let sock;
beforeEach(() => {
    sock = { sendMessage: vi.fn(async () => ({})) };
    sendSoundSticker.mockReset();
    renderSticker.mockClear();
    downloads.clear();
});
afterEach(() => vi.useRealTimers());

const run = (message, args, senderId = ALICE) => som.handler(sock, message, args, { t, senderId, chatId: CHAT });

describe('parseSomArgs', () => {
    it('reads the start offset in seconds or m:ss and leaves sticker flags', () => {
        expect(parseSomArgs(['5', '-c'])).toMatchObject({ start: 5, sticker: { shape: 'crop' } });
        expect(parseSomArgs(['-r', '1:30'])).toMatchObject({ start: 90, sticker: { shape: 'circle' } });
        expect(parseSomArgs([]).start).toBe(0);
    });

    it('does not take a number that belongs to the -p pack name', () => {
        expect(parseSomArgs(['-p', 'Memes', '2026'])).toMatchObject({ start: 0, sticker: { customPack: 'Memes 2026' } });
    });
});

describe('classifyMedia', () => {
    it('sorts pictures and audio, unwrapping sound stickers', () => {
        expect(classifyMedia(msg('1', { imageMessage: {} })).kind).toBe('visual');
        expect(classifyMedia(msg('1', { audioStickerMessage: { message: { stickerMessage: { mimetype: 'image/webp' } } } }))).toMatchObject({ kind: 'visual', media: { mimetype: 'image/webp' } });
        expect(classifyMedia(msg('1', { audioMessage: { ptt: true } })).kind).toBe('audio');
        expect(classifyMedia(msg('1', { documentMessage: { mimetype: 'audio/mpeg' } })).kind).toBe('audio');
        expect(classifyMedia(msg('1', { conversation: 'oi' }))).toBeNull();
    });
});

describe('.som two-step flow', () => {
    it('asks for the audio, ignores other people and text, then builds from the sender audio', async () => {
        downloads.set('IMG', Buffer.from('jpeg'));
        downloads.set('AUD', AUDIO);
        await run(reply('CMD', 'IMG', { imageMessage: { mimetype: 'image/jpeg' } }), ['3', '-c']);
        expect(sock.sendMessage.mock.calls[0][1].text).toMatch(/^p\.som\.askAudio/);

        expect(await handleSoundStickerReply(sock, CHAT, BOB, msg('X1', { audioMessage: {} }))).toBe(false);
        expect(await handleSoundStickerReply(sock, CHAT, ALICE, msg('X2', { conversation: 'calma' }))).toBe(false);
        expect(await handleSoundStickerReply(sock, CHAT, ALICE, msg('X3', { imageMessage: {} }))).toBe(false);
        expect(sendSoundSticker).not.toHaveBeenCalled();

        const audioMsg = msg('AUD', { audioMessage: { ptt: true } });
        expect(await handleSoundStickerReply(sock, CHAT, ALICE, audioMsg)).toBe(true);

        expect(renderSticker.mock.calls[0][0]).toMatchObject({ mediaMessage: { mimetype: 'image/jpeg' }, isExistingSticker: false, parsed: { shape: 'crop' } });
        const [, , sent] = sendSoundSticker.mock.calls[0];
        expect(sent.seconds).toBe(7); // 10 s clip started at 3 s
        expect(sent.quoted).toBe(audioMsg);
        // Consumed: the next audio is ordinary again.
        expect(await handleSoundStickerReply(sock, CHAT, ALICE, msg('AUD2', { audioMessage: {} }))).toBe(false);
        expect(fs.readdirSync(tempRoot).filter((n) => n.startsWith('som_'))).toEqual([]);
    });

    it('works the other way round: audio first, then an existing sticker keeps its pixels', async () => {
        downloads.set('AUD', AUDIO);
        downloads.set('STK', Buffer.from('webp'));
        await run(reply('CMD', 'AUD', { audioMessage: {} }), []);
        expect(sock.sendMessage.mock.calls[0][1].text).toMatch(/^p\.som\.askVisual/);

        expect(await handleSoundStickerReply(sock, CHAT, ALICE, msg('STK', { stickerMessage: { mimetype: 'image/webp', isAnimated: false } }))).toBe(true);

        expect(renderSticker.mock.calls[0][0].isExistingSticker).toBe(true);
        expect(sendSoundSticker.mock.calls[0][2].seconds).toBe(10);
    });

    it('expires after two minutes', async () => {
        vi.useFakeTimers();
        await run(reply('CMD', 'IMG', { imageMessage: {} }), []);
        vi.advanceTimersByTime(2 * 60 * 1000 + 1);
        expect(sock.sendMessage.mock.calls.at(-1)[1].text).toBe('⌛ p.som.expired');
        expect(await handleSoundStickerReply(sock, CHAT, ALICE, msg('AUD', { audioMessage: {} }))).toBe(false);
    });

    it('explains the usage when nothing usable is quoted', async () => {
        await run(msg('CMD', { conversation: '.som' }), []);
        expect(sock.sendMessage.mock.calls[0][1].text).toBe('p.som.usage');
    });
});
