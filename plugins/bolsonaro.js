import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createBolsonaroTvImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/bolsonaro-tv.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'bolsonaro',
    aliases: ['bolsonarotv'],
    category: 'images',
    description: 'Put a photo on the Bolsonaro television meme',
    usage: '.bolsonaro [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createBolsonaroTvImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.bolsonaroTvCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[BOLSONARO] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
