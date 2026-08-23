import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
    createAsciiImage,
    createForgivenessImage,
    createToBeContinuedImage,
    createTriggeredGif,
    getImageMedia,
    invertImage,
    mirrorImage
} from '../../lib/imageEffects.js';

async function pixelRow(buffer) {
    const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = [];
    for (let x = 0; x < info.width; x++)
        pixels.push([...data.subarray(x * info.channels, x * info.channels + 3)]);
    return pixels;
}

describe('image effects', () => {
    it('finds direct and quoted photos and static stickers', () => {
        const direct = { message: { imageMessage: { mimetype: 'image/jpeg' } } };
        const quoted = {
            message: {
                extendedTextMessage: {
                    contextInfo: { quotedMessage: { imageMessage: { mimetype: 'image/png' } } }
                }
            }
        };
        const sticker = { message: { stickerMessage: { mimetype: 'image/webp' } } };
        expect(getImageMedia(direct)?.type).toBe('image');
        expect(getImageMedia(quoted)?.media.mimetype).toBe('image/png');
        expect(getImageMedia(sticker)?.type).toBe('sticker');
        expect(getImageMedia({ message: { conversation: 'hello' } })).toBeNull();
    });

    it('mirrors the selected half while preserving odd dimensions', async () => {
        const colours = [
            [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255]
        ];
        const raw = Buffer.from(colours.flat());
        const input = await sharp(raw, { raw: { width: 5, height: 1, channels: 3 } }).png().toBuffer();
        expect(await pixelRow(await mirrorImage(input, 'left'))).toEqual([
            colours[0], colours[1], colours[2], colours[1], colours[0]
        ]);
        expect(await pixelRow(await mirrorImage(input, 'right'))).toEqual([
            colours[4], colours[3], colours[2], colours[3], colours[4]
        ]);
    });

    it('renders ASCII output as a valid PNG', async () => {
        const input = await sharp({
            create: { width: 100, height: 60, channels: 3, background: '#808080' }
        }).png().toBuffer();
        const result = await createAsciiImage(input);
        const metadata = await sharp(result).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBeGreaterThan(300);
        expect(metadata.height).toBeGreaterThan(100);
    });

    it('inverts RGB colours without changing the dimensions', async () => {
        const input = await sharp(Buffer.from([10, 20, 30]), {
            raw: { width: 1, height: 1, channels: 3 }
        }).png().toBuffer();
        const output = await sharp(await invertImage(input)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        expect([...output.data]).toEqual([245, 235, 225]);
        expect(output.info.width).toBe(1);
        expect(output.info.height).toBe(1);
    });

    it('renders the continued overlay without changing the canvas size', async () => {
        const input = await sharp({
            create: { width: 320, height: 180, channels: 3, background: '#4c78a8' }
        }).png().toBuffer();
        const metadata = await sharp(await createToBeContinuedImage(input, 'CONTINUA...')).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(320);
        expect(metadata.height).toBe(180);
    });

    it('appends a forgiveness panel while preserving the photo width', async () => {
        const input = await sharp({
            create: { width: 320, height: 180, channels: 3, background: '#4c78a8' }
        }).png().toBuffer();
        const metadata = await sharp(await createForgivenessImage(input)).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(320);
        expect(metadata.height).toBeGreaterThan(180);
    });

    it('renders triggered as a six-frame animated GIF', async () => {
        const base = sharp({
            create: { width: 120, height: 80, channels: 3, background: '#3278c8' }
        });
        const input = await base.composite([{
            input: Buffer.from('<svg width="120" height="80"><circle cx="20" cy="20" r="15" fill="#ffcc00"/></svg>')
        }]).png().toBuffer();
        const result = await createTriggeredGif(input);
        const metadata = await sharp(result, { animated: true }).metadata();
        expect(metadata.format).toBe('gif');
        expect(metadata.pages).toBe(6);
        expect(metadata.pageHeight).toBeGreaterThan(80);
    });
});
