import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { resolveAbility } from '../domain/abilityRegistry';
import { applyEvents, makeMatchState, makeStateWithBases } from './helpers';
import { isBaseAbilitySuppressed } from '../domain/ongoingEffects';

beforeAll(() => {
    clearRegistry();
    clearInteractionHandlers();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('ninja_infiltrate_pod talent', () => {
    it('should suppress base ability until next turn start', () => {
        const core = makeStateWithBases([{
            defId: 'test_base',
            minions: [],
            ongoingActions: [{ uid: 'inf-1', defId: 'ninja_infiltrate_pod', ownerId: '0' }],
        } as any]);
        const matchState = makeMatchState(core);

        const exec = resolveAbility('ninja_infiltrate_pod', 'talent');
        expect(exec).toBeDefined();

        const result = exec!({
            state: matchState.core,
            matchState,
            playerId: '0',
            cardUid: 'inf-1',
            defId: 'ninja_infiltrate_pod',
            baseIndex: 0,
            now: 1000,
            random: { shuffle: <T>(xs: T[]) => xs } as any,
        } as any);

        const newCore = applyEvents(core, result.events ?? []);
        expect(isBaseAbilitySuppressed(newCore, 0)).toBe(true);
    });
});

