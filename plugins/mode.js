import store from '../lib/lightweight_store.js';
/**
 * Advanced bot mode system with multiple access control options
 * Modes:
 * - public: Everyone can use (groups + private)
 * - private: Owner/sudo only
 * - groups: Only works in groups (everyone in groups)
 * - inbox: Only works in private chats (everyone in DM)
 * - self: Owner/sudo only (alias for private)
 */
async function modeCommand(sock, message, args, context) {
    const { chatId, channelInfo, t } = context;
    const _senderId = message.key.participant || message.key.remoteJid;
    const isOwnerOrSudoCheck = message.key.fromMe || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck;
    if (!isOwnerOrSudoCheck) {
        return await sock.sendMessage(chatId, {
            text: `❌ ${t('p.mode.ownerOnly')}`,
            ...channelInfo
        }, { quoted: message });
    }
    const subCommand = args[0]?.toLowerCase();
    const currentMode = await store.getBotMode() || 'public';
    if (!subCommand || subCommand === 'status' || subCommand === 'check') {
        const modeEmojis = {
            public: '🌍',
            private: '🔒',
            groups: '👥',
            inbox: '💬',
            self: '👤'
        };
        const modeDescriptions = {
            public: t('p.mode.descPublic'),
            private: t('p.mode.descPrivate'),
            groups: t('p.mode.descGroups'),
            inbox: t('p.mode.descInbox'),
            self: t('p.mode.descSelf')
        };
        let statusText = `📊 *${t('p.mode.statusTitle')}*\n\n`;
        statusText += `${t('p.mode.currentModeLabel')}: ${modeEmojis[currentMode]} *${currentMode.toUpperCase()}*\n`;
        statusText += `${t('p.mode.descriptionLabel')}: ${modeDescriptions[currentMode]}\n\n`;
        statusText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        statusText += `*${t('p.mode.availableModesTitle')}:*\n\n`;
        Object.entries(modeDescriptions).forEach(([mode, desc]) => {
            const current = mode === currentMode ? '✓ ' : '';
            statusText += `${current}${modeEmojis[mode]} \`${mode}\`\n${desc}\n\n`;
        });
        statusText += `*${t('p.mode.usageTitle')}:*\n`;
        statusText += `• \`.mode <mode>\` - ${t('p.mode.usageChange')}\n`;
        statusText += `• \`.mode status\` - ${t('p.mode.usageStatus')}\n\n`;
        statusText += `*${t('p.mode.examplesTitle')}:*\n`;
        statusText += `• \`.mode public\` - ${t('p.mode.exPublic')}\n`;
        statusText += `• \`.mode groups\` - ${t('p.mode.exGroups')}\n`;
        statusText += `• \`.mode inbox\` - ${t('p.mode.exInbox')}\n`;
        statusText += `• \`.mode private\` - ${t('p.mode.exPrivate')}`;
        return await sock.sendMessage(chatId, {
            text: statusText,
            ...channelInfo
        }, { quoted: message });
    }
    const validModes = ['public', 'private', 'groups', 'inbox', 'self'];
    if (!validModes.includes(subCommand)) {
        return await sock.sendMessage(chatId, {
            text: `❌ ${t('p.mode.invalidMode', { subCommand })}\n\n${t('p.mode.validModesLabel', { modes: validModes.join(', ') })}\n\n${t('p.mode.seeAllModes')}`,
            ...channelInfo
        }, { quoted: message });
    }
    await store.setBotMode(subCommand);
    const modeEmojis = {
        public: '🌍',
        private: '🔒',
        groups: '👥',
        inbox: '💬',
        self: '👤'
    };
    const modeMessages = {
        public: t('p.mode.msgPublic'),
        private: t('p.mode.msgPrivate'),
        groups: t('p.mode.msgGroups'),
        inbox: t('p.mode.msgInbox'),
        self: t('p.mode.msgSelf')
    };
    await sock.sendMessage(chatId, {
        text: `${modeEmojis[subCommand]} *${t('p.mode.changedTitle', { mode: subCommand.toUpperCase() })}*\n\n${modeMessages[subCommand]}\n\n_${t('p.mode.checkStatusHint')}_`,
        ...channelInfo
    }, { quoted: message });
}
export default {
    command: 'mode',
    aliases: ['botmode', 'setmode'],
    category: 'owner',
    description: 'Advanced bot access control - Set who can use the bot and where',
    usage: '.mode [public|private|groups|inbox|self|status]',
    ownerOnly: true,
    handler: modeCommand
};
