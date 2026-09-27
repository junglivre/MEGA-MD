import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createMitoJogaImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/mitojoga.jpeg', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'mitojoga',
    aliases: ['mito', 'jogamito'],
    category: 'images',
    description: 'Put a photo on the Mito Joga computer monitor',
    usage: '.mitojoga [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createMitoJogaImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.mitoJogaCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[MITOJOGA] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
