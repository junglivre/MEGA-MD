import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instagram-test-'));
vi.mock('../../lib/paths.js', () => ({ TEMP_DIR: tempRoot }));

const { normalizeInstagramUrl, withInstagramMedia } = await import('../../lib/instagramDownload.js');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(4)]);

function response(body, { status = 200, url = '' } = {}) {
    const res = new Response(body, { status });
    Object.defineProperty(res, 'url', { value: url });
    return res;
}

// post: array of 'image'|'video'; media: item index -> { bytes, finalUrl }
function mockOg(post, media = {}) {
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        calls.push(url);
        const meta = url.match(/^https:\/\/oginstagram\.com\/(p|reel)\/(\w+)\/(\d+)$/);
        if (meta) {
            if (!post.length)
                return response('{"type":"about:blank","detail":"not found"}', { status: 404 });
            const index = Math.min(Number(meta[3]), post.length);
            return response(JSON.stringify({
                type: 'Note',
                id: `https://oginstagram.com/${meta[1]}/${meta[2]}/${index}`,
                attachment: [{
                    type: 'Document',
                    mediaType: post[index - 1] === 'video' ? 'video/mp4' : 'image/jpeg',
                    url: `https://oginstagram.com/offload/${meta[2]}/${index}?sig=x`
                }]
            }));
        }
        const index = Number(url.match(/\/offload\/\w+\/(\d+)/)[1]);
        const item = media[index] || {};
        const bytes = item.bytes || (post[index - 1] === 'video' ? MP4 : JPEG);
        return response(bytes, { url: item.finalUrl || `https://scontent.cdninstagram.com/${index}` });
    }));
    return calls;
}

const leftovers = () => fs.readdirSync(tempRoot).filter((name) => name.startsWith('instagram_'));

afterEach(() => vi.unstubAllGlobals());
afterAll(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

describe('normalizeInstagramUrl', () => {
    it.each([
        ['https://www.instagram.com/p/ABC123/?igsh=xyz', 'https://www.instagram.com/p/ABC123/'],
        ['https://instagram.com/reel/ABC_-1', 'https://www.instagram.com/reel/ABC_-1/'],
        ['https://www.instagram.com/reels/ABC123/', 'https://www.instagram.com/reel/ABC123/'],
        ['https://www.instagram.com/tv/ABC123/', 'https://www.instagram.com/p/ABC123/'],
        ['https://www.instagram.com/some.user/p/ABC123/', 'https://www.instagram.com/p/ABC123/']
    ])('accepts %s', (input, expected) => {
        expect(normalizeInstagramUrl(input)).toBe(expected);
    });

    it.each([
        'https://instagram.com.evil.example/p/ABC123/',
        'https://user:pass@instagram.com/p/ABC123/',
        'https://www.instagram.com/someuser/',
        '.ig https://www.instagram.com/p/ABC123/',
        undefined
    ])('rejects %s', (input) => {
        expect(() => normalizeInstagramUrl(input)).toThrow();
    });
});

describe('withInstagramMedia', () => {
    it('returns a mixed carousel in post order and deletes the files afterwards', async () => {
        const calls = mockOg(['image', 'video', 'video']);
        let paths;
        const result = await withInstagramMedia('https://www.instagram.com/p/ABC123/', {}, async (media) => {
            paths = media.map((m) => m.path);
            expect(paths.every((p) => fs.existsSync(p))).toBe(true);
            return media.map(({ type, mimetype, index }) => ({ type, mimetype, index }));
        });

        expect(result).toEqual([
            { type: 'image', mimetype: 'image/jpeg', index: 1 },
            { type: 'video', mimetype: 'video/mp4', index: 2 },
            { type: 'video', mimetype: 'video/mp4', index: 3 }
        ]);
        // The clamped /50 lookup already returned the last item; it is not fetched twice.
        expect(calls.filter((u) => u.endsWith('/p/ABC123/3'))).toEqual([]);
        expect(paths.some((p) => fs.existsSync(p))).toBe(false);
        expect(leftovers()).toEqual([]);
    });

    it('downloads only the first items when the post exceeds the limit', async () => {
        mockOg(['image', 'image', 'image', 'video']);
        const result = await withInstagramMedia('https://www.instagram.com/p/ABC123/', { maxItems: 2 }, async (media) =>
            media.map((m) => m.index));
        expect(result).toEqual([1, 2]);
    });

    it('rejects a video item whose bytes are a thumbnail image', async () => {
        mockOg(['video'], { 1: { bytes: JPEG } });
        const consume = vi.fn();
        await expect(withInstagramMedia('https://www.instagram.com/reel/ABC123/', {}, consume)).rejects.toThrow(/not a valid video/);
        expect(consume).not.toHaveBeenCalled();
        expect(leftovers()).toEqual([]);
    });

    it('refuses media served from a host outside the Instagram CDN', async () => {
        mockOg(['image'], { 1: { finalUrl: 'https://evil.example/x.jpg' } });
        await expect(withInstagramMedia('https://www.instagram.com/p/ABC123/', {}, vi.fn())).rejects.toThrow(/untrusted host/);
        expect(leftovers()).toEqual([]);
    });

    it('reports a missing post as notFound', async () => {
        mockOg([]);
        await expect(withInstagramMedia('https://www.instagram.com/p/ABC123/', {}, vi.fn()))
            .rejects.toMatchObject({ code: 'notFound' });
    });
});
