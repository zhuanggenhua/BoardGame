import type { ActionCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const ALL_STARS_POD_FACTION = SMASHUP_FACTION_IDS.ALL_STARS_POD;
const ALL_STARS_POD_ATLAS = SMASHUP_ATLAS_IDS.ALL_STARS_POD_CARDS;

export const ALL_STARS_POD_ACTIONS: ActionCardDef[] = [
    { id: 'all_stars_seeing_stars_pod', type: 'action', subtype: 'standard', name: '手里剑', nameEn: 'Seeing Stars', faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 0 } },
    { id: 'all_stars_begin_the_summoning_pod', type: 'action', subtype: 'standard', name: '开始召唤', nameEn: 'Begin the Summoning', faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 1 } },
    { id: 'all_stars_its_astounding_pod', type: 'action', subtype: 'standard', name: '真是惊人', nameEn: "It's Astounding", faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 2 } },
    { id: 'all_stars_full_moon_pod', type: 'action', subtype: 'ongoing', name: '满月', nameEn: 'Full Moon', faction: ALL_STARS_POD_FACTION, ongoingTarget: 'base', playNeedsBase: true, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 3 } },
    { id: 'all_stars_non_infinite_loop_pod', type: 'action', subtype: 'standard', name: '非无限循环', nameEn: 'Non-Infinite Loop', faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 4 } },
    { id: 'all_stars_friendship_power_pod', type: 'action', subtype: 'standard', name: '友谊之力', nameEn: 'Friendship Power', faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 5 } },
    { id: 'all_stars_ghostly_arrival_pod', type: 'action', subtype: 'standard', name: '幽灵抵达', nameEn: 'Ghostly Arrival', faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 6 } },
    { id: 'all_stars_square_deal_pod', type: 'action', subtype: 'standard', name: '公平交易', nameEn: 'Square Deal', faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 7 } },
    { id: 'all_stars_favor_of_dionysus_pod', type: 'action', subtype: 'standard', name: '狄俄尼索斯的恩惠', nameEn: 'Favor of Dionysus', faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 8 } },
    { id: 'all_stars_prepare_for_battle_pod', type: 'action', subtype: 'standard', name: '准备战斗', nameEn: 'Prepare for Battle', faction: ALL_STARS_POD_FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 9 } },
];

export const ALL_STARS_POD_MINIONS: MinionCardDef[] = [
    { id: 'all_stars_servitor_of_cthulhu_pod', type: 'minion', name: '克苏鲁仆从', nameEn: 'Servitor of Cthulhu', faction: ALL_STARS_POD_FACTION, power: 2, abilityTags: ['talent'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 10 } },
    { id: 'all_stars_fan_pod', type: 'minion', name: '粉丝', nameEn: 'Fan', faction: ALL_STARS_POD_FACTION, power: 2, abilityTags: ['special'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 11 } },
    { id: 'all_stars_sprout_pod', type: 'minion', name: '萌芽', nameEn: 'Sprout', faction: ALL_STARS_POD_FACTION, power: 2, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 12 } },
    { id: 'all_stars_ensign_pod', type: 'minion', name: '少尉', nameEn: 'Ensign', faction: ALL_STARS_POD_FACTION, power: 2, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 13 } },
    { id: 'all_stars_puck_pod', type: 'minion', name: '帕克', nameEn: 'Puck', faction: ALL_STARS_POD_FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 14 } },
    { id: 'all_stars_lab_assistant_pod', type: 'minion', name: '实验室助手', nameEn: 'Lab Assistant', faction: ALL_STARS_POD_FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 15 } },
    { id: 'all_stars_imperial_dragon_pod', type: 'minion', name: '帝王龙', nameEn: 'Imperial Dragon', faction: ALL_STARS_POD_FACTION, power: 3, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 16 } },
    { id: 'all_stars_gelf_pod', type: 'minion', name: 'G.E.L.F.', nameEn: 'G.E.L.F.', faction: ALL_STARS_POD_FACTION, power: 4, abilityTags: ['talent'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 17 } },
    { id: 'all_stars_granny_pod', type: 'minion', name: '老奶奶', nameEn: 'Granny', faction: ALL_STARS_POD_FACTION, power: 4, abilityTags: ['talent'], count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 18 } },
    { id: 'all_stars_king_rex_pod', type: 'minion', name: '雷克斯王', nameEn: 'King Rex', faction: ALL_STARS_POD_FACTION, power: 7, count: 1, previewRef: { type: 'atlas', atlasId: ALL_STARS_POD_ATLAS, index: 19 } },
];

export const ALL_STARS_POD_CARDS: CardDef[] = [
    ...ALL_STARS_POD_ACTIONS,
    ...ALL_STARS_POD_MINIONS,
];
