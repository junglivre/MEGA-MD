export default {
    command: 'clear',
    aliases: ['clr', 'clean'],
    category: 'owner',
    description: 'Clear bot messages from chat',
    usage: '.clear',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const sent = await sock.sendMessage(chatId, {
                text: t('p.clear.clearing'),
                ...channelInfo
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.sendMessage(chatId, { delete: sent.key });
        }
        catch (error) {
            console.error('Error clearing messages:', error);
            await sock.sendMessage(chatId, {
                text: t('p.clear.genericError'),
                ...channelInfo
            }, { quoted: message });
        }
    }
};
