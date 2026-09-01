import type { DiceThroneCore, PendingBonusDiceSettlement } from './types';
import { getPendingAttackExpectedDamage } from './utils';

export interface CurrentDamageSummary {
    currentDamage: number;
    originalDamage?: number;
}

export type DamageSummaryCaptureMode = 'snapshot' | 'live';
export type DamageSummaryAuthority = 'formal-rule-state' | 'rule-preview';
export type DamageSummarySource = 'pendingDamage' | 'pendingAttack' | 'pendingBonusDiceSettlement';

export interface DamageSummaryValueContract {
    mode: DamageSummaryCaptureMode;
    authority: DamageSummaryAuthority;
    source: DamageSummarySource;
}

export interface CurrentDamageSummaryDetails extends CurrentDamageSummary {
    current: DamageSummaryValueContract;
    original?: DamageSummaryValueContract;
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

const formalLive = (source: DamageSummarySource): DamageSummaryValueContract => ({
    mode: 'live',
    authority: 'formal-rule-state',
    source,
});

const formalSnapshot = (source: DamageSummarySource): DamageSummaryValueContract => ({
    mode: 'snapshot',
    authority: 'formal-rule-state',
    source,
});

const previewLive = (source: DamageSummarySource): DamageSummaryValueContract => ({
    mode: 'live',
    authority: 'rule-preview',
    source,
});

export const isPendingDamageResponseBonusSettlement = (
    state: DiceThroneCore,
    settlement: PendingBonusDiceSettlement | undefined,
): settlement is PendingBonusDiceSettlement => {
    const pendingDamage = state.pendingDamage;
    if (!pendingDamage || !settlement
        || settlement.displayOnly !== true
        || settlement.continuation?.kind !== 'complete'
        || settlement.dice.length === 0) {
        return false;
    }
    const isSneakAttack = settlement.attackerId === pendingDamage.responderId
        && settlement.attackerId === pendingDamage.sourcePlayerId
        && settlement.targetId === pendingDamage.targetPlayerId
        && settlement.dice.every(die => die.effectKey === 'bonusDie.effect.sneakAttack');
    const isFlightDefense = settlement.attackerId === pendingDamage.responderId
        && settlement.targetId === pendingDamage.targetPlayerId
        && settlement.dice.every(die => die.effectKey === 'bonusDie.effect.tianshi.flight');
    return isSneakAttack || isFlightDefense;
};

export const isPendingDamageBonusSettlement = (
    state: DiceThroneCore,
    settlement: PendingBonusDiceSettlement | undefined,
): settlement is PendingBonusDiceSettlement => (
    isPendingDamageResponseBonusSettlement(state, settlement)
    && settlement.dice.every(die => die.effectKey === 'bonusDie.effect.sneakAttack')
);

const getPendingDamageBonusSettlementPreviewAmount = (
    state: DiceThroneCore,
): number | undefined => {
    const settlement = state.pendingBonusDiceSettlement;
    if (!isPendingDamageBonusSettlement(state, settlement)) return undefined;
    return sumBonusDiceValues(settlement);
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

export function getCurrentDamageSummaryDetails(state: DiceThroneCore): CurrentDamageSummaryDetails | undefined {
    const pendingDamage = state.pendingDamage;
    if (pendingDamage) {
        const currentDamage = toDamageValue(pendingDamage.currentDamage) ?? 0;
        const pendingDamageBonusPreview = getPendingDamageBonusSettlementPreviewAmount(state) ?? 0;
        return {
            currentDamage: currentDamage + pendingDamageBonusPreview,
            originalDamage: toDamageValue(pendingDamage.originalDamage) ?? currentDamage,
            current: pendingDamageBonusPreview > 0
                ? previewLive('pendingBonusDiceSettlement')
                : formalLive('pendingDamage'),
            original: formalSnapshot('pendingDamage'),
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
            ? {
                currentDamage: bonusDicePreview.amount,
                originalDamage: currentAttackDamage,
                current: previewLive('pendingBonusDiceSettlement'),
                original: formalLive('pendingAttack'),
            }
            : {
                currentDamage: currentAttackDamage + bonusDicePreview.amount,
                originalDamage: originalDamage,
                current: previewLive('pendingBonusDiceSettlement'),
                original: formalLive('pendingAttack'),
            };
    }

    const shouldShowDamage = Boolean(
        currentAttackDamage > 0
        || pendingAttack.damage !== undefined
        || confirmedBonusDamage > 0
    );

    return shouldShowDamage
        ? {
            currentDamage: currentAttackDamage,
            originalDamage,
            current: formalLive('pendingAttack'),
            original: formalLive('pendingAttack'),
        }
        : undefined;
}

export function getCurrentDamageSummary(state: DiceThroneCore): CurrentDamageSummary | undefined {
    const details = getCurrentDamageSummaryDetails(state);
    if (!details) return undefined;
    return {
        currentDamage: details.currentDamage,
        originalDamage: details.originalDamage,
    };
}
