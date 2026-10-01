import yts from 'yt-search';
import fs from 'fs';
import axios from 'axios';
import { downloadAudio } from '../lib/ytdlp.js';

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
        let result;
        try {
            await sock.sendMessage(chatId, { text: `🔍 ${t('p.play.searching')}` }, { quoted: message });
            const { videos } = await yts(query);
            if (!videos?.length)
                return sock.sendMessage(chatId, { text: `❌ ${t('p.play.noResults')}` }, { quoted: message });
            const video = videos[0];
            await sock.sendMessage(chatId, {
                text: `✅ ${t('p.play.found', { title: video.title, timestamp: video.timestamp, author: video.author.name })}`
            }, { quoted: message });
            result = await downloadAudio(video.url, { sock });
            let thumbnailBuffer;
            try {
                const img = await axios.get(video.thumbnail, { responseType: 'arraybuffer', timeout: 15000 });
                thumbnailBuffer = Buffer.from(img.data);
            }
            catch { /* no thumbnail */ }
            const audioBuffer = await fs.promises.readFile(result.filePath);
            await sock.sendMessage(chatId, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${result.title || video.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: result.title || video.title,
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
            await sock.sendMessage(chatId, { text: `❌ ${t('p.play.failed', { reason: err.message })}` }, { quoted: message });
        }
        finally {
            if (result)
                await result.cleanup();
        }
    }
};
