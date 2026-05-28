import { describe, expect, it } from 'vitest';
import { getScoringEligibleBaseIndices } from '../domain/ongoingModifiers';
import { makeBase, makeMinion, makeState } from './helpers';

describe('getScoringEligibleBaseIndices 回退兼容', () => {
    it('旧快照把 scoringEligibleBaseIndices 写成 null 时，应回退到实时计算而不是崩溃', () => {
        const baseState = makeState({
            bases: [
                makeBase('base_the_workshop', [
                    makeMinion('m1', 'pirate_first_mate', '0', 2),
                    makeMinion('m2', 'pirate_buccaneer', '1', 4),
                ]),
            ],
            scoringEligibleBaseIndices: undefined,
        });

        const expected = getScoringEligibleBaseIndices(baseState);
        const legacyState = {
            ...baseState,
            scoringEligibleBaseIndices: null as unknown as number[],
        };

        expect(getScoringEligibleBaseIndices(legacyState)).toEqual(expected);
    });
});
