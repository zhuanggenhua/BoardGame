import { beforeEach, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { clearRegistry } from '../domain/abilityRegistry';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { postProcessSystemEvents } from '../domain';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { resolveSmashUpReactionChoice } from '../domain/reactionSession';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { defaultTestRandom, runCommand } from './testRunner';
import { getInteractionsFromMS, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { clearOngoingEffectRegistry, collectTriggers, registerTrigger } from '../domain/ongoingEffects';
import { processAffectTriggers, processMoveTriggers, reduce } from '../domain/reducer';

describe('reaction queue: preserves event player context', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        clearOngoingEffectRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    it('collectTriggers non-perInstance source selection 应跳过 canTrigger 不合格的同名 source', () => {
        registerTrigger('test_shared_source_choice', 'onMinionDestroyed', () => [], {
            playerContext: 'sourceController',
            canTrigger: (ctx) => ctx.sourceControllerId === '1',
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
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('source-p0', 'test_shared_source_choice', '0', 2),
                        makeMinion('source-p1', 'test_shared_source_choice', '1', 2),
                        makeMinion('victim-a', 'robot_microbot', '0', 2),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'victim-a'),
            random: defaultTestRandom,
            now: 99,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(1);
        expect(queued.payload.triggers[0]).toEqual(expect.objectContaining({
            sourceDefId: 'test_shared_source_choice',
            sourceCardUid: 'source-p1',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
        }));
    });

    it('collectTriggers onMinionPlayed 不应在对手打随从时为 Gold Strike 排出空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('gold-draw-a', 'robot_microbot', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('own-played', 'robot_microbot', '0', 3),
                        makeMinion('enemy-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [{ uid: 'gold-1', defId: 'cowboys_gold_strike', ownerId: '0' } as any],
                }),
            ],
        });

        const ownQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'own-played',
            triggerMinionDefId: 'robot_microbot',
            random: defaultTestRandom,
            now: 1,
        }) as any;
        expect(ownQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('cowboys_gold_strike');

        const opponentQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy-played',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 2,
        }) as any;
        expect(opponentQueued).toBeUndefined();
    });

    it('collectTriggers onMinionPlayed 不应在非本回合首次打到基地时为 Smart Set-Up 排出空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('smart-draw-a', 'robot_microbot', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.WORLD_CHAMPS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    minionsPlayedPerBase: { 0: 2 },
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('smart-host', 'robot_microbot_alpha', '1', 3, {
                            attachedActions: [{ uid: 'smart-action', defId: 'world_champs_smart_set_up', ownerId: '0' } as any],
                        }),
                        makeMinion('second-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'second-played',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 3,
        }) as any;
        const smartSetUpTriggers = (queued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'world_champs_smart_set_up');
        expect(smartSetUpTriggers).toHaveLength(0);
    });

    it('sourceController queued onMinionPlayed trigger 应把 Smart Set-Up 归给附着行动拥有者而不是打出随从玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('smart-draw-a', 'robot_microbot', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.WORLD_CHAMPS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    minionsPlayedPerBase: { 0: 1 },
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('smart-host', 'ghosts_spectre', '1', 3, {
                            attachedActions: [{ uid: 'smart-action', defId: 'world_champs_smart_set_up', ownerId: '0' } as any],
                        }),
                        makeMinion('first-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'first-played',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 15,
        }) as any;

        const smartSetUpTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'world_champs_smart_set_up');
        expect(smartSetUpTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'smart-action',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Viking Funeral 归给附着行动拥有者而不是宿主控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('host-a', 'ghosts_spectre', '1', 3, {
                            attachedActions: [{ uid: 'funeral-a', defId: 'vikings_viking_funeral', ownerId: '0' } as any],
                        }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'host-a',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 16,
        }) as any;

        const funeralTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'vikings_viking_funeral');
        expect(funeralTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'funeral-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 World Champs Samurai Chan 归给自身控制者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('chan-draw-a', 'robot_microbot', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.WORLD_CHAMPS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('wc-chan-a', 'world_champs_samurai_chan', '1', 2),
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
            triggerMinionUid: 'wc-chan-a',
            triggerMinionDefId: 'world_champs_samurai_chan',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 17,
        }) as any;

        const chanTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'world_champs_samurai_chan');
        expect(chanTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'wc-chan-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Samurai Chan 归给自身控制者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('samurai-chan-draw-a', 'robot_microbot', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('samurai-chan-a', 'samurai_samurai_chan', '1', 2),
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
            triggerMinionUid: 'samurai-chan-a',
            triggerMinionDefId: 'samurai_samurai_chan',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 18,
        }) as any;

        const chanTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_samurai_chan');
        expect(chanTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'samurai-chan-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Samurai Chan POD 归给自身控制者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('samurai-chan-pod-draw-a', 'robot_microbot', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('samurai-chan-pod-a', 'samurai_samurai_chan_pod', '1', 2),
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
            triggerMinionUid: 'samurai-chan-pod-a',
            triggerMinionDefId: 'samurai_samurai_chan_pod',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 19,
        }) as any;

        const chanTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_samurai_chan_pod');
        expect(chanTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'samurai-chan-pod-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Bushi 归给自身控制者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('samurai-bushi-a', 'samurai_bushi', '1', 5),
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
            random: defaultTestRandom,
            now: 20,
        }) as any;

        const bushiTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_bushi');
        expect(bushiTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'samurai-bushi-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Bushi POD 归给自身控制者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('samurai-bushi-pod-a', 'samurai_bushi_pod', '1', 4, { powerCounters: 1 }),
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
            triggerMinionUid: 'samurai-bushi-pod-a',
            triggerMinionDefId: 'samurai_bushi_pod',
            triggerMinion: core.bases[0].minions[0],
            triggerMinionPower: 5,
            random: defaultTestRandom,
            now: 21,
        }) as any;

        const bushiTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_bushi_pod');
        expect(bushiTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'samurai-bushi-pod-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Shogun 归给自身控制者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('samurai-shogun-a', 'samurai_shogun', '1', 4),
                        makeMinion('shogun-ally-a', 'robot_microbot', '1', 2),
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
            triggerMinionUid: 'shogun-ally-a',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 22,
        }) as any;

        const shogunTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_shogun');
        expect(shogunTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'samurai-shogun-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Shogun POD 归给自身控制者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('samurai-shogun-pod-a', 'samurai_shogun_pod', '1', 4),
                        makeMinion('shogun-pod-ally-a', 'robot_microbot', '1', 2),
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
            triggerMinionUid: 'shogun-pod-ally-a',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 23,
        }) as any;

        const shogunTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_shogun_pod');
        expect(shogunTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'samurai-shogun-pod-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Final Haiku 归给附着行动拥有者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('haiku-host-a', 'samurai_bushi', '1', 4, {
                            attachedActions: [{ uid: 'haiku-action-a', defId: 'samurai_final_haiku', ownerId: '1' }],
                        }),
                        makeMinion('haiku-ally-a', 'robot_microbot', '1', 2),
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
            triggerMinionUid: 'haiku-host-a',
            triggerMinionDefId: 'samurai_bushi',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 24,
        }) as any;

        const haikuTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_final_haiku');
        expect(haikuTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'haiku-action-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Final Haiku POD 归给附着行动拥有者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('haiku-pod-host-a', 'samurai_bushi_pod', '1', 4, {
                            attachedActions: [{ uid: 'haiku-pod-action-a', defId: 'samurai_final_haiku_pod', ownerId: '1' }],
                        }),
                        makeMinion('haiku-pod-ally-a', 'robot_microbot', '1', 2),
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
            triggerMinionUid: 'haiku-pod-host-a',
            triggerMinionDefId: 'samurai_bushi_pod',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 25,
        }) as any;

        const haikuTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_final_haiku_pod');
        expect(haikuTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'haiku-pod-action-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Honor the Fallen 归给基地行动拥有者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('honor-draw-a', 'robot_microbot', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('honor-dead-a', 'samurai_ronin', '1', 4),
                    ],
                    ongoingActions: [{ uid: 'honor-action-a', defId: 'samurai_honor_the_fallen', ownerId: '1' }],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'honor-dead-a',
            triggerMinionDefId: 'samurai_ronin',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 26,
        }) as any;

        const honorTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_honor_the_fallen');
        expect(honorTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'honor-action-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 应把 Honor the Fallen POD 归给基地行动拥有者而不是事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('honor-pod-draw-a', 'robot_microbot', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('honor-pod-dead-a', 'samurai_ronin_pod', '1', 4),
                    ],
                    ongoingActions: [{ uid: 'honor-pod-action-a', defId: 'samurai_honor_the_fallen_pod', ownerId: '1' }],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'honor-pod-dead-a',
            triggerMinionDefId: 'samurai_ronin_pod',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 27,
        }) as any;

        const honorTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_honor_the_fallen_pod');
        expect(honorTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'honor-pod-action-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('global Way of the Warrior queued trigger 应按标记元数据给施放者抽牌而不是按事件玩家或行动拥有者', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('warrior-draw-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('warrior-draw-b', 'robot_microbot_beta', 'minion', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('event-player-draw-a', 'ghosts_spectre', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '2': makePlayer('2', {
                    deck: [makeCard('source-owner-draw-a', 'sharks_mako', 'minion', '2')],
                    discard: [makeCard('borrowed-warrior-action', 'samurai_way_of_the_warrior', 'action', '2')],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.SHARKS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('warrior-marked-a', 'samurai_ronin', '1', 4, {
                            metadata: {
                                samuraiWayOfTheWarriorDrawUntilTurnNumber: 2,
                                samuraiWayOfTheWarriorDrawPlayerId: '0',
                            },
                        }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'warrior-marked-a',
            triggerMinionDefId: 'samurai_ronin',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 28,
        }) as any;

        const warriorTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_way_of_the_warrior');
        expect(warriorTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'borrowed-warrior-action',
            sourceControllerId: '2',
            ownerPlayerId: '1',
            eventPlayerId: '1',
            playerContext: 'eventPlayer',
        }));

        const resolved = maybeResolveReactionQueue(makeMatchState({
            ...core,
            triggerQueue: [warriorTrigger],
        }), defaultTestRandom, 29);

        expect(resolved?.events.some(event =>
            event.type === SU_EVENTS.CARDS_DRAWN
            && (event as any).payload?.playerId === '0'
            && (event as any).payload?.cardUids?.includes('warrior-draw-a')
            && (event as any).payload?.cardUids?.includes('warrior-draw-b')
        )).toBe(true);
        expect(resolved?.events.some(event =>
            event.type === SU_EVENTS.CARDS_DRAWN
            && ((event as any).payload?.playerId === '1' || (event as any).payload?.playerId === '2')
        )).toBe(false);
    });

    it('global Way of the Warrior queued trigger 在场上同时存在其他玩家同名来源时，不应抢成第一张 discard source', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 2,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('warrior-action-p0', 'samurai_way_of_the_warrior', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('warrior-draw-p1-a', 'robot_microbot_alpha', 'minion', '1'),
                        makeCard('warrior-draw-p1-b', 'robot_microbot_beta', 'minion', '1'),
                    ],
                    discard: [makeCard('warrior-action-p1', 'samurai_way_of_the_warrior', 'action', '1')],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '2': makePlayer('2', {
                    deck: [makeCard('event-player-draw-a', 'ghosts_spectre', 'minion', '2')],
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.SHARKS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('warrior-marked-b', 'samurai_ronin', '2', 4, {
                            metadata: {
                                samuraiWayOfTheWarriorDrawUntilTurnNumber: 2,
                                samuraiWayOfTheWarriorDrawPlayerId: '1',
                                samuraiWayOfTheWarriorSourceCardUid: 'warrior-action-p1',
                            },
                        }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '2',
            baseIndex: 0,
            triggerMinionUid: 'warrior-marked-b',
            triggerMinionDefId: 'samurai_ronin',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 29,
        }) as any;

        const warriorTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_way_of_the_warrior');
        expect(warriorTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'warrior-action-p1',
            sourceControllerId: '1',
            eventPlayerId: '2',
        }));
    });

    it('global Way of the Warrior POD queued trigger 应按标记元数据给施放者抽牌而不是按事件玩家或行动拥有者', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('warrior-pod-draw-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('warrior-pod-draw-b', 'robot_microbot_beta', 'minion', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('pod-event-player-draw-a', 'ghosts_spectre', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
                '2': makePlayer('2', {
                    deck: [makeCard('pod-source-owner-draw-a', 'sharks_mako', 'minion', '2')],
                    discard: [makeCard('borrowed-warrior-pod-action', 'samurai_way_of_the_warrior_pod', 'action', '2')],
                    factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.SHARKS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('warrior-pod-marked-a', 'samurai_ronin_pod', '1', 4, {
                            metadata: {
                                samuraiWayOfTheWarriorDrawUntilTurnNumber: 2,
                                samuraiWayOfTheWarriorDrawPlayerId: '0',
                            },
                        }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'warrior-pod-marked-a',
            triggerMinionDefId: 'samurai_ronin_pod',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 30,
        }) as any;

        const warriorTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'samurai_way_of_the_warrior_pod');
        expect(warriorTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'borrowed-warrior-pod-action',
            sourceControllerId: '2',
            ownerPlayerId: '1',
            eventPlayerId: '1',
            playerContext: 'eventPlayer',
        }));

        const resolved = maybeResolveReactionQueue(makeMatchState({
            ...core,
            triggerQueue: [warriorTrigger],
        }), defaultTestRandom, 31);

        expect(resolved?.events.some(event =>
            event.type === SU_EVENTS.CARDS_DRAWN
            && (event as any).payload?.playerId === '0'
            && (event as any).payload?.cardUids?.includes('warrior-pod-draw-a')
            && (event as any).payload?.cardUids?.includes('warrior-pod-draw-b')
        )).toBe(true);
        expect(resolved?.events.some(event =>
            event.type === SU_EVENTS.CARDS_DRAWN
            && ((event as any).payload?.playerId === '1' || (event as any).payload?.playerId === '2')
        )).toBe(false);
    });

    it('collectTriggers onMinionPlayed 不应在对手打到祭坛基地时为 Cthulhu Altar 排出空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('altar-own-played', 'robot_microbot', '0', 3),
                        makeMinion('altar-enemy-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [{ uid: 'altar-action', defId: 'cthulhu_altar', ownerId: '0' } as any],
                }),
            ],
        });

        const ownQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'altar-own-played',
            triggerMinionDefId: 'robot_microbot',
            random: defaultTestRandom,
            now: 4,
        }) as any;
        expect(ownQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('cthulhu_altar');

        const opponentQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'altar-enemy-played',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 5,
        }) as any;
        const altarTriggers = (opponentQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'cthulhu_altar');
        expect(altarTriggers).toHaveLength(0);
    });

    it('collectTriggers onMinionPlayed 不应在对手打到德国工程基地时为 German Engineering 排出空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('engineering-own-played', 'robot_microbot', '0', 3),
                        makeMinion('engineering-enemy-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [{ uid: 'engineering-action', defId: 'frankenstein_german_engineering', ownerId: '0' } as any],
                }),
            ],
        });

        const ownQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'engineering-own-played',
            triggerMinionDefId: 'robot_microbot',
            random: defaultTestRandom,
            now: 6,
        }) as any;
        expect(ownQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('frankenstein_german_engineering');

        const opponentQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'engineering-enemy-played',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 7,
        }) as any;
        const germanEngineeringTriggers = (opponentQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'frankenstein_german_engineering');
        expect(germanEngineeringTriggers).toHaveLength(0);
    });

    it('collectTriggers onMinionPlayed 不应在非 Returned One 本体被打出时为 Returned One 排出空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.SKELETONS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('returned-one-source', 'skeletons_returned_one', '0', 2, {
                            powerModifier: 0,
                            metadata: { playedFrom: 'buried' },
                        }),
                        makeMinion('enemy-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [],
                    buriedCards: [
                        { uid: 'buried-followup', defId: 'robot_microbot_alpha', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' },
                    ],
                }),
            ],
        });

        const opponentQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy-played',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 8,
        }) as any;
        const returnedOneTriggers = (opponentQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'skeletons_returned_one');
        expect(returnedOneTriggers).toHaveLength(0);
    });

    it('collectTriggers onMinionPlayed 不应在对手打到 Rainboroc 基地时为 Rainboroc 排出空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.ITTY_CRITTERS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('rainboroc-own-played', 'robot_microbot', '0', 1),
                        makeMinion('rainboroc-enemy-played', 'robot_microbot', '1', 1),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'rainboroc-a',
                defId: 'itty_critters_rainboroc',
                faction: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
            turnNumber: 6,
        });

        const ownQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'rainboroc-own-played',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 9,
        }) as any;
        expect(ownQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('itty_critters_rainboroc');

        const opponentQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'rainboroc-enemy-played',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 10,
        }) as any;
        const rainborocTriggers = (opponentQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'itty_critters_rainboroc');
        expect(rainborocTriggers).toHaveLength(0);
    });

    it('collectTriggers onMinionPlayed 处理 itty_critters_rainboroc 时，若第一只本回合已触发应改选仍可触发的第二只 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 41,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.ITTY_CRITTERS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [makeMinion('rain-target-minion', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                }),
            ],
            titans: [
                {
                    uid: 'rainboroc-a',
                    defId: 'itty_critters_rainboroc',
                    faction: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'rainboroc-b',
                    defId: 'itty_critters_rainboroc',
                    faction: SMASHUP_FACTION_IDS.ITTY_CRITTERS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as any,
            ],
            rainborocTriggeredTurnByTitan: {
                'rainboroc-a': 41,
            },
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'rain-target-minion',
            triggerMinionDefId: 'robot_microbot_alpha',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 41,
        }) as any;

        const rainborocTrigger = queued?.payload?.triggers?.find((trigger: TriggerInstance) =>
            trigger.sourceDefId === 'itty_critters_rainboroc');
        expect(rainborocTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'rainboroc-b',
            sourceControllerId: '0',
            eventPlayerId: '0',
        }));
    });

    it('collectTriggers onMinionPlayed 只应在对手有剩余手牌时为 Big Funny Giant 排出 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                    hand: [makeCard('owner-spare', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.SHARKS],
                    hand: [makeCard('opponent-spare', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('giant-owner-played', 'robot_microbot', '0', 1),
                        makeMinion('giant-opponent-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'big-funny-a',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
            turnNumber: 6,
        });

        const ownerQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'giant-owner-played',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 11,
        }) as any;
        const ownerTriggers = (ownerQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'tricksters_big_funny_giant');
        expect(ownerTriggers).toHaveLength(0);

        const opponentQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'giant-opponent-played',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 12,
        }) as any;
        expect(opponentQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('tricksters_big_funny_giant');

        const opponentNoHandCore = {
            ...core,
            players: {
                ...core.players,
                '1': {
                    ...core.players['1'],
                    hand: [],
                },
            },
        };
        const opponentNoHandQueued = collectTriggers(opponentNoHandCore, 'onMinionPlayed', {
            state: opponentNoHandCore,
            matchState: makeMatchState(opponentNoHandCore),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'giant-opponent-played',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: opponentNoHandCore.bases[0].minions[1],
            random: defaultTestRandom,
            now: 13,
        }) as any;
        const noHandTriggers = (opponentNoHandQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'tricksters_big_funny_giant');
        expect(noHandTriggers).toHaveLength(0);
    });

    it('collectTriggers onMinionPlayed 遇到同基地两只 Big Funny Giant 时，不应因第一只属于当前玩家就吞掉对手那只 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                    hand: [makeCard('p0-spare', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.GHOSTS],
                    hand: [makeCard('p1-spare', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [makeMinion('p0-played-minion', 'robot_microbot', '0', 1)],
                }),
            ],
            titans: [
                {
                    uid: 'big-funny-self-first',
                    defId: 'tricksters_big_funny_giant',
                    faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'big-funny-opponent-second',
                    defId: 'tricksters_big_funny_giant',
                    faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as any,
            ],
            turnNumber: 7,
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'p0-played-minion',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 14,
        }) as any;

        const giantTriggers = (queued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'tricksters_big_funny_giant');
        expect(giantTriggers).toHaveLength(1);
        expect(giantTriggers[0]).toEqual(expect.objectContaining({
            sourceCardUid: 'big-funny-opponent-second',
            sourceControllerId: '1',
            eventPlayerId: '0',
        }));
    });

    it('默认 eventPlayer queued onMinionPlayed trigger 应把 Big Funny Giant 弃牌 prompt 交给打出随从的对手', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('giant-owner-hand-a', 'robot_microbot', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('giant-opponent-hand-a', 'ghosts_spectre', 'minion', '1'),
                        makeCard('giant-opponent-hand-b', 'sharks_mako', 'minion', '1'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.SHARKS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('giant-opponent-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'big-funny-a',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
            turnNumber: 6,
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'giant-opponent-played',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 32,
        }) as any;

        const giantTrigger = queued?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'tricksters_big_funny_giant');
        expect(giantTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'big-funny-a',
            sourceControllerId: '0',
            ownerPlayerId: '1',
            eventPlayerId: '1',
            playerContext: 'eventPlayer',
        }));

        const resolved = maybeResolveReactionQueue(makeMatchState({
            ...core,
            triggerQueue: [giantTrigger],
        }), defaultTestRandom, 33);

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('1');
        expect(prompt?.data?.sourceId).toBe('titan_tricksters_big_funny_giant_discard_to_play');
        expect(prompt?.data?.options?.map((option: any) => option.value?.cardUid)).toEqual([
            'giant-opponent-hand-a',
            'giant-opponent-hand-b',
        ]);
        expect(prompt?.data?.options?.some((option: any) => option.value?.cardUid === 'giant-owner-hand-a')).toBe(false);
    });

    it.each([
        ['trickster_flame_trap', false],
        ['trickster_flame_trap_pod', false],
        ['trickster_pay_the_piper', true],
        ['trickster_pay_the_piper_pod', true],
    ] as const)('collectTriggers onMinionPlayed 应按 owner/手牌条件过滤 %s 空 trigger', (sourceDefId, needsHand) => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                    hand: [makeCard('owner-spare', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.SHARKS],
                    hand: [makeCard('opponent-spare', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('trick-owner-played', 'robot_microbot', '0', 1),
                        makeMinion('trick-opponent-played', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [{ uid: `${sourceDefId}-a`, defId: sourceDefId, ownerId: '0' } as any],
                }),
            ],
        });

        const ownerQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'trick-owner-played',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 14,
        }) as any;
        const ownerTriggers = (ownerQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === sourceDefId);
        expect(ownerTriggers).toHaveLength(0);

        const opponentQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'trick-opponent-played',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 15,
        }) as any;
        expect(opponentQueued?.payload?.triggers?.some((trigger: any) => trigger.sourceDefId === sourceDefId)).toBe(true);

        const opponentNoHandCore = {
            ...core,
            players: {
                ...core.players,
                '1': {
                    ...core.players['1'],
                    hand: [],
                },
            },
        };
        const opponentNoHandQueued = collectTriggers(opponentNoHandCore, 'onMinionPlayed', {
            state: opponentNoHandCore,
            matchState: makeMatchState(opponentNoHandCore),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'trick-opponent-played',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: opponentNoHandCore.bases[0].minions[1],
            random: defaultTestRandom,
            now: 16,
        }) as any;
        const noHandTriggers = (opponentNoHandQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === sourceDefId);
        expect(noHandTriggers).toHaveLength(needsHand ? 0 : 1);
    });

    it.each([
        'trickster_leprechaun',
        'trickster_leprechaun_pod',
    ] as const)('collectTriggers onMinionPlayed 应按 controller/力量条件过滤 %s 空 trigger', (sourceDefId) => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.SHARKS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('leprechaun-a', sourceDefId, '0', 4),
                        makeMinion('lep-owner-played', 'robot_microbot', '0', 1),
                        makeMinion('lep-opponent-low', 'robot_microbot', '1', 1),
                        makeMinion('lep-opponent-high', 'sharks_megalodon', '1', 10),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const ownerQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'lep-owner-played',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 17,
        }) as any;
        const ownerTriggers = (ownerQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === sourceDefId);
        expect(ownerTriggers).toHaveLength(0);

        const opponentLowQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'lep-opponent-low',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[2],
            random: defaultTestRandom,
            now: 18,
        }) as any;
        expect(opponentLowQueued?.payload?.triggers?.some((trigger: any) => trigger.sourceDefId === sourceDefId)).toBe(true);

        const opponentHighQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'lep-opponent-high',
            triggerMinionDefId: 'sharks_megalodon',
            triggerMinion: core.bases[0].minions[3],
            random: defaultTestRandom,
            now: 19,
        }) as any;
        const highTriggers = (opponentHighQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === sourceDefId);
        expect(highTriggers).toHaveLength(0);
    });

    it('collectTriggers onMinionPlayed 处理 trickster_leprechaun_pod 时，若第一只本回合已用应改选仍可触发的第二只 source', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 2,
            turnNumber: 36,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.SHARKS],
                }),
                '2': makePlayer('2', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('lp-pod-a', 'trickster_leprechaun_pod', '0', 4, {
                            metadata: { leprechaunPodLastTurnTriggered: 36 },
                        }),
                        makeMinion('lp-pod-b', 'trickster_leprechaun_pod', '1', 5),
                        makeMinion('lep-target-minion', 'robot_microbot', '2', 1),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '2',
            baseIndex: 0,
            triggerMinionUid: 'lep-target-minion',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[2],
            random: defaultTestRandom,
            now: 36,
        }) as any;

        const lepTrigger = queued?.payload?.triggers?.find((trigger: TriggerInstance) =>
            trigger.sourceDefId === 'trickster_leprechaun_pod');
        expect(lepTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'lp-pod-b',
            sourceControllerId: '1',
            eventPlayerId: '2',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [lepTrigger],
            }),
            defaultTestRandom,
            36,
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
                reason: 'trickster_leprechaun_pod_once_per_turn',
            }),
        }));
    });

    it('collectTriggers onMinionPlayed 应按对手/异基地/回合次数/可抽牌过滤 Brownie POD 空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('brownie-draw-a', 'robot_microbot', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.SHARKS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('brownie-a', 'trickster_brownie_pod', '0', 2),
                        makeMinion('brownie-opponent-same', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_portal_room',
                    minions: [
                        makeMinion('brownie-owner-played', 'robot_microbot', '0', 1),
                        makeMinion('brownie-opponent-other', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [],
                }),
            ],
        });
        const brownieTriggers = (queued: any) => (queued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'trickster_brownie_pod');

        const ownerQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 1,
            triggerMinionUid: 'brownie-owner-played',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[1].minions[0],
            random: defaultTestRandom,
            now: 20,
        }) as any;
        expect(brownieTriggers(ownerQueued)).toHaveLength(0);

        const sameBaseQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'brownie-opponent-same',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 21,
        }) as any;
        expect(brownieTriggers(sameBaseQueued)).toHaveLength(0);

        const opponentOtherBaseQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 1,
            triggerMinionUid: 'brownie-opponent-other',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[1].minions[1],
            random: defaultTestRandom,
            now: 22,
        }) as any;
        expect(brownieTriggers(opponentOtherBaseQueued)).toHaveLength(1);

        const usedCore = {
            ...core,
            bases: [
                {
                    ...core.bases[0],
                    minions: [
                        {
                            ...core.bases[0].minions[0],
                            metadata: { browniePodLastTurnTriggered: 7 },
                        },
                        core.bases[0].minions[1],
                    ],
                },
                core.bases[1],
            ],
        };
        const usedQueued = collectTriggers(usedCore, 'onMinionPlayed', {
            state: usedCore,
            matchState: makeMatchState(usedCore),
            playerId: '1',
            baseIndex: 1,
            triggerMinionUid: 'brownie-opponent-other',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: usedCore.bases[1].minions[1],
            random: defaultTestRandom,
            now: 23,
        }) as any;
        expect(brownieTriggers(usedQueued)).toHaveLength(0);

        const noDrawCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    deck: [],
                    discard: [],
                },
            },
        };
        const noDrawQueued = collectTriggers(noDrawCore, 'onMinionPlayed', {
            state: noDrawCore,
            matchState: makeMatchState(noDrawCore),
            playerId: '1',
            baseIndex: 1,
            triggerMinionUid: 'brownie-opponent-other',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: noDrawCore.bases[1].minions[1],
            random: defaultTestRandom,
            now: 24,
        }) as any;
        expect(brownieTriggers(noDrawQueued)).toHaveLength(0);
    });

    it('collectTriggers onMinionAffected 只应在 Brownie 本体被对手影响且对手有手牌时入队', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('brownie-discard-a', 'sharks_mako', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('brownie-a', 'trickster_brownie', '0', 2),
                    makeMinion('not-brownie-a', 'robot_microbot', '0', 2),
                ]),
            ],
        });
        const brownieTriggers = (queued: any) => (queued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'trickster_brownie');

        const otherMinionAffected = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'not-brownie-a',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[1],
            affectType: 'power_change',
            counterChangeKind: 'removed',
            counterDelta: -1,
            reason: 'test_affect_other_minion',
            random: defaultTestRandom,
            now: 25,
        }) as any;
        expect(brownieTriggers(otherMinionAffected)).toHaveLength(0);

        const brownieAffected = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'brownie-a',
            triggerMinionDefId: 'trickster_brownie',
            triggerMinion: core.bases[0].minions[0],
            affectType: 'power_change',
            counterChangeKind: 'removed',
            counterDelta: -1,
            reason: 'test_affect_brownie',
            random: defaultTestRandom,
            now: 26,
        }) as any;
        expect(brownieTriggers(brownieAffected)).toHaveLength(1);
        expect(brownieAffected?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'trickster_brownie',
            sourceCardUid: 'brownie-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
        }));
    });

    it('processAffectTriggers 处理 borrowed ONGOING_ATTACHED 时，Brownie 应继续把真正打牌玩家视为事件玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('borrowed-hideout', 'trickster_hideout', 'action', '1')],
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('brownie-discard-a', 'sharks_mako', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('brownie-a', 'trickster_brownie', '1', 2),
                ]),
            ],
        });

        const processed = processAffectTriggers([{
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-hideout',
                defId: 'trickster_hideout',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'brownie-a',
            },
            timestamp: 27,
        } as any], makeMatchState(core, 'playCards', '0'), '0', defaultTestRandom as any, 27);

        const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        const brownieTrigger = queued?.payload?.triggers?.find((trigger: any) => trigger.sourceDefId === 'trickster_brownie');
        expect(brownieTrigger).toEqual(expect.objectContaining({
            sourceDefId: 'trickster_brownie',
            sourceCardUid: 'brownie-a',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
        }));
    });

    it('collectTriggers onMinionPlayed 不应在非大法师随从被打出时为 Archmage 排出空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.SHARKS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_city_of_gold',
                    minions: [
                        makeMinion('archmage-existing', 'wizard_archmage', '0', 4),
                        makeMinion('robot-played', 'robot_microbot', '0', 1),
                        makeMinion('archmage-played', 'wizard_archmage', '0', 4),
                    ],
                    ongoingActions: [],
                }),
            ],
        });
        const archmageTriggers = (queued: any) => (queued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'wizard_archmage');

        const robotQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'robot-played',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 25,
        }) as any;
        expect(archmageTriggers(robotQueued)).toHaveLength(0);

        const archmageQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'archmage-played',
            triggerMinionDefId: 'wizard_archmage',
            triggerMinion: core.bases[0].minions[2],
            random: defaultTestRandom,
            now: 26,
        }) as any;
        expect(archmageTriggers(archmageQueued)).toHaveLength(1);
    });

    it('collectTriggers onMinionPlayed 应按 Gorgodzolla 所在基地过滤异基地空 trigger', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KAIJU, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_city_of_gold',
                    minions: [
                        makeMinion('gorg-same-base', 'ghosts_spectre', '1', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_portal_room',
                    minions: [
                        makeMinion('gorg-other-base', 'robot_microbot', '1', 1),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'gorg-filter',
                defId: 'kaiju_gorgodzolla',
                faction: SMASHUP_FACTION_IDS.KAIJU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });
        const gorgodzollaTriggers = (queued: any) => (queued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'kaiju_gorgodzolla');

        const sameBaseQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'gorg-same-base',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 27,
        }) as any;
        expect(gorgodzollaTriggers(sameBaseQueued)).toHaveLength(1);

        const otherBaseQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 1,
            triggerMinionUid: 'gorg-other-base',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: core.bases[1].minions[0],
            random: defaultTestRandom,
            now: 28,
        }) as any;
        expect(gorgodzollaTriggers(otherBaseQueued)).toHaveLength(0);
    });

    it('sourceController queued trigger 仍应把原事件玩家传给 onActionPlayed 回调', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hand-a', 'sharks_mako', 'minion', '0'),
                        makeCard('hand-b', 'time_travelers_time_walk', 'action', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.SUPER_SPIES, SMASHUP_FACTION_IDS.TIME_TRAVELERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TIME_TRAVELERS, SMASHUP_FACTION_IDS.CYBORG_APES],
                }),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('agent-a', 'super_spies_secret_agent', '1', 2),
                ]),
                makeBase('base_portal_room', []),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-secret-agent',
            timing: 'onActionPlayed',
            sourceDefId: 'super_spies_secret_agent',
            sourceCardUid: 'agent-a',
            sourceControllerId: '1',
            playerContext: 'sourceController',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '1',
            eventPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 1,
            actionTargetBaseIndex: 1,
            actionTargetType: 'base',
        };

        const ms: MatchState<SmashUpCore> = makeMatchState({
            ...(core as SmashUpCore),
            triggerQueue: [trigger],
        });

        const resolved = maybeResolveReactionQueue(ms, defaultTestRandom, 1);
        expect(resolved).toBeDefined();

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.data?.sourceId).toBe('super_spies_secret_agent_discard');
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.options?.map((option: any) => option.value?.cardUid)).toEqual(['hand-a', 'hand-b']);
    });

    it('默认 eventPlayer queued onMinionPlayed trigger 仍应保留 Gold Strike 的事件玩家语义，不在对手打随从时误给拥有者抽牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('gold-draw-a', 'robot_microbot', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [makeMinion('enemy-played', 'ghosts_spectre', '1', 3)],
                    ongoingActions: [{ uid: 'gold-1', defId: 'cowboys_gold_strike', ownerId: '0' } as any],
                }),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-gold-strike',
            timing: 'onMinionPlayed',
            sourceDefId: 'cowboys_gold_strike',
            sourceCardUid: 'gold-1',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '1',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'enemy-played',
            triggerMinionDefId: 'ghosts_spectre',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            2,
        );

        expect(resolved).toBeDefined();
        expect(getInteractionsFromMS(resolved!.state)).toHaveLength(0);
        expect(resolved!.state.core.players['0'].hand).toHaveLength(0);
        expect(resolved!.state.core.players['0'].deck.map(card => card.uid)).toEqual(['gold-draw-a']);
    });

    it('sourceHostController queued beforeScoring trigger 仍应把 Dunwich Horror POD 的选择权交给宿主控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 9,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_a',
                minions: [
                    {
                        ...makeMinion('host-1', 'robot_microbot', '0', 3),
                        attachedActions: [{ uid: 'dh-1', defId: 'elder_thing_dunwich_horror_pod', ownerId: '1' }],
                    },
                    makeMinion('enemy-1', 'ninja_shinobi', '1', 6),
                ],
                ongoingActions: [],
            })],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'dh-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 1001,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('elder_thing_dunwich_horror_pod');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.playerContext).toBe('sourceHostController');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            1001,
        );
        const prompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('elder_thing_dunwich_horror_pod_choice');
    });

    it('sourceController queued onMinionMoved trigger 不应把 eventPlayer 误当成泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('enemy-moved', 'ghosts_spectre', '1', 3),
                ]),
                makeBase('base_portal_room', []),
            ],
            titans: [{
                uid: 't-ursa',
                defId: 'bear_cavalry_major_ursa',
                faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const trigger: TriggerInstance = {
            id: 'queued-major-ursa',
            timing: 'onMinionMoved',
            sourceDefId: 'bear_cavalry_major_ursa',
            sourceCardUid: 't-ursa',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'enemy-moved',
            triggerMinionDefId: 'ghosts_spectre',
        };

        const ms: MatchState<SmashUpCore> = makeMatchState({
            ...(core as SmashUpCore),
            triggerQueue: [trigger],
        });

        const resolved = maybeResolveReactionQueue(ms, defaultTestRandom, 1);
        expect(resolved).toBeDefined();
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 't-ursa',
                amount: 1,
                reason: 'bear_cavalry_major_ursa',
            }),
        }));
    });

    it('sourceController queued onMinionMoved trigger 应把 High Ground POD 归给制高点拥有者而不是移入随从玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('bear-owner-minion', 'bear_cavalry', '0', 3),
                        makeMinion('enemy-moved', 'ghosts_spectre', '1', 3),
                    ],
                    ongoingActions: [{
                        uid: 'high-ground-pod-a',
                        defId: 'bear_cavalry_high_ground_pod',
                        ownerId: '0',
                    } as any],
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
            random: defaultTestRandom,
            now: 3,
        }) as any;

        const trigger = queued?.payload?.triggers?.find((candidate: any) =>
            candidate?.sourceDefId === 'bear_cavalry_high_ground_pod');
        expect(trigger).toEqual(expect.objectContaining({
            sourceCardUid: 'high-ground-pod-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onTitanMoved trigger 仍应把 Major Ursa 的选择权交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('enemy-moved', 'ghosts_spectre', '1', 3),
                ]),
                makeBase('base_portal_room', []),
            ],
            titans: [{
                uid: 't-ursa',
                defId: 'bear_cavalry_major_ursa',
                faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'onTitanMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 't-ursa',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 2,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('bear_cavalry_major_ursa');
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

        const ursaOption = reactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            return triggerId != null && queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'bear_cavalry_major_ursa');
        });
        expect(ursaOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: ursaOption.id } } as any,
            defaultTestRandom,
        );
        const chooseMinionPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(chooseMinionPrompt?.playerId).toBe('0');
        expect(chooseMinionPrompt?.data?.sourceId).toBe('titan_bear_cavalry_major_ursa_choose_minion');

    });

    it('postProcessSystemEvents 处理 TITAN_MOVED 时，应给 Major Ursa 的 queued trigger 保留 source provenance', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.TRICKSTERS],
                }),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('enemy-moved', 'ghosts_spectre', '1', 3),
                ]),
                makeBase('base_portal_room', []),
            ],
            titans: [{
                uid: 't-ursa',
                defId: 'bear_cavalry_major_ursa',
                faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        });

        const result = postProcessSystemEvents(
            core,
            [{
                type: SU_EVENTS.TITAN_MOVED,
                payload: {
                    titanUid: 't-ursa',
                    defId: 'bear_cavalry_major_ursa',
                    fromBaseIndex: 1,
                    toBaseIndex: 0,
                    reason: 'test_major_ursa_move',
                },
                timestamp: 2,
            } as any],
            defaultTestRandom,
            makeMatchState(core),
        );

        const queuedEvent = result.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        const ursaTrigger = queuedEvent?.payload?.triggers?.find((candidate: any) =>
            candidate?.sourceDefId === 'bear_cavalry_major_ursa');

        expect(ursaTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 't-ursa',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            ownerPlayerId: '0',
            playerContext: 'sourceController',
        }));
    });

    it('sourceController queued onMinionMoved trigger 仍应把 Very Large Boulder 的移动选择交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 4,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.EXPLORERS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_camp',
                    minions: [makeMinion('moved-away', 'trickster_gnome', '1', 3)],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_cave',
                    minions: [
                        makeMinion('boulder-target', 'robot_microbot_guard', '1', 1),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 't-boulder-live',
                defId: 'explorers_very_large_boulder',
                faction: SMASHUP_FACTION_IDS.EXPLORERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 2,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const moveResult = processMoveTriggers([{
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'moved-away',
                minionDefId: 'trickster_gnome',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'test_move_from_boulder',
            },
            timestamp: 10,
        } as any], makeMatchState(core), '1', defaultTestRandom, 10);

        const queuedEvent = (moveResult.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
        expect(queuedEvent?.payload?.triggers?.[0]?.sourceDefId).toBe('explorers_very_large_boulder');
        expect(queuedEvent?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const queuedCore = moveResult.events.reduce((acc: SmashUpCore, event: any) => reduce(acc, event), core);
        const resolved = maybeResolveReactionQueue(
            {
                ...(moveResult.matchState ?? makeMatchState(core)),
                core: queuedCore,
            },
            defaultTestRandom,
            10,
        );
        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_explorers_very_large_boulder_move');
    });

    it('sourceController queued afterScoring trigger 不应把 eventPlayer 误当成 Happily Ever After 的得分拥有者', () => {
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
                    ongoingActions: [{ uid: 'hea-1', defId: 'princesses_happily_ever_after', ownerId: '0' }],
                }),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 7, vp: 3 }],
            sourceCardUid: 'hea-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 3,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('princesses_happily_ever_after');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            3,
        );

        expect(resolved?.events?.some(event =>
            event.type === SU_EVENTS.VP_AWARDED
            && (event as any).payload?.reason === 'princesses_happily_ever_after',
        )).toBe(false);
    });

    it('sourceController queued afterScoring trigger 仍应把 Alien Scout 的回手选择权交给随从控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [
                        makeMinion('scout-1', 'alien_scout', '0', 2),
                    ],
                }),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 6, vp: 4 }],
            sourceCardUid: 'scout-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 4,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('alien_scout');
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
        expect(prompt?.data?.sourceId).toBe('alien_scout_return');
    });

    it('sourceController queued afterScoring trigger 仍应把 Mummy 的埋葬 prompt 交给木乃伊控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_pyramids',
                    minions: [makeMinion('mummy-1', 'ancient_egyptians_mummy', '0', 2)],
                    ongoingActions: [],
                }),
                makeBase('base_portal_room', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'mummy-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            random: defaultTestRandom,
            now: 5,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ancient_egyptians_mummy');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            5,
        );

        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const mummyOption = reactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            return triggerId != null && queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'ancient_egyptians_mummy');
        });
        expect(mummyOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: mummyOption.id } } as any,
            defaultTestRandom,
        );
        const mummyPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(mummyPrompt?.playerId).toBe('0');
        expect(mummyPrompt?.data?.sourceId).toBe('ancient_egyptians_mummy_after_scoring');
    });

    it('sourceController queued afterScoring trigger 仍应把 Mummy POD 的埋葬 prompt 交给木乃伊控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_pyramids',
                    minions: [makeMinion('mummy-pod-1', 'ancient_egyptians_mummy_pod', '0', 2)],
                    ongoingActions: [],
                }),
                makeBase('base_portal_room', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'mummy-pod-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            rankings: [{ playerId: '1', power: 5, vp: 4 }],
            random: defaultTestRandom,
            now: 5.1,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ancient_egyptians_mummy_pod');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            5.1,
        );

        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const mummyOption = reactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            return triggerId != null && queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'ancient_egyptians_mummy_pod');
        });
        expect(mummyOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: mummyOption.id } } as any,
            defaultTestRandom,
        );
        const mummyPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(mummyPrompt?.playerId).toBe('0');
        expect(mummyPrompt?.data?.sourceId).toBe('ancient_egyptians_mummy_after_scoring');
    });

    it('sourceController queued beforeScoring trigger 仍应把 Pharaoh 的翻牌 prompt 交给法老控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_pyramids',
                minions: [makeMinion('pharaoh-1', 'ancient_egyptians_pharaoh', '0', 5)],
                buriedCards: [{
                    uid: 'buried-1',
                    defId: 'robot_zapbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            })],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'pharaoh-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            rankings: [{ playerId: '1', power: 8, vp: 4 }],
            random: defaultTestRandom,
            now: 6,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ancient_egyptians_pharaoh');
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
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const pharaohOption = reactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            return triggerId != null && queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'ancient_egyptians_pharaoh');
        });
        expect(pharaohOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: pharaohOption.id } } as any,
            defaultTestRandom,
        );
        const pharaohPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(pharaohPrompt?.playerId).toBe('0');
        expect(pharaohPrompt?.data?.sourceId).toBe('ancient_egyptians_pharaoh_before_scoring');
    });

    it('sourceController queued beforeScoring trigger 仍应把 Sheriff 的决斗 prompt 交给 Sheriff 控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_saloon',
                minions: [
                    makeMinion('sheriff-1', 'cowboys_sheriff', '0', 5),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2),
                ],
            })],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'sheriff-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            rankings: [
                { playerId: '1', power: 7, vp: 3 },
                { playerId: '0', power: 5, vp: 2 },
            ],
            random: defaultTestRandom,
            now: 7,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('cowboys_sheriff');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

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
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const sheriffOption = reactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            return triggerId != null && queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'cowboys_sheriff');
        });
        expect(sheriffOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sheriffOption.id } } as any,
            defaultTestRandom,
        );
        const sheriffPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(sheriffPrompt?.playerId).toBe('0');
        expect(sheriffPrompt?.data?.sourceId).toBe('cowboys_sheriff_before_scoring');
    });

    it('sourceController queued afterScoring trigger 仍应把 World Champs Mummy 的埋葬 prompt 交给控制者', () => {
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
                    minions: [makeMinion('wc-mummy-1', 'world_champs_mummy', '0', 2)],
                    ongoingActions: [],
                }),
                makeBase('base_b', []),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 4, vp: 3 }],
            sourceCardUid: 'wc-mummy-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 8,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('world_champs_mummy');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            8,
        );

        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const mummyOption = reactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            return triggerId != null && queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'world_champs_mummy');
        });
        expect(mummyOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: mummyOption.id } } as any,
            defaultTestRandom,
        );
        const mummyPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(mummyPrompt?.playerId).toBe('0');
        expect(mummyPrompt?.data?.sourceId).toBe('world_champs_mummy_after_scoring');
    });

    it('sourceController queued beforeScoring trigger 仍应把 World Champs Sheriff 的决斗 prompt 交给控制者', () => {
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
                    makeMinion('wc-sheriff-1', 'world_champs_sheriff', '0', 5, { powerModifier: 0 }),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            })],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'wc-sheriff-1',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 9,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('world_champs_sheriff');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            9,
        );

        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const sheriffOption = reactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            return triggerId != null && queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'world_champs_sheriff');
        });
        expect(sheriffOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sheriffOption.id } } as any,
            defaultTestRandom,
        );
        const sheriffPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(sheriffPrompt?.playerId).toBe('0');
        expect(sheriffPrompt?.data?.sourceId).toBe('world_champs_sheriff_before_scoring');
    });

    it('sourceController queued onActionPlayed trigger 仍应把 Fort Titanosaurus 的选择权交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.ALIENS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('ally-1', 'dino_war_raptor_pod', '0', 2),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'fort-1',
                defId: 'dinosaurs_fort_titanosaurus',
                faction: SMASHUP_FACTION_IDS.DINOSAURS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            actionTargetType: 'minion',
            actionTargetMinionUid: 'ally-1',
            sourceCardUid: 'opp-action-1',
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 4,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('dinosaurs_fort_titanosaurus');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            4,
        );

        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
    });

    it('sourceController queued onActionPlayed trigger 仍应把 Gorgodzolla 的抽牌提示交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'wizard_summon', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.KAIJU, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_city_of_gold',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'gorg-1',
                defId: 'kaiju_gorgodzolla',
                faction: SMASHUP_FACTION_IDS.KAIJU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const trigger: TriggerInstance = {
            id: 'queued-gorgodzolla-action',
            timing: 'onActionPlayed',
            sourceDefId: 'kaiju_gorgodzolla',
            sourceCardUid: 'gorg-1',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            5,
        );

        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_kaiju_gorgodzolla_draw');
        expect(prompt?.data?.options?.map((option: any) => option.id)).toEqual(['draw', 'skip']);
    });

    it('sourceController queued onMinionPlayed trigger 仍应让 Gorgodzolla 在对手打随从时为自己加 1 标记', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KAIJU, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_city_of_gold',
                    minions: [
                        makeMinion('opp-minion', 'ghosts_spectre', '1', 2),
                    ],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 'gorg-1',
                defId: 'kaiju_gorgodzolla',
                faction: SMASHUP_FACTION_IDS.KAIJU,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'opp-minion',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[0],
            sourceControllerId: '0',
            random: defaultTestRandom,
            now: 6,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('kaiju_gorgodzolla');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            6,
        );

        expect(resolved?.state.core.titans?.find(titan => titan.uid === 'gorg-1')?.powerCounters).toBe(1);
    });

    it('sourceController queued onActionPlayed trigger 仍应保留 Woodland Helpers 的事件玩家语义，不误回收对手行动', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-0', 'robot_microbot_alpha', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.PRINCESSES, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('deck-1', 'robot_microbot_beta', 'minion', '1')],
                    discard: [makeCard('opp-spell-1', 'wizard_summon', 'action', '1')],
                    factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'woodland-1', defId: 'princesses_woodland_helpers', ownerId: '0' }],
            }],
        });

        const trigger: TriggerInstance = {
            id: 'queued-woodland-helpers',
            timing: 'onActionPlayed',
            sourceDefId: 'princesses_woodland_helpers',
            sourceCardUid: 'woodland-1',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            sourceEventId: 'action-played:opp-spell-1:1',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            6,
        );

        const nextState = resolved?.state ?? makeMatchState(core);
        expect(getInteractionsFromMS(nextState)).toHaveLength(0);
        expect(nextState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-0']);
        expect(nextState.core.players['1'].discard.map(card => card.uid)).toEqual(['opp-spell-1']);
        expect((resolved?.events ?? []).some(event =>
            event.type === SU_EVENTS.CARD_MOVED_TO_DECK_BOTTOM
            && (event as any).payload?.cardUid === 'opp-spell-1',
        )).toBe(false);
    });

    it('sourceController queued onActionPlayed trigger 仍应保留 Odysseus 的事件玩家语义，不在对手打行动时误起加标记 prompt', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.MYTHIC_GREEKS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [makeBase('base_oracle_at_delphi', [
                makeMinion('odysseus', 'mythic_greeks_odysseus', '0', 5),
                makeMinion('ally-1', 'wizard_apprentice', '0', 2),
            ])],
        });

        const trigger: TriggerInstance = {
            id: 'queued-odysseus-action',
            timing: 'onActionPlayed',
            sourceDefId: 'mythic_greeks_odysseus',
            sourceCardUid: 'odysseus',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            7,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core))).toHaveLength(0);
        expect((resolved?.state.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.powerCounters ?? 0)).toBe(0);
    });

    it('sourceController queued onActionPlayed trigger 仍应保留 Heracles 的任意玩家语义，在对手打行动时也给自己 +1 战力', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.MYTHIC_GREEKS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [makeBase('base_oracle_at_delphi', [
                makeMinion('heracles', 'mythic_greeks_heracles', '0', 4, { tempPowerModifier: 0 }),
            ])],
        });

        const trigger: TriggerInstance = {
            id: 'queued-heracles-action',
            timing: 'onActionPlayed',
            sourceDefId: 'mythic_greeks_heracles',
            sourceCardUid: 'heracles',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            8,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core))).toHaveLength(0);
        expect(resolved?.state.core.bases[0].minions.find(minion => minion.uid === 'heracles')?.tempPowerModifier).toBe(1);
    });

    it('sourceController queued onActionPlayed trigger 仍应保留 Spartan 的事件玩家语义，不在对手打行动时误加 +1 指示物', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 8,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.MYTHIC_GREEKS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [makeBase('base_oracle_at_delphi', [
                makeMinion('spartan', 'mythic_greeks_spartan', '0', 2, { powerCounters: 0 }),
            ])],
        });

        const trigger: TriggerInstance = {
            id: 'queued-spartan-action',
            timing: 'onActionPlayed',
            sourceDefId: 'mythic_greeks_spartan',
            sourceCardUid: 'spartan',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            8,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core))).toHaveLength(0);
        expect(resolved?.state.core.bases[0].minions.find(minion => minion.uid === 'spartan')?.powerCounters).toBe(0);
    });

    it('sourceController queued onActionPlayed trigger 仍应保留 Jason 的事件玩家语义，不在对手打行动时误起选基地 prompt', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 8,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.MYTHIC_GREEKS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('jason', 'mythic_greeks_jason', '0', 4),
                    makeMinion('own-a', 'mythic_greeks_spartan', '0', 2),
                ]),
                makeBase('base_the_deep', [
                    makeMinion('own-b', 'sharks_hammerhead', '0', 3),
                ]),
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-jason-action',
            timing: 'onActionPlayed',
            sourceDefId: 'mythic_greeks_jason',
            sourceCardUid: 'jason',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            9,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core))).toHaveLength(0);
        expect((resolved?.state.core.bases[0].minions.find(minion => minion.uid === 'own-a')?.tempPowerModifier ?? 0)).toBe(0);
        expect((resolved?.state.core.bases[1].minions.find(minion => minion.uid === 'own-b')?.tempPowerModifier ?? 0)).toBe(0);
    });

    it('queued onMinionDestroyed 多个 Sharks counter source 同时在场时，每个 source 只能结算自身一次', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.BEAR_CAVALRY],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase('base_the_deep', [
                    makeMinion('hammer-a', 'sharks_hammerhead', '0', 3, { powerCounters: 0 }),
                    makeMinion('chum-host-a', 'sharks_mako', '0', 2, {
                        powerCounters: 0,
                        attachedActions: [{ uid: 'chum-a', defId: 'sharks_chum', ownerId: '0' }] as any,
                    }),
                    makeMinion('victim-a', 'ghosts_spectre', '1', 2),
                ]),
            ],
        });

        const victim = core.bases[0].minions.find(minion => minion.uid === 'victim-a');
        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: victim,
            destroyerId: '0',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 24,
        }) as any;

        expect((queued?.payload?.triggers ?? []).map((trigger: any) => trigger.sourceDefId).sort()).toEqual([
            'sharks_chum',
            'sharks_hammerhead',
        ]);

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            24,
        );
        const prompt = prompted?.state.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const chumOption = prompt.data.options.find((option: any) => {
            const triggerId = option.value?.triggerId;
            return queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'sharks_chum');
        });
        expect(chumOption).toBeDefined();

        const resolved = resolveSmashUpReactionChoice(
            prompted!.state,
            defaultTestRandom,
            25,
            chumOption.value,
        );

        const hammer = resolved?.state.core.bases[0].minions.find(minion => minion.uid === 'hammer-a');
        const chumHost = resolved?.state.core.bases[0].minions.find(minion => minion.uid === 'chum-host-a');
        expect(resolved.events
            .filter((event: any) => event.type === SU_EVENTS.POWER_COUNTER_ADDED)
            .map((event: any) => event.payload.reason)
            .sort()).toEqual(['sharks_chum', 'sharks_hammerhead']);
        expect(hammer?.powerCounters).toBe(1);
        expect(chumHost?.powerCounters).toBe(1);
    });

    it('queued onMinionDestroyed 的单个 sharks_blood_in_the_water source 不应重复结算同基地其他玩家的同名行动', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [{
                defId: 'base_the_deep',
                minions: [
                    makeMinion('victim-a', 'ghosts_spectre', '1', 2),
                    makeMinion('destroyer-a', 'sharks_great_white', '0', 4),
                ],
                ongoingActions: [
                    { uid: 'blood-p0', defId: 'sharks_blood_in_the_water', ownerId: '0' },
                    { uid: 'blood-p1', defId: 'sharks_blood_in_the_water', ownerId: '1' },
                ] as any,
            }],
        });

        const victim = core.bases[0].minions.find(minion => minion.uid === 'victim-a');
        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: victim,
            destroyerId: '0',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 25,
        }) as any;

        const bloodTriggers = (queued?.payload?.triggers ?? [])
            .filter((trigger: any) => trigger.sourceDefId === 'sharks_blood_in_the_water');
        expect(bloodTriggers.map((trigger: any) => [trigger.sourceCardUid, trigger.sourceControllerId]).sort()).toEqual([
            ['blood-p0', '0'],
            ['blood-p1', '1'],
        ]);

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [bloodTriggers.find((trigger: any) => trigger.sourceCardUid === 'blood-p0')],
            }, 'playCards', '1'),
            defaultTestRandom,
            25,
        );

        const minionLimitEvents = resolved?.events.filter((event: any) =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload?.limitType === 'minion'
            && event.payload?.reason === 'sharks_blood_in_the_water'
        ) ?? [];
        expect(minionLimitEvents.map((event: any) => event.payload?.playerId)).toEqual(['0']);
    });

    it('queued onMinionDestroyed 的 borrowed sharks_blood_in_the_water source 应把额外随从额度交给当前控制者而不是真实 owner', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [makeBase({
                defId: 'base_the_deep',
                minions: [
                    makeMinion('victim-borrowed-blood', 'ghosts_spectre', '1', 2),
                    makeMinion('destroyer-borrowed-blood', 'sharks_great_white', '0', 4),
                ],
                ongoingActions: [
                    { uid: 'blood-borrowed', defId: 'sharks_blood_in_the_water', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                ],
            })],
        });

        const victim = core.bases[0].minions.find(minion => minion.uid === 'victim-borrowed-blood');
        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'victim-borrowed-blood',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: victim,
            destroyerId: '0',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 26,
        }) as any;

        const bloodTrigger = (queued?.payload?.triggers ?? [])
            .find((trigger: any) => trigger.sourceCardUid === 'blood-borrowed');
        expect(bloodTrigger?.sourceControllerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [bloodTrigger],
            }, 'playCards', '1'),
            defaultTestRandom,
            26,
        );

        const minionLimitEvents = resolved?.events.filter((event: any) =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload?.limitType === 'minion'
            && event.payload?.reason === 'sharks_blood_in_the_water'
        ) ?? [];
        expect(minionLimitEvents.map((event: any) => event.payload?.playerId)).toEqual(['0']);
    });

    it('queued onMinionDestroyed 全局 Sharks Mako 应选择 destroyer 自己的 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mako-p0', 'sharks_mako', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('mako-p1', 'sharks_mako', 'minion', '1')],
                    factions: [SMASHUP_FACTION_IDS.SHARKS, SMASHUP_FACTION_IDS.GHOSTS],
                }),
            },
            bases: [
                makeBase('base_the_deep', [
                    makeMinion('victim-a', 'robots_zapbot', '0', 2),
                    makeMinion('destroyer-a', 'sharks_great_white', '1', 4),
                ]),
            ],
        });

        const victim = core.bases[0].minions.find(minion => minion.uid === 'victim-a');
        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'robots_zapbot',
            triggerMinion: victim,
            destroyerId: '1',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 26,
        }) as any;

        const trigger = (queued?.payload?.triggers ?? [])
            .find((candidate: any) => candidate.sourceDefId === 'sharks_mako');
        expect([trigger?.sourceCardUid, trigger?.ownerPlayerId, trigger?.sourceControllerId]).toEqual([
            'mako-p1',
            '1',
            '1',
        ]);
    });

    it('queued onMinionDestroyed 多个 The Count POD 控制者不同时，应按 sourceController 分别给选择权', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: ['vampires', 'robots'],
                }),
                '1': makePlayer('1', {
                    factions: ['vampires', 'ghosts'],
                }),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('count-p0', 'vampire_the_count_pod', '0', 5),
                ]),
                makeBase('base_b', [
                    makeMinion('count-p1', 'vampire_the_count_pod', '1', 5),
                ]),
                makeBase('base_c', [
                    makeMinion('target-a', 'robot_microbot', '0', 2),
                    makeMinion('victim-a', 'ghosts_spectre', '1', 2),
                ]),
            ],
        });

        const victim = core.bases[2].minions.find(minion => minion.uid === 'victim-a');
        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '0'),
            playerId: '1',
            baseIndex: 2,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: victim,
            destroyerId: '0',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 30,
        }) as any;

        const countTriggers = (queued?.payload?.triggers ?? [])
            .filter((trigger: any) => trigger.sourceDefId === 'vampire_the_count_pod');
        expect(countTriggers.map((trigger: any) => [trigger.sourceCardUid, trigger.ownerPlayerId]).sort()).toEqual([
            ['count-p0', '0'],
            ['count-p1', '1'],
        ]);

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '0'),
            defaultTestRandom,
            30,
        );
        const reactionPrompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        expect(reactionPrompt?.playerId).toBe('0');

        const p0CountOption = reactionPrompt.data.options.find((option: any) => {
            const triggerId = option.value?.triggerId;
            return countTriggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceCardUid === 'count-p0');
        });
        expect(p0CountOption).toBeDefined();

        const chosen = resolveSmashUpReactionChoice(
            prompted!.state,
            defaultTestRandom,
            31,
            p0CountOption.value,
        );
        const countPrompt = getInteractionsFromMS(chosen.state)[0] as any;
        expect(countPrompt?.data?.sourceId).toBe('vampire_the_count_pod_add_counter');
        expect(countPrompt?.playerId).toBe('0');
    });

    it.each([
        ['vampire_buffet_pod', 'buffet-p1'],
        ['vampire_mad_monster_party_pod', 'party-p1'],
        ['vampire_fledgling_vampire_pod', 'fledgling-p1'],
    ])('queued onMinionDestroyed 全局 Vampire POD %s 应选择 destroyer 自己的 source', (sourceDefId, expectedUid) => {
        const p0Uid = `${sourceDefId}-p0`;
        const p1Uid = expectedUid;
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard(p0Uid, sourceDefId, 'action', '0')],
                    factions: ['vampires'],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard(p1Uid, sourceDefId, 'action', '1')],
                    factions: ['vampires'],
                }),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('victim-a', 'robots_zapbot', '0', 2),
                    makeMinion('destroyer-a', 'vampire_the_count', '1', 3),
                ]),
            ],
        });

        const victim = core.bases[0].minions.find(minion => minion.uid === 'victim-a');
        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'robots_zapbot',
            triggerMinion: victim,
            destroyerId: '1',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 40,
        }) as any;
        const trigger = (queued?.payload?.triggers ?? [])
            .find((candidate: any) => candidate.sourceDefId === sourceDefId);
        expect([trigger?.sourceCardUid, trigger?.ownerPlayerId, trigger?.sourceControllerId]).toEqual([
            expectedUid,
            '1',
            '1',
        ]);
    });

    it('sourceController queued onMinionAffected trigger 仍应把 World Champs Aramis 的额外行动交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 9,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('aramis-1', 'world_champs_aramis', '0', 4, { powerModifier: 0, tempPowerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const originalEvent = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'aramis-1',
                baseIndex: 0,
                amount: 2,
                reason: 'world_champs_fast_as_lightning',
                sourcePlayerId: '1',
                sourceDefId: 'world_champs_fast_as_lightning',
                sourceCardUid: 'enemy-fast-1',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 3300,
        };
        const afterOriginal = reduce(core, originalEvent as any);
        const queued = collectTriggers(afterOriginal, 'onMinionAffected', {
            state: afterOriginal,
            matchState: makeMatchState(afterOriginal),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'enemy-fast-1',
            sourceBaseIndex: 0,
            sourceControllerId: '1',
            triggerMinionUid: 'aramis-1',
            triggerMinionDefId: 'world_champs_aramis',
            triggerMinion: afterOriginal.bases[0].minions.find(minion => minion.uid === 'aramis-1'),
            affectType: 'power_change',
            affectEvent: originalEvent as any,
            affectBatchTargets: [{ minionUid: 'aramis-1', baseIndex: 0, controllerId: '0' }],
            reason: 'world_champs_fast_as_lightning',
            random: defaultTestRandom,
            now: 3300,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('world_champs_aramis');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...afterOriginal,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            3300,
        );
        const prompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(afterOriginal))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const triggerById = new Map(prompted?.state.core.triggerQueue?.map((trigger: any) => [trigger.id, trigger]) ?? []);
        const aramisOption = prompt?.data?.options?.find((option: any) =>
            triggerById.get(option.value?.triggerId)?.sourceDefId === 'world_champs_aramis');
        expect(aramisOption).toBeDefined();

        const resolved = runCommand(
            prompted!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: aramisOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.events.some((event: any) =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload?.playerId === '0'
            && event.payload?.limitType === 'action'
            && (event.payload?.delta ?? 0) > 0,
        )).toBe(true);
    });

    it('sourceController queued onMinionAffected trigger 仍应把 World Champs Diva 的复制反应交给控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 5,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('diva-1', 'world_champs_diva', '0', 3, { powerModifier: 0, tempPowerModifier: 0 }),
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 1, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const originalEvent = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'ally-1',
                baseIndex: 0,
                amount: 2,
                reason: 'world_champs_fast_as_lightning',
                sourcePlayerId: '1',
                sourceDefId: 'world_champs_fast_as_lightning',
                sourceCardUid: 'enemy-fast-1',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 3301,
        };
        const afterOriginal = reduce(core, originalEvent as any);
        const queued = collectTriggers(afterOriginal, 'onMinionAffected', {
            state: afterOriginal,
            matchState: makeMatchState(afterOriginal),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'enemy-fast-1',
            sourceBaseIndex: 0,
            sourceControllerId: '1',
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'robot_microbot_alpha',
            triggerMinion: afterOriginal.bases[0].minions.find(minion => minion.uid === 'ally-1'),
            affectType: 'power_change',
            affectEvent: originalEvent as any,
            affectBatchTargets: [{ minionUid: 'ally-1', baseIndex: 0, controllerId: '0' }],
            reason: 'world_champs_fast_as_lightning',
            random: defaultTestRandom,
            now: 3301,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('world_champs_diva');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...afterOriginal,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            3301,
        );
        const prompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(afterOriginal))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const triggerById = new Map(prompted?.state.core.triggerQueue?.map((trigger: any) => [trigger.id, trigger]) ?? []);
        const divaOption = prompt?.data?.options?.find((option: any) =>
            triggerById.get(option.value?.triggerId)?.sourceDefId === 'world_champs_diva');
        expect(divaOption).toBeDefined();

        const resolved = runCommand(
            prompted!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: divaOption.id } } as any,
            defaultTestRandom,
        );
        expect(resolved.events.some((event: any) =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && event.payload?.minionUid === 'diva-1'
            && event.payload?.amount === 2,
        )).toBe(true);
    });

    it('sourceController queued onCardReturnedToHand trigger 在自己随从回手时仍应把 Invisible Ninja 的抽牌选择交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('peek-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('peek-2', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2, { powerModifier: 0 })],
                ongoingActions: [],
            }],
            titans: [{
                uid: 'ninja-titan-1',
                defId: 'ninjas_invisible_ninja',
                faction: 'ninjas',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
            } as any],
        });

        const queued = collectTriggers(core, 'onCardReturnedToHand', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'returned-own',
            triggerMinionDefId: 'robot_microbot_beta',
            reason: 'test_recover_own_minion',
            random: defaultTestRandom,
            now: 3302,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ninjas_invisible_ninja');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            3302,
        );
        const prompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const triggerById = new Map(prompted?.state.core.triggerQueue?.map((trigger: any) => [trigger.id, trigger]) ?? []);
        const ninjaOption = prompt?.data?.options?.find((option: any) =>
            triggerById.get(option.value?.triggerId)?.sourceDefId === 'ninjas_invisible_ninja');
        expect(ninjaOption).toBeDefined();

        const resolved = runCommand(
            prompted!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: ninjaOption.id } } as any,
            defaultTestRandom,
        );
        const drawPrompt = getInteractionsFromMS(resolved.finalState)[0] as any;
        expect(drawPrompt?.playerId).toBe('0');
        expect(drawPrompt?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_ongoing');
    });

    it('手工回放第二条 Invisible Ninja queued source 时，draw prompt 的 continuationContext 应绑定被选中的 titanUid，而不是扫描顺序里的第一只', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('peek-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('peek-2', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('ally-a', 'robot_microbot_alpha', '0', 2, { powerModifier: 0 })]),
                makeBase('base_b', [makeMinion('ally-b', 'robot_microbot_beta', '0', 3, { powerModifier: 0 })]),
            ],
            titans: [
                {
                    uid: 'ninja-titan-a',
                    defId: 'ninjas_invisible_ninja',
                    faction: 'ninjas',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'ninja-titan-b',
                    defId: 'ninjas_invisible_ninja',
                    faction: 'ninjas',
                    ownerId: '1',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 2 },
                } as any,
            ],
        });

        const trigger: TriggerInstance = {
            id: 'queued-invisible-ninja-b',
            timing: 'onCardReturnedToHand',
            playerContext: 'sourceController',
            sourceDefId: 'ninjas_invisible_ninja',
            sourceCardUid: 'ninja-titan-b',
            sourceControllerId: '0',
            sourceBaseIndex: 1,
            mandatory: false,
            resolutionClass: 'optional',
            ownerPlayerId: '0',
            eventPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            triggerMinionUid: 'returned-own',
            triggerMinionDefId: 'robot_microbot_beta',
            sourceEventId: 'card-returned:0:3303:1',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            3303,
        );

        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const ninjaOption = prompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            const queuedTrigger = resolved?.state.core.triggerQueue?.find((entry: any) => entry.id === triggerId);
            return queuedTrigger?.sourceCardUid === 'ninja-titan-b';
        });
        expect(ninjaOption).toBeDefined();

        const afterChoice = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: ninjaOption.id } } as any,
            defaultTestRandom,
        );

        const drawPrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
        expect(drawPrompt?.playerId).toBe('0');
        expect(drawPrompt?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_ongoing');
        expect(drawPrompt?.data?.continuationContext).toEqual(expect.objectContaining({
            titanUid: 'ninja-titan-b',
            cardUids: ['peek-1', 'peek-2'],
        }));
    });

    it('sourceController queued onCardReturnedToHand trigger 在他人随从回到他人手牌时不应误给 Invisible Ninja 排抽牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('peek-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('peek-2', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2, { powerModifier: 0 })],
                ongoingActions: [],
            }],
            titans: [{
                uid: 'ninja-titan-1',
                defId: 'ninjas_invisible_ninja',
                faction: 'ninjas',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0 },
            } as any],
        });

        const queued = collectTriggers(core, 'onCardReturnedToHand', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'returned-enemy',
            triggerMinionDefId: 'robot_microbot_beta',
            reason: 'test_recover_enemy_minion',
            random: defaultTestRandom,
            now: 3303,
        }) as any;

        expect(queued).toBeUndefined();
    });

    it('sourceController queued onMinionAffected trigger 仍应把漫游山岭巨人的选择权交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.IGNOBLES, SMASHUP_FACTION_IDS.GHOSTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('hill-owned', 'ghosts_spectre', '1', 2, { owner: '0' }),
                    ],
                }),
                makeBase({
                    defId: 'base_portal_room',
                }),
            ],
            titans: [{
                uid: 'hill-1',
                defId: 'ignobles_the_hill_that_strolls',
                faction: SMASHUP_FACTION_IDS.IGNOBLES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'hill-1',
            sourceBaseIndex: 1,
            sourceControllerId: '0',
            triggerMinionUid: 'hill-owned',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'hill-owned'),
            affectType: 'control_change',
            random: defaultTestRandom,
            now: 5,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ignobles_the_hill_that_strolls');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            5,
        );

        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const hillOption = reactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            return triggerId != null && queued.payload.triggers.some((trigger: any) =>
                trigger.id === triggerId && trigger.sourceDefId === 'ignobles_the_hill_that_strolls');
        });
        expect(hillOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: hillOption.id } } as any,
            defaultTestRandom,
            5,
        );
        const counterPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(counterPrompt?.playerId).toBe('0');
        expect(counterPrompt?.data?.sourceId).toBe('titan_ignobles_the_hill_that_strolls_counter');
    });

    it('processAffectTriggers 在本次 MINION_CONTROL_CHANGED 刚把己方随从交给对手后，也应为漫游山岭巨人入队', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.IGNOBLES, SMASHUP_FACTION_IDS.GHOSTS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [
                        makeMinion('hill-give-target', 'ghosts_spectre', '0', 2, { owner: '0' }),
                    ],
                }),
                makeBase({
                    defId: 'base_portal_room',
                }),
            ],
            titans: [{
                uid: 'hill-1',
                defId: 'ignobles_the_hill_that_strolls',
                faction: SMASHUP_FACTION_IDS.IGNOBLES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        });

        const processed = processAffectTriggers([{
            type: SU_EVENTS.MINION_CONTROL_CHANGED,
            payload: {
                minionUid: 'hill-give-target',
                minionDefId: 'ghosts_spectre',
                baseIndex: 0,
                ownerId: '0',
                fromControllerId: '0',
                toControllerId: '1',
                sourcePlayerId: '0',
                sourceCardUid: 'hill-1',
                sourceDefId: 'ignobles_the_hill_that_strolls',
                sourceControllerId: '0',
                sourceBaseIndex: 1,
                reason: 'ignobles_the_hill_that_strolls_talent',
            },
            timestamp: 6,
        } as any], makeMatchState(core), '0', defaultTestRandom as any, 6);

        const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        expect(queued?.payload?.triggers?.some((trigger: any) =>
            trigger.sourceDefId === 'ignobles_the_hill_that_strolls'
            && trigger.ownerPlayerId === '0'
            && trigger.sourceControllerId === '0')).toBe(true);

        const processedCore = processed.events.reduce(
            (acc: SmashUpCore, event: any) => reduce(acc, event),
            core,
        );
        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...processedCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            6,
        );

        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(processedCore))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
    });

    it('sourceController queued onCardReturnedToHand trigger 仍应把 Time Box 的第 5 枚计数 prompt 交给拥有者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '1')],
                    factions: [SMASHUP_FACTION_IDS.SHAPESHIFTERS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('stolen-jumper', 'time_travelers_jumper', '1', 2, { owner: '0' }),
                ]),
            ],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: SMASHUP_FACTION_IDS.TIME_TRAVELERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
                metadata: { timeBoxCounters: 4 },
            } as any],
            turnNumber: 1,
        });

        const destroyed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'stolen-jumper' },
        } as any, defaultTestRandom);
        expect(destroyed.success).toBe(true);

        const extraMinionPrompt = getInteractionsFromMS(destroyed.finalState)[0] as any;
        expect(extraMinionPrompt?.playerId).toBe('0');
        expect(extraMinionPrompt?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        const skipExtraMinion = extraMinionPrompt?.data?.options?.find((option: any) => option.value?.skip === true);
        expect(skipExtraMinion).toBeDefined();

        const afterSkip = runCommand(
            destroyed.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: skipExtraMinion.id } } as any,
            defaultTestRandom,
        );

        const jumperPrompt = getInteractionsFromMS(afterSkip.finalState)[0] as any;
        expect(jumperPrompt?.playerId).toBe('1');
        expect(jumperPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const jumperOption = jumperPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            const trigger = afterSkip.finalState.core.triggerQueue?.find((entry: any) => entry.id === triggerId);
            return trigger?.sourceDefId === 'time_travelers_jumper';
        });
        expect(jumperOption).toBeDefined();

        const afterJumper = runCommand(
            afterSkip.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '1', payload: { optionId: jumperOption.id } } as any,
            defaultTestRandom,
        );

        const timeBoxReactionPrompt = getInteractionsFromMS(afterJumper.finalState)[0] as any;
        expect(timeBoxReactionPrompt?.playerId).toBe('0');
        expect(timeBoxReactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const timeBoxQueuedTrigger = afterJumper.finalState.core.triggerQueue?.find((entry: any) =>
            entry.sourceDefId === 'time_travelers_time_box',
        );
        expect(timeBoxQueuedTrigger?.ownerPlayerId).toBe('0');
        expect(timeBoxQueuedTrigger?.sourceControllerId).toBe('0');
        const timeBoxOption = timeBoxReactionPrompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            const trigger = afterJumper.finalState.core.triggerQueue?.find((entry: any) => entry.id === triggerId);
            return trigger?.sourceDefId === 'time_travelers_time_box';
        });
        expect(timeBoxOption).toBeDefined();

        const afterTimeBoxChoice = runCommand(
            afterJumper.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: timeBoxOption.id } } as any,
            defaultTestRandom,
        );

        const timeBoxPrompt = getInteractionsFromMS(afterTimeBoxChoice.finalState)[0] as any;
        expect(timeBoxPrompt?.playerId).toBe('0');
        expect(timeBoxPrompt?.data?.sourceId).toBe('titan_time_travelers_time_box_play');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始触发 Stasis Field 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{ uid: 'stasis-a', defId: 'time_travelers_stasis_field', ownerId: '0' }],
                }),
            ],
            turnNumber: 1,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 10,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 11,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('time_travelers_stasis_field');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            11,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'stasis-a',
                defId: 'time_travelers_stasis_field',
                ownerId: '0',
                reason: 'time_travelers_stasis_field',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid)).toContain('stasis-a');
    });

    it('borrowed Stasis Field 应按控制者而不是真实 owner 在控制者回合开始自毁', () => {
        const borrowedCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    deck: [makeCard('owner-deck-a', 'time_travelers_time_walk', 'action', '1')],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{
                        uid: 'stasis-borrowed',
                        defId: 'time_travelers_stasis_field',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                    } as any],
                }),
            ],
            currentPlayerIndex: 0,
            turnNumber: 1,
        });

        const queued = collectTriggers(borrowedCore, 'onTurnStart', {
            state: borrowedCore,
            matchState: makeMatchState(borrowedCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 12,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('time_travelers_stasis_field');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...borrowedCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            12,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'stasis-borrowed',
                defId: 'time_travelers_stasis_field',
                ownerId: '1',
                reason: 'time_travelers_stasis_field',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid) ?? []).not.toContain('stasis-borrowed');
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('stasis-borrowed');
    });

    it('同一控制者有两张 Stasis Field 时，queued onTurnStart 应逐实例排队并逐张自毁，而不是一次清空全部', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [
                        { uid: 'stasis-a', defId: 'time_travelers_stasis_field', ownerId: '0' } as any,
                        { uid: 'stasis-b', defId: 'time_travelers_stasis_field', ownerId: '0' } as any,
                    ],
                }),
            ],
            currentPlayerIndex: 0,
            turnNumber: 1,
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 13,
        }) as any;

        const stasisTriggers = (queued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'time_travelers_stasis_field');
        expect(stasisTriggers).toHaveLength(2);
        expect(stasisTriggers.map((trigger: any) => trigger.sourceCardUid)).toEqual(['stasis-a', 'stasis-b']);

        const firstResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: [stasisTriggers[0]],
            }),
            defaultTestRandom,
            13,
        );

        expect(firstResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'stasis-a',
                defId: 'time_travelers_stasis_field',
                ownerId: '0',
                reason: 'time_travelers_stasis_field',
            }),
        }));
        expect(firstResolved?.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'stasis-b',
            }),
        }));
        expect(firstResolved?.state.core.bases[0]?.ongoingActions.map((action: any) => action.uid)).toEqual(['stasis-b']);

        const secondResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(firstResolved?.state.core as SmashUpCore),
                triggerQueue: [stasisTriggers[1]],
            }),
            defaultTestRandom,
            14,
        );

        expect(secondResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'stasis-b',
                defId: 'time_travelers_stasis_field',
                ownerId: '0',
                reason: 'time_travelers_stasis_field',
            }),
        }));
        expect(secondResolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
    });

    it('sourceController queued onTurnEnd trigger 仍应只在拥有者回合结束让 Missing Uplink 按自己实例数给拥有者抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('uplink-draw-a', 'time_travelers_time_walk', 'action', '0'),
                        makeCard('uplink-draw-b', 'time_travelers_doctor_when', 'action', '0'),
                        makeCard('uplink-draw-c', 'time_travelers_repeater_perfect', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('enemy-draw-a', 'sharks_mako', 'minion', '1')],
                }),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('uplink-host-a', 'cyborg_apes_cyberback', '0', 4, {
                        attachedActions: [{ uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                    }),
                    makeMinion('uplink-host-b', 'cyborg_apes_baboom', '0', 5, {
                        attachedActions: [{ uid: 'uplink-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                    }),
                    makeMinion('enemy-uplink-host', 'sharks_mako', '1', 3, {
                        attachedActions: [{ uid: 'uplink-enemy', defId: 'cyborg_apes_missing_uplink', ownerId: '1' }],
                    }),
                ]),
            ],
            turnNumber: 1,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 20,
        }) as any;
        const opponentUplinkTriggers = (opponentQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger?.sourceDefId === 'cyborg_apes_missing_uplink');
        expect(opponentUplinkTriggers).toHaveLength(1);
        expect(opponentUplinkTriggers[0]?.ownerPlayerId).toBe('1');
        expect(opponentUplinkTriggers[0]?.sourceCardUid).toBe('uplink-enemy');

        const opponentResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...opponentTurnCore,
                triggerQueue: opponentUplinkTriggers,
            }),
            defaultTestRandom,
            20,
        );
        expect(opponentResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '1',
                count: 1,
                cardUids: ['enemy-draw-a'],
            }),
        }));
        expect(opponentResolved?.state.core.players['1']?.hand.map((card: any) => card.uid)).toEqual(['enemy-draw-a']);
        expect(opponentResolved?.state.core.players['0']?.hand ?? []).toEqual([]);

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 21,
        }) as any;
        const ownerUplinkTriggers = (ownerQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger?.sourceDefId === 'cyborg_apes_missing_uplink');
        expect(ownerUplinkTriggers).toHaveLength(1);
        expect(ownerUplinkTriggers[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerUplinkTriggers,
            }),
            defaultTestRandom,
            21,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 2,
                cardUids: ['uplink-draw-a', 'uplink-draw-b'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toEqual(['uplink-draw-a', 'uplink-draw-b']);
        expect(resolved?.state.core.players['1']?.hand ?? []).toEqual([]);
    });

    it('sourceController queued onTurnEnd trigger 仍应只在拥有者回合结束让 Cellular Bonding 复制的 Missing Uplink 按自己实例数给拥有者抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('bond-draw-a', 'time_travelers_time_walk', 'action', '0'),
                        makeCard('bond-draw-b', 'time_travelers_doctor_when', 'action', '0'),
                        makeCard('bond-draw-c', 'time_travelers_repeater_perfect', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('bond-enemy-draw-a', 'sharks_mako', 'minion', '1')],
                }),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('bond-host-a', 'shapeshifters_copycat', '0', 3, {
                        attachedActions: [{ uid: 'bond-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' }],
                        metadata: {
                            cellularBondingCardUid: 'bond-a',
                            cellularBondingCopiedActionDefId: 'cyborg_apes_missing_uplink',
                        },
                    }),
                    makeMinion('bond-host-b', 'shapeshifters_mimic', '0', 3, {
                        attachedActions: [{ uid: 'bond-b', defId: 'shapeshifters_cellular_bonding', ownerId: '0' }],
                        metadata: {
                            cellularBondingCardUid: 'bond-b',
                            cellularBondingCopiedActionDefId: 'cyborg_apes_missing_uplink',
                        },
                    }),
                    makeMinion('bond-host-enemy-copy', 'sharks_mako', '1', 3, {
                        attachedActions: [{ uid: 'bond-enemy', defId: 'shapeshifters_cellular_bonding', ownerId: '1' }],
                        metadata: {
                            cellularBondingCardUid: 'bond-enemy',
                            cellularBondingCopiedActionDefId: 'cyborg_apes_missing_uplink',
                        },
                    }),
                ]),
            ],
            turnNumber: 2,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 22,
        }) as any;
        const opponentBondingTriggers = (opponentQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger?.sourceDefId === 'shapeshifters_cellular_bonding');
        expect(opponentBondingTriggers).toHaveLength(1);
        expect(opponentBondingTriggers[0]?.ownerPlayerId).toBe('1');
        expect(opponentBondingTriggers[0]?.sourceCardUid).toBe('bond-enemy');

        const opponentResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...opponentTurnCore,
                triggerQueue: opponentBondingTriggers,
            }),
            defaultTestRandom,
            22,
        );
        expect(opponentResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '1',
                count: 1,
                cardUids: ['bond-enemy-draw-a'],
            }),
        }));
        expect(opponentResolved?.state.core.players['1']?.hand.map((card: any) => card.uid)).toEqual(['bond-enemy-draw-a']);
        expect(opponentResolved?.state.core.players['0']?.hand ?? []).toEqual([]);

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 23,
        }) as any;
        const ownerBondingTriggers = (ownerQueued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger?.sourceDefId === 'shapeshifters_cellular_bonding');
        expect(ownerBondingTriggers).toHaveLength(1);
        expect(ownerBondingTriggers[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerBondingTriggers,
            }),
            defaultTestRandom,
            23,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 2,
                cardUids: ['bond-draw-a', 'bond-draw-b'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toEqual(['bond-draw-a', 'bond-draw-b']);
        expect(resolved?.state.core.players['1']?.hand ?? []).toEqual([]);
    });

    it('eventPlayer queued onMinionDiscardedFromBase trigger 仍应把 Doppelganger 的搜牌 prompt 交给被弃掉该随从的玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('dopp-candidate-a', 'sharks_mako', 'minion', '0'),
                        makeCard('dopp-candidate-b', 'sharks_hammerhead', 'minion', '0'),
                    ],
                    discard: [makeCard('dopp-a', 'shapeshifters_doppelganger', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_faceless_city', [])],
            turnNumber: 7,
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'dopp-a',
            triggerMinionDefId: 'shapeshifters_doppelganger',
            random: defaultTestRandom,
            now: 120,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('shapeshifters_doppelganger');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.eventPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            120,
        );

        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core, 'playCards', '1'))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('shapeshifters_doppelganger_search');
        expect(prompt?.data?.options?.map((option: any) => option.value?.cardUid)).toEqual([
            'dopp-candidate-a',
            'dopp-candidate-b',
            undefined,
        ]);
    });

    it('queued onMinionDiscardedFromBase trigger 仍应把 Gremlin POD 的抽牌归给离场随从拥有者', () => {
        const gremlinLki = makeMinion('gremlin-a', 'trickster_gremlin_pod', '1', 2, {
            owner: '0',
        });
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('gremlin-draw-a', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('gremlin-a', 'trickster_gremlin_pod', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('enemy-deck-a', 'robot_warbot', 'minion', '1')],
                }),
            },
            bases: [makeBase('base_portal_room', [])],
            turnNumber: 8,
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'gremlin-a',
            triggerMinionDefId: 'trickster_gremlin_pod',
            triggerMinion: gremlinLki,
            random: defaultTestRandom,
            now: 130,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('trickster_gremlin_pod');
        expect(queued?.payload?.triggers?.[0]?.eventPlayerId).toBe('1');
        expect(queued?.payload?.triggers?.[0]?.lkiMinion?.owner).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            130,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 1,
                cardUids: ['gremlin-draw-a'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toEqual(['gremlin-draw-a']);
        expect(resolved?.state.core.players['1']?.hand).toEqual([]);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 World Champs Shark Tattoo 给宿主加 1 标记', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('shark-host', 'world_champs_stoneford', '0', 3, {
                        attachedActions: [{ uid: 'shark-tattoo-a', defId: 'world_champs_shark_tattoo', ownerId: '0' }],
                    }),
                ]),
            ],
            turnNumber: 2,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 12,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 13,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('world_champs_shark_tattoo');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('shark-tattoo-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            13,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'shark-host',
                baseIndex: 0,
                amount: 1,
                reason: 'world_champs_shark_tattoo',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'shark-host')?.powerCounters).toBe(1);
    });

    it('同一基地第一张 Shark Tattoo 属于其他控制者时，不应吞掉后面 borrowed source 的真实 trigger', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('shark-host-opponent', 'world_champs_stoneford', '1', 3, {
                        attachedActions: [{ uid: 'shark-tattoo-opponent', defId: 'world_champs_shark_tattoo', ownerId: '1' } as any],
                    }),
                    makeMinion('shark-host-borrowed', 'world_champs_stoneford', '0', 3, {
                        attachedActions: [{
                            uid: 'shark-tattoo-borrowed',
                            defId: 'world_champs_shark_tattoo',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                    }),
                ]),
            ],
            turnNumber: 2,
        });

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 14,
        }) as any;

        expect(ownerQueued?.payload?.triggers).toHaveLength(1);
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('world_champs_shark_tattoo');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('shark-tattoo-borrowed');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            14,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'shark-host-borrowed',
                baseIndex: 0,
                amount: 1,
                reason: 'world_champs_shark_tattoo',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'shark-host-borrowed')?.powerCounters).toBe(1);
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'shark-host-opponent')?.powerCounters ?? 0).toBe(0);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Mermaid Desert Island 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('desert-host', 'mermaids_charmer', '0', 3, {
                        attachedActions: [{ uid: 'desert-island-a', defId: 'mermaids_desert_island', ownerId: '0' }],
                    }),
                ]),
            ],
            turnNumber: 3,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 14,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 15,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('mermaids_desert_island');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('desert-island-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            15,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'desert-island-a',
                defId: 'mermaids_desert_island',
                ownerId: '0',
                reason: 'mermaids_desert_island',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'desert-host')?.attachedActions ?? []).toEqual([]);
    });

    it('borrowed Mermaid Desert Island 应按控制者回合开始自毁，但进入真实拥有者弃牌堆', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('desert-host-borrowed', 'mermaids_charmer', '0', 3, {
                        attachedActions: [{
                            uid: 'desert-island-borrowed-a',
                            defId: 'mermaids_desert_island',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                    }),
                ]),
            ],
            turnNumber: 4,
        });

        const queued = collectTriggers({
            ...baseCore,
            currentPlayerIndex: 0,
        }, 'onTurnStart', {
            state: {
                ...baseCore,
                currentPlayerIndex: 0,
            },
            matchState: makeMatchState({
                ...baseCore,
                currentPlayerIndex: 0,
            }),
            playerId: '0',
            random: defaultTestRandom,
            now: 16,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'mermaids_desert_island',
            sourceCardUid: 'desert-island-borrowed-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...baseCore,
                currentPlayerIndex: 0,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            16,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'desert-island-borrowed-a',
                defId: 'mermaids_desert_island',
                ownerId: '1',
                reason: 'mermaids_desert_island',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'desert-host-borrowed')?.attachedActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('desert-island-borrowed-a');
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid) ?? []).not.toContain('desert-island-borrowed-a');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Water Lily 为拥有者抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('p0-deck-1', 'sharks_mako', 'minion', '0')],
                    hand: [],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-1', 'wizard_apprentice', 'minion', '1')],
                    hand: [],
                }),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('water-lily-a', 'killer_plant_water_lily', '0', 2),
                ]),
            ],
            turnNumber: 6,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 12,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 13,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_water_lily');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('water-lily-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            13,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(ownerTurnCore))).toEqual([]);
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 1,
                cardUids: ['p0-deck-1'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toContain('p0-deck-1');
        expect(resolved?.state.core.players['0']?.deck).toEqual([]);
        expect(resolved?.state.core.players['1']?.hand).toEqual([]);
    });

    it('eventPlayer queued onMinionDiscardedFromBase trigger 仍应把 Sleeping Beauty 洗回其拥有者牌库而不是误记到当前回合玩家', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('sleep-deck-a', 'wizard_apprentice', 'minion', '0')],
                    discard: [makeCard('sleep-a', 'princesses_sleeping_beauty', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('enemy-deck-a', 'sharks_mako', 'minion', '1')],
                }),
            },
            bases: [makeBase('base_portal_room', [])],
            turnNumber: 6,
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'sleep-a',
            triggerMinionDefId: 'princesses_sleeping_beauty',
            random: defaultTestRandom,
            now: 110,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('princesses_sleeping_beauty');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.eventPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            110,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(core, 'playCards', '1'))).toEqual([]);
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '0',
            }),
        }));
        expect(resolved?.state.core.players['0']?.deck.map((card: any) => card.uid)).toContain('sleep-a');
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid)).not.toContain('sleep-a');
        expect(resolved?.state.core.players['1']?.deck.map((card: any) => card.uid)).toEqual(['enemy-deck-a']);
    });

    it('eventPlayer queued onMinionDiscardedFromBase trigger 从弃牌堆 fallback 定位 borrowed Sleeping Beauty 时仍应洗回真实拥有者牌库', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('borrowed-sleep-a', 'princesses_sleeping_beauty', 'minion', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('owner-deck-a', 'sharks_mako', 'minion', '1')],
                }),
            },
            bases: [makeBase('base_portal_room', [])],
            turnNumber: 6,
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'borrowed-sleep-a',
            triggerMinionDefId: 'princesses_sleeping_beauty',
            random: defaultTestRandom,
            now: 111,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('princesses_sleeping_beauty');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            111,
        );

        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid)).not.toContain('borrowed-sleep-a');
        expect(resolved?.state.core.players['0']?.deck.map((card: any) => card.uid)).not.toContain('borrowed-sleep-a');
        expect(resolved?.state.core.players['1']?.deck.map((card: any) => card.uid)).toEqual(['owner-deck-a', 'borrowed-sleep-a']);
    });

    it('queued onDeckInspected trigger 在双方都持有 Dynamite Surprise 时，应只把被翻开的那张归给其拥有者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dyn-p0', 'cowboys_dynamite_surprise', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('dyn-p1', 'cowboys_dynamite_surprise', 'action', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '0', 4)],
                ongoingActions: [],
            }],
            turnNumber: 6,
        });

        const queued = collectTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '0'),
            playerId: '0',
            inspectionCards: [{ uid: 'dyn-p1', defId: 'cowboys_dynamite_surprise' }],
            inspectionZone: 'hand',
            inspectionTargetPlayerIds: ['1'],
            inspectionCausePlayerId: '0',
            random: defaultTestRandom,
            now: 112,
        }) as any;

        expect(queued?.payload?.triggers).toHaveLength(1);
        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'cowboys_dynamite_surprise',
            sourceCardUid: 'dyn-p1',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '0'),
            defaultTestRandom,
            112,
        );

        let promptState = resolved?.state ?? makeMatchState(core, 'playCards', '0');
        const firstInteraction = getInteractionsFromMS(promptState)[0] as any;
        if (firstInteraction?.data?.sourceId === 'smashup_reaction_choose') {
            const option = firstInteraction.data.options.find((entry: any) => entry.value?.kind === 'trigger');
            expect(option).toBeDefined();
            const chosen = runCommand(promptState, {
                type: 'SYS_INTERACTION_RESPOND' as any,
                playerId: firstInteraction.playerId,
                payload: { optionId: option.id },
            } as any, defaultTestRandom);
            promptState = chosen.finalState;
        }

        const prompt = getInteractionsFromMS(promptState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');
        expect(prompt?.playerId).toBe('1');
    });

    it('queued onDeckInspected trigger 在双方都持有 Dynamite Surprise POD 时，应只把被翻开的那张归给其拥有者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dyn-p0', 'cowboys_dynamite_surprise_pod', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('dyn-p1', 'cowboys_dynamite_surprise_pod', 'action', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('target-1', 'robot_microbot_alpha', '0', 4)],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            reason: 'test_reveal_hand_pod',
            inspectionCards: [{ uid: 'dyn-p1', defId: 'cowboys_dynamite_surprise_pod' }],
            inspectionZone: 'hand',
            inspectionTargetPlayerIds: ['1'],
            inspectionCausePlayerId: '0',
            random: defaultTestRandom,
            now: 1202,
        }) as any;

        const dynamiteTriggers = (queued?.payload?.triggers ?? []).filter((trigger: any) =>
            trigger.sourceDefId === 'cowboys_dynamite_surprise_pod');
        expect(dynamiteTriggers).toHaveLength(1);
        expect(dynamiteTriggers[0]?.sourceCardUid).toBe('dyn-p1');
        expect(dynamiteTriggers[0]?.sourceControllerId).toBe('1');
        expect(dynamiteTriggers[0]?.ownerPlayerId).toBe('1');
        expect(dynamiteTriggers[0]?.eventPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(makeMatchState({
            ...core,
            triggerQueue: dynamiteTriggers,
        }), defaultTestRandom, 1203);
        expect(resolved).toBeDefined();

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');
        expect(prompt?.playerId).toBe('1');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Water Lily POD 为拥有者抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('p0-pod-deck-1', 'killer_plant_sprout_pod', 'minion', '0')],
                    hand: [],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-2', 'wizard_apprentice', 'minion', '1')],
                    hand: [],
                }),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('water-lily-pod-a', 'killer_plant_water_lily_pod', '0', 2),
                ]),
            ],
            turnNumber: 6,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 112,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 113,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_water_lily_pod');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('water-lily-pod-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            113,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(ownerTurnCore))).toEqual([]);
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 1,
                cardUids: ['p0-pod-deck-1'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toContain('p0-pod-deck-1');
        expect(resolved?.state.core.players['0']?.deck).toEqual([]);
        expect(resolved?.state.core.players['1']?.hand).toEqual([]);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始把 Sprout 的检索 prompt 交给拥有者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('sprout-deck-a', 'killer_plant_water_lily', 'minion', '0'),
                        makeCard('sprout-deck-b', 'killer_plant_sprout', 'minion', '0'),
                    ],
                    hand: [],
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-1', 'wizard_apprentice', 'minion', '1')],
                    hand: [],
                }),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('sprout-a', 'killer_plant_sprout', '0', 2),
                ]),
            ],
            turnNumber: 7,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 14,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 15,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_sprout');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('sprout-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            15,
        );

        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(ownerTurnCore))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('killer_plant_sprout_search');
        expect(prompt?.data?.options?.map((option: any) => option.value?.cardUid)).toEqual([
            'sprout-deck-a',
            'sprout-deck-b',
            undefined,
        ]);
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'sprout-a',
                minionDefId: 'killer_plant_sprout',
                ownerId: '0',
                reason: 'killer_plant_sprout',
                destroyerId: '0',
            }),
        }));
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始把 Sprout POD 的检索 prompt 交给拥有者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('sprout-pod-deck-a', 'killer_plant_water_lily_pod', 'minion', '0'),
                        makeCard('sprout-pod-deck-b', 'killer_plant_sprout_pod', 'minion', '0'),
                    ],
                    hand: [],
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-2', 'wizard_apprentice', 'minion', '1')],
                    hand: [],
                }),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('sprout-pod-a', 'killer_plant_sprout_pod', '0', 2),
                ]),
            ],
            turnNumber: 7,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 114,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 115,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_sprout_pod');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('sprout-pod-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            115,
        );

        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(ownerTurnCore))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('killer_plant_sprout_search');
        expect(prompt?.data?.options?.map((option: any) => option.value?.cardUid)).toEqual([
            'sprout-pod-deck-a',
            'sprout-pod-deck-b',
            undefined,
        ]);
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'sprout-pod-a',
                minionDefId: 'killer_plant_sprout_pod',
                ownerId: '0',
                reason: 'killer_plant_sprout',
            }),
        }));
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Choking Vines 消灭其附着随从', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    {
                        ...makeMinion('choking-target-a', 'wizard_apprentice', '1', 2),
                        attachedActions: [{ uid: 'choking-vines-a', defId: 'killer_plant_choking_vines', ownerId: '0' }],
                    } as any,
                ]),
            ],
            turnNumber: 7,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 116,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 117,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_choking_vines');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('choking-vines-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            117,
        );

        expect(getInteractionsFromMS(resolved?.state ?? makeMatchState(ownerTurnCore))).toEqual([]);
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'choking-target-a',
                minionDefId: 'wizard_apprentice',
                ownerId: '1',
                reason: 'killer_plant_choking_vines',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.minions ?? []).toEqual([]);
    });

    it('borrowed Choking Vines 应按控制者而不是真实 owner 在控制者回合开始消灭宿主', () => {
        const controllerTurnCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    {
                        ...makeMinion('choking-target-borrowed', 'wizard_apprentice', '1', 2),
                        attachedActions: [{
                            uid: 'choking-vines-borrowed-a',
                            defId: 'killer_plant_choking_vines',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        }] as any,
                    } as any,
                ]),
            ],
            turnNumber: 7,
        });

        const queued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 1171,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'killer_plant_choking_vines',
            sourceCardUid: 'choking-vines-borrowed-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            1171,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'choking-target-borrowed',
                minionDefId: 'wizard_apprentice',
                ownerId: '1',
                reason: 'killer_plant_choking_vines',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.minions ?? []).toEqual([]);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Entangled 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ancient_ruins',
                    ongoingActions: [{ uid: 'entangled-a', defId: 'killer_plant_entangled', ownerId: '0' }],
                }),
            ],
            turnNumber: 8,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 16,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 17,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_entangled');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            17,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'entangled-a',
                defId: 'killer_plant_entangled',
                ownerId: '0',
                reason: 'killer_plant_entangled_self_destruct',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
    });

    it('borrowed Entangled 应按控制者而不是真实 owner 在控制者回合开始自毁', () => {
        const controllerTurnCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ancient_ruins',
                    ongoingActions: [{
                        uid: 'entangled-borrowed-a',
                        defId: 'killer_plant_entangled',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                    } as any],
                }),
            ],
            turnNumber: 8,
        });

        const queued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 171,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'killer_plant_entangled',
            sourceCardUid: 'entangled-borrowed-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            171,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'entangled-borrowed-a',
                defId: 'killer_plant_entangled',
                ownerId: '1',
                reason: 'killer_plant_entangled_self_destruct',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('entangled-borrowed-a');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Entangled POD 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ancient_ruins',
                    ongoingActions: [{ uid: 'entangled-pod-a', defId: 'killer_plant_entangled_pod', ownerId: '0' }],
                }),
            ],
            turnNumber: 8,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 118,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 119,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_entangled_pod');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            119,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'entangled-pod-a',
                defId: 'killer_plant_entangled_pod',
                ownerId: '0',
                reason: 'killer_plant_entangled_self_destruct',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始激活 Weed Eater POD 的 metadata', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_secret_volcano_headquarters', [
                    makeMinion('weed-eater-a', 'killer_plant_weed_eater_pod', '0', 3),
                ]),
            ],
            turnNumber: 9,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 18,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 19,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_weed_eater_pod');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('weed-eater-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            19,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: expect.objectContaining({
                minionUid: 'weed-eater-a',
                baseIndex: 0,
                metadataUpdate: { weedEaterEmpowered: true },
                reason: 'killer_plant_weed_eater_pod',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'weed-eater-a')?.metadata)
            .toMatchObject({ weedEaterEmpowered: true });
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Overgrowth 写入 breakpoint modifier', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    ongoingActions: [{ uid: 'overgrowth-a', defId: 'killer_plant_overgrowth', ownerId: '0' }],
                }),
            ],
            turnNumber: 10,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 20,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 21,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plant_overgrowth');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            21,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 0,
                baseDefId: 'base_the_jungle',
                delta: -12,
                reason: 'killer_plant_overgrowth',
            }),
        }));
        expect(resolved?.state.core.tempBreakpointModifiers?.[0]).toBe(-12);
    });

    it('borrowed Overgrowth 应按控制者而不是真实 owner 在控制者回合开始降低临界点', () => {
        const controllerTurnCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    ongoingActions: [{
                        uid: 'overgrowth-borrowed-a',
                        defId: 'killer_plant_overgrowth',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                    } as any],
                }),
            ],
            turnNumber: 10,
        });

        const queued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 211,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'killer_plant_overgrowth',
            sourceCardUid: 'overgrowth-borrowed-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            211,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 0,
                baseDefId: 'base_the_jungle',
                delta: -12,
                reason: 'killer_plant_overgrowth',
            }),
        }));
        expect(resolved?.state.core.tempBreakpointModifiers?.[0]).toBe(-12);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始触发 Cthulhu Complete the Ritual 清场换基地', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
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
                    ongoingActions: [
                        { uid: 'ritual-a', defId: 'cthulhu_complete_the_ritual', ownerId: '0' },
                        { uid: 'ritual-side-a', defId: 'cthulhu_altar', ownerId: '0' },
                    ],
                }),
            ],
            baseDeck: ['base_faceless_city'],
            turnNumber: 11,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 22,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 23,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('cthulhu_complete_the_ritual');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('ritual-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            23,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'ritual-a',
                defId: 'cthulhu_complete_the_ritual',
                ownerId: '0',
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

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Zombie Overrun 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{ uid: 'overrun-a', defId: 'zombie_overrun', ownerId: '0' }],
                }),
            ],
            turnNumber: 12,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 24,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 25,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('zombie_overrun');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('overrun-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            25,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'overrun-a',
                defId: 'zombie_overrun',
                ownerId: '0',
                reason: 'zombie_overrun_self_destruct',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid)).toContain('overrun-a');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Zombie Overrun POD 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{ uid: 'overrun-pod-a', defId: 'zombie_overrun_pod', ownerId: '0' }],
                }),
            ],
            turnNumber: 12,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 124,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 125,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('zombie_overrun_pod');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('overrun-pod-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            125,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'overrun-pod-a',
                defId: 'zombie_overrun_pod',
                ownerId: '0',
                reason: 'zombie_overrun_self_destruct',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid)).toContain('overrun-pod-a');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Werewolf Marking Territory 写入 breakpoint modifier', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('mt-own-a', 'werewolf_alpha', '0', 4),
                        makeMinion('mt-own-b', 'werewolf_pack_alpha', '0', 3),
                        makeMinion('mt-opp-a', 'sharks_mako', '1', 2),
                    ],
                    ongoingActions: [{ uid: 'mt-a', defId: 'werewolf_marking_territory', ownerId: '0' }],
                }),
            ],
            turnNumber: 13,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 26,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 27,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('werewolf_marking_territory');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('mt-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            27,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 0,
                delta: -12,
                reason: 'werewolf_marking_territory',
            }),
        }));
        expect(resolved?.state.core.tempBreakpointModifiers?.[0]).toBe(-12);
    });

    it('borrowed Werewolf Marking Territory 应按控制者而不是真实 owner 在控制者回合开始写入 breakpoint modifier', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('mt-borrowed-own-a', 'werewolf_alpha', '0', 4),
                        makeMinion('mt-borrowed-own-b', 'werewolf_pack_alpha', '0', 3),
                        makeMinion('mt-borrowed-opp-a', 'sharks_mako', '1', 2),
                    ],
                    ongoingActions: [{
                        uid: 'mt-borrowed-a',
                        defId: 'werewolf_marking_territory',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                    }],
                }),
            ],
            turnNumber: 14,
        });

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const queued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 28,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'werewolf_marking_territory',
            sourceCardUid: 'mt-borrowed-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            playerContext: 'sourceController',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            28,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: expect.objectContaining({
                baseIndex: 0,
                delta: -12,
                reason: 'werewolf_marking_territory',
            }),
        }));
        expect(resolved?.state.core.tempBreakpointModifiers?.[0]).toBe(-12);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Vampire Summon Wolves 增加 ongoing card counter', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{ uid: 'wolves-a', defId: 'vampire_summon_wolves', ownerId: '0', metadata: { powerCounters: 0 } }],
                }),
            ],
            turnNumber: 14,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 28,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 29,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('vampire_summon_wolves');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('wolves-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            29,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED,
            payload: expect.objectContaining({
                cardUid: 'wolves-a',
                delta: 1,
                reason: 'vampire_summon_wolves',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.ongoingActions ?? []).find((ongoing: any) => ongoing.uid === 'wolves-a')?.metadata?.powerCounters).toBe(1);
    });

    it('borrowed Vampire Summon Wolves 应按控制者而不是真实 owner 在控制者回合开始增加 ongoing card counter', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    ongoingActions: [{
                        uid: 'wolves-borrowed-a',
                        defId: 'vampire_summon_wolves',
                        ownerId: '1',
                        metadata: {
                            powerCounters: 0,
                            sourceControllerId: '0',
                        },
                    }],
                }),
            ],
            turnNumber: 15,
        });

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const queued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 30,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'vampire_summon_wolves',
            sourceCardUid: 'wolves-borrowed-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            playerContext: 'sourceController',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            30,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED,
            payload: expect.objectContaining({
                cardUid: 'wolves-borrowed-a',
                delta: 1,
                reason: 'vampire_summon_wolves',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.ongoingActions ?? []).find((ongoing: any) => ongoing.uid === 'wolves-borrowed-a')?.metadata?.powerCounters).toBe(1);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Frankenstein Uberserum 给宿主加 1 标记', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('uber-host', 'frankenstein_the_monster', '0', 4, {
                        attachedActions: [{ uid: 'uber-a', defId: 'frankenstein_uberserum', ownerId: '0' }],
                    }),
                ]),
            ],
            turnNumber: 15,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 30,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 31,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('frankenstein_uberserum');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('uber-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            31,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'uber-host',
                baseIndex: 0,
                amount: 1,
                reason: 'frankenstein_uberserum',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'uber-host')?.powerCounters).toBe(1);
    });

    it('borrowed Frankenstein Uberserum 应按控制者而不是真实 owner 在控制者回合开始给宿主加 1 标记', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('uber-host', 'frankenstein_the_monster', '0', 4, {
                        attachedActions: [{
                            uid: 'uber-borrowed',
                            defId: 'frankenstein_uberserum',
                            ownerId: '1',
                            metadata: {
                                sourcePlayerId: '0',
                                sourceControllerId: '0',
                            },
                        } as any],
                    }),
                ]),
            ],
            turnNumber: 16,
        });

        const controllerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const controllerQueued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 32,
        }) as any;

        expect(controllerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('frankenstein_uberserum');
        expect(controllerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(controllerQueued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');
        expect(controllerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('uber-borrowed');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: controllerQueued.payload.triggers,
            }),
            defaultTestRandom,
            32,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'uber-host',
                baseIndex: 0,
                amount: 1,
                reason: 'frankenstein_uberserum',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'uber-host')?.powerCounters).toBe(1);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Ninja Smoke Bomb 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('smoke-host', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'smoke-a', defId: 'ninja_smoke_bomb', ownerId: '0' }],
                    }),
                ]),
            ],
            turnNumber: 16,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 32,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 33,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('ninja_smoke_bomb');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('smoke-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            33,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'smoke-a',
                defId: 'ninja_smoke_bomb',
                ownerId: '0',
                reason: 'ninja_smoke_bomb_self_destruct',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'smoke-host')?.attachedActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid)).toContain('smoke-a');
    });

    it('borrowed Ninja Smoke Bomb 应按控制者而不是真实 owner 在控制者回合开始自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('smoke-host-borrowed', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'smoke-borrowed-a', defId: 'ninja_smoke_bomb', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
                    }),
                ]),
            ],
            turnNumber: 16,
        });

        const queued = collectTriggers({
            ...baseCore,
            currentPlayerIndex: 0,
        }, 'onTurnStart', {
            state: {
                ...baseCore,
                currentPlayerIndex: 0,
            },
            matchState: makeMatchState({
                ...baseCore,
                currentPlayerIndex: 0,
            }),
            playerId: '0',
            random: defaultTestRandom,
            now: 34,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('ninja_smoke_bomb');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceCardUid).toBe('smoke-borrowed-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...baseCore,
                currentPlayerIndex: 0,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            34,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'smoke-borrowed-a',
                defId: 'ninja_smoke_bomb',
                ownerId: '1',
                reason: 'ninja_smoke_bomb_self_destruct',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'smoke-host-borrowed')?.attachedActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('smoke-borrowed-a');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Ninja Infiltrate 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('infiltrate-host', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'infiltrate-a', defId: 'ninja_infiltrate', ownerId: '0' }],
                    }),
                ]),
            ],
            turnNumber: 17,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 34,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 35,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('ninja_infiltrate');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('infiltrate-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            35,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'infiltrate-a',
                defId: 'ninja_infiltrate',
                ownerId: '0',
                reason: 'ninja_infiltrate_expired',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'infiltrate-host')?.attachedActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid)).toContain('infiltrate-a');
    });

    it('borrowed Ninja Infiltrate 应按控制者而不是真实 owner 在控制者回合开始自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('infiltrate-host-borrowed', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'infiltrate-borrowed-a', defId: 'ninja_infiltrate', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
                    }),
                ]),
            ],
            turnNumber: 17,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 34,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const controllerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const controllerQueued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 35,
        }) as any;

        expect(controllerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('ninja_infiltrate');
        expect(controllerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(controllerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('infiltrate-borrowed-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: controllerQueued.payload.triggers,
            }),
            defaultTestRandom,
            35,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'infiltrate-borrowed-a',
                defId: 'ninja_infiltrate',
                ownerId: '1',
                reason: 'ninja_infiltrate_expired',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'infiltrate-host-borrowed')?.attachedActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('infiltrate-borrowed-a');
    });

    it('sourceController queued onTurnEnd trigger 仍应只在拥有者回合结束让 Ninja Assassination 消灭宿主', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('assassin-host', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'assassination-a', defId: 'ninja_assassination', ownerId: '0' }],
                    }),
                ]),
            ],
            turnNumber: 18,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 36,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 37,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('ninja_assassination');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('assassination-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            37,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'assassin-host',
                fromBaseIndex: 0,
                ownerId: '1',
                destroyerId: '0',
                reason: 'ninja_assassination',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'assassin-host')).toBeUndefined();
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('assassin-host');
    });

    it('borrowed Ninja Assassination 应按控制者而不是真实 owner 在控制者回合结束消灭宿主', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('assassin-host-borrowed', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'assassination-borrowed-a', defId: 'ninja_assassination', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
                    }),
                ]),
            ],
            turnNumber: 18,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 36,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const controllerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const controllerQueued = collectTriggers(controllerTurnCore, 'onTurnEnd', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 37,
        }) as any;

        expect(controllerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('ninja_assassination');
        expect(controllerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(controllerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('assassination-borrowed-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: controllerQueued.payload.triggers,
            }),
            defaultTestRandom,
            37,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'assassin-host-borrowed',
                fromBaseIndex: 0,
                ownerId: '1',
                destroyerId: '0',
                reason: 'ninja_assassination',
            }),
        }));
        expect((resolved?.state.core.bases[0]?.minions ?? []).find((minion: any) => minion.uid === 'assassin-host-borrowed')).toBeUndefined();
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('assassin-host-borrowed');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Bear Necessities POD 自毁', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [],
                ongoingActions: [{ uid: 'bear-need-a', defId: 'bear_cavalry_bear_necessities_pod', ownerId: '0', talentUsed: true } as any],
            }],
            turnNumber: 19,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 38,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 39,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('bear_cavalry_bear_necessities_pod');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('bear-need-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            39,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'bear-need-a',
                defId: 'bear_cavalry_bear_necessities_pod',
                ownerId: '0',
                reason: 'bear_cavalry_bear_necessities_pod',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['0']?.discard.map((card: any) => card.uid)).toContain('bear-need-a');
    });

    it('borrowed bear_cavalry_bear_necessities_pod 应按控制者而不是真实 owner 在下回合开始时自毁', () => {
        const controllerTurnCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [],
                ongoingActions: [{
                    uid: 'bear-need-borrowed-a',
                    defId: 'bear_cavalry_bear_necessities_pod',
                    ownerId: '1',
                    talentUsed: true,
                    metadata: { sourceControllerId: '0' },
                } as any],
            }],
            turnNumber: 19,
        });

        const queued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 391,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'bear_cavalry_bear_necessities_pod',
            sourceCardUid: 'bear-need-borrowed-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            391,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'bear-need-borrowed-a',
                defId: 'bear_cavalry_bear_necessities_pod',
                ownerId: '1',
                reason: 'bear_cavalry_bear_necessities_pod',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.ongoingActions ?? []).toEqual([]);
        expect(resolved?.state.core.players['1']?.discard.map((card: any) => card.uid)).toContain('bear-need-borrowed-a');
    });

    it('sourceController queued onTurnEnd trigger 仍应只在拥有者回合结束让 Week of Sharks 给拥有者抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('week-draw-a', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [makeMinion('week-host', 'sharks_mako', '0', 2)],
                ongoingActions: [{ uid: 'week-a', defId: 'sharks_week_of_sharks', ownerId: '0' } as any],
            }],
            turnNumber: 20,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 40,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 41,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('sharks_week_of_sharks');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('week-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            41,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 1,
                cardUids: ['week-draw-a'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toContain('week-draw-a');
    });

    it('borrowed Week of Sharks 应按控制者而不是真实 owner 在控制者回合结束抽牌', () => {
        const borrowedCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('week-draw-borrowed', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [makeMinion('week-host-borrowed', 'sharks_mako', '0', 2)],
                ongoingActions: [{
                    uid: 'week-borrowed',
                    defId: 'sharks_week_of_sharks',
                    ownerId: '1',
                    metadata: { sourceControllerId: '0' },
                } as any],
            }],
            turnNumber: 20,
        });

        const queued = collectTriggers(borrowedCore, 'onTurnEnd', {
            state: borrowedCore,
            matchState: makeMatchState(borrowedCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 42,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('sharks_week_of_sharks');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...borrowedCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            42,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 1,
                cardUids: ['week-draw-borrowed'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toContain('week-draw-borrowed');
        expect(resolved?.state.core.players['1']?.hand.map((card: any) => card.uid) ?? []).not.toContain('week-draw-borrowed');
    });

    it('sourceController queued onTurnEnd trigger 仍应只在拥有者回合结束让 Difference Engine 给拥有者抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('diff-draw-a', 'steampunk_mechanic', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [makeMinion('diff-host', 'steampunk_mechanic', '0', 2)],
                ongoingActions: [{ uid: 'diff-a', defId: 'steampunk_difference_engine', ownerId: '0' } as any],
            }],
            turnNumber: 21,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 42,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 43,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('steampunk_difference_engine');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('diff-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            43,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 1,
                cardUids: ['diff-draw-a'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toContain('diff-draw-a');
    });

    it('sourceController queued onTurnEnd trigger 应按控制者而不是真实 owner 让 borrowed 七娃在控制者回合结束抽牌', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('qiwa-draw-a', 'huluwawa_pop', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('qiwa-owner-draw-a', 'huluwawa_jade_ruyi', 'action', '1')],
                }),
            },
            bases: [makeBase('base_huluwawa_mountain', [
                makeMinion('qiwa-borrowed', 'huluwawa_qi_wa', '0', 4, {
                    owner: '1',
                    attachedActions: [{ uid: 'qiwa-attach-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
            ])],
            turnNumber: 21,
        });

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 44,
        }) as any;
        expect(ownerQueued).toBeUndefined();

        const controllerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const controllerQueued = collectTriggers(controllerTurnCore, 'onTurnEnd', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 45,
        }) as any;

        expect(controllerQueued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'huluwawa_qi_wa',
            sourceCardUid: 'qiwa-borrowed',
            ownerPlayerId: '0',
            eventPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: controllerQueued.payload.triggers,
            }),
            defaultTestRandom,
            45,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 1,
                cardUids: ['qiwa-draw-a'],
            }),
        }));
        expect(resolved?.state.core.players['0']?.hand.map((card: any) => card.uid)).toContain('qiwa-draw-a');
        expect(resolved?.state.core.players['1']?.hand.map((card: any) => card.uid) ?? []).not.toContain('qiwa-owner-draw-a');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始把 Flame Trap POD 的 breakpoint prompt 交给拥有者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [],
                ongoingActions: [{ uid: 'flame-a', defId: 'trickster_flame_trap_pod', ownerId: '0' } as any],
            }],
            turnNumber: 22,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 44,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 45,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('trickster_flame_trap_pod');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('flame-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            45,
        );

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('trickster_flame_trap_pod_bp');
    });

    it('borrowed Flame Trap POD 应按控制者而不是真实 owner 在控制者回合开始弹出 breakpoint prompt', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [],
                ongoingActions: [{ uid: 'flame-borrowed-a', defId: 'trickster_flame_trap_pod', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
            }],
            turnNumber: 22,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 44,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const controllerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const controllerQueued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 45,
        }) as any;

        expect(controllerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('trickster_flame_trap_pod');
        expect(controllerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(controllerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('flame-borrowed-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: controllerQueued.payload.triggers,
            }),
            defaultTestRandom,
            45,
        );

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('trickster_flame_trap_pod_bp');
    });

    it('深化目标应在任意玩家回合结束检查本回合被消灭的其他玩家随从，并给控制者 1 VP', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [],
                ongoingActions: [{ uid: 'cause-a', defId: 'cthulhu_furthering_the_cause', ownerId: '0' } as any],
            }],
            turnDestroyedMinions: [{ uid: 'dead-opp', defId: 'sharks_mako', baseIndex: 0, owner: '1' } as any],
            turnNumber: 23,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 46,
        }) as any;
        expect(opponentQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('cthulhu_furthering_the_cause');
        expect(opponentQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('1');
        expect(opponentQueued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');
        expect(opponentQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('cause-a');

        const opponentResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...opponentTurnCore,
                triggerQueue: opponentQueued.payload.triggers,
            }),
            defaultTestRandom,
            46,
        );

        expect(opponentResolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({
                playerId: '0',
                amount: 1,
                reason: 'cthulhu_furthering_the_cause',
            }),
        }));
        expect(opponentResolved?.state.core.players['0']?.vp).toBe(1);

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 47,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('cthulhu_furthering_the_cause');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('cause-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            47,
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
    });

    it('sourceController queued onTurnEnd trigger 遇到被他人控制但归自己拥有的 destroyed minion 时，Furthering the Cause 仍应按控制权给拥有者 1 VP', () => {
        const ownerTurnCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [],
                ongoingActions: [{ uid: 'cause-a', defId: 'cthulhu_furthering_the_cause', ownerId: '0' } as any],
            }],
            turnDestroyedMinions: [{ uid: 'dead-stolen', defId: 'sharks_mako', baseIndex: 0, owner: '0', controller: '1' } as any],
            turnNumber: 24,
        });

        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 48,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('cthulhu_furthering_the_cause');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            48,
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
    });

    it('sourceController queued onTurnEnd trigger 仍应只在拥有者回合结束让 Dunwich Horror 消灭宿主', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_portal_room',
                breakpoint: 20,
                minions: [{
                    uid: 'dunwich-host',
                    defId: 'sharks_mako',
                    controller: '0',
                    owner: '0',
                    basePower: 3,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: false,
                    attachedActions: [{ uid: 'dunwich-a', defId: 'elder_thing_dunwich_horror', ownerId: '0' }],
                }],
                ongoingActions: [],
            }],
            turnNumber: 23,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 48,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 49,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('elder_thing_dunwich_horror');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('dunwich-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            49,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({
                minionUid: 'dunwich-host',
                reason: 'elder_thing_dunwich_horror',
                destroyerId: '0',
            }),
        }));
        expect(resolved?.state.core.bases[0]?.minions ?? []).toEqual([]);
    });

    it('sourceController queued onTurnEnd trigger 仍应只在控制者回合结束让 Very Large Boulder 加 1 标记', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.EXPLORERS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_portal_room', [])],
            titans: [{
                uid: 'boulder-end-a',
                defId: 'explorers_very_large_boulder',
                faction: SMASHUP_FACTION_IDS.EXPLORERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
            turnNumber: 24,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 48,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 49,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('explorers_very_large_boulder');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('boulder-end-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            49,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 'boulder-end-a',
                amount: 1,
                reason: 'explorers_very_large_boulder',
            }),
        }));
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'boulder-end-a')?.powerCounters).toBe(1);
    });

    it('sourceController queued onTurnEnd trigger 仍应只在控制者回合结束让 Big Funny Giant 加 1 标记', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_portal_room',
                minions: [makeMinion('giant-own-a', 'trickster_gnome', '0', 2)],
            })],
            titans: [{
                uid: 'giant-a',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
            turnNumber: 25,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnEnd', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 50,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnEnd', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 51,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('tricksters_big_funny_giant');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('giant-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            51,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 'giant-a',
                amount: 1,
                reason: 'tricksters_big_funny_giant',
            }),
        }));
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'giant-a')?.powerCounters).toBe(1);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始把 Invisible Ninja 的 start-turn prompt 交给拥有者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_portal_room', [])],
            titans: [{
                uid: 'invisible-a',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
            turnNumber: 26,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 52,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 53,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('ninjas_invisible_ninja');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('invisible-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            53,
        );

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_start_turn');
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'invisible-a')?.metadata?.invisibleNinjaStartTurn).toBe(26);
    });

    it('sourceController queued onTurnStart trigger 在 borrowed Invisible Ninja 上仍应把 prompt 交给当前控制者，并保留 start-turn metadata', () => {
        const controllerTurnCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_portal_room', [])],
            titans: [{
                uid: 'borrowed-invisible-a',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '1',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
            turnNumber: 27,
        });

        const queued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 54,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'ninjas_invisible_ninja',
            sourceCardUid: 'borrowed-invisible-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            54,
        );

        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_ninjas_invisible_ninja_start_turn');
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'borrowed-invisible-a')?.metadata?.invisibleNinjaStartTurn).toBe(27);
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始让 Killer Kudzu 在 setaside 时加 1 标记', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_jungle', [])],
            titans: [{
                uid: 'kudzu-a',
                defId: 'killer_plants_killer_kudzu',
                faction: SMASHUP_FACTION_IDS.KILLER_PLANTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
            turnNumber: 19,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 38,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 39,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('killer_plants_killer_kudzu');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('kudzu-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            39,
        );

        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 'kudzu-a')?.powerCounters).toBe(1);
    });

    it('sourceController queued onTurnStart trigger 仍应把 The Bride 的起始分支选择交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WIZARDS],
                    hand: [makeCard('bride-hand-minion', 'frankenstein_igor', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase('base_the_factory', [
                    {
                        ...makeMinion('bride-counter-target', 'frankenstein_lab_assistant', '0', 2),
                        powerCounters: 1,
                    },
                ]),
            ],
            titans: [{
                uid: 'bride-setaside',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const trigger: TriggerInstance = {
            id: 'queued-bride-turn-start',
            timing: 'onTurnStart',
            playerContext: 'sourceController',
            sourceDefId: 'frankenstein_the_bride',
            sourceCardUid: 'bride-setaside',
            sourceControllerId: '0',
            mandatory: false,
            resolutionClass: 'optional',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            sourceEventId: 'turn-start:1:9:0',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            40,
        );

        const reactionPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const brideOption = reactionPrompt?.data?.options?.find((option: any) => option?.value?.triggerId === 'queued-bride-turn-start');
        expect(brideOption).toBeDefined();

        const chosen = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: brideOption.id } } as any,
            defaultTestRandom,
        );
        const bridePrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(bridePrompt?.playerId).toBe('0');
        expect(bridePrompt?.data?.sourceId).toBe('titan_frankenstein_the_bride_start_choose_branch');
    });

    it('sourceController queued onMinionAffected trigger 仍应把 The Bride 的抽牌结算归给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 3,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WIZARDS],
                    deck: [makeCard('bride-draw-a', 'frankenstein_igor', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase('base_the_factory', [
                    makeMinion('bride-counter-target', 'frankenstein_lab_assistant', '0', 2),
                ]),
            ],
            titans: [{
                uid: 'bride-on-base',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'bride-counter-target',
            triggerMinionDefId: 'frankenstein_lab_assistant',
            triggerMinion: core.bases[0].minions[0],
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            reason: 'test_bride_counter_added',
            random: defaultTestRandom,
            now: 41,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'frankenstein_the_bride',
            sourceCardUid: 'bride-on-base',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            41,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                cardUids: ['bride-draw-a'],
            }),
        }));
    });

    it('collectTriggers onMinionAffected 处理 frankenstein_the_bride 时，若第一只本回合已触发应改选仍可触发的第二只 source', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 4,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WIZARDS],
                    deck: [makeCard('bride-draw-a', 'frankenstein_igor', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.ROBOTS],
                }),
            },
            bases: [
                makeBase('base_the_factory', [
                    makeMinion('bride-counter-target', 'frankenstein_lab_assistant', '0', 2),
                ]),
            ],
            titans: [
                {
                    uid: 'bride-a',
                    defId: 'frankenstein_the_bride',
                    faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    metadata: { theBrideTriggeredTurn: 4 },
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'bride-b',
                    defId: 'frankenstein_the_bride',
                    faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 2 },
                } as any,
            ],
        });

        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'bride-counter-target',
            triggerMinionDefId: 'frankenstein_lab_assistant',
            triggerMinion: core.bases[0].minions[0],
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            reason: 'test_bride_second_source',
            random: defaultTestRandom,
            now: 42,
        }) as any;

        const brideTrigger = queued?.payload?.triggers?.find((trigger: TriggerInstance) =>
            trigger.sourceDefId === 'frankenstein_the_bride');
        expect(brideTrigger).toEqual(expect.objectContaining({
            sourceCardUid: 'bride-b',
            sourceControllerId: '0',
            eventPlayerId: '1',
        }));
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始把 Emperor Penguin 的进场选择交给拥有者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('penguin-own-a', 'penguins_cute_and_cuddly', '0', 2),
                    makeMinion('penguin-own-b', 'penguins_cute_and_cuddly', '0', 2),
                    makeMinion('penguin-own-c', 'penguins_cute_and_cuddly', '0', 2),
                ]),
            ],
            titans: [{
                uid: 'penguin-a',
                defId: 'penguins_emperor_penguin',
                faction: SMASHUP_FACTION_IDS.PENGUINS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
            turnNumber: 20,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 40,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 41,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('penguins_emperor_penguin');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('penguin-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            41,
        );
        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_penguins_emperor_penguin_play');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始把 Mergacon 的进场选择交给拥有者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('mergacon-own-a', 'changerbots_assimilator', '0', 3),
                    makeMinion('mergacon-own-b', 'changerbots_assimilator', '0', 3),
                ]),
            ],
            titans: [{
                uid: 'mergacon-a',
                defId: 'changerbots_mergacon',
                faction: SMASHUP_FACTION_IDS.CHANGERBOTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
            turnNumber: 21,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 42,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 43,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('changerbots_mergacon');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('mergacon-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            43,
        );
        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_changerbots_mergacon_play');
    });

    it('sourceController queued onTurnStart trigger 仍应只在拥有者回合开始把 Sphinx 的回手选择交给拥有者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ancient_ruins',
                    buriedCards: [{
                        uid: 'sphinx-buried-a',
                        defId: 'ancient_egyptians_lost_knowledge',
                        ownerId: '0',
                        controllerId: '0',
                        buriedFrom: 'discard',
                    } as any],
                }),
            ],
            titans: [{
                uid: 'sphinx-a',
                defId: 'sphinx',
                faction: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
            turnNumber: 22,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 44,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 45,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('sphinx');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('sphinx-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            45,
        );
        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_sphinx_start_turn');
    });

    it('sourceController queued onTurnStart trigger 在 borrowed Sphinx 上仍应把回手选择交给当前控制者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ancient_ruins',
                    buriedCards: [{
                        uid: 'borrowed-sphinx-buried-a',
                        defId: 'ancient_egyptians_lost_knowledge',
                        ownerId: '0',
                        controllerId: '0',
                        buriedFrom: 'discard',
                    } as any],
                }),
            ],
            titans: [{
                uid: 'borrowed-sphinx-a',
                defId: 'sphinx',
                faction: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                ownerId: '1',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
            turnNumber: 22,
        });

        const controllerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const queued = collectTriggers(controllerTurnCore, 'onTurnStart', {
            state: controllerTurnCore,
            matchState: makeMatchState(controllerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 46,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('sphinx');
        expect(queued?.payload?.triggers?.[0]?.sourceCardUid).toBe('borrowed-sphinx-a');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...controllerTurnCore,
                triggerQueue: queued.payload.triggers,
            }),
            defaultTestRandom,
            46,
        );
        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('titan_sphinx_start_turn');
    });

    it('sourceController queued onTurnStart trigger 仍应只在控制者回合开始把 Great Wolf Spirit 的移动选择交给控制者', () => {
        const baseCore = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('wolf-own-a', 'werewolf_alpha', '0', 4),
                ]),
                makeBase('base_the_jungle', [
                    makeMinion('wolf-own-b', 'werewolf_pack_alpha', '0', 4),
                    makeMinion('wolf-opp-a', 'sharks_mako', '1', 2),
                ]),
            ],
            titans: [{
                uid: 'wolf-spirit-a',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
            turnNumber: 23,
        });

        const opponentTurnCore = {
            ...baseCore,
            currentPlayerIndex: 1,
        };
        const opponentQueued = collectTriggers(opponentTurnCore, 'onTurnStart', {
            state: opponentTurnCore,
            matchState: makeMatchState(opponentTurnCore),
            playerId: '1',
            random: defaultTestRandom,
            now: 46,
        }) as any;
        expect(opponentQueued).toBeUndefined();

        const ownerTurnCore = {
            ...baseCore,
            currentPlayerIndex: 0,
        };
        const ownerQueued = collectTriggers(ownerTurnCore, 'onTurnStart', {
            state: ownerTurnCore,
            matchState: makeMatchState(ownerTurnCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 47,
        }) as any;

        expect(ownerQueued?.payload?.triggers?.[0]?.sourceDefId).toBe('werewolves_great_wolf_spirit');
        expect(ownerQueued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(ownerQueued?.payload?.triggers?.[0]?.sourceCardUid).toBe('wolf-spirit-a');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...ownerTurnCore,
                triggerQueue: ownerQueued.payload.triggers,
            }),
            defaultTestRandom,
            47,
        );
        const prompt = getInteractionsFromMS(resolved!.state)[0] as any;
        expect(prompt?.playerId).toBe('0');

        if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
            const wolfSpiritOption = prompt?.data?.options?.find((option: any) => {
                const triggerId = option?.value?.triggerId;
                const trigger = resolved?.state.core.triggerQueue?.find((entry: any) => entry.id === triggerId);
                return trigger?.sourceDefId === 'werewolves_great_wolf_spirit';
            });
            expect(wolfSpiritOption).toBeDefined();

            const afterChoice = runCommand(
                resolved!.state,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: wolfSpiritOption.id } } as any,
                defaultTestRandom,
            );

            const wolfSpiritPrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
            expect(wolfSpiritPrompt?.playerId).toBe('0');
            expect(wolfSpiritPrompt?.data?.sourceId).toBe('titan_werewolves_great_wolf_spirit_move');
            return;
        }

        expect(prompt?.data?.sourceId).toBe('titan_werewolves_great_wolf_spirit_move');
    });

    it('手工回放第二条 Great Wolf Spirit queued source 时，continuationContext 应绑定被选中的 titanUid 与 fromBaseIndex，而不是扫描顺序里的第一只', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('wolf-a-own', 'werewolf_alpha', '0', 5),
                ]),
                makeBase('base_the_jungle', [
                    makeMinion('wolf-b-own', 'werewolf_pack_alpha', '0', 5),
                ]),
                makeBase('base_faceless_city', [
                    makeMinion('wolf-opp', 'sharks_mako', '1', 2),
                ]),
            ],
            titans: [
                {
                    uid: 'wolf-spirit-a',
                    defId: 'werewolves_great_wolf_spirit',
                    faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                } as any,
                {
                    uid: 'wolf-spirit-b',
                    defId: 'werewolves_great_wolf_spirit',
                    faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                    ownerId: '1',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 2 },
                } as any,
            ],
            turnNumber: 24,
        });

        const trigger: TriggerInstance = {
            id: 'queued-great-wolf-spirit-b',
            timing: 'onTurnStart',
            playerContext: 'sourceController',
            sourceDefId: 'werewolves_great_wolf_spirit',
            sourceCardUid: 'wolf-spirit-b',
            sourceControllerId: '0',
            sourceBaseIndex: 1,
            mandatory: false,
            resolutionClass: 'optional',
            ownerPlayerId: '0',
            eventPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            sourceEventId: 'turn-start:0:48:1',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            48,
        );

        const prompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(prompt?.playerId).toBe('0');
        expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const wolfSpiritOption = prompt?.data?.options?.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            const queuedTrigger = resolved?.state.core.triggerQueue?.find((entry: any) => entry.id === triggerId);
            return queuedTrigger?.sourceCardUid === 'wolf-spirit-b';
        });
        expect(wolfSpiritOption).toBeDefined();

        const afterChoice = runCommand(
            resolved!.state,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: wolfSpiritOption.id } } as any,
            defaultTestRandom,
        );

        const wolfSpiritPrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
        expect(wolfSpiritPrompt?.playerId).toBe('0');
        expect(wolfSpiritPrompt?.data?.sourceId).toBe('titan_werewolves_great_wolf_spirit_move');
        expect(wolfSpiritPrompt?.data?.continuationContext).toEqual(expect.objectContaining({
            titanUid: 'wolf-spirit-b',
            titanDefId: 'werewolves_great_wolf_spirit',
            fromBaseIndex: 1,
        }));
    });

    it('sourceController queued onMinionDestroyed trigger 仍应把 Death on Six Legs 的加标记结算交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('victim-ant', 'giant_ant_worker', '0', 2, { powerCounters: 2 }),
                ]),
                makeBase(),
            ],
            titans: [{
                uid: 't-six-legs',
                defId: 'giant_ants_death_on_six_legs',
                faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'victim-ant',
            triggerMinionDefId: 'giant_ant_worker',
            triggerMinion: core.bases[0].minions.find((minion: any) => minion.uid === 'victim-ant'),
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 22,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('giant_ants_death_on_six_legs');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            22,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 't-six-legs',
                amount: 1,
                reason: 'giant_ants_death_on_six_legs',
            }),
        }));
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 't-six-legs')?.powerCounters).toBe(1);
    });

    it('sourceController queued onMinionDiscardedFromBase trigger 仍应把 Death on Six Legs 的加标记结算交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('scored-ant', 'giant_ant_worker', '0', 2, { powerCounters: 3 }),
                ]),
                makeBase(),
            ],
            titans: [{
                uid: 't-six-legs',
                defId: 'giant_ants_death_on_six_legs',
                faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'scored-ant',
            triggerMinionDefId: 'giant_ant_worker',
            triggerMinion: core.bases[0].minions.find((minion: any) => minion.uid === 'scored-ant'),
            random: defaultTestRandom,
            now: 23,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('giant_ants_death_on_six_legs');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            23,
        );
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TITAN_POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                titanUid: 't-six-legs',
                amount: 1,
                reason: 'giant_ants_death_on_six_legs',
            }),
        }));
        expect((resolved?.state.core.titans ?? []).find((titan: any) => titan.uid === 't-six-legs')?.powerCounters).toBe(1);
    });

    it('collectTriggers onMinionAffected 只应在 Dinner Date POD 宿主有效力量为 0 时入队', () => {
        const buildCore = (basePower: number): SmashUpCore => makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('dinner-host', 'robot_microbot', '1', basePower, {
                        attachedActions: [{
                            uid: 'dinner-date-a',
                            defId: 'vampire_dinner_date_pod',
                            ownerId: '0',
                        }],
                    }),
                ]),
            ],
        });

        const stillAliveCore = buildCore(4);
        const stillAliveQueued = collectTriggers(stillAliveCore, 'onMinionAffected', {
            state: stillAliveCore,
            matchState: makeMatchState(stillAliveCore, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'dinner-host',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: stillAliveCore.bases[0].minions[0],
            affectType: 'power_change',
            counterChangeKind: 'removed',
            counterDelta: -1,
            reason: 'test_still_above_zero',
            random: defaultTestRandom,
            now: 25,
        }) as any;

        expect(stillAliveQueued).toBeUndefined();

        const zeroPowerCore = buildCore(2);
        const zeroPowerQueued = collectTriggers(zeroPowerCore, 'onMinionAffected', {
            state: zeroPowerCore,
            matchState: makeMatchState(zeroPowerCore, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'dinner-host',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: zeroPowerCore.bases[0].minions[0],
            affectType: 'power_change',
            counterChangeKind: 'removed',
            counterDelta: -1,
            reason: 'test_zero_power',
            random: defaultTestRandom,
            now: 26,
        }) as any;

        expect(zeroPowerQueued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'vampire_dinner_date_pod',
            sourceCardUid: 'dinner-date-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
        }));
    });

    it('processAffectTriggers 在本次力量变化刚好让 Dinner Date POD 宿主变为 0 时应入队', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('dinner-host', 'robot_microbot', '1', 2, {
                        powerCounters: 1,
                        attachedActions: [{
                            uid: 'dinner-date-a',
                            defId: 'vampire_dinner_date_pod',
                            ownerId: '0',
                        }],
                    }),
                ]),
            ],
        });

        const result = processAffectTriggers([{
            type: SU_EVENTS.POWER_COUNTER_REMOVED,
            payload: {
                minionUid: 'dinner-host',
                baseIndex: 0,
                amount: 1,
                reason: 'test_counter_removed_to_zero',
                sourcePlayerId: '1',
            },
            timestamp: 27,
        } as any], makeMatchState(core, 'playCards', '1'), '1', defaultTestRandom, 27);

        const triggers = result.events
            .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
            .flatMap((event: any) => event.payload.triggers);

        expect(triggers).toContainEqual(expect.objectContaining({
            sourceDefId: 'vampire_dinner_date_pod',
            sourceCardUid: 'dinner-date-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            triggerMinionUid: 'dinner-host',
        }));
        expect(result.matchState?.core.bases[0].minions[0].powerCounters).toBe(0);
    });

    it('sourceController queued onMinionAffected trigger 处理 borrowed Dinner Date POD 时，destroyerId 仍应归控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.ROBOTS],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('dinner-host', 'robot_microbot', '1', 2, {
                        attachedActions: [{
                            uid: 'borrowed-dinner-date-a',
                            defId: 'vampire_dinner_date_pod',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
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
            reason: 'test_zero_power_borrowed',
            random: defaultTestRandom,
            now: 28,
        }) as any;

        expect(queued?.payload?.triggers?.[0]).toEqual(expect.objectContaining({
            sourceDefId: 'vampire_dinner_date_pod',
            sourceCardUid: 'borrowed-dinner-date-a',
            sourceControllerId: '0',
            ownerPlayerId: '0',
            eventPlayerId: '1',
        }));

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            28,
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

    it('sourceController queued onMinionAffected trigger 仍应把 Ancient Lord 的后续选择交给泰坦控制者', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('buff-target', 'ghosts_spectre', '0', 2),
                ]),
            ],
            titans: [{
                uid: 'ancient-lord-a',
                defId: 'vampires_ancient_lord',
                faction: SMASHUP_FACTION_IDS.VAMPIRES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 2,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'ancient-lord-a',
            sourceControllerId: '0',
            triggerMinionUid: 'buff-target',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions.find((minion: any) => minion.uid === 'buff-target'),
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            reason: 'test_ancient_lord_counter',
            random: defaultTestRandom,
            now: 24,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('vampires_ancient_lord');
        expect(queued?.payload?.triggers?.[0]?.ownerPlayerId).toBe('0');
        expect(queued?.payload?.triggers?.[0]?.sourceControllerId).toBe('0');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            24,
        );

        const firstPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(firstPrompt?.playerId).toBe('0');

        if (firstPrompt?.data?.sourceId === 'smashup_reaction_choose') {
            const ancientLordOption = firstPrompt?.data?.options?.find((option: any) => {
                const triggerId = option?.value?.triggerId;
                const trigger = resolved?.state.core.triggerQueue?.find((entry: any) => entry.id === triggerId);
                return trigger?.sourceDefId === 'vampires_ancient_lord';
            });
            expect(ancientLordOption).toBeDefined();

            const afterChoice = runCommand(
                resolved!.state,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: ancientLordOption.id } } as any,
                defaultTestRandom,
            );

            const ancientLordPrompt = getInteractionsFromMS(afterChoice.finalState)[0] as any;
            expect(ancientLordPrompt?.playerId).toBe('0');
            expect(ancientLordPrompt?.data?.sourceId).toBe('titan_vampires_ancient_lord_special');
            return;
        }

        expect(firstPrompt?.data?.sourceId).toBe('titan_vampires_ancient_lord_special');
    });

    it('borrowed Ancient Lord 的 queued special 应允许当前控制者存放标记并将泰坦真实打到基地', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.VAMPIRES, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('borrowed-target', 'ghosts_spectre', '0', 2, { powerCounters: 1 }),
                ]),
            ],
            titans: [{
                uid: 'ancient-lord-borrowed-a',
                defId: 'vampires_ancient_lord',
                faction: SMASHUP_FACTION_IDS.VAMPIRES,
                ownerId: '1',
                controllerId: '0',
                powerCounters: 2,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '1',
            baseIndex: 0,
            sourceCardUid: 'ancient-lord-borrowed-a',
            sourceControllerId: '0',
            triggerMinionUid: 'borrowed-target',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions.find((minion: any) => minion.uid === 'borrowed-target'),
            affectType: 'power_change',
            counterChangeKind: 'added',
            counterDelta: 1,
            reason: 'test_borrowed_ancient_lord_counter',
            random: defaultTestRandom,
            now: 25,
        }) as any;

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            25,
        );

        const firstPrompt = getInteractionsFromMS(resolved?.state ?? makeMatchState(core))[0] as any;
        expect(firstPrompt?.playerId).toBe('0');

        let ancientLordState = resolved!.state;
        let ancientLordPrompt = firstPrompt;
        if (firstPrompt?.data?.sourceId === 'smashup_reaction_choose') {
            const ancientLordOption = firstPrompt?.data?.options?.find((option: any) => {
                const triggerId = option?.value?.triggerId;
                const trigger = resolved?.state.core.triggerQueue?.find((entry: any) => entry.id === triggerId);
                return trigger?.sourceDefId === 'vampires_ancient_lord';
            });
            expect(ancientLordOption).toBeDefined();

            const afterQueueChoice = runCommand(
                resolved!.state,
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: ancientLordOption.id } } as any,
                defaultTestRandom,
            );
            ancientLordState = afterQueueChoice.finalState;
            ancientLordPrompt = getInteractionsFromMS(afterQueueChoice.finalState)[0] as any;
        }

        expect(ancientLordPrompt?.data?.sourceId).toBe('titan_vampires_ancient_lord_special');

        const storeAndPlayOption = ancientLordPrompt?.data?.options?.find((option: any) => option?.value?.mode === 'storeAndPlay');
        expect(storeAndPlayOption).toBeDefined();

        const afterChoice = runCommand(
            ancientLordState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: storeAndPlayOption.id } } as any,
            defaultTestRandom,
        );

        const titan = (afterChoice.finalState.core.titans ?? []).find((candidate: any) => candidate.uid === 'ancient-lord-borrowed-a');
        expect(titan).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            powerCounters: 0,
            location: { zone: 'base', baseIndex: 0 },
        });
        const target = afterChoice.finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'borrowed-target');
        expect(target?.powerCounters ?? 0).toBe(0);
    });

});
