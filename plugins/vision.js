import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { groqVision, hasGroqKey } from '../lib/groq.js';

function getImageMessage(message) {
    const current = message.message || {};
    const quoted = current.extendedTextMessage?.contextInfo?.quotedMessage || {};
    return current.imageMessage || quoted.imageMessage || null;
}

async function toBuffer(media) {
    const stream = await downloadContentFromMessage(media, 'image');
    const chunks = [];
    for await (const chunk of stream)
        chunks.push(chunk);
    return Buffer.concat(chunks);
}

export default {
    command: 'vision',
    aliases: ['visao', 'imagem'],
    category: 'ai',
    description: 'Analyze an image with Groq Vision',
    usage: '.vision <instruction> (send or reply to an image)',
    cooldown: 5000,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        if (!hasGroqKey()) {
            return sock.sendMessage(chatId, { text: `❌ ${t('p.vision.noKey')}`, ...channelInfo }, { quoted: message });
        }
        const prompt = args.join(' ').trim();
        if (!prompt) {
            return sock.sendMessage(chatId, { text: `🖼️ ${t('p.vision.noPrompt')}`, ...channelInfo }, { quoted: message });
        }
        const image = getImageMessage(message);
        if (!image) {
            return sock.sendMessage(chatId, { text: `🖼️ ${t('p.vision.noImage')}`, ...channelInfo }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: `🔎 ${t('p.vision.processing')}`, ...channelInfo }, { quoted: message });
            const buffer = await toBuffer(image);
            const result = await groqVision(buffer, image.mimetype, prompt);
            if (!result)
                throw new Error('Groq returned an empty vision response');
            await sock.sendMessage(chatId, { text: `🖼️ *${t('p.vision.resultTitle')}:*\n\n${result}`, ...channelInfo }, { quoted: message });
        }
        catch (error) {
            console.error('[VISION] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.vision.failed', { error: error.message })}`, ...channelInfo }, { quoted: message });
        }
    }
};
