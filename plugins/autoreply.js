import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { channelInfo } from '../lib/messageConfig.js';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const configPath = dataFile('autoreplies.json');
async function initConfig() {
    if (HAS_DB) {
        const config = await store.getSetting('global', 'autoreplies');
        return config || { enabled: true, replies: [] };
    }
    else {
        if (!fs.existsSync(configPath)) {
            const dataDir = path.dirname(configPath);
            if (!fs.existsSync(dataDir))
                fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify({ enabled: true, replies: [] }, null, 2));
        }
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
}
async function saveConfig(config) {
    if (HAS_DB) {
        await store.saveSetting('global', 'autoreplies', config);
    }
    else {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
}
// Named export — imported in lib/messageHandler.ts
export async function handleAutoReply(sock, chatId, message, userMessage) {
    try {
        const config = await initConfig();
        if (!config.enabled || !config.replies.length)
            return false;
        const lowerMsg = userMessage.toLowerCase().trim();
        for (const reply of config.replies) {
            const trigger = reply.trigger.toLowerCase();
            const matched = reply.exactMatch
                ? lowerMsg === trigger
                : lowerMsg.includes(trigger);
            if (matched) {
                const senderName = message.pushName || 'there';
                const responseText = reply.response.replace(/\{name\}/gi, senderName);
                await sock.sendMessage(chatId, {
                    text: responseText,
                    ...channelInfo
                }, { quoted: message });
                return true;
            }
        }
    }
    catch (e) {
        console.error('[AUTOREPLY] Error:', e.message);
    }
    return false;
}
export { initConfig, saveConfig };
export default {
    command: 'autoreply',
    aliases: ['ar', 'autorespond'],
    category: 'owner',
    description: 'Toggle the auto-reply system on or off',
    usage: '.autoreply <on|off>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const t = context.t;
        try {
            const config = await initConfig();
            const action = args[0]?.toLowerCase();
            if (!action) {
                const status = config.enabled ? `✅ ${t('p.autoreply.enabledLabel')}` : `❌ ${t('p.autoreply.disabledLabel')}`;
                const storage = HAS_DB ? t('p.autoreply.storageDb') : t('p.autoreply.storageFs');
                return await sock.sendMessage(chatId, {
                    text: `*🤖 ${t('p.autoreply.statusTitle')}*\n\n` +
                        `*${t('p.autoreply.status')}:* ${status}\n` +
                        `*${t('p.autoreply.totalReplies')}:* ${config.replies.length}\n` +
                        `*${t('p.autoreply.storage')}:* ${storage}\n\n` +
                        `*${t('p.autoreply.commands')}:*\n` +
                        `• \`.autoreply on\` - ${t('p.autoreply.cmdOn')}\n` +
                        `• \`.autoreply off\` - ${t('p.autoreply.cmdOff')}\n` +
                        `• \`.addreply\` - ${t('p.autoreply.cmdAddReply')}\n` +
                        `• \`.delreply\` - ${t('p.autoreply.cmdDelReply')}\n` +
                        `• \`.listreplies\` - ${t('p.autoreply.cmdListReplies')}`,
                    ...channelInfo
                }, { quoted: message });
            }
            if (action === 'on' || action === 'enable') {
                if (config.enabled) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ *${t('p.autoreply.alreadyEnabled')}*`,
                        ...channelInfo
                    }, { quoted: message });
                }
                config.enabled = true;
                await saveConfig(config);
                return await sock.sendMessage(chatId, {
                    text: `✅ *${t('p.autoreply.enabledMsg')}*`,
                    ...channelInfo
                }, { quoted: message });
            }
            if (action === 'off' || action === 'disable') {
                if (!config.enabled) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ *${t('p.autoreply.alreadyDisabled')}*`,
                        ...channelInfo
                    }, { quoted: message });
                }
                config.enabled = false;
                await saveConfig(config);
                return await sock.sendMessage(chatId, {
                    text: `❌ *${t('p.autoreply.disabledMsg')}*`,
                    ...channelInfo
                }, { quoted: message });
            }
            return await sock.sendMessage(chatId, {
                text: `❌ *${t('p.autoreply.invalidOption')}*`,
                ...channelInfo
            }, { quoted: message });
        }
        catch (e) {
            console.error('Error in autoreply command:', e);
            await sock.sendMessage(chatId, {
                text: `❌ *${t('p.autoreply.genericError')}*`,
                ...channelInfo
            }, { quoted: message });
        }
    },
    handleAutoReply,
    initConfig,
    saveConfig
};
