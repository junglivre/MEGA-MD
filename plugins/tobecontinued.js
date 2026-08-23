import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import {
    createToBeContinuedImage,
    downloadImage,
    imageErrorKey
} from '../lib/imageEffects.js';

const overlayPath = fileURLToPath(new URL('../assets/image-effects/to-be-continued.png', import.meta.url));
const overlayPromise = fs.readFile(overlayPath);

export default {
    command: 'tobecontinued',
    aliases: ['continua', 'continuara'],
    category: 'images',
    description: 'Give a photo a vintage to-be-continued ending',
    usage: '.tobecontinued (send or reply to an image or static sticker)',
    async handler(sock, message, _args, context) {
        const { chatId, channelInfo, t } = context;
        try {
            const result = await createToBeContinuedImage(await downloadImage(message), await overlayPromise);
            await sock.sendMessage(chatId, {
                image: result,
                caption: t('p.imagefx.toBeContinuedCaption'),
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            const key = imageErrorKey(error);
            if (key === 'failed')
                console.error('[TOBECONTINUED] Error:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.imagefx.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
