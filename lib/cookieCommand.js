// Core set/status/remove/clear flow shared by the unified `.dlcookies <site>`
// command (plugins/dlcookies.js). `site` here is a display label (e.g.
// "YouTube"); `siteCmd` is the lowercase token used in `.dlcookies <siteCmd>`
// examples inside messages.
import moment from 'moment-timezone';
import config from '../config.js';
import { normalizeCookieLabel } from './ytdlpCore.js';

async function extractSetPayload(message, args) {
    const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.documentMessage) {
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        const msgObj = { message: { documentMessage: quoted.documentMessage } };
        const buf = await downloadMediaMessage(msgObj, 'buffer', {});
        const label = args[0] ? normalizeCookieLabel(args[0]) : undefined;
        return { content: buf.toString('utf8'), label };
    }
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    const inlineText = args.join(' ');
    return { content: (inlineText || quotedText).trim(), label: undefined };
}

function formatWhen(ts) {
    return moment(ts).tz(config.timeZone).format('DD/MM/YY - HH:mm:ss');
}

/**
 * @param {object} opts
 * @param {object} opts.manager - cookie manager from lib/ytdlpCore.js's createCookieManager
 * @param {string} opts.site - display label, e.g. "YouTube"
 * @param {string} opts.siteCmd - lowercase token for usage examples, e.g. "youtube"
 * @param {string[]} opts.args - args AFTER the site token (so args[0] is the sub-action)
 */
export async function handleCookieCommand({ sock, message, args, context, manager, site, siteCmd }) {
    const { chatId, channelInfo, t } = context;
    const key = (slug) => `p.dlcookies.${slug}`;
    const sub = (args[0] || '').toLowerCase();
    const rest = args.slice(1);
    if (sub === 'set') {
        const { content, label } = await extractSetPayload(message, rest);
        if (!content)
            return sock.sendMessage(chatId, { text: `❌ ${t(key('noContent'))}` }, { quoted: message, ...channelInfo });
        if (!manager.validateContent(content))
            return sock.sendMessage(chatId, { text: `❌ ${t(key('invalidFormat'), { site })}` }, { quoted: message, ...channelInfo });
        try {
            const entry = await manager.saveCookiesSetting(content, label);
            await sock.sendMessage(chatId, { text: `✅ ${t(key('saveSuccess'), { site, label: entry.label, when: formatWhen(entry.updatedAt) })}` }, { quoted: message, ...channelInfo });
        }
        catch (err) {
            console.error(`[dlcookies:${siteCmd}] Save error:`, err.message);
            await sock.sendMessage(chatId, { text: `❌ ${t(key('saveError'))}` }, { quoted: message, ...channelInfo });
        }
        return;
    }
    if (sub === 'remove' || sub === 'rm' || sub === 'del') {
        const label = rest[0];
        if (!label)
            return sock.sendMessage(chatId, { text: `❌ ${t(key('noLabel'), { siteCmd })}` }, { quoted: message, ...channelInfo });
        const removed = await manager.removeCookiesProfile(label);
        await sock.sendMessage(chatId, {
            text: removed
                ? `✅ ${t(key('removeSuccess'), { site, label: normalizeCookieLabel(label) })}`
                : `❌ ${t(key('removeNotFound'), { site, label: normalizeCookieLabel(label) })}`
        }, { quoted: message, ...channelInfo });
        return;
    }
    if (sub === 'clear') {
        await manager.clearCookiesSetting();
        await sock.sendMessage(chatId, { text: `✅ ${t(key('clearSuccess'), { site })}` }, { quoted: message, ...channelInfo });
        return;
    }
    if (sub === 'status' || sub === 'list' || !sub) {
        const state = await manager.isCookiesConfigured();
        let body;
        if (!state.configured) {
            body = t(key('statusNotConfigured'), { site });
        }
        else if (state.source === 'file') {
            body = t(key('statusConfiguredFile'), { site, path: state.path });
        }
        else {
            const profiles = await manager.listCookieProfiles();
            const lines = profiles.map((p) => {
                const flag = p.invalid ? `⚠️ ${t(key('profileInvalid'), { when: formatWhen(p.invalidAt) })}` : `✅ ${t(key('profileOk'))}`;
                return `▢ *${p.label}* — ${flag} — ${t(key('profileUpdated'), { when: formatWhen(p.updatedAt) })}`;
            }).join('\n');
            body = `${t(key('statusConfiguredDb'), { site, count: profiles.length })}\n${lines}`;
        }
        await sock.sendMessage(chatId, { text: `🍪 *${site}*\n\n${body}` }, { quoted: message, ...channelInfo });
        return;
    }
    await sock.sendMessage(chatId, { text: t(key('siteMenu'), { site, siteCmd }) }, { quoted: message, ...channelInfo });
}
