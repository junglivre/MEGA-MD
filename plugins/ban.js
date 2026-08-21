import fs from 'fs';
import store from '../lib/lightweight_store.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const bannedFilePath = './data/banned.json';
async function getBannedUsers() {
    if (HAS_DB) {
        const banned = await store.getSetting('global', 'banned');
        return banned || [];
    }
    else {
        if (fs.existsSync(bannedFilePath)) {
            return JSON.parse(fs.readFileSync(bannedFilePath, "utf-8"));
        }
        return [];
    }
}
async function saveBannedUsers(bannedUsers) {
    if (HAS_DB) {
        await store.saveSetting('global', 'banned', bannedUsers);
    }
    else {
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }
        fs.writeFileSync(bannedFilePath, JSON.stringify(bannedUsers, null, 2));
    }
}
async function isUserBanned(userId) {
    const bannedUsers = await getBannedUsers();
    return bannedUsers.includes(userId);
}
export default {
    command: 'ban',
    aliases: ['block', 'banuser'],
    category: 'admin',
    description: 'Ban a user from using the bot',
    usage: '.ban @user or reply to message',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const t = context.t;
        const _isGroup = context.isGroup;
        let userToBan;
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToBan = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToBan = message.message.extendedTextMessage.contextInfo.participant;
        }
        if (!userToBan) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.ban.noTarget')}*`,
                ...channelInfo
            }, { quoted: message });
            return;
        }
        try {
            const botId = `${sock.user.id.split(':')[0] }@s.whatsapp.net`;
            if (userToBan === botId || userToBan === botId.replace('@s.whatsapp.net', '@lid')) {
                await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.ban.cannotBanBot')}*`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }
        }
        catch (e) { }
        try {
            const bannedUsers = await getBannedUsers();
            const storage = HAS_DB ? t('p.ban.storageDb') : t('p.ban.storageFs');
            if (!bannedUsers.includes(userToBan)) {
                bannedUsers.push(userToBan);
                await saveBannedUsers(bannedUsers);
                await sock.sendMessage(chatId, {
                    text: `🚫 *${t('p.ban.bannedTitle')}*\n\n@${userToBan.split('@')[0]} ${t('p.ban.bannedDesc')}\n\n` +
                        `*${t('p.ban.storage')}:* ${storage}`,
                    mentions: [userToBan],
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: `⚠️ *${t('p.ban.alreadyBannedTitle')}*\n\n@${userToBan.split('@')[0]} ${t('p.ban.alreadyBannedDesc')}`,
                    mentions: [userToBan],
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Error in ban command:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.ban.genericError')}*`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
export { getBannedUsers };
export { saveBannedUsers };
export { isUserBanned };
