import axios from 'axios';
// Utility to decode Unicode escapes
function decodeUnicode(str) {
    if (!str)
        return 'N/A';
    return str.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace("\\u", ""), 16)));
}
export default {
    command: 'genshin',
    aliases: ['gh', 'uid'],
    category: 'stalk',
    description: 'Stalk Genshin Impact UID',
    usage: '.genshin <UID>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        if (!args.length) {
            return await sock.sendMessage(chatId, {
                text: t('p.genshin.usage')
            }, { quoted: message });
        }
        const uid = args[0];
        try {
            const { data } = await axios.get(`https://discardapi.dpdns.org/api/stalk/genshin`, {
                params: { apikey: 'guru', text: uid }
            });
            if (!data?.result) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.genshin.notFound')}` }, { quoted: message });
            }
            const result = data.result;
            const na = t('p.genshin.na');
            const caption = `🎮 ${t('p.genshin.info', {
                nickname: result.nickname || na,
                uid: result.uid || na,
                achievements: result.achivement || na,
                level: result.level || na,
                worldLevel: result.world_level || na,
                spiralAbyss: decodeUnicode(result.spiral_abyss),
                cardId: result.card_id || na
            })}`;
            await sock.sendMessage(chatId, { image: { url: result.image }, caption }, { quoted: message });
        }
        catch (err) {
            console.error('Genshin plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.genshin.failed')}` }, { quoted: message });
        }
    }
};
