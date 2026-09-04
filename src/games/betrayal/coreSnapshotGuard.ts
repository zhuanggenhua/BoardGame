import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
  BetrayalMonsterSummary,
  BetrayalTraitKey,
} from "./game";

function isTraitMap(value: unknown): value is Record<BetrayalTraitKey, number> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return ["might", "speed", "knowledge", "sanity"].every(
    (key) => typeof candidate[key] === "number",
  );
}

function isInventoryCard(value: unknown): value is BetrayalInventoryCard {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<BetrayalInventoryCard>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    (candidate.kind === "item" || candidate.kind === "omen")
  );
}

function isExplorerSummary(value: unknown): value is BetrayalExplorerSummary {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<BetrayalExplorerSummary>;
  return (
    typeof candidate.playerId === "string" &&
    typeof candidate.explorerId === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.portraitAsset === "string" &&
    (candidate.tokenAsset === undefined ||
      typeof candidate.tokenAsset === "string") &&
    typeof candidate.roomId === "string" &&
    isTraitMap(candidate.traits) &&
    Array.isArray(candidate.inventory) &&
    candidate.inventory.every(isInventoryCard)
  );
}

function isMonsterSummary(value: unknown): value is BetrayalMonsterSummary {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<BetrayalMonsterSummary>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.portraitAsset === "string" &&
    (candidate.tokenAsset === undefined ||
      typeof candidate.tokenAsset === "string") &&
    typeof candidate.roomId === "string" &&
    typeof candidate.might === "number" &&
    typeof candidate.speed === "number" &&
    typeof candidate.damage === "number"
  );
}

export function isBetrayalCore(value: unknown): value is BetrayalCore {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<BetrayalCore>;
  return (
    (candidate.phase === "characterSelect" ||
      candidate.phase === "preHaunt" ||
      candidate.phase === "haunt" ||
      candidate.phase === "endgame") &&
    typeof candidate.currentPlayer === "string" &&
    typeof candidate.turnStartSpeed === "number" &&
    typeof candidate.movesRemaining === "number" &&
    typeof candidate.activeRoomId === "string" &&
    isExplorerSummary(candidate.currentExplorer) &&
    isTraitMap(candidate.currentExplorerTraits) &&
    Array.isArray(candidate.currentExplorerInventory) &&
    candidate.currentExplorerInventory.every(isInventoryCard) &&
    Array.isArray(candidate.otherExplorers) &&
    candidate.otherExplorers.every(isExplorerSummary) &&
    Array.isArray(candidate.monsters) &&
    candidate.monsters.every(isMonsterSummary) &&
    Array.isArray(candidate.rooms)
  );
}
