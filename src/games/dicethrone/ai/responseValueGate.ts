import type { MatchState, PlayerId } from '../../../engine/types';
import { findPlayerAbility, getPlayerAbilityRuleDamageEstimate, getPlayerAbilityEffects } from '../domain/abilityLookup';
import { getCustomActionMeta } from '../domain/effects';
import { RESOURCE_IDS } from '../domain/resources';
import { getRollerId } from '../domain/rules';
import type { DiceThroneCore, TurnPhase } from '../domain/types';

type DiceThroneState = MatchState<DiceThroneCore>;

export type DiceThreatSummary = {
    abilityId: string | null;
    value: number;
    damage: number;
    lethal: boolean;
    ultimate: boolean;
    highDamage: boolean;
    strongEffect: boolean;
    lowValueAttack: boolean;
    reasons: string[];
};

export type DiceInterferenceProjectionLike = {
    score: number;
    rawDelta: number;
    planDelta: number;
    currentPlanId: string | null;
    projectedPlanId: string | null;
};

export type DiceInterferenceResponseGate = {
    score: number;
    shouldSpend: boolean;
    reason: string;
    currentThreat: DiceThreatSummary;
    projectedThreat: DiceThreatSummary;
    preventedValue: number;
};

const EMPTY_THREAT: DiceThreatSummary = {
    abilityId: null,
    value: 0,
    damage: 0,
    lethal: false,
    ultimate: false,
    highDamage: false,
    strongEffect: false,
    lowValueAttack: true,
    reasons: ['没有明确可阻止技能'],
};

const addEffectValue = (state: DiceThroneState, playerId: PlayerId, abilityId: string): { value: number; strong: boolean; reasons: string[] } => {
    let value = 0;
    let strong = false;
    const reasons: string[] = [];

    for (const effect of getPlayerAbilityEffects(state.core, playerId, abilityId)) {
        const action = effect.action;
        if (!action) continue;

        if (action.type === 'grantStatus' && action.target === 'opponent') {
            const stacks = Math.max(1, action.value ?? 1);
            value += 42 * stacks;
            strong = true;
            reasons.push('强状态');
        }
        if (action.type === 'grantToken' && action.target === 'self') {
            const stacks = Math.max(1, action.value ?? 1);
            value += 14 * stacks;
            if (stacks >= 2) strong = true;
            reasons.push('关键 token');
        }
        if (action.type === 'heal' && action.target === 'self') {
            value += Math.max(0, action.value ?? 0) * 15;
            reasons.push('回血');
        }
        if (action.type === 'custom' && action.customActionId) {
            const meta = getCustomActionMeta(action.customActionId);
            if (meta?.categories.includes('damage')) {
                value += 35;
                reasons.push('动态伤害');
            }
            if (meta?.categories.includes('status')) {
                value += 45;
                strong = true;
                reasons.push('强状态');
            }
            if (meta?.categories.includes('resource') || meta?.categories.includes('token')) {
                value += 25;
                reasons.push('资源/token');
            }
        }
    }

    return { value, strong, reasons };
};

export const evaluateDiceThroneAbilityThreat = (
    state: DiceThroneState,
    abilityOwnerId: PlayerId,
    defenderId: PlayerId,
    abilityId: string | null | undefined,
): DiceThreatSummary => {
    if (!abilityId) return EMPTY_THREAT;

    const match = findPlayerAbility(state.core, abilityOwnerId, abilityId);
    if (!match) return { ...EMPTY_THREAT, abilityId };

    const defenderHp = state.core.players[defenderId]?.resources[RESOURCE_IDS.HP] ?? 0;
    const damage = getPlayerAbilityRuleDamageEstimate(state.core, abilityOwnerId, abilityId);
    const effect = addEffectValue(state, abilityOwnerId, abilityId);
    const ultimate = Boolean(match.ability.tags?.includes('ultimate') || match.variant?.tags?.includes('ultimate'));
    const lethal = defenderHp > 0 && damage >= defenderHp;
    const highDamage = damage >= 8;
    const value = damage * 32
        + effect.value
        + (ultimate ? 180 : 0)
        + (lethal ? 220 : 0)
        + (highDamage ? 55 : 0);
    const strongEffect = effect.strong || ultimate || lethal || highDamage;
    const lowValueAttack = damage <= 4 && !strongEffect && effect.value <= 0;

    return {
        abilityId,
        value,
        damage,
        lethal,
        ultimate,
        highDamage,
        strongEffect,
        lowValueAttack,
        reasons: [
            ...(ultimate ? ['大招'] : []),
            ...(lethal ? ['斩杀'] : []),
            ...(highDamage ? ['高伤害'] : []),
            ...effect.reasons,
            ...(lowValueAttack ? ['普攻/低价值攻击'] : []),
        ],
    };
};

export const assessDiceThroneDiceInterferenceResponseGate = (args: {
    state: DiceThroneState;
    responderId: PlayerId;
    phase: TurnPhase;
    targetOpponentDice: boolean;
    projection: DiceInterferenceProjectionLike | null;
    fallbackDelta: number;
    cardCpCost: number;
}): DiceInterferenceResponseGate | null => {
    const windowType = args.state.sys.responseWindow?.current?.windowType;
    if (!args.targetOpponentDice || windowType !== 'afterRollConfirmed') {
        return null;
    }

    const rollerId = getRollerId(args.state.core, args.phase);
    if (rollerId === args.responderId) {
        return null;
    }

    const currentThreat = evaluateDiceThroneAbilityThreat(
        args.state,
        rollerId,
        args.responderId,
        args.projection?.currentPlanId,
    );
    const projectedThreat = evaluateDiceThroneAbilityThreat(
        args.state,
        rollerId,
        args.responderId,
        args.projection?.projectedPlanId,
    );
    const preventedValue = Math.max(
        0,
        currentThreat.value - projectedThreat.value,
        args.projection?.planDelta ?? 0,
        args.fallbackDelta * 24,
    );
    const opportunityCost = 95 + args.cardCpCost * 30;

    if (currentThreat.lowValueAttack) {
        return {
            score: -460 - args.cardCpCost * 35,
            shouldSpend: false,
            reason: `真人当前公开骰面只对应${currentThreat.reasons.join('、')}，这张响应牌不能阻止足够收益，跳过响应更好`,
            currentThreat,
            projectedThreat,
            preventedValue,
        };
    }

    if (currentThreat.lethal || currentThreat.ultimate || currentThreat.highDamage || currentThreat.strongEffect) {
        const score = Math.max(130, preventedValue * 0.85 + (currentThreat.lethal ? 180 : 0) + (currentThreat.ultimate ? 140 : 0));
        return {
            score,
            shouldSpend: true,
            reason: `这张响应牌可尝试阻止${currentThreat.reasons.join('、')}，收益足以覆盖机会成本`,
            currentThreat,
            projectedThreat,
            preventedValue,
        };
    }

    if (preventedValue < opportunityCost) {
        return {
            score: -260 - args.cardCpCost * 25,
            shouldSpend: false,
            reason: '这张响应牌只能制造小幅骰面干扰，未达到花牌机会成本',
            currentThreat,
            projectedThreat,
            preventedValue,
        };
    }

    return {
        score: Math.max(35, preventedValue * 0.45),
        shouldSpend: true,
        reason: '这张响应牌能实质降低对手公开技能收益',
        currentThreat,
        projectedThreat,
        preventedValue,
    };
};
