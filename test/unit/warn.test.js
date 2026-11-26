import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createMockSock } from '../mocks/baileys.js';
import warnPlugin from '../../plugins/warn.js';

const WARNINGS_FILE = path.join(process.cwd(), 'data', 'warnings.json');
const t = (key) => key;

function warnMessage(chatId, mentionedJid) {
    return {
        key: { remoteJid: chatId, fromMe: false, id: 'WARN1', participant: '923009999999@s.whatsapp.net' },
        message: { extendedTextMessage: { text: '.warn', contextInfo: { mentionedJid: [mentionedJid] } } }
    };
}

async function withWarningsFile(run) {
    const orig = fs.existsSync(WARNINGS_FILE) ? fs.readFileSync(WARNINGS_FILE, 'utf8') : null;
    try {
        await run();
    }
    finally {
        if (orig === null)
            fs.rmSync(WARNINGS_FILE, { force: true });
        else
            fs.writeFileSync(WARNINGS_FILE, orig);
    }
}

describe('.warn', () => {
    it('refuses to warn the bot itself', () => withWarningsFile(async () => {
        const sock = createMockSock(); // user.id: 923000000000:1@s.whatsapp.net
        const chatId = '120363000000000099@g.us';
        const message = warnMessage(chatId, '923000000000@s.whatsapp.net');
        const context = { chatId, senderId: '923009999999@s.whatsapp.net', channelInfo: {}, t };

        await warnPlugin.handler(sock, message, [], context);

        expect(sock._lastMessage()?.content?.text).toContain('p.warn.cantWarnBot');
        expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
        const saved = fs.existsSync(WARNINGS_FILE) ? JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf8')) : {};
        expect(saved[chatId]).toBeUndefined();
    }));

    it('still warns a regular member', () => withWarningsFile(async () => {
        const sock = createMockSock();
        const chatId = '120363000000000099@g.us';
        const message = warnMessage(chatId, '923001111111@s.whatsapp.net');
        const context = { chatId, senderId: '923009999999@s.whatsapp.net', channelInfo: {}, t };

        await warnPlugin.handler(sock, message, [], context);

        const saved = JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf8'));
        expect(saved[chatId]['923001111111@s.whatsapp.net']).toBe(1);
        expect(sock._lastMessage()?.content?.text).not.toContain('cantWarnBot');
    }));
});
