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
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';
import pino from 'pino';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import store from '../lib/lightweight_store.js';
if (!global.conns)
    global.conns = [];
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
async function saveCloneSession(authId, data) {
    if (HAS_DB) {
        await store.saveSetting('clones', authId, data);
    }
    else {
        const sessionPath = path.join(process.cwd(), 'session', 'clones', authId);
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        fs.writeFileSync(path.join(sessionPath, 'session.json'), JSON.stringify(data));
    }
}
async function _getCloneSession(authId) {
    if (HAS_DB) {
        return await store.getSetting('clones', authId);
    }
    else {
        const sessionPath = path.join(process.cwd(), 'session', 'clones', authId, 'session.json');
        if (fs.existsSync(sessionPath)) {
            return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        }
        return null;
    }
}
async function deleteCloneSession(authId) {
    if (HAS_DB) {
        await store.saveSetting('clones', authId, null);
    }
    else {
        const sessionPath = path.join(process.cwd(), 'session', 'clones', authId);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }
    }
}
async function _getAllCloneSessions() {
    if (HAS_DB) {
        const settings = await store.getSetting('clones', 'all') || {};
        return Object.keys(settings);
    }
    else {
        const clonesDir = path.join(process.cwd(), 'session', 'clones');
        if (!fs.existsSync(clonesDir))
            return [];
        return fs.readdirSync(clonesDir);
    }
}
export default {
    command: 'rentbot',
    aliases: ['botclone', 'clonebot'],
    category: 'owner',
    description: 'Start a sub-bot clone via pairing code',
    usage: '.rentbot 92305xxxxxxx',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, t } = context;
        if (!args[0]) {
            return await sock.sendMessage(chatId, {
                text: `*${t('p.rentbot.usage')}:* \`.rentbot 923051391xxx\``
            }, { quoted: message });
        }
        const userNumber = args[0].replace(/[^0-9]/g, '');
        const authId = crypto.randomBytes(4).toString('hex');
        const sessionPath = path.join(process.cwd(), 'session', 'clones', authId);
        if (!HAS_DB && !fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        async function startClone() {
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestBaileysVersion();
            const msgRetryCounterCache = new NodeCache();
            const conn = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: Browsers.macOS("Chrome"),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                msgRetryCounterCache,
                connectTimeoutMs: 120000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 30000,
                mobile: false
            });
            if (!conn.authState.creds.registered) {
                await new Promise(resolve => setTimeout(resolve, 6000));
                try {
                    let code = await conn.requestPairingCode(userNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    const pairingText = `*${t('p.rentbot.cloneSystemTitle')}*\n\n` +
                        `${t('p.rentbot.code')}: *${code}*\n` +
                        `${t('p.rentbot.storage')}: *${HAS_DB ? t('p.rentbot.storageDb') : t('p.rentbot.storageFs')}*\n\n` +
                        `${t('p.rentbot.step1')}\n` +
                        `${t('p.rentbot.step2')}\n` +
                        `${t('p.rentbot.step3')}\n\n` +
                        `*${t('p.rentbot.tip')}*`;
                    await sock.sendMessage(chatId, { text: pairingText }, { quoted: message });
                }
                catch (err) {
                    console.error("Pairing Error:", err);
                    await sock.sendMessage(chatId, { text: `❌ ${t('p.rentbot.codeFailed')}` });
                }
            }
            conn.ev.on('creds.update', async () => {
                await saveCreds();
                if (HAS_DB) {
                    try {
                        await saveCloneSession(authId, {
                            userNumber,
                            createdAt: Date.now(),
                            status: 'active'
                        });
                    }
                    catch (e) {
                        console.error("DB save error:", e.message);
                    }
                }
            });
            conn.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === 'open') {
                    global.conns.push(conn);
                    if (HAS_DB) {
                        await saveCloneSession(authId, {
                            userNumber,
                            createdAt: Date.now(),
                            status: 'online',
                            connectedAt: Date.now()
                        });
                    }
                    await sock.sendMessage(chatId, {
                        text: `✅ ${t('p.rentbot.online')}\n\n` +
                            `${t('p.rentbot.id')}: ${authId}\n` +
                            `${t('p.rentbot.storage')}: ${HAS_DB ? t('p.rentbot.storageDb') : t('p.rentbot.storageFs')}`
                    }, { quoted: message });
                }
                if (connection === 'close') {
                    const code = lastDisconnect?.error?.output?.statusCode;
                    if (code !== DisconnectReason.loggedOut) {
                        startClone();
                    }
                    else {
                        await deleteCloneSession(authId);
                        const index = global.conns.indexOf(conn);
                        if (index > -1)
                            global.conns.splice(index, 1);
                    }
                }
            });
            try {
                const { handleMessages } = await import('../lib/messageHandler.js');
                conn.ev.on('messages.upsert', async (chatUpdate) => {
                    await handleMessages(conn, chatUpdate);
                });
            }
            catch (e) {
                console.error("Handler linkage failed:", e.message);
            }
            return conn;
        }
        await startClone();
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
