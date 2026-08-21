import store from '../lib/lightweight_store.js';
import isOwnerOrSudo from '../lib/isOwner.js';
import isAdmin from '../lib/isAdmin.js';
async function setAntilink(chatId, type, action) {
    try {
        await store.saveSetting(chatId, 'antilink', {
            enabled: true,
            action,
            type
        });
        return true;
    }
    catch (error) {
        console.error('Error setting antilink:', error);
        return false;
    }
}
async function getAntilink(chatId, _type) {
    try {
        const settings = await store.getSetting(chatId, 'antilink');
        return settings || null;
    }
    catch (error) {
        console.error('Error getting antilink:', error);
        return null;
    }
}
async function removeAntilink(chatId, _type) {
    try {
        await store.saveSetting(chatId, 'antilink', {
            enabled: false,
            action: null,
            type: null
        });
        return true;
    }
    catch (error) {
        console.error('Error removing antilink:', error);
        return false;
    }
}
export async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        const config = await getAntilink(chatId, 'on');
        if (!config?.enabled)
            return;
        // Check if sender is owner or sudo
        const isOwnerSudo = await isOwnerOrSudo(senderId, sock, chatId);
        if (isOwnerSudo)
            return;
        // Check if sender is admin
        try {
            const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
            if (isSenderAdmin)
                return;
        }
        catch (e) { }
        const action = config.action || 'delete';
        let shouldAct = false;
        let linkType = '';
        const linkPatterns = {
            whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i,
            whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/i,
            telegram: /t\.me\/[A-Za-z0-9_]+/i,
            allLinks: /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i,
        };
        if (linkPatterns.whatsappGroup.test(userMessage)) {
            shouldAct = true;
            linkType = 'WhatsApp Group';
        }
        else if (linkPatterns.whatsappChannel.test(userMessage)) {
            shouldAct = true;
            linkType = 'WhatsApp Channel';
        }
        else if (linkPatterns.telegram.test(userMessage)) {
            shouldAct = true;
            linkType = 'Telegram';
        }
        else if (linkPatterns.allLinks.test(userMessage)) {
            shouldAct = true;
            linkType = 'Link';
        }
        if (!shouldAct)
            return;
        const messageId = message.key.id;
        const participant = message.key.participant || senderId;
        if (action === 'delete' || action === 'kick') {
            try {
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: messageId,
                        participant
                    }
                });
            }
            catch (error) {
                console.error('Failed to delete message:', error);
            }
        }
        if (action === 'warn' || action === 'delete') {
            await sock.sendMessage(chatId, {
                text: `⚠️ *Antilink Warning*\n\n@${senderId.split('@')[0]}, posting ${linkType} links is not allowed!`,
                mentions: [senderId]
            });
        }
        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 @${senderId.split('@')[0]} has been removed for posting ${linkType} links.`,
                    mentions: [senderId]
                });
            }
            catch (error) {
                console.error('Failed to kick user:', error);
                await sock.sendMessage(chatId, {
                    text: `⚠️ Failed to remove user. Make sure the bot is an admin.`
                });
            }
        }
    }
    catch (error) {
        console.error('Error in link detection:', error);
    }
}
export default {
    command: 'antilink',
    aliases: ['alink', 'linkblock'],
    category: 'admin',
    description: 'Prevent users from sending links in the group',
    usage: '.antilink <on|off|set>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const action = args[0]?.toLowerCase();
        if (!action) {
            const config = await getAntilink(chatId, 'on');
            await sock.sendMessage(chatId, {
                text: `*🔗 ${t('p.antilink.setupTitle')}*\n\n` +
                    `*${t('p.antilink.currentStatus')}:* ${config?.enabled ? `✅ ${t('p.antilink.enabled')}` : `❌ ${t('p.antilink.disabled')}`}\n` +
                    `*${t('p.antilink.currentAction')}:* ${config?.action || t('p.antilink.notSet')}\n\n` +
                    `*${t('p.antilink.commandsLabel')}:*\n` +
                    `• \`.antilink on\` - ${t('p.antilink.enableHint')}\n` +
                    `• \`.antilink off\` - ${t('p.antilink.disableHint')}\n` +
                    `• \`.antilink set delete\` - ${t('p.antilink.setDeleteHint')}\n` +
                    `• \`.antilink set kick\` - ${t('p.antilink.setKickHint')}\n` +
                    `• \`.antilink set warn\` - ${t('p.antilink.setWarnHint')}\n\n` +
                    `*${t('p.antilink.protectedLinks')}:*\n` +
                    `• ${t('p.antilink.waGroups')}\n` +
                    `• ${t('p.antilink.waChannels')}\n` +
                    `• Telegram\n` +
                    `• ${t('p.antilink.otherLinks')}\n\n` +
                    `*${t('p.antilink.noteLabel')}:* ${t('p.antilink.exemptNote')}`
            }, { quoted: message });
            return;
        }
        switch (action) {
            case 'on':
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *${t('p.antilink.alreadyEnabled')}*`
                    }, { quoted: message });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, {
                    text: result ? `✅ *${t('p.antilink.enabledSuccess')}*\n\n${t('p.antilink.defaultActionDelete')}\n\n*${t('p.antilink.exemptLabel')}:* ${t('p.antilink.exemptList')}` : `❌ *${t('p.antilink.enableFailed')}*`
                }, { quoted: message });
                break;
            case 'off':
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.antilink.disabledTitle')}*\n\n${t('p.antilink.usersCanSendFreely')}`
                }, { quoted: message });
                break;
            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `❌ *${t('p.antilink.specifyAction')}*\n\nUsage: \`.antilink set delete | kick | warn\``
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1].toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: `❌ *${t('p.antilink.invalidAction')}*\n\n${t('p.antilink.chooseActions')}`
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                const actionDescriptions = {
                    delete: t('p.antilink.descDelete'),
                    kick: t('p.antilink.descKick'),
                    warn: t('p.antilink.descWarn')
                };
                await sock.sendMessage(chatId, {
                    text: setResult
                        ? `✅ *${t('p.antilink.actionSetTo', { action: setAction })}*\n\n${actionDescriptions[setAction]}\n\n*${t('p.antilink.exemptLabel')}:* ${t('p.antilink.exemptList')}`
                        : `❌ *${t('p.antilink.setActionFailed')}*`
                }, { quoted: message });
                break;
            case 'status':
            case 'get':
                const status = await getAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: `*🔗 ${t('p.antilink.statusTitle')}*\n\n` +
                        `*${t('p.antilink.statusLabel')}:* ${status?.enabled ? `✅ ${t('p.antilink.enabled')}` : `❌ ${t('p.antilink.disabled')}`}\n` +
                        `*${t('p.antilink.actionLabel')}:* ${status?.action || t('p.antilink.notSet')}\n\n` +
                        `*${t('p.antilink.whatHappens')}:*\n` +
                        `${status?.action === 'delete' ? `• ${t('p.antilink.msgDeleted')}\n• ${t('p.antilink.userWarned')}` : ''}` +
                        `${status?.action === 'kick' ? `• ${t('p.antilink.msgDeleted')}\n• ${t('p.antilink.userRemoved')}` : ''}` +
                        `${status?.action === 'warn' ? `• ${t('p.antilink.userWarned')}\n• ${t('p.antilink.msgStays')}` : ''}\n\n` +
                        `*${t('p.antilink.exemptLabel')}:* ${t('p.antilink.exemptList')}`
                }, { quoted: message });
                break;
            default:
                await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.antilink.invalidCommand')}*\n\n${t('p.antilink.useToSeeOptions')}`
                }, { quoted: message });
        }
    },
    handleLinkDetection,
    setAntilink,
    getAntilink,
    removeAntilink
};
