import axios from 'axios';
export default {
    command: 'sharechat',
    aliases: ['sharechatdl', 'sharechatvideo'],
    category: 'download',
    description: 'Download video from ShareChat',
    usage: '.sharechat <ShareChat URL>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const url = args?.[0];
        if (!url) {
            return await sock.sendMessage(chatId, { text: t('p.sharechat.noUrl') }, { quoted: message });
        }
        try {
            const apiUrl = `https://discardapi.dpdns.org/api/dl/sharechat?apikey=guru&url=${encodeURIComponent(url)}`;
            const { data } = await axios.get(apiUrl, { timeout: 10000 });
            if (!data?.status || !data.result?.length) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.sharechat.notFound')}` }, { quoted: message });
            }
            const videoUrl = data.result[0].video;
            const imageUrl = data.result[0].image;
            if (imageUrl) {
                await sock.sendMessage(chatId, { image: { url: imageUrl }, caption: `🖼️ ${t('p.sharechat.thumbnailCaption')}` }, { quoted: message });
            }
            if (videoUrl) {
                await sock.sendMessage(chatId, { video: { url: videoUrl }, caption: `🎬 ${t('p.sharechat.videoCaption')}` }, { quoted: message });
            }
        }
        catch (error) {
            console.error('ShareChat plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.sharechat.timeout')}` }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.sharechat.failed')}` }, { quoted: message });
            }
        }
    }
};
