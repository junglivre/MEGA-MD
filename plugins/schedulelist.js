import { loadSchedules, formatTimeLeft } from './schedule.js';
export default {
    command: 'schedulelist',
    aliases: ['schedlist', 'schedules', 'reminders'],
    category: 'utility',
    description: 'View all scheduled messages for this chat',
    usage: '.schedulelist',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const { t } = context;
        const schedules = await loadSchedules();
        // Show schedules for this chat
        const mine = schedules.filter(s => s.chatId === chatId || s.senderId === senderId);
        if (mine.length === 0) {
            return await sock.sendMessage(chatId, {
                text: `📭 *${t('p.schedulelist.noScheduled')}*\n\n${t('p.schedulelist.scheduleHint')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const now = Date.now();
        const lines = mine.map((s, i) => {
            const timeLeft = formatTimeLeft(s.sendAt - now);
            const preview = s.message.length > 40
                ? `${s.message.substring(0, 40) }...`
                : s.message;
            return `${i + 1}. 📌 *${t('p.schedulelist.idLabel')}:* ${s.id} | ⏳ ${timeLeft}\n    💬 ${preview}`;
        }).join('\n\n');
        await sock.sendMessage(chatId, {
            text: `*⏰ ${t('p.schedulelist.title', { count: mine.length })}*\n\n${lines}\n\n_${t('p.schedulelist.cancelHint')}_`,
            ...channelInfo
        }, { quoted: message });
    }
};
