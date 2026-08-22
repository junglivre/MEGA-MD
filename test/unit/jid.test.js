import { describe, expect, it } from 'vitest';
import { participantMatches } from '../../lib/jid.js';

describe('JID matching', () => {
    it('matches bare LIDs returned by group metadata', () => {
        expect(participantMatches({ lid: '123456789' }, '123456789@lid')).toBe(true);
    });

    it('matches bare phone numbers returned by group metadata', () => {
        expect(participantMatches({ phoneNumber: '5511999999999' }, '5511999999999@s.whatsapp.net')).toBe(true);
    });
});
