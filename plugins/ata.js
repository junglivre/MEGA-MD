import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createAtaImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/ata.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'ata',
    aliases: ['monicaata', 'mônicaata'],
    category: 'images',
    description: 'Put a photo on Monica computer screen',
    usage: '.ata [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createAtaImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.ataCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[ATA] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
