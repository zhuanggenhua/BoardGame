import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../domain/ongoingEffects';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { SU_EVENTS } from '../domain/types';
import { defaultTestRandom } from './testRunner';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';

function queuedSourceUids(queued: unknown): string[] {
    return (((queued as any)?.payload?.triggers ?? []) as any[])
        .map(trigger => trigger.sourceCardUid);
}

function queuedSourceDefIds(queued: unknown): string[] {
    return (((queued as any)?.payload?.triggers ?? []) as any[])
        .map(trigger => trigger.sourceDefId);
}

describe('Smash Up trigger queue canTrigger alignment', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        clearOngoingEffectRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    it('Mythic Greeks source-controller action triggers do not queue for an opponent action', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', { factions: [SMASHUP_FACTION_IDS.MYTHIC_GREEKS] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_oracle_at_delphi', [
                    makeMinion('odysseus', 'mythic_greeks_odysseus', '0', 5),
                    makeMinion('spartan', 'mythic_greeks_spartan', '0', 2),
                    makeMinion('jason', 'mythic_greeks_jason', '0', 4),
                    makeMinion('ally', 'wizard_apprentice', '0', 2),
                ]),
                makeBase('base_the_deep', [makeMinion('ally-b', 'sharks_hammerhead', '0', 3)]),
            ],
        });

        const opponentQueued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerCardUid: 'opp-action',
            triggerCardDefId: 'ghosts_creepy',
            triggerCardKind: 'action',
            random: defaultTestRandom,
            now: 1,
        }, { sourceDefIds: ['mythic_greeks_odysseus', 'mythic_greeks_spartan', 'mythic_greeks_jason'] });

        expect(opponentQueued).toBeUndefined();

        const ownQueued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerCardUid: 'own-action',
            triggerCardDefId: 'mythic_greeks_favor_of_ares',
            triggerCardKind: 'action',
            random: defaultTestRandom,
            now: 2,
        }, { sourceDefIds: ['mythic_greeks_odysseus', 'mythic_greeks_spartan', 'mythic_greeks_jason'] });

        expect(queuedSourceDefIds(ownQueued).sort()).toEqual([
            'mythic_greeks_jason',
            'mythic_greeks_odysseus',
            'mythic_greeks_spartan',
        ]);
    });

    it('Forgotten Horrors only queues when its controller played or moved their own minion to its base', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_palooza',
                    ongoingActions: [{ uid: 'horror', defId: 'explorers_forgotten_horrors', ownerId: '0' } as any],
                    minions: [
                        makeMinion('own-played', 'explorers_idaho_smith', '0', 4),
                        makeMinion('enemy-played', 'ghosts_spectre', '1', 2),
                    ],
                }),
                makeBase('base_the_deep', []),
            ],
        });

        const opponentQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy-played',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 3,
        }, { sourceDefIds: ['explorers_forgotten_horrors'] });

        expect(opponentQueued).toBeUndefined();

        const ownQueued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'own-played',
            triggerMinionDefId: 'explorers_idaho_smith',
            random: defaultTestRandom,
            now: 4,
        }, { sourceDefIds: ['explorers_forgotten_horrors'] });

        expect(queuedSourceUids(ownQueued)).toEqual(['horror']);
    });

    it('The Hill That Strolls only queues after an owned minion is taken by another player', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('taken', 'ghosts_spectre', '1', 2, { owner: '0' }),
                ]),
                makeBase('base_portal_room', []),
            ],
            titans: [{
                uid: 'hill',
                defId: 'ignobles_the_hill_that_strolls',
                faction: SMASHUP_FACTION_IDS.IGNOBLES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        });

        const powerChangeQueued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'taken',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[0],
            affectType: 'power_counter',
            random: defaultTestRandom,
            now: 5,
        }, { sourceDefIds: ['ignobles_the_hill_that_strolls'] });

        expect(powerChangeQueued).toBeUndefined();

        const controlChangeQueued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'taken',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[0],
            affectType: 'control_change',
            random: defaultTestRandom,
            now: 6,
        }, { sourceDefIds: ['ignobles_the_hill_that_strolls'] });

        expect(queuedSourceUids(controlChangeQueued)).toEqual(['hill']);
    });

    it('DIY Killers optional prompts do not queue for unrelated affected or moved minions', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 9,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_diy_killers_camp_crystal_lake', [
                    makeMinion('leatherface', 'diy_killers_leatherface', '0', 5),
                    makeMinion('jason', 'diy_killers_jason', '0', 5),
                    makeMinion('small-target', 'ghosts_spectre', '1', 2),
                    makeMinion('other-moved', 'robot_microbot', '1', 2),
                ]),
                makeBase('base_the_deep', []),
            ],
        });

        const unrelatedCounterQueued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'small-target',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[2],
            counterChangeKind: 'added',
            counterDelta: 1,
            random: defaultTestRandom,
            now: 7,
        }, { sourceDefIds: ['diy_killers_leatherface'] });

        expect(unrelatedCounterQueued).toBeUndefined();

        const unrelatedMoveQueued = collectTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'other-moved',
            triggerMinionDefId: 'robot_microbot',
            random: defaultTestRandom,
            now: 8,
        }, { sourceDefIds: ['diy_killers_jason'] });

        expect(unrelatedMoveQueued).toBeUndefined();

        const leatherfaceQueued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'leatherface',
            triggerMinionDefId: 'diy_killers_leatherface',
            triggerMinion: core.bases[0].minions[0],
            counterChangeKind: 'added',
            counterDelta: 1,
            random: defaultTestRandom,
            now: 9,
        }, { sourceDefIds: ['diy_killers_leatherface'] });

        expect(queuedSourceUids(leatherfaceQueued)).toEqual(['leatherface']);

        const jasonQueued = collectTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'jason',
            triggerMinionDefId: 'diy_killers_jason',
            random: defaultTestRandom,
            now: 10,
        }, { sourceDefIds: ['diy_killers_jason'] });

        expect(queuedSourceUids(jasonQueued)).toEqual(['jason']);
    });

    it('Cub Scout POD only queues for a weaker opposing minion moving to its base', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('scout', 'bear_cavalry_cub_scout_pod', '0', 4),
                    makeMinion('friendly', 'robot_microbot', '0', 2),
                    makeMinion('enemy-weak', 'ghosts_spectre', '1', 2),
                ]),
            ],
        });

        const friendlyQueued = collectTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'friendly',
            triggerMinionDefId: 'robot_microbot',
            random: defaultTestRandom,
            now: 11,
        }, { sourceDefIds: ['bear_cavalry_cub_scout_pod'] });

        expect(friendlyQueued).toBeUndefined();

        const enemyQueued = collectTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'enemy-weak',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 12,
        }, { sourceDefIds: ['bear_cavalry_cub_scout_pod'] });

        expect(queuedSourceUids(enemyQueued)).toEqual(['scout']);
    });

    it('Secret Agent queues only opposing Secret Agent instances for the action player', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-a', 'time_travelers_time_walk', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('own-agent', 'super_spies_secret_agent', '0', 2),
                    makeMinion('opp-agent', 'super_spies_secret_agent', '1', 2),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerCardUid: 'action-a',
            triggerCardDefId: 'time_travelers_time_walk',
            triggerCardKind: 'action',
            random: defaultTestRandom,
            now: 13,
        }, { sourceDefIds: ['super_spies_secret_agent'] });

        expect(queuedSourceUids(queued)).toEqual(['opp-agent']);
    });

    it('Chainsaw only queues when its host has a real move destination', () => {
        const buildCore = (withDestination: boolean) => makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_diy_killers_camp_crystal_lake', [
                    makeMinion('host', 'robot_microbot_alpha', '0', 2, {
                        attachedActions: [{ uid: 'chainsaw', defId: 'diy_killers_chainsaw', ownerId: '0' } as any],
                    }),
                    makeMinion('victim', 'ghosts_spectre', '1', 2),
                ]),
                ...(withDestination ? [makeBase('base_the_deep', [])] : []),
            ],
        });

        const oneBase = buildCore(false);
        const noDestinationQueued = collectTriggers(oneBase, 'onMinionDestroyed', {
            state: oneBase,
            matchState: makeMatchState(oneBase),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'victim',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: oneBase.bases[0].minions[1],
            random: defaultTestRandom,
            now: 14,
        }, { sourceDefIds: ['diy_killers_chainsaw'] });

        expect(noDestinationQueued).toBeUndefined();

        const twoBases = buildCore(true);
        const moveQueued = collectTriggers(twoBases, 'onMinionDestroyed', {
            state: twoBases,
            matchState: makeMatchState(twoBases),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'victim',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: twoBases.bases[0].minions[1],
            random: defaultTestRandom,
            now: 15,
        }, { sourceDefIds: ['diy_killers_chainsaw'] });

        expect(queuedSourceUids(moveQueued)).toEqual(['chainsaw']);
    });

    it('attached leave prompts queue only when they have a legal follow-up target', () => {
        const bewitchedAlone = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('bewitched-host', 'ghosts_spectre', '1', 2, {
                        attachedActions: [{ uid: 'bewitched', defId: 'russian_fairy_tales_bewitched', ownerId: '0' } as any],
                    }),
                ]),
            ],
        });

        const noTransferQueued = collectTriggers(bewitchedAlone, 'onMinionDestroyed', {
            state: bewitchedAlone,
            matchState: makeMatchState(bewitchedAlone),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'bewitched-host',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: bewitchedAlone.bases[0].minions[0],
            random: defaultTestRandom,
            now: 16,
        }, { sourceDefIds: ['russian_fairy_tales_bewitched'] });

        expect(noTransferQueued).toBeUndefined();

        const bewitchedWithTarget = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('bewitched-host', 'ghosts_spectre', '1', 2, {
                        attachedActions: [{ uid: 'bewitched', defId: 'russian_fairy_tales_bewitched', ownerId: '0' } as any],
                    }),
                    makeMinion('new-host', 'robot_microbot', '0', 2),
                ]),
                makeBase('base_the_deep', []),
            ],
        });

        const transferQueued = collectTriggers(bewitchedWithTarget, 'onMinionDestroyed', {
            state: bewitchedWithTarget,
            matchState: makeMatchState(bewitchedWithTarget),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'bewitched-host',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: bewitchedWithTarget.bases[0].minions[0],
            random: defaultTestRandom,
            now: 17,
        }, { sourceDefIds: ['russian_fairy_tales_bewitched'] });

        expect(queuedSourceUids(transferQueued)).toEqual(['bewitched']);
    });

    it('Liu Wa only queues before scoring when its talent modifier is actually active', () => {
        const buildCore = (withTalentModifier: boolean) => makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('liu', 'huluwawa_liu_wa', '0', 2),
                ]),
            ],
            timedPowerModifiers: withTalentModifier
                ? [{ minionUid: 'liu', amount: -4, reason: 'huluwawa_liu_wa_talent' } as any]
                : [],
        });

        const inactive = buildCore(false);
        const inactiveQueued = collectTriggers(inactive, 'beforeScoring', {
            state: inactive,
            matchState: makeMatchState(inactive),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 18,
        }, { sourceDefIds: ['huluwawa_liu_wa'] });

        expect(inactiveQueued).toBeUndefined();

        const active = buildCore(true);
        const activeQueued = collectTriggers(active, 'beforeScoring', {
            state: active,
            matchState: makeMatchState(active),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 19,
        }, { sourceDefIds: ['huluwawa_liu_wa'] });

        expect(queuedSourceUids(activeQueued)).toEqual(['liu']);
    });

    it('after-scoring move prompts require an actual destination or off-base titan', () => {
        const flyingMonkeyOneBase = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('ape', 'cyborg_apes_baboom', '0', 3, {
                        attachedActions: [{ uid: 'flying', defId: 'cyborg_apes_flying_monkey', ownerId: '0' } as any],
                    }),
                ]),
            ],
        });

        const noDestinationQueued = collectTriggers(flyingMonkeyOneBase, 'afterScoring', {
            state: flyingMonkeyOneBase,
            matchState: makeMatchState(flyingMonkeyOneBase),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 20,
        }, { sourceDefIds: ['cyborg_apes_flying_monkey'] });

        expect(noDestinationQueued).toBeUndefined();

        const megabotAtScoringBase = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', []),
                makeBase('base_the_deep', []),
            ],
            titans: [{
                uid: 'megabot',
                defId: 'mega_troopers_megabot',
                faction: SMASHUP_FACTION_IDS.MEGA_TROOPERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const alreadyThereQueued = collectTriggers(megabotAtScoringBase, 'beforeScoring', {
            state: megabotAtScoringBase,
            matchState: makeMatchState(megabotAtScoringBase),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 21,
        }, { sourceDefIds: ['mega_troopers_megabot'] });

        expect(alreadyThereQueued).toBeUndefined();

        const megabotAway = {
            ...megabotAtScoringBase,
            titans: [{
                ...(megabotAtScoringBase.titans![0] as any),
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        };

        const moveQueued = collectTriggers(megabotAway, 'beforeScoring', {
            state: megabotAway,
            matchState: makeMatchState(megabotAway),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 22,
        }, { sourceDefIds: ['mega_troopers_megabot'] });

        expect(queuedSourceDefIds(moveQueued)).toEqual(['mega_troopers_megabot']);
    });

    it('The Count POD only queues when the destroyed minion base still has a counter target', () => {
        const buildCore = (withTarget: boolean) => makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', withTarget
                    ? [makeMinion('remaining-target', 'robot_microbot', '0', 2)]
                    : []),
                makeBase('base_the_deep', [
                    makeMinion('count', 'vampire_the_count_pod', '0', 5),
                ]),
            ],
        });

        const noTarget = buildCore(false);
        const noTargetQueued = collectTriggers(noTarget, 'onMinionDestroyed', {
            state: noTarget,
            matchState: makeMatchState(noTarget),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'destroyed',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 23,
        }, { sourceDefIds: ['vampire_the_count_pod'] });

        expect(noTargetQueued).toBeUndefined();

        const withTarget = buildCore(true);
        const targetQueued = collectTriggers(withTarget, 'onMinionDestroyed', {
            state: withTarget,
            matchState: makeMatchState(withTarget),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'destroyed',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 24,
        }, { sourceDefIds: ['vampire_the_count_pod'] });

        expect(queuedSourceUids(targetQueued)).toEqual(['count']);
    });

    it('World Champs Sheriff and Mummy queue only with live targets', () => {
        const sheriffNoEnemy = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('sheriff', 'world_champs_sheriff', '0', 4),
                    makeMinion('ally', 'robot_microbot', '0', 2),
                ]),
                makeBase('base_the_deep', []),
            ],
        });

        const sheriffNoEnemyQueued = collectTriggers(sheriffNoEnemy, 'beforeScoring', {
            state: sheriffNoEnemy,
            matchState: makeMatchState(sheriffNoEnemy),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 25,
        }, { sourceDefIds: ['world_champs_sheriff'] });

        expect(sheriffNoEnemyQueued).toBeUndefined();

        const sheriffWithEnemy = {
            ...sheriffNoEnemy,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('sheriff', 'world_champs_sheriff', '0', 4),
                    makeMinion('enemy', 'ghosts_spectre', '1', 2),
                ]),
                makeBase('base_the_deep', []),
            ],
        };
        const sheriffQueued = collectTriggers(sheriffWithEnemy, 'beforeScoring', {
            state: sheriffWithEnemy,
            matchState: makeMatchState(sheriffWithEnemy),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 26,
        }, { sourceDefIds: ['world_champs_sheriff'] });

        expect(queuedSourceUids(sheriffQueued)).toEqual(['sheriff']);

        const mummyOneBase = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('mummy', 'world_champs_mummy', '0', 4),
                ]),
            ],
        });

        const mummyNoDestinationQueued = collectTriggers(mummyOneBase, 'afterScoring', {
            state: mummyOneBase,
            matchState: makeMatchState(mummyOneBase),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 27,
        }, { sourceDefIds: ['world_champs_mummy'] });

        expect(mummyNoDestinationQueued).toBeUndefined();

        const mummyTwoBases = {
            ...mummyOneBase,
            bases: [
                mummyOneBase.bases[0],
                makeBase('base_the_deep', []),
            ],
        };
        const mummyQueued = collectTriggers(mummyTwoBases, 'afterScoring', {
            state: mummyTwoBases,
            matchState: makeMatchState(mummyTwoBases),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 28,
        }, { sourceDefIds: ['world_champs_mummy'] });

        expect(queuedSourceUids(mummyQueued)).toEqual(['mummy']);
    });

    it('Zhongguo optional minion prompts queue only when their handler can produce a real choice', () => {
        const deathWisherNoTarget = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('death-wisher', 'vigilantes_death_wisher', '0', 4),
                ]),
            ],
        });

        const deathWisherNoTargetQueued = collectTriggers(deathWisherNoTarget, 'onMinionDestroyed', {
            state: deathWisherNoTarget,
            matchState: makeMatchState(deathWisherNoTarget),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'destroyed-ally',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: makeMinion('destroyed-ally', 'robot_microbot', '0', 2),
            destroyerId: '1',
            controllerId: '0',
            random: defaultTestRandom,
            now: 29,
        }, { sourceDefIds: ['vigilantes_death_wisher'] });

        expect(deathWisherNoTargetQueued).toBeUndefined();

        const deathWisherWithTarget = {
            ...deathWisherNoTarget,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('death-wisher', 'vigilantes_death_wisher', '0', 4),
                    makeMinion('destroyer-target', 'truckers_el_bandido', '1', 5),
                ]),
            ],
        };
        const deathWisherQueued = collectTriggers(deathWisherWithTarget, 'onMinionDestroyed', {
            state: deathWisherWithTarget,
            matchState: makeMatchState(deathWisherWithTarget),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'destroyed-ally',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: makeMinion('destroyed-ally', 'robot_microbot', '0', 2),
            destroyerId: '1',
            controllerId: '0',
            random: defaultTestRandom,
            now: 30,
        }, { sourceDefIds: ['vigilantes_death_wisher'] });

        expect(queuedSourceUids(deathWisherQueued)).toEqual(['death-wisher']);

        const brojakOneBase = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('brojak', 'vigilantes_brojak', '0', 4),
                    makeMinion('runner', 'truckers_good_buddy', '1', 2),
                ]),
            ],
        });

        const brojakNoDestinationQueued = collectTriggers(brojakOneBase, 'onMinionMoved', {
            state: brojakOneBase,
            matchState: makeMatchState(brojakOneBase),
            playerId: '1',
            baseIndex: 0,
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'runner',
            triggerMinionDefId: 'truckers_good_buddy',
            random: defaultTestRandom,
            now: 31,
        }, { sourceDefIds: ['vigilantes_brojak'] });

        expect(brojakNoDestinationQueued).toBeUndefined();

        const brojakTwoBases = {
            ...brojakOneBase,
            bases: [
                brojakOneBase.bases[0],
                makeBase('base_the_deep', []),
            ],
        };
        const brojakQueued = collectTriggers(brojakTwoBases, 'onMinionMoved', {
            state: brojakTwoBases,
            matchState: makeMatchState(brojakTwoBases),
            playerId: '1',
            baseIndex: 0,
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'runner',
            triggerMinionDefId: 'truckers_good_buddy',
            random: defaultTestRandom,
            now: 32,
        }, { sourceDefIds: ['vigilantes_brojak'] });

        expect(queuedSourceUids(brojakQueued)).toEqual(['brojak']);

        const dancingKingNoCopyTarget = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('king', 'disco_dancers_dancing_king', '0', 5),
                ]),
            ],
        });
        const standardActionAffect = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'king',
                baseIndex: 0,
                amount: 2,
                reason: 'disco_dancers_get_down_tonight',
                sourceDefId: 'disco_dancers_get_down_tonight',
                sourcePlayerId: '0',
            },
            timestamp: 33,
        } as any;

        const dancingKingNoCopyQueued = collectTriggers(dancingKingNoCopyTarget, 'onMinionAffected', {
            state: dancingKingNoCopyTarget,
            matchState: makeMatchState(dancingKingNoCopyTarget),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'king',
            triggerMinionDefId: 'disco_dancers_dancing_king',
            affectEvent: standardActionAffect,
            random: defaultTestRandom,
            now: 33,
        }, { sourceDefIds: ['disco_dancers_dancing_king'] });

        expect(dancingKingNoCopyQueued).toBeUndefined();

        const dancingKingWithCopyTarget = {
            ...dancingKingNoCopyTarget,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('king', 'disco_dancers_dancing_king', '0', 5),
                    makeMinion('copy-target', 'vigilantes_jacky_bill', '1', 4),
                ]),
            ],
        };
        const dancingKingQueued = collectTriggers(dancingKingWithCopyTarget, 'onMinionAffected', {
            state: dancingKingWithCopyTarget,
            matchState: makeMatchState(dancingKingWithCopyTarget),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'king',
            triggerMinionDefId: 'disco_dancers_dancing_king',
            affectEvent: standardActionAffect,
            random: defaultTestRandom,
            now: 34,
        }, { sourceDefIds: ['disco_dancers_dancing_king'] });

        expect(queuedSourceUids(dancingKingQueued)).toEqual(['king']);
    });

    it('direct optional triggers queue only when they can produce events', () => {
        const divaCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('diva', 'world_champs_diva', '0', 3),
                    makeMinion('target', 'truckers_good_buddy', '0', 2),
                ]),
            ],
        });
        const nonStandardAffect = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'target',
                baseIndex: 0,
                amount: 2,
                reason: 'test_non_action',
                sourceDefId: 'test_non_action',
            },
            timestamp: 35,
        } as any;
        const standardAffect = {
            ...nonStandardAffect,
            payload: {
                ...nonStandardAffect.payload,
                reason: 'disco_dancers_get_down_tonight',
                sourceDefId: 'disco_dancers_get_down_tonight',
            },
        } as any;

        const divaInvalidQueued = collectTriggers(divaCore, 'onMinionAffected', {
            state: divaCore,
            matchState: makeMatchState(divaCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'target',
            triggerMinionDefId: 'truckers_good_buddy',
            affectEvent: nonStandardAffect,
            affectBatchTargets: [{ minionUid: 'target', baseIndex: 0, controllerId: '0' }],
            random: defaultTestRandom,
            now: 35,
        }, { sourceDefIds: ['world_champs_diva'] });

        expect(divaInvalidQueued).toBeUndefined();

        const divaQueued = collectTriggers(divaCore, 'onMinionAffected', {
            state: divaCore,
            matchState: makeMatchState(divaCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'target',
            triggerMinionDefId: 'truckers_good_buddy',
            affectEvent: standardAffect,
            affectBatchTargets: [{ minionUid: 'target', baseIndex: 0, controllerId: '0' }],
            random: defaultTestRandom,
            now: 36,
        }, { sourceDefIds: ['world_champs_diva'] });

        expect(queuedSourceUids(divaQueued)).toEqual(['diva']);

        const ursaOwnMoved = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('friendly-moved', 'robot_microbot', '0', 2),
                ]),
            ],
            titans: [{
                uid: 'ursa',
                defId: 'bear_cavalry_major_ursa',
                faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const ursaOwnQueued = collectTriggers(ursaOwnMoved, 'onMinionMoved', {
            state: ursaOwnMoved,
            matchState: makeMatchState(ursaOwnMoved),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'friendly-moved',
            triggerMinionDefId: 'robot_microbot',
            random: defaultTestRandom,
            now: 37,
        }, { sourceDefIds: ['bear_cavalry_major_ursa'] });

        expect(ursaOwnQueued).toBeUndefined();

        const ursaEnemyMoved = {
            ...ursaOwnMoved,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('enemy-moved', 'ghosts_spectre', '1', 2),
                ]),
            ],
        };
        const ursaQueued = collectTriggers(ursaEnemyMoved, 'onMinionMoved', {
            state: ursaEnemyMoved,
            matchState: makeMatchState(ursaEnemyMoved),
            playerId: '1',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'enemy-moved',
            triggerMinionDefId: 'ghosts_spectre',
            random: defaultTestRandom,
            now: 38,
        }, { sourceDefIds: ['bear_cavalry_major_ursa'] });

        expect(queuedSourceUids(ursaQueued)).toEqual(['ursa']);

        const hotVenueCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', { minionsPlayedPerBase: { 0: 0 } as any }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_isis_swingin_pad',
                    minions: [],
                    ongoingActions: [{ uid: 'venue', defId: 'rock_stars_hot_venue', ownerId: '0' } as any],
                }),
            ],
        });

        const hotVenueNoMinionQueued = collectTriggers(hotVenueCore, 'onTurnEnd', {
            state: hotVenueCore,
            matchState: makeMatchState(hotVenueCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 39,
        }, { sourceDefIds: ['rock_stars_hot_venue'] });

        expect(hotVenueNoMinionQueued).toBeUndefined();

        const hotVenueValid = {
            ...hotVenueCore,
            players: {
                ...hotVenueCore.players,
                '0': makePlayer('0', { minionsPlayedPerBase: { 0: 1 } as any }),
            },
        };
        const hotVenueQueued = collectTriggers(hotVenueValid, 'onTurnEnd', {
            state: hotVenueValid,
            matchState: makeMatchState(hotVenueValid),
            playerId: '0',
            random: defaultTestRandom,
            now: 40,
        }, { sourceDefIds: ['rock_stars_hot_venue'] });

        expect(queuedSourceUids(hotVenueQueued)).toEqual(['venue']);

        const timeBoxInPlay = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_isis_swingin_pad', [])],
            titans: [{
                uid: 'time-box',
                defId: 'time_travelers_time_box',
                faction: SMASHUP_FACTION_IDS.TIME_TRAVELERS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        });

        const timeBoxInPlayQueued = collectTriggers(timeBoxInPlay, 'onTurnStart', {
            state: timeBoxInPlay,
            matchState: makeMatchState(timeBoxInPlay),
            playerId: '0',
            random: defaultTestRandom,
            now: 41,
        }, { sourceDefIds: ['time_travelers_time_box'] });

        expect(timeBoxInPlayQueued).toBeUndefined();

        const timeBoxSetAside = {
            ...timeBoxInPlay,
            titans: [{
                ...(timeBoxInPlay.titans![0] as any),
                location: { zone: 'setaside' },
            } as any],
        };

        const timeBoxSetAsideQueued = collectTriggers(timeBoxSetAside, 'onTurnStart', {
            state: timeBoxSetAside,
            matchState: makeMatchState(timeBoxSetAside),
            playerId: '0',
            random: defaultTestRandom,
            now: 42,
        }, { sourceDefIds: ['time_travelers_time_box'] });

        expect(queuedSourceUids(timeBoxSetAsideQueued)).toEqual(['time-box']);
    });
});
