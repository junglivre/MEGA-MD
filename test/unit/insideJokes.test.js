import { describe, expect, it } from 'vitest';
import {
    addInsideJoke,
    createBank,
    findInsideJokes,
    linkInsideJokeBank,
    normalizeInsideJokeText
} from '../../lib/insideJokes.js';
import { normalizeJid } from '../../lib/jid.js';

describe('inside joke banks', () => {
    it('normalizes accents and casing for keyword matching', () => {
        expect(normalizeInsideJokeText(' BÍXOS ')).toBe('bixos');
    });

    it('finds matching jokes only in linked groups', () => {
        const state = { banks: {} };
        createBank(state, 'bixos', 'owner');
        addInsideJoke(state, 'bixos', ['careca', 'ichigo'], 'A recurring joke about the group.', 'owner');
        addInsideJoke(state, 'bixos', ['careca'], 'A more specific bald-person context.', 'owner');
        linkInsideJokeBank(state, 'bixos', '123@g.us');

        expect(findInsideJokes(state, '123@g.us', 'esse careca apareceu')).toHaveLength(2);
        expect(findInsideJokes(state, '999@g.us', 'esse careca apareceu')).toHaveLength(0);
    });

    it('keeps flow identities normalized across device suffixes', () => {
        expect(normalizeJid('123456789:4@lid')).toBe('123456789@lid');
        expect(normalizeJid('5511999999999:7@s.whatsapp.net')).toBe('5511999999999@s.whatsapp.net');
    });
});
