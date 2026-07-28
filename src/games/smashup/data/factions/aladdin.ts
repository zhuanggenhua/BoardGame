import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef, SmashUpActivatableAbility } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.ALADDIN;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_BASES;

const TALENT: SmashUpActivatableAbility[] = [{ kind: 'talent', zone: 'board', window: 'playCards' }];

export const ALADDIN_MINIONS: MinionCardDef[] = [
    { id: 'aladdin_carpet', type: 'minion', name: '魔毯', nameEn: 'Carpet', faction: FACTION, power: 1, abilityTags: ['talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 0 } },
    { id: 'aladdin_palace_guard', type: 'minion', name: '王宫守卫', nameEn: 'Palace Guard', faction: FACTION, power: 2, abilityTags: ['talent'], activatableAbilities: TALENT, count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 1 } },
    { id: 'aladdin_abu', type: 'minion', name: '阿布', nameEn: 'Abu', faction: FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 2 } },
    { id: 'aladdin_genie', type: 'minion', name: '灯神', nameEn: 'Genie', faction: FACTION, power: 3, abilityTags: ['talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 3 } },
    {
        id: 'aladdin_rajah',
        type: 'minion',
        name: '拉贾',
        nameEn: 'Rajah',
        faction: FACTION,
        power: 3,
        abilityTags: ['talent', 'special'],
        activatableAbilities: [
            ...TALENT,
            { kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'scoringBase' },
        ],
        count: 1,
        previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 4 },
    },
    { id: 'aladdin_jasmine', type: 'minion', name: '茉莉公主', nameEn: 'Jasmine', faction: FACTION, power: 4, abilityTags: ['talent', 'extra'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 5 } },
    { id: 'aladdin_aladdin', type: 'minion', name: '阿拉丁', nameEn: 'Aladdin', faction: FACTION, power: 5, abilityTags: ['onPlay', 'talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 6 } },
];

export const ALADDIN_ACTIONS: ActionCardDef[] = [
    { id: 'aladdin_a_friend_like_me', type: 'action', subtype: 'standard', name: '我的朋友喜欢我', nameEn: 'A Friend Like Me', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 7 } },
    { id: 'aladdin_cave_of_wonders', type: 'action', subtype: 'standard', name: '奇迹之洞', nameEn: 'Cave of Wonders', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 8 } },
    { id: 'aladdin_jafar', type: 'action', subtype: 'standard', name: '贾方', nameEn: 'Jafar', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 9 } },
    { id: 'aladdin_magic_carpet_ride', type: 'action', subtype: 'standard', name: '乘坐魔毯', nameEn: 'Magic Carpet Ride', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 10 } },
    { id: 'aladdin_street_rat', type: 'action', subtype: 'standard', name: '街头混混', nameEn: 'Street Rat', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 11 } },
    { id: 'aladdin_the_lamp', type: 'action', subtype: 'standard', name: '神灯', nameEn: 'The Lamp', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 12 } },
    { id: 'aladdin_wish', type: 'action', subtype: 'standard', name: '许愿', nameEn: 'Wish', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 13 } },
];

export const ALADDIN_CARDS: CardDef[] = [
    ...ALADDIN_MINIONS,
    ...ALADDIN_ACTIONS,
];

export const ALADDIN_BASES: BaseCardDef[] = [
    { id: 'base_agrabah_bazaar', name: '阿格拉巴集市', nameEn: 'Agrabah Bazaar', breakpoint: 22, vpAwards: [4, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 5 } },
    { id: 'base_sultans_palace', name: '苏丹皇宫', nameEn: 'Sultan’s Palace', breakpoint: 18, vpAwards: [3, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 } },
];
