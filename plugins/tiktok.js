import axios from 'axios';
export default {
    command: 'tiktok',
    aliases: ['tt', 'ttdl', 'tiktokdl'],
    category: 'download',
    description: 'Download TikTok video without watermark (HD if available)',
    usage: '.tiktok <TikTok URL>',
    async handler(sock, message, args, context) {
        const { chatId, rawText, t } = context;
        const prefix = rawText.match(/^[.!#]/)?.[0] || '.';
        const commandPart = rawText.slice(prefix.length).trim();
        const parts = commandPart.split(/\s+/);
        const url = parts.slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `🎵 *${t('p.tiktok.title')}*\n\n${t('p.tiktok.provideUrl')}`
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, {
                text: `⏳ ${t('p.tiktok.downloading')}`
            }, { quoted: message });
            const apiUrl = `https://discardapi.onrender.com/api/dl/tiktok?apikey=guru&url=${encodeURIComponent(url)}`;
            const { data } = await axios.get(apiUrl, {
                timeout: 45000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!data?.status || !data?.result) {
                throw new Error('Invalid API response');
            }
            const res = data.result;
            const hd = res.data.find((v) => v.type === 'nowatermark_hd');
            const noWm = res.data.find((v) => v.type === 'nowatermark');
            const videoUrl = hd?.url || noWm?.url;
            if (!videoUrl) {
                throw new Error('No downloadable video found');
            }
            const caption = `🎵 *${t('p.tiktok.title')}*
━━━━━━━━━━━━━━━━━━━
👤 *${t('p.tiktok.userLabel')}:* ${res.author.nickname}
🆔 *${t('p.tiktok.usernameLabel')}:* ${res.author.fullname}
🌍 *${t('p.tiktok.regionLabel')}:* ${res.region}
⏱️ *${t('p.tiktok.durationLabel')}:* ${res.duration}

❤️ *${t('p.tiktok.likesLabel')}:* ${res.stats.likes}
💬 *${t('p.tiktok.commentsLabel')}:* ${res.stats.comment}
🔁 *${t('p.tiktok.sharesLabel')}:* ${res.stats.share}
👀 *${t('p.tiktok.viewsLabel')}:* ${res.stats.views}

🎧 *${t('p.tiktok.soundLabel')}:* ${res.music_info.title}
📅 *${t('p.tiktok.postedLabel')}:* ${res.taken_at}

📝 *${t('p.tiktok.captionLabel')}:*
${res.title || t('p.tiktok.noCaption')}

✨ *${t('p.tiktok.qualityLabel')}:* ${hd ? t('p.tiktok.hdNoWatermark') : t('p.tiktok.noWatermark')}
━━━━━━━━━━━━━━━━━━━`;
            await sock.sendMessage(chatId, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption
            }, { quoted: message });
        }
        catch (error) {
            console.error('TikTok plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, {
                    text: `⏱️ ${t('p.tiktok.timeout')}`
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.tiktok.downloadFailed', { reason: error.message })}`
                }, { quoted: message });
            }
        }
    }
};
