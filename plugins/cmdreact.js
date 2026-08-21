import { setCommandReactState } from '../lib/reactions.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
export default {
    command: 'cmdreact',
    aliases: ['creact', 'commandreact'],
    category: 'owner',
    description: 'Toggle command reactions',
    usage: '.creact on/off',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const storage = HAS_DB ? t('p.cmdreact.database') : t('p.cmdreact.fileSystem');
        if (!args[0] || !['on', 'off'].includes(args[0])) {
            await sock.sendMessage(chatId, {
                text: `*${t('p.cmdreact.usageTitle')}*\n.creact on/off\n\n${t('p.cmdreact.storage', { storage })}`,
                ...channelInfo
            }, { quoted: message });
            return;
        }
        if (args[0] === 'on') {
            await setCommandReactState(true);
            await sock.sendMessage(chatId, {
                text: `*✅ ${t('p.cmdreact.enabled')}*\n\n${t('p.cmdreact.storage', { storage })}`,
                ...channelInfo
            }, { quoted: message });
        }
        else if (args[0] === 'off') {
            await setCommandReactState(false);
            await sock.sendMessage(chatId, {
                text: `*❌ ${t('p.cmdreact.disabled')}*\n\n${t('p.cmdreact.storage', { storage })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
