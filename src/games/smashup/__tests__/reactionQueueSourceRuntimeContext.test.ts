import { beforeEach, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { clearRegistry } from '../domain/abilityRegistry';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { postProcessSystemEvents } from '../domain';
import { reduce } from '../domain/reduce';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { defaultTestRandom, runCommand } from './testRunner';
import { getInteractionsFromMS, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';
import { clearOngoingEffectRegistry, collectTriggers, registerTrigger } from '../domain/ongoingEffects';
import { processAffectTriggers, processDestroyTriggers, processReturnToHandTriggers } from '../domain/reducer';
import { resolveSmashUpReactionChoice } from '../domain/reactionSession';
import { SU_EVENTS } from '../domain/types';

describe('reaction queue: preserves source card/controller runtime context', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        clearOngoingEffectRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    it('queued afterScoring trigger 仍应把 sourceCardUid/sourceControllerId 传给后续 prompt 与执行结果', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('pharaoh-draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'ship-1', defId: 'mermaids_shipwreck_cove', ownerId: '0' }],
                }),
                makeBase('base_b', []),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-shipwreck-cove',
            timing: 'afterScoring',
            sourceDefId: 'mermaids_shipwreck_cove',
            sourceCardUid: 'ship-1',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const ms: MatchState<SmashUpCore> = makeMatchState({
            ...(core as SmashUpCore),
            triggerQueue: [trigger],
        });

        const resolved = maybeResolveReactionQueue(ms, defaultTestRandom, 1);
        expect(resolved).toBeDefined();

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('mermaids_shipwreck_cove_after_scoring');
        const option = prompt?.data?.options?.find((entry: any) => entry.value?.baseIndex === 1);
        expect(option).toBeDefined();

        const responded = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: option.id },
            } as any,
            defaultTestRandom,
        );

        expect(responded.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'ship-1')).toBe(false);
        expect(responded.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'ship-1')).toBe(true);
    });

    it('queued afterScoring trigger 移动被他人拥有的 mermaids_shipwreck_cove 时，仍应保留其真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'ship-1', defId: 'mermaids_shipwreck_cove', ownerId: '1' }],
                }),
                makeBase('base_b', []),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-shipwreck-cove-borrowed',
            timing: 'afterScoring',
            sourceDefId: 'mermaids_shipwreck_cove',
            sourceCardUid: 'ship-1',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            2,
        );
        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        const option = prompt?.data?.options?.find((entry: any) => entry.value?.baseIndex === 1);
        expect(option).toBeDefined();

        const responded = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: option.id },
            } as any,
            defaultTestRandom,
        );

        expect(responded.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'ship-1')).toBe(false);
        expect(responded.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'ship-1')?.ownerId).toBe('1');
    });

    it('queued afterScoring trigger 移动 borrowed mermaids_shipwreck_cove 时，仍应保留真正移动玩家的 sourcePlayerId', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'ship-1', defId: 'mermaids_shipwreck_cove', ownerId: '1' }],
                }),
                makeBase('base_b', []),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-shipwreck-cove-borrowed-source-player',
            timing: 'afterScoring',
            sourceDefId: 'mermaids_shipwreck_cove',
            sourceCardUid: 'ship-1',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            9001,
        );

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        const option = prompt?.data?.options?.find((entry: any) => entry.value?.baseIndex === 1);
        expect(option).toBeDefined();

        const responded = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: option.id },
            } as any,
            defaultTestRandom,
        );

        expect(responded.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'ship-1',
                defId: 'mermaids_shipwreck_cove',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 1,
            }),
        }));
    });

    it('queued onMinionMoved trigger 处理 borrowed bear_cavalry_high_ground_pod 时，仍应把 prompt 交给控制者并把 detached card 送回真实 owner discard', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('bear-owner-minion', 'robot_microbot_alpha', '0', 3),
                        makeMinion('enemy-moved', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [],
                }),
                makeBase('base_portal_room', []),
            ],
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'high-ground-pod-a',
                defId: 'bear_cavalry_high_ground_pod',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 11,
        } as any);

        const queued = collectTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'enemy-moved',
            triggerMinionDefId: 'ghosts_spectre',
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 12,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('bear_cavalry_high_ground_pod');
        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            ownerPlayerId: '0',
            sourceControllerId: '0',
            eventPlayerId: '1',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            12,
        );
        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('bear_cavalry_high_ground_pod_trigger');

        const destroyOption = prompt?.data?.options?.find((entry: any) => entry.value?.action === 'destroy');
        expect(destroyOption).toBeDefined();

        const responded = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: destroyOption.id },
            } as any,
            defaultTestRandom,
        );

        expect(responded.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'high-ground-pod-a',
                defId: 'bear_cavalry_high_ground_pod',
                ownerId: '1',
            }),
        }));
        expect(responded.finalState.core.players['0'].discard.some(card => card.uid === 'high-ground-pod-a')).toBe(false);
        expect(responded.finalState.core.players['1'].discard.some(card => card.uid === 'high-ground-pod-a')).toBe(true);
    });

    it('queued onMinionMoved trigger 处理 borrowed High Ground POD 时，不应把同基地其他玩家的 POD 当成当前 source', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('bear-owner-minion', 'robot_microbot_alpha', '0', 3),
                        makeMinion('enemy-moved', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [
                        { uid: 'opponent-high-ground', defId: 'bear_cavalry_high_ground_pod', ownerId: '1' } as any,
                    ],
                }),
                makeBase('base_portal_room', []),
            ],
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'high-ground-pod-a',
                defId: 'bear_cavalry_high_ground_pod',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 11,
        } as any);

        const trigger: TriggerInstance = {
            id: 'queued-high-ground-pod-a',
            timing: 'onMinionMoved',
            sourceDefId: 'bear_cavalry_high_ground_pod',
            sourceCardUid: 'high-ground-pod-a',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'enemy-moved',
            triggerMinionDefId: 'ghosts_spectre',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            12,
        );
        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('bear_cavalry_high_ground_pod_trigger');
        expect(prompt?.id).toContain('high-ground-pod-a');

        const destroyOption = prompt?.data?.options?.find((entry: any) => entry.value?.action === 'destroy');
        expect(destroyOption).toBeDefined();
        const responded = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: destroyOption.id },
            } as any,
            defaultTestRandom,
        );

        expect(responded.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'high-ground-pod-a',
                defId: 'bear_cavalry_high_ground_pod',
                ownerId: '1',
            }),
        }));
        expect(responded.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'opponent-high-ground',
            }),
        }));
    });

    it('queued onMinionMoved trigger 处理同基地两只 bear_cavalry_cub_scout_pod 时，应逐实例入队且第二条 source 不应回退到第一只斥候', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('scout-pod-a', 'bear_cavalry_cub_scout_pod', '0', 4),
                        makeMinion('scout-pod-b', 'bear_cavalry_cub_scout_pod', '0', 4),
                        makeMinion('enemy-moved', 'ghosts_spectre', '1', 2),
                    ],
                }),
                makeBase('base_portal_room', []),
            ],
        });

        const queued = collectTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'enemy-moved',
            triggerMinionDefId: 'ghosts_spectre',
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 12.1,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'scout-pod-a',
            'scout-pod-b',
        ]);

        const secondTrigger: TriggerInstance = {
            id: 'queued-cub-scout-pod-b',
            timing: 'onMinionMoved',
            sourceDefId: 'bear_cavalry_cub_scout_pod',
            sourceCardUid: 'scout-pod-b',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'enemy-moved',
            triggerMinionDefId: 'ghosts_spectre',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [secondTrigger],
            }),
            defaultTestRandom,
            12.1,
        );

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('bear_cavalry_cub_scout_pod_destroy');
        expect(prompt?.id).toContain('scout-pod-b');
        expect(prompt?.data?.scoutUid).toBe('scout-pod-b');
    });

    it('queued onTurnEnd trigger 处理 borrowed steampunk_difference_engine 时，仍应按控制者判定并让控制者抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('diff-draw-a', 'steampunk_mechanic', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('owner-deck-a', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                minions: [makeMinion('diff-host', 'steampunk_mechanic', '0', 2)],
                ongoingActions: [],
            })],
            turnNumber: 29,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'diff-a',
                defId: 'steampunk_difference_engine',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 28,
        } as any);

        const queued = collectTriggers(core, 'onTurnEnd', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 29,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'steampunk_difference_engine',
            ownerPlayerId: '0',
            sourceControllerId: '0',
            eventPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            29,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                cardUids: ['diff-draw-a'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.some(card => card.uid === 'diff-draw-a')).toBe(true);
        expect(resolved?.state.core.players['1']?.hand.some(card => card.uid === 'owner-deck-a')).toBe(false);
    });

    it('queued onTurnEnd trigger 处理同基地两张 borrowed steampunk_difference_engine 时，应逐实例入队并各自给控制者抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('diff-draw-a', 'steampunk_mechanic', 'minion', '0'),
                        makeCard('diff-draw-b', 'steampunk_steam_queen', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('owner-deck-a', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                minions: [makeMinion('diff-host', 'steampunk_mechanic', '0', 2)],
                ongoingActions: [],
            })],
            turnNumber: 30,
        });
        const withFirst = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'diff-a',
                defId: 'steampunk_difference_engine',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 29,
        } as any);
        const core = reduce(withFirst, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'diff-b',
                defId: 'steampunk_difference_engine',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 29,
        } as any);

        const queued = collectTriggers(core, 'onTurnEnd', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 30,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: any) => trigger.sourceCardUid)).toEqual([
            'diff-a',
            'diff-b',
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            30,
        );

        const firstPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(firstPrompt?.playerId).toBe('0');
        expect(firstPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const firstTriggerOption = firstPrompt?.data?.options?.find((entry: any) => entry.value?.triggerId === queued.payload.triggers[0].id);
        expect(firstTriggerOption).toBeDefined();

        const firstResolved = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: firstTriggerOption.id },
            } as any,
            defaultTestRandom,
        );
        expect(firstResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                cardUids: ['diff-draw-a'],
            }),
        }));
        expect(firstResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                cardUids: ['diff-draw-b'],
            }),
        }));
        expect(getInteractionsFromMS(firstResolved.finalState)).toHaveLength(0);
        expect(firstResolved.finalState.core.players['0']?.hand.map(card => card.uid) ?? []).toEqual(
            expect.arrayContaining(['diff-draw-a', 'diff-draw-b']),
        );
        expect(firstResolved.finalState.core.players['1']?.hand.some(card => card.uid === 'owner-deck-a')).toBe(false);
    });

    it('queued onMinionPlayed trigger 处理 borrowed cthulhu_altar 时，仍应按控制者判定并把额外行动给控制者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('altar-played-minion', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [],
            })],
            turnNumber: 30,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'altar-a',
                defId: 'cthulhu_altar',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 29,
        } as any);

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'altar-played-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 30,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'cthulhu_altar',
            ownerPlayerId: '0',
            sourceControllerId: '0',
            eventPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            30,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'action',
                delta: 1,
                reason: 'cthulhu_altar',
            }),
        }));
        expect(resolved?.state.core.players['0']?.actionLimit).toBe(2);
        expect(resolved?.state.core.players['1']?.actionLimit ?? 1).toBe(1);
    });

    it('queued onMinionPlayed trigger 处理 borrowed cthulhu_altar 时，不应把同基地其他玩家的 Altar 也当成该 source 控制', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {
                    actionLimit: 1,
                }),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('altar-played-minion', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [
                    { uid: 'opponent-altar', defId: 'cthulhu_altar', ownerId: '1' } as any,
                ],
            })],
            turnNumber: 30,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-altar',
                defId: 'cthulhu_altar',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 29,
        } as any);

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'altar-played-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 30,
        }) as any;

        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual(['borrowed-altar']);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            30,
        );

        const altarEvents = resolved?.events.filter(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'cthulhu_altar',
        ) ?? [];
        expect(altarEvents).toHaveLength(1);
        expect(altarEvents[0]).toEqual(expect.objectContaining({
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'action',
                delta: 1,
            }),
        }));
        expect(resolved?.state.core.players['0']?.actionLimit).toBe(2);
        expect(resolved?.state.core.players['1']?.actionLimit).toBe(1);
    });

    it('queued onMinionPlayed trigger 处理 borrowed cthulhu_altar_pod 时，不应把同基地其他玩家的基础版 Altar 也当成该 source 控制', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {
                    actionLimit: 1,
                }),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('altar-pod-played-minion', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [
                    { uid: 'opponent-altar-base', defId: 'cthulhu_altar', ownerId: '1' } as any,
                ],
            })],
            turnNumber: 30,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-altar-pod',
                defId: 'cthulhu_altar_pod',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 29,
        } as any);

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'altar-pod-played-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 30,
        }) as any;

        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual(['borrowed-altar-pod']);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            30,
        );

        const altarEvents = resolved?.events.filter(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'cthulhu_altar',
        ) ?? [];
        expect(altarEvents).toHaveLength(1);
        expect(altarEvents[0]).toEqual(expect.objectContaining({
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'action',
                delta: 1,
            }),
        }));
        expect(resolved?.state.core.players['0']?.actionLimit).toBe(2);
        expect(resolved?.state.core.players['1']?.actionLimit).toBe(1);
    });

    it('queued onMinionPlayed trigger 处理同一基地两张同控制者的 frankenstein_german_engineering 时，应逐实例入队并各自给新打出的随从放 1 个指示物', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('engineering-target-minion', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [
                    { uid: 'engineering-a', defId: 'frankenstein_german_engineering', ownerId: '0' } as any,
                    { uid: 'engineering-b', defId: 'frankenstein_german_engineering', ownerId: '0' } as any,
                ],
            })],
            turnNumber: 30,
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'engineering-target-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 30,
        }) as any;

        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'engineering-a',
            'engineering-b',
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            30,
        );

        const firstCounterEvents = firstResolved?.events.filter(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.reason === 'frankenstein_german_engineering',
        ) ?? [];
        expect(firstCounterEvents).toHaveLength(1);
        expect(firstResolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'engineering-target-minion')?.powerCounters).toBe(1);

        const secondResolved = maybeResolveReactionQueue(
            {
                ...firstResolved!.state,
                core: {
                    ...firstResolved!.state.core,
                    triggerQueue: [queued.payload.triggers[1]],
                },
            },
            defaultTestRandom,
            31,
        );

        const secondCounterEvents = secondResolved?.events.filter(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.reason === 'frankenstein_german_engineering',
        ) ?? [];
        expect(secondCounterEvents).toHaveLength(1);
        expect(secondResolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'engineering-target-minion')?.powerCounters).toBe(2);
    });

    it('queued onMinionPlayed trigger 处理 borrowed trickster_flame_trap 时，不应被同基地其他玩家的 Trap 抢走 source', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('trap-target-minion', 'robot_microbot_alpha', '1', 2)],
                ongoingActions: [
                    { uid: 'opponent-trap', defId: 'trickster_flame_trap', ownerId: '1' } as any,
                ],
            })],
            turnNumber: 31,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-trap',
                defId: 'trickster_flame_trap',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 30,
        } as any);

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'trap-target-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 31,
        }) as any;

        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual(['borrowed-trap']);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            31,
        );

        const flameTrapEvents = resolved?.events.filter(event =>
            event.type === SU_EVENTS.MINION_DESTROYED
            && (event as any).payload?.reason === 'trickster_flame_trap',
        ) ?? [];
        expect(flameTrapEvents).toHaveLength(1);
        expect(flameTrapEvents[0]).toEqual(expect.objectContaining({
            payload: expect.objectContaining({
                minionUid: 'trap-target-minion',
                ownerId: '1',
                controllerId: '1',
                destroyerId: '0',
                reason: 'trickster_flame_trap',
            }),
        }));
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-trap',
                defId: 'trickster_flame_trap',
                ownerId: '1',
                reason: 'trickster_flame_trap_self_destruct',
            }),
        }));
    });

    it('queued onMinionPlayed trigger 处理 borrowed trickster_pay_the_piper 时，不应被同基地其他玩家的 Piper 抢走 source', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('discard-a', 'robot_microbot_alpha', 'minion', '1'),
                        makeCard('discard-b', 'robot_microbot_beta', 'minion', '1'),
                    ],
                }),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('piper-target-minion', 'robot_microbot_alpha', '1', 2)],
                ongoingActions: [
                    { uid: 'opponent-piper', defId: 'trickster_pay_the_piper', ownerId: '1' } as any,
                ],
            })],
            turnNumber: 32,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-piper',
                defId: 'trickster_pay_the_piper',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 31,
        } as any);

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'piper-target-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 32,
        }) as any;

        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual(['borrowed-piper']);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            32,
        );

        const discardEvents = resolved?.events.filter(event =>
            event.type === SU_EVENTS.CARDS_DISCARDED
            && (event as any).payload?.playerId === '1',
        ) ?? [];
        expect(discardEvents).toHaveLength(1);
        expect((discardEvents[0] as any).payload.cardUids).toHaveLength(1);
        expect(['discard-a', 'discard-b']).toContain((discardEvents[0] as any).payload.cardUids[0]);
    });

    it('queued onMinionPlayed trigger 处理同一基地两张同控制者的 trickster_pay_the_piper 时，应逐实例入队并各自让对手弃 1 张牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('discard-a', 'robot_microbot_alpha', 'minion', '1'),
                        makeCard('discard-b', 'robot_microbot_beta', 'minion', '1'),
                    ],
                }),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('piper-target-minion', 'robot_microbot_alpha', '1', 2)],
                ongoingActions: [
                    { uid: 'piper-a', defId: 'trickster_pay_the_piper', ownerId: '0' } as any,
                    { uid: 'piper-b', defId: 'trickster_pay_the_piper', ownerId: '0' } as any,
                ],
            })],
            turnNumber: 33,
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'piper-target-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 33,
        }) as any;

        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual(['piper-a', 'piper-b']);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            33,
        );

        const firstDiscardEvents = firstResolved?.events.filter(event =>
            event.type === SU_EVENTS.CARDS_DISCARDED
            && (event as any).payload?.playerId === '1',
        ) ?? [];
        expect(firstDiscardEvents).toHaveLength(1);
        expect(firstResolved?.state.core.players['1'].hand).toHaveLength(1);

        const secondResolved = maybeResolveReactionQueue(
            {
                ...firstResolved!.state,
                core: {
                    ...firstResolved!.state.core,
                    triggerQueue: [queued.payload.triggers[1]],
                },
            },
            defaultTestRandom,
            34,
        );

        const secondDiscardEvents = secondResolved?.events.filter(event =>
            event.type === SU_EVENTS.CARDS_DISCARDED
            && (event as any).payload?.playerId === '1',
        ) ?? [];
        expect(secondDiscardEvents).toHaveLength(1);
        expect(secondResolved?.state.core.players['1'].hand).toHaveLength(0);
    });

    it('queued onMinionPlayed trigger 处理同一基地两张同控制者的 trickster_pay_the_piper_pod 时，应逐实例入队并各自让对手弃 1 张牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('discard-a', 'robot_microbot_alpha', 'minion', '1'),
                        makeCard('discard-b', 'robot_microbot_beta', 'minion', '1'),
                    ],
                }),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('piper-target-minion', 'robot_microbot_alpha', '1', 2)],
                ongoingActions: [
                    { uid: 'piper-pod-a', defId: 'trickster_pay_the_piper_pod', ownerId: '0' } as any,
                    { uid: 'piper-pod-b', defId: 'trickster_pay_the_piper_pod', ownerId: '0' } as any,
                ],
            })],
            turnNumber: 34,
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'piper-target-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            random: defaultTestRandom,
            now: 34,
        }) as any;

        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual(['piper-pod-a', 'piper-pod-b']);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            34,
        );

        const firstDiscardEvents = firstResolved?.events.filter(event =>
            event.type === SU_EVENTS.CARDS_DISCARDED
            && (event as any).payload?.playerId === '1',
        ) ?? [];
        expect(firstDiscardEvents).toHaveLength(1);
        expect(firstResolved?.state.core.players['1'].hand).toHaveLength(1);

        const secondResolved = maybeResolveReactionQueue(
            {
                ...firstResolved!.state,
                core: {
                    ...firstResolved!.state.core,
                    triggerQueue: [queued.payload.triggers[1]],
                },
            },
            defaultTestRandom,
            35,
        );

        const secondDiscardEvents = secondResolved?.events.filter(event =>
            event.type === SU_EVENTS.CARDS_DISCARDED
            && (event as any).payload?.playerId === '1',
        ) ?? [];
        expect(secondDiscardEvents).toHaveLength(1);
        expect(secondResolved?.state.core.players['1'].hand).toHaveLength(0);
    });

    it('queued onMinionPlayed trigger 手工回放第二只 trickster_leprechaun_pod source 时，不应回退到基地扫描顺序里的第一只 POD', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 2,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [
                    makeMinion('lp-pod-a', 'trickster_leprechaun_pod', '0', 4),
                    makeMinion('lp-pod-b', 'trickster_leprechaun_pod', '1', 5),
                    makeMinion('lep-target-minion', 'robot_microbot_alpha', '2', 2),
                ],
            })],
            turnNumber: 35,
        });

        const trigger: TriggerInstance = {
            id: 'queued-leprechaun-pod-b',
            timing: 'onMinionPlayed',
            sourceDefId: 'trickster_leprechaun_pod',
            sourceCardUid: 'lp-pod-b',
            sourceControllerId: '1',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '1',
            eventPlayerId: '2',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'lep-target-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            35,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'lep-target-minion',
                destroyerId: '1',
                reason: 'trickster_leprechaun_pod',
            }),
        }));
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: expect.objectContaining({
                minionUid: 'lp-pod-b',
                baseIndex: 0,
                metadataUpdate: expect.objectContaining({
                    leprechaunPodLastTurnTriggered: 35,
                }),
                reason: 'trickster_leprechaun_pod_once_per_turn',
            }),
        }));
        expect(
            resolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'lp-pod-a')?.metadata?.leprechaunPodLastTurnTriggered,
        ).toBeUndefined();
        expect(
            resolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'lp-pod-b')?.metadata?.leprechaunPodLastTurnTriggered,
        ).toBe(35);
    });

    it('queued onMinionPlayed trigger 手工回放第二只 trickster_leprechaun source 时，不应回退到基地扫描顺序里的第一只基础版来源', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 2,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [
                    makeMinion('lp-a', 'trickster_leprechaun', '0', 5),
                    makeMinion('lp-b', 'trickster_leprechaun', '1', 5),
                    makeMinion('lep-target-minion', 'robot_microbot_alpha', '2', 2),
                ],
            })],
            turnNumber: 35,
        });

        const trigger: TriggerInstance = {
            id: 'queued-leprechaun-b',
            timing: 'onMinionPlayed',
            sourceDefId: 'trickster_leprechaun',
            sourceCardUid: 'lp-b',
            sourceControllerId: '1',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '1',
            eventPlayerId: '2',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'lep-target-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            35,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'lep-target-minion',
                destroyerId: '1',
                reason: 'trickster_leprechaun',
            }),
        }));
    });

    it('queued onMinionAffected trigger 处理 borrowed Dinner Date POD 时，不应被同宿主其他玩家的同名 attachment 抢走 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: ['vampires', 'robots'],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('dinner-host', 'robot_microbot', '1', 2, {
                        attachedActions: [
                            {
                                uid: 'opponent-dinner-date-a',
                                defId: 'vampire_dinner_date_pod',
                                ownerId: '1',
                                metadata: { sourceControllerId: '1' },
                            } as any,
                            {
                                uid: 'borrowed-dinner-date-a',
                                defId: 'vampire_dinner_date_pod',
                                ownerId: '1',
                                metadata: { sourceControllerId: '0' },
                            } as any,
                        ],
                    }),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'dinner-host',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[0],
            affectType: 'power_change',
            counterChangeKind: 'removed',
            counterDelta: -1,
            reason: 'test_zero_power_borrowed_dinner_date_sibling',
            random: defaultTestRandom,
            now: 29,
        }) as any;

        const borrowedTrigger = queued?.payload?.triggers?.find(
            (trigger: TriggerInstance) => trigger.sourceCardUid === 'borrowed-dinner-date-a',
        );
        expect(borrowedTrigger).toEqual(expect.objectContaining({
            sourceDefId: 'vampire_dinner_date_pod',
            sourceCardUid: 'borrowed-dinner-date-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [borrowedTrigger],
            }, 'playCards', '1'),
            defaultTestRandom,
            29,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'dinner-host',
                destroyerId: '0',
                reason: 'vampire_dinner_date_pod',
            }),
        }));
    });

    it('processAffectTriggers 处理 borrowed ONGOING_ATTACHED 时，source 自身的 per-instance onMinionAffected trigger 也应走 explicit fallback 并保留真实 owner', () => {
        registerTrigger('test_attach_probe', 'onMinionAffected', () => [], {
            perInstance: true,
            playerContext: 'sourceController',
        });

        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('attach-host', 'robot_microbot', '1', 2),
                ]),
            ],
        });

        const processed = processAffectTriggers([{
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-attach-probe',
                defId: 'test_attach_probe',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'attach-host',
            },
            timestamp: 30,
        } as any], makeMatchState(core, 'playCards', '0'), '0', defaultTestRandom as any, 30);

        const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        const attachTrigger = queued?.payload?.triggers?.find((trigger: any) => trigger.sourceDefId === 'test_attach_probe');
        expect(attachTrigger).toEqual(expect.objectContaining({
            sourceDefId: 'test_attach_probe',
            sourceCardUid: 'borrowed-attach-probe',
            sourceControllerId: '0',
            sourceOwnerPlayerId: '1',
            ownerPlayerId: '0',
            eventPlayerId: '0',
        }));
    });

    it('queued onTurnStart trigger 处理同一宿主两张 borrowed frankenstein_uberserum 时，应逐实例入队并各自给宿主加 1 标记', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                minions: [{
                    uid: 'uber-host',
                    defId: 'frankenstein_igor',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: false,
                    attachedActions: [],
                }],
                ongoingActions: [],
            })],
            turnNumber: 31,
        });
        const withFirst = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'uber-a',
                defId: 'frankenstein_uberserum',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'uber-host',
            },
            timestamp: 30,
        } as any);
        const core = reduce(withFirst, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'uber-b',
                defId: 'frankenstein_uberserum',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'uber-host',
            },
            timestamp: 30,
        } as any);

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 31,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'uber-a',
            'uber-b',
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            31,
        );

        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const firstTriggerOption = prompt?.data?.options?.find((entry: any) => entry.value?.triggerId === queued.payload.triggers[0].id);
        expect(firstTriggerOption).toBeDefined();

        const firstResolved = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: firstTriggerOption.id },
            } as any,
            defaultTestRandom,
        );

        const counterEvents = firstResolved.events.filter((event: any) =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && event.payload?.reason === 'frankenstein_uberserum',
        );
        expect(counterEvents).toHaveLength(2);
        expect(firstResolved.finalState.core.bases[0]?.minions.find(minion => minion.uid === 'uber-host')?.powerCounters).toBe(2);
    });

    it('queued onTurnStart trigger 处理同一宿主两张 borrowed ninja_smoke_bomb 时，应逐实例入队并各自只自毁当前 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_portal_room', [
                makeMinion('smoke-host-multi', 'ninja_tiger_assassin', '1', 4, {
                    attachedActions: [
                        { uid: 'smoke-borrowed-a', defId: 'ninja_smoke_bomb', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                        { uid: 'smoke-borrowed-b', defId: 'ninja_smoke_bomb', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                    ],
                }),
            ])],
            turnNumber: 36,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 36,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'smoke-borrowed-a',
            'smoke-borrowed-b',
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            36,
        );

        expect(firstResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'smoke-borrowed-a',
                defId: 'ninja_smoke_bomb',
                ownerId: '1',
                reason: 'ninja_smoke_bomb_self_destruct',
            }),
        }));
        expect(firstResolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'smoke-host-multi')?.attachedActions.map(action => action.uid)).toEqual(['smoke-borrowed-b']);

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            36,
        );

        expect(secondResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'smoke-borrowed-b',
                defId: 'ninja_smoke_bomb',
                ownerId: '1',
                reason: 'ninja_smoke_bomb_self_destruct',
            }),
        }));
        expect(secondResolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'smoke-host-multi')?.attachedActions.map(action => action.uid)).toEqual(['smoke-borrowed-a']);
    });

    it('queued onTurnStart trigger 处理同一宿主两张 borrowed ninja_infiltrate 时，应逐实例入队并各自只自毁当前 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_portal_room', [
                makeMinion('infiltrate-host-multi', 'ninja_tiger_assassin', '1', 4, {
                    attachedActions: [
                        { uid: 'infiltrate-borrowed-a', defId: 'ninja_infiltrate', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                        { uid: 'infiltrate-borrowed-b', defId: 'ninja_infiltrate', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                    ],
                }),
            ])],
            turnNumber: 37,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 37,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'infiltrate-borrowed-a',
            'infiltrate-borrowed-b',
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            37,
        );

        expect(firstResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'infiltrate-borrowed-a',
                defId: 'ninja_infiltrate',
                ownerId: '1',
                reason: 'ninja_infiltrate_expired',
            }),
        }));
        expect(firstResolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'infiltrate-host-multi')?.attachedActions.map(action => action.uid)).toEqual(['infiltrate-borrowed-b']);

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            37,
        );

        expect(secondResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'infiltrate-borrowed-b',
                defId: 'ninja_infiltrate',
                ownerId: '1',
                reason: 'ninja_infiltrate_expired',
            }),
        }));
        expect(secondResolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'infiltrate-host-multi')?.attachedActions.map(action => action.uid)).toEqual(['infiltrate-borrowed-a']);
    });

    it('queued onTurnEnd trigger 处理同一玩家两张 ninja_assassination 时，应只消灭当前 source 对应的宿主', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('assassination-host-a', 'sharks_mako', '1', 4, {
                        attachedActions: [{ uid: 'assassination-a', defId: 'ninja_assassination', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
                    }),
                ]),
                makeBase('base_isis_swingin_pad', [
                    makeMinion('assassination-host-b', 'ghosts_spectre', '1', 3, {
                        attachedActions: [{ uid: 'assassination-b', defId: 'ninja_assassination', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
                    }),
                ]),
            ],
            turnNumber: 38,
        });

        const trigger: TriggerInstance = {
            id: 'queued-ninja-assassination-a',
            timing: 'onTurnEnd',
            sourceDefId: 'ninja_assassination',
            sourceCardUid: 'assassination-a',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            38,
        );

        const destroyEvents = resolved?.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED) ?? [];
        expect(destroyEvents).toHaveLength(1);
        expect(destroyEvents[0]).toEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'assassination-host-a',
                fromBaseIndex: 0,
                ownerId: '1',
                destroyerId: '0',
                reason: 'ninja_assassination',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'assassination-host-a')).toBeUndefined();
        expect(resolved?.state.core.bases[1]?.minions.find(minion => minion.uid === 'assassination-host-b')).toBeDefined();
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('assassination-host-a');
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).not.toContain('assassination-host-b');
    });

    it('queued onTurnStart trigger 处理两个基地上的 werewolf_marking_territory 时，应逐实例入队并各自只把所属基地临界点降到 0', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('mt-base0-own-a', 'werewolf_alpha', '0', 4),
                        makeMinion('mt-base0-own-b', 'werewolf_pack_alpha', '0', 3),
                        makeMinion('mt-base0-opp-a', 'sharks_mako', '1', 2),
                    ],
                    ongoingActions: [{ uid: 'mt-base0', defId: 'werewolf_marking_territory', ownerId: '0' }],
                }),
                makeBase({
                    defId: 'base_egypt',
                    minions: [
                        makeMinion('mt-base1-own-a', 'werewolf_alpha', '0', 5),
                        makeMinion('mt-base1-own-b', 'werewolf_pack_alpha', '0', 2),
                        makeMinion('mt-base1-opp-a', 'sharks_mako', '1', 3),
                    ],
                    ongoingActions: [{ uid: 'mt-base1', defId: 'werewolf_marking_territory', ownerId: '0' }],
                }),
            ],
            turnNumber: 38,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 38,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'mt-base0',
            'mt-base1',
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            38,
        );

        expect(firstResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 0,
                reason: 'werewolf_marking_territory',
            }),
        }));
        expect(firstResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 1,
                reason: 'werewolf_marking_territory',
            }),
        }));

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            38,
        );

        expect(secondResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 1,
                reason: 'werewolf_marking_territory',
            }),
        }));
        expect(secondResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 0,
                reason: 'werewolf_marking_territory',
            }),
        }));
    });

    it('queued onTurnStart trigger 处理两个基地上的 killer_plant_overgrowth 时，应逐实例入队并各自只把当前 source 所在基地临界点降到 0', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    ongoingActions: [{ uid: 'og-a', defId: 'killer_plant_overgrowth', ownerId: '0' }],
                }),
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{ uid: 'og-b', defId: 'killer_plant_overgrowth', ownerId: '0' }],
                }),
            ],
            turnNumber: 39,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 39,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'og-a',
            'og-b',
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            39,
        );

        expect(firstResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 0,
                reason: 'killer_plant_overgrowth',
            }),
        }));
        expect(firstResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 1,
                reason: 'killer_plant_overgrowth',
            }),
        }));

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            39,
        );

        expect(secondResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 1,
                reason: 'killer_plant_overgrowth',
            }),
        }));
        expect(secondResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 0,
                reason: 'killer_plant_overgrowth',
            }),
        }));
    });

    it('queued onTurnStart trigger 处理两个基地上的 vampire_summon_wolves 时，应逐实例入队并各自只给当前 source 增加 1 个 ongoing counter', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{ uid: 'wolves-base0', defId: 'vampire_summon_wolves', ownerId: '0', metadata: { powerCounters: 0 } }],
                }),
                makeBase({
                    defId: 'base_factory',
                    ongoingActions: [{ uid: 'wolves-base1', defId: 'vampire_summon_wolves', ownerId: '0', metadata: { powerCounters: 0 } }],
                }),
            ],
            turnNumber: 39,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 39,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'wolves-base0',
            'wolves-base1',
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            39,
        );

        expect(firstResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED,
            payload: expect.objectContaining({
                cardUid: 'wolves-base0',
                delta: 1,
                reason: 'vampire_summon_wolves',
            }),
        }));
        expect(firstResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED,
            payload: expect.objectContaining({
                cardUid: 'wolves-base1',
                reason: 'vampire_summon_wolves',
            }),
        }));

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            39,
        );

        expect(secondResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED,
            payload: expect.objectContaining({
                cardUid: 'wolves-base1',
                delta: 1,
                reason: 'vampire_summon_wolves',
            }),
        }));
        expect(secondResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED,
            payload: expect.objectContaining({
                cardUid: 'wolves-base0',
                reason: 'vampire_summon_wolves',
            }),
        }));
    });

    it('queued onTurnStart trigger 处理两个基地上的 killer_plant_weed_eater_pod 时，应逐实例入队并各自只给当前 source 写入 empowered metadata', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    minions: [makeMinion('weed-a', 'killer_plant_weed_eater_pod', '0', 3)],
                }),
                makeBase({
                    defId: 'base_factory',
                    minions: [makeMinion('weed-b', 'killer_plant_weed_eater_pod', '0', 3)],
                }),
            ],
            turnNumber: 40,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 40,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'weed-a',
            'weed-b',
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            40,
        );

        expect(firstResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: expect.objectContaining({
                minionUid: 'weed-a',
                baseIndex: 0,
                metadataUpdate: expect.objectContaining({ weedEaterEmpowered: true }),
                reason: 'killer_plant_weed_eater_pod',
            }),
        }));
        expect(firstResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: expect.objectContaining({
                minionUid: 'weed-b',
                reason: 'killer_plant_weed_eater_pod',
            }),
        }));

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            40,
        );

        expect(secondResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: expect.objectContaining({
                minionUid: 'weed-b',
                baseIndex: 1,
                metadataUpdate: expect.objectContaining({ weedEaterEmpowered: true }),
                reason: 'killer_plant_weed_eater_pod',
            }),
        }));
        expect(secondResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: expect.objectContaining({
                minionUid: 'weed-a',
                reason: 'killer_plant_weed_eater_pod',
            }),
        }));
    });

    it('queued onTurnStart trigger 处理两个基地上的 bear_cavalry_bear_necessities_pod 时，应逐实例入队并各自只自毁当前 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{ uid: 'bear-need-base0', defId: 'bear_cavalry_bear_necessities_pod', ownerId: '0', talentUsed: true } as any],
                }),
                makeBase({
                    defId: 'base_factory',
                    ongoingActions: [{ uid: 'bear-need-base1', defId: 'bear_cavalry_bear_necessities_pod', ownerId: '0', talentUsed: true } as any],
                }),
            ],
            turnNumber: 41,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 41,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: TriggerInstance) => trigger.sourceCardUid)).toEqual([
            'bear-need-base0',
            'bear-need-base1',
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            41,
        );

        expect(firstResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'bear-need-base0',
                defId: 'bear_cavalry_bear_necessities_pod',
                ownerId: '0',
                reason: 'bear_cavalry_bear_necessities_pod',
            }),
        }));
        expect(firstResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'bear-need-base1',
                reason: 'bear_cavalry_bear_necessities_pod',
            }),
        }));

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            41,
        );

        expect(secondResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'bear-need-base1',
                defId: 'bear_cavalry_bear_necessities_pod',
                ownerId: '0',
                reason: 'bear_cavalry_bear_necessities_pod',
            }),
        }));
        expect(secondResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'bear-need-base0',
                reason: 'bear_cavalry_bear_necessities_pod',
            }),
        }));
    });

    it('queued onTurnStart trigger 处理 borrowed zombie_overrun 时，仍应按控制者回合自毁并把 detached card 送回真实 owner discard', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                ongoingActions: [],
            })],
            turnNumber: 31,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-overrun-a',
                defId: 'zombie_overrun',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 30,
        } as any);

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 31,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'zombie_overrun',
            ownerPlayerId: '0',
            sourceControllerId: '0',
            eventPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            31,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-overrun-a',
                defId: 'zombie_overrun',
                ownerId: '1',
                reason: 'zombie_overrun_self_destruct',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions.some((action: any) => action.uid === 'borrowed-overrun-a')).toBe(false);
        expect(resolved?.state.core.players['0']?.discard.some((card: any) => card.uid === 'borrowed-overrun-a')).toBe(false);
        expect(resolved?.state.core.players['1']?.discard.some((card: any) => card.uid === 'borrowed-overrun-a')).toBe(true);
    });

    it('queued onTurnStart trigger 处理同基地两张 borrowed zombie_overrun 时，应逐实例入队并各自自毁回真实 owner discard', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                ongoingActions: [],
            })],
            turnNumber: 31,
        });
        const withFirst = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-overrun-a',
                defId: 'zombie_overrun',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 30,
        } as any);
        const core = reduce(withFirst, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-overrun-b',
                defId: 'zombie_overrun',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 30,
        } as any);

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 31,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: any) => trigger.sourceCardUid)).toEqual([
            'borrowed-overrun-a',
            'borrowed-overrun-b',
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            31,
        );

        const prompt = resolved?.state.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
        expect(prompt?.data?.options).toHaveLength(2);

        const handled = resolveSmashUpReactionChoice(
            resolved!.state as any,
            defaultTestRandom,
            32,
            prompt.data.options[0].value,
        );

        expect((handled.state.core.bases[0]?.ongoingActions ?? []).map((action: any) => action.uid)).toEqual([]);
        expect(handled.state.core.players['0']?.discard.map((card: any) => card.uid) ?? []).not.toEqual(
            expect.arrayContaining(['borrowed-overrun-a', 'borrowed-overrun-b']),
        );
        expect(handled.state.core.players['1']?.discard.map((card: any) => card.uid)).toEqual(
            expect.arrayContaining(['borrowed-overrun-a', 'borrowed-overrun-b']),
        );
    });

    it('queued onTurnStart trigger 处理同基地两张 borrowed killer_plant_entangled 时，应逐实例入队并各自自毁回真实 owner discard', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                ongoingActions: [],
            })],
            turnNumber: 33,
        });
        const withFirst = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-entangled-a',
                defId: 'killer_plant_entangled',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 32,
        } as any);
        const core = reduce(withFirst, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-entangled-b',
                defId: 'killer_plant_entangled',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 32,
        } as any);

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 33,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: any) => trigger.sourceCardUid)).toEqual([
            'borrowed-entangled-a',
            'borrowed-entangled-b',
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            33,
        );

        const prompt = resolved?.state.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
        expect(prompt?.data?.options).toHaveLength(2);

        const handled = resolveSmashUpReactionChoice(
            resolved!.state as any,
            defaultTestRandom,
            34,
            prompt.data.options[0].value,
        );

        expect((handled.state.core.bases[0]?.ongoingActions ?? []).map((action: any) => action.uid)).toEqual([]);
        expect(handled.state.core.players['0']?.discard.map((card: any) => card.uid) ?? []).not.toEqual(
            expect.arrayContaining(['borrowed-entangled-a', 'borrowed-entangled-b']),
        );
        expect(handled.state.core.players['1']?.discard.map((card: any) => card.uid)).toEqual(
            expect.arrayContaining(['borrowed-entangled-a', 'borrowed-entangled-b']),
        );
    });

    it('queued onTurnStart trigger 处理 borrowed killer_plant_choking_vines 时，不应被同宿主其他玩家的同名 attachment 抢走 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                minions: [{
                    uid: 'choking-host',
                    defId: 'sharks_mako',
                    controller: '1',
                    owner: '1',
                    basePower: 3,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: false,
                    attachedActions: [
                        { uid: 'opponent-choking-a', defId: 'killer_plant_choking_vines', ownerId: '1' } as any,
                        { uid: 'borrowed-choking-a', defId: 'killer_plant_choking_vines', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                    ],
                } as any],
            })],
            turnNumber: 34,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 34,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(1);
        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'killer_plant_choking_vines',
            sourceCardUid: 'borrowed-choking-a',
            ownerPlayerId: '0',
            sourceControllerId: '0',
            eventPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            34,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'choking-host',
                reason: 'killer_plant_choking_vines',
                destroyerId: '0',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.minions.map((minion: any) => minion.uid) ?? []).not.toContain('choking-host');
    });

    it('queued onTurnStart trigger 处理两个宿主上的同控制者 killer_plant_choking_vines 时，应逐实例入队并各自只消灭当前 source 宿主', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    minions: [{
                        uid: 'choking-host-a',
                        defId: 'sharks_mako',
                        controller: '1',
                        owner: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [
                            { uid: 'choking-a', defId: 'killer_plant_choking_vines', ownerId: '0' } as any,
                        ],
                    } as any],
                }),
                makeBase({
                    defId: 'base_the_deep',
                    minions: [{
                        uid: 'choking-host-b',
                        defId: 'sharks_mako',
                        controller: '1',
                        owner: '1',
                        basePower: 4,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [
                            { uid: 'choking-b', defId: 'killer_plant_choking_vines', ownerId: '0' } as any,
                        ],
                    } as any],
                }),
            ],
            turnNumber: 35,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 35,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: any) => trigger.sourceCardUid)).toEqual(['choking-a', 'choking-b']);
        expect(queued?.payload?.triggers?.map((trigger: any) => trigger.sourceDefId)).toEqual([
            'killer_plant_choking_vines',
            'killer_plant_choking_vines',
        ]);

        const resolvedFirst = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            35,
        );

        expect(resolvedFirst?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'choking-host-a',
                reason: 'killer_plant_choking_vines',
                destroyerId: '0',
            }),
        }));
        expect(resolvedFirst?.state.core.bases[0]?.minions.map((minion: any) => minion.uid) ?? []).not.toContain('choking-host-a');
        expect(resolvedFirst?.state.core.bases[1]?.minions.map((minion: any) => minion.uid) ?? []).toContain('choking-host-b');
    });

    it('queued onTurnEnd trigger 处理 borrowed cthulhu_furthering_the_cause 时，仍应按控制权判定对手并把 VP 给控制者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                ongoingActions: [],
            })],
            turnDestroyedMinions: [
                { uid: 'destroyed-opponent-a', defId: 'sharks_mako', baseIndex: 0, owner: '1', controller: '1' } as any,
            ],
            turnNumber: 32,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'cause-borrowed-a',
                defId: 'cthulhu_furthering_the_cause',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 31,
        } as any);

        const queued = collectTriggers(core, 'onTurnEnd', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 32,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'cthulhu_furthering_the_cause',
            ownerPlayerId: '0',
            sourceControllerId: '0',
            eventPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            32,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({
                playerId: '0',
                amount: 1,
                reason: 'cthulhu_furthering_the_cause',
            }),
        }));
        expect(resolved?.state.core.players['0']?.vp).toBe(1);
        expect(resolved?.state.core.players['1']?.vp ?? 0).toBe(0);
    });

    it('queued onTurnStart trigger 处理 borrowed cthulhu_complete_the_ritual 时，仍应按控制者回合开始清场并换基地', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    minions: [
                        makeMinion('ritual-host-a', 'sharks_mako', '0', 3),
                        makeMinion('ritual-host-b', 'sharks_megalodon', '1', 5),
                    ],
                    ongoingActions: [{ uid: 'ritual-side-a', defId: 'cthulhu_altar', ownerId: '1' }],
                }),
            ],
            baseDeck: ['base_faceless_city'],
            turnNumber: 41,
        });
        const core = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'ritual-borrowed-a',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 40,
        } as any);

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 41,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'cthulhu_complete_the_ritual',
            ownerPlayerId: '0',
            sourceControllerId: '0',
            eventPlayerId: '0',
            sourceCardUid: 'ritual-borrowed-a',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            41,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'ritual-borrowed-a',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                sourcePlayerId: '0',
                reason: 'cthulhu_complete_the_ritual',
            }),
        }));
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'ritual-host-b',
                defId: 'sharks_megalodon',
                ownerId: '1',
                sourcePlayerId: '0',
                reason: 'cthulhu_complete_the_ritual',
            }),
        }));
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BASE_REPLACED,
            payload: expect.objectContaining({
                baseIndex: 0,
                oldBaseDefId: 'base_portal_room',
                newBaseDefId: 'base_faceless_city',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.defId).toBe('base_faceless_city');
        expect(resolved?.state.core.bases[0]?.minions ?? []).toEqual([]);
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
    });

    it('queued onTurnStart trigger 处理两张 borrowed cthulhu_complete_the_ritual 时，选中的 trigger 不应连带清掉另一座基地的同名 Ritual', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    minions: [makeMinion('ritual-host-a', 'sharks_mako', '0', 3)],
                    ongoingActions: [{ uid: 'ritual-side-a', defId: 'cthulhu_altar', ownerId: '1' }],
                }),
                makeBase({
                    defId: 'base_faceless_city',
                    minions: [makeMinion('ritual-host-b', 'sharks_megalodon', '1', 5)],
                    ongoingActions: [{ uid: 'ritual-side-b', defId: 'cthulhu_altar', ownerId: '1' }],
                }),
            ],
            baseDeck: ['base_the_nexus', 'base_monkey_lab'],
            turnNumber: 51,
        });
        const withFirst = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'ritual-a',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 50,
        } as any);
        const core = reduce(withFirst, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'ritual-b',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 1,
            },
            timestamp: 50,
        } as any);

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 51,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: any) => trigger.sourceCardUid)).toEqual([
            'ritual-a',
            'ritual-b',
        ]);

        const firstOnlyResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            51,
        );

        expect(firstOnlyResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'ritual-a',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                reason: 'cthulhu_complete_the_ritual',
            }),
        }));
        expect(firstOnlyResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BASE_REPLACED,
            payload: expect.objectContaining({
                baseIndex: 0,
                oldBaseDefId: 'base_portal_room',
                newBaseDefId: 'base_the_nexus',
            }),
        }));
        expect(firstOnlyResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'ritual-b',
            }),
        }));
        expect(firstOnlyResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BASE_REPLACED,
            payload: expect.objectContaining({
                baseIndex: 1,
            }),
        }));
        expect(firstOnlyResolved?.state.core.bases[0]?.defId).toBe('base_the_nexus');
        expect(firstOnlyResolved?.state.core.bases[1]?.defId).toBe('base_faceless_city');
        expect(firstOnlyResolved?.state.core.bases[0]?.minions ?? []).toEqual([]);
        expect((firstOnlyResolved?.state.core.bases[1]?.minions ?? []).map((minion) => minion.uid)).toEqual(['ritual-host-b']);
        expect(firstOnlyResolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect((firstOnlyResolved?.state.core.bases[1]?.ongoingActions ?? []).map((ongoing) => ongoing.uid)).toEqual([
            'ritual-side-b',
            'ritual-b',
        ]);
    });

    it('queued onTurnStart trigger 处理两张 borrowed cthulhu_complete_the_ritual 时，应逐实例入队并各自清场换基地', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    minions: [makeMinion('ritual-host-a', 'sharks_mako', '0', 3)],
                    ongoingActions: [{ uid: 'ritual-side-a', defId: 'cthulhu_altar', ownerId: '1' }],
                }),
                makeBase({
                    defId: 'base_faceless_city',
                    minions: [makeMinion('ritual-host-b', 'sharks_megalodon', '1', 5)],
                    ongoingActions: [{ uid: 'ritual-side-b', defId: 'cthulhu_altar', ownerId: '1' }],
                }),
            ],
            baseDeck: [
                'base_the_nexus',
                'base_monkey_lab',
                'base_the_nexus',
                'base_monkey_lab',
                'base_the_nexus',
                'base_monkey_lab',
            ],
            turnNumber: 51,
        });
        const withFirst = reduce(baseCore, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'ritual-a',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            },
            timestamp: 50,
        } as any);
        const core = reduce(withFirst, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'ritual-b',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 1,
            },
            timestamp: 50,
        } as any);

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 51,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect(queued?.payload?.triggers?.map((trigger: any) => trigger.sourceCardUid)).toEqual([
            'ritual-a',
            'ritual-b',
        ]);

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            51,
        );
        const reactionPrompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        expect(reactionPrompt?.data?.options).toHaveLength(2);

        const firstTriggerOption = reactionPrompt?.data?.options?.find(
            (entry: any) => entry.value?.triggerId === queued.payload.triggers[0].id,
        );
        expect(firstTriggerOption).toBeDefined();

        const firstResolved = runCommand(
            prompted!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: firstTriggerOption.id },
            } as any,
            defaultTestRandom,
        );

        const ritualBottoms = firstResolved.events.filter((event: any) =>
            event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM
            && event.payload?.defId === 'cthulhu_complete_the_ritual',
        );
        expect(ritualBottoms.map((event: any) => event.payload.cardUid)).toEqual(['ritual-a', 'ritual-b']);
        const replacedBases = firstResolved.events.filter((event: any) => event.type === SU_EVENTS.BASE_REPLACED);
        expect(replacedBases.map((event: any) => event.payload.baseIndex)).toEqual([0, 1]);
        expect(firstResolved.finalState.core.bases[0]?.defId).toBe('base_the_nexus');
        expect(firstResolved.finalState.core.bases[1]?.defId).toBe('base_monkey_lab');
        expect(firstResolved.finalState.core.bases[0]?.minions ?? []).toEqual([]);
        expect(firstResolved.finalState.core.bases[1]?.minions ?? []).toEqual([]);
    });

    it('queued afterScoring trigger 在对手计分时仍应把 mermaids_shipwreck_cove 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'ship-1', defId: 'mermaids_shipwreck_cove', ownerId: '0' }],
                }),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'ship-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 2,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('mermaids_shipwreck_cove');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            2,
        );
        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const triggerOption = reactionPrompt?.data?.options?.find((entry: any) => entry.value?.triggerId === queued.payload.triggers[0].id);
        expect(triggerOption).toBeDefined();

        const prompted = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: triggerOption.id },
            } as any,
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(prompted.finalState)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('mermaids_shipwreck_cove_after_scoring');
    });

    it('queued afterScoring trigger 在对手计分时仍应把 skeletons_gravestones 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'gravestones-1', defId: 'skeletons_gravestones', ownerId: '0' }],
                }),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'gravestones-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 3,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('skeletons_gravestones');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            3,
        );
        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const triggerOption = reactionPrompt?.data?.options?.find((entry: any) => entry.value?.triggerId === queued.payload.triggers[0].id);
        expect(triggerOption).toBeDefined();

        const prompted = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: triggerOption.id },
            } as any,
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(prompted.finalState)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('skeletons_gravestones_after_scoring');
    });

    it('queued onBuriedCardUncovered per-instance trigger 在对手翻开埋葬牌时仍应把 skeletons_lord_of_bones 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('lob-1', 'skeletons_lord_of_bones', '0', 5),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onBuriedCardUncovered', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            buriedCardUid: 'buried-minion-1',
            buriedCardDefId: 'robot_microbot_alpha',
            sourceCardUid: 'lob-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 31,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('skeletons_lord_of_bones');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            31,
        );
        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const triggerOption = reactionPrompt?.data?.options?.find((entry: any) => entry.value?.triggerId === queued.payload.triggers[0].id);
        expect(triggerOption).toBeDefined();

        const prompted = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: triggerOption.id },
            } as any,
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(prompted.finalState)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('skeletons_lord_of_bones_ongoing');
    });

    it('queued onBuriedCardUncovered per-instance trigger 在对手翻开埋葬牌时仍应把 skeletons_gravestones 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'gravestones-1', defId: 'skeletons_gravestones', ownerId: '0' }],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onBuriedCardUncovered', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            buriedCardUid: 'buried-minion-2',
            buriedCardDefId: 'robot_microbot_beta',
            sourceCardUid: 'gravestones-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 32,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('skeletons_gravestones');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            32,
        );
        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
    });

    it('queued onBuriedCardUncovered per-instance trigger 在对手翻开己方埋葬牌时仍应把 skeletons_gravetender 归给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('grave-draw-a', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('enemy-deck-a', 'sharks_hammerhead', 'minion', '1')],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('gravetender-1', 'skeletons_gravetender', '0', 4),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onBuriedCardUncovered', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            buriedCardUid: 'buried-own-a',
            buriedCardDefId: 'robot_microbot_alpha',
            buriedCardControllerId: '0',
            sourceCardUid: 'gravetender-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 33,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('skeletons_gravetender');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.eventPlayerId).toBe('1');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            33,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core))).toEqual([]);
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toContain('grave-draw-a');
        expect(resolved?.state.core.players['1']?.hand).toEqual([]);
    });

    it('queued onBuriedCardUncovered per-instance trigger 在对手翻牌时仍应让 ancient_egyptians_pharaoh 控制者抽牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('pharaoh-draw-a', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('enemy-deck-a', 'sharks_hammerhead', 'minion', '1')],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('pharaoh-1', 'ancient_egyptians_pharaoh', '0', 5),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onBuriedCardUncovered', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            buriedCardUid: 'buried-enemy-a',
            buriedCardDefId: 'robot_zapbot',
            buriedCardControllerId: '1',
            sourceCardUid: 'pharaoh-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 34,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ancient_egyptians_pharaoh');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.eventPlayerId).toBe('1');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            34,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core))).toEqual([]);
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toContain('pharaoh-draw-a');
        expect(resolved?.state.core.players['1']?.hand).toEqual([]);
    });

    it('queued beforeScoring trigger 在对手计分时仍应把 pirate_king 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('king-0', 'pirate_king', '0', 5),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 1,
            sourceCardUid: 'king-0',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 4,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('pirate_king');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            4,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('pirate_king_move');

        const prompted = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: 'yes' },
            } as any,
            defaultTestRandom,
        );
        const promptAfterResolve = getInteractionsFromMS(prompted.finalState)[0] as any;
        expect(promptAfterResolve).toBeUndefined();
    });

    it('queued beforeScoring trigger 处理 pirate_king 时，不应把计分基地上的 resident king 当成 representative source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_score', [
                    makeMinion('king-score', 'pirate_king', '1', 5),
                    makeMinion('score-minion', 'test_other', '1', 3),
                ]),
                makeBase('base_remote', [
                    makeMinion('king-move', 'pirate_king', '0', 5),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 77,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'pirate_king',
            sourceCardUid: 'king-move',
            sourceBaseIndex: 1,
            sourceControllerId: '0',
            ownerPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            77,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('pirate_king_move');
        expect(prompt?.id).toBe('pirate_king_move_king-move_77');
    });

    it('queued beforeScoring trigger 手工回放第二张 pirate_king source 时，不应回退到扫描顺序里的第一张 king', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_first', [
                    makeMinion('king-first', 'pirate_king', '1', 5),
                ]),
                makeBase('base_second', [
                    makeMinion('king-second', 'pirate_king', '0', 5),
                ]),
                makeBase('base_score', []),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-pirate-king-second',
            timing: 'beforeScoring',
            sourceDefId: 'pirate_king',
            sourceCardUid: 'king-second',
            sourceBaseIndex: 1,
            sourceControllerId: '0',
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 2,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            88,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('pirate_king_move');
        expect(prompt?.id).toBe('pirate_king_move_king-second_88');
    });

    it('queued beforeScoring sourceHostController trigger 处理第二张 Dunwich Horror POD 时，不应回退到同基地第一张宿主 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_a',
                minions: [
                    {
                        ...makeMinion('host-1', 'robot_microbot', '1', 3),
                        attachedActions: [{ uid: 'dh-1', defId: 'elder_thing_dunwich_horror_pod', ownerId: '0' } as any],
                    },
                    {
                        ...makeMinion('host-2', 'ninja_shinobi', '0', 4),
                        attachedActions: [{ uid: 'dh-2', defId: 'elder_thing_dunwich_horror_pod', ownerId: '1' } as any],
                    },
                ],
                ongoingActions: [],
            })],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1002,
        }) as any;
        expect(queued?.payload?.triggers?.map((entry: any) => entry.sourceCardUid)).toEqual(['dh-1', 'dh-2']);

        const trigger: TriggerInstance = {
            id: 'queued-dunwich-pod-second',
            timing: 'beforeScoring',
            sourceDefId: 'elder_thing_dunwich_horror_pod',
            sourceCardUid: 'dh-2',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            playerContext: 'sourceHostController',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            1002,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.id).toContain('host-2');
        expect(prompt?.data?.sourceId).toBe('elder_thing_dunwich_horror_pod_choice');
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 pirate_first_mate 的后续选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('mate-0', 'pirate_first_mate', '0', 2),
                    makeMinion('opp-1', 'test_other', '1', 4),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 4, vp: 3 }],
            sourceCardUid: 'mate-0',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 5,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('pirate_first_mate');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            5,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('pirate_first_mate_choose_base');
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 pirate_first_mate_pod 的后续选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('mate-pod-0', 'pirate_first_mate_pod', '0', 2),
                    makeMinion('opp-1', 'test_other', '1', 4),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 4, vp: 3 }],
            sourceCardUid: 'mate-pod-0',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 5.1,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('pirate_first_mate_pod');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            5.1,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('pirate_first_mate_choose_base');
    });

    it('queued beforeScoring per-instance trigger 在对手计分时仍应把 cthulhu_chosen 的确认权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('chosen-0', 'cthulhu_chosen', '0', 3),
                ]),
            ],
            madnessDeck: [
                makeCard('mad-0', 'special_madness', 'madness', '0'),
                makeCard('mad-1', 'special_madness', 'madness', '0'),
            ] as any,
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'chosen-0',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 5,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('cthulhu_chosen');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            5,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('cthulhu_chosen_confirm');
    });

    it('同一基地同时存在其他玩家的 Cthulhu Chosen 与 borrowed Cthulhu Chosen 时，beforeScoring 应按实例顺序继续给出两条真实确认 prompt', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('chosen-opponent', 'cthulhu_chosen', '1', 3),
                    makeMinion('chosen-borrowed', 'cthulhu_chosen', '0', 3, { owner: '1' }),
                ]),
            ],
            madnessDeck: [
                makeCard('mad-a', 'special_madness', 'madness', '0'),
                makeCard('mad-b', 'special_madness', 'madness', '1'),
            ] as any,
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'chosen-borrowed',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 5.2,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect((queued?.payload?.triggers ?? []).map((trigger: any) => ({
            sourceCardUid: trigger.sourceCardUid,
            sourceControllerId: trigger.sourceControllerId,
            ownerPlayerId: trigger.ownerPlayerId,
        }))).toEqual([
            {
                sourceCardUid: 'chosen-opponent',
                sourceControllerId: '1',
                ownerPlayerId: '1',
            },
            {
                sourceCardUid: 'chosen-borrowed',
                sourceControllerId: '0',
                ownerPlayerId: '0',
            },
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            5.2,
        );
        const reactionChoice = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionChoice?.playerId).toBe('1');
        expect(reactionChoice?.data?.sourceId).toBe('smashup_reaction_choose');
        const firstTriggerOptionId = reactionChoice?.data?.options?.find(
            (option: any) => option.id === `trigger:${queued.payload.triggers[0].id}`,
        )?.id;
        expect(firstTriggerOptionId).toBeTruthy();

        const chooseFirstChosen = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '1',
                payload: { optionId: firstTriggerOptionId },
            } as any,
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(chooseFirstChosen.finalState)[0] as any;
        expect(prompt?.playerId).toBe('1');
        expect(prompt?.data?.sourceId).toBe('cthulhu_chosen_confirm');
        expect(prompt?.id).toContain('chosen-opponent');

        const responded = runCommand(
            chooseFirstChosen.finalState,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '1',
                payload: { optionId: 'no' },
            } as any,
            defaultTestRandom,
        );

        const nextPrompt = getInteractionsFromMS(responded.finalState)[0] as any;
        expect(nextPrompt?.playerId).toBe('0');
        expect(nextPrompt?.data?.sourceId).toBe('cthulhu_chosen_confirm');
        expect(nextPrompt?.id).toContain('chosen-borrowed');
    });

    it('同一基地同时存在其他玩家的 Loup Garou 与 borrowed Loup Garou 时，beforeScoring 应按实例保留两条 source，并各自只强化当前 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('wolf-opponent', 'werewolf_loup_garou', '1', 4),
                    makeMinion('wolf-borrowed', 'werewolf_loup_garou', '0', 4, { owner: '1' }),
                    makeMinion('wolf-other', 'sharks_mako', '1', 2),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'wolf-borrowed',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 5.3,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect((queued?.payload?.triggers ?? []).map((trigger: any) => ({
            sourceCardUid: trigger.sourceCardUid,
            sourceControllerId: trigger.sourceControllerId,
        }))).toEqual([
            {
                sourceCardUid: 'wolf-opponent',
                sourceControllerId: '1',
            },
            {
                sourceCardUid: 'wolf-borrowed',
                sourceControllerId: '0',
            },
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            5.3,
        );
        expect(firstResolved?.state.core.bases[0].minions.find((minion) => minion.uid === 'wolf-opponent')?.tempPowerModifier).toBe(2);
        expect(firstResolved?.state.core.bases[0].minions.find((minion) => minion.uid === 'wolf-borrowed')?.tempPowerModifier ?? 0).toBe(0);

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            5.31,
        );
        expect(secondResolved?.state.core.bases[0].minions.find((minion) => minion.uid === 'wolf-borrowed')?.tempPowerModifier).toBe(2);
        expect(secondResolved?.state.core.bases[0].minions.find((minion) => minion.uid === 'wolf-opponent')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('同一基地同时存在其他玩家的 Pack Alpha 与 borrowed Pack Alpha 时，beforeScoring 应按实例保留两条 source，并各自只强化当前控制者的随从', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('pack-opponent', 'werewolf_pack_alpha', '1', 4),
                    makeMinion('pack-opponent-ally', 'werewolf_alpha', '1', 3),
                    makeMinion('pack-borrowed', 'werewolf_pack_alpha', '0', 4, { owner: '1' }),
                    makeMinion('pack-borrowed-ally', 'robot_microbot_alpha', '0', 2),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'pack-borrowed',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 5.4,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect((queued?.payload?.triggers ?? []).map((trigger: any) => ({
            sourceCardUid: trigger.sourceCardUid,
            sourceControllerId: trigger.sourceControllerId,
        }))).toEqual([
            {
                sourceCardUid: 'pack-opponent',
                sourceControllerId: '1',
            },
            {
                sourceCardUid: 'pack-borrowed',
                sourceControllerId: '0',
            },
        ]);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[0]],
            }),
            defaultTestRandom,
            5.4,
        );
        const firstMinions = firstResolved?.state.core.bases[0].minions ?? [];
        expect(firstMinions.find((minion) => minion.uid === 'pack-opponent')?.tempPowerModifier).toBe(1);
        expect(firstMinions.find((minion) => minion.uid === 'pack-opponent-ally')?.tempPowerModifier).toBe(1);
        expect(firstMinions.find((minion) => minion.uid === 'pack-borrowed')?.tempPowerModifier ?? 0).toBe(0);
        expect(firstMinions.find((minion) => minion.uid === 'pack-borrowed-ally')?.tempPowerModifier ?? 0).toBe(0);

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [queued.payload.triggers[1]],
            }),
            defaultTestRandom,
            5.41,
        );
        const secondMinions = secondResolved?.state.core.bases[0].minions ?? [];
        expect(secondMinions.find((minion) => minion.uid === 'pack-borrowed')?.tempPowerModifier).toBe(1);
        expect(secondMinions.find((minion) => minion.uid === 'pack-borrowed-ally')?.tempPowerModifier).toBe(1);
        expect(secondMinions.find((minion) => minion.uid === 'pack-opponent')?.tempPowerModifier ?? 0).toBe(0);
        expect(secondMinions.find((minion) => minion.uid === 'pack-opponent-ally')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('queued beforeScoring per-instance trigger 在对手计分时仍应把 tornados_dust_devil 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('dust-1', 'tornados_dust_devil', '0', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 1,
            sourceCardUid: 'dust-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 6,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('tornados_dust_devil');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            6,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('tornados_dust_devil');
    });

    it('queued beforeScoring per-instance trigger 在对手计分时仍应把 sharks_megalodon 的消灭选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('mega-0', 'sharks_megalodon', '0', 5),
                    makeMinion('small-1', 'test_other', '1', 2),
                    makeMinion('small-2', 'test_other', '1', 3),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'mega-0',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 51,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('sharks_megalodon');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            51,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('sharks_megalodon_before_scoring');
        expect(prompt?.data?.targetType).toBe('field-source-target');
        const options = prompt?.options ?? prompt?.data?.options ?? [];
        const destroyOptions = options.filter((option: any) => option.value?.fieldInteractionType === 'source-target');
        expect(destroyOptions).toHaveLength(2);
        expect(destroyOptions.every((option: any) => option.value?.sourceUid === 'mega-0')).toBe(true);
        expect(destroyOptions.map((option: any) => option.value?.targetMinionUid).sort()).toEqual(['small-1', 'small-2']);
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 giant_ant_we_are_the_champions 的确认权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('ant-source', 'giant_ant_worker', '0', 3, { powerCounters: 2 }),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', [
                    makeMinion('ant-target', 'test_other', '0', 2),
                ]),
            ],
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'giant_ant_we_are_the_champions',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'champ-1',
                    minionSnapshots: [
                        {
                            uid: 'ant-source',
                            defId: 'giant_ant_worker',
                            baseIndex: 0,
                            counterAmount: 2,
                        },
                    ],
                } as any,
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'champ-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 6,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('giant_ant_we_are_the_champions');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            6,
        );
        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_snapshot_source');
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 giant_ant_we_are_the_champions_pod 的确认权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('ant-source', 'giant_ant_worker_pod', '0', 3, { powerCounters: 2 }),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', [
                    makeMinion('ant-target', 'test_other', '0', 2),
                ]),
            ],
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'giant_ant_we_are_the_champions_pod',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'champ-pod-1',
                    minionSnapshots: [
                        {
                            uid: 'ant-source',
                            defId: 'giant_ant_worker_pod',
                            baseIndex: 0,
                            counterAmount: 2,
                        },
                    ],
                } as any,
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'champ-pod-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 7,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('giant_ant_we_are_the_champions_pod');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.playerContext).toBe('sourceController');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            7,
        );
        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_snapshot_source');
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 innsmouth_return_to_the_sea 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('locals-a', 'innsmouth_the_locals', '0', 2),
                    makeMinion('locals-b', 'innsmouth_the_locals', '0', 2),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'innsmouth_return_to_the_sea',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'sea-1',
                } as any,
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'sea-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 7,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('innsmouth_return_to_the_sea');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            7,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('innsmouth_return_to_the_sea');
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 alien_scout 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('scout-1', 'alien_scout', '0', 3),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'scout-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 8,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('alien_scout');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            8,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('alien_scout_return');
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 alien_scout_pod 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('scout-pod-1', 'alien_scout_pod', '0', 3),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'scout-pod-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 8.1,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('alien_scout_pod');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            8.1,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('alien_scout_return');
    });

    it('同一基地同时存在其他玩家的 Alien Scout 与 borrowed Alien Scout 时，afterScoring 应按实例顺序继续给出两条真实 prompt', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('scout-opponent', 'alien_scout', '1', 3),
                    makeMinion('scout-borrowed', 'alien_scout', '0', 3, { owner: '1' }),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'scout-borrowed',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 8.2,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(2);
        expect((queued?.payload?.triggers ?? []).map((trigger: any) => ({
            sourceCardUid: trigger.sourceCardUid,
            sourceControllerId: trigger.sourceControllerId,
            ownerPlayerId: trigger.ownerPlayerId,
        }))).toEqual([
            {
                sourceCardUid: 'scout-opponent',
                sourceControllerId: '1',
                ownerPlayerId: '1',
            },
            {
                sourceCardUid: 'scout-borrowed',
                sourceControllerId: '0',
                ownerPlayerId: '0',
            },
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            8.2,
        );
        const reactionChoice = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionChoice?.playerId).toBe('1');
        expect(reactionChoice?.data?.sourceId).toBe('smashup_reaction_choose');
        const firstScoutOption = reactionChoice?.data?.options?.find(
            (entry: any) => entry.value?.triggerId === queued.payload.triggers[0].id,
        );
        expect(firstScoutOption).toBeDefined();

        const chooseFirstScout = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '1',
                payload: { optionId: firstScoutOption.id },
            } as any,
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(chooseFirstScout.finalState)[0] as any;
        expect(prompt?.playerId).toBe('1');
        expect(prompt?.data?.sourceId).toBe('alien_scout_return');
        expect(prompt?.id).toContain('scout-opponent');

        const responded = runCommand(
            chooseFirstScout.finalState,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '1',
                payload: { optionId: 'no' },
            } as any,
            defaultTestRandom,
        );

        const nextPrompt = getInteractionsFromMS(responded.finalState)[0] as any;
        expect(nextPrompt?.playerId).toBe('0');
        expect(nextPrompt?.data?.sourceId).toBe('alien_scout_return');
        expect(nextPrompt?.id).toContain('scout-borrowed');
    });

    it('queued afterScoring global trigger 在对手计分时仍应把 sphinx 的埋葬回手 prompt 交给控制者并保留 buried card/base context', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('opp-1', 'test_other', '1', 5)],
                    buriedCards: [{
                        uid: 'sphinx-score-buried',
                        defId: 'robot_zapbot',
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'hand',
                    }],
                }),
                makeBase('base_b', []),
            ],
            titans: [{
                uid: 't-sphinx-live',
                defId: 'sphinx',
                faction: 'ancient_egyptians',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 8,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('sphinx');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('1');
        expect(queued?.payload?.triggers?.[0]?.sourceCardUid).toBe('t-sphinx-live');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceBaseIndex).toBe(0);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            8,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_sphinx_after_scoring');

        const option = prompt?.data?.options?.find((entry: any) =>
            entry.value?.cardUid === 'sphinx-score-buried' && entry.value?.baseIndex === 0);
        expect(option).toBeDefined();

        const responded = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: option.id },
            } as any,
            defaultTestRandom,
        );

        expect(responded.finalState.core.players['0'].hand.some(card => card.uid === 'sphinx-score-buried')).toBe(true);
        expect(responded.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'sphinx-score-buried') ?? false).toBe(false);
    });

    it('同一基地同时存在其他玩家的 Sphinx 与 borrowed Sphinx 时，afterScoring 应按实例顺序继续给出两条真实 prompt', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('opp-1', 'test_other', '1', 5)],
                    buriedCards: [
                        {
                            uid: 'sphinx-buried-opponent',
                            defId: 'robot_zapbot',
                            trueOwnerId: '1',
                            controllerId: '1',
                            buriedFrom: 'hand',
                        },
                        {
                            uid: 'sphinx-buried-borrowed',
                            defId: 'robot_microbot_alpha',
                            trueOwnerId: '1',
                            controllerId: '0',
                            buriedFrom: 'hand',
                        },
                    ],
                }),
                makeBase('base_b', []),
            ],
            titans: [
                {
                    uid: 't-sphinx-opponent',
                    defId: 'sphinx',
                    faction: 'ancient_egyptians',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 't-sphinx-borrowed',
                    defId: 'sphinx',
                    faction: 'ancient_egyptians',
                    ownerId: '1',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as any,
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 8.3,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(1);
        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('sphinx');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            8.3,
        );
        const firstPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(firstPrompt?.playerId).toBe('1');
        expect(firstPrompt?.data?.sourceId).toBe('titan_sphinx_after_scoring');
        expect(firstPrompt?.id).toContain('t-sphinx-opponent');
        expect(firstPrompt?.data?.options?.some((entry: any) => entry.value?.cardUid === 'sphinx-buried-opponent')).toBe(true);
        expect(firstPrompt?.data?.options?.some((entry: any) => entry.value?.cardUid === 'sphinx-buried-borrowed')).toBe(false);

        const skipFirst = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '1',
                payload: { optionId: 'skip' },
            } as any,
            defaultTestRandom,
        );

        const secondPrompt = getInteractionsFromMS(skipFirst.finalState)[0] as any;
        expect(secondPrompt?.playerId).toBe('0');
        expect(secondPrompt?.data?.sourceId).toBe('titan_sphinx_after_scoring');
        expect(secondPrompt?.id).toContain('t-sphinx-borrowed');
        expect(secondPrompt?.data?.options?.some((entry: any) => entry.value?.cardUid === 'sphinx-buried-borrowed')).toBe(true);
        expect(secondPrompt?.data?.options?.some((entry: any) => entry.value?.cardUid === 'sphinx-buried-opponent')).toBe(false);
    });

    it('同一基地同时存在其他玩家的 Big Funny Giant 与 borrowed Big Funny Giant 时，afterScoring 应按各自控制者独立判定 VP', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('big-funny-score-minion', 'test_other', '0', 5)],
                }),
                makeBase('base_b', []),
            ],
            titans: [
                {
                    uid: 't-big-funny-opponent',
                    defId: 'tricksters_big_funny_giant',
                    faction: 'tricksters',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 't-big-funny-borrowed',
                    defId: 'tricksters_big_funny_giant',
                    faction: 'tricksters',
                    ownerId: '1',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as any,
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 8.35,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(1);
        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('tricksters_big_funny_giant');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            8.35,
        );

        const vpEvents = (resolved?.events ?? []).filter((event: any) =>
            event.type === SU_EVENTS.VP_AWARDED
            && event.payload?.reason === 'tricksters_big_funny_giant_after_scoring');

        expect(vpEvents).toHaveLength(1);
        expect(vpEvents[0]).toEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({
                playerId: '0',
                amount: 1,
                reason: 'tricksters_big_funny_giant_after_scoring',
            }),
        }));
        expect((resolved?.state.core.players['0']?.vp ?? 0)).toBe(1);
        expect((resolved?.state.core.players['1']?.vp ?? 0)).toBe(0);
        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core))).toHaveLength(0);
    });

    it('queued afterScoring global trigger 处理同基地双方都 armed 的 vampire_buffet 时，不应因第一条 source 归属而错给输家加指示物', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('buffet-score-winner', 'test_other', '0', 6),
                        makeMinion('buffet-score-loser', 'test_other', '1', 4),
                    ],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('buffet-side-winner', 'test_other', '0', 2)],
                }),
                makeBase({
                    defId: 'base_c',
                    minions: [makeMinion('buffet-side-loser', 'test_other', '1', 3)],
                }),
            ],
            pendingAfterScoringSpecials: [
                { sourceDefId: 'vampire_buffet', playerId: '1', baseIndex: 0, cardUid: 'buffet-p1' } as any,
                { sourceDefId: 'vampire_buffet', playerId: '0', baseIndex: 0, cardUid: 'buffet-p0' } as any,
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [
                { playerId: '0', power: 6, vp: 4 },
                { playerId: '1', power: 4, vp: 2 },
            ],
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 8.36,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(1);
        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'vampire_buffet',
            sourceCardUid: 'buffet-p1',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            8.36,
        );

        const consumedEvents = (resolved?.events ?? []).filter((event: any) =>
            event.type === SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED
            && event.payload?.sourceDefId === 'vampire_buffet');
        expect(consumedEvents).toHaveLength(2);

        const counterEvents = (resolved?.events ?? []).filter((event: any) =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && event.payload?.reason === 'vampire_buffet');
        expect(counterEvents).toHaveLength(2);
        expect(counterEvents.map((event: any) => event.payload?.minionUid).sort()).toEqual([
            'buffet-score-winner',
            'buffet-side-winner',
        ]);

        expect((resolved?.state.core.pendingAfterScoringSpecials ?? []).length).toBe(0);
        expect(resolved?.state.core.bases[0].minions.find((minion: any) => minion.uid === 'buffet-score-winner')?.powerCounters).toBe(1);
        expect(resolved?.state.core.bases[1].minions.find((minion: any) => minion.uid === 'buffet-side-winner')?.powerCounters).toBe(1);
        expect((resolved?.state.core.bases[0].minions.find((minion: any) => minion.uid === 'buffet-score-loser')?.powerCounters ?? 0)).toBe(0);
        expect((resolved?.state.core.bases[2].minions.find((minion: any) => minion.uid === 'buffet-side-loser')?.powerCounters ?? 0)).toBe(0);
        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core))).toHaveLength(0);
    });

    it('queued afterScoring global trigger 在对手计分时仍应把 pirates_the_kraken 的替换基地进场 prompt 交给拥有者并保留 titan source context', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-on-score', 'test_other', '0', 2),
                        makeMinion('opp-1', 'test_other', '1', 5),
                    ],
                }),
                makeBase('base_b', []),
            ],
            titans: [{
                uid: 't-kraken-setaside',
                defId: 'pirates_the_kraken',
                faction: 'pirates',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 9,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('pirates_the_kraken');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('1');
        expect(queued?.payload?.triggers?.[0]?.sourceCardUid).toBe('t-kraken-setaside');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceBaseIndex).toBeUndefined();
        expect(queued?.payload?.triggers?.[0]?.triggerBaseControllersAtTrigger).toEqual(['0', '1']);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            9,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_pirates_the_kraken_play_replacement');
        expect(prompt?.data?.continuationContext?.titanUid).toBe('t-kraken-setaside');
        expect(prompt?.data?.continuationContext?.scoringBaseIndex).toBe(0);
    });

    it('queued afterScoring global trigger 在 borrowed pirates_the_kraken 上仍应把替换基地进场 prompt 交给当前控制者并保留真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('borrowed-ally-on-score', 'test_other', '0', 2),
                        makeMinion('borrowed-opp-1', 'test_other', '1', 5),
                    ],
                }),
                makeBase('base_b', []),
            ],
            titans: [{
                uid: 't-kraken-borrowed-setaside',
                defId: 'pirates_the_kraken',
                faction: 'pirates',
                ownerId: '1',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 11,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('pirates_the_kraken');
        expect(queued?.payload?.triggers?.[0]?.sourceCardUid).toBe('t-kraken-borrowed-setaside');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            11,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_pirates_the_kraken_play_replacement');
        expect(prompt?.data?.continuationContext?.titanUid).toBe('t-kraken-borrowed-setaside');
        expect(prompt?.data?.continuationContext?.ownerId).toBe('1');
        expect(prompt?.data?.continuationContext?.controllerId).toBe('0');
    });

    it('同一计分基地同时存在其他玩家的 live Kraken 与 borrowed live Kraken 时，afterScoring rescue prompt 应按各自控制者顺序继续，不得串用上一只 Kraken 的候选', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('kraken-save-opponent', 'test_other', '1', 3),
                        makeMinion('kraken-save-borrowed', 'test_other', '0', 3, { owner: '1' }),
                    ],
                }),
                makeBase('base_b', []),
                makeBase('base_c', []),
            ],
            titans: [
                {
                    uid: 't-kraken-opponent-live',
                    defId: 'pirates_the_kraken',
                    faction: 'pirates',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 't-kraken-borrowed-live',
                    defId: 'pirates_the_kraken',
                    faction: 'pirates',
                    ownerId: '1',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as any,
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 6, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 11.1,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(1);
        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('pirates_the_kraken');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            11.1,
        );

        const firstPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(firstPrompt?.playerId).toBe('1');
        expect(firstPrompt?.data?.sourceId).toBe('titan_pirates_the_kraken_choose_minion');
        expect(firstPrompt?.id).toContain('t-kraken-opponent-live');
        expect(firstPrompt?.data?.options?.some((entry: any) => entry.value?.minionUid === 'kraken-save-opponent')).toBe(true);
        expect(firstPrompt?.data?.options?.some((entry: any) => entry.value?.minionUid === 'kraken-save-borrowed')).toBe(false);

        const chooseOpponentMinionOption = firstPrompt.data.options.find((entry: any) =>
            entry.value?.minionUid === 'kraken-save-opponent');
        expect(chooseOpponentMinionOption).toBeDefined();

        const choseOpponentMinion = runCommand(
            resolved!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '1',
                payload: { optionId: chooseOpponentMinionOption.id },
            } as any,
            defaultTestRandom,
        );

        const firstBasePrompt = getInteractionsFromMS(choseOpponentMinion.finalState)[0] as any;
        expect(firstBasePrompt?.playerId).toBe('1');
        expect(firstBasePrompt?.data?.sourceId).toBe('titan_pirates_the_kraken_choose_base');
        const moveToBaseOption = firstBasePrompt.data.options.find((entry: any) => entry.value?.baseIndex === 1)
            ?? firstBasePrompt.data.options[0];
        expect(moveToBaseOption).toBeDefined();

        const movedOpponentMinion = runCommand(
            choseOpponentMinion.finalState,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '1',
                payload: { optionId: moveToBaseOption.id },
            } as any,
            defaultTestRandom,
        );

        const secondPrompt = getInteractionsFromMS(movedOpponentMinion.finalState)[0] as any;
        expect(secondPrompt?.playerId).toBe('0');
        expect(secondPrompt?.data?.sourceId).toBe('titan_pirates_the_kraken_choose_minion');
        expect(secondPrompt?.id).toContain('t-kraken-borrowed-live');
        expect(secondPrompt?.data?.options?.some((entry: any) => entry.value?.minionUid === 'kraken-save-borrowed')).toBe(true);
        expect(secondPrompt?.data?.options?.some((entry: any) => entry.value?.minionUid === 'kraken-save-opponent')).toBe(false);
    });

    it('queued afterScoring global trigger 在对手计分时仍应把 itty_critters_rainboroc 的替换基地进场 prompt 交给赢家本人并保留 setaside titan source context', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('opp-score-1', 'test_other', '1', 5),
                        makeMinion('ally-score-1', 'test_other', '0', 2),
                    ],
                }),
                makeBase('base_b', []),
            ],
            titans: [{
                uid: 't-rainboroc-setaside',
                defId: 'itty_critters_rainboroc',
                faction: 'itty_critters',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '1',
            random: defaultTestRandom,
            now: 10,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('itty_critters_rainboroc');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('1');
        expect(queued?.payload?.triggers?.[0]?.sourceCardUid).toBe('t-rainboroc-setaside');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('1');
        expect(queued?.payload?.triggers?.[0]?.sourceBaseIndex).toBeUndefined();

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            10,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('1');
        expect(prompt?.data?.sourceId).toBe('titan_itty_critters_rainboroc_play_replacement');
        expect(prompt?.data?.continuationContext?.titanUid).toBe('t-rainboroc-setaside');
        expect(prompt?.data?.continuationContext?.scoringBaseIndex).toBe(0);
    });

    it('queued afterScoring global trigger 在 borrowed itty_critters_rainboroc 上仍应把替换基地进场 prompt 交给当前控制者并保留真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('borrowed-ally-score-1', 'test_other', '0', 5),
                        makeMinion('borrowed-opp-score-1', 'test_other', '1', 2),
                    ],
                }),
                makeBase('base_b', []),
            ],
            titans: [{
                uid: 't-rainboroc-borrowed-setaside',
                defId: 'itty_critters_rainboroc',
                faction: 'itty_critters',
                ownerId: '1',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 12,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('itty_critters_rainboroc');
        expect(queued?.payload?.triggers?.[0]?.sourceCardUid).toBe('t-rainboroc-borrowed-setaside');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            12,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_itty_critters_rainboroc_play_replacement');
        expect(prompt?.data?.continuationContext?.titanUid).toBe('t-rainboroc-borrowed-setaside');
        expect(prompt?.data?.continuationContext?.scoringBaseIndex).toBe(0);
    });

    it('queued onMinionPlayed trigger 手工回放第二只 itty_critters_rainboroc source 时，不应回退到基地扫描顺序里的第一只 titan', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 42,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_the_nexus',
                minions: [makeMinion('rain-played-minion', 'robot_microbot_alpha', '0', 2)],
            })],
            titans: [
                {
                    uid: 'rainboroc-a',
                    defId: 'itty_critters_rainboroc',
                    faction: 'itty_critters',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'rainboroc-b',
                    defId: 'itty_critters_rainboroc',
                    faction: 'itty_critters',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as any,
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-rainboroc-b',
            timing: 'onMinionPlayed',
            sourceDefId: 'itty_critters_rainboroc',
            sourceCardUid: 'rainboroc-b',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'rain-played-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            42,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 'rainboroc-b',
                amount: 1,
                reason: 'itty_critters_rainboroc',
            }),
        }));
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'rainboroc-a')?.powerCounters).toBe(0);
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'rainboroc-b')?.powerCounters).toBe(1);
    });

    it('queued onDeckInspected trigger 手工回放第二只 super_spies_moon_zero_three source 时，不应回退到扫描顺序里的第一只 titan', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 5,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', []),
                makeBase('base_b', []),
            ],
            titans: [
                {
                    uid: 'moon-zero-a',
                    defId: 'super_spies_moon_zero_three',
                    faction: 'super_spies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'moon-zero-b',
                    defId: 'super_spies_moon_zero_three',
                    faction: 'super_spies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 2 },
                } as any,
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-moon-zero-three-b',
            timing: 'onDeckInspected',
            sourceDefId: 'super_spies_moon_zero_three',
            sourceCardUid: 'moon-zero-b',
            sourceControllerId: '0',
            sourceBaseIndex: 1,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            inspectionCards: [{ uid: 'inspected-card-a', defId: 'time_travelers_jumper' }],
            inspectionZone: 'deck',
            inspectionTargetPlayerIds: ['1'],
            inspectionCausePlayerId: '0',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            52,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 'moon-zero-b',
                amount: 1,
                reason: 'super_spies_moon_zero_three_on_deck_inspected',
            }),
        }));
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'moon-zero-a')?.powerCounters).toBe(0);
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'moon-zero-b')?.powerCounters).toBe(1);
        expect(resolved?.state.core.moonZeroThreeTriggeredTurnByTitan?.['moon-zero-a']).toBeUndefined();
        expect(resolved?.state.core.moonZeroThreeTriggeredTurnByTitan?.['moon-zero-b']).toBe(5);
    });

    it('queued onTurnEnd trigger 手工回放第二只 explorers_very_large_boulder source 时，不应回退到扫描顺序里的第一只 titan', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 17,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', []),
                makeBase('base_b', []),
            ],
            titans: [
                {
                    uid: 'boulder-a',
                    defId: 'explorers_very_large_boulder',
                    faction: 'explorers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'boulder-b',
                    defId: 'explorers_very_large_boulder',
                    faction: 'explorers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 2 },
                } as any,
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-very-large-boulder-b',
            timing: 'onTurnEnd',
            sourceDefId: 'explorers_very_large_boulder',
            sourceCardUid: 'boulder-b',
            sourceControllerId: '0',
            sourceBaseIndex: 1,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            71,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 'boulder-b',
                amount: 1,
                reason: 'explorers_very_large_boulder',
            }),
        }));
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'boulder-a')?.powerCounters).toBe(0);
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'boulder-b')?.powerCounters).toBe(1);
    });

    it('queued onMinionAffected trigger 手工回放第二只 frankenstein_the_bride source 时，不应回退到扫描顺序里的第一只 titan', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 5,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('bride-draw-a', 'frankenstein_igor', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_factory', [
                makeMinion('bride-counter-target', 'frankenstein_lab_assistant', '0', 2),
            ])],
            titans: [
                {
                    uid: 'bride-a',
                    defId: 'frankenstein_the_bride',
                    faction: 'frankenstein',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'bride-b',
                    defId: 'frankenstein_the_bride',
                    faction: 'frankenstein',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as any,
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-bride-b',
            timing: 'onMinionAffected',
            sourceDefId: 'frankenstein_the_bride',
            sourceCardUid: 'bride-b',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'bride-counter-target',
            triggerMinionDefId: 'frankenstein_lab_assistant',
            lkiMinion: {
                uid: 'bride-counter-target',
                defId: 'frankenstein_lab_assistant',
                owner: '0',
                controller: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
            } as any,
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            reason: 'test_bride_second_source',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }, 'playCards', '1'),
            defaultTestRandom,
            43,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_METADATA_UPDATED,
            payload: expect.objectContaining({
                titanUid: 'bride-b',
                reason: 'frankenstein_the_bride_ongoing',
                metadataUpdate: expect.objectContaining({
                    theBrideTriggeredTurn: 5,
                }),
            }),
        }));
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                cardUids: ['bride-draw-a'],
            }),
        }));
    });

    it('queued beforeScoring live trigger 在 borrowed mega_troopers_megabot 上仍应把移动 prompt 交给当前控制者，并保留 scoring continuation context', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('score-opp-1', 'test_other', '1', 5),
                        makeMinion('score-ally-1', 'test_other', '0', 2),
                    ],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('home-ally-1', 'test_other', '0', 3)],
                }),
            ],
            titans: [{
                uid: 't-megabot-borrowed-live',
                defId: 'mega_troopers_megabot',
                faction: 'mega_troopers',
                ownerId: '1',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            sourceBaseIndex: 0,
            sourceControllerId: '1',
            random: defaultTestRandom,
            now: 13,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('mega_troopers_megabot');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('1');
        expect(queued?.payload?.triggers?.[0]?.sourceCardUid).toBe('t-megabot-borrowed-live');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceOwnerPlayerId).toBe('1');
        expect(queued?.payload?.triggers?.[0]?.sourceBaseIndex).toBe(1);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            13,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_mega_troopers_megabot_move');
        expect(prompt?.data?.continuationContext?.titanUid).toBe('t-megabot-borrowed-live');
        expect(prompt?.data?.continuationContext?.fromBaseIndex).toBe(1);
        expect(prompt?.data?.continuationContext?.scoringBaseIndex).toBe(0);
        expect(prompt?.data?.continuationContext?.scoringBaseDefId).toBe('base_a');

        const responded = runCommand(
            resolved?.state ?? makeMatchState(core),
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: 'move' },
            } as any,
            defaultTestRandom,
        );

        const moved = responded.events.find(event => event.type === SU_EVENTS.TITAN_MOVED) as any;
        expect(moved?.payload).toMatchObject({
            titanUid: 't-megabot-borrowed-live',
            fromBaseIndex: 1,
            toBaseIndex: 0,
        });
        expect(responded.finalState.core.titans?.find(titan => titan.uid === 't-megabot-borrowed-live')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('postProcessSystemEvents 处理 borrowed killer_kudzu 的 TITAN_REMOVED_FROM_PLAY 时，explicit fallback queued trigger 也应保留真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-a', 'sharks_mako', 'minion', '0')],
                    discard: [makeCard('recycle-a', 'killer_plant_sprout', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
            titans: [{
                uid: 'borrowed-kudzu',
                defId: 'killer_plants_killer_kudzu',
                faction: 'killer_plants',
                ownerId: '1',
                controllerId: '0',
                powerCounters: 3,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
            } as any],
        });

        const removedEvent = {
            type: SU_EVENTS.TITAN_REMOVED_FROM_PLAY,
            payload: {
                titanUid: 'borrowed-kudzu',
                defId: 'killer_plants_killer_kudzu',
                ownerId: '1',
                controllerId: '0',
                fromBaseIndex: 0,
                reason: 'test_borrowed_kudzu_removed_explicit_fallback_owner',
            },
            timestamp: 16,
        } as const;

        const result = postProcessSystemEvents(core, [removedEvent], defaultTestRandom, makeMatchState(core, 'playCards', '0'));
        const queued = result.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();

        const kudzuTrigger = queued.payload.triggers.find((trigger: any) => trigger.sourceDefId === 'killer_plants_killer_kudzu');
        expect(kudzuTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'borrowed-kudzu',
            sourceControllerId: '0',
            sourceOwnerPlayerId: '1',
            ownerPlayerId: '0',
            eventPlayerId: '0',
        }));

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...(result.matchState?.core ?? core),
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '0'),
            defaultTestRandom,
            16,
        );
        const reactionPrompt = getInteractionsFromMS(prompted?.state ?? result.matchState ?? makeMatchState(core, 'playCards', '0'))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const triggerOption = reactionPrompt?.data?.options?.find((option: any) => option.value?.triggerId === kudzuTrigger.id);
        expect(triggerOption).toBeDefined();

        const chosen = runCommand(
            prompted!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: triggerOption.id },
            } as any,
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_killer_plants_killer_kudzu_removed');
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 cyborg_apes_flying_monkey 的选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host-1', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'flying-1', defId: 'cyborg_apes_flying_monkey', ownerId: '0' }],
                    }),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'flying-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 9,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('cyborg_apes_flying_monkey');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            9,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');
    });

    it('queued afterScoring per-instance trigger 处理第二张 borrowed cyborg_apes_flying_monkey 时，不应回退到同基地第一张飞猴 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host-1', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'flying-1', defId: 'cyborg_apes_flying_monkey', ownerId: '0' }],
                    }),
                    makeMinion('host-2', 'robot_microbot_alpha', '1', 2, {
                        attachedActions: [{ uid: 'flying-2', defId: 'cyborg_apes_flying_monkey', ownerId: '0', metadata: { sourceControllerId: '0' } } as any],
                    }),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-flying-monkey-borrowed-second',
            timing: 'afterScoring',
            sourceDefId: 'cyborg_apes_flying_monkey',
            sourceCardUid: 'flying-2',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            911,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');
        expect(prompt?.data?.allowedFlyingMonkeyMoves).toEqual([
            expect.objectContaining({
                minionUid: 'host-2',
                actionUid: 'flying-2',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'cyborg_apes_flying_monkey',
            }),
        ]);
    });

    it('queued afterScoring per-instance trigger 在对手计分时仍应把 shapeshifters_cellular_bonding 的飞猴选择权交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host-1', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'bond-1', defId: 'shapeshifters_cellular_bonding', ownerId: '0' }],
                        metadata: {
                            cellularBondingCardUid: 'bond-1',
                            cellularBondingCopiedActionDefId: 'cyborg_apes_flying_monkey',
                        } as any,
                    }),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'bond-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 10,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('shapeshifters_cellular_bonding');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            10,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');
    });

    it('queued afterScoring per-instance trigger 在 borrowed shapeshifters_cellular_bonding 复制飞猴时，仍应把选择权交给当前控制者而不是真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host-borrowed', 'sharks_mako', '1', 2, {
                        attachedActions: [{
                            uid: 'bond-borrowed',
                            defId: 'shapeshifters_cellular_bonding',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                        metadata: {
                            cellularBondingCardUid: 'bond-borrowed',
                            cellularBondingCopiedActionDefId: 'cyborg_apes_flying_monkey',
                        } as any,
                    }),
                    makeMinion('opp-1', 'test_other', '1', 2),
                ]),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 0, vp: 0 }],
            sourceCardUid: 'bond-borrowed',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 10.1,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'shapeshifters_cellular_bonding',
            sourceCardUid: 'bond-borrowed',
            ownerPlayerId: '0',
            sourceControllerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            10.1,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');
        expect(prompt?.data?.allowedFlyingMonkeyMoves).toEqual([
            expect.objectContaining({
                minionUid: 'host-borrowed',
                actionUid: 'bond-borrowed',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'shapeshifters_cellular_bonding_flying_monkey',
            }),
        ]);
    });

    it('queued onCardReturnedToHand per-instance trigger 在对手回手宿主时仍应把 world_champs_bewitched 的转移权交给行动拥有者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host-1', 'robot_microbot_alpha', '1', 2, {
                        attachedActions: [{ uid: 'bewitched-card', defId: 'world_champs_bewitched', ownerId: '0' }],
                    }),
                    makeMinion('target-1', 'robot_microbot_beta', '1', 3),
                ]),
            ],
        });

        const hostLki = makeMinion('host-1', 'robot_microbot_alpha', '1', 2, {
            attachedActions: [{ uid: 'bewitched-card', defId: 'world_champs_bewitched', ownerId: '0' }],
        });

        const queued = collectTriggers(core, 'onCardReturnedToHand', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'robot_microbot_alpha',
            triggerMinion: hostLki,
            sourceCardUid: 'bewitched-card',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            reason: 'test_return_to_hand',
            random: defaultTestRandom,
            now: 11,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('world_champs_bewitched');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            11,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('world_champs_bewitched_transfer');
    });

    it('queued onMinionDiscardedFromBase trigger 若 sourceCardUid 不在 attached-action LKI 实例快照里，不应把 samurai_final_haiku 的 sibling 伪装成当前 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 2),
                    makeMinion('ally-2', 'robot_microbot_beta', '0', 3),
                ]),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-final-haiku-missing-instance',
            timing: 'onMinionDiscardedFromBase',
            sourceDefId: 'samurai_final_haiku',
            sourceCardUid: 'haiku-missing',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'samurai_samurai',
            lkiMinion: {
                uid: 'host-1',
                defId: 'samurai_samurai',
                owner: '1',
                controller: '1',
                baseIndex: 0,
                basePower: 4,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                attachedActionDefIds: ['samurai_final_haiku', 'samurai_final_haiku'],
                attachedActions: [
                    { uid: 'haiku-a', defId: 'samurai_final_haiku', ownerId: '0' },
                    { uid: 'haiku-b', defId: 'samurai_final_haiku', ownerId: '0' },
                ],
            } as any,
            reason: 'test_final_haiku_missing_lki_instance',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }, 'playCards', '1'),
            defaultTestRandom,
            11.5,
        );

        const haikuEvents = (resolved?.events ?? []).filter((event: any) =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && event.payload?.reason === 'samurai_final_haiku',
        );
        expect(haikuEvents).toHaveLength(0);
        expect(resolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'ally-1')?.tempPowerModifier ?? 0).toBe(0);
        expect(resolved?.state.core.bases[0]?.minions.find(minion => minion.uid === 'ally-2')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('processDestroyTriggers 产出的 borrowed time_travelers_jumper queued onMinionDiscardedFromBase trigger 也应保留真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('borrowed-jumper', 'time_travelers_jumper', '0', 2, { owner: '1' }),
                ]),
            ],
        });

        const processed = processDestroyTriggers([{
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'borrowed-jumper',
                minionDefId: 'time_travelers_jumper',
                fromBaseIndex: 0,
                ownerId: '1',
                destroyerId: '0',
                reason: 'test_borrowed_jumper_discard_owner_fallback',
            },
            timestamp: 17,
        } as any], makeMatchState(core, 'playCards', '0'), '0', defaultTestRandom, 17);

        const queued = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();

        const jumperTrigger = queued.payload.triggers.find((trigger: any) => trigger.sourceDefId === 'time_travelers_jumper');
        expect(jumperTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'borrowed-jumper',
            sourceControllerId: '0',
            sourceOwnerPlayerId: '1',
            ownerPlayerId: '0',
            eventPlayerId: '0',
        }));

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...processed.matchState!.core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '0'),
            defaultTestRandom,
            17,
        );
        const reactionPrompt = getInteractionsFromMS(prompted?.state ?? processed.matchState!)[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const triggerOption = reactionPrompt?.data?.options?.find((option: any) => option.value?.triggerId === jumperTrigger.id);
        expect(triggerOption).toBeDefined();

        const accepted = runCommand(
            prompted!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: triggerOption.id },
            } as any,
            defaultTestRandom,
        );
        expect(accepted.finalState.core.players['1']?.hand.map((card: any) => card.uid)).toContain('borrowed-jumper');
        expect(accepted.finalState.core.players['1']?.discard.map((card: any) => card.uid)).not.toContain('borrowed-jumper');
    });

    it('MINION_RETURNED 真链回手宿主时也应把 world_champs_bewitched attached source 入队', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host-1', 'robot_microbot_alpha', '1', 2, {
                        attachedActions: [{ uid: 'bewitched-card', defId: 'world_champs_bewitched', ownerId: '0' }],
                    }),
                    makeMinion('target-1', 'robot_microbot_beta', '1', 3),
                ]),
            ],
        });

        const processed = processReturnToHandTriggers([{
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'host-1',
                minionDefId: 'robot_microbot_alpha',
                fromBaseIndex: 0,
                toPlayerId: '1',
                reason: 'test_minion_returned_host',
            },
            timestamp: 12,
        } as any], makeMatchState(core, 'playCards', '1'), '1', defaultTestRandom, 12);

        const queued = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        const bewitchedTrigger = queued.payload.triggers.find((trigger: any) => trigger.sourceDefId === 'world_champs_bewitched');
        expect(bewitchedTrigger).toBeDefined();
        expect(bewitchedTrigger.sourceCardUid).toBe('bewitched-card');
        expect(bewitchedTrigger.ownerPlayerId).toBe('0');
        expect(bewitchedTrigger.eventPlayerId).toBe('1');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...processed.matchState!.core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            12,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? processed.matchState!)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('world_champs_bewitched_transfer');
    });

    it('borrowed world_champs_bewitched 在宿主回手后的 queued runtime resolve 中仍应保留真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host-1', 'robot_microbot_alpha', '1', 2, {
                        attachedActions: [{
                            uid: 'bewitched-card',
                            defId: 'world_champs_bewitched',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                    }),
                    makeMinion('target-1', 'robot_microbot_beta', '1', 3),
                    makeMinion('target-2', 'robot_microbot_gamma', '0', 2),
                ]),
            ],
        });

        const processed = processReturnToHandTriggers([{
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'host-1',
                minionDefId: 'robot_microbot_alpha',
                fromBaseIndex: 0,
                toPlayerId: '1',
                reason: 'test_borrowed_bewitched_host_returned',
            },
            timestamp: 13,
        } as any], makeMatchState(core, 'playCards', '1'), '1', defaultTestRandom, 13);

        const queued = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        const bewitchedTrigger = queued.payload.triggers.find((trigger: any) => trigger.sourceDefId === 'world_champs_bewitched');
        expect(bewitchedTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'bewitched-card',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            sourceControllerId: '0',
        }));

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...processed.matchState!.core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            13,
        );
        const prompt = getInteractionsFromMS(prompted?.state ?? processed.matchState!)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('world_champs_bewitched_transfer');
        const option = prompt?.data?.options?.find((entry: any) => entry.value?.minionUid === 'target-2');
        expect(option).toBeDefined();

        const resolved = runCommand(
            prompted!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: option.id },
            } as any,
            defaultTestRandom,
        );

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'bewitched-card',
                defId: 'world_champs_bewitched',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'target-2',
                removeFromDiscard: true,
            }),
        }));
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target-2')?.attachedActions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    uid: 'bewitched-card',
                    defId: 'world_champs_bewitched',
                    ownerId: '1',
                    metadata: expect.objectContaining({ sourceControllerId: '0' }),
                }),
            ]),
        );
        expect(resolved.finalState.core.players['1']?.discard.map((card: any) => card.uid) ?? []).not.toContain('bewitched-card');
    });

    it('processReturnToHandTriggers 产出的 borrowed world_champs_bewitched queued trigger 即使后续只剩 attachedActionDefIds fallback，也应保留真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host-1', 'robot_microbot_alpha', '1', 2, {
                        attachedActions: [{
                            uid: 'bewitched-card',
                            defId: 'world_champs_bewitched',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                    }),
                    makeMinion('target-1', 'robot_microbot_beta', '1', 3),
                    makeMinion('target-2', 'robot_microbot_gamma', '0', 2),
                ]),
            ],
        });

        const processed = processReturnToHandTriggers([{
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'host-1',
                minionDefId: 'robot_microbot_alpha',
                fromBaseIndex: 0,
                toPlayerId: '1',
                reason: 'test_borrowed_bewitched_explicit_fallback_owner',
            },
            timestamp: 15,
        } as any], makeMatchState(core, 'playCards', '1'), '1', defaultTestRandom, 15);

        const queued = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        const bewitchedTrigger = queued.payload.triggers.find((trigger: any) => trigger.sourceDefId === 'world_champs_bewitched');
        expect(bewitchedTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'bewitched-card',
            sourceControllerId: '0',
            sourceOwnerPlayerId: '1',
            ownerPlayerId: '0',
            eventPlayerId: '1',
        }));

        const replayOnlyTrigger = {
            ...bewitchedTrigger,
            lkiMinion: {
                ...bewitchedTrigger.lkiMinion,
                attachedActions: undefined,
                attachedActionDefIds: ['world_champs_bewitched'],
            },
        };

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...processed.matchState!.core,
                triggerQueue: [replayOnlyTrigger],
            }, 'playCards', '1'),
            defaultTestRandom,
            15,
        );

        const prompt = getInteractionsFromMS(prompted?.state ?? processed.matchState!)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('world_champs_bewitched_transfer');
        const option = prompt?.data?.options?.find((entry: any) => entry.value?.minionUid === 'target-2');
        expect(option).toBeDefined();

        const resolved = runCommand(
            prompted!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: option.id },
            } as any,
            defaultTestRandom,
        );

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'bewitched-card',
                defId: 'world_champs_bewitched',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'target-2',
                removeFromDiscard: true,
            }),
        }));
    });

    it('manual queued borrowed world_champs_bewitched 若只剩 attachedActionDefIds fallback，也应保留真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('target-1', 'robot_microbot_beta', '1', 3),
                    makeMinion('target-2', 'robot_microbot_gamma', '0', 2),
                ]),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'manual-borrowed-bewitched-fallback-owner',
            timing: 'onCardReturnedToHand',
            sourceDefId: 'world_champs_bewitched',
            sourceCardUid: 'bewitched-card',
            sourceControllerId: '0',
            sourceOwnerPlayerId: '1',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'robot_microbot_alpha',
            lkiMinion: {
                uid: 'host-1',
                defId: 'robot_microbot_alpha',
                owner: '1',
                controller: '1',
                baseIndex: 0,
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                attachedActionDefIds: ['world_champs_bewitched'],
            } as any,
            reason: 'manual_borrowed_bewitched_fallback_owner',
        };

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [trigger],
            }, 'playCards', '1'),
            defaultTestRandom,
            14,
        );

        const prompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('world_champs_bewitched_transfer');
        const option = prompt?.data?.options?.find((entry: any) => entry.value?.minionUid === 'target-2');
        expect(option).toBeDefined();

        const resolved = runCommand(
            prompted!.state,
            {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: '0',
                payload: { optionId: option.id },
            } as any,
            defaultTestRandom,
        );

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'bewitched-card',
                defId: 'world_champs_bewitched',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'target-2',
                removeFromDiscard: true,
            }),
        }));
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target-2')?.attachedActions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    uid: 'bewitched-card',
                    defId: 'world_champs_bewitched',
                    ownerId: '1',
                    metadata: expect.objectContaining({ sourceControllerId: '0' }),
                }),
            ]),
        );
    });
});
