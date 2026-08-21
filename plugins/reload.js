export default {
    command: 'reload',
    aliases: ['refresh', 'reloadplugins'],
    category: 'owner',
    description: 'Reload all plugins',
    usage: '.reload',
    ownerOnly: true,
    async handler(sock, message, _args, context) {
        const chatId = message.key.remoteJid;
        const { t } = context;
        const commandHandler = (await import('../lib/commandHandler.js')).default;
        try {
            const start = Date.now();
            commandHandler.reloadCommands();
            const end = Date.now();
            await sock.sendMessage(chatId, {
                text: `✅ ${t('p.reload.success', { count: commandHandler.commands.size, ms: end - start })}`
            });
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.reload.failed', { error: error.message })}`
            });
        }
    }
};
