import yts from 'yt-search';
import axios from 'axios';
const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = 'qasim-dev';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const downloadWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: 'mp3', url },
                timeout: 90000
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
    command: 'play',
    aliases: ['plays', 'music'],
    category: 'music',
    description: 'Search and download a song as MP3 from YouTube',
    usage: '.play <song name>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const t = context.t;
        const query = args.join(' ').trim();
        if (!query)
            return sock.sendMessage(chatId, { text: t('p.play.noQuery') }, { quoted: message });
        try {
            await sock.sendMessage(chatId, { text: `🔍 ${t('p.play.searching')}` }, { quoted: message });
            const { videos } = await yts(query);
            if (!videos?.length)
                return sock.sendMessage(chatId, { text: `❌ ${t('p.play.noResults')}` }, { quoted: message });
            const video = videos[0];
            await sock.sendMessage(chatId, {
                text: `✅ ${t('p.play.found', { title: video.title, timestamp: video.timestamp, author: video.author.name })}`
            }, { quoted: message });
            const songData = await downloadWithRetry(video.url);
            let thumbnailBuffer;
            try {
                const img = await axios.get(songData.thumbnail, { responseType: 'arraybuffer', timeout: 15000 });
                thumbnailBuffer = Buffer.from(img.data);
            }
            catch { /* no thumbnail */ }
            await sock.sendMessage(chatId, {
                audio: { url: songData.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${songData.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: songData.title,
                        body: `${video.author.name} • ${video.timestamp}`,
                        thumbnail: thumbnailBuffer,
                        mediaType: 2,
                        sourceUrl: video.url
                    }
                }
            }, { quoted: message });
        }
        catch (err) {
            console.error('Play error:', err.message);
            const reason = err.response?.status === 408
                ? t('p.play.reasonTimeout')
                : err.response?.status === 429
                    ? t('p.play.reasonRateLimited')
                    : err.message;
            await sock.sendMessage(chatId, { text: `❌ ${t('p.play.failed', { reason })}` }, { quoted: message });
        }
    }
};
