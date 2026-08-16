import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useVisualEventStream } from '../../../components/game/framework/hooks/useVisualEventStream';
import { useVisualStateBuffer, type UseVisualStateBufferReturn } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import type { FxBus } from '../../../engine/fx';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { MatchState } from '../../../engine/types';
import type { MageWarsCore, MageWarsEvent } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { mapMageWarsEventToFx } from './eventFxMapper';

interface UseMageWarsGameEventsParams {
    G: MatchState<MageWarsCore>;
    fxBus: FxBus;
}

interface UseMageWarsGameEventsResult {
    damageBuffer: UseVisualStateBufferReturn;
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

function getDamageTargetKey(core: MageWarsCore, targetId: string): string | null {
    if (core.players[targetId]) return mageWarsPlayerDamageKey(targetId);
    if (core.objects[targetId]) return mageWarsObjectDamageKey(targetId);
    return null;
}

function getDamageTargetFinalValue(core: MageWarsCore, targetId: string): number | null {
    const player = core.players[targetId];
    if (player) return player.damage;
    const object = core.objects[targetId];
    if (object) return object.damage;
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
        const key = getDamageTargetKey(core, targetId);
        const finalDamage = getDamageTargetFinalValue(core, targetId);
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

export function useMageWarsGameEvents({ G, fxBus }: UseMageWarsGameEventsParams): UseMageWarsGameEventsResult {
    const fxBusRef = useRef(fxBus);
    const fxImpactMapRef = useRef(new Map<string, string[]>());
    const damageBuffer = useVisualStateBuffer();
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
            damageBuffer.clear();
        }
        if (newEntries.length === 0) {
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
        consumedTypes.push(...events.map((event) => event.type));
        const drivenDamageTargetIds = collectDrivenDamageTargetIds(events);
        const damageTargets = collectDamageFreezeEntries(events, G.core);
        damageBuffer.freezeBatch(damageTargets.entries);

        for (const entry of newEntries) {
            const event = entry.event as MageWarsEvent;
            if (event.type === 'DAMAGE_DEALT' && drivenDamageTargetIds.has(event.payload.targetId)) {
                continue;
            }
            const instruction = mapMageWarsEventToFx(entry, G.core);
            if (!instruction) continue;
            fxCues.push(instruction.cue);
            const fxId = fxBusRef.current.push(instruction.cue, instruction.ctx, instruction.params);
            if (!fxId) continue;
            const releaseKeys = getDamageReleaseKeysForEvent(event, damageTargets.targetKeys, drivenDamageTargetIds);
            if (releaseKeys.length > 0) {
                fxImpactMapRef.current.set(fxId, releaseKeys);
            }
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

    }, [G.core, damageBuffer, entries.length, latestEntryId, consumeNew, getCursor, entries]);

    const onEffectImpact = useCallback((id: string) => {
        const releaseKeys = fxImpactMapRef.current.get(id);
        if (!releaseKeys) return;
        damageBuffer.release(releaseKeys);
        fxImpactMapRef.current.delete(id);
    }, [damageBuffer]);

    const onEffectComplete = useCallback((id: string) => {
        fxImpactMapRef.current.delete(id);
    }, []);

    return { damageBuffer, onEffectImpact, onEffectComplete, debug };
}
