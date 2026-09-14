import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createBuckShirtImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/buck-shirt.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'buckshirt',
    aliases: ['buckcamisa'],
    category: 'images',
    description: 'Print a photo on the three Buck shirt panels',
    usage: '.buckshirt [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createBuckShirtImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.buckShirtCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[BUCKSHIRT] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
