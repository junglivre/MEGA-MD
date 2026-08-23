import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createRipTvImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/rip-tv.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'riptv',
    aliases: [],
    category: 'images',
    description: 'Put a photo on the RIP television meme',
    usage: '.riptv [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createRipTvImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.ripTvCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[RIPTV] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
