import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const CARD_ATLAS = SMASHUP_ATLAS_IDS.INTERNATIONAL_INCIDENT_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.INTERNATIONAL_INCIDENT_BASES;

const SUMO = SMASHUP_FACTION_IDS.SUMO_WRESTLERS;
const MUSKETEERS = SMASHUP_FACTION_IDS.MUSKETEERS;
const MOUNTIES = SMASHUP_FACTION_IDS.MOUNTIES;
const LUCHADORS = SMASHUP_FACTION_IDS.LUCHADORS;

export const SUMO_WRESTLERS_ACTIONS: ActionCardDef[] = [
    { id: 'sumo_wrestlers_technique_prize', type: 'action', subtype: 'standard', name: '技术奖', nameEn: 'Technique Prize', faction: SUMO, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 0 } },
    { id: 'sumo_wrestlers_performance_prize', type: 'action', subtype: 'standard', name: '表演奖', nameEn: 'Performance Prize', faction: SUMO, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 2 } },
    { id: 'sumo_wrestlers_head_butt', type: 'action', subtype: 'standard', name: '头槌', nameEn: 'Head Butt', faction: SUMO, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 3 } },
    { id: 'sumo_wrestlers_bulking_stew', type: 'action', subtype: 'standard', name: '炖肉', nameEn: 'Bulking Stew', faction: SUMO, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 4 } },
    { id: 'sumo_wrestlers_body_slam', type: 'action', subtype: 'standard', name: '身体猛击', nameEn: 'Body Slam', faction: SUMO, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 5 } },
    { id: 'sumo_wrestlers_chikara_mizu', type: 'action', subtype: 'standard', name: '力量满溢', nameEn: 'Chikara-Mizu', faction: SUMO, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 6 } },
    { id: 'sumo_wrestlers_grasp_the_belt', type: 'action', subtype: 'standard', name: '抓住腰带', nameEn: 'Grasp the Belt', faction: SUMO, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 8 } },
    { id: 'sumo_wrestlers_fighting_spirit_prize', type: 'action', subtype: 'standard', name: '斗志奖', nameEn: 'Fighting Spirit Prize', faction: SUMO, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 9 } },
];

export const SUMO_WRESTLERS_MINIONS: MinionCardDef[] = [
    { id: 'sumo_wrestlers_yokozuna', type: 'minion', name: '横纲', nameEn: 'Yokozuna', faction: SUMO, power: 6, abilityTags: ['ongoing', 'talent'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 1 } },
    { id: 'sumo_wrestlers_third_tier', type: 'minion', name: '关胁', nameEn: 'Third Tier', faction: SUMO, power: 3, abilityTags: ['talent'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 7 } },
    { id: 'sumo_wrestlers_top_tier', type: 'minion', name: '大关', nameEn: 'Top Tier', faction: SUMO, power: 4, abilityTags: ['ongoing'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 10 } },
    { id: 'sumo_wrestlers_rookie_sumo', type: 'minion', name: '相扑新人', nameEn: 'Rookie Sumo', faction: SUMO, power: 2, abilityTags: ['talent'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 11 } },
];

export const MUSKETEERS_ACTIONS: ActionCardDef[] = [
    { id: 'musketeers_on_a_roll', type: 'action', subtype: 'standard', name: '连连获胜', nameEn: 'On a Roll', faction: MUSKETEERS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 12 } },
    { id: 'musketeers_make_way', type: 'action', subtype: 'standard', name: '让路', nameEn: 'Make Way', faction: MUSKETEERS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 13 } },
    { id: 'musketeers_en_garde', type: 'action', subtype: 'standard', name: '预备姿势', nameEn: 'En Garde', faction: MUSKETEERS, abilityTags: ['onPlay', 'extra'], playNeedsMinion: true, playTargetMinionController: 'any', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 14 } },
    { id: 'musketeers_biding_time', type: 'action', subtype: 'standard', name: '等待时间', nameEn: 'Biding Time', faction: MUSKETEERS, abilityTags: ['onPlay', 'extra'], playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 15 } },
    { id: 'musketeers_to_battle', type: 'action', subtype: 'standard', name: '奋斗！', nameEn: 'To Battle!', faction: MUSKETEERS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 16 } },
    { id: 'musketeers_one_for_all', type: 'action', subtype: 'standard', name: '一为全', nameEn: 'One for All', faction: MUSKETEERS, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 19 } },
    { id: 'musketeers_last_stand', type: 'action', subtype: 'special', name: '最后一搏', nameEn: 'Last Stand', faction: MUSKETEERS, abilityTags: ['special'], count: 1, specialTiming: 'beforeScoring', specialNeedsBase: true, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 21 } },
    { id: 'musketeers_all_for_one', type: 'action', subtype: 'ongoing', name: '全为一', nameEn: 'All for One', faction: MUSKETEERS, abilityTags: ['onPlay', 'ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 23 } },
    { id: 'musketeers_token_of_affection', type: 'action', subtype: 'standard', name: '亲情的象征', nameEn: 'Token of Affection', faction: MUSKETEERS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 24 } },
];

export const MUSKETEERS_MINIONS: MinionCardDef[] = [
    { id: 'musketeers_porthos', type: 'minion', name: 'Porthos', nameEn: 'Porthos', faction: MUSKETEERS, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 17 } },
    { id: 'musketeers_athos', type: 'minion', name: 'Athos', nameEn: 'Athos', faction: MUSKETEERS, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 18 } },
    { id: 'musketeers_young_musketeer', type: 'minion', name: '年轻的火枪手', nameEn: 'Young Musketeer', faction: MUSKETEERS, power: 3, abilityTags: ['ongoing'], count: 5, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 20 } },
    { id: 'musketeers_dartagnan', type: 'minion', name: "D'Artagnan", nameEn: "D'Artagnan", faction: MUSKETEERS, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 22 } },
    { id: 'musketeers_aramis', type: 'minion', name: 'Aramis', nameEn: 'Aramis', faction: MUSKETEERS, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 25 } },
];

export const MOUNTIES_ACTIONS: ActionCardDef[] = [
    { id: 'mounties_eh', type: 'action', subtype: 'special', name: '嗯？', nameEn: 'Eh?', faction: MOUNTIES, abilityTags: ['special'], count: 1, specialTiming: 'triggered', playNeedsMinion: true, playTargetMinionController: 'self', activatableAbilities: [{ kind: 'special', zone: 'discard', window: 'playCards' }], previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 26 } },
    { id: 'mounties_bring_em_in', type: 'action', subtype: 'ongoing', name: '带进来', nameEn: "Bring 'Em In", faction: MOUNTIES, abilityTags: ['ongoing'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'opponent', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 27 } },
    { id: 'mounties_when_calls_the_badge', type: 'action', subtype: 'special', name: '呼叫警徽', nameEn: 'When Calls the Badge', faction: MOUNTIES, abilityTags: ['onPlay', 'special'], count: 1, specialTiming: 'beforeScoring', specialNeedsBase: true, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 31 } },
    { id: 'mounties_always_get_our_man', type: 'action', subtype: 'standard', name: '总是抓住我们的人', nameEn: 'Always Get Our Man', faction: MOUNTIES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 33 } },
    { id: 'mounties_battle_moose', type: 'action', subtype: 'ongoing', name: '战斗麋鹿', nameEn: 'Battle Moose', faction: MOUNTIES, abilityTags: ['ongoing'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 34 } },
    { id: 'mounties_power_poutine', type: 'action', subtype: 'standard', name: '力量肉汁薯条', nameEn: 'Power Poutine', faction: MOUNTIES, abilityTags: ['onPlay'], playNeedsBase: true, count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 35 } },
    { id: 'mounties_move_aboot', type: 'action', subtype: 'standard', name: '挪过去', nameEn: 'Move Aboot', faction: MOUNTIES, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 36 } },
    { id: 'mounties_haich_q', type: 'action', subtype: 'ongoing', name: 'Haich-Q', nameEn: 'Haich-Q', faction: MOUNTIES, abilityTags: ['ongoing', 'talent'], count: 1, ongoingTarget: 'base', playNeedsBase: true, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 37 } },
];

export const MOUNTIES_MINIONS: MinionCardDef[] = [
    { id: 'mounties_mountie_major', type: 'minion', name: '骑警少校', nameEn: 'Mountie Major', faction: MOUNTIES, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 28 } },
    { id: 'mounties_northern_mover', type: 'minion', name: '北方搬运者', nameEn: 'Northern Mover', faction: MOUNTIES, power: 4, abilityTags: ['talent'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 29 } },
    { id: 'mounties_war_canuck', type: 'minion', name: '战争骑警', nameEn: 'War Canuck', faction: MOUNTIES, power: 3, abilityTags: ['talent'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 30 } },
    { id: 'mounties_dudlee', type: 'minion', name: 'Dudlee', nameEn: 'Dudlee', faction: MOUNTIES, power: 2, abilityTags: ['talent'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 32 } },
];

export const LUCHADORS_ACTIONS: ActionCardDef[] = [
    { id: 'luchadors_quick_set_up', type: 'action', subtype: 'ongoing', name: '快速 Set-Up', nameEn: 'Quick Set-Up', faction: LUCHADORS, abilityTags: ['onPlay', 'ongoing', 'extra'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'opponent', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 38 } },
    { id: 'luchadors_smart_set_up', type: 'action', subtype: 'ongoing', name: '聪明 Set-Up', nameEn: 'Smart Set-Up', faction: LUCHADORS, abilityTags: ['ongoing'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'opponent', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 39 } },
    { id: 'luchadors_reversal', type: 'action', subtype: 'special', name: '逆转', nameEn: 'Reversal', faction: LUCHADORS, abilityTags: ['special'], count: 1, specialTiming: 'beforeScoring', specialNeedsBase: true, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 41 } },
    { id: 'luchadors_pin', type: 'action', subtype: 'ongoing', name: '压制', nameEn: 'Pin', faction: LUCHADORS, abilityTags: ['ongoing'], count: 2, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 42 } },
    { id: 'luchadors_powerful_set_up', type: 'action', subtype: 'ongoing', name: '强力 Set-Up', nameEn: 'Powerful Set-Up', faction: LUCHADORS, abilityTags: ['ongoing'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'opponent', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 44 } },
    { id: 'luchadors_tag_team', type: 'action', subtype: 'standard', name: '团队标记', nameEn: 'Tag-Team', faction: LUCHADORS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 45 } },
    { id: 'luchadors_out_for_the_count', type: 'action', subtype: 'standard', name: '点名出局', nameEn: 'Out for the Count', faction: LUCHADORS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 47 } },
    { id: 'luchadors_senor_muchoslam_vs_the_monsters', type: 'action', subtype: 'standard', name: 'Muchoslam先生vs怪物', nameEn: 'Senor Muchoslam vs the Monsters', faction: LUCHADORS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 48 } },
    { id: 'luchadors_cheap_pop', type: 'action', subtype: 'standard', name: '廉价欢呼', nameEn: 'Cheap Pop', faction: LUCHADORS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 50 } },
];

export const LUCHADORS_MINIONS: MinionCardDef[] = [
    { id: 'luchadors_yellow_demon', type: 'minion', name: '黄色恶魔', nameEn: 'Yellow Demon', faction: LUCHADORS, power: 2, abilityTags: ['onPlay'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 40 } },
    { id: 'luchadors_senor_muchoslam', type: 'minion', name: 'Muchoslam 先生', nameEn: 'Senor Muchoslam', faction: LUCHADORS, power: 5, abilityTags: ['onPlay', 'talent'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 43 } },
    { id: 'luchadors_capa_roja', type: 'minion', name: 'Capa Roja', nameEn: 'Capa Roja', faction: LUCHADORS, power: 4, abilityTags: ['special'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 46 } },
    { id: 'luchadors_flor_loca', type: 'minion', name: 'Flor Loca', nameEn: 'Flor Loca', faction: LUCHADORS, power: 3, abilityTags: ['ongoing'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 49 } },
];

export const SUMO_WRESTLERS_CARDS: CardDef[] = [
    ...SUMO_WRESTLERS_ACTIONS,
    ...SUMO_WRESTLERS_MINIONS,
];

export const MUSKETEERS_CARDS: CardDef[] = [
    ...MUSKETEERS_ACTIONS,
    ...MUSKETEERS_MINIONS,
];

export const MOUNTIES_CARDS: CardDef[] = [
    ...MOUNTIES_ACTIONS,
    ...MOUNTIES_MINIONS,
];

export const LUCHADORS_CARDS: CardDef[] = [
    ...LUCHADORS_ACTIONS,
    ...LUCHADORS_MINIONS,
];

export const INTERNATIONAL_INCIDENT_CARDS: CardDef[] = [
    ...SUMO_WRESTLERS_CARDS,
    ...MUSKETEERS_CARDS,
    ...MOUNTIES_CARDS,
    ...LUCHADORS_CARDS,
];

export const INTERNATIONAL_INCIDENT_BASES: BaseCardDef[] = [
    { id: 'base_heya_training_stable', name: '训练馆', nameEn: 'Heya Training Stable', breakpoint: 23, vpAwards: [4, 2, 1], faction: SUMO, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 12 } },
    { id: 'base_the_dohyo', name: '土俵', nameEn: 'The Dohyo', breakpoint: 17, vpAwards: [3, 2, 1], faction: SUMO, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 15 } },
    { id: 'base_bastion_saint_gervais', name: '圣热尔韦巴斯克堡垒', nameEn: 'Bastion Saint-Gervais', breakpoint: 25, vpAwards: [5, 4, 3], faction: MUSKETEERS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 13 } },
    { id: 'base_the_golden_lily', name: '黄金百合花', nameEn: 'The Golden Lily', breakpoint: 18, vpAwards: [3, 2, 2], faction: MUSKETEERS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 8 } },
    { id: 'base_strategic_syrup_reserve', name: '战略储备所', nameEn: 'Strategic Syrup Reserve', breakpoint: 23, vpAwards: [4, 2, 1], faction: MOUNTIES, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 9 } },
    { id: 'base_great_white_north_eh', name: '伟大的白色北方，嗯？', nameEn: 'Great White North, Eh?', breakpoint: 21, vpAwards: [2, 3, 1], faction: MOUNTIES, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 10 } },
    { id: 'base_ringside', name: '擂台', nameEn: 'Ringside', breakpoint: 21, vpAwards: [4, 2, 1], faction: LUCHADORS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 14 } },
    { id: 'base_the_squared_circle', name: '拳击台', nameEn: 'The Squared Circle', breakpoint: 18, vpAwards: [3, 1, 1], faction: LUCHADORS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 11 } },
];
