import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalMonsterSummary,
  BetrayalRoomNode,
} from "./game";
import {
  resolveBetrayalLineOfSightRoomIds,
  resolveRoomCenterPoint,
  type RoomCanvasLayout,
} from "./roomMapModel";

export type BetrayalAttackLineOfSightSegment = {
  sourceRoomId: string;
  sourceMonsterId?: string;
  targetRoomId: string;
  targetPlayerId: string;
  weaponCardId?: string;
  kind: "weapon" | "phantom-photographer";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type BetrayalAttackTargetPlayerIds = {
  traitorPlayerId: string | null;
  heroPlayerIds: readonly string[];
};

type BetrayalSelectedMonsterAttackEntry = {
  kind: "normal" | "phantom-photographer";
  monster: BetrayalMonsterSummary;
  targetPlayerIds: ReadonlySet<string>;
};

export interface ResolveBetrayalAttackLineOfSightSegmentsArgs {
  core: BetrayalCore;
  visibleRooms: readonly BetrayalRoomNode[];
  roomCanvasLayout: RoomCanvasLayout;
  allExplorers: readonly BetrayalExplorerSummary[];
  selectedAttackWeaponCardId: string | null;
  selectedAttackWeaponEffectId: string | null;
  hauntTargetingActionKind: string | null;
  selectedAttackTargetPlayerIds: BetrayalAttackTargetPlayerIds;
  isMonsterAttackMode: boolean;
  selectedMonsterAttackSourceId: string | null;
  selectedMonsterAttackEntry: BetrayalSelectedMonsterAttackEntry | null;
}

function resolveVisibleTargetRoom(
  visibleRoomById: ReadonlyMap<string, BetrayalRoomNode>,
  allExplorers: readonly BetrayalExplorerSummary[],
  targetPlayerId: string,
): BetrayalRoomNode | null {
  const targetExplorer = allExplorers.find(
    (explorer) => explorer.playerId === targetPlayerId,
  );
  return targetExplorer ? visibleRoomById.get(targetExplorer.roomId) ?? null : null;
}

function pushVisibleLineOfSightSegments({
  segments,
  core,
  visibleRoomById,
  roomCanvasLayout,
  allExplorers,
  sourceRoom,
  targetPlayerIds,
  sourceMonsterId,
  weaponCardId,
  kind,
}: {
  segments: BetrayalAttackLineOfSightSegment[];
  core: BetrayalCore;
  visibleRoomById: ReadonlyMap<string, BetrayalRoomNode>;
  roomCanvasLayout: RoomCanvasLayout;
  allExplorers: readonly BetrayalExplorerSummary[];
  sourceRoom: BetrayalRoomNode;
  targetPlayerIds: Iterable<string>;
  sourceMonsterId?: string;
  weaponCardId?: string;
  kind: BetrayalAttackLineOfSightSegment["kind"];
}): void {
  const lineOfSightRoomIds = new Set(
    resolveBetrayalLineOfSightRoomIds(core, sourceRoom.id),
  );
  const sourcePoint = resolveRoomCenterPoint(sourceRoom, roomCanvasLayout);

  for (const targetPlayerId of targetPlayerIds) {
    const targetRoom = resolveVisibleTargetRoom(
      visibleRoomById,
      allExplorers,
      targetPlayerId,
    );
    if (
      !targetRoom ||
      targetRoom.id === sourceRoom.id ||
      !lineOfSightRoomIds.has(targetRoom.id)
    ) {
      continue;
    }
    const targetPoint = resolveRoomCenterPoint(targetRoom, roomCanvasLayout);
    segments.push({
      sourceRoomId: sourceRoom.id,
      ...(sourceMonsterId ? { sourceMonsterId } : {}),
      targetRoomId: targetRoom.id,
      targetPlayerId,
      ...(weaponCardId ? { weaponCardId } : {}),
      kind,
      x1: sourcePoint.x,
      y1: sourcePoint.y,
      x2: targetPoint.x,
      y2: targetPoint.y,
    });
  }
}

export function resolveBetrayalAttackLineOfSightSegments({
  core,
  visibleRooms,
  roomCanvasLayout,
  allExplorers,
  selectedAttackWeaponCardId,
  selectedAttackWeaponEffectId,
  hauntTargetingActionKind,
  selectedAttackTargetPlayerIds,
  isMonsterAttackMode,
  selectedMonsterAttackSourceId,
  selectedMonsterAttackEntry,
}: ResolveBetrayalAttackLineOfSightSegmentsArgs): BetrayalAttackLineOfSightSegment[] {
  const visibleRoomById = new Map(
    visibleRooms.map((room) => [room.id, room]),
  );
  const segments: BetrayalAttackLineOfSightSegment[] = [];

  if (
    selectedAttackWeaponCardId &&
    selectedAttackWeaponEffectId === "gun" &&
    (hauntTargetingActionKind === "attack-traitor" ||
      hauntTargetingActionKind === "attack-hero")
  ) {
    const sourceRoom = visibleRoomById.get(core.currentExplorer.roomId);
    if (sourceRoom) {
      pushVisibleLineOfSightSegments({
        segments,
        core,
        visibleRoomById,
        roomCanvasLayout,
        allExplorers,
        sourceRoom,
        targetPlayerIds:
          hauntTargetingActionKind === "attack-traitor"
            ? selectedAttackTargetPlayerIds.traitorPlayerId
              ? [selectedAttackTargetPlayerIds.traitorPlayerId]
              : []
            : selectedAttackTargetPlayerIds.heroPlayerIds,
        weaponCardId: selectedAttackWeaponCardId,
        kind: "weapon",
      });
    }
  }

  if (
    isMonsterAttackMode &&
    selectedMonsterAttackSourceId &&
    selectedMonsterAttackEntry?.kind === "phantom-photographer"
  ) {
    const monster = selectedMonsterAttackEntry.monster;
    const sourceRoom = visibleRoomById.get(monster.roomId);
    if (sourceRoom) {
      pushVisibleLineOfSightSegments({
        segments,
        core,
        visibleRoomById,
        roomCanvasLayout,
        allExplorers,
        sourceRoom,
        targetPlayerIds: selectedMonsterAttackEntry.targetPlayerIds,
        sourceMonsterId: monster.id,
        kind: "phantom-photographer",
      });
    }
  }

  return segments;
}
