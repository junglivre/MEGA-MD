import { createAsciiImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

export default {
    command: 'ascii',
    aliases: ['asciiart', 'img2ascii', 'image2ascii'],
    category: 'images',
    description: 'Turn a photo into ASCII art',
    usage: '.ascii [invert] [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const invert = args.some(arg => ['invert', 'inverter', 'claro'].includes(arg.toLowerCase()));
            const result = await createAsciiImage(await resolveImageInput(sock, message, chatId), { invert });
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.asciiCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[ASCII] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
