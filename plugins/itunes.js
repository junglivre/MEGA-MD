export default {
    command: 'itunes',
    aliases: ['song', 'music', 'track'],
    category: 'info',
    description: 'Get detailed information about a song from iTunes',
    usage: '.itunes <song name>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const text = args.join(' ').trim();
        if (!text) {
            await sock.sendMessage(chatId, {
                text: `*${t('p.itunes.noQuery')}*\nExample: \`.itunes Blinding Lights\``,
                quoted: message
            });
            return;
        }
        try {
            const url = `https://api.popcat.xyz/itunes?q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok)
                throw new Error(`API request failed with status ${res.status}`);
            const json = await res.json();
            const na = t('p.itunes.notAvailable');
            const songInfo = `
🎵 *${json.name || na}*
👤 *${t('p.itunes.artist')}:* ${json.artist || na}
💿 *${t('p.itunes.album')}:* ${json.album || na}
📅 *${t('p.itunes.releaseDate')}:* ${json.release_date || na}
💰 *${t('p.itunes.price')}:* ${json.price || na}
⏱️ *${t('p.itunes.length')}:* ${json.length || na}
🎼 *${t('p.itunes.genre')}:* ${json.genre || na}
🔗 *URL:* ${json.url || na}
      `.trim();
            if (json.thumbnail) {
                await sock.sendMessage(chatId, {
                    image: { url: json.thumbnail },
                    caption: songInfo,
                    quoted: message
                });
            }
            else {
                await sock.sendMessage(chatId, { text: songInfo, quoted: message });
            }
        }
        catch (error) {
            console.error('iTunes Command Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.itunes.error')}`,
                quoted: message
            });
        }
    }
};
