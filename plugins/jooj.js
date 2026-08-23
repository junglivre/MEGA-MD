import { imageErrorReply, mirrorImage, resolveImageInput } from '../lib/imageEffects.js';

export default {
    command: 'jooj',
    aliases: ['espelhoesquerdo'],
    category: 'images',
    description: 'Mirror the left half of a photo',
    usage: '.jooj [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await mirrorImage(await resolveImageInput(sock, message, chatId), 'left');
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.joojCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[JOOJ] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
