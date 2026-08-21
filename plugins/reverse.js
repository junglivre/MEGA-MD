import axios from 'axios';
export default {
    command: 'reverse',
    aliases: ['revt', 'reversetext'],
    category: 'tools',
    description: 'Reverse any text',
    usage: '.reverse <text>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const textToReverse = args?.join(' ')?.trim();
        if (!textToReverse) {
            return await sock.sendMessage(chatId, { text: `${t('p.reverse.provideText')}\nExample: .reverse Hello World` }, { quoted: message });
        }
        try {
            const apiUrl = `https://discardapi.dpdns.org/api/tools/reverse?apikey=guru&text=${encodeURIComponent(textToReverse)}`;
            const { data } = await axios.get(apiUrl, { timeout: 10000 });
            if (!data?.status || !data.result) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.reverse.failed')}` }, { quoted: message });
            }
            const reply = `*${t('p.reverse.reversed')}:* ${data.result}`;
            await sock.sendMessage(chatId, { text: reply }, { quoted: message });
        }
        catch (error) {
            console.error('Reverse plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.reverse.timeout')}` }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.reverse.failed')}` }, { quoted: message });
            }
        }
    }
};
