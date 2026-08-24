import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createBriggsCoverImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/briggs-cover.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'briggscover',
    aliases: ['coverbriggs', 'capabriggs', 'briggscapa'],
    category: 'images',
    description: 'Put a photo on the Briggs cover meme',
    usage: '.briggscover [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createBriggsCoverImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.briggsCoverCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[BRIGGSCOVER] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
