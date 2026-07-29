import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const CARD_ATLAS = SMASHUP_ATLAS_IDS.NEW_ROUND_TABLE_KNIGHTS_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.NEW_ROUND_TABLE_KNIGHTS_BASES;
const FACTION = SMASHUP_FACTION_IDS.NEW_ROUND_TABLE_KNIGHTS;

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

export const NEW_ROUND_TABLE_KNIGHTS_MINIONS: MinionCardDef[] = [
    minion('new_round_table_knights_king_arthur', '亚瑟王', 'King Arthur', 5, 1, 0),
    minion('new_round_table_knights_galahad', '加拉哈德', 'Galahad', 4, 1, 1),
    minion('new_round_table_knights_gawain', '加文', 'Gawain', 4, 1, 2),
    minion('new_round_table_knights_guinevere', '格尼薇儿', 'Guinevere', 4, 1, 3),
    minion('new_round_table_knights_lancelot', '兰斯洛特', 'Lancelot', 4, 1, 4),
    minion('new_round_table_knights_merlin', '梅林', 'Merlin', 4, 1, 5),
    minion('new_round_table_knights_percival', '帕西瓦尔', 'Percival', 4, 1, 6),
];

export const NEW_ROUND_TABLE_KNIGHTS_ACTIONS: ActionCardDef[] = [
    action('new_round_table_knights_quest', '任务', 'Quest', 1, 7, {
        subtype: 'ongoing',
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('new_round_table_knights_sword_in_the_stone', '石中剑', 'Sword in the Stone', 1, 8, {
        subtype: 'ongoing',
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('new_round_table_knights_do_good', '做好事', 'Do Good', 2, 9, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('new_round_table_knights_merlins_library', '梅林藏书馆', "Merlin's Library", 1, 11, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('new_round_table_knights_steed', '骏马', 'Steed', 2, 12, {
        subtype: 'ongoing',
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('new_round_table_knights_fisher_king', '渔夫王', 'Fisher King', 1, 14, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('new_round_table_knights_holy_grail', '圣杯', 'Holy Grail', 1, 15, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('new_round_table_knights_green_knight', '绿衣骑士', 'Green Knight', 1, 16, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('new_round_table_knights_lady_of_the_lake', '湖中女神', 'Lady of the Lake', 1, 17),
    action('new_round_table_knights_mists_of_avalon', '阿瓦隆的迷雾', 'Mists of Avalon', 1, 18),
    action('new_round_table_knights_questing_beast', '追踪野兽', 'Questing Beast', 1, 19, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
];

export const NEW_ROUND_TABLE_KNIGHTS_CARDS: CardDef[] = [
    ...NEW_ROUND_TABLE_KNIGHTS_MINIONS,
    ...NEW_ROUND_TABLE_KNIGHTS_ACTIONS,
];

export const NEW_ROUND_TABLE_KNIGHTS_BASES: BaseCardDef[] = [
    {
        id: 'base_arthurs_court',
        name: '亚瑟王宫',
        nameEn: "Arthur's Court",
        breakpoint: 22,
        vpAwards: [5, 3, 2],
        faction: FACTION,
        previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 0 },
    },
    {
        id: 'base_round_table',
        name: '圆桌会议',
        nameEn: 'Round Table',
        breakpoint: 21,
        vpAwards: [4, 2, 1],
        faction: FACTION,
        previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 },
    },
];
