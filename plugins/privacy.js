export default {
    command: 'privacy',
    aliases: ['setprivacy', 'pvcy', 'pri'],
    category: 'menu',
    description: 'Manage all WhatsApp privacy settings, block/unblock users',
    usage: '.privacy — show menu',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        const setting = args[0]?.toLowerCase();
        const value = args[1]?.toLowerCase();
        // ── No args: show full menu ───────────────────────────────────────
        if (!setting) {
            return await sock.sendMessage(chatId, {
                text: t('p.privacy.menu'),
                ...channelInfo
            }, { quoted: message });
        }
        // ── status: show current privacy settings ─────────────────────────
        if (setting === 'status') {
            try {
                const s = await sock.fetchPrivacySettings(true);
                const fmt = (v) => v ? `\`${v}\`` : `\`unknown\``;
                return await sock.sendMessage(chatId, {
                    text: t('p.privacy.statusView', {
                        last: fmt(s.last),
                        online: fmt(s.online),
                        profile: fmt(s.profile),
                        status: fmt(s.status),
                        readreceipts: fmt(s.readreceipts),
                        groupadd: fmt(s.groupadd)
                    }),
                    ...channelInfo
                }, { quoted: message });
            }
            catch (e) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.privacy.statusFetchFailed', { error: e.message })}`, ...channelInfo }, { quoted: message });
            }
        }
        // ── blocklist ─────────────────────────────────────────────────────
        if (setting === 'blocklist') {
            try {
                const list = await sock.fetchBlocklist();
                if (!list || list.length === 0) {
                    return await sock.sendMessage(chatId, { text: `📋 ${t('p.privacy.blocklistEmpty')}`, ...channelInfo }, { quoted: message });
                }
                const entries = list.map((jid, i) => `${i + 1}. +${jid.split('@')[0]}`).join('\n');
                return await sock.sendMessage(chatId, {
                    text: t('p.privacy.blocklistView', { entries, count: list.length }),
                    ...channelInfo
                }, { quoted: message });
            }
            catch (e) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.privacy.blocklistFetchFailed', { error: e.message })}`, ...channelInfo }, { quoted: message });
            }
        }
        // ── block/unblock ─────────────────────────────────────────────────
        if (setting === 'block' || setting === 'unblock') {
            let targetJid = null;
            const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;
            if (quotedParticipant) {
                const num = quotedParticipant.split('@')[0].split(':')[0];
                targetJid = `${num}@s.whatsapp.net`;
            }
            if (!targetJid && value) {
                const num = value.replace(/[^0-9]/g, '');
                if (num.length >= 7)
                    targetJid = `${num}@s.whatsapp.net`;
            }
            if (!targetJid && !chatId.endsWith('@g.us')) {
                targetJid = chatId;
            }
            if (!targetJid) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.privacy.missingTarget')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            try {
                await sock.updateBlockStatus(targetJid, setting);
                const icon = setting === 'block' ? '🚫' : '✅';
                const action = setting === 'block' ? t('p.privacy.blockedWord') : t('p.privacy.unblockedWord');
                return await sock.sendMessage(chatId, {
                    text: `${icon} *${action}* +${targetJid.split('@')[0]}`,
                    ...channelInfo
                }, { quoted: message });
            }
            catch (e) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.privacy.actionFailed', { action: setting, error: e.message })}`, ...channelInfo }, { quoted: message });
            }
        }
        // ── default disappearing timer ────────────────────────────────────
        if (setting === 'timer') {
            const durations = {
                'off': 0, '0': 0,
                '24h': 86400, '1d': 86400,
                '7d': 604800, '1w': 604800,
                '90d': 7776000, '3m': 7776000,
            };
            if (!value || !(value in durations)) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.privacy.timerInvalid')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            try {
                await sock.updateDefaultDisappearingMode(durations[value]);
                const label = value === 'off' || value === '0' ? t('p.privacy.timerDisabled') : t('p.privacy.timerSetTo', { value });
                return await sock.sendMessage(chatId, { text: `⏳ ${t('p.privacy.timerResult', { label })}`, ...channelInfo }, { quoted: message });
            }
            catch (e) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.privacy.timerFailed', { error: e.message })}`, ...channelInfo }, { quoted: message });
            }
        }
        // ── privacy setting updates ───────────────────────────────────────
        const privacySettings = {
            lastseen: { fn: (v) => sock.updateLastSeenPrivacy(v), allowed: ['all', 'contacts', 'contact_blacklist', 'blacklist', 'none'], label: t('p.privacy.labelLastseen') },
            online: { fn: (v) => sock.updateOnlinePrivacy(v), allowed: ['all', 'match_last_seen'], label: t('p.privacy.labelOnline') },
            profile: { fn: (v) => sock.updateProfilePicturePrivacy(v), allowed: ['all', 'contacts', 'contact_blacklist', 'blacklist', 'none'], label: t('p.privacy.labelProfile') },
            status: { fn: (v) => sock.updateStatusPrivacy(v), allowed: ['all', 'contacts', 'contact_blacklist', 'blacklist', 'none'], label: t('p.privacy.labelStatus') },
            receipts: { fn: (v) => sock.updateReadReceiptsPrivacy(v), allowed: ['all', 'none'], label: t('p.privacy.labelReceipts') },
            groups: { fn: (v) => sock.updateGroupsAddPrivacy(v), allowed: ['all', 'contacts', 'contact_blacklist', 'blacklist'], label: t('p.privacy.labelGroups') },
        };
        const config = privacySettings[setting];
        if (!config) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.privacy.unknownOption', { setting })}`,
                ...channelInfo
            }, { quoted: message });
        }
        if (!value || !config.allowed.includes(value)) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.privacy.invalidValue', { setting, allowed: config.allowed.filter(v => v !== 'contact_blacklist').map(v => `\`${v}\``).join(' ') })}`,
                ...channelInfo
            }, { quoted: message });
        }
        const resolvedValue = value === 'blacklist' ? 'contact_blacklist' : value;
        try {
            await config.fn(resolvedValue);
            return await sock.sendMessage(chatId, {
                text: `✅ ${t('p.privacy.settingUpdated', { label: config.label, value })}`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('[PRIVACY] Error:', e.message);
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.privacy.updateFailed', { label: config.label, error: e.message })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
