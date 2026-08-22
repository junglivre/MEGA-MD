import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { groqVision, hasGroqKey } from '../lib/groq.js';
import config from '../config.js';

function formatWhatsAppMarkdown(input) {
    let text = String(input || '').replace(/\r/g, '').trim();
    const protectedParts = [];
    const protect = (value) => {
        const token = `\u0000${protectedParts.length}\u0000`;
        protectedParts.push(value);
        return token;
    };
    text = text.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_match, code) => protect('```' + code.trim() + '```'));
    text = text.replace(/`([^`\n]+)`/g, (_match, code) => protect('```' + code.trim() + '```'));
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
    text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    text = text.replace(/^\s*[-*+]\s+/gm, '• ');
    text = text.replace(/^\s*>\s?/gm, '│ ');
    text = text.replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, '────────');
    text = text.replace(/\*\*(.+?)\*\*/gs, (_match, value) => protect(`*${value.trim()}*`));
    text = text.replace(/__(.+?)__/gs, (_match, value) => protect(`*${value.trim()}*`));
    text = text.replace(/~~(.+?)~~/gs, '~$1~');
    text = text.replace(/\*([^*\n]+)\*/g, '_$1_');
    for (const [index, value] of protectedParts.entries())
        text = text.replace(`\u0000${index}\u0000`, value);
    return text.replace(/\n{3,}/g, '\n\n').trim();
}

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
            const sizeInstruction = {
                small: 'Responda em poucas frases, destacando apenas o essencial.',
                medium: 'Responda de forma objetiva, com detalhes suficientes para atender ao pedido.',
                big: 'Responda com bastante detalhe, mas sem expor seu raciocínio interno.'
            }[config.groqVisionResponseSize];
            const visionPrompt = `${prompt}\n\nResponda no idioma da instrução. ${sizeInstruction} Não mostre seu raciocínio interno nem use tags <think>.`;
            const rawResult = await groqVision(buffer, image.mimetype, visionPrompt);
            const result = formatWhatsAppMarkdown(rawResult);
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
