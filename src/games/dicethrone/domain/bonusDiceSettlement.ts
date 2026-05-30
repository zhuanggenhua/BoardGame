import type { DiceThroneCore, DiceThroneEvent, PendingBonusDiceSettlement } from './types';

export interface BonusDiceSettlementHandlerContext {
    state: DiceThroneCore;
    settlement: PendingBonusDiceSettlement;
    timestamp: number;
}

export interface BonusDiceSettlementHandlerResult {
    totalDamage?: number;
    thresholdTriggered?: boolean;
    followupEvents?: DiceThroneEvent[];
}

export type BonusDiceSettlementHandler = (
    context: BonusDiceSettlementHandlerContext,
) => BonusDiceSettlementHandlerResult | undefined;

const bonusDiceSettlementHandlers = new Map<string, BonusDiceSettlementHandler>();

export function registerBonusDiceSettlementHandler(
    settlementId: string,
    handler: BonusDiceSettlementHandler,
): void {
    bonusDiceSettlementHandlers.set(settlementId, handler);
}

export function getBonusDiceSettlementHandler(
    settlementId: string,
): BonusDiceSettlementHandler | undefined {
    return bonusDiceSettlementHandlers.get(settlementId);
}
