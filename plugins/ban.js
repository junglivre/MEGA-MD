import {
    findBannedIdentities,
    getBannedUsers,
    normalizeBanTarget,
    saveBannedUsers,
    usesBannedUsersDatabase
} from '../lib/bannedUsers.js';
async function isUserBanned(userId) {
    return findBannedIdentities(await getBannedUsers(), userId).length > 0;
}
export default {
    command: 'ban',
    aliases: ['block', 'banuser'],
    category: 'owner',
    description: 'Ban a user from using the bot without removing them from the group',
    usage: '.ban @user or reply to message',
    strictOwnerOnly: true,
    strictOwnerOnlyNotice: 'p.ban.kickHint',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const t = context.t;
        const _isGroup = context.isGroup;
        let userToBan;
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToBan = normalizeBanTarget(message.message.extendedTextMessage.contextInfo.mentionedJid[0]);
        }
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToBan = normalizeBanTarget(message.message.extendedTextMessage.contextInfo.participant);
        }
        if (!userToBan) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.ban.noTarget')}*\n\nℹ️ ${t('p.ban.kickHint')}`,
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
            const storage = usesBannedUsersDatabase() ? t('p.ban.storageDb') : t('p.ban.storageFs');
            if (findBannedIdentities(bannedUsers, userToBan).length === 0) {
                bannedUsers.push(userToBan);
                await saveBannedUsers(bannedUsers);
                await sock.sendMessage(chatId, {
                    text: `🚫 *${t('p.ban.bannedTitle')}*\n\n@${userToBan.split('@')[0]} ${t('p.ban.bannedDesc')}\n\n` +
                        `*${t('p.ban.storage')}:* ${storage}\n\nℹ️ ${t('p.ban.kickHint')}`,
                    mentions: [userToBan],
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: `⚠️ *${t('p.ban.alreadyBannedTitle')}*\n\n@${userToBan.split('@')[0]} ${t('p.ban.alreadyBannedDesc')}\n\nℹ️ ${t('p.ban.kickHint')}`,
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
