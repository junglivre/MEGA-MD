import { createPrideOverlayImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

export default {
    command: 'gay',
    aliases: ['pride', 'arcoiris'],
    category: 'images',
    description: 'Apply a subtle rainbow flag overlay to a photo',
    usage: '.gay [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createPrideOverlayImage(await resolveImageInput(sock, message, chatId));
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.gayCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[GAY] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
