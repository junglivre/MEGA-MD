import axios from 'axios';
async function fetchWithRetries(url, retries = 3, delay = 2000) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            const { data } = await axios.get(url);
            return data;
        }
        catch (err) {
            attempt++;
            console.error(`[WHY] Attempt ${attempt} failed:`, err.message);
            if (attempt >= retries)
                throw new Error('Max retries reached');
            await new Promise(r => setTimeout(r, delay));
        }
    }
}
export default {
    command: 'why',
    aliases: ['whyme', 'question'],
    category: 'fun',
    description: 'Get a random “why” question from the API',
    usage: '.why',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const data = await fetchWithRetries('https://nekos.life/api/v2/why');
            if (!data?.why?.trim()) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.why.invalidResponse')}` }, { quoted: message });
            }
            await sock.sendMessage(chatId, { text: `🤔 *${t('p.why.title')}*\n\n${data.why}` }, { quoted: message });
        }
        catch (error) {
            console.error('Why plugin error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.why.failed')}` }, { quoted: message });
        }
    }
};
