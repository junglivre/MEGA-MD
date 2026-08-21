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
    command: 'alamy',
    aliases: ['alamydl', 'alamydownload'],
    category: 'download',
    description: 'Download image or video from Alamy URL',
    usage: '.alamy <Alamy URL>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const url = args?.[0]?.trim();
        if (!url) {
            return await sock.sendMessage(chatId, { text: `❌ ${t('p.alamy.noUrl')}` }, { quoted: message });
        }
        try {
            const apiUrl = `https://discardapi.dpdns.org/api/dl/alamy?apikey=guru&url=${encodeURIComponent(url)}`;
            const { data } = await axios.get(apiUrl, { timeout: 10000 });
            if (!data?.status || !data.result?.length) {
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.alamy.fetchFailed')}` }, { quoted: message });
            }
            const isValidUrl = (u) => u && u.startsWith('http');
            let sent = false;
            for (const item of data.result) {
                if (isValidUrl(item.video)) {
                    await sock.sendMessage(chatId, { video: { url: item.video }, caption: `🎬 *${t('p.alamy.videoCaption')}*` }, { quoted: message });
                    sent = true;
                }
                if (isValidUrl(item.image)) {
                    await sock.sendMessage(chatId, { image: { url: item.image }, caption: `🖼️ *${t('p.alamy.imageCaption')}*` }, { quoted: message });
                    sent = true;
                }
            }
            if (!sent) {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.alamy.noMedia')}` }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Alamy download plugin error:', error);
            if (error.code === 'ECONNABORTED') {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.alamy.timeout')}` }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, { text: `❌ ${t('p.alamy.downloadFailed')}` }, { quoted: message });
            }
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
