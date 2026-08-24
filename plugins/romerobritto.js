import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createRomeroBrittoImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/romero-britto.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'romerobritto',
    aliases: ['pintura', 'painting'],
    category: 'images',
    description: 'Put a photo on the Romero Britto canvas meme',
    usage: '.romerobritto [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createRomeroBrittoImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.romeroBrittoCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[ROMEROBRITTO] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
