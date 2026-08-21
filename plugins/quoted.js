import axios from 'axios';
import { Sticker, StickerTypes } from 'stickers-formatter';
import config from '../config.js';
import store from '../lib/lightweight_store.js';

const QUOTE_API_URL = config.quoteApiUrl;
const DEFAULT_AVATAR = 'https://i.ibb.co/9HY4wjz/a4c0b1af253197d4837ff6760d5b81c0.jpg';
const COLOR_NAMES = new Set(['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'transparent', 'random']);

function unwrapMessage(message) {
    let current = message || {};
    for (let i = 0; i < 4; i += 1) {
        const wrapped = current.ephemeralMessage?.message
            || current.viewOnceMessage?.message
            || current.viewOnceMessageV2?.message
            || current.documentWithCaptionMessage?.message;
        if (!wrapped)
            break;
        current = wrapped;
    }
    return current;
}

function extractText(message, fallback) {
    const current = unwrapMessage(message);
    return current.conversation
        || current.extendedTextMessage?.text
        || current.imageMessage?.caption
        || current.videoMessage?.caption
        || current.documentMessage?.caption
        || current.audioMessage?.caption
        || current.buttonsResponseMessage?.selectedDisplayText
        || current.listResponseMessage?.title
        || fallback;
}

function getContextInfo(message) {
    const current = unwrapMessage(message);
    return current.extendedTextMessage?.contextInfo
        || current.imageMessage?.contextInfo
        || current.videoMessage?.contextInfo
        || current.documentMessage?.contextInfo
        || {};
}

function parseOptions(args) {
    const options = {
        backgroundColor: '#FFFFFF',
        format: 'webp',
        type: 'quote',
        scale: 2,
        output: 'sticker',
        reply: false,
        count: 1,
        text: []
    };
    for (const token of args) {
        const lower = token.toLowerCase();
        if (lower === 'r' || lower === 'reply')
            options.reply = true;
        else if (/^\d+$/.test(lower))
            options.count = Math.min(20, Math.max(1, Number(lower)));
        else if (lower === 'img' || lower === 'image' || lower === 'jpg' || lower === 'png') {
            options.type = 'image';
            options.format = 'png';
            options.output = 'image';
        }
        else if (lower === 'document' || lower === 'doc') {
            options.type = 'image';
            options.format = 'png';
            options.output = 'document';
        }
        else if (/^s(?:cale)?[+-]?(?:\d*\.)?\d+$/i.test(lower))
            options.scale = Number(lower.replace(/^s(?:cale)?/i, '')) || 2;
        else if (lower === 'random' || lower === 'transparent' || COLOR_NAMES.has(lower) || /^#?[0-9a-f]{6}$/i.test(token) || /^#?[0-9a-f]{3}$/i.test(token))
            options.backgroundColor = lower === 'random' ? 'random' : token;
        else
            options.text.push(token);
    }
    options.scale = Math.min(20, Math.max(1, options.scale));
    return options;
}

function getContactName(sock, jid, contactInfo, fallback) {
    const contact = sock.store?.contacts?.[jid];
    const normalized = contactInfo?.[0];
    return contact?.name
        || contact?.notify
        || normalized?.name
        || normalized?.notify
        || (jid?.includes('@s.whatsapp.net') ? `+${jid.replace('@s.whatsapp.net', '')}` : fallback);
}

async function getSender(sock, jid, fallback) {
    const [profile, contact] = await Promise.allSettled([
        jid ? sock.profilePictureUrl(jid, 'image') : Promise.reject(new Error('no jid')),
        jid ? sock.onWhatsApp(jid) : Promise.resolve(null)
    ]);
    return {
        name: getContactName(sock, jid, contact.status === 'fulfilled' ? contact.value : null, fallback),
        avatar: profile.status === 'fulfilled' ? profile.value : DEFAULT_AVATAR,
        id: Math.abs([...String(jid || 'user')].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7))
    };
}

function sourceFromStored(stored) {
    return stored?.message ? stored : null;
}

function selectSources(message, chatId, count) {
    const quotedContext = getContextInfo(message);
    const quoted = quotedContext.quotedMessage;
    if (!quoted)
        return [];
    const quotedId = quotedContext.stanzaId;
    const stored = (store.messages?.[chatId] || []).map(sourceFromStored).filter(Boolean);
    if (count <= 1 || stored.length === 0)
        return [{ key: { participant: quotedContext.participant || message.key.participant || chatId }, message: quoted }];
    const index = stored.findIndex(item => item.key?.id === quotedId);
    if (index === -1)
        return [{ key: { participant: quotedContext.participant || message.key.participant || chatId }, message: quoted }];
    return stored.slice(Math.max(0, index - count + 1), index + 1);
}

function makeReplyPreview(source) {
    const nested = getContextInfo(source.message).quotedMessage;
    if (!nested)
        return {};
    return {
        name: source.pushName || 'WhatsApp user',
        text: extractText(nested, 'Mensagem respondida')
    };
}

async function buildQuoteMessages(sock, sources, typedText, options, fallbackName) {
    return Promise.all(sources.map(async (source, index) => {
        const context = getContextInfo(source.message);
        const who = source.key?.participant || source.participant || context.participant || source.key?.remoteJid;
        const sender = await getSender(sock, who, source.pushName || fallbackName);
        const text = typedText && sources.length === 1
            ? typedText
            : extractText(source.message, 'Mensagem de mídia');
        return {
            entities: [],
            avatar: index === 0 || sources[index - 1]?.key?.participant !== source.key?.participant,
            chatId: sender.id,
            from: { id: sender.id, name: sender.name, photo: { url: sender.avatar } },
            text,
            replyMessage: options.reply ? makeReplyPreview(source) : {}
        };
    }));
}

async function renderQuote(options, messages) {
    const width = options.output === 'sticker' ? 512 : 1800;
    const height = options.output === 'sticker' ? 768 : 1200;
    const response = await axios.post(QUOTE_API_URL, {
        type: options.type,
        format: options.format,
        backgroundColor: options.backgroundColor,
        width,
        height,
        scale: options.scale,
        messages
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
    const encoded = response.data?.result?.image;
    if (!encoded)
        throw new Error('Invalid quote renderer response');
    return Buffer.from(encoded, 'base64');
}

export default {
    command: 'quoted',
    aliases: ['q', 'quotely', 'fakereply'],
    category: 'stickers',
    description: 'Generate a QuotLy-style quote sticker or image',
    usage: '.q [count] [r] [img|png|doc|color|s2] <text> or reply to a message',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const options = parseOptions(args);
        const typedText = options.text.join(' ').trim();
        const sources = selectSources(message, chatId, options.count);
        if (!typedText && sources.length === 0)
            return sock.sendMessage(chatId, { text: t('p.quoted.missingText') }, { quoted: message });
        const sourceList = sources.length > 0
            ? sources
            : [{ key: { participant: message.key.participant || chatId }, message: { conversation: typedText } }];
        try {
            const messages = await buildQuoteMessages(sock, sourceList, typedText, options, t('p.quoted.userFallback'));
            const bufferImage = await renderQuote(options, messages);
            const author = messages[0]?.from?.name || t('p.quoted.userFallback');
            if (options.output === 'image')
                return sock.sendMessage(chatId, { image: bufferImage, caption: t('p.quoted.imageCaption') }, { quoted: message });
            if (options.output === 'document')
                return sock.sendMessage(chatId, { document: bufferImage, mimetype: 'image/png', fileName: 'quote.png' }, { quoted: message });
            try {
                const stickerBuffer = await new Sticker(bufferImage, {
                    pack: 'MEGA-MD', author, type: StickerTypes.FULL,
                    categories: ['🤩', '🎉'], quality: 100, background: '#00000000'
                }).toBuffer();
                return sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });
            }
            catch (error) {
                console.error('[QUOTED] Sticker conversion failed:', error.message);
                return sock.sendMessage(chatId, { image: bufferImage, caption: t('p.quoted.stickerFallbackCaption') }, { quoted: message });
            }
        }
        catch (error) {
            console.error('[QUOTED] Quote generation failed:', error);
            const messageKey = error.code === 'ECONNABORTED' || error.message?.includes('timeout')
                ? 'p.quoted.errorTimeout'
                : error.message?.includes('Invalid quote') ? 'p.quoted.errorInvalidApi' : 'p.quoted.errorGeneric';
            return sock.sendMessage(chatId, { text: t('p.quoted.failed', { reason: t(messageKey) }) }, { quoted: message });
        }
    }
};
