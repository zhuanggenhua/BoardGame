import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const CARD_ATLAS = SMASHUP_ATLAS_IDS.GOBLINS_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.GOBLINS_BASES;
const FACTION = SMASHUP_FACTION_IDS.GOBLINS;

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

export const GOBLINS_MINIONS: MinionCardDef[] = [
    minion('goblins_chaos_lord', '混沌领主', 'Chaos Lord', 5, 1, 0, {
        abilityTags: ['ongoing'],
    }),
    minion('goblins_diviner', '占卜师', 'Diviner', 4, 2, 1, {
        abilityTags: ['ongoing'],
    }),
    minion('goblins_blaster', '爆破手', 'Blaster', 3, 3, 3, {
        abilityTags: ['special'],
        beforeScoringPlayable: false,
        activatableAbilities: [{ kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'scoringBase' }],
    }),
    minion('goblins_gobbo', 'Gobbo', 'Gobbo', 2, 4, 6, {
        abilityTags: ['onPlay'],
    }),
];

export const GOBLINS_ACTIONS: ActionCardDef[] = [
    action('goblins_magic_helmet', '“魔法”头盔', '"Magic" Helmet', 1, 10, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'minion',
        playNeedsMinion: true,
        playTargetMinionController: 'self',
        responseWindowTiming: 'beforeScoring',
        responseWindowNeedsBase: true,
    }),
    action('goblins_a_little_help', '一点帮助', 'A Little Help', 2, 11, {
        abilityTags: ['onPlay', 'extra'],
    }),
    action('goblins_bushwhacking', '伏击', 'Bushwhacking', 1, 13, {
        abilityTags: ['onPlay'],
        playNeedsMinion: true,
        playTargetMinionController: 'any',
    }),
    action('goblins_demolition', '爆破', 'Demolition', 1, 14, {
        abilityTags: ['onPlay'],
    }),
    action('goblins_recruiters', '哥布林招募员', 'Goblin Recruiters', 1, 15, {
        subtype: 'ongoing',
        abilityTags: ['ongoing'],
        ongoingTarget: 'base',
        playNeedsBase: true,
    }),
    action('goblins_he_who_smelt_it', '谁放的屁', 'He Who Smelt It', 1, 16, {
        abilityTags: ['onPlay', 'extra'],
        playNeedsMinion: true,
        playTargetMinionController: 'any',
    }),
    action('goblins_make_your_own_luck', '自己制造好运', 'Make Your Own Luck', 2, 17, {
        subtype: 'special',
        abilityTags: ['special'],
        specialTiming: 'triggered',
    }),
    action('goblins_revving_up', '加足马力', 'Revving Up', 1, 19, {
        abilityTags: ['onPlay'],
        playNeedsBase: true,
    }),
];

export const GOBLINS_CARDS: CardDef[] = [
    ...GOBLINS_MINIONS,
    ...GOBLINS_ACTIONS,
];

export const GOBLINS_BASES: BaseCardDef[] = [
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
        id: 'base_goblin_town',
        name: '哥布林镇',
        nameEn: 'Goblin Town',
        breakpoint: 21,
        vpAwards: [4, 2, 1],
        faction: FACTION,
        previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 },
    },
];
