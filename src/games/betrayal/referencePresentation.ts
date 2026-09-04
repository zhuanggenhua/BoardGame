import {
  resolveBetrayalExplorerSide,
  type BetrayalExplorerSide,
} from "./entityRelationModel";
import type { BetrayalCore } from "./game";
import { resolveBetrayalHauntRevealProtocol } from "./hauntSetupModel";

export type ReferencePageId = "front" | "back" | "traitor" | "monster";

export type ReferencePage = {
  id: ReferencePageId;
  asset: string;
};

export type ReferenceAssetMap = Record<ReferencePageId, string>;

export type BetrayalReferenceCardId =
  | "player-reference-front"
  | "player-reference-back"
  | "heroes-book"
  | "traitor-book"
  | "monster-reference-card";

export type BetrayalReferenceCardKind =
  | "base-reference"
  | "scenario-book"
  | "monster-reference";

export type BetrayalReferenceCardVisibility =
  | "all"
  | "heroes"
  | "traitor"
  | "none";

export interface BetrayalReferenceCardAccessSummary {
  id: BetrayalReferenceCardId;
  kind: BetrayalReferenceCardKind;
  label: string;
  active: boolean;
  visibleTo: BetrayalReferenceCardVisibility;
  viewerPlayerId: string | null;
  viewerSide: "hero" | "traitor" | "free-for-all" | null;
  viewerCanOpen: boolean;
  source: "base-rule" | "haunt-protocol" | "monster-box";
  reason: string | null;
  representativeOnly: boolean;
}

const PLAYER_REFERENCE_PAGE_IDS: ReferencePageId[] = ["front", "back"];
const HAUNT_REFERENCE_PAGE_IDS: ReferencePageId[] = [
  ...PLAYER_REFERENCE_PAGE_IDS,
  "traitor",
  "monster",
];

function buildReferencePages(
  pageIds: ReferencePageId[],
  referenceAssets: ReferenceAssetMap,
): ReferencePage[] {
  return pageIds.map((id) => ({
    id,
    asset: referenceAssets[id],
  }));
}

export function resolveReferencePages(
  core: BetrayalCore,
  referenceAssets: ReferenceAssetMap,
): ReferencePage[] {
  return buildReferencePages(
    core.phase === "haunt" ? HAUNT_REFERENCE_PAGE_IDS : PLAYER_REFERENCE_PAGE_IDS,
    referenceAssets,
  );
}

function normalizeBetrayalReferenceViewerSide(
  side: BetrayalExplorerSide,
): BetrayalReferenceCardAccessSummary["viewerSide"] {
  if (side?.startsWith("free-for-all:")) {
    return "free-for-all";
  }
  return side;
}

function canViewerOpenBetrayalReferenceCard(
  visibleTo: BetrayalReferenceCardVisibility,
  viewerSide: BetrayalReferenceCardAccessSummary["viewerSide"],
): boolean {
  switch (visibleTo) {
    case "all":
      return true;
    case "heroes":
      return viewerSide === "hero";
    case "traitor":
      return viewerSide === "traitor";
    case "none":
    default:
      return false;
  }
}

function createBetrayalReferenceCardAccessSummary(
  input: Omit<BetrayalReferenceCardAccessSummary, "viewerCanOpen">,
): BetrayalReferenceCardAccessSummary {
  return {
    ...input,
    viewerCanOpen:
      input.active &&
      canViewerOpenBetrayalReferenceCard(input.visibleTo, input.viewerSide),
  };
}

export function resolveBetrayalReferenceCardAccess(
  core: BetrayalCore,
  viewerPlayerId: string | null = core.currentPlayer,
): BetrayalReferenceCardAccessSummary[] {
  const protocol = resolveBetrayalHauntRevealProtocol(core);
  const viewerSide = viewerPlayerId
    ? normalizeBetrayalReferenceViewerSide(
        resolveBetrayalExplorerSide(core, viewerPlayerId),
      )
    : null;
  const baseInput = {
    viewerPlayerId,
    viewerSide,
    representativeOnly: false,
  };
  const references: BetrayalReferenceCardAccessSummary[] = [
    createBetrayalReferenceCardAccessSummary({
      ...baseInput,
      id: "player-reference-front",
      kind: "base-reference",
      label: "玩家参考卡正面",
      active: true,
      visibleTo: "all",
      source: "base-rule",
      reason: null,
    }),
    createBetrayalReferenceCardAccessSummary({
      ...baseInput,
      id: "player-reference-back",
      kind: "base-reference",
      label: "玩家参考卡背面",
      active: true,
      visibleTo: "all",
      source: "base-rule",
      reason: null,
    }),
    createBetrayalReferenceCardAccessSummary({
      ...baseInput,
      id: "heroes-book",
      kind: "scenario-book",
      label: "英雄剧本书",
      active: protocol.active,
      visibleTo: protocol.active
        ? protocol.secretBoundary.heroBookVisibleTo
        : "none",
      source: "haunt-protocol",
      representativeOnly: protocol.active,
      reason: protocol.active
        ? "按作祟揭示协议决定英雄书可见范围。"
        : "作祟尚未开始，不能打开作祟剧本书。",
    }),
    createBetrayalReferenceCardAccessSummary({
      ...baseInput,
      id: "traitor-book",
      kind: "scenario-book",
      label: "叛徒剧本书",
      active:
        protocol.active && protocol.secretBoundary.traitorBookVisibleTo !== "none",
      visibleTo: protocol.active
        ? protocol.secretBoundary.traitorBookVisibleTo
        : "none",
      source: "haunt-protocol",
      representativeOnly: protocol.active,
      reason:
        protocol.active && protocol.secretBoundary.traitorBookVisibleTo !== "none"
          ? "按作祟揭示协议决定叛徒书只给叛徒查看。"
          : "该作祟当前没有公开叛徒书入口，避免泄露隐藏身份或不存在的秘密段落。",
    }),
    createBetrayalReferenceCardAccessSummary({
      ...baseInput,
      id: "monster-reference-card",
      kind: "monster-reference",
      label: "怪物参考卡",
      active: protocol.active && core.monsters.length > 0,
      visibleTo: protocol.active && core.monsters.length > 0 ? "all" : "none",
      source: "monster-box",
      representativeOnly: protocol.active,
      reason:
        core.monsters.length > 0
          ? "当前作祟已有怪物运行态，怪物参考卡可公开查看。"
          : "当前宅邸还没有怪物运行态。",
    }),
  ];
  return references;
}
