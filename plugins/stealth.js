import store from '../lib/lightweight_store.js';
export default {
    command: 'stealth',
    aliases: ['alwaysonline', 'stealthmode'],
    category: 'owner',
    description: 'Toggle online status - bot will not send presence updates if off',
    usage: '.stealth <on|off>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, t } = context;
        const action = args[0]?.toLowerCase();
        if (!action || !['on', 'off'].includes(action)) {
            const currentState = await store.getSetting('global', 'stealthMode');
            const status = currentState?.enabled ? t('p.stealth.on') : t('p.stealth.off');
            let autotypingWarning = '';
            try {
                const autotypingState = await store.getSetting('global', 'autotyping');
                if (autotypingState?.enabled && currentState?.enabled) {
                    autotypingWarning = `\n\n${t('p.stealth.autotypingWarning')}`;
                }
            }
            catch (e) { }
            let autoreadWarning = '';
            try {
                const autoreadState = await store.getSetting('global', 'autoread');
                if (autoreadState?.enabled && currentState?.enabled) {
                    autoreadWarning = `\n${t('p.stealth.autoreadWarning')}`;
                }
            }
            catch (e) { }
            return await sock.sendMessage(chatId, {
                text: t('p.stealth.statusView', { status, autotypingWarning, autoreadWarning })
            }, { quoted: message });
        }
        const enabled = action === 'on';
        await store.saveSetting('global', 'stealthMode', { enabled });
        let warnings = '';
        if (enabled) {
            try {
                const autotypingState = await store.getSetting('global', 'autotyping');
                const autoreadState = await store.getSetting('global', 'autoread');
                if (autotypingState?.enabled || autoreadState?.enabled) {
                    warnings = `\n\n${t('p.stealth.noteHeader')}\n`;
                    if (autotypingState?.enabled)
                        warnings += `• ${t('p.stealth.autotypingBlockedLine')}\n`;
                    if (autoreadState?.enabled)
                        warnings += `• ${t('p.stealth.autoreadBlockedLine')}\n`;
                }
            }
            catch (e) { }
        }
        await sock.sendMessage(chatId, {
            text: t('p.stealth.toggled', {
                state: enabled ? t('p.stealth.on') : t('p.stealth.off'),
                details: enabled ? t('p.stealth.enabledDetails') : t('p.stealth.disabledDetails'),
                warnings
            })
        }, { quoted: message });
    }
};
