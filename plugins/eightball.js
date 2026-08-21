export default {
    command: '8ball',
    aliases: ['eightball', 'magic8ball'],
    category: 'fun',
    description: 'Ask the magic 8-ball a question',
    usage: '.8ball Will I be rich?',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const question = args.join(' ');
            if (!question) {
                await sock.sendMessage(chatId, {
                    text: `🎱 ${t('p.8ball.noQuestion')}`
                }, { quoted: message });
                return;
            }
            const eightBallResponses = [
                t('p.8ball.r1'),
                t('p.8ball.r2'),
                t('p.8ball.r3'),
                t('p.8ball.r4'),
                t('p.8ball.r5'),
                t('p.8ball.r6'),
                t('p.8ball.r7'),
                t('p.8ball.r8')
            ];
            const randomResponse = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];
            await sock.sendMessage(chatId, {
                text: `🎱 *${t('p.8ball.questionLabel')}:* ${question}\n\n*${t('p.8ball.answerLabel')}:* ${randomResponse}`
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error in 8ball command:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.8ball.error')}`
            }, { quoted: message });
        }
    }
};
