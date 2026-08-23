import { createSamImage, downloadImage, imageErrorKey } from '../lib/imageEffects.js';

export default {
    command: 'sam',
    aliases: ['southamericamemes', 'selo'],
    category: 'images',
    description: 'Stamp a photo with a South America Memes-style badge',
    usage: '.sam (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createSamImage(await downloadImage(message), {
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
            const key = imageErrorKey(error);
            if (key === 'failed')
                console.error('[SAM] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.imagefx.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
