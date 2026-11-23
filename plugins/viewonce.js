import config from '../config.js';
import { downloadViewOnce, resolveQuotedViewOnce, ViewOnceExpiredError } from '../lib/viewOnce.js';

// Only a mobile companion (DEVICE_TYPE=mobile) receives view-once media at all;
// on desktop WhatsApp withholds it, so the command stays out of the menu there.
const supported = config.deviceType === 'mobile';

export default {
    command: 'viewonce',
    aliases: ['vo', 'obtainvo', 'visunica', 'visuunica', 'viewmedia', 'vv'],
    category: 'general',
    description: 'Re-send a view-once photo, video or audio as normal media',
    usage: '.vo (reply to a view-once photo, video or audio)',
    hidden: !supported,
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        if (!supported) {
            return sock.sendMessage(chatId, { text: `⚠️ ${t('p.viewonce.desktopMode')}` }, { quoted: message });
        }
        try {
            const found = await resolveQuotedViewOnce(sock, message, chatId);
            if (found.status !== 'ok') {
                const key = found.status === 'none' ? 'noMedia' : found.status;
                const prefix = found.status === 'expired' ? '⌛' : '⚠️';
                return sock.sendMessage(chatId, { text: `${prefix} ${t(`p.viewonce.${key}`)}` }, { quoted: message });
            }
            // Original bytes, re-sent untouched: the highest quality WhatsApp delivered.
            const buffer = await downloadViewOnce(sock, found);
            const { media } = found;
            if (found.type === 'image') {
                await sock.sendMessage(chatId, { image: buffer, mimetype: media.mimetype, caption: media.caption || undefined }, { quoted: message });
            }
            else if (found.type === 'video') {
                await sock.sendMessage(chatId, {
                    video: buffer,
                    mimetype: media.mimetype,
                    caption: media.caption || undefined,
                    gifPlayback: !!media.gifPlayback
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { audio: buffer, mimetype: media.mimetype || 'audio/ogg; codecs=opus', ptt: !!media.ptt }, { quoted: message });
            }
        }
        catch (error) {
            if (error instanceof ViewOnceExpiredError) {
                return sock.sendMessage(chatId, { text: `⌛ ${t('p.viewonce.expired')}` }, { quoted: message });
            }
            console.error('Error in viewonce command:', error.message);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.viewonce.failed')}` }, { quoted: message });
        }
    }
};
