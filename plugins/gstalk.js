import axios from 'axios';
export default {
    command: 'github',
    aliases: ['ghprofile', 'gh'],
    category: 'stalk',
    description: 'Lookup GitHub user profile',
    usage: '.github <username>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: t('p.github.missingUsername')
            }, { quoted: message });
        }
        const username = args[0];
        try {
            const apiUrl = `https://discardapi.onrender.com/api/stalk/github?apikey=guru&url=${username}`;
            const { data } = await axios.get(apiUrl, {
                timeout: 45000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!data?.result) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.github.notFound')}` }, { quoted: message });
            }
            const result = data.result;
            const caption = t('p.github.profile', {
                name: result.nickname || 'N/A',
                username: result.username || 'N/A',
                company: result.company || 'N/A',
                location: result.location || 'N/A',
                bio: result.bio || 'N/A',
                repos: result.public_repo || 0,
                gists: result.public_gists || 0,
                followers: result.followers || 0,
                following: result.following || 0,
                url: result.url || 'N/A',
                createdAt: new Date(result.created_at).toDateString(),
                updatedAt: new Date(result.updated_at).toDateString()
            });
            await sock.sendMessage(chatId, { image: { url: result.profile_pic }, caption }, { quoted: message });
        }
        catch (err) {
            console.error('GitHub plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.github.fetchFailed')}` }, { quoted: message });
        }
    }
};
