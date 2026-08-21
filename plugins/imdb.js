export default {
    command: 'imdb',
    aliases: ['movie', 'film'],
    category: 'info',
    description: 'Get detailed information about a movie or series from IMDB',
    usage: '.imdb <movie/series title>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const text = args.join(' ').trim();
        if (!text) {
            await sock.sendMessage(chatId, {
                text: t('p.imdb.usage'),
                quoted: message
            });
            return;
        }
        try {
            const res = await fetch(`https://api.popcat.xyz/imdb?q=${encodeURIComponent(text)}`);
            if (!res.ok)
                throw new Error(`API request failed with status ${res.status}`);
            const json = await res.json();
            const ratings = (json.ratings || [])
                .map((r) => `⭐ *${r.source}:* ${r.value}`)
                .join('\n') || t('p.imdb.noRatings');
            const movieInfo = t('p.imdb.info', {
                title: json.title || 'N/A',
                year: json.year || 'N/A',
                genres: json.genres || 'N/A',
                type: json.type || 'N/A',
                plot: json.plot || 'N/A',
                rating: json.rating || 'N/A',
                votes: json.votes || 'N/A',
                awards: json.awards || 'N/A',
                director: json.director || 'N/A',
                writer: json.writer || 'N/A',
                actors: json.actors || 'N/A',
                runtime: json.runtime || 'N/A',
                released: json.released || 'N/A',
                country: json.country || 'N/A',
                languages: json.languages || 'N/A',
                boxoffice: json.boxoffice || 'N/A',
                dvd: json.dvd || 'N/A',
                production: json.production || 'N/A',
                website: json.website || 'N/A',
                ratings
            }).trim();
            if (json.poster) {
                await sock.sendMessage(chatId, {
                    image: { url: json.poster },
                    caption: movieInfo,
                    quoted: message
                });
            }
            else {
                await sock.sendMessage(chatId, { text: movieInfo, quoted: message });
            }
        }
        catch (error) {
            console.error('IMDB Command Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.imdb.failed')}`,
                quoted: message
            });
        }
    }
};
