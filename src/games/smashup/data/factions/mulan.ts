import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.MULAN;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_BASES;

export const MULAN_MINIONS: MinionCardDef[] = [
    { id: 'mulan_cri_kee', type: 'minion', name: '克里基', nameEn: 'Cri-Kee', faction: FACTION, power: 2, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 45 } },
    { id: 'mulan_mushu', type: 'minion', name: '木须', nameEn: 'Mushu', faction: FACTION, power: 2, abilityTags: ['onPlay'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 46 } },
    { id: 'mulan_chien_po', type: 'minion', name: '金宝', nameEn: 'Chien Po', faction: FACTION, power: 3, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 47 } },
    { id: 'mulan_ling', type: 'minion', name: '宁', nameEn: 'Ling', faction: FACTION, power: 3, abilityTags: ['onPlay', 'ongoing', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 48 } },
    { id: 'mulan_yao', type: 'minion', name: '尧', nameEn: 'Yao', faction: FACTION, power: 3, abilityTags: ['onPlay', 'ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 49 } },
    { id: 'mulan_li_shang', type: 'minion', name: '李翔', nameEn: 'Li Shang', faction: FACTION, power: 4, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 50 } },
    { id: 'mulan_mulan', type: 'minion', name: '木兰', nameEn: 'Mulan', faction: FACTION, power: 5, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 51 } },
];

export const MULAN_ACTIONS: ActionCardDef[] = [
    { id: 'mulan_avalanche', type: 'action', subtype: 'standard', name: '雪崩', nameEn: 'Avalanche', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 52 } },
    { id: 'mulan_be_a_man', type: 'action', subtype: 'ongoing', name: '成为一个男人', nameEn: 'Be a Man', faction: FACTION, abilityTags: ['onPlay', 'ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 53 } },
    { id: 'mulan_call_up_new_recruits', type: 'action', subtype: 'standard', name: '招收新兵', nameEn: 'Call Up New Recruits', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 54 } },
    { id: 'mulan_dragon_cannon', type: 'action', subtype: 'standard', name: '飞龙巨炮', nameEn: 'Dragon Cannon', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 55 } },
    { id: 'mulan_family_sword', type: 'action', subtype: 'ongoing', name: '家族之剑', nameEn: 'Family Sword', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 56 } },
    { id: 'mulan_group_training', type: 'action', subtype: 'standard', name: '集体训练', nameEn: 'Group Training', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 57 } },
    { id: 'mulan_prepare_to_fight', type: 'action', subtype: 'standard', name: '准备战斗', nameEn: 'Prepare to Fight', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 58 } },
    { id: 'mulan_shan_yu', type: 'action', subtype: 'special', name: '单于', nameEn: 'Shan Yu', faction: FACTION, abilityTags: ['special'], specialTiming: 'beforeScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 59 } },
];

export const MULAN_BASES: BaseCardDef[] = [
    { id: 'base_training_camp', name: '训练营', nameEn: 'Training Camp', breakpoint: 25, vpAwards: [5, 3, 2], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 4 } },
    { id: 'base_forbidden_city', name: '紫禁城', nameEn: 'Forbidden City', breakpoint: 19, vpAwards: [3, 3, 2], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 5 } },
];

export const MULAN_CARDS: CardDef[] = [
    ...MULAN_MINIONS,
    ...MULAN_ACTIONS,
];
