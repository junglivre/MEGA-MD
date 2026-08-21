import axios from 'axios';
export default {
    command: 'joke2',
    aliases: ['funny2', 'jokes2'],
    category: 'fun',
    description: 'Get a random general joke',
    usage: '.joke2',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const res = await axios.get('https://raw.githubusercontent.com/GlobalTechInfo/Database/main/text/random_jokes.txt');
            if (!res.data) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.joke2.failed')}` }, { quoted: message });
            }
            const jokes = res.data.split('\n').filter((line) => line.trim() !== '');
            if (jokes.length === 0) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.joke2.noJokes')}` }, { quoted: message });
            }
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            await sock.sendMessage(chatId, { text: `😂 *${t('p.joke2.title')}*\n\n${randomJoke}` }, { quoted: message });
        }
        catch (err) {
            console.error('Joke plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.joke2.error')}` }, { quoted: message });
        }
    }
};
