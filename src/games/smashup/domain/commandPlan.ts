import type { BaseAbilityUsedEvent } from './types';
import {
    type SmashUpCore,
    type AllFactionsSelectedEvent,
    type PlayerState,
    STARTING_HAND_SIZE,
    SU_EVENTS,
    type SmashUpEvent,
    type FactionSelectedEvent,
    type SmashUpCommand,
    SU_COMMANDS,
    type MinionPlayedEvent,
    type CardToDeckBottomEvent,
    type ActionCardDef,
    type FusionCardDef,
    type CardsDiscardedEvent,
    type ReactionPassRequestedEvent,
    type FactionDeselectedEvent,
    type FactionBannedEvent,
    type FactionReadyConfirmedEvent,
    type SeatSwappedEvent,
    type TalentUsedEvent,
    type MunchkinMonsterDefeatedEvent,
} from './types';
import type { PlayerId, RandomFn, MatchState } from '../../../engine/types';
import {
    getSmashUpSelectableFactionIds,
    buildSmashUpSetupBasesForSelectedFactions,
    getSmashUpFactionsPerPlayer,
    getSmashUpDraftTurnOrder,
    getSmashUpSelectableFactionCandidatesForPlayer,
} from './pregameDraft';
import { buildFactionSelectionIdentitySet, normalizeFactionSelectionId } from './ids';
import {
    buildDeck,
    drawCards,
    isCardMinionLike,
    getMinionLikeResponseWindowLimitGroup,
    findSpecificExtraActionPlay,
} from './utils';
import { maybeQueueStartingHandMulliganPrompt } from './mulliganHandlers';
import type { CommandPlan } from '../../../engine/eventBatchPlan';
import { getMinionDef, getMinionLikePower, getFusionDef, getCardDef } from '../data/cards';
import { getSmashUpReactionWindowContext } from './reactionWindowState';
import { canPlayFromDiscard } from './discardPlayability';
import { canPlayActionFromDiscard } from './discardActionPlayability';
import { buildActionPlayedEvent } from './actionPlayEvent';
import {
    createPendingActionResolution,
    maybeQueueActionCounterWindow,
    resolvePendingActionExecution,
} from './actionCounter';
import { getActiveBaseAbilitySources, triggerActiveBaseAbilities } from './baseAbilities';
import { resolveTalent, type AbilityContext, resolveSpecial, resolveOngoingActivation } from './abilityRegistry';

// ============================================================================
// execute：命令 → 事件
// ============================================================================

export function findTitanByUid(core: SmashUpCore, titanUid: string) {
    return (core.titans ?? []).find((titan) => titan.uid === titanUid);
}

export function completeSmashUpFactionSelectionsForSetup(
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
        const configuredCandidatePool =
            mode === 'individualPools'
                ? (selection?.playerCandidatePools?.[playerId] ?? [])
                : (selection?.sharedCandidatePool ?? []);
        const candidatePool = configuredCandidatePool.length > 0 ? configuredCandidatePool : selectableFactionIds;
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

export function buildAllFactionsSelectedSetupEvent(
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
            const { deck, nextUid: afterDeckUid } = buildDeck([factions[0], factions[1]], pid, nextUid, random);
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

export function buildFactionSelectedEventsForCommand(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    factionId: string,
    sourceCommandType: string,
    random: RandomFn,
    now: number,
): { events: SmashUpEvent[]; updatedState?: MatchState<SmashUpCore> } {
    const core = state.core;
    const events: SmashUpEvent[] = [];
    const selectedEvt: FactionSelectedEvent = {
        type: SU_EVENTS.FACTION_SELECTED,
        payload: { playerId, factionId },
        sourceCommandType,
        timestamp: now,
    };
    events.push(selectedEvt);

    // 检查选秀是否完成
    const selection = core.factionSelection!;
    const factionsPerPlayer = getSmashUpFactionsPerPlayer(selection);
    const draftTurnOrder = getSmashUpDraftTurnOrder(core);
    const tempSelections = { ...selection.playerSelections };
    tempSelections[playerId] = [...(tempSelections[playerId] || []), factionId];
    const allPlayersSelected = draftTurnOrder.every(
        (draftPlayerId) => (tempSelections[draftPlayerId] ?? []).length >= factionsPerPlayer,
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

export function planSmashUpCommand(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn,
): CommandPlan<SmashUpEvent> {
    if ((command as { type: string }).type.startsWith('SYS_')) return { events: [] };
    const result = executeCommand(state, command, random, command.timestamp ?? 0);
    return { events: result.events, sys: result.updatedState?.sys };
}

/** Pure base-event compatibility entry. Formal execution consumes the full plan. */
export function execute(state: MatchState<SmashUpCore>, command: SmashUpCommand, random: RandomFn): SmashUpEvent[] {
    return planSmashUpCommand(state, command, random).events;
}

/** 内部命令执行（不含后处理） */
export function executeCommand(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn,
    now: number,
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
                ? player.storedCards?.find((c) => c.uid === command.payload.cardUid)
                : fromDiscard
                  ? player.discard.find((c) => c.uid === command.payload.cardUid)!
                  : fromDeck
                    ? player.deck.find((c) => c.uid === command.payload.cardUid)!
                    : player.hand.find((c) => c.uid === command.payload.cardUid)!;
            const replacementCard =
                !fromDiscard && !fromDeck && !fromStored && command.payload.replacementHandCardUid
                    ? player.hand.find(
                          (c) =>
                              c.uid === command.payload.replacementHandCardUid &&
                              c.defId === 'penguins_dancing_penguin',
                      )
                    : undefined;
            const card = replacementCard ?? originalCard;
            if (!card) return { events: [] };
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
                    ...(fromDiscard
                        ? (() => {
                              const info = canPlayFromDiscard(core, command.playerId, card.uid, baseIndex);
                              return info
                                  ? {
                                        discardPlaySourceId: info.sourceId,
                                        consumesNormalLimit: info.consumesNormalLimit,
                                    }
                                  : {
                                        ...(command.payload.discardPlaySourceId
                                            ? { discardPlaySourceId: command.payload.discardPlaySourceId }
                                            : {}),
                                        ...(command.payload.consumesNormalLimit === false
                                            ? { consumesNormalLimit: false }
                                            : {}),
                                    };
                          })()
                        : {}),
                    ...(fromDeck || fromStored ? { consumesNormalLimit: false } : {}),
                    // meFirst 响应窗口中打出 beforeScoringPlayable 随从不消耗正常额度
                    ...(reactionWindow?.windowType === 'meFirst' &&
                    (() => {
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
            const shouldBypassReactionChoose =
                state.sys.interaction?.current?.kind === 'simple-choice' &&
                (state.sys.interaction.current.data as { sourceId?: string } | undefined)?.sourceId ===
                    'smashup_reaction_choose';
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
            const card = (
                fromStored
                    ? player.storedCards?.find((c) => c.uid === command.payload.cardUid)
                    : fromDiscard
                      ? player.discard.find((c) => c.uid === command.payload.cardUid)
                      : player.hand.find((c) => c.uid === command.payload.cardUid)
            )!;
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
            const specificExtraActionPlay = findSpecificExtraActionPlay(workingState.core.players[command.playerId], {
                cardUid: card.uid,
                defId: card.defId,
                targetBaseIndex: command.payload.targetBaseIndex,
                targetMinionUid: command.payload.targetMinionUid,
            });

            const event = buildActionPlayedEvent({
                playerId: command.playerId,
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                targetBaseIndex: command.payload.targetBaseIndex,
                targetMinionUid: command.payload.targetMinionUid,
                isExtraAction:
                    fromStored ||
                    specificExtraActionPlay !== undefined ||
                    discardActionPlay?.consumesNormalLimit === false ||
                    command.payload.consumesNormalLimit === false ||
                    undefined,
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
                destroyAttachedActionAtTurnEnd: specificExtraActionPlay?.entry.destroyAttachedActionAtTurnEnd === true,
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
            const payload =
                command.payload && typeof command.payload === 'object'
                    ? (command.payload as { reason?: ReactionPassRequestedEvent['payload']['reason'] })
                    : {};
            const event: ReactionPassRequestedEvent = {
                type: SU_EVENTS.REACTION_PASS_REQUESTED,
                payload: {
                    playerId: command.playerId,
                    reason: payload.reason ?? 'player_pass',
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [event] };
        }

        case SU_COMMANDS.SELECT_FACTION: {
            const { factionId } = command.payload;
            return buildFactionSelectedEventsForCommand(state, command.playerId, factionId, command.type, random, now);
        }

        case SU_COMMANDS.SELECT_RANDOM_FACTION: {
            const candidates = getSmashUpSelectableFactionCandidatesForPlayer(core, command.playerId);
            if (candidates.length === 0) {
                throw new Error('随机派系选择失败：没有可随机选择的派系');
            }
            const selectedIndex = random.range(0, candidates.length - 1);
            const factionId = candidates[selectedIndex];
            if (!factionId) {
                throw new Error(`随机派系选择失败：随机索引 ${selectedIndex} 越界，可选数量 ${candidates.length}`);
            }
            return buildFactionSelectedEventsForCommand(state, command.playerId, factionId, command.type, random, now);
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

            const activeSources = getActiveBaseAbilitySources(core, baseIndex);
            for (const sourceDefId of activeSources) {
                const usedEvt: BaseAbilityUsedEvent = {
                    type: SU_EVENTS.BASE_ABILITY_USED,
                    payload: {
                        playerId: command.playerId,
                        baseIndex,
                        baseDefId: sourceDefId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(usedEvt);
            }

            const result = triggerActiveBaseAbilities({
                state: core,
                matchState: state,
                baseIndex,
                baseDefId: activeSources[0] ?? base.defId,
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
            const { minionUid, ongoingCardUid, titanUid, baseIndex, targetBaseIndex, targetMinionUid } =
                command.payload;
            const base = core.bases[baseIndex];
            const events: SmashUpEvent[] = [];

            if (titanUid) {
                const titan = core.titans?.find((candidate) => candidate.uid === titanUid);
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
                let ongoing = base?.ongoingActions.find((o) => o.uid === ongoingCardUid);
                if (!ongoing) {
                    for (const m of base?.minions ?? []) {
                        const aa = m.attachedActions.find((a) => a.uid === ongoingCardUid);
                        if (aa) {
                            ongoing = aa;
                            break;
                        }
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
            const minion = base?.minions.find((m) => m.uid === minionUid);
            if (!minion) return { events: [] };
            // 防御式门禁：避免在未通过 validate 的情况下误消耗 TALENT_USED
            if (
                (minion.defId === 'frankenstein_the_monster' || minion.defId === 'frankenstein_the_monster_pod') &&
                (minion.powerCounters ?? 0) < 1
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
                const discardCard = player?.discard.find((card) => card.uid === spDiscardUid);
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
                const handCard = player?.hand.find((card) => card.uid === spHandUid);
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
            const spMinion = spBase?.minions.find((m) => m.uid === spUid);
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
            const monster = core.bases[baseIndex]?.monsters?.find((candidate) => candidate.uid === monsterUid);
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
