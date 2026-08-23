import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createMorrePragaImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/morre-praga.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'morrepraga',
    aliases: ['dieplague', 'morre'],
    category: 'images',
    description: 'Put a photo in the classic Morre Praga meme',
    usage: '.morrepraga [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createMorrePragaImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.morrePragaCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[MORREPRAGA] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
