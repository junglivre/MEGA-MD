import yts from 'yt-search';
import fs from 'fs';
import { downloadAudio } from '../lib/ytdlp.js';

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
        let result;
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
            result = await downloadAudio(video.url, { sock });
            const audioBuffer = await fs.promises.readFile(result.filePath);
            await sock.sendMessage(chatId, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${result.title || video.title || 'song'}.mp3`,
                ptt: false
            }, { quoted: message });
        }
        catch (err) {
            console.error('Song plugin error:', err.message);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.song.failed')}: ${err.message}` }, { quoted: message });
        }
        finally {
            if (result)
                await result.cleanup();
        }
    }
};
