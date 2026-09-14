import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createWolverineFrameImage, imageErrorReply, resolveImageInput } from '../lib/imageEffects.js';

const templatePath = fileURLToPath(new URL('../assets/image-effects/wolverine-frame.png', import.meta.url));
const templatePromise = fs.readFile(templatePath);

export default {
    command: 'quadro',
    aliases: ['frame', 'picture', 'wolverine'],
    category: 'images',
    description: 'Put a photo in Wolverine picture frame',
    usage: '.quadro [@user] (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createWolverineFrameImage(
                await resolveImageInput(sock, message, chatId),
                await templatePromise
            );
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.wolverineFrameCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const reply = imageErrorReply(error, t);
            if (reply.key === 'failed')
                console.error('[QUADRO] Error:', error.message);
            await sock.sendMessage(chatId, { text: reply.text, ...channelInfo }, { quoted: message });
        }
    }
};
