import axios from 'axios';
export default {
    command: 'screenshot',
    aliases: ['ss', 'ssweb'],
    category: 'tools',
    description: 'Get a screenshot of a website',
    usage: '.screenshot <url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        let url = args?.[0]?.trim();
        if (!url) {
            return await sock.sendMessage(chatId, { text: `*${t('p.screenshot.provideUrl')}*\n${t('p.screenshot.example')}` }, { quoted: message });
        }
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${ url}`;
        }
        try {
            new URL(url);
        }
        catch {
            return await sock.sendMessage(chatId, { text: `❌ ${t('p.screenshot.invalidUrl')}` }, { quoted: message });
        }
        try {
            const apiUrl = `https://discardapi.dpdns.org/api/tools/ssweb?apikey=guru&url=${encodeURIComponent(url)}`;
            const { data } = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 10000,
            });
            const caption = `🌐 ${t('p.screenshot.screenshotOf')}:\n${url}`;
            await sock.sendMessage(chatId, { image: { buffer: data }, caption }, { quoted: message });
        }
        catch (error) {
            console.error('Screenshot plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.screenshot.timeout')}` }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.screenshot.fetchFailed')}` }, { quoted: message });
            }
        }
    }
};
