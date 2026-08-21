import isAdmin from '../lib/isAdmin.js';
export default {
    command: 'disappear',
    aliases: ['ephemeral', 'disappearing', 'vanish'],
    category: 'admin',
    description: 'Enable or disable disappearing messages in chat',
    usage: '.disappear off | .disappear 24h | .disappear 7d | .disappear 90d',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        const isGroup = chatId.endsWith('@g.us');
        const senderId = context.senderId || message.key.participant || message.key.remoteJid;
        const senderIsOwnerOrSudo = context.senderIsOwnerOrSudo || false;
        // Permission check
        if (isGroup && !senderIsOwnerOrSudo) {
            const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
            if (!isSenderAdmin) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.disappear.groupPermission')}`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        if (!isGroup && !senderIsOwnerOrSudo && !message.key.fromMe) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.disappear.dmPermission')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const input = args[0]?.toLowerCase();
        if (!input) {
            return await sock.sendMessage(chatId, {
                text: `*⏳ ${t('p.disappear.title')}*\n\n` +
                    `*${t('p.disappear.usageLabel')}*\n` +
                    `• \`.disappear off\` — ${t('p.disappear.disableOption')}\n` +
                    `• \`.disappear 24h\` — ${t('p.disappear.h24Option')}\n` +
                    `• \`.disappear 7d\` — ${t('p.disappear.d7Option')}\n` +
                    `• \`.disappear 90d\` — ${t('p.disappear.d90Option')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const durations = {
            'off': false,
            '0': false,
            '24h': 86400,
            '1d': 86400,
            '7d': 604800,
            '1w': 604800,
            '90d': 7776000,
            '3m': 7776000,
        };
        if (!(input in durations)) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.disappear.invalidOption', { input })}\n\n${t('p.disappear.chooseOptions')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const seconds = durations[input];
        try {
            await sock.sendMessage(chatId, {
                disappearingMessagesInChat: seconds === false ? false : seconds
            });
            const labels = {
                'off': `❌ ${t('p.disappear.disabled')}`,
                '0': `❌ ${t('p.disappear.disabled')}`,
                '24h': `⏳ ${t('p.disappear.set24h')}`,
                '1d': `⏳ ${t('p.disappear.set24h')}`,
                '7d': `⏳ ${t('p.disappear.set7d')}`,
                '1w': `⏳ ${t('p.disappear.set7d')}`,
                '90d': `⏳ ${t('p.disappear.set90d')}`,
                '3m': `⏳ ${t('p.disappear.set90d')}`,
            };
            await sock.sendMessage(chatId, {
                text: labels[input],
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('[DISAPPEAR] Error:', e.message);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.disappear.failed', { error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
