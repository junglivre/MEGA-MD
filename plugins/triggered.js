import { createTriggeredGif, downloadImage, gifToMp4 } from '../lib/imageEffects.js';

export default {
    command: 'triggered',
    aliases: ['gatilhado'],
    category: 'images',
    description: 'Create an animated triggered meme from a photo',
    usage: '.triggered (send or reply to an image or static sticker)',
    cooldown: 5000,
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const gif = await createTriggeredGif(await downloadImage(message));
            const video = await gifToMp4(gif);
            await sock.sendMessage(chatId, {
                video,
                gifPlayback: true,
                mimetype: 'video/mp4',
                caption: t('p.imagefx.triggeredCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const key = error.code === 'NO_IMAGE' ? 'noImage'
                : error.code === 'ANIMATED_STICKER' ? 'animatedSticker'
                    : 'failed';
            if (key === 'failed')
                console.error('[TRIGGERED] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.imagefx.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
