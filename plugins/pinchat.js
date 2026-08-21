export default {
    command: 'pinchat',
    aliases: ['pin', 'unpin', 'unpinchat'],
    category: 'owner',
    description: 'Pin or unpin the current chat',
    usage: '.pinchat pin | .pinchat unpin',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        const rawText = (context.rawText || '').toLowerCase();
        const shouldPin = !rawText.startsWith('.unpin');
        try {
            await sock.chatModify({ pin: shouldPin }, chatId);
            await sock.sendMessage(chatId, {
                text: shouldPin ? `📌 ${t('p.pinchat.pinned')}` : `📌 ${t('p.pinchat.unpinned')}`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('[PINCHAT] Error:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${shouldPin ? t('p.pinchat.failedPin', { error: e.message }) : t('p.pinchat.failedUnpin', { error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
