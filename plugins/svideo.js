import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { toVideo } from '../lib/converter.js';
const tempDir = './temp';
if (!fs.existsSync(tempDir))
    fs.mkdirSync(tempDir);
const scheduleFileDeletion = (filePath) => {
    setTimeout(async () => {
        try {
            await fsPromises.unlink(filePath);
            console.log(`File deleted: ${filePath}`);
        }
        catch (error) {
            console.error(`Failed to delete file:`, error);
        }
    }, 10000); // 10 seconds
};
export default {
    command: 's2vid',
    aliases: ['svideo', 'stovid', 'tovid'],
    category: 'stickers',
    description: 'Convert an animated sticker to a video',
    usage: '.s2vid (reply to an animated sticker)',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMessage?.stickerMessage) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.s2vid.noSticker')}` }, { quoted: message });
                return;
            }
            if (!quotedMessage.stickerMessage.isAnimated) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.s2vid.notAnimated')}` }, { quoted: message });
                return;
            }
            const stickerFilePath = path.join(tempDir, `sticker_${Date.now()}.webp`);
            const stream = await downloadContentFromMessage(quotedMessage.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream)
                buffer = Buffer.concat([buffer, chunk]);
            await fsPromises.writeFile(stickerFilePath, buffer);
            const videoBuffer = await toVideo(buffer, 'webp');
            await sock.sendMessage(chatId, { video: videoBuffer, caption: `✨ ${t('p.s2vid.caption')}` }, { quoted: message });
            scheduleFileDeletion(stickerFilePath);
        }
        catch (error) {
            console.error('SVideo Command Error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.s2vid.failed')}` }, { quoted: message });
        }
    }
};
