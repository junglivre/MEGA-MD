import { downloadImage, imageErrorKey, invertImage } from '../lib/imageEffects.js';

export default {
    command: 'invert',
    aliases: ['negative', 'inverter'],
    category: 'images',
    description: 'Convert a photo to its color negative locally',
    usage: '.invert (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await invertImage(await downloadImage(message));
            await sock.sendMessage(chatId, {
                image: result,
                caption: `🤍 ${t('p.invert.success')}`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const key = imageErrorKey(error);
            if (key === 'failed')
                console.error('[INVERT] Error:', error.message);
            const translationKey = key === 'failed' ? 'p.invert.failed' : `p.imagefx.${key}`;
            await sock.sendMessage(chatId, { text: `❌ ${t(translationKey)}`, ...channelInfo }, { quoted: message });
        }
    }
};
