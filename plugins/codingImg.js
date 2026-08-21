import axios from 'axios';
export default {
    command: 'coding',
    aliases: ['codingimg', 'programming', 'programmingimg'],
    category: 'images',
    description: 'Get a random programming image',
    usage: '.coding',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const res = await axios.get('https://raw.githubusercontent.com/GlobalTechInfo/Database/main/images/coding.json');
            if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.coding.fetchFailed')}` }, { quoted: message });
            }
            const randomImage = res.data[Math.floor(Math.random() * res.data.length)];
            await sock.sendMessage(chatId, { image: { url: randomImage }, caption: `💻 ${t('p.coding.caption')}` }, { quoted: message });
        }
        catch (err) {
            console.error('Programming image plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.coding.error')}` }, { quoted: message });
        }
    }
};
