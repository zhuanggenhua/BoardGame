import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef, SmashUpActivatableAbility } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.BEAUTY_AND_THE_BEAST;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_BASES;

const TALENT: SmashUpActivatableAbility[] = [{ kind: 'talent', zone: 'board', window: 'playCards' }];
const BASE_TALENT: SmashUpActivatableAbility[] = [{ kind: 'talent', zone: 'board', window: 'playCards' }];

export const BEAUTY_AND_THE_BEAST_MINIONS: MinionCardDef[] = [
    { id: 'beauty_and_the_beast_enchanted_objects', type: 'minion', name: '魔法物品', nameEn: 'Enchanted Objects', faction: FACTION, power: 2, abilityTags: ['special', 'extra'], count: 6, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 14 } },
    { id: 'beauty_and_the_beast_cogsworth', type: 'minion', name: '葛士华', nameEn: 'Cogsworth', faction: FACTION, power: 3, abilityTags: ['talent', 'extra'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 15 } },
    { id: 'beauty_and_the_beast_lumiere', type: 'minion', name: '卢米亚', nameEn: 'Lumiere', faction: FACTION, power: 3, abilityTags: ['talent', 'extra'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 16 } },
    { id: 'beauty_and_the_beast_mrs_potts_and_chip', type: 'minion', name: '茶煲太太和阿奇', nameEn: 'Mrs. Potts and Chip', faction: FACTION, power: 3, abilityTags: ['talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 17 } },
    { id: 'beauty_and_the_beast_beast', type: 'minion', name: '野兽', nameEn: 'Beast', faction: FACTION, power: 4, abilityTags: ['onPlay', 'talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 18 } },
    { id: 'beauty_and_the_beast_belle', type: 'minion', name: '贝儿', nameEn: 'Belle', faction: FACTION, power: 5, abilityTags: ['onPlay', 'talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 19 } },
];

export const BEAUTY_AND_THE_BEAST_ACTIONS: ActionCardDef[] = [
    { id: 'beauty_and_the_beast_be_our_guest', type: 'action', subtype: 'ongoing', name: '我们的贵客', nameEn: 'Be Our Guest', faction: FACTION, abilityTags: ['talent'], activatableAbilities: BASE_TALENT, ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 20 } },
    { id: 'beauty_and_the_beast_break_the_curse', type: 'action', subtype: 'standard', name: '打破诅咒', nameEn: 'Break the Curse', faction: FACTION, abilityTags: ['onPlay', 'special'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 21 } },
    { id: 'beauty_and_the_beast_discover_the_library', type: 'action', subtype: 'standard', name: '发现图书馆', nameEn: 'Discover the Library', faction: FACTION, abilityTags: ['onPlay', 'special'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 22 } },
    { id: 'beauty_and_the_beast_ever_a_surprise', type: 'action', subtype: 'standard', name: '不断的惊喜', nameEn: 'Ever a Surprise', faction: FACTION, abilityTags: ['onPlay', 'special'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 23 } },
    { id: 'beauty_and_the_beast_gaston', type: 'action', subtype: 'ongoing', name: '加斯顿', nameEn: 'Gaston', faction: FACTION, abilityTags: ['ongoing', 'talent'], activatableAbilities: BASE_TALENT, ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 24 } },
    { id: 'beauty_and_the_beast_petals_of_the_rose', type: 'action', subtype: 'ongoing', name: '玫瑰花瓣', nameEn: 'Petals of the Rose', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 25 } },
    { id: 'beauty_and_the_beast_this_provincial_town', type: 'action', subtype: 'standard', name: '遥远的小镇', nameEn: 'This Provincial Town', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 26 } },
];

export const BEAUTY_AND_THE_BEAST_CARDS: CardDef[] = [
    ...BEAUTY_AND_THE_BEAST_MINIONS,
    ...BEAUTY_AND_THE_BEAST_ACTIONS,
];

export const BEAUTY_AND_THE_BEAST_BASES: BaseCardDef[] = [
    { id: 'base_enchanted_castle', name: '魔法城堡', nameEn: 'Enchanted Castle', breakpoint: 23, vpAwards: [4, 3, 2], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 3 } },
    { id: 'base_gastons_tavern', name: '加斯顿酒馆', nameEn: 'Gaston’s Tavern', breakpoint: 26, vpAwards: [5, 3, 2], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 7 } },
];
