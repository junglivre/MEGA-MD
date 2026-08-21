import axios from 'axios';
export default {
    command: 'joke',
    aliases: ['jokes', 'funny'],
    category: 'fun',
    description: 'Get a random dad joke',
    usage: '.joke',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const response = await axios.get('https://icanhazdadjoke.com/', {
                headers: { Accept: 'application/json' }
            });
            const joke = response.data.joke;
            await sock.sendMessage(chatId, { text: `😂 ${joke}` }, { quoted: message });
        }
        catch (error) {
            console.error('Error fetching dad joke:', error);
            await sock.sendMessage(chatId, {
                text: t('p.joke.failed'),
                quoted: message
            });
        }
    }
};
