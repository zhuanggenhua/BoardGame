import type {
  BetrayalCore,
  BetrayalDiscoverySummary,
  BetrayalRecentRollState,
} from "./game";

export type LatestDiscoveryDisplayEntry = {
  key: string;
  sourceKey: string;
  discovery: BetrayalDiscoverySummary;
  ownerPlayerId: string | null;
  recentRoll: BetrayalRecentRollState | null;
};

export function buildLatestDiscoveryKey(core: BetrayalCore): string | null {
  return core.latestDiscovery
    ? [
        core.latestDiscoveryOwnerPlayerId ?? "",
        core.latestDiscovery.kind,
        core.latestDiscovery.title,
        core.latestDiscovery.summary,
        core.latestDiscovery.detail,
      ].join("::")
    : null;
}

export function isHauntScenarioOpeningDiscoverySummary(
  discovery: BetrayalDiscoverySummary | null,
): boolean {
  if (!discovery) {
    return false;
  }
  const discoveryText = [
    discovery.title,
    discovery.summary,
    discovery.detail,
  ].join(" ");
  return (
    discoveryText.includes("剧本") ||
    discoveryText.includes("作祟开始") ||
    discoveryText.includes("自动触发作祟") ||
    discoveryText.includes("预兆牌堆耗尽，自动触发作祟") ||
    discoveryText.includes("最后一张预兆触发作祟") ||
    (discoveryText.includes("作祟检定") && discoveryText.includes("已触发"))
  );
}

export function isHauntScenarioBookRevealDiscoverySummary(
  discovery: BetrayalDiscoverySummary | null,
): boolean {
  if (!discovery) {
    return false;
  }
  return [discovery.title, discovery.summary, discovery.detail]
    .join(" ")
    .includes("剧本");
}

export function isHauntScenarioOpeningDiscovery(core: BetrayalCore): boolean {
  if (
    core.phase !== "haunt" ||
    !core.scenarioRuntime.hauntTriggered ||
    !core.latestDiscovery
  ) {
    return false;
  }
  return isHauntScenarioOpeningDiscoverySummary(core.latestDiscovery);
}

function cloneRecentRollForDiscoveryDisplay(
  recentRoll: BetrayalRecentRollState | null,
): BetrayalRecentRollState | null {
  return recentRoll
    ? {
        ...recentRoll,
        dice: [...recentRoll.dice],
        requiredPlayerIds: recentRoll.requiredPlayerIds
          ? [...recentRoll.requiredPlayerIds]
          : undefined,
        acknowledgedPlayerIds: recentRoll.acknowledgedPlayerIds
          ? [...recentRoll.acknowledgedPlayerIds]
          : undefined,
        consumedRabbitFootCardIds: [
          ...recentRoll.consumedRabbitFootCardIds,
        ],
        branchThresholds: recentRoll.branchThresholds?.map((branch) => ({
          ...branch,
          effect: { ...branch.effect },
        })),
        eventRolledDamageResults: recentRoll.eventRolledDamageResults?.map((damage) => ({
          ...damage,
          rolls: [...damage.rolls],
        })),
        sourceEventRoll: recentRoll.sourceEventRoll
          ? {
              ...recentRoll.sourceEventRoll,
              dice: [...recentRoll.sourceEventRoll.dice],
            }
          : undefined,
      }
    : null;
}

export function buildLatestDiscoveryDisplayEntry(
  core: BetrayalCore,
): LatestDiscoveryDisplayEntry | null {
  if (
    isHauntScenarioOpeningDiscovery(core) &&
    isHauntScenarioBookRevealDiscoverySummary(core.latestDiscovery)
  ) {
    return null;
  }
  if (
    isHauntScenarioOpeningDiscovery(core) &&
    (core.pendingCardResolutionQueue?.length ?? 0) === 0
  ) {
    return null;
  }
  const baseKey = buildLatestDiscoveryKey(core);
  if (!core.latestDiscovery || !baseKey) {
    return null;
  }
  if (isEventSymbolNoCardDiscovery(core.latestDiscovery)) {
    return null;
  }
  const isHauntRollForOwner = Boolean(
    core.latestDiscovery.kind === "omen" &&
      core.recentRoll?.kind === "hauntRoll" &&
      core.latestDiscoveryOwnerPlayerId === core.recentRoll.playerId &&
      core.recentRoll.sourceTitle === core.latestDiscovery.title,
  );
  if (core.latestDiscoveryOwnerPlayerId === null && !isHauntRollForOwner) {
    return null;
  }
  const relatedRecentRoll =
    core.recentRoll?.sourceTitle === core.latestDiscovery.title
      ? core.recentRoll
      : null;
  const recentRollId = relatedRecentRoll?.id ?? "";
  const activityId = core.activityLog[0]?.id ?? "";
  const sourceKey = buildLatestDiscoverySourceKey(
    core.latestDiscoveryOwnerPlayerId,
    core.latestDiscovery,
  );
  return {
    key: [baseKey, recentRollId, activityId].join("::"),
    sourceKey,
    discovery: {
      ...core.latestDiscovery,
      resolutionSteps: core.latestDiscovery.resolutionSteps?.map((step) => ({
        ...step,
      })),
    },
    ownerPlayerId: core.latestDiscoveryOwnerPlayerId,
    recentRoll: cloneRecentRollForDiscoveryDisplay(relatedRecentRoll),
  };
}

export function isSpiderAdjacentRoomResolutionDiscovery(
  discovery: BetrayalDiscoverySummary | null,
): boolean {
  return Boolean(
    discovery?.kind === "event" &&
      discovery.title === "蜘蛛！" &&
      discovery.detail.includes("放置到") &&
      (discovery.detail.includes("神志 +1") ||
        discovery.detail.includes("速度 +1")),
  );
}

export function buildLatestDiscoverySourceKey(
  ownerPlayerId: string | null,
  discovery: BetrayalDiscoverySummary,
): string {
  return [ownerPlayerId ?? "", discovery.kind, discovery.title].join("::");
}

export function buildEventSymbolSkipSourceKey(
  ownerPlayerId: string | null,
): string {
  return [ownerPlayerId ?? "", "event", "事件符号"].join("::");
}

export function isEventSymbolNoCardDiscovery(
  discovery: BetrayalDiscoverySummary | null,
): boolean {
  if (discovery?.kind !== "event") {
    return false;
  }
  const text = [discovery.summary, discovery.detail].join(" ");
  return (
    text.includes("没有抽取或结算事件卡") ||
    text.includes("不抽取或结算事件卡")
  );
}
