import axios from 'axios';
export default {
    command: 'pinstalk',
    aliases: ['pstalk', 'pinprofile'],
    category: 'stalk',
    description: 'Lookup Pinterest user profile',
    usage: '.pinstalk <username>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: t('p.pinstalk.missingUsername')
            }, { quoted: message });
        }
        const username = args[0];
        try {
            const { data } = await axios.get(`https://discardapi.dpdns.org/api/stalk/pinterest`, {
                params: { apikey: 'guru', username }
            });
            if (!data?.result) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.pinstalk.notFound')}` }, { quoted: message });
            }
            const result = data.result;
            const profileImage = result.image?.large || result.image?.original || null;
            const na = t('p.pinstalk.na');
            const caption = `📌 ${t('p.pinstalk.profileInfo', {
                fullName: result.full_name || na,
                username: result.username || na,
                bio: result.bio || na,
                boards: result.stats?.boards || 0,
                followers: result.stats?.followers || 0,
                following: result.stats?.following || 0,
                likes: result.stats?.likes || 0,
                pins: result.stats?.pins || 0,
                saves: result.stats?.saves || 0,
                profileUrl: result.profile_url || na,
                website: result.website || na
            })}`;
            if (profileImage) {
                await sock.sendMessage(chatId, { image: { url: profileImage }, caption }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
        }
        catch (err) {
            console.error('Pinterest plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.pinstalk.fetchFailed')}` }, { quoted: message });
        }
    }
};
