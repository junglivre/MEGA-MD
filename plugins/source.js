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
import axios from 'axios';
export default {
    command: 'getpage',
    aliases: ['source', 'viewsource'],
    category: 'tools',
    description: 'Get the raw HTML source of a website',
    usage: '.getpage <url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const url = args[0];
        if (!url || !url.startsWith('http')) {
            return await sock.sendMessage(chatId, { text: t('p.getpage.invalidUrl') }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: `🌐 *${t('p.getpage.fetching')}*` });
            const res = await axios.get(url);
            const html = res.data;
            const buffer = Buffer.from(html, 'utf-8');
            await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: 'text/html',
                fileName: 'source.html',
                caption: `*${t('p.getpage.sourceFor')}:* ${url}`
            }, { quoted: message });
        }
        catch (err) {
            await sock.sendMessage(chatId, { text: `❌ ${t('p.getpage.fetchFailed')}` });
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
