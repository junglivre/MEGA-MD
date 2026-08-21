export default {
    command: 'tinyurl',
    aliases: ['shorten', 'tiny'],
    category: 'tools',
    description: 'Shorten a URL using TinyURL',
    usage: '.tinyurl <url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const query = args?.join(' ')?.trim();
        if (!query) {
            return await sock.sendMessage(chatId, { text: t('p.tinyurl.usage') }, { quoted: message });
        }
        try {
            const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(query)}`);
            const shortUrl = await response.text();
            if (!shortUrl) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.tinyurl.generateFailed')}` }, { quoted: message });
            }
            const output = `✨ *${t('p.tinyurl.resultTitle')}*\n\n` +
                `🔗 *${t('p.tinyurl.originalLinkLabel')}:*\n${query}\n\n` +
                `✂️ *${t('p.tinyurl.shortenedUrlLabel')}:*\n${shortUrl}`;
            await sock.sendMessage(chatId, { text: output }, { quoted: message });
        }
        catch (err) {
            console.error('TinyURL plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.tinyurl.failed')}` }, { quoted: message });
        }
    }
};
