import type { ValidationResult } from '../../../engine/types';
import type { ActionCardDef, FusionCardDef, PlayConstraint, SmashUpCore } from './types';
import { getCardDef, getFusionDef, getMinionDef, getMinionLikePower } from '../data/cards';
import { hasPlayerTurnRestriction, isOperationRestricted } from './ongoingEffects';
import { getPlayerEffectivePowerOnBase } from './ongoingModifiers';
import { mustUseBaseLimitedMinionQuota } from './utils';
import { isCardMinionLike } from './utils';

function isCurrentTurnPlayer(core: SmashUpCore, playerId: string): boolean {
    return core.turnOrder[core.currentPlayerIndex] === playerId;
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

    if (consumesNormalLimit && player.minionsPlayed >= player.minionLimit) {
        return { valid: false, error: '本回合随从额度已用完' };
    }

    const discardCard = player.discard.find(card => card.uid === cardUid);
    if (!discardCard || !isCardMinionLike(discardCard)) {
        return { valid: false, error: '弃牌堆中没有该随从' };
    }

    const basePower = getMinionLikePower(discardCard.defId) ?? 0;
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

export function validateDeckTopRegularMinionPlaySemantics(
    core: SmashUpCore,
    playerId: string,
    params: {
        baseIndex: number;
        cardUid?: string;
        defId: string;
    },
): ValidationResult {
    if (
        hasPlayerTurnRestriction(core, playerId, 'play_minion')
        || (isCurrentTurnPlayer(core, playerId) && core.sleepMarkedPlayers?.includes(playerId))
    ) {
        return { valid: false, error: '当前效果禁止你打出随从' };
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
    if (
        hasPlayerTurnRestriction(core, playerId, 'play_action')
        || (isCurrentTurnPlayer(core, playerId) && core.sleepMarkedPlayers?.includes(playerId))
    ) {
        return { valid: false, error: '当前效果禁止你打出战术' };
    }

    const def = getCardDef(params.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!def) return { valid: false, error: '卡牌定义不存在' };

    const subtype = (def as any).type === 'fusion'
        ? (def as FusionCardDef).actionSubtype
        : (def as ActionCardDef).subtype;
    if (subtype === 'special') {
        const cardTiming = (def as any).type === 'fusion'
            ? ((def as FusionCardDef).actionSpecialTiming ?? 'beforeScoring')
            : ((def as ActionCardDef).specialTiming ?? 'beforeScoring');
        if (cardTiming === 'beforeScoring') {
            return { valid: false, error: '该特殊行动卡只能在基地计分前的响应窗口中打出' };
        }
        return { valid: false, error: '该特殊行动卡只能在基地计分后的响应窗口中打出' };
    }

    const targetBaseIndex = params.targetBaseIndex;
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

    if (constraint === 'onlyCardInHand') {
        const handSize = effectiveHandSize ?? (core.players[playerId]?.hand.length ?? 0);
        if (handSize !== 1) return '只能在本卡是你的唯一手牌时打出';
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
