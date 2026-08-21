export default {
    command: 'lyrics',
    aliases: ['lyric', 'songlyrics'],
    category: 'music',
    description: 'Get lyrics of a song along with artist and image',
    usage: '.lyrics <song name>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const songTitle = args.join(' ').trim();
        if (!songTitle) {
            await sock.sendMessage(chatId, {
                text: `*${t('p.lyrics.noTitle')}*\nUsage: \`.lyrics <song name>\``,
                quoted: message
            });
            return;
        }
        try {
            const apiUrl = `https://discardapi.dpdns.org/api/music/lyrics?apikey=qasim&song=${encodeURIComponent(songTitle)}`;
            const res = await fetch(apiUrl);
            if (!res.ok)
                throw new Error(`API request failed with status ${res.status}`);
            const data = await res.json();
            const messageData = data?.result?.message;
            if (!messageData?.lyrics) {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.lyrics.notFound', { songTitle })}`,
                    quoted: message
                });
                return;
            }
            const { artist, lyrics, image, title, url } = messageData;
            const maxChars = 4096;
            const lyricsOutput = lyrics.length > maxChars ? `${lyrics.slice(0, maxChars - 3) }...` : lyrics;
            const caption = `
🎵 *${title}*
👤 *${t('p.lyrics.artistLabel')}:* ${artist}
🔗 *${t('p.lyrics.urlLabel')}:* ${url}

📝 *${t('p.lyrics.lyricsLabel')}:*
${lyricsOutput}
      `.trim();
            if (image) {
                await sock.sendMessage(chatId, {
                    image: { url: image },
                    caption,
                    quoted: message
                });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: caption,
                    quoted: message
                });
            }
        }
        catch (error) {
            console.error('Lyrics Command Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.lyrics.fetchError', { songTitle })}`,
                quoted: message
            });
        }
    }
};
