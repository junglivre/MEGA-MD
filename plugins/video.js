import yts from 'yt-search';
import fs from 'fs';
import { downloadVideo, getVideoMetadata, VIDEO_QUALITY_TIERS } from '../lib/ytdlp.js';
import { formatYtDlpError } from '../lib/ytdlpCore.js';

const QUALITY_RE = new RegExp(`^(${VIDEO_QUALITY_TIERS.join('|')})p?$`, 'i');

export default {
    command: 'video',
    aliases: ['ytmp4', 'ytvideo', 'ytdl'],
    category: 'download',
    description: 'Download YouTube videos by link or search',
    usage: '.video <youtube link | search query> [quality: 1080|720|480|360|240|144]',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const argsList = [...args];
        let maxHeight;
        if (argsList.length > 1 && QUALITY_RE.test(argsList[argsList.length - 1]))
            maxHeight = Number(argsList.pop().replace(/p$/i, ''));
        const query = argsList.join(' ').trim();
        if (!query)
            return sock.sendMessage(chatId, { text: `🎥 ${t('p.video.askQuery')}` }, { quoted: message });
        let result;
        try {
            let videoUrl;
            if (query.startsWith('http://') || query.startsWith('https://')) {
                videoUrl = query;
            }
            else {
                const { videos } = await yts(query);
                if (!videos?.length)
                    return sock.sendMessage(chatId, { text: `❌ ${t('p.video.noResults')}` }, { quoted: message });
                videoUrl = videos[0].url;
            }
            const validYT = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
            if (!validYT)
                return sock.sendMessage(chatId, { text: `❌ ${t('p.video.invalidLink')}` }, { quoted: message });
            const ytId = validYT[1];
            let meta = {};
            try {
                meta = await getVideoMetadata(videoUrl, { sock });
            }
            catch { /* metadata lookup failed (private/restricted); fall back to the query/link below */ }
            const title = meta.title || query;
            const thumb = meta.thumbnail || `https://i.ytimg.com/vi/${ytId}/sddefault.jpg`;
            const infoLines = [`🎬 *${title}*`];
            if (meta.uploader)
                infoLines.push(`📺 ${meta.uploader}`);
            if (meta.uploadDate)
                infoLines.push(`📅 ${meta.uploadDate}`);
            infoLines.push('', videoUrl, `⬇️ ${t('p.video.downloading')}`);
            const statusMsg = await sock.sendMessage(chatId, {
                image: { url: thumb },
                caption: infoLines.join('\n')
            }, { quoted: message });
            result = await downloadVideo(videoUrl, { sock, ...(maxHeight ? { maxHeight } : {}) });
            const videoBuffer = await fs.promises.readFile(result.filePath);
            const finalTitle = result.title || title;
            const finalCaptionLines = [`🎬 *${finalTitle}*`];
            if (meta.uploader)
                finalCaptionLines.push(`📺 ${meta.uploader}`);
            if (meta.uploadDate)
                finalCaptionLines.push(`📅 ${meta.uploadDate}`);
            finalCaptionLines.push('', videoUrl, '', `> *_${t('p.video.footer')}_*`);
            await sock.sendMessage(chatId, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                fileName: `${finalTitle}.mp4`,
                caption: finalCaptionLines.join('\n')
            }, { quoted: message });
            await sock.sendMessage(chatId, { delete: statusMsg.key });
        }
        catch (err) {
            console.error('[VIDEO] Error:', err.message);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.video.failed', { reason: formatYtDlpError(err, t) })}` }, { quoted: message });
        }
        finally {
            if (result)
                await result.cleanup();
        }
    }
};
