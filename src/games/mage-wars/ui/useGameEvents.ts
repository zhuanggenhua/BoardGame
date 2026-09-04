import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useVisualEntityBuffer } from '../../../components/game/framework/hooks/useVisualEntityBuffer';
import { useVisualEventStream } from '../../../components/game/framework/hooks/useVisualEventStream';
import { useVisualStateBuffer, type UseVisualStateBufferReturn } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import { scheduleFxFrameCallback, type FxAnchorRef, type FxAnchorSnapshot, type FxBus, type FxFrameSubscription } from '../../../engine/fx';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { MatchState } from '../../../engine/types';
import type { MageWarsArenaObjectState, MageWarsCore, MageWarsEvent } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { mapMageWarsEventToFx } from './eventFxMapper';
import { MW_FX } from './fxCues';

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

function addHeldObjectCandidatesToCore(
    core: MageWarsCore,
    heldObjectCandidates: Map<string, MageWarsArenaObjectState>,
): MageWarsCore {
    if (heldObjectCandidates.size === 0) return core;

    let nextCore = core;
    for (const object of heldObjectCandidates.values()) {
        if (nextCore.objects[object.id]) continue;
        nextCore = {
            ...nextCore,
            objects: {
                ...nextCore.objects,
                [object.id]: object,
            },
            arena: nextCore.arena.map((zone) => (
                zone.id === object.zoneId
                    ? { ...zone, objectIds: [...new Set([...zone.objectIds, object.id])] }
                    : zone
            )),
        };
    }
    return nextCore;
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

function anchorSnapshotCacheKey(anchorKind: FxAnchorRef['anchorKind'], anchorId: string): string {
    return `${anchorKind}:${anchorId}`;
}

function isFxAnchorSnapshot(value: unknown): value is FxAnchorSnapshot {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<FxAnchorSnapshot>;
    return typeof candidate.surfaceId === 'string'
        && typeof candidate.anchorId === 'string'
        && typeof candidate.anchorKind === 'string'
        && candidate.box != null
        && typeof candidate.box.left === 'number'
        && typeof candidate.box.top === 'number'
        && typeof candidate.box.width === 'number'
        && typeof candidate.box.height === 'number';
}

function getRelocationMovedAnchor(event: MageWarsEvent): Pick<FxAnchorRef, 'anchorId' | 'anchorKind'> | null {
    if (event.type === MAGE_WARS_EVENTS.MAGE_MOVED) {
        return { anchorId: event.payload.playerId, anchorKind: 'player' };
    }
    if (event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED) {
        return { anchorId: event.payload.objectId, anchorKind: 'entity' };
    }
    if (event.type === MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED) {
        if (event.payload.targetObjectId) return { anchorId: event.payload.targetObjectId, anchorKind: 'entity' };
        if (event.payload.targetPlayerId) return { anchorId: event.payload.targetPlayerId, anchorKind: 'player' };
    }
    if (event.type === MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED) {
        return { anchorId: event.payload.targetObjectId, anchorKind: 'entity' };
    }
    return null;
}

function attachRelocationSourceSnapshot(
    event: MageWarsEvent,
    instruction: ReturnType<typeof mapMageWarsEventToFx>,
    previousAnchorSnapshots: Map<string, FxAnchorSnapshot>,
): ReturnType<typeof mapMageWarsEventToFx> {
    if (!instruction) return instruction;
    const movedAnchor = getRelocationMovedAnchor(event);
    if (!movedAnchor) return instruction;
    const params = instruction.params ?? {};
    if (isFxAnchorSnapshot(params.sourceSnapshot)) return instruction;
    const sourceSnapshot = previousAnchorSnapshots.get(anchorSnapshotCacheKey(movedAnchor.anchorKind, movedAnchor.anchorId));
    if (!sourceSnapshot) return instruction;

    return {
        ...instruction,
        ctx: {
            ...instruction.ctx,
            sourceSnapshot,
        },
        params: {
            ...params,
            sourceSnapshot,
        },
    };
}

function captureCoreAnchorSnapshots(
    core: MageWarsCore,
    resolveFxAnchorSnapshot?: UseMageWarsGameEventsParams['resolveFxAnchorSnapshot'],
): Map<string, FxAnchorSnapshot> {
    const snapshots = new Map<string, FxAnchorSnapshot>();
    if (!resolveFxAnchorSnapshot) return snapshots;

    for (const playerId of Object.keys(core.players)) {
        const snapshot = resolveFxAnchorSnapshot(anchorRef(playerId, 'player'));
        if (snapshot) snapshots.set(anchorSnapshotCacheKey('player', playerId), snapshot);
    }
    for (const objectId of Object.keys(core.objects)) {
        const snapshot = resolveFxAnchorSnapshot(anchorRef(objectId, 'entity'));
        if (snapshot) snapshots.set(anchorSnapshotCacheKey('entity', objectId), snapshot);
    }

    return snapshots;
}

function resolveInstructionSnapshots(
    instruction: ReturnType<typeof mapMageWarsEventToFx>,
    resolveFxAnchorSnapshot?: UseMageWarsGameEventsParams['resolveFxAnchorSnapshot'],
): ReturnType<typeof mapMageWarsEventToFx> {
    if (!instruction || !resolveFxAnchorSnapshot) return instruction;
    const params = instruction.params ?? {};
    const explicitSourceSnapshot = isFxAnchorSnapshot(params.sourceSnapshot) ? params.sourceSnapshot : null;
    const explicitTargetSnapshot = isFxAnchorSnapshot(params.targetSnapshot) ? params.targetSnapshot : null;
    const relocationCue = instruction.cue === MW_FX.MOVE
        || instruction.cue === MW_FX.SPELL_PUSH
        || instruction.cue === MW_FX.SPELL_TELEPORT;
    const sourceAnchor = anchorRef(
        params.sourceObjectId ?? params.attackerId ?? (relocationCue ? undefined : params.playerId),
        params.sourceObjectId ? 'entity' : 'player',
    );
    const targetAnchor = anchorRef(
        params.objectId ?? params.targetObjectId ?? params.targetPlayerId ?? params.defenderId ?? params.targetId,
        params.objectId || params.targetObjectId || params.targetId ? 'entity' : 'player',
    );
    const sourceSnapshot = explicitSourceSnapshot ?? (sourceAnchor ? resolveFxAnchorSnapshot(sourceAnchor) : null);
    const targetSnapshot = explicitTargetSnapshot ?? (targetAnchor ? resolveFxAnchorSnapshot(targetAnchor) : null);

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
    const scheduledHeldFxRef = useRef(new Set<FxFrameSubscription>());
    const previousCoreRef = useRef(G.core);
    const anchorSnapshotCacheRef = useRef(new Map<string, FxAnchorSnapshot>());
    const damageBuffer = useVisualStateBuffer();
    const visualEntityBuffer = useVisualEntityBuffer<MageWarsArenaObjectState>();
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

    useLayoutEffect(() => () => {
        for (const cancel of scheduledHeldFxRef.current) {
            cancel();
        }
        scheduledHeldFxRef.current.clear();
    }, []);

    const entries = getEventStreamEntries(G);
    const { consumeNew, getCursor } = useVisualEventStream({
        entries,
        strategy: 'requiredSequence',
        consumeInitialEntries: true,
        consumeOnReconcile: true,
    });
    const latestEntryId = entries[entries.length - 1]?.id ?? 0;

    useLayoutEffect(() => {
        const { entries: newEntries, didReset } = consumeNew();
        const consumedTypes: string[] = [];
        const fxCues: string[] = [];
        if (didReset) {
            for (const cancel of scheduledHeldFxRef.current) {
                cancel();
            }
            scheduledHeldFxRef.current.clear();
            fxImpactMapRef.current.clear();
            damageBuffer.clear();
            visualEntityBuffer.clear();
        }
        if (newEntries.length === 0) {
            anchorSnapshotCacheRef.current = captureCoreAnchorSnapshots(G.core, resolveFxAnchorSnapshot);
            previousCoreRef.current = G.core;
            let cancelled = false;
            queueMicrotask(() => {
                if (cancelled) return;
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
            });
            return () => {
                cancelled = true;
            };
        }

        const events = newEntries.map((entry) => entry.event as MageWarsEvent);
        const previousCore = previousCoreRef.current;
        consumedTypes.push(...events.map((event) => event.type));
        const drivenDamageTargetIds = collectDrivenDamageTargetIds(events);
        const damageTargets = collectDamageFreezeEntries(events, G.core, previousCore);
        const heldObjectCandidates = collectDefeatedObjectHoldCandidates(events, G.core, previousCore);
        const visualCore = addHeldObjectCandidatesToCore(G.core, heldObjectCandidates);
        const previousAnchorSnapshots = anchorSnapshotCacheRef.current;
        damageBuffer.freezeBatch(damageTargets.entries);

        const pushFxInstruction = (
            instruction: ReturnType<typeof mapMageWarsEventToFx>,
            releaseKeys: string[],
            holdOwnerId?: string,
        ) => {
            const resolvedInstruction = resolveInstructionSnapshots(
                instruction,
                resolveFxAnchorSnapshot,
            );
            if (!resolvedInstruction) {
                if (holdOwnerId) visualEntityBuffer.releaseOwner(holdOwnerId);
                return;
            }
            const fxId = fxBusRef.current.push(resolvedInstruction.cue, resolvedInstruction.ctx, resolvedInstruction.params);
            if (!fxId) {
                if (holdOwnerId) visualEntityBuffer.releaseOwner(holdOwnerId);
                return;
            }
            if (releaseKeys.length > 0) {
                fxImpactMapRef.current.set(fxId, releaseKeys);
            }
            if (holdOwnerId) {
                visualEntityBuffer.transferOwner(holdOwnerId, fxId);
            }
        };

        for (const entry of newEntries) {
            const event = entry.event as MageWarsEvent;
            if (event.type === 'DAMAGE_DEALT' && drivenDamageTargetIds.has(event.payload.targetId)) {
                continue;
            }
            const instruction = attachRelocationSourceSnapshot(
                event,
                mapMageWarsEventToFx(entry, visualCore),
                previousAnchorSnapshots,
            );
            if (!instruction) continue;
            fxCues.push(instruction.cue);
            const releaseKeys = getDamageReleaseKeysForEvent(event, damageTargets.targetKeys, drivenDamageTargetIds);
            const heldObjectIds = getHeldObjectIdsForEvent(event, heldObjectCandidates);
            if (heldObjectIds.length > 0) {
                const holdOwnerId = `mage-wars:pending-fx:${entry.id}:${event.type}`;
                visualEntityBuffer.hold(
                    holdOwnerId,
                    heldObjectIds
                        .map((objectId) => {
                            const snapshot = heldObjectCandidates.get(objectId);
                            return snapshot ? { id: objectId, snapshot } : null;
                        })
                        .filter((item): item is { id: string; snapshot: MageWarsArenaObjectState } => item != null),
                );
                const cancel = scheduleFxFrameCallback(32, () => {
                    scheduledHeldFxRef.current.delete(cancel);
                    pushFxInstruction(instruction, releaseKeys, holdOwnerId);
                });
                scheduledHeldFxRef.current.add(cancel);
            } else {
                pushFxInstruction(instruction, releaseKeys);
            }
        }
        const nextDebug = {
            eventCount: entries.length,
            latestEntryId,
            cursor: getCursor(),
            lastConsumedTypes: consumedTypes,
            lastFxCues: fxCues,
        };
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            setDebug((current) => (
                current.eventCount === nextDebug.eventCount
                && current.latestEntryId === nextDebug.latestEntryId
                && current.cursor === nextDebug.cursor
                && current.lastConsumedTypes.join(',') === nextDebug.lastConsumedTypes.join(',')
                && current.lastFxCues.join(',') === nextDebug.lastFxCues.join(',')
                    ? current
                    : nextDebug
            ));
        });
        previousCoreRef.current = G.core;
        anchorSnapshotCacheRef.current = captureCoreAnchorSnapshots(G.core, resolveFxAnchorSnapshot);
        return () => {
            cancelled = true;
        };

    }, [G.core, damageBuffer, visualEntityBuffer, entries.length, latestEntryId, consumeNew, getCursor, entries, resolveFxAnchorSnapshot]);

    const onEffectImpact = useCallback((id: string) => {
        const releaseKeys = fxImpactMapRef.current.get(id);
        if (!releaseKeys) return;
        damageBuffer.release(releaseKeys);
        fxImpactMapRef.current.delete(id);
    }, [damageBuffer]);

    const onEffectComplete = useCallback((id: string) => {
        fxImpactMapRef.current.delete(id);
        visualEntityBuffer.releaseOwner(id);
    }, [visualEntityBuffer]);

    return {
        damageBuffer,
        heldObjects: visualEntityBuffer.heldSnapshots,
        onEffectImpact,
        onEffectComplete,
        debug,
    };
}
