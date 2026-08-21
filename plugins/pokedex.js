export default {
    command: 'pokedex',
    aliases: ['pokemon', 'poke'],
    category: 'info',
    description: 'Get information about a Pokémon',
    usage: '.pokedex <pokemon name>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const text = args.join(' ').trim();
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: t('p.pokedex.noQuery')
            }, { quoted: message });
        }
        try {
            const url = `https://some-random-api.com/pokemon/pokedex?pokemon=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const json = await res.json();
            if (!res.ok)
                throw json.error || 'Unknown error';
            const messageText = t('p.pokedex.info', {
                name: json.name,
                id: json.id,
                type: Array.isArray(json.type) ? json.type.join(', ') : json.type,
                abilities: Array.isArray(json.abilities) ? json.abilities.join(', ') : json.abilities,
                species: Array.isArray(json.species) ? json.species.join(', ') : json.species,
                height: json.height,
                weight: json.weight,
                experience: json.base_experience,
                description: json.description
            });
            await sock.sendMessage(chatId, { text: messageText, quoted: message });
        }
        catch (error) {
            console.error('Pokedex Command Error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.pokedex.error', { error })}` }, { quoted: message });
        }
    }
};
