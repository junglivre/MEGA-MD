import moment from 'moment-timezone';
import fs from 'fs';
import path from 'path';
export default {
    command: 'script',
    aliases: ['repo', 'sc'],
    category: 'info',
    description: 'Get information about the MEGA-MD GitHub repository',
    usage: '.script',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const res = await fetch('https://api.github.com/repos/GlobalTechInfo/MEGA-MD');
            if (!res.ok)
                throw new Error('Error fetching repository data');
            const json = await res.json();
            const txt = t('p.script.info', {
                name: json.name,
                watchers: json.watchers_count,
                size: (json.size / 1024).toFixed(2),
                updated: moment(json.updated_at).format('DD/MM/YY - HH:mm:ss'),
                url: json.html_url,
                forks: json.forks_count,
                stars: json.stargazers_count
            });
            const imgPath = path.join(process.cwd(), 'assets/thumb.png');
            const imgBuffer = fs.readFileSync(imgPath);
            await sock.sendMessage(chatId, { image: imgBuffer, caption: txt }, { quoted: message });
        }
        catch (error) {
            console.error('Error in github command:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.script.fetchError')}` }, { quoted: message });
        }
    }
};
