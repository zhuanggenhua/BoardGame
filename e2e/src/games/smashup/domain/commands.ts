/**
 * 大杀四方 (Smash Up) - 命令验证
 */

import type { MatchState, ValidationResult } from '../../../engine/types';
import type { SmashUpCommand, SmashUpCore, ActionCardDef, FusionCardDef, PlayConstraint } from './types';
import { SU_COMMANDS, getCurrentPlayerId, HAND_LIMIT } from './types';
import { getCardDef, getFusionDef, getMinionDef, getMinionLikePower, getTitanDef } from '../data/cards';
import { isOperationRestricted } from './ongoingEffects';
import {
    getScoringEligibleBaseIndices,
    getPlayerEffectivePowerOnBase,
} from './ongoingModifiers';
import { canPlayFromDiscard } from './discardPlayability';
import { getTitanByUid, isSpecialLimitBlocked } from './abilityHelpers';
import { canUseActiveBaseAbility, getActiveBaseAbilityOptions, hasActiveBaseAbility } from './baseAbilities';
import { getActionPlayRestrictionError, getMinionPlayRestrictionError, validateActionPlaySemantics } from './playLegality';
import { resolveOngoingActivation, resolveSpecial, resolveTalent } from './abilityRegistry';
import { validateTitanOngoingActivation, validateTitanSpecialActivation, validateTitanTalentUse } from './titanAbilityValidators';
import {
    actionLikeNeedsResponseWindowBase,
    getActionLikeResponseWindowTiming,
    canUseBaseLimitedMinionQuota,
    canUseSameNameMinionQuota,
    getMaxRemainingBaseLimitedPowerQuota,
    getMaxRemainingGlobalPowerLimitedQuota,
    isSameNameDefId,
    mustUseBaseLimitedMinionQuota,
    mustUseGlobalPowerLimitedMinionQuota,
} from './utils';
import { isCardActionLike, isCardMinionLike } from './utils';
import { getSmashUpReactionWindowContext, hasBlockingLegacyResponseWindow } from './reactionWindowState';

type TitanAbilityKind = 'special' | 'talent' | 'ongoing';

function resolveTitanAbilityLabel(kind: TitanAbilityKind): string {
    switch (kind) {
        case 'special':
            return '特殊能力';
        case 'talent':
            return '天赋能力';
        case 'ongoing':
            return '持续能力';
        default:
            return '能力';
    }
}

function validateTitanAbility(
    state: MatchState<SmashUpCore>,
    command: { playerId: string; payload: { titanUid?: string; baseIndex: number } },
    kind: TitanAbilityKind,
): ValidationResult {
    const core = state.core;
    const { titanUid, baseIndex } = command.payload;
    if (!titanUid) return { valid: false, error: '必须指定泰坦' };
    if (baseIndex < 0 || baseIndex >= core.bases.length) {
        return { valid: false, error: '无效的基地索引' };
    }

    const titan = getTitanByUid(core, titanUid);
    if (!titan) return { valid: false, error: '该泰坦不存在' };

    const titanDef = getTitanDef(titan.defId);
    if (!titanDef) return { valid: false, error: '泰坦定义不存在' };

    const abilityLabel = resolveTitanAbilityLabel(kind);
    if (!titanDef.abilityTags?.includes(kind)) {
        return { valid: false, error: `该泰坦没有${abilityLabel}` };
    }
    if (titanDef.activatableAbilityKinds && !titanDef.activatableAbilityKinds.includes(kind)) {
        return { valid: false, error: `该泰坦的${abilityLabel}不能手动激活` };
    }

    if (kind === 'special') {
        if (!resolveSpecial(titan.defId)) {
            return { valid: false, error: '该泰坦的特殊能力不能手动激活' };
        }
        if (titan.location.zone !== 'setaside') {
            return { valid: false, error: '该泰坦当前不在牌库旁' };
        }
        if (titan.ownerId !== command.playerId) {
            return { valid: false, error: '只能激活自己拥有的泰坦特殊能力' };
        }
    } else {
        if (titan.location.zone !== 'base') {
            return { valid: false, error: '该泰坦当前不在场' };
        }
        if (titan.controllerId !== command.playerId) {
            return { valid: false, error: `只能使用自己控制的泰坦${abilityLabel}` };
        }
    }

    if (kind === 'talent' && !resolveTalent(titan.defId)) {
        return { valid: false, error: '该泰坦的天赋不能手动激活' };
    }
    if (kind === 'ongoing' && !resolveOngoingActivation(titan.defId)) {
        return { valid: false, error: '该泰坦的持续能力不能手动激活' };
    }
    if (kind === 'ongoing' && (core.titanOngoingSuppressedUntilTurnEnd ?? []).includes(titan.uid)) {
        return { valid: false, error: '该泰坦的持续能力已被压制' };
    }

    const ctx = { state: core, playerId: command.playerId, titan, titanDef, baseIndex };
    const error = kind === 'special'
        ? validateTitanSpecialActivation(ctx)
        : kind === 'talent'
            ? validateTitanTalentUse(ctx)
            : validateTitanOngoingActivation(ctx);
    return error ? { valid: false, error } : { valid: true };
}

function hasActiveBearNecessitiesPodRestriction(core: SmashUpCore, playerId: string): boolean {
    for (const base of core.bases) {
        const hasPlayerMinion = base.minions.some(minion => minion.controller === playerId);
        if (!hasPlayerMinion) continue;
        const hasOpponentActivePod = base.ongoingActions.some(ongoing =>
            ongoing.defId === 'bear_cavalry_bear_necessities_pod'
            && ongoing.ownerId !== playerId
            && ongoing.talentUsed === true,
        );
        if (hasOpponentActivePod) return true;
    }
    return false;
}

function isExtraMinionPlayAttempt(
    core: SmashUpCore,
    playerId: string,
    baseIndex: number,
    cardDefId: string,
    basePower: number,
    fromDiscard: boolean,
    consumesNormalLimit: boolean,
): boolean {
    const player = core.players[playerId];
    if (!player) return false;
    const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
    if (fromDiscard && consumesNormalLimit === false) return true;
    if (player.minionsPlayed >= 1) return true;
    if (globalQuotaRemaining <= 0) {
        if (canUseBaseLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
        if (canUseSameNameMinionQuota(player, cardDefId)) return true;
    }
    if (mustUseBaseLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
    if (mustUseGlobalPowerLimitedMinionQuota(core, player, baseIndex, cardDefId, basePower)) return true;
    return false;
}

function isExtraActionPlayAttempt(core: SmashUpCore, playerId: string): boolean {
    const player = core.players[playerId];
    if (!player) return false;
    return player.actionsPlayed >= 1;
}

export function validate(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand
): ValidationResult {
    const core = state.core;
    const currentPlayerId = getCurrentPlayerId(core);
    const phase = state.sys.phase;
    const reactionWindow = getSmashUpReactionWindowContext(state);

    // 防御性检查：确保 command 和 type 存在
    if (!command || typeof command.type !== 'string') {
        return { valid: false, error: 'invalid_command_missing_type' };
    }

    // 系统命令（SYS_ 前缀）由引擎层处理，领域层直接放行
    if (command.type.startsWith('SYS_')) {
        return { valid: true };
    }

    switch (command.type) {
        case SU_COMMANDS.PLAY_MINION: {
            // meFirst 响应窗口期间：允许从手牌打出 beforeScoringPlayable 随从到即将计分的基地
            if (reactionWindow?.windowType === 'meFirst') {
                const currentResponderId = reactionWindow.activePlayerId;
                if (command.playerId !== currentResponderId) {
                    return { valid: false, error: '等待对方响应' };
                }
                const mfPlayer = core.players[command.playerId];
                if (!mfPlayer) return { valid: false, error: '玩家不存在' };
                const mfCard = mfPlayer.hand.find(c => c.uid === command.payload.cardUid);
                if (!mfCard) return { valid: false, error: '手牌中没有该卡牌' };
                if (!isCardMinionLike(mfCard)) return { valid: false, error: '该卡牌不是随从' };
                const mfDef = getMinionDef(mfCard.defId);
                const mfFusionDef = getFusionDef(mfCard.defId);
                if (!mfDef && !mfFusionDef) return { valid: false, error: '卡牌定义不存在' };
                if (!(mfDef?.beforeScoringPlayable || mfFusionDef?.minionBeforeScoringPlayable)) {
                    return { valid: false, error: '该随从不能在基地计分前打出' };
                }
                const mfBaseIndex = command.payload.baseIndex;
                if (mfBaseIndex < 0 || mfBaseIndex >= core.bases.length) {
                    return { valid: false, error: '无效的基地索引' };
                }
                const mfEligible = getScoringEligibleBaseIndices(core);
                if (!mfEligible.includes(mfBaseIndex)) {
                    return { valid: false, error: '只能打出到即将计分的基地' };
                }
                if (isSpecialLimitBlocked(core, mfCard.defId, mfBaseIndex)) {
                    return { valid: false, error: '该基地本回合已使用过同组特殊能力' };
                }
                return { valid: true };
            }

            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段打出随从' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };

            const { baseIndex, fromDiscard } = command.payload;
            if (baseIndex < 0 || baseIndex >= core.bases.length) {
                return { valid: false, error: '无效的基地索引' };
            }

            // 从弃牌堆打出：通过 discardPlayability 模块验证
            if (fromDiscard) {
                const discardCheck = canPlayFromDiscard(core, command.playerId, command.payload.cardUid, baseIndex);
                if (!discardCheck) {
                    return { valid: false, error: '该卡牌不能从弃牌堆打出到此基地' };
                }
                // 消耗正常额度的弃牌堆出牌需要检查额度
                if (discardCheck.consumesNormalLimit && player.minionsPlayed >= player.minionLimit) {
                    return { valid: false, error: '本回合随从额度已用完' };
                }
                // 限制检查
                const discardCard = player.discard.find(c => c.uid === command.payload.cardUid);
                if (!discardCard || !isCardMinionLike(discardCard)) {
                    return { valid: false, error: '弃牌堆中没有该随从' };
                }
                const basePower = getMinionLikePower(discardCard.defId) ?? 0;
                const blockedByBearNecessitiesPod = hasActiveBearNecessitiesPodRestriction(core, command.playerId)
                    && isExtraMinionPlayAttempt(
                        core,
                        command.playerId,
                        baseIndex,
                        discardCard.defId,
                        basePower,
                        true,
                        discardCheck.consumesNormalLimit,
                    );
                if (blockedByBearNecessitiesPod) {
                    return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
                }
                const usesBaseLimitedMinionQuota = discardCheck.consumesNormalLimit
                    && mustUseBaseLimitedMinionQuota(core, player, baseIndex, discardCard.defId, basePower);
                if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                    minionDefId: discardCard.defId,
                    basePower,
                    usesBaseLimitedMinionQuota,
                    cardUid: discardCard.uid,
                    fromDiscard: true,
                })) {
                    return { valid: false, error: '该基地禁止打出该随从' };
                }
                return { valid: true };
            }

            // 正常手牌打出：全局额度 + 同名额度 + 基地限定额度
            const baseQuota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
            const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
            const globalQuotaRemaining = player.minionLimit - player.minionsPlayed;
            if (globalQuotaRemaining <= 0 && sameNameRemaining <= 0 && baseQuota <= 0) {
                return { valid: false, error: '本回合随从额度已用完' };
            }
            const card = player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) return { valid: false, error: '手牌中没有该卡牌' };
            if (!isCardMinionLike(card)) return { valid: false, error: '该卡牌不是随从' };
            const minionDef = getMinionDef(card.defId);
            const fusionDef = getFusionDef(card.defId);
            const basePower = (minionDef?.power ?? fusionDef?.minionPower) ?? 0;
            const blockedByBearNecessitiesPod = hasActiveBearNecessitiesPodRestriction(core, command.playerId)
                && isExtraMinionPlayAttempt(
                    core,
                    command.playerId,
                    baseIndex,
                    card.defId,
                    basePower,
                    false,
                    true,
                );
            if (blockedByBearNecessitiesPod) {
                return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
            }
            const usesBaseLimitedMinionQuota = mustUseBaseLimitedMinionQuota(core, player, baseIndex, card.defId, basePower);
            // 同名额度检查：全局额度用完后，如果只剩同名额度，必须匹配已锁定的 defId
            if (globalQuotaRemaining <= 0 && sameNameRemaining > 0 && baseQuota <= 0) {
                // 已锁定 defId 时，只能打出同名随从
                if (
                    player.sameNameMinionDefId !== null
                    && player.sameNameMinionDefId !== undefined
                    && !isSameNameDefId(card.defId, player.sameNameMinionDefId)
                ) {
                    return { valid: false, error: '额外出牌只能打出同名随从' };
                }
            }
            // 基地限定同名额度检查：全局额度和全局同名额度都用完后，使用基地限定额度时检查同名约束
            if (usesBaseLimitedMinionQuota) {
                if (player.baseLimitedSameNameRequired?.[baseIndex]) {
                    // 必须与触发能力时的随从同名
                    const requiredDefId = player.baseLimitedSameNameDefId?.[baseIndex];
                    if (requiredDefId) {
                        if (!isSameNameDefId(card.defId, requiredDefId)) {
                            const requiredCard = getCardDef(requiredDefId);
                            const requiredName = requiredCard?.name ?? requiredDefId;
                            return { valid: false, error: `只能打出与触发能力的随从同名的随从（${requiredName}）` };
                        }
                    } else {
                        const hasSameNameOnBase = core.bases[baseIndex]?.minions.some(minion => isSameNameDefId(card.defId, minion.defId)) ?? false;
                        if (!hasSameNameOnBase) {
                            return { valid: false, error: '只能打出与该基地上某个随从同名的随从' };
                        }
                    }
                }
                if (!canUseBaseLimitedMinionQuota(core, player, baseIndex, card.defId, basePower)) {
                    const maxAllowedPower = getMaxRemainingBaseLimitedPowerQuota(player, baseIndex);
                    if (maxAllowedPower !== undefined && basePower > maxAllowedPower) {
                        return { valid: false, error: `额外出牌只能打出力量≤${maxAllowedPower}的随从` };
                    }
                    return { valid: false, error: '该基地禁止打出该随从' };
                }
            }
            // 全局力量限制检查：额外出牌机会可能有力量上限（如家园：力量≤2）
            if (mustUseGlobalPowerLimitedMinionQuota(core, player, baseIndex, card.defId, basePower)) {
                const maxAllowedPower = getMaxRemainingGlobalPowerLimitedQuota(player);
                if (maxAllowedPower !== undefined && basePower > maxAllowedPower) {
                    return { valid: false, error: `额外出牌只能打出力量≤${maxAllowedPower}的随从` };
                }
            }
            // 限制检查：是否禁止打出随从到此基地（包括基地效果和 ongoing 效果）
            if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                minionDefId: card.defId,
                basePower,
                usesBaseLimitedMinionQuota,
                cardUid: card.uid,
                fromDiscard: false,
            })) {
                return { valid: false, error: '该基地禁止打出该随从' };
            }
            // 随从打出约束（数据驱动）
            const constraint = minionDef?.playConstraint ?? fusionDef?.minionPlayConstraint;
            if (constraint) {
                const constraintError = checkPlayConstraint(constraint, core, baseIndex, command.playerId);
                if (constraintError) return { valid: false, error: constraintError };
            }
            return { valid: true };
        }

        case SU_COMMANDS.PLAY_ACTION: {
            console.log('[DEBUG] PLAY_ACTION validation: start', {
                playerId: command.playerId,
                cardUid: command.payload.cardUid,
                targetBaseIndex: command.payload.targetBaseIndex,
                hasReactionWindow: !!reactionWindow,
                windowType: reactionWindow?.windowType,
            });
            
            // 响应窗口期间：允许当前响应者打出特殊行动卡
            if (reactionWindow && (reactionWindow.windowType === 'meFirst' || reactionWindow.windowType === 'afterScoring')) {
                const currentResponderId = reactionWindow.activePlayerId;
                
                console.log('[DEBUG] PLAY_ACTION validation: in response window', {
                    currentResponderId,
                    commandPlayerId: command.playerId,
                    isCurrentResponder: command.playerId === currentResponderId,
                    windowType: reactionWindow.windowType,
                });
                
                if (command.playerId !== currentResponderId) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - not current responder');
                    return { valid: false, error: '等待对方响应' };
                }
                const rPlayer = core.players[command.playerId];
                if (!rPlayer) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - player not found');
                    return { valid: false, error: '玩家不存在' };
                }
                const rCard = rPlayer.hand.find(c => c.uid === command.payload.cardUid);
                if (!rCard) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - card not in hand');
                    return { valid: false, error: '手牌中没有该卡牌' };
                }
                if (!isCardActionLike(rCard)) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - not action card');
                    return { valid: false, error: '该卡牌不是行动卡' };
                }
                const rDef = getCardDef(rCard.defId) as ActionCardDef | FusionCardDef | undefined;
                if (!rDef) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - card def not found');
                    return { valid: false, error: '卡牌定义不存在' };
                }
                const responseTiming = getActionLikeResponseWindowTiming(rDef);
                if (!responseTiming) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - not response-window card', {
                        subtype: (rDef as any).type === 'fusion'
                            ? (rDef as FusionCardDef).actionSubtype
                            : (rDef as ActionCardDef).subtype,
                    });
                    return { valid: false, error: '该行动卡不能在响应窗口中打出' };
                }
                
                // 检查 specialTiming 是否匹配窗口类型
                const cardTiming = (rDef as any).type === 'fusion'
                    ? ((rDef as FusionCardDef).actionSpecialTiming ?? 'beforeScoring')
                    : ((rDef as ActionCardDef).specialTiming ?? 'beforeScoring'); // 默认为 beforeScoring
                if (reactionWindow.windowType === 'meFirst' && cardTiming !== 'beforeScoring') {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - wrong timing for meFirst window', {
                        cardTiming,
                        windowType: reactionWindow.windowType,
                    });
                    return { valid: false, error: '该卡牌只能在计分后打出' };
                }
                if (reactionWindow.windowType === 'afterScoring' && cardTiming !== 'afterScoring') {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - wrong timing for afterScoring window', {
                        cardTiming,
                        windowType: reactionWindow.windowType,
                    });
                    return { valid: false, error: '该卡牌只能在计分前打出' };
                }

                const restrictionError = getActionPlayRestrictionError(core, command.playerId);
                if (restrictionError) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - player restricted from actions', {
                        playerId: command.playerId,
                        windowType: reactionWindow.windowType,
                        restrictionError,
                    });
                    return { valid: false, error: restrictionError };
                }

                const targetBase = command.payload.targetBaseIndex;
                console.log('[DEBUG] PLAY_ACTION validation: checking base requirement', {
                    responseWindowNeedsBase: actionLikeNeedsResponseWindowBase(rDef),
                    targetBase,
                });
                
                const needsBase = actionLikeNeedsResponseWindowBase(rDef);
                if (needsBase) {
                    if (typeof targetBase !== 'number' || !Number.isInteger(targetBase)) {
                        console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - needs base but no valid base provided');
                        return { valid: false, error: '该行动卡需要选择一个达标基地' };
                    }
                    const targetBaseIndex = targetBase;
                    if (targetBaseIndex < 0 || targetBaseIndex >= core.bases.length) {
                        console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - invalid base index');
                        return { valid: false, error: '无效的基地索引' };
                    }

                    // 使用统一查询函数（优先锁定列表，回退实时计算）
                    const eligibleIndices = getScoringEligibleBaseIndices(core);
                    console.log('[DEBUG] PLAY_ACTION validation: eligible bases', {
                        eligibleIndices,
                        targetBaseIndex,
                        isEligible: eligibleIndices.includes(targetBaseIndex),
                    });
                    
                    if (!eligibleIndices.includes(targetBaseIndex)) {
                        console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - base not eligible');
                        return { valid: false, error: '只能选择达到临界点的基地' };
                    }

                    // specialLimitGroup 检查：该基地本回合是否已使用过同组 special 能力
                    const isBlocked = isSpecialLimitBlocked(core, rCard.defId, targetBaseIndex);
                    console.log('[DEBUG] PLAY_ACTION validation: special limit check', {
                        cardDefId: rCard.defId,
                        targetBaseIndex,
                        isBlocked,
                    });
                    
                    if (isBlocked) {
                        console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - special limit');
                        return { valid: false, error: '该基地本回合已使用过同组特殊能力' };
                    }
                } else if (targetBase !== undefined) {
                    console.log('[DEBUG] PLAY_ACTION validation: BLOCKED - base provided but not needed');
                    return { valid: false, error: '该行动卡不需要基地目标' };
                }

                console.log('[DEBUG] PLAY_ACTION validation: PASSED (Me First! mode)');
                return { valid: true };
            }

            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段打出行动卡' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };
            if (hasActiveBearNecessitiesPodRestriction(core, command.playerId) && isExtraActionPlayAttempt(core, command.playerId)) {
                return { valid: false, error: '受黑熊口粮POD限制：你不能打出额外牌' };
            }
            if (player.actionsPlayed >= player.actionLimit) {
                return { valid: false, error: '本回合行动额度已用完' };
            }
            const card = player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) return { valid: false, error: '手牌中没有该卡牌' };
            if (!isCardActionLike(card)) return { valid: false, error: '该卡牌不是行动卡' };
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            if (!def) return { valid: false, error: '卡牌定义不存在' };
            return validateActionPlaySemantics(core, command.playerId, {
                defId: card.defId,
                targetBaseIndex: command.payload.targetBaseIndex,
                targetMinionUid: command.payload.targetMinionUid,
                effectiveHandSize: player.hand.length,
            });
        }

        case SU_COMMANDS.DISCARD_TO_LIMIT: {
            if (phase !== 'draw') {
                return { valid: false, error: '只能在抽牌阶段弃牌' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };
            const excess = player.hand.length - HAND_LIMIT;
            if (excess <= 0) return { valid: false, error: '手牌未超过上限' };
            if (command.payload.cardUids.length !== excess) {
                return { valid: false, error: `需要弃掉 ${excess} 张牌` };
            }
            const handUids = new Set(player.hand.map(c => c.uid));
            for (const uid of command.payload.cardUids) {
                if (!handUids.has(uid)) {
                    return { valid: false, error: `手牌中不存在 uid=${uid}` };
                }
            }
            return { valid: true };
        }

        case SU_COMMANDS.SELECT_FACTION: {
            if (phase !== 'factionSelect') {
                return { valid: false, error: '只能在派系选择阶段选择派系' };
            }
            // Check turn order strictness
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const selection = core.factionSelection;
            if (!selection) return { valid: false, error: '派系选择状态未初始化' };

            const factionId = command.payload.factionId;
            if (selection.takenFactions.includes(factionId)) {
                return { valid: false, error: '该派系已被选择' };
            }
            const playerSelections = selection.playerSelections[command.playerId] || [];
            if (playerSelections.length >= 2) {
                return { valid: false, error: '你已选择了两个派系' };
            }

            return { valid: true };
        }

        case SU_COMMANDS.DESELECT_FACTION: {
            if (phase !== 'factionSelect') {
                return { valid: false, error: '只能在派系选择阶段取消派系' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const selection = core.factionSelection;
            if (!selection) return { valid: false, error: '派系选择状态未初始化' };

            const factionId = command.payload.factionId;
            const playerSelections = selection.playerSelections[command.playerId] || [];
            if (!playerSelections.includes(factionId)) {
                return { valid: false, error: '尚未选择该派系' };
            }
            return { valid: true };
        }

        case SU_COMMANDS.USE_BASE_ABILITY: {
            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段使用基地能力' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const { baseIndex } = command.payload;
            const base = core.bases[baseIndex];
            if (!base) return { valid: false, error: '无效的基地索引' };

            if (!hasActiveBaseAbility(base.defId)) {
                return { valid: false, error: '该基地没有可主动使用的能力' };
            }

            const activeOptions = getActiveBaseAbilityOptions(base.defId);
            if (activeOptions?.oncePerTurn) {
                const used = core.usedBaseAbilitiesThisTurn ?? [];
                if (used.some(entry => entry.playerId === command.playerId && entry.baseIndex === baseIndex && entry.baseDefId === base.defId)) {
                    return { valid: false, error: '该基地能力本回合已使用' };
                }
            }

            const canUse = canUseActiveBaseAbility(base.defId, {
                state: core,
                matchState: state,
                baseIndex,
                baseDefId: base.defId,
                playerId: command.playerId,
                now: core.turnNumber ?? 0,
            } as any);
            if (!canUse) {
                return { valid: false, error: '当前不能使用该基地能力' };
            }

            return { valid: true };
        }

        case SU_COMMANDS.USE_TALENT: {
            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段使用天赋' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const { minionUid, ongoingCardUid, titanUid, baseIndex } = command.payload;
            const targetCount = [minionUid, ongoingCardUid, titanUid].filter(Boolean).length;
            if (targetCount !== 1) {
                return { valid: false, error: '蹇呴』涓旀墜鑳藉彧鑳芥寚瀹氫竴绉嶅ぉ璧嬬洰鏍?' };
            }
            if (titanUid) {
                return validateTitanAbility(state, command, 'talent');
            }
            const targetBase = core.bases[baseIndex];
            if (!targetBase) return { valid: false, error: '无效的基地索引' };

            if (ongoingCardUid) {
                // 先查基地 ongoingActions
                let ongoing = targetBase.ongoingActions.find(o => o.uid === ongoingCardUid);
                // 再查随从 attachedActions
                if (!ongoing) {
                    for (const m of targetBase.minions) {
                        const aa = m.attachedActions.find(a => a.uid === ongoingCardUid);
                        if (aa) { ongoing = aa; break; }
                    }
                }
                if (!ongoing) return { valid: false, error: '基地上没有该持续行动卡' };
                if (ongoing.ownerId !== command.playerId) {
                    return { valid: false, error: '只能使用自己的持续行动卡天赋' };
                }
                if (ongoing.talentUsed) {
                    return { valid: false, error: '本回合天赋已使用' };
                }
                const oDef = getCardDef(ongoing.defId);
                if (!oDef || !('abilityTags' in oDef) || !oDef.abilityTags?.includes('talent')) {
                    return { valid: false, error: '该持续行动卡没有天赋能力' };
                }
                return { valid: true };
            }

            // 随从天赋
            if (!minionUid) return { valid: false, error: '必须指定随从或持续行动卡' };
            const targetMinion = targetBase.minions.find(m => m.uid === minionUid);
            if (!targetMinion) return { valid: false, error: '基地上没有该随从' };
            if (targetMinion.controller !== command.playerId) {
                return { valid: false, error: '只能使用自己控制的随从的天赋' };
            }
            if (targetMinion.talentUsed) {
                // 巨石阵例外：允许一个随从每回合使用才能两次
                const isStandingStones = targetBase.defId === 'base_standing_stones';
                const doubleTalentAvailable = !core.standingStonesDoubleTalentMinionUid;
                const greatWolfSpirit = (core.titans ?? []).find(titan =>
                    titan.defId === 'werewolves_great_wolf_spirit'
                    && titan.location.zone === 'base'
                    && titan.controllerId === command.playerId
                    && !(core.titanOngoingSuppressedUntilTurnEnd ?? []).includes(titan.uid),
                );
                const greatWolfSpiritBaseIndex = greatWolfSpirit?.location.baseIndex;
                const canUseGreatWolfSpiritDouble =
                    greatWolfSpiritBaseIndex === baseIndex
                    && !((core.greatWolfSpiritDoubleTalentCardUids ?? []).includes(minionUid));

                if (!(isStandingStones && doubleTalentAvailable) && !canUseGreatWolfSpiritDouble) {
                    return { valid: false, error: '本回合天赋已使用' };
                }
            }
            // 检查是否有天赋能力
            const mDef = getCardDef(targetMinion.defId);
            if (!mDef || !('abilityTags' in mDef) || !mDef.abilityTags?.includes('talent')) {
                return { valid: false, error: '该随从没有天赋能力' };
            }

            // 约束：部分天赋需要满足额外条件，否则不应允许发动（避免误消耗 TALENT_USED）
            // 怪物（frankenstein_the_monster）：需要至少 1 个 +1 力量指示物
            if (
                (targetMinion.defId === 'frankenstein_the_monster' || targetMinion.defId === 'frankenstein_the_monster_pod')
                && (targetMinion.powerCounters ?? 0) < 1
            ) {
                return { valid: false, error: '该随从当前无法发动天赋：没有+1力量指示物' };
            }
            return { valid: true };
        }

        case SU_COMMANDS.ACTIVATE_SPECIAL: {
            // 允许在 playCards 和 scoreBases 阶段激活特殊能力
            // scoreBases 阶段：基地计分前的 beforeScoring 特殊能力（如忍者侍从）
            if (phase !== 'playCards' && phase !== 'scoreBases') {
                return { valid: false, error: '只能在出牌阶段或计分阶段激活特殊能力' };
            }
            const currentResponderOrTurnPlayer = phase === 'scoreBases' && reactionWindow
                ? reactionWindow.activePlayerId
                : currentPlayerId;
            if (command.playerId !== currentResponderOrTurnPlayer) {
                return { valid: false, error: 'player_mismatch' };
            }
            const { minionUid: spMinionUid, titanUid: spTitanUid, baseIndex: spBaseIndex } = command.payload;
            const targetCount = [spMinionUid, spTitanUid].filter(Boolean).length;
            if (targetCount !== 1) {
                return { valid: false, error: '蹇呴』涓旀墜鑳藉彧鑳芥寚瀹氫竴涓壒娈婅兘鍔涚洰鏍?' };
            }
            const spBase = core.bases[spBaseIndex];
            if (!spBase) return { valid: false, error: '无效的基地索引' };
            if (spTitanUid) {
                const titanValidation = validateTitanAbility(
                    state,
                    { playerId: command.playerId, payload: { titanUid: spTitanUid, baseIndex: spBaseIndex } },
                    'special',
                );
                if (!titanValidation.valid) {
                    return titanValidation;
                }
                if (phase === 'scoreBases') {
                    const eligibleIndices = getScoringEligibleBaseIndices(core);
                    if (!eligibleIndices.includes(spBaseIndex)) {
                        return { valid: false, error: '鍙兘鍦ㄨ揪鍒颁复鐣岀偣鐨勫熀鍦颁笂婵€娲昏鍒嗗墠鐗规畩鑳藉姏' };
                    }
                    if (hasBlockingLegacyResponseWindow(state)) {
                        return { valid: false, error: 'Me First! 鍝嶅簲绐楀彛浠嶅湪杩涜涓?' };
                    }
                }
                return { valid: true };
            }

            const spMinion = spBase.minions.find(m => m.uid === spMinionUid);
            if (!spMinion) return { valid: false, error: '基地上没有该随从' };
            if (spMinion.controller !== command.playerId) {
                return { valid: false, error: '只能激活自己控制的随从的特殊能力' };
            }
            const spDef = getCardDef(spMinion.defId);
            const hasSpecialTag = (() => {
                if (!spDef) return false;
                if (spDef.type === 'fusion') {
                    return spDef.minionAbilityTags?.includes('special') ?? false;
                }
                if ('abilityTags' in spDef) {
                    return spDef.abilityTags?.includes('special') ?? false;
                }
                return false;
            })();
            if (!hasSpecialTag) {
                return { valid: false, error: '该随从没有特殊能力' };
            }
            // specialLimitGroup 检查
            if (isSpecialLimitBlocked(core, spMinion.defId, spBaseIndex)) {
                return { valid: false, error: '该基地本回合已使用过同组特殊能力' };
            }
            // scoreBases 阶段额外验证：只能在达标基地上激活
            if (phase === 'scoreBases') {
                const eligibleIndices = getScoringEligibleBaseIndices(core);
                if (!eligibleIndices.includes(spBaseIndex)) {
                    return { valid: false, error: '只能在达到临界点的基地上激活计分前特殊能力' };
                }
                // 响应窗口仍打开时不允许激活（Me First! 优先）
                if (hasBlockingLegacyResponseWindow(state)) {
                    return { valid: false, error: 'Me First! 响应窗口仍在进行中' };
                }
            }
            return { valid: true };
        }

        case SU_COMMANDS.ACTIVATE_TITAN_ONGOING: {
            if (phase !== 'playCards') {
                return { valid: false, error: '鍙兘鍦ㄥ嚭鐗岄樁娈垫縺娲绘嘲鍧︽寔缁兘鍔?' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            return validateTitanAbility(state, command, 'ongoing');
        }

        default:
            // RESPONSE_PASS 由引擎 ResponseWindowSystem 处理，领域层直接放行
            if ((command as { type: string }).type === 'RESPONSE_PASS') {
                return { valid: true };
            }
            return { valid: false, error: '未知命令' };
    }
}

/**
 * 通用打出约束检查（数据驱动）。
 * 返回 null 表示通过，返回字符串表示拒绝原因。
 */
function checkPlayConstraint(
    constraint: PlayConstraint,
    core: SmashUpCore,
    baseIndex: number,
    playerId: string,
): string | null {
    if (constraint === 'requireOwnMinion') {
        const hasOwnMinion = core.bases[baseIndex].minions.some(m => m.controller === playerId);
        if (!hasOwnMinion) return '目标基地上必须有你的随从';
        return null;
    }
    if (constraint === 'onlyCardInHand') {
        const handSize = core.players[playerId]?.hand.length ?? 0;
        if (handSize !== 1) return '只能在本卡是你的唯一手牌时打出';
        return null;
    }
    if (typeof constraint === 'object' && constraint.type === 'requireOwnPower') {
        const base = core.bases[baseIndex];
        const myPower = getPlayerEffectivePowerOnBase(core, base, baseIndex, playerId);
        if (myPower < constraint.minPower) {
            return `只能打到你至少拥有${constraint.minPower}点力量的基地`;
        }
        return null;
    }
    return null;
}
