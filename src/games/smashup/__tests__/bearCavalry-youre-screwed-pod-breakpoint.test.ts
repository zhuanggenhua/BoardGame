import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getEffectiveBreakpoint } from '../domain/ongoingModifiers';
import { makeBase, makeMinion, makeStateWithBases } from './helpers';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('bear_cavalry_youre_screwed_pod: 动态爆破点修正', () => {
    it('默认：每个在此基地有随从的玩家 +2 爆破点', () => {
        const base = makeBase('base_the_jungle', [
            makeMinion('m0', 'test_minion', '0', 3),
            makeMinion('m1', 'test_minion', '1', 3),
        ]);
        base.ongoingActions = [{ uid: 'oa1', defId: 'bear_cavalry_youre_screwed_pod', ownerId: '0' } as any];

        const state = makeStateWithBases([base]);
        const baseBreakpoint = getEffectiveBreakpoint(
            makeStateWithBases([makeBase('base_the_jungle')]),
            0,
        );

        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint + 4);
    });

    it('若本回合曾把对手随从移动到此基地：改为每个玩家 -2 爆破点', () => {
        const base = makeBase('base_the_jungle', [
            makeMinion('m0', 'test_minion', '0', 3),
            makeMinion('m1', 'test_minion', '1', 3),
        ]);
        base.ongoingActions = [{ uid: 'oa1', defId: 'bear_cavalry_youre_screwed_pod', ownerId: '0' } as any];

        const state = makeStateWithBases([base], {
            movedToBasesThisTurn: { 0: true },
        });
        const baseBreakpoint = getEffectiveBreakpoint(
            makeStateWithBases([makeBase('base_the_jungle')]),
            0,
        );

        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint - 4);
    });
});

