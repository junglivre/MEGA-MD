import axios from 'axios';
export default {
    command: 'ttstalk',
    aliases: ['tikstalk', 'ttprofile'],
    category: 'stalk',
    description: 'Lookup TikTok user profile',
    usage: '.ttstalk <username>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: `*${t('p.ttstalk.noUsername')}*\n${t('p.ttstalk.example')}`
            }, { quoted: message });
        }
        const username = args[0];
        try {
            const { data } = await axios.get('https://discardapi.dpdns.org/api/stalk/tiktok', {
                params: { apikey: 'guru', username }
            });
            if (!data?.result?.user) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.ttstalk.notFound')}` }, { quoted: message });
            }
            const user = data.result.user;
            const stats = data.result.statsV2 || data.result.stats;
            const profileImage = user.avatarLarger || user.avatarMedium || user.avatarThumb;
            const verifiedMark = user.verified ? `✅ ${t('p.ttstalk.verified')}` : '';
            const yesLabel = t('p.ttstalk.yes');
            const noLabel = t('p.ttstalk.no');
            const caption = `🎵 *${t('p.ttstalk.profileInfo')}*\n\n` +
                `👤 ${t('p.ttstalk.nickname')}: ${user.nickname || 'N/A'} ${verifiedMark}\n` +
                `🆔 ${t('p.ttstalk.username')}: @${user.uniqueId || 'N/A'}\n` +
                `📝 ${t('p.ttstalk.bio')}: ${user.signature || 'N/A'}\n` +
                `🔒 ${t('p.ttstalk.privateAccount')}: ${user.privateAccount ? yesLabel : noLabel}\n\n` +
                `👥 ${t('p.ttstalk.followers')}: ${stats?.followerCount || 0}\n` +
                `➡ ${t('p.ttstalk.following')}: ${stats?.followingCount || 0}\n` +
                `❤️ ${t('p.ttstalk.likes')}: ${stats?.heartCount || 0}\n` +
                `🎥 ${t('p.ttstalk.videos')}: ${stats?.videoCount || 0}\n\n` +
                `🔗 ${t('p.ttstalk.profileUrl')}: https://www.tiktok.com/@${user.uniqueId}`;
            if (profileImage) {
                await sock.sendMessage(chatId, { image: { url: profileImage }, caption }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
        }
        catch (err) {
            console.error('TikTok plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.ttstalk.fetchFailed')}` }, { quoted: message });
        }
    }
};
