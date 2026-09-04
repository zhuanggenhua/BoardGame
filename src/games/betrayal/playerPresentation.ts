import type { MatchPlayerInfo } from "../../engine/transport/protocol";
import type { BetrayalExplorerSummary } from "./game";

export function resolvePlayerName(
  playerId: string,
  explorerName: string,
  matchData?: MatchPlayerInfo[],
): string {
  const matched = matchData?.find(
    (item) => String(item.id) === String(playerId),
  );
  return matched?.name?.trim() || explorerName;
}

export function resolveEndgameExplorerName(
  explorer: Pick<BetrayalExplorerSummary, "playerId" | "displayName">,
  matchData?: MatchPlayerInfo[],
): string {
  const displayName = explorer.displayName.trim();
  return resolvePlayerName(explorer.playerId, displayName || "玩家", matchData);
}
