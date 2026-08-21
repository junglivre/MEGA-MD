import axios from 'axios';
import yts from 'yt-search';
const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'xbps-install-Syu';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const downloadWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: 'mp3', url },
                timeout: 120000
            });
            if (data?.data?.downloadUrl)
                return data.data;
            throw new Error('No download URL');
        }
        catch (err) {
            if (i === retries - 1)
                throw err;
            console.log(`Download attempt ${i + 1} failed, retrying in 5s...`);
            await wait(5000);
        }
    }
    throw new Error('All download attempts failed');
};
export default {
    command: 'song',
    aliases: ['music', 'audio', 'mp3'],
    category: 'music',
    description: 'Download song from YouTube (MP3)',
    usage: '.song <song name | youtube link>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const query = args.join(' ').trim();
        if (!query)
            return sock.sendMessage(chatId, { text: `🎵 *${t('p.song.title')}*\n\n${t('p.song.usageLabel')}:\n.song <song name | YouTube link>` }, { quoted: message });
        try {
            let video;
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                video = { url: query };
            }
            else {
                const { videos } = await yts(query);
                if (!videos?.length)
                    return sock.sendMessage(chatId, { text: `❌ ${t('p.song.noResults')}` }, { quoted: message });
                video = videos[0];
            }
            if (video.thumbnail) {
                await sock.sendMessage(chatId, {
                    image: { url: video.thumbnail },
                    caption: `🎶 *${video.title || query}*\n⏱ ${video.timestamp || ''}\n\n⏳ ${t('p.song.downloading')}`
                }, { quoted: message });
            }
            const audio = await downloadWithRetry(video.url);
            await sock.sendMessage(chatId, {
                audio: { url: audio.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${audio.title || video.title || 'song'}.mp3`,
                ptt: false
            }, { quoted: message });
        }
        catch (err) {
            console.error('Song plugin error:', err.message);
            const reason = err.response?.status === 408
                ? t('p.song.timeoutReason')
                : err.message;
            await sock.sendMessage(chatId, { text: `❌ ${t('p.song.failed')}: ${reason}` }, { quoted: message });
        }
    }
};
