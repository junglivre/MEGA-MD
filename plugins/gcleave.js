export default {
    command: 'gcleave',
    aliases: ['leavegroup', 'groupleave', 'leavegc'],
    category: 'owner',
    description: 'Make the bot leave a group',
    usage: '.groupleave — leave current group\n.groupleave <jid> — leave specific group',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const t = context.t;
        const targetJid = args[0]?.includes('@g.us') ? args[0] : chatId;
        if (!targetJid.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.gcleave.groupOnly')}`,
                ...channelInfo
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(targetJid, {
                text: `👋 ${t('p.gcleave.leaving')}`,
                ...channelInfo
            });
            await new Promise(r => setTimeout(r, 500));
            await sock.groupLeave(targetJid);
            // If triggered from another chat, confirm there
            if (targetJid !== chatId) {
                await sock.sendMessage(chatId, {
                    text: `✅ ${t('p.gcleave.left', { jid: targetJid })}`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (e) {
            console.error('[GROUPLEAVE] Error:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.gcleave.failed', { error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
