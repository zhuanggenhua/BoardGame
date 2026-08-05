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
    getFirstPrompt,
    getPromptHandlerData,
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getPromptOptionsGenerator,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
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

function queueImmediateSpecificExtraMinions(
    matchState: MatchState<SmashUpCore>,
    cardUids: string[],
) {
    const events = cardUids.map((cardUid, index) => ({
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: {
            playerId: '0',
            limitType: 'minion',
            delta: 1,
            reason: 'test_immediate_specific_extra_minion',
            playTiming: 'immediate',
            specificCardUid: cardUid,
        },
        timestamp: 1000 + index,
    } as const));

    return queueImmediateExtraPlayInteractions(matchState, events as any);
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
        expect(getPromptHandlerData(prompt)?.deferredSnapshot).toMatchObject({
            extra: expect.objectContaining({ playerId: '0' }),
        });
        expect(getPromptHandlerData(prompt)?.runtimeContext).toBeUndefined();
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
                const sourceId = getPromptSourceId(prompt);
                if (sourceId === 'smashup_immediate_extra_action_base') {
                    const baseOption = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.baseIndex === 0,
                        'immediate extra action base option',
                    );
                    return { optionId: baseOption.id };
                }
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
                const sourceId = getPromptSourceId(prompt);
                if (sourceId === 'smashup_immediate_extra_action_minion') {
                    const minionOption = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.minionUid === 'ally-1',
                        'immediate extra action minion option',
                    );
                    return { optionId: minionOption.id };
                }
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

    it('指定卡牌和指定宿主的立即额外行动应在计分前手动选择宿主后附着', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spiky-1', 'munchkin_treasure_spiky_boots', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_mines',
                    minions: [
                        makeMinion('host-1', 'munchkin_dwarves_loot_lover', '0', 3),
                        makeMinion('opponent-1', 'pirate_buccaneer', '1', 4),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_treasure_bath',
                    minions: [makeMinion('away-host', 'alien_invader', '0', 3)],
                    ongoingActions: [],
                }),
            ],
        });
        const matchState = makeMatchState(state);
        matchState.sys.phase = 'scoreBases';
        const queuedState = queueImmediateExtraPlayInteractions(matchState, [{
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: '0',
                limitType: 'action',
                delta: 1,
                reason: 'munchkin_dwarves_salvage',
                playTiming: 'immediate',
                restrictToBase: 0,
                restrictToCardUid: 'spiky-1',
                restrictToMinionUid: 'host-1',
                specialActionWindow: 'meFirst',
            },
            timestamp: 1000,
        } as any]);

        const prompt = getSimpleChoicePrompt(queuedState, 'smashup_immediate_extra_action');
        const optionsGenerator = getPromptOptionsGenerator(prompt);
        expect(typeof optionsGenerator).toBe('function');
        expect(optionsGenerator!(queuedState, getPromptHandlerData(prompt)).map((option: any) => option.value?.cardUid)).toContain('spiky-1');
        expect(getPromptOptions(prompt).map((option: any) => option.value?.cardUid)).toContain('spiky-1');

        const result = resolveInteractionChain(
            queuedState,
            prompt => {
                const sourceId = getPromptSourceId(prompt);
                if (sourceId === 'smashup_immediate_extra_action_minion') {
                    const minionOption = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.minionUid === 'host-1',
                        'restricted immediate extra action host option',
                    );
                    return { optionId: minionOption.id };
                }
                if (sourceId !== 'smashup_immediate_extra_action') {
                    throw new Error(`unexpected prompt source: ${String(sourceId)}`);
                }
                const option = getPromptOption(
                    prompt,
                    candidate => candidate?.value?.cardUid === 'spiky-1',
                    'restricted immediate extra action card option',
                );
                return { optionId: option.id };
            },
        );

        expect(result.finalState.core.bases[0].minions[0].attachedActions).toContainEqual(expect.objectContaining({
            uid: 'spiky-1',
            defId: 'munchkin_treasure_spiky_boots',
            ownerId: '0',
        }));
        expect(result.finalState.core.bases[0].minions[1].attachedActions).toEqual([]);
        expect(result.finalState.core.bases[1].minions[0].attachedActions).toEqual([]);
        expect(result.finalState.core.players['0'].hand).toEqual([]);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(2);
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
        expect(getOptionalSimpleChoicePrompt(result.finalState, 'smashup_immediate_extra_action')).toBeUndefined();
        expect(getOptionalSimpleChoicePrompt(result.finalState, 'smashup_immediate_extra_action_minion')).toBeUndefined();
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

    it('立即额外随从的基地选择 prompt 应通过 deferredSnapshot 保留 choice，而不是手写 runtimeContext', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'zombie_walker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_secret_garden', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'base_the_jungle', minions: [], ongoingActions: [] }),
            ],
        });

        const firstPromptState = queueImmediateExtraMinion(makeMatchState(state));
        const firstPrompt = getSimpleChoicePrompt(firstPromptState, 'smashup_immediate_extra_minion');
        const firstOption = getPromptOption(
            firstPrompt,
            candidate => candidate?.value?.defId === 'zombie_walker',
            'immediate extra minion card option',
        );
        const advanced = respondToPrompt(firstPromptState, firstOption.id, '0');
        const basePrompt = getSimpleChoicePrompt(advanced.finalState, 'smashup_immediate_extra_minion_base');

        expect(getPromptHandlerData(basePrompt)?.deferredSnapshot).toMatchObject({
            extra: expect.objectContaining({ playerId: '0' }),
            choice: expect.objectContaining({ cardUid: 'h1', defId: 'zombie_walker' }),
        });
        expect(getPromptHandlerData(basePrompt)?.runtimeContext).toBeUndefined();
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

    it('指定卡牌的立即额外随从应在多基地链路中连续消费，不应留下空窗口', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('h1', 'zombie_walker', 'minion', '0'),
                        makeCard('h2', 'alien_invader', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_secret_garden', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'base_the_jungle', minions: [], ongoingActions: [] }),
            ],
        });

        const queuedState = queueImmediateSpecificExtraMinions(makeMatchState(state), ['h1', 'h2']);
        const firstPrompt = getSimpleChoicePrompt(queuedState, 'smashup_immediate_extra_minion');
        expect(getPromptOptions(firstPrompt).map((option: any) => option.value?.cardUid)).toContain('h1');
        expect(getPromptOptions(firstPrompt).map((option: any) => option.value?.cardUid)).not.toContain('h2');

        const firstOption = getPromptOption(
            firstPrompt,
            candidate => candidate?.value?.cardUid === 'h1',
            'first specific immediate extra minion',
        );
        const afterFirstCardChoice = respondToPrompt(queuedState, firstOption.id, '0');
        expect(afterFirstCardChoice.success).toBe(true);
        expect(getPromptSourceId(getFirstPrompt(afterFirstCardChoice.finalState))).toBe('smashup_immediate_extra_minion_base');
        expect(getSimpleChoicePrompt(afterFirstCardChoice.finalState, 'smashup_immediate_extra_minion')).toBeDefined();

        const result = resolveInteractionChain(
            queuedState,
            prompt => {
                const sourceId = getPromptSourceId(prompt);
                if (sourceId === 'smashup_immediate_extra_minion') {
                    const options = getPromptOptions(prompt);
                    const expectedUid = options.some((option: any) => option.value?.cardUid === 'h1')
                        ? 'h1'
                        : 'h2';
                    const option = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.cardUid === expectedUid,
                        `specific immediate extra minion ${expectedUid}`,
                    );
                    return { optionId: option.id };
                }
                if (sourceId === 'smashup_immediate_extra_minion_base') {
                    const option = getPromptOption(
                        prompt,
                        candidate => candidate?.value?.baseIndex === 0,
                        'specific immediate extra minion base',
                    );
                    return { optionId: option.id };
                }
                throw new Error(`unexpected prompt source: ${String(sourceId)}`);
            },
        );

        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['h1', 'h2']);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(result.finalState.core.players['0'].minionsPlayed).toBe(3);
        expect(result.finalState.core.players['0'].minionLimit).toBe(3);
        expect(getOptionalSimpleChoicePrompt(result.finalState, 'smashup_immediate_extra_minion')).toBeUndefined();
        expect(getOptionalSimpleChoicePrompt(result.finalState, 'smashup_immediate_extra_minion_base')).toBeUndefined();
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
