import { channelInfo } from '../lib/messageConfig.js';

export default {
    command: 'broadcast',
    aliases: ['bc', 'announce'],
    category: 'owner',
    description: 'Broadcast a message to all groups the bot is in',
    usage: '.broadcast <message>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const t = context.t;
        const text = args.join(' ').trim();
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: `*📢 ${t('p.broadcast.usageTitle')}*\n\n*${t('p.broadcast.usageLabel')}:* .broadcast <message>\n\n*${t('p.broadcast.exampleLabel')}:*\n.broadcast ${t('p.broadcast.exampleText')}\n\n_${t('p.broadcast.note')}_`,
                ...channelInfo
            }, { quoted: message });
        }
        let groups = [];
        try {
            const allChats = Object.keys(sock.store?.chats || {});
            groups = allChats.filter(jid => jid.endsWith('@g.us'));
        }
        catch (e) {
            console.error('[BROADCAST] Error getting groups:', e.message);
        }
        if (groups.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.broadcast.noGroups')}`,
                ...channelInfo
            }, { quoted: message });
        }
        await sock.sendMessage(chatId, {
            text: `📢 *${t('p.broadcast.broadcasting', { count: groups.length })}*\n\n${t('p.broadcast.mayTakeMoment')}`,
            ...channelInfo
        }, { quoted: message });
        const broadcastText = `📢 *${t('p.broadcast.messageTitle')}*\n\n${text}`;
        let sent = 0;
        let failed = 0;
        for (const groupJid of groups) {
            try {
                await sock.sendMessage(groupJid, {
                    text: broadcastText,
                    ...channelInfo
                });
                sent++;
            }
            catch (e) {
                console.error(`[BROADCAST] Failed to send to ${groupJid}: ${e.message}`);
                failed++;
            }
            // 1 second delay between sends to avoid WhatsApp rate limiting
            await new Promise(r => setTimeout(r, 1000));
        }
        await sock.sendMessage(chatId, {
            text: `✅ *${t('p.broadcast.completeTitle')}*\n\n📤 ${t('p.broadcast.sentLabel')}: ${sent}\n❌ ${t('p.broadcast.failedLabel')}: ${failed}\n📊 ${t('p.broadcast.totalLabel')}: ${groups.length}`,
            ...channelInfo
        }, { quoted: message });
    }
};
