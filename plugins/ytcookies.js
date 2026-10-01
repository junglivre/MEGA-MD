import moment from 'moment-timezone';
import config from '../config.js';
import {
    saveCookiesSetting,
    removeCookiesProfile,
    clearCookiesSetting,
    isCookiesConfigured,
    listCookieProfiles,
    validateCookiesContent,
    normalizeCookieLabel
} from '../lib/ytdlp.js';

async function extractSetPayload(message, args) {
    const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.documentMessage) {
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        const msgObj = { message: { documentMessage: quoted.documentMessage } };
        const buf = await downloadMediaMessage(msgObj, 'buffer', {});
        const label = args[1] ? normalizeCookieLabel(args[1]) : undefined;
        return { content: buf.toString('utf8'), label };
    }
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    const inlineText = args.slice(1).join(' ');
    return { content: (inlineText || quotedText).trim(), label: undefined };
}

function formatWhen(ts) {
    return moment(ts).tz(config.timeZone).format('DD/MM/YY - HH:mm:ss');
}

export default {
    command: 'ytcookies',
    aliases: ['ytcookie', 'youtubecookies'],
    category: 'owner',
    description: 'Manage YouTube cookies used by .play/.song/.video',
    usage: '.ytcookies set [label]|status|remove <label>|clear (reply to a cookies.txt file or paste its content)',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'set') {
            const { content, label } = await extractSetPayload(message, args);
            if (!content)
                return sock.sendMessage(chatId, { text: `❌ ${t('p.ytcookies.noContent')}` }, { quoted: message, ...channelInfo });
            if (!validateCookiesContent(content))
                return sock.sendMessage(chatId, { text: `❌ ${t('p.ytcookies.invalidFormat')}` }, { quoted: message, ...channelInfo });
            try {
                const entry = await saveCookiesSetting(content, label);
                await sock.sendMessage(chatId, { text: `✅ ${t('p.ytcookies.saveSuccess', { label: entry.label, when: formatWhen(entry.updatedAt) })}` }, { quoted: message, ...channelInfo });
            }
            catch (err) {
                console.error('[YTCOOKIES] Save error:', err.message);
                await sock.sendMessage(chatId, { text: `❌ ${t('p.ytcookies.saveError')}` }, { quoted: message, ...channelInfo });
            }
            return;
        }
        if (sub === 'remove' || sub === 'rm' || sub === 'del') {
            const label = args[1];
            if (!label)
                return sock.sendMessage(chatId, { text: `❌ ${t('p.ytcookies.noLabel')}` }, { quoted: message, ...channelInfo });
            const removed = await removeCookiesProfile(label);
            await sock.sendMessage(chatId, {
                text: removed
                    ? `✅ ${t('p.ytcookies.removeSuccess', { label: normalizeCookieLabel(label) })}`
                    : `❌ ${t('p.ytcookies.removeNotFound', { label: normalizeCookieLabel(label) })}`
            }, { quoted: message, ...channelInfo });
            return;
        }
        if (sub === 'clear') {
            await clearCookiesSetting();
            await sock.sendMessage(chatId, { text: `✅ ${t('p.ytcookies.clearSuccess')}` }, { quoted: message, ...channelInfo });
            return;
        }
        if (sub === 'status' || sub === 'list') {
            const state = await isCookiesConfigured();
            let body;
            if (!state.configured) {
                body = t('p.ytcookies.statusNotConfigured');
            }
            else if (state.source === 'file') {
                body = t('p.ytcookies.statusConfiguredFile', { path: state.path });
            }
            else {
                const profiles = await listCookieProfiles();
                const lines = profiles.map((p) => {
                    const flag = p.invalid ? `⚠️ ${t('p.ytcookies.profileInvalid', { when: formatWhen(p.invalidAt) })}` : `✅ ${t('p.ytcookies.profileOk')}`;
                    return `▢ *${p.label}* — ${flag} — ${t('p.ytcookies.profileUpdated', { when: formatWhen(p.updatedAt) })}`;
                }).join('\n');
                body = `${t('p.ytcookies.statusConfiguredDb', { count: profiles.length })}\n${lines}`;
            }
            await sock.sendMessage(chatId, { text: `🍪 *${t('p.ytcookies.title')}*\n\n${body}` }, { quoted: message, ...channelInfo });
            return;
        }
        await sock.sendMessage(chatId, { text: t('p.ytcookies.menu') }, { quoted: message, ...channelInfo });
    }
};
