import axios from 'axios';
export default {
    command: 'quote2',
    aliases: ['quotes2', 'randomquote'],
    category: 'quotes',
    description: 'Get a random inspirational quote',
    usage: '.quote2',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const res = await axios.get('https://discardapi.dpdns.org/api/quotes/random?apikey=guru');
            if (!res.data || res.data.status !== true) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.quote2.fetchFailed')}` }, { quoted: message });
            }
            const quote = res.data.result?.quote || t('p.quote2.noQuote');
            const _creator = res.data.creator || 'Unknown';
            const replyText = `💬 *${t('p.quote2.header')}*\n\n${quote}`;
            await sock.sendMessage(chatId, { text: replyText }, { quoted: message });
        }
        catch (err) {
            console.error('Quote plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.quote2.error')}` }, { quoted: message });
        }
    }
};
