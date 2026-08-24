import { describe, expect, it } from 'vitest';
import { getStickerShape } from '../../plugins/sticker.js';

describe('sticker default shape', () => {
    it('uses normal mode for animated media', () => {
        expect(getStickerShape(null, true)).toBe('normal');
    });

    it('keeps full mode as the default for static media', () => {
        expect(getStickerShape(null, false)).toBe('full');
    });

    it('respects an explicitly requested shape', () => {
        expect(getStickerShape('crop', true)).toBe('crop');
        expect(getStickerShape('full', true)).toBe('full');
    });
});
