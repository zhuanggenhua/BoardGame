import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { makeMatchState, makeStateWithBases } from './helpers';
import { isBaseAbilitySuppressed } from '../domain/ongoingEffects';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';

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

        const result = runCommand(
            matchState,
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'inf-1', baseIndex: 0 },
            } as any,
            { shuffle: <T>(xs: T[]) => xs } as any,
        );

        expect(result.success).toBe(true);
        expect(isBaseAbilitySuppressed(result.finalState.core, 0)).toBe(true);
    });
});

