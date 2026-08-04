import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

type MinionSeed = readonly [id: string, name: string, nameEn: string, power: number, count: number, index: number];
type ActionSeed = readonly [id: string, name: string, nameEn: string, count: number, index: number];
type MunchkinSpecialDeckKind = 'treasure' | 'monster';
type MunchkinSpecialSeed = readonly [id: string, name: string, nameEn: string, count: number, index: number, power?: number, treasureReward?: number];
type ActionExtras = Pick<ActionCardDef,
    | 'abilityTags'
    | 'playNeedsBase'
    | 'playNeedsMinion'
    | 'playTargetMinionController'
    | 'subtype'
    | 'ongoingTarget'
    | 'specialTiming'
    | 'specialNeedsBase'
    | 'responseWindowTiming'
    | 'responseWindowNeedsBase'
>;

export interface MunchkinSpecialCardDescriptor {
    id: string;
    name: string;
    nameEn: string;
    kind: MunchkinSpecialDeckKind;
    count: number;
    /** 怪物力量：不计入任何玩家总力，只用于抬高基地破坏门槛 */
    power?: number;
    /** 击败该怪物时奖励的宝藏数量 */
    treasureReward?: number;
    previewRef: {
        type: 'atlas';
        atlasId: string;
        index: number;
    };
}

function minion(
    faction: string,
    atlasId: string,
    seed: MinionSeed,
    abilityTags?: MinionCardDef['abilityTags'],
): MinionCardDef {
    const [id, name, nameEn, power, count, index] = seed;
    return {
        id,
        type: 'minion',
        name,
        nameEn,
        faction,
        power,
        count,
        previewRef: { type: 'atlas', atlasId, index },
        ...(abilityTags ? { abilityTags } : {}),
    };
}

function action(
    faction: string,
    atlasId: string,
    seed: ActionSeed,
    abilityTagsOrExtras?: ActionCardDef['abilityTags'] | Partial<ActionExtras>,
): ActionCardDef {
    const [id, name, nameEn, count, index] = seed;
    const extras = Array.isArray(abilityTagsOrExtras)
        ? { abilityTags: abilityTagsOrExtras }
        : abilityTagsOrExtras;
    return {
        id,
        type: 'action',
        subtype: 'standard',
        name,
        nameEn,
        faction,
        count,
        previewRef: { type: 'atlas', atlasId, index },
        ...(extras ?? {}),
    };
}

function treasureMinion(
    card: MunchkinSpecialCardDescriptor,
    power: number,
    abilityTags?: MinionCardDef['abilityTags'],
): MinionCardDef {
    return {
        id: card.id,
        type: 'minion',
        name: card.name,
        nameEn: card.nameEn,
        faction: MUNCHKIN_TREASURE_FACTION_ID,
        power,
        count: card.count,
        previewRef: card.previewRef,
        ...(abilityTags ? { abilityTags } : {}),
    };
}

function treasureAction(
    card: MunchkinSpecialCardDescriptor,
    options: Pick<ActionCardDef, 'subtype' | 'ongoingTarget' | 'playNeedsBase' | 'playNeedsMinion' | 'specialTiming' | 'specialNeedsBase' | 'responseWindowTiming' | 'responseWindowNeedsBase' | 'abilityTags'>,
): ActionCardDef {
    return {
        id: card.id,
        type: 'action',
        name: card.name,
        nameEn: card.nameEn,
        faction: MUNCHKIN_TREASURE_FACTION_ID,
        count: card.count,
        previewRef: card.previewRef,
        ...options,
    };
}

function special(kind: MunchkinSpecialDeckKind, atlasId: string, seed: MunchkinSpecialSeed): MunchkinSpecialCardDescriptor {
    const [id, name, nameEn, count, index, power, treasureReward] = seed;
    return { id, name, nameEn, kind, count, power, treasureReward, previewRef: { type: 'atlas', atlasId, index } };
}

function expandSpecialDeck(cards: readonly MunchkinSpecialCardDescriptor[]): string[] {
    return cards.flatMap(card => Array.from({ length: card.count }, () => card.id));
}

const TREASURES_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_TREASURES_CARDS;
const MONSTERS_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_MONSTERS_CARDS;

export const MUNCHKIN_TREASURE_CARDS: MunchkinSpecialCardDescriptor[] = [
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_dwarf_hireling', '矮人雇佣兵', 'Dwarf Hireling', 1, 0]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_halfling_hireling', '半身人雇佣兵', 'Halfling Hireling', 1, 1]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_tiger_steed', '虎骑士', 'Tiger Steed', 1, 2]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_bag_of_caltrops', '一袋铁蒺藜', 'Bag of Caltrops', 1, 3]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_spiky_boots', '尖刺靴', 'Spiky Boots', 1, 4]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_rocket_boots', '火箭靴', 'Rocket Boots', 1, 5]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_buckler_of_swashing', '摆动的盾牌', 'Buckler of Swashing', 1, 6]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_bloody_dismemberment_chainsaw', '血腥肢解电锯', 'Bloody Dismemberment Chainsaw', 1, 7]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_loads_of_treasure', '大量宝藏', 'Loads of Treasure', 1, 8]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_crossbow', '十字弓', 'Crossbow', 1, 9]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_dungeon_rulebook', '地牢规则书', 'Dungeon Rulebook', 1, 10]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_temporal_displacement_jetpack', '时间错乱的喷气背包', 'Temporal Displacement Jetpack', 1, 11]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_kneepads_of_allure', '诱惑护膝', 'Kneepads of Allure', 1, 12]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_magic_missile', '魔法导弹', 'Magic Missile', 1, 13]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_potion_of_cowardice', '怯懦药水', 'Potion of Cowardice', 1, 14]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_potion_of_halitosis', '口臭药水', 'Potion of Halitosis', 1, 15]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_potion_of_idiotic_bravery', '愚蠢勇气药水', 'Potion of Idiotic Bravery', 1, 16]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_potion_of_straight_line_running_away', '直线跑路药水', 'Potion of Straight Line Running Away', 1, 17]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_potion_of_paralysis', '麻痹药水', 'Potion of Paralysis', 1, 18]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_potion_of_duplication', '复制药水', 'Potion of Duplication', 1, 19]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_treasure_finder', '探宝棒', 'Treasure Finder', 1, 20]),
    special('treasure', TREASURES_CARD_ATLAS, ['munchkin_treasure_wishing_ring', '许愿指环', 'Wishing Ring', 1, 21]),
];

const MUNCHKIN_TREASURE_FACTION_ID = 'munchkin_treasures';

const TREASURE_BY_ID = new Map(MUNCHKIN_TREASURE_CARDS.map(card => [card.id, card] as const));
function treasure(id: string): MunchkinSpecialCardDescriptor {
    const card = TREASURE_BY_ID.get(id);
    if (!card) throw new Error(`unknown Munchkin treasure card: ${id}`);
    return card;
}

export const MUNCHKIN_TREASURE_CARD_DEFS: CardDef[] = [
    treasureMinion(treasure('munchkin_treasure_dwarf_hireling'), 2),
    treasureMinion(treasure('munchkin_treasure_halfling_hireling'), 2, ['onPlay']),
    treasureMinion(treasure('munchkin_treasure_tiger_steed'), 3),
    treasureAction(treasure('munchkin_treasure_bag_of_caltrops'), { subtype: 'ongoing', ongoingTarget: 'base', playNeedsBase: true }),
    treasureAction(treasure('munchkin_treasure_spiky_boots'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true }),
    treasureAction(treasure('munchkin_treasure_rocket_boots'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true, abilityTags: ['talent'] }),
    treasureAction(treasure('munchkin_treasure_buckler_of_swashing'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true }),
    treasureAction(treasure('munchkin_treasure_bloody_dismemberment_chainsaw'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true }),
    treasureAction(treasure('munchkin_treasure_loads_of_treasure'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true }),
    treasureAction(treasure('munchkin_treasure_crossbow'), { subtype: 'standard', playNeedsBase: true, abilityTags: ['onPlay'] }),
    treasureAction(treasure('munchkin_treasure_dungeon_rulebook'), { subtype: 'standard', abilityTags: ['onPlay', 'special'], responseWindowTiming: 'beforeScoring' }),
    treasureAction(treasure('munchkin_treasure_temporal_displacement_jetpack'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true }),
    treasureAction(treasure('munchkin_treasure_kneepads_of_allure'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true }),
    treasureAction(treasure('munchkin_treasure_magic_missile'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true, abilityTags: ['talent'] }),
    treasureAction(treasure('munchkin_treasure_potion_of_cowardice'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true }),
    treasureAction(treasure('munchkin_treasure_potion_of_halitosis'), { subtype: 'standard', playNeedsBase: true, abilityTags: ['onPlay', 'special'], responseWindowTiming: 'beforeScoring', responseWindowNeedsBase: true }),
    treasureAction(treasure('munchkin_treasure_potion_of_idiotic_bravery'), { subtype: 'standard', playNeedsMinion: true, abilityTags: ['onPlay'] }),
    treasureAction(treasure('munchkin_treasure_potion_of_straight_line_running_away'), { subtype: 'special', specialTiming: 'afterScoring' }),
    treasureAction(treasure('munchkin_treasure_potion_of_paralysis'), { subtype: 'special', specialTiming: 'beforeScoring', specialNeedsBase: true }),
    treasureAction(treasure('munchkin_treasure_potion_of_duplication'), { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true, abilityTags: ['talent'] }),
    treasureAction(treasure('munchkin_treasure_treasure_finder'), { subtype: 'standard', abilityTags: ['onPlay'] }),
    treasureAction(treasure('munchkin_treasure_wishing_ring'), { subtype: 'standard', abilityTags: ['onPlay'] }),
];

export const MUNCHKIN_MONSTER_CARDS: MunchkinSpecialCardDescriptor[] = [
    special('monster', MONSTERS_CARD_ATLAS, ['munchkin_monster_treasure_dragon', '宝藏龙', 'Treasure Dragon', 1, 0, 5, 3]),
    special('monster', MONSTERS_CARD_ATLAS, ['munchkin_monster_bigfoot', '大脚怪', 'Bigfoot', 2, 1, 4, 2]),
    special('monster', MONSTERS_CARD_ATLAS, ['munchkin_monster_pegasus', '天马', 'Pegasus', 3, 3, 3, 1]),
    special('monster', MONSTERS_CARD_ATLAS, ['munchkin_monster_gross_troll', '长毛巨魔', 'Gross Troll', 4, 6, 1, 0]),
    special('monster', MONSTERS_CARD_ATLAS, ['munchkin_monster_undead_horseman', '活死人骑士', 'Undead Horseman', 1, 10, 5, 2]),
    special('monster', MONSTERS_CARD_ATLAS, ['munchkin_monster_tutankhamen', '图坦卡蒙', 'Tutankhamen', 2, 11, 4, 2]),
    special('monster', MONSTERS_CARD_ATLAS, ['munchkin_monster_ghoul', '食尸鬼', 'Ghoul', 3, 13, 3, 1]),
    special('monster', MONSTERS_CARD_ATLAS, ['munchkin_monster_fowl_fiend', '鸟之冤魂', 'Fowl Fiend', 4, 16, 2, 1]),
];

export const MUNCHKIN_TREASURE_DECK_DEF_IDS = expandSpecialDeck(MUNCHKIN_TREASURE_CARDS);
export const MUNCHKIN_MONSTER_DECK_DEF_IDS = expandSpecialDeck(MUNCHKIN_MONSTER_CARDS);
export const MUNCHKIN_TREASURE_DECK_SIZE = MUNCHKIN_TREASURE_DECK_DEF_IDS.length;
export const MUNCHKIN_MONSTER_DECK_SIZE = MUNCHKIN_MONSTER_DECK_DEF_IDS.length;
export const MUNCHKIN_TREASURE_DECK_PREVIEW_DEF_ID = MUNCHKIN_TREASURE_CARDS[0].id;
export const MUNCHKIN_MONSTER_DECK_PREVIEW_DEF_ID = MUNCHKIN_MONSTER_CARDS[0].id;

const MUNCHKIN_SPECIAL_CARD_BY_ID = new Map<string, MunchkinSpecialCardDescriptor>(
    [...MUNCHKIN_TREASURE_CARDS, ...MUNCHKIN_MONSTER_CARDS].map(card => [card.id, card]),
);

export function getMunchkinSpecialCardDescriptor(defId: string): MunchkinSpecialCardDescriptor | undefined {
    return MUNCHKIN_SPECIAL_CARD_BY_ID.get(defId);
}

const DWARVES = SMASHUP_FACTION_IDS.MUNCHKIN_DWARVES;
const DWARVES_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_DWARVES_CARDS;
const DWARVES_BASE_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_DWARVES_BASES;

export const MUNCHKIN_DWARVES_MINIONS: MinionCardDef[] = [
    minion(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_dwarf_king', '矮人王', 'Dwarf King', 5, 1, 0]),
    minion(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_loot_lover', '宝藏爱好者', 'Loot Lover', 4, 2, 1], ['ongoing']),
    minion(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_gold_digger', '黄金挖掘者', 'Gold Digger', 3, 3, 3], ['talent']),
    minion(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_gem_grabber', '宝石抓取者', 'Gem Grabber', 2, 4, 6], ['ongoing']),
];

export const MUNCHKIN_DWARVES_ACTIONS: ActionCardDef[] = [
    action(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_anything_for_money', '为了钱什么都可以', 'Anything for Money', 1, 10], ['onPlay']),
    action(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_cash_out', '套现', 'Cash Out', 1, 11], ['onPlay']),
    {
        ...action(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_cunning_plan', '狡猾计划', 'Cunning Plan', 1, 12], ['special']),
        subtype: 'special',
        specialTiming: 'beforeScoring',
    },
    action(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_greed_is_good', '贪婪是好的', 'Greed is Good', 2, 13], ['onPlay']),
    action(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_hidden_assets', '隐藏资产', 'Hidden Assets', 2, 15], ['onPlay']),
    action(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_mine', '我的！', 'Mine!', 1, 17], ['onPlay']),
    action(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_no_my_precious', '不！我的宝贝！', 'No! My Precious!', 1, 18], ['onPlay']),
    {
        ...action(DWARVES, DWARVES_CARD_ATLAS, ['munchkin_dwarves_salvage', '打捞', 'Salvage', 1, 19], ['special']),
        subtype: 'special',
        specialTiming: 'beforeScoring',
    },
];

export const MUNCHKIN_DWARVES_CARDS: CardDef[] = [
    ...MUNCHKIN_DWARVES_MINIONS,
    ...MUNCHKIN_DWARVES_ACTIONS,
];

export const MUNCHKIN_DWARVES_BASES: BaseCardDef[] = [
    { id: 'base_the_mines', name: '矿洞', nameEn: 'The Mines', breakpoint: 18, vpAwards: [4, 2, 1], faction: DWARVES, monsterCount: 2, previewRef: { type: 'atlas', atlasId: DWARVES_BASE_ATLAS, index: 0 } },
    { id: 'base_treasure_bath', name: '宝藏池', nameEn: 'Treasure Bath', breakpoint: 12, vpAwards: [2, 0, 0], faction: DWARVES, monsterCount: 1, previewRef: { type: 'atlas', atlasId: DWARVES_BASE_ATLAS, index: 1 } },
];

const HALFLINGS = SMASHUP_FACTION_IDS.MUNCHKIN_HALFLINGS;
const HALFLINGS_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_HALFLINGS_CARDS;
const HALFLINGS_BASE_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_HALFLINGS_BASES;

export const MUNCHKIN_HALFLINGS_MINIONS: MinionCardDef[] = [
    minion(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_shire_marshal', '夏尔首领', 'Shire Marshal', 4, 1, 0], ['talent']),
    minion(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_pestling', '调皮鬼', 'Pestling', 3, 2, 1], ['onPlay', 'ongoing']),
    minion(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_bardling', '吟游诗人', 'Bardling', 2, 3, 3], ['onPlay', 'ongoing']),
    minion(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_quarterling', '半身人', 'Quarterling', 2, 4, 6], ['onPlay']),
];

export const MUNCHKIN_HALFLINGS_ACTIONS: ActionCardDef[] = [
    {
        ...action(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_last_call', '最后通牒', 'Last Call', 1, 10], ['special']),
        subtype: 'special',
        specialTiming: 'beforeScoring',
        specialNeedsBase: true,
    },
    {
        ...action(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_lunch_run', '午餐散步', 'Lunch Run', 2, 11], ['ongoing']),
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    },
    action(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_out_of_nowhere', '偷袭', 'Out Of Nowhere', 1, 13], ['onPlay']),
    {
        ...action(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_rude_awakening', '惊醒', 'Rude Awakening', 1, 14], ['onPlay']),
        playNeedsBase: true,
    },
    {
        ...action(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_small_but_tough', '小而坚韧', 'Small But Tough', 1, 15], ['ongoing']),
        subtype: 'ongoing',
        ongoingTarget: 'minion',
        playNeedsMinion: true,
    },
    {
        ...action(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_sneaksy', '偷偷摸摸', 'Sneaksy', 1, 16], ['ongoing']),
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    },
    action(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_spoiled_brats', '被宠坏的小家伙', 'Spoiled Brats', 1, 17], ['onPlay']),
    action(HALFLINGS, HALFLINGS_CARD_ATLAS, ['munchkin_halflings_unexpected_party', '意外的派对', 'Unexpected Party', 2, 18], ['onPlay']),
];

export const MUNCHKIN_HALFLINGS_CARDS: CardDef[] = [
    ...MUNCHKIN_HALFLINGS_MINIONS,
    ...MUNCHKIN_HALFLINGS_ACTIONS,
];

export const MUNCHKIN_HALFLINGS_BASES: BaseCardDef[] = [
    { id: 'base_birthday_party', name: '生日派对', nameEn: 'Birthday Party', breakpoint: 20, vpAwards: [4, 2, 1], faction: HALFLINGS, monsterCount: 1, previewRef: { type: 'atlas', atlasId: HALFLINGS_BASE_ATLAS, index: 0 } },
    { id: 'base_subterranean_lair', name: '地下矮屋', nameEn: 'Subterranean Lair', breakpoint: 23, vpAwards: [5, 3, 2], faction: HALFLINGS, monsterCount: 1, previewRef: { type: 'atlas', atlasId: HALFLINGS_BASE_ATLAS, index: 1 } },
];

const THIEVES = SMASHUP_FACTION_IDS.MUNCHKIN_THIEVES;
const THIEVES_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_THIEVES_CARDS;
const THIEVES_BASE_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_THIEVES_BASES;

export const MUNCHKIN_THIEVES_MINIONS: MinionCardDef[] = [
    minion(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_master_thief', '盗贼大师', 'Master Thief', 5, 1, 0], ['talent']),
    minion(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_fence', '销赃犯', 'Fence', 3, 2, 1], ['talent']),
    minion(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_cat_burglar', '猫咪窃贼', 'Cat Burglar', 3, 3, 3], ['onPlay']),
    minion(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_pickpocket', '扒手', 'Pickpocket', 2, 4, 6], ['onPlay']),
];

export const MUNCHKIN_THIEVES_ACTIONS: ActionCardDef[] = [
    action(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_backstab', '背刺', 'Backstab', 1, 10], ['onPlay']),
    action(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_clever_distraction', '转移注意力', 'Clever Distraction', 1, 11], {
        subtype: 'special',
        abilityTags: ['special'],
        specialTiming: 'afterScoring',
        specialNeedsBase: true,
        responseWindowTiming: 'afterScoring',
        responseWindowNeedsBase: true,
    }),
    action(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_mugging', '打劫', 'Mugging', 1, 12], ['onPlay']),
    action(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_potion_bandolier', '药水腰带', 'Potion Bandolier', 2, 13], {
        abilityTags: ['onPlay'],
        playNeedsMinion: true,
        playTargetMinionController: 'any',
    }),
    action(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_secret_stash', '秘密藏匿处', 'Secret Stash', 1, 15], {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing'],
    }),
    action(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_smuggling', '走私', 'Smuggling', 1, 16], ['onPlay']),
    action(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_strip_bare', '剥光', 'Strip Bare', 1, 17], ['onPlay']),
    action(THIEVES, THIEVES_CARD_ATLAS, ['munchkin_thieves_swipe', '顺手拿走', 'Swipe', 2, 18], ['onPlay']),
];

export const MUNCHKIN_THIEVES_CARDS: CardDef[] = [
    ...MUNCHKIN_THIEVES_MINIONS,
    ...MUNCHKIN_THIEVES_ACTIONS,
];

export const MUNCHKIN_THIEVES_BASES: BaseCardDef[] = [
    { id: 'base_the_coffers', name: '金库', nameEn: 'The Coffers', breakpoint: 18, vpAwards: [4, 2, 1], faction: THIEVES, monsterCount: 2, previewRef: { type: 'atlas', atlasId: THIEVES_BASE_ATLAS, index: 0 } },
    { id: 'base_thieves_guild', name: '盗贼公会', nameEn: 'Thieves\' Guild', breakpoint: 19, vpAwards: [4, 3, 2], faction: THIEVES, monsterCount: 1, previewRef: { type: 'atlas', atlasId: THIEVES_BASE_ATLAS, index: 1 } },
];

const MAGES = SMASHUP_FACTION_IDS.MUNCHKIN_MAGES;
const MAGES_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_MAGES_CARDS;
const MAGES_BASE_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_MAGES_BASES;

export const MUNCHKIN_MAGES_MINIONS: MinionCardDef[] = [
    { ...minion(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_blaster_master', '爆破大师', 'Blaster Master', 5, 1, 0], ['talent']), activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }] },
    { ...minion(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_happy_zapper', '快乐小法师', 'Happy Zapper', 3, 2, 1], ['talent', 'special']), activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }, { kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'scoringBase' }] },
    { ...minion(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_wand_whiz', '魔杖天才', 'Wand Whiz', 3, 3, 3], ['onPlay']), },
    { ...minion(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_scroll_shuffler', '勤读者', 'Scroll Shuffler', 2, 4, 6], ['onPlay']), },
];

export const MUNCHKIN_MAGES_ACTIONS: ActionCardDef[] = [
    action(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_charm', '魅力', 'Charm', 1, 10], ['onPlay']),
    action(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_embiggen', '大上一倍', 'Embiggen', 1, 11], ['onPlay']),
    action(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_mass_summoning', '大召唤', 'Mass Summoning', 1, 12], ['onPlay']),
    action(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_portal_to_beyond', '通往次元之门', 'Portal to Beyond', 1, 13], {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['talent'],
    }),
    action(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_recover_arcane_wisdom', '恢复奥术智慧', 'Recover Arcane Wisdom', 2, 14], ['onPlay']),
    action(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_some_enchanted_evening', '神奇的夜晚', 'Some Enchanted Evening', 1, 16], ['onPlay']),
    action(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_speed_reading', '快速阅读', 'Speed Reading', 1, 17], ['onPlay']),
    action(MAGES, MAGES_CARD_ATLAS, ['munchkin_mages_zzzzzap', '快速攻击！', 'Zzzzzap!', 2, 18], ['onPlay']),
];

export const MUNCHKIN_MAGES_CARDS: CardDef[] = [
    ...MUNCHKIN_MAGES_MINIONS,
    ...MUNCHKIN_MAGES_ACTIONS,
];

export const MUNCHKIN_MAGES_BASES: BaseCardDef[] = [
    { id: 'base_dimension_doors', name: '次元之门', nameEn: 'Dimension Doors', breakpoint: 20, vpAwards: [4, 2, 1], faction: MAGES, monsterCount: 1, previewRef: { type: 'atlas', atlasId: MAGES_BASE_ATLAS, index: 0 } },
    { id: 'base_mages_tower', name: '法师之塔', nameEn: 'Mage\'s Tower', breakpoint: 18, vpAwards: [4, 3, 2], faction: MAGES, monsterCount: 1, previewRef: { type: 'atlas', atlasId: MAGES_BASE_ATLAS, index: 1 } },
];

const ELVES = SMASHUP_FACTION_IDS.MUNCHKIN_ELVES;
const ELVES_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_ELVES_CARDS;
const ELVES_BASE_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_ELVES_BASES;

export const MUNCHKIN_ELVES_MINIONS: MinionCardDef[] = [
    minion(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_fae_fighter', '精灵斗士', 'Fae Fighter', 5, 1, 0], ['ongoing']),
    { ...minion(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_lord_of_the_prance', '优雅贵族', 'Lord of the Prance', 4, 2, 1], ['talent']), activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }] },
    minion(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_flower_child', '花之子', 'Flower Child', 2, 3, 3], ['onPlay']),
    { ...minion(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_elf_help_guru', '精灵帮助大师', 'Elf Help Guru', 2, 4, 6], ['talent']), activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }] },
];

export const MUNCHKIN_ELVES_ACTIONS: ActionCardDef[] = [
    action(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_after_you', '在你之后', 'After You', 1, 10], ['onPlay']),
    action(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_dancing_root', '舞动之根', 'Dancing Root', 1, 11], ['onPlay']),
    action(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_helping_hands', '援手', 'Helping Hands', 1, 12], { subtype: 'special', abilityTags: ['special'], specialTiming: 'beforeScoring', specialNeedsBase: true }),
    action(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_pumping_iron', '力量训练', 'Pumping Iron', 2, 13], ['onPlay']),
    action(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_run_away', '逃跑吧！', 'Run Away!', 1, 15], { subtype: 'special', abilityTags: ['special'], specialTiming: 'beforeScoring', specialNeedsBase: true }),
    action(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_run_away_more', '赶紧逃跑吧！', 'Run Away More!', 1, 16], { subtype: 'special', abilityTags: ['special'], specialTiming: 'beforeScoring', specialNeedsBase: true }),
    action(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_trade', '贸易', 'Trade', 2, 17], ['onPlay']),
    action(ELVES, ELVES_CARD_ATLAS, ['munchkin_elves_traveling_elf', '旅行精灵', 'Traveling Elf', 1, 19], { subtype: 'ongoing', ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', abilityTags: ['ongoing', 'talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }] }),
];

export const MUNCHKIN_ELVES_CARDS: CardDef[] = [
    ...MUNCHKIN_ELVES_MINIONS,
    ...MUNCHKIN_ELVES_ACTIONS,
];

export const MUNCHKIN_ELVES_BASES: BaseCardDef[] = [
    { id: 'base_helpers_hollow', name: '援助山谷', nameEn: 'Helper\'s Hollow', breakpoint: 17, vpAwards: [3, 2, 1], faction: ELVES, monsterCount: 2, previewRef: { type: 'atlas', atlasId: ELVES_BASE_ATLAS, index: 0 } },
    { id: 'base_treehouse', name: '树屋', nameEn: 'Treehouse', breakpoint: 15, vpAwards: [4, 2, 1], faction: ELVES, monsterCount: 2, previewRef: { type: 'atlas', atlasId: ELVES_BASE_ATLAS, index: 1 } },
];

const CLERICS = SMASHUP_FACTION_IDS.MUNCHKIN_CLERICS;
const CLERICS_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_CLERICS_CARDS;
const CLERICS_BASE_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_CLERICS_BASES;

export const MUNCHKIN_CLERICS_MINIONS: MinionCardDef[] = [
    minion(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_cardinal', '红衣主教', 'Cardinal', 5, 1, 0]),
    minion(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_deep_friar', '资深修士', 'Deep Friar', 4, 2, 1]),
    minion(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_turner', '特纳', 'Turner', 3, 3, 3]),
    minion(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_holy_roller', '圣临者', 'Holy Roller', 2, 4, 6]),
];

export const MUNCHKIN_CLERICS_ACTIONS: ActionCardDef[] = [
    action(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_bin_and_gone', '垃圾处理', 'Bin and Gone', 1, 10]),
    action(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_collection_plate', '光盘', 'Collection Plate', 2, 11]),
    action(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_curse_of_imprisonment', '监禁诅咒', 'Curse of Imprisonment', 1, 13]),
    action(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_curse_of_uselessness', '无用诅咒', 'Curse of Uselessness', 1, 14]),
    action(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_good_habits', '好习惯', 'Good Habits', 1, 15]),
    action(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_join_the_club', '加入团队', 'Join the Club', 2, 16]),
    action(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_remove_curse', '解除诅咒', 'Remove Curse', 1, 18]),
    action(CLERICS, CLERICS_CARD_ATLAS, ['munchkin_clerics_word_of_recall', '回忆祷词', 'Word of Recall', 1, 19]),
];

export const MUNCHKIN_CLERICS_CARDS: CardDef[] = [
    ...MUNCHKIN_CLERICS_MINIONS,
    ...MUNCHKIN_CLERICS_ACTIONS,
];

export const MUNCHKIN_CLERICS_BASES: BaseCardDef[] = [
    { id: 'base_hotel_of_holiness', name: '圣洁酒店', nameEn: 'Hotel of Holiness', breakpoint: 15, vpAwards: [4, 3, 2], faction: CLERICS, monsterCount: 2, previewRef: { type: 'atlas', atlasId: CLERICS_BASE_ATLAS, index: 0 } },
    { id: 'base_whack_a_ghoul', name: '抓鬼', nameEn: 'Whack-A-Ghoul', breakpoint: 12, vpAwards: [3, 2, 1], faction: CLERICS, monsterCount: 3, previewRef: { type: 'atlas', atlasId: CLERICS_BASE_ATLAS, index: 1 } },
];

const ORCS = SMASHUP_FACTION_IDS.MUNCHKIN_ORCS;
const ORCS_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_ORCS_CARDS;
const ORCS_BASE_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_ORCS_BASES;

export const MUNCHKIN_ORCS_MINIONS: MinionCardDef[] = [
    minion(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_sword_lord', '剑王', 'Sword Lord', 5, 1, 0]),
    minion(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_topper_chopper', '粉碎者', 'Topper Chopper', 5, 2, 1]),
    minion(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_hammer_slammer', '重击者', 'Hammer Slammer', 3, 3, 3]),
    minion(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_dork_orc', '呆瓜兽人', 'Dork Orc', 2, 4, 6]),
];

export const MUNCHKIN_ORCS_ACTIONS: ActionCardDef[] = [
    action(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_and_stay_down', '躺下！', 'And Stay Down!', 1, 10]),
    action(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_angry_pillagers', '愤怒的掠夺者', 'Angry Pillagers', 2, 11]),
    action(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_crush', '挤碎', 'Crush', 1, 13]),
    action(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_death_breath', '死亡之息', 'Death Breath', 1, 14]),
    action(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_dogpile', '狗堆', 'Dogpile', 2, 15]),
    action(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_gimme', '给我！', 'Gimme!', 1, 17]),
    action(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_stalling', '洗手间', 'Stalling', 1, 18]),
    action(ORCS, ORCS_CARD_ATLAS, ['munchkin_orcs_too_tough', '太难了', 'Too Tough', 1, 19]),
];

export const MUNCHKIN_ORCS_CARDS: CardDef[] = [
    ...MUNCHKIN_ORCS_MINIONS,
    ...MUNCHKIN_ORCS_ACTIONS,
];

export const MUNCHKIN_ORCS_BASES: BaseCardDef[] = [
    { id: 'base_garrison', name: '要塞', nameEn: 'Garrison', breakpoint: 12, vpAwards: [3, 2, 1], faction: ORCS, monsterCount: 2, previewRef: { type: 'atlas', atlasId: ORCS_BASE_ATLAS, index: 0 } },
    { id: 'base_the_pits', name: '坑洞', nameEn: 'The Pits', breakpoint: 16, vpAwards: [4, 2, 1], faction: ORCS, monsterCount: 2, previewRef: { type: 'atlas', atlasId: ORCS_BASE_ATLAS, index: 1 } },
];

const WARRIORS = SMASHUP_FACTION_IDS.MUNCHKIN_WARRIORS;
const WARRIORS_CARD_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_WARRIORS_CARDS;
const WARRIORS_BASE_ATLAS = SMASHUP_ATLAS_IDS.MUNCHKIN_WARRIORS_BASES;

export const MUNCHKIN_WARRIORS_MINIONS: MinionCardDef[] = [
    minion(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_big_hero', '大英雄', 'Big Hero', 5, 1, 0]),
    minion(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_star_player', '明星勇士', 'Star Player', 4, 2, 1]),
    minion(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_berserker', '狂战士', 'Berserker', 3, 3, 3]),
    minion(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_taunter', '嘲讽者', 'Taunter', 2, 4, 6]),
];

export const MUNCHKIN_WARRIORS_ACTIONS: ActionCardDef[] = [
    action(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_campaign', '领导运动', 'Campaign', 1, 10]),
    action(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_cleave', '斩杀', 'Cleave', 2, 11]),
    action(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_dumbbells', '哑铃', 'Dumbbells', 1, 13]),
    action(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_dungeon_bait', '地牢诱饵', 'Dungeon Bait', 2, 14]),
    action(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_eternal_hero', '永恒的英雄', 'Eternal Hero', 1, 16]),
    action(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_ruckus', '骚乱', 'Ruckus', 1, 17]),
    action(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_shield_of_ubiquity', '无处不在之盾', 'Shield of Ubiquity', 1, 18]),
    action(WARRIORS, WARRIORS_CARD_ATLAS, ['munchkin_warriors_war_cry', '战争怒吼', 'War Cry', 1, 19]),
];

export const MUNCHKIN_WARRIORS_CARDS: CardDef[] = [
    ...MUNCHKIN_WARRIORS_MINIONS,
    ...MUNCHKIN_WARRIORS_ACTIONS,
];

export const MUNCHKIN_WARRIORS_BASES: BaseCardDef[] = [
    { id: 'base_bastion', name: '堡垒', nameEn: 'Bastion', breakpoint: 11, vpAwards: [3, 2, 2], faction: WARRIORS, monsterCount: 3, previewRef: { type: 'atlas', atlasId: WARRIORS_BASE_ATLAS, index: 0 } },
    { id: 'base_the_gauntlet', name: '锦标赛', nameEn: 'The Gauntlet', breakpoint: 14, vpAwards: [5, 3, 2], faction: WARRIORS, monsterCount: 3, previewRef: { type: 'atlas', atlasId: WARRIORS_BASE_ATLAS, index: 1 } },
];

export const MUNCHKIN_CARDS: CardDef[] = [
    ...MUNCHKIN_DWARVES_CARDS,
    ...MUNCHKIN_HALFLINGS_CARDS,
    ...MUNCHKIN_THIEVES_CARDS,
    ...MUNCHKIN_MAGES_CARDS,
    ...MUNCHKIN_ELVES_CARDS,
    ...MUNCHKIN_CLERICS_CARDS,
    ...MUNCHKIN_ORCS_CARDS,
    ...MUNCHKIN_WARRIORS_CARDS,
];

export const MUNCHKIN_BASES: BaseCardDef[] = [
    ...MUNCHKIN_DWARVES_BASES,
    ...MUNCHKIN_HALFLINGS_BASES,
    ...MUNCHKIN_THIEVES_BASES,
    ...MUNCHKIN_MAGES_BASES,
    ...MUNCHKIN_ELVES_BASES,
    ...MUNCHKIN_CLERICS_BASES,
    ...MUNCHKIN_ORCS_BASES,
    ...MUNCHKIN_WARRIORS_BASES,
];
