/**
 * DiceThrone 命令验证
 * 从 game.ts 各 move 的校验逻辑抽取
 */

import type { ValidationResult, PlayerId, ResponseWindowState } from '../../../engine/types';
import type {
    InteractionDescriptor,
    DiceThroneCore,
    DiceThroneCommand,
    TurnPhase,
    DtResponseWindowType,
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
    MoveSeatCommand,
    RequestSeatSwapCommand,
    RespondSeatSwapCommand,
    CancelSeatSwapCommand,
    PlayerReadyCommand,
    PlayerUnreadyCommand,
    ResponsePassCommand,
    ModifyDieCommand,
    RerollDieCommand,
    RemoveStatusCommand,
    TransferStatusCommand,
    ResolveInteractionCommand,
    UseTokenCommand,
    SkipTokenResponseCommand,
    UsePurifyCommand,
    PayToRemoveKnockdownCommand,
    RerollBonusDieCommand,
    SkipBonusDiceRerollCommand,
    UsePassiveAbilityCommand,
    GrantTokensCommand,
    PendingDefenderChoice,
    SelectDefenderTargetCommand,
} from './types';
import {
    getRollerId,
    isMoveAllowed,
    canAdvancePhase,
    isSetupReadyToStart,
    checkPlayCard,
    checkPlayUpgradeCard,
    getAvailableAbilityIds,
    getActiveDice,
    getAttackSnapshotDieIndex,
    getSeatingOrder,
    isAttackSnapshotDieId,
} from './rules';
import { findPlayerAbility } from './abilityLookup';
import { RESOURCE_IDS } from './resources';
import { getPassiveActionTokenCosts, isPassiveActionUsable } from './passiveAbility';
import { STATUS_IDS, DICETHRONE_COMMANDS, TOKEN_IDS } from './ids';
import { DICETHRONE_CHARACTER_CATALOG } from './core-types';
import { getUsableTokenAmountForTiming } from './tokenResponse';
import { getTokenUseOptions } from './tokenTypes';
import { getGameMode } from './utils';
import { canRemoveStatusFromPlayer, isPurifiableDebuffId, isRemovableStatusId } from './statusRemoval';
import { isDirectDiceInterferenceActor } from './responseWindowGuards';
import { findCurrentRollDie, getCurrentRollDice, isCurrentBonusRollSettlement, resolveCurrentRollContext } from './rollContext';

// ============================================================================
// 验证函数
// ============================================================================

const ok = (): ValidationResult => ({ valid: true });
const fail = (error: string): ValidationResult => ({ valid: false, error });
const SELECTABLE_CHARACTER_ID_SET = new Set<string>(DICETHRONE_CHARACTER_CATALOG.map(character => character.id));

const getCurrentResponseWindowResponderId = (
    currentWindow: ResponseWindowState['current'] | undefined,
): PlayerId | undefined => {
    if (!currentWindow) return undefined;
    return currentWindow.responderQueue[currentWindow.currentResponderIndex];
};

const validateCurrentResponseWindowActor = (
    state: DiceThroneCore,
    currentWindow: ResponseWindowState['current'] | undefined,
    actingPlayerId: PlayerId,
    allowDirectInterferenceActor = false,
): ValidationResult => {
    if (!currentWindow) {
        return ok();
    }

    const currentResponderId = getCurrentResponseWindowResponderId(currentWindow);
    const isCurrentResponder = currentResponderId === actingPlayerId;
    const isAllowedDirectInterference = allowDirectInterferenceActor
        && isDirectDiceInterferenceActor(state, currentWindow, actingPlayerId);
    if (!isCurrentResponder && !isAllowedDirectInterference) {
        return fail('not_current_responder');
    }

    return ok();
};

const getActionBlockedByStunLikeStatus = (
    state: DiceThroneCore,
    playerId: PlayerId,
): string | null => {
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return null;
    }

    const player = state.players[playerId];
    if (!player) {
        return null;
    }

    const dazeStacks = player.statusEffects[STATUS_IDS.DAZE] ?? 0;
    if (dazeStacks > 0) {
        return 'player_is_dazed';
    }

    const stunStacks = player.statusEffects[STATUS_IDS.STUN] ?? 0;
    if (stunStacks > 0) {
        return 'player_is_stunned';
    }

    return null;
};

const isCommandType = <TType extends DiceThroneCommand['type']>(
    command: DiceThroneCommand,
    type: TType
): command is Extract<DiceThroneCommand, { type: TType }> => command.type === type;

type ValidationInteractionDescriptor = InteractionDescriptor & {
    allowedDieIds?: number[];
    completedDieIds?: number[];
};

const getValidationInteraction = (
    pendingInteraction?: InteractionDescriptor
): ValidationInteractionDescriptor | undefined => pendingInteraction as ValidationInteractionDescriptor | undefined;

const getInteractionTargetPlayerIds = (
    state: DiceThroneCore,
    pendingInteraction: InteractionDescriptor
): PlayerId[] => pendingInteraction.targetPlayerIds?.length
    ? pendingInteraction.targetPlayerIds
    : Object.keys(state.players);

const playerHasStatusOrToken = (
    state: DiceThroneCore,
    playerId: PlayerId,
    statusId?: string
): boolean => {
    const player = state.players[playerId];
    if (!player) return false;
    if (statusId) {
        if (!isRemovableStatusId(state, statusId)) {
            return false;
        }
        return (player.statusEffects[statusId] ?? 0) > 0 || (player.tokens[statusId] ?? 0) > 0;
    }
    return Object.entries(player.statusEffects).some(([effectId, value]) => value > 0 && isRemovableStatusId(state, effectId))
        || Object.entries(player.tokens).some(([effectId, value]) => value > 0 && isRemovableStatusId(state, effectId));
};

const getRemainingDieInteractionSlots = (
    pendingInteraction: InteractionDescriptor | undefined,
): number | undefined => {
    const interaction = getValidationInteraction(pendingInteraction);
    if (!interaction) return undefined;
    const allowedDieIds = interaction.allowedDieIds?.length
        ? interaction.allowedDieIds
        : undefined;
    const selectCount = interaction.selectCount ?? allowedDieIds?.length;
    if (typeof selectCount !== 'number' || !Number.isFinite(selectCount)) {
        return undefined;
    }
    const completedDieIds = Array.from(new Set((interaction.completedDieIds ?? []).filter(id => typeof id === 'number')));
    return Math.max(0, selectCount - completedDieIds.length);
};

const validateInteractionOwnership = (
    pendingInteraction: InteractionDescriptor | undefined,
    playerId: PlayerId
): ValidationResult | null => {
    if (!pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    return null;
};

const validateTargetPlayerInInteraction = (
    state: DiceThroneCore,
    pendingInteraction: InteractionDescriptor,
    targetPlayerId: PlayerId
): ValidationResult | null => {
    const targetPlayerIds = getInteractionTargetPlayerIds(state, pendingInteraction);
    if (!targetPlayerIds.includes(targetPlayerId)) {
        return fail('invalid_target_player');
    }
    if (!state.players[targetPlayerId]) {
        return fail('player_not_found');
    }
    return null;
};

const validateDieInteraction = (
    state: DiceThroneCore,
    pendingInteraction: InteractionDescriptor | undefined,
    playerId: PlayerId,
    dieId: number,
    phase: TurnPhase,
    limitError: string,
    mode: 'modify' | 'reroll',
): { interaction: ValidationInteractionDescriptor } | ValidationResult => {
    const ownershipError = validateInteractionOwnership(pendingInteraction, playerId);
    if (ownershipError) return ownershipError;

    const interaction = getValidationInteraction(pendingInteraction)!;
    const allowedDieIds = interaction.allowedDieIds?.length
        ? interaction.allowedDieIds
        : getActiveDice(state, phase).map(activeDie => activeDie.id);
    const attackSnapshotDieIndex = getAttackSnapshotDieIndex(dieId);
    const isAttackSnapshotDie = phase === 'defensiveRoll'
        && isAttackSnapshotDieId(dieId)
        && allowedDieIds.includes(dieId)
        && !!state.pendingAttack?.attackerId
        && Array.isArray(state.pendingAttack.attackDiceValues)
        && attackSnapshotDieIndex >= 0
        && attackSnapshotDieIndex < state.pendingAttack.attackDiceValues.length;
    const currentRollContext = resolveCurrentRollContext(state, phase);
    const die = findCurrentRollDie(state, dieId, phase)?.die;
    if (!die && !isAttackSnapshotDie) {
        return fail('die_not_found');
    }
    if (die && currentRollContext) {
        const actorScope = mode === 'modify'
            ? currentRollContext.policy.modifiableBy
            : currentRollContext.policy.rerollableBy;
        if (actorScope === 'none') {
            return fail('dice_locked');
        }
    }
    if (!allowedDieIds.includes(dieId)) {
        return fail('invalid_die_selection');
    }
    if (
        interaction.diceOwnerId
        && interaction.targetOpponentDice !== true
        && interaction.diceOwnerId !== playerId
        && !isAttackSnapshotDie
    ) {
        return fail('invalid_die_selection');
    }

    const completedDieIds = Array.from(new Set((interaction.completedDieIds ?? []).filter(id => typeof id === 'number')));
    if (completedDieIds.includes(dieId)) {
        return fail('die_already_completed');
    }

    const selectCount = interaction.selectCount ?? allowedDieIds.length;
    if (completedDieIds.length >= selectCount) {
        return fail(limitError);
    }

    return { interaction };
};

/**
 * 验证掷骰命令
 */
const validateRollDice = (
    state: DiceThroneCore,
    _cmd: RollDiceCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'offensiveRoll' && phase !== 'targetingRoll' && phase !== 'defensiveRoll') {
        return fail('invalid_phase');
    }

    const rollerId = getRollerId(state, phase);
    if (!isMoveAllowed(playerId, rollerId)) {
        return fail('player_mismatch');
    }

    if (state.rollCount >= state.rollLimit) {
        return fail('roll_limit_reached');
    }

    if (phase === 'offensiveRoll') {
        const bindStacks = state.players[rollerId]?.statusEffects[STATUS_IDS.BIND] ?? 0;
        const currentCp = state.players[rollerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        if (bindStacks > 0 && state.rollCount > 0 && currentCp < 1) {
            return fail('not_enough_cp');
        }
    }

    // 防御阶段必须先选择防御技能才能掷骰（规则 §3.6 步骤 2→3）
    if (phase === 'defensiveRoll' && state.pendingAttack && !state.pendingAttack.defenseAbilityId) {
        return fail('defense_ability_not_selected');
    }

    if (phase === 'defensiveRoll' && state.rollCount > 0) {
        const rerollDieLimit = getDefenseRerollDieLimit(state);
        if (typeof rerollDieLimit === 'number') {
            const unlockedDiceCount = getActiveDice(state, phase).filter((die) => !die.isKept).length;
            if (unlockedDiceCount > rerollDieLimit) {
                return fail('defense_reroll_die_limit_exceeded');
            }
        }
    }

    // 晕眩额外攻击检查：如果当前是晕眩触发的额外攻击，防御方（原攻击方）不能防御掷骰
    // 注意：根据 Wiki 规则，Daze 只是"攻击方再次攻击"，不影响防御能力
    // 额外攻击中防御方可以正常防御
    if (phase === 'defensiveRoll' && state.extraAttackInProgress && state.pendingAttack) {
        // 已移除：额外攻击中防御方可以正常防御
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

    const isTutorialMode = getGameMode() === 'tutorial';
    const selectedByOtherPlayer = Object.entries(state.selectedCharacters)
        .some(([otherPlayerId, selectedCharacterId]) => (
            otherPlayerId !== playerId && selectedCharacterId === cmd.payload.characterId
        ));
    if (selectedByOtherPlayer && !isTutorialMode) {
        return fail('character_already_taken');
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

    if (state.seatSwapRequest) {
        return fail('seat_swap_request_pending');
    }

    if (!isSetupReadyToStart({
        playerIds: Object.keys(state.players),
        hostPlayerId: state.hostPlayerId,
        selectedCharacters: state.selectedCharacters,
        readyPlayers: state.readyPlayers,
    })) {
        return fail('players_not_ready');
    }

    return ok();
};

/**
 * 验证玩家取消准备命令
 */
const validatePlayerUnready = (
    state: DiceThroneCore,
    _cmd: PlayerUnreadyCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'setup') {
        return fail('invalid_phase');
    }

    const char = state.selectedCharacters[playerId];
    if (!char || char === 'unselected') {
        return fail('character_not_selected');
    }

    return ok();
};

/**
 * 验证移动座位命令（setup 阶段）
 */
const validateMoveSeat = (
    state: DiceThroneCore,
    cmd: MoveSeatCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'setup') {
        return fail('invalid_phase');
    }

    const seatingOrder = getSeatingOrder(state);
    if (seatingOrder.length < 2) {
        return fail('invalid_mode');
    }

    if (!isMoveAllowed(playerId, state.hostPlayerId)) {
        return fail('player_mismatch');
    }

    const movingPlayerId = cmd.payload.playerId;
    if (!state.players[movingPlayerId]) {
        return fail('player_not_found');
    }

    const sourceSeatIndex = seatingOrder.indexOf(movingPlayerId);
    if (sourceSeatIndex < 0) {
        return fail('player_not_found');
    }

    const targetSeatIndex = cmd.payload.targetSeatIndex;
    if (targetSeatIndex < 0 || targetSeatIndex >= seatingOrder.length) {
        return fail('invalid_seat_index');
    }

    if (targetSeatIndex === sourceSeatIndex) {
        return fail('seat_not_changed');
    }

    return ok();
};

/**
 * 验证申请换位命令（setup 阶段）
 */
const validateRequestSeatSwap = (
    state: DiceThroneCore,
    cmd: RequestSeatSwapCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'setup') {
        return fail('invalid_phase');
    }

    const seatingOrder = getSeatingOrder(state);
    if (seatingOrder.length < 2) {
        return fail('invalid_mode');
    }

    const targetPlayerId = cmd.payload.targetPlayerId;
    if (!state.players[playerId] || !state.players[targetPlayerId]) {
        return fail('player_not_found');
    }

    if (playerId === targetPlayerId) {
        return fail('seat_not_changed');
    }

    if (state.seatSwapRequest) {
        return fail('seat_swap_request_pending');
    }

    return ok();
};

/**
 * 验证响应换位命令（setup 阶段）
 */
const validateRespondSeatSwap = (
    state: DiceThroneCore,
    _cmd: RespondSeatSwapCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'setup') {
        return fail('invalid_phase');
    }

    const pendingRequest = state.seatSwapRequest;
    if (!pendingRequest) {
        return fail('seat_swap_request_missing');
    }

    if (pendingRequest.targetPlayerId !== playerId) {
        return fail('player_mismatch');
    }

    return ok();
};

/**
 * 验证取消换位命令（setup 阶段）
 */
const validateCancelSeatSwap = (
    state: DiceThroneCore,
    _cmd: CancelSeatSwapCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    if (phase !== 'setup') {
        return fail('invalid_phase');
    }

    const pendingRequest = state.seatSwapRequest;
    if (!pendingRequest) {
        return fail('seat_swap_request_missing');
    }

    if (pendingRequest.requesterId !== playerId) {
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
    if (phase !== 'offensiveRoll' && phase !== 'targetingRoll' && phase !== 'defensiveRoll') {
        return fail('invalid_phase');
    }

    const rollerId = getRollerId(state, phase);
    if (!isMoveAllowed(playerId, rollerId)) {
        return fail('player_mismatch');
    }

    if (state.rollCount === 0) {
        return fail('no_roll_yet');
    }

    if (state.rollConfirmed) {
        return fail('roll_already_confirmed');
    }
    
    const die = findCurrentRollDie(state, cmd.payload.dieId, phase)?.die;
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
    const activeBonusSettlement = state.pendingBonusDiceSettlement;
    if (activeBonusSettlement && isCurrentBonusRollSettlement(state, activeBonusSettlement)) {
        if (!isMoveAllowed(playerId, activeBonusSettlement.attackerId)) {
            return fail('player_mismatch');
        }
        return ok();
    }

    if (phase !== 'offensiveRoll' && phase !== 'targetingRoll' && phase !== 'defensiveRoll') {
        return fail('invalid_phase');
    }
    
    const rollerId = getRollerId(state, phase);
    if (!isMoveAllowed(playerId, rollerId)) {
        return fail('player_mismatch');
    }
    
    if (state.rollConfirmed) {
        return fail('roll_already_confirmed');
    }

    if (state.rollCount === 0) {
        return fail('no_roll_yet');
    }
    
    return ok();
};

const validateConfirmCompareRoll = (
    state: DiceThroneCore,
    playerId: PlayerId,
): ValidationResult => {
    const context = state.currentRollContext;
    if (context?.kind !== 'compare') return fail('no_compare_roll');
    if (context.ownerPlayerId !== playerId) return fail('not_your_roll');
    return ok();
};

/**
 * 验证选择技能命令
 */
const playerHasAbility = (state: DiceThroneCore, playerId: PlayerId | undefined, abilityId: string): boolean => {
    if (!playerId) return false;
    const player = state.players[playerId];
    if (!player) return false;
    return player.abilities.some(ability => {
        if (ability.id === abilityId) return true;
        return ability.variants?.some(variant => variant.id === abilityId) ?? false;
    });
};

const normalizeSelectedAbilityId = (state: DiceThroneCore, playerId: PlayerId | undefined, abilityId: string): string => {
    if (abilityId === 'shadow-guard') return 'shadow-defense';
    if (
        abilityId === 'shadow-step'
        && !playerHasAbility(state, playerId, 'shadow-step')
        && playerHasAbility(state, playerId, 'elusive-step')
    ) {
        return 'elusive-step';
    }
    return abilityId;
};

const getDefenseRerollDieLimit = (state: DiceThroneCore): number | undefined => {
    const defenderId = state.pendingAttack?.defenderId;
    const defenseAbilityId = state.pendingAttack?.defenseAbilityId;
    if (!defenderId || !defenseAbilityId) return undefined;

    const match = findPlayerAbility(state, defenderId, defenseAbilityId);
    const trigger = match?.variant?.trigger ?? match?.ability.trigger;
    if (!trigger || trigger.type !== 'phase' || trigger.phaseId !== 'defensiveRoll') {
        return undefined;
    }

    return typeof trigger.rerollDieLimit === 'number' && Number.isFinite(trigger.rerollDieLimit)
        ? trigger.rerollDieLimit
        : undefined;
};

const validateSelectAbility = (
    state: DiceThroneCore,
    cmd: SelectAbilityCommand,
    playerId: PlayerId,
    phase: TurnPhase
): ValidationResult => {
    const selectingPlayerId = phase === 'defensiveRoll'
        ? state.pendingAttack?.defenderId
        : state.activePlayerId;
    const abilityId = normalizeSelectedAbilityId(state, selectingPlayerId, cmd.payload.abilityId);
    
    if (phase === 'defensiveRoll') {
        if (!state.pendingAttack) {
            return fail('no_pending_attack');
        }
        if (!isMoveAllowed(playerId, state.pendingAttack.defenderId)) {
            return fail('player_mismatch');
        }

        const defender = state.players[state.pendingAttack.defenderId];
        if (!defender) return fail('player_not_found');

        // 防御阶段分两步：
        // 1. 掷骰前选择/切换防御技能（规则 §3.6 步骤 2）：只需验证玩家拥有该防御技能
        //    暗影刺客等拥有多个防御技能的英雄，在投掷前可以自由切换选择
        // 2. 掷骰后确认骰面后的技能激活：用 getAvailableAbilityIds 检查骰面
        if (state.rollCount === 0) {
            // 掷骰前选择/切换：验证玩家拥有该防御技能（不检查骰面）
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

        // 掷骰后选择：若唯一防御技能已在进入 defensiveRoll 时自动选中，
        // 允许同 ID 的重复 SELECT_ABILITY 作为幂等操作。
        if (state.pendingAttack.defenseAbilityId === abilityId) {
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
    
    // offensiveRoll 内的 pendingAttack 表示“已选攻击候选”，玩家仍未点推进/确认攻击。
    // 真正进入 targetingRoll/defensiveRoll/结算后会离开 offensiveRoll，此时自然不能再走进攻 SELECT_ABILITY。
    
    // 晕眩状态不阻止进攻技能：攻击方有晕眩时仍可攻击，晕眩在攻击结算后触发额外攻击
    // 晕眩只阻止防御行为（见上方 defensiveRoll 分支）
    
    const player = state.players[state.activePlayerId];
    if (!player) return fail('player_not_found');
    
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
    // 售卖仅限当前回合玩家，可在主要阶段或弃牌阶段执行
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    if (phase !== 'main1' && phase !== 'main2' && phase !== 'discard') {
        return fail('invalid_phase');
    }

    const blockedError = getActionBlockedByStunLikeStatus(state, playerId);
    if (blockedError) {
        return fail(blockedError);
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
    // 撤回售卖仅限当前回合玩家，可在主要阶段或弃牌阶段执行
    if (!isMoveAllowed(playerId, state.activePlayerId)) {
        return fail('player_mismatch');
    }
    if (phase !== 'main1' && phase !== 'main2' && phase !== 'discard') {
        return fail('invalid_phase');
    }

    const blockedError = getActionBlockedByStunLikeStatus(state, playerId);
    if (blockedError) {
        return fail(blockedError);
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
    phase: TurnPhase,
    responseWindowType?: DtResponseWindowType,
    currentResponseWindow?: ResponseWindowState['current'],
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

    const blockedError = getActionBlockedByStunLikeStatus(state, playerId);
    if (blockedError) {
        return fail(blockedError);
    }

    if (responseWindowType) {
        const responseWindowActorCheck = validateCurrentResponseWindowActor(
            state,
            currentResponseWindow,
            actingPlayerId,
            true,
        );
        if (!responseWindowActorCheck.valid) {
            return responseWindowActorCheck;
        }
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
    const checkResult = checkPlayCard(state, actingPlayerId, card, phase, responseWindowType);
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
    phase: TurnPhase,
    currentResponseWindow?: ResponseWindowState['current'],
): ValidationResult => {
    const responseWindowActorCheck = validateCurrentResponseWindowActor(state, currentResponseWindow, playerId);
    if (!responseWindowActorCheck.valid) {
        return responseWindowActorCheck;
    }

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

    const blockedError = getActionBlockedByStunLikeStatus(state, playerId);
    if (blockedError) {
        return fail(blockedError);
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
    phase: TurnPhase,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    const validation = validateDieInteraction(state, pendingInteraction, playerId, cmd.payload.dieId, phase, 'modify_die_limit_reached', 'modify');
    if ('valid' in validation) return validation;
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
    phase: TurnPhase,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    const validation = validateDieInteraction(state, pendingInteraction, playerId, cmd.payload.dieId, phase, 'reroll_die_limit_reached', 'reroll');
    if ('valid' in validation) return validation;
    const remainingSlots = getRemainingDieInteractionSlots(pendingInteraction);
    if (remainingSlots !== undefined && remainingSlots <= 0) {
        return fail('reroll_die_limit_reached');
    }
    return ok();
};

/**
 * 验证移除状态效果命令
 */
const validateRemoveStatus = (
    state: DiceThroneCore,
    cmd: RemoveStatusCommand,
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    const ownershipError = validateInteractionOwnership(pendingInteraction, playerId);
    if (ownershipError) return ownershipError;

    const interaction = pendingInteraction!;
    const targetError = validateTargetPlayerInInteraction(state, interaction, cmd.payload.targetPlayerId);
    if (targetError) return targetError;

    if (cmd.payload.statusId) {
        if (!canRemoveStatusFromPlayer(state, playerId, cmd.payload.targetPlayerId, cmd.payload.statusId)) {
            return fail('invalid_status');
        }
        if (!playerHasStatusOrToken(state, cmd.payload.targetPlayerId, cmd.payload.statusId)) {
            return fail('no_status');
        }
    } else if (interaction.requiresTargetWithStatus === true && !playerHasStatusOrToken(state, cmd.payload.targetPlayerId)) {
        return fail('target_has_no_status');
    }

    return ok();
};

/**
 * 验证转移状态效果命令
 */
const validateTransferStatus = (
    state: DiceThroneCore,
    cmd: TransferStatusCommand,
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    const ownershipError = validateInteractionOwnership(pendingInteraction, playerId);
    if (ownershipError) return ownershipError;

    const interaction = pendingInteraction!;
    const sourceTargetError = validateTargetPlayerInInteraction(state, interaction, cmd.payload.fromPlayerId);
    if (sourceTargetError) return sourceTargetError;

    if (!canRemoveStatusFromPlayer(state, playerId, cmd.payload.fromPlayerId, cmd.payload.statusId)) {
        return fail('invalid_status');
    }

    const targetError = validateTargetPlayerInInteraction(state, interaction, cmd.payload.toPlayerId);
    if (targetError) return targetError;

    if (cmd.payload.fromPlayerId === cmd.payload.toPlayerId) {
        return fail('invalid_target_player');
    }

    if (interaction.transferConfig?.sourcePlayerId && interaction.transferConfig.sourcePlayerId !== cmd.payload.fromPlayerId) {
        return fail('invalid_source_player');
    }
    if (interaction.transferConfig?.statusId && interaction.transferConfig.statusId !== cmd.payload.statusId) {
        return fail('invalid_status');
    }

    if (!playerHasStatusOrToken(state, cmd.payload.fromPlayerId, cmd.payload.statusId)) {
        return fail('no_status');
    }

    return ok();
};

const validateResolveInteraction = (
    state: DiceThroneCore,
    cmd: ResolveInteractionCommand,
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor,
): ValidationResult => {
    if (!pendingInteraction) {
        return fail('no_pending_interaction');
    }
    if (pendingInteraction.playerId !== playerId) {
        return fail('player_mismatch');
    }
    if (pendingInteraction.type === 'selectPlayer') {
        const selectedPlayerIds = cmd.payload.selectedPlayerIds ?? [];
        const targetPlayerIds = pendingInteraction.targetPlayerIds ?? Object.keys(state.players);
        const resolvedPlayerIds = Array.from(new Set(
            selectedPlayerIds.filter(playerId => targetPlayerIds.includes(playerId))
        ));
        const minSelectCount = pendingInteraction.minSelectCount ?? 1;
        if (resolvedPlayerIds.length < minSelectCount) {
            return fail('not_enough_players_selected');
        }
        return ok();
    }
    if (pendingInteraction.type === 'selectHandCard') {
        const player = state.players[playerId];
        if (!player) {
            return fail('player_not_found');
        }
        const selectedCardIds = cmd.payload.selectedCardIds ?? [];
        if (selectedCardIds.length < (pendingInteraction.selectCount ?? 1)) {
            return fail('not_enough_cards_selected');
        }
        const handCardIds = new Set(player.hand.map(card => card.id));
        if (selectedCardIds.some(cardId => !handCardIds.has(cardId))) {
            return fail('card_not_in_hand');
        }
        return ok();
    }
    if (pendingInteraction.type === 'selectStatus') {
        if ((pendingInteraction.minSelectCount ?? 1) > 0) {
            return fail('status_selection_requires_choice');
        }
        return ok();
    }
    if (pendingInteraction.type !== 'selectPlayer') {
        return fail('invalid_interaction_type');
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
    playerId: PlayerId,
    phase: TurnPhase,
): ValidationResult => {
    const pendingDamage = state.pendingDamage;

    if (cmd.payload.tokenId === TOKEN_IDS.NYRA_REDIRECT) {
        const player = state.players[playerId];
        if (!pendingDamage) return fail('no_pending_damage');
        if (!isMoveAllowed(playerId, pendingDamage.responderId)) return fail('player_mismatch');
        if (state.pendingAttack?.isUltimate) return fail('invalid_token_timing');
        if (player?.characterId !== 'lieren' || (player.companion?.hp ?? 0) <= 0) return fail('no_token');
        return cmd.payload.amount === pendingDamage.currentDamage ? ok() : fail('invalid_amount');
    }

    if (cmd.payload.tokenId === TOKEN_IDS.NYRAS_BOND && !pendingDamage) {
        const player = state.players[playerId];
        if (player?.characterId !== 'lieren' || !player.companion) return fail('no_token');
        if ((player.tokens[TOKEN_IDS.NYRAS_BOND] ?? 0) < 1) return fail('no_token');
        if (player.companion.hp >= player.companion.maxHp) return fail('invalid_token_timing');
        return cmd.payload.amount === 1 ? ok() : fail('invalid_amount');
    }

    if (cmd.payload.tokenId === TOKEN_IDS.NYRAS_BOND && pendingDamage) {
        const player = state.players[playerId];
        if (!isMoveAllowed(playerId, pendingDamage.responderId)) return fail('player_mismatch');
        if (state.pendingAttack?.isUltimate) return fail('invalid_token_timing');
        if (player?.characterId !== 'lieren' || (player.companion?.hp ?? 0) <= 0) return fail('no_token');
        if ((player.tokens[TOKEN_IDS.NYRAS_BOND] ?? 0) < 1) return fail('no_token');
        const maxAssignableDamage = Math.min(pendingDamage.currentDamage, player.companion.hp);
        return Number.isInteger(cmd.payload.amount) && cmd.payload.amount >= 1 && cmd.payload.amount <= maxAssignableDamage
            ? ok()
            : fail('invalid_amount');
    }

    const tokenDef = state.tokenDefinitions.find(t => t.id === cmd.payload.tokenId);
    if (!tokenDef) {
        return fail('unknown_token');
    }

    const isRollPhase = phase === 'offensiveRoll' || phase === 'defensiveRoll';
    const canUseDuringRoll = !pendingDamage
        && isRollPhase
        && tokenDef.activeUse?.timing?.includes('duringRoll');
    if (canUseDuringRoll) {
        if (getRollerId(state, phase) !== playerId) {
            return fail('player_mismatch');
        }
        if (!state.pendingAttack) {
            return fail('no_pending_attack');
        }

        const currentAmount = state.players[playerId]?.tokens[cmd.payload.tokenId] ?? 0;
        if (currentAmount <= 0) {
            return fail('no_token');
        }
        if (cmd.payload.amount <= 0) {
            return fail('invalid_amount');
        }
        if (!getTokenUseOptions(tokenDef, currentAmount).includes(cmd.payload.amount)) {
            return fail('invalid_amount');
        }
        return ok();
    }

    if (!pendingDamage) {
        return fail('no_pending_damage');
    }
    if (!isMoveAllowed(playerId, pendingDamage.responderId)) {
        return fail('player_mismatch');
    }

    const p = state.players[playerId];
    if (!p) return fail('player_not_found');

    const isArtificerBot = cmd.payload.tokenId === TOKEN_IDS.NANOBOT
        || cmd.payload.tokenId === TOKEN_IDS.SHOCK_BOT
        || cmd.payload.tokenId === TOKEN_IDS.HEAL_BOT;
    const currentAmount = isArtificerBot
        ? getUsableTokenAmountForTiming(state, playerId, cmd.payload.tokenId, pendingDamage.responseType)
        : (p?.tokens[cmd.payload.tokenId] ?? 0);
    if (currentAmount <= 0) {
        return fail('no_token');
    }

    if (cmd.payload.amount <= 0) {
        return fail('invalid_amount');
    }

    if (!tokenDef.activeUse?.timing?.includes(pendingDamage.responseType)) {
        return fail('invalid_token_timing');
    }

    if (tokenDef.activeUse.requiresAttackDamage && !state.pendingAttack) {
        return fail('invalid_token_timing');
    }

    const availableAmount = getUsableTokenAmountForTiming(state, playerId, cmd.payload.tokenId, pendingDamage.responseType);
    if (availableAmount <= 0) {
        return fail('invalid_amount');
    }

    const allowedConsumeAmounts = getTokenUseOptions(tokenDef, availableAmount);
    if (!allowedConsumeAmounts.includes(cmd.payload.amount)) {
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
    if (!isPurifiableDebuffId(state, cmd.payload.statusId)) {
        return fail('no_status');
    }
    const stacks = (p.statusEffects[cmd.payload.statusId] ?? 0) + (p.tokens[cmd.payload.statusId] ?? 0);
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
    if (!state.pendingBonusDiceSettlement || !isCurrentBonusRollSettlement(state)) {
        return fail('no_pending_bonus_dice');
    }
    const currentRollContext = resolveCurrentRollContext(state);
    if (currentRollContext?.kind !== 'bonus') {
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
    const die = findCurrentRollDie(state, dieIndex)?.die;
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
    if (!state.pendingBonusDiceSettlement || !isCurrentBonusRollSettlement(state)) {
        return fail('no_pending_bonus_dice');
    }
    if (!isMoveAllowed(playerId, state.pendingBonusDiceSettlement.attackerId)) {
        return fail('player_mismatch');
    }
    return ok();
};

const validateSelectDefenderTarget = (
    _state: DiceThroneCore,
    cmd: SelectDefenderTargetCommand,
    playerId: PlayerId,
    pendingDefenderChoice?: PendingDefenderChoice,
): ValidationResult => {
    if (!pendingDefenderChoice) {
        return fail('no_pending_defender_choice');
    }
    if (pendingDefenderChoice.chooserPlayerId !== playerId) {
        return fail('player_mismatch');
    }

    const option = pendingDefenderChoice.options.find((entry) => entry.playerId === cmd.payload.defenderId);
    if (!option) {
        return fail('invalid_defender_target');
    }
    if (option.disabled) {
        return fail('defender_target_disabled');
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
    phase: TurnPhase,
    responseWindowType?: DtResponseWindowType,
    currentResponseWindow?: ResponseWindowState['current'],
): ValidationResult => {
    const player = state.players[playerId];
    if (!player) return fail('player_not_found');

    if (responseWindowType) {
        const responseWindowActorCheck = validateCurrentResponseWindowActor(
            state,
            currentResponseWindow,
            playerId,
            true,
        );
        if (!responseWindowActorCheck.valid) {
            return responseWindowActorCheck;
        }
    }

    const passives = player.passiveAbilities ?? [];
    const passive = passives.find(p => p.id === cmd.payload.passiveId);
    if (!passive) return fail('passive_not_found');

    if (!Number.isInteger(cmd.payload.actionIndex)) {
        return fail('action_not_found');
    }
    const action = passive.actions[cmd.payload.actionIndex];
    if (!action) return fail('action_not_found');

    // CP / Token / 时机检查
    const cp = player.resources[RESOURCE_IDS.CP] ?? 0;
    if (cp < action.cpCost) return fail('not_enough_cp');
    for (const cost of getPassiveActionTokenCosts(action)) {
        if ((player.tokens[cost.tokenId] ?? 0) < cost.amount) {
            return fail('not_enough_token');
        }
    }
    if (!isPassiveActionUsable(
        state,
        playerId,
        cmd.payload.passiveId,
        cmd.payload.actionIndex,
        phase,
        { responseWindowType },
    )) {
        return fail('passive_action_unusable');
    }

    // custom 动作需要配置 customActionId
    if (action.type === 'custom' && !action.customActionId) {
        return fail('custom_action_missing');
    }

    // rerollDie 需要合法且处于当前投掷池内的 targetDieId
    if (action.type === 'rerollDie' && !Number.isInteger(cmd.payload.targetDieId)) {
        return fail('target_die_required');
    }

    // rerollDie 需要命中当前骰区中的骰子
    if (action.type === 'rerollDie' && Number.isInteger(cmd.payload.targetDieId)) {
        const currentDie = findCurrentRollDie(state, cmd.payload.targetDieId, phase);
        if (!currentDie) {
            const currentDice = getCurrentRollDice(state, phase);
            console.warn('[validateUsePassiveAbility] 骰子不存在:', {
                playerId,
                targetDieId: cmd.payload.targetDieId,
                diceIds: currentDice.map(d => d.id),
            });
            return fail('die_not_found');
        }
        // 不能重掷被锁定的骰子
        if (currentDie.die.isKept) {
            return fail('die_is_locked');
        }
    }

    return ok();
};

/**
 * 验证授予 Token 命令
 * 
 * 前置条件：存在 selectPlayer 类型的交互，且交互数据中包含 tokenGrantConfigs/tokenGrantConfig。
 * 验证目标玩家在交互的 targetPlayerIds 中。
 */
const validateGrantTokens = (
    state: DiceThroneCore,
    cmd: GrantTokensCommand,
    playerId: PlayerId,
    pendingInteraction?: InteractionDescriptor
): ValidationResult => {
    const ownershipError = validateInteractionOwnership(pendingInteraction, playerId);
    if (ownershipError) return ownershipError;

    const interaction = pendingInteraction!;
    const targetError = validateTargetPlayerInInteraction(state, interaction, cmd.payload.targetPlayerId);
    if (targetError) return targetError;

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
    pendingInteraction?: InteractionDescriptor,
    pendingDefenderChoice?: PendingDefenderChoice,
    responseWindowType?: DtResponseWindowType,
    currentResponseWindow?: ResponseWindowState['current'],
): ValidationResult => {
    if (command.type.startsWith('SYS_')) {
        return ok();
    }

    const playerId = command.playerId;
    if (isCommandType(command, 'ROLL_DICE')) return validateRollDice(state, command, playerId, phase);
    if (isCommandType(command, 'TOGGLE_DIE_LOCK')) return validateToggleDieLock(state, command, playerId, phase);
    if (isCommandType(command, 'CONFIRM_ROLL')) return validateConfirmRoll(state, command, playerId, phase);
    if (isCommandType(command, 'CONFIRM_COMPARE_ROLL')) return validateConfirmCompareRoll(state, playerId);
    if (isCommandType(command, 'SELECT_ABILITY')) return validateSelectAbility(state, command, playerId, phase);
    if (isCommandType(command, 'DRAW_CARD')) return validateDrawCard(state, command, playerId);
    if (isCommandType(command, 'DISCARD_CARD')) return validateDiscardCard(state, command, playerId);
    if (isCommandType(command, 'SELL_CARD')) return validateSellCard(state, command, playerId, phase);
    if (isCommandType(command, 'UNDO_SELL_CARD')) return validateUndoSellCard(state, command, playerId, phase);
    if (isCommandType(command, 'REORDER_CARD_TO_END')) return validateReorderCardToEnd(state, command, playerId);
    if (isCommandType(command, 'PLAY_CARD')) return validatePlayCard(state, command, playerId, phase, responseWindowType, currentResponseWindow);
    if (isCommandType(command, 'PLAY_UPGRADE_CARD')) return validatePlayUpgradeCard(state, command, playerId, phase, currentResponseWindow);
    if (isCommandType(command, 'RESOLVE_CHOICE')) return validateResolveChoice(state, command, playerId);
    if (isCommandType(command, 'SELECT_DEFENDER_TARGET')) return validateSelectDefenderTarget(state, command, playerId, pendingDefenderChoice);
    if (isCommandType(command, 'ADVANCE_PHASE')) return validateAdvancePhase(state, command, playerId, phase);
    if (isCommandType(command, 'SELECT_CHARACTER')) return validateSelectCharacter(state, command, playerId, phase);
    if (isCommandType(command, 'HOST_START_GAME')) return validateHostStartGame(state, command, playerId, phase);
    if (isCommandType(command, 'MOVE_SEAT')) return validateMoveSeat(state, command, playerId, phase);
    if (isCommandType(command, 'REQUEST_SEAT_SWAP')) return validateRequestSeatSwap(state, command, playerId, phase);
    if (isCommandType(command, 'RESPOND_SEAT_SWAP')) return validateRespondSeatSwap(state, command, playerId, phase);
    if (isCommandType(command, 'CANCEL_SEAT_SWAP')) return validateCancelSeatSwap(state, command, playerId, phase);
    if (isCommandType(command, 'PLAYER_READY')) return validatePlayerReady(state, command, playerId, phase);
    if (isCommandType(command, 'PLAYER_UNREADY')) return validatePlayerUnready(state, command, playerId, phase);
    if (isCommandType(command, 'RESPONSE_PASS')) return validateResponsePass(state, command, playerId);
    if (isCommandType(command, 'MODIFY_DIE')) return validateModifyDie(state, command, playerId, phase, pendingInteraction);
    if (isCommandType(command, 'REROLL_DIE')) return validateRerollDie(state, command, playerId, phase, pendingInteraction);
    if (isCommandType(command, 'REMOVE_STATUS')) return validateRemoveStatus(state, command, playerId, pendingInteraction);
    if (isCommandType(command, 'TRANSFER_STATUS')) return validateTransferStatus(state, command, playerId, pendingInteraction);
    if (isCommandType(command, 'RESOLVE_INTERACTION')) return validateResolveInteraction(state, command, playerId, pendingInteraction);
    // if (isCommandType(command, 'CONFIRM_INTERACTION')) return validateConfirmInteraction(state, command, playerId, pendingInteraction);
    // if (isCommandType(command, 'CANCEL_INTERACTION')) return validateCancelInteraction(state, command, playerId, pendingInteraction);
    if (isCommandType(command, 'USE_TOKEN')) return validateUseToken(state, command, playerId, phase);
    if (isCommandType(command, 'SKIP_TOKEN_RESPONSE')) return validateSkipTokenResponse(state, command, playerId);
    if (isCommandType(command, 'USE_PURIFY')) return validateUsePurify(state, command, playerId);
    if (isCommandType(command, DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN)) {
        return validatePayToRemoveKnockdown(state, command, playerId, phase);
    }
    if (isCommandType(command, 'REROLL_BONUS_DIE')) return validateRerollBonusDie(state, command, playerId);
    if (isCommandType(command, 'SKIP_BONUS_DICE_REROLL')) return validateSkipBonusDiceReroll(state, command, playerId);
    if (isCommandType(command, 'USE_PASSIVE_ABILITY')) {
        return validateUsePassiveAbility(state, command, playerId, phase, responseWindowType, currentResponseWindow);
    }
    if (isCommandType(command, 'GRANT_TOKENS')) return validateGrantTokens(state, command, playerId, pendingInteraction);

    const _exhaustive: never = command;
    return fail(`unknown_command: ${(_exhaustive as DiceThroneCommand).type}`);
};
