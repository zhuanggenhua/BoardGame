import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const CARD_ATLAS = SMASHUP_ATLAS_IDS.WHAT_WERE_WE_THINKING_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.WHAT_WERE_WE_THINKING_BASES;

const ROCK_STARS = SMASHUP_FACTION_IDS.ROCK_STARS;
const TEDDY_BEARS = SMASHUP_FACTION_IDS.TEDDY_BEARS;
const GRANNIES = SMASHUP_FACTION_IDS.GRANNIES;
const EXPLORERS = SMASHUP_FACTION_IDS.EXPLORERS;

export const ROCK_STARS_ACTIONS: ActionCardDef[] = [
    { id: 'rock_stars_turn_up_to_11', type: 'action', subtype: 'ongoing', name: '音量开到 11', nameEn: 'Turn Up to 11', faction: ROCK_STARS, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 0 } },
    { id: 'rock_stars_reunion_tour', type: 'action', subtype: 'standard', name: '重聚巡演', nameEn: 'Reunion Tour', faction: ROCK_STARS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 1 } },
    { id: 'rock_stars_total_sellout', type: 'action', subtype: 'special', name: '彻底售罄', nameEn: 'Total Sellout', faction: ROCK_STARS, abilityTags: ['special'], specialTiming: 'afterScoring', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 2 } },
    { id: 'rock_stars_rock_of_luuv', type: 'action', subtype: 'standard', name: '爱之摇滚', nameEn: 'Rock of Luuv', faction: ROCK_STARS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 3 } },
    { id: 'rock_stars_guest_star', type: 'action', subtype: 'standard', name: '嘉宾明星', nameEn: 'Guest Star', faction: ROCK_STARS, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 4 } },
    { id: 'rock_stars_tour_bus', type: 'action', subtype: 'standard', name: '巡演巴士', nameEn: 'Tour Bus', faction: ROCK_STARS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 5 } },
    { id: 'rock_stars_hot_venue', type: 'action', subtype: 'ongoing', name: '火热场地', nameEn: 'Hot Venue', faction: ROCK_STARS, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 6 } },
    { id: 'rock_stars_power_ballad', type: 'action', subtype: 'standard', name: '力量情歌', nameEn: 'Power Ballad', faction: ROCK_STARS, abilityTags: ['onPlay', 'special'], responseWindowTiming: 'beforeScoring', responseWindowNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 7 } },
];

export const ROCK_STARS_MINIONS: MinionCardDef[] = [
    { id: 'rock_stars_the_monarch', type: 'minion', name: '帝王', nameEn: 'The Monarch', faction: ROCK_STARS, power: 5, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 8 } },
    { id: 'rock_stars_classic_rocker', type: 'minion', name: '经典摇滚客', nameEn: 'Classic Rocker', faction: ROCK_STARS, power: 4, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 9 } },
    { id: 'rock_stars_rick_roll', type: 'minion', name: '瑞克摇滚', nameEn: 'Rick Roll', faction: ROCK_STARS, power: 3, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 10 } },
    { id: 'rock_stars_groupie', type: 'minion', name: '追星族', nameEn: 'Groupie', faction: ROCK_STARS, power: 2, abilityTags: ['onPlay', 'extra'], count: 5, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 11 } },
];

export const TEDDY_BEARS_ACTIONS: ActionCardDef[] = [
    { id: 'teddy_bears_square_deal', type: 'action', subtype: 'standard', name: '公平交易', nameEn: 'Square Deal', faction: TEDDY_BEARS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 12 } },
    { id: 'teddy_bears_love_overload', type: 'action', subtype: 'special', name: '爱意过载', nameEn: 'Love Overload', faction: TEDDY_BEARS, abilityTags: ['special'], specialTiming: 'beforeScoring', specialNeedsBase: true, responseWindowTiming: 'beforeScoring', responseWindowNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 13 } },
    { id: 'teddy_bears_group_hug', type: 'action', subtype: 'standard', name: '集体拥抱', nameEn: 'Group Hug', faction: TEDDY_BEARS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 14 } },
    { id: 'teddy_bears_care_package', type: 'action', subtype: 'standard', name: '爱心包裹', nameEn: 'Care Package', faction: TEDDY_BEARS, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 15 } },
    { id: 'teddy_bears_too_cute', type: 'action', subtype: 'ongoing', name: '太可爱', nameEn: 'Too Cute', faction: TEDDY_BEARS, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 16 } },
    { id: 'teddy_bears_bear_picnic', type: 'action', subtype: 'ongoing', name: '泰迪熊野餐', nameEn: 'Bear Picnic', faction: TEDDY_BEARS, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 17 } },
    { id: 'teddy_bears_cuddle', type: 'action', subtype: 'ongoing', name: '抱抱', nameEn: 'Cuddle', faction: TEDDY_BEARS, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 18 } },
    { id: 'teddy_bears_tea_party', type: 'action', subtype: 'ongoing', name: '茶会', nameEn: 'Tea Party', faction: TEDDY_BEARS, abilityTags: ['talent'], ongoingTarget: 'base', playNeedsBase: true, activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 19 } },
];

export const TEDDY_BEARS_MINIONS: MinionCardDef[] = [
    { id: 'teddy_bears_sir_squeezes', type: 'minion', name: '挤挤爵士', nameEn: 'Sir Squeezes', faction: TEDDY_BEARS, power: 5, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 20 } },
    { id: 'teddy_bears_lovey_bear', type: 'minion', name: '爱心熊', nameEn: 'Lovey Bear', faction: TEDDY_BEARS, power: 3, abilityTags: ['ongoing'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 21 } },
    { id: 'teddy_bears_fun_bear', type: 'minion', name: '欢乐熊', nameEn: 'Fun Bear', faction: TEDDY_BEARS, power: 2, abilityTags: ['ongoing'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 22 } },
    { id: 'teddy_bears_snuggly_bear', type: 'minion', name: '依偎熊', nameEn: 'Snuggly Bear', faction: TEDDY_BEARS, power: 1, abilityTags: ['special', 'extra'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 23 } },
];

export const GRANNIES_ACTIONS: ActionCardDef[] = [
    { id: 'grannies_chicken_soup', type: 'action', subtype: 'standard', name: '鸡汤', nameEn: 'Chicken Soup', faction: GRANNIES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 24 } },
    { id: 'grannies_grannys_purse', type: 'action', subtype: 'standard', name: '外婆的钱包', nameEn: "Granny's Purse", faction: GRANNIES, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 25 } },
    { id: 'grannies_always_room_at_grannys', type: 'action', subtype: 'special', name: '外婆家总有地方', nameEn: "Always Room at Granny's", faction: GRANNIES, abilityTags: ['special'], specialTiming: 'afterScoring', responseWindowTiming: 'afterScoring', responseWindowNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 26 } },
    { id: 'grannies_attic_treasures', type: 'action', subtype: 'standard', name: '阁楼宝藏', nameEn: 'Attic Treasures', faction: GRANNIES, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 28 } },
    { id: 'grannies_hush_my_stories_are_on', type: 'action', subtype: 'standard', name: '嘘，我的剧开播了', nameEn: 'Hush, My Stories are On', faction: GRANNIES, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 29 } },
    { id: 'grannies_family_reunion', type: 'action', subtype: 'ongoing', name: '家庭聚会', nameEn: 'Family Reunion', faction: GRANNIES, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 30 } },
    { id: 'grannies_dont_mess_with_my_babies', type: 'action', subtype: 'ongoing', name: '别惹我的宝贝！', nameEn: "Don't Mess With My Babies!", faction: GRANNIES, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 31 } },
    { id: 'grannies_knitting_circle', type: 'action', subtype: 'standard', name: '编织小组', nameEn: 'Knitting Circle', faction: GRANNIES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 32 } },
];

export const GRANNIES_MINIONS: MinionCardDef[] = [
    { id: 'grannies_matriarch', type: 'minion', name: '女族长', nameEn: 'Matriarch', faction: GRANNIES, power: 5, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 27 } },
    { id: 'grannies_granny', type: 'minion', name: '外婆', nameEn: 'Granny', faction: GRANNIES, power: 4, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 33 } },
    { id: 'grannies_nana', type: 'minion', name: '奶奶', nameEn: 'Nana', faction: GRANNIES, power: 3, abilityTags: ['onPlay', 'extra'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 34 } },
    { id: 'grannies_grandma', type: 'minion', name: '祖母', nameEn: 'Grandma', faction: GRANNIES, power: 2, abilityTags: ['onPlay'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 35 } },
];

export const EXPLORERS_MINIONS: MinionCardDef[] = [
    { id: 'explorers_idaho_smith', type: 'minion', name: '爱达荷·史密斯', nameEn: 'Idaho Smith', faction: EXPLORERS, power: 5, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 36 } },
    { id: 'explorers_guide', type: 'minion', name: '向导', nameEn: 'Guide', faction: EXPLORERS, power: 4, abilityTags: ['ongoing'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 40 } },
    { id: 'explorers_crypt_looter', type: 'minion', name: '古墓掠夺者', nameEn: 'Crypt Looter', faction: EXPLORERS, power: 3, abilityTags: ['special', 'extra'], count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 42 } },
    { id: 'explorers_glory_hound', type: 'minion', name: '逐名猎犬', nameEn: 'Glory Hound', faction: EXPLORERS, power: 2, abilityTags: ['onPlay'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 43 } },
];

export const EXPLORERS_ACTIONS: ActionCardDef[] = [
    { id: 'explorers_lost_city', type: 'action', subtype: 'special', name: '失落之城', nameEn: 'Lost City', faction: EXPLORERS, abilityTags: ['special', 'extra'], specialTiming: 'afterScoring', responseWindowTiming: 'afterScoring', responseWindowNeedsBase: true, count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 37 } },
    { id: 'explorers_you_call_this_archaeology', type: 'action', subtype: 'standard', name: '你管这叫考古？', nameEn: 'You Call This Archaeology?', faction: EXPLORERS, abilityTags: ['onPlay', 'special'], responseWindowTiming: 'beforeScoring', responseWindowNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 38 } },
    { id: 'explorers_fortune_and_glory', type: 'action', subtype: 'standard', name: '财富与荣耀', nameEn: 'Fortune and Glory', faction: EXPLORERS, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 39 } },
    { id: 'explorers_forgotten_horrors', type: 'action', subtype: 'ongoing', name: '被遗忘的恐怖', nameEn: 'Forgotten Horrors', faction: EXPLORERS, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 41 } },
    { id: 'explorers_it_belongs_in_a_museum', type: 'action', subtype: 'standard', name: '它该进博物馆', nameEn: 'It Belongs in a Museum', faction: EXPLORERS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 44 } },
    { id: 'explorers_x_never_marks_the_spot', type: 'action', subtype: 'standard', name: 'X 从不标记地点', nameEn: 'X Never Marks the Spot', faction: EXPLORERS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 45 } },
    { id: 'explorers_i_said_no_camels', type: 'action', subtype: 'standard', name: '我说了不要骆驼！', nameEn: 'I Said No Camels!', faction: EXPLORERS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 46 } },
    { id: 'explorers_dr_livingstone_i_presume', type: 'action', subtype: 'standard', name: '利文斯通医生，想必是你？', nameEn: 'Dr Livingstone, I Presume?', faction: EXPLORERS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 47 } },
];

export const ROCK_STARS_CARDS: CardDef[] = [...ROCK_STARS_ACTIONS, ...ROCK_STARS_MINIONS];
export const TEDDY_BEARS_CARDS: CardDef[] = [...TEDDY_BEARS_ACTIONS, ...TEDDY_BEARS_MINIONS];
export const GRANNIES_CARDS: CardDef[] = [...GRANNIES_ACTIONS, ...GRANNIES_MINIONS];
export const EXPLORERS_CARDS: CardDef[] = [...EXPLORERS_ACTIONS, ...EXPLORERS_MINIONS];

export const WHAT_WERE_WE_THINKING_CARDS: CardDef[] = [
    ...ROCK_STARS_CARDS,
    ...TEDDY_BEARS_CARDS,
    ...GRANNIES_CARDS,
    ...EXPLORERS_CARDS,
];

export const WHAT_WERE_WE_THINKING_BASES: BaseCardDef[] = [
    { id: 'base_under_the_bed', name: '床底下', nameEn: 'Under the Bed', breakpoint: 22, vpAwards: [4, 2, 1], faction: TEDDY_BEARS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 0 } },
    { id: 'base_out_in_the_woods', name: '在森林里', nameEn: 'Out in the Woods', breakpoint: 18, vpAwards: [3, 2, 1], faction: TEDDY_BEARS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 } },
    { id: 'base_lake_minnetonka', name: '明尼通卡湖', nameEn: 'Lake Minnetonka', breakpoint: 26, vpAwards: [5, 3, 2], faction: ROCK_STARS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 2 } },
    { id: 'base_palooza', name: '演唱会', nameEn: 'Palooza', breakpoint: 27, vpAwards: [6, 4, 3], faction: ROCK_STARS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 3 } },
    { id: 'base_grandmas_house', name: '奶奶家', nameEn: "Grandma's House", breakpoint: 25, vpAwards: [5, 3, 2], faction: GRANNIES, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 4 } },
    { id: 'base_retirement_community', name: '退休社区', nameEn: 'Retirement Community', breakpoint: 20, vpAwards: [4, 2, 1], faction: GRANNIES, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 5 } },
    { id: 'base_ancient_temple', name: '古代神庙', nameEn: 'Ancient Temple', breakpoint: 20, vpAwards: [4, 2, 1], faction: EXPLORERS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 6 } },
    { id: 'base_city_of_gold', name: '黄金城', nameEn: 'City of Gold', breakpoint: 16, vpAwards: [3, 1, 1], faction: EXPLORERS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 7 } },
];
