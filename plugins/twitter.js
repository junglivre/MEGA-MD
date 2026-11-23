import fs from 'fs';
import { withTweetMedia } from '../lib/twitterDownload.js';

const CAPTION_LIMIT = 300;

function caption(meta) {
    const text = meta.text.length > CAPTION_LIMIT ? `${meta.text.slice(0, CAPTION_LIMIT)}…` : meta.text;
    return [meta.author && `🐦 @${meta.author}`, text].filter(Boolean).join('\n') || undefined;
}

export default {
    command: 'twitter',
    aliases: ['xtweet', 'tweetdl', 'twitterdl'],
    category: 'download',
    description: 'Download photos and videos from an X/Twitter post',
    usage: '.twitter <Tweet URL>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const url = args?.[0];
        if (!url || !/(twitter|x)\.com\//i.test(url)) {
            return sock.sendMessage(chatId, { text: `${t('p.twitter.noUrl')}\n${t('p.twitter.example')}` }, { quoted: message });
        }
        try {
            await withTweetMedia(url, async (mediaList, meta) => {
                for (let i = 0; i < mediaList.length; i++) {
                    const media = mediaList[i];
                    const buffer = await fs.promises.readFile(media.path);
                    const text = i === 0 ? caption(meta) : undefined;
                    if (media.type === 'image') {
                        await sock.sendMessage(chatId, { image: buffer, caption: text }, { quoted: message });
                    }
                    else {
                        await sock.sendMessage(chatId, {
                            video: buffer,
                            mimetype: 'video/mp4',
                            gifPlayback: media.type === 'gif',
                            caption: text
                        }, { quoted: message });
                    }
                    if (i < mediaList.length - 1)
                        await new Promise((r) => setTimeout(r, 1000));
                }
            });
        }
        catch (error) {
            console.error('Twitter plugin error:', error.message);
            const key = {
                invalidUrl: 'p.twitter.noUrl',
                notFound: 'p.twitter.notFound',
                private: 'p.twitter.private',
                noMedia: 'p.twitter.noMedia'
            }[error.code] || 'p.twitter.fetchFailed';
            await sock.sendMessage(chatId, { text: `❌ ${t(key)}` }, { quoted: message });
        }
    }
};
