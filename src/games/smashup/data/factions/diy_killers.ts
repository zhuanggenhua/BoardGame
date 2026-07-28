import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.DIY_KILLERS;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DIY_KILLERS_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DIY_KILLERS_BASES;

export const DIY_KILLERS_MINIONS: MinionCardDef[] = [
    { id: 'diy_killers_leatherface', type: 'minion', name: '人皮脸', nameEn: 'Leatherface', faction: FACTION, power: 5, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 0 } },
    { id: 'diy_killers_freddy_krueger', type: 'minion', name: '弗莱迪·克鲁格', nameEn: 'Freddy Krueger', faction: FACTION, power: 5, abilityTags: ['onPlay', 'talent'], activatableAbilities: [{ kind: 'talent', zone: 'board' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 1 } },
    { id: 'diy_killers_jason', type: 'minion', name: '杰森', nameEn: 'Jason', faction: FACTION, power: 5, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 2 } },
    { id: 'diy_killers_michael_myers', type: 'minion', name: '麦克尔·麦尔斯', nameEn: 'Michael Myers', faction: FACTION, power: 5, abilityTags: ['onPlay', 'special'], activatableAbilities: [{ kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'scoringBase' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 3 } },
    { id: 'diy_killers_pinhead', type: 'minion', name: '钉子头', nameEn: 'Pinhead', faction: FACTION, power: 5, abilityTags: ['onPlay', 'talent'], activatableAbilities: [{ kind: 'talent', zone: 'board' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 4 } },
];

export const DIY_KILLERS_ACTIONS: ActionCardDef[] = [
    { id: 'diy_killers_captain_kirk_mask', type: 'action', subtype: 'ongoing', name: '柯克船长面具', nameEn: 'Captain Kirk Mask', faction: FACTION, count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 5 } },
    { id: 'diy_killers_savage_attack', type: 'action', subtype: 'standard', name: '野蛮攻击', nameEn: 'Savage Attack', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 6 } },
    { id: 'diy_killers_cha_cha_cha_ha_ha_ha', type: 'action', subtype: 'standard', name: '恰-恰-恰 哈-哈-哈', nameEn: 'Ch-Ch-Ch Ha-Ha-Ha', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 7 } },
    { id: 'diy_killers_chainsaw', type: 'action', subtype: 'ongoing', name: '电锯', nameEn: 'Chainsaw', faction: FACTION, abilityTags: ['ongoing'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 8 } },
    { id: 'diy_killers_clawed_glove', type: 'action', subtype: 'ongoing', name: '爪子手套', nameEn: 'Clawed Glove', faction: FACTION, abilityTags: ['ongoing', 'talent'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', activatableAbilities: [{ kind: 'talent', zone: 'board' }], previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 9 } },
    { id: 'diy_killers_good_boy', type: 'action', subtype: 'standard', name: '他是个好孩子!', nameEn: "He's a Good Boy!", faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 10 } },
    { id: 'diy_killers_laundry_room', type: 'action', subtype: 'ongoing', name: '躲藏在洗衣间', nameEn: 'Hiding in the Laundry Room', faction: FACTION, abilityTags: ['onPlay', 'ongoing'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'opponent', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 11 } },
    { id: 'diy_killers_improvised_weapon', type: 'action', subtype: 'standard', name: '简易武器', nameEn: 'Improvised Weapon', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 12 } },
    { id: 'diy_killers_machete', type: 'action', subtype: 'ongoing', name: '大砍刀', nameEn: 'Machete', faction: FACTION, abilityTags: ['ongoing', 'talent'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', activatableAbilities: [{ kind: 'talent', zone: 'board' }], previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 13 } },
    { id: 'diy_killers_oh_no', type: 'action', subtype: 'standard', name: '哦 不！！！', nameEn: 'Oh No!!!', faction: FACTION, abilityTags: ['onPlay', 'special'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 14 } },
    { id: 'diy_killers_origin_story', type: 'action', subtype: 'standard', name: '起源故事', nameEn: 'Origin Story', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 15 } },
    { id: 'diy_killers_hell_puzzle_box', type: 'action', subtype: 'ongoing', name: '地狱魔盒', nameEn: 'Hell Puzzle Box', faction: FACTION, abilityTags: ['ongoing'], count: 1, ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 17 } },
    { id: 'diy_killers_is_it_over', type: 'action', subtype: 'standard', name: '结束了?', nameEn: 'Is It Over?', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 18 } },
];

export const DIY_KILLERS_BASES: BaseCardDef[] = [
    { id: 'base_diy_killers_camp_crystal_lake', name: '水晶湖营地', nameEn: 'Camp Crystal Lake', breakpoint: 20, vpAwards: [4, 3, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 0 } },
    { id: 'base_diy_killers_nightmare_world', name: '梦魇世界', nameEn: 'Nightmare World', breakpoint: 22, vpAwards: [5, 3, 2], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 } },
];

export const DIY_KILLERS_CARDS: CardDef[] = [
    ...DIY_KILLERS_MINIONS,
    ...DIY_KILLERS_ACTIONS,
];
