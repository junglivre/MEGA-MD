import {
    findBannedIdentities,
    getBannedUsers,
    normalizeBanTarget,
    saveBannedUsers,
    usesBannedUsersDatabase
} from '../lib/bannedUsers.js';

export function extractUnbanTarget(message, args) {
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const mentioned = contextInfo?.mentionedJid?.[0];
    if (mentioned)
        return normalizeBanTarget(mentioned);
    const typed = normalizeBanTarget(args?.[0]);
    if (typed)
        return typed;
    return normalizeBanTarget(contextInfo?.participant);
}
export default {
    command: 'unban',
    aliases: ['pardon'],
    category: 'owner',
    description: 'Unban a user from using the bot',
    usage: '.unban <LID|@user> or reply to message',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const userToUnban = extractUnbanTarget(message, args);
        if (!userToUnban) {
            await sock.sendMessage(chatId, {
                text: t('p.unban.noTarget'),
                ...channelInfo
            }, { quoted: message });
            return;
        }
        try {
            const bannedUsers = await getBannedUsers();
            const matchedUsers = findBannedIdentities(bannedUsers, userToUnban);
            if (matchedUsers.length > 0) {
                const matchedSet = new Set(matchedUsers);
                await saveBannedUsers(bannedUsers.filter(user => !matchedSet.has(user)));
                const removedUser = matchedUsers[0];
                await sock.sendMessage(chatId, {
                    text: t('p.unban.unbanned', { user: removedUser.split('@')[0], storage: usesBannedUsersDatabase() ? t('p.unban.storageDb') : t('p.unban.storageFile') }),
                    mentions: removedUser.includes('@') ? [removedUser] : [],
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: t('p.unban.notBanned', { user: userToUnban.split('@')[0] }),
                    mentions: userToUnban.includes('@') ? [userToUnban] : [],
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
