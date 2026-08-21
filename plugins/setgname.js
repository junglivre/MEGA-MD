export default {
    command: 'setgname',
    aliases: ['setname', 'groupname'],
    category: 'admin',
    description: 'Change group name',
    usage: '.setgname <new name>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const name = args.join(' ').trim();
        if (!name) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.setgname.noName')}*\n\n${t('p.setgname.usage')}`
            }, { quoted: message });
            return;
        }
        try {
            await sock.groupUpdateSubject(chatId, name);
            await sock.sendMessage(chatId, {
                text: `✅ *${t('p.setgname.success')}:*\n${name}`
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error updating group name:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.setgname.failedTitle')}*\n\n${t('p.setgname.failedHint')}`
            }, { quoted: message });
        }
    }
};
