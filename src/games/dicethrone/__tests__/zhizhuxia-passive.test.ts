import { describe, expect, it } from 'vitest';

import { isPassiveActionUsable } from '../domain/passiveAbility';
import { TOKEN_IDS } from '../domain/ids';
import { createHeroMatchup, fixedRandom } from './test-utils';

describe('蜘蛛侠连击被动', () => {
    it('同一回合已使用后不可再次触发', () => {
        const state = createHeroMatchup('zhizhuxia', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.COMBO] = 1;
        state.core.lastResolvedAttackDamage = 3;

        const context = { responseWindowType: 'afterAttackResolved' as const };
        expect(isPassiveActionUsable(
            state.core,
            '0',
            'zhizhuxia-combo',
            0,
            'main2',
            context,
        )).toBe(true);

        state.core.passiveActionUsedThisTurn = {
            '0': { 'zhizhuxia-combo-extra-attack': true },
        };

        expect(isPassiveActionUsable(
            state.core,
            '0',
            'zhizhuxia-combo',
            0,
            'main2',
            context,
        )).toBe(false);
    });
});
