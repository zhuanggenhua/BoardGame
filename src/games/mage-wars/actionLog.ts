import type {
    ActionLogEntry,
    ActionLogSegment,
    Command,
    GameEvent,
    PlayerId,
} from '../../engine/types';
import { FLOW_COMMANDS, FLOW_EVENTS } from '../../engine/systems/FlowSystem';
import { MAGE_WARS_COMMANDS } from './domain/commands';
import { MAGE_WARS_EVENTS } from './domain/events';
import type {
    MageWarsActionReadinessResetEvent,
    MageWarsArenaObjectAbilityResolvedEvent,
    MageWarsArenaObjectAttackDeclaredEvent,
    MageWarsArenaObjectDefeatedEvent,
    MageWarsArenaObjectDefenseRolledEvent,
    MageWarsArenaObjectMovedEvent,
    MageWarsArenaObjectRegeneratedEvent,
    MageWarsArenaObjectSummonedEvent,
    MageWarsArenaObjectTemporaryTraitsClearedEvent,
    MageWarsAttackDeclaredEvent,
    MageWarsAttackMissedEvent,
    MageWarsCounterstrikeAvailableEvent,
    MageWarsDamageDealtEvent,
    MageWarsDefenseAvailableEvent,
    MageWarsGuardGainedEvent,
    MageWarsGuardRemovedEvent,
    MageWarsMageAbilityResolvedEvent,
    MageWarsMageDefeatedEvent,
    MageWarsMageMovedEvent,
    MageWarsManaChanneledEvent,
    MageWarsManaDrainedEvent,
    MageWarsSpellAttackRolledEvent,
    MageWarsSpellCastResolvedEvent,
    MageWarsSpellDirectDamageRolledEvent,
    MageWarsSpellHealingRolledEvent,
    MageWarsSpellPushResolvedEvent,
    MageWarsSpellTeleportResolvedEvent,
    MageWarsStatusTokenPlacedEvent,
    MageWarsStatusTokenRemovedEvent,
    MageWarsSpellsPlannedEvent,
    MageWarsTurnAdvancedEvent,
} from './domain/events';
import { getMageWarsSpellCardName, getMageWarsSpellCardPreviewRef } from './ui/cardAtlas';

export const ACTION_ALLOWLIST = [
    MAGE_WARS_COMMANDS.PLAN_SPELLS,
    MAGE_WARS_COMMANDS.CAST_SPELL,
    MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
    MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
    MAGE_WARS_COMMANDS.MOVE_MAGE,
    MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
    MAGE_WARS_COMMANDS.GUARD,
    MAGE_WARS_COMMANDS.DECLARE_ATTACK,
    MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
    MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
    MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE,
    FLOW_COMMANDS.ADVANCE_PHASE,
] as const;

export const UNDO_ALLOWLIST = [
    MAGE_WARS_COMMANDS.PLAN_SPELLS,
    MAGE_WARS_COMMANDS.CAST_SPELL,
    MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
    MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
    MAGE_WARS_COMMANDS.MOVE_MAGE,
    MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
    MAGE_WARS_COMMANDS.GUARD,
    MAGE_WARS_COMMANDS.DECLARE_ATTACK,
    MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
    MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK,
    MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE,
    FLOW_COMMANDS.ADVANCE_PHASE,
] as const;

const MW_NS = 'game-mage-wars';

const i18nSeg = (
    key: string,
    params?: Record<string, string | number>,
    paramI18nKeys?: string[],
): ActionLogSegment => ({
    type: 'i18n',
    ns: MW_NS,
    key,
    ...(params ? { params } : {}),
    ...(paramI18nKeys ? { paramI18nKeys } : {}),
});

function zoneKey(zoneId: string): string {
    return `zones.${zoneId}`;
}

function buildSpellCardSegment(cardId: number): ActionLogSegment {
    const id = String(cardId);
    return {
        type: 'card',
        cardId: id,
        previewText: getMageWarsSpellCardName(id) ?? id,
        previewRef: getMageWarsSpellCardPreviewRef(id) ?? undefined,
    };
}

function pushEntry(
    entries: ActionLogEntry[],
    kind: string,
    actorId: PlayerId,
    timestamp: number,
    segments: ActionLogSegment[],
    index: number,
): void {
    entries.push({
        id: `${kind}-${actorId}-${timestamp}-${index}`,
        timestamp,
        actorId,
        kind,
        segments,
    });
}

function eventTimestamp(event: GameEvent, fallback: number): number {
    return typeof event.timestamp === 'number' ? event.timestamp : fallback;
}

function appendTargetSegments(
    segments: ActionLogSegment[],
    payload: { targetPlayerId?: PlayerId; targetObjectId?: string; targetZoneId?: string },
): void {
    if (payload.targetPlayerId) {
        segments.push(i18nSeg('actionLog.targetPlayer', { targetPlayerId: payload.targetPlayerId }));
    }
    if (payload.targetObjectId) {
        segments.push(i18nSeg('actionLog.targetObject', { targetObjectId: payload.targetObjectId }));
    }
    if (payload.targetZoneId) {
        segments.push(
            i18nSeg('actionLog.targetZone', { zone: zoneKey(payload.targetZoneId) }, ['zone']),
        );
    }
}

function formatPhaseChangedEvent(event: GameEvent, fallbackTimestamp: number): ActionLogEntry | null {
    if (event.type !== FLOW_EVENTS.PHASE_CHANGED) return null;
    const payload = event.payload as { to?: string; activePlayerId?: PlayerId } | undefined;
    if (!payload?.to || !payload.activePlayerId) return null;
    return {
        id: `${event.type}-${payload.activePlayerId}-${eventTimestamp(event, fallbackTimestamp)}`,
        timestamp: eventTimestamp(event, fallbackTimestamp),
        actorId: payload.activePlayerId,
        kind: event.type,
        segments: [
            i18nSeg('actionLog.phaseChanged', { phase: `phases.${payload.to}` }, ['phase']),
        ],
    };
}

export function formatMageWarsActionEntry({
    command,
    events,
}: {
    command: Command;
    events: GameEvent[];
}): ActionLogEntry | ActionLogEntry[] | null {
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const entries: ActionLogEntry[] = [];

    events.forEach((event, index) => {
        const entryTimestamp = eventTimestamp(event, timestamp);
        switch (event.type) {
            case FLOW_EVENTS.PHASE_CHANGED: {
                const entry = formatPhaseChangedEvent(event, timestamp);
                if (entry) entries.push({ ...entry, id: `${entry.id}-${index}` });
                break;
            }
            case MAGE_WARS_EVENTS.SPELLS_PLANNED: {
                const payload = (event as MageWarsSpellsPlannedEvent).payload;
                const segments: ActionLogSegment[] = [
                    i18nSeg('actionLog.spellsPlanned', { count: payload.spellCardIds.length }),
                ];
                payload.spellCardIds.forEach((spellCardId, spellIndex) => {
                    if (spellIndex > 0) segments.push(i18nSeg('actionLog.separator.card'));
                    segments.push(buildSpellCardSegment(spellCardId));
                });
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, segments, index);
                break;
            }
            case MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED: {
                const payload = (event as MageWarsSpellCastResolvedEvent).payload;
                const segments: ActionLogSegment[] = [
                    i18nSeg('actionLog.spellCast'),
                    buildSpellCardSegment(payload.spellCardId),
                    i18nSeg('actionLog.spellCastCost', { manaCost: payload.manaCost }),
                ];
                appendTargetSegments(segments, payload);
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, segments, index);
                break;
            }
            case MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED: {
                const payload = (event as MageWarsMageAbilityResolvedEvent).payload;
                const segments: ActionLogSegment[] = [
                    i18nSeg('actionLog.mageAbilityResolved', {
                        abilityName: payload.abilityName,
                        manaCost: payload.manaCost,
                    }),
                ];
                appendTargetSegments(segments, payload);
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, segments, index);
                break;
            }
            case MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED: {
                const payload = (event as MageWarsArenaObjectAbilityResolvedEvent).payload;
                const segments: ActionLogSegment[] = [
                    i18nSeg('actionLog.arenaObjectAbilityResolved', {
                        objectId: payload.objectId,
                        abilityName: payload.abilityName,
                        manaCost: payload.manaCost,
                    }),
                ];
                appendTargetSegments(segments, payload);
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, segments, index);
                break;
            }
            case MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED: {
                const payload = (event as MageWarsArenaObjectTemporaryTraitsClearedEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.arenaObjectTemporaryTraitsCleared', {
                        objectId: payload.objectId,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED: {
                const payload = (event as MageWarsArenaObjectSummonedEvent).payload;
                pushEntry(entries, event.type, payload.object.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.arenaObjectSummoned', {
                        objectName: payload.object.name,
                        zone: zoneKey(payload.object.zoneId),
                    }, ['zone']),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED: {
                const payload = (event as MageWarsSpellAttackRolledEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.spellAttackRolled'),
                    buildSpellCardSegment(payload.spellCardId),
                    i18nSeg('actionLog.spellAttackDice', {
                        targetId: payload.targetPlayerId ?? payload.targetObjectId ?? '',
                        dice: payload.diceResults.join('+'),
                        damage: payload.baseDamage,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_ROLLED: {
                const payload = (event as MageWarsSpellDirectDamageRolledEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.spellDirectDamageRolled'),
                    buildSpellCardSegment(payload.spellCardId),
                    i18nSeg('actionLog.spellDirectDamageDice', {
                        targetId: payload.targetPlayerId ?? payload.targetObjectId ?? '',
                        dice: payload.diceResults.join('+'),
                        damage: payload.directDamage,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED: {
                const payload = (event as MageWarsSpellHealingRolledEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.spellHealingRolled'),
                    buildSpellCardSegment(payload.spellCardId),
                    i18nSeg('actionLog.spellHealingDice', {
                        targetId: payload.targetPlayerId ?? payload.targetObjectId ?? '',
                        dice: payload.diceResults.join('+'),
                        healing: payload.actualHealing,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED: {
                const payload = (event as MageWarsSpellPushResolvedEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.spellPushResolved'),
                    buildSpellCardSegment(payload.spellCardId),
                    i18nSeg('actionLog.spellPushTarget', {
                        targetId: payload.targetPlayerId ?? payload.targetObjectId ?? '',
                        from: zoneKey(payload.fromZoneId),
                        to: zoneKey(payload.toZoneId),
                    }, ['from', 'to']),
                ], index);
                break;
            }            case MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED: {
                const payload = (event as MageWarsSpellTeleportResolvedEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.spellTeleportResolved'),
                    buildSpellCardSegment(payload.spellCardId),
                    i18nSeg('actionLog.spellTeleportTarget', {
                        targetId: payload.targetObjectId,
                        from: zoneKey(payload.fromZoneId),
                        to: zoneKey(payload.toZoneId),
                        distance: payload.distance,
                    }, ['from', 'to']),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.MANA_CHANNELED: {
                const payload = (event as MageWarsManaChanneledEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.manaChanneled', { amount: payload.amount }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.MANA_DRAINED: {
                const payload = (event as MageWarsManaDrainedEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.manaDrained', {
                        amount: payload.amount,
                        requestedAmount: payload.requestedAmount,
                        targetId: payload.targetPlayerId ?? payload.targetObjectId ?? '',
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.MAGE_MOVED: {
                const payload = (event as MageWarsMageMovedEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.mageMoved', {
                        from: zoneKey(payload.fromZoneId),
                        to: zoneKey(payload.toZoneId),
                    }, ['from', 'to']),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED: {
                const payload = (event as MageWarsArenaObjectMovedEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.arenaObjectMoved', {
                        objectId: payload.objectId,
                        from: zoneKey(payload.fromZoneId),
                        to: zoneKey(payload.toZoneId),
                    }, ['from', 'to']),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.GUARD_GAINED: {
                const payload = (event as MageWarsGuardGainedEvent).payload;
                if (payload.targetObjectId) {
                    pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                        i18nSeg('actionLog.guardGainedObject', { objectId: payload.targetObjectId }),
                    ], index);
                    break;
                }
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.guardGained'),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.GUARD_REMOVED: {
                const payload = (event as MageWarsGuardRemovedEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.guardRemoved', { objectId: payload.targetObjectId }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE: {
                const payload = (event as MageWarsCounterstrikeAvailableEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.counterstrikeAvailable', {
                        defenderObjectId: payload.defenderObjectId,
                        attackerObjectId: payload.attackerObjectId,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.DEFENSE_AVAILABLE: {
                const payload = (event as MageWarsDefenseAvailableEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.defenseAvailable', {
                        defenderObjectId: payload.defenderObjectId ?? payload.defenderId ?? '',
                        attackerObjectId: payload.attackerObjectId ?? payload.attackerId ?? '',
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ATTACK_DECLARED: {
                const payload = (event as MageWarsAttackDeclaredEvent).payload;
                pushEntry(entries, event.type, payload.attackerId, entryTimestamp, [
                    i18nSeg('actionLog.attackDeclared', {
                        defenderId: payload.defenderId,
                        dice: payload.diceResults.join('+'),
                        damage: payload.baseDamage,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED: {
                const payload = (event as MageWarsArenaObjectAttackDeclaredEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.arenaObjectAttackDeclared', {
                        attackerObjectId: payload.attackerObjectId,
                        targetId: payload.targetPlayerId ?? payload.targetObjectId ?? '',
                        dice: payload.diceResults.join('+'),
                        damage: payload.baseDamage,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ATTACK_MISSED: {
                const payload = (event as MageWarsAttackMissedEvent).payload;
                const key = payload.immunityDamageTypes?.length
                    ? 'actionLog.attackMissedByImmunity'
                    : payload.defenseProfileId
                        ? 'actionLog.attackMissedByDefense'
                        : 'actionLog.attackMissedByDaze';
                pushEntry(entries, event.type, payload.attackerId ?? payload.attackerObjectId ?? 'unknown', entryTimestamp, [
                    i18nSeg(key, {
                        targetId: payload.targetPlayerId ?? payload.targetObjectId ?? '',
                        effectDie: payload.effectDieResult ?? '',
                        defenseProfileId: payload.defenseProfileId ?? '',
                        damageTypes: payload.immunityDamageTypes?.join(' / ') ?? '',
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED: {
                const payload = (event as MageWarsArenaObjectDefenseRolledEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.arenaObjectDefenseRolled', {
                        defenderObjectId: payload.defenderObjectId,
                        rawEffectDie: payload.rawEffectDieResult,
                        modifier: payload.defenseDieModifier,
                        modifiedEffectDie: payload.modifiedEffectDieResult,
                        minRoll: payload.defenseMinRoll,
                        result: payload.success ? 'actionLog.defenseResult.success' : 'actionLog.defenseResult.fail',
                    }, ['result']),
                ], index);
                break;
            }
            case 'DAMAGE_DEALT': {
                const payload = (event as MageWarsDamageDealtEvent).payload;
                pushEntry(entries, event.type, payload.targetId, entryTimestamp, [
                    i18nSeg('actionLog.damageDealt', {
                        amount: payload.actualDamage ?? payload.amount,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED: {
                const payload = (event as MageWarsStatusTokenPlacedEvent).payload;
                pushEntry(entries, event.type, payload.targetPlayerId ?? payload.targetObjectId ?? 'unknown', entryTimestamp, [
                    i18nSeg('actionLog.statusTokenPlaced', {
                        status: `tokens.${payload.statusTokenId}`,
                        amount: payload.amount,
                    }, ['status']),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED: {
                const payload = (event as MageWarsStatusTokenRemovedEvent).payload;
                pushEntry(entries, event.type, payload.targetPlayerId ?? payload.targetObjectId ?? 'unknown', entryTimestamp, [
                    i18nSeg('actionLog.statusTokenRemoved', {
                        status: `tokens.${payload.statusTokenId}`,
                        amount: payload.amount,
                    }, ['status']),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED: {
                const payload = (event as MageWarsArenaObjectRegeneratedEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.arenaObjectRegenerated', {
                        objectId: payload.objectId,
                        healing: payload.actualHealing,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED: {
                const payload = (event as MageWarsArenaObjectDefeatedEvent).payload;
                pushEntry(entries, event.type, payload.ownerId, entryTimestamp, [
                    i18nSeg('actionLog.arenaObjectDefeated', { objectId: payload.objectId }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.MAGE_DEFEATED: {
                const payload = (event as MageWarsMageDefeatedEvent).payload;
                pushEntry(entries, event.type, payload.defeatedPlayerId, entryTimestamp, [
                    i18nSeg('actionLog.mageDefeated', { winnerId: payload.winnerId }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.TURN_ADVANCED: {
                const payload = (event as MageWarsTurnAdvancedEvent).payload;
                pushEntry(entries, event.type, payload.toPlayerId, entryTimestamp, [
                    i18nSeg('actionLog.turnAdvanced', {
                        toPlayerId: payload.toPlayerId,
                        turnNumber: payload.turnNumber,
                    }),
                ], index);
                break;
            }
            case MAGE_WARS_EVENTS.ACTION_READINESS_RESET: {
                const payload = (event as MageWarsActionReadinessResetEvent).payload;
                pushEntry(entries, event.type, payload.playerId, entryTimestamp, [
                    i18nSeg('actionLog.readinessReset'),
                ], index);
                break;
            }
            default:
                break;
        }
    });

    if (entries.length === 0) return null;
    if (entries.length === 1) return entries[0];
    return entries;
}
