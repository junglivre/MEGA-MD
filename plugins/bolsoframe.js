import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createBolsoFrameImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/bolsoframe.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'bolsoframe',
    aliases: ['bolsonaroframe', 'bolsoquadro', 'bolsonaroquadro'],
    category: 'images',
    description: 'Put a photo in the framed Bolsonaro meme',
    usage: '.bolsoframe [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createBolsoFrameImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.bolsoFrameCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[BOLSOFRAME] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
