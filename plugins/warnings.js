import fs from 'fs';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const warningsFilePath = dataFile('warnings.json');
async function loadWarnings() {
    if (HAS_DB) {
        const warnings = await store.getSetting('global', 'warnings');
        return warnings || {};
    }
    else {
        if (!fs.existsSync(warningsFilePath)) {
            fs.writeFileSync(warningsFilePath, JSON.stringify({}), 'utf8');
        }
        const data = fs.readFileSync(warningsFilePath, 'utf8');
        return JSON.parse(data);
    }
}
export default {
    command: 'warnings',
    aliases: ['checkwarn', 'warncount'],
    category: 'group',
    description: 'Check warning count of a user',
    usage: '.warnings [@user]',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const mentionedJidList = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentionedJidList.length === 0) {
            await sock.sendMessage(chatId, {
                text: t('p.warnings.noMention'),
                ...channelInfo
            }, { quoted: message });
            return;
        }
        const userToCheck = mentionedJidList[0];
        const warnings = await loadWarnings();
        const warningCount = (warnings[chatId] && warnings[chatId][userToCheck]) || 0;
        const storage = HAS_DB ? t('p.warnings.storageDb') : t('p.warnings.storageFile');
        await sock.sendMessage(chatId, {
            text: t('p.warnings.count', { user: userToCheck.split('@')[0], count: warningCount, storage }),
            mentions: [userToCheck],
            ...channelInfo
        }, { quoted: message });
    }
};
