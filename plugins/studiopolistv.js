import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createStudiopolisTvImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/studiopolis-tv.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'studiopolistv',
    aliases: ['studiopolis'],
    category: 'images',
    description: 'Put a photo on the Studiopolis television',
    usage: '.studiopolistv [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createStudiopolisTvImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.studiopolisTvCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[STUDIOPOLISTV] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
