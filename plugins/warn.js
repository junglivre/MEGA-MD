import fs from 'fs';
import path from 'path';
import store from '../lib/lightweight_store.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');
function initializeWarningsFile() {
    if (!HAS_DB) {
        if (!fs.existsSync(databaseDir)) {
            fs.mkdirSync(databaseDir, { recursive: true });
        }
        if (!fs.existsSync(warningsPath)) {
            fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
        }
    }
}
async function getWarnings() {
    if (HAS_DB) {
        const warnings = await store.getSetting('global', 'warnings');
        return warnings || {};
    }
    else {
        try {
            return JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
        }
        catch (error) {
            return {};
        }
    }
}
async function saveWarnings(warnings) {
    if (HAS_DB) {
        await store.saveSetting('global', 'warnings', warnings);
    }
    else {
        fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
    }
}
export default {
    command: 'warn',
    aliases: ['warning'],
    category: 'admin',
    description: 'Warn a user (auto-kick after 3 warnings)',
    usage: '.warn [@user] or reply to message',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, t } = context;
        try {
            initializeWarningsFile();
            let userToWarn;
            const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentionedJids && mentionedJids.length > 0) {
                userToWarn = mentionedJids[0];
            }
            else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                userToWarn = message.message.extendedTextMessage.contextInfo.participant;
            }
            if (!userToWarn) {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.warn.noTarget')}`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const warnings = await getWarnings();
                if (!warnings[chatId])
                    warnings[chatId] = {};
                if (!warnings[chatId][userToWarn])
                    warnings[chatId][userToWarn] = 0;
                warnings[chatId][userToWarn]++;
                await saveWarnings(warnings);
                const storage = HAS_DB ? t('p.warn.storageDb') : t('p.warn.storageFile');
                const warningMessage = `*『 ${t('p.warn.alertTitle')} 』*\n\n` +
                    `👤 *${t('p.warn.warnedUser')}:* @${userToWarn.split('@')[0]}\n` +
                    `⚠️ *${t('p.warn.warningCount')}:* ${warnings[chatId][userToWarn]}/3\n` +
                    `👑 *${t('p.warn.warnedBy')}:* @${senderId.split('@')[0]}\n` +
                    `🗄️ *${t('p.warn.storage')}:* ${storage}\n\n` +
                    `📅 *${t('p.warn.date')}:* ${new Date().toLocaleString()}`;
                await sock.sendMessage(chatId, {
                    text: warningMessage,
                    mentions: [userToWarn, senderId],
                    ...channelInfo
                });
                if (warnings[chatId][userToWarn] >= 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sock.groupParticipantsUpdate(chatId, [userToWarn], "remove");
                    delete warnings[chatId][userToWarn];
                    await saveWarnings(warnings);
                    const kickMessage = `*『 ${t('p.warn.autoKickTitle')} 』*\n\n` +
                        `@${userToWarn.split('@')[0]} ${t('p.warn.autoKickMessage')} ⚠️`;
                    await sock.sendMessage(chatId, {
                        text: kickMessage,
                        mentions: [userToWarn],
                        ...channelInfo
                    });
                }
            }
            catch (error) {
                console.error('Error in warn command:', error);
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.warn.failedGeneric')}`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Error in warn command:', error);
            if (error.data === 429) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                try {
                    await sock.sendMessage(chatId, {
                        text: `❌ ${t('p.warn.rateLimited')}`,
                        ...channelInfo
                    }, { quoted: message });
                }
                catch (retryError) {
                    console.error('Error sending retry message:', retryError);
                }
            }
            else {
                try {
                    await sock.sendMessage(chatId, {
                        text: `❌ ${t('p.warn.failedPermissions')}`,
                        ...channelInfo
                    }, { quoted: message });
                }
                catch (sendError) {
                    console.error('Error sending error message:', sendError);
                }
            }
        }
    }
};
