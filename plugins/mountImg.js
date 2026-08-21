import axios from 'axios';
export default {
    command: 'mountain',
    aliases: ['mountains', 'mountainimg'],
    category: 'images',
    description: 'Get a random mountain image',
    usage: '.mountain',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const res = await axios.get('https://raw.githubusercontent.com/GlobalTechInfo/Database/main/images/mountain.json');
            if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.mountain.fetchFailed')}` }, { quoted: message });
            }
            const randomImage = res.data[Math.floor(Math.random() * res.data.length)];
            await sock.sendMessage(chatId, { image: { url: randomImage }, caption: `🏔️ ${t('p.mountain.caption')}` }, { quoted: message });
        }
        catch (err) {
            console.error('Mountain image plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.mountain.fetchError')}` }, { quoted: message });
        }
    }
};
