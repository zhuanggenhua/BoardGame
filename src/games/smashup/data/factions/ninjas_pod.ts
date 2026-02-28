/**
 * 忍者 POD版 (Ninjas - POD Edition)
 *
 * 该文件为忍者阵营的最新英文版（POD Print-on-Demand 版本）数据定义。
 * 不修改原版 ninjas.ts，本文件独立共存，阵营 ID 为 'ninjas_pod'。
 * 所有卡牌 ID 带有 _pod 后缀，避免与原版冲突。
 *
 * 注意：卡牌图集继续复用 TTS 高清图集（englishAtlasMap.json 中无需修改，
 * SmashUpCardRenderer 会通过原版 ID 的相同英文名自动查表渲染）。
 * 因此 previewRef 中保留原版卡牌 ID 对应的图集坐标，只是 id 字段加了 _pod 后缀。
 */
import type { MinionCardDef, ActionCardDef, CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS } from '../../domain/ids';

export const NINJA_POD_MINIONS: MinionCardDef[] = [
    {
        id: 'ninja_master_pod',
        type: 'minion',
        name: '忍者大师',
        nameEn: 'Ninja Master',
        faction: 'ninjas_pod',
        power: 5,
        abilityTags: ['onPlay'],
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 12 },
    },
    {
        id: 'ninja_tiger_assassin_pod',
        type: 'minion',
        name: '猛虎刺客',
        nameEn: 'Tiger Assassin',
        faction: 'ninjas_pod',
        power: 4,
        abilityTags: ['onPlay'],
        count: 2,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 13 },
    },
    {
        id: 'ninja_shinobi_pod',
        type: 'minion',
        name: '影舞者',
        nameEn: 'Shinobi',
        faction: 'ninjas_pod',
        power: 3,
        abilityTags: ['special'],
        specialLimitGroup: 'ninja_pod_special',
        count: 3,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 14 },
    },
    {
        id: 'ninja_acolyte_pod',
        type: 'minion',
        name: '忍者侍从',
        nameEn: 'Ninja Acolyte',
        faction: 'ninjas_pod',
        power: 2,
        // [POD版新效果] Talent: During your turn, if you have not played a minion,
        // you may return this card to your hand to play an extra minion on this base.
        // 旧版只有 special，新版改为 talent（主动激活型）
        abilityTags: ['talent'],
        count: 4,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 15 },
    },
];

export const NINJA_POD_ACTIONS: ActionCardDef[] = [
    {
        id: 'ninja_way_of_deception_pod',
        type: 'action',
        subtype: 'standard',
        name: '诈术',
        nameEn: 'Way of Deception',
        faction: 'ninjas_pod',
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 16 },
    },
    {
        id: 'ninja_smoke_bomb_pod',
        type: 'action',
        subtype: 'ongoing',
        name: '烟幕弹',
        nameEn: 'Smoke Bomb',
        faction: 'ninjas_pod',
        // [POD版效果] Play on one of your minions.
        // Ongoing: This minion is not affected by other players' actions.
        abilityTags: ['ongoing'],
        ongoingTarget: 'minion',
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 17 },
    },
    {
        id: 'ninja_assassination_pod',
        type: 'action',
        subtype: 'ongoing',
        name: '暗杀',
        nameEn: 'Assassination',
        faction: 'ninjas_pod',
        abilityTags: ['ongoing'],
        ongoingTarget: 'minion',
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 18 },
    },
    {
        id: 'ninja_hidden_ninja_pod',
        type: 'action',
        subtype: 'special',
        name: '便衣忍者',
        nameEn: 'Hidden Ninja',
        faction: 'ninjas_pod',
        abilityTags: ['special'],
        specialNeedsBase: true,
        specialLimitGroup: 'ninja_pod_special',
        count: 2,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 19 },
    },
    {
        id: 'ninja_seeing_stars_pod',
        type: 'action',
        subtype: 'standard',
        name: '手里剑',
        nameEn: 'Seeing Stars',
        faction: 'ninjas_pod',
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 20 },
    },
    {
        id: 'ninja_disguise_pod',
        type: 'action',
        subtype: 'standard',
        name: '伪装',
        nameEn: 'Disguise',
        faction: 'ninjas_pod',
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 21 },
    },
    {
        id: 'ninja_infiltrate_pod',
        type: 'action',
        subtype: 'ongoing',
        name: '渗透',
        nameEn: 'Infiltrate',
        faction: 'ninjas_pod',
        // [POD版效果] Play on a base. You may destroy another action on this base.
        // Talent: Destroy this action to cancel this base's ability until the start of your turn.
        // 注意：即时消灭战术是 onPlay 效果，加入 onPlay 标签
        abilityTags: ['onPlay', 'ongoing'],
        ongoingTarget: 'base',
        count: 1,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 22 },
    },
    {
        id: 'ninja_poison_pod',
        type: 'action',
        subtype: 'ongoing',
        name: '下毒',
        nameEn: 'Poison',
        faction: 'ninjas_pod',
        abilityTags: ['ongoing'],
        ongoingTarget: 'minion',
        count: 2,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 23 },
    },
];

export const NINJA_POD_CARDS: CardDef[] = [...NINJA_POD_MINIONS, ...NINJA_POD_ACTIONS];
