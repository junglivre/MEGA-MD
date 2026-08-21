export default {
    command: 'poll',
    aliases: ['createpoll', 'newpoll'],
    category: 'group',
    description: 'Create a native WhatsApp poll in the group',
    usage: '.poll <Question> | <Option1> | <Option2> | ...',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        const fullText = args.join(' ');
        const parts = fullText.split('|').map((p) => p.trim()).filter(Boolean);
        if (parts.length < 3) {
            return await sock.sendMessage(chatId, {
                text: t('p.poll.usage'),
                ...channelInfo
            }, { quoted: message });
        }
        const question = parts[0];
        const options = parts.slice(1);
        if (options.length > 12) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.poll.maxOptions')}`,
                ...channelInfo
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, {
                poll: {
                    name: question,
                    values: options,
                    selectableCount: 1
                }
            });
        }
        catch (e) {
            console.error('[POLL] Error sending poll:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.poll.failed')}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
