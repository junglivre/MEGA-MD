import { describe, expect, it } from 'vitest';
import { getAlternateJid, getMessageIdentityAlternatives, getMessageSenderJid, isBotJid, participantMatches } from '../../lib/jid.js';

describe('JID matching', () => {
    it('matches bare LIDs returned by group metadata', () => {
        expect(participantMatches({ lid: '123456789' }, '123456789@lid')).toBe(true);
    });

    it('matches bare phone numbers returned by group metadata', () => {
        expect(participantMatches({ phoneNumber: '5511999999999' }, '5511999999999@s.whatsapp.net')).toBe(true);
    });

    it('remembers the PN carried alongside a message LID', () => {
        const sender = getMessageSenderJid({ key: {
            participant: '123456789@lid',
            participantAlt: '5511999999999@s.whatsapp.net'
        } });
        expect(sender).toBe('123456789@lid');
        expect(getAlternateJid(sender)).toBe('5511999999999@s.whatsapp.net');
    });

    it('returns all sender identities for stateful flows', () => {
        const identities = getMessageIdentityAlternatives({ key: {
            participant: '123456789@lid',
            participantAlt: '5511999999999@s.whatsapp.net'
        } });
        expect(identities).toEqual(expect.arrayContaining([
            '123456789@lid',
            '5511999999999@s.whatsapp.net'
        ]));
    });
});

describe('isBotJid', () => {
    const sock = { user: { id: '5511888888888:12@s.whatsapp.net', lid: '987654321@lid' } };

    it('matches the bot own phone-number JID, ignoring the device suffix', () => {
        expect(isBotJid(sock, '5511888888888@s.whatsapp.net')).toBe(true);
    });

    it('matches the bot own LID', () => {
        expect(isBotJid(sock, '987654321@lid')).toBe(true);
    });

    it('rejects anyone else', () => {
        expect(isBotJid(sock, '5511999999999@s.whatsapp.net')).toBe(false);
    });

    it('rejects a missing jid', () => {
        expect(isBotJid(sock, null)).toBe(false);
        expect(isBotJid({}, '5511888888888@s.whatsapp.net')).toBe(false);
    });
});
