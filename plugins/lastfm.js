import store from '../lib/lightweight_store.js';
import { getLastFmTrack, LastFmError, renderLastFmCard } from '../lib/lastfm.js';

export default {
    command: 'lastfm',
    aliases: ['lfm', 'lt'],
    category: 'music',
    description: 'Show your latest Last.fm scrobble',
    usage: '.lastfm',
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, t, config } = context;
        const username = await store.getUserSetting(senderId, 'lastFmUsername');
        if (!username)
            return sock.sendMessage(chatId, { text: `📝 ${t('p.lastfm.noUsername')}`, ...channelInfo }, { quoted: message });
        if (!config.lastFmApiKey)
            return sock.sendMessage(chatId, { text: `❌ ${t('p.lastfm.missingApiKey')}`, ...channelInfo }, { quoted: message });
        try {
            const track = await getLastFmTrack(username);
            const image = await renderLastFmCard(track, {
                nowPlaying: t('p.lastfm.nowPlaying'),
                lastPlayed: t('p.lastfm.lastPlayed'),
                plays: t('p.lastfm.plays'),
                loved: t('p.lastfm.loved')
            });
            await sock.sendMessage(chatId, { image, ...channelInfo }, { quoted: message });
        }
        catch (error) {
            console.error('[LASTFM]', error.message);
            const key = error instanceof LastFmError && error.code === 'NO_SCROBBLES' ? 'noScrobbles' : 'failed';
            await sock.sendMessage(chatId, { text: `❌ ${t(`p.lastfm.${key}`)}`, ...channelInfo }, { quoted: message });
        }
    }
};
