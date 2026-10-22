import { FATE_MASTER_BY_ID } from '../data';

// CHM 准备阶段：通常补到三张；已有更多手牌时不额外抽牌。
export const FATE_DEFAULT_HAND_LIMIT = 3;
// 移动合法性统一由 movement adapter 负责；demo-only 的局势文案不在这里直接变成规则。
export { FATE_LOCATION_ORDER, FATE_STEP_COST, legalMoveTargets, movementCost } from './movement';

/** 所有魔力获得路径共用御主的印刷上限，不在 UI 或各阶段硬编码。 */
export function capFateMana(masterId: string, mana: number): number {
    return Math.min(FATE_MASTER_BY_ID[masterId]?.manaLimit ?? 12, mana);
}
