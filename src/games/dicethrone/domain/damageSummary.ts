import type { DiceThroneCore, PendingBonusDiceSettlement } from './types';
import { getPendingAttackExpectedDamage } from './utils';

export interface CurrentDamageSummary {
    currentDamage: number;
    originalDamage?: number;
}

type BonusSettlementDamagePreview =
    | { mode: 'add'; amount: number }
    | { mode: 'replace'; amount: number };

const toDamageValue = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, value)
        : undefined
);

const sumBonusDiceValues = (settlement: PendingBonusDiceSettlement): number =>
    settlement.dice.reduce((sum, die) => sum + (toDamageValue(die.value) ?? 0), 0);

const sumPostSettleBonusDamage = (settlement: PendingBonusDiceSettlement): number =>
    (settlement.postSettleBonusDamageAdds ?? [])
        .reduce((sum, entry) => sum + (toDamageValue(entry.amount) ?? 0), 0);

const firstNumericParam = (
    params: Record<string, string | number> | undefined,
    keys: readonly string[],
): number | undefined => {
    if (!params) return undefined;
    for (const key of keys) {
        const value = toDamageValue(params[key]);
        if (value !== undefined) return value;
    }
    return undefined;
};

const sumDiceEffectParam = (
    settlement: PendingBonusDiceSettlement,
    keys: readonly string[],
): number | undefined => {
    let found = false;
    const total = settlement.dice.reduce((sum, die) => {
        const value = firstNumericParam(die.effectParams, keys);
        if (value === undefined) return sum;
        found = true;
        return sum + value;
    }, 0);
    return found ? total : undefined;
};

export function getPendingBonusDiceSettlementDamagePreview(
    state: DiceThroneCore,
): BonusSettlementDamagePreview | undefined {
    const settlement = state.pendingBonusDiceSettlement;
    if (!settlement || settlement.continuation?.kind !== 'attack') return undefined;

    const postSettleBonusDamage = sumPostSettleBonusDamage(settlement);

    if (settlement.resolutionMode === 'attackBonus') {
        const totalDamage = sumBonusDiceValues(settlement);
        const attackBonus = settlement.attackBonusScale === 'halfUp'
            ? Math.ceil(totalDamage / 2)
            : totalDamage;
        return { mode: 'add', amount: attackBonus + postSettleBonusDamage };
    }

    const summaryDamage = firstNumericParam(
        settlement.summaryEffectParams,
        ['bonusDamage', 'damage', 'totalDamage'],
    );
    if (summaryDamage !== undefined) {
        return { mode: 'add', amount: summaryDamage + postSettleBonusDamage };
    }

    const perDieEffectDamage = sumDiceEffectParam(
        settlement,
        ['bonusDamage', 'damage', 'totalDamage'],
    );
    if (perDieEffectDamage !== undefined) {
        return { mode: 'add', amount: perDieEffectDamage + postSettleBonusDamage };
    }

    if (settlement.resolutionMode === 'damage' && settlement.showTotal !== false) {
        return { mode: 'replace', amount: sumBonusDiceValues(settlement) };
    }

    return undefined;
}

export function getCurrentDamageSummary(state: DiceThroneCore): CurrentDamageSummary | undefined {
    const pendingDamage = state.pendingDamage;
    if (pendingDamage) {
        const currentDamage = toDamageValue(pendingDamage.currentDamage) ?? 0;
        return {
            currentDamage,
            originalDamage: toDamageValue(pendingDamage.originalDamage) ?? currentDamage,
        };
    }

    const pendingAttack = state.pendingAttack;
    if (!pendingAttack) return undefined;

    const currentAttackDamage = toDamageValue(getPendingAttackExpectedDamage(state, pendingAttack)) ?? 0;
    const confirmedBonusDamage = toDamageValue(pendingAttack.bonusDamage) ?? 0;
    const originalDamage = Math.max(0, currentAttackDamage - confirmedBonusDamage);
    const bonusDicePreview = getPendingBonusDiceSettlementDamagePreview(state);

    if (bonusDicePreview) {
        return bonusDicePreview.mode === 'replace'
            ? { currentDamage: bonusDicePreview.amount, originalDamage: currentAttackDamage }
            : { currentDamage: currentAttackDamage + bonusDicePreview.amount, originalDamage };
    }

    const shouldShowDamage = Boolean(
        pendingAttack.sourceAbilityId
        || pendingAttack.damage !== undefined
        || confirmedBonusDamage > 0
    );

    return shouldShowDamage
        ? { currentDamage: currentAttackDamage, originalDamage }
        : undefined;
}
