import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { SU_COMMANDS } from '../../domain/types';
import { defaultTestRandom, runCommand } from '../testRunner';
import {
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makePlayer,
    makeState,
} from '../helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('ancient_egyptians_plague_of_locusts onPlay', () => {
    it('正常打出时会创建选基地交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('plague-1', 'ancient_egyptians_plague_of_locusts', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
        });
        const matchState = makeMatchState(state);
        const result = runCommand(
            matchState,
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'plague-1', targetBaseIndex: 0 },
            } as any,
            defaultTestRandom,
        );

        expect(result.success).toBe(true);
        const current = getSimpleChoicePrompt(result.finalState, 'ancient_egyptians_plague_of_locusts');
        expect(getPromptSourceId(current)).toBe('ancient_egyptians_plague_of_locusts');
        expect(getPromptTargetType(current)).toBe('base');
    });
});
