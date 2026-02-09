/**
 * 大杀四方 (Smash Up) - 命令验证
 */

import type { MatchState, ValidationResult } from '../../../engine/types';
import type { SmashUpCommand, SmashUpCore, ActionCardDef } from './types';
import { SU_COMMANDS, getCurrentPlayerId, HAND_LIMIT } from './types';
import { getCardDef } from '../data/cards';
import { isOperationRestricted } from './ongoingEffects';

export function validate(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand
): ValidationResult {
    const core = state.core;
    const currentPlayerId = getCurrentPlayerId(core);
    const phase = state.sys.phase;

    // 系统命令（SYS_ 前缀）由引擎层处理，领域层直接放行
    if ((command as any).type.startsWith('SYS_')) {
        return { valid: true };
    }

    switch (command.type) {
        case SU_COMMANDS.PLAY_MINION: {
            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段打出随从' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: '不是你的回合' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };
            if (player.minionsPlayed >= player.minionLimit) {
                return { valid: false, error: '本回合随从额度已用完' };
            }
            const card = player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) return { valid: false, error: '手牌中没有该卡牌' };
            if (card.type !== 'minion') return { valid: false, error: '该卡牌不是随从' };
            const { baseIndex } = command.payload;
            if (baseIndex < 0 || baseIndex >= core.bases.length) {
                return { valid: false, error: '无效的基地索引' };
            }
            // ongoing 限制检查：是否禁止打出随从到此基地
            if (isOperationRestricted(core, baseIndex, command.playerId, 'play_minion', {
                minionDefId: card.defId,
            })) {
                return { valid: false, error: '该基地禁止打出随从' };
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
                return { valid: true };
            }

            if (phase !== 'playCards') {
                return { valid: false, error: '只能在出牌阶段打出行动卡' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: '不是你的回合' };
            }
            const player = core.players[command.playerId];
            if (!player) return { valid: false, error: '玩家不存在' };
            if (player.actionsPlayed >= player.actionLimit) {
                return { valid: false, error: '本回合行动额度已用完' };
            }
            const card = player.hand.find(c => c.uid === command.payload.cardUid);
            if (!card) return { valid: false, error: '手牌中没有该卡牌' };
            if (card.type !== 'action') return { valid: false, error: '该卡牌不是行动卡' };
            const def = getCardDef(card.defId);
            if (!def) return { valid: false, error: '卡牌定义不存在' };
            // ongoing 限制检查：是否禁止打出行动卡到目标基地
            const targetBase = command.payload.targetBaseIndex;
            if (targetBase !== undefined && isOperationRestricted(core, targetBase, command.playerId, 'play_action')) {
                return { valid: false, error: '该基地禁止打出行动卡' };
            }
            return { valid: true };
        }

        case SU_COMMANDS.DISCARD_TO_LIMIT: {
            if (phase !== 'draw') {
                return { valid: false, error: '只能在抽牌阶段弃牌' };
            }
            if (command.playerId !== currentPlayerId) {
                return { valid: false, error: '不是你的回合' };
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
                return { valid: false, error: '不是你的回合' };
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
                return { valid: false, error: '不是你的回合' };
            }
            const { minionUid, baseIndex } = command.payload;
            const targetBase = core.bases[baseIndex];
            if (!targetBase) return { valid: false, error: '无效的基地索引' };
            const targetMinion = targetBase.minions.find(m => m.uid === minionUid);
            if (!targetMinion) return { valid: false, error: '基地上没有该随从' };
            if (targetMinion.controller !== command.playerId) {
                return { valid: false, error: '只能使用自己控制的随从的天赋' };
            }
            if (targetMinion.talentUsed) {
                return { valid: false, error: '本回合天赋已使用' };
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
            if ((command as any).type === 'RESPONSE_PASS') {
                return { valid: true };
            }
            return { valid: false, error: '未知命令' };
    }
}
