// Discontinued: relied on api.qasimdev.dpdns.org, which went the same way as
// the YouTube download API (dead/ad-redirected). Terabox has no yt-dlp
// extractor and every community resolver needs its own Terabox account
// cookie plus scraping logic that breaks whenever Terabox changes its
// anti-bot measures — a bigger, separate maintenance burden than the
// YouTube fix. Kept as a stub (hidden from the menu) so the command still
// answers instead of erroring against a dead API.
export default {
    command: 'terabox',
    aliases: ['tera', 'tbox', 'tbdl'],
    category: 'download',
    description: 'Discontinued: TeraBox downloads no longer work',
    usage: '.terabox <terabox link>',
    hidden: true,
    async handler(sock, message, _args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t, channelInfo } = context;
        await sock.sendMessage(chatId, { text: t('p.terabox.discontinued'), ...channelInfo }, { quoted: message });
    }
};
