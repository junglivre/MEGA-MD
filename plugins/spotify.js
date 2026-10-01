import axios from 'axios';
import yts from 'yt-search';
import fs from 'fs';
import { downloadAudio } from '../lib/ytdlp.js';

function extractTrackId(url) {
    const m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?track\/([a-zA-Z0-9]+)/) || url.match(/^spotify:track:([a-zA-Z0-9]+)$/);
    return m ? m[1] : null;
}

function findTrackEntity(node, depth = 0) {
    if (depth > 8 || !node || typeof node !== 'object')
        return null;
    if (node.type === 'track' && node.name)
        return node;
    for (const key of Object.keys(node)) {
        const found = findTrackEntity(node[key], depth + 1);
        if (found)
            return found;
    }
    return null;
}

const formatDuration = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Spotify's embed page ships the track's public metadata (name, artists,
// duration, cover art) as a Next.js __NEXT_DATA__ blob — no API key needed.
// There is no legitimate way to pull the actual Spotify audio stream (DRM),
// so the match is downloaded from YouTube via the shared yt-dlp pipeline,
// the same approach every other "Spotify downloader" bot uses.
async function fetchSpotifyTrack(trackId) {
    const { data: html } = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, { timeout: 15000 });
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (!match)
        throw new Error('Spotify metadata not found');
    const track = findTrackEntity(JSON.parse(match[1]));
    if (!track)
        throw new Error('Spotify track not found');
    const cover = [...(track.visualIdentity?.image || [])].sort((a, b) => (b.maxWidth || 0) - (a.maxWidth || 0))[0]?.url;
    return {
        title: track.name,
        artist: (track.artists || []).map((a) => a.name).join(', '),
        durationMs: track.duration,
        cover
    };
}

export default {
    command: 'spotify',
    aliases: ['sptfdl', 'spotifydl'],
    category: 'download',
    description: 'Download music from Spotify (matched on YouTube)',
    usage: '.spotify <spotify-url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const url = args.join(' ').trim();
        const trackId = extractTrackId(url);
        if (!trackId) {
            return sock.sendMessage(chatId, {
                text: `🎵 *${t('p.spotify.title')}*\n\n${t('p.spotify.usageLine')}\n${t('p.spotify.exampleLine')}`
            }, { quoted: message });
        }
        let result;
        try {
            await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });
            const track = await fetchSpotifyTrack(trackId);
            const query = `${track.artist} - ${track.title}`.trim();
            await sock.sendMessage(chatId, { text: t('p.spotify.searching', { query }) }, { quoted: message });
            const { videos } = await yts(query);
            if (!videos?.length)
                return sock.sendMessage(chatId, { text: `❌ ${t('p.spotify.notFound')}` }, { quoted: message });
            result = await downloadAudio(videos[0].url, { sock });
            const caption = [
                `🎵 *${track.title || t('p.spotify.unknownTitle')}*`,
                track.artist ? `👤 ${track.artist}` : '',
                track.durationMs ? `⏱ ${formatDuration(track.durationMs)}` : ''
            ].filter(Boolean).join('\n');
            if (track.cover) {
                await sock.sendMessage(chatId, { image: { url: track.cover }, caption }, { quoted: message });
            }
            else if (caption) {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
            const audioBuffer = await fs.promises.readFile(result.filePath);
            await sock.sendMessage(chatId, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${(track.title || 'track').replace(/[\\/:*?"<>|]/g, '')}.mp3`
            }, { quoted: message });
        }
        catch (error) {
            console.error('[SPOTIFY] error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.spotify.downloadFailed')}` }, { quoted: message });
        }
        finally {
            if (result)
                await result.cleanup();
        }
    }
};
