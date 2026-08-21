import axios from 'axios';
export default {
    command: 'thrstalk',
    aliases: ['threadsprofile', 'threadsuser'],
    category: 'stalk',
    description: 'Lookup Threads user profile',
    usage: '.thrstalk <username>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: `*${t('p.thrstalk.noUsername')}*\n${t('p.thrstalk.example')}`
            }, { quoted: message });
        }
        const username = args[0];
        try {
            const apiUrl = `https://discardapi.onrender.com/api/stalk/threads?apikey=guru&url=${username}`;
            const { data } = await axios.get(apiUrl, {
                timeout: 45000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!data?.result) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.thrstalk.notFound')}` }, { quoted: message });
            }
            const result = data.result;
            const profileImage = result.hd_profile_picture || result.profile_picture || null;
            const verifiedMark = result.is_verified ? `✅ ${t('p.thrstalk.verified')}` : '';
            const caption = `🧵 *${t('p.thrstalk.profileInfo')}*\n\n` +
                `👤 ${t('p.thrstalk.name')}: ${result.name || 'N/A'} ${verifiedMark}\n` +
                `🆔 ${t('p.thrstalk.username')}: ${result.username || 'N/A'}\n` +
                `📎 ${t('p.thrstalk.links')}: ${result.links?.length ? result.links.join('\n') : 'N/A'}\n` +
                `👥 ${t('p.thrstalk.followers')}: ${result.followers || 0}\n` +
                `📝 ${t('p.thrstalk.bio')}: ${result.bio || 'N/A'}\n` +
                `🔗 ${t('p.thrstalk.profileUrl')}: https://threads.net/@${result.username || username}`;
            if (profileImage) {
                await sock.sendMessage(chatId, { image: { url: profileImage }, caption }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
        }
        catch (err) {
            console.error('Threads plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.thrstalk.fetchFailed')}` }, { quoted: message });
        }
    }
};
