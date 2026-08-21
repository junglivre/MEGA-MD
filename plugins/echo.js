export default {
    command: 'echo',
    aliases: [],
    category: 'general',
    description: 'Repeats your message a specified number of times.',
    usage: '.echo <text> <count>',
    isPrefixless: true,
    async handler(sock, message, args, context) {
        const chatId = message.key.remoteJid;
        const { t } = context;
        if (args.length < 2) {
            return await sock.sendMessage(chatId, { text: t('p.echo.usage') }, { quoted: message });
        }
        const count = parseInt(args[args.length - 1], 10);
        if (isNaN(count) || count <= 0) {
            return await sock.sendMessage(chatId, { text: t('p.echo.invalidCount') }, { quoted: message });
        }
        args.pop();
        const text = args.join(' ').trim();
        const repeated = Array(count).fill(text).join('\n');
        await sock.sendMessage(chatId, { text: repeated }, { quoted: message });
    }
};
