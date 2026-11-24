import { afterAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { proto } from '@whiskeysockets/baileys';
import { extractStickerAudio, sendSoundSticker, unwrapSoundSticker, SOUND_STICKER_MIMETYPE } from '../../lib/soundSticker.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sound-sticker-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args]);

describe('sound sticker protobuf', () => {
    // Layout of the sound sticker captured from WhatsApp on 2026-11-24.
    const captured = {
        audioStickerMessage: {
            message: {
                stickerMessage: {
                    mimetype: 'image/webp', isAnimated: true, premium: 0, emojis: '',
                    audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 4, fileLength: 32643 }
                }
            }
        }
    };

    it('keeps the clip when a sound sticker is encoded and decoded', () => {
        const decoded = proto.Message.decode(proto.Message.encode(captured).finish());
        const { sticker, audio } = unwrapSoundSticker(decoded);
        expect(sticker.mimetype).toBe('image/webp');
        expect(audio).toMatchObject({ mimetype: 'audio/ogg; codecs=opus', seconds: 4 });
    });

    it('keeps the clip of a quoted sound sticker in a reply', () => {
        const reply = proto.Message.decode(proto.Message.encode({
            extendedTextMessage: { text: '.s', contextInfo: { stanzaId: 'X', quotedMessage: captured } }
        }).finish());
        expect(unwrapSoundSticker(reply.extendedTextMessage.contextInfo.quotedMessage)?.audio?.seconds).toBe(4);
    });

    it('keeps the clip when the message store saves it as JSON and reloads it', () => {
        // lightweight_store persists messages with JSON.stringify (proto toJSON).
        const received = proto.Message.decode(proto.Message.encode(captured).finish());
        const reloaded = proto.Message.fromObject(JSON.parse(JSON.stringify(received)));
        expect(unwrapSoundSticker(reloaded)?.audio).toMatchObject({ mimetype: 'audio/ogg; codecs=opus', seconds: 4 });
    });

    it('does not treat a regular sticker as a sound sticker', () => {
        expect(unwrapSoundSticker({ stickerMessage: { mimetype: 'image/webp' } })).toBeNull();
    });
});

describe('extractStickerAudio', () => {
    it('encodes the first seconds of a video as mono 48 kHz Opus', async () => {
        const input = path.join(dir, 'with-audio.mp4');
        ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', input);

        const clip = await extractStickerAudio(input, path.join(dir, 'clip.ogg'), 6);

        expect(clip.seconds).toBe(6);
        const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels', '-of', 'csv=p=0', clip.path], { encoding: 'utf8' }).trim();
        expect(probe).toBe('opus,48000,1');
    });

    it('returns null for a video without an audio track', async () => {
        const input = path.join(dir, 'silent.mp4');
        ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=15', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', input);
        expect(await extractStickerAudio(input, path.join(dir, 'none.ogg'), 6)).toBeNull();
    });
});

describe('sendSoundSticker', () => {
    it('uploads sticker and clip separately and relays the captured layout', async () => {
        const uploads = [];
        const sock = {
            user: { id: '5511999999999:7@s.whatsapp.net' },
            logger: undefined,
            waUploadToServer: vi.fn(async (_path, { mediaType }) => {
                uploads.push(mediaType);
                return { mediaUrl: `https://mmg.whatsapp.net/${mediaType}`, directPath: `/v/${mediaType}` };
            }),
            relayMessage: vi.fn()
        };
        const quoted = { key: { remoteJid: 'chat@g.us', id: 'CMD1', participant: 'user@lid' }, message: { conversation: '.s' } };

        await sendSoundSticker(sock, 'chat@g.us', {
            sticker: Buffer.from('RIFF0000WEBPVP8 '), audio: Buffer.from('OggS fake clip'), seconds: 6, animated: true,
            contextInfo: { forwardingScore: 1 }, quoted
        });

        expect(uploads).toEqual(['sticker', 'audio']);
        const [jid, sent] = sock.relayMessage.mock.calls[0];
        expect(jid).toBe('chat@g.us');
        // Encode exactly as Baileys does when relaying, then read it back.
        const { sticker, audio } = unwrapSoundSticker(proto.Message.decode(proto.Message.encode(sent).finish()));
        expect(sticker).toMatchObject({ mimetype: 'image/webp', isAnimated: true, directPath: '/v/sticker' });
        expect(sticker.contextInfo).toMatchObject({ stanzaId: 'CMD1', forwardingScore: 1 });
        expect(audio).toMatchObject({ mimetype: SOUND_STICKER_MIMETYPE, seconds: 6, directPath: '/v/audio' });
        expect(audio.mediaKey).not.toEqual(sticker.mediaKey);
    });
});
