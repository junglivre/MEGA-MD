export default {
    command: 'ping',
    aliases: ['p', 'pong'],
    category: 'general',
    description: 'Check bot response time',
    usage: '.ping',
    isPrefixless: true,
    async handler(sock, message, _args, context) {
        const { t } = context;
        const start = Date.now();
        const chatId = message.key.remoteJid;
        const sent = await sock.sendMessage(chatId, {
            text: t('p.ping.pinging')
        });
        const end = Date.now();
        await sock.sendMessage(chatId, {
            text: `🏓 ${t('p.ping.pong', { ms: end - start })}`,
            edit: sent.key
        });
    }
};
