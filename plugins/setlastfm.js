import store from '../lib/lightweight_store.js';
import { LastFmError, validateLastFmUsername } from '../lib/lastfm.js';

export default {
    command: 'setlastfm',
    aliases: ['lfmset', 'lastfmset'],
    category: 'music',
    description: 'Set your Last.fm username',
    usage: '.setlastfm <username>',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, t, config } = context;
        const username = args[0]?.trim().replace(/^@/, '');
        if (!username)
            return sock.sendMessage(chatId, { text: `📝 ${t('p.lastfm.setUsage')}`, ...channelInfo }, { quoted: message });
        if (!config.lastFmApiKey)
            return sock.sendMessage(chatId, { text: `❌ ${t('p.lastfm.missingApiKey')}`, ...channelInfo }, { quoted: message });
        try {
            const verified = await validateLastFmUsername(username);
            await store.saveUserSetting(senderId, 'lastFmUsername', verified);
            await sock.sendMessage(chatId, { text: `✅ ${t('p.lastfm.setSuccess', { username: verified })}`, ...channelInfo }, { quoted: message });
        }
        catch (error) {
            const key = error instanceof LastFmError && error.code === 'INVALID_USERNAME' ? 'invalidUsername' : 'failed';
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.lastfm.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
