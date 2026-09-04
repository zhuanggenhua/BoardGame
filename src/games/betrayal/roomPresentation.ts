import type { BetrayalRoomEdge, BetrayalRoomNode } from "./game";

type BetrayalTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

type RoomEndTurnEffectHint = {
  title: string;
  detail: string;
};

type RoomIdentityTone = {
  stripe: string;
  badge: string;
};

type RoomIdentityKey =
  | NonNullable<BetrayalRoomNode["discoveryReward"]>
  | "starting"
  | "explorable"
  | "unrevealed";

export type RoomIdentityPresentation = {
  key: RoomIdentityKey;
  label: string;
  tone: RoomIdentityTone;
};

const ROOM_EDGE_MARKER_CLASS: Record<BetrayalRoomEdge, string> = {
  north: "left-1/2 top-1 -translate-x-1/2",
  east: "right-1 top-1/2 -translate-y-1/2",
  south: "bottom-1 left-1/2 -translate-x-1/2",
  west: "left-1 top-1/2 -translate-y-1/2",
};

const ROOM_IDENTITY_TONE: Record<RoomIdentityKey, RoomIdentityTone> = {
  starting: {
    stripe: "bg-[rgba(148,163,155,0.28)]",
    badge: "border-[#6f7f77] bg-[rgba(24,31,28,0.76)] text-[#d6e0d9]",
  },
  unrevealed: {
    stripe: "bg-[rgba(92,106,95,0.22)]",
    badge:
      "border-[rgba(111,126,116,0.42)] bg-[rgba(18,26,22,0.92)] text-[#9fb6a3]",
  },
  explorable: {
    stripe: "bg-[rgba(144,168,150,0.28)]",
    badge: "border-[#7fa58c] bg-[rgba(24,35,29,0.76)] text-[#d1e5d8]",
  },
  event: {
    stripe: "bg-[rgba(134,163,150,0.26)]",
    badge: "border-[#788f84] bg-[rgba(24,31,28,0.76)] text-[#d7e2dd]",
  },
  item: {
    stripe: "bg-[rgba(144,168,150,0.24)]",
    badge: "border-[#7b8e84] bg-[rgba(24,31,28,0.76)] text-[#d8e2dd]",
  },
  omen: {
    stripe: "bg-[rgba(118,189,153,0.24)]",
    badge: "border-[#76bd99] bg-[rgba(33,65,51,0.82)] text-[#d6f1df]",
  },
};

export function resolveRoomEndTurnEffectHint(
  room: BetrayalRoomNode | null | undefined,
  t: BetrayalTranslation,
): RoomEndTurnEffectHint | null {
  if (!room?.endTurnEffect || room.state !== "discovered") {
    return null;
  }
  switch (room.endTurnEffect) {
    case "physicalDamage1":
      return {
        title: t("board.rooms.endTurnEffects.physicalDamage1.title", {
          room: room.name,
        }),
        detail: t("board.rooms.endTurnEffects.physicalDamage1.detail"),
      };
    case "speedCheckFallToBasement":
      return {
        title: t("board.rooms.endTurnEffects.speedCheckFallToBasement.title", {
          room: room.name,
        }),
        detail: t("board.rooms.endTurnEffects.speedCheckFallToBasement.detail"),
      };
    case "moveToBasementLanding":
      return {
        title: t("board.rooms.endTurnEffects.moveToBasementLanding.title", {
          room: room.name,
        }),
        detail: t("board.rooms.endTurnEffects.moveToBasementLanding.detail"),
      };
    default:
      return null;
  }
}

export function resolveRoomEdgeMarkerClass(edge: BetrayalRoomEdge): string {
  return ROOM_EDGE_MARKER_CLASS[edge];
}

export function resolveRoomIdentityPresentation(
  room: BetrayalRoomNode,
  options: {
    isDiscovered: boolean;
    isExploreTarget: boolean;
    t: BetrayalTranslation;
  },
): RoomIdentityPresentation | null {
  const { isDiscovered, isExploreTarget, t } = options;
  const key: RoomIdentityKey | null = room.discoveryReward
    ? room.discoveryReward
    : room.startingTile
      ? "starting"
      : isExploreTarget
        ? "explorable"
        : !isDiscovered
          ? "unrevealed"
          : null;

  if (!key) {
    return null;
  }

  const label = room.discoveryReward
    ? t(`board.rooms.rewards.${room.discoveryReward}`)
    : room.startingTile
      ? (room.tags[0] ?? t("board.rooms.active"))
      : isExploreTarget
        ? t("board.rooms.explorable")
        : t("board.rooms.slotUndiscovered");

  return {
    key,
    label,
    tone: ROOM_IDENTITY_TONE[key],
  };
}
