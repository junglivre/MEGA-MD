import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { uploadToLitterbox } from '../lib/uploaders.js';
export default {
    command: 'litterbox',
    aliases: ['tempup', 'litter', 'litr'],
    category: 'upload',
    description: 'Upload temporarily (1h/12h/24h/72h)',
    usage: '.litterbox <1h/12h/24h/72h> (reply to media)',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.litterbox.noMedia')}` }, { quoted: message });
                return;
            }
            const type = Object.keys(quotedMsg)[0];
            const supportedTypes = ['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage'];
            if (!supportedTypes.includes(type)) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.litterbox.unsupportedType')}` }, { quoted: message });
                return;
            }
            const time = args[0] || '1h';
            const validTimes = ['1h', '12h', '24h', '72h'];
            const uploadTime = validTimes.includes(time) ? time : '1h';
            await sock.sendMessage(chatId, { text: t('p.litterbox.uploading', { time: uploadTime }) }, { quoted: message });
            const mediaType = type === 'stickerMessage' ? 'sticker' : type.replace('Message', '');
            const stream = await downloadContentFromMessage(quotedMsg[type], mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            let ext = 'bin';
            if (type === 'imageMessage')
                ext = 'jpg';
            else if (type === 'videoMessage')
                ext = 'mp4';
            else if (type === 'stickerMessage')
                ext = 'webp';
            else if (quotedMsg[type].fileName) {
                ext = quotedMsg[type].fileName.split('.').pop() || 'bin';
            }
            const tempDir = path.join('./temp');
            if (!fs.existsSync(tempDir))
                fs.mkdirSync(tempDir, { recursive: true });
            const tempPath = path.join(tempDir, `litterbox_${Date.now()}.${ext}`);
            fs.writeFileSync(tempPath, buffer);
            const result = await uploadToLitterbox(tempPath, uploadTime);
            await sock.sendMessage(chatId, {
                text: `✅ *${t('p.litterbox.success')}*\n\n` +
                    `⏰ *${t('p.litterbox.expires')}:* ${result.expires}\n` +
                    `🔗 *${t('p.litterbox.url')}:* ${result.url}\n\n` +
                    `_${t('p.litterbox.expireHint', { expires: result.expires })}_`
            }, { quoted: message });
            fs.unlinkSync(tempPath);
        }
        catch (error) {
            console.error('Litterbox Error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.litterbox.errorLabel', { error: error.message })}` }, { quoted: message });
        }
    }
};
