import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { uploadToFreeimage } from '../lib/uploaders.js';
export default {
    command: 'freeimage',
    aliases: ['fimg', 'freeimg'],
    category: 'upload',
    description: 'Upload to Freeimage.host',
    usage: '.freeimage (reply to image)',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg?.imageMessage) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.freeimage.noImage')}` }, { quoted: message });
                return;
            }
            await sock.sendMessage(chatId, { text: t('p.freeimage.uploading') }, { quoted: message });
            const stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            const tempDir = path.join('./temp');
            if (!fs.existsSync(tempDir))
                fs.mkdirSync(tempDir, { recursive: true });
            const tempPath = path.join(tempDir, `freeimage_${Date.now()}.jpg`);
            fs.writeFileSync(tempPath, buffer);
            const result = await uploadToFreeimage(tempPath);
            await sock.sendMessage(chatId, {
                text: `✅ *${t('p.freeimage.success')}*\n\n` +
                    `🔗 *${t('p.freeimage.url')}:* ${result.url}\n` +
                    `🖼️ *${t('p.freeimage.display')}:* ${result.display_url}\n` +
                    `🗑️ *${t('p.freeimage.delete')}:* ${result.delete_url}`
            }, { quoted: message });
            fs.unlinkSync(tempPath);
        }
        catch (error) {
            console.error('Freeimage Error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.freeimage.errorLabel', { error: error.message })}` }, { quoted: message });
        }
    }
};
