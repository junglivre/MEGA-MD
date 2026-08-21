import axios from 'axios';
const API = 'https://api.qasimdev.dpdns.org/api/spotify/download';
const API_KEY = 'qasim-dev';
const formatDuration = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
};
export default {
    command: 'spotify',
    aliases: ['sptfdl', 'spotifydl'],
    category: 'download',
    description: 'Download music from Spotify',
    usage: '.spotify <spotify-url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const url = args.join(' ').trim();
        if (!url || !url.includes('spotify.com')) {
            return sock.sendMessage(chatId, {
                text: `🎵 *${t('p.spotify.title')}*\n\n${t('p.spotify.usageLine')}\n${t('p.spotify.exampleLine')}`
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });
            const { data } = await axios.get(API, {
                params: { apiKey: API_KEY, url },
                timeout: 30000
            });
            if (!data?.success || !data?.data) {
                throw new Error('Invalid API response');
            }
            const track = data.data;
            if (!track.download) {
                return sock.sendMessage(chatId, {
                    text: `❌ ${t('p.spotify.noAudio')}`
                }, { quoted: message });
            }
            const caption = [
                `🎵 *${track.title || t('p.spotify.unknownTitle')}*`,
                track.artist ? `👤 ${track.artist}` : '',
                track.duration ? `⏱ ${formatDuration(track.duration)}` : '',
                track.format ? `🎧 ${t('p.spotify.formatLabel')}: ${track.format.toUpperCase()}` : ''
            ].filter(Boolean).join('\n');
            if (track.cover) {
                await sock.sendMessage(chatId, {
                    image: { url: track.cover },
                    caption
                }, { quoted: message });
            }
            else if (caption) {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                audio: { url: track.download },
                mimetype: 'audio/mpeg',
                fileName: `${(track.title || 'track').replace(/[\\/:*?"<>|]/g, '')}.mp3`
            }, { quoted: message });
        }
        catch (error) {
            console.error('[SPOTIFY] error:', error.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.spotify.downloadFailed')}`
            }, { quoted: message });
        }
    }
};
