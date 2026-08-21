import pkg from 'api-qasim';
const QasimAny = pkg;
import { channelInfo } from '../lib/messageConfig.js';
export default {
    command: 'wattpad',
    aliases: ['wattpadsearch', 'searchwattpad'],
    category: 'search',
    description: 'Search for stories on Wattpad!',
    usage: '.wattpad <query>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const query = args.join(' ').trim();
        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `*${t('p.wattpad.noQuery')}*` +
                    `\n${t('p.wattpad.example')}`,
                ...channelInfo
            }, { quoted: message });
        }
        try {
            const results = await QasimAny.wattpad(query);
            if (!Array.isArray(results) || results.length === 0) {
                throw new Error(t('p.wattpad.noResults'));
            }
            const formattedResults = results.slice(0, 9).map((story, index) => {
                const title = story.judul || t('p.wattpad.noTitle');
                const reads = story.dibaca || t('p.wattpad.noReads');
                const votes = story.divote || t('p.wattpad.noVotes');
                const thumb = story.thumb || '';
                const link = story.link || t('p.wattpad.noLink');
                return `${index + 1}. *${title}*\n*${t('p.wattpad.readsLabel')}*: ${reads}\n*${t('p.wattpad.votesLabel')}*: ${votes}\n${t('p.wattpad.readMore')}: ${link}${thumb ? `\n${thumb}` : ''}`;
            }).join('\n\n');
            await sock.sendMessage(chatId, {
                text: `*${t('p.wattpad.searchResultsFor', { query })}*\n\n${formattedResults}`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.wattpad.error', { message: error.message || error })}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
