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
    command: 'whoisip',
    aliases: ['ip', 'iplookup'],
    category: 'search',
    description: 'Get location info from an IP or Domain',
    usage: '.ip <address/domain>',
    async handler(sock, message, args, context) {
        const { t } = context;
        const chatId = context.chatId || message.key.remoteJid;
        const query = args[0];
        if (!query)
            return await sock.sendMessage(chatId, { text: t('p.whoisip.noQuery') });
        try {
            const res = await axios.get(`http://ip-api.com/json/${query}?fields=status,message,country,regionName,city,zip,isp,org,as,query`);
            const data = res.data;
            if (data.status === 'fail')
                return await sock.sendMessage(chatId, { text: `❌ ${t('p.whoisip.error', { message: data.message })}` });
            const info = `
🌐 *${t('p.whoisip.title')}*
---
📍 *${t('p.whoisip.target')}:* ${data.query}
🌍 *${t('p.whoisip.country')}:* ${data.country}
🏙️ *${t('p.whoisip.cityRegion')}:* ${data.city}, ${data.regionName}
📮 *${t('p.whoisip.zip')}:* ${data.zip}
📡 *${t('p.whoisip.isp')}:* ${data.isp}
🏢 *${t('p.whoisip.organization')}:* ${data.org}
      `.trim();
            await sock.sendMessage(chatId, { text: info }, { quoted: message });
        }
        catch (err) {
            await sock.sendMessage(chatId, { text: `❌ ${t('p.whoisip.networkError')}` });
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
