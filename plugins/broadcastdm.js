import { channelInfo } from '../lib/messageConfig.js';

export default {
    command: 'broadcastdm',
    aliases: ['bcdm', 'announcedm', 'dmall'],
    category: 'owner',
    description: 'Broadcast a message to all saved DM contacts',
    usage: '.broadcastdm <message>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const t = context.t;
        const text = args.join(' ').trim();
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: `*📩 ${t('p.broadcastdm.usageTitle')}*\n\n*${t('p.broadcastdm.usageLabel')}:* .broadcastdm <message>\n\n*${t('p.broadcastdm.exampleLabel')}:*\n.broadcastdm ${t('p.broadcastdm.exampleText')}\n\n_${t('p.broadcastdm.note')}_`,
                ...channelInfo
            }, { quoted: message });
        }
        let contacts = [];
        try {
            const allContacts = Object.keys(sock.store?.contacts || {});
            contacts = allContacts.filter(jid => (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')) &&
                jid !== sock.user?.id);
        }
        catch (e) {
            console.error('[BROADCASTDM] Error getting contacts:', e.message);
        }
        if (contacts.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.broadcastdm.noContacts')}`,
                ...channelInfo
            }, { quoted: message });
        }
        await sock.sendMessage(chatId, {
            text: `📩 *${t('p.broadcastdm.broadcasting', { count: contacts.length })}*\n\n${t('p.broadcastdm.mayTakeMoment')}`,
            ...channelInfo
        }, { quoted: message });
        const broadcastText = `📩 *${t('p.broadcastdm.messageTitle')}*\n\n${text}`;
        let sent = 0;
        let failed = 0;
        for (const contactJid of contacts) {
            try {
                await sock.sendMessage(contactJid, {
                    text: broadcastText,
                    ...channelInfo
                });
                sent++;
            }
            catch (e) {
                console.error(`[BROADCASTDM] Failed to send to ${contactJid}: ${e.message}`);
                failed++;
            }
            // 1.5 second delay between DMs
            await new Promise(r => setTimeout(r, 1500));
        }
        await sock.sendMessage(chatId, {
            text: `✅ *${t('p.broadcastdm.completeTitle')}*\n\n📤 ${t('p.broadcastdm.sentLabel')}: ${sent}\n❌ ${t('p.broadcastdm.failedLabel')}: ${failed}\n📊 ${t('p.broadcastdm.totalLabel')}: ${contacts.length}`,
            ...channelInfo
        }, { quoted: message });
    }
};
