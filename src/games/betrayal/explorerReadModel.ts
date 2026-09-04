import type { BetrayalCore, BetrayalExplorerSummary, BetrayalRoomNode } from "./game";
import { cloneInventoryCard } from "./possessionDeckModel";
import {
  buildTraitTracksFromValues,
  cloneTraitTracks,
  normalizeExplorerTraitTracks,
} from "./traitTrackModel";

export function getAllExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
  return [core.currentExplorer, ...core.otherExplorers];
}

export function cloneExplorerSummary(explorer: BetrayalExplorerSummary): BetrayalExplorerSummary {
  const cloned = {
    ...explorer,
    traits: { ...explorer.traits },
    traitTracks: explorer.traitTracks
      ? cloneTraitTracks(explorer.traitTracks)
      : buildTraitTracksFromValues(explorer.explorerId, explorer.traits),
    inventory: explorer.inventory.map(cloneInventoryCard),
  };
  normalizeExplorerTraitTracks(cloned);
  return cloned;
}

export function findExplorerByPlayerId(
  core: BetrayalCore,
  playerId: string,
): BetrayalExplorerSummary | null {
  return getAllExplorers(core).find((explorer) => explorer.playerId === playerId) ?? null;
}

export function resolveTurnStartSpeed(
  core: BetrayalCore,
  playerId = core.currentExplorer.playerId,
): number {
  const explorer = findExplorerByPlayerId(core, playerId) ?? core.currentExplorer;
  return Math.max(0, explorer.traits.speed);
}

export function getExplorersInTurnOrder(
  core: BetrayalCore,
): BetrayalExplorerSummary[] {
  const explorerByPlayerId = new Map(
    getAllExplorers(core).map((explorer) => [explorer.playerId, explorer]),
  );
  return core.playerIds
    .map((playerId) => explorerByPlayerId.get(playerId))
    .filter((explorer): explorer is BetrayalExplorerSummary => Boolean(explorer));
}

export function resolveExplorerRoom(
  core: BetrayalCore,
  explorer: BetrayalExplorerSummary | null | undefined,
): BetrayalRoomNode | null {
  return explorer ? core.rooms.find((room) => room.id === explorer.roomId) ?? null : null;
}
