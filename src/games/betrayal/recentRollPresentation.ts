import type { MatchPlayerInfo } from "../../engine/transport/protocol";
import type { DicePhysicsProjectedLayout } from "../../lib/dice-physics/types";
import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalRecentRollState,
} from "./game";
import {
  resolvePendingEventRollResolutionRequiredPlayerIds,
  resolveRecentRollAcknowledgedPlayerIds,
  resolveRecentRollRequiredPlayerIds,
} from "./acknowledgementReadModel";
import { resolvePlayerName } from "./playerPresentation";

const BETRAYAL_REROLL_TARGET_MIN_HIT_SIZE = 42;
const BETRAYAL_REROLL_TARGET_MAX_HIT_PADDING = 3.75;

export type EventRollConfirmationPresentation = {
  requiredPlayerIds: string[];
  acknowledgedPlayerIds: string[];
  confirmedCount: number;
  totalCount: number;
  viewerHasAcknowledged: boolean;
  canViewerAcknowledge: boolean;
};

export function buildRecentRollDisplayKey(
  recentRoll: BetrayalRecentRollState | null | undefined,
): string | null {
  if (!recentRoll) {
    return null;
  }
  return [
    recentRoll.id,
    recentRoll.kind,
    recentRoll.playerId,
    recentRoll.sourceTitle,
    recentRoll.eventDescription ?? "",
    recentRoll.sourceEventRoll?.eventDescription ?? "",
    recentRoll.rollLabel ?? "",
    recentRoll.latestLabel,
    recentRoll.dice.join(","),
    recentRoll.passiveBonus,
  ].join("::");
}

export function isAcknowledgeableRecentRollDisplay(
  recentRoll: BetrayalRecentRollState | null | undefined,
): boolean {
  if (!recentRoll) {
    return false;
  }
  if (recentRoll.roomEndTurn?.nextPlayerId || recentRoll.deathPrevention?.nextPlayerId) {
    return false;
  }
  return (
    recentRoll.kind === "eventRolledDamage" ||
    recentRoll.kind === "attackRoll" ||
    recentRoll.kind === "hauntActionTraitCheck" ||
    recentRoll.kind === "monsterMoveRoll"
  );
}

export function resolveRecentRollRequiredPlayerIdsForDisplay(
  core: BetrayalCore,
  recentRoll: BetrayalRecentRollState | null | undefined,
): string[] {
  if (!recentRoll) {
    return [];
  }
  return resolveRecentRollRequiredPlayerIds(core, recentRoll);
}

export function resolveRecentRollAcknowledgedPlayerIdsForDisplay(
  recentRoll: BetrayalRecentRollState | null | undefined,
): string[] {
  return recentRoll ? resolveRecentRollAcknowledgedPlayerIds(recentRoll) : [];
}

export function resolveRecentRollTotal(roll: BetrayalRecentRollState): number {
  return roll.dice.reduce((sum, pip) => sum + pip, 0) + roll.passiveBonus;
}

export function resolveRecentRollActorLabel(options: {
  roll: BetrayalRecentRollState | null | undefined;
  viewerPlayerId: string;
  explorers: readonly BetrayalExplorerSummary[];
  matchData?: MatchPlayerInfo[];
}): string | null {
  const { roll, viewerPlayerId, explorers, matchData } = options;
  if (!roll || roll.playerId === viewerPlayerId) {
    return null;
  }
  const actor = explorers.find((explorer) => explorer.playerId === roll.playerId);
  const actorName = actor
    ? resolvePlayerName(actor.playerId, actor.displayName, matchData)
    : resolvePlayerName(roll.playerId, "玩家", matchData);
  return `由 ${actorName} 触发`;
}

export function resolveEventRollConfirmationPresentation(
  core: BetrayalCore,
  viewerPlayerId: string,
): EventRollConfirmationPresentation {
  const pendingResolution = core.pendingEventRollResolution;
  const requiredPlayerIds = pendingResolution
    ? resolvePendingEventRollResolutionRequiredPlayerIds(core, pendingResolution)
    : [];
  const acknowledgedPlayerIds =
    pendingResolution?.acknowledgedPlayerIds ?? [];
  const confirmedCount = requiredPlayerIds.filter((playerId) =>
    acknowledgedPlayerIds.includes(playerId),
  ).length;
  const totalCount = requiredPlayerIds.length;
  const viewerHasAcknowledged = acknowledgedPlayerIds.includes(viewerPlayerId);
  const canViewerAcknowledge = Boolean(
    pendingResolution &&
      pendingResolution.requiresAcknowledgement !== false &&
      requiredPlayerIds.includes(viewerPlayerId) &&
      !viewerHasAcknowledged,
  );

  return {
    requiredPlayerIds: [...requiredPlayerIds],
    acknowledgedPlayerIds: [...acknowledgedPlayerIds],
    confirmedCount,
    totalCount,
    viewerHasAcknowledged,
    canViewerAcknowledge,
  };
}

export function resolveBetrayalRerollTargetBoxSize(
  layout: DicePhysicsProjectedLayout,
): number {
  const visibleWidth = layout.visualWidth ?? layout.width;
  const visibleHeight = layout.visualHeight ?? layout.height;
  const longestVisibleSide = Math.max(visibleWidth, visibleHeight);
  const paddedVisibleSize =
    longestVisibleSide + BETRAYAL_REROLL_TARGET_MAX_HIT_PADDING * 2;
  return Math.max(
    longestVisibleSide,
    Math.min(BETRAYAL_REROLL_TARGET_MIN_HIT_SIZE, paddedVisibleSize),
  );
}
