import type { BetrayalRoomEdge, BetrayalRoomNode } from "./game";
import {
  ROOM_EDGE_VECTOR,
  ROOM_TILE_SIZE,
  resolveDoorwayConnectionEdge,
  resolveOppositeRoomEdge,
  resolveRoomTileStyle,
  type RoomCanvasLayout,
} from "./roomMapModel";
import type { BetrayalMapMoveKind } from "./movementReadModel";

export type BetrayalMapMoveReachSegment = {
  sourceRoomId: string;
  targetRoomId: string;
  sourceEdge: BetrayalRoomEdge;
  targetEdge: BetrayalRoomEdge;
  cost: number;
  kind: BetrayalMapMoveKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function resolveDoorwayPoint(
  room: BetrayalRoomNode,
  edge: BetrayalRoomEdge,
  layout: RoomCanvasLayout,
): { x: number; y: number } {
  const tile = resolveRoomTileStyle(room, layout);
  switch (edge) {
    case "north":
      return { x: tile.left + ROOM_TILE_SIZE / 2, y: tile.top };
    case "east":
      return { x: tile.left + ROOM_TILE_SIZE, y: tile.top + ROOM_TILE_SIZE / 2 };
    case "south":
      return { x: tile.left + ROOM_TILE_SIZE / 2, y: tile.top + ROOM_TILE_SIZE };
    case "west":
      return { x: tile.left, y: tile.top + ROOM_TILE_SIZE / 2 };
  }
}

function isSamePoint(
  left: { x: number; y: number },
  right: { x: number; y: number },
): boolean {
  return Math.abs(left.x - right.x) < 1 && Math.abs(left.y - right.y) < 1;
}

/**
 * Returns only a one-step, reciprocal doorway reach marker. Special links such
 * as Skeleton Key or secret passages remain targets, but never get a fabricated
 * physical route drawn across the map.
 */
export function resolveBetrayalMapMoveReachSegments({
  sourceRoomId,
  visibleRooms,
  layout,
  moveTargetRoomIds,
  moveCostByRoomId,
  moveKindByRoomId,
}: {
  sourceRoomId: string;
  visibleRooms: readonly BetrayalRoomNode[];
  layout: RoomCanvasLayout;
  moveTargetRoomIds: ReadonlySet<string>;
  moveCostByRoomId: ReadonlyMap<string, number>;
  moveKindByRoomId: ReadonlyMap<string, BetrayalMapMoveKind>;
}): BetrayalMapMoveReachSegment[] {
  const sourceRoom = visibleRooms.find(
    (room) => room.id === sourceRoomId && room.state === "discovered",
  );
  if (!sourceRoom) return [];

  const segments: BetrayalMapMoveReachSegment[] = [];
  for (const targetRoom of visibleRooms) {
    if (
      targetRoom.id === sourceRoom.id ||
      targetRoom.state !== "discovered" ||
      targetRoom.floor !== sourceRoom.floor ||
      !moveTargetRoomIds.has(targetRoom.id)
    ) {
      continue;
    }
    const sourceEdge = resolveDoorwayConnectionEdge(sourceRoom, targetRoom.id);
    const targetEdge = resolveDoorwayConnectionEdge(targetRoom, sourceRoom.id);
    if (
      !sourceEdge ||
      !targetEdge ||
      targetEdge !== resolveOppositeRoomEdge(sourceEdge)
    ) {
      continue;
    }

    const sourcePoint = resolveDoorwayPoint(sourceRoom, sourceEdge, layout);
    const targetPoint = resolveDoorwayPoint(targetRoom, targetEdge, layout);
    // Fixed links and non-geometric links are valid moves, but aren't literal
    // doorway paths. Keep the visual cue anchored to the map's actual layout.
    if (!isSamePoint(sourcePoint, targetPoint)) continue;

    const sourceVector = ROOM_EDGE_VECTOR[sourceEdge];
    const targetVector = ROOM_EDGE_VECTOR[targetEdge];
    const inset = 14;
    segments.push({
      sourceRoomId: sourceRoom.id,
      targetRoomId: targetRoom.id,
      sourceEdge,
      targetEdge,
      cost: moveCostByRoomId.get(targetRoom.id) ?? 1,
      kind: moveKindByRoomId.get(targetRoom.id) ?? "normal",
      x1: sourcePoint.x - sourceVector.x * inset,
      y1: sourcePoint.y - sourceVector.y * inset,
      x2: targetPoint.x - targetVector.x * inset,
      y2: targetPoint.y - targetVector.y * inset,
    });
  }
  return segments;
}
