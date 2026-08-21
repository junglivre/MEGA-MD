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
export default {
    command: 'add',
    aliases: ['invite', 'gcadd', 'addgc'],
    category: 'admin',
    description: 'Add a user to the group',
    usage: '.add <number> or reply to vcard/message',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        let targetNumber = null;
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedMsg = message.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedParticipant = message.message.extendedTextMessage.contextInfo.participant;
            if (quotedMsg.contactMessage) {
                const vcard = quotedMsg.contactMessage.vcard;
                const phoneMatch = vcard.match(/waid=(\d+)/);
                if (phoneMatch) {
                    targetNumber = phoneMatch[1];
                }
                else {
                    const telMatch = vcard.match(/TEL.*?:(\+?\d+)/);
                    if (telMatch) {
                        targetNumber = telMatch[1].replace(/\D/g, '');
                    }
                }
            }
            else if (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text) {
                const text = quotedMsg.conversation || quotedMsg.extendedTextMessage.text;
                const numberMatch = text.match(/(\+?\d{10,15})/);
                if (numberMatch) {
                    targetNumber = numberMatch[1].replace(/\D/g, '');
                }
            }
            else if (quotedParticipant) {
                targetNumber = quotedParticipant.split('@')[0];
            }
        }
        if (!targetNumber && args.length > 0) {
            const input = args.join(' ');
            const cleaned = input.replace(/[^\d+]/g, '');
            targetNumber = cleaned.replace(/^\+/, '');
        }
        if (!targetNumber) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.add.usage')}`,
                ...channelInfo
            }, { quoted: message });
        }
        if (!targetNumber.startsWith('1') && !targetNumber.startsWith('2') && !targetNumber.startsWith('3') &&
            !targetNumber.startsWith('4') && !targetNumber.startsWith('5') && !targetNumber.startsWith('6') &&
            !targetNumber.startsWith('7') && !targetNumber.startsWith('8') && !targetNumber.startsWith('9')) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.add.invalidFormat')}`,
                ...channelInfo
            }, { quoted: message });
        }
        const targetJid = `${targetNumber}@s.whatsapp.net`;
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants.map((p) => p.id);
            if (participants.includes(targetJid)) {
                return await sock.sendMessage(chatId, {
                    text: `⚠️ ${t('p.add.alreadyMember', { number: targetNumber })}`,
                    ...channelInfo
                }, { quoted: message });
            }
            const result = await sock.groupParticipantsUpdate(chatId, [targetJid], 'add');
            if (result[0].status === '200') {
                await sock.sendMessage(chatId, {
                    text: `✅ ${t('p.add.success', { number: targetNumber })}`,
                    mentions: [targetJid],
                    ...channelInfo
                }, { quoted: message });
            }
            else if (result[0].status === '403') {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.add.privacyBlocked')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            else if (result[0].status === '408') {
                await sock.sendMessage(chatId, {
                    text: `⚠️ ${t('p.add.inviteSent')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: `❌ ${t('p.add.failedStatus', { status: result[0].status })}`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Add command error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.add.error', { error: error.message })}`,
                ...channelInfo
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
