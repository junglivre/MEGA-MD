import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instagram-test-'));
const execFile = vi.fn();

vi.mock('child_process', () => ({ execFile: (...args) => execFile(...args) }));
vi.mock('../../lib/paths.js', () => ({ TEMP_DIR: tempRoot }));

const { normalizeInstagramUrl, withInstagramMedia } = await import('../../lib/instagramDownload.js');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(4)]);

function writeItem(directory, name, bytes, metadata) {
    fs.writeFileSync(path.join(directory, name), bytes);
    fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(metadata));
}

// Simulates one CLI run: `behaviour(binary, args, directory)` writes files and
// returns { error, stdout }.
function scriptRuns(...behaviours) {
    let call = 0;
    execFile.mockImplementation((binary, args, _options, callback) => {
        const behaviour = behaviours[call++];
        const dirIndex = args.indexOf('--directory');
        const outIndex = args.indexOf('-o');
        const directory = dirIndex !== -1
            ? args[dirIndex + 1]
            : outIndex !== -1 ? path.dirname(args[outIndex + 1]) : undefined;
        setTimeout(() => {
            const { error = null, stdout = '' } = behaviour(binary, args, directory) || {};
            callback(error, stdout, '');
        });
        return { kill: vi.fn() };
    });
}

const leftovers = () => fs.readdirSync(tempRoot).filter((name) => name.startsWith('instagram_'));

describe('normalizeInstagramUrl', () => {
    it.each([
        ['https://www.instagram.com/p/ABC123/?igsh=xyz', 'https://www.instagram.com/p/ABC123/'],
        ['https://instagram.com/reel/ABC_-1', 'https://www.instagram.com/reel/ABC_-1/'],
        ['https://www.instagram.com/reels/ABC123/', 'https://www.instagram.com/reel/ABC123/'],
        ['https://www.instagram.com/some.user/p/ABC123/', 'https://www.instagram.com/p/ABC123/']
    ])('accepts %s', (input, expected) => {
        expect(normalizeInstagramUrl(input)).toBe(expected);
    });

    it.each([
        'https://instagram.com.evil.example/p/ABC123/',
        'https://evil.example/instagram.com/p/ABC123/',
        'https://user:pass@instagram.com/p/ABC123/',
        'https://www.instagram.com/someuser/',
        '.ig https://www.instagram.com/p/ABC123/',
        undefined
    ])('rejects %s', (input) => {
        expect(() => normalizeInstagramUrl(input)).toThrow();
    });
});

describe('withInstagramMedia', () => {
    beforeEach(() => {
        execFile.mockReset();
    });

    afterAll(() => {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    it('returns a mixed carousel in post order and cleans up afterwards', async () => {
        scriptRuns((_binary, _args, directory) => {
            writeItem(directory, '222.mp4', MP4, { num: 2, count: 2, video_url: 'https://cdn.example/v.mp4' });
            writeItem(directory, '111.jpg', JPEG, { num: 1, count: 2 });
        });
        let seenPaths;
        const result = await withInstagramMedia('https://www.instagram.com/p/ABC123/', {}, async (media) => {
            seenPaths = media.map((item) => item.path);
            expect(seenPaths.every((p) => fs.existsSync(p))).toBe(true);
            return media.map(({ type, mimetype, index }) => ({ type, mimetype, index }));
        });

        expect(result).toEqual([
            { type: 'image', mimetype: 'image/jpeg', index: 1 },
            { type: 'video', mimetype: 'video/mp4', index: 2 }
        ]);
        expect(seenPaths.some((p) => fs.existsSync(p))).toBe(false);
        expect(leftovers()).toEqual([]);
        expect(execFile).toHaveBeenCalledOnce();
    });

    it('fails instead of falling back to video-only when a carousel download breaks midway', async () => {
        scriptRuns((_binary, _args, directory) => {
            writeItem(directory, '111.jpg', JPEG, { num: 1, count: 3 });
            return { error: Object.assign(new Error('failed'), { code: 4 }) };
        });
        const consume = vi.fn();

        await expect(withInstagramMedia('https://www.instagram.com/p/ABC123/', {}, consume)).rejects.toThrow();

        expect(consume).not.toHaveBeenCalled();
        expect(execFile).toHaveBeenCalledOnce();
        expect(leftovers()).toEqual([]);
    });

    it('rejects a video thumbnail reported as the only photo', async () => {
        scriptRuns((_binary, _args, directory) => {
            writeItem(directory, '111.jpg', JPEG, { num: 1, count: 1, video_url: 'https://cdn.example/v.mp4' });
        });

        await expect(withInstagramMedia('https://www.instagram.com/reel/ABC123/', {}, vi.fn()))
            .rejects.toThrow(/preview/);
        expect(leftovers()).toEqual([]);
    });

    it('does not accept a carousel playlist through the single-video fallback', async () => {
        scriptRuns(
            () => ({ error: Object.assign(new Error('login redirect'), { code: 4 }) }),
            () => ({ stdout: JSON.stringify({ _type: 'playlist', entries: [{ _type: 'video' }] }) })
        );
        const consume = vi.fn();

        await expect(withInstagramMedia('https://www.instagram.com/p/ABC123/', {}, consume))
            .rejects.toThrow(/single video/);
        expect(consume).not.toHaveBeenCalled();
        expect(execFile).toHaveBeenCalledTimes(2);
        expect(leftovers()).toEqual([]);
    });

    it('downloads a single video through the fallback when extraction is blocked', async () => {
        scriptRuns(
            () => ({ error: Object.assign(new Error('login redirect'), { code: 4 }) }),
            () => ({ stdout: JSON.stringify({ _type: 'video', duration: null, formats: [{ ext: 'mp4', vcodec: 'avc1', height: 640 }] }) }),
            (_binary, args, directory) => {
                expect(args).toContain('--load-info-json');
                fs.writeFileSync(path.join(directory, '1.mp4'), MP4);
            }
        );

        const result = await withInstagramMedia('https://www.instagram.com/reel/ABC123/', {}, async (media) =>
            media.map(({ type, index }) => ({ type, index })));

        expect(result).toEqual([{ type: 'video', index: 1 }]);
        expect(leftovers()).toEqual([]);
    });
});
