import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const CARD_ATLAS = SMASHUP_ATLAS_IDS.EXCELLENT_MOVIES_TEENS_CARDS;

const ACTION_HEROES = SMASHUP_FACTION_IDS.ACTION_HEROES;
const BACKTIMERS = SMASHUP_FACTION_IDS.BACKTIMERS;
const EXTRAMORPHS = SMASHUP_FACTION_IDS.EXTRAMORPHS;
const TEENS = SMASHUP_FACTION_IDS.TEENS;
const WRAITHRUSTLERS = SMASHUP_FACTION_IDS.WRAITHRUSTLERS;

type MinionOverrides = Partial<Omit<MinionCardDef, 'id' | 'type' | 'name' | 'nameEn' | 'faction' | 'power' | 'count' | 'previewRef'>>;
type ActionOverrides = Partial<Omit<ActionCardDef, 'id' | 'type' | 'name' | 'nameEn' | 'faction' | 'count' | 'previewRef'>>;

function minion(
    id: string,
    nameEn: string,
    faction: string,
    power: number,
    count: number,
    slot: number,
    overrides: MinionOverrides = {},
): MinionCardDef {
    return {
        id,
        type: 'minion',
        name: nameEn,
        nameEn,
        faction,
        power,
        count,
        previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: slot },
        ...overrides,
    };
}

function action(
    id: string,
    nameEn: string,
    faction: string,
    count: number,
    slot: number,
    overrides: ActionOverrides = {},
): ActionCardDef {
    return {
        id,
        type: 'action',
        subtype: overrides.subtype ?? 'standard',
        name: nameEn,
        nameEn,
        faction,
        count,
        previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: slot },
        ...overrides,
    };
}

export const ACTION_HEROES_MINIONS: MinionCardDef[] = [
    minion('action_heroes_commandbro', 'Commandbro', ACTION_HEROES, 5, 1, 0, { abilityTags: ['ongoing'] }),
    minion('action_heroes_gracie_brones', 'Gracie Brones', ACTION_HEROES, 5, 1, 1, { abilityTags: ['ongoing'] }),
    minion('action_heroes_kickboxbro', 'Kickboxbro', ACTION_HEROES, 5, 1, 2, {
        abilityTags: ['ongoing', 'talent', 'special', 'extra'],
        activatableAbilities: [
            { kind: 'talent', zone: 'board', window: 'playCards' },
            { kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'scoringBase' },
        ],
    }),
    minion('action_heroes_robobro', 'Robobro', ACTION_HEROES, 5, 1, 3, { abilityTags: ['ongoing'] }),
    minion('action_heroes_rumbro', 'Rumbro', ACTION_HEROES, 5, 1, 4, { abilityTags: ['ongoing'] }),
    minion('action_heroes_warbro', 'Warbro', ACTION_HEROES, 5, 1, 5, {
        abilityTags: ['talent'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
];

export const ACTION_HEROES_ACTIONS: ActionCardDef[] = [
    action('action_heroes_all_out_of_bubblegum', 'All Out of Bubblegum', ACTION_HEROES, 2, 6, {
        abilityTags: ['onPlay', 'extra'],
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('action_heroes_collateral_damage', 'Collateral Damage', ACTION_HEROES, 1, 7, {
        abilityTags: ['onPlay'],
        playNeedsBase: true,
    }),
    action('action_heroes_final_stand', 'Final Stand', ACTION_HEROES, 1, 8, {
        subtype: 'special',
        abilityTags: ['special'],
        specialTiming: 'beforeScoring',
        specialNeedsBase: true,
        responseWindowTiming: 'beforeScoring',
        responseWindowNeedsBase: true,
    }),
    action('action_heroes_friends_through_eternity', 'Friends Through Eternity', ACTION_HEROES, 1, 9, {
        abilityTags: ['onPlay', 'extra'],
    }),
    action('action_heroes_get_to_the_choppa', 'Get to the Choppa!', ACTION_HEROES, 1, 10, {
        abilityTags: ['onPlay', 'extra'],
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('action_heroes_hostage_rescue', 'Hostage Rescue', ACTION_HEROES, 2, 11, { abilityTags: ['onPlay'] }),
    action('action_heroes_lone_wolf', 'Lone Wolf', ACTION_HEROES, 2, 12, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('action_heroes_pushing_the_limit', 'Pushing the Limit', ACTION_HEROES, 1, 13, { abilityTags: ['onPlay'] }),
    action('action_heroes_slo_mo_attack', 'Slo-Mo Attack', ACTION_HEROES, 1, 14, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'talent'],
        ongoingTarget: 'base',
        playNeedsBase: true,
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('action_heroes_the_right_person', 'The Right Person', ACTION_HEROES, 1, 15, {
        abilityTags: ['onPlay', 'extra'],
    }),
    action('action_heroes_walk_away_slowly', 'Walk Away... Slowly', ACTION_HEROES, 1, 16, {
        subtype: 'special',
        abilityTags: ['special'],
        specialTiming: 'afterScoring',
        responseWindowTiming: 'afterScoring',
        responseWindowNeedsBase: true,
    }),
];

export const BACKTIMERS_MINIONS: MinionCardDef[] = [
    minion('backtimers_sidelined_girlfriend', 'Sidelined Girlfriend', BACKTIMERS, 2, 4, 17, { abilityTags: ['onPlay', 'special', 'extra'] }),
    minion('backtimers_lifelong_bully', 'Lifelong Bully', BACKTIMERS, 3, 3, 18, { abilityTags: ['onPlay'] }),
    minion('backtimers_zany_prof', 'Zany Prof', BACKTIMERS, 4, 2, 19, { abilityTags: ['ongoing'] }),
    minion('backtimers_alex_p_mcglide', 'Alex P. McGlide', BACKTIMERS, 5, 1, 20, {
        abilityTags: ['onPlay', 'talent'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
];

export const BACKTIMERS_ACTIONS: ActionCardDef[] = [
    action('backtimers_back_from_the_future', 'Back From the Future', BACKTIMERS, 2, 21, { abilityTags: ['onPlay'] }),
    action('backtimers_99_mph', '99 MPH', BACKTIMERS, 2, 22, { abilityTags: ['onPlay'] }),
    action('backtimers_future_almanac', 'Future Almanac?', BACKTIMERS, 1, 23, { abilityTags: ['onPlay', 'special'] }),
    action('backtimers_lightning_strike', 'Lightning Strike', BACKTIMERS, 1, 24, { abilityTags: ['onPlay', 'special'] }),
    action('backtimers_will_have_to_do', 'Will Have to Do', BACKTIMERS, 1, 25, { abilityTags: ['onPlay'] }),
    action('backtimers_help_from_the_past', 'Help From the Past', BACKTIMERS, 1, 26, { abilityTags: ['onPlay', 'special', 'extra'] }),
    action('backtimers_letter_from_another_time', 'Letter From Another Time', BACKTIMERS, 1, 27, { abilityTags: ['onPlay', 'special', 'extra'] }),
    action('backtimers_disrupt_the_space_time_continuum', 'Disrupt the Space-Time Continuum', BACKTIMERS, 1, 28, { abilityTags: ['onPlay'] }),
];

export const EXTRAMORPHS_MINIONS: MinionCardDef[] = [
    minion('extramorphs_chestbreaker', 'Chestbreaker', EXTRAMORPHS, 2, 4, 29, {
        abilityTags: ['talent', 'extra'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    minion('extramorphs_extradrone', 'Extradrone', EXTRAMORPHS, 3, 3, 30, { abilityTags: ['onPlay'] }),
    minion('extramorphs_alien_life_form', 'Alien Life Form', EXTRAMORPHS, 4, 2, 31, {
        abilityTags: ['onPlay', 'talent'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    minion('extramorphs_hive_queen', 'Hive Queen', EXTRAMORPHS, 5, 1, 32, {
        abilityTags: ['onPlay', 'talent'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
];

export const EXTRAMORPHS_ACTIONS: ActionCardDef[] = [
    action('extramorphs_close_encounters', 'Close Encounters', EXTRAMORPHS, 1, 33, { abilityTags: ['onPlay', 'extra'] }),
    action('extramorphs_distress_call', 'Distress Call', EXTRAMORPHS, 1, 34, {
        abilityTags: ['onPlay'],
        playNeedsMinion: true,
        playTargetMinionController: 'any',
    }),
    action('extramorphs_egg_field', 'Egg Field', EXTRAMORPHS, 2, 35, {
        subtype: 'ongoing',
        abilityTags: ['onPlay', 'ongoing', 'talent', 'extra'],
        ongoingTarget: 'base',
        playNeedsBase: true,
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('extramorphs_five_by_five', 'Five by Five', EXTRAMORPHS, 1, 36, { abilityTags: ['onPlay'] }),
    action('extramorphs_game_over_dude', 'Game Over, Dude!', EXTRAMORPHS, 1, 37, {
        abilityTags: ['onPlay', 'extra'],
        playNeedsBase: true,
    }),
    action('extramorphs_head_grabber', 'Head Grabber', EXTRAMORPHS, 2, 38, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'talent', 'extra'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'any',
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('extramorphs_nuke_it_from_orbit', 'Nuke It From Orbit', EXTRAMORPHS, 1, 39, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'talent'],
        ongoingTarget: 'base',
        playNeedsBase: true,
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('extramorphs_time_to_go', 'Time to Go', EXTRAMORPHS, 1, 40, { abilityTags: ['onPlay'] }),
];

export const TEENS_MINIONS: MinionCardDef[] = [
    minion('teens_brain', 'Brain', TEENS, 3, 2, 41, { abilityTags: ['onPlay', 'ongoing', 'extra'] }),
    minion('teens_jock', 'Jock', TEENS, 3, 2, 42, { abilityTags: ['onPlay', 'ongoing'] }),
    minion('teens_prep', 'Prep', TEENS, 3, 2, 43, { abilityTags: ['onPlay', 'ongoing'] }),
    minion('teens_rebel', 'Rebel', TEENS, 3, 2, 44, { abilityTags: ['onPlay', 'ongoing', 'extra'] }),
    minion('teens_slacker', 'Slacker', TEENS, 3, 2, 45, { abilityTags: ['onPlay', 'ongoing'] }),
];

export const TEENS_ACTIONS: ActionCardDef[] = [
    action('teens_abe_frohman', 'Abe Frohman', TEENS, 2, 46, {
        subtype: 'ongoing',
        abilityTags: ['talent', 'ongoing'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('teens_babysitter', 'Babysitter', TEENS, 1, 47, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('teens_booty_trap', 'Booty Trap', TEENS, 1, 48, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('teens_brunch_bunch', 'Brunch Bunch', TEENS, 1, 49, {
        abilityTags: ['onPlay', 'extra'],
        playNeedsBase: true,
    }),
    action('teens_explosion_at_school', 'Explosion at School', TEENS, 1, 50, { abilityTags: ['onPlay'] }),
    action('teens_new_kid', 'New Kid', TEENS, 2, 51, { abilityTags: ['onPlay', 'extra'] }),
    action('teens_principals_office', "Principal's Office", TEENS, 1, 52, {
        abilityTags: ['onPlay', 'extra'],
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('teens_strange_science', 'Strange Science', TEENS, 1, 53, { abilityTags: ['onPlay', 'extra'] }),
];

export const WRAITHRUSTLERS_MINIONS: MinionCardDef[] = [
    minion('wraithrustlers_watson', 'Watson', WRAITHRUSTLERS, 2, 4, 54, { abilityTags: ['onPlay'] }),
    minion('wraithrustlers_roy', 'Roy', WRAITHRUSTLERS, 3, 3, 55, { abilityTags: ['onPlay', 'ongoing'] }),
    minion('wraithrustlers_ellen', 'Ellen', WRAITHRUSTLERS, 4, 2, 56, {
        abilityTags: ['talent', 'ongoing', 'extra'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    minion('wraithrustlers_funkman', 'Funkman', WRAITHRUSTLERS, 5, 1, 57, {
        abilityTags: ['ongoing', 'special'],
        activatableAbilities: [{ kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'anyBase' }],
    }),
];

export const WRAITHRUSTLERS_ACTIONS: ActionCardDef[] = [
    action('wraithrustlers_ancient_sumerian_god', 'Ancient Sumerian God', WRAITHRUSTLERS, 1, 58, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'talent', 'extra'],
        ongoingTarget: 'base',
        playNeedsBase: true,
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('wraithrustlers_demon_dogs', 'Demon Dogs', WRAITHRUSTLERS, 2, 59, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'onDestroy', 'extra'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('wraithrustlers_ectoplasm_one', 'Ectoplasm One', WRAITHRUSTLERS, 1, 60, {
        subtype: 'ongoing',
        abilityTags: ['talent', 'ongoing'],
        ongoingTarget: 'base',
        playNeedsBase: true,
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('wraithrustlers_librarian_haunt', 'Librarian Haunt', WRAITHRUSTLERS, 2, 61, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'onDestroy'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('wraithrustlers_resurgence', 'Resurgence', WRAITHRUSTLERS, 1, 62, {
        abilityTags: ['onPlay', 'special'],
        playNeedsBase: true,
        responseWindowTiming: 'beforeScoring',
        responseWindowNeedsBase: true,
    }),
    action('wraithrustlers_slimy', 'Slimy', WRAITHRUSTLERS, 1, 63, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'onDestroy'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('wraithrustlers_the_tools_and_the_talent', 'The Tools and The Talent', WRAITHRUSTLERS, 1, 64, { abilityTags: ['onPlay'] }),
    action('wraithrustlers_unlicensed_nuclear_accelerator', 'Unlicensed Nuclear Accelerator', WRAITHRUSTLERS, 1, 65, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'talent'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
];

export const ACTION_HEROES_CARDS: CardDef[] = [...ACTION_HEROES_MINIONS, ...ACTION_HEROES_ACTIONS];
export const BACKTIMERS_CARDS: CardDef[] = [...BACKTIMERS_MINIONS, ...BACKTIMERS_ACTIONS];
export const EXTRAMORPHS_CARDS: CardDef[] = [...EXTRAMORPHS_MINIONS, ...EXTRAMORPHS_ACTIONS];
export const TEENS_CARDS: CardDef[] = [...TEENS_MINIONS, ...TEENS_ACTIONS];
export const WRAITHRUSTLERS_CARDS: CardDef[] = [...WRAITHRUSTLERS_MINIONS, ...WRAITHRUSTLERS_ACTIONS];

export const EXCELLENT_MOVIES_TEENS_CARDS: CardDef[] = [
    ...ACTION_HEROES_CARDS,
    ...BACKTIMERS_CARDS,
    ...EXTRAMORPHS_CARDS,
    ...TEENS_CARDS,
    ...WRAITHRUSTLERS_CARDS,
];

export const EXCELLENT_MOVIES_TEENS_BASES: BaseCardDef[] = [
    { id: 'base_building_rooftop', name: '楼顶', nameEn: 'Building Rooftop', breakpoint: 20, vpAwards: [3, 1, 1], faction: ACTION_HEROES },
    { id: 'base_jungle_camp', name: '丛林营地', nameEn: 'Jungle Camp', breakpoint: 20, vpAwards: [3, 2, 1], faction: ACTION_HEROES },
    { id: 'base_alternate_present', name: '另类现在', nameEn: 'Alternate Present', breakpoint: 20, vpAwards: [4, 2, 2], faction: BACKTIMERS },
    { id: 'base_time_traveling_car', name: '时间旅行汽车', nameEn: 'Time-Traveling Car', breakpoint: 22, vpAwards: [3, 2, 1], faction: BACKTIMERS },
    { id: 'base_ancient_crashed_ship', name: '古代坠毁飞船', nameEn: 'Ancient Crashed Ship', breakpoint: 21, vpAwards: [4, 2, 1], faction: EXTRAMORPHS },
    { id: 'base_brood_hive', name: '育巢', nameEn: 'Brood Hive', breakpoint: 22, vpAwards: [4, 2, 1], faction: EXTRAMORPHS },
    { id: 'base_cabin_in_the_woods', name: '林中小屋', nameEn: 'Cabin in the Woods', breakpoint: 24, vpAwards: [4, 3, 1], faction: TEENS },
    { id: 'base_montridge_high', name: '蒙特里奇高中', nameEn: 'Montridge High', breakpoint: 20, vpAwards: [4, 2, 1], faction: TEENS },
    { id: 'base_rooftop_portal', name: '屋顶传送门', nameEn: 'Rooftop Portal', breakpoint: 22, vpAwards: [5, 3, 2], faction: WRAITHRUSTLERS },
    { id: 'base_wraithrustlers_hq', name: '怨灵捕手总部', nameEn: 'Wraithrustlers HQ', breakpoint: 20, vpAwards: [4, 2, 1], faction: WRAITHRUSTLERS },
];
