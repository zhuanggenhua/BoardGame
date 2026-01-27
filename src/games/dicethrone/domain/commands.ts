/**
 * DiceThrone 命令验证
 * 从 game.ts 各 move 的校验逻辑抽取
 */

import type { ValidationResult, PlayerId } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneCommand,
    RollDiceCommand,
    RollBonusDieCommand,
    ToggleDieLockCommand,
    ConfirmRollCommand,
    SelectAbilityCommand,
    DrawCardCommand,
    DiscardCardCommand,
    SellCardCommand,
    UndoSellCardCommand,
    ReorderCardToEndCommand,
    PlayCardCommand,
    PlayUpgradeCardCommand,
    ResolveChoiceCommand,
    AdvancePhaseCommand,
    ResponsePassCommand,
    ModifyDieCommand,
    RerollDieCommand,
    RemoveStatusCommand,
    TransferStatusCommand,
    ConfirmInteractionCommand,
    CancelInteractionCommand,
    UseTokenCommand,
    SkipTokenResponseCommand,
    UsePurifyCommand,
    PayToRemoveStunCommand,
} from './types';
import {
    getRollerId,
    isMoveAllowed,
    canAdvancePhase,
    checkPlayCard,
    checkPlayUpgradeCard,
    getAvailableAbilityIds,
} from './rules';
import { RESOURCE_IDS } from './resources';

// ============================================================================
// 验证函数
// ============================================================================

const ok = (): ValidationResult => ({ valid: true });
const fail = (error: string): ValidationResult => ({ valid: false, error });

/**
 * 验证掷骰命令
 */
const validateRollDice = (
    state: DiceThroneCore,
    _cmd: RollDiceCommand,
    playerId: PlayerId
): ValidationResult => {
    if (state.turnPhase !== 'offensiveRoll' && state.turnPhase !== 'defensiveRoll') {
        return fail('invalid_phase');
    }
    
    const rollerId = getRollerId(state);
    if (!isMoveAllowed(playerId, rollerId)) {
        // 临时日志：排查防御投掷 player_mismatch
        console.warn('[DiceThrone][validateRollDice] player_mismatch', {
            playerId,
            rollerId,
            turnPhase: state.turnPhase,
            activePlayerId: state.activePlayerId,
            rollCount: state.rollCount,
            rollLimit: state.rollLimit,
            pendingAttack: state.pendingAttack
                ? {
                    attackerId: state.pendingAttack.attackerId,
                    defenderId: state.pendingAttack.defenderId,
                    sourceAbilityId: state.pendingAttack.sourceAbilityId,
                }
                : null,
        });
        return fail('player_mismatch');
    }
    
    if (state.rollCount >= state.rollLimit) {
        return fail('roll_limit_reached');
    }
    
    return ok();
};

/**
 * 验证额外骰子命令
 * @deprecated 额外骰子现在在 resolveAttack 中自动投掷
 */
const validateRollBonusDie = (
    _state: DiceThroneCore,
    _cmd: RollBonusDieCommand,
    _playerId: PlayerId
): ValidationResult => {
    // 已废弃：额外骰子现在在 resolveAttack 中自动投掷
    return fail('deprecated_command');
};

/**
 * 验证锁定骰子命令
 */
const validateToggleDieLock = (
    state: DiceThroneCore,
    cmd: ToggleDieLockCommand,
    playerId: PlayerId
): ValidationResult => {
    if (state.turnPhase !== 'offensiveRoll') {
        return fail('invalid_phase');
    }
    
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    
    if (state.rollConfirmed) {
        return fail('roll_already_confirmed');
    }
    
    const die = state.dice.find(d => d.id === cmd.payload.dieId);
    if (!die) {
        return fail('die_not_found');
    }
    
    return ok();
};

/**
 * 验证确认骰子命令
 */
const validateConfirmRoll = (
    state: DiceThroneCore,
    _cmd: ConfirmRollCommand,
    playerId: PlayerId
): ValidationResult => {
    if (state.turnPhase !== 'offensiveRoll' && state.turnPhase !== 'defensiveRoll') {
        return fail('invalid_phase');
    }
    
    const rollerId = getRollerId(state);
    if (!isMoveAllowed(playerId, rollerId)) {
        return fail('player_mismatch');
    }
    
    if (state.rollCount === 0) {
        return fail('no_roll_yet');
    }
    
    return ok();
};

/**
 * 验证选择技能命令
 */
const validateSelectAbility = (
    state: DiceThroneCore,
    cmd: SelectAbilityCommand,
    playerId: PlayerId
): ValidationResult => {
    const { abilityId } = cmd.payload;
    
    if (state.turnPhase === 'defensiveRoll') {
        if (!state.pendingAttack) {
            return fail('no_pending_attack');
        }
        if (!isMoveAllowed(playerId, state.pendingAttack.defenderId)) {
            return fail('player_mismatch');
        }
        // 实时计算可用技能（派生状态）
        const availableAbilityIds = getAvailableAbilityIds(state, state.pendingAttack.defenderId);
        if (!availableAbilityIds.includes(abilityId)) {
            return fail('ability_not_available');
        }
        return ok();
    }
    
    if (state.turnPhase !== 'offensiveRoll') {
        return fail('invalid_phase');
    }
    
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    
    if (!state.rollConfirmed) {
        return fail('roll_not_confirmed');
    }
    
    // 实时计算可用技能（派生状态）
    const availableAbilityIds = getAvailableAbilityIds(state, state.activePlayerId);
    if (!availableAbilityIds.includes(abilityId)) {
        return fail('ability_not_available');
    }
    
    return ok();
};

/**
 * 验证抽牌命令
 */
const validateDrawCard = (
    state: DiceThroneCore,
    _cmd: DrawCardCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    
    const player = state.players[state.activePlayerId];
    if (!player) {
        return fail('player_not_found');
    }

    // 允许牌库为空但弃牌堆不为空：会在 execute 层触发洗牌事件
    if (player.deck.length === 0 && player.discard.length === 0) {
        return fail('deck_empty');
    }
    
    return ok();
};

/**
 * 验证弃牌命令
 */
const validateDiscardCard = (
    state: DiceThroneCore,
    cmd: DiscardCardCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    
    const player = state.players[state.activePlayerId];
    if (!player) {
        return fail('player_not_found');
    }
    
    const card = player.hand.find(c => c.id === cmd.payload.cardId);
    if (!card) {
        return fail('card_not_in_hand');
    }
    
    return ok();
};

/**
 * 验证售卖卡牌命令
 */
const validateSellCard = (
    state: DiceThroneCore,
    cmd: SellCardCommand,
    playerId: PlayerId
): ValidationResult => {
    // 售卖仅限当前回合玩家，且仅在主要阶段与弃牌阶段
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    if (state.turnPhase !== 'main1' && state.turnPhase !== 'main2' && state.turnPhase !== 'discard') {
        return fail('invalid_phase');
    }
    
    const player = state.players[state.activePlayerId];
    if (!player) {
        return fail('player_not_found');
    }
    
    const card = player.hand.find(c => c.id === cmd.payload.cardId);
    if (!card) {
        return fail('card_not_in_hand');
    }
    
    return ok();
};

/**
 * 验证撤回售卖命令
 */
const validateUndoSellCard = (
    state: DiceThroneCore,
    _cmd: UndoSellCardCommand,
    playerId: PlayerId
): ValidationResult => {
    // 撤回售卖仅限当前回合玩家，且仅在主要阶段与弃牌阶段
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    if (state.turnPhase !== 'main1' && state.turnPhase !== 'main2' && state.turnPhase !== 'discard') {
        return fail('invalid_phase');
    }
    
    if (!state.lastSoldCardId) {
        return fail('no_card_to_undo');
    }
    
    const player = state.players[state.activePlayerId];
    if (!player) {
        return fail('player_not_found');
    }
    
    const card = player.discard.find(c => c.id === state.lastSoldCardId);
    if (!card) {
        return fail('card_not_in_discard');
    }
    
    return ok();
};

/**
 * 验证重排卡牌命令
 */
const validateReorderCardToEnd = (
    state: DiceThroneCore,
    cmd: ReorderCardToEndCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    
    const player = state.players[state.activePlayerId];
    if (!player) {
        return fail('player_not_found');
    }
    
    const cardIndex = player.hand.findIndex(c => c.id === cmd.payload.cardId);
    if (cardIndex === -1) {
        return fail('card_not_in_hand');
    }
    
    return ok();
};

/**
 * 验证打出卡牌命令
 */
const validatePlayCard = (
    state: DiceThroneCore,
    cmd: PlayCardCommand,
    playerId: PlayerId
): ValidationResult => {
    const actingPlayerId = playerId;

    const player = state.players[actingPlayerId];
    if (!player) {
        console.warn('[validatePlayCard] 验证失败 - 玩家不存在:', { playerId: actingPlayerId });
        return fail('player_not_found');
    }
    
    const card = player.hand.find(c => c.id === cmd.payload.cardId);
    if (!card) {
        console.warn('[validatePlayCard] 验证失败 - 卡牌不在手牌中:', {
            playerId: actingPlayerId,
            cardId: cmd.payload.cardId,
            handCardIds: player.hand.map(c => c.id),
        });
        return fail('card_not_in_hand');
    }

    // 主要阶段牌：仅允许当前回合玩家
    if (card.timing === 'main' && !isMoveAllowed(playerId, state.activePlayerId)) {
        console.warn('[validatePlayCard] 验证失败 - 主要阶段牌只能由当前玩家打出:', {
            playerId,
            activePlayerId: state.activePlayerId,
            cardTiming: card.timing,
        });
        return fail('player_mismatch');
    }

    // 使用 checkPlayCard 获取详细原因（阶段/CP 校验等）
    const checkResult = checkPlayCard(state, actingPlayerId, card);
    if (!checkResult.ok) {
        console.warn('[validatePlayCard] 验证失败 - checkPlayCard 返回错误:', {
            playerId: actingPlayerId,
            cardId: card.id,
            cardType: card.type,
            cardTiming: card.timing,
            cpCost: card.cpCost,
            playerCP: player.resources[RESOURCE_IDS.CP] ?? 0,
            currentPhase: state.turnPhase,
            reason: checkResult.reason,
        });
        return fail(checkResult.reason);
    }
    
    console.log('[validatePlayCard] 验证成功:', {
        playerId: actingPlayerId,
        cardId: card.id,
        cardType: card.type,
    });
    return ok();
};

/**
 * 验证打出升级卡命令
 */
const validatePlayUpgradeCard = (
    state: DiceThroneCore,
    cmd: PlayUpgradeCardCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    
    const player = state.players[state.activePlayerId];
    if (!player) {
        return fail('player_not_found');
    }
    
    const card = player.hand.find(c => c.id === cmd.payload.cardId);
    if (!card) {
        return fail('card_not_in_hand');
    }
    
    // 使用 checkPlayUpgradeCard 获取详细原因
    const checkResult = checkPlayUpgradeCard(state, playerId, card, cmd.payload.targetAbilityId);
    if (!checkResult.ok) {
        return fail(checkResult.reason);
    }
    
    return ok();
};

/**
 * 验证解决选择命令
 * 注意：pendingChoice 已迁移到 sys.prompt，这里仅做基础验证
 */
const validateResolveChoice = (
    _state: DiceThroneCore,
    _cmd: ResolveChoiceCommand,
    _playerId: PlayerId
): ValidationResult => {
    // 实际验证需在 pipeline 层通过 sys.prompt 进行
    return ok();
};

/**
 * 验证推进阶段命令
 */
const validateAdvancePhase = (
    state: DiceThroneCore,
    _cmd: AdvancePhaseCommand,
    playerId: PlayerId
): ValidationResult => {
    // 防御阶段由防御方结束，其他阶段由 activePlayer 推进
    const allowedPlayerId = state.turnPhase === 'defensiveRoll'
        ? getRollerId(state)
        : state.activePlayerId;
    
    if (!isMoveAllowed(playerId, allowedPlayerId)) {
        return fail('player_mismatch');
    }
    
    if (!canAdvancePhase(state)) {
        return fail('cannot_advance_phase');
    }
    
    return ok();
};

/**
 * 验证跳过响应窗口命令
 * 注意：实际验证由 ResponseWindowSystem 在 beforeCommand hook 中处理
 */
const validateResponsePass = (
    _state: DiceThroneCore,
    _cmd: ResponsePassCommand,
    _playerId: PlayerId
): ValidationResult => {
    // 实际验证由系统层处理
    return ok();
};

/**
 * 验证修改骰子命令
 */
const validateModifyDie = (
    state: DiceThroneCore,
    cmd: ModifyDieCommand,
    playerId: PlayerId
): ValidationResult => {
    // 检查是否有待处理的交互
    if (!state.pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (state.pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    // 检查骰子是否存在
    const die = state.dice.find(d => d.id === cmd.payload.dieId);
    if (!die) {
        return fail('die_not_found');
    }
    // 检查新值是否在范围内
    if (cmd.payload.newValue < 1 || cmd.payload.newValue > 6) {
        return fail('invalid_die_value');
    }
    return ok();
};

/**
 * 验证重掷骰子命令
 */
const validateRerollDie = (
    state: DiceThroneCore,
    cmd: RerollDieCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (state.pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    const die = state.dice.find(d => d.id === cmd.payload.dieId);
    if (!die) {
        return fail('die_not_found');
    }
    return ok();
};

/**
 * 验证移除状态效果命令
 */
const validateRemoveStatus = (
    state: DiceThroneCore,
    _cmd: RemoveStatusCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (state.pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    return ok();
};

/**
 * 验证转移状态效果命令
 */
const validateTransferStatus = (
    state: DiceThroneCore,
    _cmd: TransferStatusCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (state.pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    return ok();
};

/**
 * 验证确认交互命令
 */
const validateConfirmInteraction = (
    state: DiceThroneCore,
    cmd: ConfirmInteractionCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (state.pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    if (state.pendingInteraction.id !== cmd.payload.interactionId) {
        return fail('interaction_id_mismatch');
    }
    return ok();
};

/**
 * 验证取消交互命令
 */
const validateCancelInteraction = (
    state: DiceThroneCore,
    _cmd: CancelInteractionCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (state.pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    return ok();
};

/**
 * 验证使用 Token 命令（伤害响应窗口）
 */
const validateUseToken = (
    state: DiceThroneCore,
    cmd: UseTokenCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingDamage) {
        return fail('no_pending_damage');
    }
    if (!isMoveAllowed(playerId, state.pendingDamage.responderId)) {
        return fail('player_mismatch');
    }

    const tokenDef = state.tokenDefinitions.find(t => t.id === cmd.payload.tokenId);
    if (!tokenDef) {
        return fail('unknown_token');
    }

    const p = state.players[playerId];
    const currentAmount = p?.tokens[cmd.payload.tokenId] ?? 0;
    if (currentAmount <= 0) {
        return fail('no_token');
    }

    if (cmd.payload.amount <= 0) {
        return fail('invalid_amount');
    }

    return ok();
};

/**
 * 验证跳过 Token 响应命令
 */
const validateSkipTokenResponse = (
    state: DiceThroneCore,
    _cmd: SkipTokenResponseCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingDamage) {
        return fail('no_pending_damage');
    }
    if (!isMoveAllowed(playerId, state.pendingDamage.responderId)) {
        return fail('player_mismatch');
    }
    return ok();
};

/**
 * 验证使用净化 Token 命令（独立于伤害流程）
 */
const validateUsePurify = (
    state: DiceThroneCore,
    cmd: UsePurifyCommand,
    playerId: PlayerId
): ValidationResult => {
    const p = state.players[playerId];
    if (!p) {
        return fail('player_not_found');
    }
    const amount = p.tokens['purify'] ?? 0;
    if (amount <= 0) {
        return fail('no_token');
    }
    const stacks = p.statusEffects[cmd.payload.statusId] ?? 0;
    if (stacks <= 0) {
        return fail('no_status');
    }
    return ok();
};

/**
 * 验证花费 CP 移除击倒命令
 * 规则：攻击掷骰阶段前可花费 2CP 移除击倒标记
 */
const validatePayToRemoveStun = (
    state: DiceThroneCore,
    _cmd: PayToRemoveStunCommand,
    playerId: PlayerId
): ValidationResult => {
    // 只能在自己回合的主要阶段使用（offensiveRoll 前）
    if (state.turnPhase !== 'upkeep' && state.turnPhase !== 'income' && state.turnPhase !== 'main1') {
        return fail('invalid_phase');
    }
    
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    
    const p = state.players[playerId];
    if (!p) {
        return fail('player_not_found');
    }
    
    // 检查是否有击倒状态
    const stunStacks = p.statusEffects['stun'] ?? 0;
    if (stunStacks <= 0) {
        return fail('no_stun');
    }
    
    // 检查 CP 是否足够
    const cp = p.resources[RESOURCE_IDS.CP] ?? 0;
    if (cp < 2) {
        return fail('not_enough_cp');
    }
    
    return ok();
};

// ============================================================================
// 主验证入口
// ============================================================================

/**
 * 验证命令
 */
export const validateCommand = (
    state: DiceThroneCore,
    command: DiceThroneCommand
): ValidationResult => {
    if (command.type.startsWith('SYS_')) {
        return ok();
    }

    const playerId = command.playerId;
    switch (command.type) {
        case 'ROLL_DICE':
            return validateRollDice(state, command, playerId);
        case 'ROLL_BONUS_DIE':
            return validateRollBonusDie(state, command, playerId);
        case 'TOGGLE_DIE_LOCK':
            return validateToggleDieLock(state, command, playerId);
        case 'CONFIRM_ROLL':
            return validateConfirmRoll(state, command, playerId);
        case 'SELECT_ABILITY':
            return validateSelectAbility(state, command, playerId);
        case 'DRAW_CARD':
            return validateDrawCard(state, command, playerId);
        case 'DISCARD_CARD':
            return validateDiscardCard(state, command, playerId);
        case 'SELL_CARD':
            return validateSellCard(state, command, playerId);
        case 'UNDO_SELL_CARD':
            return validateUndoSellCard(state, command, playerId);
        case 'REORDER_CARD_TO_END':
            return validateReorderCardToEnd(state, command, playerId);
        case 'PLAY_CARD':
            return validatePlayCard(state, command, playerId);
        case 'PLAY_UPGRADE_CARD':
            return validatePlayUpgradeCard(state, command, playerId);
        case 'RESOLVE_CHOICE':
            return validateResolveChoice(state, command, playerId);
        case 'ADVANCE_PHASE':
            return validateAdvancePhase(state, command, playerId);
        case 'RESPONSE_PASS':
            return validateResponsePass(state, command, playerId);
        case 'MODIFY_DIE':
            return validateModifyDie(state, command, playerId);
        case 'REROLL_DIE':
            return validateRerollDie(state, command, playerId);
        case 'REMOVE_STATUS':
            return validateRemoveStatus(state, command, playerId);
        case 'TRANSFER_STATUS':
            return validateTransferStatus(state, command, playerId);
        case 'CONFIRM_INTERACTION':
            return validateConfirmInteraction(state, command, playerId);
        case 'CANCEL_INTERACTION':
            return validateCancelInteraction(state, command, playerId);
        case 'USE_TOKEN':
            return validateUseToken(state, command, playerId);
        case 'SKIP_TOKEN_RESPONSE':
            return validateSkipTokenResponse(state, command, playerId);
        case 'USE_PURIFY':
            return validateUsePurify(state, command, playerId);
        case 'PAY_TO_REMOVE_STUN':
            return validatePayToRemoveStun(state, command, playerId);
        default: {
            const _exhaustive: never = command;
            return fail(`unknown_command: ${(_exhaustive as DiceThroneCommand).type}`);
        }
    }
};
