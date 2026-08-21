import axios from 'axios';
export default {
    command: 'string',
    aliases: ['textinfo', 'textstats'],
    category: 'info',
    description: 'Get detailed info about a text string',
    usage: '.string <text>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const textInput = args?.join(' ')?.trim();
        if (!textInput) {
            return await sock.sendMessage(chatId, { text: `*${t('p.string.provideText')}*\n${t('p.string.example')}` }, { quoted: message });
        }
        try {
            const apiUrl = `https://discardapi.dpdns.org/api/tools/string?apikey=guru&text=${encodeURIComponent(textInput)}`;
            const { data } = await axios.get(apiUrl, { timeout: 10000 });
            if (!data?.status) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.string.analyzeFailed')}` }, { quoted: message });
            }
            const reply = t('p.string.analysis', {
                text: textInput,
                letters: data.letters,
                length: data.length,
                words: data.words
            });
            await sock.sendMessage(chatId, { text: reply }, { quoted: message });
        }
        catch (error) {
            console.error('String plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.string.timeout')}` }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.string.fetchFailed')}` }, { quoted: message });
            }
        }
    }
};
