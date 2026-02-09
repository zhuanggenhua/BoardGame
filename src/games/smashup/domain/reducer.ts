/**
 * 大杀四方 (Smash Up) - 命令执行与事件归约
 *
 * execute: 命令 → 事件列表
 * reduce: 事件 → 新状态（确定性）
 */

import type { MatchState, RandomFn } from '../../../engine/types';
import type {
    SmashUpCommand,
    SmashUpCore,
    SmashUpEvent,
    MinionPlayedEvent,
    ActionPlayedEvent,
    CardsDiscardedEvent,
    FactionSelectedEvent,
    AllFactionsSelectedEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    OngoingAttachedEvent,
    OngoingDetachedEvent,
    TalentUsedEvent,
    CardToDeckBottomEvent,
    CardRecoveredFromDiscardEvent,
    HandShuffledIntoDeckEvent,
    MinionReturnedEvent,
    PromptContinuationEvent,
    MadnessDrawnEvent,
    MadnessReturnedEvent,
    MinionOnBase,
    CardInstance,
    BaseInPlay,
} from './types';
import type { PlayerId } from '../../../engine/types';
import { SU_COMMANDS, SU_EVENTS, STARTING_HAND_SIZE, MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE } from './types';
import { getMinionDef, getCardDef, getBaseDefIdsForFactions } from '../data/cards';
import type { ActionCardDef } from './types';
import { buildDeck, drawCards } from './utils';
import { resolveOnPlay, resolveTalent, resolveOnDestroy } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import { triggerAllBaseAbilities, triggerBaseAbility, triggerExtendedBaseAbility } from './baseAbilities';
import { hasCthulhuExpansionFaction } from './abilityHelpers';
import { fireTriggers, isMinionProtected } from './ongoingEffects';

// ============================================================================
// execute：命令 → 事件
// ============================================================================

export function execute(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn
): SmashUpEvent[] {
    const now = Date.now();
    const core = state.core;

    // 系统命令（SYS_ 前缀）由引擎层处理，领域层不生成事件
    if ((command as any).type.startsWith('SYS_')) {
        return [];
    }

    const events = executeCommand(core, command, random, now);
    // 后处理：onDestroy 触发
    return processDestroyTriggers(events, core, command.playerId, random, now);
}

/** 内部命令执行（不含后处理） */
function executeCommand(
    core: SmashUpCore,
    command: SmashUpCommand,
    random: RandomFn,
    now: number
): SmashUpEvent[] {

    switch (command.type) {
        case SU_COMMANDS.PLAY_MINION: {
            const player = core.players[command.playerId];
            const card = player.hand.find(c => c.uid === command.payload.cardUid)!;
            const minionDef = getMinionDef(card.defId);
            const baseIndex = command.payload.baseIndex;
            const events: SmashUpEvent[] = [];

            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    baseIndex,
                    power: minionDef?.power ?? 0,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(playedEvt);

            // onPlay 能力触发（通过注册表）
            const executor = resolveOnPlay(card.defId);
            if (executor) {
                const ctx: AbilityContext = {
                    state: core,
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    baseIndex,
                    random,
                    now,
                };
                const result = executor(ctx);
                events.push(...result.events);
            }

            // 基地能力触发：onMinionPlayed（如中央大脑 +1 力量）
            const baseAbilityEvents = triggerAllBaseAbilities(
                'onMinionPlayed', core, command.playerId, now,
                {
                    baseIndex,
                    minionUid: card.uid,
                    minionDefId: card.defId,
                    minionPower: minionDef?.power ?? 0,
                }
            );
            events.push(...baseAbilityEvents);

            // ongoing 触发：onMinionPlayed（如火焰陷阱消灭入场随从）
            const coreAfterPlayed = reduce(core, playedEvt);
            const ongoingTriggerEvents = fireTriggers(coreAfterPlayed, 'onMinionPlayed', {
                state: coreAfterPlayed,
                playerId: command.playerId,
                baseIndex,
                triggerMinionUid: card.uid,
                triggerMinionDefId: card.defId,
                random,
                now,
            });
            events.push(...ongoingTriggerEvents);

            return events;
        }

        case SU_COMMANDS.PLAY_ACTION: {
            const player = core.players[command.playerId];
            const card = player.hand.find(c => c.uid === command.payload.cardUid)!;
            const def = getCardDef(card.defId) as ActionCardDef | undefined;
            const events: SmashUpEvent[] = [];

            const event: ActionPlayedEvent = {
                type: SU_EVENTS.ACTION_PLAYED,
                payload: {
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(event);

            if (def?.subtype === 'ongoing') {
                // 持续行动卡：附着到目标
                const targetBase = command.payload.targetBaseIndex ?? 0;
                const attachEvt: OngoingAttachedEvent = {
                    type: SU_EVENTS.ONGOING_ATTACHED,
                    payload: {
                        cardUid: card.uid,
                        defId: card.defId,
                        ownerId: command.playerId,
                        targetType: command.payload.targetMinionUid ? 'minion' : 'base',
                        targetBaseIndex: targetBase,
                        targetMinionUid: command.payload.targetMinionUid,
                    },
                    timestamp: now,
                };
                events.push(attachEvt);
            } else {
                // standard / special 行动卡：执行效果
                const executor = resolveOnPlay(card.defId);
                if (executor) {
                    const ctx: AbilityContext = {
                        state: core,
                        playerId: command.playerId,
                        cardUid: card.uid,
                        defId: card.defId,
                        baseIndex: command.payload.targetBaseIndex ?? 0,
                        targetMinionUid: command.payload.targetMinionUid,
                        random,
                        now,
                    };
                    const result = executor(ctx);
                    events.push(...result.events);
                }
            }

            // 基地能力触发：onActionPlayed（如工坊：额外打出一张战术）
            const targetBaseIdx = command.payload.targetBaseIndex;
            if (targetBaseIdx !== undefined) {
                const base = core.bases[targetBaseIdx];
                if (base) {
                    const baseCtx = {
                        state: core,
                        baseIndex: targetBaseIdx,
                        baseDefId: base.defId,
                        playerId: command.playerId,
                        actionTargetBaseIndex: targetBaseIdx,
                        now,
                    };
                    const bEvents = triggerBaseAbility(base.defId, 'onActionPlayed', baseCtx);
                    events.push(...bEvents);
                }
            }

            return events;
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
            return [event];
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
            const newTakenCount = selection.takenFactions.length + 1;
            const totalRequired = core.turnOrder.length * 2;

            if (newTakenCount >= totalRequired) {
                // 预测更新后的选择
                const tempSelections = { ...selection.playerSelections };
                tempSelections[command.playerId] = [
                    ...(tempSelections[command.playerId] || []),
                    factionId,
                ];

                const readiedPlayers: AllFactionsSelectedEvent['payload']['readiedPlayers'] = {};
                let nextUid = core.nextUid;

                const selectedFactions = Object.values(tempSelections).flatMap((items) => items);
                const basePool = getBaseDefIdsForFactions(selectedFactions);
                const shuffledBasePool = random.shuffle(basePool);
                const baseCount = core.turnOrder.length + 1;
                const activeBases: BaseInPlay[] = shuffledBasePool.slice(0, baseCount).map(defId => ({
                    defId,
                    minions: [],
                    ongoingActions: [],
                }));
                const baseDeck = shuffledBasePool.slice(baseCount);

                for (const pid of core.turnOrder) {
                    const factions = tempSelections[pid];
                    if (factions && factions.length === 2) {
                        const { deck, nextUid: afterDeckUid } = buildDeck(
                            [factions[0], factions[1]],
                            pid,
                            nextUid,
                            random
                        );
                        nextUid = afterDeckUid;

                        const drawResult = drawCards(
                            {
                                ...core.players[pid],
                                deck,
                                hand: [],
                                discard: [],
                            } as any,
                            STARTING_HAND_SIZE,
                            random
                        );

                        readiedPlayers[pid] = {
                            deck: drawResult.deck,
                            hand: drawResult.hand,
                        };
                    }
                }

                const allSelectedEvt: AllFactionsSelectedEvent = {
                    type: SU_EVENTS.ALL_FACTIONS_SELECTED,
                    payload: {
                        readiedPlayers,
                        nextUid,
                        bases: activeBases,
                        baseDeck,
                    },
                    timestamp: now,
                };
                events.push(allSelectedEvt);
            }

            return events;
        }

        case SU_COMMANDS.USE_TALENT: {
            const { minionUid, baseIndex } = command.payload;
            const base = core.bases[baseIndex];
            const minion = base?.minions.find(m => m.uid === minionUid);
            if (!minion) return [];

            const events: SmashUpEvent[] = [];
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
                    playerId: command.playerId,
                    cardUid: minionUid,
                    defId: minion.defId,
                    baseIndex,
                    random,
                    now,
                };
                const result = executor(ctx);
                events.push(...result.events);
            }

            return events;
        }

        default:
            // RESPONSE_PASS 由引擎 ResponseWindowSystem.beforeCommand 处理，领域层不生成事件
            return [];
    }
}

// ============================================================================
// onDestroy 后处理：扫描事件中的 MINION_DESTROYED，触发 onDestroy 能力和基地扩展时机
// ============================================================================

function filterProtectedDestroyEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId
): SmashUpEvent[] {
    return events.filter(e => {
        if (e.type !== SU_EVENTS.MINION_DESTROYED) return true;
        const de = e as MinionDestroyedEvent;
        const { minionUid, fromBaseIndex } = de.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) return true; // 找不到随从，不过滤
        // 检查是否受保护
        return !isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'destroy');
    });
}

function processDestroyTriggers(
    events: SmashUpEvent[],
    core: SmashUpCore,
    playerId: PlayerId,
    random: RandomFn,
    now: number
): SmashUpEvent[] {
    // 保护检查：过滤掉受保护的随从的消灭事件
    const filteredEvents = filterProtectedDestroyEvents(events, core, playerId);

    const destroyEvents = filteredEvents.filter(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent[];
    if (destroyEvents.length === 0) return filteredEvents;

    const extraEvents: SmashUpEvent[] = [];
    for (const de of destroyEvents) {
        const { minionUid, minionDefId, fromBaseIndex, ownerId } = de.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        const destroyerId = minion?.controller ?? ownerId;
        const localEvents: SmashUpEvent[] = [];

        // 1. 触发随从自身的 onDestroy 能力
        const executor = resolveOnDestroy(minionDefId);
        if (executor) {
            // 查找被消灭随从在基地上的信息（消灭前的状态）
            const ctx: AbilityContext = {
                state: core,
                playerId: destroyerId,
                cardUid: minionUid,
                defId: minionDefId,
                baseIndex: fromBaseIndex,
                random,
                now,
            };
            const result = executor(ctx);
            localEvents.push(...result.events);
        }

        // 2. 触发基地扩展时机 onMinionDestroyed
        if (base) {
            const baseCtx = {
                state: core,
                baseIndex: fromBaseIndex,
                baseDefId: base.defId,
                playerId: ownerId,
                minionUid,
                minionDefId,
                controllerId: minion?.controller ?? ownerId,
                destroyerId,
                now,
            };
            const baseEvents = triggerExtendedBaseAbility(base.defId, 'onMinionDestroyed', baseCtx);
            localEvents.push(...(baseEvents as SmashUpEvent[]));
        }

        // 3. 触发 ongoing 拦截器 onMinionDestroyed（如逃生舱回手牌）
        const ongoingDestroyEvents = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            playerId: ownerId,
            baseIndex: fromBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            random,
            now,
        });
        localEvents.push(...ongoingDestroyEvents);

        extraEvents.push(...filterProtectedDestroyEvents(localEvents, core, destroyerId));
    }

    const returnedMinionUids = new Set(
        extraEvents
            .filter(e => e.type === SU_EVENTS.MINION_RETURNED)
            .map(e => (e as MinionReturnedEvent).payload.minionUid)
    );

    const cleanedEvents = returnedMinionUids.size === 0
        ? filteredEvents
        : filteredEvents.filter(e => {
            if (e.type !== SU_EVENTS.MINION_DESTROYED) return true;
            const { minionUid } = (e as MinionDestroyedEvent).payload;
            return !returnedMinionUids.has(minionUid);
        });

    return [...cleanedEvents, ...extraEvents];
}

// ============================================================================
// reduce：事件 → 新状态（确定性）
// ============================================================================

export function reduce(state: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    switch (event.type) {
        case SU_EVENTS.FACTION_SELECTED: {
            const { playerId, factionId } = event.payload;
            const selection = state.factionSelection;
            if (!selection) return state;

            const newTaken = [...selection.takenFactions, factionId];
            const newPlayerSelections = {
                ...selection.playerSelections,
                [playerId]: [...(selection.playerSelections[playerId] || []), factionId],
            };

            // 蛇形选秀逻辑
            const N = state.turnOrder.length;
            const k = newTaken.length;
            let nextPlayerIndex = 0;
            if (k < N) {
                nextPlayerIndex = k;
            } else if (k < 2 * N) {
                nextPlayerIndex = 2 * N - 1 - k;
            }

            return {
                ...state,
                currentPlayerIndex: nextPlayerIndex,
                factionSelection: {
                    ...selection,
                    takenFactions: newTaken,
                    playerSelections: newPlayerSelections,
                },
            };
        }

        case SU_EVENTS.ALL_FACTIONS_SELECTED: {
            const { readiedPlayers, nextUid, bases, baseDeck } = event.payload;
            const newPlayers: Record<PlayerId, any> = { ...state.players };

            for (const [pid, data] of Object.entries(readiedPlayers)) {
                if (newPlayers[pid]) {
                    newPlayers[pid] = {
                        ...newPlayers[pid],
                        deck: data.deck,
                        hand: data.hand,
                        factions: state.factionSelection?.playerSelections[pid] || [],
                    };
                }
            }

            // 检查是否有克苏鲁扩展派系，初始化疯狂牌库
            const madnessDeck = hasCthulhuExpansionFaction(newPlayers)
                ? Array.from({ length: MADNESS_DECK_SIZE }, () => MADNESS_CARD_DEF_ID)
                : undefined;

            return {
                ...state,
                players: newPlayers,
                nextUid,
                currentPlayerIndex: 0,
                factionSelection: undefined,
                madnessDeck,
                bases: bases ?? state.bases,
                baseDeck: baseDeck ?? state.baseDeck,
            };
        }

        case SU_EVENTS.MINION_PLAYED: {
            const { playerId, cardUid, defId, baseIndex, power } = event.payload;
            const player = state.players[playerId];
            const newHand = player.hand.filter(c => c.uid !== cardUid);
            const minion: MinionOnBase = {
                uid: cardUid,
                defId,
                controller: playerId,
                owner: playerId,
                basePower: power,
                powerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            };
            const newBases = state.bases.map((base, i) => {
                if (i !== baseIndex) return base;
                return { ...base, minions: [...base.minions, minion] };
            });
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: newHand,
                        minionsPlayed: player.minionsPlayed + 1,
                    },
                },
                bases: newBases,
            };
        }

        case SU_EVENTS.ACTION_PLAYED: {
            const { playerId, cardUid } = event.payload;
            const player = state.players[playerId];
            const card = player.hand.find(c => c.uid === cardUid);
            const def = card ? getCardDef(card.defId) : undefined;
            const isOngoing = def && def.type === 'action' && (def as ActionCardDef).subtype === 'ongoing';

            const newHand = player.hand.filter(c => c.uid !== cardUid);
            // ongoing 行动卡不进弃牌堆（由 ONGOING_ATTACHED 处理）
            const newDiscard = card && !isOngoing ? [...player.discard, card] : player.discard;
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: newHand,
                        discard: newDiscard,
                        actionsPlayed: player.actionsPlayed + 1,
                    },
                },
            };
        }

        case SU_EVENTS.ONGOING_ATTACHED: {
            const { cardUid, defId, ownerId, targetType, targetBaseIndex, targetMinionUid } = event.payload;
            if (targetType === 'base') {
                const newBases = state.bases.map((base, i) => {
                    if (i !== targetBaseIndex) return base;
                    return {
                        ...base,
                        ongoingActions: [...base.ongoingActions, { uid: cardUid, defId, ownerId }],
                    };
                });
                return { ...state, bases: newBases };
            }
            // 附着到随从
            if (targetMinionUid) {
                const newBases = state.bases.map((base, i) => {
                    if (i !== targetBaseIndex) return base;
                    return {
                        ...base,
                        minions: base.minions.map(m => {
                            if (m.uid !== targetMinionUid) return m;
                            return { ...m, attachedActions: [...m.attachedActions, { uid: cardUid, defId, ownerId }] };
                        }),
                    };
                });
                return { ...state, bases: newBases };
            }
            return state;
        }

        case SU_EVENTS.BASE_SCORED: {
            const { baseIndex, rankings } = event.payload;
            let newPlayers = { ...state.players };
            for (const r of rankings) {
                if (r.vp > 0) {
                    const p = newPlayers[r.playerId];
                    newPlayers = {
                        ...newPlayers,
                        [r.playerId]: { ...p, vp: p.vp + r.vp },
                    };
                }
            }
            const scoredBase = state.bases[baseIndex];

            // Property 11: 持续行动卡回各自所有者弃牌堆
            for (const ongoing of scoredBase.ongoingActions) {
                const owner = newPlayers[ongoing.ownerId];
                if (owner) {
                    const returnedCard: CardInstance = {
                        uid: ongoing.uid,
                        defId: ongoing.defId,
                        type: 'action',
                        owner: ongoing.ownerId,
                    };
                    newPlayers = {
                        ...newPlayers,
                        [ongoing.ownerId]: { ...owner, discard: [...owner.discard, returnedCard] },
                    };
                }
            }

            // 基地上的随从回各自所有者弃牌堆
            for (const m of scoredBase.minions) {
                // Property 12: 随从附着的行动卡回各自所有者弃牌堆
                for (const attached of m.attachedActions) {
                    const attachedOwner = newPlayers[attached.ownerId];
                    if (attachedOwner) {
                        const attachedCard: CardInstance = {
                            uid: attached.uid,
                            defId: attached.defId,
                            type: 'action',
                            owner: attached.ownerId,
                        };
                        newPlayers = {
                            ...newPlayers,
                            [attached.ownerId]: { ...newPlayers[attached.ownerId], discard: [...newPlayers[attached.ownerId].discard, attachedCard] },
                        };
                    }
                }
                const returnedCard: CardInstance = {
                    uid: m.uid,
                    defId: m.defId,
                    type: 'minion',
                    owner: m.owner,
                };
                newPlayers = {
                    ...newPlayers,
                    [m.owner]: { ...newPlayers[m.owner], discard: [...newPlayers[m.owner].discard, returnedCard] },
                };
            }

            const newBases = state.bases.filter((_, i) => i !== baseIndex);
            return { ...state, players: newPlayers, bases: newBases };
        }

        case SU_EVENTS.VP_AWARDED: {
            const { playerId, amount } = event.payload;
            const player = state.players[playerId];
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: { ...player, vp: player.vp + amount },
                },
            };
        }

        case SU_EVENTS.CARDS_DRAWN: {
            const { playerId, cardUids } = event.payload;
            const player = state.players[playerId];
            const drawnCards: CardInstance[] = [];
            let newDeck = [...player.deck];
            for (const uid of cardUids) {
                const idx = newDeck.findIndex(c => c.uid === uid);
                if (idx !== -1) {
                    drawnCards.push(newDeck[idx]);
                    newDeck = [...newDeck.slice(0, idx), ...newDeck.slice(idx + 1)];
                }
            }
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: [...player.hand, ...drawnCards],
                        deck: newDeck,
                    },
                },
            };
        }

        case SU_EVENTS.CARDS_DISCARDED: {
            const { playerId, cardUids } = event.payload;
            const player = state.players[playerId];
            const uidSet = new Set(cardUids);
            // 从手牌和牌库中查找要弃掉的卡
            const discardedFromHand = player.hand.filter(c => uidSet.has(c.uid));
            const discardedFromDeck = player.deck.filter(c => uidSet.has(c.uid));
            const remainingHand = player.hand.filter(c => !uidSet.has(c.uid));
            const remainingDeck = player.deck.filter(c => !uidSet.has(c.uid));
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: remainingHand,
                        deck: remainingDeck,
                        discard: [...player.discard, ...discardedFromHand, ...discardedFromDeck],
                    },
                },
            };
        }

        case SU_EVENTS.TURN_STARTED: {
            const { playerId, turnNumber } = event.payload;
            const player = state.players[playerId];
            // 重置天赋使用状态
            const newBases = state.bases.map(base => ({
                ...base,
                minions: base.minions.map(m => ({
                    ...m,
                    talentUsed: m.controller === playerId ? false : m.talentUsed,
                })),
            }));
            return {
                ...state,
                turnNumber,
                bases: newBases,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                    },
                },
            };
        }

        case SU_EVENTS.TURN_ENDED: {
            const { nextPlayerIndex } = event.payload;
            return { ...state, currentPlayerIndex: nextPlayerIndex };
        }

        case SU_EVENTS.BASE_REPLACED: {
            const { baseIndex, newBaseDefId } = event.payload;
            const newBase: BaseInPlay = {
                defId: newBaseDefId,
                minions: [],
                ongoingActions: [],
            };
            const newBases = [...state.bases];
            newBases.splice(baseIndex, 0, newBase);
            const newBaseDeck = state.baseDeck.filter(id => id !== newBaseDefId);
            return { ...state, bases: newBases, baseDeck: newBaseDeck };
        }

        case SU_EVENTS.DECK_RESHUFFLED: {
            const { playerId, deckUids } = event.payload;
            const player = state.players[playerId];
            // 合并牌库和弃牌堆中的所有卡牌，按 deckUids 排序
            const allCards = [...player.deck, ...player.discard];
            const cardMap = new Map(allCards.map(card => [card.uid, card]));
            const reshuffledDeck = deckUids
                .map(uid => cardMap.get(uid))
                .filter((card): card is CardInstance => card !== undefined);
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: { ...player, deck: reshuffledDeck, discard: [] },
                },
            };
        }

        case SU_EVENTS.MINION_RETURNED: {
            const { minionUid, minionDefId, fromBaseIndex, toPlayerId } = event.payload;
            const newBases = state.bases.map((base, i) => {
                if (i !== fromBaseIndex) return base;
                return { ...base, minions: base.minions.filter(m => m.uid !== minionUid) };
            });
            const owner = state.players[toPlayerId];
            const returnedCard: CardInstance = {
                uid: minionUid,
                defId: minionDefId,
                type: 'minion',
                owner: toPlayerId,
            };
            return {
                ...state,
                bases: newBases,
                players: {
                    ...state.players,
                    [toPlayerId]: { ...owner, hand: [...owner.hand, returnedCard] },
                },
            };
        }

        case SU_EVENTS.LIMIT_MODIFIED: {
            const { playerId, limitType, delta } = event.payload;
            const player = state.players[playerId];
            if (limitType === 'minion') {
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [playerId]: { ...player, minionLimit: player.minionLimit + delta },
                    },
                };
            }
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: { ...player, actionLimit: player.actionLimit + delta },
                },
            };
        }

        // === 新增事件归约 ===

        case SU_EVENTS.MINION_DESTROYED: {
            const { minionUid, minionDefId, fromBaseIndex, ownerId } = (event as MinionDestroyedEvent).payload;
            // 从基地移除随从
            const base = state.bases[fromBaseIndex];
            const minion = base?.minions.find(m => m.uid === minionUid);
            const newBases = state.bases.map((b, i) => {
                if (i !== fromBaseIndex) return b;
                return { ...b, minions: b.minions.filter(m => m.uid !== minionUid) };
            });
            // 随从放入所有者弃牌堆
            let newPlayers = { ...state.players };
            const owner = newPlayers[ownerId];
            const destroyedCard: CardInstance = {
                uid: minionUid,
                defId: minionDefId,
                type: 'minion',
                owner: ownerId,
            };
            newPlayers = {
                ...newPlayers,
                [ownerId]: { ...owner, discard: [...owner.discard, destroyedCard] },
            };
            // Property 12: 附着的行动卡回各自所有者弃牌堆
            if (minion) {
                for (const attached of minion.attachedActions) {
                    const attachedOwner = newPlayers[attached.ownerId];
                    if (attachedOwner) {
                        const attachedCard: CardInstance = {
                            uid: attached.uid,
                            defId: attached.defId,
                            type: 'action',
                            owner: attached.ownerId,
                        };
                        newPlayers = {
                            ...newPlayers,
                            [attached.ownerId]: { ...newPlayers[attached.ownerId], discard: [...newPlayers[attached.ownerId].discard, attachedCard] },
                        };
                    }
                }
            }
            return { ...state, bases: newBases, players: newPlayers };
        }

        case SU_EVENTS.MINION_MOVED: {
            const { minionUid, fromBaseIndex, toBaseIndex } = (event as MinionMovedEvent).payload;
            let movedMinion: MinionOnBase | undefined;
            const newBases = state.bases.map((base, i) => {
                if (i === fromBaseIndex) {
                    const m = base.minions.find(m => m.uid === minionUid);
                    if (m) movedMinion = { ...m };
                    return { ...base, minions: base.minions.filter(m => m.uid !== minionUid) };
                }
                return base;
            });
            if (movedMinion) {
                return {
                    ...state,
                    bases: newBases.map((base, i) => {
                        if (i !== toBaseIndex) return base;
                        return { ...base, minions: [...base.minions, movedMinion!] };
                    }),
                };
            }
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.POWER_COUNTER_ADDED: {
            const { minionUid, baseIndex, amount } = (event as PowerCounterAddedEvent).payload;
            const newBases = state.bases.map((base, i) => {
                if (i !== baseIndex) return base;
                return {
                    ...base,
                    minions: base.minions.map(m => {
                        if (m.uid !== minionUid) return m;
                        return { ...m, powerModifier: m.powerModifier + amount };
                    }),
                };
            });
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.POWER_COUNTER_REMOVED: {
            const { minionUid, baseIndex, amount } = (event as PowerCounterRemovedEvent).payload;
            const newBases = state.bases.map((base, i) => {
                if (i !== baseIndex) return base;
                return {
                    ...base,
                    minions: base.minions.map(m => {
                        if (m.uid !== minionUid) return m;
                        return { ...m, powerModifier: Math.max(0, m.powerModifier - amount) };
                    }),
                };
            });
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.TALENT_USED: {
            const { minionUid, baseIndex } = (event as TalentUsedEvent).payload;
            const newBases = state.bases.map((base, i) => {
                if (i !== baseIndex) return base;
                return {
                    ...base,
                    minions: base.minions.map(m => {
                        if (m.uid !== minionUid) return m;
                        return { ...m, talentUsed: true };
                    }),
                };
            });
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.ONGOING_DETACHED: {
            const { cardUid, defId, ownerId } = (event as OngoingDetachedEvent).payload;
            // 从基地的 ongoingActions 或随从的 attachedActions 中移除
            let newBases = state.bases.map(base => {
                const filteredOngoing = base.ongoingActions.filter(o => o.uid !== cardUid);
                const filteredMinions = base.minions.map(m => ({
                    ...m,
                    attachedActions: m.attachedActions.filter(a => a.uid !== cardUid),
                }));
                if (filteredOngoing.length === base.ongoingActions.length &&
                    filteredMinions.every((m, idx) => m.attachedActions.length === base.minions[idx].attachedActions.length)) {
                    return base;
                }
                return { ...base, ongoingActions: filteredOngoing, minions: filteredMinions };
            });
            // 行动卡回所有者弃牌堆
            const detachedOwner = state.players[ownerId];
            if (!detachedOwner) return { ...state, bases: newBases };
            const detachedCard: CardInstance = { uid: cardUid, defId, type: 'action', owner: ownerId };
            return {
                ...state,
                bases: newBases,
                players: {
                    ...state.players,
                    [ownerId]: { ...detachedOwner, discard: [...detachedOwner.discard, detachedCard] },
                },
            };
        }

        case SU_EVENTS.CARD_TO_DECK_BOTTOM: {
            const { cardUid, defId, ownerId } = (event as CardToDeckBottomEvent).payload;
            const owner = state.players[ownerId];
            if (!owner) return state;
            // 从弃牌堆中移除该卡（如果存在），放入牌库底
            const cardInDiscard = owner.discard.find(c => c.uid === cardUid);
            if (cardInDiscard) {
                const newDiscard = owner.discard.filter(c => c.uid !== cardUid);
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [ownerId]: {
                            ...owner,
                            discard: newDiscard,
                            deck: [...owner.deck, cardInDiscard],
                        },
                    },
                };
            }
            // 如果不在弃牌堆（可能还没进弃牌堆），创建卡牌实例放入牌库底
            const newCard: CardInstance = { uid: cardUid, defId, type: 'minion', owner: ownerId };
            return {
                ...state,
                players: {
                    ...state.players,
                    [ownerId]: {
                        ...owner,
                        deck: [...owner.deck, newCard],
                    },
                },
            };
        }

        case SU_EVENTS.CARD_RECOVERED_FROM_DISCARD: {
            const { playerId, cardUids } = (event as CardRecoveredFromDiscardEvent).payload;
            const player = state.players[playerId];
            if (!player) return state;
            const uidSet = new Set(cardUids);
            const recovered = player.discard.filter(c => uidSet.has(c.uid));
            const remainingDiscard = player.discard.filter(c => !uidSet.has(c.uid));
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: [...player.hand, ...recovered],
                        discard: remainingDiscard,
                    },
                },
            };
        }

        case SU_EVENTS.HAND_SHUFFLED_INTO_DECK: {
            const { playerId, newDeckUids } = (event as HandShuffledIntoDeckEvent).payload;
            const player = state.players[playerId];
            if (!player) return state;
            // 手牌 + 原牌库合并，按 newDeckUids 排序
            const allCards = [...player.hand, ...player.deck];
            const cardMap = new Map(allCards.map(c => [c.uid, c]));
            const newDeck = newDeckUids
                .map(uid => cardMap.get(uid))
                .filter((c): c is CardInstance => c !== undefined);
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: [],
                        deck: newDeck,
                    },
                },
            };
        }

        case SU_EVENTS.PROMPT_CONTINUATION: {
            const { action, continuation } = (event as PromptContinuationEvent).payload;
            if (action === 'set') {
                return { ...state, pendingPromptContinuation: continuation };
            }
            // action === 'clear'
            return { ...state, pendingPromptContinuation: undefined };
        }

        case SU_EVENTS.MADNESS_DRAWN: {
            const { playerId, count, cardUids } = (event as MadnessDrawnEvent).payload;
            const player = state.players[playerId];
            if (!player || !state.madnessDeck) return state;
            // 从疯狂牌库取出 count 张，生成卡牌实例放入玩家手牌
            const actualCount = Math.min(count, state.madnessDeck.length);
            const newMadnessDeck = state.madnessDeck.slice(actualCount);
            const madnessCards: CardInstance[] = cardUids.slice(0, actualCount).map(uid => ({
                uid,
                defId: MADNESS_CARD_DEF_ID,
                type: 'action' as const,
                owner: playerId,
            }));
            return {
                ...state,
                madnessDeck: newMadnessDeck,
                nextUid: state.nextUid + actualCount,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: [...player.hand, ...madnessCards],
                    },
                },
            };
        }

        case SU_EVENTS.MADNESS_RETURNED: {
            const { playerId, cardUid } = (event as MadnessReturnedEvent).payload;
            const player = state.players[playerId];
            if (!player || !state.madnessDeck) return state;
            // 从手牌移除疯狂卡，放回疯狂牌库
            const newHand = player.hand.filter(c => c.uid !== cardUid);
            return {
                ...state,
                madnessDeck: [...state.madnessDeck, MADNESS_CARD_DEF_ID],
                players: {
                    ...state.players,
                    [playerId]: { ...player, hand: newHand },
                },
            };
        }

        default:
            return state;
    }
}
