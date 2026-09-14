import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createPerfectImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/perfeito.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'perfeito',
    aliases: ['perfect'],
    category: 'images',
    description: 'Place a photo in the classic nothing-is-perfect meme',
    usage: '.perfeito [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createPerfectImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.perfectCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[PERFEITO] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
