import CommandHandler from '../lib/commandHandler.js';
export default {
    command: 'manage',
    aliases: ['ctrl', 'control'],
    category: 'owner',
    description: 'Manage bot commands and aliases',
    usage: '.manage [toggle/alias] [command_name] [new_alias]',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const action = args[0]?.toLowerCase();
        const targetCmd = args[1]?.toLowerCase();
        try {
            if (action === 'toggle') {
                if (!CommandHandler.commands.has(targetCmd)) {
                    return await sock.sendMessage(chatId, { text: `❌ ${t('p.manage.cmdNotFound', { targetCmd })}` }, { quoted: message });
                }
                const state = CommandHandler.toggleCommand(targetCmd);
                return await sock.sendMessage(chatId, { text: `✅ ${t('p.manage.toggled', { targetCmd, state })}` }, { quoted: message });
            }
            if (action === 'alias') {
                const newAlias = args[2]?.toLowerCase();
                if (!targetCmd || !newAlias) {
                    return await sock.sendMessage(chatId, { text: `❌ ${t('p.manage.aliasUsage')}` }, { quoted: message });
                }
                if (!CommandHandler.commands.has(targetCmd)) {
                    return await sock.sendMessage(chatId, { text: `❌ ${t('p.manage.sourceNotFound', { targetCmd })}` }, { quoted: message });
                }
                CommandHandler.aliases.set(newAlias, targetCmd);
                return await sock.sendMessage(chatId, { text: `✅ ${t('p.manage.aliasAdded', { newAlias, targetCmd })}` }, { quoted: message });
            }
            const helpText = `🛠️ *${t('p.manage.helpTitle')}*\n\n` +
                `*⁠• ${t('p.manage.helpToggleLabel')}* .manage toggle [name]\n` +
                `*• ${t('p.manage.helpAliasLabel')}* .manage alias [name] [new_alias]\n` +
                `*• ${t('p.manage.helpReloadLabel')}* ${t('p.manage.helpReloadText')}`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
        }
        catch (error) {
            console.error('Error in manage plugin:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.manage.actionFailed')}` }, { quoted: message });
        }
    }
};
