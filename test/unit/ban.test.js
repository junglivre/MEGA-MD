import { describe, expect, it } from 'vitest';
import ban from '../../plugins/ban.js';
import unban, { extractUnbanTarget } from '../../plugins/unban.js';
import { findBannedIdentities, normalizeBanTarget } from '../../lib/bannedUsers.js';

describe('ban command permissions', () => {
    it('restricts ban and unban to the bot owner', () => {
        expect(ban.strictOwnerOnly).toBe(true);
        expect(ban.strictOwnerOnlyNotice).toBe('p.ban.kickHint');
        expect(unban.strictOwnerOnly).toBe(true);
    });
});

describe('unban targets', () => {
    it('accepts a database LID in private chat arguments', () => {
        const message = { message: { conversation: '/unban 123456789@lid' } };
        expect(extractUnbanTarget(message, ['123456789@lid'])).toBe('123456789@lid');
    });

    it('accepts a bare database LID and the lid: prefix', () => {
        expect(normalizeBanTarget('123456789')).toBe('123456789');
        expect(normalizeBanTarget('lid:123456789')).toBe('123456789@lid');
    });

    it('matches normalized LIDs exactly, including stored device suffixes', () => {
        const banned = ['123456789:17@lid', '5511999999999@s.whatsapp.net'];
        expect(findBannedIdentities(banned, '123456789@lid')).toEqual(['123456789:17@lid']);
        expect(findBannedIdentities(banned, '123456789')).toEqual(['123456789:17@lid']);
    });

    it('rejects arbitrary text as a database identity', () => {
        expect(normalizeBanTarget('fulano')).toBeNull();
    });
});
