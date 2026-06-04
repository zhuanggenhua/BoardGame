import { beforeAll, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { queueImmediateExtraPlayInteractions } from '../../domain/extraPlay';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { SmashUpCore, TitanState } from '../../domain/types';
import { SU_EVENTS } from '../../domain/types';
import {
    getPromptHandlerData,
    getPromptOption,
    getPromptOptionsGenerator,
    getPromptSourceId,
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

function queueImmediateExtraMinion(matchState: MatchState<SmashUpCore>) {
    const immediateEvent = {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: {
            playerId: '0',
            limitType: 'minion',
            delta: 1,
            reason: 'test_immediate_extra_minion',
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

    it('立即额外随从应推进到基地选择，不应停留在原交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'zombie_walker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_secret_garden',
                    minions: [],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const result = resolveInteractionChain(
            queueImmediateExtraMinion(makeMatchState(state)),
            prompt => {
                const sourceId = getPromptSourceId(prompt);
                if (sourceId === 'smashup_immediate_extra_minion') {
                    const option = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.defId === 'zombie_walker',
                        'immediate extra minion card option',
                    );
                    return { optionId: option.id };
                }
                if (sourceId === 'smashup_immediate_extra_minion_base') {
                    const option = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.baseIndex === 1,
                        'immediate extra minion base option',
                    );
                    return { optionId: option.id };
                }
                throw new Error(`unexpected prompt source: ${String(sourceId)}`);
            },
        );

        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'h1')).toBe(false);
        expect(result.finalState.core.bases[1].minions.some(minion => minion.uid === 'h1')).toBe(true);
    });

    it('立即额外随从应允许选择可作为随从打出的 setaside 泰坦', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_secret_garden',
                    minions: [makeMinion('ally-0', 'zombie_walker', '0', 2)],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [makeMinion('ally-1', 'alien_invader', '0', 3)],
                    ongoingActions: [],
                }),
            ],
        });
        const matchState = makeMatchState(state);
        matchState.core.titans = [{
            uid: 't-ursa',
            defId: 'bear_cavalry_major_ursa',
            faction: 'bear_cavalry',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
        } satisfies TitanState];

        const result = resolveInteractionChain(
            queueImmediateExtraMinion(matchState),
            prompt => {
                const sourceId = getPromptSourceId(prompt);
                if (sourceId === 'smashup_immediate_extra_minion') {
                    const option = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.titanUid === 't-ursa',
                        'immediate extra minion titan option',
                    );
                    return { optionId: option.id };
                }
                if (sourceId === 'smashup_immediate_extra_minion_base') {
                    const option = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.baseIndex === 1,
                        'immediate extra minion titan base option',
                    );
                    return { optionId: option.id };
                }
                throw new Error(`unexpected prompt source: ${String(sourceId)}`);
            },
        );

        const titanPlayed = result.events.find(event => event.type === SU_EVENTS.TITAN_PLAYED);
        expect(titanPlayed).toBeDefined();
        expect((titanPlayed as any).payload).toMatchObject({
            titanUid: 't-ursa',
            defId: 'bear_cavalry_major_ursa',
            controllerId: '0',
            baseIndex: 1,
            reason: 'bear_cavalry_major_ursa_special',
        });

        expect((result.finalState.core.titans ?? []).find(titan => titan.uid === 't-ursa')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('smashup_immediate_extra_minion 应允许当前控制者选择 borrowed setaside 泰坦', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_secret_garden',
                    minions: [makeMinion('ally-0', 'zombie_walker', '0', 2)],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [makeMinion('ally-1', 'alien_invader', '0', 3)],
                    ongoingActions: [],
                }),
            ],
        });
        const matchState = makeMatchState(state);
        matchState.core.titans = [{
            uid: 'borrowed-ursa',
            defId: 'bear_cavalry_major_ursa',
            faction: 'bear_cavalry',
            ownerId: '1',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
        } satisfies TitanState];

        const result = resolveInteractionChain(
            queueImmediateExtraMinion(matchState),
            prompt => {
                const sourceId = getPromptSourceId(prompt);
                if (sourceId === 'smashup_immediate_extra_minion') {
                    const option = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.titanUid === 'borrowed-ursa',
                        'borrowed immediate extra minion titan option',
                    );
                    return { optionId: option.id };
                }
                if (sourceId === 'smashup_immediate_extra_minion_base') {
                    const option = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.baseIndex === 1,
                        'borrowed immediate extra minion titan base option',
                    );
                    return { optionId: option.id };
                }
                throw new Error(`unexpected prompt source: ${String(sourceId)}`);
            },
        );

        const titanPlayed = result.events.find(event => event.type === SU_EVENTS.TITAN_PLAYED);
        expect(titanPlayed).toBeDefined();
        expect((titanPlayed as any).payload).toMatchObject({
            titanUid: 'borrowed-ursa',
            defId: 'bear_cavalry_major_ursa',
            ownerId: '1',
            controllerId: '0',
            baseIndex: 1,
            reason: 'bear_cavalry_major_ursa_special',
        });

        expect((result.finalState.core.titans ?? []).find(titan => titan.uid === 'borrowed-ursa')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });
});
