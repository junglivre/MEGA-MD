import fs from 'fs';
import { downloadTikTok } from '../lib/tiktokDownload.js';
import { formatYtDlpError } from '../lib/ytdlpCore.js';

function val(field) {
    return field && field !== 'NA' ? field : undefined;
}

export default {
    command: 'tiktok',
    aliases: ['tt', 'ttdl', 'tiktokdl'],
    category: 'download',
    description: 'Download TikTok video without watermark',
    usage: '.tiktok <TikTok URL>',
    async handler(sock, message, args, context) {
        const { chatId, t } = context;
        const url = args.join(' ').trim();
        if (!url || !/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(url)) {
            return sock.sendMessage(chatId, {
                text: `🎵 *${t('p.tiktok.title')}*\n\n${t('p.tiktok.provideUrl')}`
            }, { quoted: message });
        }
        let result;
        try {
            await sock.sendMessage(chatId, { text: `⏳ ${t('p.tiktok.downloading')}` }, { quoted: message });
            result = await downloadTikTok(url, { sock });
            const f = result.fields || {};
            const caption = [
                `🎵 *${result.title || t('p.tiktok.title')}*`,
                val(f.uploader) ? `👤 ${f.uploader}` : '',
                [val(f.likes) && `❤️ ${f.likes}`, val(f.comments) && `💬 ${f.comments}`, val(f.shares) && `🔁 ${f.shares}`, val(f.views) && `👀 ${f.views}`].filter(Boolean).join(' | '),
                val(f.track) ? `🎧 ${f.track}` : ''
            ].filter(Boolean).join('\n');
            const videoBuffer = await fs.promises.readFile(result.filePath);
            await sock.sendMessage(chatId, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption
            }, { quoted: message });
        }
        catch (error) {
            console.error('TikTok plugin error:', error.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.tiktok.downloadFailed', { reason: formatYtDlpError(error, t) })}`
            }, { quoted: message });
        }
        finally {
            if (result)
                await result.cleanup();
        }
    }
};
