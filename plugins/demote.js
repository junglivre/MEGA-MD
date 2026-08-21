async function handleDemotionEvent(sock, groupId, participants, author) {
    try {
        if (!Array.isArray(participants) || participants.length === 0) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        const demotedUsernames = await Promise.all(participants.map(async (jid) => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            return `@${jidString.split('@')[0]}`;
        }));
        let demotedBy;
        const mentionList = participants.map(jid => {
            return typeof jid === 'string' ? jid : (jid.id || jid.toString());
        });
        if (author && author.length > 0) {
            const authorJid = typeof author === 'string' ? author : (author.id || author.toString());
            demotedBy = `@${authorJid.split('@')[0]}`;
            mentionList.push(authorJid);
        }
        else {
            demotedBy = 'System';
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        const demotionMessage = `*『 GROUP DEMOTION 』*\n\n` +
            `👤 *Demoted User${participants.length > 1 ? 's' : ''}:*\n` +
            `${demotedUsernames.map(name => `• ${name}`).join('\n')}\n\n` +
            `👑 *Demoted By:* ${demotedBy}\n\n` +
            `📅 *Date:* ${new Date().toLocaleString()}`;
        await sock.sendMessage(groupId, {
            text: demotionMessage,
            mentions: mentionList
        });
    }
    catch (error) {
        console.error('Error handling demotion event:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}
export default {
    command: 'demote',
    aliases: ['dmt', 'removeadmin'],
    category: 'admin',
    description: 'Demote user(s) from admin to member',
    usage: '.demote @user or reply to message',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const isBotAdmin = context.isBotAdmin;
        const { t } = context;
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.demote.needAdmin')}*`
            }, { quoted: message });
            return;
        }
        let userToDemote = [];
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJids && mentionedJids.length > 0) {
            userToDemote = mentionedJids;
        }
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToDemote = [message.message.extendedTextMessage.contextInfo.participant];
        }
        if (userToDemote.length === 0) {
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.demote.noTarget')}*\n\n${t('p.demote.usage')}`
            }, { quoted: message });
            return;
        }
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.groupParticipantsUpdate(chatId, userToDemote, "demote");
            const usernames = await Promise.all(userToDemote.map(async (jid) => {
                return `@${jid.split('@')[0]}`;
            }));
            await new Promise(resolve => setTimeout(resolve, 1000));
            const demotedUserLabel = userToDemote.length > 1 ? t('p.demote.demotedUsers') : t('p.demote.demotedUser');
            const demotionMessage = `*『 ${t('p.demote.title')} 』*\n\n` +
                `👤 *${demotedUserLabel}:*\n` +
                `${usernames.map(name => `• ${name}`).join('\n')}\n\n` +
                `👑 *${t('p.demote.demotedBy')}:* @${message.key.participant ? message.key.participant.split('@')[0] : message.key.remoteJid.split('@')[0]}\n\n` +
                `📅 *${t('p.demote.date')}:* ${new Date().toLocaleString()}`;
            await sock.sendMessage(chatId, {
                text: demotionMessage,
                mentions: [...userToDemote, message.key.participant || message.key.remoteJid]
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error in demote command:', error);
            if (error.data === 429) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                try {
                    await sock.sendMessage(chatId, {
                        text: `❌ *${t('p.demote.rateLimitTitle')}*\n\n${t('p.demote.rateLimitBody')}`
                    }, { quoted: message });
                }
                catch (retryError) {
                    console.error('Error sending retry message:', retryError);
                }
            }
            else {
                try {
                    await sock.sendMessage(chatId, {
                        text: `❌ *${t('p.demote.failedTitle')}*\n\n${t('p.demote.failedBody')}`
                    }, { quoted: message });
                }
                catch (sendError) {
                    console.error('Error sending error message:', sendError);
                }
            }
        }
    },
    handleDemotionEvent
};
