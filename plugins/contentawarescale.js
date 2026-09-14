import {
    createContentAwareScaleImage,
    imageErrorReply,
    resolveImageInput
} from '../lib/imageEffects.js';

export default {
    command: 'contentawarescale',
    aliases: ['cas', 'contentaware', 'seamcarver'],
    category: 'images',
    description: 'Distort a photo using local content-aware seam carving',
    usage: '.contentawarescale [@user] (send or reply to an image or static sticker)',
    cooldown: 5000,
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createContentAwareScaleImage(await resolveImageInput(sock, message, chatId));
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.contentAwareCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[CONTENT-AWARE] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
