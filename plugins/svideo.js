import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
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
function toPosixPath(filePath) {
    return path.resolve(filePath).split(path.sep).join('/');
}
function framesToVideo(framePaths, delays, listPath, outputPath) {
    return new Promise(async (resolve, reject) => {
        try {
            let list = '';
            for (let i = 0; i < framePaths.length; i++) {
                list += `file '${toPosixPath(framePaths[i])}'\n`;
                list += `duration ${(Math.max(delays[i], 20) / 1000).toFixed(3)}\n`;
            }
            // ffmpeg's concat demuxer ignores the last entry's duration, so repeat it.
            list += `file '${toPosixPath(framePaths[framePaths.length - 1])}'\n`;
            await fsPromises.writeFile(listPath, list);
            spawn('ffmpeg', [
                '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', listPath,
                '-vf', 'fps=15,format=yuv420p',
                '-c:v', 'libx264',
                '-crf', '23',
                '-preset', 'veryfast',
                '-movflags', '+faststart',
                outputPath
            ])
                .on('error', reject)
                .on('close', (code) => {
                if (code !== 0)
                    return reject(new Error(`ffmpeg exited with code ${code}`));
                resolve();
            });
        }
        catch (error) {
            reject(error);
        }
    });
}
export default {
    command: 's2vid',
    aliases: ['svideo', 'stovid', 'tovid'],
    category: 'stickers',
    description: 'Convert an animated sticker to a video',
    usage: '.s2vid (reply to an animated sticker)',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const stamp = Date.now();
        const stickerFilePath = path.join(tempDir, `sticker_${stamp}.webp`);
        const listPath = path.join(tempDir, `svideo_${stamp}.txt`);
        const outputVideoPath = path.join(tempDir, `svideo_${stamp}.mp4`);
        const framePaths = [];
        try {
            const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMessage?.stickerMessage) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.s2vid.noSticker')}` }, { quoted: message });
                return;
            }
            const stream = await downloadContentFromMessage(quotedMessage.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream)
                buffer = Buffer.concat([buffer, chunk]);
            await fsPromises.writeFile(stickerFilePath, buffer);
            const metadata = await sharp(stickerFilePath, { animated: true }).metadata();
            const pages = metadata.pages || 1;
            if (pages <= 1) {
                await sock.sendMessage(chatId, { text: `⚠️ ${t('p.s2vid.notAnimated')}` }, { quoted: message });
                return;
            }
            const delays = (metadata.delay && metadata.delay.length === pages)
                ? metadata.delay
                : new Array(pages).fill(100);
            for (let i = 0; i < pages; i++) {
                const framePath = path.join(tempDir, `svideo_${stamp}_${String(i).padStart(4, '0')}.png`);
                await sharp(stickerFilePath, { page: i }).png().toFile(framePath);
                framePaths.push(framePath);
            }
            await framesToVideo(framePaths, delays, listPath, outputVideoPath);
            const videoBuffer = await fsPromises.readFile(outputVideoPath);
            await sock.sendMessage(chatId, { video: videoBuffer, caption: `✨ ${t('p.s2vid.caption')}` }, { quoted: message });
        }
        catch (error) {
            console.error('SVideo Command Error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.s2vid.failed')}` }, { quoted: message });
        }
        finally {
            scheduleFileDeletion(stickerFilePath);
            scheduleFileDeletion(listPath);
            scheduleFileDeletion(outputVideoPath);
            for (const framePath of framePaths)
                scheduleFileDeletion(framePath);
        }
    }
};
