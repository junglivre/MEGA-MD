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
export default {
    command: 'unban',
    aliases: ['pardon'],
    category: 'admin',
    description: 'Unban a user from using the bot',
    usage: '.unban [@user] or reply to message',
    ownerOnly: false,
    async handler(sock, message, args, context) {
        const { chatId, isGroup, channelInfo, senderIsOwnerOrSudo, isSenderAdmin, isBotAdmin, t } = context;
        if (isGroup) {
            if (!isBotAdmin) {
                await sock.sendMessage(chatId, {
                    text: t('p.unban.needBotAdmin'),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            if (!isSenderAdmin && !message.key.fromMe && !senderIsOwnerOrSudo) {
                await sock.sendMessage(chatId, {
                    text: t('p.unban.groupAdminOnly'),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
        }
        else {
            if (!message.key.fromMe && !senderIsOwnerOrSudo) {
                await sock.sendMessage(chatId, {
                    text: t('p.unban.ownerOnlyPrivate'),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
        }
        let userToUnban;
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToUnban = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToUnban = message.message.extendedTextMessage.contextInfo.participant;
        }
        if (!userToUnban) {
            await sock.sendMessage(chatId, {
                text: t('p.unban.noTarget'),
                ...channelInfo
            }, { quoted: message });
            return;
        }
        try {
            const bannedUsers = await getBannedUsers();
            const index = bannedUsers.indexOf(userToUnban);
            if (index > -1) {
                bannedUsers.splice(index, 1);
                await saveBannedUsers(bannedUsers);
                await sock.sendMessage(chatId, {
                    text: t('p.unban.unbanned', { user: userToUnban.split('@')[0], storage: HAS_DB ? t('p.unban.storageDb') : t('p.unban.storageFile') }),
                    mentions: [userToUnban],
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: t('p.unban.notBanned', { user: userToUnban.split('@')[0] }),
                    mentions: [userToUnban],
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Error in unban command:', error);
            await sock.sendMessage(chatId, {
                text: t('p.unban.failed'),
                ...channelInfo
            }, { quoted: message });
        }
    }
};
