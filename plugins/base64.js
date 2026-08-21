export default {
    command: 'base64',
    aliases: ['b64', 'encode'],
    category: 'tools',
    description: 'Encode text to Base64',
    usage: '.base64 <text> OR reply to a message',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const t = context.t;
        try {
            let txt = args?.join(' ') || "";
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                txt = quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption ||
                    txt;
            }
            txt = txt.replace(/^\.\w+\s*/, '').trim();
            if (!txt) {
                return await sock.sendMessage(chatId, { text: `*${t('p.base64.noText')}*\n${t('p.base64.example')}` }, { quoted: message });
            }
            const encoded = Buffer.from(txt, 'utf-8').toString('base64');
            const response = `*🔗 ${t('p.base64.encodedTitle')}*\n\n${encoded}`;
            await sock.sendMessage(chatId, { text: response }, { quoted: message });
        }
        catch (err) {
            console.error('Base64 plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.base64.genericError')}` }, { quoted: message });
        }
    }
};
