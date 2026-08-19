/**
 * DiceThrone 命令执行
 * Command -> Event[] 转换
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DtResponseWindowType,
    TurnPhase,
    DiceThroneCommand,
    DiceThroneEvent,
    DiceRolledEvent,
    DieLockToggledEvent,
    RollConfirmedEvent,
    AbilityActivatedEvent,
    AttackInitiatedEvent,
    ResponseWindowOpenedEvent,
    DieModifiedEvent,
    StatusRemovedEvent,
    CharacterSelectedEvent,
    HostStartedEvent,
    SeatingMovedEvent,
    SeatSwapRequestedEvent,
    SeatSwapRejectedEvent,
    SeatSwapCancelledEvent,
    PlayerReadyEvent,
    PlayerUnreadyEvent,
    DefenderSelectionResolvedEvent,
} from './types';
import {
    getRollerId,
    getCombatOpponentId,
    getDefaultOpponentId,
    getNextPlayerId,
    getResponderQueue,
    getTokenStackLimit,
    getSeatingOrder,
    isTeamMode,
    getAttackSnapshotDieIndex,
    isAttackSnapshotDieId,
} from './rules';
import { findPlayerAbility, playerAbilityHasDamage } from './abilityLookup';
import { applyEvents } from './utils';
import { reduce } from './reducer';
import type { InteractionDescriptor as PendingInteraction } from './core-types';

import { DICETHRONE_COMMANDS, STATUS_IDS, TOKEN_IDS } from './ids';
import { CHARACTER_DATA_MAP } from './characters';
import { executeCardCommand } from './executeCards';
import { buildBonusDiceSettlementEvents, executeTokenCommand } from './executeTokens';
import { getPassiveActionTokenCosts, getPlayerPassiveAbilities, isPassiveActionUsable } from './passiveAbility';
import { buildDrawEvents } from './deckEvents';
import { RESOURCE_IDS } from './resources';
import { getCustomActionHandler } from './effects';
import { buildStatusAppliedOrChoiceEvents } from './statusEvents';
import { canRemoveStatusFromPlayer, isRemovableStatusId } from './statusRemoval';
import {
    hasAfterRollConfirmedWindowBeenHandled,
    buildAfterRollConfirmedSignature,
} from './responseWindowGuards';
import { buildCompareRollChoiceEvent, findCurrentRollDie, isCurrentBonusRollSettlement, resolveCurrentRollContext } from './rollContext';
import { buildCurrentRollRerollEvents, shouldRequireAbilityReselectionForCurrentRoll } from './reroll';

// ============================================================================
// 辅助函数
// ============================================================================

const resolveTimestamp = (command?: DiceThroneCommand): number => {
    return typeof command?.timestamp === 'number' ? command.timestamp : 0;
};

const isArtificerNanobotPassiveActivation = (
    passiveId: string,
    actionIndex: number,
): boolean => passiveId === 'artificer-workshop' && (actionIndex === 0 || actionIndex === 1);

const playerHasAbility = (state: DiceThroneCore, playerId: PlayerId | undefined, abilityId: string): boolean => {
    if (!playerId) return false;
    return findPlayerAbility(state, playerId, abilityId) !== null;
};

const buildAfterRollConfirmedWindowEvent = (
    state: DiceThroneCore,
    rollerId: PlayerId,
    phase: TurnPhase,
    timestamp: number,
    commandType: string,
): ResponseWindowOpenedEvent | null => {
    const rollSignature = buildAfterRollConfirmedSignature(state, phase);
    if (hasAfterRollConfirmedWindowBeenHandled(state, rollSignature)) {
        return null;
    }

    const responseTriggerId = getCombatOpponentId(state, rollerId) ?? rollerId;
    const responderQueue = getResponderQueue(
        state,
        'afterRollConfirmed',
        responseTriggerId,
        undefined,
        rollerId,
        phase,
    );
    if (responderQueue.length === 0) {
        return null;
    }

    return {
        type: 'RESPONSE_WINDOW_OPENED',
        payload: {
            windowId: `afterRollConfirmed-${timestamp}`,
            responderQueue,
            windowType: 'afterRollConfirmed',
            sourceId: rollSignature,
        },
        sourceCommandType: commandType,
        timestamp,
    };
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

const buildSwappedSeatingOrder = (
    seatingOrder: PlayerId[],
    requesterId: PlayerId,
    targetPlayerId: PlayerId,
) => {
    const sourceSeatIndex = seatingOrder.indexOf(requesterId);
    const targetSeatIndex = seatingOrder.indexOf(targetPlayerId);
    if (sourceSeatIndex === -1 || targetSeatIndex === -1 || sourceSeatIndex === targetSeatIndex) {
        return null;
    }

    const nextSeatingOrder = [...seatingOrder];
    [nextSeatingOrder[sourceSeatIndex], nextSeatingOrder[targetSeatIndex]] = [
        nextSeatingOrder[targetSeatIndex],
        nextSeatingOrder[sourceSeatIndex],
    ];

    return {
        sourceSeatIndex,
        targetSeatIndex,
        nextSeatingOrder,
    };
};

/**
 * 判断该进攻技能是否可被防御（是否进入防御投掷阶段）
 * 
 * 设计原则（规则 §4.3/§4.4）：
 * - 进攻技能默认可防御（进入防御阶段）
 * - 标记 'unblockable' 的技能/变体不可防御
 * - 终极技能（'ultimate' tag）产生 Ultimate Damage，因此不可防御且不可避免
 * - 没有任何伤害效果的技能不进入防御阶段（无需防御）
 */
const isDefendableAttack = (state: DiceThroneCore, attackerId: string, abilityId: string): boolean => {
    const match = findPlayerAbility(state, attackerId, abilityId);
    if (!match) {
        return true;
    }

    // 检查 variant 和 ability 的 tags
    const variantTags = match.variant?.tags ?? [];
    const abilityTags = match.ability.tags ?? [];

    // 终极技能会产生 Ultimate Damage：不可防御且不可避免
    if (abilityTags.includes('ultimate')) return false;

    // 不可防御标签：跳过防御阶段
    if (variantTags.includes('unblockable') || abilityTags.includes('unblockable')) return false;

    // 灵魂燃烧的红圈伤害属于不可防御伤害；仍保留伤害修正卡对第一段攻击伤害的修正。
    if (abilityId.startsWith('soul-burn') || match.ability.id === 'soul-burn' || match.variant?.id?.startsWith('soul-burn')) return false;

    // 无伤害效果的技能不进入防御阶段
    if (!playerAbilityHasDamage(state, attackerId, abilityId)) return false;

    // 进攻技能默认可防御
    return true;
};

// ============================================================================
// 命令执行器
// ============================================================================

/**
 * 执行命令，生成事件
 */
export function execute(
    matchState: { core: DiceThroneCore; sys?: { phase?: string; tutorial?: { active?: boolean }; responseWindow?: { current?: { windowType: string } }; interaction?: { current?: { kind: string; data: unknown } | null } } },
    command: DiceThroneCommand,
    random: RandomFn
): DiceThroneEvent[] {
    const state = matchState.core;
    const phase = (matchState.sys?.phase ?? 'setup') as TurnPhase;
    const isTutorialActive = matchState.sys?.tutorial?.active === true;
    const events: DiceThroneEvent[] = [];
    const timestamp = resolveTimestamp(command);

    // 系统命令由系统层处理（如 CheatSystem），领域层不生成事件
    if (command.type.startsWith('SYS_')) {
        return events;
    }

    switch (command.type) {
        case 'ROLL_DICE': {
            const rollerId = getRollerId(state, phase);
            const bindStacks = state.players[rollerId]?.statusEffects[STATUS_IDS.BIND] ?? 0;
            const isBindExtraOffensiveRoll = phase === 'offensiveRoll' && bindStacks > 0 && state.rollCount > 0;
            if (isBindExtraOffensiveRoll) {
                const currentCp = state.players[rollerId]?.resources[RESOURCE_IDS.CP] ?? 0;
                if (currentCp < 1) {
                    break;
                }
                events.push({
                    type: 'CP_CHANGED',
                    payload: {
                        playerId: rollerId,
                        delta: -1,
                        newValue: currentCp - 1,
                        sourceAbilityId: STATUS_IDS.BIND,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                });
            }

            const results: number[] = [];
            // 教程模式：骰子固定为 1（fist），确保教程流程中技能匹配
            // randomPolicy.values:[6] 控制其他随机（如悟道卡 rollDie → lotus）
            const tutorialFixedValue = 1;
            
            state.dice.slice(0, state.rollDiceCount).forEach(die => {
                if (!die.isKept) {
                    results.push(isTutorialActive ? tutorialFixedValue : random.d(6));
                }
            });
            if (phase === 'defensiveRoll' && state.pendingAttack?.defenseAbilityId === 'duel') {
                results.push(isTutorialActive ? tutorialFixedValue : random.d(6));
            }
            
            const event: DiceRolledEvent = {
                type: 'DICE_ROLLED',
                payload: { results, rollerId, phase },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'SELECT_CHARACTER': {
            const { characterId, initialDeckCardIds: presetDeckIds } = command.payload;
            const data = CHARACTER_DATA_MAP[characterId];
            if (!data || !random) break;

            const initialDeck = data.getStartingDeck(random);
            const initialDeckCardIds = presetDeckIds && presetDeckIds.length > 0
                ? presetDeckIds
                : initialDeck.map(c => c.id);

            const selectedEvent: CharacterSelectedEvent = {
                type: 'CHARACTER_SELECTED',
                payload: {
                    playerId: command.playerId,
                    characterId,
                    initialDeckCardIds,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(selectedEvent);
            break;
        }

        case 'HOST_START_GAME': {
            const hostEvent: HostStartedEvent = {
                type: 'HOST_STARTED',
                payload: {
                    playerId: command.playerId,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(hostEvent);
            break;
        }

        case 'MOVE_SEAT': {
            const movingPlayerId = command.payload.playerId;
            const seatingOrder = getSeatingOrder(state);
            const sourceSeatIndex = seatingOrder.indexOf(movingPlayerId);
            if (sourceSeatIndex === -1) {
                break;
            }

            const remainingPlayers = seatingOrder.filter((pid) => pid !== movingPlayerId);
            const nextSeatingOrder = [
                ...remainingPlayers.slice(0, command.payload.targetSeatIndex),
                movingPlayerId,
                ...remainingPlayers.slice(command.payload.targetSeatIndex),
            ];

            const seatingMovedEvent: SeatingMovedEvent = {
                type: 'SEATING_MOVED',
                payload: {
                    playerId: movingPlayerId,
                    sourceSeatIndex,
                    targetSeatIndex: command.payload.targetSeatIndex,
                    seatingOrder: nextSeatingOrder,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(seatingMovedEvent);
            break;
        }

        case 'REQUEST_SEAT_SWAP': {
            const requesterId = command.playerId;
            const { targetPlayerId } = command.payload as { targetPlayerId: PlayerId };
            const seatingOrder = getSeatingOrder(state);
            const controller = state.seatControllers?.[targetPlayerId];
            const controllerType = controller?.type ?? 'human';

            if (controllerType !== 'human') {
                const swapResult = buildSwappedSeatingOrder(seatingOrder, requesterId, targetPlayerId);
                if (!swapResult) {
                    break;
                }

                const seatingMovedEvent: SeatingMovedEvent = {
                    type: 'SEATING_MOVED',
                    payload: {
                        playerId: requesterId,
                        sourceSeatIndex: swapResult.sourceSeatIndex,
                        targetSeatIndex: swapResult.targetSeatIndex,
                        seatingOrder: swapResult.nextSeatingOrder,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(seatingMovedEvent);
                break;
            }

            const seatSwapRequestedEvent: SeatSwapRequestedEvent = {
                type: 'SEAT_SWAP_REQUESTED',
                payload: {
                    requesterId,
                    targetPlayerId,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(seatSwapRequestedEvent);
            break;
        }

        case 'RESPOND_SEAT_SWAP': {
            const pendingRequest = state.seatSwapRequest;
            if (!pendingRequest) {
                break;
            }

            const { approve } = command.payload as { approve: boolean };
            if (!approve) {
                const seatSwapRejectedEvent: SeatSwapRejectedEvent = {
                    type: 'SEAT_SWAP_REJECTED',
                    payload: pendingRequest,
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(seatSwapRejectedEvent);
                break;
            }

            const seatingOrder = getSeatingOrder(state);
            const swapResult = buildSwappedSeatingOrder(
                seatingOrder,
                pendingRequest.requesterId,
                pendingRequest.targetPlayerId,
            );
            if (!swapResult) {
                break;
            }

            const seatingMovedEvent: SeatingMovedEvent = {
                type: 'SEATING_MOVED',
                payload: {
                    playerId: pendingRequest.requesterId,
                    sourceSeatIndex: swapResult.sourceSeatIndex,
                    targetSeatIndex: swapResult.targetSeatIndex,
                    seatingOrder: swapResult.nextSeatingOrder,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(seatingMovedEvent);
            break;
        }

        case 'CANCEL_SEAT_SWAP': {
            const pendingRequest = state.seatSwapRequest;
            if (!pendingRequest) {
                break;
            }

            const seatSwapCancelledEvent: SeatSwapCancelledEvent = {
                type: 'SEAT_SWAP_CANCELLED',
                payload: pendingRequest,
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(seatSwapCancelledEvent);
            break;
        }

        case 'PLAYER_READY': {
            const readyEvent: PlayerReadyEvent = {
                type: 'PLAYER_READY',
                payload: {
                    playerId: command.playerId,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(readyEvent);
            break;
        }

        case 'PLAYER_UNREADY': {
            const unreadyEvent: PlayerUnreadyEvent = {
                type: 'PLAYER_UNREADY',
                payload: {
                    playerId: command.playerId,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(unreadyEvent);
            break;
        }

        case 'TOGGLE_DIE_LOCK': {
            const payload = command.payload as { dieId: number };
            const die = state.dice.find(d => d.id === payload.dieId);
            if (die) {
                const event: DieLockToggledEvent = {
                    type: 'DIE_LOCK_TOGGLED',
                    payload: { dieId: die.id, isKept: !die.isKept },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
            }
            break;
        }

        case 'CONFIRM_ROLL': {
            const activeBonusSettlement = state.pendingBonusDiceSettlement;
            if (activeBonusSettlement && isCurrentBonusRollSettlement(state, activeBonusSettlement)) {
                events.push(...buildBonusDiceSettlementEvents({
                    state,
                    settlement: activeBonusSettlement,
                    random,
                    timestamp,
                    sourceCommandType: command.type,
                }));
                break;
            }

            const rollerId = getRollerId(state, phase);
            
            const event: RollConfirmedEvent = {
                type: 'ROLL_CONFIRMED',
                payload: { playerId: rollerId },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            
            // 确认骰面后，打开响应窗口
            // - 排除 rollerId（当前投掷方），因为他们可以主动出牌
            // - triggerId 是对手（优先响应）
            // 例如：进攻方或防御方确认骰面后，对手都可以响应（强制重投等）
            // 
            // 关键：必须用 ROLL_CONFIRMED 事件应用后的状态来检查响应窗口
            // 否则 rollConfirmed 仍为 false，requireRollConfirmed 的卡牌（如抬一手）会被过滤掉
            const stateAfterConfirm = applyEvents(state, [event] as DiceThroneEvent[], reduce);
            const responseWindowEvent = buildAfterRollConfirmedWindowEvent(
                stateAfterConfirm,
                rollerId,
                phase,
                timestamp,
                command.type,
            );
            if (!responseWindowEvent) {
                break;
            }
            events.push(responseWindowEvent);
            return events; // 等待响应窗口关闭
        }

        case 'SELECT_ABILITY': {
            const { abilityId: rawAbilityId } = command.payload as { abilityId: string };
            const selectingPlayerId = phase === 'defensiveRoll'
                ? state.pendingAttack?.defenderId
                : state.activePlayerId;
            const abilityId = normalizeSelectedAbilityId(state, selectingPlayerId, rawAbilityId);

            if (phase === 'defensiveRoll') {
                // 防御技能选择
                const event: AbilityActivatedEvent = {
                    type: 'ABILITY_ACTIVATED',
                    payload: { 
                        abilityId, 
                        playerId: state.pendingAttack!.defenderId,
                        isDefense: true,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
            } else {
                // 进攻技能选择 -> 发起放击
                // 1. 先触发技能激活事件（用于特写展示）
                const abilityActivatedEvent: AbilityActivatedEvent = {
                    type: 'ABILITY_ACTIVATED',
                    payload: { 
                        abilityId, 
                        playerId: state.activePlayerId,
                        isDefense: false,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(abilityActivatedEvent);
                
                // 2. 再发起放击事件
                const defenderId = isTeamMode(state)
                    ? undefined
                    : (getDefaultOpponentId(state, state.activePlayerId) ?? getNextPlayerId(state));
                const isDefendable = isDefendableAttack(state, state.activePlayerId, abilityId);
                
                // 检查这次技能是否会产生 Ultimate Damage
                const match = findPlayerAbility(state, state.activePlayerId, abilityId);
                const isUltimate = match?.ability?.tags?.includes('ultimate') ?? false;
                
                const attackEvent: AttackInitiatedEvent = {
                    type: 'ATTACK_INITIATED',
                    payload: { 
                        attackerId: state.activePlayerId,
                        defenderId,
                        sourceAbilityId: abilityId,
                        isDefendable,
                        isUltimate,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(attackEvent);

                const shouldOpenAttackDeclarationResponseWindow =
                    state.afterRollResponseWindowRequiresAttackDeclaration === true;
                const stateAfterAttackDeclaration = applyEvents(state, events, reduce);
                if (
                    shouldOpenAttackDeclarationResponseWindow
                    && stateAfterAttackDeclaration.pendingAttack?.defenderId !== undefined
                ) {
                    const responseWindowEvent = buildAfterRollConfirmedWindowEvent(
                        stateAfterAttackDeclaration,
                        state.activePlayerId,
                        phase,
                        timestamp,
                        command.type,
                    );
                    if (responseWindowEvent) {
                        events.push(responseWindowEvent);
                    }
                }
            }
            break;
        }

        case 'CONFIRM_COMPARE_ROLL': {
            const currentRollContext = resolveCurrentRollContext(state, phase);
            if (currentRollContext?.kind === 'compare') {
                const choiceEvent = buildCompareRollChoiceEvent(currentRollContext, timestamp, command.type);
                if (choiceEvent) {
                    events.push(choiceEvent);
                    events.push({
                        type: 'COMPARE_ROLL_SETTLED',
                        payload: { contextId: currentRollContext.id },
                        sourceCommandType: command.type,
                        timestamp: timestamp + 1,
                    } as DiceThroneEvent);
                }
            }
            break;
        }

        case 'DRAW_CARD':
        case 'DISCARD_CARD':
        case 'SELL_CARD':
        case 'UNDO_SELL_CARD':
        case 'REORDER_CARD_TO_END':
        case 'PLAY_CARD':
        case 'PLAY_UPGRADE_CARD': {
            return executeCardCommand(matchState, command, random, phase, timestamp);
        }

        case 'RESOLVE_CHOICE': {
            // 由 InteractionSystem 处理，这里只生成领域事件
            // 实际的交互清理在系统层
            break;
        }

        case 'SELECT_DEFENDER_TARGET': {
            const currentInteraction = matchState.sys?.interaction?.current;
            if (currentInteraction?.kind !== 'dt:defender-choice') {
                break;
            }
            const pendingChoice = currentInteraction.data as {
                attackerId?: PlayerId;
                chooserPlayerId?: PlayerId;
                sourceAbilityId?: string;
            } | null;
            if (
                !pendingChoice
                || typeof pendingChoice.attackerId !== 'string'
                || typeof pendingChoice.chooserPlayerId !== 'string'
                || typeof pendingChoice.sourceAbilityId !== 'string'
            ) {
                break;
            }

            const event: DefenderSelectionResolvedEvent = {
                type: 'DEFENDER_SELECTION_RESOLVED',
                payload: {
                    attackerId: pendingChoice.attackerId,
                    chooserPlayerId: pendingChoice.chooserPlayerId,
                    defenderId: command.payload.defenderId,
                    sourceAbilityId: pendingChoice.sourceAbilityId,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(event);
            break;
        }

        case 'RESPONSE_PASS': {
            // 由 ResponseWindowSystem 处理，领域层不生成事件
            break;
        }

        case 'ADVANCE_PHASE': {
            // 阶段推进完全由 FlowSystem 通过 FlowHooks 处理
            // - onPhaseExit: 处理阶段退出逻辑（攻击结算、回合切换等）
            // - onPhaseEnter: 处理阶段进入逻辑（收入、抽牌等）
            // 领域层不再生成 PHASE_CHANGED 事件
            break;
        }

        case 'MODIFY_DIE': {
            const { dieId, newValue } = command.payload as { dieId: number; newValue: number };
            const currentRollContext = resolveCurrentRollContext(state, phase);
            const currentRollDie = findCurrentRollDie(state, dieId, phase);
            const evasionDieActive = currentRollContext?.kind === 'evasion' && currentRollDie !== undefined;
            const die = currentRollDie?.die;
            const attackSnapshotDieIndex = getAttackSnapshotDieIndex(dieId);
            const attackSnapshotDieValue = isAttackSnapshotDieId(dieId)
                && state.pendingAttack
                && attackSnapshotDieIndex >= 0
                && attackSnapshotDieIndex < (state.pendingAttack.attackDiceValues?.length ?? 0)
                ? state.pendingAttack.attackDiceValues?.[attackSnapshotDieIndex]
                : undefined;
            if (die || attackSnapshotDieValue !== undefined) {
                const dieTarget = evasionDieActive
                    ? 'evasionDie'
                    : currentRollContext?.kind === 'bonus'
                        ? 'pendingBonusDie'
                        : attackSnapshotDieValue !== undefined
                            ? 'attackSnapshot'
                            : 'activeDie';
                const event: DieModifiedEvent = {
                    type: 'DIE_MODIFIED',
                    payload: {
                        dieId,
                        oldValue: evasionDieActive
                            ? die?.value ?? newValue
                            : die?.value ?? attackSnapshotDieValue ?? newValue,
                        newValue,
                        playerId: command.playerId,
                        ownerId: evasionDieActive
                            ? currentRollContext?.ownerPlayerId
                            : die?.ownerId
                                ?? currentRollContext?.ownerPlayerId
                                ?? (attackSnapshotDieValue !== undefined ? state.pendingAttack?.attackerId : undefined),
                        target: dieTarget,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(event);
                
                // 规则 3.3 步骤 3：如果骰面被修改且已选择技能，触发重选。
                // 终极技能只有正式发动后才行动锁定；发动前仍可被改骰取消。
                if (shouldRequireAbilityReselectionForCurrentRoll(state, phase)
                    && die
                    && newValue !== die.value) {
                    events.push({
                        type: 'ABILITY_RESELECTION_REQUIRED',
                        payload: {
                            playerId: state.activePlayerId,
                            previousAbilityId: state.pendingAttack.sourceAbilityId,
                            reason: 'dieModified',
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
                
                // 骰子交互完成由 systems.ts 自动处理：
                // 当 DIE_MODIFIED 事件数达到 selectCount 时自动生成 INTERACTION_COMPLETED
            }
            break;
        }

        case 'REROLL_DIE': {
            const { dieId } = command.payload as { dieId: number };
            const currentInteraction = matchState.sys?.interaction?.current;
            const interactionMeta = currentInteraction?.kind === 'multistep-choice'
                ? (currentInteraction.data as { meta?: { dtType?: string; skipAbilityReselection?: boolean } } | undefined)?.meta
                : undefined;
            const skipAbilityReselection = interactionMeta?.dtType === 'selectDie'
                && interactionMeta?.skipAbilityReselection === true;
            events.push(...buildCurrentRollRerollEvents({
                state,
                phase,
                dieId,
                playerId: command.playerId,
                random,
                timestamp,
                sourceCommandType: command.type,
                skipAbilityReselection,
            }));
            break;
        }

        case 'REMOVE_STATUS': {
            const { targetPlayerId, statusId } = command.payload as { targetPlayerId: PlayerId; statusId?: string };
            const targetPlayer = state.players[targetPlayerId];
            if (targetPlayer) {
                if (statusId) {
                    // 移除单个状态/标记的一层；“移除全部”走 statusId 为空的分支。
                    if (!canRemoveStatusFromPlayer(state, command.playerId, targetPlayerId, statusId)) {
                        break;
                    }
                    const currentStacks = targetPlayer.statusEffects[statusId] ?? 0;
                    if (currentStacks > 0) {
                        // 检查状态是否可被移除
                        if (isRemovableStatusId(state, statusId)) {
                            const event: StatusRemovedEvent = {
                                type: 'STATUS_REMOVED',
                                payload: { targetId: targetPlayerId, statusId, stacks: 1 },
                                sourceCommandType: command.type,
                                timestamp,
                            };
                            events.push(event);
                        }
                    } else {
                        // 也检查 tokens
                        const tokenAmount = targetPlayer.tokens[statusId] ?? 0;
                        // 检查 token 是否可被移除
                        if (tokenAmount > 0 && isRemovableStatusId(state, statusId)) {
                            events.push({
                                type: 'TOKEN_CONSUMED',
                                payload: { playerId: targetPlayerId, tokenId: statusId, amount: 1, newTotal: Math.max(0, tokenAmount - 1) },
                                sourceCommandType: command.type,
                                timestamp,
                            } as DiceThroneEvent);
                        }
                    }
                } else {
                    // 移除所有状态（只移除可被移除的）
                    Object.entries(targetPlayer.statusEffects).forEach(([sid, stacks]) => {
                        if (stacks > 0) {
                            if (isRemovableStatusId(state, sid)
                                && canRemoveStatusFromPlayer(state, command.playerId, targetPlayerId, sid)) {
                                events.push({
                                    type: 'STATUS_REMOVED',
                                    payload: { targetId: targetPlayerId, statusId: sid, stacks },
                                    sourceCommandType: command.type,
                                    timestamp,
                                } as StatusRemovedEvent);
                            }
                        }
                    });
                    Object.entries(targetPlayer.tokens).forEach(([tid, amount]) => {
                        if (amount > 0) {
                            if (isRemovableStatusId(state, tid)
                                && canRemoveStatusFromPlayer(state, command.playerId, targetPlayerId, tid)) {
                                events.push({
                                    type: 'TOKEN_CONSUMED',
                                    payload: { playerId: targetPlayerId, tokenId: tid, amount, newTotal: 0 },
                                    sourceCommandType: command.type,
                                    timestamp,
                                } as DiceThroneEvent);
                            }
                        }
                    });
                }
                
                // 交互完成由 systems.ts 自动处理：
                // 当 STATUS_REMOVED/TOKEN_CONSUMED 事件触发时，systems.ts 检测当前交互类型
                // 并生成带正确 interactionId 的 INTERACTION_COMPLETED
            }
            break;
        }

        case 'TRANSFER_STATUS': {
            const { fromPlayerId, toPlayerId, statusId } = command.payload as { fromPlayerId: PlayerId; toPlayerId: PlayerId; statusId: string };
            const fromPlayer = state.players[fromPlayerId];
            const toPlayer = state.players[toPlayerId];
            if (fromPlayer && toPlayer) {
                // 检查是 statusEffects 还是 tokens
                const fromStacks = fromPlayer.statusEffects[statusId] ?? 0;
                const fromTokens = fromPlayer.tokens[statusId] ?? 0;
                
                // 检查是否可被转移（不可移除的 token 也不能被转移）
                if (!isRemovableStatusId(state, statusId)) {
                    // 不可移除的 token 不能被转移，跳过
                    break;
                }
                if (!canRemoveStatusFromPlayer(state, command.playerId, fromPlayerId, statusId)) {
                    break;
                }
                
                if (fromStacks > 0) {
                    const transferStacks = 1;
                    const statusAppliedEvents = buildStatusAppliedOrChoiceEvents({
                        state,
                        targetId: toPlayerId,
                        statusId,
                        stacks: transferStacks,
                        sourceCommandType: command.type,
                        timestamp,
                    });
                    if (statusAppliedEvents.length === 0) {
                        break;
                    }
                    // 转移 1 个状态效果只移动一层；“移除全部”仍由 REMOVE_STATUS 空 statusId 分支处理。
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId: fromPlayerId, statusId, stacks: transferStacks },
                        sourceCommandType: command.type,
                        timestamp,
                    } as StatusRemovedEvent);
                    // 给目标玩家添加状态
                    events.push(...statusAppliedEvents);
                } else if (fromTokens > 0) {
                    const transferAmount = 1;
                    const toTokens = toPlayer.tokens[statusId] ?? 0;
                    const maxTokens = getTokenStackLimit(state, toPlayerId, statusId);
                    const newTotal = Math.min(toTokens + transferAmount, maxTokens);
                    const grantedAmount = Math.max(0, newTotal - toTokens);
                    if (grantedAmount <= 0) {
                        break;
                    }
                    // 移除源玩家的 token
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: { playerId: fromPlayerId, tokenId: statusId, amount: transferAmount, newTotal: Math.max(0, fromTokens - transferAmount) },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                    // 给目标玩家添加 token
                    events.push({
                        type: 'TOKEN_GRANTED',
                        payload: { targetId: toPlayerId, tokenId: statusId, amount: grantedAmount, newTotal },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
                
                // 交互完成由 systems.ts 自动处理：
                // 当 STATUS_REMOVED/STATUS_APPLIED 事件触发时，systems.ts 检测当前交互类型
                // 并生成带正确 interactionId 的 INTERACTION_COMPLETED
            }
            break;
        }

        case 'GRANT_TOKENS': {
            const { targetPlayerId, tokens } = command.payload as {
                targetPlayerId: PlayerId;
                tokens: Array<{ tokenId: string; amount: number }>;
            };
            const targetPlayer = state.players[targetPlayerId];
            if (targetPlayer && tokens?.length > 0) {
                for (const { tokenId, amount } of tokens) {
                    const currentAmount = targetPlayer.tokens[tokenId] ?? 0;
                    const maxStacks = getTokenStackLimit(state, targetPlayerId, tokenId);
                    const newTotal = Math.min(currentAmount + amount, maxStacks);
                    const grantedAmount = Math.max(0, newTotal - currentAmount);
                    events.push({
                        type: 'TOKEN_GRANTED',
                        payload: { targetId: targetPlayerId, tokenId, amount: grantedAmount, newTotal },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
            }
            break;
        }

        case 'RESOLVE_INTERACTION': {
            const currentInteraction = matchState.sys?.interaction?.current;
            if (currentInteraction?.kind !== 'dt:card-interaction') {
                break;
            }

            const interaction = currentInteraction.data as PendingInteraction;
            if (interaction.type === 'selectStatus' && interaction.minSelectCount === 0) {
                events.push({
                    type: 'INTERACTION_COMPLETED',
                    payload: {
                        interactionId: currentInteraction.id,
                        sourceCardId: interaction.sourceCardId ?? '',
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
                break;
            }

            if (interaction.type === 'selectHandCard') {
                const { selectedCardIds = [] } = command.payload as { selectedCardIds?: string[] };
                const player = state.players[interaction.playerId];
                if (!player) break;

                const handCardIds = new Set(player.hand.map(card => card.id));
                const resolvedCardIds = Array.from(new Set(selectedCardIds.filter(cardId => handCardIds.has(cardId))))
                    .slice(0, interaction.selectCount ?? 1);
                for (const [cardIndex, cardId] of resolvedCardIds.entries()) {
                    events.push({
                        type: 'CARD_DISCARDED',
                        payload: {
                            playerId: interaction.playerId,
                            cardId,
                        },
                        sourceCommandType: command.type,
                        timestamp: timestamp + cardIndex,
                    } as DiceThroneEvent);
                }

                if (resolvedCardIds.length > 0) {
                    events.push({
                        type: 'INTERACTION_COMPLETED',
                        payload: {
                            interactionId: currentInteraction.id,
                            sourceCardId: interaction.sourceCardId ?? '',
                        },
                        sourceCommandType: command.type,
                        timestamp: timestamp + resolvedCardIds.length + 1,
                    } as DiceThroneEvent);
                }
                break;
            }

            if (interaction.type !== 'selectPlayer') {
                break;
            }

            const { selectedPlayerIds = [] } = command.payload as { selectedPlayerIds?: PlayerId[] };
            const targetPlayerIds = interaction.targetPlayerIds ?? Object.keys(state.players);
            const resolvedPlayerIds = Array.from(new Set(
                selectedPlayerIds.filter(playerId => targetPlayerIds.includes(playerId))
            )).slice(0, interaction.selectCount ?? 1);

            if (resolvedPlayerIds.length < (interaction.minSelectCount ?? 1)) {
                break;
            }

            const tokenConfigs = interaction.tokenGrantConfigs ?? (
                interaction.tokenGrantConfig ? [interaction.tokenGrantConfig] : []
            );
            const statusConfigs = interaction.statusGrantConfigs ?? (
                interaction.statusGrantConfig ? [interaction.statusGrantConfig] : []
            );
            const resolveCustomActionId = interaction.resolveCustomActionId;

            for (const [playerIndex, targetPlayerId] of resolvedPlayerIds.entries()) {
                if (!state.players[targetPlayerId]) continue;

                if (resolveCustomActionId) {
                    const handler = getCustomActionHandler(resolveCustomActionId);
                    if (!handler) {
                        continue;
                    }

                    const customTimestamp = timestamp + playerIndex * 10;
                    events.push(...handler({
                        ctx: {
                            attackerId: interaction.playerId,
                            defenderId: targetPlayerId,
                            sourceAbilityId: interaction.sourceCardId,
                            state,
                            damageDealt: 0,
                            timestamp: customTimestamp,
                        },
                        targetId: targetPlayerId,
                        attackerId: interaction.playerId,
                        sourceAbilityId: interaction.sourceCardId,
                        state,
                        timestamp: customTimestamp,
                        random,
                        action: {
                            type: 'custom',
                            target: 'self',
                            customActionId: resolveCustomActionId,
                        },
                    }).filter(event => event !== undefined));
                    continue;
                }

                if (tokenConfigs.length > 0 || statusConfigs.length > 0) {
                    for (const [configIndex, tokenConfig] of tokenConfigs.entries()) {
                        const currentAmount = state.players[targetPlayerId]?.tokens[tokenConfig.tokenId] ?? 0;
                        const maxStacks = getTokenStackLimit(state, targetPlayerId, tokenConfig.tokenId);
                        const newTotal = Math.min(currentAmount + tokenConfig.amount, maxStacks);
                        const grantedAmount = Math.max(0, newTotal - currentAmount);
                        events.push({
                            type: 'TOKEN_GRANTED',
                            payload: {
                                targetId: targetPlayerId,
                                tokenId: tokenConfig.tokenId,
                                amount: grantedAmount,
                                newTotal,
                                sourceAbilityId: interaction.sourceCardId,
                            },
                            sourceCommandType: command.type,
                            timestamp: timestamp + playerIndex * 10 + configIndex,
                        } as DiceThroneEvent);
                    }

                    for (const [configIndex, statusConfig] of statusConfigs.entries()) {
                        events.push(...buildStatusAppliedOrChoiceEvents({
                            state,
                            targetId: targetPlayerId,
                            statusId: statusConfig.statusId,
                            stacks: statusConfig.amount,
                            sourceAbilityId: interaction.sourceCardId,
                            sourceCommandType: command.type,
                            timestamp: timestamp + playerIndex * 10 + tokenConfigs.length + configIndex,
                        }));
                    }
                    continue;
                }

                const targetPlayer = state.players[targetPlayerId];
                Object.entries(targetPlayer.statusEffects).forEach(([statusId, stacks], statusIndex) => {
                    if (stacks <= 0) return;
                    if (!isRemovableStatusId(state, statusId)) return;
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId: targetPlayerId, statusId, stacks },
                        sourceCommandType: command.type,
                        timestamp: timestamp + playerIndex * 100 + statusIndex,
                    } as StatusRemovedEvent);
                });

                Object.entries(targetPlayer.tokens).forEach(([tokenId, amount], tokenIndex) => {
                    if (amount <= 0) return;
                    if (!isRemovableStatusId(state, tokenId)) return;
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: { playerId: targetPlayerId, tokenId, amount, newTotal: 0 },
                        sourceCommandType: command.type,
                        timestamp: timestamp + playerIndex * 100 + 50 + tokenIndex,
                    } as DiceThroneEvent);
                });
            }

            if (resolveCustomActionId) {
                events.push({
                    type: 'INTERACTION_COMPLETED',
                    payload: {
                        interactionId: currentInteraction.id,
                        sourceCardId: interaction.sourceCardId ?? '',
                    },
                    sourceCommandType: command.type,
                    timestamp: timestamp + resolvedPlayerIds.length * 10 + 1,
                } as DiceThroneEvent);
            }

            break;
        }

        // 已废弃 - 迁移到 InteractionSystem
        // case 'CONFIRM_INTERACTION': {
        //     ... (约 150 行代码已删除)
        // }

        // 已废弃 - 迁移到 InteractionSystem
        // case 'CANCEL_INTERACTION': {
        //     ... (约 20 行代码已删除)
        // }

        case 'USE_TOKEN':
        case 'SKIP_TOKEN_RESPONSE':
        case 'USE_PURIFY':
        case DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN:
        case 'REROLL_BONUS_DIE':
        case 'SKIP_BONUS_DICE_REROLL':
            return executeTokenCommand(state, command, random, timestamp, phase);

        case 'USE_PASSIVE_ABILITY': {
            const responseWindowType = matchState.sys?.responseWindow?.current?.windowType as DtResponseWindowType | undefined;
            const { passiveId, actionIndex, targetDieId } = command.payload as {
                passiveId: string;
                actionIndex: number;
                targetDieId?: number;
            };
            const passives = getPlayerPassiveAbilities(state, command.playerId);
            const passive = passives.find(p => p.id === passiveId);
            if (!passive) break;
            if (!Number.isInteger(actionIndex)) break;
            const action = passive.actions[actionIndex];
            if (!action) break;
            if (!isPassiveActionUsable(
                state,
                command.playerId,
                passiveId,
                actionIndex,
                phase,
                { responseWindowType },
            )) break;
            if (action.type === 'rerollDie') {
                if (!Number.isInteger(targetDieId)) break;
                const currentDie = findCurrentRollDie(state, targetDieId, phase);
                if (!currentDie) break;
            }

            const player = state.players[command.playerId];
            if (!player) break;
            const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
            if (currentCp < action.cpCost) break;

            // 扣除 CP
            if (action.cpCost > 0) {
                const newCp = currentCp - action.cpCost;
                events.push({
                    type: 'CP_CHANGED',
                    payload: { playerId: command.playerId, delta: -action.cpCost, newValue: newCp, sourceAbilityId: passiveId },
                    sourceCommandType: command.type,
                    timestamp,
                });
            }

            // 扣除 Token 成本（如树精的幼种/木苗树灵/生命源泉、工匠合成器）
            const passiveTokenCosts = getPassiveActionTokenCosts(action).filter((tokenCost) => (
                !isArtificerNanobotPassiveActivation(passiveId, actionIndex) || tokenCost.tokenId !== TOKEN_IDS.NANOBOT
            ));
            for (const tokenCost of passiveTokenCosts) {
                const currentTokenAmount = player.tokens[tokenCost.tokenId] ?? 0;
                events.push({
                    type: 'TOKEN_CONSUMED',
                    payload: {
                        playerId: command.playerId,
                        tokenId: tokenCost.tokenId,
                        amount: tokenCost.amount,
                        newTotal: Math.max(0, currentTokenAmount - tokenCost.amount),
                        sourceAbilityId: passiveId,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
            }

            // 执行动作
            if (action.type === 'rerollDie') {
                events.push(...buildCurrentRollRerollEvents({
                    state,
                    phase,
                    dieId: targetDieId,
                    playerId: command.playerId,
                    random,
                    timestamp: timestamp + 1,
                    sourceCommandType: command.type,
                }));
            } else if (action.type === 'drawCard') {
                events.push(
                    ...buildDrawEvents(state, command.playerId, 1, random, command.type, timestamp + 1, passiveId)
                );
            } else if (action.type === 'custom' && action.customActionId) {
                const handler = getCustomActionHandler(action.customActionId);
                if (handler) {
                    const opponentId = getDefaultOpponentId(state, command.playerId) ?? command.playerId;
                    events.push(...handler({
                        ctx: {
                            attackerId: command.playerId,
                            defenderId: opponentId,
                            sourceAbilityId: passiveId,
                            state,
                            damageDealt: 0,
                            timestamp: timestamp + 1,
                        },
                        targetId: opponentId,
                        attackerId: command.playerId,
                        sourceAbilityId: passiveId,
                        state,
                        timestamp: timestamp + 1,
                        random,
                        action: { type: 'custom', target: 'self', customActionId: action.customActionId },
                    }));
                }
            }
            break;
        }

         default: {
            console.warn(`Unknown command type: ${(command as DiceThroneCommand).type}`);
        }
    }
 
    return events;
}
