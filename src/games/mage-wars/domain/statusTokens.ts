import { STATUS_TOKEN_IDS, type StatusTokenId } from './ids';

export type MageWarsStatusTokenBag = Partial<Record<StatusTokenId, number>>;

export interface MageWarsStatusTokenReader {
    statusTokens: MageWarsStatusTokenBag;
}

export interface MageWarsStatusTokenCarrier {
    guarding: boolean;
    statusTokens: MageWarsStatusTokenBag;
}

export function getStatusTokenAmount(
    carrier: MageWarsStatusTokenReader,
    statusTokenId: StatusTokenId,
): number {
    return carrier.statusTokens[statusTokenId] ?? 0;
}

export function hasStatusToken(
    carrier: MageWarsStatusTokenReader,
    statusTokenId: StatusTokenId,
): boolean {
    return getStatusTokenAmount(carrier, statusTokenId) > 0;
}

export function addStatusTokenAmount(
    statusTokens: MageWarsStatusTokenBag,
    statusTokenId: StatusTokenId,
    amount: number,
): MageWarsStatusTokenBag {
    return {
        ...statusTokens,
        [statusTokenId]: (statusTokens[statusTokenId] ?? 0) + amount,
    };
}

export function removeStatusTokenAmount(
    statusTokens: MageWarsStatusTokenBag,
    statusTokenId: StatusTokenId,
    amount: number,
): MageWarsStatusTokenBag {
    const current = statusTokens[statusTokenId] ?? 0;
    const nextAmount = Math.max(0, current - amount);
    const next = { ...statusTokens };
    if (nextAmount > 0) {
        next[statusTokenId] = nextAmount;
    } else {
        delete next[statusTokenId];
    }
    return next;
}

export function applyStatusTokenPlacement<TTarget extends MageWarsStatusTokenCarrier>(
    target: TTarget,
    statusTokenId: StatusTokenId,
    amount: number,
): TTarget {
    return {
        ...target,
        guarding: statusTokenId === STATUS_TOKEN_IDS.STUN ? false : target.guarding,
        statusTokens: addStatusTokenAmount(target.statusTokens, statusTokenId, amount),
    };
}

export function applyStatusTokenRemoval<TTarget extends { statusTokens: MageWarsStatusTokenBag }>(
    target: TTarget,
    statusTokenId: StatusTokenId,
    amount: number,
): TTarget {
    return {
        ...target,
        statusTokens: removeStatusTokenAmount(target.statusTokens, statusTokenId, amount),
    };
}
