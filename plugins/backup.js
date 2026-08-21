import isOwnerOrSudo from '../lib/isOwner.js';
import { createBackup, listBackups } from '../lib/backup.js';

export default {
    command: 'backup',
    aliases: ['backupnow', 'backups'],
    category: 'owner',
    ownerOnly: true,
    description: 'Create or list local ZIP backups',
    usage: '.backup [now|list]',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        if (!message.key.fromMe && !(await isOwnerOrSudo(senderId, sock, chatId)))
            return;
        if ((args[0] || 'now').toLowerCase() === 'list') {
            const backups = listBackups();
            const text = backups.length
                ? `📦 ${t('p.backup.listTitle', { count: backups.length })}\n${backups.map((backup) => `• ${backup.file} — ${(backup.size / 1024 / 1024).toFixed(2)} MB`).join('\n')}`
                : `📦 ${t('p.backup.empty')}`;
            return sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `📦 ${t('p.backup.creating')}`, ...channelInfo }, { quoted: message });
        const backup = await createBackup();
        return sock.sendMessage(chatId, {
            text: backup ? `✅ ${t('p.backup.success', { file: backup.file, size: backup.size })}` : `❌ ${t('p.backup.failed')}`
        }, { quoted: message });
    }
};
