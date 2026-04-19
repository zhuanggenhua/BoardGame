import type { CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS } from '../../domain/ids';

export const MADNESS_CARDS: CardDef[] = [
    {
        id: 'special_madness',
        type: 'action',
        subtype: 'standard',
        name: '疯狂',
        nameEn: 'Madness',
        faction: 'madness',        // 特殊规则（已实现）：
        // 1. 属于独立的“疯狂牌堆”，不进入玩家起始牌组
        // 2. 游戏结束时，在玩家牌组/手牌/弃牌堆中的每份该卡扣除 1/2 VP（向下取整）
        count: 30,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS2, index: 47 },
    },
];

export const MADNESS_UNIQUE_CARDS: CardDef[] = [...MADNESS_CARDS];
