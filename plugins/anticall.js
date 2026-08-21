import store from '../lib/lightweight_store.js';
import fs from 'fs';
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const ANTICALL_PATH = './data/anticall.json';
async function readState() {
    try {
        if (HAS_DB) {
            const settings = await store.getSetting('global', 'anticall');
            return settings || { enabled: false };
        }
        else {
            if (!fs.existsSync(ANTICALL_PATH))
                return { enabled: false };
            const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
            const data = JSON.parse(raw || '{}');
            return { enabled: !!data.enabled };
        }
    }
    catch {
        return { enabled: false };
    }
}
async function writeState(enabled) {
    try {
        if (HAS_DB) {
            await store.saveSetting('global', 'anticall', { enabled: !!enabled });
        }
        else {
            if (!fs.existsSync('./data'))
                fs.mkdirSync('./data', { recursive: true });
            fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
        }
    }
    catch (e) {
        console.error('Error writing anticall state:', e);
    }
}
export default {
    command: 'anticall',
    aliases: ['acall', 'callblock'],
    category: 'owner',
    description: 'Enable or disable auto-blocking of incoming calls',
    usage: '.anticall <on|off|status>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const { t } = context;
        const state = await readState();
        const sub = args.join(' ').trim().toLowerCase();
        const storageLabel = HAS_DB ? t('p.anticall.database') : t('p.anticall.fileSystem');
        if (!sub || !['on', 'off', 'status'].includes(sub)) {
            return await sock.sendMessage(chatId, {
                text: `*${t('p.anticall.settingsTitle')}*\n\n` +
                    `📵 ${t('p.anticall.autoBlock')}\n\n` +
                    `*${t('p.anticall.usageLabel')}:*\n` +
                    `• \`.anticall on\` - ${t('p.anticall.enableHint')}\n` +
                    `• \`.anticall off\` - ${t('p.anticall.disableHint')}\n` +
                    `• \`.anticall status\` - ${t('p.anticall.statusHint')}\n\n` +
                    `*${t('p.anticall.currentStatus')}:* ${state.enabled ? `✅ ${t('p.anticall.enabledCaps')}` : `❌ ${t('p.anticall.disabledCaps')}`}\n` +
                    `*${t('p.anticall.storage')}:* ${storageLabel}`
            }, { quoted: message });
        }
        if (sub === 'status') {
            return await sock.sendMessage(chatId, {
                text: `📵 *${t('p.anticall.statusTitle')}*\n\n` +
                    `${t('p.anticall.currentLabel')}: ${state.enabled ? `✅ *${t('p.anticall.enabledCaps')}*` : `❌ *${t('p.anticall.disabledCaps')}*`}\n` +
                    `${t('p.anticall.storage')}: ${storageLabel}\n\n` +
                    `${state.enabled ? t('p.anticall.callsWillBeBlocked') : t('p.anticall.callsAllowed')}`
            }, { quoted: message });
        }
        const enable = sub === 'on';
        await writeState(enable);
        await sock.sendMessage(chatId, {
            text: `📵 *${t('p.anticall.anticallTitle', { state: enable ? t('p.anticall.enabledCaps') : t('p.anticall.disabledCaps') })}*\n\n` +
                `${enable ? `✅ ${t('p.anticall.willBeBlocked')}` : `❌ ${t('p.anticall.nowAllowed')}`}`
        }, { quoted: message });
    },
    readState,
    writeState
};
