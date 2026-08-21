import store from '../lib/lightweight_store.js';

export default {
    command: 'unsetlastfm',
    aliases: ['lfmunset', 'lastfmunset'],
    category: 'music',
    description: 'Remove your Last.fm username',
    usage: '.unsetlastfm',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, t } = context;
        const current = await store.getUserSetting(senderId, 'lastFmUsername');
        if (!current)
            return sock.sendMessage(chatId, { text: `ℹ️ ${t('p.lastfm.notConfigured')}`, ...channelInfo }, { quoted: message });
        await store.saveUserSetting(senderId, 'lastFmUsername', null);
        return sock.sendMessage(chatId, { text: `✅ ${t('p.lastfm.unsetSuccess')}`, ...channelInfo }, { quoted: message });
    }
};
