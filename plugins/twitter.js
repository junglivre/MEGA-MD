import fs from 'fs';
import { downloadTwitterMedia } from '../lib/twitterDownload.js';
import { formatYtDlpError } from '../lib/ytdlpCore.js';

export default {
    command: 'twitter',
    aliases: ['xtweet', 'tweetdl', 'twitterdl'],
    category: 'download',
    description: 'Download video from an X/Twitter post',
    usage: '.twitter <Tweet URL>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const url = args?.[0];
        if (!url || !/(twitter|x)\.com\//i.test(url)) {
            return sock.sendMessage(chatId, { text: `${t('p.twitter.noUrl')}\n${t('p.twitter.example')}` }, { quoted: message });
        }
        let result;
        try {
            result = await downloadTwitterMedia(url, { sock });
            const videoBuffer = await fs.promises.readFile(result.filePath);
            await sock.sendMessage(chatId, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: result.title ? `🐦 ${result.title}` : undefined
            }, { quoted: message });
        }
        catch (error) {
            console.error('Twitter plugin error:', error.message);
            const text = /no video could be found/i.test(error.message)
                ? `❌ ${t('p.twitter.noMedia')}`
                : `❌ ${t('p.twitter.fetchFailed', { reason: formatYtDlpError(error, t) })}`;
            await sock.sendMessage(chatId, { text }, { quoted: message });
        }
        finally {
            if (result)
                await result.cleanup();
        }
    }
};
