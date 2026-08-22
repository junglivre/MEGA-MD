import axios from 'axios';
import { Sticker, StickerTypes } from 'stickers-formatter';
import config from '../config.js';
import store from '../lib/lightweight_store.js';

const QUOTE_API_URL = config.quoteApiUrl;
const COLOR_NAMES = new Set(['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'transparent', 'random']);

function unwrapMessage(message) {
    // Baileys passes a full WAMessage to plugins, while stored/quoted
    // messages are often already the inner `message` content object.
    let current = message?.message || message || {};
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
    return current.contextInfo
        || current.extendedTextMessage?.contextInfo
        || current.imageMessage?.contextInfo
        || current.videoMessage?.contextInfo
        || current.documentMessage?.contextInfo
        || current.audioMessage?.contextInfo
        || current.buttonsResponseMessage?.contextInfo
        || current.listResponseMessage?.contextInfo
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
        // The quote API renders an initial when photo is empty. Do not use a
        // generic fallback image here: it hides who actually sent the message.
        avatar: profile.status === 'fulfilled' ? profile.value : null,
        id: Math.abs([...String(jid || 'user')].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7))
    };
}

function sourceFromStored(stored) {
    return stored?.message ? stored : null;
}

function sourceFromQuoted(quoted, context, fallbackParticipant) {
    if (!quoted)
        return null;
    return {
        key: {
            id: context?.stanzaId,
            participant: context?.participant || fallbackParticipant
        },
        message: quoted,
        pushName: context?.pushName
    };
}

function getReplyChainFromSource(initial) {
    const chain = [];
    let current = initial;
    const seen = new Set();
    while (current && chain.length < 20) {
        const id = current.key?.id || `nested-${chain.length}`;
        if (seen.has(id))
            break;
        seen.add(id);
        chain.unshift(current);
        const nestedContext = getContextInfo(current.message);
        current = sourceFromQuoted(nestedContext.quotedMessage, nestedContext, current.key?.participant);
    }
    return chain;
}

function getReplyChain(message, quotedContext, stored) {
    const quotedId = String(quotedContext.stanzaId || '');
    const storedSource = stored.find(item => String(item.key?.id || '') === quotedId);
    const initial = storedSource
        || sourceFromQuoted(quotedContext.quotedMessage, quotedContext, message.key?.participant);
    return getReplyChainFromSource(initial);
}

function selectSources(message, chatId, count, includeReplyChain = false) {
    const quotedContext = getContextInfo(message);
    const quoted = quotedContext.quotedMessage;
    const currentId = message.key?.id;
    const stored = (store.messages?.[chatId] || [])
        .map(sourceFromStored)
        .filter(item => item && item.key?.id !== currentId)
        .sort((a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0));
    if (!quoted)
        return stored.slice(-count);
    // With a single count, `r` means follow the reply chain. When a count is
    // provided (e.g. `.q 4 r`), keep the normal message window and only add
    // reply previews to the messages that contain one.
    if (includeReplyChain && count <= 1)
        return getReplyChain(message, quotedContext, stored);
    const quotedId = quotedContext.stanzaId;
    if (count <= 1 || stored.length === 0)
        return [{ key: { participant: quotedContext.participant || message.key.participant || chatId }, message: quoted }];
    const index = stored.findIndex(item => String(item.key?.id || '') === String(quotedId || ''));
    // Count forward from the selected message. This matches the chat order:
    // replying to message 1 with `.q 2` quotes message 1 and message 2.
    if (index === -1)
        return stored.slice(-count);
    return stored.slice(index, index + count);
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
    const resolved = await Promise.all(sources.map(async (source) => {
        const context = getContextInfo(source.message);
        const who = source.key?.participant || source.participant || context.participant || source.key?.remoteJid;
        const sender = await getSender(sock, who, source.pushName || fallbackName);
        return { source, sender };
    }));

    return resolved.map(({ source, sender }, index) => {
        const previous = resolved[index - 1]?.sender;
        const next = resolved[index + 1]?.sender;
        const sameAsPrevious = previous && (previous.id === sender.id || previous.name === sender.name);
        const sameAsNext = next && next.id === sender.id;
        const text = typedText && sources.length === 1
            ? typedText
            : extractText(source.message, 'Mensagem de mídia');
        return {
            entities: [],
            // QuotLy renders the avatar on the last message of a sender run.
            avatar: !sameAsNext,
            chatId: sender.id,
            // The renderer shows a name on every message unless we explicitly
            // suppress it. Keep first_name for the initials-avatar fallback.
            from: sameAsPrevious
                ? { id: sender.id, name: false, first_name: sender.name, photo: sender.avatar ? { url: sender.avatar } : {} }
                : { id: sender.id, name: sender.name, photo: sender.avatar ? { url: sender.avatar } : {} },
            text,
            replyMessage: options.reply ? makeReplyPreview(source) : {}
        };
    });
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
        const sources = selectSources(message, chatId, options.count, options.reply);
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
