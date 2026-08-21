import axios from 'axios';
export default {
    command: 'stickers',
    aliases: ['stickersearch', 'ssticker'],
    category: 'stickers',
    description: 'Search for stickers using Tenor',
    usage: '.stickers <search term>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const text = args?.join(' ')?.trim();
        if (!text) {
            return await sock.sendMessage(chatId, { text: `*${t('p.stickers.provideTerm')}*\n${t('p.stickers.example')}` }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: t('p.stickers.searching') }, { quoted: message });
            const { data } = await axios.get(`https://g.tenor.com/v1/search?q=${encodeURIComponent(text)}&key=LIVDSRZULELA&limit=8`);
            if (!data?.results?.length) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.stickers.notFound')}` }, { quoted: message });
            }
            const limit = Math.min(data.results.length, 5);
            for (let i = 0; i < limit; i++) {
                const media = data.results[i].media?.[0]?.mp4?.url;
                if (!media)
                    continue;
                await sock.sendMessage(chatId, { video: { url: media }, caption: t('p.stickers.captionLabel', { n: i + 1 }), mimetype: 'video/mp4' }, { quoted: message });
            }
        }
        catch (error) {
            console.error('StickerSearch plugin error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.stickers.fetchFailed')}` }, { quoted: message });
        }
    }
};
