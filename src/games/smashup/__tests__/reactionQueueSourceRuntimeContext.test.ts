import { beforeEach, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { clearRegistry } from '../domain/abilityRegistry';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { reduce } from '../domain/reduce';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { defaultTestRandom, runCommand } from './testRunner';
import { getInteractionsFromMS, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';
import { clearOngoingEffectRegistry, collectTriggers } from '../domain/ongoingEffects';
import { processReturnToHandTriggers } from '../domain/reducer';
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

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-overrun-a',
                defId: 'zombie_overrun',
                ownerId: '1',
                reason: 'zombie_overrun_self_destruct',
            }),
        }));
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-overrun-b',
                defId: 'zombie_overrun',
                ownerId: '1',
                reason: 'zombie_overrun_self_destruct',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.ongoingActions ?? []).map((action: any) => action.uid)).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid) ?? []).not.toEqual(
            expect.arrayContaining(['borrowed-overrun-a', 'borrowed-overrun-b']),
        );
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toEqual(
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

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-entangled-a',
                defId: 'killer_plant_entangled',
                ownerId: '1',
                reason: 'killer_plant_entangled_self_destruct',
            }),
        }));
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-entangled-b',
                defId: 'killer_plant_entangled',
                ownerId: '1',
                reason: 'killer_plant_entangled_self_destruct',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.ongoingActions ?? []).map((action: any) => action.uid)).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid) ?? []).not.toEqual(
            expect.arrayContaining(['borrowed-entangled-a', 'borrowed-entangled-b']),
        );
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toEqual(
            expect.arrayContaining(['borrowed-entangled-a', 'borrowed-entangled-b']),
        );
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

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            51,
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
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'ritual-a',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                reason: 'cthulhu_complete_the_ritual',
            }),
        }));
        expect(firstResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'ritual-b',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '1',
                reason: 'cthulhu_complete_the_ritual',
            }),
        }));
        expect(firstResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BASE_REPLACED,
            payload: expect.objectContaining({
                baseIndex: 0,
                oldBaseDefId: 'base_portal_room',
                newBaseDefId: 'base_the_nexus',
            }),
        }));
        expect(firstResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BASE_REPLACED,
            payload: expect.objectContaining({
                baseIndex: 1,
                oldBaseDefId: 'base_faceless_city',
                newBaseDefId: 'base_monkey_lab',
            }),
        }));
        expect(getInteractionsFromMS(firstResolved.finalState)).toHaveLength(0);
        expect(firstResolved.finalState.core.bases[0]?.defId).toBe('base_the_nexus');
        expect(firstResolved.finalState.core.bases[1]?.defId).toBe('base_monkey_lab');
        expect(firstResolved.finalState.core.bases[0]?.minions ?? []).toEqual([]);
        expect(firstResolved.finalState.core.bases[1]?.minions ?? []).toEqual([]);
        expect(firstResolved.finalState.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect(firstResolved.finalState.core.bases[1]?.ongoingActions ?? []).toEqual([]);
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
});
