import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createRipLifeImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/ripvida.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'ripvida',
    aliases: ['riplife'],
    category: 'images',
    description: 'Put a photo in the RIP life meme',
    usage: '.ripvida [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createRipLifeImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.ripLifeCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[RIPVIDA] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
