import React from 'react';
import { useVisualEventStream } from '../../components/game/framework/hooks/useVisualEventStream';
import type { EventStreamEntry } from '../../engine/types';
import type { MapSceneSprite, MapSceneSpriteMotionPhase } from '../../engine/mapRenderer';
import { useReducedMotionPreference } from '../../hooks/ui/useReducedMotionPreference';
import { AudioManager } from '../../lib/audio/AudioManager';
import { selectBetrayalFootstepKey } from './audio.config';
import type { BetrayalCore, BetrayalExplorerSummary, BetrayalMonsterSummary, BetrayalRoomNode } from './game';
import type { BetrayalEvent } from './events';
import { getAllExplorers } from './explorerReadModel';
import { resolveBetrayalEntitySceneSprites } from './roomSceneModel';
import { resolveRoomCenterPoint, type RoomCanvasLayout } from './roomMapModel';
import { resolveSceneMovementFacts, type SceneMovementFact } from './sceneMovementModel';

type MovementJob = { sprite: MapSceneSprite; roomId: string; visualId: string; eventType: SceneMovementFact['eventType'] };
type RoomRevealJob = { sprite: MapSceneSprite };
const ROOM_REVEAL_DROP_HEIGHT = 16;
// A brief readable landing beat, separate from the 300ms travel hop.
const LANDING_FEEDBACK_MS = 200;

function groupByRoom<T extends { roomId: string }>(objects: readonly T[]): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const object of objects) (result[object.roomId] ??= []).push(object);
    return result;
}

export function useSceneMovement({ core, entries, rollbackRevision, rooms, layout, locale, sprites, onStart, onEnd, onPresented, onApproach, onRoomRevealActivity }: {
    core: BetrayalCore;
    entries: EventStreamEntry[];
    rollbackRevision: number;
    rooms: readonly BetrayalRoomNode[];
    layout: RoomCanvasLayout;
    locale: string;
    sprites: readonly MapSceneSprite[];
    onStart: () => void;
    onEnd: () => void;
    onPresented?: (roomId: string, entityId: string) => void;
    onApproach?: (roomId: string, entityId: string) => void;
    onRoomRevealActivity?: (active: boolean) => void;
}) {
    const approachCallback = React.useRef(onApproach);
    React.useLayoutEffect(() => { approachCallback.current = onApproach; }, [onApproach]);
    const previous = React.useRef({ core, rollbackRevision });
    const [queues, renderQueues] = React.useState<ReadonlyMap<string, readonly MovementJob[]>>(new Map());
    const [roomReveals, renderRoomReveals] = React.useState<ReadonlyMap<string, RoomRevealJob>>(new Map());
    const mounted = React.useRef(false);
    const emittedPhases = React.useRef(new Map<string, Map<string, Set<MapSceneSpriteMotionPhase>>>());
    const nextFootstepVariantByEntity = React.useRef(new Map<string, number>());
    // The ticker may deliver another completion before React commits. Advance the same
    // queue synchronously so stale callbacks cannot present a landing twice.
    const queuesRef = React.useRef(queues);
    const roomRevealsRef = React.useRef(roomReveals);
    const setQueues = React.useCallback((update: React.SetStateAction<ReadonlyMap<string, readonly MovementJob[]>>) => {
        if (!mounted.current) return queuesRef.current;
        const next = typeof update === 'function' ? update(queuesRef.current) : update;
        queuesRef.current = next;
        renderQueues(next);
        return next;
    }, []);
    const setRoomReveals = React.useCallback((update: React.SetStateAction<ReadonlyMap<string, RoomRevealJob>>) => {
        if (!mounted.current) return roomRevealsRef.current;
        const next = typeof update === 'function' ? update(roomRevealsRef.current) : update;
        roomRevealsRef.current = next;
        renderRoomReveals(next);
        return next;
    }, []);
    const reducedMotion = useReducedMotionPreference();
    const { consumeNew } = useVisualEventStream({ entries, strategy: 'requiredSequence', consumeInitialEntries: false, consumeOnReconcile: true });

    React.useLayoutEffect(() => {
        mounted.current = true;
        const phaseRecords = emittedPhases.current;
        const footstepVariants = nextFootstepVariantByEntity.current;
        return () => {
            mounted.current = false;
            queuesRef.current = new Map();
            roomRevealsRef.current = new Map();
            phaseRecords.clear();
            footstepVariants.clear();
        };
    }, []);
    React.useLayoutEffect(() => {
        const before = previous.current;
        previous.current = { core, rollbackRevision };
        const delta = consumeNew();
        if (delta.didReset || delta.didOptimisticRollback || before.rollbackRevision !== rollbackRevision) {
            emittedPhases.current.clear();
            nextFootstepVariantByEntity.current.clear();
            setQueues(new Map());
            setRoomReveals(new Map());
            return;
        }
        if (!delta.entries.length) return;
        const explorers: BetrayalExplorerSummary[] = getAllExplorers(before.core);
        const monsters: BetrayalMonsterSummary[] = before.core.monsters;
        const positions = new Map([
            ...explorers.map(explorer => [`player:${explorer.playerId}`, explorer.roomId] as const),
            ...monsters.map(monster => [`monster:${monster.id}`, monster.roomId] as const),
        ]);
        const facts = resolveSceneMovementFacts(delta.entries, positions, core.rooms);
        const roomRevealAdditions = new Map<string, RoomRevealJob>();
        for (const entry of delta.entries) {
            const event = entry.event as BetrayalEvent;
            if (event.type !== 'ROOM_EXPLORED') continue;
            const roomId = event.payload.roomId;
            const previousRoom = before.core.rooms.find(room => room.id === roomId);
            const revealedRoom = core.rooms.find(room => room.id === roomId);
            const tileSprite = sprites.find(sprite => sprite.id === roomId);
            if (previousRoom?.state === 'discovered' || revealedRoom?.state !== 'discovered' || !tileSprite) continue;
            const motionId = `${rollbackRevision}:${entry.id}`;
            const center = { x: tileSprite.x + tileSprite.width / 2, y: tileSprite.y + tileSprite.height / 2 };
            roomRevealAdditions.set(roomId, {
                sprite: {
                    ...tileSprite,
                    motion: {
                        id: motionId,
                        from: { x: center.x, y: center.y - (reducedMotion ? 0 : ROOM_REVEAL_DROP_HEIGHT) },
                        kind: 'reveal',
                        durationMs: reducedMotion ? 0 : 360,
                        startScale: 0.96,
                    },
                },
            });
        }
        const previousSprites = new Map(resolveBetrayalEntitySceneSprites(rooms, groupByRoom(explorers), groupByRoom(monsters), layout, locale, core.currentExplorer.playerId).map(sprite => [sprite.id, sprite]));
        const finalIndexByEntity = new Map<string, number>();
        facts.forEach((fact, index) => finalIndexByEntity.set(fact.entityId, index));
        const immediatelyPresented = new Map<string, string>();
        for (const [entityId, index] of finalIndexByEntity) {
            const finalFact = facts[index];
            const targetIsVisible = rooms.some(room => room.id === finalFact.toRoomId)
                && sprites.some(sprite => sprite.id === entityId);
            if (!targetIsVisible) immediatelyPresented.set(entityId, finalFact.toRoomId);
        }
        const additions = new Map<string, MovementJob[]>();
        facts.forEach((fact, index) => {
            if (immediatelyPresented.has(fact.entityId)) return;
            const targetSprite = sprites.find(sprite => sprite.id === fact.entityId);
            const targetRoom = rooms.find(room => room.id === fact.toRoomId);
            if (!targetSprite || !targetRoom) {
                previousSprites.delete(fact.entityId);
                return;
            }
            const prior = previousSprites.get(fact.entityId);
            const laterSameEntity = index < finalIndexByEntity.get(fact.entityId)!;
            const center = resolveRoomCenterPoint(targetRoom, layout);
            const target = laterSameEntity ? { x: center.x - targetSprite.width / 2, y: center.y - targetSprite.height / 2 } : targetSprite;
            const sprite: MapSceneSprite = {
                ...targetSprite, x: target.x, y: target.y,
                motion: { id: `${rollbackRevision}:${fact.id}`, from: prior ? { x: prior.x, y: prior.y } : { x: target.x, y: target.y },
                    kind: !prior ? 'fade' : fact.kind,
                    durationMs: reducedMotion ? 0 : 300,
                    landingDurationMs: reducedMotion ? 0 : LANDING_FEEDBACK_MS,
                    arcHeight: reducedMotion ? 0 : 16 },
            };
            (additions.get(fact.entityId) ?? (additions.set(fact.entityId, []), additions.get(fact.entityId)!)).push({
                sprite,
                roomId: fact.toRoomId,
                visualId: targetRoom.visualId,
                eventType: fact.eventType,
            });
            previousSprites.set(fact.entityId, sprite);
        });
        if (additions.size || immediatelyPresented.size) setQueues(current => {
            const next = new Map(current);
            for (const entityId of immediatelyPresented.keys()) {
                next.delete(entityId);
                emittedPhases.current.delete(entityId);
                nextFootstepVariantByEntity.current.delete(entityId);
            }
            for (const [id, jobs] of additions) next.set(id, [...(next.get(id) ?? []), ...jobs]);
            return next;
        });
        if (roomRevealAdditions.size) setRoomReveals(current => {
            const next = new Map(current);
            for (const [roomId, reveal] of roomRevealAdditions) next.set(roomId, reveal);
            return next;
        });
        for (const [entityId, roomId] of immediatelyPresented) onPresented?.(roomId, entityId);
    }, [consumeNew, core, entries, layout, locale, onPresented, reducedMotion, rollbackRevision, rooms, setQueues, setRoomReveals, sprites]);

    React.useLayoutEffect(() => {
        if (!reducedMotion) return;
        setQueues(current => {
            let changed = false;
            const next = new Map<string, readonly MovementJob[]>();
            for (const [entityId, jobs] of current) {
                const reducedJobs = jobs.map(job => {
                    const motion = job.sprite.motion;
                    if (!motion || (motion.durationMs === 0 && motion.landingDurationMs === 0 && motion.arcHeight === 0)) return job;
                    changed = true;
                    return { ...job, sprite: { ...job.sprite, motion: { ...motion, durationMs: 0, landingDurationMs: 0, arcHeight: 0 } } };
                });
                next.set(entityId, reducedJobs);
            }
            return changed ? next : current;
        });
    }, [reducedMotion, setQueues]);

    React.useLayoutEffect(() => {
        if (!reducedMotion) return;
        setRoomReveals(current => {
            let changed = false;
            const next = new Map<string, RoomRevealJob>();
            for (const [roomId, reveal] of current) {
                if (reveal.sprite.motion?.durationMs === 0) {
                    next.set(roomId, reveal);
                    continue;
                }
                changed = true;
                next.set(roomId, {
                    ...reveal,
                    sprite: {
                        ...reveal.sprite,
                        motion: reveal.sprite.motion
                            ? { ...reveal.sprite.motion, durationMs: 0 }
                            : undefined,
                    },
                });
            }
            return changed ? next : current;
        });
    }, [reducedMotion, setRoomReveals]);

    React.useLayoutEffect(() => {
        const liveIds = new Set(sprites.map(sprite => sprite.id));
        setQueues(current => {
            if ([...current.keys()].every(id => liveIds.has(id))) return current;
            for (const entityId of current.keys()) {
                if (!liveIds.has(entityId)) {
                    emittedPhases.current.delete(entityId);
                    nextFootstepVariantByEntity.current.delete(entityId);
                }
            }
            return new Map([...current].filter(([id]) => liveIds.has(id)));
        });
        setRoomReveals(current => {
            if ([...current.keys()].every(id => liveIds.has(id))) return current;
            return new Map([...current].filter(([id]) => liveIds.has(id)));
        });
    }, [setQueues, setRoomReveals, sprites]);
    // Keep discovery cards behind the actual tile reveal, without locking unrelated
    // scene actions or guessing the animation duration in a second timer.
    const roomRevealActive = roomReveals.size > 0;
    React.useLayoutEffect(() => {
        if (!roomRevealActive) return;
        onRoomRevealActivity?.(true);
        return () => onRoomRevealActivity?.(false);
    }, [onRoomRevealActivity, roomRevealActive]);
    React.useLayoutEffect(() => {
        for (const [entityId, queue] of queues) {
            if (queue[0]) approachCallback.current?.(queue[0].roomId, entityId);
        }
    }, [queues]);
    const active = queues.size > 0;
    React.useLayoutEffect(() => {
        if (!active) return;
        onStart();
        return onEnd;
    }, [active, onStart, onEnd]);
    const complete = React.useCallback((entityId: string, motionId: string) => {
        if (!mounted.current) return;
        const roomReveal = roomRevealsRef.current.get(entityId);
        if (roomReveal) {
            if (roomReveal.sprite.motion?.id !== motionId) return;
            setRoomReveals(current => {
                if (current.get(entityId)?.sprite.motion?.id !== motionId) return current;
                const next = new Map(current);
                next.delete(entityId);
                return next;
            });
            return;
        }
        const first = queuesRef.current.get(entityId)?.[0];
        if (!first || first.sprite.motion?.id !== motionId) return;
        const entityPhases = emittedPhases.current.get(entityId);
        entityPhases?.delete(motionId);
        if (entityPhases?.size === 0) emittedPhases.current.delete(entityId);
        setQueues(current => {
            const queue = current.get(entityId);
            if (!queue || queue[0].sprite.motion?.id !== motionId) return current;
            const next = new Map(current);
            if (queue.length > 1) next.set(entityId, queue.slice(1));
            else next.delete(entityId);
            return next;
        });
        onPresented?.(first.roomId, entityId);
    }, [onPresented, setQueues, setRoomReveals]);
    const onMotionPhase = React.useCallback((entityId: string, motionId: string, phase: MapSceneSpriteMotionPhase) => {
        if (!mounted.current) return;
        const first = queuesRef.current.get(entityId)?.[0];
        if (!first || first.sprite.motion?.id !== motionId) return;
        if (phase === 'landing' && first.sprite.motion.kind !== 'hop') return;
        const entityPhases = emittedPhases.current.get(entityId) ?? new Map<string, Set<MapSceneSpriteMotionPhase>>();
        const motionPhases = entityPhases.get(motionId) ?? new Set<MapSceneSpriteMotionPhase>();
        if (motionPhases.has(phase)) return;
        motionPhases.add(phase);
        entityPhases.set(motionId, motionPhases);
        emittedPhases.current.set(entityId, entityPhases);
        if (phase === 'landing') {
            const variantIndex = nextFootstepVariantByEntity.current.get(entityId) ?? 0;
            AudioManager.play(selectBetrayalFootstepKey(first.roomId, first.visualId, variantIndex));
            nextFootstepVariantByEntity.current.set(entityId, variantIndex + 1);
        }
    }, []);
    const cancel = React.useCallback(() => {
        emittedPhases.current.clear();
        nextFootstepVariantByEntity.current.clear();
        setQueues(new Map());
        setRoomReveals(new Map());
    }, [setQueues, setRoomReveals]);
    const projected = React.useMemo(() => sprites.map(sprite => queues.get(sprite.id)?.[0]?.sprite ?? roomReveals.get(sprite.id)?.sprite ?? sprite), [queues, roomReveals, sprites]);
    return { sprites: projected, complete, onMotionPhase, cancel, active, roomRevealActive };
}
