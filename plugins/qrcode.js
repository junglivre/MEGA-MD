import QRCode from 'qrcode';
export default {
    command: 'qrcode',
    aliases: ['qr'],
    category: 'tools',
    description: 'Generate a QR code from text',
    usage: '.qrcode <text>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const text = args?.join(' ')?.trim();
        if (!text) {
            return await sock.sendMessage(chatId, { text: t('p.qrcode.missingText') }, { quoted: message });
        }
        try {
            const qr = await QRCode.toDataURL(text.slice(0, 2048), {
                errorCorrectionLevel: 'H',
                scale: 8
            });
            await sock.sendMessage(chatId, { image: { url: qr }, caption: `✅ ${t('p.qrcode.generated')}` }, { quoted: message });
        }
        catch (err) {
            console.error('QR plugin error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.qrcode.failed')}` }, { quoted: message });
        }
    }
};
