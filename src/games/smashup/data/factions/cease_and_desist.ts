import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const CARD_ATLAS = SMASHUP_ATLAS_IDS.CEASE_AND_DESIST_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.CEASE_AND_DESIST_BASES;

const ASTROKNIGHTS = SMASHUP_FACTION_IDS.ASTROKNIGHTS;
const IGNOBLES = SMASHUP_FACTION_IDS.IGNOBLES;
const STAR_ROAMERS = SMASHUP_FACTION_IDS.STAR_ROAMERS;
const CHANGERBOTS = SMASHUP_FACTION_IDS.CHANGERBOTS;

export const ASTROKNIGHTS_ACTIONS: ActionCardDef[] = [
    { id: 'astroknights_block_the_probe', type: 'action', subtype: 'special', name: '阻止探解', nameEn: 'Block the Probe', faction: ASTROKNIGHTS, abilityTags: ['onPlay', 'special'], specialTiming: 'beforeScoring', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 0 } },
    { id: 'astroknights_hidden_base', type: 'action', subtype: 'ongoing', name: '隐蔽基地', nameEn: 'Hidden Base', faction: ASTROKNIGHTS, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 1 } },
    { id: 'astroknights_recycle_the_trash', type: 'action', subtype: 'standard', name: '垃圾回收', nameEn: 'Recycle the Trash', faction: ASTROKNIGHTS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 2 } },
    { id: 'astroknights_yield_to_rage', type: 'action', subtype: 'standard', name: '狂怒支配', nameEn: 'Yield to Rage', faction: ASTROKNIGHTS, abilityTags: ['onPlay', 'extra'], playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 3 } },
    { id: 'astroknights_laser_sword', type: 'action', subtype: 'ongoing', name: '激光剑', nameEn: 'Laser Sword', faction: ASTROKNIGHTS, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 4 } },
    { id: 'astroknights_prepare_for_battle', type: 'action', subtype: 'standard', name: '战斗准备', nameEn: 'Prepare for Battle', faction: ASTROKNIGHTS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 5 } },
    { id: 'astroknights_use_the_fours', type: 'action', subtype: 'standard', name: '使用“似”原力', nameEn: 'Use the Fours', faction: ASTROKNIGHTS, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 8 } },
    { id: 'astroknights_its_a_trap', type: 'action', subtype: 'special', name: '这是个陷阱！', nameEn: "It's a Trap!", faction: ASTROKNIGHTS, abilityTags: ['special'], specialTiming: 'beforeScoring', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 17 } },
];

export const ASTROKNIGHTS_MINIONS: MinionCardDef[] = [
    { id: 'astroknights_annoying_alien', type: 'minion', name: '恼人的外星', nameEn: 'Annoying Alien', faction: ASTROKNIGHTS, power: 2, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 6 } },
    { id: 'astroknights_pupoks', type: 'minion', name: '帕伯克人', nameEn: 'Pupoks', faction: ASTROKNIGHTS, power: 2, abilityTags: ['talent', 'extra'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 7 } },
    { id: 'astroknights_alien_guru', type: 'minion', name: '外星人大师', nameEn: 'Alien Guru', faction: ASTROKNIGHTS, power: 2, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 9 } },
    { id: 'astroknights_walking_carpet', type: 'minion', name: '自主地毯', nameEn: 'Walking Carpet', faction: ASTROKNIGHTS, power: 4, abilityTags: ['special'], beforeScoringPlayable: false, activatableAbilities: [{ kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'scoringBase' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 10 } },
    { id: 'astroknights_scoundrel', type: 'minion', name: '恶棍', nameEn: 'Scoundrel', faction: ASTROKNIGHTS, power: 4, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 11 } },
    { id: 'astroknights_ghost_knight', type: 'minion', name: '幽灵武士', nameEn: 'Ghost Knight', faction: ASTROKNIGHTS, power: 0, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 12 } },
    { id: 'astroknights_mannersbot', type: 'minion', name: '礼仪机器人', nameEn: 'Mannersbot', faction: ASTROKNIGHTS, power: 2, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 13 } },
    { id: 'astroknights_space_prince', type: 'minion', name: '太空王子', nameEn: 'Space Prince', faction: ASTROKNIGHTS, power: 4, abilityTags: ['talent', 'extra'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 14 } },
    { id: 'astroknights_space_knight', type: 'minion', name: '太空武士', nameEn: 'Space Knight', faction: ASTROKNIGHTS, power: 5, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 15 } },
    { id: 'astroknights_astro_robot', type: 'minion', name: '宇航机器人', nameEn: 'Astro Robot', faction: ASTROKNIGHTS, power: 2, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 16 } },
];

export const IGNOBLES_ACTIONS: ActionCardDef[] = [
    { id: 'ignobles_repaying_debts', type: 'action', subtype: 'standard', name: '有债必还', nameEn: 'Repaying Debts', faction: IGNOBLES, abilityTags: ['onPlay', 'extra'], playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 18 } },
    { id: 'ignobles_fate_of_the_favorites', type: 'action', subtype: 'standard', name: '宠儿的命运', nameEn: 'Fate of the Favorites', faction: IGNOBLES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 19 } },
    { id: 'ignobles_red_birthday_party', type: 'action', subtype: 'standard', name: '红色生日聚会', nameEn: 'Red Birthday Party', faction: IGNOBLES, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 20 } },
    { id: 'ignobles_hostage_exchange', type: 'action', subtype: 'standard', name: '交换人质', nameEn: 'Hostage Exchange', faction: IGNOBLES, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 21 } },
    { id: 'ignobles_inevitable_betrayal', type: 'action', subtype: 'special', name: '必然的背叛', nameEn: 'Inevitable Betrayal', faction: IGNOBLES, abilityTags: ['special'], specialTiming: 'beforeScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 23 } },
    { id: 'ignobles_activate_the_spy', type: 'action', subtype: 'standard', name: '启用间谍', nameEn: 'Activate the Spy', faction: IGNOBLES, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 24 } },
    { id: 'ignobles_out_of_sight', type: 'action', subtype: 'standard', name: '视线之外', nameEn: 'Out of Sight', faction: IGNOBLES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 26 } },
    { id: 'ignobles_banner_call', type: 'action', subtype: 'standard', name: '家族召唤', nameEn: 'Banner Call', faction: IGNOBLES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 29 } },
];

export const IGNOBLES_MINIONS: MinionCardDef[] = [
    { id: 'ignobles_sneaky_squire', type: 'minion', name: '奸诈贵族', nameEn: 'Sneaky Squire', faction: IGNOBLES, power: 2, abilityTags: ['onPlay', 'extra'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 22 } },
    { id: 'ignobles_betrothed', type: 'minion', name: '未婚妻', nameEn: 'Betrothed', faction: IGNOBLES, power: 3, abilityTags: ['onPlay', 'ongoing'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 25 } },
    { id: 'ignobles_foot_of_the_king', type: 'minion', name: '国王之脚', nameEn: 'Foot of the King', faction: IGNOBLES, power: 4, abilityTags: ['ongoing'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 27 } },
    { id: 'ignobles_aunt_of_drakes', type: 'minion', name: '龙之伯母', nameEn: 'Aunt of Drakes', faction: IGNOBLES, power: 5, abilityTags: ['talent', 'extra'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 28 } },
];

export const STAR_ROAMERS_ACTIONS: ActionCardDef[] = [
    { id: 'star_roamers_weird_new_worlds', type: 'action', subtype: 'standard', name: '奇异新世界', nameEn: 'Weird New Worlds', faction: STAR_ROAMERS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 30 } },
    { id: 'star_roamers_whiplash_maneuver', type: 'action', subtype: 'ongoing', name: '鞭绳回旋', nameEn: 'Whiplash Maneuver', faction: STAR_ROAMERS, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 31 } },
    { id: 'star_roamers_protector_fields', type: 'action', subtype: 'ongoing', name: '防御力场', nameEn: 'Protector Fields', faction: STAR_ROAMERS, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, playConstraint: 'requireOwnMinion', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 32 } },
    { id: 'star_roamers_teleport_overflow', type: 'action', subtype: 'standard', name: '传送超额', nameEn: 'Teleport Overflow', faction: STAR_ROAMERS, abilityTags: ['onPlay', 'extra'], playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 33 } },
    { id: 'star_roamers_teleport_error', type: 'action', subtype: 'standard', name: '传送事故', nameEn: 'Teleport Error', faction: STAR_ROAMERS, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 34 } },
    { id: 'star_roamers_hyperspeed_10', type: 'action', subtype: 'standard', name: '超高速运转', nameEn: 'Hyperspeed 10', faction: STAR_ROAMERS, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 35 } },
    { id: 'star_roamers_port_me_up', type: 'action', subtype: 'special', name: '传送我上船', nameEn: 'Port Me Up', faction: STAR_ROAMERS, abilityTags: ['onPlay', 'special'], specialTiming: 'afterScoring', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 37 } },
    { id: 'star_roamers_mass_teleport', type: 'action', subtype: 'standard', name: '大规模传送', nameEn: 'Mass Teleport', faction: STAR_ROAMERS, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 39 } },
];

export const STAR_ROAMERS_MINIONS: MinionCardDef[] = [
    { id: 'star_roamers_ships_engineer', type: 'minion', name: '舰船工程师', nameEn: "Ship's Engineer", faction: STAR_ROAMERS, power: 3, abilityTags: ['ongoing'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 36 } },
    { id: 'star_roamers_medical_officer', type: 'minion', name: '医疗指挥官', nameEn: 'Medical Officer', faction: STAR_ROAMERS, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 38 } },
    { id: 'star_roamers_science_officer', type: 'minion', name: '科学指挥官', nameEn: 'Science Officer', faction: STAR_ROAMERS, power: 4, abilityTags: ['talent', 'extra'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 40 } },
    { id: 'star_roamers_ensign', type: 'minion', name: '炮灰', nameEn: 'Ensign', faction: STAR_ROAMERS, power: 2, abilityTags: ['ongoing'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 41 } },
    { id: 'star_roamers_ships_captain', type: 'minion', name: '舰长', nameEn: "Ship's Captain", faction: STAR_ROAMERS, power: 5, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 42 } },
];

export const CHANGERBOTS_ACTIONS: ActionCardDef[] = [
    { id: 'changerbots_matrix_of_bossiness', type: 'action', subtype: 'ongoing', name: '跋扈模块', nameEn: 'Matrix of Bossiness', faction: CHANGERBOTS, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 43 } },
    { id: 'changerbots_change_into_a_gun', type: 'action', subtype: 'ongoing', name: '重组形态', nameEn: 'Change Into A Gun', faction: CHANGERBOTS, abilityTags: ['onPlay', 'ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 44 } },
    { id: 'changerbots_passengers', type: 'action', subtype: 'ongoing', name: '乘客', nameEn: 'Passengers', faction: CHANGERBOTS, abilityTags: ['talent'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 45 } },
    { id: 'changerbots_the_touch', type: 'action', subtype: 'ongoing', name: '触动', nameEn: 'The Touch', faction: CHANGERBOTS, abilityTags: ['talent'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 46 } },
    { id: 'changerbots_flighterizer', type: 'action', subtype: 'ongoing', name: '飞行组件', nameEn: 'Flighterizer', faction: CHANGERBOTS, abilityTags: ['talent'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 48 } },
    { id: 'changerbots_change_up_and_roll_on', type: 'action', subtype: 'special', name: '变形，出发！', nameEn: 'Change Up and Roll On', faction: CHANGERBOTS, abilityTags: ['special'], specialTiming: 'beforeScoring', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 50 } },
    { id: 'changerbots_cesium_armor', type: 'action', subtype: 'ongoing', name: '铯装甲', nameEn: 'Cesium Armor', faction: CHANGERBOTS, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 52 } },
    { id: 'changerbots_form_mergacon', type: 'action', subtype: 'standard', name: '合体形态', nameEn: 'Form Mergacon', faction: CHANGERBOTS, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 53 } },
];

export const CHANGERBOTS_MINIONS: MinionCardDef[] = [
    { id: 'changerbots_leader_two', type: 'minion', name: '李德徒', nameEn: 'Leader Two', faction: CHANGERBOTS, power: 6, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 47 } },
    { id: 'changerbots_solarshout', type: 'minion', name: '破空', nameEn: 'Solarshout', faction: CHANGERBOTS, power: 4, abilityTags: ['talent', 'extra'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 49 } },
    { id: 'changerbots_huffie', type: 'minion', name: '飞撕', nameEn: 'Huffie', faction: CHANGERBOTS, power: 3, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 51 } },
    { id: 'changerbots_bruiser', type: 'minion', name: '创世', nameEn: 'Bruiser', faction: CHANGERBOTS, power: 2, abilityTags: ['ongoing', 'talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 54 } },
];

export const ASTROKNIGHTS_CARDS: CardDef[] = [...ASTROKNIGHTS_ACTIONS, ...ASTROKNIGHTS_MINIONS];
export const IGNOBLES_CARDS: CardDef[] = [...IGNOBLES_ACTIONS, ...IGNOBLES_MINIONS];
export const STAR_ROAMERS_CARDS: CardDef[] = [...STAR_ROAMERS_ACTIONS, ...STAR_ROAMERS_MINIONS];
export const CHANGERBOTS_CARDS: CardDef[] = [...CHANGERBOTS_ACTIONS, ...CHANGERBOTS_MINIONS];

export const CEASE_AND_DESIST_CARDS: CardDef[] = [
    ...ASTROKNIGHTS_CARDS,
    ...IGNOBLES_CARDS,
    ...STAR_ROAMERS_CARDS,
    ...CHANGERBOTS_CARDS,
];

export const CEASE_AND_DESIST_BASES: BaseCardDef[] = [
    { id: 'base_spikey_chair_room', name: '刺王座', nameEn: 'Spikey Chair Room', breakpoint: 20, vpAwards: [4, 2, 1], faction: IGNOBLES, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 0 } },
    { id: 'base_no_moon', name: '非月球', nameEn: 'No-Moon', breakpoint: 25, vpAwards: [5, 3, 3], faction: ASTROKNIGHTS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 } },
    { id: 'base_uss_undertaking', name: '联邦星舰', nameEn: 'USS Undertaking', breakpoint: 22, vpAwards: [4, 2, 1], faction: STAR_ROAMERS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 2 } },
    { id: 'base_unicrave', name: '宇宙大王', nameEn: 'Unicrave', breakpoint: 19, vpAwards: [0, 0, 0], faction: CHANGERBOTS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 3 } },
    { id: 'base_wintersquashed', name: '雪覆城', nameEn: 'Wintersquashed', breakpoint: 16, vpAwards: [2, 4, 1], faction: IGNOBLES, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 4 } },
    { id: 'base_changing_room', name: '改造室', nameEn: 'Changing Room', breakpoint: 22, vpAwards: [5, 3, 2], faction: CHANGERBOTS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 5 } },
    { id: 'base_neutral_space', name: '中立区', nameEn: 'Neutral Space', breakpoint: 18, vpAwards: [3, 2, 1], faction: STAR_ROAMERS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 6 } },
    { id: 'base_hive_of_scum_and_villainy', name: '渣渣和坏蛋的老巢', nameEn: 'Hive of Scum and Villainy', breakpoint: 18, vpAwards: [4, 2, 1], faction: ASTROKNIGHTS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 7 } },
];
