import axios from 'axios';
export default {
    command: 'tgstalk',
    aliases: ['tguser', 'tginfo'],
    category: 'stalk',
    description: 'Lookup Telegram channel or user',
    usage: '.tgstalk <username>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: t('p.tgstalk.usage')
            }, { quoted: message });
        }
        const username = args[0];
        try {
            const apiUrl = `https://discardapi.onrender.com/api/stalk/telegram?apikey=guru&url=${username}`;
            const { data } = await axios.get(apiUrl, {
                timeout: 45000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!data?.result) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.tgstalk.notFound')}` }, { quoted: message });
            }
            const result = data.result;
            const profileImage = result.image_url || null;
            const caption = `📱 *${t('p.tgstalk.infoTitle')}*\n\n` +
                `👤 ${t('p.tgstalk.titleLabel')}: ${result.title || t('p.tgstalk.notAvailable')}\n` +
                `📝 ${t('p.tgstalk.descriptionLabel')}: ${result.description || t('p.tgstalk.notAvailable')}\n` +
                `🔗 ${t('p.tgstalk.linkLabel')}: ${result.url || `https://t.me/${username}`}`;
            if (profileImage) {
                await sock.sendMessage(chatId, { image: { url: profileImage }, caption }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
        }
        catch (err) {
            console.error('Telegram plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.tgstalk.fetchFailed')}` }, { quoted: message });
        }
    }
};
