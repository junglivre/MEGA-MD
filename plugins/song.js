import yts from 'yt-search';
import fs from 'fs';
import { downloadAudio, getVideoMetadata } from '../lib/ytdlp.js';
import { formatYtDlpError } from '../lib/ytdlpCore.js';

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
            let videoUrl;
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                videoUrl = query;
            }
            else {
                const { videos } = await yts(query);
                if (!videos?.length)
                    return sock.sendMessage(chatId, { text: `❌ ${t('p.song.noResults')}` }, { quoted: message });
                videoUrl = videos[0].url;
            }
            let meta = {};
            try {
                meta = await getVideoMetadata(videoUrl, { sock });
            }
            catch { /* metadata lookup failed (private/restricted); fall back to the query below */ }
            const title = meta.title || query;
            const infoLines = [`🎶 *${title}*`];
            if (meta.uploader)
                infoLines.push(`📺 ${meta.uploader}`);
            if (meta.uploadDate)
                infoLines.push(`📅 ${meta.uploadDate}`);
            infoLines.push('', videoUrl, `⏳ ${t('p.song.downloading')}`);
            let statusMsg;
            if (meta.thumbnail) {
                statusMsg = await sock.sendMessage(chatId, {
                    image: { url: meta.thumbnail },
                    caption: infoLines.join('\n')
                }, { quoted: message });
            }
            result = await downloadAudio(videoUrl, { sock });
            const audioBuffer = await fs.promises.readFile(result.filePath);
            await sock.sendMessage(chatId, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${result.title || title || 'song'}.mp3`,
                ptt: false
            }, { quoted: message });
            if (statusMsg)
                await sock.sendMessage(chatId, { delete: statusMsg.key });
        }
        catch (err) {
            console.error('Song plugin error:', err.message);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.song.failed', { reason: formatYtDlpError(err, t) })}` }, { quoted: message });
        }
        finally {
            if (result)
                await result.cleanup();
        }
    }
};
