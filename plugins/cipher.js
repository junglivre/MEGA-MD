import { getBin } from '../lib/compile.js';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export default {
    command: 'cipher',
    aliases: ['encrypt', 'decrypt', 'encode', 'crypt'],
    category: 'utility',
    description: 'Encrypt or decrypt text using Caesar, Vigenere, or XOR cipher',
    usage: '.cipher <type> <encode|decode> <key> <text>',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, t } = context;
        if (args.length < 4) {
            return await sock.sendMessage(chatId, {
                text: `🔐 *${t('p.cipher.title')}*\n\n` +
                    `*${t('p.cipher.usageLabel')}:* \`.cipher <type> <encode|decode> <key> <text>\`\n\n` +
                    `*${t('p.cipher.cipherTypesLabel')}:*\n\n` +
                    `*caesar* — ${t('p.cipher.caesarDesc')}\n` +
                    `• \`.cipher caesar encode 13 Hello World\`\n` +
                    `• \`.cipher caesar decode 13 Uryyb Jbeyq\`\n\n` +
                    `*vigenere* — ${t('p.cipher.vigenereDesc')}\n` +
                    `• \`.cipher vigenere encode SECRET Hello World\`\n` +
                    `• \`.cipher vigenere decode SECRET Zincs Pgvnu\`\n\n` +
                    `*xor* — ${t('p.cipher.xorDesc')}\n` +
                    `• \`.cipher xor encode mykey Hello\`\n` +
                    `• \`.cipher xor decode mykey 25090a0e06\``,
                ...channelInfo
            }, { quoted: message });
        }
        const cipherType = args[0].toLowerCase();
        const mode = args[1].toLowerCase();
        const key = args[2];
        const text = args.slice(3).join(' ').trim();
        if (!['caesar', 'vigenere', 'xor'].includes(cipherType)) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.cipher.unknownCipher', { cipherType })}`,
                ...channelInfo
            }, { quoted: message });
        }
        if (!['encode', 'decode', 'encrypt', 'decrypt'].includes(mode)) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.cipher.unknownMode', { mode })}`,
                ...channelInfo
            }, { quoted: message });
        }
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.cipher.noText')}`,
                ...channelInfo
            }, { quoted: message });
        }
        if (cipherType === 'caesar' && isNaN(parseInt(key, 10))) {
            return await sock.sendMessage(chatId, {
                text: `❌ ${t('p.cipher.caesarKeyNotNumber')}`,
                ...channelInfo
            }, { quoted: message });
        }
        try {
            const bin = getBin('cipher');
            const safeText = text.replace(/"/g, '\\"');
            const safeKey = key.replace(/"/g, '\\"');
            const { stdout, stderr } = await execAsync(`"${bin}" ${cipherType} ${mode} "${safeKey}" "${safeText}"`, { timeout: 10000 });
            if (stderr && !stdout) {
                return await sock.sendMessage(chatId, {
                    text: `❌ ${stderr.trim()}`,
                    ...channelInfo
                }, { quoted: message });
            }
            const result = stdout.trim();
            const cipherNames = {
                caesar: 'Caesar', vigenere: 'Vigenère', xor: 'XOR'
            };
            const modeLabel = (mode === 'encode' || mode === 'encrypt') ? `🔒 ${t('p.cipher.encryptedLabel')}` : `🔓 ${t('p.cipher.decryptedLabel')}`;
            await sock.sendMessage(chatId, {
                text: `🔐 *${cipherNames[cipherType]} ${t('p.cipher.cipherWord')}*\n\n` +
                    `📥 *${t('p.cipher.inputLabel')}:* \`${text}\`\n` +
                    `🔑 *${t('p.cipher.keyLabel')}:* \`${key}\`\n` +
                    `${modeLabel}: \`${result}\``,
                ...channelInfo
            }, { quoted: message });
        }
        catch (error) {
            await sock.sendMessage(chatId, {
                text: `❌ ${t('p.cipher.failedLabel')}: ${error.message}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
