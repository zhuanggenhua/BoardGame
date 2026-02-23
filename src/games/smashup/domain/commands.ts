/**
 * 大杀四方 (Smash Up) - 命令验证
 */

import type { MatchState, ValidationResult } from '../../../engine/types';
import type { SmashUpCommand, SmashUpCore, ActionCardDef, PlayConstraint } from './types';
import { SU_COMMANDS, getCurrentPlayerId, HAND_LIMIT } from './types';
import { getCardDef, getMinionDef } from '../data/cards';
import { isOperationRestricted } from './ongoingEffects';
import {
    getEffectiveBreakpoint,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
} from './ongoingModifiers';
import { canPlayFromDiscard } from './discardPlayability';
import { isSpecialLimitBlocked } from './abilityHelpers';

export function validate(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand
): ValidationResult {
    const core = state.core;
    const currentPlayerId = getCurrentPlayerId(core);
    const phase = state.sys.phase;

    // 系统命令（SYS_ 前缀）由引擎层处理，领域层直接放行
    if ((command as { type: string }).type.startsWith('SYS_')) {
        return { valid: true };
    }

    switch (command.type) {
        case SU_COMMANDS.PLAY_MINION: {
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
                if (!discardCard || discardCard.type !== 'minion') {
                    return { valid: false, error: '弃牌堆中没有该随从' };
                }
                const minionDef = getMinionDef(discardCard.defId);
                const basePower = minionDef?.power ?? 0;
                if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                    minionDefId: discardCard.defId,
                    basePower,
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
            if (card.type !== 'minion') return { valid: false, error: '该卡牌不是随从' };
            // 同名额度检查：全局额度用完后，如果只剩同名额度，必须匹配已锁定的 defId
            if (globalQuotaRemaining <= 0 && sameNameRemaining > 0 && baseQuota <= 0) {
                // 已锁定 defId 时，只能打出同名随从
                if (player.sameNameMinionDefId !== null && player.sameNameMinionDefId !== undefined && card.defId !== player.sameNameMinionDefId) {
                    return { valid: false, error: '额外出牌只能打出同名随从' };
                }
            }
            // 基地限定同名额度检查：全局额度和全局同名额度都用完后，使用基地限定额度时检查同名约束
            if (globalQuotaRemaining <= 0 && sameNameRemaining <= 0 && baseQuota > 0) {
                if (player.baseLimitedSameNameRequired?.[baseIndex]) {
                    // 必须与该基地上已有随从同名
                    const base = core.bases[baseIndex];
                    const baseDefIds = new Set(base.minions.map(m => m.defId));
                    if (!baseDefIds.has(card.defId)) {
                        return { valid: false, error: '只能打出与该基地上随从同名的随从' };
                    }
                }
            }
            // 全局力量限制检查：额外出牌机会可能有力量上限（如家园：力量≤2）
            if (player.extraMinionPowerMax !== undefined && player.minionsPlayed >= 1) {
                const minionDef = getMinionDef(card.defId);
                const basePower = minionDef?.power ?? 0;
                if (basePower > player.extraMinionPowerMax) {
                    return { valid: false, error: `额外出牌只能打出力量≤${player.extraMinionPowerMax}的随从` };
                }
            }
            // 限制检查：是否禁止打出随从到此基地（包括基地效果和 ongoing 效果）
            const minionDef = getMinionDef(card.defId);
            const basePower = minionDef?.power ?? 0;
            if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                minionDefId: card.defId,
                basePower,
            })) {
                return { valid: false, error: '该基地禁止打出该随从' };
            }
            // 随从打出约束（数据驱动）
            if (minionDef?.playConstraint) {
                const constraintError = checkPlayConstraint(minionDef.playConstraint, core, baseIndex, command.playerId);
                if (constraintError) return { valid: false, error: constraintError };
            }
            return { valid: true };
        }

        case SU_COMMANDS.PLAY_ACTION: {
            // Me First! 响应窗口期间：允许当前响应者打出特殊行动卡
            const responseWindow = state.sys.responseWindow?.current;
            if (responseWindow && responseWindow.windowType === 'meFirst') {
                const responderQueue = responseWindow.responderQueue;
                const currentResponderId = responderQueue[responseWindow.currentResponderIndex];
                if (command.playerId !== currentResponderId) {
                    return { valid: false, error: '等待对方响应' };
                }
                const rPlayer = core.players[command.playerId];
                if (!rPlayer) return { valid: false, error: '玩家不存在' };
                const rCard = rPlayer.hand.find(c => c.uid === command.payload.cardUid);
                if (!rCard) return { valid: false, error: '手牌中没有该卡牌' };
                if (rCard.type !== 'action') return { valid: false, error: '该卡牌不是行动卡' };
                const rDef = getCardDef(rCard.defId) as ActionCardDef | undefined;
                if (!rDef) return { valid: false, error: '卡牌定义不存在' };
                if (rDef.subtype !== 'special') {
                    return { valid: false, error: 'Me First! 响应只能打出特殊行动卡' };
                }

                const targetBase = command.payload.targetBaseIndex;
                if (rDef.specialNeedsBase) {
                    if (typeof targetBase !== 'number' || !Number.isInteger(targetBase)) {
                        return { valid: false, error: '该特殊行动卡需要选择一个达标基地' };
                    }
                    const targetBaseIndex = targetBase;
                    if (targetBaseIndex < 0 || targetBaseIndex >= core.bases.length) {
                        return { valid: false, error: '无效的基地索引' };
                    }

                    const base = core.bases[targetBaseIndex];
                    const totalPower = getTotalEffectivePowerOnBase(core, base, targetBaseIndex);
                    const breakpoint = getEffectiveBreakpoint(core, targetBaseIndex);
                    if (totalPower < breakpoint) {
                        return { valid: false, error: '只能选择达到临界点的基地' };
                    }

                    // specialLimitGroup 检查：该基地本回合是否已使用过同组 special 能力
                    if (isSpecialLimitBlocked(core, rCard.defId, targetBaseIndex)) {
                        return { valid: false, error: '该基地本回合已使用过同组特殊能力' };
                    }
                } else if (targetBase !== undefined) {
                    return { valid: false, error: '该特殊行动卡不需要基地目标' };
                }

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
            if (player.actionsPlayed >= player.actionLimit) {
                return { valid: false, error: '本回合行动额度已用完' };
            }
            const card = player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) return { valid: false, error: '手牌中没有该卡牌' };
            if (card.type !== 'action') return { valid: false, error: '该卡牌不是行动卡' };
            const def = getCardDef(card.defId) as ActionCardDef | undefined;
            if (!def) return { valid: false, error: '卡牌定义不存在' };
            // 特殊行动卡只能在 Me First! 响应窗口中打出，不能在正常出牌阶段使用
            if (def.subtype === 'special') {
                return { valid: false, error: '特殊行动卡只能在基地计分前的 Me First! 窗口中打出' };
            }

            // 持续行动卡：必须显式选择附着目标
            const targetBase = command.payload.targetBaseIndex;
            if (def.subtype === 'ongoing') {
                if (typeof targetBase !== 'number' || !Number.isInteger(targetBase)) {
                    return { valid: false, error: '持续行动卡需要选择目标基地' };
                }
                if (targetBase < 0 || targetBase >= core.bases.length) {
                    return { valid: false, error: '无效的基地索引' };
                }

                const ongoingTarget = def.ongoingTarget ?? 'base';
                const targetMinionUid = command.payload.targetMinionUid;
                if (ongoingTarget === 'minion') {
                    if (!targetMinionUid) {
                        return { valid: false, error: '该持续行动卡需要选择目标随从' };
                    }
                    const targetMinion = core.bases[targetBase].minions.find(m => m.uid === targetMinionUid);
                    if (!targetMinion) {
                        return { valid: false, error: '基地上没有该随从' };
                    }
                } else if (targetMinionUid !== undefined) {
                    return { valid: false, error: '该持续行动卡不需要选择随从目标' };
                }

                // 打出约束检查（数据驱动）
                if (def.playConstraint) {
                    const constraintError = checkPlayConstraint(def.playConstraint, core, targetBase, command.playerId);
                    if (constraintError) return { valid: false, error: constraintError };
                }
            }

            // ongoing 限制检查：是否禁止打出行动卡到目标基地
            if (typeof targetBase === 'number' && isOperationRestricted(core, targetBase, command.playerId, 'play_action')) {
                return { valid: false, error: '该基地禁止打出行动卡' };
            }
            return { valid: true };
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

        case SU_COMMANDS.USE_TALENT: {
            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段使用天赋' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: 'player_mismatch' };
            }
            const { minionUid, ongoingCardUid, baseIndex } = command.payload;
            const targetBase = core.bases[baseIndex];
            if (!targetBase) return { valid: false, error: '无效的基地索引' };

            // ongoing 行动卡天赋（基地上或随从附着）
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
                if (!(isStandingStones && doubleTalentAvailable)) {
                    return { valid: false, error: '本回合天赋已使用' };
                }
            }
            // 检查是否有天赋能力
            const mDef = getCardDef(targetMinion.defId);
            if (!mDef || !('abilityTags' in mDef) || !mDef.abilityTags?.includes('talent')) {
                return { valid: false, error: '该随从没有天赋能力' };
            }
            return { valid: true };
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
        const hasOwnMinion = core.bases[baseIndex].minions.some(m => m.owner === playerId);
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
