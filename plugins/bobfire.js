import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createBobFireImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/bobfire.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'bobfire',
    aliases: ['bobburningpaper', 'bobpaperfire', 'bobpapelfogo', 'bobfogo'],
    category: 'images',
    description: 'Put a photo on the paper SpongeBob burns',
    usage: '.bobfire [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createBobFireImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.bobFireCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[BOBFIRE] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
