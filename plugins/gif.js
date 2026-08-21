import axios from 'axios';
export default {
    command: 'gif',
    aliases: ['giphy', 'searchgif'],
    category: 'stickers',
    description: 'Get a GIF based on a search term',
    usage: '.gif <search term>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const config = context.config;
        const { t } = context;
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(chatId, { text: t('p.gif.noQuery') }, { quoted: message });
            return;
        }
        try {
            const response = await axios.get('https://api.giphy.com/v1/gifs/search', {
                params: {
                    api_key: config.giphyApiKey,
                    q: query,
                    limit: 1,
                    rating: 'g'
                }
            });
            const gifData = response.data.data[0];
            if (!gifData) {
                await sock.sendMessage(chatId, { text: t('p.gif.notFound') }, { quoted: message });
                return;
            }
            const mp4Url = gifData.images.original_mp4?.mp4;
            if (mp4Url) {
                await sock.sendMessage(chatId, { video: { url: mp4Url }, caption: t('p.gif.caption', { query }) }, { quoted: message });
            }
            else {
                const gifUrl = gifData.images.original?.url;
                await sock.sendMessage(chatId, { document: { url: gifUrl }, mimetype: 'image/gif', caption: t('p.gif.caption', { query }) }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Error in gif command:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.gif.failed')}` }, { quoted: message });
        }
    }
};
