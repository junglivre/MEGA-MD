import { imageErrorReply, mirrorImage, resolveImageInput } from '../lib/imageEffects.js';

export default {
    command: 'ojjo',
    aliases: ['espelhodireito'],
    category: 'images',
    description: 'Mirror the right half of a photo',
    usage: '.ojjo [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await mirrorImage(await resolveImageInput(sock, message, chatId), 'right');
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.ojjoCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[OJJO] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
