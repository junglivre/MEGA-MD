import fs from 'fs';
import { normalizeInstagramUrl, withInstagramMedia } from '../lib/instagramDownload.js';
const processedMessages = new Set();
export default {
    command: 'instagram',
    aliases: ['ig', 'igdl', 'insta'],
    category: 'download',
    description: 'Download Instagram posts, reels & videos',
    usage: '.ig <instagram link>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const text = args.join(' ') ||
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text;
        try {
            if (processedMessages.has(message.key.id))
                return;
            processedMessages.add(message.key.id);
            setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);
            if (!text) {
                return await sock.sendMessage(chatId, { text: `📸 *${t('p.instagram.title')}*\n\n${t('p.instagram.usage')}` }, { quoted: message });
            }
            const linkMatch = text.match(/https?:\/\/\S+/);
            let instagramUrl;
            try {
                instagramUrl = normalizeInstagramUrl(linkMatch?.[0]);
            }
            catch {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.instagram.invalidLink')}` }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                react: { text: '🔄', key: message.key }
            });
            await withInstagramMedia(instagramUrl, { maxItems: 20 }, async (mediaList) => {
                for (let i = 0; i < mediaList.length; i++) {
                    const media = mediaList[i];
                    const buffer = await fs.promises.readFile(media.path);
                    if (media.type === 'video') {
                        await sock.sendMessage(chatId, {
                            video: buffer,
                            mimetype: media.mimetype,
                            caption: `📥 *${t('p.instagram.downloadedBy')}*`
                        }, { quoted: message });
                    }
                    else {
                        await sock.sendMessage(chatId, {
                            image: buffer,
                            caption: `📥 *${t('p.instagram.downloadedBy')}*`
                        }, { quoted: message });
                    }
                    if (i < mediaList.length - 1) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            });
        }
        catch (err) {
            console.error('Instagram plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.instagram.failed')}` }, { quoted: message });
        }
    }
};
