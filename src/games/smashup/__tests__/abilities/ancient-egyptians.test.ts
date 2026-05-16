import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry, resolveAbility, type AbilityContext } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { defaultTestRandom } from '../testRunner';
import {
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    makeBase,
    makeMatchState,
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
        const state = makeState({ bases: [makeBase(), makeBase()] });
        const matchState = makeMatchState(state);
        const executor = resolveAbility('ancient_egyptians_plague_of_locusts', 'onPlay');

        expect(executor).toBeDefined();
        const result = executor!({
            state,
            matchState,
            playerId: '0',
            cardUid: 'plague-1',
            defId: 'ancient_egyptians_plague_of_locusts',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 0,
        } as AbilityContext);

        const current = getSimpleChoicePrompt(result.matchState!, 'ancient_egyptians_plague_of_locusts');
        expect(getPromptSourceId(current)).toBe('ancient_egyptians_plague_of_locusts');
        expect(getPromptTargetType(current)).toBe('base');
    });
});
