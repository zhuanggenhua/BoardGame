import type { ValidationResult } from '../../../engine/types';
import type { ActionCardDef, FusionCardDef, PlayConstraint, SmashUpCore } from './types';
import { getCardDef, getFusionDef, getMinionDef, getMinionLikePower } from '../data/cards';
import { hasPlayerTurnRestriction, isOperationRestricted } from './ongoingEffects';
import { getPlayerEffectivePowerOnBase } from './ongoingModifiers';
import {
    actionLikeNeedsPlayBase,
    actionLikeNeedsPlayMinion,
    actionLikePlayTargetMinionController,
    canUseBaseLimitedMinionQuota,
    canUseSameNameMinionQuota,
    getActionLikeResponseWindowTiming,
    getMaxRemainingBaseLimitedPowerQuota,
    getMaxRemainingGlobalPowerLimitedQuota,
    getRemainingGlobalPowerLimitedMinionQuotas,
    getRemainingUnrestrictedGlobalMinionQuota,
    isCardMinionLike,
    mustUseBaseLimitedMinionQuota,
    mustUseGlobalPowerLimitedMinionQuota,
} from './utils';

function isCurrentTurnPlayer(core: SmashUpCore, playerId: string): boolean {
    return core.turnOrder[core.currentPlayerIndex] === playerId;
}

export function getMinionPlayRestrictionError(core: SmashUpCore, playerId: string): string | null {
    if (
        hasPlayerTurnRestriction(core, playerId, 'play_minion')
        || (isCurrentTurnPlayer(core, playerId) && core.sleepMarkedPlayers?.includes(playerId))
    ) {
        return '当前效果禁止你打出随从';
    }
    return null;
}

export function getActionPlayRestrictionError(core: SmashUpCore, playerId: string, defId?: string): string | null {
    if (
        hasPlayerTurnRestriction(core, playerId, 'play_action')
        || (isCurrentTurnPlayer(core, playerId) && core.sleepMarkedPlayers?.includes(playerId))
    ) {
        return '当前效果禁止你打出战术';
    }
    if (defId && core.blockedActionDefIdsThisTurn?.[playerId]?.includes(defId)) {
        const name = getCardDef(defId)?.name ?? defId;
        return `本回合不能再打出${name}`;
    }
    return null;
}

export function validateConsumableMinionQuota(
    core: SmashUpCore,
    playerId: string,
    baseIndex: number,
    cardDefId: string,
    basePower: number,
): ValidationResult {
    const player = core.players[playerId];
    if (!player) return { valid: false, error: '玩家不存在' };

    const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
    if (globalQuotaRemaining > 0) {
        if (mustUseGlobalPowerLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) {
            const maxAllowedPower = getMaxRemainingGlobalPowerLimitedQuota(player);
            if (maxAllowedPower !== undefined && basePower > maxAllowedPower) {
                return { valid: false, error: `额外出牌只能打出力量≤${maxAllowedPower}的随从` };
            }
        }
        return { valid: true };
    }

    if (canUseSameNameMinionQuota(player, cardDefId)) {
        return { valid: true };
    }

    if (mustUseBaseLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) {
        if (!canUseBaseLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) {
            const maxAllowedPower = getMaxRemainingBaseLimitedPowerQuota(player, baseIndex);
            if (maxAllowedPower !== undefined && basePower > maxAllowedPower) {
                return { valid: false, error: `额外出牌只能打出力量≤${maxAllowedPower}的随从` };
            }
            return { valid: false, error: '该基地禁止打出该随从' };
        }
        return { valid: true };
    }

    return { valid: false, error: '本回合随从额度已用完' };
}

export function validateDiscardMinionPlaySemantics(
    core: SmashUpCore,
    playerId: string,
    params: {
        cardUid: string;
        baseIndex: number;
        consumesNormalLimit: boolean;
    },
): ValidationResult {
    const player = core.players[playerId];
    if (!player) return { valid: false, error: '玩家不存在' };

    const { cardUid, baseIndex, consumesNormalLimit } = params;
    if (baseIndex < 0 || baseIndex >= core.bases.length) {
        return { valid: false, error: '无效的基地索引' };
    }

    const discardCard = player.discard.find(card => card.uid === cardUid);
    if (!discardCard || !isCardMinionLike(discardCard)) {
        return { valid: false, error: '弃牌堆中没有该随从' };
    }

    const basePower = getMinionLikePower(discardCard.defId) ?? 0;
    if (consumesNormalLimit) {
        const quotaValidation = validateConsumableMinionQuota(
            core,
            playerId,
            baseIndex,
            discardCard.defId,
            basePower,
        );
        if (!quotaValidation.valid) return quotaValidation;

        const remainingRestrictedGlobalCaps = getRemainingGlobalPowerLimitedMinionQuotas(player);
        const unrestrictedGlobalQuotaRemaining = getRemainingUnrestrictedGlobalMinionQuota(player);
        const maxRestrictedGlobalPower = getMaxRemainingGlobalPowerLimitedQuota(player);
        if (
            remainingRestrictedGlobalCaps.length > 0
            && unrestrictedGlobalQuotaRemaining > 0
            && maxRestrictedGlobalPower !== undefined
            && basePower > maxRestrictedGlobalPower
        ) {
            return { valid: false, error: `额外出牌只能打出力量≤${maxRestrictedGlobalPower}的随从` };
        }
    }

    const usesBaseLimitedMinionQuota = consumesNormalLimit
        && mustUseBaseLimitedMinionQuota(core, player, baseIndex, discardCard.defId, basePower);

    if (isOperationRestricted(core, baseIndex, playerId, 'play_minion', {
        minionDefId: discardCard.defId,
        basePower,
        usesBaseLimitedMinionQuota,
    })) {
        return { valid: false, error: '该基地禁止打出该随从' };
    }

    return { valid: true };
}

export function validateImmediateHandExtraMinionPlaySemantics(
    core: SmashUpCore,
    playerId: string,
    params: {
        cardUid: string;
        baseIndex: number;
    },
): ValidationResult {
    const restrictionError = getMinionPlayRestrictionError(core, playerId);
    if (restrictionError) {
        return { valid: false, error: restrictionError };
    }

    const player = core.players[playerId];
    if (!player) return { valid: false, error: '玩家不存在' };

    const { cardUid, baseIndex } = params;
    if (baseIndex < 0 || baseIndex >= core.bases.length) {
        return { valid: false, error: '无效的基地索引' };
    }

    const handCard = player.hand.find(card => card.uid === cardUid);
    if (!handCard || !isCardMinionLike(handCard)) {
        return { valid: false, error: '手牌中没有该随从' };
    }

    const basePower = getMinionLikePower(handCard.defId) ?? 0;
    if (isOperationRestricted(core, baseIndex, playerId, 'play_minion', {
        minionDefId: handCard.defId,
        basePower,
        usesBaseLimitedMinionQuota: false,
        cardUid: handCard.uid,
        fromDiscard: false,
    })) {
        return { valid: false, error: '该基地禁止打出该随从' };
    }

    return { valid: true };
}

export function validateDeckTopRegularMinionPlaySemantics(
    core: SmashUpCore,
    playerId: string,
    params: {
        baseIndex: number;
        cardUid?: string;
        defId: string;
    },
): ValidationResult {
    const restrictionError = getMinionPlayRestrictionError(core, playerId);
    if (restrictionError) {
        return { valid: false, error: restrictionError };
    }

    const player = core.players[playerId];
    if (!player) return { valid: false, error: '玩家不存在' };

    const { baseIndex, cardUid, defId } = params;
    if (baseIndex < 0 || baseIndex >= core.bases.length) {
        return { valid: false, error: '无效的基地索引' };
    }

    if (player.minionsPlayed >= player.minionLimit) {
        return { valid: false, error: '本回合随从额度已用完' };
    }

    const deckTopCard = player.deck[0];
    if (!deckTopCard || !isCardMinionLike(deckTopCard)) {
        return { valid: false, error: '牌库顶没有可打出的随从' };
    }
    if (cardUid && deckTopCard.uid !== cardUid) {
        return { valid: false, error: '指定卡牌不在牌库顶' };
    }
    if (deckTopCard.defId !== defId) {
        return { valid: false, error: '牌库顶卡牌与能力要求不一致' };
    }

    const minionDef = getMinionDef(deckTopCard.defId);
    const fusionDef = getFusionDef(deckTopCard.defId);
    const basePower = getMinionLikePower(deckTopCard.defId) ?? 0;

    if (isOperationRestricted(core, baseIndex, playerId, 'play_minion', {
        minionDefId: deckTopCard.defId,
        basePower,
        usesBaseLimitedMinionQuota: false,
        cardUid: deckTopCard.uid,
        fromDiscard: false,
    })) {
        return { valid: false, error: '该基地禁止打出该随从' };
    }

    const constraint = minionDef?.playConstraint ?? fusionDef?.minionPlayConstraint;
    if (constraint) {
        const constraintError = checkPlayConstraint(constraint, core, baseIndex, playerId);
        if (constraintError) return { valid: false, error: constraintError };
    }

    return { valid: true };
}

export function validateActionPlaySemantics(
    core: SmashUpCore,
    playerId: string,
    params: {
        defId: string;
        targetBaseIndex?: number;
        targetMinionUid?: string;
        effectiveHandSize?: number;
    },
): ValidationResult {
    const restrictionError = getActionPlayRestrictionError(core, playerId, params.defId);
    if (restrictionError) {
        return { valid: false, error: restrictionError };
    }

    const def = getCardDef(params.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!def) return { valid: false, error: '卡牌定义不存在' };

    const subtype = (def as any).type === 'fusion'
        ? (def as FusionCardDef).actionSubtype
        : (def as ActionCardDef).subtype;
    if (subtype === 'special') {
        const cardTiming = getActionLikeResponseWindowTiming(def);
        if (cardTiming === 'beforeScoring') {
            return { valid: false, error: '该特殊行动卡只能在基地计分前的响应窗口中打出' };
        }
        if (cardTiming === 'afterScoring') {
            return { valid: false, error: '该特殊行动卡只能在基地计分后的响应窗口中打出' };
        }
        return { valid: false, error: '该特殊行动卡不能作为普通行动主动打出' };
    }

    const targetBaseIndex = params.targetBaseIndex;
    if (actionLikeNeedsPlayMinion(def)) {
        if (!params.targetMinionUid) {
            return { valid: false, error: '该行动卡需要选择目标随从' };
        }
        if (typeof targetBaseIndex !== 'number' || !Number.isInteger(targetBaseIndex)) {
            return { valid: false, error: '该行动卡需要选择目标基地' };
        }
        const targetMinion = core.bases[targetBaseIndex]?.minions.find(minion => minion.uid === params.targetMinionUid);
        if (!targetMinion) {
            return { valid: false, error: '基地上没有该随从' };
        }
        const controllerConstraint = actionLikePlayTargetMinionController(def);
        if (controllerConstraint === 'self' && targetMinion.controller !== playerId) {
            return { valid: false, error: '该行动卡需要选择你的随从' };
        }
        if (controllerConstraint === 'opponent' && targetMinion.controller === playerId) {
            return { valid: false, error: '该行动卡需要选择其他玩家的随从' };
        }
    }

    if (actionLikeNeedsPlayBase(def)) {
        if (typeof targetBaseIndex !== 'number' || !Number.isInteger(targetBaseIndex)) {
            return { valid: false, error: '该行动卡需要选择目标基地' };
        }
        if (targetBaseIndex < 0 || targetBaseIndex >= core.bases.length) {
            return { valid: false, error: '无效的基地索引' };
        }
    }

    if (subtype === 'ongoing') {
        if (typeof targetBaseIndex !== 'number' || !Number.isInteger(targetBaseIndex)) {
            return { valid: false, error: '持续行动卡需要选择目标基地' };
        }
        if (targetBaseIndex < 0 || targetBaseIndex >= core.bases.length) {
            return { valid: false, error: '无效的基地索引' };
        }

        const ongoingTarget = (def as any).type === 'fusion'
            ? ((def as FusionCardDef).actionOngoingTarget ?? 'base')
            : (((def as ActionCardDef).ongoingTarget ?? 'base'));
        if (ongoingTarget === 'minion') {
            if (!params.targetMinionUid) {
                return { valid: false, error: '该持续行动卡需要选择目标随从' };
            }
            const targetMinion = core.bases[targetBaseIndex].minions.find(
                minion => minion.uid === params.targetMinionUid,
            );
            if (!targetMinion) {
                return { valid: false, error: '基地上没有该随从' };
            }
            const controllerConstraint = actionLikePlayTargetMinionController(def);
            if (controllerConstraint === 'self' && targetMinion.controller !== playerId) {
                return { valid: false, error: '该行动卡需要选择你的随从' };
            }
            if (controllerConstraint === 'opponent' && targetMinion.controller === playerId) {
                return { valid: false, error: '该行动卡需要选择其他玩家的随从' };
            }
        } else if (params.targetMinionUid !== undefined) {
            return { valid: false, error: '该持续行动卡不需要选择随从目标' };
        }

        const playConstraint = (def as any).type === 'fusion'
            ? (def as FusionCardDef).actionPlayConstraint
            : (def as ActionCardDef).playConstraint;
        if (playConstraint) {
            const constraintError = checkPlayConstraint(
                playConstraint,
                core,
                targetBaseIndex,
                playerId,
                params.effectiveHandSize,
            );
            if (constraintError) {
                return { valid: false, error: constraintError };
            }
        }
    }

    if (typeof targetBaseIndex === 'number') {
        const ongoingTarget = def.ongoingTarget ?? 'base';
        if (ongoingTarget === 'base' && isOperationRestricted(core, targetBaseIndex, playerId, 'play_action')) {
            return { valid: false, error: '该基地禁止打出行动卡' };
        }
    }

    return { valid: true };
}

export type ActionPlayTargetMode = 'none' | 'base' | 'minion';

export interface LegalActionPlayTargets {
    mode: ActionPlayTargetMode;
    baseIndices: number[];
    minionUids: string[];
    firstError: string | null;
}

export function getActionPlayTargetMode(def: ActionCardDef | FusionCardDef): ActionPlayTargetMode {
    const subtype = (def as any).type === 'fusion'
        ? (def as FusionCardDef).actionSubtype
        : (def as ActionCardDef).subtype;

    if (subtype === 'ongoing') {
        const ongoingTarget = (def as any).type === 'fusion'
            ? ((def as FusionCardDef).actionOngoingTarget ?? 'base')
            : ((def as ActionCardDef).ongoingTarget ?? 'base');
        return ongoingTarget === 'minion' ? 'minion' : 'base';
    }

    if (actionLikeNeedsPlayMinion(def)) return 'minion';
    if (actionLikeNeedsPlayBase(def)) return 'base';
    return 'none';
}

export function collectLegalActionPlayTargets(
    core: SmashUpCore,
    playerId: string,
    params: {
        defId: string;
        effectiveHandSize?: number;
    },
): LegalActionPlayTargets {
    const def = getCardDef(params.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!def) {
        return { mode: 'none', baseIndices: [], minionUids: [], firstError: '卡牌定义不存在' };
    }

    const mode = getActionPlayTargetMode(def);
    const baseIndices: number[] = [];
    const minionUids: string[] = [];
    let firstError: string | null = null;

    if (mode === 'none') {
        const validation = validateActionPlaySemantics(core, playerId, params);
        return {
            mode,
            baseIndices,
            minionUids,
            firstError: validation.valid ? null : validation.error ?? null,
        };
    }

    if (mode === 'base') {
        for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
            const validation = validateActionPlaySemantics(core, playerId, {
                ...params,
                targetBaseIndex: baseIndex,
            });
            if (validation.valid) {
                baseIndices.push(baseIndex);
            } else if (!firstError && validation.error) {
                firstError = validation.error;
            }
        }
        return { mode, baseIndices, minionUids, firstError };
    }

    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        let hasLegalMinionOnBase = false;
        for (const minion of core.bases[baseIndex].minions) {
            const validation = validateActionPlaySemantics(core, playerId, {
                ...params,
                targetBaseIndex: baseIndex,
                targetMinionUid: minion.uid,
            });
            if (validation.valid) {
                hasLegalMinionOnBase = true;
                minionUids.push(minion.uid);
            } else if (!firstError && validation.error) {
                firstError = validation.error;
            }
        }
        if (hasLegalMinionOnBase) {
            baseIndices.push(baseIndex);
        }
    }

    return { mode, baseIndices, minionUids, firstError };
}

export function checkPlayConstraint(
    constraint: PlayConstraint,
    core: SmashUpCore,
    baseIndex: number,
    playerId: string,
    effectiveHandSize?: number,
): string | null {
    if (constraint === 'requireOwnMinion') {
        const hasOwnMinion = core.bases[baseIndex].minions.some(minion => minion.controller === playerId);
        if (!hasOwnMinion) return '目标基地上必须有你的随从';
        return null;
    }

    if (constraint === 'requireNoCharacters') {
        const hasCharacters = core.bases[baseIndex].minions.length > 0;
        if (hasCharacters) return '目标基地上不能有任何角色';
        return null;
    }

    if (constraint === 'onlyCardInHand') {
        const handSize = effectiveHandSize ?? (core.players[playerId]?.hand.length ?? 0);
        if (handSize !== 1) return '只能在本卡是你的唯一手牌时打出';
        return null;
    }

    if (constraint === 'requireNoOwnActionsOnBase') {
        const hasOwnAction = core.bases[baseIndex].ongoingActions.some(action => action.ownerId === playerId);
        if (hasOwnAction) return '只能打到你没有行动牌的基地';
        return null;
    }

    if (typeof constraint === 'object' && constraint.type === 'requireOwnPower') {
        const base = core.bases[baseIndex];
        const myPower = getPlayerEffectivePowerOnBase(core, base, baseIndex, playerId);
        if (myPower < constraint.minPower) {
            return `只能打到你至少拥有 ${constraint.minPower} 点力量的基地`;
        }
        return null;
    }

    return null;
}
