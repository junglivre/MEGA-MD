import axios from 'axios';
export default {
    command: 'tech',
    aliases: ['technology', 'techimg'],
    category: 'images',
    description: 'Get a random tech image',
    usage: '.tech',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const res = await axios.get('https://raw.githubusercontent.com/GlobalTechInfo/Database/main/images/tech.json');
            if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.tech.fetchFailed')}` }, { quoted: message });
            }
            const randomImage = res.data[Math.floor(Math.random() * res.data.length)];
            await sock.sendMessage(chatId, { image: { url: randomImage }, caption: `💻 ${t('p.tech.caption')}` }, { quoted: message });
        }
        catch (err) {
            console.error('Tech image plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.tech.error')}` }, { quoted: message });
        }
    }
};
