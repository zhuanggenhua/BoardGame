import type { BetrayalCore, BetrayalTraitKey } from "./game";
import {
  BETRAYAL_TRAIT_LABEL,
  effectIsTraitOnly,
} from "./possessionEffects";

type ActivityText = (key: string, options?: Record<string, unknown>) => string;

type BetrayalActivityEntry = BetrayalCore["activityLog"][number];

export type BetrayalBoardResultFeedback = {
  kind: "heal" | "traitChange";
  title: string;
  detail: string;
  targetName: string | null;
  targetPlayerId?: string | null;
  targetLabel: string | null;
  traitSummary: string;
  traitCount: number;
  meta: string;
  deltaText?: string;
};

export type BetrayalTraitDelta = {
  trait: BetrayalTraitKey;
  amount: number;
};

export function resolveBetrayalTraitDeltas(
  before: Record<BetrayalTraitKey, number> | undefined,
  after: Record<BetrayalTraitKey, number> | undefined,
): BetrayalTraitDelta[] {
  if (!before || !after) {
    return [];
  }
  return (Object.keys(BETRAYAL_TRAIT_LABEL) as BetrayalTraitKey[])
    .map((trait) => ({
      trait,
      amount: (after[trait] ?? 0) - (before[trait] ?? 0),
    }))
    .filter((entry) => entry.amount !== 0);
}

export type BetrayalActivityPresentation = {
  visibleActivityEntries: BetrayalActivityEntry[];
  latestLogEntry: BetrayalActivityEntry | null;
  visibleBoardResultFeedback: BetrayalBoardResultFeedback | null;
  earlierLogEntries: BetrayalActivityEntry[];
};

export function resolveBetrayalActivityPresentation({
  core,
  text,
}: {
  core: BetrayalCore;
  text: ActivityText;
}): BetrayalActivityPresentation {
  const visibleActivityEntries = core.activityLog.filter(
    (entry) => !entry.id.startsWith("scenario-started-"),
  );
  const latestLogEntry = visibleActivityEntries[0] ?? null;
  const visibleBoardResultFeedback = resolveBoardResultFeedback(
    latestLogEntry,
    text,
  ) ?? resolveTraitChangeFeedback(core);
  return {
    visibleActivityEntries,
    latestLogEntry,
    visibleBoardResultFeedback,
    earlierLogEntries: visibleActivityEntries.slice(1, 4),
  };
}

function resolveTraitChangeFeedback(
  core: BetrayalCore,
): BetrayalBoardResultFeedback | null {
  const recentRoll = core.recentRoll;
  const snapshot = recentRoll?.eventEffectSnapshot;
  if (
    !recentRoll
    || !snapshot
    || (recentRoll.kind !== "eventDiceRoll" && recentRoll.kind !== "eventTraitCheck")
    || recentRoll.playerId !== core.currentExplorer.playerId
    || core.latestDiscovery?.kind !== "event"
    || core.latestDiscovery.title !== recentRoll.sourceTitle
  ) {
    return null;
  }
  const effect = recentRoll.branchThresholds?.find(
    (branch) => branch.label === recentRoll.latestLabel,
  )?.effect;
  if (!effectIsTraitOnly(effect)) {
    return null;
  }
  const traitDeltas = resolveBetrayalTraitDeltas(
    snapshot.traitsBeforeEffect,
    core.currentExplorer.traits,
  );
  if (traitDeltas.length === 0) {
    return null;
  }
  const deltaText = traitDeltas
    .map(({ trait, amount }) => `${amount > 0 ? "+" : ""}${amount} ${BETRAYAL_TRAIT_LABEL[trait]}`)
    .join(" / ");
  return {
    kind: "traitChange",
    title: `${recentRoll.sourceTitle}属性变化`,
    detail: deltaText,
    targetName: core.currentExplorer.displayName,
    targetPlayerId: core.currentExplorer.playerId,
    targetLabel: `属性变化目标：${core.currentExplorer.displayName}`,
    traitSummary: traitDeltas.map(({ trait }) => BETRAYAL_TRAIT_LABEL[trait]).join(" / "),
    traitCount: traitDeltas.length,
    meta: "事件效果已结算",
    deltaText,
  };
}

function resolveBoardResultFeedback(
  latestLogEntry: BetrayalActivityEntry | null,
  text: ActivityText,
): BetrayalBoardResultFeedback | null {
  const logText = latestLogEntry?.text?.trim();
  if (!logText) {
    return null;
  }
  const healMatch = logText.match(/埋葬([^，,。]+)[，,]\s*(治疗.+)$/);
  if (!healMatch) {
    return null;
  }
  const cardName = healMatch[1]?.trim() || text("board.inventory.item");
  const resultText = healMatch[2]?.trim() ?? "";
  const healDetailMatch = resultText.match(/^治疗(.+?)的(.+)$/);
  const targetName = healDetailMatch?.[1]?.trim() ?? null;
  const traitText = healDetailMatch?.[2]?.trim() ?? "";
  const traitNames = traitText
    ? traitText
        .split("和")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  return {
    kind: "heal",
    title: `${cardName}已使用`,
    detail: resultText,
    targetName,
    targetLabel: targetName ? `治疗目标：${targetName}` : null,
    traitSummary: traitNames.length > 0 ? traitNames.join(" / ") : traitText,
    traitCount: traitNames.length,
    meta: "物品已移除",
  };
}
