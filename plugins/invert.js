import { imageErrorReply, invertImage, resolveImageInput } from '../lib/imageEffects.js';

export default {
    command: 'invert',
    aliases: ['negative', 'inverter'],
    category: 'images',
    description: 'Convert a photo to its color negative locally',
    usage: '.invert [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await invertImage(await resolveImageInput(sock, message, chatId));
            await sock.sendMessage(chatId, {
                image: result,
                caption: `🤍 ${t('p.invert.success')}`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t, 'p.invert.failed');
            if (reply.key === 'failed')
                console.error('[INVERT] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
