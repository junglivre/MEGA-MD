import { loadSchedules, saveSchedules } from './schedule.js';
export default {
    command: 'schedulecancel',
    aliases: ['schedcancel', 'cancelschedule', 'unschedule'],
    category: 'utility',
    description: 'Cancel a scheduled message by its ID',
    usage: '.schedulecancel <ID>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        if (!args || args.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.schedulecancel.provideId')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const targetId = args[0].toUpperCase();
        const schedules = await loadSchedules();
        const index = schedules.findIndex(s => s.id === targetId && (s.chatId === chatId || s.senderId === senderId));
        if (index === -1) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.schedulecancel.notFound', { id: targetId })}`,
                ...channelInfo
            }, { quoted: message });
        }
        const cancelled = schedules.splice(index, 1)[0];
        await saveSchedules(schedules);
        await sock.sendMessage(chatId, {
            text: `🗑️ *${t('p.schedulecancel.cancelled')}*\n\n📌 *${t('p.schedulecancel.idLabel')}:* ${cancelled.id}\n💬 *${t('p.schedulecancel.messageLabel')}:* ${cancelled.message}`,
            ...channelInfo
        }, { quoted: message });
    }
};
