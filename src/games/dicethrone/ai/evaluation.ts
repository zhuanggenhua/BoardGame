import type { MatchState, PlayerId } from '../../../engine/types';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, PendingDamage } from '../domain/types';

export type DiceThroneBoardEvaluationBreakdown = {
    lifeSafety: number;
    damageRace: number;
    resourceEconomy: number;
    upgradeEngine: number;
    statusAndTokens: number;
    dicePlan: number;
    phaseTempo: number;
};

export type DiceThroneBoardEvaluation = {
    total: number;
    breakdown: DiceThroneBoardEvaluationBreakdown;
};

type DiceThroneState = MatchState<DiceThroneCore>;

const sumStacks = (values: Record<string, number> | undefined): number => {
    if (!values) return 0;
    return Object.values(values).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
};

const countOpponentHp = (state: DiceThroneState, playerId: PlayerId): { total: number; count: number; lowest: number } => {
    let total = 0;
    let count = 0;
    let lowest = Number.POSITIVE_INFINITY;

    for (const [candidateId, player] of Object.entries(state.core.players)) {
        if (candidateId === playerId) continue;
        const hp = player.resources[RESOURCE_IDS.HP] ?? 0;
        total += hp;
        count += 1;
        lowest = Math.min(lowest, hp);
    }

    return {
        total,
        count,
        lowest: Number.isFinite(lowest) ? lowest : 0,
    };
};

export const evaluateDiceThroneBoardState = (
    state: DiceThroneState,
    playerId: PlayerId,
): DiceThroneBoardEvaluation => {
    const self = state.core.players[playerId];
    if (!self) {
        return {
            total: 0,
            breakdown: {
                lifeSafety: 0,
                damageRace: 0,
                resourceEconomy: 0,
                upgradeEngine: 0,
                statusAndTokens: 0,
                dicePlan: 0,
                phaseTempo: 0,
            },
        };
    }

    const opponentHp = countOpponentHp(state, playerId);
    const opponentDivisor = Math.max(1, opponentHp.count);
    const ownHp = self.resources[RESOURCE_IDS.HP] ?? 0;
    const ownCp = self.resources[RESOURCE_IDS.CP] ?? 0;
    const pendingDamage = state.core.pendingDamage as PendingDamage | undefined;
    const incomingDamage = pendingDamage?.targetPlayerId === playerId
        ? pendingDamage.currentDamage ?? 0
        : 0;
    const pendingAttack = state.core.pendingAttack;
    const outgoingPressure = pendingAttack?.attackerId === playerId
        ? (pendingAttack.damage ?? 0) + (pendingAttack.bonusDamage ?? 0) + (pendingAttack.attackModifierBonusDamage ?? 0)
        : 0;
    const lethalIncoming = ownHp > 0 && incomingDamage >= ownHp;
    const shields = self.damageShields.reduce((sum, shield) => sum + Math.max(0, shield.value ?? 0), 0);
    const tokenStacks = sumStacks(self.tokens as Record<string, number>);
    const statusStacks = sumStacks(self.statusEffects);
    const upgradeCount = Object.keys(self.upgradeCardByAbilityId ?? {}).length;
    const phase = state.sys.phase;
    const canStillUseDice = phase === 'offensiveRoll' || phase === 'defensiveRoll';
    const remainingRolls = canStillUseDice
        ? Math.max(0, state.core.rollLimit - state.core.rollCount)
        : 0;

    const breakdown: DiceThroneBoardEvaluationBreakdown = {
        lifeSafety: (
            ownHp * 7
            - incomingDamage * (lethalIncoming ? 18 : 8)
            + shields * 4
            + tokenStacks * 2
        ),
        damageRace: (
            (30 - opponentHp.total / opponentDivisor) * 4
            + outgoingPressure * 6
            + (opponentHp.lowest > 0 && outgoingPressure >= opponentHp.lowest ? 80 : 0)
        ),
        resourceEconomy: ownCp * 4 + self.hand.length * 7,
        upgradeEngine: upgradeCount * 18,
        statusAndTokens: tokenStacks * 3 - statusStacks * 10,
        dicePlan: canStillUseDice
            ? state.core.dice.filter((die) => die.isKept).length * 7 + remainingRolls * 9
            : 0,
        phaseTempo: phase === 'main1' || phase === 'main2'
            ? Math.max(0, self.hand.length - 2) * 3
            : 0,
    };

    const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    return {
        total: Number(total.toFixed(3)),
        breakdown,
    };
};
