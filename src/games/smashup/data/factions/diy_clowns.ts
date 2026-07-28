import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.DIY_CLOWNS;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DIY_CLOWNS_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DIY_CLOWNS_BASES;

export const DIY_CLOWNS_MINIONS: MinionCardDef[] = [
    { id: 'diy_clowns_slapstick_clown', type: 'minion', name: '滑稽小丑', nameEn: 'Slapstick Clown', faction: FACTION, power: 5, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 0 } },
    { id: 'diy_clowns_mrs_clown', type: 'minion', name: '小丑夫人', nameEn: 'Mrs. Clown', faction: FACTION, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 1 } },
    { id: 'diy_clowns_dancing_clown', type: 'minion', name: '跳舞小丑', nameEn: 'Dancing Clown', faction: FACTION, power: 4, abilityTags: ['talent'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 2 } },
    { id: 'diy_clowns_mcdonald_clown', type: 'minion', name: '麦当劳小丑', nameEn: "McDonald's Clown", faction: FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 3 } },
    { id: 'diy_clowns_silent_clown', type: 'minion', name: '沉默小丑', nameEn: 'Silent Clown', faction: FACTION, power: 3, abilityTags: ['ongoing'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 4 } },
    { id: 'diy_clowns_clown_girl', type: 'minion', name: '小丑女', nameEn: 'Clown Girl', faction: FACTION, power: 2, abilityTags: ['onPlay'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 6 } },
];

export const DIY_CLOWNS_ACTIONS: ActionCardDef[] = [
    { id: 'diy_clowns_banana_peel', type: 'action', subtype: 'standard', name: '香蕉皮', nameEn: 'Banana Peel', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 10 } },
    { id: 'diy_clowns_clown_car', type: 'action', subtype: 'standard', name: '小丑车', nameEn: 'Clown Car', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 11 } },
    { id: 'diy_clowns_jack_in_the_box', type: 'action', subtype: 'standard', name: '惊吓盒', nameEn: 'Jack-in-the-Box', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 12 } },
    { id: 'diy_clowns_clown_pyramid', type: 'action', subtype: 'standard', name: '小丑金字塔', nameEn: 'Clown Pyramid', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 13 } },
    { id: 'diy_clowns_colorful_scarf', type: 'action', subtype: 'standard', name: '彩色围巾', nameEn: 'Colorful Scarf', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 14 } },
    { id: 'diy_clowns_confetti_bucket', type: 'action', subtype: 'standard', name: '五彩纸屑桶', nameEn: 'Confetti Bucket', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 16 } },
    { id: 'diy_clowns_juggling', type: 'action', subtype: 'standard', name: '杂耍', nameEn: 'Juggling', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 17 } },
    { id: 'diy_clowns_pie_in_the_face', type: 'action', subtype: 'standard', name: '馅饼砸脸', nameEn: 'Pie in the Face', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 18 } },
];

export const DIY_CLOWNS_BASES: BaseCardDef[] = [
    { id: 'base_diy_clowns_clown_academy', name: '小丑学院', nameEn: 'Clown Academy', breakpoint: 18, vpAwards: [3, 2, 2], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 0 } },
    { id: 'base_diy_clowns_circus_tent', name: '马戏篷', nameEn: 'Circus Tent', breakpoint: 21, vpAwards: [4, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 } },
];

export const DIY_CLOWNS_CARDS: CardDef[] = [
    ...DIY_CLOWNS_MINIONS,
    ...DIY_CLOWNS_ACTIONS,
];
