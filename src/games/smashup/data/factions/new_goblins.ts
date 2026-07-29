import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const CARD_ATLAS = SMASHUP_ATLAS_IDS.NEW_GOBLINS_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.NEW_GOBLINS_BASES;
const FACTION = SMASHUP_FACTION_IDS.NEW_GOBLINS;

function minion(
    id: string,
    name: string,
    nameEn: string,
    power: number,
    count: number,
    index: number,
): MinionCardDef {
    return {
        id,
        type: 'minion',
        name,
        nameEn,
        faction: FACTION,
        power,
        count,
        previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index },
    };
}

function action(
    id: string,
    name: string,
    nameEn: string,
    count: number,
    index: number,
    extras: Partial<ActionCardDef> = {},
): ActionCardDef {
    return {
        id,
        type: 'action',
        subtype: 'standard',
        name,
        nameEn,
        faction: FACTION,
        count,
        previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index },
        ...extras,
    };
}

export const NEW_GOBLINS_MINIONS: MinionCardDef[] = [
    minion('new_goblins_chaos_goblin', '混沌哥布林', 'Chaos Goblin', 5, 1, 0),
    minion('new_goblins_oracle_goblin', '先知哥布林', 'Oracle Goblin', 4, 2, 1),
    minion('new_goblins_bomb_goblin', '爆弹哥布林', 'Bomb Goblin', 3, 3, 3),
    minion('new_goblins_goblin', '哥布林', 'Goblin', 2, 4, 6),
];

export const NEW_GOBLINS_ACTIONS: ActionCardDef[] = [
    action('new_goblins_magic_helmet', '“魔法”头盔', '"Magic" Helmet', 1, 10, {
        subtype: 'ongoing',
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('new_goblins_a_little_help', '一点帮助', 'A Little Help', 2, 11),
    action('new_goblins_ambush', '伏击', 'Ambush', 1, 13, {
        playNeedsMinion: true,
        playTargetMinionController: 'any',
    }),
    action('new_goblins_blast', '爆破', 'Blast', 1, 14),
    action('new_goblins_recruiters', '哥布林招聘人员', 'Goblin Recruiters', 1, 15, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('new_goblins_who_smelted_it', '是谁冶炼它', 'Who Smelted It?', 1, 16, {
        playNeedsMinion: true,
        playTargetMinionController: 'any',
    }),
    action('new_goblins_make_your_own_luck', '自己制造好运', 'Make Your Own Luck', 2, 17, {
        subtype: 'special',
        specialTiming: 'triggered',
    }),
    action('new_goblins_speed_boost', '速度提升', 'Speed Boost', 1, 19, {
        playNeedsBase: true,
    }),
];

export const NEW_GOBLINS_CARDS: CardDef[] = [
    ...NEW_GOBLINS_MINIONS,
    ...NEW_GOBLINS_ACTIONS,
];

export const NEW_GOBLINS_BASES: BaseCardDef[] = [
    {
        id: 'base_goblin_caves',
        name: '哥布林洞穴',
        nameEn: 'Goblin Caves',
        breakpoint: 17,
        vpAwards: [3, 1, 1],
        faction: FACTION,
        previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 0 },
    },
    {
        id: 'base_goblin_village',
        name: '哥布林村',
        nameEn: 'Goblin Village',
        breakpoint: 21,
        vpAwards: [4, 2, 1],
        faction: FACTION,
        previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 },
    },
];
