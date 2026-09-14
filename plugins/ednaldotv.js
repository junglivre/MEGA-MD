import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createEdnaldoTvImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/ednaldo-tv.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'ednaldotv',
    aliases: [],
    category: 'images',
    description: 'Put a photo on Ednaldo Pereira television',
    usage: '.ednaldotv [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createEdnaldoTvImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.ednaldoTvCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[EDNALDOTV] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
