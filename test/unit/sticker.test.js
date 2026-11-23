import { describe, expect, it } from 'vitest';
import { getStickerShape, parseStickerArgs } from '../../plugins/sticker.js';

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
    it.each(['-s', '-stretch', '-esticado', '-full', '-FULL'])('%s stretches to 512x512', (flag) => {
        expect(parseStickerArgs([flag]).shape).toBe('stretch');
    });

    it('no longer treats -crop as a shape', () => {
        const parsed = parseStickerArgs(['-crop']);
        expect(parsed.shape).toBeNull();
        expect(parsed.bareText).toBe('-crop');
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
