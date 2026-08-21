import axios from 'axios';
export default {
    command: 'snapchat',
    aliases: ['scspot', 'snapdl'],
    category: 'download',
    description: 'Download media (video or image) from Snapchat Spotlight URL',
    usage: '.snapchat <Snapchat URL>',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, rawText, t } = context;
        const prefix = context.rawText.match(/^[.!#]/)?.[0] || '.';
        const commandPart = rawText.slice(prefix.length).trim();
        const parts = commandPart.split(/\s+/);
        const url = parts.slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, {
                text: t('p.snapchat.noUrl'),
                ...channelInfo
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, {
                text: `⏳ ${t('p.snapchat.fetching')}`,
                ...channelInfo
            }, { quoted: message });
            const apiUrl = `https://discardapi.dpdns.org/api/dl/snapchat?apikey=guru&url=${encodeURIComponent(url)}`;
            console.log('Requesting URL:', apiUrl);
            console.log('Original URL:', url);
            const { data } = await axios.get(apiUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            console.log('Snapchat API Response:', JSON.stringify(data, null, 2));
            if (!data || data.status !== true || !data.result || !Array.isArray(data.result) || data.result.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.snapchat.notFound')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            for (const mediaItem of data.result) {
                if (mediaItem.video) {
                    await sock.sendMessage(chatId, {
                        video: { url: mediaItem.video },
                        caption: `📹 ${t('p.snapchat.videoCaption')}`,
                        ...channelInfo
                    }, { quoted: message });
                }
                if (mediaItem.image) {
                    await sock.sendMessage(chatId, {
                        image: { url: mediaItem.image },
                        caption: `🖼 ${t('p.snapchat.imageCaption')}`,
                        ...channelInfo
                    }, { quoted: message });
                }
            }
        }
        catch (error) {
            console.error('Snapchat plugin error:', error.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.snapchat.failed')}\n${t('p.snapchat.errorLabel')}: ${error.message}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
