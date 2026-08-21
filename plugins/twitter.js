import axios from 'axios';
export default {
    command: 'twitter',
    aliases: ['xtweet', 'tweetdl', 'twitterdl'],
    category: 'download',
    description: 'Download media (video or image) from X/Twitter post',
    usage: '.twitter <Tweet URL>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const url = args?.[0];
        if (!url) {
            return await sock.sendMessage(chatId, { text: `${t('p.twitter.noUrl')}\n${t('p.twitter.example')}` }, { quoted: message });
        }
        try {
            const apiUrl = `https://discardapi.dpdns.org/api/dl/twitter?apikey=guru&url=${encodeURIComponent(url)}`;
            const { data } = await axios.get(apiUrl, { timeout: 10000 });
            if (!data?.status || !data.result?.media?.length) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.twitter.noMedia')}` }, { quoted: message });
            }
            const tweet = data.result;
            const caption = `
📝 @${tweet.authorUsername} (${tweet.authorName})
📅 ${tweet.date}
❤️ ${t('p.twitter.likes')}: ${tweet.likes} | 🔁 ${t('p.twitter.retweets')}: ${tweet.retweets} | 💬 ${t('p.twitter.replies')}: ${tweet.replies}

💬 ${tweet.text}
      `.trim();
            for (const mediaItem of tweet.media) {
                if (mediaItem.type === 'video') {
                    await sock.sendMessage(chatId, { video: { url: mediaItem.url }, caption }, { quoted: message });
                }
                else if (mediaItem.type === 'image') {
                    await sock.sendMessage(chatId, { image: { url: mediaItem.url }, caption }, { quoted: message });
                }
            }
        }
        catch (error) {
            console.error('Twitter plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.twitter.timeout')}` }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.twitter.fetchFailed')}` }, { quoted: message });
            }
        }
    }
};
