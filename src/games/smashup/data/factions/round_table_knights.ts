import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const CARD_ATLAS = SMASHUP_ATLAS_IDS.ROUND_TABLE_KNIGHTS_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.ROUND_TABLE_KNIGHTS_BASES;
const FACTION = SMASHUP_FACTION_IDS.ROUND_TABLE_KNIGHTS;

function minion(
    id: string,
    name: string,
    nameEn: string,
    power: number,
    count: number,
    index: number,
    extras: Partial<MinionCardDef> = {},
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
        ...extras,
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

export const ROUND_TABLE_KNIGHTS_MINIONS: MinionCardDef[] = [
    minion('round_table_knights_king_arthur', '亚瑟王', 'King Arthur', 5, 1, 0, {
        abilityTags: ['talent'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    minion('round_table_knights_galahad', '加拉哈德', 'Galahad', 4, 1, 1, {
        abilityTags: ['onPlay', 'special'],
        beforeScoringPlayable: false,
        activatableAbilities: [{ kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'scoringBase' }],
    }),
    minion('round_table_knights_gawain', '加文', 'Gawain', 4, 1, 2, {
        abilityTags: ['ongoing'],
    }),
    minion('round_table_knights_guinevere', '格尼薇儿', 'Guinevere', 4, 1, 3, {
        abilityTags: ['talent', 'ongoing'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    minion('round_table_knights_lancelot', '兰斯洛特', 'Lancelot', 4, 1, 4, {
        abilityTags: ['ongoing'],
    }),
    minion('round_table_knights_merlin', '梅林', 'Merlin', 4, 1, 5, {
        abilityTags: ['talent'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    minion('round_table_knights_percival', '帕西瓦尔', 'Percival', 4, 1, 6, {
        abilityTags: ['talent'],
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
];

export const ROUND_TABLE_KNIGHTS_ACTIONS: ActionCardDef[] = [
    action('round_table_knights_a_questing', '踏上征途', 'A Questing', 1, 7, {
        subtype: 'ongoing',
        abilityTags: ['onPlay', 'ongoing'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
    }),
    action('round_table_knights_excalibur', '圣剑 Excalibur', 'Excalibur', 1, 8, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
        responseWindowTiming: 'afterScoring',
        responseWindowNeedsBase: true,
    }),
    action('round_table_knights_good_deed', '善行', 'Good Deed', 2, 9, {
        subtype: 'ongoing',
        abilityTags: ['onPlay', 'ongoing'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('round_table_knights_merlins_library', '梅林藏书馆', "Merlin's Library", 1, 11, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'talent'],
        ongoingTarget: 'base',
        playNeedsBase: true,
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('round_table_knights_noble_steed', '高贵坐骑', 'Noble Steed', 2, 12, {
        subtype: 'ongoing',
        abilityTags: ['ongoing', 'talent'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
        activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }],
    }),
    action('round_table_knights_the_fisher_king', '渔夫王', 'The Fisher King', 1, 14, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('round_table_knights_the_grail', '圣杯', 'The Grail', 1, 15, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'base',
        playNeedsBase: true,
        playConstraint: 'requireNoOwnActionsOnBase',
    }),
    action('round_table_knights_the_green_knight', '绿衣骑士', 'The Green Knight', 1, 16, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('round_table_knights_the_lady_of_the_lake', '湖中女神', 'The Lady of the Lake', 1, 17, {
        abilityTags: ['onPlay', 'extra'],
    }),
    action('round_table_knights_the_mists_of_avalon', '阿瓦隆迷雾', 'The Mists of Avalon', 1, 18, {
        abilityTags: ['onPlay'],
    }),
    action('round_table_knights_the_questing_beast', '追踪野兽', 'The Questing Beast', 1, 19, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
];

export const ROUND_TABLE_KNIGHTS_CARDS: CardDef[] = [
    ...ROUND_TABLE_KNIGHTS_MINIONS,
    ...ROUND_TABLE_KNIGHTS_ACTIONS,
];

export const ROUND_TABLE_KNIGHTS_BASES: BaseCardDef[] = [
    {
        id: 'base_camelot',
        name: '卡美洛',
        nameEn: 'Camelot',
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
