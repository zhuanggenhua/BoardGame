import type { RandomFn } from '../../engine/types';

const BETRAYAL_DICE_POOL_SIZE = 8;

export function normalizeBetrayalDiceCount(count: number): number {
    return Math.min(BETRAYAL_DICE_POOL_SIZE, Math.max(0, Math.floor(count)));
}

export function rollBetrayalPip(random: RandomFn): number {
    return Math.max(0, Math.min(2, random.d(3) - 1));
}

export function rollBetrayalDicePips(random: RandomFn, count: number): number[] {
    return Array.from({ length: normalizeBetrayalDiceCount(count) }, () => rollBetrayalPip(random));
}
