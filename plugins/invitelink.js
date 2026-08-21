export default {
    command: 'invitelink',
    aliases: ['invite', 'grouplink', 'gclink', 'revokeinvite', 'resetlink'],
    category: 'group',
    description: 'Get or revoke the group invite link',
    usage: '.invitelink — get link\n.revokeinvite — reset link',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const rawText = (context.rawText || '').toLowerCase();
        const isBotAdmin = context.isBotAdmin || false;
        const { t } = context;
        const isRevoke = rawText.startsWith('.revokeinvite') || rawText.startsWith('.resetlink') || args[0]?.toLowerCase() === 'revoke';
        if (isRevoke && !isBotAdmin) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.invitelink.botNotAdmin')}`,
                ...channelInfo
            }, { quoted: message });
        }
        try {
            if (isRevoke) {
                const newCode = await sock.groupRevokeInvite(chatId);
                return await sock.sendMessage(chatId, {
                    text: `🔄 *${t('p.invitelink.reset')}*\n\n*${t('p.invitelink.newLink')}:*\nhttps://chat.whatsapp.com/${newCode}`,
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                const code = await sock.groupInviteCode(chatId);
                return await sock.sendMessage(chatId, {
                    text: `🔗 *${t('p.invitelink.title')}*\n\nhttps://chat.whatsapp.com/${code}\n\n_${t('p.invitelink.hint')}_`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (e) {
            console.error('[INVITELINK] Error:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.invitelink.failed', { error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
