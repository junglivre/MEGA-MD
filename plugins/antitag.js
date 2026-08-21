import { setAntitag, getAntitag, removeAntitag } from '../lib/index.js';
export async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        const antitagSetting = await getAntitag(chatId, 'on');
        if (!antitagSetting || !antitagSetting.enabled)
            return;
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const messageText = (message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            '');
        const textMentions = messageText.match(/@[\d+\s\-()~.]+/g) || [];
        const numericMentions = messageText.match(/@\d{10,}/g) || [];
        const _allMentions = [...new Set([...mentionedJids, ...textMentions, ...numericMentions])];
        const uniqueNumericMentions = new Set();
        numericMentions.forEach((mention) => {
            const numMatch = mention.match(/@(\d+)/);
            if (numMatch)
                uniqueNumericMentions.add(numMatch[1]);
        });
        const mentionedJidCount = mentionedJids.length;
        const numericMentionCount = uniqueNumericMentions.size;
        const totalMentions = Math.max(mentionedJidCount, numericMentionCount);
        if (totalMentions >= 3) {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants || [];
            const mentionThreshold = Math.ceil(participants.length * 0.5);
            const hasManyNumericMentions = numericMentionCount >= 10 ||
                (numericMentionCount >= 5 && numericMentionCount >= mentionThreshold);
            if (totalMentions >= mentionThreshold || hasManyNumericMentions) {
                const action = antitagSetting.action || 'delete';
                if (action === 'delete') {
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: false,
                            id: message.key.id,
                            participant: senderId
                        }
                    });
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *Tagall Detected!*\n\n@${senderId.split('@')[0]}, tagging all members is not allowed.`,
                        mentions: [senderId]
                    });
                }
                else if (action === 'kick') {
                    await sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: false,
                            id: message.key.id,
                            participant: senderId
                        }
                    });
                    try {
                        await sock.groupParticipantsUpdate(chatId, [senderId], "remove");
                        await sock.sendMessage(chatId, {
                            text: `🚫 *Antitag Action!*\n\n@${senderId.split('@')[0]} has been removed for tagging all members.`,
                            mentions: [senderId]
                        });
                    }
                    catch (error) {
                        await sock.sendMessage(chatId, {
                            text: `⚠️ Failed to remove user. Make sure the bot is an admin.`
                        });
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('Error in tag detection:', error);
    }
}
export default {
    command: 'antitag',
    aliases: ['at', 'tagblock'],
    category: 'admin',
    description: 'Prevent users from tagging all members',
    usage: '.antitag <on|off|set>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const action = args[0]?.toLowerCase();
        if (!action) {
            const config = await getAntitag(chatId, 'on');
            await sock.sendMessage(chatId, {
                text: `*🏷️ ${t('p.antitag.setupTitle')}*\n\n` +
                    `*${t('p.antitag.currentStatus')}:* ${config?.enabled ? `✅ ${t('p.antitag.enabled')}` : `❌ ${t('p.antitag.disabled')}`}\n` +
                    `*${t('p.antitag.currentAction')}:* ${config?.action || t('p.antitag.notSet')}\n\n` +
                    `*${t('p.antitag.commandsLabel')}:*\n` +
                    `• \`.antitag on\` - ${t('p.antitag.enableHint')}\n` +
                    `• \`.antitag off\` - ${t('p.antitag.disableHint')}\n` +
                    `• \`.antitag set delete\` - ${t('p.antitag.setDeleteHint')}\n` +
                    `• \`.antitag set kick\` - ${t('p.antitag.setKickHint')}\n\n` +
                    `*${t('p.antitag.detectionLabel')}:*\n` +
                    `• ${t('p.antitag.detDetects')}\n` +
                    `• ${t('p.antitag.detCatches')}\n` +
                    `• ${t('p.antitag.detProtects')}`
            }, { quoted: message });
            return;
        }
        switch (action) {
            case 'on':
                const existingConfig = await getAntitag(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *${t('p.antitag.alreadyEnabled')}*`
                    }, { quoted: message });
                    return;
                }
                const result = await setAntitag(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, {
                    text: result
                        ? `✅ *${t('p.antitag.enabledSuccess')}*\n\n${t('p.antitag.defaultActionDelete')}`
                        : `❌ *${t('p.antitag.enableFailed')}*`
                }, { quoted: message });
                break;
            case 'off':
                await removeAntitag(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.antitag.disabledTitle')}*\n\n${t('p.antitag.usersCanTagFreely')}`
                }, { quoted: message });
                break;
            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `❌ *${t('p.antitag.specifyAction')}*\n\nUsage: \`.antitag set delete | kick\``
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1].toLowerCase();
                if (!['delete', 'kick'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: `❌ *${t('p.antitag.invalidAction')}*\n\n${t('p.antitag.chooseDeleteKick')}`
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntitag(chatId, 'on', setAction);
                const actionDescriptions = {
                    delete: t('p.antitag.descDelete'),
                    kick: t('p.antitag.descKick')
                };
                await sock.sendMessage(chatId, {
                    text: setResult
                        ? `✅ *${t('p.antitag.actionSetTo', { action: setAction })}*\n\n${actionDescriptions[setAction]}`
                        : `❌ *${t('p.antitag.setActionFailed')}*`
                }, { quoted: message });
                break;
            case 'status':
            case 'get':
                const status = await getAntitag(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: `*🏷️ ${t('p.antitag.statusTitle')}*\n\n` +
                        `*${t('p.antitag.statusLabel')}:* ${status?.enabled ? `✅ ${t('p.antitag.enabled')}` : `❌ ${t('p.antitag.disabled')}`}\n` +
                        `*${t('p.antitag.actionLabel')}:* ${status?.action || t('p.antitag.notSet')}\n\n` +
                        `*${t('p.antitag.whatHappens')}:*\n` +
                        `${status?.action === 'delete' ? `• ${t('p.antitag.msgDeleted')}\n• ${t('p.antitag.userWarned')}` : ''}` +
                        `${status?.action === 'kick' ? `• ${t('p.antitag.msgDeleted')}\n• ${t('p.antitag.userRemoved')}` : ''}\n\n` +
                        `*${t('p.antitag.detectionThreshold')}*`
                }, { quoted: message });
                break;
            default:
                await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.antitag.invalidCommand')}*\n\n${t('p.antitag.useToSeeOptions')}`
                }, { quoted: message });
        }
    },
    handleTagDetection
};
