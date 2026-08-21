export default {
    command: 'quote',
    aliases: ['quotes', 'quotetext'],
    category: 'quotes',
    description: 'Get a random quote',
    usage: '.quote',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const apiKey = 'shizo';
            const res = await fetch(`https://shizoapi.onrender.com/api/texts/quotes?apikey=${apiKey}`);
            if (!res.ok)
                throw await res.text();
            const json = await res.json();
            const quoteMessage = json.result;
            await sock.sendMessage(chatId, { text: quoteMessage }, { quoted: message });
        }
        catch (error) {
            console.error('Quote Command Error:', error);
            await sock.sendMessage(chatId, {
                text: t('p.quote.failed')
            }, { quoted: message });
        }
    }
};
