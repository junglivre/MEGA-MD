import { describe, expect, it } from 'vitest';
import {
    addInsideJoke,
    createBank,
    findInsideJokes,
    linkInsideJokeBank,
    normalizeInsideJokeText
} from '../../lib/insideJokes.js';

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

});
