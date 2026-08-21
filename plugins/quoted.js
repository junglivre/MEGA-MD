import axios from 'axios';
import { Sticker, StickerTypes } from 'stickers-formatter';
export default {
    command: 'quoted',
    aliases: ['q', 'fakereply'],
    category: 'stickers',
    description: 'Generate a quote sticker from text',
    usage: '.quote <text> or reply to a message',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const ctx = message.message?.extendedTextMessage?.contextInfo;
        let text = args.join(' ').trim();
        if (!text) {
            const q = ctx?.quotedMessage;
            if (!q)
                return sock.sendMessage(chatId, { text: t('p.quoted.missingText') }, { quoted: message });
            text = q.conversation
                || q.extendedTextMessage?.text
                || q.imageMessage?.caption
                || q.videoMessage?.caption
                || t('p.quoted.mediaFallback');
        }
        const who = ctx?.participant
            || ctx?.mentionedJid?.[0]
            || message.key.participant
            || message.key.remoteJid;
        const [userPfp, contactInfo] = await Promise.allSettled([
            sock.profilePictureUrl(who, 'image'),
            sock.onWhatsApp(who)
        ]);
        const pfp = userPfp.status === 'fulfilled'
            ? userPfp.value
            : 'https://i.ibb.co/9HY4wjz/a4c0b1af253197d4837ff6760d5b81c0.jpg';
        const contactValue = contactInfo.status === 'fulfilled' ? contactInfo.value : null;
        // Try multiple sources for name
        const storeContact = sock.store?.contacts?.[who];
        const userName = storeContact?.name
            || storeContact?.notify
            || contactValue?.[0]?.notify
            || (who.includes('@s.whatsapp.net') ? `+${ who.replace('@s.whatsapp.net', '')}` : t('p.quoted.userFallback'));
        try {
            const res = await axios.post('https://bot.lyo.su/quote/generate', {
                type: 'quote',
                format: 'png',
                backgroundColor: '#FFFFFF',
                width: 1800,
                height: 200,
                scale: 2,
                messages: [{
                        entities: [],
                        avatar: true,
                        from: { id: 1, name: userName, photo: { url: pfp } },
                        text,
                        replyMessage: {}
                    }]
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });
            if (!res.data?.result?.image)
                throw new Error('Invalid API response');
            const bufferImage = Buffer.from(res.data.result.image, 'base64');
            try {
                const stickerBuffer = await new Sticker(bufferImage, {
                    pack: 'MEGA-MD',
                    author: userName,
                    type: StickerTypes.FULL,
                    categories: ['🤩', '🎉'],
                    quality: 100,
                    background: '#00000000'
                }).toBuffer();
                await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });
            }
            catch {
                await sock.sendMessage(chatId, { image: bufferImage, caption: t('p.quoted.stickerFallbackCaption') }, { quoted: message });
            }
        }
        catch (err) {
            console.error('Quote plugin error:', err);
            const msg = err.message.includes('timeout')
                ? t('p.quoted.errorTimeout')
                : err.message.includes('Invalid API')
                    ? t('p.quoted.errorInvalidApi')
                    : t('p.quoted.errorGeneric');
            await sock.sendMessage(chatId, { text: t('p.quoted.failed', { reason: msg }) }, { quoted: message });
        }
    }
};
