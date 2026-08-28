/**
 * 大杀四方 (Smash Up) - 命令执行与事件归约
 *
 * execute: 命令 → 事件列表
 * reduce: 事件 → 新状态（确定性）
 * 
 * ## execute 层职责约束（Critical）
 * 
 * execute 函数的唯一职责：命令 → 基础事件。
 * 
 * ✅ 允许：
 * - 生成基础事件（MINION_PLAYED / ACTION_PLAYED / CARDS_DRAWN 等）
 * - 读取当前状态进行条件判断
 * - 调用纯函数辅助（getCardDef / findUnit 等）
 * 
 * ❌ 禁止：
 * - 调用触发链函数（fireMinionPlayedTriggers / triggerOnPlay 等）
 * - 调用 reduce 模拟状态推演
 * - 直接修改 state.sys
 * - 创建交互（应在能力执行器中通过 queueInteraction 创建）
 * 
 * 所有触发链（onPlay / onMinionPlayed / ongoing triggers）必须在
 * postProcessSystemEvents 中统一处理，避免重复触发。
 * 
 * 详见：.spec/knowledge/standards/engine-systems.md「领域层职责边界」节
 */

import type { MatchState, RandomFn } from '../../../engine/types';
import type {
    SmashUpCommand,
    SmashUpCore,
    SmashUpEvent,
    ActionCounteredEvent,
    MinionPlayedEvent,
    CardsDiscardedEvent,
    FactionSelectedEvent,
    FactionDeselectedEvent,
    FactionBannedEvent,
    FactionReadyConfirmedEvent,
    SeatSwappedEvent,
    AllFactionsSelectedEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    MinionReturnedEvent,
    MinionControlChangedEvent,
    BuriedCardReturnedToHandEvent,
    CardRecoveredFromDiscardEvent,
    OngoingDetachedEvent,
    TalentUsedEvent,
    CardInstance,
    PlayerState,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    TempPowerAddedEvent,
    PermanentPowerAddedEvent,
    CardToDeckBottomEvent,
    CardTransferredEvent,
    SpecialAfterScoringArmedEvent,
    ReactionPassRequestedEvent,
    RevealHandEvent,
    RevealDeckTopEvent,
    DeckInspectedEvent,
    MunchkinMonsterDefeatedEvent,
} from './types';
import type { PlayerId } from '../../../engine/types';
import { SU_COMMANDS, SU_EVENTS, STARTING_HAND_SIZE } from './types';
import { getMinionDef, getMinionLikePower, getCardDef, getFusionDef } from '../data/cards';
import type { ActionCardDef, FusionCardDef } from './types';
import { buildCardInstanceFromObjectRef, getCardTransferObjectRef } from './objectProvenance';
import {
    buildDeck,
    drawCards,
    getActionLikeResponseWindowTiming,
    getMinionLikeResponseWindowLimitGroup,
    isCardMinionLike,
    matchesDefId,
} from './utils';
import { autoMulligan } from '../../../engine/primitives/mulligan';
import { maybeQueueStartingHandMulliganPrompt } from './mulliganHandlers';
import { resolveOnPlay, resolveSpecial, resolveTalent, resolveOnDestroy, resolveOngoingActivation } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import { triggerActiveBaseAbility } from './baseAbilities';
import { collectExtendedBaseAbilityTriggers } from './baseAbilityQueue';
import { fireTriggers, collectTriggers } from './ongoingEffects';
import { getEffectivePower } from './ongoingModifiers';
import { maybeResolveReactionQueue } from './reactionQueue';
import { applyTriggerQueueFactEvent } from './triggerQueueFacts';
import { doesDestroyedMinionEnterOwnerDiscard } from './destroyFacts';
import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent';
import { canPlayFromDiscard } from './discardPlayability';
import { canPlayActionFromDiscard } from './discardActionPlayability';
import {
    reduceBuriedCardReturnedToHandEvent,
    reduceCardRecoveredFromDiscardEvent,
    reduceCardTransferredEvent,
    reduceDeckInspectionFactEvent,
    reduceMinionMovedEvent,
    reduceMinionReturnedEvent,
    reduceOngoingDetachedEvent,
} from './reduce';
import { buildAffectRecords, type AffectRecord } from './affect';
import { buildActionPlayedEvent } from './actionPlayEvent';
import {
    filterSemanticProtectedAffectEvents,
    resolveSemanticMinionEventProtectionBlock,
} from './effectSemantics';
import {
    createPendingActionResolution,
    maybeQueueActionCounterWindow,
    resolvePendingActionExecution,
} from './actionCounter';
import { getSmashUpReactionWindowContext } from './reactionWindowState';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import {
    buildSmashUpSetupBasesForSelectedFactions,
    getSmashUpDraftTurnOrder,
    getSmashUpFactionsPerPlayer,
    getSmashUpSelectableFactionIds,
} from './pregameDraft';
import {
    buildFactionSelectionIdentitySet,
    normalizeFactionSelectionId,
} from './ids';

// ============================================================================
// execute：命令 → 事件
// ============================================================================

function findTitanByUid(core: SmashUpCore, titanUid: string) {
    return (core.titans ?? []).find(titan => titan.uid === titanUid);
}

function completeSmashUpFactionSelectionsForSetup(
    core: SmashUpCore,
    playerSelections: Record<PlayerId, string[]>,
    draftTurnOrder: readonly PlayerId[],
    factionsPerPlayer: number,
    random: RandomFn,
): Record<PlayerId, string[]> {
    const requiredFactionCount = Math.max(2, factionsPerPlayer);
    const selection = core.factionSelection;
    const selectableFactionIds = getSmashUpSelectableFactionIds(
        core.enabledExpansions ?? ['titans', 'diy'],
        core.includedFactionIds,
    );
    const selectableIdentities = buildFactionSelectionIdentitySet(selectableFactionIds);
    const completedSelections: Record<PlayerId, string[]> = {};
    const takenIdentities = new Set<string>();

    for (const playerId of draftTurnOrder) {
        const normalizedSelections: string[] = [];
        for (const factionId of playerSelections[playerId] ?? []) {
            if (typeof factionId !== 'string' || factionId.length === 0) continue;
            const identity = normalizeFactionSelectionId(factionId);
            if (!identity || !selectableIdentities.has(identity)) continue;
            normalizedSelections.push(factionId);
            takenIdentities.add(identity);
            if (normalizedSelections.length >= requiredFactionCount) break;
        }
        completedSelections[playerId] = normalizedSelections;
    }

    for (const playerId of draftTurnOrder) {
        const currentSelections = completedSelections[playerId] ?? [];
        if (currentSelections.length >= requiredFactionCount) continue;

        const mode = selection?.mode ?? core.factionSelectionMode ?? 'snakeDraft';
        const configuredCandidatePool = mode === 'individualPools'
            ? selection?.playerCandidatePools?.[playerId] ?? []
            : selection?.sharedCandidatePool ?? [];
        const candidatePool = configuredCandidatePool.length > 0
            ? configuredCandidatePool
            : selectableFactionIds;
        const shuffledCandidates = random.shuffle(candidatePool);

        for (const factionId of shuffledCandidates) {
            if (typeof factionId !== 'string' || factionId.length === 0) continue;
            const identity = normalizeFactionSelectionId(factionId);
            if (!identity || !selectableIdentities.has(identity) || takenIdentities.has(identity)) continue;
            currentSelections.push(factionId);
            takenIdentities.add(identity);
            if (currentSelections.length >= requiredFactionCount) break;
        }

        if (currentSelections.length < requiredFactionCount) {
            throw new Error(`派系选择补齐失败：玩家 ${playerId} 需要 ${requiredFactionCount} 个可用派系`);
        }
    }

    return completedSelections;
}

function buildAllFactionsSelectedSetupEvent(
    core: SmashUpCore,
    playerSelections: Record<PlayerId, string[]>,
    draftTurnOrder: PlayerId[],
    factionsPerPlayer: number,
    random: RandomFn,
    now: number,
): { event: AllFactionsSelectedEvent; mulliganPlayers: PlayerId[] } {
    const readiedPlayers: AllFactionsSelectedEvent['payload']['readiedPlayers'] = {};
    const completedPlayerSelections = completeSmashUpFactionSelectionsForSetup(
        core,
        playerSelections,
        draftTurnOrder,
        factionsPerPlayer,
        random,
    );
    let nextUid = core.nextUid;
    const mulliganPlayers: PlayerId[] = [];

    const selectedFactions = Object.values(completedPlayerSelections).flatMap((items) => items);
    const setupBases = buildSmashUpSetupBasesForSelectedFactions(
        selectedFactions,
        draftTurnOrder.length,
        random,
        core.enabledExpansions ?? ['titans', 'diy'],
        core.factionSelection?.basePoolPolicy ?? core.basePoolPolicy ?? 'selectedFactionBases',
    );

    for (const pid of draftTurnOrder) {
        const factions = completedPlayerSelections[pid];
        if (factions && factions.length >= 2) {
            const { deck, nextUid: afterDeckUid } = buildDeck(
                [factions[0], factions[1]],
                pid,
                nextUid,
                random,
            );
            nextUid = afterDeckUid;

            const drawResult = drawCards(
                {
                    ...core.players[pid],
                    deck,
                    hand: [],
                    discard: [],
                } as PlayerState,
                STARTING_HAND_SIZE,
                random,
            );

            readiedPlayers[pid] = {
                deck: drawResult.deck,
                hand: drawResult.hand,
            };
            if (!drawResult.hand.some(isCardMinionLike)) {
                mulliganPlayers.push(pid);
            }
        }
    }

    return {
        event: {
            type: SU_EVENTS.ALL_FACTIONS_SELECTED,
            payload: {
                readiedPlayers,
                selectedFactionsByPlayer: completedPlayerSelections,
                nextUid,
                bases: setupBases.bases,
                baseDeck: setupBases.baseDeck,
                nextBaseInstanceId: setupBases.nextBaseInstanceId,
                ...(mulliganPlayers.length > 0 ? { mulliganPlayers } : {}),
            },
            timestamp: now,
        },
        mulliganPlayers,
    };
}

export function execute(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn
): SmashUpEvent[] {
    const now = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const _core = state.core;

    // 系统命令（SYS_ 前缀）由引擎层处理，领域层不生成事件
    if ((command as { type: string }).type.startsWith('SYS_')) {
        return [];
    }

    const { events, updatedState } = executeCommand(state, command, random, now);
    
    // 如果能力修改了 matchState（如 queueInteraction 创建了 Interaction），
    // 通过引用赋值将 sys 更新传递给 pipeline
    if (updatedState) {
        state.sys = updatedState.sys;
    }

    if (command.type === SU_COMMANDS.REACTION_PASS) {
        return events;
    }

    // 后处理：onDestroy 触发 → onMove 触发（循环直到稳定）→ onAffected 触发
    // 注意：postProcessSystemEvents 只用于“系统事件”（afterEvents 轮中产生、不会经过 execute 的领域事件）。
    const afterDestroyMove = processDestroyMoveCycle(events, state, command.playerId, random, now);
    
    if (afterDestroyMove.matchState) {
        state.sys = afterDestroyMove.matchState.sys;
    }
    const afterReturnToHand = processReturnToHandTriggers(afterDestroyMove.events, state, command.playerId, random, now);
    if (afterReturnToHand.matchState) {
        state.sys = afterReturnToHand.matchState.sys;
    }
    const afterClydeChoice = processClydeDetachChoices(afterReturnToHand.events, state, now);
    if (afterClydeChoice.matchState) {
        state.sys = afterClydeChoice.matchState.sys;
    }
    // 返回手牌保护过滤（deep_roots / entangled / ghost_incorporeal 等）
    const afterProtectedAffect = filterProtectedAffectEvents(afterClydeChoice.events, state.core, command.playerId);
    const afterAffect = processAffectTriggers(afterProtectedAffect, state, command.playerId, random, now);
    if (afterAffect.matchState) {
        state.sys = afterAffect.matchState.sys;
    }
    const afterDeckInspection = processDeckInspectionTriggers(afterAffect.events, state, command.playerId, random, now);
    if (afterDeckInspection.matchState) {
        state.sys = afterDeckInspection.matchState.sys;
    }
    
    return afterDeckInspection.events;
}

/** 内部命令执行（不含后处理） */
function executeCommand(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn,
    now: number
): { events: SmashUpEvent[]; updatedState?: MatchState<SmashUpCore> } {
    // 防御性初始化：处理测试环境可能传递裸 core 的情况
    // 如果 state 没有 core 字段，说明传递的是裸 core，需要包装
    if (!(state as any).core) {
        state = { core: state as any, sys: { interaction: { queue: [] } } as any };
    }
    // 确保 sys 和 sys.interaction 存在
    if (!state.sys) {
        state = { ...state, sys: { interaction: { queue: [] } } as any };
    } else if (!state.sys.interaction) {
        state = { ...state, sys: { ...state.sys, interaction: { queue: [] } } };
    }
    const core = state.core;

    switch (command.type) {
        case SU_COMMANDS.PLAY_MINION: {
            const player = core.players[command.playerId];
            const fromDiscard = command.payload.fromDiscard === true;
            const fromDeck = command.payload.fromDeck === true;
            const fromStored = command.payload.fromStored === true;
            const originalCard = fromStored
                ? player.storedCards?.find(c => c.uid === command.payload.cardUid)
                : fromDiscard
                    ? player.discard.find(c => c.uid === command.payload.cardUid)!
                    : fromDeck
                        ? player.deck.find(c => c.uid === command.payload.cardUid)!
                        : player.hand.find(c => c.uid === command.payload.cardUid)!;
            const replacementCard = (!fromDiscard && !fromDeck && !fromStored && command.payload.replacementHandCardUid)
                ? player.hand.find(c =>
                    c.uid === command.payload.replacementHandCardUid
                    && c.defId === 'penguins_dancing_penguin'
                )
                : undefined;
            const card = replacementCard ?? originalCard;
            if (!card) return state;
            const minionDef = getMinionDef(card.defId);
            const reactionWindow = getSmashUpReactionWindowContext(state);
            const baseIndex = command.payload.baseIndex;
            const events: SmashUpEvent[] = [];
            let updatedState: MatchState<SmashUpCore> | undefined;
            const basePower = getMinionLikePower(card.defId) ?? 0;

            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    baseIndex,
                    ownerId: card.owner,
                    baseDefId: core.bases[baseIndex].defId,
                    power: basePower,
                    fromDiscard: fromDiscard || undefined,
                    fromDeck: fromDeck || undefined,
                    fromStored: fromStored || undefined,
                    ...(fromDiscard ? (() => {
                        const info = canPlayFromDiscard(core, command.playerId, card.uid, baseIndex);
                        return info
                            ? { discardPlaySourceId: info.sourceId, consumesNormalLimit: info.consumesNormalLimit }
                            : {
                                ...(command.payload.discardPlaySourceId ? { discardPlaySourceId: command.payload.discardPlaySourceId } : {}),
                                ...(command.payload.consumesNormalLimit === false ? { consumesNormalLimit: false } : {}),
                            };
                    })() : {}),
                    ...(fromDeck || fromStored ? { consumesNormalLimit: false } : {}),
                    // meFirst 响应窗口中打出 beforeScoringPlayable 随从不消耗正常额度
                    ...(reactionWindow?.windowType === 'meFirst' && (() => {
                        if (minionDef?.beforeScoringPlayable) return true;
                        const fusionDef = getFusionDef(card.defId);
                        return fusionDef?.minionBeforeScoringPlayable === true;
                    })()
                        ? { consumesNormalLimit: false }
                        : {}),
                    ...(command.payload.playAsAction ? { consumesNormalLimit: false, playAsAction: true } : {}),
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            if (replacementCard && originalCard && originalCard.uid !== replacementCard.uid) {
                events.push({
                    type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                    payload: {
                        cardUid: originalCard.uid,
                        defId: originalCard.defId,
                        ownerId: originalCard.owner,
                        sourcePlayerId: command.playerId,
                        sourceCardUid: replacementCard.uid,
                        sourceDefId: replacementCard.defId,
                        sourceControllerId: command.playerId,
                        sourceBaseIndex: baseIndex,
                        reason: 'penguins_dancing_penguin',
                    },
                    timestamp: now,
                } as CardToDeckBottomEvent);
            }

            events.push(playedEvt);

            const responseLimitGroup = reactionWindow?.windowType
                ? getMinionLikeResponseWindowLimitGroup(card.defId, reactionWindow.windowType)
                : undefined;
            if (responseLimitGroup) {
                events.push({
                    type: SU_EVENTS.SPECIAL_LIMIT_USED,
                    payload: {
                        playerId: command.playerId,
                        baseIndex,
                        limitGroup: responseLimitGroup,
                        abilityDefId: card.defId,
                    },
                    timestamp: now,
                } as SmashUpEvent);
            }

            // 触发链由 postProcessSystemEvents 统一处理，避免重复触发
            // （postProcessSystemEvents 会检测所有 MINION_PLAYED 事件并调用 fireMinionPlayedTriggers）

            return { events };
        }

        case SU_COMMANDS.PLAY_ACTION: {
            const shouldBypassReactionChoose = (
                state.sys.interaction?.current?.kind === 'simple-choice'
                && (state.sys.interaction.current.data as { sourceId?: string } | undefined)?.sourceId === 'smashup_reaction_choose'
            );
            const workingState = shouldBypassReactionChoose
                ? {
                    ...state,
                    sys: {
                        ...state.sys,
                        interaction: {
                            ...state.sys.interaction,
                            current: undefined,
                        },
                    },
                }
                : state;

            const player = workingState.core.players[command.playerId];
            const fromDiscard = command.payload.fromDiscard === true;
            const fromStored = command.payload.fromStored === true;
            const card = (fromStored
                ? player.storedCards?.find(c => c.uid === command.payload.cardUid)
                : fromDiscard
                ? player.discard.find(c => c.uid === command.payload.cardUid)
                : player.hand.find(c => c.uid === command.payload.cardUid))!;
            const discardActionPlay = fromDiscard
                ? canPlayActionFromDiscard(
                    core,
                    command.playerId,
                    card.uid,
                    command.payload.targetBaseIndex,
                    command.payload.targetMinionUid,
                )
                : null;
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            const events: SmashUpEvent[] = [];
            let updatedState: MatchState<SmashUpCore> | undefined;

            const event = buildActionPlayedEvent({
                playerId: command.playerId,
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                targetBaseIndex: command.payload.targetBaseIndex,
                targetMinionUid: command.payload.targetMinionUid,
                isExtraAction: fromStored || discardActionPlay?.consumesNormalLimit === false || command.payload.consumesNormalLimit === false || undefined,
                fromDiscard,
                fromStored,
                discardPlaySourceId: discardActionPlay?.sourceId ?? command.payload.discardPlaySourceId,
                consumesNormalLimit: discardActionPlay?.consumesNormalLimit ?? command.payload.consumesNormalLimit,
                sourceCommandType: command.type,
                timestamp: now,
            });
            events.push(event);

            const pendingResolution = createPendingActionResolution({
                playerId: command.playerId,
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                targetBaseIndex: command.payload.targetBaseIndex,
                targetMinionUid: command.payload.targetMinionUid,
                fromDiscard,
                fromStored,
                now,
            });
            const counterWindowState = maybeQueueActionCounterWindow(workingState, pendingResolution, now);
            if (counterWindowState) {
                updatedState = counterWindowState;
                return { events, updatedState };
            }

            const resolution = resolvePendingActionExecution(workingState, pendingResolution, random, now);
            events.push(...resolution.events);
            if (fromDiscard && discardActionPlay?.sourceId.startsWith('diy_clowns_')) {
                events.push({
                    type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                    payload: {
                        cardUid: card.uid,
                        defId: card.defId,
                        ownerId: card.owner,
                        sourcePlayerId: command.playerId,
                        reason: discardActionPlay.sourceId,
                    },
                    timestamp: now,
                } as CardToDeckBottomEvent);
            }
            if (resolution.state !== workingState) {
                updatedState = resolution.state;
            }

            // 基地能力触发：onActionPlayed（如工坊：额外打出一张战术）
            return updatedState ? { events, updatedState } : { events };
        }

        case SU_COMMANDS.DISCARD_TO_LIMIT: {
            const event: CardsDiscardedEvent = {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: command.playerId,
                    cardUids: command.payload.cardUids,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [event] };
        }

        case SU_COMMANDS.REACTION_PASS: {
            const event: ReactionPassRequestedEvent = {
                type: SU_EVENTS.REACTION_PASS_REQUESTED,
                payload: {
                    playerId: command.playerId,
                    reason: command.payload.reason,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [event] };
        }

        case SU_COMMANDS.SELECT_FACTION: {
            const { factionId } = command.payload;
            const events: SmashUpEvent[] = [];
            const selectedEvt: FactionSelectedEvent = {
                type: SU_EVENTS.FACTION_SELECTED,
                payload: { playerId: command.playerId, factionId },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(selectedEvt);

            // 检查选秀是否完成
            const selection = core.factionSelection!;
            const factionsPerPlayer = getSmashUpFactionsPerPlayer(selection);
            const draftTurnOrder = getSmashUpDraftTurnOrder(core);
            const tempSelections = { ...selection.playerSelections };
            tempSelections[command.playerId] = [
                ...(tempSelections[command.playerId] || []),
                factionId,
            ];
            const allPlayersSelected = draftTurnOrder.every(
                (playerId) => (tempSelections[playerId] ?? []).length >= factionsPerPlayer,
            );

            if (allPlayersSelected && selection.mode !== 'individualPools') {
                const setupEvent = buildAllFactionsSelectedSetupEvent(
                    core,
                    tempSelections,
                    draftTurnOrder,
                    factionsPerPlayer,
                    random,
                    now,
                );
                events.push(setupEvent.event);

                // 规则：起手无随从“可”重抽一次 → 排队交互（不会影响核心事件链）
                // 注意：这一步只改变 sys.interaction，不直接改 core；重抽由交互 handler 生成事件完成。
                let updated = state;
                for (const pid of setupEvent.mulliganPlayers) {
                    updated = maybeQueueStartingHandMulliganPrompt(updated, pid, now);
                }
                return { events, updatedState: updated };
            }

            return { events };
        }

        case SU_COMMANDS.DESELECT_FACTION: {
            const { factionId } = command.payload;
            const deselectedEvt: FactionDeselectedEvent = {
                type: SU_EVENTS.FACTION_DESELECTED,
                payload: { playerId: command.playerId, factionId },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [deselectedEvt] };
        }

        case SU_COMMANDS.BAN_FACTION: {
            const selection = core.factionSelection!;
            const stage = selection.phase === 'banAfterFirstRound' ? 'afterFirstRound' : 'preDraft';
            const bannedEvt: FactionBannedEvent = {
                type: SU_EVENTS.FACTION_BANNED,
                payload: {
                    playerId: command.playerId,
                    factionId: command.payload.factionId,
                    stage,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [bannedEvt] };
        }

        case SU_COMMANDS.CONFIRM_FACTION_READY: {
            const selection = core.factionSelection!;
            const draftTurnOrder = getSmashUpDraftTurnOrder(core);
            const readyPlayers = new Set(selection.readyPlayers ?? []);
            readyPlayers.add(command.playerId);
            const readyEvt: FactionReadyConfirmedEvent = {
                type: SU_EVENTS.FACTION_READY_CONFIRMED,
                payload: { playerId: command.playerId },
                sourceCommandType: command.type,
                timestamp: now,
            };
            const events: SmashUpEvent[] = [readyEvt];

            if (draftTurnOrder.every((playerId) => readyPlayers.has(playerId))) {
                const setupEvent = buildAllFactionsSelectedSetupEvent(
                    core,
                    selection.playerSelections,
                    draftTurnOrder,
                    getSmashUpFactionsPerPlayer(selection),
                    random,
                    now,
                );
                events.push(setupEvent.event);

                let updated = state;
                for (const pid of setupEvent.mulliganPlayers) {
                    updated = maybeQueueStartingHandMulliganPrompt(updated, pid, now);
                }
                return { events, updatedState: updated };
            }

            return { events };
        }

        case SU_COMMANDS.SWAP_SEAT: {
            const targetPlayerId = String(command.payload.targetPlayerId) as PlayerId;
            const seatSwappedEvt: SeatSwappedEvent = {
                type: SU_EVENTS.SEAT_SWAPPED,
                payload: {
                    requesterId: command.playerId as PlayerId,
                    targetPlayerId,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [seatSwappedEvt] };
        }

        case SU_COMMANDS.USE_BASE_ABILITY: {
            const { baseIndex, targetBaseIndex, targetMinionUid } = command.payload;
            const base = core.bases[baseIndex];
            if (!base) return { events: [] };

            const events: SmashUpEvent[] = [];

            // 记录“本回合已使用”，用于 oncePerTurn 门禁（与 USE_TALENT 的语义对齐：一旦发动即消耗次数）
            const usedEvt: BaseAbilityUsedEvent = {
                type: SU_EVENTS.BASE_ABILITY_USED,
                payload: {
                    playerId: command.playerId,
                    baseIndex,
                    baseDefId: base.defId,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(usedEvt);

            const result = triggerActiveBaseAbility(base.defId, {
                state: core,
                matchState: state,
                baseIndex,
                baseDefId: base.defId,
                playerId: command.playerId,
                targetBaseIndex,
                targetMinionUid,
                now,
            });
            events.push(...result.events);

            if (result.matchState) {
                return { events, updatedState: result.matchState };
            }
            return { events };
        }

        case SU_COMMANDS.USE_TALENT: {
            const { minionUid, ongoingCardUid, titanUid, baseIndex, targetBaseIndex, targetMinionUid } = command.payload;
            const base = core.bases[baseIndex];
            const events: SmashUpEvent[] = [];

            if (titanUid) {
                const titan = core.titans?.find(candidate => candidate.uid === titanUid);
                if (!titan) return { events: [] };

                const talentEvt: TalentUsedEvent = {
                    type: SU_EVENTS.TALENT_USED,
                    payload: {
                        playerId: command.playerId,
                        titanUid,
                        defId: titan.defId,
                        baseIndex,
                    },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(talentEvt);

                const executor = resolveTalent(titan.defId);
                if (executor) {
                    const ctx: AbilityContext = {
                        state: core,
                        matchState: state,
                        playerId: command.playerId,
                        cardUid: titanUid,
                        defId: titan.defId,
                        baseIndex,
                        targetBaseIndex,
                        targetMinionUid,
                        random,
                        now,
                    };
                    const result = executor(ctx);
                    events.push(...result.events);
                    if (result.matchState) {
                        return { events, updatedState: result.matchState };
                    }
                }
                return { events };
            }

            // ongoing 行动卡天赋（基地上或随从附着）
            if (titanUid) {
                const titan = findTitanByUid(core, titanUid);
                if (!titan || titan.location.zone !== 'base') return { events: [] };

                const talentEvt: TalentUsedEvent = {
                    type: SU_EVENTS.TALENT_USED,
                    payload: {
                        playerId: command.playerId,
                        titanUid,
                        defId: titan.defId,
                        baseIndex,
                    },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(talentEvt);

                const executor = resolveTalent(titan.defId);
                if (executor) {
                    const ctx: AbilityContext = {
                        state: core,
                        matchState: state,
                        playerId: command.playerId,
                        cardUid: titanUid,
                        defId: titan.defId,
                        baseIndex,
                        targetBaseIndex,
                        targetMinionUid,
                        random,
                        now,
                    };
                    const result = executor(ctx);
                    events.push(...result.events);
                    if (result.matchState) {
                        return { events, updatedState: result.matchState };
                    }
                }
                return { events };
            }

            if (ongoingCardUid) {
                let ongoing = base?.ongoingActions.find(o => o.uid === ongoingCardUid);
                if (!ongoing) {
                    for (const m of (base?.minions ?? [])) {
                        const aa = m.attachedActions.find(a => a.uid === ongoingCardUid);
                        if (aa) { ongoing = aa; break; }
                    }
                }
                if (!ongoing) return { events: [] };

                const talentEvt: TalentUsedEvent = {
                    type: SU_EVENTS.TALENT_USED,
                    payload: {
                        playerId: command.playerId,
                        ongoingCardUid,
                        defId: ongoing.defId,
                        baseIndex,
                    },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(talentEvt);

                // 执行天赋能力
                const executor = resolveTalent(ongoing.defId);
                if (executor) {
                    const ctx: AbilityContext = {
                        state: core,
                        matchState: state,
                        playerId: command.playerId,
                        cardUid: ongoingCardUid,
                        defId: ongoing.defId,
                        baseIndex,
                        targetBaseIndex,
                        targetMinionUid,
                        random,
                        now,
                    };
                    const result = executor(ctx);
                    events.push(...result.events);
                    if (result.matchState) {
                        return { events, updatedState: result.matchState };
                    }
                }
                return { events };
            }

            // 随从天赋
            const minion = base?.minions.find(m => m.uid === minionUid);
            if (!minion) return { events: [] };
            // 防御式门禁：避免在未通过 validate 的情况下误消耗 TALENT_USED
            if (
                (minion.defId === 'frankenstein_the_monster' || minion.defId === 'frankenstein_the_monster_pod')
                && (minion.powerCounters ?? 0) < 1
            ) {
                return { events: [] };
            }

            const talentEvt: TalentUsedEvent = {
                type: SU_EVENTS.TALENT_USED,
                payload: {
                    playerId: command.playerId,
                    minionUid,
                    defId: minion.defId,
                    baseIndex,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(talentEvt);

            // 执行天赋能力
            const executor = resolveTalent(minion.defId);
            if (executor) {
                const ctx: AbilityContext = {
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: minionUid!,
                    defId: minion.defId,
                    baseIndex,
                    targetBaseIndex,
                    targetMinionUid,
                    random,
                    now,
                };
                const result = executor(ctx);
                events.push(...result.events);
                if (result.matchState) {
                    return { events, updatedState: result.matchState };
                }
            }

            return { events };
        }

        case SU_COMMANDS.ACTIVATE_SPECIAL: {
            const {
                minionUid: spUid,
                titanUid: spTitanUid,
                discardCardUid: spDiscardUid,
                handCardUid: spHandUid,
                baseIndex: spIdx,
                targetBaseIndex: spTargetBaseIndex,
                targetMinionUid: spTargetMinionUid,
            } = command.payload;
            const spBase = core.bases[spIdx];
            if (spTitanUid) {
                const titan = findTitanByUid(core, spTitanUid);
                if (!titan) return { events: [] };

                const executor = resolveSpecial(titan.defId);
                if (!executor) return { events: [] };

                const ctx: AbilityContext = {
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: spTitanUid,
                    defId: titan.defId,
                    baseIndex: spIdx,
                    targetBaseIndex: spTargetBaseIndex,
                    targetMinionUid: spTargetMinionUid,
                    random,
                    now,
                };
                const result = executor(ctx);
                if (result.matchState) {
                    return { events: result.events, updatedState: result.matchState };
                }
                return { events: result.events };
            }
            if (spDiscardUid) {
                const player = core.players[command.playerId];
                const discardCard = player?.discard.find(card => card.uid === spDiscardUid);
                if (!discardCard) return { events: [] };

                const executor = resolveSpecial(discardCard.defId);
                if (!executor) return { events: [] };

                const ctx: AbilityContext = {
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: spDiscardUid,
                    defId: discardCard.defId,
                    baseIndex: spIdx,
                    targetBaseIndex: spTargetBaseIndex,
                    targetMinionUid: spTargetMinionUid,
                    random,
                    now,
                };
                const result = executor(ctx);
                if (result.matchState) {
                    return { events: result.events, updatedState: result.matchState };
                }
                return { events: result.events };
            }
            if (spHandUid) {
                const player = core.players[command.playerId];
                const handCard = player?.hand.find(card => card.uid === spHandUid);
                if (!handCard) return { events: [] };

                const executor = resolveSpecial(handCard.defId);
                if (!executor) return { events: [] };

                const ctx: AbilityContext = {
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: spHandUid,
                    defId: handCard.defId,
                    baseIndex: spIdx,
                    targetBaseIndex: spTargetBaseIndex,
                    targetMinionUid: spTargetMinionUid,
                    random,
                    now,
                };
                const result = executor(ctx);
                if (result.matchState) {
                    return { events: result.events, updatedState: result.matchState };
                }
                return { events: result.events };
            }
            const spMinion = spBase?.minions.find(m => m.uid === spUid);
            if (!spMinion) return { events: [] };

            const executor = resolveSpecial(spMinion.defId);
            if (!executor) return { events: [] };

            const ctx: AbilityContext = {
                state: core,
                matchState: state,
                playerId: command.playerId,
                cardUid: spUid,
                defId: spMinion.defId,
                baseIndex: spIdx,
                targetBaseIndex: spTargetBaseIndex,
                targetMinionUid: spTargetMinionUid,
                random,
                now,
            };
            const result = executor(ctx);
            if (result.matchState) {
                return { events: result.events, updatedState: result.matchState };
            }
            return { events: result.events };
        }

        case SU_COMMANDS.ACTIVATE_TITAN_ONGOING: {
            const { titanUid, baseIndex } = command.payload;
            const titan = findTitanByUid(core, titanUid);
            if (!titan) return { events: [] };

            const executor = resolveOngoingActivation(titan.defId);
            if (!executor) return { events: [] };

            const ctx: AbilityContext = {
                state: core,
                matchState: state,
                playerId: command.playerId,
                cardUid: titanUid,
                defId: titan.defId,
                baseIndex,
                random,
                now,
            };
            const result = executor(ctx);
            if (result.matchState) {
                return { events: result.events, updatedState: result.matchState };
            }
            return { events: result.events };
        }

        case SU_COMMANDS.DEFEAT_MUNCHKIN_MONSTER: {
            const { baseIndex, monsterUid } = command.payload;
            const monster = core.bases[baseIndex]?.monsters?.find(candidate => candidate.uid === monsterUid);
            if (!monster) return { events: [] };
            const defeatedEvent: MunchkinMonsterDefeatedEvent = {
                type: SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED,
                payload: {
                    playerId: command.playerId,
                    baseIndex,
                    monsterUid,
                    monsterDefId: monster.defId,
                    reason: 'manual_defeat_munchkin_monster',
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [defeatedEvent] };
        }

        default:
            return { events: [] };
    }
}

// ============================================================================
function filterProtectedMinionEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
    protectedEventType: typeof SU_EVENTS.MINION_DESTROYED | typeof SU_EVENTS.MINION_MOVED,
): SmashUpEvent[] {
    const result: SmashUpEvent[] = [];
    let workingCore = core;
    let pendingSourceKey: string | undefined;
    let pendingEvents: SmashUpEvent[] = [];

    const flushPendingEvents = () => {
        for (const pendingEvent of pendingEvents) {
            workingCore = applyPostProcessPrefixEvent(workingCore, pendingEvent);
        }
        pendingEvents = [];
        pendingSourceKey = undefined;
    };

    const appendEvent = (event: SmashUpEvent, sourceKey: string | undefined) => {
        result.push(event);
        if (sourceKey) {
            pendingSourceKey = sourceKey;
            pendingEvents.push(event);
            return;
        }
        workingCore = applyPostProcessPrefixEvent(workingCore, event);
    };

    for (const e of events) {
        const sourceKey = buildAffectEventSourceKey(e, sourcePlayerId);
        if (pendingEvents.length > 0 && sourceKey !== pendingSourceKey) {
            flushPendingEvents();
        }

        if (e.type !== protectedEventType) {
            appendEvent(e, sourceKey);
            continue;
        }
        const resolution = resolveSemanticMinionEventProtectionBlock(
            workingCore,
            e as MinionDestroyedEvent | MinionMovedEvent,
            sourcePlayerId,
        );
        if (resolution.blocked) {
            for (const extraEvent of resolution.extraEvents) {
                appendEvent(extraEvent, sourceKey);
            }
            continue;
        }
        appendEvent(e, sourceKey);
    }
    flushPendingEvents();
    return result;
}

function buildAffectEventSourceKey(event: SmashUpEvent, fallbackSourcePlayerId: PlayerId): string | undefined {
    const payload = (event as { payload?: Record<string, unknown> }).payload;
    if (!payload) return undefined;
    const sourceParts = [
        payload.sourcePlayerId ?? fallbackSourcePlayerId,
        payload.sourceCardUid,
        payload.sourceDefId,
        payload.sourceControllerId,
        payload.sourceBaseIndex,
        payload.reason,
    ];
    if (sourceParts.every(part => part === undefined || part === null || part === '')) {
        return undefined;
    }
    return sourceParts.map(part => String(part ?? '')).join('|');
}

// onDestroy 后处理前的遗留桥接：批量刷新事件流，但保护语义解析已下沉到 shared effect semantics
// ============================================================================

export function filterProtectedDestroyEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
): SmashUpEvent[] {
    return filterProtectedMinionEvents(events, core, sourcePlayerId, SU_EVENTS.MINION_DESTROYED);
}

/** 后处理结果：事件 + 可选的 matchState（触发器可能创建了交互） */
export interface PostProcessResult {
    events: SmashUpEvent[];
    matchState?: MatchState<SmashUpCore>;
}

function findClydeDetachChoiceContext(
    core: SmashUpCore,
    event: OngoingDetachedEvent,
): { baseIndex: number; hostUid: string; clydeControllerId: PlayerId } | undefined {
    if (event.payload.clydeReturnToHand !== undefined) return undefined;
    const { cardUid } = event.payload;

    for (const [baseIndex, base] of core.bases.entries()) {
        const host = base.minions.find(minion =>
            minion.attachedActions.some(action => action.uid === cardUid),
        );
        if (!host) continue;
        if (base.defId === 'base_primate_park') return undefined;
        const clyde = base.minions.find(minion =>
            minion.controller === host.controller
            && matchesDefId(minion.defId, 'cyborg_apes_clyde_2_0'),
        );
        if (!clyde) return undefined;
        return { baseIndex, hostUid: host.uid, clydeControllerId: clyde.controller };
    }

    return undefined;
}

export function processClydeDetachChoices(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    now: number,
): PostProcessResult {
    let matchState = state;
    const result: SmashUpEvent[] = [];

    for (const event of events) {
        if (event.type !== SU_EVENTS.ONGOING_DETACHED) {
            result.push(event);
            const advancedCore = applyPostProcessPrefixEvent(matchState.core, event);
            if (advancedCore !== matchState.core) {
                matchState = { ...matchState, core: advancedCore };
            }
            continue;
        }

        const detached = event as OngoingDetachedEvent;
        const context = findClydeDetachChoiceContext(matchState.core, detached);
        if (!context) {
            result.push(event);
            const advancedCore = reduceOngoingDetachedEvent(matchState.core, detached);
            if (advancedCore !== matchState.core) {
                matchState = { ...matchState, core: advancedCore };
            }
            continue;
        }

        const interaction = createSimpleChoice(
            `cyborg_apes_clyde_2_0_detach_${detached.payload.cardUid}_${now}`,
            context.clydeControllerId,
            '克莱德2.0：是否将离场行动收入手牌？',
            [
                {
                    id: 'return-to-hand',
                    label: '收入手牌',
                    labelKey: 'ui.cyborg_apes_clyde_detach_return_option',
                    value: { returnToHand: true },
                    displayMode: 'button' as const,
                },
                {
                    id: 'discard',
                    label: '进入弃牌堆',
                    labelKey: 'ui.cyborg_apes_clyde_detach_discard_option',
                    value: { returnToHand: false },
                    displayMode: 'button' as const,
                },
            ],
            {
                sourceId: 'cyborg_apes_clyde_2_0_detach',
                targetType: 'generic',
                titleKey: 'ui.cyborg_apes_clyde_detach_title',
            },
        );
        interaction.data.detached = {
            ...detached.payload,
            baseIndex: context.baseIndex,
            hostUid: context.hostUid,
            clydeControllerId: context.clydeControllerId,
            timestamp: detached.timestamp,
        };
        matchState = queueInteraction(matchState, interaction);
    }

    return { events: result, matchState: matchState === state ? undefined : matchState };
}

export function filterProtectedAffectEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    fallbackSourcePlayerId: PlayerId,
): SmashUpEvent[] {
    return filterSemanticProtectedAffectEvents(events, core, fallbackSourcePlayerId);
}

export function buildDestroyEventKey(event: MinionDestroyedEvent): string {
    const payload = event.payload;
    const timestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
    const destroyerId = payload.destroyerId ?? 'unknown';
    return `${payload.minionUid}@${payload.fromBaseIndex}@${destroyerId}@${timestamp}`;
}

function buildAffectRecordEventKey(event: SmashUpEvent, record: AffectRecord, recordIndex: number): string {
    const timestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
    return [
        event.type,
        record.targetKind,
        record.targetUid,
        record.baseIndex ?? 'none',
        record.affectType,
        record.sourcePlayerId ?? 'unknown',
        record.sourceCardUid ?? 'none',
        record.sourceDefId ?? 'none',
        record.reason ?? 'none',
        recordIndex,
        timestamp,
    ].join('@');
}

export function buildAffectEventKeys(
    core: SmashUpCore,
    event: SmashUpEvent,
    fallbackSourcePlayerId?: PlayerId,
): string[] {
    return buildAffectRecords(core, event, fallbackSourcePlayerId)
        .map((record, recordIndex) => ({ record, recordIndex }))
        .filter(({ record }) => record.countsForOnMinionAffected && record.triggerMinion && record.baseIndex !== undefined)
        .map(({ record, recordIndex }) => buildAffectRecordEventKey(event, record, recordIndex));
}

export function processDestroyTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    options?: { skipDestroyEventKeys?: Set<string>; skipReactionQueueResolution?: boolean }
): PostProcessResult {
    const core = state.core;
    // 保护检查：过滤掉受保护的随从的消灭事件
    const filteredEvents = filterProtectedDestroyEvents(events, core, playerId);
    const skipDestroyEventKeys = options?.skipDestroyEventKeys;

    // ✅ 去重：同一个 minionUid 只处理一次（防止重复触发 onDestroy）
    const destroyEventsRaw = filteredEvents.filter(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent[];
    const seenUids = new Set<string>();
    const destroyEvents = destroyEventsRaw.filter(e => {
        const uid = e.payload.minionUid;
        if (seenUids.has(uid)) {
            // 跳过重复的消灭事件
            return false;
        }
        if (skipDestroyEventKeys?.has(buildDestroyEventKey(e))) {
            // 跳过已处理过的消灭事件（防止重复触发）
            seenUids.add(uid);
            return false;
        }
        seenUids.add(uid);
        return true;
    });
    if (destroyEvents.length === 0) return { events: filteredEvents };
    const destroyEventKeysToProcess = new Set(destroyEvents.map(buildDestroyEventKey));

    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;
    let prefixCursor = 0;
    // 待拯救随从：trigger 创建了交互（玩家选择是否拯救）但未产生 MINION_RETURNED，
    // 需要暂缓 MINION_DESTROYED，等交互解决后再决定消灭或拯救
    const pendingSaveMinionUids = new Set<string>();
    // FAQ batching: some base triggers apply once per destruction ability
    const baseDestroyBatchSeen = new Set<string>();

    const advanceStateBeforeDestroy = (destroyEvent: MinionDestroyedEvent) => {
        const targetIndex = filteredEvents.findIndex((event, index) => index >= prefixCursor && event === destroyEvent);
        if (targetIndex < 0) return;

        const prefixEvents = filteredEvents
            .slice(prefixCursor, targetIndex)
            .filter(event => event.type !== SU_EVENTS.MINION_DESTROYED);
        if (prefixEvents.length > 0) {
            const stateBeforePrefix = ms ?? state;
            const advancedCore = prefixEvents.reduce(
                (acc, event) => applyPostProcessPrefixEvent(acc, event),
                stateBeforePrefix.core,
            );
            if (advancedCore !== stateBeforePrefix.core) {
                ms = {
                    ...stateBeforePrefix,
                    core: advancedCore,
                };
            }
        }
        prefixCursor = targetIndex + 1;
    };

    for (const de of destroyEvents) {
        advanceStateBeforeDestroy(de);
        const currentState = ms ?? state;
        const currentCore = currentState.core;
        const destroyEventKey = buildDestroyEventKey(de);
        if (!destroyEventKeysToProcess.has(destroyEventKey)) {
            continue;
        }
        destroyEventKeysToProcess.delete(destroyEventKey);
        const { minionUid, minionDefId, fromBaseIndex, ownerId: eventOwnerId, destroyerId: eventDestroyerId, reason } = de.payload;
        const base = currentCore.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        const triggerMinion = minion ?? {
            uid: minionUid,
            defId: minionDefId,
            owner: eventOwnerId,
            controller: eventOwnerId,
            basePower: getMinionLikePower(minionDefId) ?? 0,
            powerCounters: 0,
            powerModifier: 0,
            tempPowerModifier: 0,
            attachedActions: [],
            metadata: undefined,
        };
        const triggerMinionPower = minion ? getEffectivePower(currentCore, minion, fromBaseIndex) : triggerMinion.basePower;
        // ✅ 优先从 state 读取 owner（兜底修复：即使事件中的 ownerId 错了也能修复）
        const ownerId = minion?.owner ?? eventOwnerId;
        const triggerPlayerId = minion?.controller ?? triggerMinion.controller ?? ownerId;
        // "you destroyed" 类触发只能信任事件显式声明的 destroyerId。
        // 不能把当前回合玩家/目标控制者兜底成消灭者，否则会把中性或缺失归因的消灭误判为玩家造成。
        const destroyerId = eventDestroyerId;

        // === Phase 1: 先检查防止消灭触发器（ongoing replacement） ===
        // 在触发 onDestroy 之前，先确认消灭是否会被防止
        const currentMS_save = currentState;
        const interactionCountBefore =
            (currentMS_save.sys.interaction.current ? 1 : 0) + currentMS_save.sys.interaction.queue.length;

        const saveEvents: SmashUpEvent[] = [];

        // 2. 触发 ongoing 拦截器 onMinionDestroyed（replacement：如雄蜂防止消灭、逃生舱回手牌）
            const ongoingDestroyEvents = fireTriggers(currentCore, 'onMinionDestroyed', {
                state: currentCore,
                matchState: ms ?? currentMS_save,
                playerId: triggerPlayerId,
                baseIndex: fromBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                triggerMinion,
                triggerMinionPower,
                controllerId: triggerPlayerId,
                destroyerId,
                reason: de.payload.reason,
                random,
            now,
        }, { phase: 'replacement' });
        saveEvents.push(...ongoingDestroyEvents.events);
        if (ongoingDestroyEvents.matchState) ms = ongoingDestroyEvents.matchState;

        // 检测"待拯救"模式：baseTrigger/ongoing 创建了新交互但未产生 MINION_RETURNED/MINION_MOVED
        // 典型场景：九命之屋创建玩家选择交互，暂缓消灭等待玩家决定
        // 海盗单基地时直接返回 MINION_MOVED 事件，也视为拯救
        const hasReturn = saveEvents.some(e => e.type === SU_EVENTS.MINION_RETURNED);
        const hasMoveAway = saveEvents.some(e =>
            e.type === SU_EVENTS.MINION_MOVED &&
            (e as MinionMovedEvent).payload.minionUid === minionUid
        );
        const hasDeckRedirect = saveEvents.some(e =>
            (e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) &&
            (e as any).payload?.cardUid === minionUid
        );
        const hasSaveEvent = hasReturn || hasMoveAway || hasDeckRedirect;
        let isPendingSave = false;
        if (!hasSaveEvent && ms) {
            const interactionCountAfter =
                (ms.sys.interaction.current ? 1 : 0) + ms.sys.interaction.queue.length;
            if (interactionCountAfter > interactionCountBefore) {
                // 检查新交互是否为"防止消灭"类交互（白名单）
                // 排除：地窖等"给其他随从加指示物"的交互
                const PREVENT_DESTROY_SOURCE_IDS = [
                    'base_nine_lives_intercept',        // 九命之屋
                    'giant_ant_drone_prevent_destroy',   // 雄蜂防止消灭
                    'pirate_buccaneer_move',             // 海盗：被消灭时移动到其他基地
                    'kitty_cats_hang_in_there',          // 猫咪：坚持住移动随从并弃掉本行动
                ];
                const newInteraction = ms.sys.interaction.current ?? ms.sys.interaction.queue[ms.sys.interaction.queue.length - 1];
                const sourceId = (newInteraction?.data as any)?.sourceId as string | undefined;
                const isPreventDestroy = sourceId ? PREVENT_DESTROY_SOURCE_IDS.includes(sourceId) : false;
                if (isPreventDestroy) {
                    isPendingSave = true;
                    pendingSaveMinionUids.add(minionUid);
                }
            }
        }

        // === Phase 2: 只有确认消灭（无防止/无返回/无移走）时才触发 onDestroy ===
        // 当 isPendingSave 时，Phase 1 的 saveEvents 中包含了所有 onMinionDestroyed 触发器的事件
        // （包括吸血鬼伯爵/投机主义等加指示物事件），这些必须被抑制——
        // 因为消灭尚未确认，等交互解决后再决定是否触发。
        // 只保留 matchState 变更（交互创建），丢弃所有副作用事件。
        //
        // 当 hasSaveEvent 时，消灭被替代/改写（回手牌 / 移动走 / 放回牌库顶/底），
        // 同样需要抑制其他触发器的副作用事件，但保留替代效果事件本身。
        const localEvents: SmashUpEvent[] = isPendingSave
            ? []
            : hasSaveEvent
                ? saveEvents.filter(e =>
                    e.type === SU_EVENTS.MINION_RETURNED ||
                    (e.type === SU_EVENTS.MINION_MOVED && (e as MinionMovedEvent).payload.minionUid === minionUid) ||
                    ((e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) && (e as any).payload?.cardUid === minionUid)
                )
                : [...saveEvents];
        if (!isPendingSave && !hasSaveEvent) {
            const phase2State = ms ?? currentState;
            const phase2Core = phase2State.core;
            const sourceEventId = `minion-destroyed:${minionUid}:${fromBaseIndex}:${now}`;
            const frameId = `minion-destroyed-frame:${minionUid}:${fromBaseIndex}:${now}`;
            if (base) {
                const needsBatchDedup = base.defId === 'base_the_field_of_honor' || base.defId === 'base_crypt';
                const batchKey = `${base.defId}::${fromBaseIndex}::${destroyerId}::${reason ?? ''}`;
                if (!needsBatchDedup || !baseDestroyBatchSeen.has(batchKey)) {
                    if (needsBatchDedup) {
                        baseDestroyBatchSeen.add(batchKey);
                    }
                    const queuedBaseDestroyReaction = collectExtendedBaseAbilityTriggers({
                        core: phase2Core,
                        timing: 'onMinionDestroyed',
                        ownerPlayerId: ownerId,
                        baseIndex: fromBaseIndex,
                        triggerMinionUid: minionUid,
                        triggerMinionDefId: minionDefId,
                        triggerMinionPower,
                        destroyerId,
                        controllerId: minion?.controller ?? ownerId,
                        reason: de.payload.reason,
                        frameId,
                        sourceEventId,
                        now,
                    });
                    if (queuedBaseDestroyReaction) {
                        localEvents.push(queuedBaseDestroyReaction);
                    }
                }
            }
            // reaction-phase triggers for onMinionDestroyed are queued and resolved later (Wiki simultaneous ordering)
            const queuedDestroyReactions = collectTriggers(phase2Core, 'onMinionDestroyed', {
                state: phase2Core,
                matchState: phase2State,
                playerId: triggerPlayerId,
                baseIndex: fromBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                triggerMinion,
                triggerMinionPower,
                controllerId: triggerPlayerId,
                destroyerId,
                reason: de.payload.reason,
                frameId,
                sourceEventId,
                random,
                now,
            });
            if (queuedDestroyReactions) {
                localEvents.push(queuedDestroyReactions);
            }
            const didEnterOwnerDiscard = doesDestroyedMinionEnterOwnerDiscard(phase2Core, de);
            if (didEnterOwnerDiscard) {
                const discardSourceEventId = `minion-discarded-from-base:${minionUid}:${fromBaseIndex}:${now}`;
                const discardFrameId = `minion-discarded-from-base-frame:${minionUid}:${fromBaseIndex}:${now}`;
                const discardTriggerPlayerId = minion?.controller ?? ownerId;
                const queuedDiscardReactions = collectTriggers(phase2Core, 'onMinionDiscardedFromBase', {
                    state: phase2Core,
                    matchState: phase2State,
                    playerId: discardTriggerPlayerId,
                    baseIndex: fromBaseIndex,
                    triggerMinionUid: minionUid,
                    triggerMinionDefId: minionDefId,
                    triggerMinion: minion,
                    triggerMinionPower,
                    destroyerId,
                    controllerId: minion?.controller ?? ownerId,
                    reason: de.payload.reason,
                    frameId: discardFrameId,
                    sourceEventId: discardSourceEventId,
                    random,
                    now,
                });
                if (queuedDiscardReactions) {
                    localEvents.push(queuedDiscardReactions);
                }
            }
            // 1. 触发随从自身的 onDestroy 能力
            const executor = resolveOnDestroy(minionDefId);
            if (executor) {
                const onDestroyPlayerId = minion?.controller ?? ownerId;
                const ctx: AbilityContext = {
                    state: phase2Core,
                    matchState: phase2State,
                    playerId: onDestroyPlayerId,
                    cardUid: minionUid,
                    defId: minionDefId,
                    baseIndex: fromBaseIndex,
                    random,
                    now,
                };
                const result = executor(ctx);
                localEvents.push(...result.events);
                if (result.matchState) ms = result.matchState;
            }
        }

        const filteredLocal = filterProtectedDestroyEvents(localEvents, (ms ?? currentState).core, destroyerId);
        extraEvents.push(...filteredLocal);

        // 同批次多个 MINION_DESTROYED 需要串行吃到最新手牌/牌库状态，
        // 否则像“双小鬼同时被消灭”会重复抽到同一张牌、重复弃同一张牌，第二次实际落不下去。
        if (filteredLocal.length > 0) {
            const stateBeforeAdvance = ms ?? currentState;
            const advancedCore = filteredLocal.reduce(
                (acc, event) => applyPostProcessPrefixEvent(acc, event),
                stateBeforeAdvance.core,
            );
            if (advancedCore !== stateBeforeAdvance.core) {
                ms = {
                    ...stateBeforeAdvance,
                    core: advancedCore,
                };
            }
        }
    }

    // 记录已处理的消灭事件，防止同一事件在后续流程中重复触发
    if (skipDestroyEventKeys) {
        for (const de of destroyEvents) {
            skipDestroyEventKeys.add(buildDestroyEventKey(de));
        }
    }

    // 需要抑制的随从 uid：已被 replacement 改写去向（回手/移动走/放回牌库）+ 待交互拯救
    const suppressedMinionUids = new Set(
        extraEvents
            .filter(e => e.type === SU_EVENTS.MINION_RETURNED)
            .map(e => (e as MinionReturnedEvent).payload.minionUid)
    );
    // 被 MINION_MOVED 移走的随从也视为拯救（如海盗单基地自动移动）
    for (const e of extraEvents) {
        if (e.type === SU_EVENTS.MINION_MOVED) {
            suppressedMinionUids.add((e as MinionMovedEvent).payload.minionUid);
        }
        if (e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) {
            const uid = (e as any).payload?.cardUid as string | undefined;
            if (uid) suppressedMinionUids.add(uid);
        }
    }
    for (const uid of pendingSaveMinionUids) {
        suppressedMinionUids.add(uid);
    }

    const cleanedEvents = suppressedMinionUids.size === 0
        ? filteredEvents
        : filteredEvents.filter(e => {
            if (e.type !== SU_EVENTS.MINION_DESTROYED) return true;
            const { minionUid } = (e as MinionDestroyedEvent).payload;
            return !suppressedMinionUids.has(minionUid);
        });

    const combined = [...cleanedEvents, ...extraEvents];
    const hasImmediateExtraPlay = combined.some(event =>
        event.type === SU_EVENTS.LIMIT_MODIFIED
        && (event as any).payload?.playTiming === 'immediate'
        && ((event as any).payload?.delta ?? 0) > 0
    );

    // Attempt to auto-resolve reaction queue when possible (single trigger, no ordering prompt).
    let coreForQueue = (ms ?? state).core;
    for (const e of combined) {
        if (e.type === SU_EVENTS.TRIGGER_QUEUED || e.type === SU_EVENTS.TRIGGER_CONSUMED) {
            coreForQueue = applyTriggerQueueFactEvent(coreForQueue, e);
        }
    }
    const baseMS = ms ?? state;
    const msForQueue = coreForQueue === baseMS.core ? baseMS : { ...baseMS, core: coreForQueue };
    if (hasImmediateExtraPlay) {
        return { events: combined, matchState: msForQueue };
    }
    if (!options?.skipReactionQueueResolution) {
        const rq = maybeResolveReactionQueue(msForQueue, random, now);
        if (rq) {
            return { events: [...combined, ...rq.events], matchState: rq.state };
        }
    }

    return { events: combined, matchState: ms };
}

// ============================================================================
// onMove 后处理：扫描 MINION_MOVED 事件，触发 onMinionMoved 拦截器
// ============================================================================

/** 遗留桥接：批量刷新 MINION_MOVED，但 move 保护语义解析已下沉到 shared effect semantics */
export function filterProtectedMoveEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
): SmashUpEvent[] {
    return filterProtectedMinionEvents(events, core, sourcePlayerId, SU_EVENTS.MINION_MOVED);
}

// ============================================================================
// onReturn 保护过滤：扫描 MINION_RETURNED 事件，过滤受保护的随从
// ============================================================================

/**
 * 过滤受保护的随从的返回手牌事件
 *
 * 与 filterProtectedMoveEvents 对齐：
 * - 'move' 保护同时阻止移动和返回手牌（deep_roots / entangled）
 * - 'action' / 'affect' 广义保护也阻止返回手牌（ghost_incorporeal / elder_thing）
 *
 * 注意：tooth_and_claw 通过 interceptor 拦截 MINION_RETURNED（引擎管线层），
 * 此函数处理的是 registerProtection 注册的保护（领域层后处理）。
 */
export function filterProtectedReturnEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId
): SmashUpEvent[] {
    return filterProtectedAffectEvents(events, core, sourcePlayerId);
}

// ============================================================================
// onDeckBottom 保护过滤：扫描 CARD_TO_DECK_BOTTOM 事件，过滤受保护的随从
// ============================================================================

/**
 * 过滤受保护的随从的放入牌库底事件
 *
 * CARD_TO_DECK_BOTTOM 没有 fromBaseIndex，需要遍历基地查找随从。
 * 保护检查逻辑与 filterProtectedReturnEvents 对齐：
 * - 'move' 保护阻止（bear_cavalry_superiority 描述含"返回牌库"）
 * - 'action' / 'affect' 广义保护也阻止（ghost_incorporeal / elder_thing 等）
 *
 * 注意：tooth_and_claw 通过 interceptor 拦截 CARD_TO_DECK_BOTTOM（引擎管线层），
 * 此函数处理的是 registerProtection 注册的保护（领域层后处理）。
 * 注意：只过滤场上随从的放牌库底事件，不过滤手牌/弃牌堆的卡牌操作。
 */
export function filterProtectedDeckBottomEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId
): SmashUpEvent[] {
    return filterProtectedAffectEvents(events, core, sourcePlayerId);
}

/** 后处理：触发 onMinionMoved 拦截器 */
export function processMoveTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number
): PostProcessResult {
    const core = state.core;
    // 保护检查：过滤掉受 move 保护的随从的移动事件
    const filteredEvents = filterProtectedMoveEvents(events, core, playerId);
    const moveBatchUidsByBatchId = new Map<string, string[]>();
    for (const event of filteredEvents) {
        if (event.type !== SU_EVENTS.MINION_MOVED) continue;
        const batchId = event.payload.batchId;
        if (!batchId) continue;
        const list = moveBatchUidsByBatchId.get(batchId) ?? [];
        list.push(event.payload.minionUid);
        moveBatchUidsByBatchId.set(batchId, list);
    }

    const moveEvents = filteredEvents.filter(
        e => e.type === SU_EVENTS.MINION_MOVED
    ) as MinionMovedEvent[];
    if (moveEvents.length === 0) return { events: filteredEvents };

    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;
    for (const event of filteredEvents) {
        const stateBeforeMove = ms ?? state;
        const coreBeforeMove = stateBeforeMove.core;
        if (event.type !== SU_EVENTS.MINION_MOVED) {
            ms = { ...stateBeforeMove, core: applyPostProcessPrefixEvent(coreBeforeMove, event) };
            continue;
        }
        const me = event as MinionMovedEvent;
        const { minionUid, minionDefId, fromBaseIndex, toBaseIndex, reason } = me.payload;
        const simultaneousMoveBatchMinionUids = me.payload.batchId
            ? moveBatchUidsByBatchId.get(me.payload.batchId)
            : undefined;
        const advancedCore = reduceMinionMovedEvent(coreBeforeMove, me);
        const advancedMatchState = { ...stateBeforeMove, core: advancedCore };
        const sourceEventId = `minion-moved:${minionUid}:${fromBaseIndex}:${toBaseIndex}:${now}`;
        const frameId = `minion-moved-frame:${minionUid}:${fromBaseIndex}:${toBaseIndex}:${now}`;

        // 触发 ongoing 拦截器 onMinionMoved（改为入队，按 Wiki 同时触发排序解决）
        const queued = collectTriggers(advancedCore, 'onMinionMoved', {
            state: advancedCore,
            matchState: advancedMatchState,
            playerId,
            baseIndex: toBaseIndex,
            frameId,
            sourceEventId,
            moveFromBaseIndex: fromBaseIndex,
            moveToBaseIndex: toBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            simultaneousMoveBatchMinionUids,
            random,
            now,
        });
        if (queued) extraEvents.push(queued);

        // 触发“有随从从该基地移走”的 ongoing onMinionMoved（如硕大圆石）
        if (fromBaseIndex !== toBaseIndex) {
            const queuedFromBase = collectTriggers(advancedCore, 'onMinionMoved', {
                state: advancedCore,
                matchState: advancedMatchState,
                playerId,
                baseIndex: fromBaseIndex,
                frameId,
                sourceEventId,
                moveFromBaseIndex: fromBaseIndex,
                moveToBaseIndex: toBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                simultaneousMoveBatchMinionUids,
                random,
                now,
            });
            if (queuedFromBase) extraEvents.push(queuedFromBase);
        }

        // 触发基地扩展时机 onMinionMoved（如牧场：首次移动触发额外移动）
        // 与 ongoing onMinionMoved 一样统一入队，避免混入直执行交互态而绕开 reaction ordering。
        const targetBase = advancedCore.bases[toBaseIndex];
        if (targetBase) {
            const movedMinion = targetBase.minions.find(minion => minion.uid === minionUid);
            const queuedBase = collectExtendedBaseAbilityTriggers({
                core: advancedCore,
                timing: 'onMinionMoved',
                ownerPlayerId: playerId,
                baseIndex: toBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                triggerMinionPower: movedMinion?.basePower,
                controllerId: movedMinion?.controller,
                reason,
                frameId,
                sourceEventId,
                simultaneousMoveBatchMinionUids,
                now,
            });
            if (queuedBase) {
                extraEvents.push(queuedBase);
            }
        }
        ms = advancedMatchState;
    }

    return ms ? { events: [...filteredEvents, ...extraEvents], matchState: ms } : { events: [...filteredEvents, ...extraEvents] };
}

/** 后处理：触发 onCardReturnedToHand 拦截器 */
export function processReturnToHandTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    _playerId: PlayerId,
    random: RandomFn,
    now: number,
): PostProcessResult {
    const retainedEvents: SmashUpEvent[] = [];
    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;

    const getProcessedReturnToHandEventKeys = (matchState: MatchState<SmashUpCore>): Set<string> => {
        const sysAny = matchState.sys as any;
        if (!(sysAny._processedReturnToHandEvents instanceof Set)) {
            sysAny._processedReturnToHandEvents = new Set<string>();
        }
        return sysAny._processedReturnToHandEvents as Set<string>;
    };

    const buildReturnToHandDedupKey = (
        event: SmashUpEvent,
        cardUidOverride?: string,
    ): string | undefined => {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const payload = (event as MinionReturnedEvent).payload;
            return [
                event.type,
                payload.minionUid,
                payload.minionDefId,
                payload.fromBaseIndex,
                payload.toPlayerId,
                payload.reason ?? '',
                event.timestamp,
            ].join(':');
        }
        if (event.type === SU_EVENTS.CARD_TRANSFERRED) {
            const payload = (event as CardTransferredEvent).payload;
            return [
                event.type,
                payload.cardUid,
                payload.defId ?? '',
                payload.fromPlayerId,
                payload.toPlayerId,
                payload.reason ?? '',
                event.timestamp,
            ].join(':');
        }
        if (event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD) {
            const payload = (event as CardRecoveredFromDiscardEvent).payload;
            return [
                event.type,
                cardUidOverride ?? '',
                payload.playerId,
                payload.reason ?? '',
                event.timestamp,
            ].join(':');
        }
        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const payload = (event as any).payload as { playerId: PlayerId; cardUid: string; baseIndex: number; reason?: string };
            return [
                event.type,
                payload.cardUid,
                payload.playerId,
                payload.baseIndex,
                payload.reason ?? '',
                event.timestamp,
            ].join(':');
        }
        return undefined;
    };

    const isCardTransferFromPlayOrDiscard = (core: SmashUpCore, event: CardTransferredEvent): boolean => {
        const { cardUid, fromPlayerId } = event.payload;
        const fromDiscard = core.players[fromPlayerId]?.discard.some(card => card.uid === cardUid) ?? false;
        if (fromDiscard) return true;
        return core.bases.some(base =>
            base.ongoingActions.some(action => action.uid === cardUid)
            || base.minions.some(minion =>
                minion.uid === cardUid
                || minion.attachedActions.some(action => action.uid === cardUid),
            ),
        );
    };

    const findRecoveredCardFromDiscard = (core: SmashUpCore, playerId: PlayerId, cardUid: string): CardInstance | undefined => {
        const discard = core.players[playerId]?.discard ?? [];
        return discard.find(candidate => candidate.uid === cardUid);
    };

    const findTransferredMinionFromPlayOrDiscard = (core: SmashUpCore, event: CardTransferredEvent): CardInstance | undefined => {
        const { cardUid, fromPlayerId } = event.payload;
        const discard = core.players[fromPlayerId]?.discard ?? [];
        const discardedCard = discard.find(card => card.uid === cardUid);
        if (discardedCard?.type === 'minion') return discardedCard;

        for (const base of core.bases) {
            const minion = base.minions.find(candidate => candidate.uid === cardUid);
            if (minion) {
                return {
                    uid: minion.uid,
                    defId: minion.defId,
                    type: 'minion',
                    owner: minion.owner,
                };
            }
        }
        const transferRef = getCardTransferObjectRef(event.payload);
        if (transferRef && (transferRef.type === 'minion' || getCardDef(transferRef.defId)?.type === 'minion')) {
            return buildCardInstanceFromObjectRef(transferRef);
        }
        return undefined;
    };

    const findTransferredMinionLkiFromPlay = (
        core: SmashUpCore,
        event: CardTransferredEvent,
    ): { minion: MinionOnBase; baseIndex: number } | undefined => {
        const { cardUid } = event.payload;
        for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
            const minion = core.bases[baseIndex].minions.find(candidate =>
                candidate.uid === cardUid
                || candidate.attachedActions.some(action => action.uid === cardUid),
            );
            if (minion) {
                return { minion, baseIndex };
            }
        }
        return undefined;
    };

    const findReturnedMinionLkiFromPlay = (
        core: SmashUpCore,
        event: MinionReturnedEvent,
    ): { minion: MinionOnBase; baseIndex: number } | undefined => {
        const { minionUid, fromBaseIndex } = event.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === minionUid);
        return minion ? { minion, baseIndex: fromBaseIndex } : undefined;
    };

    const findReturnedBuriedMinion = (core: SmashUpCore, baseIndex: number, cardUid: string): CardInstance | undefined => {
        const buriedCard = core.bases[baseIndex]?.buriedCards?.find(card => card.uid === cardUid);
        if (!buriedCard) return undefined;
        if (getCardDef(buriedCard.defId)?.type !== 'minion') return undefined;
        return {
            uid: buriedCard.uid,
            defId: buriedCard.defId,
            type: 'minion',
            owner: buriedCard.trueOwnerId,
        };
    };

    const buildReturnToHandFrameMeta = (
        event: SmashUpEvent,
        eventIndex: number,
    ): { frameId: string; sourceEventId: string } => {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const payload = (event as MinionReturnedEvent).payload;
            return {
                sourceEventId: `card-returned-to-hand:${event.type}:${payload.minionUid}:${payload.toPlayerId}:${eventIndex}:${now}`,
                frameId: `card-returned-to-hand-frame:${event.type}:${payload.minionUid}:${payload.toPlayerId}:${eventIndex}:${now}`,
            };
        }
        if (event.type === SU_EVENTS.CARD_TRANSFERRED) {
            const payload = (event as CardTransferredEvent).payload;
            return {
                sourceEventId: `card-returned-to-hand:${event.type}:${payload.cardUid}:${payload.toPlayerId}:${eventIndex}:${now}`,
                frameId: `card-returned-to-hand-frame:${event.type}:${payload.cardUid}:${payload.toPlayerId}:${eventIndex}:${now}`,
            };
        }
        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const payload = (event as any).payload;
            return {
                sourceEventId: `card-returned-to-hand:${event.type}:${payload.cardUid}:${payload.playerId}:${eventIndex}:${now}`,
                frameId: `card-returned-to-hand-frame:${event.type}:${payload.cardUid}:${payload.playerId}:${eventIndex}:${now}`,
            };
        }
        const payload = (event as CardRecoveredFromDiscardEvent).payload;
        const cardUidKey = (payload.cardUids ?? []).join(',');
        return {
            sourceEventId: `card-returned-to-hand:${event.type}:${cardUidKey}:${payload.playerId}:${eventIndex}:${now}`,
            frameId: `card-returned-to-hand-frame:${event.type}:${cardUidKey}:${payload.playerId}:${eventIndex}:${now}`,
        };
    };

    const buildRecoveredCardReturnFrameMeta = (
        payload: CardRecoveredFromDiscardEvent['payload'],
        cardUid: string,
        eventIndex: number,
    ): { frameId: string; sourceEventId: string } => ({
        sourceEventId: `card-returned-to-hand:${SU_EVENTS.CARD_RECOVERED_FROM_DISCARD}:${cardUid}:${payload.playerId}:${eventIndex}:${now}`,
        frameId: `card-returned-to-hand-frame:${SU_EVENTS.CARD_RECOVERED_FROM_DISCARD}:${cardUid}:${payload.playerId}:${eventIndex}:${now}`,
    });

    for (const [eventIndex, event] of events.entries()) {
        const stateBeforeReturn = ms ?? state;
        const coreBeforeReturn = stateBeforeReturn.core;
        const processedReturnToHandEventKeys = getProcessedReturnToHandEventKeys(stateBeforeReturn);
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const payload = (event as MinionReturnedEvent).payload;
            const returnedMinionLki = findReturnedMinionLkiFromPlay(coreBeforeReturn, event as MinionReturnedEvent);
            const { frameId, sourceEventId } = buildReturnToHandFrameMeta(event, eventIndex);
            if (!payload.skipReturnReplacement && returnedMinionLki) {
                const replacement = fireTriggers(coreBeforeReturn, 'onCardReturnedToHand', {
                    state: coreBeforeReturn,
                    matchState: stateBeforeReturn,
                    playerId: payload.toPlayerId,
                    baseIndex: returnedMinionLki.baseIndex,
                    frameId,
                    sourceEventId,
                    affectEvent: event,
                    triggerMinion: returnedMinionLki.minion,
                    triggerMinionUid: payload.minionUid,
                    triggerMinionDefId: payload.minionDefId,
                    reason: payload.reason,
                    random,
                    now,
                }, { phase: 'replacement' });
                if (replacement.events.length > 0 || (replacement.matchState && replacement.matchState !== stateBeforeReturn)) {
                    extraEvents.push(...replacement.events);
                    if (replacement.matchState) ms = replacement.matchState;
                    continue;
                }
            }
            const advancedCore = reduceMinionReturnedEvent(coreBeforeReturn, event as MinionReturnedEvent);
            const advancedMatchState = { ...stateBeforeReturn, core: advancedCore };
            const dedupKey = buildReturnToHandDedupKey(event);
            if (dedupKey && processedReturnToHandEventKeys.has(dedupKey)) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            if (dedupKey) {
                processedReturnToHandEventKeys.add(dedupKey);
            }
            const queued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                state: advancedCore,
                matchState: advancedMatchState,
                playerId: payload.toPlayerId,
                frameId,
                sourceEventId,
                triggerMinion: returnedMinionLki?.minion,
                triggerMinionUid: payload.minionUid,
                triggerMinionDefId: payload.minionDefId,
                reason: payload.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
            if (returnedMinionLki) {
                const queuedBase = collectExtendedBaseAbilityTriggers({
                    core: advancedCore,
                    timing: 'onCardReturnedToHand',
                    ownerPlayerId: payload.toPlayerId,
                    baseIndex: returnedMinionLki.baseIndex,
                    triggerMinionUid: returnedMinionLki.minion.uid,
                    triggerMinionDefId: returnedMinionLki.minion.defId,
                    triggerMinionPower: returnedMinionLki.minion.basePower,
                    controllerId: returnedMinionLki.minion.controller,
                    reason: payload.reason,
                    frameId,
                    sourceEventId,
                    now,
                });
                if (queuedBase) extraEvents.push(queuedBase);
            }
            if (returnedMinionLki) {
                for (const attachedAction of returnedMinionLki.minion.attachedActions) {
                    const attachedControllerId = (attachedAction.metadata as { sourceControllerId?: string; sourcePlayerId?: string } | undefined)?.sourceControllerId
                        ?? (attachedAction.metadata as { sourceControllerId?: string; sourcePlayerId?: string } | undefined)?.sourcePlayerId
                        ?? attachedAction.ownerId;
                    const attachedQueued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                        state: advancedCore,
                        matchState: advancedMatchState,
                        playerId: payload.toPlayerId,
                        frameId,
                        sourceEventId,
                        sourceCardUid: attachedAction.uid,
                        sourceDefId: attachedAction.defId,
                        sourceBaseIndex: returnedMinionLki.baseIndex,
                        sourceControllerId: attachedControllerId,
                        sourceOwnerPlayerId: attachedAction.ownerId,
                        triggerMinion: returnedMinionLki.minion,
                        triggerMinionUid: returnedMinionLki.minion.uid,
                        triggerMinionDefId: returnedMinionLki.minion.defId,
                        reason: payload.reason,
                        random,
                        now,
                    }, { sourceDefIds: [attachedAction.defId] });
                    if (attachedQueued) extraEvents.push(attachedQueued);
                }
            }
            retainedEvents.push(event);
            ms = advancedMatchState;
            continue;
        }

        if (event.type === SU_EVENTS.CARD_TRANSFERRED) {
            const payload = (event as CardTransferredEvent).payload;
            const transferredMinionLki = findTransferredMinionLkiFromPlay(coreBeforeReturn, event as CardTransferredEvent);
            const advancedCore = reduceCardTransferredEvent(coreBeforeReturn, event as CardTransferredEvent);
            const advancedMatchState = { ...stateBeforeReturn, core: advancedCore };
            const transferFrameId = `card-transferred-frame:${payload.cardUid}:${payload.fromPlayerId}:${payload.toPlayerId}:${eventIndex}:${now}`;
            const transferSourceEventId = `card-transferred:${payload.cardUid}:${payload.fromPlayerId}:${payload.toPlayerId}:${eventIndex}:${now}`;
            const transferDedupKey = `${SU_EVENTS.CARD_TRANSFERRED}:trigger:${payload.cardUid}:${payload.fromPlayerId}:${payload.toPlayerId}:${payload.reason ?? ''}:${event.timestamp}`;
            if (!processedReturnToHandEventKeys.has(transferDedupKey)) {
                processedReturnToHandEventKeys.add(transferDedupKey);
                const transferredOwnerId = payload.ownerId
                    ?? getCardTransferObjectRef(payload)?.provenance.ownerId
                    ?? payload.fromPlayerId;
                const queuedTransfer = collectTriggers(advancedCore, 'onCardTransferred', {
                    state: advancedCore,
                    matchState: advancedMatchState,
                    playerId: payload.toPlayerId,
                    frameId: transferFrameId,
                    sourceEventId: transferSourceEventId,
                    transferredCardUid: payload.cardUid,
                    transferredCardDefId: payload.defId,
                    transferredCardOwnerId: transferredOwnerId,
                    transferredFromPlayerId: payload.fromPlayerId,
                    transferredToPlayerId: payload.toPlayerId,
                    triggerCardUid: payload.cardUid,
                    triggerCardDefId: payload.defId,
                    triggerCardOwnerId: transferredOwnerId,
                    reason: payload.reason,
                    random,
                    now,
                });
                if (queuedTransfer) extraEvents.push(queuedTransfer);
            }
            if (!isCardTransferFromPlayOrDiscard(coreBeforeReturn, event as CardTransferredEvent)) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            const dedupKey = buildReturnToHandDedupKey(event);
            if (dedupKey && processedReturnToHandEventKeys.has(dedupKey)) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            if (dedupKey) {
                processedReturnToHandEventKeys.add(dedupKey);
            }
            const transferredMinion = findTransferredMinionFromPlayOrDiscard(coreBeforeReturn, event as CardTransferredEvent);
            const { frameId, sourceEventId } = buildReturnToHandFrameMeta(event, eventIndex);
            const queued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                state: advancedCore,
                matchState: advancedMatchState,
                playerId: payload.toPlayerId,
                frameId,
                sourceEventId,
                triggerMinion: transferredMinionLki?.minion,
                triggerMinionUid: transferredMinion?.uid,
                triggerMinionDefId: transferredMinion?.defId,
                reason: payload.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
            if (transferredMinionLki) {
                const queuedBase = collectExtendedBaseAbilityTriggers({
                    core: advancedCore,
                    timing: 'onCardReturnedToHand',
                    ownerPlayerId: payload.toPlayerId,
                    baseIndex: transferredMinionLki.baseIndex,
                    triggerMinionUid: transferredMinionLki.minion.uid,
                    triggerMinionDefId: transferredMinionLki.minion.defId,
                    triggerMinionPower: transferredMinionLki.minion.basePower,
                    controllerId: transferredMinionLki.minion.controller,
                    reason: payload.reason,
                    frameId,
                    sourceEventId,
                    now,
                });
                if (queuedBase) extraEvents.push(queuedBase);
            }
            if (transferredMinionLki && transferredMinionLki.minion.uid === payload.cardUid) {
                for (const attachedAction of transferredMinionLki.minion.attachedActions) {
                    const attachedControllerId = (attachedAction.metadata as { sourceControllerId?: string; sourcePlayerId?: string } | undefined)?.sourceControllerId
                        ?? (attachedAction.metadata as { sourceControllerId?: string; sourcePlayerId?: string } | undefined)?.sourcePlayerId
                        ?? attachedAction.ownerId;
                    const attachedQueued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                        state: advancedCore,
                        matchState: advancedMatchState,
                        playerId: payload.toPlayerId,
                        frameId,
                        sourceEventId,
                        sourceCardUid: attachedAction.uid,
                        sourceDefId: attachedAction.defId,
                        sourceBaseIndex: transferredMinionLki.baseIndex,
                        sourceControllerId: attachedControllerId,
                        sourceOwnerPlayerId: attachedAction.ownerId,
                        triggerMinion: transferredMinionLki.minion,
                        triggerMinionUid: transferredMinionLki.minion.uid,
                        triggerMinionDefId: transferredMinionLki.minion.defId,
                        reason: payload.reason,
                        random,
                        now,
                    }, { sourceDefIds: [attachedAction.defId] });
                    if (attachedQueued) extraEvents.push(attachedQueued);
                }
            }
            retainedEvents.push(event);
            ms = advancedMatchState;
            continue;
        }

        if (event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD) {
            const payload = (event as CardRecoveredFromDiscardEvent).payload;
            const advancedCore = reduceCardRecoveredFromDiscardEvent(coreBeforeReturn, event as CardRecoveredFromDiscardEvent);
            const advancedMatchState = { ...stateBeforeReturn, core: advancedCore };
            if ((payload.cardUids?.length ?? 0) === 0) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            for (const cardUid of payload.cardUids ?? []) {
                const dedupKey = buildReturnToHandDedupKey(event, cardUid);
                if (dedupKey && processedReturnToHandEventKeys.has(dedupKey)) {
                    continue;
                }
                if (dedupKey) {
                    processedReturnToHandEventKeys.add(dedupKey);
                }
                const recoveredCard = findRecoveredCardFromDiscard(coreBeforeReturn, payload.playerId, cardUid);
                const recoveredMinion = recoveredCard?.type === 'minion' ? recoveredCard : undefined;
                const { frameId, sourceEventId } = buildRecoveredCardReturnFrameMeta(payload, cardUid, eventIndex);
                const queued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                    state: advancedCore,
                    matchState: advancedMatchState,
                    playerId: payload.playerId,
                    frameId,
                    sourceEventId,
                    triggerMinionUid: recoveredMinion?.uid,
                    triggerMinionDefId: recoveredMinion?.defId,
                    reason: payload.reason,
                    random,
                    now,
                });
                if (queued) extraEvents.push(queued);
            }
            retainedEvents.push(event);
            ms = advancedMatchState;
            continue;
        }

        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const payload = (event as any).payload as { playerId: PlayerId; cardUid: string; baseIndex: number; reason?: string };
            const advancedCore = reduceBuriedCardReturnedToHandEvent(coreBeforeReturn, event as BuriedCardReturnedToHandEvent);
            const advancedMatchState = { ...stateBeforeReturn, core: advancedCore };
            const dedupKey = buildReturnToHandDedupKey(event);
            if (dedupKey && processedReturnToHandEventKeys.has(dedupKey)) {
                retainedEvents.push(event);
                ms = advancedMatchState;
                continue;
            }
            if (dedupKey) {
                processedReturnToHandEventKeys.add(dedupKey);
            }
            const returnedMinion = findReturnedBuriedMinion(coreBeforeReturn, payload.baseIndex, payload.cardUid);
            const { frameId, sourceEventId } = buildReturnToHandFrameMeta(event, eventIndex);
            const queued = collectTriggers(advancedCore, 'onCardReturnedToHand', {
                state: advancedCore,
                matchState: advancedMatchState,
                playerId: payload.playerId,
                frameId,
                sourceEventId,
                triggerMinionUid: returnedMinion?.uid,
                triggerMinionDefId: returnedMinion?.defId,
                reason: payload.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
            if (returnedMinion) {
                const queuedBase = collectExtendedBaseAbilityTriggers({
                    core: advancedCore,
                    timing: 'onCardReturnedToHand',
                    ownerPlayerId: payload.playerId,
                    baseIndex: payload.baseIndex,
                    triggerMinionUid: returnedMinion.uid,
                    triggerMinionDefId: returnedMinion.defId,
                    reason: payload.reason,
                    frameId,
                    sourceEventId,
                    now,
                });
                if (queuedBase) extraEvents.push(queuedBase);
            }
            retainedEvents.push(event);
            ms = advancedMatchState;
            continue;
        }

        // 同批次里前置的非回手事件也可能改写 source controller / base 现场。
        // 若这里不顺序推进现场，后续 return carrier 仍会按旧 core 收集 queued trigger。
        retainedEvents.push(event);
        ms = { ...stateBeforeReturn, core: applyPostProcessPrefixEvent(coreBeforeReturn, event) };
    }

    if (extraEvents.length > 0) {
        return { events: [...retainedEvents, ...extraEvents], matchState: ms };
    }
    return ms ? { events: retainedEvents, matchState: ms } : { events: retainedEvents };
}

// ============================================================================
// destroy→move 循环：move 触发器可能产生新的 MINION_DESTROYED（如制高点/幼熊斥候），
// 需要回馈给 processDestroyTriggers 处理（如海盗被消灭时移动到其他基地）。
// 循环直到 move 不再产生新的 MINION_DESTROYED 事件为止。
// ============================================================================

/**
 * 循环执行 destroy→move 直到稳定（move 不再产生新的 MINION_DESTROYED）
 *
 * 典型场景：黑熊骑兵移动海盗到制高点基地 → 制高点消灭海盗 → 海盗 onDestroyed 触发移动
 */
export function processDestroyMoveCycle(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    options?: { skipDestroyEventKeys?: Set<string>; skipReactionQueueResolution?: boolean }
): PostProcessResult {
    let currentEvents = events;
    let ms: MatchState<SmashUpCore> | undefined;

    const destroySysAny = (state.sys as any);
    if (!destroySysAny._processedDestroyEvents || !(destroySysAny._processedDestroyEvents instanceof Set)) {
        destroySysAny._processedDestroyEvents = new Set<string>();
    }
    const processedDestroyEventKeys = (options?.skipDestroyEventKeys ?? destroySysAny._processedDestroyEvents) as Set<string>;
    const mergedOptions = { ...(options ?? {}), skipDestroyEventKeys: processedDestroyEventKeys };
    
    // 跟踪已处理的 MINION_DESTROYED 事件（防止重复处理）
    const processedDestroyUids = new Set<string>();

    // 第一轮：正常的 destroy → move
    // 记录第一轮处理的所有 MINION_DESTROYED 事件
    for (const e of currentEvents) {
        if (e.type === SU_EVENTS.MINION_DESTROYED) {
            const uid = (e as MinionDestroyedEvent).payload.minionUid;
            processedDestroyUids.add(uid);
        }
    }
    
    const afterDestroy = processDestroyTriggers(currentEvents, ms ?? state, playerId, random, now, mergedOptions);
    if (afterDestroy.matchState) ms = afterDestroy.matchState;
    const afterMove = processMoveTriggers(afterDestroy.events, ms ?? state, playerId, random, now);
    if (afterMove.matchState) ms = afterMove.matchState;
    currentEvents = afterMove.events;

    // 检查 move 是否产生了新的 MINION_DESTROYED 事件（不在已处理集合中的）
    let newDestroyEvents = currentEvents.filter(
        e => e.type === SU_EVENTS.MINION_DESTROYED && !processedDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid)
    ) as SmashUpEvent[];

    // 循环处理新产生的 MINION_DESTROYED（最多 5 轮防止无限循环）
    let iteration = 0;
    while (newDestroyEvents.length > 0 && iteration < 5) {
        iteration++;
        
        // 将新事件加入已处理集合
        for (const e of newDestroyEvents) {
            const uid = (e as MinionDestroyedEvent).payload.minionUid;
            processedDestroyUids.add(uid);
        }
        
        // 只对新的 MINION_DESTROYED 事件运行 destroy 触发器
        const extraDestroy = processDestroyTriggers(newDestroyEvents, ms ?? state, playerId, random, now, mergedOptions);
        if (extraDestroy.matchState) ms = extraDestroy.matchState;

        // 替换原事件中的新 MINION_DESTROYED 为处理后的结果
        // （processDestroyTriggers 可能过滤掉被拯救的随从、添加 MINION_RETURNED/MINION_MOVED 等）
        const newDestroyUids = new Set(newDestroyEvents.map(e => (e as MinionDestroyedEvent).payload.minionUid));
        const eventsWithoutNewDestroy = currentEvents.filter(
            e => !(e.type === SU_EVENTS.MINION_DESTROYED && newDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid))
        );
        currentEvents = [...eventsWithoutNewDestroy, ...extraDestroy.events];

        // 对 extraDestroy 产生的 MINION_MOVED 事件运行 move 触发器
        const extraMoveEvents = extraDestroy.events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        if (extraMoveEvents.length > 0) {
            const extraMove = processMoveTriggers(extraDestroy.events, ms ?? state, playerId, random, now);
            if (extraMove.matchState) ms = extraMove.matchState;
            // 替换 extraDestroy.events 部分为 extraMove 结果
            const eventsWithoutExtra = currentEvents.filter(
                e => !extraDestroy.events.includes(e)
            );
            currentEvents = [...eventsWithoutExtra, ...extraMove.events];

            // 检查是否又产生了新的 MINION_DESTROYED（不在已处理集合中的）
            newDestroyEvents = extraMove.events.filter(
                e => e.type === SU_EVENTS.MINION_DESTROYED && !processedDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid)
            );
        } else {
            break;
        }
    }
    
    return { events: currentEvents, matchState: ms };
}

// ============================================================================
// onAffected 后处理：扫描"影响"类事件，触发 onMinionAffected
// 影响 = 消灭 | 移动 | 负力量修改 | 附着对手行动卡
// ============================================================================

/** 后处理：触发 onMinionAffected（聚合时机） */
export function processAffectTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
    options?: { skipAffectEventKeys?: Set<string> },
): PostProcessResult {
    const retainedEvents: SmashUpEvent[] = [];
    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;

    const skipEnsignRedirect = (event: SmashUpEvent): boolean => (
        ((event as { payload?: { skipEnsignRedirect?: boolean } }).payload?.skipEnsignRedirect ?? false) === true
    );

    eventLoop:
    for (const [eventIndex, event] of events.entries()) {
        const stateBeforeAffect = ms ?? state;
        const coreBeforeAffect = stateBeforeAffect.core;
        const affectRecords = buildAffectRecords(coreBeforeAffect, event, playerId);
        const affectBatchTargets = affectRecords
            .filter(record => record.countsForOnMinionAffected && record.triggerMinion && record.baseIndex !== undefined)
            .map(record => ({
                minionUid: record.triggerMinionUid ?? record.triggerMinion!.uid,
                baseIndex: record.baseIndex!,
                controllerId: record.triggerMinion!.controller,
            }));
        for (const [recordIndex, record] of affectRecords.entries()) {
            if (
                record.affectType === 'destroy'
                && (record.targetKind === 'ongoing' || record.targetKind === 'attached_action')
                && record.triggerCardUid
                && record.triggerCardDefId
                && record.triggerCardOwnerId
            ) {
                const sourceEventId = `card-destroyed:${event.type}:${record.triggerCardUid}:${record.affectType}:${record.baseIndex ?? 'none'}:${eventIndex}:${recordIndex}:${now}`;
                const frameId = `card-destroyed-frame:${event.type}:${record.triggerCardUid}:${record.affectType}:${record.baseIndex ?? 'none'}:${eventIndex}:${recordIndex}:${now}`;
                const queuedCardDestroyed = collectTriggers(coreBeforeAffect, 'onCardDestroyed', {
                    state: coreBeforeAffect,
                    matchState: stateBeforeAffect,
                    playerId: record.sourcePlayerId ?? playerId,
                    baseIndex: record.baseIndex,
                    frameId,
                    sourceEventId,
                    sourceCardUid: record.sourceCardUid,
                    sourceDefId: record.sourceDefId,
                    sourceBaseIndex: record.sourceBaseIndex,
                    sourceControllerId: record.sourceControllerId,
                    sourceOwnerPlayerId: record.sourceOwnerPlayerId,
                    triggerCardUid: record.triggerCardUid,
                    triggerCardDefId: record.triggerCardDefId,
                    triggerCardOwnerId: record.triggerCardOwnerId,
                    triggerCardKind: record.triggerCardKind,
                    destroyerId: record.sourcePlayerId ?? playerId,
                    affectType: record.affectType,
                    affectEvent: event,
                    reason: record.reason,
                    random,
                    now,
                });
                if (queuedCardDestroyed) extraEvents.push(queuedCardDestroyed);
            }

            if (!record.countsForOnMinionAffected || !record.triggerMinion || record.baseIndex === undefined) continue;
            if (options?.skipAffectEventKeys?.has(buildAffectRecordEventKey(event, record, recordIndex))) continue;
            const sourceEventId = `minion-affected:${event.type}:${record.triggerMinionUid}:${record.affectType}:${record.baseIndex}:${eventIndex}:${recordIndex}:${now}`;
            const frameId = `minion-affected-frame:${event.type}:${record.triggerMinionUid}:${record.affectType}:${record.baseIndex}:${eventIndex}:${recordIndex}:${now}`;

            if (!skipEnsignRedirect(event)) {
                const replacement = fireTriggers(coreBeforeAffect, 'onMinionAffected', {
                    state: coreBeforeAffect,
                    matchState: stateBeforeAffect,
                    playerId: record.sourcePlayerId ?? playerId,
                    baseIndex: record.baseIndex,
                    frameId,
                    sourceEventId,
                    sourceCardUid: record.sourceCardUid,
                    sourceDefId: record.sourceDefId,
                    sourceBaseIndex: record.sourceBaseIndex,
                    sourceControllerId: record.sourceControllerId,
                    sourceOwnerPlayerId: record.sourceOwnerPlayerId,
                    triggerMinionUid: record.triggerMinionUid,
                    triggerMinionDefId: record.triggerMinionDefId,
                    triggerMinion: record.triggerMinion,
                    controllerId: record.triggerMinion.controller,
                    affectType: record.affectType,
                    counterChangeKind: record.counterChangeKind,
                    counterDelta: record.counterDelta,
                    affectEvent: event,
                    affectBatchTargets,
                    reason: record.reason,
                    random,
                    now,
                }, { phase: 'replacement' });
                if (replacement.events.length > 0 || (replacement.matchState && replacement.matchState !== stateBeforeAffect)) {
                    extraEvents.push(...replacement.events);
                    if (replacement.matchState) ms = replacement.matchState;
                    continue eventLoop;
                }
            }

            const queued = collectTriggers(coreBeforeAffect, 'onMinionAffected', {
                state: coreBeforeAffect,
                matchState: stateBeforeAffect,
                playerId: record.sourcePlayerId ?? playerId,
                baseIndex: record.baseIndex,
                frameId,
                sourceEventId,
                sourceCardUid: record.sourceCardUid,
                sourceDefId: record.sourceDefId,
                sourceBaseIndex: record.sourceBaseIndex,
                sourceControllerId: record.sourceControllerId,
                sourceOwnerPlayerId: record.sourceOwnerPlayerId,
                triggerMinionUid: record.triggerMinionUid,
                triggerMinionDefId: record.triggerMinionDefId,
                triggerMinion: record.triggerMinion,
                controllerId: record.triggerMinion.controller,
                affectType: record.affectType,
                counterChangeKind: record.counterChangeKind,
                counterDelta: record.counterDelta,
                affectEvent: event,
                affectBatchTargets,
                reason: record.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);

            const queuedBase = collectExtendedBaseAbilityTriggers({
                core: coreBeforeAffect,
                timing: 'onMinionAffected',
                ownerPlayerId: record.sourcePlayerId ?? playerId,
                baseIndex: record.baseIndex,
                triggerMinionUid: record.triggerMinionUid,
                triggerMinionDefId: record.triggerMinionDefId,
                triggerMinionPower: record.triggerMinion.basePower,
                controllerId: record.triggerMinion.controller,
                reason: record.reason,
                actionTargetBaseIndex: record.baseIndex,
                actionTargetType: 'minion',
                actionTargetMinionUid: record.triggerMinionUid,
                frameId,
                sourceEventId,
                now,
            });
            if (queuedBase) extraEvents.push(queuedBase);
        }

        const advancedCore = applyPostProcessPrefixEvent(coreBeforeAffect, event);
        if (advancedCore !== coreBeforeAffect) {
            ms = {
                ...stateBeforeAffect,
                core: advancedCore,
            };
        }
        retainedEvents.push(event);
    }

    if (extraEvents.length === 0) return ms ? { events: retainedEvents, matchState: ms } : { events: retainedEvents };
    return { events: [...retainedEvents, ...extraEvents], matchState: ms };
}

// ============================================================================
// onDeckInspected 后处理：扫描牌库查看事件，触发 onDeckInspected
// ============================================================================

export function processDeckInspectionTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
): PostProcessResult {
    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;

    for (const [eventIndex, evt] of events.entries()) {
        const stateBeforeInspection = ms ?? state;
        const coreBeforeInspection = stateBeforeInspection.core;
        if (evt.type !== SU_EVENTS.REVEAL_HAND && evt.type !== SU_EVENTS.REVEAL_DECK_TOP && evt.type !== SU_EVENTS.DECK_INSPECTED) {
            ms = { ...stateBeforeInspection, core: applyPostProcessPrefixEvent(coreBeforeInspection, evt) };
            continue;
        }

        const isReveal = evt.type === SU_EVENTS.REVEAL_HAND || evt.type === SU_EVENTS.REVEAL_DECK_TOP;
        const payload = (evt as RevealHandEvent | RevealDeckTopEvent | DeckInspectedEvent).payload as any;
        const targetPlayerIds = Array.isArray(payload.targetPlayerId)
            ? payload.targetPlayerId
            : [payload.targetPlayerId];
        const inspectionZone = isReveal
            ? (evt.type === SU_EVENTS.REVEAL_HAND ? 'hand' : 'deck')
            : 'deck';
        const inspectionCausePlayerId = (isReveal ? payload.sourcePlayerId : payload.inspectorPlayerId) ?? playerId;
        const sourceEventId = `deck-inspected:${evt.type}:${inspectionZone}:${targetPlayerIds.join(',')}:${eventIndex}:${now}`;
        const frameId = `deck-inspected-frame:${evt.type}:${inspectionZone}:${targetPlayerIds.join(',')}:${eventIndex}:${now}`;
        const advancedCore = reduceDeckInspectionFactEvent(
            coreBeforeInspection,
            evt as RevealHandEvent | RevealDeckTopEvent | DeckInspectedEvent,
        );
        const advancedMatchState = { ...stateBeforeInspection, core: advancedCore };

        const queued = collectTriggers(advancedCore, 'onDeckInspected', {
            state: advancedCore,
            matchState: advancedMatchState,
            playerId: inspectionCausePlayerId,
            frameId,
            sourceEventId,
            inspectionCards: isReveal ? payload.cards : [],
            inspectionZone,
            inspectionTargetPlayerIds: targetPlayerIds,
            inspectionCausePlayerId,
            random,
            now,
        });

        if (queued) extraEvents.push(queued);
        for (const [baseIndex] of advancedCore.bases.entries()) {
            const queuedBase = collectExtendedBaseAbilityTriggers({
                core: advancedCore,
                timing: 'onDeckInspected',
                ownerPlayerId: inspectionCausePlayerId,
                baseIndex,
                reason: payload.reason,
                frameId,
                sourceEventId,
                now,
            });
            if (queuedBase) extraEvents.push(queuedBase);
        }
        ms = advancedMatchState;
    }

    if (extraEvents.length === 0) return ms ? { events, matchState: ms } : { events };
    return { events: [...events, ...extraEvents], matchState: ms };
}

export { reduce } from './reduce';
