import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
export default {
    command: 'readqr',
    aliases: ['qrread', 'decodeqr'],
    category: 'tools',
    description: 'Read QR code from an image',
    usage: 'Reply to an image with .readqr',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        try {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted?.imageMessage) {
                return await sock.sendMessage(chatId, { text: `🧾 *${t('p.readqr.title')}*\n\n📌 ${t('p.readqr.noImage')}\n\nUsage:\n.readqr` }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                react: { text: '🔍', key: message.key }
            });
            const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            const tempFile = path.join(process.cwd(), `qr_${Date.now()}.png`);
            fs.writeFileSync(tempFile, buffer);
            const form = new FormData();
            form.append('apikey', 'guru');
            form.append('image', fs.createReadStream(tempFile));
            const res = await axios.post('https://discardapi.dpdns.org/api/tools/readqr', form, { headers: form.getHeaders(), timeout: 60000 });
            fs.unlinkSync(tempFile);
            if (!res?.data?.status)
                throw new Error('Decode failed');
            await sock.sendMessage(chatId, {
                text: `✅ *${t('p.readqr.decoded')}*

📄 *${t('p.readqr.result')}:*
\`\`\`
${res.data.result}
\`\`\`

👤 ${res.data.creator}
`
            }, { quoted: message });
        }
        catch (err) {
            console.error('QR Reader Error:', err);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.readqr.failed')}` }, { quoted: message });
        }
    }
};
