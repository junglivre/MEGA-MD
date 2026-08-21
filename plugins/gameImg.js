import axios from 'axios';
export default {
    command: 'game',
    aliases: ['gaming', 'gameimg'],
    category: 'images',
    description: 'Get a random gaming image',
    usage: '.game',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const res = await axios.get('https://raw.githubusercontent.com/GlobalTechInfo/Database/main/images/game.json');
            if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.game.noData')}` }, { quoted: message });
            }
            const randomImage = res.data[Math.floor(Math.random() * res.data.length)];
            await sock.sendMessage(chatId, { image: { url: randomImage }, caption: `🎮 ${t('p.game.caption')}` }, { quoted: message });
        }
        catch (err) {
            console.error('Game image plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.game.failed')}` }, { quoted: message });
        }
    }
};
