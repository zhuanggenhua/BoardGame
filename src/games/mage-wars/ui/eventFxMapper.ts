import type { FxCellCoord, FxContext, FxParams } from '../../../engine/fx';
import type { EventStreamEntry, PlayerId } from '../../../engine/types';
import type { MageWarsCore, MageWarsEvent } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import type { ArenaZoneId } from '../domain/ids';
import { MW_FX, type MageWarsFxCue } from './fxCues';

export interface MageWarsFxInstruction {
    sourceEventId: number;
    cue: MageWarsFxCue;
    ctx: FxContext;
    params?: FxParams;
}

function resolveZoneCell(core: MageWarsCore, zoneId?: ArenaZoneId): FxCellCoord | null {
    if (!zoneId) return null;
    const zone = core.arena.find((candidate) => candidate.id === zoneId);
    return zone ? { row: zone.row, col: zone.col } : null;
}

export function resolvePlayerCell(core: MageWarsCore, playerId?: PlayerId): FxCellCoord | null {
    if (!playerId) return null;
    return resolveZoneCell(core, core.players[playerId]?.mageZoneId);
}

function resolveObjectCell(core: MageWarsCore, objectId?: string): FxCellCoord | null {
    if (!objectId) return null;
    return resolveZoneCell(core, core.objects[objectId]?.zoneId);
}

function resolveIntensity(amount: number | undefined): FxContext['intensity'] {
    return amount !== undefined && amount >= 6 ? 'strong' : 'normal';
}

export function mapMageWarsEventToFx(
    entry: EventStreamEntry,
    core: MageWarsCore,
): MageWarsFxInstruction | null {
    const event = entry.event as MageWarsEvent;

    if (event.type === MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED) {
        return null;
    }

    if (event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED) {
        const { object } = event.payload;
        if (object.kind !== 'creature' && object.kind !== 'conjuration') return null;

        const target = resolveZoneCell(core, object.zoneId);
        if (!target) return null;

        return {
            sourceEventId: entry.id,
            cue: MW_FX.SUMMON,
            ctx: {
                cell: target,
                intensity: object.life >= 6 ? 'strong' : 'normal',
            },
            params: {
                objectId: object.id,
                objectKind: object.kind,
                ownerId: object.ownerId,
                sourceSpellCardId: object.sourceSpellCardId,
            },
        };
    }

    if (event.type === MAGE_WARS_EVENTS.ATTACK_DECLARED) {
        const payload = event.payload;
        const source = resolvePlayerCell(core, payload.attackerId);
        const target = resolvePlayerCell(core, payload.defenderId);
        if (!target) return null;

        return {
            sourceEventId: entry.id,
            cue: MW_FX.ATTACK_IMPACT,
            ctx: {
                cell: target,
                intensity: resolveIntensity(payload.baseDamage),
            },
            params: {
                source,
                attackerId: payload.attackerId,
                defenderId: payload.defenderId,
                targetPlayerId: payload.defenderId,
                diceResults: payload.diceResults,
                damageAmount: payload.baseDamage,
            },
        };
    }

    if (event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED) {
        const payload = event.payload;
        const source = resolveObjectCell(core, payload.attackerObjectId);
        const target = resolveZoneCell(core, payload.targetZoneId)
            ?? resolvePlayerCell(core, payload.targetPlayerId)
            ?? resolveObjectCell(core, payload.targetObjectId);
        if (!target) return null;

        return {
            sourceEventId: entry.id,
            cue: MW_FX.ATTACK_IMPACT,
            ctx: {
                cell: target,
                intensity: resolveIntensity(payload.baseDamage),
            },
            params: {
                source,
                attackerId: payload.attackerObjectId,
                sourceObjectId: payload.attackerObjectId,
                defenderId: payload.targetPlayerId ?? payload.targetObjectId,
                targetPlayerId: payload.targetPlayerId,
                targetObjectId: payload.targetObjectId,
                attackProfileId: payload.attackProfileId,
                targetZoneId: payload.targetZoneId,
                diceResults: payload.diceResults,
                effectDieResult: payload.effectDieResult,
                damageAmount: payload.baseDamage,
            },
        };
    }

    if (event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED) {
        const payload = event.payload;
        const source = resolveZoneCell(core, payload.chainSourceZoneId)
            ?? resolvePlayerCell(core, payload.playerId);
        const target = resolvePlayerCell(core, payload.targetPlayerId)
            ?? resolveObjectCell(core, payload.targetObjectId)
            ?? resolveZoneCell(core, payload.targetZoneId);
        if (!target) return null;

        return {
            sourceEventId: entry.id,
            cue: MW_FX.ATTACK_IMPACT,
            ctx: {
                cell: target,
                intensity: resolveIntensity(payload.baseDamage),
            },
            params: {
                source,
                attackerId: payload.playerId,
                defenderId: payload.targetPlayerId ?? payload.targetObjectId,
                targetPlayerId: payload.targetPlayerId,
                targetObjectId: payload.targetObjectId,
                targetZoneId: payload.targetZoneId,
                spellCardId: payload.spellCardId,
                sourceAbilityId: payload.sourceAbilityId,
                diceResults: payload.diceResults,
                effectDieResult: payload.effectDieResult,
                damageAmount: payload.baseDamage,
            },
        };
    }

    if (event.type === MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED) {
        const payload = event.payload;
        const source = resolveZoneCell(core, payload.fromZoneId);
        const target = resolveZoneCell(core, payload.toZoneId);
        if (!target) return null;

        return {
            sourceEventId: entry.id,
            cue: MW_FX.SPELL_PUSH,
            ctx: {
                cell: target,
                intensity: 'normal',
            },
            params: {
                source,
                playerId: payload.playerId,
                spellCardId: payload.spellCardId,
                sourceAbilityId: payload.sourceAbilityId,
                targetPlayerId: payload.targetPlayerId,
                targetObjectId: payload.targetObjectId,
                fromZoneId: payload.fromZoneId,
                toZoneId: payload.toZoneId,
            },
        };
    }

    if (event.type === MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED) {
        const payload = event.payload;
        const target = resolveObjectCell(core, payload.targetObjectId)
            ?? resolvePlayerCell(core, payload.targetPlayerId)
            ?? resolveZoneCell(core, payload.targetZoneId);
        if (!target) return null;

        return {
            sourceEventId: entry.id,
            cue: MW_FX.HEALING_IMPACT,
            ctx: {
                cell: target,
                intensity: resolveIntensity(payload.actualHealing),
            },
            params: {
                targetPlayerId: payload.targetPlayerId,
                targetObjectId: payload.targetObjectId,
                targetZoneId: payload.targetZoneId,
                spellCardId: payload.spellCardId,
                sourceAbilityId: payload.sourceAbilityId,
                diceResults: payload.diceResults,
                healingAmount: payload.healing,
                actualHealing: payload.actualHealing,
            },
        };
    }

    if (event.type === MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED) {
        const payload = event.payload;
        const source = resolveZoneCell(core, payload.fromZoneId);
        const target = resolveZoneCell(core, payload.toZoneId);
        if (!target) return null;

        return {
            sourceEventId: entry.id,
            cue: MW_FX.SPELL_TELEPORT,
            ctx: {
                cell: target,
                intensity: payload.distance > 1 ? 'strong' : 'normal',
            },
            params: {
                source,
                playerId: payload.playerId,
                spellCardId: payload.spellCardId,
                sourceAbilityId: payload.sourceAbilityId,
                targetObjectId: payload.targetObjectId,
                fromZoneId: payload.fromZoneId,
                toZoneId: payload.toZoneId,
                distance: payload.distance,
            },
        };
    }

    if (event.type === 'DAMAGE_DEALT') {
        const payload = event.payload;
        const target = resolvePlayerCell(core, payload.targetId)
            ?? resolveObjectCell(core, payload.targetId);
        if (!target) return null;

        const damageAmount = payload.actualDamage ?? payload.amount;
        return {
            sourceEventId: entry.id,
            cue: MW_FX.DAMAGE_IMPACT,
            ctx: {
                cell: target,
                intensity: resolveIntensity(damageAmount),
            },
            params: {
                targetId: payload.targetId,
                damageAmount,
                sourceAbilityId: payload.sourceAbilityId,
            },
        };
    }

    return null;
}
