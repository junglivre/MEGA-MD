export default {
    command: 'tagnotadmin',
    aliases: ['tagmembers', 'tagnon'],
    category: 'admin',
    description: 'Tag all non-admin members in the group',
    usage: '.tagnotadmin',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants || [];
            const nonAdmins = participants.filter((p) => !p.admin).map((p) => p.id);
            if (nonAdmins.length === 0) {
                await sock.sendMessage(chatId, {
                    text: t('p.tagnotadmin.noneFound'),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            let text = `🔊 *${t('p.tagnotadmin.greeting')}:*\n\n`;
            nonAdmins.forEach((jid) => {
                text += `@${jid.split('@')[0]}\n`;
            });
            await sock.sendMessage(chatId, {
                text,
                mentions: nonAdmins,
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error in tagnotadmin command:', error);
            await sock.sendMessage(chatId, {
                text: t('p.tagnotadmin.failed'),
                ...channelInfo
            }, { quoted: message });
        }
    }
};
