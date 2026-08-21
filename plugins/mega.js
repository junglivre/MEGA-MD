import { File } from 'megajs';
import path from 'path';
const formatBytes = (bytes) => {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2)) } ${ sizes[i]}`;
};
const generateBar = (percentage) => {
    const totalBars = 10;
    const filledBars = Math.floor((percentage / 100) * totalBars);
    return '█'.repeat(filledBars) + '░'.repeat(totalBars - filledBars);
};
const MIME_TYPES = {
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.apk': 'application/vnd.android.package-archive',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.mkv': 'video/x-matroska'
};
export default {
    command: 'mega',
    aliases: ['megadl'],
    category: 'download',
    description: 'Download from MEGA with real-time progress',
    usage: '.mega <mega-url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const text = args.join(' ').trim();
        if (!text) {
            return sock.sendMessage(chatId, { text: `*${t('p.mega.usageLabel')}:* .mega https://mega.nz/file/xxxx#xxxx` }, { quoted: message });
        }
        try {
            const file = File.fromURL(text);
            await file.loadAttributes();
            if (file.size >= 500 * 1024 * 1024) {
                return sock.sendMessage(chatId, { text: `❌ *${t('p.mega.errorLabel')}:* ${t('p.mega.fileTooLarge')}` }, { quoted: message });
            }
            const { key } = await sock.sendMessage(chatId, {
                text: `🌩️ *${t('p.mega.downloadTitle')}*\n\n▢ *${t('p.mega.fileLabel')}:* ${file.name}\n▢ *${t('p.mega.sizeLabel')}:* ${formatBytes(file.size)}\n\n*${t('p.mega.progressLabel')}:* 0% [░░░░░░░░░░]`
            }, { quoted: message });
            const stream = file.download();
            const chunks = [];
            let lastUpdate = Date.now();
            stream.on('progress', async (info) => {
                const { bytesLoaded, bytesTotal } = info;
                const percentage = Math.floor((bytesLoaded / bytesTotal) * 100);
                if (Date.now() - lastUpdate > 3000 || percentage === 100) {
                    const bar = generateBar(percentage);
                    await sock.sendMessage(chatId, {
                        text: `🌩️ *${t('p.mega.downloadTitle')}*\n\n▢ *${t('p.mega.fileLabel')}:* ${file.name}\n▢ *${t('p.mega.sizeLabel')}:* ${formatBytes(bytesTotal)}\n\n*${t('p.mega.progressLabel')}:* ${percentage}% [${bar}]`,
                        edit: key
                    });
                    lastUpdate = Date.now();
                }
            });
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const ext = path.extname(file.name ?? '').toLowerCase();
                await sock.sendMessage(chatId, {
                    document: buffer,
                    fileName: file.name,
                    mimetype: MIME_TYPES[ext] || 'application/octet-stream',
                    caption: `✅ *${t('p.mega.downloadComplete')}*\n▢ *${t('p.mega.fileLabel')}:* ${file.name}\n▢ *${t('p.mega.sizeLabel')}:* ${formatBytes(file.size)}`
                }, { quoted: message });
            });
            stream.on('error', async (err) => {
                await sock.sendMessage(chatId, { text: `❌ *${t('p.mega.downloadErrorLabel')}:* ${err.message}` }, { quoted: message });
            });
        }
        catch (error) {
            await sock.sendMessage(chatId, { text: `❌ *${t('p.mega.errorLabel')}:* ${error.message}` }, { quoted: message });
        }
    }
};
