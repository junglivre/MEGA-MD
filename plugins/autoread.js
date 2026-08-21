import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const configPath = dataFile('autoread.json');
async function initConfig() {
    if (HAS_DB) {
        const config = await store.getSetting('global', 'autoread');
        return config || { enabled: false };
    }
    else {
        if (!fs.existsSync(configPath)) {
            const dataDir = path.dirname(configPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
        }
        return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
}
async function saveConfig(config) {
    if (HAS_DB) {
        await store.saveSetting('global', 'autoread', config);
    }
    else {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
}
async function isAutoreadEnabled() {
    try {
        const config = await initConfig();
        return config.enabled;
    }
    catch (error) {
        console.error('Error checking autoread status:', error);
        return false;
    }
}
function isBotMentionedInMessage(message, botNumber) {
    if (!message.message)
        return false;
    const messageTypes = [
        'extendedTextMessage', 'imageMessage', 'videoMessage', 'stickerMessage',
        'documentMessage', 'audioMessage', 'contactMessage', 'locationMessage'
    ];
    for (const type of messageTypes) {
        if (message.message[type]?.contextInfo?.mentionedJid) {
            const mentionedJid = message.message[type].contextInfo.mentionedJid;
            if (mentionedJid.some((jid) => jid === botNumber)) {
                return true;
            }
        }
    }
    const textContent = message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        message.message.imageMessage?.caption ||
        message.message.videoMessage?.caption || '';
    if (textContent) {
        const botUsername = botNumber.split('@')[0];
        if (textContent.includes(`@${botUsername}`)) {
            return true;
        }
        const botNames = [global.botname?.toLowerCase(), 'bot', 'mega', 'mega bot'];
        const words = textContent.toLowerCase().split(/\s+/);
        if (botNames.some(name => words.includes(name))) {
            return true;
        }
    }
    return false;
}
export async function handleAutoread(sock, message) {
    try {
        const ghostMode = await store.getSetting('global', 'stealthMode');
        if (ghostMode && ghostMode.enabled) {
            console.log('👻 Stealth mode active - skipping read receipt');
            return false;
        }
    }
    catch (err) {
    }
    const enabled = await isAutoreadEnabled();
    if (enabled) {
        const botNumber = `${sock.user.id.split(':')[0] }@s.whatsapp.net`;
        const isBotMentioned = isBotMentionedInMessage(message, botNumber);
        if (isBotMentioned) {
            return false;
        }
        else {
            try {
                const key = {
                    remoteJid: message.key.remoteJid,
                    id: message.key.id,
                    participant: message.key.participant
                };
                await sock.readMessages([key]);
                return true;
            }
            catch (error) {
                console.error('Error marking message as read:', error);
                return false;
            }
        }
    }
    return false;
}
export default {
    command: 'autoread',
    aliases: ['read', 'autoreadmsg'],
    category: 'owner',
    description: 'Toggle automatic message reading (blue ticks)',
    usage: '.autoread <on|off>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const t = context.t;
        try {
            const config = await initConfig();
            const action = args[0]?.toLowerCase();
            if (!action) {
                const ghostMode = await store.getSetting('global', 'stealthMode');
                const ghostActive = ghostMode && ghostMode.enabled;
                const status = config.enabled ? `✅ ${t('p.autoread.enabledLabel')}` : `❌ ${t('p.autoread.disabledLabel')}`;
                const stealth = ghostActive ? `👻 ${t('p.autoread.stealthActive')}` : `❌ ${t('p.autoread.stealthInactive')}`;
                const storage = HAS_DB ? t('p.autoread.storageDb') : t('p.autoread.storageFs');
                await sock.sendMessage(chatId, {
                    text: `*📖 ${t('p.autoread.statusTitle')}*\n\n` +
                        `*${t('p.autoread.currentStatus')}:* ${status}\n` +
                        `*${t('p.autoread.stealthMode')}:* ${stealth}\n` +
                        `*${t('p.autoread.storage')}:* ${storage}\n\n` +
                        `*${t('p.autoread.commands')}:*\n` +
                        `• \`.autoread on\` - ${t('p.autoread.cmdOn')}\n` +
                        `• \`.autoread off\` - ${t('p.autoread.cmdOff')}\n\n` +
                        `*${t('p.autoread.whatItDoes')}:*\n` +
                        `${t('p.autoread.whatItDoesDesc')}\n\n` +
                        `*${t('p.autoread.note')}:* ${t('p.autoread.ghostNote')}`,
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            if (action === 'on' || action === 'enable') {
                if (config.enabled) {
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *${t('p.autoread.alreadyEnabled')}*`,
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                config.enabled = true;
                await saveConfig(config);
                const ghostMode = await store.getSetting('global', 'stealthMode');
                const ghostActive = ghostMode && ghostMode.enabled;
                await sock.sendMessage(chatId, {
                    text: `✅ *${t('p.autoread.enabledMsg')}*${ghostActive ? `\n\n⚠️ *${t('p.autoread.note')}:* ${t('p.autoread.ghostOverrideNote')}` : ''}`,
                    ...channelInfo
                }, { quoted: message });
            }
            else if (action === 'off' || action === 'disable') {
                if (!config.enabled) {
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *${t('p.autoread.alreadyDisabled')}*`,
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                config.enabled = false;
                await saveConfig(config);
                await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.autoread.disabledMsg')}*`,
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.autoread.invalidOption')}*`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Error in autoread command:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.autoread.genericError')}*`,
                ...channelInfo
            }, { quoted: message });
        }
    },
    isAutoreadEnabled,
    isBotMentionedInMessage,
    handleAutoread
};
