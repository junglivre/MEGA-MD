import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
    createAsciiImage,
    createContentAwareScaleImage,
    createForgivenessImage,
    createPerfectImage,
    createPetPetGif,
    createPrideOverlayImage,
    createSamImage,
    createToBeContinuedImage,
    createTriggeredGif,
    getImageMedia,
    getMentionedJids,
    imageErrorReply,
    invertImage,
    mirrorImage,
    resolveImageInput
} from '../../lib/imageEffects.js';

async function pixelRow(buffer) {
    const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = [];
    for (let x = 0; x < info.width; x++)
        pixels.push([...data.subarray(x * info.channels, x * info.channels + 3)]);
    return pixels;
}

describe('image effects', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

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

    it('finds and normalizes mentions in text and media messages', () => {
        const textMessage = {
            message: {
                extendedTextMessage: {
                    contextInfo: { mentionedJid: ['5511999999999:4@s.whatsapp.net'] }
                }
            }
        };
        const imageMessage = {
            message: {
                imageMessage: {
                    contextInfo: { mentionedJid: ['123456789@lid', '123456789@lid'] }
                }
            }
        };
        expect(getMentionedJids(textMessage)).toEqual(['5511999999999@s.whatsapp.net']);
        expect(getMentionedJids(imageMessage)).toEqual(['123456789@lid']);
    });

    it('uses the mentioned profile picture before attached media', async () => {
        const avatar = await sharp({
            create: { width: 32, height: 32, channels: 3, background: '#9867c5' }
        }).png().toBuffer();
        const profilePictureUrl = vi.fn().mockResolvedValue('https://example.test/avatar.png');
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => String(avatar.length) },
            arrayBuffer: async () => avatar.buffer.slice(avatar.byteOffset, avatar.byteOffset + avatar.byteLength)
        });
        vi.stubGlobal('fetch', fetchMock);
        const message = {
            message: {
                imageMessage: {
                    mimetype: 'image/jpeg',
                    contextInfo: { mentionedJid: ['5511999999999@s.whatsapp.net'] }
                }
            }
        };

        const result = await resolveImageInput({ profilePictureUrl }, message, '5511888888888@s.whatsapp.net');

        expect(result.equals(avatar)).toBe(true);
        expect(profilePictureUrl).toHaveBeenCalledWith('5511999999999@s.whatsapp.net', 'image');
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('returns a neutral profile-picture hint instead of using another image', async () => {
        const message = {
            message: {
                extendedTextMessage: {
                    contextInfo: {
                        mentionedJid: ['5511999999999@s.whatsapp.net'],
                        quotedMessage: { imageMessage: { mimetype: 'image/jpeg' } }
                    }
                }
            }
        };
        const sock = { profilePictureUrl: vi.fn().mockRejectedValue(new Error('not authorized')) };

        let caught;
        try {
            await resolveImageInput(sock, message, '5511888888888@s.whatsapp.net');
        }
        catch (error) {
            caught = error;
        }
        const reply = imageErrorReply(caught, key => key);

        expect(caught?.code).toBe('NO_PROFILE_PICTURE');
        expect(reply).toEqual({ key: 'noProfilePicture', text: 'p.imagefx.noProfilePicture' });
        expect(reply.text).not.toContain('❌');
    });

    it('returns a neutral usage hint when no mention or media is present', async () => {
        let caught;
        try {
            await resolveImageInput({}, { message: { conversation: '.jooj' } }, '5511888888888@s.whatsapp.net');
        }
        catch (error) {
            caught = error;
        }
        const reply = imageErrorReply(caught, key => key);

        expect(caught?.code).toBe('NO_IMAGE');
        expect(reply).toEqual({ key: 'noImage', text: 'p.imagefx.noImage' });
        expect(reply.text).not.toContain('❌');
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

    it('adds a subtle rainbow overlay while preserving the photo', async () => {
        const input = await sharp({
            create: { width: 60, height: 60, channels: 3, background: '#808080' }
        }).png().toBuffer();
        const result = await createPrideOverlayImage(input);
        const { data, info } = await sharp(result).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const topPixel = [...data.subarray(0, 3)];
        const greenPixelOffset = Math.floor(info.height * 0.58) * info.width * info.channels;
        const greenPixel = [...data.subarray(greenPixelOffset, greenPixelOffset + 3)];

        expect(info.width).toBe(60);
        expect(info.height).toBe(60);
        expect(topPixel[0]).toBeGreaterThan(topPixel[1]);
        expect(greenPixel[1]).toBeGreaterThan(greenPixel[0]);
        expect(topPixel.every(channel => channel > 95)).toBe(true);
        expect(Math.max(...topPixel) - Math.min(...topPixel)).toBeLessThan(50);
    });

    it('places a photo in the perfect meme template', async () => {
        const input = await sharp({
            create: { width: 100, height: 160, channels: 3, background: '#20c060' }
        }).png().toBuffer();
        const template = await fs.readFile(path.join(process.cwd(), 'assets/image-effects/perfeito.png'));
        const result = await createPerfectImage(input, template);
        const metadata = await sharp(result).metadata();
        const pixel = await sharp(result).extract({ left: 300, top: 100, width: 1, height: 1 })
            .removeAlpha().raw().toBuffer();

        expect(metadata.width).toBe(456);
        expect(metadata.height).toBe(400);
        expect([...pixel]).toEqual([32, 192, 96]);
    });

    it('renders petpet as a five-frame animated GIF', async () => {
        const input = await sharp({
            create: { width: 100, height: 100, channels: 3, background: '#3278c8' }
        }).png().toBuffer();
        const overlay = await fs.readFile(path.join(process.cwd(), 'assets/image-effects/petpet-transparent.gif'));
        const result = await createPetPetGif(input, overlay);
        const metadata = await sharp(result, { animated: true }).metadata();

        expect(metadata.format).toBe('gif');
        expect(metadata.pages).toBe(5);
        expect(metadata.width).toBe(112);
        expect(metadata.pageHeight).toBe(112);
    });

    it('renders the continued overlay without changing the canvas size', async () => {
        const input = await sharp({
            create: { width: 320, height: 180, channels: 3, background: '#4c78a8' }
        }).png().toBuffer();
        const overlay = await fs.readFile(path.join(process.cwd(), 'assets/image-effects/to-be-continued.png'));
        const metadata = await sharp(await createToBeContinuedImage(input, overlay)).metadata();
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

    it('adds a SAM badge without changing the canvas size', async () => {
        const input = await sharp({
            create: { width: 320, height: 180, channels: 3, background: '#4c78a8' }
        }).png().toBuffer();
        const overlay = await fs.readFile(path.join(process.cwd(), 'assets/image-effects/sam.png'));
        const metadata = await sharp(await createSamImage(input, overlay)).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(320);
        expect(metadata.height).toBe(180);
    });

    it('content-aware scales locally and restores the display dimensions', async () => {
        const input = await sharp({
            create: { width: 80, height: 60, channels: 3, background: '#4c78a8' }
        }).composite([{
            input: Buffer.from('<svg width="80" height="60"><circle cx="18" cy="25" r="12" fill="#ffcc00"/></svg>')
        }]).png().toBuffer();
        const result = await createContentAwareScaleImage(input, 0.25);
        const metadata = await sharp(result).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(80);
        expect(metadata.height).toBe(60);
        expect(result.equals(input)).toBe(false);
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
