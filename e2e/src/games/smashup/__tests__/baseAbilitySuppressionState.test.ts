import { describe, expect, it } from 'vitest';
import { isBaseAbilitySuppressed } from '../domain/ongoingEffects';
import { makeStateWithBases, makeBase } from './helpers';

describe('isBaseAbilitySuppressed: state-based suppression', () => {
    it('should treat suppressedBasesUntilTurnStart as suppressed even without any active cards', () => {
        const state = makeStateWithBases([makeBase('base_the_jungle')], {
            suppressedBasesUntilTurnStart: [{ baseIndex: 0, suppressorPlayerId: '0' }],
        } as any);

        expect(isBaseAbilitySuppressed(state, 0)).toBe(true);
    });
});

