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
    MinionControlChangedEvent,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    OngoingDetachedEvent,
    OngoingCardCounterChangedEvent,
    TalentUsedEvent,
    CardToDeckTopEvent,
    CardToDeckBottomEvent,
    CardBoxedEvent,
    CardTransferredEvent,
    CardRecoveredFromDiscardEvent,
    HandShuffledIntoDeckEvent,
    MadnessDrawnEvent,
    MadnessReturnedEvent,
    BaseDeckReorderedEvent,
    BaseReplacedEvent,
    TempPowerAddedEvent,
    PermanentPowerAddedEvent,
    CardSuppressedEvent,
    BreakpointModifiedEvent,
    BaseDeckShuffledEvent,
    SpecialLimitUsedEvent,
    SpecialAfterScoringArmedEvent,
    SpecialAfterScoringConsumedEvent,
    TriggerQueuedEvent,
    TriggerConsumedEvent,
    MinionOnBase,
    CardType,
    CardInstance,
    BaseInPlay,
    ActionCardDef,
    PlayerState,
    TitanState,
    TitanPlayedEvent,
    TitanMovedEvent,
    TitanRemovedFromPlayEvent,
    TitanPowerCounterAddedEvent,
    TitanPowerCounterRemovedEvent,
    TitanMetadataUpdatedEvent,
} from './types';
import type { PlayerId } from '../../../engine/types';
import { SU_EVENTS, SU_EVENT_TYPES, MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE } from './types';
import { getBaseDef, getMinionDef, getCardDef, getFactionTitan } from '../data/cards';
import { hasCthulhuExpansionFaction } from './abilityHelpers';
import {
    getBestMatchingBaseLimitedPowerQuota,
    canUseBaseLimitedMinionQuota,
    canUseSameNameMinionQuota,
    getBestMatchingGlobalPowerLimitedQuota,
    getRemainingBaseLimitedPowerLimitedMinionQuotas,
    getRemainingGlobalPowerLimitedMinionQuotas,
    getRemainingUnrestrictedGlobalMinionQuota,
    resolveLiveBaseIndex,
} from './utils';

function buildCompletedDraftPlayers(
    turnOrder: PlayerId[],
    playerSelections: Record<PlayerId, string[]>,
): PlayerId[] {
    return turnOrder.filter((playerId) => (playerSelections[playerId] ?? []).length >= 2);
}

function getNextDraftPlayerIndex(
    turnOrder: PlayerId[],
    playerSelections: Record<PlayerId, string[]>,
    anchorPlayerId: PlayerId,
    fallbackIndex: number,
): number {
    if (turnOrder.length === 0) return 0;

    const counts = turnOrder.map((playerId) => (playerSelections[playerId] ?? []).length);
    if (counts.every((count) => count >= 2)) {
        return 0;
    }

    const allPlayersHaveFirstFaction = counts.every((count) => count >= 1);
    const targetCount = allPlayersHaveFirstFaction ? 2 : 1;
    const direction = allPlayersHaveFirstFaction ? -1 : 1;
    const anchorIndex = Math.max(0, turnOrder.indexOf(anchorPlayerId));
    const startIndex = turnOrder.includes(anchorPlayerId) ? anchorIndex : fallbackIndex;

    for (let offset = 0; offset < turnOrder.length; offset += 1) {
        const index = (startIndex + direction * offset + turnOrder.length) % turnOrder.length;
        if ((playerSelections[turnOrder[index]] ?? []).length < targetCount) {
            return index;
        }
    }

    return fallbackIndex;
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
            const nextPlayerIndex = getNextDraftPlayerIndex(
                state.turnOrder,
                newPlayerSelections,
                playerId,
                state.currentPlayerIndex,
            );

            return {
                ...state,
                currentPlayerIndex: nextPlayerIndex,
                factionSelection: {
                    ...selection,
                    takenFactions: newTaken,
                    playerSelections: newPlayerSelections,
                    completedPlayers: buildCompletedDraftPlayers(state.turnOrder, newPlayerSelections),
                },
            };
        }

        case SU_EVENTS.FACTION_DESELECTED: {
            const { playerId, factionId } = event.payload;
            const selection = state.factionSelection;
            if (!selection) return state;

            const newTaken = selection.takenFactions.filter((takenFactionId) => takenFactionId !== factionId);
            const newPlayerSelections = {
                ...selection.playerSelections,
                [playerId]: (selection.playerSelections[playerId] || []).filter((selectedFactionId) => selectedFactionId !== factionId),
            };
            const nextPlayerIndex = getNextDraftPlayerIndex(
                state.turnOrder,
                newPlayerSelections,
                playerId,
                state.currentPlayerIndex,
            );

            return {
                ...state,
                currentPlayerIndex: nextPlayerIndex,
                factionSelection: {
                    ...selection,
                    takenFactions: newTaken,
                    playerSelections: newPlayerSelections,
                    completedPlayers: buildCompletedDraftPlayers(state.turnOrder, newPlayerSelections),
                },
            };
        }

        case SU_EVENTS.ALL_FACTIONS_SELECTED: {
            const { readiedPlayers, nextUid, bases, baseDeck } = event.payload;
            const newPlayers: Record<PlayerId, PlayerState> = { ...state.players };
            const titans: TitanState[] = [];
            const titansEnabled = (state.enabledExpansions ?? ['titans']).includes('titans');

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

                    if (titansEnabled) {
                        for (const factionId of factions) {
                            const titanDef = getFactionTitan(factionId);
                            if (!titanDef) continue;
                            titans.push({
                                uid: `titan_${pid}_${titanDef.id}`,
                                defId: titanDef.id,
                                faction: titanDef.faction,
                                ownerId: pid as PlayerId,
                                controllerId: pid as PlayerId,
                                powerCounters: 0,
                                talentUsed: false,
                                location: { zone: 'setaside' },
                            });
                        }
                    }
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
                titans,
                bases: bases ?? state.bases,
                baseDeck: baseDeck ?? state.baseDeck,
            };
        }

        case SU_EVENTS.MINION_PLAYED: {
            const { playerId, cardUid, defId, baseIndex, power, fromDiscard, fromDeck, fromBuried, discardPlaySourceId, consumesNormalLimit, allowImplicitSource } = event.payload;
            const resolvedBaseIndex = resolveLiveBaseIndex(state, baseIndex, event.payload.baseDefId) ?? baseIndex;
            const player = state.players[playerId];
            const cardInHand = player.hand.some(card => card.uid === cardUid);
            const cardInDiscard = player.discard.some(card => card.uid === cardUid);
            const cardInDeck = player.deck.some(card => card.uid === cardUid);
            const buriedHasCard = fromBuried
                ? (state.bases[resolvedBaseIndex]?.buriedCards ?? []).some(c => c.uid === cardUid)
                : false;
            if (fromBuried && !buriedHasCard && !allowImplicitSource) return state;
            if (!fromBuried && !allowImplicitSource && ((fromDiscard && !cardInDiscard) || (fromDeck && !cardInDeck) || (!fromDiscard && !fromDeck && !cardInHand))) {
                return state;
            }
            // 根据来源从手牌、弃牌堆或牌库移除卡牌
            // allowImplicitSource: true 时从所有位置尝试移除（用于动态牌源）
            const removeCard = (cards: CardInstance[]) => cards.filter(c => c.uid !== cardUid);
            const newHand = allowImplicitSource ? removeCard(player.hand) : (fromDiscard || fromDeck || fromBuried) ? player.hand : removeCard(player.hand);
            const newDiscard = allowImplicitSource ? removeCard(player.discard) : fromDiscard ? removeCard(player.discard) : player.discard;
            const newDeck = allowImplicitSource ? removeCard(player.deck) : fromDeck ? removeCard(player.deck) : player.deck;
            const minion: MinionOnBase = {
                uid: cardUid,
                defId,
                controller: playerId,
                owner: playerId,
                basePower: power,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: true,
                attachedActions: [],
                metadata: (fromDiscard || fromDeck || fromBuried)
                    ? { playedFrom: fromDiscard ? 'discard' : fromDeck ? 'deck' : 'buried' }
                    : undefined,
            };
            const newBases = state.bases.map((base, i) => {
                if (i !== resolvedBaseIndex) return base;
                const buriedCards = fromBuried
                    ? (base.buriedCards ?? []).filter(c => c.uid !== cardUid)
                    : base.buriedCards;
                return { ...base, minions: [...base.minions, minion], ...(buriedCards ? { buriedCards } : { buriedCards: undefined }) };
            });
            // 弃牌堆出牌：追踪已使用的能力 sourceId（用于每回合限制）
            const newUsedAbilities = fromDiscard && discardPlaySourceId
                ? [...(player.usedDiscardPlayAbilities ?? []), discardPlaySourceId]
                : player.usedDiscardPlayAbilities;
            // consumesNormalLimit=false 时不消耗正常额度（忍者 special 额外打出、弃牌堆额外出牌等）
            const shouldIncrementPlayed = consumesNormalLimit !== false;
            const quotaResolution = (() => {
                const baseQuota = player.baseLimitedMinionQuota?.[resolvedBaseIndex] ?? 0;
                const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
                const baseDef = getBaseDef(state.bases[resolvedBaseIndex]?.defId);
                const baseHasPowerRestrictedQuota = baseDef?.restrictions?.some(
                    restriction => restriction.type === 'play_minion'
                        && restriction.condition?.extraPlayMinionPowerMax !== undefined,
                ) ?? false;
                const remainingBasePowerCaps = getRemainingBaseLimitedPowerLimitedMinionQuotas(player, resolvedBaseIndex);
                const canUseBaseQuota = shouldIncrementPlayed
                    && canUseBaseLimitedMinionQuota(state, player, resolvedBaseIndex, defId, power);
                const canUseSameNameQuota = shouldIncrementPlayed
                    && canUseSameNameMinionQuota(player, defId);
                const matchingBasePowerQuota = shouldIncrementPlayed
                    ? getBestMatchingBaseLimitedPowerQuota(player, resolvedBaseIndex, power)
                    : undefined;
                const matchingGlobalPowerQuota = shouldIncrementPlayed
                    ? getBestMatchingGlobalPowerLimitedQuota(player, power)
                    : undefined;
                const useRestrictedBaseQuota = canUseBaseQuota
                    && (
                        player.baseLimitedSameNameRequired?.[resolvedBaseIndex] === true
                        || baseHasPowerRestrictedQuota
                        || matchingBasePowerQuota !== undefined
                    );
                const useSameNameQuota = !useRestrictedBaseQuota && canUseSameNameQuota;
                const useGlobalPowerQuota = !useRestrictedBaseQuota
                    && !useSameNameQuota
                    && matchingGlobalPowerQuota !== undefined;
                const useBaseQuota = !useRestrictedBaseQuota
                    && !useSameNameQuota
                    && !useGlobalPowerQuota
                    && canUseBaseQuota;
                const remainingGlobalPowerCaps = getRemainingGlobalPowerLimitedMinionQuotas(player);
                const unrestrictedGlobalQuotaRemaining = shouldIncrementPlayed
                    ? getRemainingUnrestrictedGlobalMinionQuota(player)
                    : 0;

                let newBaseLimitedMinionQuota = player.baseLimitedMinionQuota;
                let newBaseLimitedMinionPowerCaps = player.baseLimitedMinionPowerCaps;
                let newSameNameRemaining = player.sameNameMinionRemaining;
                let newSameNameDefId = player.sameNameMinionDefId;
                let newExtraMinionPowerCaps = remainingGlobalPowerCaps;
                let finalMinionsPlayed = player.minionsPlayed;

                if (useRestrictedBaseQuota || useBaseQuota) {
                    newBaseLimitedMinionQuota = {
                        ...player.baseLimitedMinionQuota,
                        [resolvedBaseIndex]: baseQuota - 1,
                    };
                    if (matchingBasePowerQuota !== undefined && remainingBasePowerCaps.length > 0) {
                        const removeIndex = remainingBasePowerCaps.findIndex(powerCap => powerCap === matchingBasePowerQuota);
                        const nextBasePowerCaps = removeIndex >= 0
                            ? [
                                ...remainingBasePowerCaps.slice(0, removeIndex),
                                ...remainingBasePowerCaps.slice(removeIndex + 1),
                            ]
                            : remainingBasePowerCaps;
                        const nextMap = { ...(player.baseLimitedMinionPowerCaps ?? {}) };
                        if (nextBasePowerCaps.length > 0) {
                            nextMap[resolvedBaseIndex] = nextBasePowerCaps;
                        } else {
                            delete nextMap[resolvedBaseIndex];
                        }
                        newBaseLimitedMinionPowerCaps = Object.keys(nextMap).length > 0 ? nextMap : undefined;
                    }
                } else if (useSameNameQuota) {
                    newSameNameRemaining = sameNameRemaining - 1;
                    if (newSameNameDefId === null || newSameNameDefId === undefined) {
                        newSameNameDefId = defId;
                    }
                } else if (useGlobalPowerQuota) {
                    finalMinionsPlayed = player.minionsPlayed + 1;
                    const quotaIndex = newExtraMinionPowerCaps.findIndex(powerCap => powerCap === matchingGlobalPowerQuota);
                    if (quotaIndex >= 0) {
                        newExtraMinionPowerCaps = [
                            ...newExtraMinionPowerCaps.slice(0, quotaIndex),
                            ...newExtraMinionPowerCaps.slice(quotaIndex + 1),
                        ];
                    }
                } else if (shouldIncrementPlayed && (unrestrictedGlobalQuotaRemaining > 0 || player.minionsPlayed < player.minionLimit)) {
                    finalMinionsPlayed = player.minionsPlayed + 1;
                }

                return {
                    minionsPlayed: finalMinionsPlayed,
                    baseLimitedMinionQuota: newBaseLimitedMinionQuota,
                    baseLimitedMinionPowerCaps: newBaseLimitedMinionPowerCaps,
                    sameNameMinionRemaining: newSameNameRemaining,
                    sameNameMinionDefId: newSameNameDefId,
                    extraMinionPowerCaps: newExtraMinionPowerCaps.length > 0 ? newExtraMinionPowerCaps : undefined,
                    extraMinionPowerMax: newExtraMinionPowerCaps.length > 0
                        ? Math.min(...newExtraMinionPowerCaps)
                        : undefined,
                };
            })();

            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: newHand,
                        discard: newDiscard,
                        deck: newDeck,
                        minionsPlayed: quotaResolution.minionsPlayed,
                        minionsPlayedPerBase: {
                            ...(player.minionsPlayedPerBase ?? {}),
                            [resolvedBaseIndex]: ((player.minionsPlayedPerBase ?? {})[resolvedBaseIndex] ?? 0) + 1,
                        },
                        usedDiscardPlayAbilities: newUsedAbilities,
                        baseLimitedMinionQuota: quotaResolution.baseLimitedMinionQuota,
                        baseLimitedMinionPowerCaps: quotaResolution.baseLimitedMinionPowerCaps,
                        extraMinionPowerCaps: quotaResolution.extraMinionPowerCaps,
                        extraMinionPowerMax: quotaResolution.extraMinionPowerMax,
                        sameNameMinionRemaining: quotaResolution.sameNameMinionRemaining,
                        sameNameMinionDefId: quotaResolution.sameNameMinionDefId,
                    },
                },
                bases: newBases,
                cardsPlayedThisTurn: (state.cardsPlayedThisTurn ?? 0) + 1,
            };
        }

        case SU_EVENTS.ACTION_PLAYED: {
            const { playerId, cardUid, isExtraAction, fromBuried } = event.payload as any;
            const player = state.players[playerId];
            const card = player.hand.find(c => c.uid === cardUid);
            const buriedLookup = (() => {
                if (!fromBuried) return undefined;
                for (let i = 0; i < state.bases.length; i++) {
                    const b = state.bases[i];
                    const bc = (b.buriedCards ?? []).find(x => x.uid === cardUid);
                    if (bc) return { baseIndex: i, buried: bc };
                }
                return undefined;
            })();
            const defId = card?.defId ?? buriedLookup?.buried.defId;
            const def = defId ? getCardDef(defId) : undefined;
            const isOngoing = def && def.type === 'action' && (def as ActionCardDef).subtype === 'ongoing';
            const isSpecial = def && def.type === 'action' && (def as ActionCardDef).subtype === 'special';

            const newHand = fromBuried ? player.hand : player.hand.filter(c => c.uid !== cardUid);
            // ongoing 行动卡不进弃牌堆（由 ONGOING_ATTACHED 处理）
            const movedCard: CardInstance | undefined = card ?? (buriedLookup ? {
                uid: buriedLookup.buried.uid,
                defId: buriedLookup.buried.defId,
                type: (getCardDef(buriedLookup.buried.defId)?.type === 'minion' ? 'minion' : 'action') as any,
                owner: buriedLookup.buried.trueOwnerId,
            } : undefined);
            const newDiscard = movedCard && !isOngoing ? [...player.discard, movedCard] : player.discard;
            const newBases = fromBuried && buriedLookup
                ? state.bases.map((b, i) => i !== buriedLookup.baseIndex ? b : ({
                    ...b,
                    buriedCards: (b.buriedCards ?? []).filter(x => x.uid !== cardUid),
                }))
                : state.bases;
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: newHand,
                        discard: newDiscard,
                        // Special 卡和额外行动不消耗行动额度
                        actionsPlayed: (isSpecial || isExtraAction) ? player.actionsPlayed : player.actionsPlayed + 1,
                    },
                },
                cardsPlayedThisTurn: (state.cardsPlayedThisTurn ?? 0) + 1,
                ...(newBases !== state.bases ? { bases: newBases } : {}),
            };
        }

        case SU_EVENTS.TITAN_PLAYED: {
            const {
                titanUid,
                ownerId,
                controllerId,
                baseIndex,
                baseDefId,
                consumesRegularPlayKind,
                consumesRegularPlayKinds,
            } = (event as TitanPlayedEvent).payload;
            const resolvedBaseIndex = resolveLiveBaseIndex(state, baseIndex, baseDefId) ?? baseIndex;
            const titans = state.titans ?? [];
            const titanIndex = titans.findIndex(titan => titan.uid === titanUid);
            if (titanIndex === -1) return state;
            const player = state.players[controllerId];
            if (!player) return state;
            const consumedKinds = new Set(
                [
                    ...(consumesRegularPlayKinds ?? []),
                    ...(consumesRegularPlayKind ? [consumesRegularPlayKind] : []),
                ],
            );

            const nextTitans = [...titans];
            nextTitans[titanIndex] = {
                ...nextTitans[titanIndex],
                ownerId,
                controllerId,
                talentUsed: false,
                location: {
                    zone: 'base',
                    baseIndex: resolvedBaseIndex,
                    enteredAt: event.timestamp ?? 0,
                },
            };
            return {
                ...state,
                players: {
                    ...state.players,
                    [controllerId]: {
                        ...player,
                        minionsPlayed: consumedKinds.has('minion') ? player.minionsPlayed + 1 : player.minionsPlayed,
                        actionsPlayed: consumedKinds.has('action') ? player.actionsPlayed + 1 : player.actionsPlayed,
                    },
                },
                titans: nextTitans,
                cardsPlayedThisTurn: (state.cardsPlayedThisTurn ?? 0) + 1,
            };
        }

        case SU_EVENTS.TITAN_MOVED: {
            const { titanUid, toBaseIndex, toBaseDefId } = (event as TitanMovedEvent).payload;
            const resolvedBaseIndex = resolveLiveBaseIndex(state, toBaseIndex, toBaseDefId) ?? toBaseIndex;
            const titans = state.titans ?? [];
            const titanIndex = titans.findIndex(titan => titan.uid === titanUid);
            if (titanIndex === -1) return state;
            const titan = titans[titanIndex];
            if (titan.location.zone !== 'base') return state;

            const nextTitans = [...titans];
            nextTitans[titanIndex] = {
                ...titan,
                location: {
                    zone: 'base',
                    baseIndex: resolvedBaseIndex,
                    enteredAt: titan.location.enteredAt,
                },
            };
            return {
                ...state,
                titans: nextTitans,
                titanMovedTurnByTitanUid: {
                    ...(state.titanMovedTurnByTitanUid ?? {}),
                    [titanUid]: state.turnNumber,
                },
            };
        }

        case SU_EVENTS.TITAN_REMOVED_FROM_PLAY: {
            const { titanUid } = (event as TitanRemovedFromPlayEvent).payload;
            const titans = state.titans ?? [];
            const titanIndex = titans.findIndex(titan => titan.uid === titanUid);
            if (titanIndex === -1) return state;
            const titan = titans[titanIndex];
            const nextTitans = [...titans];
            nextTitans[titanIndex] = {
                ...titan,
                controllerId: titan.ownerId,
                powerCounters: 0,
                talentUsed: false,
                metadata: undefined,
                location: { zone: 'setaside' },
            };
            return { ...state, titans: nextTitans };
        }

        case SU_EVENTS.TITAN_POWER_COUNTER_ADDED: {
            const { titanUid, amount, reason } = (event as TitanPowerCounterAddedEvent).payload;
            if (amount <= 0) return state;
            const titans = state.titans ?? [];
            const titanIndex = titans.findIndex(titan => titan.uid === titanUid);
            if (titanIndex === -1) return state;
            const nextTitans = [...titans];
            nextTitans[titanIndex] = {
                ...nextTitans[titanIndex],
                powerCounters: nextTitans[titanIndex].powerCounters + amount,
            };
            return {
                ...state,
                titans: nextTitans,
                ...(reason === 'super_spies_moon_zero_three_on_deck_inspected'
                    ? {
                        moonZeroThreeTriggeredTurnByTitan: {
                            ...(state.moonZeroThreeTriggeredTurnByTitan ?? {}),
                            [titanUid]: state.turnNumber,
                        },
                    }
                    : {}),
                ...(reason === 'itty_critters_rainboroc'
                    ? {
                        rainborocTriggeredTurnByTitan: {
                            ...(state.rainborocTriggeredTurnByTitan ?? {}),
                            [titanUid]: state.turnNumber,
                        },
                    }
                    : {}),
            };
        }

        case SU_EVENTS.TITAN_POWER_COUNTER_REMOVED: {
            const { titanUid, amount } = (event as TitanPowerCounterRemovedEvent).payload;
            if (amount <= 0) return state;
            const titans = state.titans ?? [];
            const titanIndex = titans.findIndex(titan => titan.uid === titanUid);
            if (titanIndex === -1) return state;
            const nextTitans = [...titans];
            nextTitans[titanIndex] = {
                ...nextTitans[titanIndex],
                powerCounters: Math.max(0, nextTitans[titanIndex].powerCounters - amount),
            };
            return { ...state, titans: nextTitans };
        }

        case SU_EVENTS.TITAN_ONGOING_SUPPRESSED: {
            const { titanUid } = (event as any).payload;
            const prev = state.titanOngoingSuppressedUntilTurnEnd ?? [];
            if (prev.includes(titanUid)) return state;
            return {
                ...state,
                titanOngoingSuppressedUntilTurnEnd: [...prev, titanUid],
            };
        }

        case SU_EVENTS.CARD_BURIED: {
            const { playerId, cardUid, defId, baseIndex, trueOwnerId, buriedFrom } = event.payload as any;
            const player = state.players[playerId];
            const existsInHand = player.hand.some(c => c.uid === cardUid);
            const existsInDiscard = player.discard.some(c => c.uid === cardUid);
            const newHand = buriedFrom === 'hand' ? player.hand.filter(c => c.uid !== cardUid) : player.hand;
            const newDiscard = buriedFrom === 'discard' ? player.discard.filter(c => c.uid === cardUid ? false : true) : player.discard;
            const newDeck = buriedFrom === 'deck' ? player.deck.filter(c => c.uid !== cardUid) : player.deck;
            let updatedPlayers = {
                ...state.players,
                [playerId]: { ...player, hand: newHand, discard: newDiscard, deck: newDeck },
            };
            let updatedBases = state.bases;
            if (buriedFrom === 'hand' && !existsInHand) return state;
            if (buriedFrom === 'discard' && !existsInDiscard) return state;
            if (buriedFrom === 'deck' && !player.deck.some(c => c.uid === cardUid)) return state;
            if (buriedFrom === 'play') {
                const discardOwner = updatedPlayers[playerId];
                const discardIndex = discardOwner.discard.findIndex(card => card.uid === cardUid);
                if (discardIndex >= 0) {
                    updatedPlayers = {
                        ...updatedPlayers,
                        [playerId]: {
                            ...discardOwner,
                            discard: discardOwner.discard.filter(card => card.uid !== cardUid),
                        },
                    };
                }

                updatedBases = state.bases.map((base) => {
                    const minion = base.minions.find(entry => entry.uid === cardUid);
                    if (minion) {
                        let detachedPlayers = updatedPlayers;
                        for (const attached of minion.attachedActions ?? []) {
                            const attachedOwner = detachedPlayers[attached.ownerId];
                            if (!attachedOwner) continue;
                            detachedPlayers = {
                                ...detachedPlayers,
                                [attached.ownerId]: {
                                    ...attachedOwner,
                                    discard: [
                                        ...attachedOwner.discard,
                                        { uid: attached.uid, defId: attached.defId, type: 'action', owner: attached.ownerId },
                                    ],
                                },
                            };
                        }
                        updatedPlayers = detachedPlayers;
                        return {
                            ...base,
                            minions: base.minions.filter(entry => entry.uid !== cardUid),
                        };
                    }

                    const ongoing = base.ongoingActions.find(entry => entry.uid === cardUid);
                    if (ongoing) {
                        return {
                            ...base,
                            ongoingActions: base.ongoingActions.filter(entry => entry.uid !== cardUid),
                        };
                    }

                    let attachedRemoved = false;
                    const minions = base.minions.map((entry) => {
                        const hasAttached = entry.attachedActions?.some(action => action.uid === cardUid) ?? false;
                        if (!hasAttached) return entry;
                        attachedRemoved = true;
                        return {
                            ...entry,
                            attachedActions: entry.attachedActions.filter(action => action.uid !== cardUid),
                        };
                    });
                    return attachedRemoved ? { ...base, minions } : base;
                });
            }
            const buriedEntry = { uid: cardUid, defId, trueOwnerId, controllerId: playerId, buriedFrom } as any;
            const newBases = updatedBases.map((b, i) => i !== baseIndex ? b : ({
                ...b,
                buriedCards: [...(b.buriedCards ?? []), buriedEntry],
            }));
            return {
                ...state,
                players: updatedPlayers,
                bases: newBases,
            };
        }

        case SU_EVENTS.BURIED_CARD_UNCOVERED: {
            const { cardUid, baseIndex, discardWithoutPlay } = event.payload as any;
            if (!discardWithoutPlay) return state;
            const base = state.bases[baseIndex];
            const buried = (base?.buriedCards ?? []).find((card) => card.uid === cardUid);
            if (!base || !buried) return state;
            const owner = state.players[buried.trueOwnerId];
            if (!owner) return state;
            const returned: CardInstance = {
                uid: buried.uid,
                defId: buried.defId,
                type: (getCardDef(buried.defId)?.type === 'minion' ? 'minion' : 'action') as any,
                owner: buried.trueOwnerId,
            };
            return {
                ...state,
                players: {
                    ...state.players,
                    [buried.trueOwnerId]: {
                        ...owner,
                        discard: [...owner.discard, returned],
                    },
                },
                bases: state.bases.map((entry, index) => index !== baseIndex ? entry : ({
                    ...entry,
                    buriedCards: (entry.buriedCards ?? []).filter((card) => card.uid !== cardUid),
                })),
            };
        }

        case SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND: {
            const { playerId, cardUid, baseIndex } = event.payload as any;
            const base = state.bases[baseIndex];
            const buried = (base?.buriedCards ?? []).find((card) => card.uid === cardUid);
            if (!base || !buried) return state;
            const owner = state.players[playerId];
            if (!owner) return state;

            const returned: CardInstance = {
                uid: buried.uid,
                defId: buried.defId,
                type: (getCardDef(buried.defId)?.type === 'minion' ? 'minion' : 'action') as CardType,
                owner: buried.trueOwnerId,
            };

            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...owner,
                        hand: [...owner.hand, returned],
                    },
                },
                bases: state.bases.map((entry, index) => index !== baseIndex ? entry : ({
                    ...entry,
                    buriedCards: (entry.buriedCards ?? []).filter((card) => card.uid !== cardUid),
                })),
            };
        }

        case SU_EVENTS.BURIED_CARDS_DISCARDED_WITH_BASE: {
            const { baseIndex } = event.payload as any;
            const base = state.bases[baseIndex];
            if (!base || !base.buriedCards || base.buriedCards.length === 0) return state;
            let newPlayers = { ...state.players };
            for (const bc of base.buriedCards) {
                const owner = newPlayers[bc.trueOwnerId];
                if (!owner) continue;
                const returned: CardInstance = {
                    uid: bc.uid,
                    defId: bc.defId,
                    type: (getCardDef(bc.defId)?.type === 'minion' ? 'minion' : 'action') as any,
                    owner: bc.trueOwnerId,
                };
                newPlayers = {
                    ...newPlayers,
                    [bc.trueOwnerId]: { ...owner, discard: [...owner.discard, returned] },
                };
            }
            const newBases = state.bases.map((b, i) => i !== baseIndex ? b : ({ ...b, buriedCards: undefined }));
            return { ...state, players: newPlayers, bases: newBases };
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
            const titans = state.titans ?? [];
            const newBaseDiscard = [...(state.baseDiscard ?? []), scoredBase.defId];

            // 埋葬卡：基地离场时翻开弃置到真正所有者弃牌堆（不触发能力）
            if (scoredBase.buriedCards && scoredBase.buriedCards.length > 0) {
                for (const bc of scoredBase.buriedCards) {
                    const owner = newPlayers[bc.trueOwnerId];
                    if (!owner) continue;
                    const returned: CardInstance = {
                        uid: bc.uid,
                        defId: bc.defId,
                        type: (getCardDef(bc.defId)?.type === 'minion' ? 'minion' : 'action') as any,
                        owner: bc.trueOwnerId,
                    };
                    newPlayers = {
                        ...newPlayers,
                        [bc.trueOwnerId]: { ...owner, discard: [...owner.discard, returned] },
                    };
                }
            }

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
            const newTitans = titans.map(titan => {
                if (titan.location.zone !== 'base') return titan;
                if (titan.location.baseIndex === baseIndex) {
                    return {
                        ...titan,
                        controllerId: titan.ownerId,
                        powerCounters: 0,
                        talentUsed: false,
                        metadata: undefined,
                        location: { zone: 'setaside' } as const,
                    };
                }
                if (titan.location.baseIndex > baseIndex) {
                    return {
                        ...titan,
                        location: {
                            ...titan.location,
                            baseIndex: titan.location.baseIndex - 1,
                        },
                    };
                }
                return titan;
            });
            // 从锁定的 eligible 列表中移除已计分的基地索引，并调整后续索引（因 bases 数组收缩）
            const prevEligible = state.scoringEligibleBaseIndices;
            const newEligible = prevEligible
                ? prevEligible
                    .filter(i => i !== baseIndex)
                    .map(i => i > baseIndex ? i - 1 : i)
                : undefined;
            return {
                ...state,
                players: newPlayers,
                bases: newBases,
                titans: newTitans,
                baseDiscard: newBaseDiscard,
                scoringEligibleBaseIndices: newEligible?.length ? newEligible : undefined,
            };
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
            // 只允许从手牌弃置（deck → discard 请使用 CARDS_MILLED）
            const discardedFromHand = player.hand.filter(c => uidSet.has(c.uid));
            const remainingHand = player.hand.filter(c => !uidSet.has(c.uid));
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: remainingHand,
                        discard: [...player.discard, ...discardedFromHand],
                    },
                },
            };
        }

        case SU_EVENTS.CARDS_MILLED: {
            const { playerId, cardUids } = event.payload as { playerId: PlayerId; cardUids: string[] };
            const player = state.players[playerId];
            const uidSet = new Set(cardUids);
            const milledFromDeck = player.deck.filter(c => uidSet.has(c.uid));
            const remainingDeck = player.deck.filter(c => !uidSet.has(c.uid));
            if (milledFromDeck.length === 0) return state;
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        deck: remainingDeck,
                        discard: [...player.discard, ...milledFromDeck],
                    },
                },
            };
        }

        case SU_EVENTS.TRIGGER_QUEUED: {
            const { triggers } = (event as TriggerQueuedEvent).payload;
            if (!Array.isArray(triggers) || triggers.length === 0) return state;
            const prev = state.triggerQueue ?? [];
            const seenIds = new Set(prev.map(t => t.id));
            const deduped = triggers.filter(trigger => {
                if (!trigger?.id || seenIds.has(trigger.id)) return false;
                seenIds.add(trigger.id);
                return true;
            });
            if (deduped.length === 0) return state;
            return {
                ...state,
                triggerQueue: [...prev, ...deduped],
            };
        }

        case SU_EVENTS.TRIGGER_CONSUMED: {
            const { triggerId } = (event as TriggerConsumedEvent).payload;
            const prev = state.triggerQueue ?? [];
            if (!triggerId || prev.length === 0) return state;
            const consumed = prev.find(t => t.id === triggerId);
            const next = prev.filter(t => {
                if (t.id === triggerId) return false;
                if (
                    consumed?.sourceDefId === 'explorers_very_large_boulder'
                    && consumed.timing === 'onMinionMoved'
                    && consumed.sourceControllerId
                ) {
                    return !(
                        t.sourceDefId === consumed.sourceDefId
                        && t.timing === consumed.timing
                        && t.sourceControllerId === consumed.sourceControllerId
                    );
                }
                return true;
            });
            const consumedBoulder = (
                consumed?.sourceDefId === 'explorers_very_large_boulder'
                && consumed.timing === 'onMinionMoved'
                && consumed.sourceControllerId
            )
                ? (state.titans ?? []).find(titan =>
                    titan.defId === 'explorers_very_large_boulder'
                    && titan.controllerId === consumed.sourceControllerId
                    && titan.location.zone === 'base',
                )
                : undefined;
            return {
                ...state,
                triggerQueue: next.length ? next : undefined,
                ...(consumedBoulder
                    ? {
                        veryLargeBoulderTriggeredTurnByTitan: {
                            ...(state.veryLargeBoulderTriggeredTurnByTitan ?? {}),
                            [consumedBoulder.uid]: state.turnNumber,
                        },
                    }
                    : {}),
            };
        }

        case SU_EVENTS.CARD_REMOVED_FROM_DECK: {
            const { playerId, cardUid } = event.payload;
            const player = state.players[playerId];
            if (!player.deck.some(card => card.uid === cardUid)) return state;
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        deck: player.deck.filter(card => card.uid !== cardUid),
                    },
                },
            };
        }

        case SU_EVENTS.CARD_REMOVED_FROM_GAME: {
            const { playerId, cardUid, defId } = event.payload;
            const player = state.players[playerId];
            if (!player) return state;

            // 1) 先从玩家区域移除（hand/deck/discard）
            let found: CardInstance | undefined;
            const removeFrom = (cards: CardInstance[]): CardInstance[] => {
                const idx = cards.findIndex(c => c.uid === cardUid);
                if (idx === -1) return cards;
                if (!found) found = cards[idx];
                return [...cards.slice(0, idx), ...cards.slice(idx + 1)];
            };

            const newHand = removeFrom(player.hand);
            const newDeck = removeFrom(player.deck);
            const newDiscard = removeFrom(player.discard);

            // 2) 再从场上持续牌/附着牌移除（不触发“弃牌”语义，直接消失）
            let removedFromBoard = false;
            const newBases = state.bases.map(base => {
                const hasOngoing = base.ongoingActions.some(o => o.uid === cardUid);
                const hasAttachment = base.minions.some(m => m.attachedActions.some(a => a.uid === cardUid));
                if (!hasOngoing && !hasAttachment) return base;

                removedFromBoard = true;
                const nextOngoing = hasOngoing ? base.ongoingActions.filter(o => o.uid !== cardUid) : base.ongoingActions;
                const nextMinions = hasAttachment
                    ? base.minions.map(m => {
                          if (!m.attachedActions.some(a => a.uid === cardUid)) return m;
                          return { ...m, attachedActions: m.attachedActions.filter(a => a.uid !== cardUid) };
                      })
                    : base.minions;

                return { ...base, ongoingActions: nextOngoing, minions: nextMinions };
            });

            // 找不到卡：无变化（避免把不存在的 uid 强行塞进 removedFromGame）
            if (!found && !removedFromBoard) return state;

            const def = getCardDef(defId);
            const removed: CardInstance =
                found ??
                ({
                    uid: cardUid,
                    defId,
                    type: def?.type ?? 'action',
                    owner: playerId,
                } satisfies CardInstance);

            const prevRemoved = player.removedFromGame ?? [];
            return {
                ...state,
                bases: newBases,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        hand: newHand,
                        deck: newDeck,
                        discard: newDiscard,
                        removedFromGame: [...prevRemoved, removed],
                    },
                },
            };
        }

        case SU_EVENTS.STAKEOUT_POD_BLOCK_ADDED: {
            const { baseIndex, ownerId, expiresOnTurnNumber } = event.payload as any;
            const prev = state.stakeoutPodBlocks ?? [];
            const next = [...prev, { baseIndex, ownerId, expiresOnTurnNumber }];
            return { ...state, stakeoutPodBlocks: next };
        }

        case SU_EVENTS.CARD_BOXED: {
            const { playerId, cardUid, from } = (event as CardBoxedEvent).payload;
            const player = state.players[playerId];
            if (!player) return state;

            const zone = player[from];
            const boxedCard = zone.find(card => card.uid === cardUid);
            if (!boxedCard) return state;

            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        [from]: zone.filter(card => card.uid !== cardUid),
                        removedFromGame: [...(player.removedFromGame ?? []), boxedCard],
                    },
                },
            };
        }

        case SU_EVENTS.TURN_STARTED: {
            const { playerId, turnNumber } = event.payload;
            const expiredTimedPowerModifiers = (state.timedPowerModifiers ?? []).filter(
                modifier => turnNumber >= modifier.expiresOnTurnNumber,
            );
            const timedPowerReverts = new Map<string, number>();
            for (const modifier of expiredTimedPowerModifiers) {
                timedPowerReverts.set(
                    modifier.minionUid,
                    (timedPowerReverts.get(modifier.minionUid) ?? 0) - modifier.amount,
                );
            }

            // 重置天赋使用状态 + 清零临时力量修正（随从 + ongoing 行动卡）
            const newBases = state.bases.map(base => ({
                ...base,
                minions: base.minions.map(m => ({
                    ...m,
                    powerCounters: m.powerCounters,  // 显式保留力量指示物（独立实体）
                    powerModifier: m.powerModifier + (timedPowerReverts.get(m.uid) ?? 0),
                    talentUsed: m.controller === playerId ? false : m.talentUsed,
                    playedThisTurn: m.controller === playerId ? undefined : m.playedThisTurn,
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
            const newTitans = (state.titans ?? []).map(titan => ({
                ...titan,
                talentUsed: titan.controllerId === playerId ? false : titan.talentUsed,
            }));
            const remainingPlayerRestrictions = state.playerRestrictionsUntilTurnStart?.filter(
                entry => entry.sourcePlayerId !== playerId,
            );
            // 检查沉睡印记 / 睡眠印记 POD：被限制打出战术的玩家本回合 actionLimit 设为 0
            const isSleepMarked = state.sleepMarkedPlayers?.includes(playerId);
            const isActionRestricted = remainingPlayerRestrictions?.some(
                entry => entry.targetPlayerId === playerId && entry.restrictionType === 'play_action',
            ) ?? false;
            const newActionLimit = (isSleepMarked || isActionRestricted) ? 0 : 1;

            // Smash Up 的 each turn 以“当前玩家回合”为单位。
            // 因此每个玩家回合开始时，都要清空全体玩家在各基地的本回合出牌计数，
            // 否则会把“当前回合内基地全局首次”错误拉长成整轮。
            const newPlayers: Record<PlayerId, SmashUpPlayer> = {};
            for (const pid of Object.keys(state.players)) {
                const current = state.players[pid];
                if (pid === playerId) {
                    newPlayers[pid] = {
                        ...current,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: newActionLimit,
                        minionsPlayedPerBase: undefined,
                        usedDiscardPlayAbilities: undefined,
                        baseLimitedMinionQuota: undefined,
                        baseLimitedMinionPowerCaps: undefined,
                        baseLimitedSameNameRequired: undefined,
                        extraMinionPowerCaps: undefined,
                        extraMinionPowerMax: undefined,
                        sameNameMinionRemaining: undefined,
                        sameNameMinionDefId: null,
                        pendingMinionPlayEffects: undefined,
                        extraTalentUsesConsumed: undefined,
                    };
                    continue;
                }

                newPlayers[pid] = {
                    ...current,
                    minionsPlayedPerBase: undefined,
                };
            }

            return {
                ...state,
                turnNumber,
                bases: newBases,
                titans: newTitans,
                // 清空本回合消灭记录
                turnDestroyedMinions: [],
                cardsPlayedThisTurn: 0,
                powerCountersPlacedOnMinionsThisTurn: 0,
                destroyedMinionByPlayersThisTurn: undefined,
                basePowerDecreasedPlayersThisTurn: undefined,
                stakeoutPodBlocks: (() => {
                    const remaining = (state.stakeoutPodBlocks ?? []).filter(b => turnNumber < b.expiresOnTurnNumber);
                    return remaining.length ? remaining : undefined;
                })(),
                timedPowerModifiers: (() => {
                    const remaining = (state.timedPowerModifiers ?? []).filter(
                        modifier => turnNumber < modifier.expiresOnTurnNumber,
                    );
                    return remaining.length ? remaining : undefined;
                })(),
                titanOngoingSuppressedUntilTurnEnd: undefined,
                moonZeroThreeTriggeredTurnByTitan: undefined,
                veryLargeBoulderTriggeredTurnByTitan: undefined,
                // 清空本回合移动追踪
                minionsMovedToBaseThisTurn: undefined,
                movedToBasesThisTurn: undefined,
                // 清空海盗 POD：私掠者每回合一次追踪
                buccaneerPodUsedUids: undefined,
                // 清空临时临界点修正
                tempBreakpointModifiers: undefined,
                // 清理“直到本回合开始”的基地压制（仅清除由当前回合玩家施加的条目）
                suppressedBasesUntilTurnStart: (() => {
                    const remaining = (state.suppressedBasesUntilTurnStart ?? [])
                        .filter(s => s.suppressorPlayerId !== playerId);
                    return remaining.length ? remaining : undefined;
                })(),
                suppressedCardsUntilTurnStart: (() => {
                    const remaining = (state.suppressedCardsUntilTurnStart ?? [])
                        .filter(s => s.suppressorPlayerId !== playerId);
                    return remaining.length ? remaining : undefined;
                })(),
                // 清空 special 能力限制组使用记录
                specialLimitUsed: undefined,
                // 清空巨石阵双才能追踪
                standingStonesDoubleTalentMinionUid: undefined,
                // 清空计分后延迟 special 记录
                pendingAfterScoringSpecials: undefined,
                // 清空计分后等待基地替换完成的动作
                pendingPostScoringActions: undefined,
                // 清空计分阶段锁定的 eligible 基地列表
                scoringEligibleBaseIndices: undefined,
                // 清空本回合已使用的持续行动 UID 追踪
                turnUsedOngoingUids: undefined,
                usedBaseAbilitiesThisTurn: (() => {
                    const remaining = (state.usedBaseAbilitiesThisTurn ?? []).filter(entry => entry.playerId !== playerId);
                    return remaining.length > 0 ? remaining : undefined;
                })(),
                activeDuel: undefined,
                sleepMarkedPlayers: state.sleepMarkedPlayers,
                playerRestrictionsUntilTurnStart: remainingPlayerRestrictions?.length
                    ? remainingPlayerRestrictions
                    : undefined,
                players: newPlayers,
            };
        }

        case SU_EVENTS.TURN_ENDED: {
            const { playerId, nextPlayerIndex } = event.payload;
            const remainingSleepMarked = state.sleepMarkedPlayers?.filter(pid => pid !== playerId);
            return {
                ...state,
                currentPlayerIndex: nextPlayerIndex,
                sleepMarkedPlayers: remainingSleepMarked?.length ? remainingSleepMarked : undefined,
                titanOngoingSuppressedUntilTurnEnd: undefined,
                activeDuel: undefined,
            };
        }

        case SU_EVENTS.BASE_REPLACED: {
            const { baseIndex, oldBaseDefId, newBaseDefId, keepCards } = (event as BaseReplacedEvent).payload;
            // ✅ 修复：使用 indexOf + slice 移除第一个匹配的基地，而不是 filter
            // 原因：filter 会移除所有匹配的基地，如果 baseDeck 中有重复基地会出错
            // 而且 scoreOneBase 中已经用 slice(1) 移除了第一个基地，这里应该保持一致
            // 但是 reduce 是基于事件的，不应该依赖 scoreOneBase 的返回值
            // 所以这里需要找到 newBaseDefId 在 baseDeck 中的索引，然后移除它
            const baseDefIdIndex = state.baseDeck.indexOf(newBaseDefId);
            if (baseDefIdIndex < 0) {
                console.warn(`[BASE_REPLACED] newBaseDefId ${newBaseDefId} not found in baseDeck`, {
                    baseDeck: state.baseDeck,
                    baseIndex,
                    oldBaseDefId,
                    newBaseDefId,
                });
            }
            const newBaseDeck = baseDefIdIndex >= 0
                ? [...state.baseDeck.slice(0, baseDefIdIndex), ...state.baseDeck.slice(baseDefIdIndex + 1)]
                : state.baseDeck;
            
            // ✅ 修复：清除被替换基地的触发标记
            // 原因：基地替换后，新基地不应该继承旧基地的"已触发"状态
            // 否则新基地达到 breakpoint 时会被跳过，无法计分
            const cleanedBeforeScoring = (state.beforeScoringTriggeredBases ?? [])
                .filter(idx => idx !== baseIndex);
            const cleanedWhenScoring = (state.whenScoringTriggeredBases ?? [])
                .filter(idx => idx !== baseIndex);
            const cleanedAfterScoring = (state.afterScoringTriggeredBases ?? [])
                .filter(idx => idx !== baseIndex);
            
            // keepCards 模式：仅替换 defId，保留随从和 ongoing，旧 defId 回牌库
            if (keepCards) {
                const updatedBases = state.bases.map((base, i) => {
                    if (i !== baseIndex) return base;
                    return { ...base, defId: newBaseDefId };
                });
                return {
                    ...state,
                    bases: updatedBases,
                    baseDeck: [...newBaseDeck, oldBaseDefId],
                    beforeScoringTriggeredBases: cleanedBeforeScoring.length > 0 ? cleanedBeforeScoring : undefined,
                    whenScoringTriggeredBases: cleanedWhenScoring.length > 0 ? cleanedWhenScoring : undefined,
                    afterScoringTriggeredBases: cleanedAfterScoring.length > 0 ? cleanedAfterScoring : undefined,
                };
            }
            // 默认模式：插入新空基地（配合 BASE_SCORED 删除旧基地后使用）
            const newBase: BaseInPlay = {
                defId: newBaseDefId,
                minions: [],
                ongoingActions: [],
            };
            const newBases = [...state.bases];
            newBases.splice(baseIndex, 0, newBase);
            const adjustedTitans = (state.titans ?? []).map(titan => {
                if (titan.location.zone !== 'base') return titan;
                if (titan.location.baseIndex >= baseIndex) {
                    return {
                        ...titan,
                        location: {
                            ...titan.location,
                            baseIndex: titan.location.baseIndex + 1,
                        },
                    };
                }
                return titan;
            });
            // 插入基地后，eligible 列表中 >= baseIndex 的索引需要 +1（数组扩张）
            const prevEligible = state.scoringEligibleBaseIndices;
            const adjustedEligible = prevEligible
                ? prevEligible.map(i => i >= baseIndex ? i + 1 : i)
                : undefined;
            return {
                ...state,
                bases: newBases,
                titans: adjustedTitans,
                baseDeck: newBaseDeck,
                beforeScoringTriggeredBases: cleanedBeforeScoring.length > 0 ? cleanedBeforeScoring : undefined,
                whenScoringTriggeredBases: cleanedWhenScoring.length > 0 ? cleanedWhenScoring : undefined,
                afterScoringTriggeredBases: cleanedAfterScoring.length > 0 ? cleanedAfterScoring : undefined,
                ...(adjustedEligible ? { scoringEligibleBaseIndices: adjustedEligible } : {}),
            };
        }

        case SU_EVENTS.DECK_RESHUFFLED: {
            const { playerId, deckUids } = event.payload;
            const player = state.players[playerId];
            // 兼容“先抽旧牌库顶部，再把弃牌堆洗回牌库”的同批次场景：
            // deckUids 只描述被重洗进去的部分，旧牌库里尚未被后续 CARDS_DRAWN 消耗的牌必须暂时保留。
            const allCards = [...player.deck, ...player.discard];
            const cardMap = new Map(allCards.map(card => [card.uid, card]));
            const deckUidSet = new Set(deckUids);
            const referencedCards = deckUids
                .map(uid => cardMap.get(uid))
                .filter((card): card is CardInstance => card !== undefined);
            const preservedDeck = player.deck.filter(card => !deckUidSet.has(card.uid));
            const newDiscard = player.discard.filter(card => !deckUidSet.has(card.uid));
            
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        deck: [...preservedDeck, ...referencedCards],
                        discard: newDiscard,
                    },
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
            const base = state.bases[fromBaseIndex];
            const minion = base?.minions.find(m => m.uid === minionUid);
            
            // 从基地移除随从
            const newBases = state.bases.map((b, i) => {
                if (i !== fromBaseIndex) return b;
                return { ...b, minions: b.minions.filter(m => m.uid !== minionUid) };
            });
            
            // 随从返回手牌
            let newPlayers = { ...state.players };
            const owner = newPlayers[toPlayerId];
            const returnedCard: CardInstance = {
                uid: minionUid,
                defId: minionDefId,
                type: 'minion',
                owner: toPlayerId,
            };
            newPlayers = {
                ...newPlayers,
                [toPlayerId]: { ...owner, hand: [...owner.hand, returnedCard] },
            };
            
            // 附着的行动卡回各自所有者弃牌堆（与 MINION_DESTROYED 逻辑一致）
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
            
            return {
                ...state,
                bases: newBases,
                players: newPlayers,
            };
        }

        case SU_EVENTS.LIMIT_MODIFIED: {
            const { playerId, limitType, delta, restrictToBase, powerMax, sameNameOnly, sameNameDefId } = event.payload;
            const player = state.players[playerId];
            if (limitType === 'minion') {
                // 基地限定额度：写入 baseLimitedMinionQuota
                if (restrictToBase !== undefined) {
                    const oldQuota = player.baseLimitedMinionQuota ?? {};
                    const oldPowerCaps = player.baseLimitedMinionPowerCaps ?? {};
                    const updatedPlayer: typeof player = {
                        ...player,
                        baseLimitedMinionQuota: {
                            ...oldQuota,
                            [restrictToBase]: (oldQuota[restrictToBase] ?? 0) + delta,
                        },
                    };
                    // 同名约束标记和 defId
                    if (sameNameOnly) {
                        updatedPlayer.baseLimitedSameNameRequired = {
                            ...(player.baseLimitedSameNameRequired ?? {}),
                            [restrictToBase]: true,
                        };
                        // 保存触发能力时的随从 defId
                        if (sameNameDefId) {
                            updatedPlayer.baseLimitedSameNameDefId = {
                                ...(player.baseLimitedSameNameDefId ?? {}),
                                [restrictToBase]: sameNameDefId,
                            };
                        }
                    }
                    if (powerMax !== undefined) {
                        const nextPowerCaps = [...(oldPowerCaps[restrictToBase] ?? [])];
                        if (delta > 0) {
                            nextPowerCaps.push(...Array.from({ length: delta }, () => powerMax));
                        } else if (delta < 0) {
                            let remainingToRemove = Math.abs(delta);
                            while (remainingToRemove > 0) {
                                const removeIndex = nextPowerCaps.findIndex(cap => cap === powerMax);
                                if (removeIndex < 0) break;
                                nextPowerCaps.splice(removeIndex, 1);
                                remainingToRemove -= 1;
                            }
                        }
                        const nextMap = { ...oldPowerCaps };
                        if (nextPowerCaps.length > 0) {
                            nextMap[restrictToBase] = nextPowerCaps;
                        } else {
                            delete nextMap[restrictToBase];
                        }
                        updatedPlayer.baseLimitedMinionPowerCaps = Object.keys(nextMap).length > 0 ? nextMap : undefined;
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
                // 全局额度（带力量限制时记录 extraMinionPowerCaps / extraMinionPowerMax）
                const updatedPlayer = { ...player, minionLimit: player.minionLimit + delta };
                if (powerMax !== undefined) {
                    const nextPowerCaps = getRemainingGlobalPowerLimitedMinionQuotas(player);
                    if (delta > 0) {
                        nextPowerCaps.push(...Array.from({ length: delta }, () => powerMax));
                    } else if (delta < 0) {
                        let remainingToRemove = Math.abs(delta);
                        while (remainingToRemove > 0) {
                            const removeIndex = nextPowerCaps.findIndex(cap => cap === powerMax);
                            if (removeIndex < 0) break;
                            nextPowerCaps.splice(removeIndex, 1);
                            remainingToRemove -= 1;
                        }
                    }
                    updatedPlayer.extraMinionPowerCaps = nextPowerCaps.length > 0 ? nextPowerCaps : undefined;
                    updatedPlayer.extraMinionPowerMax = nextPowerCaps.length > 0
                        ? Math.min(...nextPowerCaps)
                        : undefined;
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
            const { minionUid, minionDefId, fromBaseIndex, ownerId, destroyerId } = (event as MinionDestroyedEvent).payload;
            // 从基地移除随从
            const base = state.bases[fromBaseIndex];
            const minion = base?.minions.find(m => m.uid === minionUid);
            const newBases = state.bases.map((b, i) => {
                if (i !== fromBaseIndex) return b;
                return { ...b, minions: b.minions.filter(m => m.uid !== minionUid) };
            });
            const destroyedAtBaseThisTurnCount = (state.turnDestroyedMinions ?? [])
                .filter(record => record.baseIndex === fromBaseIndex)
                .length;
            // POD 刚柔流寺庙：这里被消灭的随从始终改放拥有者牌库底。
            // 焦油坑：只在同基地本回合第一次随从被消灭时改去向，后续照常进弃牌堆。
            const shouldRedirectToDeckBottom =
                base?.defId === 'base_temple_of_goju_pod'
                || (base?.defId === 'base_tar_pits' && destroyedAtBaseThisTurnCount === 0);
            let newPlayers = { ...state.players };
            const owner = newPlayers[ownerId];
            const destroyedCard: CardInstance = {
                uid: minionUid,
                defId: minionDefId,
                type: 'minion',
                owner: ownerId,
            };
            newPlayers = shouldRedirectToDeckBottom
                ? {
                    ...newPlayers,
                    [ownerId]: { ...owner, deck: [...owner.deck, destroyedCard] },
                }
                : {
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
            // 追踪本回合被消灭的随从（用于 furthering_the_cause 等触发器，并阻止过期移动把弃牌堆里的牌复活）
            const destroyRecord = { uid: minionUid, defId: minionDefId, baseIndex: fromBaseIndex, owner: ownerId };
            const updatedDestroyList = [...(state.turnDestroyedMinions ?? []), destroyRecord];
            const destroyedMinionByPlayersThisTurn = destroyerId
                ? Array.from(new Set([...(state.destroyedMinionByPlayersThisTurn ?? []), destroyerId]))
                : state.destroyedMinionByPlayersThisTurn;
            const basePowerDecreasedPlayersThisTurn = {
                ...(state.basePowerDecreasedPlayersThisTurn ?? {}),
                [fromBaseIndex]: Array.from(new Set([...(state.basePowerDecreasedPlayersThisTurn?.[fromBaseIndex] ?? []), ownerId])),
            };
            return {
                ...state,
                bases: newBases,
                players: newPlayers,
                turnDestroyedMinions: updatedDestroyList,
                destroyedMinionByPlayersThisTurn,
                basePowerDecreasedPlayersThisTurn,
            };
        }

        case SU_EVENTS.MINION_MOVED: {
            const { minionUid, fromBaseIndex, toBaseIndex, toBaseDefId, reason } = (event as MinionMovedEvent).payload as any;
            const resolvedToBaseIndex = resolveLiveBaseIndex(state, toBaseIndex, toBaseDefId) ?? toBaseIndex;
            const buccaneerPodUsedUids = reason === 'pirate_buccaneer_pod'
                ? Array.from(new Set([...(state.buccaneerPodUsedUids ?? []), minionUid]))
                : state.buccaneerPodUsedUids;
            let movedMinion: MinionOnBase | undefined;
            const newBases = state.bases.map((base, i) => {
                if (i === fromBaseIndex) {
                    const m = base.minions.find(m => m.uid === minionUid);
                    if (m) movedMinion = { ...m };
                    return { ...base, minions: base.minions.filter(m => m.uid !== minionUid) };
                }
                return base;
            });
            const wasDestroyedThisTurn = (state.turnDestroyedMinions ?? []).some(record => record.uid === minionUid);
            // 回退：若基地上找不到（如 afterScoring 后随从已进弃牌堆），可从弃牌堆恢复；
            // 但本回合刚被消灭的随从绝不能被过期移动“复活”。
            if (!movedMinion && !wasDestroyedThisTurn) {
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
                            powerCounters: 0,
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
                                if (i !== resolvedToBaseIndex) return base;
                                return { ...base, minions: [...base.minions, movedMinion!] };
                            })
                            : newBases;
                        return {
                            ...state,
                            bases: updatedBases,
                            buccaneerPodUsedUids,
                            players: {
                                ...state.players,
                                [pid]: { ...player, discard: newDiscard },
                            },
                        };
                    }
                }
            }
            if (movedMinion) {
                // Stakeout POD: moving away reduces that player's power on fromBaseIndex
                const basePowerDecreasedPlayersThisTurn = {
                    ...(state.basePowerDecreasedPlayersThisTurn ?? {}),
                    [fromBaseIndex]: Array.from(new Set([...(state.basePowerDecreasedPlayersThisTurn?.[fromBaseIndex] ?? []), movedMinion.controller])),
                };
                // 追踪本回合移动到各基地的次数（用于牧场等"首次移动"触发）
                const mover = movedMinion.controller;
                const prevMoves = state.minionsMovedToBaseThisTurn ?? {};
                const playerMoves = prevMoves[mover] ?? {};
                const updatedMoves = {
                    ...prevMoves,
                    [mover]: { ...playerMoves, [resolvedToBaseIndex]: (playerMoves[resolvedToBaseIndex] ?? 0) + 1 },
                };

                // 你们已经完蛋 POD：追踪“本回合是否把对手随从移动到该基地”
                const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
                const movedOpponentMinion = movedMinion.controller !== currentPlayerId;
                const updatedMovedOpp = movedOpponentMinion
                    ? { ...(state.movedToBasesThisTurn ?? {}), [resolvedToBaseIndex]: true }
                    : state.movedToBasesThisTurn;

                return {
                    ...state,
                    minionsMovedToBaseThisTurn: updatedMoves,
                    movedToBasesThisTurn: updatedMovedOpp,
                    basePowerDecreasedPlayersThisTurn,
                    buccaneerPodUsedUids,
                    bases: newBases.map((base, i) => {
                        if (i !== resolvedToBaseIndex) return base;
                        return { ...base, minions: [...base.minions, movedMinion!] };
                    }),
                };
            }
            return { ...state, bases: newBases, buccaneerPodUsedUids };
        }

        case SU_EVENTS.MINION_CONTROL_CHANGED: {
            const { minionUid, baseIndex, toControllerId } = (event as MinionControlChangedEvent).payload;
            const base = state.bases[baseIndex];
            if (!base) return state;

            let changed = false;
            const nextBases = state.bases.map((candidate, index) => {
                if (index !== baseIndex) return candidate;
                return {
                    ...candidate,
                    minions: candidate.minions.map(minion => {
                        if (minion.uid !== minionUid) return minion;
                        changed = true;
                        return { ...minion, controller: toControllerId };
                    }),
                };
            });

            return changed ? { ...state, bases: nextBases } : state;
        }

        case SU_EVENTS.MINION_METADATA_UPDATED: {
            const { minionUid, baseIndex, metadataUpdate } = (event as any as { payload: { minionUid: string; baseIndex?: number; metadataUpdate: Record<string, unknown> } }).payload;
            const tryUpdateBase = (b: BaseInPlay) => ({
                ...b,
                minions: b.minions.map(m => {
                    if (m.uid !== minionUid) return m;
                    return { ...m, metadata: { ...(m.metadata ?? {}), ...metadataUpdate } };
                }),
            });

            // 优先使用 baseIndex 定位；否则回退全场扫描
            if (typeof baseIndex === 'number' && state.bases[baseIndex]) {
                return {
                    ...state,
                    bases: state.bases.map((b, i) => (i === baseIndex ? tryUpdateBase(b) : b)),
                };
            }
            return {
                ...state,
                bases: state.bases.map(tryUpdateBase),
            };
        }

        case SU_EVENTS.TITAN_METADATA_UPDATED: {
            const { titanUid, metadataUpdate } = (event as TitanMetadataUpdatedEvent).payload;
            const titans = state.titans ?? [];
            const titanIndex = titans.findIndex(titan => titan.uid === titanUid);
            if (titanIndex === -1) return state;
            const nextTitans = [...titans];
            nextTitans[titanIndex] = {
                ...nextTitans[titanIndex],
                metadata: { ...(nextTitans[titanIndex].metadata ?? {}), ...metadataUpdate },
            };
            return { ...state, titans: nextTitans };
        }

        case SU_EVENTS.POWER_COUNTER_ADDED: {
            const { minionUid, amount } = (event as PowerCounterAddedEvent).payload;
            // 力量指示物：操作 powerCounters 字段（独立可追踪实体）
            const newBases = state.bases.map(base => ({
                ...base,
                minions: base.minions.map(m => 
                    m.uid === minionUid 
                        ? { ...m, powerCounters: (m.powerCounters ?? 0) + amount }
                        : m
                ),
            }));
            return {
                ...state,
                bases: newBases,
                powerCountersPlacedOnMinionsThisTurn: amount > 0
                    ? (state.powerCountersPlacedOnMinionsThisTurn ?? 0) + amount
                    : state.powerCountersPlacedOnMinionsThisTurn,
            };
        }

        case SU_EVENTS.POWER_COUNTER_REMOVED: {
            const { minionUid, amount } = (event as PowerCounterRemovedEvent).payload;
            // 力量指示物：操作 powerCounters 字段
            let decreased: { baseIndex: number; playerId: PlayerId } | undefined;
            const newBases = state.bases.map((base, bi) => ({
                ...base,
                minions: base.minions.map(m => {
                    if (m.uid !== minionUid) return m;
                    if (amount > 0) decreased = { baseIndex: bi, playerId: m.controller };
                    return { ...m, powerCounters: Math.max(0, (m.powerCounters ?? 0) - amount) };
                }),
            }));
            const basePowerDecreasedPlayersThisTurn = decreased
                ? {
                    ...(state.basePowerDecreasedPlayersThisTurn ?? {}),
                    [decreased.baseIndex]: Array.from(new Set([...(state.basePowerDecreasedPlayersThisTurn?.[decreased.baseIndex] ?? []), decreased.playerId])),
                }
                : state.basePowerDecreasedPlayersThisTurn;
            return { ...state, bases: newBases, ...(basePowerDecreasedPlayersThisTurn ? { basePowerDecreasedPlayersThisTurn } : {}) };
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
            const { playerId, minionUid, ongoingCardUid, titanUid, baseIndex } = (event as TalentUsedEvent).payload;
            const oldBase = baseIndex < state.bases.length ? state.bases[baseIndex] : undefined;
            let reusedTalent = false;
            let consumedStandingStones = false;
            let standingStonesHostMinionUid: string | undefined;

            if (ongoingCardUid) {
                const baseOngoing = oldBase?.ongoingActions.find(o => o.uid === ongoingCardUid);
                if (baseOngoing?.talentUsed) {
                    reusedTalent = true;
                }
                if (!reusedTalent) {
                    for (const minion of oldBase?.minions ?? []) {
                        const attached = minion.attachedActions.find(action => action.uid === ongoingCardUid);
                        if (attached?.talentUsed) {
                            reusedTalent = true;
                            consumedStandingStones =
                                oldBase?.defId === 'base_standing_stones'
                                && minion.controller === playerId
                                && !state.standingStonesDoubleTalentMinionUid;
                            standingStonesHostMinionUid = minion.uid;
                            break;
                        }
                    }
                }
            } else if (titanUid) {
                const oldTitan = (state.titans ?? []).find(titan => titan.uid === titanUid);
                reusedTalent = oldTitan?.talentUsed ?? false;
            } else if (minionUid) {
                const oldMinion = oldBase?.minions.find(m => m.uid === minionUid);
                reusedTalent = oldMinion?.talentUsed ?? false;
                consumedStandingStones = reusedTalent
                    && oldBase?.defId === 'base_standing_stones'
                    && !state.standingStonesDoubleTalentMinionUid;
            }

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
            if (consumedStandingStones) {
                newStandingStonesUid = standingStonesHostMinionUid ?? minionUid;
            }
            const newTitans = titanUid
                ? (state.titans ?? []).map(titan =>
                    titan.uid === titanUid ? { ...titan, talentUsed: true } : titan,
                )
                : state.titans;
            const currentPlayer = state.players[playerId];
            const nextPlayer = reusedTalent && !consumedStandingStones && currentPlayer
                ? {
                    ...currentPlayer,
                    extraTalentUsesConsumed: (currentPlayer.extraTalentUsesConsumed ?? 0) + 1,
                }
                : currentPlayer;
            return {
                ...state,
                bases: newBases,
                titans: newTitans,
                standingStonesDoubleTalentMinionUid: newStandingStonesUid,
                players: nextPlayer
                    ? { ...state.players, [playerId]: nextPlayer }
                    : state.players,
            };
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
            let attachedToDiscard: CardInstance[] | undefined;
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
                        // 离场弃附属：随从被放入牌库时，其附着行动卡进入各自所有者弃牌堆
                        if (!attachedToDiscard && minion.attachedActions.length > 0) {
                            attachedToDiscard = minion.attachedActions.map(a => ({
                                uid: a.uid,
                                defId: a.defId,
                                type: 'action' as const,
                                owner: a.ownerId,
                            }));
                        }
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

            let updatedPlayers = {
                ...state.players,
                [ownerId]: {
                    ...owner,
                    hand: newHand,
                    discard: newDiscard,
                    deck: [...newDeck, card],
                },
            };

            if (attachedToDiscard && attachedToDiscard.length > 0) {
                for (const a of attachedToDiscard) {
                    const p = updatedPlayers[a.owner];
                    if (!p) continue;
                    updatedPlayers = {
                        ...updatedPlayers,
                        [a.owner]: {
                            ...p,
                            discard: [...p.discard, a],
                        },
                    };
                }
            }

            return {
                ...state,
                bases: newBases,
                players: updatedPlayers,
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
            let newBases = state.bases;

            if (!found) {
                newBases = state.bases.map(base => {
                    const buried = (base.buriedCards ?? []).find(card => card.uid === cardUid);
                    if (!buried) return base;
                    if (!found) {
                        found = {
                            uid: buried.uid,
                            defId: buried.defId,
                            type: (getCardDef(buried.defId)?.type ?? 'minion') as CardType,
                            owner: buried.trueOwnerId,
                        };
                    }
                    return {
                        ...base,
                        buriedCards: (base.buriedCards ?? []).filter(card => card.uid !== cardUid),
                    };
                });
            }

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
                bases: newBases,
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

        case SU_EVENTS.STARTING_HAND_MULLIGAN_USED: {
            const { playerId, used } = (event as any as { payload: { playerId: PlayerId; used: boolean } }).payload;
            const player = state.players[playerId];
            if (!player) return state;
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        startingHandMulliganUsed: used ? true : player.startingHandMulliganUsed ?? false,
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
        case SU_EVENTS.DECK_INSPECTED:
            return state;

        // 临时力量修正（回合结束自动清零）
        case SU_EVENTS.TEMP_POWER_ADDED: {
            const { minionUid, amount } = (event as TempPowerAddedEvent).payload;
            // 使用 minionUid 查找，不依赖 baseIndex（避免基地删除后索引错位）
            let decreased: { baseIndex: number; playerId: PlayerId } | undefined;
            const newBases = state.bases.map((base, bi) => ({
                ...base,
                minions: base.minions.map(m => {
                    if (m.uid !== minionUid) return m;
                    if (amount < 0) decreased = { baseIndex: bi, playerId: m.controller };
                    return { ...m, tempPowerModifier: (m.tempPowerModifier ?? 0) + amount };
                }),
            }));
            const basePowerDecreasedPlayersThisTurn = decreased
                ? {
                    ...(state.basePowerDecreasedPlayersThisTurn ?? {}),
                    [decreased.baseIndex]: Array.from(new Set([...(state.basePowerDecreasedPlayersThisTurn?.[decreased.baseIndex] ?? []), decreased.playerId])),
                }
                : state.basePowerDecreasedPlayersThisTurn;
            return { ...state, bases: newBases, ...(basePowerDecreasedPlayersThisTurn ? { basePowerDecreasedPlayersThisTurn } : {}) };
        }

        // 永久力量修正（非指示物，不可移动/转移）
        case SU_EVENTS.PERMANENT_POWER_ADDED: {
            const { minionUid, amount } = (event as PermanentPowerAddedEvent).payload;
            let decreased: { baseIndex: number; playerId: PlayerId } | undefined;
            const newBases = state.bases.map((base, bi) => ({
                ...base,
                minions: base.minions.map(m => {
                    if (m.uid !== minionUid) return m;
                    if (amount < 0) decreased = { baseIndex: bi, playerId: m.controller };
                    return { ...m, powerModifier: m.powerModifier + amount };
                }),
            }));
            const basePowerDecreasedPlayersThisTurn = decreased
                ? {
                    ...(state.basePowerDecreasedPlayersThisTurn ?? {}),
                    [decreased.baseIndex]: Array.from(new Set([...(state.basePowerDecreasedPlayersThisTurn?.[decreased.baseIndex] ?? []), decreased.playerId])),
                }
                : state.basePowerDecreasedPlayersThisTurn;
            return { ...state, bases: newBases, ...(basePowerDecreasedPlayersThisTurn ? { basePowerDecreasedPlayersThisTurn } : {}) };
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

        case SU_EVENTS.BASE_ABILITY_SUPPRESSED: {
            const { baseIndex, suppressorPlayerId } = (event as BaseAbilitySuppressedEvent).payload;
            const prev = state.suppressedBasesUntilTurnStart ?? [];
            // 去重：同一基地同一压制者只记录一次
            if (prev.some(s => s.baseIndex === baseIndex && s.suppressorPlayerId === suppressorPlayerId)) {
                return state;
            }
            return {
                ...state,
                suppressedBasesUntilTurnStart: [...prev, { baseIndex, suppressorPlayerId }],
            };
        }

        case SU_EVENTS.CARD_SUPPRESSED: {
            const { cardUid, baseIndex, suppressorPlayerId, cardType } = (event as CardSuppressedEvent).payload;
            const prev = state.suppressedCardsUntilTurnStart ?? [];
            if (prev.some(s => s.cardUid === cardUid && s.suppressorPlayerId === suppressorPlayerId)) {
                return state;
            }
            return {
                ...state,
                suppressedCardsUntilTurnStart: [...prev, { cardUid, baseIndex, suppressorPlayerId, cardType }],
            };
        }

        // 基地牌库洗混
        case SU_EVENTS.BASE_DECK_SHUFFLED: {
            const { newBaseDeckDefIds, clearBaseDiscard } = (event as BaseDeckShuffledEvent).payload;
            return {
                ...state,
                baseDeck: newBaseDeckDefIds,
                baseDiscard: clearBaseDiscard ? [] : state.baseDiscard,
            };
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

        case SU_EVENTS.BASE_ABILITY_USED: {
            const { playerId, baseIndex, baseDefId } = (event as any).payload;
            const prev = state.usedBaseAbilitiesThisTurn ?? [];
            if (prev.some(
                entry => entry.playerId === playerId
                    && entry.baseIndex === baseIndex
                    && entry.baseDefId === baseDefId,
            )) {
                return state;
            }
            return {
                ...state,
                usedBaseAbilitiesThisTurn: [...prev, { playerId, baseIndex, baseDefId }],
            };
        }

        case SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED: {
            const payload = (event as SpecialAfterScoringArmedEvent).payload;
            const prev = state.pendingAfterScoringSpecials ?? [];
            const exists = prev.some(
                p => payload.cardUid
                    ? p.cardUid === payload.cardUid
                    : p.sourceDefId === payload.sourceDefId
                        && p.playerId === payload.playerId
                        && p.baseIndex === payload.baseIndex,
            );
            if (exists) return state;

            const newEntry: PendingAfterScoringSpecial = {
                sourceDefId: payload.sourceDefId,
                playerId: payload.playerId,
                baseIndex: payload.baseIndex,
                cardUid: payload.cardUid,
                ...(payload.minionSnapshots ? { minionSnapshots: payload.minionSnapshots } : {}),
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
                p => payload.cardUid
                    ? p.cardUid !== payload.cardUid
                    : !(p.sourceDefId === payload.sourceDefId
                        && p.playerId === payload.playerId
                        && p.baseIndex === payload.baseIndex),
            );
            return {
                ...state,
                pendingAfterScoringSpecials: next.length > 0 ? next : undefined,
            };
        }

        case SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED: {
            const { baseIndices } = event.payload as { baseIndices: number[] };
            return {
                ...state,
                scoringEligibleBaseIndices: baseIndices,
            };
        }

        case SU_EVENT_TYPES.BEFORE_SCORING_TRIGGERED: {
            const { baseIndex } = event.payload as { baseIndex: number };
            const existing = state.beforeScoringTriggeredBases ?? [];
            // 防御性检查：防止重复添加同一个 baseIndex
            // 正常情况下不应该发生（scoreOneBase 中已有检查），但作为额外保护
            if (existing.includes(baseIndex)) return state;
            return {
                ...state,
                beforeScoringTriggeredBases: [...existing, baseIndex],
            };
        }

        case SU_EVENT_TYPES.BEFORE_SCORING_CLEARED: {
            // 计分阶段结束时清空标记，准备下一轮计分
            return {
                ...state,
                beforeScoringTriggeredBases: undefined,
            };
        }

        case SU_EVENT_TYPES.WHEN_SCORING_TRIGGERED: {
            const { baseIndex } = event.payload as { baseIndex: number };
            const existing = state.whenScoringTriggeredBases ?? [];
            if (existing.includes(baseIndex)) return state;
            return {
                ...state,
                whenScoringTriggeredBases: [...existing, baseIndex],
            };
        }

        case SU_EVENT_TYPES.WHEN_SCORING_CLEARED: {
            return {
                ...state,
                whenScoringTriggeredBases: undefined,
            };
        }

        case SU_EVENT_TYPES.AFTER_SCORING_TRIGGERED: {
            const { baseIndex } = event.payload as { baseIndex: number };
            const existing = state.afterScoringTriggeredBases ?? [];
            // 防御性检查：防止重复添加同一个 baseIndex
            if (existing.includes(baseIndex)) return state;
            return {
                ...state,
                afterScoringTriggeredBases: [...existing, baseIndex],
            };
        }

        case SU_EVENT_TYPES.AFTER_SCORING_CLEARED: {
            // 计分阶段结束时清空标记，准备下一轮计分
            return {
                ...state,
                afterScoringTriggeredBases: undefined,
                pendingPostScoringActions: undefined,
            };
        }

        default:
            return state;
    }
}
