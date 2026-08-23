import {
    createForgivenessImage,
    downloadImage,
    imageErrorKey
} from '../lib/imageEffects.js';

export default {
    command: 'perdao',
    aliases: ['perdão', 'forgive'],
    category: 'images',
    description: 'Put a dramatic forgiveness poll below a photo',
    usage: '.perdao (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createForgivenessImage(await downloadImage(message), {
                question: t('p.imagefx.forgivenessQuestion'),
                no: t('p.imagefx.no'),
                yes: t('p.imagefx.yes')
            });
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.forgivenessCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const key = imageErrorKey(error);
            if (key === 'failed')
                console.error('[PERDAO] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.imagefx.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
