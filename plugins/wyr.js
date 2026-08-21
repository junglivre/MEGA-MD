import axios from 'axios';
export default {
    command: 'wyr',
    aliases: ['wouldyourather'],
    category: 'quotes',
    description: 'Get a Would You Rather question',
    usage: '.wyr',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const res = await axios.get('https://discardapi.dpdns.org/api/quote/wyr?apikey=guru');
            if (!res.data || res.data.status !== true) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.wyr.fetchFailed')}` }, { quoted: message });
            }
            const opt1 = res.data.question?.option1 || t('p.wyr.option1NotFound');
            const opt2 = res.data.question?.option2 || t('p.wyr.option2NotFound');
            const _creator = res.data.creator || 'Unknown';
            const replyText = `🤔 *${t('p.wyr.title')}*\n\n◍ ${opt1}\n◍ ${opt2}`;
            await sock.sendMessage(chatId, { text: replyText }, { quoted: message });
        }
        catch (err) {
            console.error('WYR plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.wyr.errorFetching')}` }, { quoted: message });
        }
    }
};
