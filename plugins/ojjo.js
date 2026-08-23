import { downloadImage, imageErrorKey, mirrorImage } from '../lib/imageEffects.js';

export default {
    command: 'ojjo',
    aliases: ['espelhodireito'],
    category: 'images',
    description: 'Mirror the right half of a photo',
    usage: '.ojjo (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await mirrorImage(await downloadImage(message), 'right');
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.ojjoCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const key = imageErrorKey(error);
            if (key === 'failed')
                console.error('[OJJO] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.imagefx.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
