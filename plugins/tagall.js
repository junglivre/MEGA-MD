export default {
    command: 'tagall',
    aliases: ['everyone', 'all'],
    category: 'admin',
    description: 'Tag all group members with their usernames',
    usage: '.tagall',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;
            if (!participants || participants.length === 0) {
                await sock.sendMessage(chatId, {
                    text: t('p.tagall.noParticipants'),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            let messageText = `🔊 *${t('p.tagall.greeting')}:*\n\n`;
            participants.forEach((participant) => {
                messageText += `@${participant.id.split('@')[0]}\n`;
            });
            await sock.sendMessage(chatId, {
                text: messageText,
                mentions: participants.map((p) => p.id),
                ...channelInfo
            });
        }
        catch (error) {
            console.error('Error in tagall command:', error);
            await sock.sendMessage(chatId, {
                text: t('p.tagall.failed'),
                ...channelInfo
            }, { quoted: message });
        }
    }
};
