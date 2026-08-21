import { initConfig, saveConfig } from './autoreply.js';
export default {
    command: 'delreply',
    aliases: ['removereply', 'rmreply'],
    category: 'owner',
    description: 'Delete an auto-reply trigger',
    usage: '.delreply <trigger>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        if (!args || args.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.delreply.noTrigger')}\n\n${t('p.delreply.usageLabel')}: \`.delreply hello\`\n${t('p.delreply.seeAll')}: \`.listreplies\``,
                ...channelInfo
            }, { quoted: message });
        }
        const trigger = args.join(' ').toLowerCase().trim();
        const config = await initConfig();
        const before = config.replies.length;
        config.replies = config.replies.filter(r => r.trigger !== trigger);
        if (config.replies.length === before) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.delreply.notFound', { trigger })}\n\n${t('p.delreply.useListReplies')}`,
                ...channelInfo
            }, { quoted: message });
        }
        await saveConfig(config);
        await sock.sendMessage(chatId, {
            text: `🗑️ *${t('p.delreply.deletedTitle')}*\n\n${t('p.delreply.deletedBody', { trigger })}`,
            ...channelInfo
        }, { quoted: message });
    }
};
