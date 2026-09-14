import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createPepeDreamImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/pepe-dream.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'pepedream',
    aliases: ['sonhopepe', 'pepesonho'],
    category: 'images',
    description: 'Put a photo inside Pepe dream bubble',
    usage: '.pepedream [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createPepeDreamImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.pepeDreamCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[PEPEDREAM] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
