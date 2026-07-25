import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.FROZEN;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_BASES;

export const FROZEN_MINIONS: MinionCardDef[] = [
    { id: 'frozen_snowgie', type: 'minion', name: '迷你雪人', nameEn: 'Snowgie', faction: FACTION, power: 2, abilityTags: ['onPlay'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 15 } },
    { id: 'frozen_marshmallow', type: 'minion', name: '棉花糖', nameEn: 'Marshmallow', faction: FACTION, power: 3, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 16 } },
    { id: 'frozen_olaf', type: 'minion', name: '雪宝', nameEn: 'Olaf', faction: FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 17 } },
    { id: 'frozen_sven', type: 'minion', name: '斯文', nameEn: 'Sven', faction: FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 18 } },
    { id: 'frozen_anna', type: 'minion', name: '安娜', nameEn: 'Anna', faction: FACTION, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 19 } },
    { id: 'frozen_kristoff', type: 'minion', name: '克里斯托弗', nameEn: 'Kristoff', faction: FACTION, power: 4, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 20 } },
    { id: 'frozen_elsa', type: 'minion', name: '艾莎', nameEn: 'Elsa', faction: FACTION, power: 5, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 21 } },
];

export const FROZEN_ACTIONS: ActionCardDef[] = [
    { id: 'frozen_act_of_true_love', type: 'action', subtype: 'standard', name: '真爱的行为', nameEn: 'Act of True Love', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 22 } },
    { id: 'frozen_big_summer_blowout', type: 'action', subtype: 'standard', name: '夏天大盛宴', nameEn: 'Big Summer Blowout', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 23 } },
    { id: 'frozen_do_you_want_to_build_a_snowman', type: 'action', subtype: 'standard', name: '你想和我堆个雪人吗?', nameEn: 'Do You Want to Build a Snowman?', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 24 } },
    { id: 'frozen_frozen_port', type: 'action', subtype: 'ongoing', name: '冻结的港口', nameEn: 'Frozen Port', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 25 } },
    { id: 'frozen_hans_westergaard', type: 'action', subtype: 'standard', name: '汉斯·韦斯特加德', nameEn: 'Hans Westergaard', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 26 } },
    { id: 'frozen_let_it_go', type: 'action', subtype: 'standard', name: '放手吧', nameEn: 'Let It Go', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 27 } },
    { id: 'frozen_lock_the_gates', type: 'action', subtype: 'ongoing', name: '锁上大门', nameEn: 'Lock the Gates', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 28 } },
    { id: 'frozen_reindeers_are_better_than_people', type: 'action', subtype: 'standard', name: '驯鹿的心地比人好', nameEn: 'Reindeers Are Better Than People', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 29 } },
];

export const FROZEN_BASES: BaseCardDef[] = [
    { id: 'base_ice_palace', name: '冰宫', nameEn: 'Ice Palace', breakpoint: 22, vpAwards: [4, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 8 } },
    { id: 'base_arendelle', name: '阿伦黛尔', nameEn: 'Arendelle', breakpoint: 20, vpAwards: [3, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 9 } },
];

export const FROZEN_CARDS: CardDef[] = [
    ...FROZEN_MINIONS,
    ...FROZEN_ACTIONS,
];
