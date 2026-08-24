import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createPassingPaperImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/passing-paper.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'passingpaper',
    aliases: ['bilhete', 'quizkid'],
    category: 'images',
    description: 'Put a photo on the passing paper meme',
    usage: '.passingpaper [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createPassingPaperImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.passingPaperCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[PASSINGPAPER] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
