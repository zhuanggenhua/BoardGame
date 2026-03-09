/**
 * Cardia 命令验证逻辑
 */

import type { ValidationResult, MatchState } from '../../../engine/types';
import type { CardiaCore } from './core-types';
import type { CardiaCommand } from './commands';
import { CARDIA_COMMANDS } from './commands';
import { FACTION_IDS } from './ids';

/**
 * 验证命令
 */
export function validate(
    state: MatchState<CardiaCore>,
    command: CardiaCommand
): ValidationResult {
    const core = state.core;
    
    // 系统命令（以 SYS_ 开头）由系统层处理，游戏层直接放行
    if (command.type.startsWith('SYS_')) {
        return { valid: true };
    }
    
    switch (command.type) {
        case CARDIA_COMMANDS.PLAY_CARD:
            return validatePlayCard(core, command);
        
        case CARDIA_COMMANDS.ACTIVATE_ABILITY:
            return validateActivateAbility(state, command);
        
        case CARDIA_COMMANDS.SKIP_ABILITY:
            return validateSkipAbility(state, command);
        
        case CARDIA_COMMANDS.CHOOSE_CARD:
            return validateChooseCard(core, command);
        
        case CARDIA_COMMANDS.CHOOSE_FACTION:
            return validateChooseFaction(core, command);
        
        case CARDIA_COMMANDS.CHOOSE_MODIFIER:
            return validateChooseModifier(core, command);
        
        case CARDIA_COMMANDS.CONFIRM_CHOICE:
            return validateConfirmChoice(core, command);
        
        case CARDIA_COMMANDS.END_TURN:
            return validateEndTurn(core, command);
        
        default:
            return { valid: false, error: 'Unknown command type' };
    }
}

/**
 * 验证打出卡牌命令
 */
function validatePlayCard(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: 'PLAY_CARD' }>
): ValidationResult {
    const { playerId } = command;
    const { cardUid } = command.payload;
    
    // Cardia 是同时打出卡牌的游戏，不需要检查是否是当前玩家
    // 只要在打出卡牌阶段，任何玩家都可以打出卡牌
    
    // 检查是否在打出卡牌阶段
    if (core.phase !== 'play') {
        console.warn('[Cardia] PLAY_CARD validation failed: Not in play phase', {
            playerId,
            currentPhase: core.phase,
        });
        return { valid: false, error: 'Not in play phase' };
    }
    
    // 检查玩家是否存在
    const player = core.players[playerId];
    if (!player) {
        console.warn('[Cardia] PLAY_CARD validation failed: Player not found', {
            playerId,
            availablePlayers: Object.keys(core.players),
        });
        return { valid: false, error: 'Player not found' };
    }
    
    // 检查是否已经打出卡牌
    if (player.hasPlayed) {
        console.warn('[Cardia] PLAY_CARD validation failed: Already played', {
            playerId,
            hasPlayed: player.hasPlayed,
        });
        return { valid: false, error: 'Already played a card this turn' };
    }
    
    // 占卜师能力：检查强制出牌顺序
    if (core.forcedPlayOrderNextEncounter) {
        const forcedPlayer = core.forcedPlayOrderNextEncounter;
        const forcedPlayerState = core.players[forcedPlayer];
        
        // 如果强制出牌的玩家还没有出牌，其他玩家不能出牌
        if (!forcedPlayerState.hasPlayed && playerId !== forcedPlayer) {
            console.warn('[Cardia] PLAY_CARD validation failed: Forced play order', {
                playerId,
                forcedPlayer,
                forcedPlayerHasPlayed: forcedPlayerState.hasPlayed,
            });
            return { valid: false, error: 'validation.opponent_must_play_first' };
        }
    }
    
    // 检查卡牌是否在手牌中
    const card = player.hand.find(c => c.uid === cardUid);
    if (!card) {
        console.warn('[Cardia] PLAY_CARD validation failed: Card not in hand', {
            playerId,
            cardUid,
            handCards: player.hand.map(c => c.uid),
        });
        return { valid: false, error: 'Card not in hand' };
    }
    
    console.log('[Cardia] PLAY_CARD validation passed', {
        playerId,
        cardUid,
        cardDefId: card.defId,
    });
    
    return { valid: true };
}

/**
 * 验证激活能力命令
 */
function validateActivateAbility(
    state: MatchState<CardiaCore>,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.ACTIVATE_ABILITY }>
): ValidationResult {
    const { playerId } = command;
    const { abilityId, sourceCardUid } = command.payload;
    const core = state.core;
    
    // 检查是否在能力阶段（从 sys.phase 读取，FlowSystem 管理的权威来源）
    if (state.sys.phase !== 'ability') {
        return { valid: false, error: 'Not in ability phase' };
    }
    
    // 检查玩家是否存在
    const player = core.players[playerId];
    if (!player) {
        return { valid: false, error: 'Player not found' };
    }
    
    // 检查是否有当前遭遇
    if (!core.currentEncounter) {
        return { valid: false, error: 'No current encounter' };
    }
    
    // 检查是否是失败者（只有失败者可以激活能力）
    if (core.currentEncounter.loserId !== playerId) {
        return { valid: false, error: 'Only the loser can activate abilities' };
    }
    
    // 检查卡牌是否存在（可能在 playedCards 或 currentCard 中）
    let card = player.playedCards.find(c => c.uid === sourceCardUid);
    if (!card && player.currentCard?.uid === sourceCardUid) {
        card = player.currentCard;
    }
    if (!card) {
        return { valid: false, error: 'Card not found on board' };
    }
    
    // 检查能力是否属于该卡牌
    if (!card.abilityIds.includes(abilityId)) {
        return { valid: false, error: 'Ability not found on card' };
    }
    
    // TODO: 检查能力是否有可选目标（需要能力注册表）
    // TODO: 检查资源是否充足
    // TODO: 检查条件限制（如影响力≤8）
    
    return { valid: true };
}

/**
 * 验证跳过能力命令
 */
function validateSkipAbility(
    state: MatchState<CardiaCore>,
    command: Extract<CardiaCommand, { type: 'SKIP_ABILITY' }>
): ValidationResult {
    const { core, sys } = state;
    const { playerId } = command;
    
    // 检查是否在能力阶段（从 sys.phase 读取，FlowSystem 管理）
    if (sys.phase !== 'ability') {
        return { valid: false, error: 'Not in ability phase' };
    }
    
    // 检查是否是失败者
    if (!core.currentEncounter) {
        return { valid: false, error: 'No current encounter' };
    }
    
    if (core.currentEncounter.loserId !== playerId) {
        return { valid: false, error: 'Only the loser can skip abilities' };
    }
    
    return { valid: true };
}

/**
 * 验证选择修正标记命令（交互）
 */
function validateChooseModifier(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.CHOOSE_MODIFIER }>
): ValidationResult {
    const { playerId } = command;
    const { value } = command.payload;
    
    // 检查玩家是否存在
    const player = core.players[playerId];
    if (!player) {
        return { valid: false, error: 'Player not found' };
    }
    
    // 检查修正值是否有效
    const validValues = [1, 3, 5, -1, -3, -5];
    if (!validValues.includes(value)) {
        return { valid: false, error: 'Invalid modifier value' };
    }
    
    // 注意：更详细的验证由 InteractionSystem 处理
    // 这里只做基础验证
    
    return { valid: true };
}

/**
 * 验证确认选择命令（交互）
 */
function validateConfirmChoice(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.CONFIRM_CHOICE }>
): ValidationResult {
    const { playerId } = command;
    
    // 检查玩家是否存在
    const player = core.players[playerId];
    if (!player) {
        return { valid: false, error: 'Player not found' };
    }
    
    // 注意：更详细的验证由 InteractionSystem 处理
    // 这里只做基础验证
    
    return { valid: true };
}

/**
 * 验证选择卡牌命令（交互）
 */
function validateChooseCard(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.CHOOSE_CARD }>
): ValidationResult {
    const { playerId } = command;
    const { cardUid, cardUids, interactionId } = command.payload;
    
    // 检查玩家是否存在
    const player = core.players[playerId];
    if (!player) {
        return { valid: false, error: 'Player not found' };
    }
    
    // 检查交互ID是否存在
    if (!interactionId) {
        return { valid: false, error: 'No interaction ID' };
    }
    
    // 支持单选和多选两种格式
    const selectedCards = cardUids || (cardUid ? [cardUid] : []);
    
    // 检查是否有选择的卡牌
    if (selectedCards.length === 0) {
        return { valid: false, error: 'No cards selected' };
    }
    
    // 检查所有选择的卡牌是否在手牌中
    for (const uid of selectedCards) {
        const card = player.hand.find(c => c.uid === uid);
        if (!card) {
            return { valid: false, error: `Card ${uid} not in hand` };
        }
    }
    
    // 注意：更详细的验证（如是否符合过滤条件、数量限制）由 InteractionSystem 处理
    // 这里只做基础验证
    
    return { valid: true };
}

/**
 * 验证选择派系命令（交互）
 */
function validateChooseFaction(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.CHOOSE_FACTION }>
): ValidationResult {
    const { playerId } = command;
    const { faction, interactionId } = command.payload;
    
    // 检查玩家是否存在
    const player = core.players[playerId];
    if (!player) {
        return { valid: false, error: 'Player not found' };
    }
    
    // 检查派系是否有效
    const validFactions = Object.values(FACTION_IDS);
    if (!validFactions.includes(faction as any)) {
        return { valid: false, error: 'Invalid faction' };
    }
    
    // 检查交互ID是否存在
    if (!interactionId) {
        return { valid: false, error: 'No interaction ID' };
    }
    
    // 注意：更详细的验证由 InteractionSystem 处理
    // 这里只做基础验证
    
    return { valid: true };
}

/**
 * 验证回合结束命令
 */
function validateEndTurn(
    core: CardiaCore,
    command: Extract<CardiaCommand, { type: typeof CARDIA_COMMANDS.END_TURN }>
): ValidationResult {
    const { playerId } = command;
    
    // 检查是否在结束阶段
    if (core.phase !== 'end') {
        return { valid: false, error: 'Not in end phase' };
    }
    
    // 检查是否是当前玩家
    if (core.currentPlayerId !== playerId) {
        return { valid: false, error: 'Not your turn' };
    }
    
    // 检查玩家是否存在
    const player = core.players[playerId];
    if (!player) {
        return { valid: false, error: 'Player not found' };
    }
    
    return { valid: true };
}

export default validate;
