import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { uncoverBuriedCard } from '../domain/bury';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { fireTriggers } from '../domain/ongoingEffects';
import { MADNESS_CARD_DEF_ID, SU_EVENTS } from '../domain/types';
import {
    getFirstPrompt,
    getPromptHandlerData,
    getPromptOptions,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from './helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('Smash Up 无交互态不替玩家自动选择目标', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('不会从牌库、弃牌堆、场上行动或基地目标里自动取第一个候选', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('sprout-target', 'ignobles_sneaky_squire', 'minion', '0')],
                    discard: [makeCard('vulture-target', 'astroknights_hidden_base', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_alpha',
                    minions: [
                        makeMinion('sprout', 'all_stars_sprout', '0', 2),
                        makeMinion('buccaneer', 'pirate_buccaneer', '0', 2),
                        makeMinion('igor', 'frankenstein_igor', '0', 2),
                        makeMinion('igor-target', 'ignobles_sneaky_squire', '0', 2),
                        makeMinion('let-it-go-target', 'frozen_anna', '0', 3),
                        makeMinion('out-count-host', 'luchadors_el_diablo', '0', 3, {
                            attachedActions: [{ uid: 'own-attached', defId: 'star_roamers_whiplash_maneuver', ownerId: '0' }],
                        }),
                        makeMinion('sumo-own', 'sumo_wrestlers_yokozuna', '0', 4),
                    ],
                    ongoingActions: [{ uid: 'opponent-ongoing', defId: 'astroknights_hidden_base', ownerId: '1' }],
                }),
                makeBase('base_beta', [
                    makeMinion('coordinated-source', 'ultimates_wasp', '0', 2),
                ]),
                makeBase('base_gamma'),
            ],
        });

        const sprout = fireTriggers(core, 'onTurnStart', {
            state: core,
            playerId: '0',
            random: FIXED_RANDOM,
            now: 10,
        });
        expect(sprout.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(sprout.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);

        expect(fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buccaneer',
            triggerMinionDefId: 'pirate_buccaneer',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'buccaneer'),
            random: FIXED_RANDOM,
            now: 11,
        }).events).toEqual([]);

        expect(fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'igor',
            triggerMinionDefId: 'frankenstein_igor',
            triggerMinion: core.bases[0].minions.find(minion => minion.uid === 'igor'),
            random: FIXED_RANDOM,
            now: 12,
        }).events).toEqual([]);

        expect(invokeRegisteredAbilityContract('frozen_let_it_go', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'let-it-go',
            defId: 'frozen_let_it_go',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 13,
        }).events).toEqual([]);

        expect(invokeRegisteredAbilityContract('sinister_six_vulture', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'vulture',
            defId: 'sinister_six_vulture',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 14,
        }).events).toEqual([]);

        expect(invokeRegisteredAbilityContract('ultimates_coordinated_attack', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'coordinated',
            defId: 'ultimates_coordinated_attack',
            targetBaseIndex: 0,
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 15,
        }).events).toEqual([]);

        expect(invokeRegisteredAbilityContract('sumo_wrestlers_head_butt', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'head-butt',
            defId: 'sumo_wrestlers_head_butt',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 16,
        }).events).toEqual([]);

        expect(invokeRegisteredAbilityContract('luchadors_out_for_the_count', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'out-for-the-count',
            defId: 'luchadors_out_for_the_count',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 17,
        }).events).toEqual([]);
    });

    it('不会在其它选择型卡牌里用默认候选替代玩家确认', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('galahad-deck-action', 'astroknights_hidden_base', 'action', '0')],
                    discard: [
                        makeCard('repeater-discard-action', 'astroknights_hidden_base', 'action', '0'),
                        makeCard('felix-discard-action', 'astroknights_hidden_base', 'action', '0'),
                        makeCard('disco-discard-minion', 'round_table_knights_king_arthur', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_alpha',
                    minions: [
                        makeMinion('baymax', 'big_hero_6_baymax', '0', 3, { powerCounters: 1 }),
                        makeMinion('baymax-target', 'frozen_anna', '0', 3),
                        makeMinion('laser', 'dino_laser_triceratops', '0', 3),
                        makeMinion('laser-target', 'pirate_buccaneer', '1', 2),
                        makeMinion('arthur', 'round_table_knights_king_arthur', '0', 5),
                        makeMinion('guinevere', 'round_table_knights_guinevere', '0', 4),
                        makeMinion('guinevere-target', 'round_table_knights_galahad', '0', 4),
                        makeMinion('thor', 'avengers_thor', '0', 5),
                        makeMinion('modifier-host', 'frozen_anna', '0', 3, {
                            attachedActions: [
                                { uid: 'ghostly-present', defId: 'nightmare_before_christmas_ghostly_presents', ownerId: '0' },
                                { uid: 'mjolnir', defId: 'avengers_mjolnir', ownerId: '0' },
                                { uid: 'cellular-bonding', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                                { uid: 'bonding-source', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                            ],
                        }),
                        makeMinion('modifier-destination', 'frozen_elsa', '0', 4),
                        makeMinion('copycat', 'shapeshifters_copycat', '0', 3),
                        makeMinion('enemy-copy', 'pirate_buccaneer', '1', 2),
                        makeMinion('doctor', 'time_travelers_doctor_when', '0', 3),
                        makeMinion('doctor-target', 'frozen_anna', '0', 3),
                        makeMinion('monkey-host', 'cyborg_apes_missing_uplink', '0', 2, {
                            attachedActions: [{ uid: 'monkey-action', defId: 'cyborg_apes_monkey_on_your_back', ownerId: '0' }],
                        }),
                        makeMinion('monkey-target', 'pirate_buccaneer', '1', 2),
                        makeMinion('spies-target', 'pirate_buccaneer', '1', 2),
                        makeMinion('base-not-enough-target', 'pirate_buccaneer', '1', 4),
                        makeMinion('disco-live', 'round_table_knights_king_arthur', '0', 5),
                    ],
                    ongoingActions: [
                        { uid: 'felix-base-modifier', defId: 'astroknights_hidden_base', ownerId: '0' },
                        { uid: 'modular-source', defId: 'astroknights_hidden_base', ownerId: '0' },
                    ],
                }),
                makeBase('base_beta', [
                    makeMinion('arthur-target', 'round_table_knights_galahad', '0', 4),
                ]),
            ],
        });

        const baseContext = {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'source',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        };

        for (const [defId, tag, extra] of [
            ['big_hero_6_baymax', 'special', { cardUid: 'baymax' }],
            ['dino_rampage', 'onPlay', { cardUid: 'rampage' }],
            ['dino_laser_triceratops', 'onPlay', { cardUid: 'laser' }],
            ['nightmare_before_christmas_dr_finkelstein', 'talent', { cardUid: 'dr-finkelstein' }],
            ['round_table_knights_king_arthur', 'talent', { cardUid: 'arthur' }],
            ['round_table_knights_galahad', 'onPlay', { cardUid: 'galahad' }],
            ['round_table_knights_guinevere', 'talent', { cardUid: 'guinevere' }],
            ['wreck_it_ralph_fix_it_felix_jr', 'onPlay', { cardUid: 'felix' }],
            ['wreck_it_ralph_fix_it_felix_jr', 'talent', { cardUid: 'felix', baseIndex: 0 }],
            ['shapeshifters_copycat', 'onPlay', { cardUid: 'copycat' }],
            ['shapeshifters_cellular_bonding', 'onPlay', { cardUid: 'cellular-bonding', targetMinionUid: 'modifier-host' }],
            ['cyborg_apes_monkey_on_your_back', 'talent', { cardUid: 'monkey-action' }],
            ['super_spies_live_and_let_chum', 'special', { cardUid: 'live-let-chum' }],
            ['super_spies_the_base_is_not_enough', 'special', { cardUid: 'base-not-enough' }],
            ['time_travelers_repeater_perfect', 'onPlay', { cardUid: 'repeater' }],
            ['time_travelers_doctor_when', 'onPlay', { cardUid: 'doctor', targetMinionUid: 'enemy-copy' }],
            ['disco_dancers_stayin_alive', 'onPlay', { cardUid: 'stayin-alive' }],
            ['avengers_thor', 'talent', { cardUid: 'thor' }],
            ['avengers_modular_tech', 'onPlay', { cardUid: 'modular-tech' }],
            ['goblins_bushwhacking', 'onPlay', { cardUid: 'bushwhacking' }],
            ['goblins_bushwhacking', 'onPlay', { cardUid: 'bushwhacking', targetMinionUid: 'modifier-host' }],
            ['goblins_he_who_smelt_it', 'onPlay', { cardUid: 'smelt-it' }],
        ] as const) {
            expect(invokeRegisteredAbilityContract(defId, tag, {
                ...baseContext,
                defId,
                ...extra,
            }).events, `${defId}::${tag}`).toEqual([]);
        }
    });

    it('移动到另一个基地的效果不会自动取第一个目的地或同行目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn-action', 'astroknights_hidden_base', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_alpha',
                    minions: [
                        makeMinion('carpet', 'aladdin_carpet', '0', 1),
                        makeMinion('companion-a', 'aladdin_abu', '0', 3),
                        makeMinion('vanellope', 'wreck_it_ralph_vanellope_von_schweetz', '0', 3),
                        makeMinion('oogie-host', 'frozen_anna', '1', 3),
                        makeMinion('black-sheep', 'sheep_black_sheep', '0', 4),
                        makeMinion('sheep-entrant', 'sheep_flock', '1', 2),
                        makeMinion('quest-host', 'round_table_knights_lancelot', '0', 4),
                        makeMinion('steed-host', 'round_table_knights_lancelot', '0', 4, {
                            attachedActions: [{ uid: 'steed', defId: 'round_table_knights_noble_steed', ownerId: '0' }],
                        }),
                        makeMinion('racer', 'wreck_it_ralph_sugar_rush_racer', '0', 2),
                    ],
                    ongoingActions: [
                        { uid: 'galahad-action', defId: 'round_table_knights_good_deed', ownerId: '0' },
                        { uid: 'king-candy', defId: 'wreck_it_ralph_king_candy', ownerId: '0' },
                    ],
                }),
                makeBase('base_beta'),
                makeBase('base_gamma'),
            ],
        });

        const baseContext = {
            state: core,
            matchState: undefined,
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 70,
        };

        for (const [defId, tag, extra] of [
            ['aladdin_carpet', 'talent', { cardUid: 'carpet' }],
            ['wreck_it_ralph_vanellope_von_schweetz', 'talent', { cardUid: 'vanellope' }],
            ['nightmare_before_christmas_oogie_boogie', 'onPlay', { cardUid: 'oogie', targetMinionUid: 'oogie-host' }],
            ['wreck_it_ralph_escape_pod', 'onPlay', { cardUid: 'escape-pod' }],
            ['wreck_it_ralph_king_candy', 'talent', { cardUid: 'king-candy' }],
            ['round_table_knights_a_questing', 'onPlay', { cardUid: 'quest', targetMinionUid: 'quest-host' }],
            ['round_table_knights_noble_steed', 'talent', { cardUid: 'steed' }],
            ['round_table_knights_galahad', 'special', { cardUid: 'galahad' }],
        ] as const) {
            expect(invokeRegisteredAbilityContract(defId, tag, {
                ...baseContext,
                defId,
                ...extra,
            }).events, `${defId}::${tag}`).toEqual([]);
        }

        const carpetWithDestination = invokeRegisteredAbilityContract('aladdin_carpet', 'talent', {
            ...baseContext,
            cardUid: 'carpet',
            defId: 'aladdin_carpet',
            targetBaseIndex: 2,
        });
        expect(carpetWithDestination.events.filter(event => event.type === SU_EVENTS.MINION_MOVED)
            .map(event => (event as any).payload.minionUid)).toEqual(['carpet']);

        const racer = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: undefined,
            playerId: '0',
            actionTargetBaseIndex: 0,
            triggerCardDefId: 'wreck_it_ralph_king_candy',
            random: FIXED_RANDOM,
            now: 71,
        });
        expect(racer.events).toEqual([]);

        const blackSheep = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: undefined,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'sheep-entrant',
            triggerMinionDefId: 'sheep_flock',
            random: FIXED_RANDOM,
            now: 72,
        });
        expect(blackSheep.events).toEqual([]);
    });

    it('全派系选择型旧兜底不会在无交互态自动取第一张牌或第一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('stoneford-action', 'astroknights_hidden_base', 'action', '0'),
                        makeCard('prep-minion', 'teens_prep', 'minion', '0'),
                        makeCard('killer-deck-sprout', 'killer_plant_sprout', 'minion', '0'),
                    ],
                    hand: [makeCard('own-action', 'astroknights_hidden_base', 'action', '0')],
                    discard: [
                        makeCard('discard-action', 'astroknights_hidden_base', 'action', '0'),
                        makeCard('discard-low-power-minion', 'frozen_snowgie', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('opponent-action-a', 'astroknights_hidden_base', 'action', '1'),
                        makeCard('opponent-action-b', 'teens_babysitter', 'action', '1'),
                    ],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_alpha',
                    minions: [
                        makeMinion('first-mate', 'pirate_first_mate', '0', 2),
                        makeMinion('servitor', 'all_stars_servitor_of_cthulhu', '0', 2),
                        makeMinion('brain', 'teens_brain', '0', 3),
                        makeMinion('own-blocker', 'frozen_anna', '0', 3),
                        makeMinion('roland', 'paladins_roland', '0', 5, { powerCounters: 4 }),
                        makeMinion('mind-lady', 'superheroes_mind_lady', '0', 5),
                        makeMinion('killer-sprout', 'killer_plant_sprout', '0', 2),
                        makeMinion('venus-trap', 'killer_plant_venus_man_trap', '0', 5),
                        makeMinion('enemy-entered', 'pirate_buccaneer', '1', 2),
                        makeMinion('cub-scout-pod', 'bear_cavalry_cub_scout_pod', '0', 3),
                        makeMinion('cub-moved', 'pirate_buccaneer', '1', 2),
                    ],
                    ongoingActions: [
                        { uid: 'oh-hoh', defId: 'kung_fu_fighters_oh_hoh_hoh_hoah', ownerId: '0' },
                    ],
                }),
                makeBase('base_beta'),
            ],
            titans: [{
                uid: 'seraphim-0',
                defId: 'paladins_seraphim',
                faction: SMASHUP_FACTION_IDS.PALADINS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
            baseDeck: ['base_island_peak'],
            baseDiscard: ['base_beta', 'base_gamma'],
        });

        const jafar = invokeRegisteredAbilityContract('aladdin_jafar', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'jafar',
            defId: 'aladdin_jafar',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 80,
        });
        expect(jafar.events).toEqual([]);

        const stoneford = invokeRegisteredAbilityContract('vigilantes_stoneford', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'stoneford',
            defId: 'vigilantes_stoneford',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 81,
        });
        expect(stoneford.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(false);
        expect(stoneford.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);

        const prep = invokeRegisteredAbilityContract('teens_prep', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'prep',
            defId: 'teens_prep',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 82,
        });
        expect(prep.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);

        const astounding = invokeRegisteredAbilityContract('all_stars_its_astounding', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'astounding',
            defId: 'all_stars_its_astounding',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 86,
        });
        expect(astounding.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(false);

        const servitor = invokeRegisteredAbilityContract('all_stars_servitor_of_cthulhu', 'talent', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'servitor',
            defId: 'all_stars_servitor_of_cthulhu',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 87,
        });
        expect(servitor.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_TOP)).toBe(false);
        expect(servitor.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const seraphim = invokeRegisteredAbilityContract('paladins_roland', 'talent', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'roland',
            defId: 'paladins_roland',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 96,
        });
        expect(seraphim.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);
        expect(seraphim.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const mindLady = invokeRegisteredAbilityContract('superheroes_mind_lady', 'talent', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'mind-lady',
            defId: 'superheroes_mind_lady',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 97,
        });
        expect(mindLady.events.some(event => event.type === SU_EVENTS.CARD_SUPPRESSED)).toBe(false);

        const stampede = invokeRegisteredAbilityContract('lion_king_wildebeest_stampede', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'stampede',
            defId: 'lion_king_wildebeest_stampede',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 88,
        });
        expect(stampede.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(stampede.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);

        const ohHoh = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: undefined,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy-entered',
            triggerMinionDefId: 'pirate_buccaneer',
            random: FIXED_RANDOM,
            now: 89,
        });
        expect(ohHoh.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);

        const cubScoutPod = fireTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: undefined,
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'cub-moved',
            triggerMinionDefId: 'pirate_buccaneer',
            random: FIXED_RANDOM,
            now: 89.5,
        });
        expect(cubScoutPod.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const rafiki = invokeRegisteredAbilityContract('lion_king_rafiki', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'rafiki',
            defId: 'lion_king_rafiki',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 90,
        });
        expect(rafiki.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(false);

        const fixIt = invokeRegisteredAbilityContract('truckers_fixin_to_fix_it', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'fix-it',
            defId: 'truckers_fixin_to_fix_it',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 93,
        });
        expect(fixIt.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(false);

        const muchoslam = invokeRegisteredAbilityContract('luchadors_senor_muchoslam', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'muchoslam',
            defId: 'luchadors_senor_muchoslam',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 94,
        });
        expect(muchoslam.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(false);

        const discoLou = invokeRegisteredAbilityContract('disco_dancers_ul_disco_lou', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'disco-lou',
            defId: 'disco_dancers_ul_disco_lou',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 95,
        });
        expect(discoLou.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_TOP)).toBe(false);

        const volcano = invokeRegisteredAbilityContract('polynesian_voyagers_volcanic_uprising', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'volcano',
            defId: 'polynesian_voyagers_volcanic_uprising',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 91,
        });
        expect(volcano.events.some(event => event.type === SU_EVENTS.BASE_REPLACED)).toBe(true);
        expect(volcano.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);

        const timeTravelersAstounding = invokeRegisteredAbilityContract('time_travelers_its_astounding', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'time-travelers-astounding',
            defId: 'time_travelers_its_astounding',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 92,
        });
        expect(timeTravelersAstounding.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(false);

        const timeIsFleeting = invokeRegisteredAbilityContract('time_travelers_time_is_fleeting', 'special', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'time-is-fleeting',
            defId: 'time_travelers_time_is_fleeting',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 98,
        });
        expect(timeIsFleeting.events.some(event => event.type === SU_EVENTS.BASE_DECK_REORDERED)).toBe(false);

        const killerSprout = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: undefined,
            playerId: '0',
            triggerMinionUid: 'killer-sprout',
            triggerMinionDefId: 'killer_plant_sprout',
            sourceCardUid: 'killer-sprout',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 99,
        });
        expect(killerSprout.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(killerSprout.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);

        const venus = invokeRegisteredAbilityContract('killer_plant_venus_man_trap', 'talent', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'venus-trap',
            defId: 'killer_plant_venus_man_trap',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 100,
        });
        expect(venus.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);

        const firstMate = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: undefined,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 1 }],
            random: FIXED_RANDOM,
            now: 83,
        });
        expect(firstMate.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);

        const outbreak = invokeRegisteredAbilityContract('zombie_outbreak', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'outbreak',
            defId: 'zombie_outbreak',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 84,
        });
        expect(outbreak.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);

        for (const defId of ['werewolf_chew_toy', 'werewolf_let_the_dog_out'] as const) {
            const result = invokeRegisteredAbilityContract(defId, 'onPlay', {
                state: core,
                matchState: undefined,
                playerId: '0',
                cardUid: defId,
                defId,
                baseIndex: 0,
                random: FIXED_RANDOM,
                now: 85,
            });
            expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED), defId).toBe(false);
        }
    });

    it('翻开埋葬的持续行动时，单个合法宿主也必须等待玩家确认', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_alpha',
                    minions: [makeMinion('only-target', 'frozen_anna', '0', 3)],
                    ongoingActions: [],
                    buriedCards: [{
                        uid: 'buried-ongoing',
                        defId: 'cyborg_apes_monkey_on_your_back',
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'hand',
                    } as any],
                }),
            ],
        });

        const uncovered = uncoverBuriedCard({
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'buried-ongoing',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
            reason: 'test_uncover',
        });

        expect(uncovered.events.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(false);
        const prompt = getFirstPrompt(uncovered.state);
        expect(getPromptHandlerData(prompt).sourceId).toBe('bury_uncover_ongoing_target');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt)).toHaveLength(1);
    });

    it('古老者强制对手选随从时，单个可毁目标也不能由系统代选', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('madness-1', MADNESS_CARD_DEF_ID, 'action', '1')],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_alpha',
                    minions: [makeMinion('only-enemy', 'frozen_anna', '1', 3)],
                    ongoingActions: [],
                }),
            ],
        });

        const result = invokeRegisteredAbilityContract('elder_thing_unfathomable_goals', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'goals',
            defId: 'elder_thing_unfathomable_goals',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 60,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});
