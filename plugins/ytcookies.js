import moment from 'moment-timezone';
import config from '../config.js';
import {
    saveCookiesSetting,
    clearCookiesSetting,
    isCookiesConfigured,
    getCookieAlertState,
    validateCookiesContent
} from '../lib/ytdlp.js';

async function extractContent(message, args) {
    const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.documentMessage) {
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        const msgObj = { message: { documentMessage: quoted.documentMessage } };
        const buf = await downloadMediaMessage(msgObj, 'buffer', {});
        return buf.toString('utf8');
    }
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    const inlineText = args.slice(1).join(' ');
    return (inlineText || quotedText).trim();
}

export default {
    command: 'ytcookies',
    aliases: ['ytcookie', 'youtubecookies'],
    category: 'owner',
    description: 'Manage YouTube cookies used by .play/.song/.video',
    usage: '.ytcookies set|status|clear (reply to a cookies.txt file or paste its content)',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'set') {
            const content = await extractContent(message, args);
            if (!content)
                return sock.sendMessage(chatId, { text: `❌ ${t('p.ytcookies.noContent')}` }, { quoted: message, ...channelInfo });
            if (!validateCookiesContent(content))
                return sock.sendMessage(chatId, { text: `❌ ${t('p.ytcookies.invalidFormat')}` }, { quoted: message, ...channelInfo });
            try {
                const entry = await saveCookiesSetting(content);
                const when = moment(entry.updatedAt).tz(config.timeZone).format('DD/MM/YY - HH:mm:ss');
                await sock.sendMessage(chatId, { text: `✅ ${t('p.ytcookies.saveSuccess', { when })}` }, { quoted: message, ...channelInfo });
            }
            catch (err) {
                console.error('[YTCOOKIES] Save error:', err.message);
                await sock.sendMessage(chatId, { text: `❌ ${t('p.ytcookies.saveError')}` }, { quoted: message, ...channelInfo });
            }
            return;
        }
        if (sub === 'clear') {
            await clearCookiesSetting();
            await sock.sendMessage(chatId, { text: `✅ ${t('p.ytcookies.clearSuccess')}` }, { quoted: message, ...channelInfo });
            return;
        }
        if (sub === 'status') {
            const state = await isCookiesConfigured();
            const alert = await getCookieAlertState();
            let statusLine;
            if (!state.configured) {
                statusLine = t('p.ytcookies.statusNotConfigured');
            }
            else if (state.source === 'db') {
                const when = moment(state.updatedAt).tz(config.timeZone).format('DD/MM/YY - HH:mm:ss');
                statusLine = t('p.ytcookies.statusConfiguredDb', { when });
            }
            else {
                statusLine = t('p.ytcookies.statusConfiguredFile', { path: state.path });
            }
            const alertLine = alert?.notifiedAt
                ? t('p.ytcookies.statusAlertActive', { when: moment(alert.notifiedAt).tz(config.timeZone).format('DD/MM/YY - HH:mm:ss') })
                : t('p.ytcookies.statusAlertNone');
            await sock.sendMessage(chatId, { text: `🍪 *${t('p.ytcookies.title')}*\n\n${statusLine}\n${alertLine}` }, { quoted: message, ...channelInfo });
            return;
        }
        await sock.sendMessage(chatId, { text: t('p.ytcookies.menu') }, { quoted: message, ...channelInfo });
    }
};
