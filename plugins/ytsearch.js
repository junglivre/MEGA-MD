/*****************************************************************************
 *                                                                           *
 *                     Developed By Qasim Ali                                *
 *                                                                           *
 *  🌐  GitHub   : https://github.com/GlobalTechInfo                         *
 *  ▶️  YouTube  : https://youtube.com/@GlobalTechInfo                       *
 *  💬  WhatsApp : https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07     *
 *                                                                           *
 *    © 2026 GlobalTechInfo. All rights reserved.                            *
 *                                                                           *
 *    Description: This file is part of the MEGA-MD Project.                 *
 *                 Unauthorized copying or distribution is prohibited.       *
 *                                                                           *
 *****************************************************************************/
import yts from 'yt-search';
export default {
    command: 'ytsearch',
    aliases: ['yts', 'playlist', 'playlista'],
    category: 'music',
    description: 'Search YouTube',
    usage: '.yts [query]',
    async handler(sock, message, args, context) {
        const { chatId, config, t } = context;
        const query = args.join(' ');
        const prefix = config.prefix;
        if (!query) {
            return sock.sendMessage(chatId, {
                text: t('p.ytsearch.exampleQuery', { prefix })
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });
            const result = await yts(query);
            const videos = result.videos.slice(0, 10);
            if (videos.length === 0) {
                return sock.sendMessage(chatId, { text: `❌ ${t('p.ytsearch.noResults')}` });
            }
            let searchText = `✨ *${t('p.ytsearch.title')}* ✨\n\n`;
            videos.forEach((v, index) => {
                searchText += `*${index + 1}.🎧 ${v.title}*\n`;
                searchText += `*⌚ ${t('p.ytsearch.duration')}:* ${v.timestamp}\n`;
                searchText += `*👀 ${t('p.ytsearch.views')}:* ${v.views}\n`;
                searchText += `*🔗 ${t('p.ytsearch.url')}:* ${v.url}\n`;
                searchText += `──────────────────\n`;
            });
            await sock.sendMessage(chatId, {
                image: { url: videos[0].image },
                caption: searchText
            }, { quoted: message });
        }
        catch (error) {
            console.error('YouTube Search Error:', error);
            await sock.sendMessage(chatId, { text: `❌ ${t('p.ytsearch.error')}` });
        }
    }
};
/*****************************************************************************
 *                                                                           *
 *                     Developed By Qasim Ali                                *
 *                                                                           *
 *  🌐  GitHub   : https://github.com/GlobalTechInfo                         *
 *  ▶️  YouTube  : https://youtube.com/@GlobalTechInfo                       *
 *  💬  WhatsApp : https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07     *
 *                                                                           *
 *    © 2026 GlobalTechInfo. All rights reserved.                            *
 *                                                                           *
 *    Description: This file is part of the MEGA-MD Project.                 *
 *                 Unauthorized copying or distribution is prohibited.       *
 *                                                                           *
 *****************************************************************************/
