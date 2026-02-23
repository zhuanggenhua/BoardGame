/**
 * 大杀四方 (Smash Up) - 事件归约
 *
 * reduce: 事件 → 新状态（确定性）
 */

import type {
    SmashUpCore,
    SmashUpEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    OngoingDetachedEvent,
    OngoingCardCounterChangedEvent,
    TalentUsedEvent,
    CardToDeckTopEvent,
    CardToDeckBottomEvent,
    CardTransferredEvent,
    CardRecoveredFromDiscardEvent,
    HandShuffledIntoDeckEvent,
    MadnessDrawnEvent,
    MadnessReturnedEvent,
    BaseDeckReorderedEvent,
    BaseReplacedEvent,
    TempPowerAddedEvent,
    BreakpointModifiedEvent,
    BaseDeckShuffledEvent,
    SpecialLimitUsedEvent,
    SpecialAfterScoringArmedEvent,
    SpecialAfterScoringConsumedEvent,
    MinionOnBase,
    CardInstance,
    BaseInPlay,
    ActionCardDef,
    PlayerState,
} from './types';
import type { PlayerId } from '../../../engine/types';
import { SU_EVENTS, MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE } from './types';
import { getMinionDef, getCardDef } from '../data/cards';
import { hasCthulhuExpansionFaction } from './abilityHelpers';

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
            const newPlayers: Record<PlayerId, PlayerState> = { ...state.players };

            for (const [pid, data] of Object.entries(readiedPlayers)) {
                if (newPlayers[pid]) {
                    const selectedFactions = state.factionSelection?.playerSelections[pid];
                    const factions = Array.isArray(selectedFactions) && selectedFactions.length === 2
                        ? [selectedFactions[0], selectedFactions[1]] as PlayerState['factions']
                        : newPlayers[pid].factions;

                    newPlayers[pid] = {
                        ...newPlayers[pid],
                        deck: data.deck,
                        hand: data.hand,
                        factions,
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
            const { playerId, cardUid, defId, baseIndex, power, fromDiscard, discardPlaySourceId, consumesNormalLimit } = event.payload;
            const player = state.players[playerId];
            // 根据来源从手牌或弃牌堆移除卡牌
            const newHand = fromDiscard ? player.hand : player.hand.filter(c => c.uid !== cardUid);
            const newDiscard = fromDiscard ? player.discard.filter(c => c.uid !== cardUid) : player.discard;
            const minion: MinionOnBase = {
                uid: cardUid,
                defId,
                controller: playerId,
                owner: playerId,
                basePower: power,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            };
            const newBases = state.bases.map((base, i) => {
                if (i !== baseIndex) return base;
                return { ...base, minions: [...base.minions, minion] };
            });
            // 弃牌堆出牌：追踪已使用的能力 sourceId（用于每回合限制）
            const newUsedAbilities = fromDiscard && discardPlaySourceId
                ? [...(player.usedDiscardPlayAbilities ?? []), discardPlaySourceId]
                : player.usedDiscardPlayAbilities;
            // 弃牌堆额外出牌（consumesNormalLimit=false）不消耗正常额度
            const shouldIncrementPlayed = !fromDiscard || consumesNormalLimit !== false;

            // 同名额度消耗：全局额度已用完且有同名额度剩余时，优先消耗同名额度
            const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
            const globalFull0 = player.minionsPlayed >= player.minionLimit;
            const useSameNameQuota = shouldIncrementPlayed && globalFull0 && sameNameRemaining > 0;
            let newSameNameRemaining = player.sameNameMinionRemaining;
            let newSameNameDefId = player.sameNameMinionDefId;
            if (useSameNameQuota) {
                newSameNameRemaining = sameNameRemaining - 1;
                // 锁定 defId（首次使用时从 null 锁定为实际 defId）
                if (newSameNameDefId === null || newSameNameDefId === undefined) {
                    newSameNameDefId = defId;
                }
            }

            // 基地限定额度消耗：如果该基地有限定额度且全局额度和同名额度都已用完，优先消耗限定额度
            const baseQuota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
            const globalFull = player.minionsPlayed >= player.minionLimit;
            const useBaseQuota = shouldIncrementPlayed && !useSameNameQuota && globalFull && baseQuota > 0;
            let newBaseLimitedMinionQuota = player.baseLimitedMinionQuota;
            let finalMinionsPlayed = player.minionsPlayed;
            if (useSameNameQuota) {
                // 消耗同名额度，不增加全局 minionsPlayed
            } else if (useBaseQuota) {
                // 消耗基地限定额度，不增加全局 minionsPlayed
                newBaseLimitedMinionQuota = {
                    ...player.baseLimitedMinionQuota,
                    [baseIndex]: baseQuota - 1,
                };
            } else if (shouldIncrementPlayed) {
                finalMinionsPlayed = player.minionsPlayed + 1;
            }

            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: newHand,
                        discard: newDiscard,
                        minionsPlayed: finalMinionsPlayed,
                        minionsPlayedPerBase: {
                            ...(player.minionsPlayedPerBase ?? {}),
                            [baseIndex]: ((player.minionsPlayedPerBase ?? {})[baseIndex] ?? 0) + 1,
                        },
                        usedDiscardPlayAbilities: newUsedAbilities,
                        baseLimitedMinionQuota: newBaseLimitedMinionQuota,
                        sameNameMinionRemaining: newSameNameRemaining,
                        sameNameMinionDefId: newSameNameDefId,
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
            const isSpecial = def && def.type === 'action' && (def as ActionCardDef).subtype === 'special';

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
                        // Special 卡不消耗行动额度（规则：打出 Special 不算作你的行动）
                        actionsPlayed: isSpecial ? player.actionsPlayed : player.actionsPlayed + 1,
                    },
                },
            };
        }

        case SU_EVENTS.ONGOING_ATTACHED: {
            const { cardUid, defId, ownerId, targetType, targetBaseIndex, targetMinionUid, metadata } = event.payload;
            if (targetType === 'base') {
                const newBases = state.bases.map((base, i) => {
                    if (i !== targetBaseIndex) return base;
                    return {
                        ...base,
                        ongoingActions: [...base.ongoingActions, { uid: cardUid, defId, ownerId, talentUsed: false, ...(metadata ? { metadata } : {}) }],
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
                            const updated = { ...m, attachedActions: [...m.attachedActions, { uid: cardUid, defId, ownerId }] };
                            // ghost_make_contact：附着时改变控制权
                            if (defId === 'ghost_make_contact') {
                                updated.controller = ownerId;
                            }
                            return updated;
                        }),
                    };
                });
                return { ...state, bases: newBases };
            }
            return state;
        }

        case SU_EVENTS.BASE_SCORED: {
            // 仅发放 VP，不清除基地（清除由后续 BASE_CLEARED 执行）
            // 这确保 afterScoring 触发器能访问基地上的随从和 ongoing 卡
            const { rankings } = event.payload;
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
            return { ...state, players: newPlayers };
        }

        case SU_EVENTS.BASE_CLEARED: {
            const { baseIndex } = event.payload;
            const scoredBase = state.bases[baseIndex];
            if (!scoredBase) return state;
            let newPlayers = { ...state.players };

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
            // 重置天赋使用状态 + 清零临时力量修正（随从 + ongoing 行动卡）
            const newBases = state.bases.map(base => ({
                ...base,
                minions: base.minions.map(m => ({
                    ...m,
                    powerModifier: m.powerModifier,  // 显式保留 +1力量指示物
                    talentUsed: m.controller === playerId ? false : m.talentUsed,
                    tempPowerModifier: 0,
                    attachedActions: m.attachedActions.map(a => ({
                        ...a,
                        talentUsed: a.ownerId === playerId ? false : a.talentUsed,
                    })),
                })),
                ongoingActions: base.ongoingActions.map(o => ({
                    ...o,
                    talentUsed: o.ownerId === playerId ? false : o.talentUsed,
                })),
            }));
            // 检查沉睡印记：被标记的玩家本回合 actionLimit 设为 0
            const isSleepMarked = state.sleepMarkedPlayers?.includes(playerId);
            const newActionLimit = isSleepMarked ? 0 : 1;
            // 清除该玩家的沉睡标记
            const newSleepMarked = isSleepMarked
                ? (state.sleepMarkedPlayers?.filter(p => p !== playerId) ?? [])
                : state.sleepMarkedPlayers;
            return {
                ...state,
                turnNumber,
                bases: newBases,
                // 清空本回合消灭记录
                turnDestroyedMinions: [],
                // 清空本回合移动追踪
                minionsMovedToBaseThisTurn: undefined,
                // 清空临时临界点修正
                tempBreakpointModifiers: undefined,
                // 清空 special 能力限制组使用记录
                specialLimitUsed: undefined,
                // 清空巨石阵双才能追踪
                standingStonesDoubleTalentMinionUid: undefined,
                // 清空计分后延迟 special 记录
                pendingAfterScoringSpecials: undefined,
                sleepMarkedPlayers: newSleepMarked?.length ? newSleepMarked : undefined,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: newActionLimit,
                        minionsPlayedPerBase: undefined,
                        usedDiscardPlayAbilities: undefined,
                        baseLimitedMinionQuota: undefined,
                        baseLimitedSameNameRequired: undefined,
                        extraMinionPowerMax: undefined,
                        sameNameMinionRemaining: undefined,
                        sameNameMinionDefId: null,
                        pendingMinionPlayEffects: undefined,
                    },
                },
            };
        }

        case SU_EVENTS.TURN_ENDED: {
            const { nextPlayerIndex } = event.payload;
            return { ...state, currentPlayerIndex: nextPlayerIndex };
        }

        case SU_EVENTS.BASE_REPLACED: {
            const { baseIndex, oldBaseDefId, newBaseDefId, keepCards } = (event as BaseReplacedEvent).payload;
            const newBaseDeck = state.baseDeck.filter(id => id !== newBaseDefId);
            // keepCards 模式：仅替换 defId，保留随从和 ongoing，旧 defId 回牌库
            if (keepCards) {
                const updatedBases = state.bases.map((base, i) => {
                    if (i !== baseIndex) return base;
                    return { ...base, defId: newBaseDefId };
                });
                return { ...state, bases: updatedBases, baseDeck: [...newBaseDeck, oldBaseDefId] };
            }
            // 默认模式：插入新空基地（配合 BASE_SCORED 删除旧基地后使用）
            const newBase: BaseInPlay = {
                defId: newBaseDefId,
                minions: [],
                ongoingActions: [],
            };
            const newBases = [...state.bases];
            newBases.splice(baseIndex, 0, newBase);
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

        case SU_EVENTS.DECK_REORDERED: {
            const { playerId, deckUids } = event.payload;
            const player = state.players[playerId];
            // 从牌库和弃牌堆中查找卡牌，按 deckUids 顺序组建新牌库
            // 弃牌堆中被引用的卡会移入牌库，未被引用的留在弃牌堆
            const deckMap = new Map(player.deck.map(card => [card.uid, card]));
            const discardMap = new Map(player.discard.map(card => [card.uid, card]));
            const movedFromDiscard = new Set<string>();
            const reorderedDeck: CardInstance[] = [];
            for (const uid of deckUids) {
                const fromDeck = deckMap.get(uid);
                if (fromDeck) {
                    reorderedDeck.push(fromDeck);
                } else {
                    const fromDiscard = discardMap.get(uid);
                    if (fromDiscard) {
                        reorderedDeck.push(fromDiscard);
                        movedFromDiscard.add(uid);
                    }
                }
            }
            // 弃牌堆中未被移走的卡保留
            const newDiscard = movedFromDiscard.size > 0
                ? player.discard.filter(c => !movedFromDiscard.has(c.uid))
                : player.discard;
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: { ...player, deck: reorderedDeck, discard: newDiscard },
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
            const { playerId, limitType, delta, restrictToBase, powerMax, sameNameOnly, sameNameDefId } = event.payload;
            const player = state.players[playerId];
            if (limitType === 'minion') {
                // 基地限定额度：写入 baseLimitedMinionQuota
                if (restrictToBase !== undefined) {
                    const oldQuota = player.baseLimitedMinionQuota ?? {};
                    const updatedPlayer: typeof player = {
                        ...player,
                        baseLimitedMinionQuota: {
                            ...oldQuota,
                            [restrictToBase]: (oldQuota[restrictToBase] ?? 0) + delta,
                        },
                    };
                    // 同名约束标记
                    if (sameNameOnly) {
                        updatedPlayer.baseLimitedSameNameRequired = {
                            ...(player.baseLimitedSameNameRequired ?? {}),
                            [restrictToBase]: true,
                        };
                    }
                    return {
                        ...state,
                        players: { ...state.players, [playerId]: updatedPlayer },
                    };
                }
                // 同名限制额度：不增加全局 minionLimit，写入独立的 sameNameMinionRemaining
                if (sameNameOnly) {
                    const updatedPlayer = {
                        ...player,
                        sameNameMinionRemaining: (player.sameNameMinionRemaining ?? 0) + delta,
                        // 预锁定 defId 或首次设置时初始化为 null（尚未锁定）
                        sameNameMinionDefId: sameNameDefId ?? (player.sameNameMinionDefId !== undefined ? player.sameNameMinionDefId : null),
                    };
                    return {
                        ...state,
                        players: { ...state.players, [playerId]: updatedPlayer },
                    };
                }
                // 全局额度（带力量限制时记录 extraMinionPowerMax）
                const updatedPlayer = { ...player, minionLimit: player.minionLimit + delta };
                if (powerMax !== undefined) {
                    // 取最严格的限制（多个来源时取最小值）
                    updatedPlayer.extraMinionPowerMax = player.extraMinionPowerMax !== undefined
                        ? Math.min(player.extraMinionPowerMax, powerMax)
                        : powerMax;
                }
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [playerId]: updatedPlayer,
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
            // 追踪本回合被消灭的随从（用于 furthering_the_cause 等触发器）
            const destroyRecord = { defId: minionDefId, baseIndex: fromBaseIndex, owner: ownerId };
            const updatedDestroyList = [...(state.turnDestroyedMinions ?? []), destroyRecord];
            return { ...state, bases: newBases, players: newPlayers, turnDestroyedMinions: updatedDestroyList };
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
            // 回退：若基地上找不到（如 afterScoring 后随从已进弃牌堆），从弃牌堆恢复
            if (!movedMinion) {
                for (const [pid, player] of Object.entries(state.players)) {
                    const idx = player.discard.findIndex(c => c.uid === minionUid);
                    if (idx !== -1) {
                        const card = player.discard[idx];
                        const minionDef = getMinionDef(card.defId);
                        movedMinion = {
                            uid: card.uid,
                            defId: card.defId,
                            owner: card.owner,
                            controller: card.owner,
                            basePower: minionDef?.power ?? 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        };
                        // 从弃牌堆移除
                        const newDiscard = [...player.discard];
                        newDiscard.splice(idx, 1);
                        const updatedBases = movedMinion
                            ? newBases.map((base, i) => {
                                if (i !== toBaseIndex) return base;
                                return { ...base, minions: [...base.minions, movedMinion!] };
                            })
                            : newBases;
                        return {
                            ...state,
                            bases: updatedBases,
                            players: {
                                ...state.players,
                                [pid]: { ...player, discard: newDiscard },
                            },
                        };
                    }
                }
            }
            if (movedMinion) {
                // 追踪本回合移动到各基地的次数（用于牧场等"首次移动"触发）
                const mover = movedMinion.controller;
                const prevMoves = state.minionsMovedToBaseThisTurn ?? {};
                const playerMoves = prevMoves[mover] ?? {};
                const updatedMoves = {
                    ...prevMoves,
                    [mover]: { ...playerMoves, [toBaseIndex]: (playerMoves[toBaseIndex] ?? 0) + 1 },
                };
                return {
                    ...state,
                    minionsMovedToBaseThisTurn: updatedMoves,
                    bases: newBases.map((base, i) => {
                        if (i !== toBaseIndex) return base;
                        return { ...base, minions: [...base.minions, movedMinion!] };
                    }),
                };
            }
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.POWER_COUNTER_ADDED: {
            const { minionUid, amount } = (event as PowerCounterAddedEvent).payload;
            // 使用 minionUid 查找，不依赖 baseIndex（避免基地删除后索引错位）
            const newBases = state.bases.map(base => ({
                ...base,
                minions: base.minions.map(m => 
                    m.uid === minionUid 
                        ? { ...m, powerModifier: m.powerModifier + amount }
                        : m
                ),
            }));
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.POWER_COUNTER_REMOVED: {
            const { minionUid, amount } = (event as PowerCounterRemovedEvent).payload;
            // 使用 minionUid 查找，不依赖 baseIndex（避免基地删除后索引错位）
            const newBases = state.bases.map(base => ({
                ...base,
                minions: base.minions.map(m => 
                    m.uid === minionUid 
                        ? { ...m, powerModifier: Math.max(0, m.powerModifier - amount) }
                        : m
                ),
            }));
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.MINION_PLAY_EFFECT_QUEUED: {
            const qPayload = (event as unknown as { payload: { playerId: string; effect: 'addPowerCounter'; amount: number } }).payload;
            const qPlayer = state.players[qPayload.playerId];
            if (!qPlayer) return state;
            const prev = qPlayer.pendingMinionPlayEffects ?? [];
            return {
                ...state,
                players: { ...state.players, [qPayload.playerId]: { ...qPlayer, pendingMinionPlayEffects: [...prev, { effect: qPayload.effect, amount: qPayload.amount }] } },
            };
        }

        case SU_EVENTS.MINION_PLAY_EFFECT_CONSUMED: {
            const cPayload = (event as unknown as { payload: { playerId: string } }).payload;
            const cPlayer = state.players[cPayload.playerId];
            if (!cPlayer) return state;
            const queue = cPlayer.pendingMinionPlayEffects ?? [];
            return {
                ...state,
                players: { ...state.players, [cPayload.playerId]: { ...cPlayer, pendingMinionPlayEffects: queue.slice(1) } },
            };
        }

        case SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED: {
            const { cardUid, delta } = (event as OngoingCardCounterChangedEvent).payload;
            // 使用 cardUid 查找，不依赖 baseIndex（避免基地删除后索引错位）
            const newBases = state.bases.map(base => ({
                ...base,
                ongoingActions: base.ongoingActions.map(oa => {
                    if (oa.uid !== cardUid) return oa;
                    const prev = ((oa.metadata?.powerCounters as number) ?? 0);
                    return { ...oa, metadata: { ...oa.metadata, powerCounters: Math.max(0, prev + delta) } };
                }),
            }));
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.TALENT_USED: {
            const { minionUid, ongoingCardUid, baseIndex } = (event as TalentUsedEvent).payload;
            // 使用 uid 查找，不依赖 baseIndex（避免基地删除后索引错位）
            const newBases = state.bases.map(base => {
                // ongoing 行动卡天赋（基地上或随从附着）
                if (ongoingCardUid) {
                    return {
                        ...base,
                        ongoingActions: base.ongoingActions.map(o => 
                            o.uid === ongoingCardUid ? { ...o, talentUsed: true } : o
                        ),
                        minions: base.minions.map(m => ({
                            ...m,
                            attachedActions: m.attachedActions.map(a => 
                                a.uid === ongoingCardUid ? { ...a, talentUsed: true } : a
                            ),
                        })),
                    };
                }
                // 随从天赋
                return {
                    ...base,
                    minions: base.minions.map(m => 
                        m.uid === minionUid ? { ...m, talentUsed: true } : m
                    ),
                };
            });
            // 巨石阵双才能追踪：如果随从在使用前 talentUsed 已为 true，说明这是第二次使用
            let newStandingStonesUid = state.standingStonesDoubleTalentMinionUid;
            if (minionUid && !ongoingCardUid) {
                // 使用 baseIndex 查找旧状态（这里 baseIndex 仍然有效，因为是在 TALENT_USED 命令执行时）
                const oldBase = baseIndex < state.bases.length ? state.bases[baseIndex] : undefined;
                const oldMinion = oldBase?.minions.find(m => m.uid === minionUid);
                if (oldMinion?.talentUsed && oldBase?.defId === 'base_standing_stones') {
                    newStandingStonesUid = minionUid;
                }
            }
            return { ...state, bases: newBases, standingStonesDoubleTalentMinionUid: newStandingStonesUid };
        }

        case SU_EVENTS.ONGOING_DETACHED: {
            const { cardUid, defId, ownerId } = (event as OngoingDetachedEvent).payload;
            // 从基地的 ongoingActions 或随从的 attachedActions 中移除
            const newBases = state.bases.map(base => {
                const filteredOngoing = base.ongoingActions.filter(o => o.uid !== cardUid);
                const filteredMinions = base.minions.map(m => {
                    const hadAttachment = m.attachedActions.some(a => a.uid === cardUid);
                    const filtered = m.attachedActions.filter(a => a.uid !== cardUid);
                    if (!hadAttachment) return { ...m, attachedActions: filtered };
                    const updated = { ...m, attachedActions: filtered };
                    // ghost_make_contact：移除时恢复控制权为原始 owner
                    if (defId === 'ghost_make_contact') {
                        updated.controller = m.owner;
                    }
                    return updated;
                });
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

        case SU_EVENTS.CARD_TO_DECK_TOP: {
            const { cardUid, defId, ownerId } = (event as CardToDeckTopEvent).payload;
            const owner = state.players[ownerId];
            if (!owner) return state;

            let found: CardInstance | undefined;
            const removeCard = (cards: CardInstance[]): CardInstance[] => {
                const idx = cards.findIndex(c => c.uid === cardUid);
                if (idx === -1) return cards;
                if (!found) found = cards[idx];
                return [...cards.slice(0, idx), ...cards.slice(idx + 1)];
            };

            const newHand = removeCard(owner.hand);
            const newDeck = removeCard(owner.deck);
            const newDiscard = removeCard(owner.discard);

            const def = getCardDef(defId);
            const card: CardInstance = found ?? {
                uid: cardUid,
                defId,
                type: def?.type ?? 'minion',
                owner: ownerId,
            };

            return {
                ...state,
                players: {
                    ...state.players,
                    [ownerId]: {
                        ...owner,
                        hand: newHand,
                        discard: newDiscard,
                        deck: [card, ...newDeck],
                    },
                },
            };
        }

        case SU_EVENTS.CARD_TO_DECK_BOTTOM: {
            const { cardUid, defId, ownerId } = (event as CardToDeckBottomEvent).payload;
            const owner = state.players[ownerId];
            if (!owner) return state;

            let found: CardInstance | undefined;
            const removeCard = (cards: CardInstance[]): CardInstance[] => {
                const idx = cards.findIndex(c => c.uid === cardUid);
                if (idx === -1) return cards;
                if (!found) found = cards[idx];
                return [...cards.slice(0, idx), ...cards.slice(idx + 1)];
            };

            const newHand = removeCard(owner.hand);
            const newDeck = removeCard(owner.deck);
            const newDiscard = removeCard(owner.discard);

            // 也从基地上搜索（随从或 ongoing 行动卡）
            let newBases = state.bases;
            if (!found) {
                newBases = state.bases.map(base => {
                    // 搜索随从
                    const minion = base.minions.find(m => m.uid === cardUid);
                    if (minion) {
                        if (!found) found = { uid: cardUid, defId, type: 'minion', owner: ownerId };
                        return { ...base, minions: base.minions.filter(m => m.uid !== cardUid) };
                    }
                    // 搜索 ongoing 行动卡
                    const ongoing = base.ongoingActions.find(o => o.uid === cardUid);
                    if (ongoing) {
                        if (!found) found = { uid: cardUid, defId, type: 'action', owner: ownerId };
                        return { ...base, ongoingActions: base.ongoingActions.filter(o => o.uid !== cardUid) };
                    }
                    return base;
                });
            }

            const def = getCardDef(defId);
            const card: CardInstance = found ?? {
                uid: cardUid,
                defId,
                type: def?.type ?? 'minion',
                owner: ownerId,
            };

            return {
                ...state,
                bases: newBases,
                players: {
                    ...state.players,
                    [ownerId]: {
                        ...owner,
                        hand: newHand,
                        discard: newDiscard,
                        deck: [...newDeck, card],
                    },
                },
            };
        }

        case SU_EVENTS.CARD_TRANSFERRED: {
            const { cardUid, defId, fromPlayerId, toPlayerId } = (event as CardTransferredEvent).payload;
            const fromPlayer = state.players[fromPlayerId];
            const toPlayer = state.players[toPlayerId];
            if (!fromPlayer || !toPlayer) return state;

            let found: CardInstance | undefined;
            const removeCard = (cards: CardInstance[]): CardInstance[] => {
                const idx = cards.findIndex(c => c.uid === cardUid);
                if (idx === -1) return cards;
                if (!found) found = cards[idx];
                return [...cards.slice(0, idx), ...cards.slice(idx + 1)];
            };

            const fromHand = removeCard(fromPlayer.hand);
            const fromDeck = removeCard(fromPlayer.deck);
            const fromDiscard = removeCard(fromPlayer.discard);

            if (!found) return state;

            const def = getCardDef(defId);
            const card: CardInstance = found ?? {
                uid: cardUid,
                defId,
                type: def?.type ?? 'minion',
                owner: fromPlayerId,
            };

            return {
                ...state,
                players: {
                    ...state.players,
                    [fromPlayerId]: {
                        ...fromPlayer,
                        hand: fromHand,
                        deck: fromDeck,
                        discard: fromDiscard,
                    },
                    [toPlayerId]: {
                        ...toPlayer,
                        hand: [...toPlayer.hand, card],
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
            // 手牌 + 原牌库合并，按 newDeckUids 排序构建新牌库
            const allCards = [...player.hand, ...player.deck];
            const cardMap = new Map(allCards.map(c => [c.uid, c]));
            const newDeck = newDeckUids
                .map(uid => cardMap.get(uid))
                .filter((c): c is CardInstance => c !== undefined);
            // 只移除被洗入牌库的手牌，保留其余手牌
            const movedUidSet = new Set(newDeckUids);
            const remainingHand = player.hand.filter(c => !movedUidSet.has(c.uid));
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: remainingHand,
                        deck: newDeck,
                    },
                },
            };
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
            // 从手牌或弃牌堆移除疯狂卡，放回疯狂牌库
            const newHand = player.hand.filter(c => c.uid !== cardUid);
            const newDiscard = player.discard.filter(c => c.uid !== cardUid);
            return {
                ...state,
                madnessDeck: [...state.madnessDeck, MADNESS_CARD_DEF_ID],
                players: {
                    ...state.players,
                    [playerId]: { ...player, hand: newHand, discard: newDiscard },
                },
            };
        }

        // 基地牌库重排（巫师学院等能力）
        case SU_EVENTS.BASE_DECK_REORDERED: {
            const { topDefIds } = (event as BaseDeckReorderedEvent).payload;
            // 将 topDefIds 放到牌库顶部，其余保持原序
            const remaining = state.baseDeck.filter(id => !topDefIds.includes(id));
            return { ...state, baseDeck: [...topDefIds, ...remaining] };
        }

        // 展示手牌（纯事件，UI 通过 EventStream 消费展示，不写入 core）
        case SU_EVENTS.REVEAL_HAND:
        case SU_EVENTS.REVEAL_DECK_TOP:
            return state;

        // 临时力量修正（回合结束自动清零）
        case SU_EVENTS.TEMP_POWER_ADDED: {
            const { minionUid, amount } = (event as TempPowerAddedEvent).payload;
            // 使用 minionUid 查找，不依赖 baseIndex（避免基地删除后索引错位）
            const newBases = state.bases.map(base => ({
                ...base,
                minions: base.minions.map(m => 
                    m.uid === minionUid 
                        ? { ...m, tempPowerModifier: (m.tempPowerModifier ?? 0) + amount }
                        : m
                ),
            }));
            return { ...state, bases: newBases };
        }

        // 临界点临时修正（回合结束自动清零）
        case SU_EVENTS.BREAKPOINT_MODIFIED: {
            const { baseIndex, delta } = (event as BreakpointModifiedEvent).payload;
            const prev = state.tempBreakpointModifiers ?? {};
            return {
                ...state,
                tempBreakpointModifiers: {
                    ...prev,
                    [baseIndex]: (prev[baseIndex] ?? 0) + delta,
                },
            };
        }

        // 基地牌库洗混
        case SU_EVENTS.BASE_DECK_SHUFFLED: {
            const { newBaseDeckDefIds } = (event as BaseDeckShuffledEvent).payload;
            return { ...state, baseDeck: newBaseDeckDefIds };
        }

        // special 能力限制组使用记录（每基地每回合一次）
        case SU_EVENTS.SPECIAL_LIMIT_USED: {
            const { limitGroup, baseIndex } = (event as SpecialLimitUsedEvent).payload;
            const prev = state.specialLimitUsed ?? {};
            const prevGroup = prev[limitGroup] ?? [];
            if (prevGroup.includes(baseIndex)) return state;
            return {
                ...state,
                specialLimitUsed: {
                    ...prev,
                    [limitGroup]: [...prevGroup, baseIndex],
                },
            };
        }

        case SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED: {
            const payload = (event as SpecialAfterScoringArmedEvent).payload;
            const prev = state.pendingAfterScoringSpecials ?? [];
            const exists = prev.some(
                p => p.sourceDefId === payload.sourceDefId
                    && p.playerId === payload.playerId
                    && p.baseIndex === payload.baseIndex,
            );
            if (exists) return state;

            const newEntry = {
                sourceDefId: payload.sourceDefId,
                playerId: payload.playerId,
                baseIndex: payload.baseIndex,
            };
            const newState = {
                ...state,
                pendingAfterScoringSpecials: [
                    ...prev,
                    newEntry,
                ],
            };
            return newState;
        }

        case SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED: {
            const payload = (event as SpecialAfterScoringConsumedEvent).payload;
            const prev = state.pendingAfterScoringSpecials ?? [];
            const next = prev.filter(
                p => !(p.sourceDefId === payload.sourceDefId
                    && p.playerId === payload.playerId
                    && p.baseIndex === payload.baseIndex),
            );
            return {
                ...state,
                pendingAfterScoringSpecials: next.length > 0 ? next : undefined,
            };
        }

        default:
            return state;
    }
}
