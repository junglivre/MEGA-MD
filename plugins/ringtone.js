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
    command: 'ringtone',
    aliases: ['ring', 'tone'],
    category: 'music',
    description: 'Search and download ringtones',
    usage: '.ringtone <search term>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const searchQuery = args.join(' ').trim();
        try {
            if (!searchQuery) {
                return await sock.sendMessage(chatId, {
                    text: `*${t('p.ringtone.whichRingtone')}*\nUsage: .ringtone <name>\n\nExample: .ringtone Nokia`
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, {
                text: `🔍 *${t('p.ringtone.searching')}*`
            }, { quoted: message });
            await new Promise(resolve => setTimeout(resolve, 10000));
            const searchUrl = `https://discardapi.dpdns.org/api/dl/ringtone?apikey=guru&title=${encodeURIComponent(searchQuery)}`;
            const response = await axios.get(searchUrl, { timeout: 30000 });
            if (!response.data?.result || response.data.result.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.ringtone.noResults')}*\n${t('p.ringtone.tryDifferent')}`
                }, { quoted: message });
            }
            const ringtones = response.data.result;
            const totalFound = ringtones.length;
            const limit = Math.min(2, totalFound);
            for (let i = 0; i < limit; i++) {
                const audioUrl = ringtones[i].audio;
                try {
                    await sock.sendMessage(chatId, {
                        audio: { url: audioUrl },
                        mimetype: "audio/mpeg",
                        fileName: `${searchQuery}_${i + 1}.mp3`,
                        contextInfo: {
                            externalAdReply: {
                                title: `${searchQuery} ${t('p.ringtone.ringtoneLabel')} ${i + 1}`,
                                body: t('p.ringtone.ringtoneOf', { current: i + 1, total: limit }),
                                mediaType: 2,
                                thumbnail: null
                            }
                        }
                    }, { quoted: message });
                    if (i < limit - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                catch (sendError) {
                    console.error(`Failed to send ringtone ${i + 1}:`, sendError.message);
                    continue;
                }
            }
            await sock.sendMessage(chatId, {
                text: `✅ *${t('p.ringtone.sent', { count: limit })}*\n\n${totalFound > limit ? `📊 *${t('p.ringtone.moreAvailable', { count: totalFound - limit })}*\n${t('p.ringtone.useAgain')}` : ''}`
            }, { quoted: message });
        }
        catch (error) {
            console.error('Ringtone Command Error:', error);
            let errorMsg = `❌ *${t('p.ringtone.searchFailed')}*\n\n`;
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                errorMsg += `*${t('p.ringtone.reason')}:* ${t('p.ringtone.connTimeout')}`;
            }
            else if (error.response) {
                errorMsg += `*${t('p.ringtone.status')}:* ${error.response.status}\n*${t('p.ringtone.error')}:* ${error.response.statusText}`;
            }
            else {
                errorMsg += `*${t('p.ringtone.error')}:* ${error.message}`;
            }
            errorMsg += `\n\n${t('p.ringtone.tryAgainLater')}`;
            await sock.sendMessage(chatId, {
                text: errorMsg
            }, { quoted: message });
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
