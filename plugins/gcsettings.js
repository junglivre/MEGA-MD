export default {
    command: 'gcset',
    aliases: ['gsetting', 'groupset', 'gpset'],
    category: 'admin',
    description: 'Change group settings (lock/unlock messages or settings)',
    usage: '.gcset <setting>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const isBotAdmin = context.isBotAdmin || false;
        const t = context.t;
        if (!isBotAdmin) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.gcset.notAdmin')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const setting = args[0]?.toLowerCase();
        if (!setting) {
            return await sock.sendMessage(chatId, {
                text: t('p.gcset.menu'),
                ...channelInfo
            }, { quoted: message });
        }
        const settingsMap = {
            lock: { value: 'announcement', label: `🔒 ${t('p.gcset.lockLabel')}` },
            unlock: { value: 'not_announcement', label: `🔓 ${t('p.gcset.unlockLabel')}` },
            lockset: { value: 'locked', label: `🔒 ${t('p.gcset.locksetLabel')}` },
            unlockset: { value: 'unlocked', label: `🔓 ${t('p.gcset.unlocksetLabel')}` },
        };
        const config = settingsMap[setting];
        if (!config) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.gcset.unknown', { setting })}`,
                ...channelInfo
            }, { quoted: message });
        }
        try {
            await sock.groupSettingUpdate(chatId, config.value);
            return await sock.sendMessage(chatId, {
                text: `✅ ${config.label}`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('[GROUPSETTINGS] Error:', e.message);
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.gcset.failed', { error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
