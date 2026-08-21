import { promises as fs } from 'fs';
import path from 'path';
export default {
    command: 'getfile',
    aliases: ['readfile', 'viewfile'],
    category: 'owner',
    description: 'Read and display file contents from bot directory',
    usage: '.getfile <filename>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const filename = args.join(' ').trim();
        try {
            if (!filename) {
                return await sock.sendMessage(chatId, {
                    text: t('p.getfile.usage')
                }, { quoted: message });
            }
            // Check project root first, then dist/ for compiled files
            let filePath = path.join(process.cwd(), filename);
            try {
                await fs.access(filePath);
            }
            catch {
                // Try dist/ for .js files
                const distPath = path.join(process.cwd(), 'dist', filename);
                try {
                    await fs.access(distPath);
                    filePath = distPath;
                }
                catch { /* will fail below */ }
            }
            try {
                await fs.access(filePath);
            }
            catch {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.getfile.notFound', { filename })}`
                }, { quoted: message });
            }
            const fileContent = await fs.readFile(filePath, 'utf8');
            if (!fileContent || fileContent.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: `⚠️ ${t('p.getfile.empty', { filename })}`
                }, { quoted: message });
            }
            if (fileContent.length > 60000) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.getfile.tooLarge', { filename, size: Math.round(fileContent.length / 1024) })}`
                }, { quoted: message });
            }
            const stats = await fs.stat(filePath);
            const fileSize = (stats.size / 1024).toFixed(2);
            const lastModified = stats.mtime.toLocaleString();
            const header = t('p.getfile.caption', {
                filename,
                size: fileSize,
                modified: lastModified,
                lines: fileContent.split('\n').length
            });
            const caption = `📄 ${header}\n\n\`\`\`${fileContent}\`\`\``;
            await sock.sendMessage(chatId, {
                text: caption
            }, { quoted: message });
        }
        catch (error) {
            console.error('GetFile Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.getfile.error', { error: error.message })}`
            }, { quoted: message });
        }
    }
};
