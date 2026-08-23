import { downloadImage, imageErrorKey, mirrorImage } from '../lib/imageEffects.js';

export default {
    command: 'jooj',
    aliases: ['espelhoesquerdo'],
    category: 'images',
    description: 'Mirror the left half of a photo',
    usage: '.jooj (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await mirrorImage(await downloadImage(message), 'left');
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.joojCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const key = imageErrorKey(error);
            if (key === 'failed')
                console.error('[JOOJ] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.imagefx.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
