import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStickerShape, parseStickerArgs, renderSticker } from '../../plugins/sticker.js';

describe('sticker default shape', () => {
    it('keeps the original proportions without flags', () => {
        expect(getStickerShape(null, false)).toBe('original');
        // Animated keeps proportions too, on a transparent square canvas.
        expect(getStickerShape(null, true)).toBe('padded');
    });

    it('respects an explicitly requested shape', () => {
        expect(getStickerShape('stretch', true)).toBe('stretch');
        expect(getStickerShape('circle', false)).toBe('circle');
    });
});

describe('parseStickerArgs', () => {
    it.each(['-s', '-f', '-stretch', '-esticado', '-full', '-FULL'])('%s stretches to 512x512', (flag) => {
        expect(parseStickerArgs([flag]).shape).toBe('stretch');
    });

    it.each([['-crop', 'crop'], ['-c', 'crop'], ['-rounded', 'circle'], ['-circle', 'circle'], ['-r', 'circle']])('%s selects %s', (flag, shape) => {
        expect(parseStickerArgs([flag]).shape).toBe(shape);
    });

    it('-p is a short form of -custom', () => {
        expect(parseStickerArgs(['-p', 'Jung|Memes', '-c'])).toMatchObject({ customAuthor: 'Jung', customPack: 'Memes', shape: 'crop' });
    });

    it.each(['-sa', '-semaudio', '-na', '-noaudio'])('%s turns the sound off without changing the shape', (flag) => {
        expect(parseStickerArgs([flag, '-s'])).toMatchObject({ noAudio: true, shape: 'stretch' });
        expect(parseStickerArgs(['-s']).noAudio).toBe(false);
    });

    it('-custom without a pipe sets only the pack and removes the author', () => {
        expect(parseStickerArgs(['-custom', 'Memes', 'do', 'Grupo'])).toMatchObject({
            customPack: 'Memes do Grupo',
            customAuthor: ''
        });
    });

    it('-custom author|pack sets both, and no -custom keeps the default author', () => {
        expect(parseStickerArgs(['-custom', 'Jung|Memes', '-s'])).toMatchObject({ customAuthor: 'Jung', customPack: 'Memes', shape: 'stretch' });
        expect(parseStickerArgs(['😂']).customAuthor).toBeNull();
    });

    it('collects emoji categories separately from text', () => {
        expect(parseStickerArgs(['😂', 'Pacote', '🔥'])).toMatchObject({ emojiTokens: ['😂', '🔥'], bareText: 'Pacote' });
    });
});

describe('re-rendering an animated sticker', () => {
    // ffmpeg (6.1 on prod, 7.1 here) cannot decode animated WebP on its own.
    let dir;
    let animatedWebp;
    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticker-anim-'));
        const file = path.join(dir, 'in.webp');
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10:duration=2,format=rgba', '-c:v', 'libwebp', '-loop', '0', file]);
        animatedWebp = fs.readFileSync(file);
    });
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    // A quoted sticker does not always carry isAnimated, so the bytes decide.
    it.each([[{ mimetype: 'image/webp' }], [{ mimetype: 'image/webp', isAnimated: true }]])('stretches every frame (%j)', async (mediaMessage) => {
        const { buffer, animated } = await renderSticker({
            mediaBuffer: animatedWebp,
            mediaMessage,
            isExistingSticker: true,
            parsed: parseStickerArgs(['-s']),
            tempInput: path.join(dir, 'tmp-in'),
            tempOutput: path.join(dir, 'tmp-out.webp')
        });
        const meta = await sharp(buffer, { animated: true }).metadata();
        expect(animated).toBe(true);
        expect(meta.width).toBe(512);
        expect(meta.pageHeight).toBe(512);
        expect(meta.pages).toBeGreaterThan(10);
    }, 30000);
});
