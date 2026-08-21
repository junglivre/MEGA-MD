export default {
    command: 'resetlink',
    aliases: ['revoke', 'newlink'],
    category: 'admin',
    description: 'Reset group invite link',
    usage: '.resetlink',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const newCode = await sock.groupRevokeInvite(chatId);
            await sock.sendMessage(chatId, {
                text: `✅ ${t('p.resetlink.success')}\n\n🔗 ${t('p.resetlink.newLink')}:\nhttps://chat.whatsapp.com/${newCode}`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error in resetlink command:', error);
            await sock.sendMessage(chatId, {
                text: t('p.resetlink.failed'),
                ...channelInfo
            }, { quoted: message });
        }
    }
};
