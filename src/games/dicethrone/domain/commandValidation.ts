/**
 * DiceThrone 命令验证
 * 从 game.ts 各 move 的校验逻辑抽取
 */

import type { ValidationResult, PlayerId } from '../../../engine/types';
import type {
    InteractionDescriptor,
    DiceThroneCore,
    DiceThroneCommand,
    TurnPhase,
    RollDiceCommand,
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
    SelectCharacterCommand,
    HostStartGameCommand,
    PlayerReadyCommand,
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
    PayToRemoveKnockdownCommand,
    RerollBonusDieCommand,
    SkipBonusDiceRerollCommand,
    UsePassiveAbilityCommand,
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
import { STATUS_IDS, DICETHRONE_COMMANDS, TOKEN_IDS } from './ids';
import { DICETHRONE_CHARACTER_CATALOG } from './core-types';

// ============================================================================
// 验证函数
// ============================================================================

const ok = (): ValidationResult => ({ valid: true });
const fail = (error: string): ValidationResult => ({ valid: false, error });
const SELECTABLE_CHARACTER_ID_SET = new Set<string>(DICETHRONE_CHARACTER_CATALOG.map(character => character.id));

const isCommandType = <TType extends DiceThroneCommand['type']>(
    command: DiceThroneCommand,
    type: TType
): command is Extract<DiceThroneCommand, { type: TType }> => command.type === type;

/**
 * 验证掷骰命令
 */
const validateRollDice = (
    state: DiceThroneCore,
    _cmd: RollDiceCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') {
        return fail('invalid_phase');
    }

    const rollerId = getRollerId(state, phase);
    if (!isMoveAllowed(playerId, rollerId)) {
        return fail('player_mismatch');
    }

    if (state.rollCount >= state.rollLimit) {
        return fail('roll_limit_reached');
    }

    // 防御阶段必须先选择防御技能才能掷骰（规则 §3.6 步骤 2→3）
    if (phase === 'defensiveRoll' && state.pendingAttack && !state.pendingAttack.defenseAbilityId) {
        return fail('defense_ability_not_selected');
    }

    return ok();
}

/**
 * 验证选择角色命令
 */
const validateSelectCharacter = (
    state: DiceThroneCore,
    cmd: SelectCharacterCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'setup') {
        return fail('invalid_phase');
    }

    if (!state.players[playerId]) {
        return fail('player_not_found');
    }

    if (!cmd.payload.characterId) {
        return fail('invalid_character');
    }

    if (!SELECTABLE_CHARACTER_ID_SET.has(cmd.payload.characterId)) {
        return fail('unsupported_character');
    }

    return ok();
};

/**
 * 验证房主开始命令
 */
const validateHostStartGame = (
    state: DiceThroneCore,
    _cmd: HostStartGameCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'setup') {
        return fail('invalid_phase');
    }

    if (!isMoveAllowed(playerId, state.hostPlayerId)) {
        return fail('player_mismatch');
    }

    return ok();
};

/**
 * 验证玩家准备命令
 */
const validatePlayerReady = (
    state: DiceThroneCore,
    _cmd: PlayerReadyCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'setup') {
        return fail('invalid_phase');
    }

    // 必须已选角才能准备
    const char = state.selectedCharacters[playerId];
    if (!char || char === 'unselected') {
        return fail('character_not_selected');
    }

    return ok();
};

/**
 * 验证锁定骰子命令
 */
const validateToggleDieLock = (
    state: DiceThroneCore,
    cmd: ToggleDieLockCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    // 只允许在进攻阶段锁定骰子
    if (phase !== 'offensiveRoll') {
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
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') {
        return fail('invalid_phase');
    }
    
    const rollerId = getRollerId(state, phase);
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
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    const { abilityId } = cmd.payload;
    
    if (phase === 'defensiveRoll') {
        if (!state.pendingAttack) {
            return fail('no_pending_attack');
        }
        if (!isMoveAllowed(playerId, state.pendingAttack.defenderId)) {
            return fail('player_mismatch');
        }

        // 防御阶段分两步：
        // 1. 掷骰前选择/切换防御技能（规则 §3.6 步骤 2）：只需验证玩家拥有该防御技能
        //    暗影刺客等拥有多个防御技能的英雄，在投掷前可以自由切换选择
        // 2. 掷骰后确认骰面后的技能激活：用 getAvailableAbilityIds 检查骰面
        if (state.rollCount === 0) {
            // 掷骰前选择/切换：验证玩家拥有该防御技能（不检查骰面）
            const defender = state.players[state.pendingAttack.defenderId];
            if (!defender) return fail('player_not_found');
            const hasAbility = defender.abilities.some(a => {
                if (a.type !== 'defensive') return false;
                if (a.id === abilityId) return true;
                return a.variants?.some(v => v.id === abilityId) ?? false;
            });
            if (!hasAbility) {
                return fail('ability_not_available');
            }
            return ok();
        }

        // 掷骰后选择：实时计算可用技能（派生状态）
        const availableAbilityIds = getAvailableAbilityIds(state, state.pendingAttack.defenderId, phase);
        if (!availableAbilityIds.includes(abilityId)) {
            return fail('ability_not_available');
        }
        return ok();
    }
    
    if (phase !== 'offensiveRoll') {
        return fail('invalid_phase');
    }
    
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    
    if (!state.rollConfirmed) {
        return fail('roll_not_confirmed');
    }
    
    // 实时计算可用技能（派生状态）
    const availableAbilityIds = getAvailableAbilityIds(state, state.activePlayerId, phase);
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
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    // 售卖仅限当前回合玩家，且仅在主要阶段与弃牌阶段
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    if (phase !== 'main1' && phase !== 'main2' && phase !== 'discard') {
        return fail('invalid_phase');
    }
    
    const player = state.players[state.activePlayerId];
    if (!player) {
        return fail('player_not_found');
    }
    
    const card = player.hand.find(c => c.id === cmd.payload.cardId);
    if (!card) {
        console.warn('[validateSellCard] 卡牌不在手牌中:', {
            playerId: state.activePlayerId,
            cardId: cmd.payload.cardId,
            handCardIds: player.hand.map(c => c.id),
        });
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
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    // 撤回售卖仅限当前回合玩家，且仅在主要阶段与弃牌阶段
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    if (phase !== 'main1' && phase !== 'main2' && phase !== 'discard') {
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
        console.warn('[validateReorderCardToEnd] 卡牌不在手牌中:', {
            playerId: state.activePlayerId,
            cardId: cmd.payload.cardId,
            handCardIds: player.hand.map(c => c.id),
        });
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
    playerId: PlayerId,
    phase: TurnPhase
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
    const checkResult = checkPlayCard(state, actingPlayerId, card, phase);
    if (!checkResult.ok) {
        console.warn('[validatePlayCard] 验证失败 - checkPlayCard 返回错误:', {
            playerId: actingPlayerId,
            cardId: card.id,
            cardType: card.type,
            cardTiming: card.timing,
            cpCost: card.cpCost,
            playerCP: player.resources[RESOURCE_IDS.CP] ?? 0,
            currentPhase: phase,
            diceCount: state.dice.length,
            rollCount: state.rollCount,
            rollConfirmed: state.rollConfirmed,
            playCondition: card.playCondition,
            reason: checkResult.reason,
        });
        return fail(checkResult.reason);
    }
    
    return ok();
};

/**
 * 验证打出升级卡命令
 */
const validatePlayUpgradeCard = (
    state: DiceThroneCore,
    cmd: PlayUpgradeCardCommand,
    playerId: PlayerId,
    phase: TurnPhase
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
        console.warn('[validatePlayUpgradeCard] 卡牌不在手牌中:', {
            playerId: state.activePlayerId,
            cardId: cmd.payload.cardId,
            handCardIds: player.hand.map(c => c.id),
        });
        return fail('card_not_in_hand');
    }
    
    // 使用 checkPlayUpgradeCard 获取详细原因
    const checkResult = checkPlayUpgradeCard(state, playerId, card, cmd.payload.targetAbilityId, phase);
    if (!checkResult.ok) {
        return fail(checkResult.reason);
    }
    
    return ok();
};

/**
 * 验证解决选择命令
 * 注意：pendingChoice 已迁移到 sys.interaction，这里仅做基础验证
 */
 
const validateResolveChoice = (
    _state: DiceThroneCore,
    _cmd: ResolveChoiceCommand,
    _playerId: PlayerId
): ValidationResult => {
    // 实际验证需在 pipeline 层通过 sys.interaction 进行
    return ok();
};
 

/**
 * 验证推进阶段命令
 */
const validateAdvancePhase = (
    state: DiceThroneCore,
    _cmd: AdvancePhaseCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    // 防御阶段由防御方结束，其他阶段由 activePlayer 推进
    const allowedPlayerId = phase === 'defensiveRoll'
        ? getRollerId(state, phase)
        : state.activePlayerId;
    
    if (!isMoveAllowed(playerId, allowedPlayerId)) {
        return fail('player_mismatch');
    }
    
    if (!canAdvancePhase(state, phase)) {
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
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    // 检查是否有待处理的交互（从 sys.interaction 读取）
    if (!pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (pendingInteraction.playerId !== playerId) {
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
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    if (!pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (pendingInteraction.playerId !== playerId) {
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
    _state: DiceThroneCore,
    _cmd: RemoveStatusCommand,
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    if (!pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    return ok();
};

/**
 * 验证转移状态效果命令
 */
const validateTransferStatus = (
    _state: DiceThroneCore,
    _cmd: TransferStatusCommand,
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    if (!pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    return ok();
};

/**
 * 验证确认交互命令
 * @deprecated 已废弃 - 使用 InteractionSystem 的 RESPOND 命令
 */
/*
const validateConfirmInteraction = (
    _state: DiceThroneCore,
    cmd: ConfirmInteractionCommand,
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    if (!pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    if (pendingInteraction.id !== cmd.payload.interactionId) {
        return fail('interaction_id_mismatch');
    }
    return ok();
};
*/

/**
 * 验证取消交互命令
 * @deprecated 已废弃 - 使用 InteractionSystem 的 CANCEL 命令
 */
/*
const validateCancelInteraction = (
    _state: DiceThroneCore,
    _cmd: CancelInteractionCommand,
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    if (!pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    return ok();
};
*/

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
    const amount = p.tokens[TOKEN_IDS.PURIFY] ?? 0;
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
const validatePayToRemoveKnockdown = (
    state: DiceThroneCore,
    _cmd: PayToRemoveKnockdownCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    // 只能在自己回合的主要阶段使用（offensiveRoll 前）
    if (phase !== 'upkeep' && phase !== 'income' && phase !== 'main1') {
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
    const knockdownStacks = p.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
    if (knockdownStacks <= 0) {
        return fail('no_knockdown');
    }
    
    // 检查 CP 是否足够
    const cp = p.resources[RESOURCE_IDS.CP] ?? 0;
    if (cp < 2) {
        return fail('not_enough_cp');
    }
    
    return ok();
};

/**
 * 验证重掷奖励骰命令
 */
const validateRerollBonusDie = (
    state: DiceThroneCore,
    cmd: RerollBonusDieCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingBonusDiceSettlement) {
        return fail('no_pending_bonus_dice');
    }
    if (!isMoveAllowed(playerId, state.pendingBonusDiceSettlement.attackerId)) {
        return fail('player_mismatch');
    }
    const { rerollCount, maxRerollCount } = state.pendingBonusDiceSettlement;
    if (maxRerollCount !== undefined && rerollCount >= maxRerollCount) {
        return fail('bonus_reroll_limit_reached');
    }
    // 检查 Token 是否足够
    const p = state.players[playerId];
    const tokenId = state.pendingBonusDiceSettlement.rerollCostTokenId;
    const costAmount = state.pendingBonusDiceSettlement.rerollCostAmount;
    const currentAmount = p?.tokens?.[tokenId] ?? 0;
    if (currentAmount < costAmount) {
        return fail('not_enough_token');
    }
    // 检查骰子索引是否有效
    const dieIndex = cmd.payload.dieIndex;
    const die = state.pendingBonusDiceSettlement.dice.find(d => d.index === dieIndex);
    if (!die) {
        return fail('invalid_die_index');
    }
    return ok();
};

/**
 * 验证跳过奖励骰重掷命令
 */
const validateSkipBonusDiceReroll = (
    state: DiceThroneCore,
    _cmd: SkipBonusDiceRerollCommand,
    playerId: PlayerId
): ValidationResult => {
    if (!state.pendingBonusDiceSettlement) {
        return fail('no_pending_bonus_dice');
    }
    if (!isMoveAllowed(playerId, state.pendingBonusDiceSettlement.attackerId)) {
        return fail('player_mismatch');
    }
    return ok();
};

/**
 * 验证使用被动能力命令（如教皇税：花费 CP 重掷/抽牌）
 */
const validateUsePassiveAbility = (
    state: DiceThroneCore,
    cmd: UsePassiveAbilityCommand,
    playerId: PlayerId,
    _phase: TurnPhase,
): ValidationResult => {
    const player = state.players[playerId];
    if (!player) return fail('player_not_found');

    const passives = player.passiveAbilities ?? [];
    const passive = passives.find(p => p.id === cmd.payload.passiveId);
    if (!passive) return fail('passive_not_found');

    const action = passive.actions[cmd.payload.actionIndex];
    if (!action) return fail('action_not_found');

    // CP 检查
    const cp = player.resources[RESOURCE_IDS.CP] ?? 0;
    if (cp < action.cpCost) return fail('not_enough_cp');

    // rerollDie 需要 targetDieId
    if (action.type === 'rerollDie' && cmd.payload.targetDieId === undefined) {
        return fail('target_die_required');
    }

    // rerollDie 需要在投掷阶段且有骰子
    if (action.type === 'rerollDie' && cmd.payload.targetDieId !== undefined) {
        const die = state.dice.find(d => d.id === cmd.payload.targetDieId);
        if (!die) {
            console.warn('[validateUsePassiveAbility] 骰子不存在:', {
                playerId,
                targetDieId: cmd.payload.targetDieId,
                diceIds: state.dice.map(d => d.id),
            });
            return fail('die_not_found');
        }
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
    command: DiceThroneCommand,
    phase: TurnPhase,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    if (command.type.startsWith('SYS_')) {
        return ok();
    }

    const playerId = command.playerId;
    if (isCommandType(command, 'ROLL_DICE')) return validateRollDice(state, command, playerId, phase);
    if (isCommandType(command, 'TOGGLE_DIE_LOCK')) return validateToggleDieLock(state, command, playerId, phase);
    if (isCommandType(command, 'CONFIRM_ROLL')) return validateConfirmRoll(state, command, playerId, phase);
    if (isCommandType(command, 'SELECT_ABILITY')) return validateSelectAbility(state, command, playerId, phase);
    if (isCommandType(command, 'DRAW_CARD')) return validateDrawCard(state, command, playerId);
    if (isCommandType(command, 'DISCARD_CARD')) return validateDiscardCard(state, command, playerId);
    if (isCommandType(command, 'SELL_CARD')) return validateSellCard(state, command, playerId, phase);
    if (isCommandType(command, 'UNDO_SELL_CARD')) return validateUndoSellCard(state, command, playerId, phase);
    if (isCommandType(command, 'REORDER_CARD_TO_END')) return validateReorderCardToEnd(state, command, playerId);
    if (isCommandType(command, 'PLAY_CARD')) return validatePlayCard(state, command, playerId, phase);
    if (isCommandType(command, 'PLAY_UPGRADE_CARD')) return validatePlayUpgradeCard(state, command, playerId, phase);
    if (isCommandType(command, 'RESOLVE_CHOICE')) return validateResolveChoice(state, command, playerId);
    if (isCommandType(command, 'ADVANCE_PHASE')) return validateAdvancePhase(state, command, playerId, phase);
    if (isCommandType(command, 'SELECT_CHARACTER')) return validateSelectCharacter(state, command, playerId, phase);
    if (isCommandType(command, 'HOST_START_GAME')) return validateHostStartGame(state, command, playerId, phase);
    if (isCommandType(command, 'PLAYER_READY')) return validatePlayerReady(state, command, playerId, phase);
    if (isCommandType(command, 'RESPONSE_PASS')) return validateResponsePass(state, command, playerId);
    if (isCommandType(command, 'MODIFY_DIE')) return validateModifyDie(state, command, playerId, pendingInteraction);
    if (isCommandType(command, 'REROLL_DIE')) return validateRerollDie(state, command, playerId, pendingInteraction);
    if (isCommandType(command, 'REMOVE_STATUS')) return validateRemoveStatus(state, command, playerId, pendingInteraction);
    if (isCommandType(command, 'TRANSFER_STATUS')) return validateTransferStatus(state, command, playerId, pendingInteraction);
    // if (isCommandType(command, 'CONFIRM_INTERACTION')) return validateConfirmInteraction(state, command, playerId, pendingInteraction);
    // if (isCommandType(command, 'CANCEL_INTERACTION')) return validateCancelInteraction(state, command, playerId, pendingInteraction);
    if (isCommandType(command, 'USE_TOKEN')) return validateUseToken(state, command, playerId);
    if (isCommandType(command, 'SKIP_TOKEN_RESPONSE')) return validateSkipTokenResponse(state, command, playerId);
    if (isCommandType(command, 'USE_PURIFY')) return validateUsePurify(state, command, playerId);
    if (isCommandType(command, DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN)) {
        return validatePayToRemoveKnockdown(state, command, playerId, phase);
    }
    if (isCommandType(command, 'REROLL_BONUS_DIE')) return validateRerollBonusDie(state, command, playerId);
    if (isCommandType(command, 'SKIP_BONUS_DICE_REROLL')) return validateSkipBonusDiceReroll(state, command, playerId);
    if (isCommandType(command, 'USE_PASSIVE_ABILITY')) return validateUsePassiveAbility(state, command, playerId, phase);

    const _exhaustive: never = command;
    return fail(`unknown_command: ${(_exhaustive as DiceThroneCommand).type}`);
};
