import axios from 'axios';
export default {
    command: 'xstalk',
    aliases: ['twstalk', 'xprofile'],
    category: 'stalk',
    description: 'Lookup Twitter user profile',
    usage: '.xstalk <username>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: `*${t('p.xstalk.noUsername')}*\nExample: .xstalk HarmeetSinghPk`
            }, { quoted: message });
        }
        const username = args[0];
        try {
            const { data } = await axios.get(`https://discardapi.dpdns.org/api/stalk/twitter`, {
                params: { apikey: 'guru', username }
            });
            if (!data?.result) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.xstalk.notFound')}` }, { quoted: message });
            }
            const result = data.result;
            const profileImage = result.profile?.image || null;
            const bannerImage = result.profile?.banner || null;
            const na = t('p.xstalk.na');
            const verifiedMark = result.verified ? `✅ ${t('p.xstalk.verified')}` : '';
            const caption = `🐦 *${t('p.xstalk.title')}*\n\n` +
                `👤 ${t('p.xstalk.name')}: ${result.name || na} ${verifiedMark}\n` +
                `🆔 ${t('p.xstalk.username')}: @${result.username || na}\n` +
                `📝 ${t('p.xstalk.bio')}: ${result.description || na}\n` +
                `📍 ${t('p.xstalk.location')}: ${result.location || na}\n` +
                `📅 ${t('p.xstalk.joined')}: ${new Date(result.created_at).toDateString()}\n\n` +
                `👥 ${t('p.xstalk.followers')}: ${result.stats?.followers || 0}\n` +
                `➡ ${t('p.xstalk.following')}: ${result.stats?.following || 0}\n` +
                `❤️ ${t('p.xstalk.likes')}: ${result.stats?.likes || 0}\n` +
                `🖼 ${t('p.xstalk.media')}: ${result.stats?.media || 0}\n` +
                `🐦 ${t('p.xstalk.tweets')}: ${result.stats?.tweets || 0}\n` +
                `🔗 ${t('p.xstalk.profileUrl')}: https://twitter.com/${result.username}`;
            if (profileImage) {
                await sock.sendMessage(chatId, { image: { url: profileImage }, caption }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
            if (bannerImage) {
                await sock.sendMessage(chatId, { image: { url: bannerImage }, caption: `📌 ${t('p.xstalk.bannerCaption', { username })}` });
            }
        }
        catch (err) {
            console.error('Twitter plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.xstalk.failed')}` }, { quoted: message });
        }
    }
};
