export default {
    command: 'joingroup',
    aliases: ['join', 'gcjoin', 'groupinfo'],
    category: 'owner',
    description: 'Join a group via invite link or get group info from link',
    usage: '.joingroup <link or code>\n.groupinfo <link or code>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const rawText = (context.rawText || '').toLowerCase();
        const { t } = context;
        const isInfo = rawText.startsWith('.groupinfo');
        const input = args[0];
        if (!input) {
            return await sock.sendMessage(chatId, {
                text: `*${isInfo ? `🔍 ${t('p.joingroup.groupInfoTitle')}` : `🚪 ${t('p.joingroup.joinGroupTitle')}`}*\n\n` +
                    `*${t('p.joingroup.usage')}:*\n` +
                    `• \`.joingroup https://chat.whatsapp.com/XXXX\`\n` +
                    `• \`.joingroup XXXX\` (${t('p.joingroup.codeOnly')})\n` +
                    `• \`.groupinfo https://chat.whatsapp.com/XXXX\` — ${t('p.joingroup.infoWithoutJoining')}`,
                ...channelInfo
            }, { quoted: message });
        }
        // Extract code from full link or use directly
        const code = input.replace('https://chat.whatsapp.com/', '').trim();
        try {
            if (isInfo) {
                const info = await sock.groupGetInviteInfo(code);
                const members = info.participants?.length || 0;
                return await sock.sendMessage(chatId, {
                    text: `╔═══════════════════════╗\n` +
                        `║    🔍 *${t('p.joingroup.groupInfoTitle')}*       ║\n` +
                        `╚═══════════════════════╝\n\n` +
                        `*${t('p.joingroup.name')}:* ${info.subject || t('p.joingroup.unknown')}\n` +
                        `*${t('p.joingroup.description')}:* ${info.desc || t('p.joingroup.none')}\n` +
                        `*${t('p.joingroup.members')}:* ${members}\n` +
                        `*${t('p.joingroup.created')}:* ${info.creation ? new Date(info.creation * 1000).toLocaleDateString() : t('p.joingroup.unknown')}\n` +
                        `*JID:* \`${info.id}\``,
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                const response = await sock.groupAcceptInvite(code);
                return await sock.sendMessage(chatId, {
                    text: `✅ *${t('p.joingroup.joined')}*\n\nJID: \`${response}\``,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (e) {
            console.error('[JOINGROUP] Error:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.joingroup.failed', { error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
