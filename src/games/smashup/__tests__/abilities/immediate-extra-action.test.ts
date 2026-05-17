import { beforeAll, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { queueImmediateExtraPlayInteractions } from '../../domain/extraPlay';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { SmashUpCore } from '../../domain/types';
import { SU_EVENTS } from '../../domain/types';
import {
    getPromptHandlerData,
    getPromptOption,
    getPromptOptionsGenerator,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveInteractionChain,
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

function queueImmediateExtraAction(matchState: MatchState<SmashUpCore>) {
    const immediateEvent = {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: {
            playerId: '0',
            limitType: 'action',
            delta: 1,
            reason: 'test_immediate_extra_action',
            playTiming: 'immediate',
        },
        timestamp: 1000,
    } as const;

    return queueImmediateExtraPlayInteractions(matchState, [immediateEvent as any]);
}

describe('立即额外行动交互', () => {
    it('立即额外行动应包含需要基地目标的行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ancient_egyptians_you_can_take_it_with_you', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const queuedState = queueImmediateExtraAction(makeMatchState(state));
        const prompt = getSimpleChoicePrompt(queuedState, 'smashup_immediate_extra_action');
        const optionsGenerator = getPromptOptionsGenerator(prompt);
        expect(typeof optionsGenerator).toBe('function');

        const options = optionsGenerator!(queuedState, getPromptHandlerData(prompt));
        const hasCardOption = options.some((option: any) => option?.value?.defId === 'ancient_egyptians_you_can_take_it_with_you');
        expect(hasCardOption).toBe(true);
    });

    it('立即额外行动应包含需要随从目标的行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'samurai_way_of_the_warrior', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [makeMinion('m1', 'test_ally', '0', 2)],
                ongoingActions: [],
            })],
        });

        const queuedState = queueImmediateExtraAction(makeMatchState(state));
        const prompt = getSimpleChoicePrompt(queuedState, 'smashup_immediate_extra_action');
        const optionsGenerator = getPromptOptionsGenerator(prompt);
        expect(typeof optionsGenerator).toBe('function');

        const options = optionsGenerator!(queuedState, getPromptHandlerData(prompt));
        const hasCardOption = options.some((option: any) => option?.value?.defId === 'samurai_way_of_the_warrior');
        expect(hasCardOption).toBe(true);
    });

    it('立即额外行动应能实际打出需要基地目标的行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ancient_egyptians_you_can_take_it_with_you', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const result = resolveInteractionChain(
            queueImmediateExtraAction(makeMatchState(state)),
            prompt => {
                const option = getPromptOption(
                    prompt,
                    candidate => candidate?.value?.defId === 'ancient_egyptians_you_can_take_it_with_you',
                    'immediate extra action card option',
                );
                return { optionId: option.id };
            },
        );

        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'a1')).toBe(false);
        expect(result.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'a1')).toBe(true);
    });

    it('立即额外行动应能实际打出需要随从目标的行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'samurai_way_of_the_warrior', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [makeMinion('ally-1', 'test_ally', '0', 2)],
                ongoingActions: [],
            })],
        });

        const result = resolveInteractionChain(
            queueImmediateExtraAction(makeMatchState(state)),
            prompt => {
                const option = getPromptOption(
                    prompt,
                    candidate => candidate?.value?.defId === 'samurai_way_of_the_warrior',
                    'immediate extra action card option',
                );
                return { optionId: option.id };
            },
        );

        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'a1')).toBe(false);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.tempPowerModifier).toBe(3);
    });
});
