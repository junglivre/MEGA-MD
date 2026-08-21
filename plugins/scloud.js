import axios from 'axios';
export default {
    command: 'scloud',
    aliases: ['scsearch', 'soundcloud'],
    category: 'music',
    description: 'Search for tracks on SoundCloud',
    usage: '.scloud <song name>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const searchQuery = args.join(' ').trim();
        try {
            if (!searchQuery) {
                return await sock.sendMessage(chatId, {
                    text: `*${t('p.scloud.whatSearch')}*\nUsage: .soundcloud <song name>\n\nExample: .soundcloud never gonna give you up`
                }, { quoted: message });
            }
            await new Promise(resolve => setTimeout(resolve, 10000));
            const searchUrl = `https://discardapi.dpdns.org/api/search/soundcloud?apikey=guru&query=${encodeURIComponent(searchQuery)}`;
            const response = await axios.get(searchUrl, { timeout: 30000 });
            if (!response.data?.result?.result || response.data.result.result.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.scloud.noResults')}*\n${t('p.scloud.tryDifferent')}`
                }, { quoted: message });
            }
            const results = response.data.result.result;
            const totalFound = results.length;
            const tracks = results.filter((item) => item.kind === 'track');
            if (tracks.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.scloud.noTracks')}*\n${t('p.scloud.onlyProfiles')}`
                }, { quoted: message });
            }
            const limit = Math.min(5, tracks.length);
            let resultText = `🎵 *${t('p.scloud.resultsTitle')}*\n`;
            resultText += `📊 ${t('p.scloud.foundResults', { total: totalFound, tracks: tracks.length })}\n\n`;
            for (let i = 0; i < limit; i++) {
                const track = tracks[i];
                const duration = Math.floor(track.duration / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                resultText += `*${i + 1}. ${track.title}*\n`;
                resultText += `👤 ${t('p.scloud.artist')}: ${track.user_id ? t('p.scloud.available') : t('p.scloud.unknown')}\n`;
                resultText += `⏱️ ${t('p.scloud.duration')}: ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
                resultText += `👂 ${t('p.scloud.plays')}: ${track.playback_count?.toLocaleString() || t('p.scloud.notAvailable')}\n`;
                resultText += `❤️ ${t('p.scloud.likes')}: ${track.likes_count?.toLocaleString() || t('p.scloud.notAvailable')}\n`;
                resultText += `💬 ${t('p.scloud.comments')}: ${track.comment_count?.toLocaleString() || t('p.scloud.notAvailable')}\n`;
                resultText += `🎼 ${t('p.scloud.genre')}: ${track.genre || t('p.scloud.unknown')}\n`;
                resultText += `🔗 ${t('p.scloud.link')}: ${track.permalink_url}\n\n`;
            }
            if (tracks.length > limit) {
                resultText += `_${t('p.scloud.moreTracks', { count: tracks.length - limit })}_`;
            }
            const firstTrack = tracks[0];
            if (firstTrack.artwork_url) {
                try {
                    const imageBuffer = await axios.get(firstTrack.artwork_url, {
                        responseType: 'arraybuffer',
                        timeout: 15000
                    }).then(res => Buffer.from(res.data));
                    await sock.sendMessage(chatId, {
                        image: imageBuffer,
                        caption: resultText
                    }, { quoted: message });
                }
                catch (imgError) {
                    await sock.sendMessage(chatId, {
                        text: resultText
                    }, { quoted: message });
                }
            }
            else {
                await sock.sendMessage(chatId, {
                    text: resultText
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('SoundCloud Search Error:', error);
            let errorMsg = `❌ *${t('p.scloud.searchFailed')}*\n\n`;
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                errorMsg += `*${t('p.scloud.reason')}:* ${t('p.scloud.connTimeout')}`;
            }
            else if (error.response) {
                errorMsg += `*${t('p.scloud.status')}:* ${error.response.status}\n*${t('p.scloud.error')}:* ${error.response.statusText}`;
            }
            else {
                errorMsg += `*${t('p.scloud.error')}:* ${error.message}`;
            }
            errorMsg += `\n\n${t('p.scloud.tryAgainLater')}`;
            await sock.sendMessage(chatId, {
                text: errorMsg
            }, { quoted: message });
        }
    }
};
