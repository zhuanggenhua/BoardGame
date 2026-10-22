import type { EventStreamEntry } from '../../engine/types';
import type { BetrayalEvent } from './events';
import type { BetrayalRoomNode } from './game';
import { ROOM_EDGE_VECTOR, resolveDoorwayConnectionEdge, resolveOppositeRoomEdge } from './roomMapModel';

export interface SceneMovementFact {
    id: string;
    eventType: BetrayalEvent['type'];
    entityId: string;
    fromRoomId: string;
    toRoomId: string;
    kind: 'hop' | 'fade';
}

/** Only committed movement events authorize movement presentation. Never predicts a command result. */
export function resolveSceneMovementFacts(
    entries: readonly EventStreamEntry[],
    previousRooms: ReadonlyMap<string, string>,
    rooms: readonly BetrayalRoomNode[],
): SceneMovementFact[] {
    const positions = new Map(previousRooms);
    const result: SceneMovementFact[] = [];
    for (const entry of entries) {
        const event = entry.event as BetrayalEvent;
        let entityId: string; let fromRoomId: string | undefined; let toRoomId: string; let teleport = false;
        if (event.type === 'EXPLORER_MOVED' || event.type === 'ROOM_EXPLORED') {
            const controlledToken = event.type === 'EXPLORER_MOVED' ? event.payload.controlledToken : undefined;
            teleport = event.type === 'EXPLORER_MOVED' && Boolean(event.payload.skeletonKeyCardId || event.payload.usedActionId);
            entityId = controlledToken === 'jack-spirit' ? 'monster:jack-spirit'
                : controlledToken === 'feverish' ? `monster:feverish-${event.payload.playerId}`
                    : `player:${event.payload.playerId}`;
            fromRoomId = positions.get(entityId);
            toRoomId = event.payload.roomId;
        } else if (event.type === 'MONSTER_MOVED' || event.type === 'HELPING_HANDS_TROLL_HAND_MOVED') {
            entityId = `monster:${event.payload.monsterId}`;
            fromRoomId = event.payload.fromRoomId;
            toRoomId = event.payload.toRoomId;
            teleport = event.type === 'MONSTER_MOVED' && event.payload.teleportMove;
        } else continue;
        positions.set(entityId, toRoomId);
        if (!fromRoomId || fromRoomId === toRoomId) continue;
        const source = rooms.find(room => room.id === fromRoomId);
        const target = rooms.find(room => room.id === toRoomId);
        if (!source || !target) continue;
        const sourceEdge = resolveDoorwayConnectionEdge(source, target.id);
        const targetEdge = resolveDoorwayConnectionEdge(target, source.id);
        const vector = sourceEdge ? ROOM_EDGE_VECTOR[sourceEdge] : undefined;
        const adjacent = source.floor === target.floor && Boolean(sourceEdge && targetEdge
            && targetEdge === resolveOppositeRoomEdge(sourceEdge)
            && vector && target.x === source.x + vector.x && target.y === source.y + vector.y);
        result.push({ id: String(entry.id), eventType: event.type, entityId, fromRoomId, toRoomId, kind: adjacent && !teleport ? 'hop' : 'fade' });
    }
    return result;
}
