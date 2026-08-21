import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { uploadToUguu } from '../lib/uploaders.js';
export default {
    command: 'uguu',
    aliases: ['ug', 'uguuse'],
    category: 'upload',
    description: 'Upload to Uguu.se (temporary)',
    usage: '.uguu (reply to media or caption on media)',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const hasMedia = message.message?.imageMessage ||
                message.message?.videoMessage ||
                message.message?.stickerMessage ||
                message.message?.documentMessage;
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!hasMedia && !quotedMsg) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.uguu.noMedia')}` }, { quoted: message });
                return;
            }
            const mediaSource = hasMedia ? message.message : quotedMsg;
            const type = Object.keys(mediaSource).find(key => ['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage'].includes(key));
            if (!type) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.uguu.unsupportedType')}` }, { quoted: message });
                return;
            }
            await sock.sendMessage(chatId, { text: t('p.uguu.uploading') }, { quoted: message });
            const mediaType = type === 'stickerMessage' ? 'sticker' : type.replace('Message', '');
            const stream = await downloadContentFromMessage(mediaSource[type], mediaType);
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
            else if (mediaSource[type].fileName) {
                ext = mediaSource[type].fileName.split('.').pop() || 'bin';
            }
            const tempDir = path.join('./temp');
            if (!fs.existsSync(tempDir))
                fs.mkdirSync(tempDir, { recursive: true });
            const tempPath = path.join(tempDir, `uguu_${Date.now()}.${ext}`);
            fs.writeFileSync(tempPath, buffer);
            const result = await uploadToUguu(tempPath);
            await sock.sendMessage(chatId, {
                text: `✅ *${t('p.uguu.uploadSuccess')}*\n\n🔗 ${result.url}\n⚠️ ${t('p.uguu.temporaryLink')}`
            }, { quoted: message });
            fs.unlinkSync(tempPath);
        }
        catch (error) {
            console.error('Uguu Error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.uguu.error', { message: error.message })}` }, { quoted: message });
        }
    }
};
