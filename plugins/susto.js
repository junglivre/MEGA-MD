import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createScaredImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/susto.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'susto',
    aliases: ['scared', 'fright'],
    category: 'images',
    description: 'Put a photo in the Loritta scared comic',
    usage: '.susto [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createScaredImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.scaredCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[SUSTO] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
