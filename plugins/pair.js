import axios from 'axios';
import { channelInfo } from '../lib/messageConfig.js';
export default {
    command: 'pair',
    aliases: ['paircode', 'session', 'getsession', 'sessionid'],
    category: 'general',
    description: 'Get session id for MEGA-MD',
    usage: '.pair 92305395XXXX',
    async handler(sock, message, args, context) {
        const { chatId, t } = context;
        const forwardInfo = channelInfo.contextInfo;
        const query = args.join('').trim();
        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.pair.missingNumber')}`,
                contextInfo: forwardInfo
            }, { quoted: message });
        }
        const number = query.replace(/[^0-9]/g, '');
        if (number.length < 10 || number.length > 15) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.pair.invalidFormat')}`,
                contextInfo: forwardInfo
            }, { quoted: message });
        }
        await sock.sendMessage(chatId, {
            text: `⚡ ${t('p.pair.requesting')}`,
            contextInfo: forwardInfo
        }, { quoted: message });
        try {
            const response = await axios.get(`https://mega-pairing.onrender.com/pair?number=${number}`, {
                timeout: 60000
            });
            if (response.data && response.data.code) {
                const pairingCode = response.data.code;
                if (pairingCode.includes("Unavailable") || pairingCode.includes("Error")) {
                    throw new Error("Server is busy");
                }
                const successText = `✅ ${t('p.pair.success', { code: pairingCode })}`;
                await sock.sendMessage(chatId, {
                    text: successText,
                    contextInfo: forwardInfo
                }, { quoted: message });
            }
            else {
                throw new Error("Invalid response format");
            }
        }
        catch (error) {
            console.error('Pairing Plugin Error:', error.message);
            let errorKey;
            if (error.code === 'ECONNABORTED') {
                errorKey = 'p.pair.failedTimeout';
            }
            else if (error.response?.status === 400) {
                errorKey = 'p.pair.failedInvalid';
            }
            else {
                errorKey = 'p.pair.failedGeneric';
            }
            await sock.sendMessage(chatId, {
                text: `❌ ${t(errorKey)}`,
                contextInfo: forwardInfo
            }, { quoted: message });
        }
    }
};
