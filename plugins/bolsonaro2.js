import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createBolsonaroTv2Image, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/bolsonaro-tv2.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'bolsonaro2',
    aliases: ['bolsonarotv2'],
    category: 'images',
    description: 'Put a photo on the second Bolsonaro television meme',
    usage: '.bolsonaro2 [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createBolsonaroTv2Image(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.bolsonaroTv2Caption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[BOLSONARO2] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
