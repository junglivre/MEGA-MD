import axios from 'axios';
export default {
    command: 'pingweb',
    aliases: ['pweb'],
    category: 'general',
    description: 'Check bot response time and ping a website',
    usage: '.pingweb [website URL]',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, rawText, t } = context;
        const prefix = rawText.match(/^[.!#]/)?.[0] || '.';
        const commandPart = rawText.slice(prefix.length).trim();
        const parts = commandPart.split(/\s+/);
        const url = parts.slice(1).join(' ').trim();
        const startBot = Date.now();
        const sent = await sock.sendMessage(chatId, {
            text: `🏓 ${t('p.pingweb.pinging')}`,
            ...channelInfo
        }, { quoted: message });
        const endBot = Date.now();
        const botLatency = endBot - startBot;
        let responseText = `🏓 ${t('p.pingweb.pongHeader', { ms: botLatency })}`;
        if (url) {
            try {
                let testUrl = url;
                if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
                    testUrl = `https://${ testUrl}`;
                }
                const urlObj = new URL(testUrl);
                const startWeb = Date.now();
                const response = await axios.get(testUrl, {
                    timeout: 10000,
                    validateStatus: () => true,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                const endWeb = Date.now();
                const webLatency = endWeb - startWeb;
                responseText += t('p.pingweb.websiteReachable', {
                    hostname: urlObj.hostname,
                    ms: webLatency,
                    status: response.status,
                    statusText: response.statusText
                });
            }
            catch (error) {
                if (error.code === 'ENOTFOUND') {
                    responseText += t('p.pingweb.websiteNotFound', { url });
                }
                else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                    responseText += t('p.pingweb.websiteTimeout', { url });
                }
                else if (error.message.includes('Invalid URL')) {
                    responseText += t('p.pingweb.invalidUrl');
                }
                else {
                    responseText += t('p.pingweb.websiteError', { url, error: error.message });
                }
            }
        }
        else {
            responseText += t('p.pingweb.tip');
        }
        await sock.sendMessage(chatId, {
            text: responseText,
            edit: sent.key,
            ...channelInfo
        });
    }
};
