import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import { collectBaseAbilityTriggers } from '../../domain/baseAbilityQueue';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import {
    appendScoringFrameDeferredPayload,
    buildPendingPostScoringActionEvents,
    consumeScoringFrameDeferredPayload,
    createScoringSession,
    setScoringSession,
} from '../../domain/scoringSession';
import { SU_EVENTS } from '../../domain/types';
import {
    getInteractionsFromResult,
    getPromptOption,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makePlayer,
    makeState,
    respondToPromptOption,
    triggerBaseAbilityWithMS,
    withOnlyCurrentPrompt,
} from '../helpers';
import { defaultTestRandom } from '../testRunner';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import { triggerBaseAbility } from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

function makeCtx(overrides: Partial<BaseAbilityContext>): BaseAbilityContext {
    const state = overrides.state ?? makeState();
    return {
        state,
        matchState: makeMatchState(state),
        baseIndex: 0,
        baseDefId: 'test_base',
        playerId: '0',
        now: 1000,
        ...overrides,
    };
}

describe('AL9000 bases', () => {
    it('base_greenhouse: 冠军牌库有随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_greenhouse', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_greenhouse')],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('dk1', 'alien_collector', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_greenhouse',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_greenhouse');
    });

    it('base_greenhouse: 若所选随从已不在牌库则不再打出', () => {
        const result = triggerBaseAbilityWithMS('base_greenhouse', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_greenhouse')],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('dk1', 'alien_collector', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_greenhouse',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));
        const interaction = getInteractionsFromResult(result)[0];
        const option = getPromptOption(interaction, (entry: any) => entry.value?.cardUid === 'dk1');
        expect(getPromptSourceId(interaction)).toBe('base_greenhouse');
        expect(option).toBeDefined();

        const staleCore = makeState({
            bases: [makeBase('base_greenhouse')],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dk1', 'alien_collector', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
        });

        const scoredState = makeMatchState(staleCore);
        const scoredSessionState = appendScoringFrameDeferredPayload(setScoringSession(scoredState, {
                ...createScoringSession(scoredState.core, [0]),
                currentBaseRef: { slotIndex: 0, baseDefId: 'base_greenhouse' },
                currentStep: 'awaiting-interactions',
            }), {
                deferredEvents: [
                    {
                        type: SU_EVENTS.BASE_CLEARED,
                        payload: { baseIndex: 0, baseDefId: 'base_greenhouse' },
                        timestamp: 1852,
                    },
                    {
                        type: SU_EVENTS.BASE_REPLACED,
                        payload: {
                            baseIndex: 0,
                            oldBaseDefId: 'base_greenhouse',
                            newBaseDefId: 'base_secret_garden',
                        },
                        timestamp: 1852,
                    },
                ],
            });

        const resolved = respondToPromptOption(
            withOnlyCurrentPrompt(scoredSessionState, interaction),
            (entry: any) => entry.value?.cardUid === 'dk1',
            'Greenhouse stale deck option',
            '0',
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_PLAYED }),
        ]));
        expect(consumeScoringFrameDeferredPayload(resolved.finalState).deferredActions).toEqual([]);
    });

    it('base_greenhouse: 直接打出 borrowed 牌库随从时应保留真实 owner', () => {
        const result = triggerBaseAbilityWithMS('base_greenhouse', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_greenhouse')],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('dk-borrowed', 'alien_collector', '1')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_greenhouse',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));
        const interaction = getInteractionsFromResult(result)[0];
        expect(getPromptOption(interaction, (entry: any) => entry.value?.cardUid === 'dk-borrowed')).toBeDefined();

        const resolved = respondToPromptOption(
            result.matchState!,
            (entry: any) => entry.value?.cardUid === 'dk-borrowed',
            'Greenhouse borrowed direct option',
            '0',
        );
        expect(resolved.success, resolved.error).toBe(true);

        const playedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_PLAYED) as any;
        expect(playedEvent).toBeDefined();
        expect(playedEvent.payload).toEqual(expect.objectContaining({
            playerId: '0',
            cardUid: 'dk-borrowed',
            defId: 'alien_collector',
            ownerId: '1',
            fromDeck: true,
        }));
    });

    it('base_greenhouse: replacement follow-up 应写入 scoring session，不写 core', () => {
        const result = triggerBaseAbilityWithMS('base_greenhouse', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_greenhouse')],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('dk1', 'alien_collector', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_greenhouse',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));
        const interaction = getInteractionsFromResult(result)[0];
        expect(getPromptOption(interaction, (entry: any) => entry.value?.cardUid === 'dk1')).toBeDefined();

        const scoredState = makeMatchState(makeState({
            bases: [makeBase('base_greenhouse')],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dk1', 'alien_collector', '0')],
                }),
                '1': makePlayer('1'),
            },
        }));

        const stagedState = withOnlyCurrentPrompt(
            appendScoringFrameDeferredPayload(
                setScoringSession(scoredState, {
                    ...createScoringSession(scoredState.core, [0]),
                    currentBaseRef: { slotIndex: 0, baseDefId: 'base_greenhouse' },
                    currentStep: 'awaiting-interactions',
                }),
                {
                    deferredEvents: [
                        {
                            type: SU_EVENTS.BASE_CLEARED,
                            payload: { baseIndex: 0, baseDefId: 'base_greenhouse' },
                            timestamp: 1852,
                        },
                        {
                            type: SU_EVENTS.BASE_REPLACED,
                            payload: {
                                baseIndex: 0,
                                oldBaseDefId: 'base_greenhouse',
                                newBaseDefId: 'base_secret_garden',
                            },
                            timestamp: 1852,
                        },
                    ],
                },
            ),
            interaction,
        );

        const resolved = respondToPromptOption(
            stagedState,
            (entry: any) => entry.value?.cardUid === 'dk1',
            'Greenhouse replacement follow-up option',
            '0',
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_PLAYED }),
        ]));
        const consumed = consumeScoringFrameDeferredPayload(resolved.finalState);
        expect(consumed.deferredActions).toEqual([
            {
                kind: 'playMinionOnReplacementBase',
                playerId: '0',
                cardUid: 'dk1',
                defId: 'alien_collector',
                ownerId: '0',
                baseIndex: 0,
                targetBaseDefId: 'base_secret_garden',
                power: 2,
            },
        ]);
    });

    it('base_greenhouse: replacement deferred 打出 borrowed 牌库随从时应保留真实 owner', () => {
        const result = triggerBaseAbilityWithMS('base_greenhouse', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_greenhouse')],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('dk-borrowed', 'alien_collector', '1')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_greenhouse',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));
        const interaction = getInteractionsFromResult(result)[0];
        expect(getPromptOption(interaction, (entry: any) => entry.value?.cardUid === 'dk-borrowed')).toBeDefined();

        const scoredState = makeMatchState(makeState({
            bases: [makeBase('base_greenhouse')],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dk-borrowed', 'alien_collector', '1')],
                }),
                '1': makePlayer('1'),
            },
        }));

        const stagedState = withOnlyCurrentPrompt(
            appendScoringFrameDeferredPayload(
                setScoringSession(scoredState, {
                    ...createScoringSession(scoredState.core, [0]),
                    currentBaseRef: { slotIndex: 0, baseDefId: 'base_greenhouse' },
                    currentStep: 'awaiting-interactions',
                }),
                {
                    deferredEvents: [
                        {
                            type: SU_EVENTS.BASE_CLEARED,
                            payload: { baseIndex: 0, baseDefId: 'base_greenhouse' },
                            timestamp: 1852,
                        },
                        {
                            type: SU_EVENTS.BASE_REPLACED,
                            payload: {
                                baseIndex: 0,
                                oldBaseDefId: 'base_greenhouse',
                                newBaseDefId: 'base_secret_garden',
                            },
                            timestamp: 1852,
                        },
                    ],
                },
            ),
            interaction,
        );

        const resolved = respondToPromptOption(
            stagedState,
            (entry: any) => entry.value?.cardUid === 'dk-borrowed',
            'Greenhouse borrowed deferred option',
            '0',
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.not.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_PLAYED }),
        ]));

        const consumed = consumeScoringFrameDeferredPayload(resolved.finalState);
        expect(consumed.deferredActions).toEqual([
            {
                kind: 'playMinionOnReplacementBase',
                playerId: '0',
                cardUid: 'dk-borrowed',
                defId: 'alien_collector',
                ownerId: '1',
                baseIndex: 0,
                targetBaseDefId: 'base_secret_garden',
                power: 2,
            },
        ]);

        const pendingEvents = buildPendingPostScoringActionEvents(
            { core: resolved.finalState.core },
            consumed.deferredActions,
            2000,
        ) as any[];
        expect(pendingEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAYED,
                payload: expect.objectContaining({
                    playerId: '0',
                    cardUid: 'dk-borrowed',
                    defId: 'alien_collector',
                    ownerId: '1',
                    fromDeck: true,
                    baseDefId: 'base_secret_garden',
                }),
            }),
        ]));
    });

    it('base_greenhouse 触发反应队列后仍会留下可响应交互', () => {
        const core = makeState({
            bases: [makeBase('base_greenhouse')],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dk1', 'alien_collector', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const queued = collectBaseAbilityTriggers({
            core,
            timing: 'afterScoring',
            ownerPlayerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
            frameId: 'score-after:0:0',
            sourceEventId: 'score-after:0:0',
            now: 1000,
        }) as any;
        const reaction = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued.payload.triggers }),
            defaultTestRandom,
            1001,
        );
        const currentPrompt = reaction?.state?.sys?.interaction?.current as any;
        if (currentPrompt?.data?.sourceId === 'smashup_reaction_choose') {
            const queueById = new Map((reaction!.state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            const resolved = respondToPromptOption(
                reaction!.state as any,
                (entry: any) => queueById.get(entry.value?.triggerId)?.sourceDefId === 'base_greenhouse',
                'Greenhouse reaction trigger option',
                '0',
            );
            expect(resolved.success).toBe(true);
            expect(resolved.events.some(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toBe(true);
            expect(getSimpleChoicePrompt(resolved.finalState as any, 'base_greenhouse')).toBeDefined();
            return;
        }

        expect(currentPrompt?.data?.sourceId).toBe('base_greenhouse');
        expect(getSimpleChoicePrompt(reaction!.state as any, 'base_greenhouse')).toBeDefined();
    });

    it('base_secret_garden: onTurnStart 发放仅限本基地的 banked 额外随从额度', () => {
        const { events } = triggerBaseAbility('base_secret_garden', 'onTurnStart', makeCtx({
            state: makeState({ bases: [makeBase('base_secret_garden')] }),
            baseDefId: 'base_secret_garden',
            baseIndex: 0,
            playerId: '0',
        }));

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: '0',
                limitType: 'minion',
                delta: 1,
                restrictToBase: 0,
                playTiming: 'banked',
            },
        });
    });

    it('base_secret_garden: onMinionPlayed 不发额度，避免把回合持续许可误建模为打出后触发', () => {
        const { events } = triggerBaseAbility('base_secret_garden', 'onMinionPlayed', makeCtx({
            state: makeState({ bases: [makeBase('base_secret_garden')] }),
            baseDefId: 'base_secret_garden',
            baseIndex: 0,
            playerId: '0',
        }));

        expect(events).toHaveLength(0);
    });

    it('base_inventors_salon: 冠军弃牌堆有行动卡时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_inventors_salon', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_inventors_salon')],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('d1', 'pirate_full_sail', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_inventors_salon',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_inventors_salon');
    });

    it('base_inventors_salon: 冠军弃牌堆无行动卡时不触发', () => {
        const { events } = triggerBaseAbility('base_inventors_salon', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_inventors_salon')],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('d1', 'alien_collector', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_inventors_salon',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });

    it('base_inventors_salon: 若所选行动已不在弃牌堆则不再取回', () => {
        const result = triggerBaseAbilityWithMS('base_inventors_salon', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_inventors_salon')],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('d1', 'pirate_full_sail', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_inventors_salon',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));
        const interaction = getInteractionsFromResult(result)[0];
        const option = getPromptOption(interaction, (entry: any) => entry.value?.cardUid === 'd1');
        expect(getPromptSourceId(interaction)).toBe('base_inventors_salon');
        expect(option).toBeDefined();

        const staleCore = makeState({
            bases: [makeBase('base_inventors_salon')],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('d1', 'pirate_full_sail', 'action', '0')],
                    discard: [],
                }),
                '1': makePlayer('1'),
            },
        });

        const staleState = withOnlyCurrentPrompt(makeMatchState(staleCore), interaction);
        const resolved = respondToPromptOption(
            staleState,
            (entry: any) => entry.value?.cardUid === 'd1',
            'Inventors Salon stale option',
            '0',
        );
        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(false);
    });
});
