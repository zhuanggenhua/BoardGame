import type { MageWarsArenaObjectState, MageWarsCore, MageWarsEvent, MageWarsPlayerState } from './types';
import { MAGE_WARS_EVENTS } from './events';
import {
    addArenaObject,
    moveArenaOccupant,
    moveArenaObject,
    removeArenaObject,
    updateArenaObject,
    updatePlayer,
} from './utils';
import {
    isMageWarsLivingArenaObject,
    isMageWarsQuickSpellCounterResponseCardId,
    resolveMageWarsObjectEffectiveLife,
    resolveMageWarsZoneMaxMovementActionsPerTurn,
} from './spellRules';
import {
    applyMovementTemporaryTraits,
    applyObjectAbilityTemporaryGrants,
    applyTemporaryTraitGain,
    clearPostMoveAttackTraits,
    clearTemporaryTraits,
    hasExpiredRoundScopedTemporaryTraits,
} from './temporaryTraits';
import { recordObjectAbilityUseInRound } from './objectAbilityUsage';
import { applyStatusTokenPlacement, applyStatusTokenRemoval } from './statusTokens';

function removePreparedSpell(preparedSpellCardIds: number[], spellCardId: number): number[] {
    let removed = false;
    return preparedSpellCardIds.filter((candidate) => {
        if (!removed && candidate === spellCardId) {
            removed = true;
            return false;
        }
        return true;
    });
}

function removeOneCard(cardIds: readonly number[], spellCardId: number): number[] {
    let removed = false;
    return cardIds.filter((candidate) => {
        if (!removed && candidate === spellCardId) {
            removed = true;
            return false;
        }
        return true;
    });
}

function clearDefenseUsesThisRound(object: MageWarsArenaObjectState): MageWarsArenaObjectState {
    if (!object.defenseUsesThisRound) return object;
    const { defenseUsesThisRound: _defenseUsesThisRound, ...readyObject } = object;
    return readyObject;
}

function applyMovementTurnFacts(
    object: MageWarsArenaObjectState,
    movementLimits: readonly number[],
    countsAsMovementAction: boolean,
): MageWarsArenaObjectState {
    const movementLimit = movementLimits.length > 0
        ? Math.min(...movementLimits)
        : object.movementActionsLimitThisTurn;
    return {
        ...object,
        ...(countsAsMovementAction
            ? { movementActionsUsedThisTurn: (object.movementActionsUsedThisTurn ?? 0) + 1 }
            : {}),
        ...(movementLimit === undefined ? {} : {
            movementActionsLimitThisTurn: object.movementActionsLimitThisTurn === undefined
                ? movementLimit
                : Math.min(object.movementActionsLimitThisTurn, movementLimit),
        }),
    };
}

function clearPlayerDefenseUsesThisRound(player: MageWarsPlayerState): MageWarsPlayerState {
    if (!player.defenseUsesThisRound) return player;
    const { defenseUsesThisRound: _defenseUsesThisRound, ...readyPlayer } = player;
    return readyPlayer;
}

function markPhaseReady(core: MageWarsCore, playerId: string): MageWarsCore {
    const ready = core.phaseReadyPlayerIds ?? [];
    return ready.includes(playerId)
        ? core
        : { ...core, phaseReadyPlayerIds: [...ready, playerId] };
}

function collectAttachedArenaObjectIds(core: MageWarsCore, rootObjectId: string): Set<string> {
    const objectIds = new Set<string>([rootObjectId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const object of Object.values(core.objects)) {
            if (object.anchoredToObjectId && objectIds.has(object.anchoredToObjectId) && !objectIds.has(object.id)) {
                objectIds.add(object.id);
                changed = true;
            }
        }
    }
    return objectIds;
}

function removeArenaObjectPlacement(core: MageWarsCore, rootObjectId: string): MageWarsCore {
    const objectIds = collectAttachedArenaObjectIds(core, rootObjectId);
    return {
        ...core,
        arena: core.arena.map((zone) => ({
            ...zone,
            objectIds: zone.objectIds.filter((objectId) => !objectIds.has(objectId)),
            conjurationIds: zone.conjurationIds.filter((objectId) => !objectIds.has(objectId)),
        })),
    };
}

function recordDeathMarkAttackUse(
    core: MageWarsCore,
    sourceObjectIds: string[] | undefined,
    attackerObjectId: string,
    roundNumber: number | undefined,
): MageWarsCore {
    if (!sourceObjectIds?.length || roundNumber === undefined) return core;

    return sourceObjectIds.reduce((nextCore, sourceObjectId) => updateArenaObject(
        nextCore,
        sourceObjectId,
        (source) => {
            const attackerObjectIds = source.deathMarkRoundNumber === roundNumber
                ? (source.deathMarkAttackerObjectIdsThisRound ?? [])
                : [];
            if (attackerObjectIds.includes(attackerObjectId)) return source;
            return {
                ...source,
                deathMarkRoundNumber: roundNumber,
                deathMarkAttackerObjectIdsThisRound: [...attackerObjectIds, attackerObjectId],
            };
        },
    ), core);
}

function recordMentalCalmTrigger(
    core: MageWarsCore,
    sourceObjectIds: string[],
    attackerObjectId: string,
    roundNumber: number,
): MageWarsCore {
    return sourceObjectIds.reduce((nextCore, sourceObjectId) => updateArenaObject(
        nextCore,
        sourceObjectId,
        (source) => {
            const attackerObjectIds = source.mentalCalmRoundNumber === roundNumber
                ? (source.mentalCalmAttackerObjectIdsThisRound ?? [])
                : [];
            if (attackerObjectIds.includes(attackerObjectId)) return source;
            return {
                ...source,
                mentalCalmRoundNumber: roundNumber,
                mentalCalmAttackerObjectIdsThisRound: [...attackerObjectIds, attackerObjectId],
            };
        },
    ), core);
}

function recordMeleeAttackManaTaxTrigger(
    core: MageWarsCore,
    sourceObjectIds: string[],
    attackerObjectId: string,
    roundNumber: number,
): MageWarsCore {
    return sourceObjectIds.reduce((nextCore, sourceObjectId) => updateArenaObject(
        nextCore,
        sourceObjectId,
        (source) => {
            const attackerObjectIds = source.meleeAttackManaTaxRoundNumber === roundNumber
                ? (source.meleeAttackManaTaxAttackerObjectIdsThisRound ?? [])
                : [];
            if (attackerObjectIds.includes(attackerObjectId)) return source;
            return {
                ...source,
                meleeAttackManaTaxRoundNumber: roundNumber,
                meleeAttackManaTaxAttackerObjectIdsThisRound: [...attackerObjectIds, attackerObjectId],
            };
        },
    ), core);
}

function recordDamageBarrierTrigger(
    core: MageWarsCore,
    sourceObjectId: string,
    attackerId: string,
    roundNumber: number,
): MageWarsCore {
    return updateArenaObject(core, sourceObjectId, (source) => {
        const attackerIds = source.damageBarrierRoundNumber === roundNumber
            ? (source.damageBarrierAttackerIdsThisRound ?? [])
            : [];
        if (attackerIds.includes(attackerId)) return source;
        return {
            ...source,
            damageBarrierRoundNumber: roundNumber,
            damageBarrierAttackerIdsThisRound: [...attackerIds, attackerId],
        };
    });
}

function applyArenaObjectAttackActionCost(
    core: MageWarsCore,
    attackerObjectId: string,
    actionCost?: 'normal' | 'none',
): MageWarsCore {
    if (actionCost === 'none') return core;

    const attacker = core.objects[attackerObjectId];
    if (!attacker) return core;
    if (attacker.kind === 'equipment' && attacker.anchoredToPlayerId) {
        return updatePlayer(core, attacker.anchoredToPlayerId, (player) => ({
            ...player,
            actionReady: false,
            guarding: false,
        }));
    }

    return updateArenaObject(core, attackerObjectId, (object) => (
        clearPostMoveAttackTraits({
            ...object,
            actionReady: false,
            guarding: false,
        })
    ));
}

function clearRousedTurnFact(object: MageWarsArenaObjectState): MageWarsArenaObjectState {
    if (object.rousedBySpellTurnNumber === undefined) return object;
    const { rousedBySpellTurnNumber: _rousedBySpellTurnNumber, ...nextObject } = object;
    return nextObject;
}

function clearRousedTurnFacts(core: MageWarsCore): MageWarsCore {
    return Object.values(core.objects).reduce((nextCore, object) => (
        object.rousedBySpellTurnNumber === undefined
            ? nextCore
            : updateArenaObject(nextCore, object.id, clearRousedTurnFact)
    ), core);
}

function clearExpiredRoundScopedTemporaryTraits(
    core: MageWarsCore,
    roundNumber: number,
): MageWarsCore {
    return Object.values(core.objects).reduce((nextCore, object) => (
        hasExpiredRoundScopedTemporaryTraits(object, roundNumber)
            ? updateArenaObject(nextCore, object.id, (current) => clearTemporaryTraits(current, ['meleeDice']))
            : nextCore
    ), core);
}

export function reduceEvent(core: MageWarsCore, event: MageWarsEvent): MageWarsCore {
    switch (event.type) {
        case MAGE_WARS_EVENTS.SPELLS_PLANNED:
            return markPhaseReady(updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                preparedSpellCardIds: [...event.payload.spellCardIds],
                preparedSpellSlots: event.payload.spellCardIds.length,
            })), event.payload.playerId);

        case MAGE_WARS_EVENTS.OBJECT_SPELL_PLANNED:
            return updateArenaObject(core, event.payload.objectId, (object) => ({
                ...object,
                preparedSpellCardId: event.payload.spellCardId,
                preparedSpellCount: 1,
            }));

        case MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED:
            return updateArenaObject(core, event.payload.objectId, (object) => ({
                ...object,
                mana: (object.mana ?? 0) + event.payload.amount,
            }));

        case MAGE_WARS_EVENTS.OBJECT_SPELL_RETURNED:
            return updateArenaObject(core, event.payload.objectId, (object) => (
                object.preparedSpellCardId !== event.payload.spellCardId
                    ? object
                    : {
                        ...object,
                        preparedSpellCardId: undefined,
                        preparedSpellCount: undefined,
                    }
            ));

        case MAGE_WARS_EVENTS.MANA_CHANNELED:
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                mana: player.mana + event.payload.amount,
            }));

        case MAGE_WARS_EVENTS.MANA_SPENT:
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                mana: Math.max(0, player.mana - event.payload.amount),
            }));

        case MAGE_WARS_EVENTS.MANA_DRAINED:
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                mana: Math.max(0, player.mana - event.payload.amount),
            }));

        case MAGE_WARS_EVENTS.MANA_TRANSFERRED: {
            const afterDrain = updatePlayer(core, event.payload.fromPlayerId, (player) => ({
                ...player,
                mana: Math.max(0, player.mana - event.payload.amount),
            }));
            return updatePlayer(afterDrain, event.payload.toPlayerId, (player) => ({
                ...player,
                mana: player.mana + event.payload.amount,
            }));
        }

        case MAGE_WARS_EVENTS.AREA_CONJURATION_MANA_GAINED:
            return updateArenaObject(core, event.payload.objectId, (object) => {
                if (object.kind !== 'conjuration' || object.sourceSpellCardId !== 2209) return object;
                const targetObjectIds = object.pentagramRoundNumber === event.payload.roundNumber
                    ? (object.pentagramTargetObjectIdsThisRound ?? [])
                    : [];
                if (targetObjectIds.length >= 2 || targetObjectIds.includes(event.payload.targetObjectId)) {
                    return object;
                }
                return {
                    ...object,
                    mana: (object.mana ?? 0) + event.payload.amount,
                    pentagramRoundNumber: event.payload.roundNumber,
                    pentagramTargetObjectIdsThisRound: [
                        ...targetObjectIds,
                        event.payload.targetObjectId,
                    ],
                };
            });

        case MAGE_WARS_EVENTS.SPELL_CAST_STARTED:
            if (event.payload.caster.kind === 'arena-object') {
                const objectManaCost = event.payload.objectManaCost ?? 0;
                const playerManaCost = event.payload.playerManaCost ?? Math.max(0, event.payload.manaCost - objectManaCost);
                const paidObject = updateArenaObject(core, event.payload.caster.objectId, (object) => ({
                    ...object,
                    mana: Math.max(0, (object.mana ?? 0) - objectManaCost),
                    preparedSpellCardId: undefined,
                    preparedSpellCount: undefined,
                    actionReady: event.payload.castMode === 'action' ? false : object.actionReady,
                    guarding: event.payload.castMode === 'action' ? false : object.guarding,
                }));
                return updatePlayer(paidObject, event.payload.playerId, (player) => ({
                    ...player,
                    mana: Math.max(0, player.mana - playerManaCost),
                }));
            }
            return updatePlayer(core, event.payload.playerId, (player) => {
                const preparedSpellCardIds = removePreparedSpell(
                    player.preparedSpellCardIds,
                    event.payload.spellCardId,
                );
                return {
                    ...player,
                    mana: Math.max(0, player.mana - (event.payload.playerManaCost ?? event.payload.manaCost)),
                    preparedSpellCardIds,
                    preparedSpellSlots: preparedSpellCardIds.length,
                    quickcastReady: event.payload.castMode === 'quickcast' ? false : player.quickcastReady,
                    actionReady: event.payload.castMode === 'action' ? false : player.actionReady,
                    guarding: event.payload.castMode === 'action' ? false : player.guarding,
                };
            });

        case MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED:
            if (event.payload.paymentAlreadyApplied === true) {
                return updatePlayer(core, event.payload.playerId, (player) => ({
                    ...player,
                    discardSpellCardIds: player.discardSpellCardIds.includes(event.payload.spellCardId)
                        ? player.discardSpellCardIds
                        : [event.payload.spellCardId, ...(player.discardSpellCardIds ?? [])],
                }));
            }
            if (event.payload.boundSourceObjectId) {
                return updatePlayer(core, event.payload.playerId, (player) => ({
                    ...player,
                    mana: Math.max(0, player.mana - (event.payload.playerManaCost ?? event.payload.manaCost)),
                    quickcastReady: event.payload.castMode === 'quickcast' ? false : player.quickcastReady,
                    actionReady: event.payload.castMode === 'action' ? false : player.actionReady,
                    guarding: event.payload.castMode === 'action' ? false : player.guarding,
                }));
            }
            if (event.payload.caster.kind === 'arena-object') {
                const objectManaCost = event.payload.objectManaCost ?? 0;
                const playerManaCost = event.payload.playerManaCost ?? Math.max(0, event.payload.manaCost - objectManaCost);
                const paidObject = updateArenaObject(core, event.payload.caster.objectId, (object) => ({
                    ...object,
                    mana: Math.max(0, (object.mana ?? 0) - objectManaCost),
                    preparedSpellCardId: undefined,
                    preparedSpellCount: undefined,
                    actionReady: event.payload.castMode === 'action' ? false : object.actionReady,
                    guarding: event.payload.castMode === 'action' ? false : object.guarding,
                }));
                return updatePlayer(paidObject, event.payload.playerId, (player) => ({
                    ...player,
                    mana: Math.max(0, player.mana - playerManaCost),
                    discardSpellCardIds: [event.payload.spellCardId, ...(player.discardSpellCardIds ?? [])],
                }));
            }
            return updatePlayer(core, event.payload.playerId, (player) => {
                const preparedSpellCardIds = removePreparedSpell(
                    player.preparedSpellCardIds,
                    event.payload.spellCardId,
                );
                return {
                    ...player,
                    mana: Math.max(0, player.mana - (event.payload.playerManaCost ?? event.payload.manaCost)),
                    preparedSpellCardIds,
                    preparedSpellSlots: preparedSpellCardIds.length,
                    discardSpellCardIds: [event.payload.spellCardId, ...(player.discardSpellCardIds ?? [])],
                    quickcastReady: event.payload.castMode === 'quickcast' ? false : player.quickcastReady,
                    actionReady: event.payload.castMode === 'action' ? false : player.actionReady,
                    guarding: event.payload.castMode === 'action' ? false : player.guarding,
                };
            });

        case MAGE_WARS_EVENTS.SPELL_COST_REDUCTION_USED:
            return updateArenaObject(core, event.payload.sourceObjectId, (object) => (
                recordObjectAbilityUseInRound(object, event.payload.sourceAbilityId, event.payload.roundNumber)
            ));

        case MAGE_WARS_EVENTS.SPELL_DISCARDED:
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                discardSpellCardIds: player.discardSpellCardIds.includes(event.payload.spellCardId)
                    ? player.discardSpellCardIds
                : [event.payload.spellCardId, ...(player.discardSpellCardIds ?? [])],
            }));

        case MAGE_WARS_EVENTS.DEFEATED_CREATURE_CARD_CONSUMED:
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                defeatedLivingCreatureCardIds: removeOneCard(
                    player.defeatedLivingCreatureCardIds ?? [],
                    event.payload.spellCardId,
                ),
                discardSpellCardIds: removeOneCard(
                    player.discardSpellCardIds ?? [],
                    event.payload.spellCardId,
                ),
            }));

        case MAGE_WARS_EVENTS.SPELL_COUNTERED:
            if (!isMageWarsQuickSpellCounterResponseCardId(event.payload.responseCardId)) return core;
            if (event.payload.caster?.kind === 'arena-object') {
                const object = core.objects[event.payload.caster.objectId];
                if (!object) return core;
                const objectManaCost = event.payload.objectManaCost ?? 0;
                const playerManaCost = event.payload.playerManaCost ?? Math.max(0, event.payload.manaCost - objectManaCost);
                const restoredObject = updateArenaObject(core, object.id, (current) => ({
                    ...current,
                    mana: (current.mana ?? 0) + objectManaCost,
                    preparedSpellCardId: event.payload.spellCardId,
                    preparedSpellCount: 1,
                }));
                return updatePlayer(restoredObject, event.payload.spellOwnerId, (player) => ({
                    ...player,
                    mana: player.mana + playerManaCost,
                }));
            }
            return updatePlayer(core, event.payload.spellOwnerId, (player) => {
                const preparedSpellCardIds = [event.payload.spellCardId, ...removePreparedSpell(
                    player.preparedSpellCardIds,
                    event.payload.spellCardId,
                )];
                return {
                    ...player,
                    mana: player.mana + event.payload.manaCost,
                    preparedSpellCardIds,
                    preparedSpellSlots: preparedSpellCardIds.length,
                };
            });

        case MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED:
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                mana: Math.max(0, player.mana - event.payload.manaCost),
                quickcastReady: event.payload.actionTrack === 'quickcast' ? false : player.quickcastReady,
                actionReady: event.payload.actionTrack === 'action' ? false : player.actionReady,
                guarding: event.payload.actionTrack === 'action' ? false : player.guarding,
            }));

        case MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED: {
            const paid = updatePlayer(core, event.payload.ownerId, (player) => ({
                ...player,
                mana: Math.max(0, player.mana - event.payload.manaCost),
            }));
            const resolved = updateArenaObject(paid, event.payload.objectId, (object) => (
                applyObjectAbilityTemporaryGrants({
                    ...recordObjectAbilityUseInRound(
                        object,
                        event.payload.abilityId,
                        event.payload.roundNumber,
                    ),
                    mana: event.payload.manaGain === undefined
                        ? object.mana
                        : (object.mana ?? 0) + event.payload.manaGain,
                    actionReady: event.payload.actionCost === 'normal' ? false : object.actionReady,
                    boundSpellCardId: event.payload.boundSpellCardId === undefined
                        ? object.boundSpellCardId
                        : event.payload.boundSpellCardId,
                }, event.payload.grants)
            ));
            const targetSpent = event.payload.targetActionCost === 'normal' && event.payload.targetObjectId
                ? updateArenaObject(resolved, event.payload.targetObjectId, (object) => ({
                    ...object,
                    actionReady: false,
                    guarding: false,
                }))
                : resolved;
            if (!event.payload.actionTrack) return targetSpent;
            return updatePlayer(targetSpent, event.payload.ownerId, (player) => ({
                ...player,
                quickcastReady: event.payload.actionTrack === 'quickcast' ? false : player.quickcastReady,
                actionReady: event.payload.actionTrack === 'action' ? false : player.actionReady,
                guarding: event.payload.actionTrack === 'action' ? false : player.guarding,
            }));
        }

        case MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED:
            return updateArenaObject(core, event.payload.objectId, (object) => (
                applyTemporaryTraitGain(object, event.payload)
            ));

        case MAGE_WARS_EVENTS.BATTLE_FURY_AVAILABLE:
            return updateArenaObject(core, event.payload.attackerObjectId, (object) => (
                object.temporaryTraits?.battleFuryRoundNumber === event.payload.roundNumber
                    ? {
                        ...object,
                        temporaryTraits: {
                            ...object.temporaryTraits,
                            battleFuryExtraAttackAvailable: true,
                        },
                    }
                    : object
            ));

        case MAGE_WARS_EVENTS.BATTLE_FURY_CONSUMED:
            return updateArenaObject(core, event.payload.attackerObjectId, (object) => (
                clearTemporaryTraits(object, ['battleFury'])
            ));

        case MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED:
            {
                const nextSequence = core.nextObjectSequence
                    ?? Math.max(
                        0,
                        ...Object.values(core.objects).map((object) => object.createdAtSequence ?? 0),
                    ) + 1;
                const object = {
                    ...event.payload.object,
                    createdAtSequence: event.payload.object.createdAtSequence ?? nextSequence,
                    createdAtTimestamp: event.payload.object.createdAtTimestamp ?? event.timestamp,
                };
                return {
                    ...addArenaObject(core, object),
                    nextObjectSequence: Math.max(nextSequence + 1, core.nextObjectSequence ?? 0),
                };
            }

        case MAGE_WARS_EVENTS.ARENA_OBJECT_BANISHED: {
            const target = core.objects[event.payload.objectId];
            if (!target || target.kind !== 'creature') return core;
            const detached = removeArenaObjectPlacement(core, target.id);
            return updateArenaObject(detached, target.id, (object) => ({
                ...object,
                banished: {
                    remainingTokens: event.payload.remainingTokens,
                    returnToZoneId: event.payload.returnToZoneId,
                    sourceSpellCardId: event.payload.spellCardId,
                },
            }));
        }

        case MAGE_WARS_EVENTS.ARENA_OBJECT_BANISH_TICKED: {
            const target = core.objects[event.payload.objectId];
            if (!target?.banished) return core;
            if (target.banished.remainingTokens > 1) {
                return updateArenaObject(core, target.id, (object) => ({
                    ...object,
                    banished: {
                        ...object.banished!,
                        remainingTokens: object.banished!.remainingTokens - 1,
                    },
                }));
            }
            const restored = moveArenaObject(
                core,
                target.id,
                target.banished.returnToZoneId,
                target.banished.returnToZoneId,
            );
            return updateArenaObject(restored, target.id, (object) => {
                const { banished: _banished, ...restoredObject } = object;
                return restoredObject;
            });
        }

        case MAGE_WARS_EVENTS.WALL_SUMMONED:
            return {
                ...core,
                walls: {
                    ...(core.walls ?? {}),
                    [event.payload.wall.edgeId]: event.payload.wall,
                },
            };

        case MAGE_WARS_EVENTS.WALL_PASSAGE_DAMAGE_TRIGGERED:
            return core;

        case MAGE_WARS_EVENTS.ENCHANTMENT_REVEALED:
            return updateArenaObject(core, event.payload.objectId, (object) => ({
                ...object,
                revealed: true,
            }));

        case MAGE_WARS_EVENTS.ARENA_OBJECT_ROUSED:
            return updateArenaObject(core, event.payload.objectId, (object) => ({
                ...object,
                actionReady: true,
                rousedBySpellTurnNumber: event.payload.turnNumber,
            }));

        case MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED:
            return updateArenaObject(core, event.payload.objectId, (object) => ({
                ...object,
                restrainedByObjectId: event.payload.restrainedByObjectId,
            }));

        case MAGE_WARS_EVENTS.MAGE_MOVED: {
            const moved = moveArenaOccupant(
                core,
                event.payload.playerId,
                event.payload.fromZoneId,
                event.payload.toZoneId,
            );
            const movedPlayer = updatePlayer(moved, event.payload.playerId, (player) => ({
                ...player,
                mageZoneId: event.payload.toZoneId,
                actionReady: false,
                guarding: false,
            }));
            return Object.values(movedPlayer.objects)
                .filter((object) => object.anchoredToPlayerId === event.payload.playerId)
                .reduce((nextCore, object) => (
                    object.zoneId === event.payload.toZoneId
                        ? nextCore
                        : moveArenaObject(nextCore, object.id, object.zoneId, event.payload.toZoneId)
                ), movedPlayer);
        }

        case MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED: {
            const movingObject = core.objects[event.payload.objectId];
            const movementLimits = movingObject && isMageWarsLivingArenaObject(movingObject)
                ? [
                    resolveMageWarsZoneMaxMovementActionsPerTurn(core, event.payload.fromZoneId),
                    resolveMageWarsZoneMaxMovementActionsPerTurn(core, event.payload.toZoneId),
                ].filter((value): value is number => value !== undefined)
                : [];
            const moved = moveArenaObject(
                core,
                event.payload.objectId,
                event.payload.fromZoneId,
                event.payload.toZoneId,
            );
            const isTeleportMove = event.payload.movementMode === 'teleport';
            return updateArenaObject(moved, event.payload.objectId, (object) => {
                const movementTraitsApplied = applyMovementTemporaryTraits({
                    ...object,
                    actionReady: event.payload.actionCost === 'none' ? object.actionReady : false,
                    guarding: false,
                }, {
                    actionCost: event.payload.actionCost,
                    isTeleportMove,
                });
                return applyMovementTurnFacts(movementTraitsApplied, movementLimits, !isTeleportMove);
            });
        }

        case MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED:
            return updateArenaObject(core, event.payload.objectId, (object) => (
                clearTemporaryTraits(object, event.payload.traitIds)
            ));

        case MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED: {
            if (event.payload.targetPlayerId) {
                const moved = moveArenaOccupant(
                    core,
                    event.payload.targetPlayerId,
                    event.payload.fromZoneId,
                    event.payload.toZoneId,
                );
                return updatePlayer(moved, event.payload.targetPlayerId, (player) => ({
                    ...player,
                    mageZoneId: event.payload.toZoneId,
                }));
            }
            if (event.payload.targetObjectId) {
                return moveArenaObject(
                    core,
                    event.payload.targetObjectId,
                    event.payload.fromZoneId,
                    event.payload.toZoneId,
                );
            }
            return core;
        }

        case MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED: {
            const target = core.objects[event.payload.targetObjectId];
            const movementLimits = target && isMageWarsLivingArenaObject(target)
                ? [
                    resolveMageWarsZoneMaxMovementActionsPerTurn(core, event.payload.fromZoneId),
                    resolveMageWarsZoneMaxMovementActionsPerTurn(core, event.payload.toZoneId),
                ].filter((value): value is number => value !== undefined)
                : [];
            const moved = moveArenaObject(
                core,
                event.payload.targetObjectId,
                event.payload.fromZoneId,
                event.payload.toZoneId,
            );
            return updateArenaObject(moved, event.payload.targetObjectId, (object) => (
                applyMovementTurnFacts(object, movementLimits, false)
            ));
        }

        case MAGE_WARS_EVENTS.ENCHANTMENT_STOLEN: {
            const moved = event.payload.fromZoneId === event.payload.toZoneId
                ? core
                : moveArenaObject(
                    core,
                    event.payload.objectId,
                    event.payload.fromZoneId,
                    event.payload.toZoneId,
                );
            const nextSequence = moved.nextObjectSequence
                ?? Math.max(
                    0,
                    ...Object.values(moved.objects).map((object) => object.createdAtSequence ?? 0),
                ) + 1;
            return {
                ...updateArenaObject(moved, event.payload.objectId, (object) => ({
                    ...object,
                    ownerId: event.payload.ownerId,
                    zoneId: event.payload.toZoneId,
                    anchoredToPlayerId: event.payload.targetPlayerId,
                    anchoredToObjectId: event.payload.targetObjectId,
                    anchoredToZoneId: event.payload.targetZoneId,
                    createdAtSequence: nextSequence,
                    createdAtTimestamp: event.timestamp,
                })),
                nextObjectSequence: Math.max(nextSequence + 1, moved.nextObjectSequence ?? 0),
            };
        }

        case MAGE_WARS_EVENTS.ENCHANTMENT_REATTACHED: {
            const moved = event.payload.fromZoneId === event.payload.toZoneId
                ? core
                : moveArenaObject(
                    core,
                    event.payload.objectId,
                    event.payload.fromZoneId,
                    event.payload.toZoneId,
                );
            const nextSequence = moved.nextObjectSequence
                ?? Math.max(
                    0,
                    ...Object.values(moved.objects).map((object) => object.createdAtSequence ?? 0),
                ) + 1;
            return {
                ...updateArenaObject(moved, event.payload.objectId, (object) => ({
                    ...object,
                    ownerId: event.payload.ownerId,
                    zoneId: event.payload.toZoneId,
                    anchoredToPlayerId: event.payload.targetPlayerId,
                    anchoredToObjectId: event.payload.targetObjectId,
                    anchoredToZoneId: event.payload.targetZoneId,
                    createdAtSequence: nextSequence,
                    createdAtTimestamp: event.timestamp,
                })),
                nextObjectSequence: Math.max(nextSequence + 1, moved.nextObjectSequence ?? 0),
            };
        }

        case MAGE_WARS_EVENTS.GUARD_GAINED:
            if (event.payload.targetObjectId) {
                return updateArenaObject(core, event.payload.targetObjectId, (object) => ({
                    ...object,
                    actionReady: false,
                    guarding: true,
                }));
            }
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                actionReady: false,
                guarding: true,
            }));

        case MAGE_WARS_EVENTS.GUARD_REMOVED:
            return updateArenaObject(core, event.payload.targetObjectId, (object) => (
                object.guarding
                    ? { ...object, guarding: false }
                    : object
            ));

        case MAGE_WARS_EVENTS.FEAR_HELMET_TRIGGERED:
            return updateArenaObject(core, event.payload.helmetObjectId, (object) => {
                const attackerRefId = event.payload.attackerObjectId ?? event.payload.attackerId;
                if (!attackerRefId) {
                    throw new Error('Mage Wars fear helmet trigger requires an attacker reference');
                }
                const attackerObjectIds = object.fearHelmetRoundNumber === event.payload.roundNumber
                    ? (object.fearHelmetAttackerObjectIdsThisRound ?? [])
                    : [];
                if (attackerObjectIds.includes(attackerRefId)) return object;
                return {
                    ...object,
                    fearHelmetRoundNumber: event.payload.roundNumber,
                    fearHelmetAttackerObjectIdsThisRound: [
                        ...attackerObjectIds,
                        attackerRefId,
                    ],
                };
            });

        case MAGE_WARS_EVENTS.DEFENSE_AVAILABLE:
            if (event.payload.attackerObjectId) {
                return applyArenaObjectAttackActionCost(
                    core,
                    event.payload.attackerObjectId,
                    event.payload.actionCost,
                );
            }
            if (event.payload.attackerId && event.payload.actionCost !== 'none') {
                return updatePlayer(core, event.payload.attackerId, (player) => ({
                    ...player,
                    actionReady: false,
                    guarding: false,
                }));
            }
            return core;

        case MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED:
            return updateArenaObject(core, event.payload.defenderObjectId, (object) => ({
                ...object,
                defenseUsesThisRound: {
                    ...object.defenseUsesThisRound,
                    [event.payload.defenseProfileId]: (object.defenseUsesThisRound?.[event.payload.defenseProfileId] ?? 0) + 1,
                },
            }));

        case MAGE_WARS_EVENTS.MAGE_DEFENSE_ROLLED:
            return updatePlayer(core, event.payload.defenderId, (player) => ({
                ...player,
                defenseUsesThisRound: {
                    ...player.defenseUsesThisRound,
                    [event.payload.defenseProfileId]: (player.defenseUsesThisRound?.[event.payload.defenseProfileId] ?? 0) + 1,
                },
            }));

        case MAGE_WARS_EVENTS.ATTACK_DECLARED:
            return updatePlayer(core, event.payload.attackerId, (player) => ({
                ...player,
                actionReady: false,
                guarding: false,
            }));

        case MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED:
            return recordMentalCalmTrigger(
                core,
                event.payload.sourceObjectIds,
                event.payload.attackerObjectId,
                event.payload.roundNumber,
            );

        case MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED:
            return recordMeleeAttackManaTaxTrigger(
                core,
                event.payload.sourceObjectIds,
                event.payload.attackerObjectId,
                event.payload.roundNumber,
            );

        case MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED:
            return recordDamageBarrierTrigger(
                core,
                event.payload.sourceObjectId,
                event.payload.attackerObjectId ?? event.payload.attackerId ?? '',
                event.payload.roundNumber,
            );

        case MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED:
            return recordDeathMarkAttackUse(
                applyArenaObjectAttackActionCost(
                    core,
                    event.payload.attackerObjectId,
                    event.payload.actionCost,
                ),
                event.payload.deathMarkSourceObjectIds,
                event.payload.attackerObjectId,
                event.payload.deathMarkRoundNumber,
            );

        case 'DAMAGE_DEALT': {
            const damage = event.payload.actualDamage ?? event.payload.amount;
            if (core.players[event.payload.targetId]) {
                return updatePlayer(core, event.payload.targetId, (player) => ({
                    ...player,
                    damage: Math.min(player.life, player.damage + damage),
                }));
            }
            return updateArenaObject(core, event.payload.targetId, (object) => ({
                ...object,
                damage: Math.min(resolveMageWarsObjectEffectiveLife(core, object), object.damage + damage),
            }));
        }

        case MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED:
            if (event.payload.targetPlayerId) {
                return updatePlayer(core, event.payload.targetPlayerId, (player) => ({
                    ...player,
                    damage: Math.max(0, player.damage - event.payload.actualHealing),
                }));
            }
            if (event.payload.targetObjectId) {
                return updateArenaObject(core, event.payload.targetObjectId, (object) => ({
                    ...object,
                    damage: Math.max(0, object.damage - event.payload.actualHealing),
                }));
            }
            return core;

        case MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED:
            return updateArenaObject(core, event.payload.objectId, (object) => ({
                ...object,
                damage: Math.max(0, object.damage - event.payload.actualHealing),
            }));

        case MAGE_WARS_EVENTS.MAGE_REGENERATED:
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                damage: Math.max(0, player.damage - event.payload.actualHealing),
            }));

        case MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED:
            if (event.payload.targetPlayerId) {
                return updatePlayer(core, event.payload.targetPlayerId, (player) => (
                    applyStatusTokenPlacement(player, event.payload.statusTokenId, event.payload.amount)
                ));
            }
            if (event.payload.targetObjectId) {
                return updateArenaObject(core, event.payload.targetObjectId, (object) => (
                    applyStatusTokenPlacement(object, event.payload.statusTokenId, event.payload.amount)
                ));
            }
            return core;

        case MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED:
            if (event.payload.targetPlayerId) {
                return updatePlayer(core, event.payload.targetPlayerId, (player) => (
                    applyStatusTokenRemoval(player, event.payload.statusTokenId, event.payload.amount)
                ));
            }
            if (event.payload.targetObjectId) {
                return updateArenaObject(core, event.payload.targetObjectId, (object) => (
                    applyStatusTokenRemoval(object, event.payload.statusTokenId, event.payload.amount)
                ));
            }
            return core;

        case MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED: {
            const defeated = core.objects[event.payload.objectId];
            const removed = removeArenaObject(core, event.payload.objectId);
            if (!defeated) return removed;
            if (defeated.sourceSpellCardId !== 1811 && !isMageWarsLivingArenaObject(defeated)) return removed;
            return updatePlayer(removed, defeated.ownerId, (player) => ({
                ...player,
                ...(defeated.sourceSpellCardId === 1811 ? { mana: player.mana + 2 } : {}),
                ...(isMageWarsLivingArenaObject(defeated)
                    ? {
                        defeatedLivingCreatureCardIds: [
                            ...(player.defeatedLivingCreatureCardIds ?? []),
                            defeated.sourceSpellCardId,
                        ],
                    }
                    : {}),
            }));
        }

        case MAGE_WARS_EVENTS.MAGE_DEFEATED:
            return {
                ...core,
                gameResult: {
                    winner: event.payload.winnerId,
                },
            };

        case MAGE_WARS_EVENTS.TURN_ADVANCED:
            return clearRousedTurnFacts({
                ...core,
                currentPlayerId: event.payload.toPlayerId,
                turnNumber: event.payload.turnNumber,
            });

        case MAGE_WARS_EVENTS.ACTION_READINESS_RESET: {
            const roundTraitsCleared = clearExpiredRoundScopedTemporaryTraits(core, core.turnNumber);
            const resetPlayer = updatePlayer(roundTraitsCleared, event.payload.playerId, (player) => ({
                ...player,
                actionReady: true,
                quickcastReady: true,
                guarding: false,
            }));
            const resetActions = (event.payload.objectIds ?? []).reduce((nextCore, objectId) => (
                updateArenaObject(nextCore, objectId, (object) => {
                    const resetObject = object.banished
                        ? object
                        : {
                            ...object,
                            actionReady: true,
                            guarding: false,
                        };
                    const {
                        movementActionsUsedThisTurn: _movementActionsUsedThisTurn,
                        movementActionsLimitThisTurn: _movementActionsLimitThisTurn,
                        ...movementFactsCleared
                    } = resetObject;
                    return movementFactsCleared;
                })
                ), resetPlayer);
            const resetPlayerDefense = updatePlayer(resetActions, event.payload.playerId, clearPlayerDefenseUsesThisRound);
            return Object.values(resetPlayerDefense.objects).reduce((nextCore, object) => (
                object.ownerId === event.payload.playerId
                    ? updateArenaObject(nextCore, object.id, clearDefenseUsesThisRound)
                    : nextCore
            ), resetPlayerDefense);
        }

        default:
            return core;
    }
}
