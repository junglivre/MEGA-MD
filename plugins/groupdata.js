export default {
    command: 'gcmtdata',
    aliases: ['gcinfo', 'groupinfo', 'gcmetadata', 'groupdata'],
    category: 'group',
    description: 'Get detailed info about the current group',
    usage: '.gcinfo',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        try {
            const meta = await sock.groupMetadata(chatId);
            const admins = meta.participants.filter((p) => p.admin).map((p) => `  • @${p.id.split('@')[0]}`).join('\n');
            const created = meta.creation
                ? new Date(meta.creation * 1000).toLocaleDateString()
                : t('p.gcmtdata.unknown');
            const memberCount = meta.participants.length;
            const adminCount = meta.participants.filter((p) => p.admin).length;
            await sock.sendMessage(chatId, {
                text: t('p.gcmtdata.info', {
                    subject: meta.subject,
                    desc: meta.desc || t('p.gcmtdata.noDescription'),
                    memberCount,
                    adminCount,
                    created,
                    id: meta.id,
                    admins: admins || t('p.gcmtdata.noAdmins')
                }),
                mentions: meta.participants.filter((p) => p.admin).map((p) => p.id),
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('[GROUPMETADATA] Error:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.gcmtdata.error', { message: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
