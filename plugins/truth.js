export default {
    command: 'truth',
    aliases: ['truthdare'],
    category: 'games',
    description: 'Get a random truth from the Shizo API.',
    usage: '.truth',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const shizokeys = 'shizo';
            const res = await fetch(`https://shizoapi.onrender.com/api/texts/truth?apikey=${shizokeys}`);
            if (!res.ok) {
                throw await res.text();
            }
            const json = await res.json();
            const truthMessage = json.result;
            await sock.sendMessage(chatId, {
                text: truthMessage
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error in truth command:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.truth.failed')}`
            }, { quoted: message });
        }
    }
};
