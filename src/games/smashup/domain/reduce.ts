/**
 * 大杀四方 (Smash Up) - 事件归约
 *
 * reduce: 事件 → 新状态（确定性）
 */

import type {
    SmashUpCore,
    SmashUpEvent,
    ActionCounteredEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    MinionControlChangedEvent,
    BaseMetadataUpdatedEvent,
    ActionDefBlockedThisTurnEvent,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    OngoingDetachedEvent,
    OngoingCardCounterChangedEvent,
    TalentUsedEvent,
    DiscardAbilityUsedEvent,
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
    ExtraTurnQueuedEvent,
    TempPowerAddedEvent,
    PermanentPowerAddedEvent,
    CardSuppressedEvent,
    BreakpointModifiedEvent,
    TempBasePowerModifiedEvent,
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
import {
    bindEntityScopedValue,
    clearEntityScopedValue,
    createEntityId,
    resolveEntityRef,
} from '../../../engine/primitives';
import {
    buildCardInstanceFromObjectRef,
    enrichCardInstanceWithObjectRef,
    getCardTransferObjectRef,
} from './objectProvenance';
import { canControllerPlayTitan, hasCthulhuExpansionFaction } from './abilityHelpers';
import { normalizeScoringEligibleBaseIndices } from './ongoingModifiers';
import {
    getBestMatchingBaseLimitedPowerQuota,
    canUseBaseLimitedMinionQuota,
    canUseSameNameMinionQuota,
    getBestMatchingGlobalPowerLimitedQuota,
    getRemainingBaseLimitedPowerLimitedMinionQuotas,
    getRemainingGlobalPowerLimitedMinionQuotas,
    getRemainingUnrestrictedGlobalMinionQuota,
    isSameNameDefId,
    resolveLiveBaseIndex,
} from './utils';

function buildCompletedDraftPlayers(
    turnOrder: PlayerId[],
    playerSelections: Record<PlayerId, string[]>,
): PlayerId[] {
    return turnOrder.filter((playerId) => (playerSelections[playerId] ?? []).length >= 2);
}

function removeTempBreakpointModifierAtBaseIndex(
    modifiers: Record<number, number> | undefined,
    baseIndex: number,
): Record<number, number> | undefined {
    if (!modifiers) return undefined;
    const adjusted = Object.entries(modifiers).reduce<Record<number, number>>((acc, [rawIndex, delta]) => {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index === baseIndex) return acc;
        acc[index > baseIndex ? index - 1 : index] = delta;
        return acc;
    }, {});
    return Object.keys(adjusted).length > 0 ? adjusted : undefined;
}

function removeTempBasePowerModifierAtBaseIndex(
    modifiers: Record<number, Record<PlayerId, number>> | undefined,
    baseIndex: number,
): Record<number, Record<PlayerId, number>> | undefined {
    if (!modifiers) return undefined;
    const adjusted = Object.entries(modifiers).reduce<Record<number, Record<PlayerId, number>>>((acc, [rawIndex, deltaByPlayer]) => {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index === baseIndex) return acc;
        acc[index > baseIndex ? index - 1 : index] = deltaByPlayer;
        return acc;
    }, {});
    return Object.keys(adjusted).length > 0 ? adjusted : undefined;
}

function insertTempBreakpointModifierBaseSlot(
    modifiers: Record<number, number> | undefined,
    baseIndex: number,
): Record<number, number> | undefined {
    if (!modifiers) return undefined;
    const adjusted = Object.entries(modifiers).reduce<Record<number, number>>((acc, [rawIndex, delta]) => {
        const index = Number(rawIndex);
        if (!Number.isInteger(index)) return acc;
        acc[index >= baseIndex ? index + 1 : index] = delta;
        return acc;
    }, {});
    return Object.keys(adjusted).length > 0 ? adjusted : undefined;
}

function insertTempBasePowerModifierBaseSlot(
    modifiers: Record<number, Record<PlayerId, number>> | undefined,
    baseIndex: number,
): Record<number, Record<PlayerId, number>> | undefined {
    if (!modifiers) return undefined;
    const adjusted = Object.entries(modifiers).reduce<Record<number, Record<PlayerId, number>>>((acc, [rawIndex, deltaByPlayer]) => {
        const index = Number(rawIndex);
        if (!Number.isInteger(index)) return acc;
        acc[index >= baseIndex ? index + 1 : index] = deltaByPlayer;
        return acc;
    }, {});
    return Object.keys(adjusted).length > 0 ? adjusted : undefined;
}

function createNextBaseInstanceId(state: SmashUpCore): { instanceId: string; nextBaseInstanceId: number } {
    const ordinal = state.nextBaseInstanceId ?? ((state.bases?.length ?? 0) + 1);
    return {
        instanceId: createEntityId('smashup:base', ordinal),
        nextBaseInstanceId: ordinal + 1,
    };
}

function resolveBaseInstanceId(state: SmashUpCore, baseIndex: number, explicitBaseInstanceId?: string): string | undefined {
    if (explicitBaseInstanceId) {
        const result = resolveEntityRef(
            { entityId: explicitBaseInstanceId, kind: 'smashup:base' },
            state.bases
                .filter((base): base is BaseInPlay & { instanceId: string } => !!base.instanceId)
                .map(base => ({ ...base, entityId: base.instanceId, kind: 'smashup:base' as const })),
        );
        if (result.ok) return result.entity.entityId;
    }
    return state.bases[baseIndex]?.instanceId;
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

function removeCardUidFromOwnerZones(
    players: Record<PlayerId, PlayerState>,
    ownerId: PlayerId,
    cardUid: string,
): Record<PlayerId, PlayerState> {
    const owner = players[ownerId];
    if (!owner) return players;
    return {
        ...players,
        [ownerId]: {
            ...owner,
            hand: owner.hand.filter(card => card.uid !== cardUid),
            deck: owner.deck.filter(card => card.uid !== cardUid),
            discard: owner.discard.filter(card => card.uid !== cardUid),
        },
    };
}

function collectOccupiedUids(state: SmashUpCore): Set<string> {
    const occupied = new Set<string>();

    for (const player of Object.values(state.players)) {
        for (const card of player.hand) occupied.add(card.uid);
        for (const card of player.deck) occupied.add(card.uid);
        for (const card of player.discard) occupied.add(card.uid);
    }

    for (const base of state.bases) {
        for (const minion of base.minions) {
            occupied.add(minion.uid);
            for (const attached of minion.attachedActions ?? []) {
                occupied.add(attached.uid);
            }
        }
        for (const ongoing of base.ongoingActions) {
            occupied.add(ongoing.uid);
        }
        for (const buried of base.buriedCards ?? []) {
            occupied.add(buried.uid);
        }
    }

    for (const titan of state.titans ?? []) {
        occupied.add(titan.uid);
    }

    return occupied;
}

function allocateMadnessCardUids(
    state: SmashUpCore,
    requestedUids: string[],
    actualCount: number,
): { cardUids: string[]; nextUid: number } {
    const occupied = collectOccupiedUids(state);
    const resolvedUids: string[] = [];
    let fallbackNextUid = state.nextUid;

    for (let index = 0; index < actualCount; index += 1) {
        const requestedUid = requestedUids[index];
        if (
            requestedUid
            && !occupied.has(requestedUid)
            && !resolvedUids.includes(requestedUid)
        ) {
            resolvedUids.push(requestedUid);
            occupied.add(requestedUid);
            continue;
        }

        while (occupied.has(`madness_${fallbackNextUid}`)) {
            fallbackNextUid += 1;
        }
        const generatedUid = `madness_${fallbackNextUid}`;
        resolvedUids.push(generatedUid);
        occupied.add(generatedUid);
        fallbackNextUid += 1;
    }

    return {
        cardUids: resolvedUids,
        nextUid: Math.max(state.nextUid + actualCount, fallbackNextUid),
    };
}

function removeMinionUidFromBases(
    bases: BaseInPlay[],
    minionUid: string,
    preferredBaseIndex?: number,
): { bases: BaseInPlay[]; movedMinion?: MinionOnBase } {
    let preferredMinion: MinionOnBase | undefined;
    let fallbackMinion: MinionOnBase | undefined;
    const nextBases = bases.map((base, index) => {
        const existing = base.minions.find(minion => minion.uid === minionUid);
        if (!existing) return base;
        const snapshot: MinionOnBase = {
            ...existing,
            attachedActions: [...existing.attachedActions],
        };
        if (preferredBaseIndex === index && !preferredMinion) {
            preferredMinion = snapshot;
        }
        if (!fallbackMinion) {
            fallbackMinion = snapshot;
        }
        return {
            ...base,
            minions: base.minions.filter(minion => minion.uid !== minionUid),
        };
    });
    return {
        bases: nextBases,
        movedMinion: preferredMinion ?? fallbackMinion,
    };
}

function detachCardUidFromBases(
    bases: BaseInPlay[],
    cardUid: string,
): {
    bases: BaseInPlay[];
    removedMinion?: MinionOnBase;
    removedOngoing?: BaseInPlay['ongoingActions'][number];
    removedAttachedAction?: MinionOnBase['attachedActions'][number];
    detachedFromRemovedMinions: MinionOnBase['attachedActions'];
} {
    let removedMinion: MinionOnBase | undefined;
    let removedOngoing: BaseInPlay['ongoingActions'][number] | undefined;
    let removedAttachedAction: MinionOnBase['attachedActions'][number] | undefined;
    const detachedFromRemovedMinions: MinionOnBase['attachedActions'] = [];

    const nextBases = bases.map((base) => {
        const removedMinions = base.minions.filter(minion => minion.uid === cardUid);
        if (!removedMinion && removedMinions.length > 0) {
            const candidate = removedMinions[0];
            removedMinion = {
                ...candidate,
                attachedActions: [...candidate.attachedActions],
            };
        }
        for (const minion of removedMinions) {
            if (minion.attachedActions.length > 0) {
                detachedFromRemovedMinions.push(...minion.attachedActions);
            }
        }

        const filteredOngoing = base.ongoingActions.filter(ongoing => ongoing.uid !== cardUid);
        if (!removedOngoing) {
            const matchedOngoing = base.ongoingActions.find(ongoing => ongoing.uid === cardUid);
            if (matchedOngoing) {
                removedOngoing = matchedOngoing;
            }
        }

        const filteredMinions = base.minions
            .filter(minion => minion.uid !== cardUid)
            .map((minion) => {
                const matchedAttached = minion.attachedActions.find(attached => attached.uid === cardUid);
                if (!removedAttachedAction && matchedAttached) {
                    removedAttachedAction = matchedAttached;
                }
                const filteredAttached = minion.attachedActions.filter(attached => attached.uid !== cardUid);
                if (filteredAttached.length === minion.attachedActions.length) {
                    return minion;
                }
                return {
                    ...minion,
                    attachedActions: filteredAttached,
                };
            });

        const minionChanged = filteredMinions.length !== base.minions.length
            || filteredMinions.some((minion, idx) => minion !== base.minions[idx]);
        const ongoingChanged = filteredOngoing.length !== base.ongoingActions.length;
        if (!minionChanged && !ongoingChanged) {
            return base;
        }
        return {
            ...base,
            minions: filteredMinions,
            ongoingActions: filteredOngoing,
        };
    });

    return {
        bases: nextBases,
        removedMinion,
        removedOngoing,
        removedAttachedAction,
        detachedFromRemovedMinions,
    };
}

// ============================================================================
// reduce：事件 → 新状态（确定性）
// ============================================================================

export function reduce(state: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    switch (event.type) {
        case 'SYS_PHASE_CHANGED': {
            const payload = event.payload as { to?: string } | undefined;
            return payload?.to === undefined
                ? state
                : {
                    ...state,
                    turnPhase: payload.to,
                };
        }

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

        case SU_EVENTS.SEAT_SWAPPED: {
            const { requesterId, targetPlayerId } = event.payload;
            const requesterIndex = state.turnOrder.indexOf(requesterId);
            const targetIndex = state.turnOrder.indexOf(targetPlayerId);
            if (requesterIndex < 0 || targetIndex < 0 || requesterIndex === targetIndex) {
                return state;
            }
            const nextTurnOrder = [...state.turnOrder];
            [nextTurnOrder[requesterIndex], nextTurnOrder[targetIndex]] = [nextTurnOrder[targetIndex], nextTurnOrder[requesterIndex]];
            const currentPlayerId = state.turnOrder[state.currentPlayerIndex] ?? state.turnOrder[0];
            const nextCurrentPlayerIndex = Math.max(0, nextTurnOrder.indexOf(currentPlayerId));
            return {
                ...state,
                turnOrder: nextTurnOrder,
                currentPlayerIndex: nextCurrentPlayerIndex,
            };
        }

        case SU_EVENTS.ALL_FACTIONS_SELECTED: {
            const { readiedPlayers, nextUid, bases, baseDeck, nextBaseInstanceId } = event.payload;
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
                nextBaseInstanceId: nextBaseInstanceId ?? state.nextBaseInstanceId,
            };
        }

        case SU_EVENTS.MINION_PLAYED: {
            const {
                playerId,
                cardUid,
                defId,
                baseIndex,
                power,
                fromDiscard,
                fromDeck,
                fromBuried,
                discardPlaySourceId,
                consumesNormalLimit,
                allowImplicitSource,
                ownerId,
                playAsAction,
            } = event.payload;
            const resolvedBaseIndex = resolveLiveBaseIndex(state, baseIndex, event.payload.baseDefId) ?? baseIndex;
            const player = state.players[playerId];
            const cardInHand = player.hand.some(card => card.uid === cardUid);
            const cardInDiscard = player.discard.some(card => card.uid === cardUid);
            const cardInDeck = player.deck.some(card => card.uid === cardUid);
            const buriedHasCard = fromBuried
                ? (state.bases[resolvedBaseIndex]?.buriedCards ?? []).some(c => c.uid === cardUid)
                : false;
            const canResolveFromDeck = fromDeck ? (cardInDeck || cardInHand) : false;
            if (fromBuried && !buriedHasCard && !allowImplicitSource) return state;
            if (!fromBuried && !allowImplicitSource && ((fromDiscard && !cardInDiscard) || (fromDeck && !canResolveFromDeck) || (!fromDiscard && !fromDeck && !cardInHand))) {
                return state;
            }
            // 根据来源从手牌、弃牌堆或牌库移除卡牌
            // allowImplicitSource: true 时从所有位置尝试移除（用于动态牌源）
            const removeCard = (cards: CardInstance[]) => cards.filter(c => c.uid !== cardUid);
            const shouldRemoveFromHand = !fromDiscard && !fromBuried && (!fromDeck || cardInHand);
            const newHand = allowImplicitSource ? removeCard(player.hand) : shouldRemoveFromHand ? removeCard(player.hand) : player.hand;
            const newDiscard = allowImplicitSource ? removeCard(player.discard) : fromDiscard ? removeCard(player.discard) : player.discard;
            const newDeck = allowImplicitSource ? removeCard(player.deck) : (fromDeck && cardInDeck) ? removeCard(player.deck) : player.deck;
            const minion: MinionOnBase = {
                uid: cardUid,
                defId,
                controller: playerId,
                owner: ownerId ?? playerId,
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
                const requiredBaseSameNameDefId = player.baseLimitedSameNameDefId?.[resolvedBaseIndex];
                const matchesRestrictedBaseSameNameQuota = shouldIncrementPlayed
                    && player.baseLimitedSameNameRequired?.[resolvedBaseIndex] === true
                    && (
                        requiredBaseSameNameDefId
                            ? isSameNameDefId(defId, requiredBaseSameNameDefId)
                            : (state.bases[resolvedBaseIndex]?.minions.some(minion => isSameNameDefId(defId, minion.defId)) ?? false)
                    );
                const useRestrictedBaseQuota = canUseBaseQuota
                    && (
                        matchesRestrictedBaseSameNameQuota
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
                let newBaseLimitedSameNameRequired = player.baseLimitedSameNameRequired;
                let newBaseLimitedSameNameDefId = player.baseLimitedSameNameDefId;
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
                    if (useRestrictedBaseQuota && matchesRestrictedBaseSameNameQuota) {
                        const nextRequiredMap = { ...(player.baseLimitedSameNameRequired ?? {}) };
                        delete nextRequiredMap[resolvedBaseIndex];
                        newBaseLimitedSameNameRequired = Object.keys(nextRequiredMap).length > 0 ? nextRequiredMap : undefined;

                        const nextDefIdMap = { ...(player.baseLimitedSameNameDefId ?? {}) };
                        delete nextDefIdMap[resolvedBaseIndex];
                        newBaseLimitedSameNameDefId = Object.keys(nextDefIdMap).length > 0 ? nextDefIdMap : undefined;
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
                } else if (playAsAction) {
                    finalMinionsPlayed = player.minionsPlayed;
                } else if (shouldIncrementPlayed && (unrestrictedGlobalQuotaRemaining > 0 || player.minionsPlayed < player.minionLimit)) {
                    finalMinionsPlayed = player.minionsPlayed + 1;
                }

                return {
                    minionsPlayed: finalMinionsPlayed,
                    baseLimitedMinionQuota: newBaseLimitedMinionQuota,
                    baseLimitedMinionPowerCaps: newBaseLimitedMinionPowerCaps,
                    baseLimitedSameNameRequired: newBaseLimitedSameNameRequired,
                    baseLimitedSameNameDefId: newBaseLimitedSameNameDefId,
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
                        baseLimitedSameNameRequired: quotaResolution.baseLimitedSameNameRequired,
                        baseLimitedSameNameDefId: quotaResolution.baseLimitedSameNameDefId,
                        extraMinionPowerCaps: quotaResolution.extraMinionPowerCaps,
                        extraMinionPowerMax: quotaResolution.extraMinionPowerMax,
                        sameNameMinionRemaining: quotaResolution.sameNameMinionRemaining,
                        sameNameMinionDefId: quotaResolution.sameNameMinionDefId,
                        actionsPlayed: playAsAction ? player.actionsPlayed + 1 : player.actionsPlayed,
                        extraCardsPlayedThisTurn: quotaResolution.usedExtraCard
                            ? (player.extraCardsPlayedThisTurn ?? 0) + 1
                            : player.extraCardsPlayedThisTurn,
                    },
                },
                bases: newBases,
                cardsPlayedThisTurn: (state.cardsPlayedThisTurn ?? 0) + 1,
            };
        }

        case SU_EVENTS.ACTION_PLAYED: {
            const { playerId, cardUid, isExtraAction, fromBuried, fromDiscard, ownerId } = event.payload as any;
            const player = state.players[playerId];
            const card = fromDiscard
                ? player.discard.find(c => c.uid === cardUid)
                : player.hand.find(c => c.uid === cardUid);
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
            const wasExtraActionPlay = isExtraAction === true || player.actionsPlayed >= 1;

            const newHand = (fromBuried || fromDiscard) ? player.hand : player.hand.filter(c => c.uid !== cardUid);
            // ongoing 行动卡不进弃牌堆（由 ONGOING_ATTACHED 处理）
            const movedCard: CardInstance | undefined = card ?? (buriedLookup ? {
                uid: buriedLookup.buried.uid,
                defId: buriedLookup.buried.defId,
                type: (getCardDef(buriedLookup.buried.defId)?.type === 'minion' ? 'minion' : 'action') as any,
                owner: buriedLookup.buried.trueOwnerId,
            } : undefined);
            const resolvedOwnerId = ownerId ?? movedCard?.owner ?? playerId;
            const discardWithoutSource = fromDiscard ? player.discard.filter(c => c.uid !== cardUid) : player.discard;
            const sourceDiscard = discardWithoutSource;
            const targetOwner = state.players[resolvedOwnerId] ?? player;
            const targetDiscardBase = resolvedOwnerId === playerId ? sourceDiscard : targetOwner.discard;
            const targetDiscard = movedCard && !isOngoing
                ? [...targetDiscardBase, movedCard]
                : targetDiscardBase;
            const newBases = fromBuried && buriedLookup
                ? state.bases.map((b, i) => i !== buriedLookup.baseIndex ? b : ({
                    ...b,
                    buriedCards: (b.buriedCards ?? []).filter(x => x.uid !== cardUid),
                }))
                : state.bases;
            const nextPlayers = {
                ...state.players,
                [playerId]: {
                    ...player,
                    hand: newHand,
                    discard: resolvedOwnerId === playerId
                        ? targetDiscard
                        : sourceDiscard,
                    // Special 卡和额外行动不消耗行动额度
                    actionsPlayed: (isSpecial || isExtraAction) ? player.actionsPlayed : player.actionsPlayed + 1,
                    extraCardsPlayedThisTurn: wasExtraActionPlay
                        ? (player.extraCardsPlayedThisTurn ?? 0) + 1
                        : player.extraCardsPlayedThisTurn,
                },
            };
            if (resolvedOwnerId !== playerId) {
                nextPlayers[resolvedOwnerId] = {
                    ...targetOwner,
                    discard: targetDiscard,
                };
            }
            return {
                ...state,
                players: nextPlayers,
                cardsPlayedThisTurn: (state.cardsPlayedThisTurn ?? 0) + 1,
                ...(newBases !== state.bases ? { bases: newBases } : {}),
            };
        }

        case SU_EVENTS.ACTION_COUNTERED: {
            const { cardUid, defId, ownerId } = (event as ActionCounteredEvent).payload;
            const def = getCardDef(defId) as ActionCardDef | FusionCardDef | undefined;
            const subtype = def?.type === 'fusion' ? def.actionSubtype : def?.subtype;
            if (subtype !== 'ongoing') {
                return state;
            }

            const owner = state.players[ownerId];
            if (!owner) return state;
            if (owner.discard.some((card) => card.uid === cardUid)) {
                return state;
            }

            return {
                ...state,
                players: {
                    ...state.players,
                    [ownerId]: {
                        ...owner,
                        discard: [
                            ...owner.discard,
                            {
                                uid: cardUid,
                                defId,
                                type: 'action',
                                owner: ownerId,
                            } as CardInstance,
                        ],
                    },
                },
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
            const titan = titans[titanIndex];
            const player = state.players[controllerId];
            if (!player) return state;
            if (
                !canControllerPlayTitan(state, controllerId, titanUid, {
                    allowConcurrentOwnTitan: titan.metadata?.deferClashUntilDuelEnds === true,
                })
            ) {
                return state;
            }
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
                controllerId: titan.controllerId,
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
            const {
                cardUid,
                defId,
                ownerId,
                sourcePlayerId,
                targetType,
                targetBaseIndex,
                targetMinionUid,
                metadata,
                talentUsed,
            } = event.payload;
            const existingOngoing = state.bases.flatMap(base => [
                ...base.ongoingActions,
                ...base.minions.flatMap(minion => minion.attachedActions),
            ]).find(ongoing => ongoing.uid === cardUid);
            const baseMetadata = metadata ?? existingOngoing?.metadata;
            const preservedMetadata = sourcePlayerId && sourcePlayerId !== ownerId
                ? {
                    ...(baseMetadata ?? {}),
                    sourcePlayerId,
                    sourceControllerId: sourcePlayerId,
                }
                : baseMetadata;
            const preservedTalentUsed = talentUsed ?? existingOngoing?.talentUsed ?? false;
            let nextPlayers = removeCardUidFromOwnerZones(state.players, sourcePlayerId ?? ownerId, cardUid);
            if (sourcePlayerId && sourcePlayerId !== ownerId) {
                nextPlayers = removeCardUidFromOwnerZones(nextPlayers, ownerId, cardUid);
            }
            const dedupedBases = state.bases.map((base) => ({
                ...base,
                ongoingActions: base.ongoingActions.filter(ongoing => ongoing.uid !== cardUid),
                minions: base.minions.map((minion) => ({
                    ...minion,
                    attachedActions: minion.attachedActions.filter(attached => attached.uid !== cardUid),
                })),
            }));
            if (targetType === 'base') {
                const newBases = dedupedBases.map((base, i) => {
                    if (i !== targetBaseIndex) return base;
                    return {
                        ...base,
                        ongoingActions: [
                            ...base.ongoingActions,
                            { uid: cardUid, defId, ownerId, talentUsed: preservedTalentUsed, ...(preservedMetadata ? { metadata: preservedMetadata } : {}) },
                        ],
                    };
                });
                return { ...state, bases: newBases, players: nextPlayers };
            }
            // 附着到随从
            if (targetMinionUid) {
                const newBases = dedupedBases.map((base, i) => {
                    if (i !== targetBaseIndex) return base;
                    return {
                        ...base,
                        minions: base.minions.map(m => (
                            m.uid !== targetMinionUid
                                ? m
                                : {
                                    ...m,
                                    attachedActions: [
                                        ...m.attachedActions,
                                        { uid: cardUid, defId, ownerId, talentUsed: preservedTalentUsed, ...(preservedMetadata ? { metadata: preservedMetadata } : {}) },
                                    ],
                                }
                        )),
                    };
                });
                return { ...state, bases: newBases, players: nextPlayers };
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
                        controllerId: titan.controllerId,
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
            const newTempBreakpointModifiers = removeTempBreakpointModifierAtBaseIndex(
                state.tempBreakpointModifiers,
                baseIndex,
            );
            const newTempBasePowerModifiers = removeTempBasePowerModifierAtBaseIndex(
                state.tempBasePowerModifiers,
                baseIndex,
            );
            const newTempBreakpointModifiersByBaseId = scoredBase.instanceId
                ? clearEntityScopedValue(state.tempBreakpointModifiersByBaseId, scoredBase.instanceId)
                : state.tempBreakpointModifiersByBaseId;
            const newTempBasePowerModifiersByBaseId = scoredBase.instanceId
                ? clearEntityScopedValue(state.tempBasePowerModifiersByBaseId, scoredBase.instanceId)
                : state.tempBasePowerModifiersByBaseId;
            return {
                ...state,
                players: newPlayers,
                bases: newBases,
                titans: newTitans,
                baseDiscard: newBaseDiscard,
                scoringEligibleBaseIndices: newEligible?.length ? newEligible : undefined,
                tempBreakpointModifiers: newTempBreakpointModifiers,
                tempBreakpointModifiersByBaseId: newTempBreakpointModifiersByBaseId,
                tempBasePowerModifiers: newTempBasePowerModifiers,
                tempBasePowerModifiersByBaseId: newTempBasePowerModifiersByBaseId,
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
            let nextPlayers = {
                ...state.players,
                [playerId]: {
                    ...player,
                    hand: remainingHand,
                },
            };
            for (const card of discardedFromHand) {
                const ownerId = state.players[card.owner] ? card.owner : playerId;
                const owner = nextPlayers[ownerId];
                if (!owner) continue;
                nextPlayers = {
                    ...nextPlayers,
                    [ownerId]: {
                        ...owner,
                        discard: [...owner.discard, card],
                    },
                };
            }
            return {
                ...state,
                players: nextPlayers,
            };
        }

        case SU_EVENTS.CARDS_MILLED: {
            const { playerId, cardUids } = event.payload as { playerId: PlayerId; cardUids: string[] };
            const player = state.players[playerId];
            const uidSet = new Set(cardUids);
            const milledFromDeck = player.deck.filter(c => uidSet.has(c.uid));
            const remainingDeck = player.deck.filter(c => !uidSet.has(c.uid));
            if (milledFromDeck.length === 0) return state;
            let nextPlayers = {
                ...state.players,
                [playerId]: {
                    ...player,
                    deck: remainingDeck,
                },
            };
            for (const card of milledFromDeck) {
                const ownerId = state.players[card.owner] ? card.owner : playerId;
                const owner = nextPlayers[ownerId];
                if (!owner) continue;
                nextPlayers = {
                    ...nextPlayers,
                    [ownerId]: {
                        ...owner,
                        discard: [...owner.discard, card],
                    },
                };
            }
            return {
                ...state,
                players: nextPlayers,
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
            const { playerId, ownerId: payloadOwnerId, cardUid, from } = (event as CardBoxedEvent).payload;
            const ownerId = payloadOwnerId ?? playerId;
            const player = state.players[playerId];
            if (!player) return state;

            const zone = player[from];
            const boxedCard = zone.find(card => card.uid === cardUid);
            if (!boxedCard) return state;
            const owner = state.players[ownerId] ?? player;
            const finalOwnerId = state.players[ownerId] ? ownerId : playerId;

            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        [from]: zone.filter(card => card.uid !== cardUid),
                        ...(finalOwnerId === playerId
                            ? { removedFromGame: [...(player.removedFromGame ?? []), boxedCard] }
                            : {}),
                    },
                    ...(finalOwnerId === playerId
                        ? {}
                        : {
                            [finalOwnerId]: {
                                ...owner,
                                removedFromGame: [...(owner.removedFromGame ?? []), boxedCard],
                            },
                        }),
                },
            };
        }

        case SU_EVENTS.TURN_STARTED: {
            const { playerId, turnNumber } = event.payload;
            const expiredTimedPowerModifiers = (state.timedPowerModifiers ?? []).filter(
                modifier => turnNumber >= modifier.expiresOnTurnNumber
                    && (modifier.expiresOnPlayerId === undefined || modifier.expiresOnPlayerId === playerId),
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
                minions: base.minions.map(m => {
                    const {
                        mythicHorsesSeastarExtraTalent: _seastarExtra,
                        mythicHorsesSeastarExtraTalentConsumed: _seastarConsumed,
                        passengersOriginalBaseIndex: _passengersOriginalBaseIndex,
                        passengersMovedTurnNumber: _passengersMovedTurnNumber,
                        ...remainingMetadata
                    } = m.metadata ?? {};
                    const metadata = Object.keys(remainingMetadata).length > 0 ? remainingMetadata : undefined;
                    return {
                        ...m,
                        ...(metadata ? { metadata } : { metadata: undefined }),
                        powerCounters: m.powerCounters,  // 显式保留力量指示物（独立实体）
                        powerModifier: m.powerModifier + (timedPowerReverts.get(m.uid) ?? 0),
                        talentUsed: m.controller === playerId ? false : m.talentUsed,
                        playedThisTurn: m.controller === playerId ? undefined : m.playedThisTurn,
                        tempPowerModifier: 0,
                        attachedActions: m.attachedActions.map(a => ({
                            ...a,
                            talentUsed: ((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === playerId
                                ? false
                                : a.talentUsed,
                        })),
                    };
                }),
                ongoingActions: base.ongoingActions.map(o => ({
                    ...o,
                    talentUsed: ((o.metadata?.sourceControllerId as PlayerId | undefined) ?? o.ownerId) === playerId
                        ? false
                        : o.talentUsed,
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
                        extraCardsPlayedThisTurn: undefined,
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
                        modifier => turnNumber < modifier.expiresOnTurnNumber
                            || (modifier.expiresOnPlayerId !== undefined && modifier.expiresOnPlayerId !== playerId),
                    );
                    return remaining.length ? remaining : undefined;
                })(),
                titanOngoingSuppressedUntilTurnEnd: undefined,
                moonZeroThreeTriggeredTurnByTitan: undefined,
                veryLargeBoulderTriggeredTurnByTitan: undefined,
                // 清空本回合移动追踪
                minionsMovedToBaseThisTurn: undefined,
                minionMoveEventsByBaseThisTurn: undefined,
                minionMovesThisTurnByPlayer: undefined,
                blockedActionDefIdsThisTurn: undefined,
                movedToBasesThisTurn: undefined,
                // 清空海盗 POD：私掠者每回合一次追踪
                buccaneerPodUsedUids: undefined,
                // 清空临时临界点修正
                tempBreakpointModifiers: undefined,
                // 清空本回合临时玩家-基地总力量修正
                tempBasePowerModifiers: undefined,
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
                greatWolfSpiritDoubleTalentCardUids: undefined,
                // 清空计分后延迟 special 记录
                pendingAfterScoringSpecials: undefined,
                // 清空计分阶段锁定的 eligible 基地列表
                scoringEligibleBaseIndices: undefined,
                // 清空本回合已使用的持续行动 UID 追踪
                turnUsedOngoingUids: undefined,
                // 这是“本回合”态，不是“该玩家下一次回合”态。
                // 像龙卷风走廊这类 once/turn 基地能力若跨回合残留，会直接把下一位玩家的首次触发错误挡掉。
                usedBaseAbilitiesThisTurn: undefined,
                activeDuel: undefined,
                sleepMarkedPlayers: state.sleepMarkedPlayers,
                playerRestrictionsUntilTurnStart: remainingPlayerRestrictions?.length
                    ? remainingPlayerRestrictions
                    : undefined,
                players: newPlayers,
            };
        }

        case SU_EVENTS.TURN_ENDED: {
            const {
                playerId,
                nextPlayerIndex,
                extraTurnPlayerId,
                extraTurnReturnToPlayerIndex,
                extraTurnReason,
                completedExtraTurn,
            } = event.payload;
            const remainingSleepMarked = state.sleepMarkedPlayers?.filter(pid => pid !== playerId);
            let pendingExtraTurns = state.pendingExtraTurns;
            let activeExtraTurn = completedExtraTurn ? undefined : state.activeExtraTurn;
            if (extraTurnPlayerId) {
                const consumeIndex = pendingExtraTurns?.findIndex(entry =>
                    entry.playerId === extraTurnPlayerId
                    && entry.returnToPlayerIndex === extraTurnReturnToPlayerIndex
                    && entry.reason === extraTurnReason,
                ) ?? -1;
                pendingExtraTurns = consumeIndex >= 0 && pendingExtraTurns
                    ? [
                        ...pendingExtraTurns.slice(0, consumeIndex),
                        ...pendingExtraTurns.slice(consumeIndex + 1),
                    ]
                    : pendingExtraTurns?.slice(1);
                activeExtraTurn = {
                    playerId: extraTurnPlayerId,
                    returnToPlayerIndex: extraTurnReturnToPlayerIndex ?? nextPlayerIndex,
                    reason: extraTurnReason ?? 'extra_turn',
                };
            }
            let updatedPlayers = state.players;
            const restoredBases = state.bases.map((base) => ({
                ...base,
                minions: base.minions.flatMap((minion) => {
                    const metadata = minion.metadata as Record<string, unknown> | undefined;
                    let current = minion;
                    const temporaryControlPlayerId = metadata?.temporaryControlPlayerId ?? metadata?.mermaidsTemporaryControlPlayerId;
                    const temporaryControlTurn = metadata?.temporaryControlTurn ?? metadata?.mermaidsTemporaryControlTurn;
                    const originalController = metadata?.temporaryControlOriginalController ?? metadata?.mermaidsTemporaryControlOriginalController;
                    const temporaryControlEndsOnTurnEndPlayerId = metadata?.temporaryControlEndsOnTurnEndPlayerId;
                    if (
                        (temporaryControlEndsOnTurnEndPlayerId ?? temporaryControlPlayerId) === playerId
                        && temporaryControlTurn === state.turnNumber
                        && typeof originalController === 'string'
                    ) {
                        current = {
                            ...current,
                            controller: originalController as PlayerId,
                            metadata: {
                                ...metadata,
                                temporaryControlPlayerId: undefined,
                                temporaryControlTurn: undefined,
                                temporaryControlOriginalController: undefined,
                                temporaryControlEndsOnTurnEndPlayerId: undefined,
                                mermaidsTemporaryControlPlayerId: undefined,
                                mermaidsTemporaryControlTurn: undefined,
                                mermaidsTemporaryControlOriginalController: undefined,
                            },
                        };
                    }
                    const currentMetadata = current.metadata as Record<string, unknown> | undefined;
                    const returnPlayerId = currentMetadata?.ittyCrittersReturnToDeckBottomPlayerId;
                    if (returnPlayerId !== playerId || current.controller !== playerId) {
                        return [current];
                    }

                    const owner = updatedPlayers[playerId];
                    if (!owner) return [current];
                    const returnedCard: CardInstance = {
                        uid: current.uid,
                        defId: current.defId,
                        type: 'minion',
                        owner: playerId,
                    };
                    updatedPlayers = {
                        ...updatedPlayers,
                        [playerId]: {
                            ...owner,
                            deck: [...owner.deck, returnedCard],
                        },
                    };
                    for (const attached of current.attachedActions ?? []) {
                        const attachedOwner = updatedPlayers[attached.ownerId];
                        if (!attachedOwner) continue;
                        updatedPlayers = {
                            ...updatedPlayers,
                            [attached.ownerId]: {
                                ...attachedOwner,
                                discard: [
                                    ...attachedOwner.discard,
                                    { uid: attached.uid, defId: attached.defId, type: 'action', owner: attached.ownerId },
                                ],
                            },
                        };
                    }
                    return [];
                }),
            }));
            return {
                ...state,
                currentPlayerIndex: nextPlayerIndex,
                pendingExtraTurns: pendingExtraTurns?.length ? pendingExtraTurns : undefined,
                activeExtraTurn,
                players: updatedPlayers,
                bases: restoredBases,
                sleepMarkedPlayers: remainingSleepMarked?.length ? remainingSleepMarked : undefined,
                titanOngoingSuppressedUntilTurnEnd: undefined,
                activeDuel: undefined,
            };
        }

        case SU_EVENTS.EXTRA_TURN_QUEUED: {
            const { playerId, returnToPlayerIndex, reason } = (event as ExtraTurnQueuedEvent).payload;
            return {
                ...state,
                pendingExtraTurns: [
                    ...(state.pendingExtraTurns ?? []),
                    { playerId, returnToPlayerIndex, reason },
                ],
            };
        }

        case SU_EVENTS.BASE_REPLACED: {
            const {
                baseIndex,
                oldBaseDefId,
                newBaseDefId,
                keepCards,
                allowMissingFromBaseDeck,
                newBaseInstanceId,
            } = (event as BaseReplacedEvent).payload;
            // ✅ 修复：使用 indexOf + slice 移除第一个匹配的基地，而不是 filter
            // 原因：filter 会移除所有匹配的基地，如果 baseDeck 中有重复基地会出错
            // 而且 scoreOneBase 中已经用 slice(1) 移除了第一个基地，这里应该保持一致
            // 但是 reduce 是基于事件的，不应该依赖 scoreOneBase 的返回值
            // 所以这里需要找到 newBaseDefId 在 baseDeck 中的索引，然后移除它
            const baseDefIdIndex = state.baseDeck.indexOf(newBaseDefId);
            const replacementAlreadyApplied = state.bases[baseIndex]?.defId === newBaseDefId;
            if (baseDefIdIndex < 0 && replacementAlreadyApplied) {
                return state;
            }
            if (baseDefIdIndex < 0 && !allowMissingFromBaseDeck) {
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
                const allocatedBaseIdentity = createNextBaseInstanceId(state);
                const replacementId = newBaseInstanceId ?? allocatedBaseIdentity.instanceId;
                const nextBaseInstanceId = newBaseInstanceId ? state.nextBaseInstanceId : allocatedBaseIdentity.nextBaseInstanceId;
                const updatedBases = state.bases.map((base, i) => {
                    if (i !== baseIndex) return base;
                    return { ...base, instanceId: replacementId, defId: newBaseDefId };
                });
                const removedTitanUids = new Set(
                    (state.titans ?? [])
                        .filter(titan => titan.location.zone === 'base' && titan.location.baseIndex === baseIndex)
                        .map(titan => titan.uid),
                );
                const updatedTitans = removedTitanUids.size > 0
                    ? (state.titans ?? []).map(titan => {
                        if (!removedTitanUids.has(titan.uid)) return titan;
                        return {
                            ...titan,
                            controllerId: titan.controllerId,
                            powerCounters: 0,
                            talentUsed: false,
                            metadata: undefined,
                            location: { zone: 'setaside' },
                        };
                    })
                    : state.titans;
                const cleanedTitanSuppressed = removedTitanUids.size > 0
                    ? (state.titanOngoingSuppressedUntilTurnEnd ?? []).filter(uid => !removedTitanUids.has(uid))
                    : state.titanOngoingSuppressedUntilTurnEnd;
                return {
                    ...state,
                    bases: updatedBases,
                    baseDeck: [...newBaseDeck, oldBaseDefId],
                    ...(nextBaseInstanceId ? { nextBaseInstanceId } : {}),
                    ...(updatedTitans ? { titans: updatedTitans } : {}),
                    ...(removedTitanUids.size > 0
                        ? {
                            titanOngoingSuppressedUntilTurnEnd: cleanedTitanSuppressed.length > 0
                                ? cleanedTitanSuppressed
                                : undefined,
                        }
                        : {}),
                    beforeScoringTriggeredBases: cleanedBeforeScoring.length > 0 ? cleanedBeforeScoring : undefined,
                    whenScoringTriggeredBases: cleanedWhenScoring.length > 0 ? cleanedWhenScoring : undefined,
                    afterScoringTriggeredBases: cleanedAfterScoring.length > 0 ? cleanedAfterScoring : undefined,
                };
            }
            // 默认模式：插入新空基地（配合 BASE_SCORED 删除旧基地后使用）
            const nextBaseIdentity = newBaseInstanceId
                ? { instanceId: newBaseInstanceId, nextBaseInstanceId: state.nextBaseInstanceId }
                : createNextBaseInstanceId(state);
            const newBase: BaseInPlay = {
                instanceId: nextBaseIdentity.instanceId,
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
            const adjustedTempBreakpointModifiers = insertTempBreakpointModifierBaseSlot(
                state.tempBreakpointModifiers,
                baseIndex,
            );
            const adjustedTempBasePowerModifiers = insertTempBasePowerModifierBaseSlot(
                state.tempBasePowerModifiers,
                baseIndex,
            );
            return {
                ...state,
                bases: newBases,
                titans: adjustedTitans,
                baseDeck: newBaseDeck,
                ...(nextBaseIdentity.nextBaseInstanceId ? { nextBaseInstanceId: nextBaseIdentity.nextBaseInstanceId } : {}),
                beforeScoringTriggeredBases: cleanedBeforeScoring.length > 0 ? cleanedBeforeScoring : undefined,
                whenScoringTriggeredBases: cleanedWhenScoring.length > 0 ? cleanedWhenScoring : undefined,
                afterScoringTriggeredBases: cleanedAfterScoring.length > 0 ? cleanedAfterScoring : undefined,
                ...(adjustedEligible ? { scoringEligibleBaseIndices: adjustedEligible } : {}),
                tempBreakpointModifiers: adjustedTempBreakpointModifiers,
                tempBasePowerModifiers: adjustedTempBasePowerModifiers,
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
            const { playerId, deckUids, sourcePlayerId } = event.payload;
            const player = state.players[playerId];
            if (!player) return state;
            if (sourcePlayerId !== undefined && sourcePlayerId !== playerId) {
                const sourcePlayer = state.players[sourcePlayerId];
                if (!sourcePlayer) return state;

                const referencedUids = new Set(deckUids);
                const cardLookup = new Map<string, CardInstance>();
                for (const card of [...player.hand, ...player.deck, ...player.discard]) {
                    if (referencedUids.has(card.uid) && !cardLookup.has(card.uid)) {
                        cardLookup.set(card.uid, card);
                    }
                }
                for (const card of [...sourcePlayer.hand, ...sourcePlayer.deck, ...sourcePlayer.discard]) {
                    if (referencedUids.has(card.uid) && !cardLookup.has(card.uid)) {
                        cardLookup.set(card.uid, card);
                    }
                }

                const reorderedDeck = deckUids
                    .map(uid => cardLookup.get(uid))
                    .filter((card): card is CardInstance => card !== undefined);
                const stripReferencedCards = (cards: CardInstance[]) => cards.filter(card => !referencedUids.has(card.uid));

                return {
                    ...state,
                    players: {
                        ...state.players,
                        [playerId]: {
                            ...player,
                            hand: stripReferencedCards(player.hand),
                            deck: reorderedDeck,
                            discard: stripReferencedCards(player.discard),
                        },
                        [sourcePlayerId]: {
                            ...sourcePlayer,
                            hand: stripReferencedCards(sourcePlayer.hand),
                            deck: stripReferencedCards(sourcePlayer.deck),
                            discard: stripReferencedCards(sourcePlayer.discard),
                        },
                    },
                };
            }
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
            if (!base || !minion) {
                return state;
            }
            
            // 从基地移除随从
            const newBases = state.bases.map((b, i) => {
                if (i !== fromBaseIndex) return b;
                return { ...b, minions: b.minions.filter(m => m.uid !== minionUid) };
            });
            
            // 随从返回手牌
            let newPlayers = { ...state.players };
            const owner = newPlayers[toPlayerId];
            if (!owner) {
                return state;
            }
            const alreadyInHand = owner.hand.some(c => c.uid === minionUid);
            const returnedCard: CardInstance = {
                uid: minionUid,
                defId: minionDefId,
                type: 'minion',
                owner: toPlayerId,
            };
            newPlayers = {
                ...newPlayers,
                [toPlayerId]: { ...owner, hand: alreadyInHand ? owner.hand : [...owner.hand, returnedCard] },
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
            const { playerId, limitType, delta, restrictToBase, powerMax, sameNameOnly, sameNameDefId, playTiming } = event.payload;
            const player = state.players[playerId];
            if (playTiming === 'immediate') {
                // 立即额外出牌只作为交互信号存在，不应沉淀为可跨时机保留的额度。
                return state;
            }
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
            const destroyRecord = {
                uid: minionUid,
                defId: minionDefId,
                baseIndex: fromBaseIndex,
                owner: ownerId,
                controller: (event as MinionDestroyedEvent).payload.controllerId ?? minion?.controller ?? ownerId,
            };
            const updatedDestroyList = [...(state.turnDestroyedMinions ?? []), destroyRecord];
            const destroyedMinionByPlayersThisTurn = destroyerId
                ? Array.from(new Set([...(state.destroyedMinionByPlayersThisTurn ?? []), destroyerId]))
                : state.destroyedMinionByPlayersThisTurn;
            const decreasedControllerId = destroyRecord.controller;
            const basePowerDecreasedPlayersThisTurn = {
                ...(state.basePowerDecreasedPlayersThisTurn ?? {}),
                [fromBaseIndex]: Array.from(new Set([...(state.basePowerDecreasedPlayersThisTurn?.[fromBaseIndex] ?? []), decreasedControllerId])),
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
            const canRecoverFromDeck = reason === 'pirate_first_mate' || reason === 'pirate_first_mate_pod';
            const removalResult = removeMinionUidFromBases(state.bases, minionUid, fromBaseIndex);
            let movedMinion: MinionOnBase | undefined = removalResult.movedMinion;
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
                            ? removalResult.bases.map((base, i) => {
                                if (i !== resolvedToBaseIndex) return base;
                                return { ...base, minions: [...base.minions, movedMinion!] };
                            })
                            : removalResult.bases;
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
                if (canRecoverFromDeck) {
                    for (const [pid, player] of Object.entries(state.players)) {
                        const idx = player.deck.findIndex(c => c.uid === minionUid);
                        if (idx === -1) continue;
                        const card = player.deck[idx];
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
                        const newDeck = [...player.deck];
                        newDeck.splice(idx, 1);
                        const updatedBases = removalResult.bases.map((base, i) => {
                            if (i !== resolvedToBaseIndex) return base;
                            return { ...base, minions: [...base.minions, movedMinion!] };
                        });
                        return {
                            ...state,
                            bases: updatedBases,
                            buccaneerPodUsedUids,
                            players: {
                                ...state.players,
                                [pid]: { ...player, deck: newDeck },
                            },
                        };
                    }
                }
            }
            if (movedMinion) {
                const hasPassengers = movedMinion.attachedActions.some(action => action.defId === 'changerbots_passengers');
                const movedMinionWithMetadata = hasPassengers
                    ? {
                        ...movedMinion,
                        metadata: {
                            ...(movedMinion.metadata ?? {}),
                            passengersOriginalBaseIndex: fromBaseIndex,
                            passengersMovedTurnNumber: state.turnNumber,
                        },
                    }
                    : movedMinion;
                // Stakeout POD: moving away reduces that player's power on fromBaseIndex
                const basePowerDecreasedPlayersThisTurn = {
                    ...(state.basePowerDecreasedPlayersThisTurn ?? {}),
                    [fromBaseIndex]: Array.from(new Set([...(state.basePowerDecreasedPlayersThisTurn?.[fromBaseIndex] ?? []), movedMinionWithMetadata.controller])),
                };
                // 追踪本回合移动到各基地的次数（用于牧场等"首次移动"触发）
                const mover = movedMinionWithMetadata.controller;
                const prevMoves = state.minionsMovedToBaseThisTurn ?? {};
                const playerMoves = prevMoves[mover] ?? {};
                const updatedMoves = {
                    ...prevMoves,
                    [mover]: { ...playerMoves, [resolvedToBaseIndex]: (playerMoves[resolvedToBaseIndex] ?? 0) + 1 },
                };
                const moveEventCounts = { ...(state.minionMoveEventsByBaseThisTurn ?? {}) };
                moveEventCounts[fromBaseIndex] = (moveEventCounts[fromBaseIndex] ?? 0) + 1;
                moveEventCounts[resolvedToBaseIndex] = (moveEventCounts[resolvedToBaseIndex] ?? 0) + 1;
                const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
                const updatedMoveCountsByPlayer = {
                    ...(state.minionMovesThisTurnByPlayer ?? {}),
                    [currentPlayerId]: ((state.minionMovesThisTurnByPlayer ?? {})[currentPlayerId] ?? 0) + 1,
                };

                // 你们已经完蛋 POD：追踪“本回合是否把对手随从移动到该基地”
                const movedOpponentMinion = movedMinionWithMetadata.controller !== currentPlayerId;
                const updatedMovedOpp = movedOpponentMinion
                    ? {
                        ...(state.movedToBasesThisTurn ?? {}),
                        [resolvedToBaseIndex]: {
                            ...(state.movedToBasesThisTurn?.[resolvedToBaseIndex] ?? {}),
                            [currentPlayerId]: true,
                        },
                    }
                    : state.movedToBasesThisTurn;

                return {
                    ...state,
                    minionsMovedToBaseThisTurn: updatedMoves,
                    minionMoveEventsByBaseThisTurn: moveEventCounts,
                    minionMovesThisTurnByPlayer: updatedMoveCountsByPlayer,
                    movedToBasesThisTurn: updatedMovedOpp,
                    basePowerDecreasedPlayersThisTurn,
                    buccaneerPodUsedUids,
                    bases: removalResult.bases.map((base, i) => {
                        if (i !== resolvedToBaseIndex) return base;
                        return { ...base, minions: [...base.minions, movedMinionWithMetadata] };
                    }),
                };
            }
            return { ...state, bases: removalResult.bases, buccaneerPodUsedUids };
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

        case SU_EVENTS.BASE_METADATA_UPDATED: {
            const { baseIndex, baseInstanceId, metadataUpdate } = (event as BaseMetadataUpdatedEvent).payload;
            const matchesBase = (base: BaseInPlay, index: number) => (
                index === baseIndex
                && (baseInstanceId === undefined || base.instanceId === baseInstanceId)
            );
            let changed = false;
            const bases = state.bases.map((base, index) => {
                if (!matchesBase(base, index)) return base;
                changed = true;
                return {
                    ...base,
                    metadata: {
                        ...(base.metadata ?? {}),
                        ...metadataUpdate,
                    },
                };
            });
            return changed ? { ...state, bases } : state;
        }

        case SU_EVENTS.ACTION_DEF_BLOCKED_THIS_TURN: {
            const { playerId, defId } = (event as ActionDefBlockedThisTurnEvent).payload;
            const existing = state.blockedActionDefIdsThisTurn?.[playerId] ?? [];
            if (existing.includes(defId)) return state;
            return {
                ...state,
                blockedActionDefIdsThisTurn: {
                    ...(state.blockedActionDefIdsThisTurn ?? {}),
                    [playerId]: [...existing, defId],
                },
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
            const qPayload = (event as unknown as { payload: { playerId: string; effect: 'addPowerCounter' | 'addTempPower' | 'grantExtraActionForPlayedMinion'; amount: number; reason?: string } }).payload;
            const qPlayer = state.players[qPayload.playerId];
            if (!qPlayer) return state;
            const prev = qPlayer.pendingMinionPlayEffects ?? [];
            return {
                ...state,
                players: { ...state.players, [qPayload.playerId]: { ...qPlayer, pendingMinionPlayEffects: [...prev, { effect: qPayload.effect, amount: qPayload.amount, ...(qPayload.reason ? { reason: qPayload.reason } : {}) }] } },
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
            const { cardUid, delta, metadataUpdate, replaceMode } = (event as OngoingCardCounterChangedEvent).payload;
            // 使用 cardUid 查找，不依赖 baseIndex（避免基地删除后索引错位）
            const newBases = state.bases.map(base => ({
                ...base,
                ongoingActions: base.ongoingActions.map(oa => {
                    if (oa.uid !== cardUid) return oa;
                    const prev = ((oa.metadata?.powerCounters as number) ?? 0);
                    const nextPowerCounters = replaceMode
                        ? Math.max(0, typeof metadataUpdate?.powerCounters === 'number' ? metadataUpdate.powerCounters : prev)
                        : Math.max(0, prev + delta);
                    return {
                        ...oa,
                        metadata: {
                            ...oa.metadata,
                            ...(metadataUpdate ?? {}),
                            powerCounters: nextPowerCounters,
                        },
                    };
                }),
            }));
            return { ...state, bases: newBases };
        }

        case SU_EVENTS.TALENT_USED: {
            const { playerId, minionUid, ongoingCardUid, titanUid, baseIndex } = (event as TalentUsedEvent).payload;
            const oldBase = baseIndex < state.bases.length ? state.bases[baseIndex] : undefined;
            let reusedTalent = false;
            let consumedStandingStones = false;
            let consumedSeastarExtra = false;
            let standingStonesHostMinionUid: string | undefined;

            if (ongoingCardUid) {
                const baseOngoing = oldBase?.ongoingActions.find(o => o.uid === ongoingCardUid);
                if (baseOngoing?.talentUsed) {
                    reusedTalent = true;
                    consumedSeastarExtra =
                        (baseOngoing.metadata?.mythicHorsesSeastarExtraTalent === true)
                        && (baseOngoing.metadata?.mythicHorsesSeastarExtraTalentConsumed !== true);
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
                            consumedSeastarExtra =
                                (attached.metadata?.mythicHorsesSeastarExtraTalent === true)
                                && (attached.metadata?.mythicHorsesSeastarExtraTalentConsumed !== true);
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
                consumedSeastarExtra = reusedTalent
                    && oldMinion?.metadata?.mythicHorsesSeastarExtraTalent === true
                    && oldMinion?.metadata?.mythicHorsesSeastarExtraTalentConsumed !== true;
            }

            // 使用 uid 查找，不依赖 baseIndex（避免基地删除后索引错位）
            const newBases = state.bases.map(base => {
                // ongoing 行动卡天赋（基地上或随从附着）
                if (ongoingCardUid) {
                    return {
                        ...base,
                        ongoingActions: base.ongoingActions.map(o => 
                            o.uid === ongoingCardUid
                                ? {
                                    ...o,
                                    talentUsed: true,
                                    metadata: consumedSeastarExtra
                                        ? { ...(o.metadata ?? {}), mythicHorsesSeastarExtraTalentConsumed: true }
                                        : o.metadata,
                                }
                                : o
                        ),
                        minions: base.minions.map(m => ({
                            ...m,
                            attachedActions: m.attachedActions.map(a => 
                                a.uid === ongoingCardUid
                                    ? {
                                        ...a,
                                        talentUsed: true,
                                        metadata: consumedSeastarExtra
                                            ? { ...(a.metadata ?? {}), mythicHorsesSeastarExtraTalentConsumed: true }
                                            : a.metadata,
                                    }
                                    : a
                            ),
                        })),
                    };
                }
                // 随从天赋
                return {
                    ...base,
                    minions: base.minions.map(m => {
                        if (m.uid !== minionUid) return m;
                        return {
                            ...m,
                            talentUsed: true,
                            metadata: consumedSeastarExtra
                                ? { ...(m.metadata ?? {}), mythicHorsesSeastarExtraTalentConsumed: true }
                                : m.metadata,
                        };
                    }),
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
            const greatWolfSpiritActive = !!(
                minionUid
                && baseIndex !== undefined
                && (state.titans ?? []).some(titan =>
                    titan.defId === 'werewolves_great_wolf_spirit'
                    && titan.location.zone === 'base'
                    && titan.location.baseIndex === baseIndex
                    && titan.controllerId === playerId
                    && !((state.titanOngoingSuppressedUntilTurnEnd ?? []).includes(titan.uid)),
                )
            );
            const prevGreatWolfSpiritUids = state.greatWolfSpiritDoubleTalentCardUids ?? [];
            const nextGreatWolfSpiritUids = reusedTalent
                && !consumedStandingStones
                && greatWolfSpiritActive
                && minionUid
                ? Array.from(new Set([...prevGreatWolfSpiritUids, minionUid]))
                : prevGreatWolfSpiritUids;
            return {
                ...state,
                bases: newBases,
                titans: newTitans,
                standingStonesDoubleTalentMinionUid: newStandingStonesUid,
                greatWolfSpiritDoubleTalentCardUids: nextGreatWolfSpiritUids.length > 0 ? nextGreatWolfSpiritUids : undefined,
                players: nextPlayer
                    ? { ...state.players, [playerId]: nextPlayer }
                    : state.players,
            };
        }

        case SU_EVENTS.DISCARD_ABILITY_USED: {
            const { playerId, sourceId } = (event as DiscardAbilityUsedEvent).payload;
            const player = state.players[playerId];
            if (!player) return state;
            if (player.usedDiscardPlayAbilities?.includes(sourceId)) return state;
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...player,
                        usedDiscardPlayAbilities: [...(player.usedDiscardPlayAbilities ?? []), sourceId],
                    },
                },
            };
        }

        case SU_EVENTS.ONGOING_DETACHED: {
            const { cardUid, defId, ownerId, clydeReturnToHand, destination } = (event as OngoingDetachedEvent).payload;
            let clydeReturnControllerId: PlayerId | undefined;
            if (clydeReturnToHand === true) {
                for (const base of state.bases) {
                    const host = base.minions.find(m => m.attachedActions.some(a => a.uid === cardUid));
                    if (!host) continue;
                    if (base.defId === 'base_primate_park') break;
                    const clyde = base.minions.find(m =>
                        m.controller === host.controller
                        && m.defId === 'cyborg_apes_clyde_2_0'
                    );
                    if (clyde) {
                        clydeReturnControllerId = clyde.controller;
                        break;
                    }
                }
            }
            // 从基地的 ongoingActions 或随从的 attachedActions 中移除
            const newBases = state.bases.map(base => {
                const filteredOngoing = base.ongoingActions.filter(o => o.uid !== cardUid);
                const filteredMinions = base.minions.map(m => {
                    const hadAttachment = m.attachedActions.some(a => a.uid === cardUid);
                    const filtered = m.attachedActions.filter(a => a.uid !== cardUid);
                    if (!hadAttachment) return { ...m, attachedActions: filtered };
                    const updated = { ...m, attachedActions: filtered };
                    // ghost_make_contact：移除时恢复控制权为原始 owner
                    if (defId.startsWith('ghost_make_contact')) {
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
            // 行动卡回所有者弃牌堆；Clyde 2.0 可把附着在同基地己方随从上的行动改为收入手牌。
            const detachedOwner = state.players[ownerId];
            if (!detachedOwner) return { ...state, bases: newBases };
            const detachedCard: CardInstance = { uid: cardUid, defId, type: 'action', owner: ownerId };
            if (clydeReturnControllerId) {
                const receiver = state.players[clydeReturnControllerId];
                if (receiver) {
                    return {
                        ...state,
                        bases: newBases,
                        players: {
                            ...state.players,
                            [clydeReturnControllerId]: {
                                ...receiver,
                                hand: [...receiver.hand, detachedCard],
                            },
                        },
                    };
                }
            }
            const destinationZone = destination ?? 'discard';
            return {
                ...state,
                bases: newBases,
                players: {
                    ...state.players,
                    [ownerId]: destinationZone === 'hand'
                        ? { ...detachedOwner, hand: [...detachedOwner.hand, detachedCard] }
                        : { ...detachedOwner, discard: [...detachedOwner.discard, detachedCard] },
                },
            };
        }

        case SU_EVENTS.CARD_TO_DECK_TOP: {
            const { cardUid, defId, ownerId, sourcePlayerId } = (event as CardToDeckTopEvent).payload;
            const owner = state.players[ownerId];
            if (!owner) return state;
            const sourceOwner = state.players[sourcePlayerId ?? ownerId];
            if (!sourceOwner) return state;

            let found: CardInstance | undefined;
            const removeCard = (cards: CardInstance[]): CardInstance[] => {
                const idx = cards.findIndex(c => c.uid === cardUid);
                if (idx === -1) return cards;
                if (!found) found = cards[idx];
                return [...cards.slice(0, idx), ...cards.slice(idx + 1)];
            };

            const newSourceHand = removeCard(sourceOwner.hand);
            const newSourceDeck = removeCard(sourceOwner.deck);
            const newSourceDiscard = removeCard(sourceOwner.discard);
            const ownerWithoutCard = sourcePlayerId !== undefined && sourcePlayerId !== ownerId
                ? {
                    hand: removeCard(owner.hand),
                    deck: removeCard(owner.deck),
                    discard: removeCard(owner.discard),
                }
                : undefined;
            const detached = detachCardUidFromBases(state.bases, cardUid);

            if (!found) {
                if (detached.removedMinion) {
                    found = {
                        uid: detached.removedMinion.uid,
                        defId: detached.removedMinion.defId,
                        type: 'minion',
                        owner: detached.removedMinion.owner,
                    };
                } else if (detached.removedOngoing) {
                    found = {
                        uid: detached.removedOngoing.uid,
                        defId: detached.removedOngoing.defId,
                        type: 'action',
                        owner: detached.removedOngoing.ownerId,
                    };
                } else if (detached.removedAttachedAction) {
                    found = {
                        uid: detached.removedAttachedAction.uid,
                        defId: detached.removedAttachedAction.defId,
                        type: 'action',
                        owner: detached.removedAttachedAction.ownerId,
                    };
                }
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
                [sourcePlayerId ?? ownerId]: {
                    ...sourceOwner,
                    hand: newSourceHand,
                    discard: newSourceDiscard,
                    deck: sourcePlayerId === undefined || sourcePlayerId === ownerId
                        ? [card, ...newSourceDeck]
                        : newSourceDeck,
                },
            };
            if (sourcePlayerId !== undefined && sourcePlayerId !== ownerId) {
                updatedPlayers = {
                    ...updatedPlayers,
                    [ownerId]: {
                        ...owner,
                        hand: ownerWithoutCard?.hand ?? owner.hand,
                        discard: ownerWithoutCard?.discard ?? owner.discard,
                        deck: [card, ...(ownerWithoutCard?.deck ?? owner.deck)],
                    },
                };
            }

            const uniqueDetached = Array.from(
                new Map(detached.detachedFromRemovedMinions.map((attached) => [attached.uid, attached])).values(),
            );
            if (uniqueDetached.length > 0) {
                for (const attached of uniqueDetached) {
                    const attachedOwner = updatedPlayers[attached.ownerId];
                    if (!attachedOwner) continue;
                    const attachedCard: CardInstance = {
                        uid: attached.uid,
                        defId: attached.defId,
                        type: 'action',
                        owner: attached.ownerId,
                    };
                    updatedPlayers = {
                        ...updatedPlayers,
                        [attached.ownerId]: {
                            ...attachedOwner,
                            discard: [...attachedOwner.discard, attachedCard],
                        },
                    };
                }
            }

            return {
                ...state,
                bases: detached.bases,
                players: updatedPlayers,
            };
        }

        case SU_EVENTS.CARD_TO_DECK_BOTTOM: {
            const { cardUid, defId, ownerId, sourcePlayerId } = (event as CardToDeckBottomEvent).payload;
            const owner = state.players[ownerId];
            if (!owner) return state;
            const sourceOwner = state.players[sourcePlayerId ?? ownerId];
            if (!sourceOwner) return state;

            let found: CardInstance | undefined;
            const removeCard = (cards: CardInstance[]): CardInstance[] => {
                const idx = cards.findIndex(c => c.uid === cardUid);
                if (idx === -1) return cards;
                if (!found) found = cards[idx];
                return [...cards.slice(0, idx), ...cards.slice(idx + 1)];
            };

            const newSourceHand = removeCard(sourceOwner.hand);
            const newSourceDeck = removeCard(sourceOwner.deck);
            const newSourceDiscard = removeCard(sourceOwner.discard);
            const ownerWithoutCard = sourcePlayerId !== undefined && sourcePlayerId !== ownerId
                ? {
                    hand: removeCard(owner.hand),
                    deck: removeCard(owner.deck),
                    discard: removeCard(owner.discard),
                }
                : undefined;
            const detached = detachCardUidFromBases(state.bases, cardUid);
            if (!found) {
                if (detached.removedMinion) {
                    found = {
                        uid: detached.removedMinion.uid,
                        defId: detached.removedMinion.defId,
                        type: 'minion',
                        owner: detached.removedMinion.owner,
                    };
                } else if (detached.removedOngoing) {
                    found = {
                        uid: detached.removedOngoing.uid,
                        defId: detached.removedOngoing.defId,
                        type: 'action',
                        owner: detached.removedOngoing.ownerId,
                    };
                } else if (detached.removedAttachedAction) {
                    found = {
                        uid: detached.removedAttachedAction.uid,
                        defId: detached.removedAttachedAction.defId,
                        type: 'action',
                        owner: detached.removedAttachedAction.ownerId,
                    };
                }
            }

            const def = getCardDef(defId);
            const card: CardInstance = found ?? {
                uid: cardUid,
                defId,
                type: def?.type ?? 'minion',
                owner: ownerId,
            };

            let updatedPlayers = { ...state.players };
            updatedPlayers[sourcePlayerId ?? ownerId] = {
                ...sourceOwner,
                hand: newSourceHand,
                discard: newSourceDiscard,
                deck: sourcePlayerId === undefined || sourcePlayerId === ownerId
                    ? [...newSourceDeck, card]
                    : newSourceDeck,
            };
            if (sourcePlayerId !== undefined && sourcePlayerId !== ownerId) {
                updatedPlayers[ownerId] = {
                    ...owner,
                    hand: ownerWithoutCard?.hand ?? owner.hand,
                    discard: ownerWithoutCard?.discard ?? owner.discard,
                    deck: [...(ownerWithoutCard?.deck ?? owner.deck), card],
                };
            }

            const uniqueDetached = Array.from(
                new Map(detached.detachedFromRemovedMinions.map((attached) => [attached.uid, attached])).values(),
            );
            if (uniqueDetached.length > 0) {
                for (const a of uniqueDetached) {
                    const p = updatedPlayers[a.ownerId];
                    if (!p) continue;
                    const detachedCard: CardInstance = {
                        uid: a.uid,
                        defId: a.defId,
                        type: 'action',
                        owner: a.ownerId,
                    };
                    updatedPlayers = {
                        ...updatedPlayers,
                        [a.ownerId]: {
                            ...p,
                            discard: [...p.discard, detachedCard],
                        },
                    };
                }
            }

            return {
                ...state,
                bases: detached.bases,
                players: updatedPlayers,
            };
        }

        case SU_EVENTS.CARD_TRANSFERRED: {
            const { cardUid, defId, fromPlayerId, toPlayerId, ownerId } = (event as CardTransferredEvent).payload;
            const fromPlayer = state.players[fromPlayerId];
            const toPlayer = state.players[toPlayerId];
            if (!fromPlayer || !toPlayer) return state;
            const transferRef = getCardTransferObjectRef((event as CardTransferredEvent).payload);

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
            const detached = detachCardUidFromBases(state.bases, cardUid);
            let newBases = detached.bases;

            if (!found) {
                if (detached.removedMinion) {
                    found = {
                        uid: detached.removedMinion.uid,
                        defId: detached.removedMinion.defId,
                        type: 'minion',
                        owner: detached.removedMinion.owner,
                    };
                } else if (detached.removedOngoing) {
                    found = {
                        uid: detached.removedOngoing.uid,
                        defId: detached.removedOngoing.defId,
                        type: 'action',
                        owner: detached.removedOngoing.ownerId,
                    };
                } else if (detached.removedAttachedAction) {
                    found = {
                        uid: detached.removedAttachedAction.uid,
                        defId: detached.removedAttachedAction.defId,
                        type: 'action',
                        owner: detached.removedAttachedAction.ownerId,
                    };
                }
            }

            if (!found) {
                newBases = newBases.map(base => {
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

            if (!found && !transferRef && ownerId === undefined) return state;

            const def = getCardDef(defId);
            const card: CardInstance = found
                ? enrichCardInstanceWithObjectRef(found, transferRef)
                : transferRef
                    ? buildCardInstanceFromObjectRef(transferRef)
                    : {
                        uid: cardUid,
                        defId,
                        type: def?.type ?? 'minion',
                        owner: ownerId ?? fromPlayerId,
                    };
            const movedFromAndToSamePlayer = fromPlayerId === toPlayerId;
            let updatedPlayers = movedFromAndToSamePlayer
                ? {
                    ...state.players,
                    [fromPlayerId]: {
                        ...fromPlayer,
                        hand: [...fromHand, card],
                        deck: fromDeck,
                        discard: fromDiscard,
                    },
                }
                : {
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
                };

            const uniqueDetached = Array.from(
                new Map(detached.detachedFromRemovedMinions.map((attached) => [attached.uid, attached])).values(),
            );
            for (const attached of uniqueDetached) {
                const attachedOwner = updatedPlayers[attached.ownerId];
                if (!attachedOwner) continue;
                const attachedCard: CardInstance = {
                    uid: attached.uid,
                    defId: attached.defId,
                    type: 'action',
                    owner: attached.ownerId,
                };
                updatedPlayers = {
                    ...updatedPlayers,
                    [attached.ownerId]: {
                        ...attachedOwner,
                        discard: [...attachedOwner.discard, attachedCard],
                    },
                };
            }

            return {
                ...state,
                bases: newBases,
                players: updatedPlayers,
            };
        }

        case SU_EVENTS.CARD_RECOVERED_FROM_DISCARD: {
            const { playerId, cardUids } = (event as CardRecoveredFromDiscardEvent).payload;
            const player = state.players[playerId];
            if (!player) return state;
            const uidSet = new Set(cardUids);
            const recovered = player.discard.filter(c => uidSet.has(c.uid));
            const remainingDiscard = player.discard.filter(c => !uidSet.has(c.uid));
            let nextPlayers = {
                ...state.players,
                [playerId]: {
                    ...player,
                    discard: remainingDiscard,
                },
            };
            for (const card of recovered) {
                const ownerId = state.players[card.owner] ? card.owner : playerId;
                const owner = nextPlayers[ownerId];
                if (!owner) continue;
                nextPlayers = {
                    ...nextPlayers,
                    [ownerId]: {
                        ...owner,
                        hand: [...owner.hand, card],
                    },
                };
            }
            return {
                ...state,
                players: nextPlayers,
            };
        }

        case SU_EVENTS.HAND_SHUFFLED_INTO_DECK: {
            const { playerId, newDeckUids } = (event as HandShuffledIntoDeckEvent).payload;
            const player = state.players[playerId];
            if (!player) return state;
            // 手牌 + 原牌库合并，按 newDeckUids 排序构建新牌库
            const allCards = [...player.hand, ...player.deck];
            const cardMap = new Map(allCards.map(c => [c.uid, c]));
            const orderedCards = newDeckUids
                .map(uid => cardMap.get(uid))
                .filter((c): c is CardInstance => c !== undefined);
            const ownerForCard = (card: CardInstance): PlayerId => state.players[card.owner] ? card.owner : playerId;
            const newDeck = orderedCards.filter(card => ownerForCard(card) === playerId);
            // 只移除被洗入牌库的手牌，保留其余手牌
            const movedUidSet = new Set(newDeckUids);
            const remainingHand = player.hand.filter(c => !movedUidSet.has(c.uid));
            let nextPlayers = {
                ...state.players,
                [playerId]: {
                    ...player,
                    hand: remainingHand,
                    deck: newDeck,
                },
            };
            for (const card of orderedCards) {
                const ownerId = ownerForCard(card);
                if (ownerId === playerId) continue;
                nextPlayers = removeCardUidFromOwnerZones(nextPlayers, ownerId, card.uid);
                const owner = nextPlayers[ownerId];
                if (!owner) continue;
                nextPlayers = {
                    ...nextPlayers,
                    [ownerId]: {
                        ...owner,
                        deck: [...owner.deck, card],
                    },
                };
            }
            return {
                ...state,
                players: nextPlayers,
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
            const allocation = allocateMadnessCardUids(state, cardUids, actualCount);
            const madnessCards: CardInstance[] = allocation.cardUids.map(uid => ({
                uid,
                defId: MADNESS_CARD_DEF_ID,
                type: 'action' as const,
                owner: playerId,
            }));
            return {
                ...state,
                madnessDeck: newMadnessDeck,
                nextUid: allocation.nextUid,
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
            // 从手牌或弃牌堆移除一张疯狂卡，放回疯狂牌库。
            // 注意：即使出现历史脏数据导致同 uid 重复，也应每个事件只移除一张，避免一次性移除多张。
            const handIndex = player.hand.findIndex(c => c.uid === cardUid);
            const discardIndex = handIndex >= 0 ? -1 : player.discard.findIndex(c => c.uid === cardUid);
            const returningCard = handIndex >= 0
                ? player.hand[handIndex]
                : discardIndex >= 0
                    ? player.discard[discardIndex]
                    : undefined;
            if (!returningCard) return state;
            const newHand = handIndex >= 0
                ? [...player.hand.slice(0, handIndex), ...player.hand.slice(handIndex + 1)]
                : player.hand;
            const newDiscard = discardIndex >= 0
                ? [...player.discard.slice(0, discardIndex), ...player.discard.slice(discardIndex + 1)]
                : player.discard;
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
            const { topDefIds, reason } = (event as BaseDeckReorderedEvent).payload;
            // 将 topDefIds 放到牌库顶部，其余保持原序
            const remaining = state.baseDeck.filter(id => !topDefIds.includes(id));
            const shouldRemoveFromBaseDiscard =
                reason === 'time_travelers_time_is_fleeting'
                || reason === 'base_the_nexus'
                || reason === 'dragons_burn_it_down';
            const nextBaseDiscard = shouldRemoveFromBaseDiscard
                ? topDefIds.reduce((discard, defId) => {
                    const index = discard.indexOf(defId);
                    return index >= 0 ? [...discard.slice(0, index), ...discard.slice(index + 1)] : discard;
                }, state.baseDiscard)
                : state.baseDiscard;
            return { ...state, baseDeck: [...topDefIds, ...remaining], baseDiscard: nextBaseDiscard };
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
            const { minionUid, amount, reason, expiresOnTurnNumber, expiresOnPlayerId } = (event as PermanentPowerAddedEvent).payload;
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
            const timedPowerModifiers = typeof expiresOnTurnNumber === 'number'
                ? [
                    ...(state.timedPowerModifiers ?? []),
                    {
                        minionUid,
                        amount,
                        expiresOnTurnNumber,
                        ...(expiresOnPlayerId !== undefined ? { expiresOnPlayerId } : {}),
                        reason,
                    },
                ]
                : state.timedPowerModifiers;
            return {
                ...state,
                bases: newBases,
                ...(basePowerDecreasedPlayersThisTurn ? { basePowerDecreasedPlayersThisTurn } : {}),
                ...(timedPowerModifiers ? { timedPowerModifiers } : {}),
            };
        }

        // 临界点临时修正（回合结束自动清零）
        case SU_EVENTS.BREAKPOINT_MODIFIED: {
            const { baseIndex, baseInstanceId, delta } = (event as BreakpointModifiedEvent).payload;
            const prev = state.tempBreakpointModifiers ?? {};
            const resolvedBaseInstanceId = resolveBaseInstanceId(state, baseIndex, baseInstanceId);
            const prevByBaseId = state.tempBreakpointModifiersByBaseId ?? {};
            const nextByBaseId = resolvedBaseInstanceId
                ? bindEntityScopedValue(
                    prevByBaseId,
                    { entityId: resolvedBaseInstanceId, kind: 'smashup:base' },
                    (prevByBaseId[resolvedBaseInstanceId] ?? 0) + delta,
                )
                : state.tempBreakpointModifiersByBaseId;
            return {
                ...state,
                tempBreakpointModifiers: {
                    ...prev,
                    [baseIndex]: (prev[baseIndex] ?? 0) + delta,
                },
                tempBreakpointModifiersByBaseId: nextByBaseId,
            };
        }

        case SU_EVENTS.TEMP_BASE_POWER_MODIFIED: {
            const { baseIndex, baseInstanceId, playerId, amount } = (event as TempBasePowerModifiedEvent).payload;
            const prev = state.tempBasePowerModifiers ?? {};
            const basePrev = prev[baseIndex] ?? {};
            const resolvedBaseInstanceId = resolveBaseInstanceId(state, baseIndex, baseInstanceId);
            const prevByBaseId = state.tempBasePowerModifiersByBaseId ?? {};
            const basePrevById = resolvedBaseInstanceId ? (prevByBaseId[resolvedBaseInstanceId] ?? {}) : {};
            const nextByBaseId = resolvedBaseInstanceId
                ? bindEntityScopedValue(
                    prevByBaseId,
                    { entityId: resolvedBaseInstanceId, kind: 'smashup:base' },
                    {
                        ...basePrevById,
                        [playerId]: (basePrevById[playerId] ?? 0) + amount,
                    },
                )
                : state.tempBasePowerModifiersByBaseId;
            return {
                ...state,
                tempBasePowerModifiers: {
                    ...prev,
                    [baseIndex]: {
                        ...basePrev,
                        [playerId]: (basePrev[playerId] ?? 0) + amount,
                    },
                },
                tempBasePowerModifiersByBaseId: nextByBaseId,
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
            const { newBaseDeckDefIds, clearBaseDiscard, newBaseDiscardDefIds } = (event as BaseDeckShuffledEvent).payload;
            return {
                ...state,
                baseDeck: newBaseDeckDefIds,
                baseDiscard: newBaseDiscardDefIds ?? (clearBaseDiscard ? [] : state.baseDiscard),
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
            const normalized = normalizeScoringEligibleBaseIndices(baseIndices);
            return {
                ...state,
                scoringEligibleBaseIndices: normalized.length > 0 ? normalized : undefined,
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
            };
        }

        default:
            return state;
    }
}

