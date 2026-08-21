import fs from 'fs';
import path from 'path';
import isOwnerOrSudo from '../lib/isOwner.js';
import { channelInfo } from '../lib/messageConfig.js';
export default {
    command: 'clearsession',
    aliases: ['clearses', 'csession'],
    category: 'owner',
    description: 'Clear session files',
    usage: '.clearsession',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const t = context.t;
        try {
            const senderId = message.key.participant || message.key.remoteJid;
            const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
            if (!message.key.fromMe && !isOwner) {
                return await sock.sendMessage(chatId, { text: `*${t('p.clearsession.ownerOnly')}*`, ...channelInfo });
            }
            const sessionDir = path.join(process.cwd(), 'session');
            if (!fs.existsSync(sessionDir)) {
                return await sock.sendMessage(chatId, { text: `*${t('p.clearsession.dirNotFound')}*`, ...channelInfo });
            }
            let filesCleared = 0;
            let errors = 0;
            const errorDetails = [];
            await sock.sendMessage(chatId, { text: `🔍 ${t('p.clearsession.optimizing')}`, ...channelInfo });
            const files = fs.readdirSync(sessionDir);
            let appStateSyncCount = 0;
            let preKeyCount = 0;
            for (const file of files) {
                if (file.startsWith('app-state-sync-'))
                    appStateSyncCount++;
                if (file.startsWith('pre-key-'))
                    preKeyCount++;
            }
            for (const file of files) {
                if (file === 'creds.json')
                    continue;
                if (file.startsWith('app-state-sync-key-'))
                    continue;
                try {
                    fs.unlinkSync(path.join(sessionDir, file));
                    filesCleared++;
                }
                catch (err) {
                    errors++;
                    errorDetails.push(t('p.clearsession.deleteFailed', { file, error: err.message }));
                }
            }
            const msgText = `✅ ${t('p.clearsession.successTitle')}\n\n` +
                `📊 ${t('p.clearsession.statsLabel')}:\n` +
                `• ${t('p.clearsession.totalCleared')}: ${filesCleared}\n` +
                `• ${t('p.clearsession.appStateSyncFiles')}: ${appStateSyncCount}\n` +
                `• ${t('p.clearsession.preKeyFiles')}: ${preKeyCount}\n${
                errors > 0 ? `\n⚠️ ${t('p.clearsession.errorsEncountered', { count: errors })}\n${errorDetails.join('\n')}` : ''}`;
            await sock.sendMessage(chatId, { text: msgText, ...channelInfo });
        }
        catch {
            await sock.sendMessage(chatId, { text: `❌ ${t('p.clearsession.genericError')}`, ...channelInfo });
        }
    }
};
