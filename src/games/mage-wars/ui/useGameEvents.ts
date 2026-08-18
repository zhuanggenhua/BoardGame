import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useVisualEventStream } from '../../../components/game/framework/hooks/useVisualEventStream';
import { useVisualStateBuffer, type UseVisualStateBufferReturn } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import type { FxAnchorRef, FxAnchorSnapshot, FxBus } from '../../../engine/fx';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { MatchState } from '../../../engine/types';
import type { MageWarsArenaObjectState, MageWarsCore, MageWarsEvent } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { mapMageWarsEventToFx } from './eventFxMapper';

interface UseMageWarsGameEventsParams {
    G: MatchState<MageWarsCore>;
    fxBus: FxBus;
    resolveFxAnchorSnapshot?: (anchor: FxAnchorRef | string | undefined | null) => FxAnchorSnapshot | null;
}

interface UseMageWarsGameEventsResult {
    damageBuffer: UseVisualStateBufferReturn;
    heldObjects: MageWarsArenaObjectState[];
    onEffectImpact: (id: string) => void;
    onEffectComplete: (id: string) => void;
    debug: {
        eventCount: number;
        latestEntryId: number;
        cursor: number;
        lastConsumedTypes: string[];
        lastFxCues: string[];
    };
}

export function mageWarsPlayerDamageKey(playerId: string): string {
    return `mage-wars:player-damage:${playerId}`;
}

export function mageWarsObjectDamageKey(objectId: string): string {
    return `mage-wars:object-damage:${objectId}`;
}

function getDamageTargetKey(core: MageWarsCore, targetId: string, previousCore?: MageWarsCore): string | null {
    if (core.players[targetId]) return mageWarsPlayerDamageKey(targetId);
    if (core.objects[targetId] ?? previousCore?.objects[targetId]) return mageWarsObjectDamageKey(targetId);
    return null;
}

function getDamageTargetFinalValue(
    core: MageWarsCore,
    previousCore: MageWarsCore | undefined,
    targetId: string,
    damageAmount: number,
): number | null {
    const player = core.players[targetId];
    if (player) return player.damage;
    const object = core.objects[targetId];
    if (object) return object.damage;
    const previousObject = previousCore?.objects[targetId];
    if (previousObject) return Math.min(previousObject.life, previousObject.damage + damageAmount);
    return null;
}

function collectDrivenDamageTargetIds(events: MageWarsEvent[]): Set<string> {
    const result = new Set<string>();
    for (const event of events) {
        if (event.type === MAGE_WARS_EVENTS.ATTACK_DECLARED) {
            result.add(event.payload.defenderId);
            continue;
        }
        if (event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED) {
            if (event.payload.targetPlayerId) result.add(event.payload.targetPlayerId);
            if (event.payload.targetObjectId) result.add(event.payload.targetObjectId);
            continue;
        }
        if (event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED) {
            if (event.payload.targetPlayerId) result.add(event.payload.targetPlayerId);
            if (event.payload.targetObjectId) result.add(event.payload.targetObjectId);
        }
    }
    return result;
}

function collectDamageFreezeEntries(
    events: MageWarsEvent[],
    core: MageWarsCore,
    previousCore?: MageWarsCore,
): {
    entries: Array<{ key: string; value: number }>;
    targetKeys: Map<string, string>;
} {
    const damageByTarget = new Map<string, number>();
    for (const event of events) {
        if (event.type !== 'DAMAGE_DEALT') continue;
        const damage = event.payload.actualDamage ?? event.payload.amount;
        if (damage <= 0) continue;
        damageByTarget.set(event.payload.targetId, (damageByTarget.get(event.payload.targetId) ?? 0) + damage);
    }

    const entries: Array<{ key: string; value: number }> = [];
    const targetKeys = new Map<string, string>();
    for (const [targetId, totalDamage] of damageByTarget) {
        const key = getDamageTargetKey(core, targetId, previousCore);
        const finalDamage = getDamageTargetFinalValue(core, previousCore, targetId, totalDamage);
        if (!key || finalDamage == null) continue;
        targetKeys.set(targetId, key);
        entries.push({ key, value: Math.max(0, finalDamage - totalDamage) });
    }
    return { entries, targetKeys };
}

function getDamageReleaseKeysForEvent(
    event: MageWarsEvent,
    targetKeys: Map<string, string>,
    drivenDamageTargetIds: Set<string>,
): string[] {
    if (event.type === MAGE_WARS_EVENTS.ATTACK_DECLARED) {
        const key = targetKeys.get(event.payload.defenderId);
        return key ? [key] : [];
    }
    if (event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED) {
        const targetId = event.payload.targetPlayerId ?? event.payload.targetObjectId;
        const key = targetId ? targetKeys.get(targetId) : undefined;
        return key ? [key] : [];
    }
    if (event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED) {
        const targetId = event.payload.targetPlayerId ?? event.payload.targetObjectId;
        const key = targetId ? targetKeys.get(targetId) : undefined;
        return key ? [key] : [];
    }
    if (event.type === 'DAMAGE_DEALT' && !drivenDamageTargetIds.has(event.payload.targetId)) {
        const key = targetKeys.get(event.payload.targetId);
        return key ? [key] : [];
    }
    return [];
}

function collectDamageByTarget(events: MageWarsEvent[]): Map<string, number> {
    const damageByTarget = new Map<string, number>();
    for (const event of events) {
        if (event.type !== 'DAMAGE_DEALT') continue;
        const damage = event.payload.actualDamage ?? event.payload.amount;
        if (damage <= 0) continue;
        damageByTarget.set(event.payload.targetId, (damageByTarget.get(event.payload.targetId) ?? 0) + damage);
    }
    return damageByTarget;
}

function collectDefeatedObjectHoldCandidates(
    events: MageWarsEvent[],
    core: MageWarsCore,
    previousCore: MageWarsCore | undefined,
): Map<string, MageWarsArenaObjectState> {
    const damageByTarget = collectDamageByTarget(events);
    const heldObjects = new Map<string, MageWarsArenaObjectState>();

    for (const event of events) {
        if (event.type !== MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED) continue;
        const objectId = event.payload.objectId;
        if (core.objects[objectId]) continue;
        const previousObject = previousCore?.objects[objectId];
        if (!previousObject) continue;
        const damage = damageByTarget.get(objectId) ?? 0;
        heldObjects.set(objectId, {
            ...previousObject,
            damage: Math.min(previousObject.life, previousObject.damage + damage),
        });
    }

    return heldObjects;
}

function getHeldObjectIdsForEvent(
    event: MageWarsEvent,
    heldObjectCandidates: Map<string, MageWarsArenaObjectState>,
): string[] {
    if (event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED) {
        return event.payload.targetObjectId && heldObjectCandidates.has(event.payload.targetObjectId)
            ? [event.payload.targetObjectId]
            : [];
    }
    if (event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED) {
        return event.payload.targetObjectId && heldObjectCandidates.has(event.payload.targetObjectId)
            ? [event.payload.targetObjectId]
            : [];
    }
    if (event.type === 'DAMAGE_DEALT') {
        return heldObjectCandidates.has(event.payload.targetId) ? [event.payload.targetId] : [];
    }
    if (event.type === MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED || event.type === MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED) {
        return event.payload.targetObjectId && heldObjectCandidates.has(event.payload.targetObjectId)
            ? [event.payload.targetObjectId]
            : [];
    }
    return [];
}

export const MAGE_WARS_ARENA_FX_SURFACE_ID = 'mage-wars:arena';

function anchorRef(anchorId: unknown, anchorKind: FxAnchorRef['anchorKind']): FxAnchorRef | null {
    return typeof anchorId === 'string' && anchorId.length > 0
        ? { surfaceId: MAGE_WARS_ARENA_FX_SURFACE_ID, anchorId, anchorKind }
        : null;
}

function resolveInstructionSnapshots(
    instruction: ReturnType<typeof mapMageWarsEventToFx>,
    resolveFxAnchorSnapshot?: UseMageWarsGameEventsParams['resolveFxAnchorSnapshot'],
): ReturnType<typeof mapMageWarsEventToFx> {
    if (!instruction || !resolveFxAnchorSnapshot) return instruction;
    const params = instruction.params ?? {};
    const sourceAnchor = anchorRef(
        params.sourceObjectId ?? params.attackerId ?? params.playerId,
        params.sourceObjectId ? 'entity' : 'player',
    );
    const targetAnchor = anchorRef(
        params.objectId ?? params.targetObjectId ?? params.targetPlayerId ?? params.defenderId ?? params.targetId,
        params.objectId || params.targetObjectId || params.targetId ? 'entity' : 'player',
    );
    const sourceSnapshot = sourceAnchor ? resolveFxAnchorSnapshot(sourceAnchor) : null;
    const targetSnapshot = targetAnchor ? resolveFxAnchorSnapshot(targetAnchor) : null;

    return {
        ...instruction,
        ctx: {
            ...instruction.ctx,
            space: 'board',
            surfaceId: MAGE_WARS_ARENA_FX_SURFACE_ID,
            ...(sourceSnapshot ? { sourceSnapshot } : {}),
            ...(targetSnapshot ? { targetSnapshot } : {}),
        },
        params: {
            ...params,
            ...(sourceSnapshot ? { sourceSnapshot } : {}),
            ...(targetSnapshot ? { targetSnapshot } : {}),
        },
    };
}

export function useMageWarsGameEvents({ G, fxBus, resolveFxAnchorSnapshot }: UseMageWarsGameEventsParams): UseMageWarsGameEventsResult {
    const fxBusRef = useRef(fxBus);
    const fxImpactMapRef = useRef(new Map<string, string[]>());
    const fxHeldObjectMapRef = useRef(new Map<string, string[]>());
    const previousCoreRef = useRef(G.core);
    const damageBuffer = useVisualStateBuffer();
    const [heldObjectMap, setHeldObjectMap] = useState<Map<string, MageWarsArenaObjectState>>(() => new Map());
    const [debug, setDebug] = useState<UseMageWarsGameEventsResult['debug']>(() => ({
        eventCount: 0,
        latestEntryId: 0,
        cursor: -1,
        lastConsumedTypes: [],
        lastFxCues: [],
    }));
    useLayoutEffect(() => {
        fxBusRef.current = fxBus;
    }, [fxBus]);

    const entries = getEventStreamEntries(G);
    const { consumeNew, getCursor } = useVisualEventStream({
        entries,
        strategy: 'requiredSequence',
        consumeInitialEntries: true,
        consumeOnReconcile: true,
    });
    const latestEntryId = entries.at(-1)?.id ?? 0;

    useLayoutEffect(() => {
        const { entries: newEntries, didReset } = consumeNew();
        const consumedTypes: string[] = [];
        const fxCues: string[] = [];
        if (didReset) {
            fxImpactMapRef.current.clear();
            fxHeldObjectMapRef.current.clear();
            damageBuffer.clear();
            setHeldObjectMap(new Map());
        }
        if (newEntries.length === 0) {
            previousCoreRef.current = G.core;
            setDebug((current) => {
                const nextDebug = {
                    eventCount: entries.length,
                    latestEntryId,
                    cursor: getCursor(),
                    lastConsumedTypes: didReset ? consumedTypes : current.lastConsumedTypes,
                    lastFxCues: didReset ? fxCues : current.lastFxCues,
                };
                return current.eventCount === nextDebug.eventCount
                    && current.latestEntryId === nextDebug.latestEntryId
                    && current.cursor === nextDebug.cursor
                    && current.lastConsumedTypes.join(',') === nextDebug.lastConsumedTypes.join(',')
                    && current.lastFxCues.join(',') === nextDebug.lastFxCues.join(',')
                    ? current
                    : nextDebug;
            });
            return;
        }

        const events = newEntries.map((entry) => entry.event as MageWarsEvent);
        const previousCore = previousCoreRef.current;
        consumedTypes.push(...events.map((event) => event.type));
        const drivenDamageTargetIds = collectDrivenDamageTargetIds(events);
        const damageTargets = collectDamageFreezeEntries(events, G.core, previousCore);
        const heldObjectCandidates = collectDefeatedObjectHoldCandidates(events, G.core, previousCore);
        const linkedHeldObjectIds = new Set<string>();
        damageBuffer.freezeBatch(damageTargets.entries);

        for (const entry of newEntries) {
            const event = entry.event as MageWarsEvent;
            if (event.type === 'DAMAGE_DEALT' && drivenDamageTargetIds.has(event.payload.targetId)) {
                continue;
            }
            const instruction = resolveInstructionSnapshots(
                mapMageWarsEventToFx(entry, G.core),
                resolveFxAnchorSnapshot,
            );
            if (!instruction) continue;
            fxCues.push(instruction.cue);
            const fxId = fxBusRef.current.push(instruction.cue, instruction.ctx, instruction.params);
            if (!fxId) continue;
            const releaseKeys = getDamageReleaseKeysForEvent(event, damageTargets.targetKeys, drivenDamageTargetIds);
            if (releaseKeys.length > 0) {
                fxImpactMapRef.current.set(fxId, releaseKeys);
            }
            const heldObjectIds = getHeldObjectIdsForEvent(event, heldObjectCandidates);
            if (heldObjectIds.length > 0) {
                fxHeldObjectMapRef.current.set(fxId, heldObjectIds);
                heldObjectIds.forEach((objectId) => linkedHeldObjectIds.add(objectId));
            }
        }
        if (linkedHeldObjectIds.size > 0) {
            setHeldObjectMap((current) => {
                const next = new Map(current);
                for (const objectId of linkedHeldObjectIds) {
                    const object = heldObjectCandidates.get(objectId);
                    if (object && !G.core.objects[objectId]) next.set(objectId, object);
                }
                return next;
            });
        }
        const nextDebug = {
            eventCount: entries.length,
            latestEntryId,
            cursor: getCursor(),
            lastConsumedTypes: consumedTypes,
            lastFxCues: fxCues,
        };
        setDebug((current) => (
            current.eventCount === nextDebug.eventCount
            && current.latestEntryId === nextDebug.latestEntryId
            && current.cursor === nextDebug.cursor
            && current.lastConsumedTypes.join(',') === nextDebug.lastConsumedTypes.join(',')
            && current.lastFxCues.join(',') === nextDebug.lastFxCues.join(',')
                ? current
                : nextDebug
        ));
        previousCoreRef.current = G.core;

    }, [G.core, damageBuffer, entries.length, latestEntryId, consumeNew, getCursor, entries]);

    const onEffectImpact = useCallback((id: string) => {
        const releaseKeys = fxImpactMapRef.current.get(id);
        if (!releaseKeys) return;
        damageBuffer.release(releaseKeys);
        fxImpactMapRef.current.delete(id);
    }, [damageBuffer]);

    const onEffectComplete = useCallback((id: string) => {
        fxImpactMapRef.current.delete(id);
        const completedHeldObjectIds = fxHeldObjectMapRef.current.get(id) ?? [];
        fxHeldObjectMapRef.current.delete(id);
        if (completedHeldObjectIds.length === 0) return;
        const stillHeldObjectIds = new Set(Array.from(fxHeldObjectMapRef.current.values()).flat());
        setHeldObjectMap((current) => {
            const next = new Map(current);
            for (const objectId of completedHeldObjectIds) {
                if (!stillHeldObjectIds.has(objectId)) next.delete(objectId);
            }
            return next;
        });
    }, []);

    return {
        damageBuffer,
        heldObjects: Array.from(heldObjectMap.values()),
        onEffectImpact,
        onEffectComplete,
        debug,
    };
}
