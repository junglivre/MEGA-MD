import { createSamImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

export default {
    command: 'sam',
    aliases: ['southamericamemes', 'selo'],
    category: 'images',
    description: 'Stamp a photo with a South America Memes-style badge',
    usage: '.sam [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createSamImage(await resolveImageInput(sock, message, chatId), {
                title: t('p.imagefx.samTitle'),
                subtitle: t('p.imagefx.samSubtitle')
            });
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.samCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[SAM] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
