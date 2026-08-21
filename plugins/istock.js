import axios from 'axios';
export default {
    command: 'istock',
    aliases: ['istockdl', 'istockdownload'],
    category: 'download',
    description: 'Download image or video from iStock URL',
    usage: '.istock <iStock URL>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const url = args?.[0]?.trim();
        if (!url) {
            return await sock.sendMessage(chatId, { text: t('p.istock.noUrl') }, { quoted: message });
        }
        try {
            const apiUrl = `https://discardapi.dpdns.org/api/dl/istock?apikey=guru&url=${encodeURIComponent(url)}`;
            const { data } = await axios.get(apiUrl, { timeout: 10000 });
            if (!data?.status || !data.result) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.istock.fetchFailed')}` }, { quoted: message });
            }
            const item = data.result;
            if (item.video) {
                await sock.sendMessage(chatId, { video: { url: item.video }, caption: `🎬 *${t('p.istock.videoCaption')}*` }, { quoted: message });
            }
            if (item.image) {
                await sock.sendMessage(chatId, { image: { url: item.image }, caption: `🖼️ *${t('p.istock.imageCaption')}*` }, { quoted: message });
            }
        }
        catch (error) {
            console.error('iStock download plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.istock.timeout')}` }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.istock.downloadFailed')}` }, { quoted: message });
            }
        }
    }
};
