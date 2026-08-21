export default {
    command: 'owner',
    aliases: ['creator'],
    category: 'info',
    description: 'Get the contact of the bot owner',
    usage: '.owner',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const config = context.config;
        const { t } = context;
        try {
            const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${config.botOwner}
TEL;waid=${config.ownerNumber}:${config.ownerNumber}
END:VCARD
      `.trim();
            await sock.sendMessage(chatId, {
                contacts: { displayName: config.botOwner, contacts: [{ vcard }] },
            }, { quoted: message });
        }
        catch (error) {
            console.error('Owner Command Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.owner.fetchFailed')}`
            }, { quoted: message });
        }
    }
};
