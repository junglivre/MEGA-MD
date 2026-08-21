import { initConfig } from './autoreply.js';
export default {
    command: 'listreplies',
    aliases: ['autoreplies', 'replylist', 'replies'],
    category: 'owner',
    description: 'List all configured auto-reply triggers',
    usage: '.listreplies',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        const config = await initConfig();
        if (config.replies.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `📭 *${t('p.listreplies.emptyTitle')}*\n\n${t('p.listreplies.statusLabel')}: ${config.enabled ? t('p.listreplies.enabled') : t('p.listreplies.disabled')}\n\n${t('p.listreplies.emptyHint')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const lines = config.replies.map((r, i) => {
            const preview = r.response.length > 40
                ? `${r.response.substring(0, 40) }...`
                : r.response;
            const matchIcon = r.exactMatch ? '🎯' : '🔍';
            return `${i + 1}. ${matchIcon} *${r.trigger}*\n    ↳ ${preview}`;
        }).join('\n\n');
        await sock.sendMessage(chatId, {
            text: `*🤖 ${t('p.listreplies.title')} (${config.replies.length})*\n` +
                `*${t('p.listreplies.statusLabel')}:* ${config.enabled ? t('p.listreplies.enabled') : t('p.listreplies.disabled')}\n\n` +
                `${lines}\n\n` +
                `${t('p.listreplies.legend')}\n` +
                `_${t('p.listreplies.removeHint')}_`,
            ...channelInfo
        }, { quoted: message });
    }
};
