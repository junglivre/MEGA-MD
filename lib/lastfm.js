import axios from 'axios';
import sharp from 'sharp';
import config from '../config.js';

const API_URL = 'https://ws.audioscrobbler.com/2.0/';
const FALLBACK_COVER = 'https://telegra.ph/file/bdcf492162713ea5633a1.jpg';

export class LastFmError extends Error {
    constructor(code, message = code) {
        super(message);
        this.name = 'LastFmError';
        this.code = code;
    }
}

function requireApiKey() {
    if (!config.lastFmApiKey)
        throw new LastFmError('MISSING_API_KEY');
}

async function request(method, params) {
    requireApiKey();
    try {
        const { data } = await axios.get(config.lastFmApiUrl || API_URL, {
            params: { method, api_key: config.lastFmApiKey, format: 'json', ...params },
            timeout: 15000
        });
        if (data?.error) {
            if (data.error === 6)
                throw new LastFmError('INVALID_USERNAME');
            throw new LastFmError('API_ERROR', data.message || 'Last.fm API error');
        }
        return data;
    }
    catch (error) {
        if (error instanceof LastFmError)
            throw error;
        throw new LastFmError('API_ERROR', error.message);
    }
}

function imageUrl(images = []) {
    return [...images].reverse().map(image => image?.['#text']).find(Boolean) || FALLBACK_COVER;
}

export async function validateLastFmUsername(username) {
    const data = await request('user.getinfo', { user: username });
    return data?.user?.name || username;
}

export async function getLastFmTrack(username) {
    const recent = await request('user.getrecenttracks', { user: username, limit: 1, extended: 1 });
    const track = recent?.recenttracks?.track?.[0];
    if (!track)
        throw new LastFmError('NO_SCROBBLES');

    let playCount = 0;
    try {
        const details = await request('track.getInfo', {
            user: username,
            artist: track.artist?.name || track.artist?.['#text'] || '',
            track: track.name
        });
        playCount = Number(details?.track?.userplaycount || 0);
    }
    catch (error) {
        if (error.code !== 'API_ERROR')
            throw error;
    }

    return {
        username,
        artist: track.artist?.name || track.artist?.['#text'] || 'Unknown artist',
        name: track.name || 'Unknown track',
        album: track.album?.['#text'] || '',
        loved: track.loved === '1' || track.userloved === '1',
        nowPlaying: track['@attr']?.nowplaying === 'true',
        playCount,
        image: imageUrl(track.image),
        url: track.url || ''
    };
}

function escapeXml(value) {
    return String(value ?? '').replace(/[<>&'"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]));
}

function truncate(value, length) {
    const text = String(value || '');
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

async function downloadCover(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        return Buffer.from(response.data);
    }
    catch {
        return null;
    }
}

export async function renderLastFmCard(track, labels = {}) {
    const cover = await downloadCover(track.image);
    const base = cover
        ? await sharp(cover).resize(600, 250, { fit: 'cover' }).blur(18).modulate({ brightness: 0.55, saturation: 0.8 }).jpeg().toBuffer()
        : await sharp({ create: { width: 600, height: 250, channels: 3, background: '#151515' } }).jpeg().toBuffer();
    const coverLayer = cover
        ? await sharp(cover).resize(200, 200, { fit: 'cover' }).jpeg().toBuffer()
        : null;
    const artist = truncate(track.artist, 34);
    const name = truncate(track.name, 34);
    const username = truncate(`@${track.username}`, 28);
    const status = track.nowPlaying ? (labels.nowPlaying || 'Now playing') : (labels.lastPlayed || 'Last played');
    const loved = track.loved ? `<text x="430" y="216" class="small">♥ ${escapeXml(labels.loved || 'Loved')}</text>` : '';
    const svg = `<svg width="600" height="250" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="250" fill="#000" fill-opacity=".42"/>
      <rect x="16" y="16" width="218" height="218" rx="8" fill="#000" fill-opacity=".35"/>
      <style>.title{font:700 22px Arial,sans-serif;fill:#fff}.artist{font:18px Arial,sans-serif;fill:#eee}.small{font:14px Arial,sans-serif;fill:#eee}.muted{font:14px Arial,sans-serif;fill:#bbb}</style>
      <text x="260" y="48" class="muted">${escapeXml(status)}</text>
      <text x="260" y="83" class="title">${escapeXml(name)}</text>
      <text x="260" y="113" class="artist">${escapeXml(artist)}</text>
      <text x="260" y="174" class="small">${escapeXml(username)}</text>
      <text x="260" y="198" class="muted">${escapeXml(labels.plays || 'Plays')}: ${track.playCount}</text>
      ${loved}
    </svg>`;
    const composite = [{ input: Buffer.from(svg), left: 0, top: 0 }];
    if (coverLayer)
        composite.unshift({ input: coverLayer, left: 25, top: 25 });
    return sharp(base).composite(composite).jpeg({ quality: 94 }).toBuffer();
}
