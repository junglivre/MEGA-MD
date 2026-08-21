import axios from 'axios';
export default {
    command: 'news',
    aliases: ['headlines', 'latestnews'],
    category: 'info',
    description: 'Get the latest top 5 news headlines from the US',
    usage: '.news',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const apiKey = 'dcd720a6f1914e2d9dba9790c188c08c';
            const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
            if (!response.data || !response.data.articles)
                throw new Error('Invalid API response');
            const articles = response.data.articles.slice(0, 5);
            if (articles.length === 0) {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.news.noNews')}`,
                    quoted: message
                });
                return;
            }
            let newsMessage = `📰 *${t('p.news.title')}*:\n\n`;
            articles.forEach((article, index) => {
                newsMessage += `${index + 1}. *${article.title}*\n${article.description || t('p.news.noDescription')}\n\n`;
            });
            await sock.sendMessage(chatId, {
                text: newsMessage.trim(),
                quoted: message
            });
        }
        catch (error) {
            console.error('News Command Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.news.fetchError')}`,
                quoted: message
            });
        }
    }
};
