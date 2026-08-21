export default {
    command: 'archivechat',
    aliases: ['archive', 'unarchive', 'unarchivechat'],
    category: 'owner',
    description: 'Archive or unarchive the current chat',
    usage: '.archivechat <archive|unarchive>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const rawText = context.rawText || '';
        const { t } = context;
        // Auto-detect from command name
        const isUnarchive = rawText.toLowerCase().startsWith('.unarchive');
        const action = args[0]?.toLowerCase() || (isUnarchive ? 'unarchive' : 'archive');
        if (!['archive', 'unarchive'].includes(action)) {
            return await sock.sendMessage(chatId, {
                text: `*📦 ${t('p.archivechat.title')}*\n\n*${t('p.archivechat.usageLabel')}:*\n• \`.archivechat archive\` — ${t('p.archivechat.usageArchive')}\n• \`.archivechat unarchive\` — ${t('p.archivechat.usageUnarchive')}\n\n_${t('p.archivechat.aliasesHint')}_`,
                ...channelInfo
            }, { quoted: message });
        }
        const shouldArchive = action === 'archive';
        try {
            const lastMsg = message;
            await sock.chatModify({
                archive: shouldArchive,
                lastMessages: [
                    {
                        key: lastMsg.key,
                        messageTimestamp: lastMsg.messageTimestamp
                    }
                ]
            }, chatId);
            await sock.sendMessage(chatId, {
                text: shouldArchive
                    ? `📦 *${t('p.archivechat.archived')}*`
                    : `📂 *${t('p.archivechat.unarchived')}*`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('[ARCHIVECHAT] Error:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.archivechat.failed', { action, error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
