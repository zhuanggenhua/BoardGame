import type { MageWarsArenaObjectState, MageWarsCore, MageWarsEvent, MageWarsPlayerState } from './types';
import { MAGE_WARS_EVENTS } from './events';
import { STATUS_TOKEN_IDS, type StatusTokenId } from './ids';
import {
    addArenaObject,
    moveArenaOccupant,
    moveArenaObject,
    removeArenaObject,
    updateArenaObject,
    updatePlayer,
} from './utils';
import { resolveMageWarsObjectEffectiveLife } from './spellRules';
import {
    applyMovementTemporaryTraits,
    applyObjectAbilityTemporaryGrants,
    applyTemporaryTraitGain,
    clearPostMoveAttackTraits,
    clearTemporaryTraits,
    hasExpiredRoundScopedTemporaryTraits,
} from './temporaryTraits';
import { recordObjectAbilityUseInRound } from './objectAbilityUsage';

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

function removeStatusTokenAmount(
    statusTokens: Partial<Record<StatusTokenId, number>>,
    statusTokenId: StatusTokenId,
    amount: number,
): Partial<Record<StatusTokenId, number>> {
    const current = statusTokens[statusTokenId] ?? 0;
    const nextAmount = Math.max(0, current - amount);
    const next = { ...statusTokens };
    if (nextAmount > 0) {
        next[statusTokenId] = nextAmount;
    } else {
        delete next[statusTokenId];
    }
    return next;
}

function clearDefenseUsesThisRound(object: MageWarsArenaObjectState): MageWarsArenaObjectState {
    if (!object.defenseUsesThisRound) return object;
    const { defenseUsesThisRound: _defenseUsesThisRound, ...readyObject } = object;
    return readyObject;
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

        case MAGE_WARS_EVENTS.SPELL_DISCARDED:
            return updatePlayer(core, event.payload.playerId, (player) => ({
                ...player,
                discardSpellCardIds: player.discardSpellCardIds.includes(event.payload.spellCardId)
                    ? player.discardSpellCardIds
                    : [event.payload.spellCardId, ...(player.discardSpellCardIds ?? [])],
            }));

        case MAGE_WARS_EVENTS.SPELL_COUNTERED:
            if (event.payload.responseCardId !== 1825) return core;
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
                    actionReady: event.payload.actionCost === 'normal' ? false : object.actionReady,
                    boundSpellCardId: event.payload.boundSpellCardId === undefined
                        ? object.boundSpellCardId
                        : event.payload.boundSpellCardId,
                }, event.payload.grants)
            ));
            if (!event.payload.actionTrack) return resolved;
            return updatePlayer(resolved, event.payload.ownerId, (player) => ({
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

        case MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED:
            return addArenaObject(core, event.payload.object);

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
            const moved = moveArenaObject(
                core,
                event.payload.objectId,
                event.payload.fromZoneId,
                event.payload.toZoneId,
            );
            const isTeleportMove = event.payload.movementMode === 'teleport';
            return updateArenaObject(moved, event.payload.objectId, (object) => (
                applyMovementTemporaryTraits({
                    ...object,
                    actionReady: event.payload.actionCost === 'none' ? object.actionReady : false,
                    guarding: false,
                }, {
                    actionCost: event.payload.actionCost,
                    isTeleportMove,
                })
            ));
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

        case MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED:
            return moveArenaObject(
                core,
                event.payload.targetObjectId,
                event.payload.fromZoneId,
                event.payload.toZoneId,
            );

        case MAGE_WARS_EVENTS.ENCHANTMENT_STOLEN: {
            const moved = event.payload.fromZoneId === event.payload.toZoneId
                ? core
                : moveArenaObject(
                    core,
                    event.payload.objectId,
                    event.payload.fromZoneId,
                    event.payload.toZoneId,
                );
            return updateArenaObject(moved, event.payload.objectId, (object) => ({
                ...object,
                ownerId: event.payload.ownerId,
                zoneId: event.payload.toZoneId,
                anchoredToPlayerId: event.payload.targetPlayerId,
                anchoredToObjectId: event.payload.targetObjectId,
                anchoredToZoneId: event.payload.targetZoneId,
            }));
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

        case MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED:
            if (event.payload.targetPlayerId) {
                return updatePlayer(core, event.payload.targetPlayerId, (player) => ({
                    ...player,
                    guarding: event.payload.statusTokenId === STATUS_TOKEN_IDS.STUN ? false : player.guarding,
                    statusTokens: {
                        ...player.statusTokens,
                        [event.payload.statusTokenId]: (player.statusTokens[event.payload.statusTokenId] ?? 0) + event.payload.amount,
                    },
                }));
            }
            if (event.payload.targetObjectId) {
                return updateArenaObject(core, event.payload.targetObjectId, (object) => ({
                    ...object,
                    guarding: event.payload.statusTokenId === STATUS_TOKEN_IDS.STUN ? false : object.guarding,
                    statusTokens: {
                        ...object.statusTokens,
                        [event.payload.statusTokenId]: (object.statusTokens[event.payload.statusTokenId] ?? 0) + event.payload.amount,
                    },
                }));
            }
            return core;

        case MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED:
            if (event.payload.targetPlayerId) {
                return updatePlayer(core, event.payload.targetPlayerId, (player) => ({
                    ...player,
                    statusTokens: removeStatusTokenAmount(
                        player.statusTokens,
                        event.payload.statusTokenId,
                        event.payload.amount,
                    ),
                }));
            }
            if (event.payload.targetObjectId) {
                return updateArenaObject(core, event.payload.targetObjectId, (object) => ({
                    ...object,
                    statusTokens: removeStatusTokenAmount(
                        object.statusTokens,
                        event.payload.statusTokenId,
                        event.payload.amount,
                    ),
                }));
            }
            return core;

        case MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED:
            return removeArenaObject(core, event.payload.objectId);

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
                updateArenaObject(nextCore, objectId, (object) => ({
                    ...object,
                    actionReady: true,
                    guarding: false,
                }))
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
