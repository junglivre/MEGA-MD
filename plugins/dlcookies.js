import { handleCookieCommand } from '../lib/cookieCommand.js';
import { cookieManager as youtubeManager } from '../lib/ytdlp.js';
import { cookieManager as tiktokManager } from '../lib/tiktokDownload.js';

// One cookie command for every yt-dlp-backed download site, instead of a
// separate .ytcookies/.tiktokcookies per site:
//   .dlcookies youtube set [label]   (reply to a cookies.txt file)
//   .dlcookies tiktok set conta1
//   .dlcookies youtube status
// Twitter/X and Instagram go through public resolvers and need no cookies.
const SITES = {
    youtube: { manager: youtubeManager, label: 'YouTube', aliases: ['youtube', 'yt'] },
    tiktok: { manager: tiktokManager, label: 'TikTok', aliases: ['tiktok', 'tt'] }
};
const SITE_LOOKUP = Object.fromEntries(
    Object.entries(SITES).flatMap(([key, site]) => site.aliases.map((alias) => [alias, key]))
);

export default {
    command: 'dlcookies',
    aliases: ['dlcookie', 'cookies'],
    category: 'owner',
    description: 'Manage cookies for YouTube/TikTok downloads',
    usage: '.dlcookies <youtube|tiktok> <set [label]|status|remove <label>|clear>',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        const siteKey = SITE_LOOKUP[(args[0] || '').toLowerCase()];
        if (!siteKey) {
            return sock.sendMessage(chatId, { text: t('p.dlcookies.menu') }, { quoted: message, ...channelInfo });
        }
        const site = SITES[siteKey];
        await handleCookieCommand({
            sock,
            message,
            args: args.slice(1),
            context,
            manager: site.manager,
            site: site.label,
            siteCmd: siteKey
        });
    }
};
