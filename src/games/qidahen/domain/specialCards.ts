import type { QidahenFactionId } from './types';

/** TTS atlas05 完整卡面标有“特”的九张牌；不以牌堆数量差推定扩展身份。 */
export const QIDAHEN_SPECIAL_CARD_ATLAS_INDICES: Record<QidahenFactionId, readonly number[]> = {
    ming: [32, 33, 34],
    mongol: [12, 16, 23],
    jin: [30, 50, 60],
};

export const isQidahenSpecialCard = (factionId: QidahenFactionId, atlasIndex: number): boolean => (
    QIDAHEN_SPECIAL_CARD_ATLAS_INDICES[factionId].includes(atlasIndex)
);
