import type { MinionCardDef, ActionCardDef, FusionCardDef, CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS } from '../../domain/ids';

export const VAMPIRE_POD_MINIONS: MinionCardDef[] = [
    {
        id: 'vampire_the_count_pod',
        type: 'minion',
        name: '吸血鬼伯爵',
        nameEn: 'The Count',
        faction: 'vampires_pod',
        power: 5,
        abilityTags: ['ongoing', 'talent'],
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 35 },
    },
    {
        id: 'vampire_nightstalker_pod',
        type: 'minion',
        name: '夜行者',
        nameEn: 'Nightstalker',
        faction: 'vampires_pod',
        power: 4,
        abilityTags: ['talent'],
        count: 2,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 33 },
    },
    {
        id: 'vampire_heavy_drinker_pod',
        type: 'minion',
        name: '海量酒鬼',
        nameEn: 'Heavy Drinker',
        faction: 'vampires_pod',
        power: 2,
        abilityTags: ['onPlay'],
        count: 3,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 31 },
    },
    {
        id: 'vampire_fledgling_vampire_pod',
        type: 'minion',
        name: '新生吸血鬼',
        nameEn: 'Fledgling Vampire',
        faction: 'vampires_pod',
        power: 2,
        abilityTags: ['onPlay'],
        count: 3,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 29 },
    },
];

export const VAMPIRE_POD_FUSIONS: FusionCardDef[] = [
    {
        id: 'vampire_wolf_pact_pod',
        type: 'fusion',
        name: '狼之契约',
        nameEn: 'Wolf Pact',
        faction: 'vampires_pod',
        count: 2,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 34 },

        // as minion
        minionPower: 2,
        minionAbilityTags: ['onPlay'],

        // as action
        actionSubtype: 'standard',
        actionAbilityTags: ['onPlay'],
    },
];

export const VAMPIRE_POD_ACTIONS: ActionCardDef[] = [
    {
        id: 'vampire_big_gulp_pod',
        type: 'action',
        subtype: 'standard',
        name: '一大口',
        nameEn: 'Big Gulp',
        faction: 'vampires_pod',
        abilityTags: ['onPlay'],
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 25 },
    },
    {
        id: 'vampire_buffet_pod',
        type: 'action',
        subtype: 'standard',
        name: '自助餐',
        nameEn: 'Buffet',
        faction: 'vampires_pod',
        // 注意：POD 自助餐是 onMinionDestroyed 触发后，从手牌创建交互并打出
        // 不是通用计分响应窗口中的可手动 special，因此不能有 abilityTags: ['special']
        abilityTags: ['onPlay'],
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 30 },
    },
    {
        id: 'vampire_crack_of_dusk_pod',
        type: 'action',
        subtype: 'standard',
        name: '破晓',
        nameEn: 'Crack of Dusk',
        faction: 'vampires_pod',
        abilityTags: ['onPlay'],
        count: 2,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 32 },
    },
    {
        id: 'vampire_cull_the_weak_pod',
        type: 'action',
        subtype: 'standard',
        name: '剔除弱者',
        nameEn: 'Cull The Weak',
        faction: 'vampires_pod',
        abilityTags: ['onPlay'],
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 28 },
    },
    {
        id: 'vampire_dinner_date_pod',
        type: 'action',
        subtype: 'ongoing',
        name: '晚餐约会',
        nameEn: 'Dinner Date',
        faction: 'vampires_pod',
        abilityTags: ['onPlay', 'ongoing'],
        ongoingTarget: 'minion',
        count: 2,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 24 },
    },
    {
        id: 'vampire_mad_monster_party_pod',
        type: 'action',
        subtype: 'special',
        name: '疯狂怪物派对',
        nameEn: 'Mad Monster Party',
        faction: 'vampires_pod',
        // 注意：POD 疯狂怪物派对同样由 onMinionDestroyed 触发后创建交互并打出
        // 不是通用计分响应窗口中的可手动 special，因此不能有 abilityTags: ['special']
        specialTiming: 'triggered',
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 27 },
    },
    {
        id: 'vampire_stakeout_pod',
        type: 'action',
        subtype: 'ongoing',
        name: '盯梢',
        nameEn: 'Stakeout',
        faction: 'vampires_pod',
        abilityTags: ['ongoing', 'talent'],
        ongoingTarget: 'base',
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 26 },
    },
];

export const VAMPIRE_POD_CARDS: CardDef[] = [
    ...VAMPIRE_POD_MINIONS,
    ...VAMPIRE_POD_FUSIONS,
    ...VAMPIRE_POD_ACTIONS,
];
