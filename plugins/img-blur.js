import { downloadMediaMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import { channelInfo } from '../lib/messageConfig.js';
export default {
    command: 'blur',
    aliases: ['blurimg', 'blurpic'],
    category: 'tools',
    description: 'Apply a blur effect to an image',
    usage: '.blur (reply to an image or send image with caption)',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        try {
            let imageBuffer;
            if (quotedMessage?.imageMessage) {
                const quoted = { message: { imageMessage: quotedMessage.imageMessage } };
                imageBuffer = await downloadMediaMessage(quoted, 'buffer', {});
            }
            else if (message.message?.imageMessage) {
                imageBuffer = await downloadMediaMessage(message, 'buffer', {}, {});
            }
            else {
                await sock.sendMessage(chatId, {
                    text: t('p.blur.noMedia')
                }, { quoted: message });
                return;
            }
            const resizedImage = await sharp(imageBuffer)
                .resize(800, 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
                .jpeg({ quality: 80 })
                .toBuffer();
            const blurredImage = await sharp(resizedImage)
                .blur(10)
                .toBuffer();
            await sock.sendMessage(chatId, {
                image: blurredImage,
                caption: `✨ *${t('p.blur.success')}*`,
                    ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error in blur command:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.blur.failed')}`
            }, { quoted: message });
        }
    }
};
