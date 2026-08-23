import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { groqVision, hasGroqKey } from '../lib/groq.js';
import config from '../config.js';
import sharp from 'sharp';

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

function getVisionMedia(message) {
    const current = message.message || {};
    const quoted = current.extendedTextMessage?.contextInfo?.quotedMessage || {};
    const image = current.imageMessage || quoted.imageMessage;
    if (image)
        return image;
    const sticker = current.stickerMessage || quoted.stickerMessage;
    return sticker ? { ...sticker, __isSticker: true } : null;
}

async function toBuffer(media) {
    const isSticker = media.__isSticker === true;
    if (isSticker && media.isAnimated)
        throw new Error('Animated stickers are not supported by .vision');
    const stream = await downloadContentFromMessage(media, isSticker ? 'sticker' : 'image');
    const chunks = [];
    for await (const chunk of stream)
        chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    return isSticker
        ? { buffer: await sharp(buffer).png().toBuffer(), mimetype: 'image/png' }
        : { buffer, mimetype: media.mimetype || 'image/jpeg' };
}

export default {
    command: 'vision',
    aliases: ['visao', 'imagem'],
    category: 'ai',
    description: 'Analyze an image with Groq Vision',
    usage: '.vision <instruction> (send or reply to an image or static sticker)',
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
        const media = getVisionMedia(message);
        if (!media) {
            return sock.sendMessage(chatId, { text: `🖼️ ${t('p.vision.noImage')}`, ...channelInfo }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: `🔎 ${t('p.vision.processing')}`, ...channelInfo }, { quoted: message });
            const { buffer, mimetype } = await toBuffer(media);
            const sizeInstruction = {
                small: 'Responda em poucas frases, destacando apenas o essencial.',
                medium: 'Responda de forma objetiva, com detalhes suficientes para atender ao pedido.',
                big: 'Responda com bastante detalhe, mas sem expor seu raciocínio interno.'
            }[config.groqVisionResponseSize];
            const visionPrompt = `${prompt}\n\nResponda no idioma da instrução. ${sizeInstruction} Não mostre seu raciocínio interno nem use tags <think>.`;
            const rawResult = await groqVision(buffer, mimetype, visionPrompt);
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
