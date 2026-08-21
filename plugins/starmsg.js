export default {
    command: 'star',
    aliases: ['starmsg', 'unstar', 'unstarmsg'],
    category: 'owner',
    description: 'Star or unstar a replied message',
    usage: '.star — reply to a message | .unstar — reply to a message',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        const rawText = (context.rawText || '').toLowerCase();
        const shouldStar = !rawText.startsWith('.unstar');
        // contextInfo can be nested in any message type
        const msg = message.message;
        const contextInfo = msg?.extendedTextMessage?.contextInfo ||
            msg?.imageMessage?.contextInfo ||
            msg?.videoMessage?.contextInfo ||
            msg?.audioMessage?.contextInfo ||
            msg?.documentMessage?.contextInfo ||
            msg?.stickerMessage?.contextInfo ||
            msg?.buttonsResponseMessage?.contextInfo ||
            null;
        if (!contextInfo?.stanzaId) {
            return await sock.sendMessage(chatId, {
                text: `*⭐ ${t('p.star.title')}*\n\n_${t('p.star.instructions')}_\n• \`.star\` — ${t('p.star.starOption')}\n• \`.unstar\` — ${t('p.star.unstarOption')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const targetId = contextInfo.stanzaId;
        // Determine fromMe: compare phone numbers only (strip :xx@suffix)
        const botNum = (sock.user?.id || '').split(':')[0].split('@')[0];
        const participantNum = (contextInfo.participant || '').split(':')[0].split('@')[0];
        const fromMe = participantNum ? participantNum === botNum : message.key.fromMe;
        try {
            await sock.chatModify({
                star: {
                    messages: [{ id: targetId, fromMe }],
                    star: shouldStar
                }
            }, chatId);
            await sock.sendMessage(chatId, {
                text: shouldStar ? `⭐ *${t('p.star.starred')}*` : `✴️ *${t('p.star.unstarred')}*`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('[STARMSG] Error:', e.message);
            const actionWord = shouldStar ? t('p.star.starAction') : t('p.star.unstarAction');
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.star.actionFailed', { action: actionWord, error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
