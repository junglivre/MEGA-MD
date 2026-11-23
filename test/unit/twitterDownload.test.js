import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'twitter-test-'));
vi.mock('../../lib/paths.js', () => ({ TEMP_DIR: tempRoot }));

const { parseTweetId, withTweetMedia } = await import('../../lib/twitterDownload.js');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(4)]);

function response(body, url = '') {
    const res = new Response(body);
    Object.defineProperty(res, 'url', { value: url });
    return res;
}

function mockFx(apiBody) {
    const downloads = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (url.startsWith('https://api.fxtwitter.com/2/status/'))
            return response(JSON.stringify(apiBody));
        downloads.push(url);
        return response(url.includes('pbs.twimg.com') ? JPEG : MP4, url);
    }));
    return downloads;
}

const videoFormats = [
    { container: 'm3u8', url: 'https://video.twimg.com/v/pl.m3u8' },
    { container: 'mp4', bitrate: 256000, url: 'https://video.twimg.com/v/270.mp4' },
    { container: 'mp4', bitrate: 2176000, url: 'https://video.twimg.com/v/720.mp4' },
    { container: 'mp4', bitrate: 832000, url: 'https://video.twimg.com/v/360.mp4' }
];

afterEach(() => vi.unstubAllGlobals());
afterAll(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

describe('parseTweetId', () => {
    it.each([
        'https://x.com/user/status/1848831595014459513',
        'https://twitter.com/user/status/1848831595014459513?s=20',
        'https://mobile.twitter.com/user/status/1848831595014459513',
        'https://fixupx.com/user/status/1848831595014459513/photo/2',
        'https://x.com/i/web/status/1848831595014459513'
    ])('reads the post id from %s', (input) => {
        expect(parseTweetId(input)).toBe('1848831595014459513');
    });

    it.each([
        'https://x.com/user',
        'https://evil.example/user/status/1848831595014459513',
        'https://x.com.evil.example/user/status/1848831595014459513'
    ])('rejects %s', (input) => {
        expect(() => parseTweetId(input)).toThrow();
    });
});

describe('withTweetMedia', () => {
    it('downloads photos, the best fitting MP4 and GIFs in post order', async () => {
        const downloads = mockFx({
            code: 200,
            status: {
                text: 'hello', author: { screen_name: 'someone' },
                media: { all: [
                    { type: 'photo', url: 'https://pbs.twimg.com/media/a.jpg?name=orig' },
                    { type: 'video', url: 'https://video.twimg.com/v/720.mp4', duration: 30, formats: videoFormats },
                    { type: 'gif', url: 'https://video.twimg.com/tweet_video/g.mp4' }
                ] }
            }
        });

        const result = await withTweetMedia('https://x.com/someone/status/1', async (media, meta) => ({
            types: media.map((m) => m.type),
            meta
        }));

        expect(result).toEqual({ types: ['image', 'video', 'gif'], meta: { author: 'someone', text: 'hello' } });
        expect(downloads[1]).toBe('https://video.twimg.com/v/720.mp4');
        expect(fs.readdirSync(tempRoot)).toEqual([]);
    });

    it('steps down to a smaller MP4 when the best one would be too large', async () => {
        const downloads = mockFx({
            code: 200,
            status: { media: { all: [{ type: 'video', url: 'x', duration: 3600, formats: videoFormats }] } }
        });
        await withTweetMedia('https://x.com/someone/status/1', async () => {});
        // 2.176 Mbps for an hour is ~980 MB; 256 kbps is ~115 MB, still over, so the smallest wins.
        expect(downloads).toEqual(['https://video.twimg.com/v/270.mp4']);
    });

    it.each([
        [{ code: 404, message: 'NOT_FOUND' }, 'notFound'],
        [{ code: 401, message: 'PRIVATE_TWEET' }, 'private'],
        [{ code: 200, status: { media: { all: [] } } }, 'noMedia']
    ])('maps %j to %s', async (body, code) => {
        mockFx(body);
        await expect(withTweetMedia('https://x.com/someone/status/1', vi.fn())).rejects.toMatchObject({ code });
    });
});
