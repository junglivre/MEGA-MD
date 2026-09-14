import { describe, expect, it } from 'vitest';
import alive from '../../plugins/alive.js';

describe('alive command triggers', () => {
    it('does not use bot as a prefixless alias', () => {
        expect(alive.isPrefixless).toBe(true);
        expect(alive.aliases).toContain('status');
        expect(alive.aliases).not.toContain('bot');
    });
});
