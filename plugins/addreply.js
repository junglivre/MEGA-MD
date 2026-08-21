import { initConfig, saveConfig } from './autoreply.js';
export default {
    command: 'addreply',
    aliases: ['newtrigger', 'setreply'],
    category: 'owner',
    description: 'Add an auto-reply trigger',
    usage: '.addreply <trigger> | <response>\nFor exact match: .addreply exact:<trigger> | <response>\nUse {name} in response to mention sender name',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        const fullText = args.join(' ');
        const pipeIndex = fullText.indexOf('|');
        if (!fullText || pipeIndex === -1) {
            return await sock.sendMessage(chatId, {
                text: `*➕ ${t('p.addreply.title')}*\n\n` +
                    `*${t('p.addreply.usageLabel')}:*\n` +
                    `\`.addreply <trigger> | <response>\`\n\n` +
                    `*${t('p.addreply.examplesLabel')}:*\n` +
                    `• \`.addreply hello | Hi there! 👋\`\n` +
                    `• \`.addreply exact:good morning | Good morning! ☀️\`\n` +
                    `• \`.addreply hi | Hello {name}! How are you?\`\n\n` +
                    `*${t('p.addreply.tipsLabel')}:*\n` +
                    `• ${t('p.addreply.tipExact')}\n` +
                    `• ${t('p.addreply.tipContains')}\n` +
                    `• ${t('p.addreply.tipName')}`,
                ...channelInfo
            }, { quoted: message });
        }
        let trigger = fullText.substring(0, pipeIndex).trim();
        const response = fullText.substring(pipeIndex + 1).trim();
        if (!trigger || !response) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.addreply.missingParts')}`,
                ...channelInfo
            }, { quoted: message });
        }
        let exactMatch = false;
        if (trigger.toLowerCase().startsWith('exact:')) {
            exactMatch = true;
            trigger = trigger.substring(6).trim();
        }
        if (!trigger) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.addreply.emptyTrigger')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const config = await initConfig();
        const exists = config.replies.find(r => r.trigger === trigger.toLowerCase());
        if (exists) {
            return await sock.sendMessage(chatId, {
                text: `⚠️ ${t('p.addreply.alreadyExists', { trigger })}`,
                ...channelInfo
            }, { quoted: message });
        }
        config.replies.push({
            trigger: trigger.toLowerCase(),
            response,
            exactMatch,
            addedBy: senderId,
            createdAt: Date.now()
        });
        await saveConfig(config);
        const matchType = exactMatch ? t('p.addreply.matchExact') : t('p.addreply.matchContains');
        await sock.sendMessage(chatId, {
            text: `✅ *${t('p.addreply.added')}*\n\n` +
                `🔑 *${t('p.addreply.triggerLabel')}:* ${trigger}\n` +
                `🎯 *${t('p.addreply.matchTypeLabel')}:* ${matchType}\n` +
                `💬 *${t('p.addreply.responseLabel')}:* ${response}`,
            ...channelInfo
        }, { quoted: message });
    }
};
