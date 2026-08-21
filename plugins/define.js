import axios from 'axios';
export default {
    command: 'define',
    aliases: ['dict', 'urban'],
    category: 'search',
    description: 'Search a word on Dictionary',
    usage: '.define <word>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const query = args?.join(' ')?.trim();
        if (!query) {
            return await sock.sendMessage(chatId, { text: `*${t('p.define.noQuery')}*\n${t('p.define.example')}: .define hello` }, { quoted: message });
        }
        try {
            const url = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(query)}`;
            const { data: json } = await axios.get(url);
            if (!json?.list || json.list.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.define.notFound')}` }, { quoted: message });
            }
            const firstEntry = json.list[0];
            const definition = firstEntry.definition || t('p.define.noDefinition');
            const example = firstEntry.example ? `*${t('p.define.example')}:* ${firstEntry.example}` : '';
            const text = `🔍 *${t('p.define.title')}*\n\n*${t('p.define.wordLabel')}:* ${query}\n*${t('p.define.definitionLabel')}:* ${definition}\n${example}`;
            await sock.sendMessage(chatId, { text }, { quoted: message });
        }
        catch (error) {
            console.error('Urban plugin error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.define.fetchFailed')}`, }, { quoted: message });
        }
    }
};
