import { join } from 'path';
import { unlinkSync, readdirSync } from 'fs';
export default {
    command: 'delplugin',
    aliases: ['deleteplugin', 'rmplugin'],
    category: 'owner',
    description: 'Delete a plugin by name (owner only)',
    usage: '.delplugin <plugin_name>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            if (!args || !args[0]) {
                return await sock.sendMessage(chatId, {
                    text: `*🌟${t('p.delplugin.exampleUsage')}*\n.delplugin main-menu`
                }, { quoted: message });
            }
            const pluginDir = join(process.cwd(), 'plugins');
            const pluginFiles = readdirSync(pluginDir).filter(f => f.endsWith('.js'));
            const pluginNames = pluginFiles.map(f => f.replace('.js', ''));
            if (!pluginNames.includes(args[0])) {
                return await sock.sendMessage(chatId, {
                    text: `🗃️ ${t('p.delplugin.notExist')}\n\n${t('p.delplugin.availablePlugins')}\n${pluginNames.join('\n')}`
                }, { quoted: message });
            }
            const filePath = join(pluginDir, `${args[0] }.js`);
            unlinkSync(filePath);
            await sock.sendMessage(chatId, { text: `⚠️ ${t('p.delplugin.deleted', { name: args[0] })}` }, { quoted: message });
        }
        catch (err) {
            console.error('rmplugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.delplugin.failed', { error: err.message })}`
            }, { quoted: message });
        }
    }
};
