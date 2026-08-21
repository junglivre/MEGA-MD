import os from 'os';
import process from 'process';
import { channelInfo } from '../lib/messageConfig.js';
export default {
    command: 'alive',
    aliases: ['status', 'bot'],
    category: 'general',
    description: 'Check bot status and system info',
    usage: '.alive',
    isPrefixless: true,
    async handler(sock, message, args, context) {
        const { chatId, config, t } = context;
        try {
            let uptime = Math.floor(process.uptime());
            const days = Math.floor(uptime / 86400);
            uptime %= 86400;
            const hours = Math.floor(uptime / 3600);
            uptime %= 3600;
            const minutes = Math.floor(uptime / 60);
            const seconds = (Number(uptime) % Number(60));
            const uptimeParts = [];
            if (days)
                uptimeParts.push(`${days}d`);
            if (hours)
                uptimeParts.push(`${hours}h`);
            if (minutes)
                uptimeParts.push(`${minutes}m`);
            if (seconds || uptimeParts.length === 0)
                uptimeParts.push(`${seconds}s`);
            const uptimeText = uptimeParts.join(' ');
            const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
            const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);
            const usedMem = (Number(totalMem) - Number(freeMem)).toFixed(2);
            const cpuLoad = os.loadavg()[0].toFixed(2);
            const platform = os.platform();
            const arch = os.arch();
            const nodeVersion = process.version;
            const text = `*🤖 ${t('p.alive.active', { botName: config.botName })}*\n\n` +
                `*${t('p.alive.version')}:* ${config.version}\n` +
                `*${t('p.alive.uptime')}:* ${uptimeText}\n` +
                `*${t('p.alive.ramUsage')}:* ${usedMem} MB / ${totalMem} MB\n` +
                `*${t('p.alive.cpuLoad')}:* ${cpuLoad}\n` +
                `*${t('p.alive.platform')}:* ${platform} (${arch})\n` +
                `*Node.js:* ${nodeVersion}\n`;
            await sock.sendMessage(chatId, {
                text,
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error in alive command:', error);
            await sock.sendMessage(chatId, { text: `✅ ${t('p.alive.fallback')}` }, { quoted: message });
        }
    }
};
