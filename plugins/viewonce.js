import { downloadContentFromMessage } from '@whiskeysockets/baileys';
export default {
    command: 'viewonce',
    aliases: ['viewmedia', 'vv'],
    category: 'general',
    description: 'Re-send a view-once image or video.',
    usage: '.viewonce (reply to a view-once media)',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedImage = quoted?.imageMessage;
            const quotedVideo = quoted?.videoMessage;
            if (quotedImage && quotedImage.viewOnce) {
                const stream = await downloadContentFromMessage(quotedImage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream)
                    buffer = Buffer.concat([buffer, chunk]);
                await sock.sendMessage(chatId, {
                    image: buffer,
                    fileName: 'media.jpg',
                    caption: quotedImage.caption || ''
                }, { quoted: message });
            }
            else if (quotedVideo && quotedVideo.viewOnce) {
                const stream = await downloadContentFromMessage(quotedVideo, 'video');
                let buffer = Buffer.from([]);
                for await (const chunk of stream)
                    buffer = Buffer.concat([buffer, chunk]);
                await sock.sendMessage(chatId, {
                    video: buffer,
                    fileName: 'media.mp4',
                    caption: quotedVideo.caption || ''
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: `*${t('p.viewonce.noMedia')}*`
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Error in viewonceCommand:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.viewonce.failed')}`
            }, { quoted: message });
        }
    }
};
