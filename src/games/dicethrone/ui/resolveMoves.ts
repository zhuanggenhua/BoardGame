/**
 * DiceThrone Move 映射
 *
 * 基于 dispatch 的类型安全包装器。
 * 保留 DiceThroneMoveMap 接口供子组件使用。
 */

import { DICETHRONE_COMMANDS } from '../domain/ids';

export type DiceThroneMoveMap = {
    advancePhase: () => void;
    rollDice: () => void;
    toggleDieLock: (id: number) => void;
    confirmRoll: () => void;
    selectAbility: (abilityId: string) => void;
    playCard: (cardId: string) => void;
    sellCard: (cardId: string) => void;
    undoSellCard?: () => void;
    resolveChoice: (statusId: string) => void;
    responsePass: (forPlayerId?: string) => void;
    // 卡牌交互相关
    modifyDie: (dieId: number, newValue: number) => void;
    rerollDie: (dieId: number) => void;
    removeStatus: (targetPlayerId: string, statusId?: string) => void;
    transferStatus: (fromPlayerId: string, toPlayerId: string, statusId: string) => void;
    // confirmInteraction: (interactionId: string, selectedDiceIds?: number[], selectedPlayerId?: string) => void; // @deprecated - 使用 InteractionSystem
    // cancelInteraction: () => void; // @deprecated - 使用 InteractionSystem
    // Token 响应相关
    useToken: (tokenId: string, amount: number) => void;
    skipTokenResponse: () => void;
    usePurify: (statusId: string) => void;
    // 击倒移除
    payToRemoveKnockdown: () => void;
    // 奖励骰重掷
    rerollBonusDie: (dieIndex: number) => void;
    skipBonusDiceReroll: () => void;
    // 被动能力（如教皇税）
    usePassiveAbility: (passiveId: string, actionIndex: number, targetDieId?: number) => void;
    // 选角相关
    selectCharacter: (characterId: string) => void;
    hostStartGame: () => void;
    playerReady: () => void;
};

/**
 * 从 dispatch 创建类型安全的 DiceThroneMoveMap
 */
export const resolveMoves = (
    dispatch: (type: string, payload?: unknown) => void,
): DiceThroneMoveMap => ({
    advancePhase: () => dispatch('ADVANCE_PHASE', {}),
    rollDice: () => dispatch('ROLL_DICE', {}),
    toggleDieLock: (id) => dispatch('TOGGLE_DIE_LOCK', { dieId: id }),
    confirmRoll: () => dispatch('CONFIRM_ROLL', {}),
    selectAbility: (abilityId) => dispatch('SELECT_ABILITY', { abilityId }),
    playCard: (cardId) => dispatch('PLAY_CARD', { cardId }),
    sellCard: (cardId) => dispatch('SELL_CARD', { cardId }),
    undoSellCard: () => dispatch('UNDO_SELL_CARD', {}),
    resolveChoice: (statusId) => dispatch('RESOLVE_CHOICE', { statusId }),
    responsePass: (forPlayerId) => dispatch('RESPONSE_PASS', forPlayerId ? { forPlayerId } : {}),
    // 卡牌交互
    modifyDie: (dieId, newValue) => dispatch('MODIFY_DIE', { dieId, newValue }),
    rerollDie: (dieId) => dispatch('REROLL_DIE', { dieId }),
    removeStatus: (targetPlayerId, statusId) => dispatch('REMOVE_STATUS', { targetPlayerId, statusId }),
    transferStatus: (fromPlayerId, toPlayerId, statusId) => dispatch('TRANSFER_STATUS', { fromPlayerId, toPlayerId, statusId }),
    // confirmInteraction: (interactionId, selectedDiceIds, selectedPlayerId) => dispatch('CONFIRM_INTERACTION', { interactionId, selectedDiceIds, selectedPlayerId }),
    // cancelInteraction: () => dispatch('CANCEL_INTERACTION', {}),
    // Token 响应
    useToken: (tokenId, amount) => dispatch('USE_TOKEN', { tokenId, amount }),
    skipTokenResponse: () => dispatch('SKIP_TOKEN_RESPONSE', {}),
    usePurify: (statusId) => dispatch('USE_PURIFY', { statusId }),
    // 击倒移除
    payToRemoveKnockdown: () => dispatch(DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN, {}),
    // 奖励骰重掷
    rerollBonusDie: (dieIndex) => dispatch('REROLL_BONUS_DIE', { dieIndex }),
    skipBonusDiceReroll: () => dispatch('SKIP_BONUS_DICE_REROLL', {}),
    // 被动能力
    usePassiveAbility: (passiveId, actionIndex, targetDieId) =>
        dispatch('USE_PASSIVE_ABILITY', { passiveId, actionIndex, targetDieId }),
    selectCharacter: (characterId) => dispatch('SELECT_CHARACTER', { characterId }),
    hostStartGame: () => dispatch('HOST_START_GAME', {}),
    playerReady: () => dispatch('PLAYER_READY', {}),
});
