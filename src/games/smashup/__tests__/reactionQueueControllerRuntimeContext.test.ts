import { makeMinionDestroyedEvent } from './helpers';
import { SU_EVENTS } from '../domain/types';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { clearOngoingEffectRegistry, collectTriggers, registerTrigger } from '../domain/ongoingEffects';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { processDestroyTriggers } from '../domain/reducer';
import { registerKillerPlantAbilities } from '../abilities/killer_plants';
import { registerSamuraiAbilities } from '../abilities/samurai';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { defaultTestRandom, runCommand } from './testRunner';
import { getInteractionsFromMS, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';

describe('reaction queue: preserves controller runtime context', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearOngoingEffectRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
    });

    it('queued onMinionDestroyed ongoing trigger 的 canTrigger 与 executor 都应继续拿到 controllerId', () => {
        registerTrigger('test_controller_runtime', 'onMinionDestroyed', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `controller:${ctx.controllerId ?? 'missing-controller'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            canTrigger: (ctx) => (
                ctx.controllerId === '1'
                && ctx.destroyerId === '0'
                && ctx.reason === 'queued_controller_runtime'
                && ctx.triggerMinionUid === 'victim-1'
            ),
        });

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
                        makeMinion('source-1', 'test_controller_runtime', '0', 3),
                        makeMinion('victim-1', 'victim_card', '1', 2),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const matchState = makeMatchState(core);
        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'victim-1',
            triggerMinionDefId: 'victim_card',
            triggerMinion: core.bases[0].minions[1],
            controllerId: '1',
            destroyerId: '0',
            reason: 'queued_controller_runtime',
            random: defaultTestRandom as any,
            now: 1,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers[0];
        expect(trigger.controllerId).toBe('1');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: (queued as any).payload.triggers,
            }),
            defaultTestRandom,
            1,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'controller:1',
            }),
        }));
    });

    it('processDestroyTriggers 在 borrowed 随从被消灭时，queued onMinionDestroyed trigger 仍应把 playerId 视为当前 controller', () => {
        registerTrigger('test_destroy_runtime_player', 'onMinionDestroyed', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `destroy-runtime:${ctx.playerId}:${ctx.controllerId ?? 'missing-controller'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            canTrigger: (ctx) => (
                ctx.playerId === '0'
                && ctx.controllerId === '0'
                && ctx.destroyerId === '1'
                && ctx.reason === 'process_destroy_runtime'
                && ctx.triggerMinionUid === 'victim-borrowed'
            ),
        });

        const borrowedVictim = makeMinion('victim-borrowed', 'victim_card', '0', 2, { owner: '1' });
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
                        makeMinion('source-destroy-1', 'test_destroy_runtime_player', '0', 3),
                        borrowedVictim,
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const destroyed = processDestroyTriggers([makeMinionDestroyedEvent({
            minionUid: 'victim-borrowed',
                minionDefId: 'victim_card',
                fromBaseIndex: 0,
                ownerId: '1',
                controllerId: '0',
                destroyerId: '1',
            reason: 'process_destroy_runtime',
            timestamp: 11,
        }) as any], makeMatchState(core), '1', defaultTestRandom, 11);

        const queuedEvent = destroyed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        const queuedTrigger = queuedEvent?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'test_destroy_runtime_player');
        expect(queuedTrigger).toBeDefined();
        expect([queuedTrigger?.eventPlayerId, queuedTrigger?.controllerId, queuedTrigger?.sourceControllerId]).toEqual([
            '0',
            '0',
            '0',
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: queuedEvent.payload.triggers,
            }),
            defaultTestRandom,
            11,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'destroy-runtime:0:0',
            }),
        }));
    });

    it('queued onDuelResolved ongoing trigger 的 canTrigger 与 executor 都应继续拿到 duel 上下文', () => {
        registerTrigger('test_duel_runtime', 'onDuelResolved', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `duel:${ctx.duelSourceId ?? 'missing-source'}:${ctx.duelOutcome ?? 'missing-outcome'}:${ctx.duelWinner?.uid ?? 'missing-winner'}:${ctx.duelLoser?.uid ?? 'missing-loser'}:${ctx.duelTie === true ? '1' : '0'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            canTrigger: (ctx) => (
                ctx.duelSourceId === 'duel_source'
                && ctx.duelOutcome === 'vp_to_winner'
                && ctx.duelChallenger?.uid === 'challenger-1'
                && ctx.duelChallenged?.uid === 'challenged-1'
                && ctx.duelWinner?.uid === 'challenger-1'
                && ctx.duelLoser?.uid === 'challenged-1'
                && ctx.duelTie === false
            ),
        });

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
                        makeMinion('source-1', 'test_duel_runtime', '0', 3),
                        makeMinion('challenger-1', 'challenger_card', '0', 4),
                        makeMinion('challenged-1', 'challenged_card', '1', 2),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const challenger = core.bases[0].minions[1];
        const challenged = core.bases[0].minions[2];
        const matchState = makeMatchState(core);
        const queued = collectTriggers(core, 'onDuelResolved', {
            state: core,
            matchState,
            playerId: '0',
            baseIndex: 0,
            duel: {
                id: 'duel-1',
                baseIndex: 0,
                sourceId: 'duel_source',
                sourcePlayerId: '0',
                challengerPlayerId: '0',
                challengerMinionUid: 'challenger-1',
                challengedPlayerId: '1',
                challengedMinionUid: 'challenged-1',
                outcome: 'vp_to_winner',
            },
            duelSourceId: 'duel_source',
            duelOutcome: 'vp_to_winner',
            duelChallenger: challenger,
            duelChallenged: challenged,
            duelWinner: challenger,
            duelLoser: challenged,
            duelTie: false,
            random: defaultTestRandom as any,
            now: 1,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers[0];
        expect(trigger.duelSourceId).toBe('duel_source');
        expect(trigger.duelWinner?.uid).toBe('challenger-1');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: (queued as any).payload.triggers,
            }),
            defaultTestRandom,
            1,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'duel:duel_source:vp_to_winner:challenger-1:challenged-1:0',
            }),
        }));
    });

    it('queued onMinionDiscardedFromBase 真链仍应把 Bushi 的 triggerMinionPower 传到 executor', () => {
        registerSamuraiAbilities();

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
                        makeMinion('samurai-bushi-a', 'samurai_bushi', '1', 4, { powerCounters: 1 }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'samurai-bushi-a',
            triggerMinionDefId: 'samurai_bushi',
            triggerMinion: core.bases[0].minions[0],
            triggerMinionPower: 5,
            random: defaultTestRandom as any,
            now: 20,
        }) as any;

        expect(queued).toBeDefined();
        const bushiTrigger = (queued?.payload?.triggers ?? []).find((trigger: any) =>
            trigger.sourceDefId === 'samurai_bushi');
        expect(bushiTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'samurai-bushi-a',
            sourceControllerId: '1',
            triggerMinionPower: 5,
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            20,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({
                playerId: '1',
                amount: 1,
                reason: 'samurai_bushi',
            }),
        }));
    });

    it('queued onTurnStart 双 Sprout 共享唯一候选时，仍不应重复打出同一张 deck UID', () => {
        registerKillerPlantAbilities();

        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('wl-1', 'killer_plant_water_lily', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('sp-1', 'killer_plant_sprout', '0', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [
                        makeMinion('sp-2', 'killer_plant_sprout', '0', 2),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom as any,
            now: 1000,
        }) as any;

        expect(queued).toBeDefined();
        expect(queued?.payload?.triggers).toHaveLength(2);

        let state = makeMatchState({
            ...(core as any),
            triggerQueue: queued.payload.triggers,
        });
        const allEvents: any[] = [];
        for (let step = 0; step < 8; step += 1) {
            const prompt = state.sys.interaction.current as any;
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const chosen = (prompt.data.options ?? []).find((option: any) => option?.value?.kind === 'trigger');
                expect(chosen).toBeDefined();
                const responded = runCommand(
                    state,
                    {
                        type: 'SYS_INTERACTION_RESPOND',
                        playerId: prompt.playerId,
                        payload: { optionId: chosen.id },
                    } as any,
                    defaultTestRandom,
                );
                allEvents.push(...responded.events);
                state = responded.finalState;
                continue;
            }
            if (prompt?.data?.sourceId === 'killer_plant_sprout_search') {
                const chosen = (prompt.data.options ?? []).find((option: any) => option?.value?.cardUid === 'wl-1')
                    ?? (prompt.data.options ?? []).find((option: any) => option?.id === 'skip');
                expect(chosen).toBeDefined();
                const responded = runCommand(
                    state,
                    {
                        type: 'SYS_INTERACTION_RESPOND',
                        playerId: prompt.playerId,
                        payload: { optionId: chosen.id },
                    } as any,
                    defaultTestRandom,
                );
                allEvents.push(...responded.events);
                state = responded.finalState;
                continue;
            }
            const advanced = maybeResolveReactionQueue(state, defaultTestRandom, 1000 + step);
            if (!advanced) break;
            allEvents.push(...advanced.events);
            state = advanced.state;
            if ((state.core.triggerQueue ?? []).length === 0 && !state.sys.interaction.current) {
                break;
            }
        }

        const playedEvents = allEvents.filter((event) => event.type === SU_EVENTS.MINION_PLAYED) as any[];
        const destroyedEvents = allEvents.filter((event) => event.type === SU_EVENTS.MINION_DESTROYED) as any[];
        expect(playedEvents).toHaveLength(1);
        expect(playedEvents[0].payload.cardUid).toBe('wl-1');
        expect(destroyedEvents).toHaveLength(2);
        expect(state.core.players['0'].deck).toHaveLength(0);
    });

    it('queued afterScoring trigger 真链仍应把 triggerBaseControllersAtTrigger 传到 Kraken executor', () => {
        initAllAbilities();

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
                        makeMinion('live-only-p0', 'robot_microbot_alpha', '0', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'kraken-setaside-1',
                defId: 'pirates_the_kraken',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const trigger = {
            id: 'queued-kraken-runtime',
            timing: 'afterScoring',
            sourceDefId: 'pirates_the_kraken',
            sourceCardUid: 'kraken-setaside-1',
            sourceControllerId: '1',
            mandatory: false,
            resolutionClass: 'optional',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            witnessRequirement: 'zoneCardAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerBaseControllersAtTrigger: ['1'],
        } as any;

        let state = makeMatchState({
            ...(core as any),
            triggerQueue: [trigger],
        });

        const firstAdvance = maybeResolveReactionQueue(state, defaultTestRandom, 3000);
        expect(firstAdvance).toBeDefined();
        state = firstAdvance!.state;

        const choosePrompt = getInteractionsFromMS(state)[0] as any;
        expect(choosePrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const triggerOption = choosePrompt.data.options.find((entry: any) => entry.value?.kind === 'trigger');
        expect(triggerOption).toBeDefined();

        const chosen = runCommand(
            state,
            {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: choosePrompt.playerId,
                payload: { optionId: triggerOption.id },
            } as any,
            defaultTestRandom,
        );
        state = chosen.finalState;

        const prompt = getInteractionsFromMS(state)[0] as any;
        expect(prompt?.playerId).toBe('1');
        expect(prompt?.data?.sourceId).toBe('titan_pirates_the_kraken_play_replacement');
        expect(prompt?.data?.continuationContext?.titanUid).toBe('kraken-setaside-1');
    });

    it('queued afterScoring 真链不应让 triggerBaseControllersAtTrigger 快照被 live mutation 污染', () => {
        registerTrigger('test_base_controllers_runtime', 'afterScoring', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `controllers:${((ctx as any).triggerBaseControllersAtTrigger ?? []).join(',')}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            canTrigger: (ctx) => (
                ((ctx as any).triggerBaseControllersAtTrigger ?? []).join(',') === '0,1'
            ),
        });

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
                        makeMinion('source-1', 'test_base_controllers_runtime', '0', 3),
                        makeMinion('other-1', 'other_card', '1', 2),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const triggerBaseControllersAtTrigger = ['0', '1'] as any;
        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [
                { playerId: '0', power: 5, vp: 3 },
                { playerId: '1', power: 2, vp: 1 },
            ] as any,
            triggerBaseControllersAtTrigger,
            random: defaultTestRandom as any,
            now: 1,
        }) as any;

        expect(queued).toBeDefined();
        const trigger = queued.payload.triggers[0];
        expect(trigger.triggerBaseControllersAtTrigger).toEqual(['0', '1']);

        triggerBaseControllersAtTrigger[0] = '9';

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            1,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'controllers:0,1',
            }),
        }));
    });

    it('queued onMinionMoved 真链仍应把 moveFromBaseIndex/moveToBaseIndex 传到 Very Large Boulder executor', () => {
        initAllAbilities();

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
                        makeMinion('boulder-host', 'robot_microbot_alpha', '0', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [
                        makeMinion('moved-minion', 'robot_microbot_beta', '0', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'boulder-1',
                defId: 'explorers_very_large_boulder',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 2,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
            } as any],
        });

        const trigger = {
            id: 'queued-boulder-runtime',
            timing: 'onMinionMoved',
            sourceDefId: 'explorers_very_large_boulder',
            sourceCardUid: 'boulder-1',
            sourceControllerId: '1',
            sourceBaseIndex: 0,
            mandatory: false,
            resolutionClass: 'optional',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
        } as any;

        let state = makeMatchState({
            ...(core as any),
            triggerQueue: [trigger],
        });

        const firstAdvance = maybeResolveReactionQueue(state, defaultTestRandom, 4000);
        expect(firstAdvance).toBeDefined();
        state = firstAdvance!.state;

        const choosePrompt = getInteractionsFromMS(state)[0] as any;
        expect(choosePrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const triggerOption = choosePrompt.data.options.find((entry: any) => entry.value?.kind === 'trigger');
        expect(triggerOption).toBeDefined();

        const chosen = runCommand(
            state,
            {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: choosePrompt.playerId,
                payload: { optionId: triggerOption.id },
            } as any,
            defaultTestRandom,
        );
        state = chosen.finalState;

        const prompt = getInteractionsFromMS(state)[0] as any;
        expect(prompt?.playerId).toBe('1');
        expect(prompt?.data?.sourceId).toBe('titan_explorers_very_large_boulder_move');
        expect(prompt?.data?.continuationContext).toEqual(expect.objectContaining({
            titanUid: 'boulder-1',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            destroyThreshold: 2,
        }));
    });

    it('queued onMinionPlayed 真链仍应把 triggerMinion.metadata 传到 Returned One executor，而不是回头读 live metadata', () => {
        initAllAbilities();

        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: ['skeletons', 'robots'],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('returned-one', 'skeletons_returned_one', '0', 2, {
                            powerModifier: 0,
                            metadata: { playedFrom: 'buried' },
                        }),
                    ],
                    ongoingActions: [],
                    buriedCards: [
                        { uid: 'buried-followup', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' } as any,
                    ],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'returned-one',
            triggerMinionDefId: 'skeletons_returned_one',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom as any,
            now: 5000,
        }) as any;

        expect(queued).toBeDefined();
        const returnedOneTrigger = (queued?.payload?.triggers ?? []).find((trigger: any) =>
            trigger.sourceDefId === 'skeletons_returned_one');
        expect(returnedOneTrigger).toBeDefined();
        expect(returnedOneTrigger.lkiMinion?.metadata).toEqual({ playedFrom: 'buried' });

        const mutatedCore = {
            ...(core as any),
            bases: [{
                ...core.bases[0],
                minions: [{
                    ...core.bases[0].minions[0],
                    metadata: undefined,
                }],
            }],
            triggerQueue: queued.payload.triggers,
        };

        let state = makeMatchState(mutatedCore);
        const firstAdvance = maybeResolveReactionQueue(state, defaultTestRandom, 5000);
        expect(firstAdvance).toBeDefined();
        state = firstAdvance!.state;

        const reactionPrompt = getInteractionsFromMS(state)[0] as any;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const triggerOption = reactionPrompt.data.options.find((entry: any) => entry.value?.triggerId === returnedOneTrigger.id);
        expect(triggerOption).toBeDefined();

        const chosen = runCommand(
            state,
            {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: reactionPrompt.playerId,
                payload: { optionId: triggerOption.id },
            } as any,
            defaultTestRandom,
        );
        state = chosen.finalState;

        const prompt = getInteractionsFromMS(state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('skeletons_returned_one_uncover');
    });

    it('queued onMinionPlayed 真链不应让 triggerMinion.metadata 的嵌套对象被 live mutation 污染', () => {
        registerTrigger('test_nested_metadata_runtime', 'onMinionPlayed', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `nested:${((ctx.triggerMinion?.metadata as any)?.nested as any)?.flag ?? 'missing'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            mandatory: true,
            canTrigger: (ctx) => (((ctx.triggerMinion?.metadata as any)?.nested as any)?.flag === 'queued'),
        });

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
                        makeMinion('nested-minion', 'test_nested_metadata_runtime', '0', 3, {
                            metadata: { nested: { flag: 'queued' } },
                        }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'nested-minion',
            triggerMinionDefId: 'test_nested_metadata_runtime',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom as any,
            now: 6000,
        }) as any;

        expect(queued).toBeDefined();
        const nestedTrigger = (queued?.payload?.triggers ?? []).find((trigger: any) =>
            trigger.sourceDefId === 'test_nested_metadata_runtime');
        expect(nestedTrigger).toBeDefined();
        expect(nestedTrigger.lkiMinion?.metadata).toEqual({ nested: { flag: 'queued' } });

        ((core.bases[0].minions[0].metadata as any).nested as any).flag = 'mutated';

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            6000,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'nested:queued',
            }),
        }));
    });

    it('queued afterScoring 真链不应让 rankings 快照被 live mutation 污染', () => {
        registerTrigger('test_rankings_runtime', 'afterScoring', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `rankings:${ctx.rankings?.[0]?.playerId ?? 'missing'}:${ctx.rankings?.[0]?.power ?? 'missing'}:${ctx.rankings?.[0]?.vp ?? 'missing'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            mandatory: true,
            canTrigger: (ctx) => (
                ctx.rankings?.[0]?.playerId === '0'
                && ctx.rankings?.[0]?.power === 5
                && ctx.rankings?.[0]?.vp === 4
            ),
        });

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
                        makeMinion('rankings-source', 'test_rankings_runtime', '0', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const rankings = [
            { playerId: '0', power: 5, vp: 4 },
            { playerId: '1', power: 3, vp: 2 },
        ];

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: rankings as any,
            random: defaultTestRandom as any,
            now: 7000,
        }) as any;

        expect(queued).toBeDefined();
        const rankingsTrigger = (queued?.payload?.triggers ?? []).find((trigger: any) =>
            trigger.sourceDefId === 'test_rankings_runtime');
        expect(rankingsTrigger).toBeDefined();
        expect(rankingsTrigger.rankings).toEqual([
            { playerId: '0', power: 5, vp: 4 },
            { playerId: '1', power: 3, vp: 2 },
        ]);

        rankings[0].playerId = '1';
        rankings[0].power = 99;
        rankings[0].vp = 1;

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            7000,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'rankings:0:5:4',
            }),
        }));
    });

    it('queued onDeckInspected 真链不应让 inspectionCards 快照被 live mutation 污染', () => {
        registerTrigger('test_inspection_cards_runtime', 'onDeckInspected', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `inspect:${ctx.inspectionCards?.[0]?.uid ?? 'missing'}:${ctx.inspectionCards?.[0]?.defId ?? 'missing'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            mandatory: true,
            canTrigger: (ctx) => (
                ctx.inspectionCards?.[0]?.uid === 'peek-a'
                && ctx.inspectionCards?.[0]?.defId === 'card_a'
                && ctx.inspectionZone === 'deck'
                && ctx.inspectionCausePlayerId === '0'
            ),
        });

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
                        makeMinion('inspect-source', 'test_inspection_cards_runtime', '0', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const inspectionCards = [
            { uid: 'peek-a', defId: 'card_a' },
            { uid: 'peek-b', defId: 'card_b' },
        ];

        const queued = collectTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            inspectionCards: inspectionCards as any,
            inspectionZone: 'deck',
            inspectionCausePlayerId: '0',
            random: defaultTestRandom as any,
            now: 7100,
        }) as any;

        expect(queued).toBeDefined();
        const inspectionTrigger = (queued?.payload?.triggers ?? []).find((trigger: any) =>
            trigger.sourceDefId === 'test_inspection_cards_runtime');
        expect(inspectionTrigger).toBeDefined();
        expect(inspectionTrigger.inspectionCards).toEqual([
            { uid: 'peek-a', defId: 'card_a' },
            { uid: 'peek-b', defId: 'card_b' },
        ]);

        inspectionCards[0].uid = 'peek-mutated';
        inspectionCards[0].defId = 'card_mutated';

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            7100,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'inspect:peek-a:card_a',
            }),
        }));
    });

    it('queued onDeckInspected 真链不应让 inspectionTargetPlayerIds 快照被 live mutation 污染', () => {
        registerTrigger('test_inspection_targets_runtime', 'onDeckInspected', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `targets:${ctx.inspectionTargetPlayerIds?.join(',') ?? 'missing'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            mandatory: true,
            canTrigger: (ctx) => (
                (ctx.inspectionTargetPlayerIds ?? []).join(',') === '1,2'
                && ctx.inspectionZone === 'deck'
                && ctx.inspectionCausePlayerId === '0'
            ),
        });

        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            } as any,
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('inspect-target-source', 'test_inspection_targets_runtime', '0', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const inspectionTargetPlayerIds = ['1', '2'];

        const queued = collectTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            inspectionCards: [{ uid: 'peek-a', defId: 'card_a' }] as any,
            inspectionZone: 'deck',
            inspectionTargetPlayerIds: inspectionTargetPlayerIds as any,
            inspectionCausePlayerId: '0',
            random: defaultTestRandom as any,
            now: 7200,
        }) as any;

        expect(queued).toBeDefined();
        const targetTrigger = (queued?.payload?.triggers ?? []).find((trigger: any) =>
            trigger.sourceDefId === 'test_inspection_targets_runtime');
        expect(targetTrigger).toBeDefined();
        expect(targetTrigger.inspectionTargetPlayerIds).toEqual(['1', '2']);

        inspectionTargetPlayerIds[0] = '9';

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            7200,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'targets:1,2',
            }),
        }));
    });

    it('queued onMinionAffected ongoing trigger 的 canTrigger 与 executor 都应继续拿到 affectBatchTargets', () => {
        registerTrigger('test_affect_batch_runtime', 'onMinionAffected', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `batch:${ctx.affectBatchTargets?.length ?? 'missing'}:${ctx.affectBatchTargets?.[0]?.minionUid ?? 'missing-target'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            canTrigger: (ctx) => (
                ctx.affectType === 'power_change'
                && ctx.reason === 'queued_affect_batch_runtime'
                && ctx.triggerMinionUid === 'ally-1'
                && ctx.affectBatchTargets?.length === 1
                && ctx.affectBatchTargets?.[0]?.minionUid === 'ally-1'
            ),
        });

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
                        makeMinion('source-1', 'test_affect_batch_runtime', '0', 3),
                        makeMinion('ally-1', 'ally_card', '0', 2, { powerModifier: 0, tempPowerModifier: 0 }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const matchState = makeMatchState(core);
        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState,
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'enemy-fast-1',
            sourceBaseIndex: 0,
            sourceControllerId: '1',
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'ally_card',
            triggerMinion: core.bases[0].minions[1],
            affectType: 'power_change',
            affectEvent: {
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: {
                    minionUid: 'ally-1',
                    baseIndex: 0,
                    amount: 2,
                    reason: 'queued_affect_batch_runtime',
                    sourcePlayerId: '1',
                    sourceDefId: 'enemy_fast',
                    sourceCardUid: 'enemy-fast-1',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1,
            } as any,
            affectBatchTargets: [{ minionUid: 'ally-1', baseIndex: 0, controllerId: '0' }],
            reason: 'queued_affect_batch_runtime',
            random: defaultTestRandom as any,
            now: 1,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers[0];
        expect(trigger.affectBatchTargets).toEqual([
            { minionUid: 'ally-1', baseIndex: 0, controllerId: '0' },
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: (queued as any).payload.triggers,
            }),
            defaultTestRandom,
            1,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'batch:1:ally-1',
            }),
        }));
    });

    it('queued onMinionAffected 真链不应让 affectEvent 快照被 live mutation 污染', () => {
        registerTrigger('test_affect_event_runtime', 'onMinionAffected', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `affect:${ctx.affectEvent?.payload?.reason ?? 'missing'}:${ctx.affectEvent?.payload?.meta?.nested ?? 'missing'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            canTrigger: (ctx) => (
                ctx.affectType === 'power_change'
                && ctx.reason === 'queued_affect_event_runtime'
                && ctx.triggerMinionUid === 'ally-1'
                && ctx.affectEvent?.payload?.reason === 'queued_affect_event_runtime'
                && ctx.affectEvent?.payload?.meta?.nested === 'queued'
            ),
        });

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
                        makeMinion('source-1', 'test_affect_event_runtime', '0', 3),
                        makeMinion('ally-1', 'ally_card', '0', 2, { powerModifier: 0, tempPowerModifier: 0 }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const affectEvent = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'ally-1',
                baseIndex: 0,
                amount: 2,
                reason: 'queued_affect_event_runtime',
                sourcePlayerId: '1',
                sourceDefId: 'enemy_fast',
                sourceCardUid: 'enemy-fast-1',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
                meta: {
                    nested: 'queued',
                },
            },
            timestamp: 1,
        } as any;

        const matchState = makeMatchState(core);
        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState,
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'enemy-fast-1',
            sourceBaseIndex: 0,
            sourceControllerId: '1',
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'ally_card',
            triggerMinion: core.bases[0].minions[1],
            affectType: 'power_change',
            affectEvent,
            affectBatchTargets: [{ minionUid: 'ally-1', baseIndex: 0, controllerId: '0' }],
            reason: 'queued_affect_event_runtime',
            random: defaultTestRandom as any,
            now: 1,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers[0];
        expect(trigger.affectEvent?.payload?.reason).toBe('queued_affect_event_runtime');
        expect(trigger.affectEvent?.payload?.meta?.nested).toBe('queued');

        affectEvent.payload.reason = 'mutated_affect_event_reason';
        affectEvent.payload.meta.nested = 'mutated_affect_event_nested';

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: (queued as any).payload.triggers,
            }),
            defaultTestRandom,
            1,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'affect:queued_affect_event_runtime:queued',
            }),
        }));
    });

    it('queued onMinionAffected 真链不应让 affectBatchTargets 快照被 live mutation 污染', () => {
        registerTrigger('test_affect_batch_snapshot_runtime', 'onMinionAffected', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `batch-snapshot:${ctx.affectBatchTargets?.[0]?.minionUid ?? 'missing-target'}:${ctx.affectBatchTargets?.[0]?.controllerId ?? 'missing-controller'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            canTrigger: (ctx) => (
                ctx.affectType === 'power_change'
                && ctx.reason === 'queued_affect_batch_snapshot_runtime'
                && ctx.affectBatchTargets?.[0]?.minionUid === 'ally-1'
                && ctx.affectBatchTargets?.[0]?.controllerId === '0'
            ),
        });

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
                        makeMinion('source-1', 'test_affect_batch_snapshot_runtime', '0', 3),
                        makeMinion('ally-1', 'ally_card', '0', 2, { powerModifier: 0, tempPowerModifier: 0 }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const affectBatchTargets = [{ minionUid: 'ally-1', baseIndex: 0, controllerId: '0' }] as any;
        const matchState = makeMatchState(core);
        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState,
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'enemy-fast-1',
            sourceBaseIndex: 0,
            sourceControllerId: '1',
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'ally_card',
            triggerMinion: core.bases[0].minions[1],
            affectType: 'power_change',
            affectEvent: {
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: {
                    minionUid: 'ally-1',
                    baseIndex: 0,
                    amount: 2,
                    reason: 'queued_affect_batch_snapshot_runtime',
                    sourcePlayerId: '1',
                    sourceDefId: 'enemy_fast',
                    sourceCardUid: 'enemy-fast-1',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1,
            } as any,
            affectBatchTargets,
            reason: 'queued_affect_batch_snapshot_runtime',
            random: defaultTestRandom as any,
            now: 1,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers[0];
        expect(trigger.affectBatchTargets?.[0]?.minionUid).toBe('ally-1');
        expect(trigger.affectBatchTargets?.[0]?.controllerId).toBe('0');

        affectBatchTargets[0].minionUid = 'mutated-target';
        affectBatchTargets[0].controllerId = '9';

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: (queued as any).payload.triggers,
            }),
            defaultTestRandom,
            1,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'batch-snapshot:ally-1:0',
            }),
        }));
    });

    it('queued onDuelResolved 真链不应让 duel 与 duelWinner 快照被 live mutation 污染', () => {
        registerTrigger('test_duel_snapshot_runtime', 'onDuelResolved', (ctx) => ([{
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: ctx.playerId,
                messageKey: `duel-snapshot:${ctx.duel?.sourceId ?? 'missing-source'}:${ctx.duelWinner?.metadata?.nested ?? 'missing-nested'}`,
                tone: 'info',
            },
            timestamp: ctx.now,
        }] as any), {
            perInstance: true,
            canTrigger: (ctx) => (
                ctx.duel?.sourceId === 'duel_source_snapshot'
                && ctx.duelWinner?.uid === 'challenger-1'
                && ctx.duelWinner?.metadata?.nested === 'queued'
            ),
        });

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
                        makeMinion('source-1', 'test_duel_snapshot_runtime', '0', 3),
                        makeMinion('challenger-1', 'challenger_card', '0', 4),
                        makeMinion('challenged-1', 'challenged_card', '1', 2),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const challenger = core.bases[0].minions[1] as any;
        const challenged = core.bases[0].minions[2] as any;
        challenger.metadata = { nested: 'queued' };
        challenged.metadata = { nested: 'challenged-queued' };

        const duel = {
            id: 'duel-1',
            baseIndex: 0,
            sourceId: 'duel_source_snapshot',
            sourcePlayerId: '0',
            challengerPlayerId: '0',
            challengerMinionUid: 'challenger-1',
            challengedPlayerId: '1',
            challengedMinionUid: 'challenged-1',
            outcome: 'vp_to_winner',
        } as any;

        const matchState = makeMatchState(core);
        const queued = collectTriggers(core, 'onDuelResolved', {
            state: core,
            matchState,
            playerId: '0',
            baseIndex: 0,
            duel,
            duelSourceId: 'duel_source_snapshot',
            duelOutcome: 'vp_to_winner',
            duelChallenger: challenger,
            duelChallenged: challenged,
            duelWinner: challenger,
            duelLoser: challenged,
            duelTie: false,
            random: defaultTestRandom as any,
            now: 1,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers[0];
        expect(trigger.duel?.sourceId).toBe('duel_source_snapshot');
        expect(trigger.duelWinner?.metadata?.nested).toBe('queued');

        duel.sourceId = 'mutated_duel_source';
        challenger.metadata.nested = 'mutated_duel_winner_nested';

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as any),
                triggerQueue: (queued as any).payload.triggers,
            }),
            defaultTestRandom,
            1,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                messageKey: 'duel-snapshot:duel_source_snapshot:queued',
            }),
        }));
    });
});
