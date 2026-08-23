import { createAsciiImage, downloadImage } from '../lib/imageEffects.js';

export default {
    command: 'ascii',
    aliases: ['asciiart', 'img2ascii', 'image2ascii'],
    category: 'images',
    description: 'Turn a photo into ASCII art',
    usage: '.ascii [invert] (send or reply to an image or static sticker)',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const invert = args.some(arg => ['invert', 'inverter', 'claro'].includes(arg.toLowerCase()));
            const result = await createAsciiImage(await downloadImage(message), { invert });
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.asciiCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const key = error.code === 'NO_IMAGE' ? 'noImage'
                : error.code === 'ANIMATED_STICKER' ? 'animatedSticker'
                    : 'failed';
            if (key === 'failed')
                console.error('[ASCII] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.imagefx.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
