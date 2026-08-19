import React from "react";
import { useInRouterContext } from "react-router-dom";
import {
  BookOpen,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Eye,
  Footprints,
  Handshake,
  House,
  Hourglass,
  ImageOff,
  LocateFixed,
  RotateCcw,
  RotateCw,
  Search,
  Skull,
  Swords,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTutorial, useTutorialBridge } from "../../contexts/TutorialContext";
import { HudPortal, UI_Z_INDEX } from "../../core";
import type { ActionBarAction } from "../../core/ui/types";
import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import { MagnifyOverlay } from "../../components/common/overlays/MagnifyOverlay";
import { FoldLinePageFlipStage } from "../../components/home-v2/FoldLinePageFlipStage";
import { DiceBoxPhysicsSource } from "../../lib/dice-physics/DiceBoxPhysicsSource";
import type { DiceBoxDieSkin } from "../../lib/dice-box-threejs/engine";
import type { DiceBoxStyleProfile } from "../../lib/dice-box-threejs/engine";
import type { DicePhysicsState } from "../../lib/dice-physics/types";
import { playSound, useGameAudio } from "../../lib/audio/useGameAudio";
import {
  DamageFlash,
  HitStopContainer,
  ShakeContainer,
  useImpactFeedback,
} from "../../components/common/animations";
import {
  ResourceTraySkeleton,
  ZoomPanViewport,
  useVisualSequenceGate,
} from "../../components/game/framework";
import { GameDebugPanel } from "../../components/game/framework/widgets/GameDebugPanel";
import { useRuntimeViewport } from "../../hooks/ui/useRuntimeViewport";
import type { MatchPlayerInfo } from "../../engine/transport/protocol";
import type { GameBoardProps } from "../../engine/transport/protocol";
import type {
  BetrayalCommandMap,
  BetrayalBloodFromStonePeekabooOption,
  BetrayalCore,
  BetrayalDeckKind,
  BetrayalDiscoverySummary,
  BetrayalExplorerSummary,
  BetrayalHauntRevealProtocol,
  BetrayalHauntSpecialActionId,
  BetrayalHauntSpecialActionStatus,
  BetrayalHauntTokenInstanceSummary,
  BetrayalHelpingHandsTrollHandAttackOption,
  BetrayalInventoryCard,
  BetrayalMonsterActionSlot,
  BetrayalMonsterStatusKind,
  BetrayalMonsterSummary,
  BetrayalPendingCardResolutionState,
  BetrayalRecentRollState,
  BetrayalRoomVisualId,
  BetrayalRoomEdge,
  BetrayalRoomNode,
  BetrayalRoomPlacementPreview,
  BetrayalRoomTileAdjustmentOption,
  BetrayalRoomTileAdjustmentSelection,
  BetrayalTraitKey,
  BetrayalTraitTrackState,
  BetrayalTradeCardStatus,
  PossessionUseEffectProfile,
  UseEffectProfile,
} from "./game";
import {
  BETRAYAL_COMMANDS,
  BetrayalDomain,
  EXPLORER_CATALOG,
  canUseDogForTrade,
  canUseHolySymbolForDiscovery,
  canUseIdolToSkipEvent,
  canUseRecentRollRerollItemForRecentRoll,
  canUseSkeletonKeyForMove,
  createBetrayalCharacterSelectCore,
  resolveHelpingHandsControllerPlayerId,
  resolveHelpingHandsMonsterTurnStatus,
  resolveHelpingHandsPendingAttackReward,
  resolveHelpingHandsStealableCards,
  resolveHelpingHandsTrollHandAttackOptions,
  resolveHelpingHandsTrollHandMoveOptions,
  resolveMummyPendingAttackReward,
  resolveMummyStealableCards,
  resolveRecentRollRerollSelectableDieIndices,
  resolveBetrayalAttackTargetPlayerIds,
  resolveBetrayalHauntRisk,
  resolveBetrayalHauntRevealProtocol,
  resolveBetrayalHauntSpecialActionStatus,
  resolveBetrayalHauntTokenInstances,
  resolveBetrayalMonsterActionPanel,
  resolveBetrayalNormalMonsterAttackTargets,
  resolveBetrayalMonsterStatuses,
  resolveBetrayalNumberTracks,
  resolveBetrayalPossessionSpecialActionStatus,
  resolveBetrayalRoomSpecialActionStatus,
  resolveBetrayalTraitorPowerStatus,
  resolveBetrayalTradeCardStatus,
  resolveBetrayalLineOfSightRoomIds,
  resolveBloodFromStonePeekabooOptions,
  resolveBloodFromStoneSetupPlacementPlan,
  resolveAttackWeaponCardStatuses,
  resolveDogTradeTargets,
  resolveExplorableRoomSlots,
  resolveMagicCameraPhotoTargets,
  resolveNextRoomDiscoveryDeckKind,
  resolveRoomPlacementPreview,
  resolveRoomTileAdjustmentOptions,
  resolveMagicCameraPhantomAttackTargets,
  resolveInventoryEffectId,
  resolveUseEffect,
} from "./game";
import {
  BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
  buildPossessionAtlasImageStyle,
  resolvePossessionAtlasVisual,
  type BetrayalPossessionAtlasVisual,
} from "./possessionAtlas";
import {
  getBetrayalScenarioCardCandidate,
  isBetrayalOptionalHauntRollRuntimeSupported,
  resolveImplementedScenarioIdForCard,
  type BetrayalScenarioCardCandidate,
  type BetrayalScenarioCardId,
} from "./scenarioConfig";
import {
  buildDiscoveryAtlasImageStyle,
  resolveDiscoveryAtlasVisual,
  type BetrayalDiscoveryAtlasVisual,
} from "./discoveryAtlas";
import {
  BETRAYAL_ROOM_TILE_VISUALS,
  buildRoomAtlasImageStyle,
  type BetrayalRoomTileVisual,
} from "./roomAtlas";
import {
  BETRAYAL_AUDIO_CONFIG,
  BETRAYAL_SCENARIO_PAGE_TURN_KEY,
} from "./audio.config";
import { BETRAYAL_MANIFEST } from "./manifest";
import { BETRAYAL_VISUAL_TRANSITION_DURATION_MS } from "./visualTiming";

type Props = GameBoardProps<BetrayalCore, BetrayalCommandMap>;

type ScenarioReaderSection = {
  id: string;
  labelKey: string;
  bodyKey: string;
  accentClass: string;
  audiences: ScenarioReaderAudience[];
};

type ScenarioReaderPage = {
  id: string;
  type: "cover" | "section";
  pageNumber: number;
  sections?: ScenarioReaderSection[];
};

type ScenarioBookTurnSnapshot = {
  fromPages: [ScenarioReaderPage | null, ScenarioReaderPage | null];
  toPages: [ScenarioReaderPage | null, ScenarioReaderPage | null];
};

const SCENARIO_BOOK_TURN_DURATION_MS = 380;

const isChineseLocale = (locale: string) =>
  locale.toLowerCase().startsWith("zh");

type ScenarioReaderAudience = "all" | "heroes" | "traitor";
type ScenarioReaderScope = "all" | "heroes" | "traitor";

const SCENARIO_READER_RULE_HANDOFF_SECTION_IDS = new Set(["setup"]);
const SCENARIO_READER_ENDING_SECTION_IDS = new Set([
  "ending",
  "endingHeroes",
  "endingTraitor",
  "endingHaunt",
  "endingSurvivors",
]);
const SCENARIO_READER_CINEMATIC_SECTION_IDS = new Set([
  "prologue",
  "prologueHeroes",
  "prologueTraitor",
]);

const splitCinematicNarrationText = (text: string) =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const formatScenarioCardTitle = (
  candidate: BetrayalScenarioCardCandidate,
  locale: string,
) => (isChineseLocale(locale) ? candidate.title : candidate.titleEn);

const formatScenarioCardSummary = (
  candidate: BetrayalScenarioCardCandidate,
  locale: string,
) => (isChineseLocale(locale) ? candidate.summary : candidate.summaryEn);

type HauntDossierId =
  | "mummyRampage"
  | "crimsonJack"
  | "dust"
  | "bloodFromStone"
  | "helpingHands"
  | "magicCamera";

type HauntDossier = {
  id: HauntDossierId;
  cardNumber: number;
  titleKey: string;
  objectiveKey: string;
  heroGoalKey: string;
  traitorGoalKey: string;
  sections: ScenarioReaderSection[];
};

type HauntTargetGuide = {
  kind: "room" | "explorer" | "monster";
  roomId: string | null;
  playerId?: string;
  monsterId?: string;
  targetName: string;
  cue: string;
};

type HauntUseContext<Type extends keyof BetrayalCommandMap> = {
  actionKind: "use";
  commandType: Type;
  payload?: BetrayalCommandMap[Type];
  label: string;
  cue: string;
  hauntSpecialActionId?: BetrayalHauntSpecialActionId;
  disabledReason?: string | null;
};

const createHauntSection = (
  dossierId: HauntDossierId,
  id: string,
  accentClass: string,
  audiences: ScenarioReaderAudience[] = ["all"],
): ScenarioReaderSection => ({
  id,
  labelKey: `game-betrayal:board.haunts.${dossierId}.reader.${id}Label`,
  bodyKey: `game-betrayal:board.haunts.${dossierId}.reader.${id}`,
  accentClass,
  audiences,
});

const HAUNT_DOSSIERS: Record<HauntDossierId, HauntDossier> = {
  mummyRampage: {
    id: "mummyRampage",
    cardNumber: 1,
    titleKey: "game-betrayal:board.haunts.mummyRampage.title",
    objectiveKey: "game-betrayal:board.haunts.mummyRampage.objective",
    heroGoalKey: "game-betrayal:board.haunts.mummyRampage.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.mummyRampage.traitorGoal",
    sections: [
      createHauntSection("mummyRampage", "prologue", "border-[#8f5a22]"),
      createHauntSection("mummyRampage", "prologueHeroes", "border-[#8f5a22]", [
        "heroes",
      ]),
      createHauntSection("mummyRampage", "prologueTraitor", "border-[#8f5a22]", [
        "traitor",
      ]),
      createHauntSection("mummyRampage", "setup", "border-[#607f3a]"),
      createHauntSection("mummyRampage", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("mummyRampage", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("mummyRampage", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("mummyRampage", "monster", "border-[#684b87]", ["traitor"]),
      createHauntSection("mummyRampage", "endingHeroes", "border-[#8f5a22]", [
        "heroes",
      ]),
      createHauntSection("mummyRampage", "endingTraitor", "border-[#8f5a22]", [
        "traitor",
      ]),
    ],
  },
  crimsonJack: {
    id: "crimsonJack",
    cardNumber: 1,
    titleKey: "game-betrayal:board.haunts.crimsonJack.title",
    objectiveKey: "game-betrayal:board.haunts.crimsonJack.objective",
    heroGoalKey: "game-betrayal:board.haunts.crimsonJack.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.crimsonJack.traitorGoal",
    sections: [
      createHauntSection("crimsonJack", "prologue", "border-[#8f5a22]"),
      createHauntSection("crimsonJack", "setup", "border-[#607f3a]"),
      createHauntSection("crimsonJack", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("crimsonJack", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("crimsonJack", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("crimsonJack", "monster", "border-[#684b87]", ["traitor"]),
      createHauntSection("crimsonJack", "ending", "border-[#8f5a22]"),
    ],
  },
  dust: {
    id: "dust",
    cardNumber: 3,
    titleKey: "game-betrayal:board.haunts.dust.title",
    objectiveKey: "game-betrayal:board.haunts.dust.objective",
    heroGoalKey: "game-betrayal:board.haunts.dust.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.dust.traitorGoal",
    sections: [
      createHauntSection("dust", "prologue", "border-[#8f5a22]"),
      createHauntSection("dust", "setup", "border-[#607f3a]"),
      createHauntSection("dust", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("dust", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("dust", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("dust", "ending", "border-[#8f5a22]"),
    ],
  },
  bloodFromStone: {
    id: "bloodFromStone",
    cardNumber: 5,
    titleKey: "game-betrayal:board.haunts.bloodFromStone.title",
    objectiveKey: "game-betrayal:board.haunts.bloodFromStone.objective",
    heroGoalKey: "game-betrayal:board.haunts.bloodFromStone.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.bloodFromStone.traitorGoal",
    sections: [
      createHauntSection("bloodFromStone", "prologue", "border-[#8f5a22]"),
      createHauntSection("bloodFromStone", "setup", "border-[#607f3a]"),
      createHauntSection("bloodFromStone", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("bloodFromStone", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("bloodFromStone", "monster", "border-[#684b87]"),
      createHauntSection("bloodFromStone", "ending", "border-[#8f5a22]"),
    ],
  },
  helpingHands: {
    id: "helpingHands",
    cardNumber: 12,
    titleKey: "game-betrayal:board.haunts.helpingHands.title",
    objectiveKey: "game-betrayal:board.haunts.helpingHands.objective",
    heroGoalKey: "game-betrayal:board.haunts.helpingHands.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.helpingHands.traitorGoal",
    sections: [
      createHauntSection("helpingHands", "prologue", "border-[#8f5a22]"),
      createHauntSection("helpingHands", "setup", "border-[#607f3a]"),
      createHauntSection("helpingHands", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("helpingHands", "special", "border-[#a16c24]"),
      createHauntSection("helpingHands", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("helpingHands", "ending", "border-[#8f5a22]"),
    ],
  },
  magicCamera: {
    id: "magicCamera",
    cardNumber: 33,
    titleKey: "game-betrayal:board.haunts.magicCamera.title",
    objectiveKey: "game-betrayal:board.haunts.magicCamera.objective",
    heroGoalKey: "game-betrayal:board.haunts.magicCamera.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.magicCamera.traitorGoal",
    sections: [
      createHauntSection("magicCamera", "prologue", "border-[#8f5a22]"),
      createHauntSection("magicCamera", "setup", "border-[#607f3a]"),
      createHauntSection("magicCamera", "heroes", "border-[#43717a]", ["heroes"]),
      createHauntSection("magicCamera", "special", "border-[#a16c24]", ["heroes"]),
      createHauntSection("magicCamera", "traitor", "border-[#8f3c2e]", ["traitor"]),
      createHauntSection("magicCamera", "ending", "border-[#8f5a22]"),
    ],
  },
};

const HAUNT_DOSSIER_BY_CARD_NUMBER: Record<number, HauntDossierId> = {
  1: "mummyRampage",
  3: "dust",
  5: "bloodFromStone",
  12: "helpingHands",
  33: "magicCamera",
};

const HAUNT_DOSSIER_BY_HAUNT_ID: Record<
  NonNullable<BetrayalCore["endgameResult"]>["hauntId"],
  HauntDossierId
> = {
  "mummy-rampage": "mummyRampage",
  "crimson-jack-returns": "crimsonJack",
  "the-dust": "dust",
  "blood-from-a-stone": "bloodFromStone",
  "helping-hands": "helpingHands",
  "magic-camera": "magicCamera",
};

function resolveScenarioCardDossier(
  candidate: BetrayalScenarioCardCandidate,
): HauntDossier {
  if (candidate.id === "mummy-rampage") {
    return HAUNT_DOSSIERS.mummyRampage;
  }
  if (candidate.id === "crimson-jack-returns") {
    return HAUNT_DOSSIERS.crimsonJack;
  }
  const dossierId = HAUNT_DOSSIER_BY_CARD_NUMBER[candidate.hauntNumber];
  return dossierId ? HAUNT_DOSSIERS[dossierId] : HAUNT_DOSSIERS.crimsonJack;
}

function resolveActiveHauntDossier(core: BetrayalCore): HauntDossier {
  if (core.phase === "haunt" && core.scenarioRuntime.hauntCardNumber) {
    if (
      core.scenarioRuntime.hauntCardNumber === 1 &&
      core.scenarioRuntime.hauntScenarioCardId === "mummy-rampage"
    ) {
      return HAUNT_DOSSIERS.mummyRampage;
    }
    const dossierId =
      HAUNT_DOSSIER_BY_CARD_NUMBER[core.scenarioRuntime.hauntCardNumber] ??
      "crimsonJack";
    return HAUNT_DOSSIERS[dossierId];
  }
  return HAUNT_DOSSIERS.mummyRampage;
}

function resolveEndgameHauntDossier(core: BetrayalCore): HauntDossier {
  const hauntId = core.endgameResult?.hauntId;
  return hauntId
    ? HAUNT_DOSSIERS[HAUNT_DOSSIER_BY_HAUNT_ID[hauntId]]
    : resolveActiveHauntDossier(core);
}

function resolveEndgameNarrationSectionId(
  dossier: HauntDossier,
  outcome: NonNullable<BetrayalCore["endgameResult"]>["outcome"] | undefined,
): string {
  if (outcome === "haunt") {
    return "endingHaunt";
  }
  if (outcome === "traitor") {
    return "endingTraitor";
  }
  if (dossier.id === "mummyRampage") {
    return "endingHeroes";
  }
  return "endingSurvivors";
}

function resolveScenarioReaderScope(
  core: BetrayalCore,
  viewerPlayerId: string,
): ScenarioReaderScope {
  const teamModel = core.scenarioRuntime.hauntTraitorResolution?.teamModel;
  const isOneTraitorHaunt =
    core.phase === "haunt" &&
    core.scenarioRuntime.hauntTriggered &&
    (teamModel === "one-traitor" ||
      (!teamModel && Boolean(core.scenarioRuntime.traitorPlayerId)));

  if (!isOneTraitorHaunt || !core.scenarioRuntime.traitorPlayerId) {
    return "all";
  }

  return core.scenarioRuntime.traitorPlayerId === viewerPlayerId
    ? "traitor"
    : "heroes";
}

function isScenarioSectionVisibleForScope(
  section: ScenarioReaderSection,
  scope: ScenarioReaderScope,
): boolean {
  if (scope === "all") {
    return true;
  }
  return section.audiences.includes("all") || section.audiences.includes(scope);
}

function filterScenarioSectionsByScope(
  sections: ScenarioReaderSection[],
  scope: ScenarioReaderScope,
): ScenarioReaderSection[] {
  const immersiveSections = sections.filter(
    (section) =>
      !SCENARIO_READER_RULE_HANDOFF_SECTION_IDS.has(section.id) &&
      !SCENARIO_READER_ENDING_SECTION_IDS.has(section.id) &&
      !SCENARIO_READER_CINEMATIC_SECTION_IDS.has(section.id),
  );
  return immersiveSections.filter(
    (section) => isScenarioSectionVisibleForScope(section, scope),
  );
}

function findScenarioOpeningNarrationSection(
  dossier: HauntDossier,
  scope: ScenarioReaderScope,
): ScenarioReaderSection | null {
  const cinematicSections = dossier.sections.filter(
    (section) =>
      SCENARIO_READER_CINEMATIC_SECTION_IDS.has(section.id) &&
      isScenarioSectionVisibleForScope(section, scope),
  );
  if (scope !== "all") {
    return (
      cinematicSections.find((section) => section.audiences.includes(scope)) ??
      cinematicSections[0] ??
      null
    );
  }
  return (
    cinematicSections.find((section) => section.audiences.includes("all")) ??
    cinematicSections[0] ??
    null
  );
}

function buildScenarioReaderPages(
  dossier: HauntDossier = HAUNT_DOSSIERS.mummyRampage,
  scope: ScenarioReaderScope = "all",
): ScenarioReaderPage[] {
  const scopedSections = filterScenarioSectionsByScope(dossier.sections, scope);
  // 每个正文段占一页；书本一次展示左右两页，但不能为了减少翻页把结局
  // 和前置规则段压到同一轮翻页里，否则第一页翻页就会直接看到结局。
  const pageCount = Math.max(2, scopedSections.length);
  const baseSectionsPerPage = Math.floor(scopedSections.length / pageCount);
  const pagesWithExtraSection = scopedSections.length % pageCount;
  let sectionOffset = 0;

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const sectionCount =
      baseSectionsPerPage + (pageIndex < pagesWithExtraSection ? 1 : 0);
    const sections = scopedSections.slice(
      sectionOffset,
      sectionOffset + sectionCount,
    );
    sectionOffset += sectionCount;
    return {
      id: `${dossier.id}-dossier-${pageIndex + 1}`,
      type: "section" as const,
      pageNumber: pageIndex + 1,
      sections,
    };
  });
}

function resolveScenarioReaderSpreadPages(
  pages: ScenarioReaderPage[],
  hasOpeningStage: boolean,
  spreadIndex: number,
): [ScenarioReaderPage | null, ScenarioReaderPage | null] {
  const bookSpreadIndex = hasOpeningStage
    ? Math.max(0, spreadIndex - 1)
    : spreadIndex;
  return [
    pages[bookSpreadIndex * 2] ?? null,
    pages[bookSpreadIndex * 2 + 1] ?? null,
  ];
}

function BetrayalDebugPanel(props: {
  G: Props["G"];
  dispatch: Props["dispatch"];
  playerID: Props["playerID"];
}) {
  const isInRouter = useInRouterContext();
  if (!isInRouter) {
    return null;
  }

  return (
    <GameDebugPanel
      G={props.G}
      dispatch={props.dispatch}
      playerID={props.playerID}
      aiSupport={BETRAYAL_MANIFEST.ai}
      playerOptions={BETRAYAL_MANIFEST.playerOptions}
    />
  );
}

type DeckTrayItem = {
  id: string;
  label: string;
  count: number;
  asset: string;
};

type PreviewState = {
  selectedInventoryCardId: string | null;
  lastUsedInventoryCardId: string | null;
  selectedTradeTargetPlayerId: string | null;
  selectedCorpseLootCardId: string | null;
  selectedTradeGiveCardIds: string[];
  selectedDogTradeCardIds: string[];
  selectedTradeReturnCardIds: string[];
  selectedAttackWeaponCardId: string | null;
  selectedInventoryTargetPlayerId: string | null;
  selectedInventoryTargetRoomId: string | null;
  selectedInventoryReplacementRollTotal: number | null;
  selectedRollModifierDieIndex: number | null;
  selectedMaskTargetRoomIdsByTokenId: Record<string, string>;
  activeMaskTargetTokenId: string | null;
  selectedEventTrait: BetrayalTraitKey | null;
  selectedEventCardId: string | null;
  selectedDustSearchTrait: BetrayalTraitKey | null;
  selectedDustCureTrait: BetrayalTraitKey | null;
  selectedEventTargetRoomId: string | null;
  selectedEventDamageTraits: BetrayalTraitKey[];
  selectedDamageAllocationTraits: BetrayalTraitKey[];
  useBroochForDamageAllocation: boolean;
  useHolySymbolForExplore: boolean;
  useIdolForExplore: boolean;
  ignoreEventSymbolWithTraitorPower: boolean;
  pendingRoomPlacementSlotId: string | null;
  pendingRoomPlacementFailure: {
    roomId: string;
    floor: BetrayalRoomNode["floor"];
  } | null;
  pendingRoomOrientationTurns: RoomOrientationTurns;
  pendingRoomTileAdjustment: BetrayalRoomTileAdjustmentSelection | null;
  tradeSelectionTouched: boolean;
  dismissedLatestDiscoveryKey: string | null;
  dismissedRecentRollId: string | null;
  interactionMode:
    | "default"
    | "move"
    | "explore"
    | "sicknessExchange"
    | "helpingHandsTrollMove"
    | "monsterMove"
    | "monsterAttack"
    | "bloodFromStoneSetupPlacement"
    | "bloodFromStoneMonsterTurnEnd";
  hauntTargetingActionKind: string | null;
  selectedHelpingHandsTrollHandMoveMonsterId: string | null;
  selectedMonsterMoveMonsterId: string | null;
  selectedMonsterAttackMonsterId: string | null;
  selectedPeekabooSameRoomMonsterId: string | null;
  selectedPeekabooLineOfSightMonsterId: string | null;
  selectedBloodFromStoneStoneCherubRoomIds: string[];
};

type LatestDiscoveryDisplayEntry = {
  key: string;
  sourceKey: string;
  discovery: BetrayalDiscoverySummary;
  ownerPlayerId: string | null;
  recentRoll: BetrayalRecentRollState | null;
};

type RoomEndTurnEffectHint = {
  title: string;
  detail: string;
};

function resolveRoomEndTurnEffectHint(
  room: BetrayalRoomNode | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
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

const ROOM_TILE_SIZE = 184;
const ROOM_TILE_STEP_X = 184;
const ROOM_TILE_STEP_Y = 184;
const ROOM_CANVAS_PADDING = 8;
const ROOM_CANVAS_MIN_WIDTH = 780;
const ROOM_CANVAS_MIN_HEIGHT = 560;

const ASSETS = {
  titleBanner: "betrayal/ui/title-banner",
  cover: "betrayal/thumbnails/cover",
  playerReference: {
    front: "betrayal/cards/player-reference-zh-front",
    back: "betrayal/cards/player-reference-zh-back",
    traitor: "betrayal/cards/traitor-reference-zh",
    monster: "betrayal/cards/monster-reference-zh",
  },
  traitorBack: "betrayal/cards/back-traitor",
  deck: {
    omen: "betrayal/cards/back-omen",
    item: "betrayal/cards/back-item",
    event: "betrayal/cards/back-event",
  } satisfies Record<BetrayalDeckKind, string>,
  trait: {
    might: "betrayal/markers/might",
    speed: "betrayal/markers/speed",
    knowledge: "betrayal/markers/knowledge",
    sanity: "betrayal/markers/sanity",
  } satisfies Record<BetrayalTraitKey, string>,
  marker: {
    altar: "betrayal/markers/altar",
    blessing: "betrayal/markers/blessing",
    blood: "betrayal/markers/blood",
    contract: "betrayal/markers/contract",
    food: "betrayal/markers/food",
    hidden: "betrayal/markers/hidden",
    nest: "betrayal/markers/nest",
    obstacle: "betrayal/markers/obstacle",
    off: "betrayal/markers/off",
    on: "betrayal/markers/on",
    portal: "betrayal/markers/portal",
    searched: "betrayal/markers/searched",
    trait: "betrayal/markers/trait",
    numberBlank: "betrayal/markers/number-blank",
    videotape: "betrayal/markers/videotape",
  } as const,
  ui: {
    hauntRiskTrack: "betrayal/ui/trait-track-0-9",
  } as const,
} as const;

const EXPLORER_BOARD_MARKER_RANGE: Record<
  BetrayalTraitKey,
  { from: { x: number; y: number }; to: { x: number; y: number } }
> = {
  might: { from: { x: 14.5, y: 44.5 }, to: { x: 35.5, y: 23.5 } },
  speed: { from: { x: 18.5, y: 79.5 }, to: { x: 18.5, y: 54.5 } },
  knowledge: { from: { x: 85.5, y: 44.5 }, to: { x: 64.5, y: 23.5 } },
  sanity: { from: { x: 81.5, y: 79.5 }, to: { x: 81.5, y: 54.5 } },
};

const ACTION_ICON_BY_ID = {
  move: Footprints,
  monsterMove: Footprints,
  monsterAttack: Swords,
  bloodFromStoneSetupPlacement: House,
  bloodFromStoneConfirmSetupPlacement: House,
  monsterMovementRoll: RotateCcw,
  monsterTurnStart: Skull,
  bloodFromStoneMonsterTurnEnd: Hourglass,
  explore: Search,
  trade: Handshake,
  use: BookOpen,
  roomEffect: RotateCcw,
  endTurn: Hourglass,
  cancelTarget: X,
} as const;

const ENDGAME_MEDALLION_CLIP_PATH =
  "polygon(50% 0%, 85% 11%, 100% 42%, 83% 85%, 50% 100%, 17% 85%, 0% 42%, 15% 11%)";
const REFERENCE_CARD_FRAME_WIDTH = `min(92vw, calc(86vh * ${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO}))`;
const SCENARIO_REFERENCE_BOOK_FRAME_WIDTH = "min(94vw, 1120px)";
const SCENARIO_REFERENCE_BOOK_FRAME_HEIGHT = "min(86vh, 760px)";
const INVENTORY_PREVIEW_MAX_WIDTH = 360;
const INVENTORY_PREVIEW_VIEWPORT_WIDTH_RATIO = 0.84;
const INVENTORY_PREVIEW_VERTICAL_GUTTER = 80;
const COMPACT_INVENTORY_CARD_WIDTH = 62;
const SCENARIO_READER_MODAL_Z_INDEX = UI_Z_INDEX.emergencyHud + 20;

type ReferencePageId = "front" | "back" | "traitor" | "monster";

type ReferencePage = {
  id: ReferencePageId;
  asset?: string;
};

const PLAYER_REFERENCE_PAGES: ReferencePage[] = [
  { id: "front", asset: ASSETS.playerReference.front },
  { id: "back", asset: ASSETS.playerReference.back },
];

const HAUNT_REFERENCE_PAGES: ReferencePage[] = [
  ...PLAYER_REFERENCE_PAGES,
  { id: "traitor", asset: ASSETS.playerReference.traitor },
  { id: "monster", asset: ASSETS.playerReference.monster },
];

function resolveReferencePages(core: BetrayalCore): ReferencePage[] {
  return core.phase === "haunt"
    ? HAUNT_REFERENCE_PAGES
    : PLAYER_REFERENCE_PAGES;
}

const FLOOR_TONE: Record<
  BetrayalCore["rooms"][number]["floor"],
  { label: string; accent: string; glow: string }
> = {
  ground: { label: "一层", accent: "#c5a56c", glow: "rgba(197,165,108,0.32)" },
  upper: { label: "二层", accent: "#8ba98d", glow: "rgba(139,169,141,0.28)" },
  basement: {
    label: "地下",
    accent: "#8b6b78",
    glow: "rgba(139,107,120,0.26)",
  },
};

const ROOM_MAP_FLOOR_ORDER: BetrayalRoomNode["floor"][] = [
  "upper",
  "ground",
  "basement",
];

type RoomOrientationTurns = 0 | 1 | 2 | 3;

const ROOM_ORIENTATION_DEGREES: Record<RoomOrientationTurns, number> = {
  0: 0,
  1: 90,
  2: 180,
  3: 270,
};

const ROOM_EDGE_MARKER_CLASS: Record<BetrayalRoomEdge, string> = {
  north: "left-1/2 top-1 -translate-x-1/2",
  east: "right-1 top-1/2 -translate-y-1/2",
  south: "bottom-1 left-1/2 -translate-x-1/2",
  west: "left-1 top-1/2 -translate-y-1/2",
};

function roomTileAdjustmentSelectionsMatch(
  left: BetrayalRoomTileAdjustmentSelection,
  right: BetrayalRoomTileAdjustmentSelection,
): boolean {
  return (
    left.roomId === right.roomId &&
    left.x === right.x &&
    left.y === right.y &&
    left.entryRoomId === right.entryRoomId &&
    left.entryEdge === right.entryEdge &&
    left.orientationTurns === right.orientationTurns
  );
}

function toRoomTileAdjustmentSelection(
  option: BetrayalRoomTileAdjustmentOption,
): BetrayalRoomTileAdjustmentSelection {
  return {
    roomId: option.roomId,
    x: option.x,
    y: option.y,
    entryRoomId: option.entryRoomId,
    entryEdge: option.entryEdge,
    orientationTurns: option.orientationTurns,
  };
}

const ROOM_IDENTITY_TONE = {
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
} as const;

const INVENTORY_FACE_TONE = {
  item: {
    cardSurfaceClass:
      "border-[rgba(118,74,50,0.58)] bg-[linear-gradient(180deg,rgba(85,40,30,0.96),rgba(35,18,16,0.96))]",
    frameClass: "border-[rgba(192,110,86,0.24)] bg-[rgba(20,10,10,0.18)]",
    badgeClass:
      "border-[rgba(202,124,95,0.34)] bg-[rgba(68,29,22,0.8)] text-[#efc4ad]",
    nameClass: "text-[#f6e6d8]",
    accentClass: "text-[#eeb29d]",
    backOpacityClass: "opacity-[0.14]",
  },
  omen: {
    cardSurfaceClass:
      "border-[rgba(88,119,73,0.58)] bg-[linear-gradient(180deg,rgba(53,77,38,0.96),rgba(18,31,20,0.96))]",
    frameClass: "border-[rgba(140,181,123,0.24)] bg-[rgba(11,20,12,0.18)]",
    badgeClass:
      "border-[rgba(126,182,127,0.34)] bg-[rgba(29,61,35,0.78)] text-[#d4f0cb]",
    nameClass: "text-[#edf4df]",
    accentClass: "text-[#bdddb7]",
    backOpacityClass: "opacity-[0.12]",
  },
} as const;

const INVENTORY_CARD_BACK_ASSET: Record<BetrayalInventoryCard["kind"], string> =
  {
    item: ASSETS.deck.item,
    omen: ASSETS.deck.omen,
  };

function isTraitMap(value: unknown): value is Record<BetrayalTraitKey, number> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["might", "speed", "knowledge", "sanity"].every(
    (key) => typeof candidate[key] === "number",
  );
}
function isInventoryCard(value: unknown): value is BetrayalInventoryCard {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BetrayalInventoryCard>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    (candidate.kind === "item" || candidate.kind === "omen")
  );
}

function isExplorerSummary(value: unknown): value is BetrayalExplorerSummary {
  if (!value || typeof value !== "object") return false;
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
  if (!value || typeof value !== "object") return false;
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

function isBetrayalCore(value: unknown): value is BetrayalCore {
  if (!value || typeof value !== "object") return false;
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

function createInitialPreviewState(_core: BetrayalCore): PreviewState {
  return {
    selectedInventoryCardId: null,
    lastUsedInventoryCardId: null,
    selectedTradeTargetPlayerId: null,
    selectedCorpseLootCardId: null,
    selectedTradeGiveCardIds: [],
    selectedDogTradeCardIds: [],
    selectedTradeReturnCardIds: [],
    selectedAttackWeaponCardId: null,
    selectedInventoryTargetPlayerId: null,
    selectedInventoryTargetRoomId: null,
    selectedInventoryReplacementRollTotal: null,
    selectedRollModifierDieIndex: null,
    selectedMaskTargetRoomIdsByTokenId: {},
    activeMaskTargetTokenId: null,
    selectedEventTrait: null,
    selectedEventCardId: null,
    selectedDustSearchTrait: null,
    selectedDustCureTrait: null,
    selectedEventTargetRoomId: null,
    selectedEventDamageTraits: [],
    selectedDamageAllocationTraits: [],
    useBroochForDamageAllocation: false,
    useHolySymbolForExplore: false,
    useIdolForExplore: false,
    ignoreEventSymbolWithTraitorPower: false,
    pendingRoomPlacementSlotId: null,
    pendingRoomPlacementFailure: null,
    pendingRoomOrientationTurns: 0,
    pendingRoomTileAdjustment: null,
    tradeSelectionTouched: false,
    dismissedLatestDiscoveryKey: null,
    dismissedRecentRollId: null,
    interactionMode: "default",
    hauntTargetingActionKind: null,
    selectedHelpingHandsTrollHandMoveMonsterId: null,
    selectedMonsterMoveMonsterId: null,
    selectedMonsterAttackMonsterId: null,
    selectedPeekabooSameRoomMonsterId: null,
    selectedPeekabooLineOfSightMonsterId: null,
    selectedBloodFromStoneStoneCherubRoomIds: [],
  };
}

function buildLatestDiscoveryKey(core: BetrayalCore): string | null {
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

function isHauntScenarioOpeningDiscoverySummary(
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

function isHauntScenarioBookRevealDiscoverySummary(
  discovery: BetrayalDiscoverySummary | null,
): boolean {
  if (!discovery) {
    return false;
  }
  return [discovery.title, discovery.summary, discovery.detail]
    .join(" ")
    .includes("剧本");
}

function isHauntScenarioOpeningDiscovery(core: BetrayalCore): boolean {
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
        consumedRabbitFootCardIds: [
          ...recentRoll.consumedRabbitFootCardIds,
        ],
        branchThresholds: recentRoll.branchThresholds?.map((branch) => ({
          ...branch,
          effect: { ...branch.effect },
        })),
      }
    : null;
}

function buildRecentRollDisplayKey(
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
    recentRoll.rollLabel ?? "",
    recentRoll.latestLabel,
    recentRoll.dice.join(","),
    recentRoll.passiveBonus,
  ].join("::");
}

function isAcknowledgeableRecentRollDisplay(
  recentRoll: BetrayalRecentRollState | null | undefined,
): boolean {
  if (!recentRoll) {
    return false;
  }
  if (recentRoll.roomEndTurn?.nextPlayerId || recentRoll.deathPrevention?.nextPlayerId) {
    return false;
  }
  return (
    recentRoll.kind === "mysticElevator" ||
    recentRoll.kind === "attackRoll" ||
    recentRoll.kind === "hauntActionTraitCheck" ||
    recentRoll.kind === "monsterMoveRoll"
  );
}

function buildLatestDiscoveryDisplayEntry(
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
  const sourceKey = [
    core.latestDiscoveryOwnerPlayerId ?? "",
    core.latestDiscovery.kind,
    core.latestDiscovery.title,
  ].join("::");
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

function isSpiderAdjacentRoomResolutionDiscovery(
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

function resolvePlayerName(
  playerId: string,
  explorerName: string,
  matchData?: MatchPlayerInfo[],
) {
  const matched = matchData?.find(
    (item) => String(item.id) === String(playerId),
  );
  return matched?.name?.trim() || explorerName;
}

function resolveEndgameExplorerName(
  explorer: Pick<BetrayalExplorerSummary, "playerId" | "displayName">,
  matchData?: MatchPlayerInfo[],
) {
  const displayName = explorer.displayName.trim();
  return resolvePlayerName(explorer.playerId, displayName || "玩家", matchData);
}

function buildDeckItems(
  core: BetrayalCore,
  t: ReturnType<typeof useTranslation>["t"],
): DeckTrayItem[] {
  return (["omen", "item", "event"] as BetrayalDeckKind[]).map((kind) => ({
    id: `deck-${kind}`,
    label: t(`board.decks.${kind}`),
    count: core.deckCounts[kind],
    asset: ASSETS.deck[kind],
  }));
}

function buildDiscardItems(
  core: BetrayalCore,
  t: ReturnType<typeof useTranslation>["t"],
): DeckTrayItem[] {
  return (["omen", "item", "event"] as BetrayalDeckKind[]).map((kind) => ({
    id: `discard-${kind}`,
    label: `${t(`board.decks.${kind}`)} · ${t("board.sections.discard")}`,
    count: core.discardCounts[kind],
    asset: ASSETS.deck[kind],
  }));
}

type RoomTileSpriteProps = {
  visual: BetrayalRoomTileVisual;
  locale: string;
  alt: string;
  className?: string;
};

function RoomTileSprite({
  visual,
  locale,
  alt,
  className,
}: RoomTileSpriteProps) {
  const imgStyle = React.useMemo(
    () => buildRoomAtlasImageStyle(visual),
    [visual],
  );

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`.trim()}
      style={{ aspectRatio: imgStyle.aspectRatio }}
    >
      <OptimizedImage
        src={visual.image}
        locale={locale}
        alt={alt}
        draggable={false}
        className="absolute left-0 top-0 max-w-none select-none"
        style={imgStyle}
      />
    </div>
  );
}

type PossessionAtlasFrameProps = {
  visual: BetrayalPossessionAtlasVisual;
  locale: string;
  alt: string;
  testId?: string;
};

function PossessionAtlasFrame({
  visual,
  locale,
  alt,
  testId,
}: PossessionAtlasFrameProps) {
  const imgStyle = React.useMemo(
    () => buildPossessionAtlasImageStyle(visual),
    [visual],
  );

  return (
    <OptimizedImage
      src={visual.image}
      locale={locale}
      alt={alt}
      data-testid={testId}
      data-asset-src={visual.image}
      draggable={false}
      className="absolute left-0 top-0 max-w-none select-none"
      style={imgStyle}
    />
  );
}

function ExplorerFigureToken({
  explorer,
  locale,
  label,
  tone,
  size = "board",
  missingTokenLabel,
  testIdPrefix = "betrayal-explorer-figure-token",
}: {
  explorer: BetrayalExplorerSummary;
  locale: string;
  label: string;
  tone: "self" | "ally";
  size?: "board" | "panel";
  missingTokenLabel: string;
  testIdPrefix?: string;
}) {
  const tokenAsset = explorer.tokenAsset;
  const hasOfficialToken = Boolean(explorer.tokenAsset);
  const outlineColor =
    tone === "self" ? "rgba(138,240,95,0.98)" : "rgba(245,204,72,0.98)";
  const tokenShape = "polygon(50% 0%, 96% 30%, 82% 100%, 18% 100%, 4% 30%)";
  const sizeClass =
    size === "panel"
      ? {
          root: "h-[38px] w-[36px]",
          outline: "h-[34px] w-[32px]",
          frame: "h-[31px] w-[30px]",
          officialImage: "h-full w-full scale-[1.16] object-cover",
          fallbackImage: "h-full w-full scale-[1.08] object-cover",
        }
      : {
          root: "h-[54px] w-[50px]",
          outline: "h-[48px] w-[46px]",
          frame: "h-[44px] w-[42px]",
          officialImage: "h-full w-full scale-[1.16] object-cover",
          fallbackImage: "h-full w-full scale-[1.08] object-cover",
        };

  return (
    <span
      className={`relative inline-flex ${sizeClass.root} items-center justify-center`}
      data-testid={`${testIdPrefix}-${explorer.playerId}`}
      data-player-id={explorer.playerId}
      data-explorer-id={explorer.explorerId}
      data-explorer-name={explorer.displayName}
      data-token-asset={tokenAsset ?? undefined}
      data-token-state={hasOfficialToken ? "official" : "missing-official-token"}
      data-token-tone={tone}
      aria-label={
        hasOfficialToken ? label : `${label}：${missingTokenLabel}`
      }
      title={hasOfficialToken ? label : `${label}：${missingTokenLabel}`}
    >
      <span
        className={`pointer-events-none absolute left-1/2 top-1/2 ${sizeClass.outline} -translate-x-1/2 -translate-y-1/2`}
        data-testid={`${testIdPrefix}-outline-${explorer.playerId}`}
        style={{
          clipPath: tokenShape,
          backgroundColor: outlineColor,
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.32))",
        }}
      />
      <span
        className={`relative flex ${sizeClass.frame} items-center justify-center overflow-hidden bg-transparent`}
        style={{
          clipPath: tokenShape,
        }}
      >
        {hasOfficialToken && tokenAsset ? (
          <OptimizedImage
            src={tokenAsset}
            locale={locale}
            alt={label}
            className={sizeClass.officialImage}
            draggable={false}
          />
        ) : (
          <span
            data-testid={`${testIdPrefix}-missing-${explorer.playerId}`}
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[rgba(28,21,17,0.96)] px-0.5 text-center text-[7px] font-black leading-[8px] text-[#f0c97b]"
          >
            <ImageOff size={size === "panel" ? 12 : 15} aria-hidden="true" />
            <span>{missingTokenLabel}</span>
          </span>
        )}
      </span>
    </span>
  );
}
function MonsterBoardToken({
  monster,
  locale,
  t,
  quietFrame = false,
  status = "active",
  testIdPrefix = "betrayal-monster-board-token",
}: {
  monster: BetrayalMonsterSummary;
  locale: string;
  t: ReturnType<typeof useTranslation>["t"];
  quietFrame?: boolean;
  status?: BetrayalMonsterStatusKind;
  testIdPrefix?: string;
}) {
  const tokenAsset = monster.tokenAsset ?? monster.portraitAsset;
  const hasOfficialToken = Boolean(monster.tokenAsset);
  const isStunned = status === "stunned";
  const outlineColor = quietFrame
    ? "rgba(217,255,151,0.16)"
    : isStunned
      ? "rgba(148,158,160,0.78)"
      : "rgba(218,74,57,0.98)";
  const outlineShadow = quietFrame
    ? "drop-shadow(0 0 8px rgba(217,255,151,0.22))"
    : isStunned
      ? "drop-shadow(0 3px 8px rgba(0,0,0,0.32))"
      : "drop-shadow(0 5px 10px rgba(0,0,0,0.36))";

  return (
    <span
      className={`relative inline-flex h-[52px] w-[52px] items-center justify-center transition ${
        isStunned ? "-rotate-12 opacity-80 grayscale" : ""
      }`}
      data-testid={`${testIdPrefix}-${monster.id}`}
      data-monster-status={status}
    >
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 rounded-[7px]"
        data-testid={`${testIdPrefix}-outline-${monster.id}`}
        style={{
          backgroundColor: outlineColor,
          filter: outlineShadow,
        }}
      />
      <span className="relative flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-[6px] bg-transparent">
        <OptimizedImage
          src={tokenAsset}
          locale={locale}
          alt={monster.name}
          className={
            hasOfficialToken
              ? "h-full w-full scale-[1.18] object-cover brightness-110 saturate-110"
              : "h-full w-full scale-[1.08] object-cover brightness-125 saturate-125"
          }
          draggable={false}
        />
      </span>
      {isStunned ? (
        <span
          className="pointer-events-none absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-[4px] border border-[rgba(212,224,221,0.62)] bg-[rgba(9,14,14,0.94)] px-1.5 py-0.5 text-[8px] font-black leading-none tracking-[0.08em] text-[#dce7e2] shadow-[0_3px_8px_rgba(0,0,0,0.38)]"
          data-testid={`betrayal-monster-board-token-status-${monster.id}`}
        >
          {t("board.monster.status.stunned")}
        </span>
      ) : null}
    </span>
  );
}
function GirlBoardToken({
  token,
  t,
  attachedTo,
  interactive = false,
  onClick,
  testIdPrefix = "betrayal-room-haunt-token",
}: {
  token: BetrayalHauntTokenInstanceSummary;
  t: ReturnType<typeof useTranslation>["t"];
  attachedTo: "room" | "explorer" | "mummy";
  interactive?: boolean;
  onClick?: () => void;
  testIdPrefix?: string;
}) {
  const status = token.status ?? "placed";
  const ownerLabel =
    status === "held-by-mummy"
      ? t("board.hauntTokens.girlHeldByMummy")
      : status === "held-by-player" && token.ownerName
        ? t("board.hauntTokens.girlHeldByPlayer", {
            player: token.ownerName,
          })
        : t("board.hauntTokens.girlPlaced");
  const label = `${t("board.hauntTokens.girl")}，${ownerLabel}`;
  const unit = (
    <svg
      viewBox="0 0 48 48"
      className={`block drop-shadow-[0_0_8px_rgba(255,139,209,0.56)] ${
        attachedTo === "room" ? "h-12 w-12" : "h-9 w-9"
      }`}
      data-testid={
        testIdPrefix === "betrayal-room-haunt-token"
          ? `betrayal-girl-svg-token-${token.roomId ?? "unknown"}`
          : `${testIdPrefix}-girl-svg-${token.roomId ?? "unknown"}`
      }
      data-token-attachment={attachedTo}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
          <path
            d="M14 18.5c0-6.2 4.3-10.5 10-10.5s10 4.3 10 10.5c0 2.4-.7 4.7-2.1 6.5H16.1A11.5 11.5 0 0 1 14 18.5Z"
            fill="#4a122f"
            stroke="#ffd8ef"
            strokeWidth="1.5"
          />
          <circle cx="24" cy="20" r="6.7" fill="#ffe1ef" stroke="#4a122f" strokeWidth="1.4" />
          <path
            d="M18.5 29.2c1.6-2.2 3.4-3.1 5.5-3.1s3.9.9 5.5 3.1l4.2 10.3H14.3l4.2-10.3Z"
            fill="#f5a6d4"
            stroke="#4a122f"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M17.8 30.2 13.5 35M30.2 30.2l4.3 4.8" stroke="#ffe1ef" strokeWidth="2" strokeLinecap="round" />
          <circle cx="21.8" cy="19.7" r="0.8" fill="#4a122f" />
          <circle cx="26.2" cy="19.7" r="0.8" fill="#4a122f" />
          <path d="M22 23.2c1.2.8 2.8.8 4 0" stroke="#a73570" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );

  if (interactive) {
    return (
      <button
        type="button"
        data-testid={`${testIdPrefix}-${token.roomId ?? "unknown"}-${token.id}`}
        data-token-kind={token.kind}
        data-token-status={status}
        data-token-placement={attachedTo}
        data-token-owner-player-id={token.ownerPlayerId ?? undefined}
        data-token-owner-monster-id={
          attachedTo === "mummy" ? "mummy" : undefined
        }
        data-direct-target="true"
        aria-label={label}
        title={label}
        className="pointer-events-auto relative inline-flex min-h-[64px] min-w-[64px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 outline-none transition hover:drop-shadow-[0_0_18px_rgba(255,139,209,0.68)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe8f5]"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
      >
        {unit}
      </button>
    );
  }

  return (
    <span
      data-testid={`${testIdPrefix}-${token.roomId ?? "unknown"}-${token.id}`}
      data-token-kind={token.kind}
      data-token-status={status}
      data-token-placement={attachedTo}
      data-token-owner-player-id={token.ownerPlayerId ?? undefined}
      data-token-owner-monster-id={
        attachedTo === "mummy" ? "mummy" : undefined
      }
      aria-label={label}
      title={label}
      className="relative inline-flex items-center justify-center"
    >
      {unit}
    </span>
  );
}

type BetrayalViewportRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type BetrayalVisualTransition = {
  id: string;
  kind: "explorer-move" | "monster-move" | "girl-transfer" | "possession-gain";
  sourceRect: BetrayalViewportRect;
  targetRect: BetrayalViewportRect | null;
  targetTestId: string;
  fallbackRoomTestId?: string;
  explorer?: BetrayalExplorerSummary;
  monster?: BetrayalMonsterSummary;
  monsterStatus?: BetrayalMonsterStatusKind;
  girlToken?: BetrayalHauntTokenInstanceSummary;
  possessionCard?: BetrayalInventoryCard;
  possessionVisual?: BetrayalPossessionAtlasVisual;
  locale: string;
  tokenLabel?: string;
  tone?: "self" | "ally";
  missingTokenLabel: string;
  attachedTo?: "room" | "explorer" | "mummy";
  onComplete?: () => void;
};

function findBetrayalTestElement(testId: string): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  return Array.from(document.querySelectorAll<HTMLElement>("[data-testid]"))
    .find((element) => element.dataset.testid === testId) ?? null;
}

function readBetrayalViewportRect(
  element: Element | null,
): BetrayalViewportRect | null {
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function centerBetrayalRect(
  roomRect: BetrayalViewportRect,
  width: number,
  height: number,
): BetrayalViewportRect {
  return {
    left: roomRect.left + (roomRect.width - width) / 2,
    top: roomRect.top + (roomRect.height - height) / 2,
    width,
    height,
  };
}

function BetrayalVisualTransitionLayer({
  transition,
  onComplete,
}: {
  transition: BetrayalVisualTransition;
  onComplete: (transitionId: string) => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const targetRect = transition.targetRect;
  const sourceCenter = {
    x: transition.sourceRect.left + transition.sourceRect.width / 2,
    y: transition.sourceRect.top + transition.sourceRect.height / 2,
  };
  const targetCenter = targetRect
    ? {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      }
    : sourceCenter;
  const finalScale =
    transition.kind === "possession-gain" ? 0.36 : 0.9;
  const transitionWidth =
    transition.kind === "possession-gain"
      ? Math.min(transition.sourceRect.width, 220)
      : transition.sourceRect.width;
  const transitionHeight =
    transition.kind === "possession-gain"
      ? Math.min(transition.sourceRect.height, 320)
      : transition.sourceRect.height;
  const content = transition.explorer ? (
    <ExplorerFigureToken
      explorer={transition.explorer}
      locale={transition.locale}
      label={transition.tokenLabel ?? transition.explorer.displayName}
      tone={transition.tone ?? "self"}
      missingTokenLabel={transition.missingTokenLabel}
      testIdPrefix="betrayal-visual-transition-explorer-token"
    />
  ) : transition.monster ? (
    <MonsterBoardToken
      monster={transition.monster}
      locale={transition.locale}
      t={t}
      status={transition.monsterStatus ?? "active"}
      testIdPrefix="betrayal-visual-transition-monster-token"
    />
  ) : transition.girlToken ? (
    <GirlBoardToken
      token={transition.girlToken}
      t={t}
      attachedTo={transition.attachedTo ?? "room"}
      testIdPrefix="betrayal-visual-transition-girl-token"
    />
  ) : transition.possessionCard && transition.possessionVisual ? (
    <div className="relative h-full w-full overflow-hidden rounded-[8px] border border-[rgba(255,236,175,0.64)] bg-[rgba(10,8,6,0.96)] shadow-[0_18px_36px_rgba(0,0,0,0.52)]">
      <PossessionAtlasFrame
        visual={transition.possessionVisual}
        locale={transition.locale}
        alt={transition.possessionCard.name}
      />
    </div>
  ) : null;

  return (
    <HudPortal>
      <div
        data-testid="betrayal-visual-transition-blocker"
        data-transition-kind={transition.kind}
        data-transition-target-testid={transition.targetTestId}
        data-transition-ready={targetRect ? "true" : "false"}
        aria-busy="true"
        className="pointer-events-auto fixed inset-0 cursor-wait"
        style={{ zIndex: UI_Z_INDEX.modalOverlay + 40 }}
      >
        {targetRect ? (
          <motion.div
            data-testid={`betrayal-visual-transition-${transition.id}`}
            data-transition-kind={transition.kind}
            data-transition-phase="moving"
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center"
            style={{
              left: sourceCenter.x - transitionWidth / 2,
              top: sourceCenter.y - transitionHeight / 2,
              width: transitionWidth,
              height: transitionHeight,
              transformOrigin: "center center",
            }}
            initial={{ scale: 1.06, opacity: 1, x: 0, y: 0 }}
            animate={{
              scale: finalScale,
              opacity: [1, 1, 0],
              x: targetCenter.x - sourceCenter.x,
              y: targetCenter.y - sourceCenter.y,
            }}
            transition={{
              duration: BETRAYAL_VISUAL_TRANSITION_DURATION_MS / 1000,
              ease: [0.22, 0.8, 0.24, 1],
              opacity: {
                duration: BETRAYAL_VISUAL_TRANSITION_DURATION_MS / 1000,
                times: [0, 0.78, 1],
              },
            }}
            onAnimationComplete={() => onComplete(transition.id)}
          >
            {content}
          </motion.div>
        ) : null}
      </div>
    </HudPortal>
  );
}

function ExplorerDetailsDialog({
  explorer,
  locale,
  playerName,
  roomName,
  abilityName,
  abilityText,
  onClose,
}: {
  explorer: BetrayalExplorerSummary;
  locale: string;
  playerName: string;
  roomName: string;
  abilityName: string;
  abilityText: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const tokenAsset = explorer.tokenAsset;
  const detailsLabel = t("board.players.detailsAria", { player: playerName });

  return (
    <HudPortal>
      <div
        data-testid="betrayal-explorer-detail-overlay"
        className="fixed inset-0 flex items-center justify-center bg-[rgba(2,6,5,0.62)] px-4 py-6 text-[#f1e8d4] backdrop-blur-[2px]"
        style={{ zIndex: UI_Z_INDEX.modalOverlay }}
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={detailsLabel}
          data-testid={`betrayal-explorer-detail-dialog-${explorer.playerId}`}
          data-player-id={explorer.playerId}
          data-explorer-id={explorer.explorerId}
          data-token-asset={tokenAsset}
          className="relative grid w-[min(92vw,720px)] max-h-[min(86vh,680px)] grid-cols-[minmax(170px,230px)_minmax(0,1fr)] gap-4 overflow-hidden rounded-[14px] border border-[rgba(214,191,129,0.42)] bg-[linear-gradient(180deg,rgba(18,22,18,0.98),rgba(7,11,10,0.98))] p-4 shadow-[0_26px_70px_rgba(0,0,0,0.58)]"
          style={{ zIndex: UI_Z_INDEX.modalContent }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            data-testid="betrayal-explorer-detail-close"
            aria-label={t("board.players.closeDetails")}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-[8px] border border-[rgba(214,191,129,0.30)] bg-[rgba(18,15,12,0.86)] text-[#e8d6a5] transition hover:border-[rgba(245,218,150,0.62)] hover:text-[#fff1bd]"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
          <div className="relative overflow-hidden rounded-[10px] border border-[rgba(110,91,57,0.48)] bg-[rgba(8,12,10,0.74)] px-3 pb-4 pt-5">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.30),transparent)]" />
            <OptimizedImage
              src={explorer.portraitAsset}
              locale={locale}
              alt={explorer.displayName}
              className="mx-auto h-[220px] w-full object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.42)]"
              draggable={false}
            />
            <div className="-mt-2 flex justify-center">
              <ExplorerFigureToken
                explorer={explorer}
                locale={locale}
                label={playerName}
                tone="ally"
                size="panel"
                missingTokenLabel={t("board.hauntTokens.officialTokenMissing")}
                testIdPrefix="betrayal-explorer-detail-token"
              />
            </div>
          </div>
          <div className="min-w-0 overflow-y-auto pr-1">
            <div className="pr-10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4a265]">
                {t("board.players.detailsTitle")}
              </div>
              <h2 className="mt-1 truncate text-[24px] font-semibold tracking-[0.04em] text-[#fff1bf]">
                {playerName}
              </h2>
              <div className="mt-1 truncate text-[13px] text-[#c9b58b]">
                {explorer.displayName} · {roomName}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {(
                ["might", "speed", "knowledge", "sanity"] as BetrayalTraitKey[]
              ).map((trait) => (
                <div
                  key={`${explorer.playerId}-detail-${trait}`}
                  className="rounded-[8px] border border-[rgba(111,89,51,0.46)] bg-[rgba(19,17,13,0.74)] px-2.5 py-2"
                >
                  <ExplorerTraitTrackRail
                    explorer={explorer}
                    trait={trait}
                    locale={locale}
                    density="detail"
                    testIdPrefix={`betrayal-explorer-detail-trait-track-${explorer.playerId}`}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[10px] border border-[rgba(111,89,51,0.42)] bg-[rgba(11,15,13,0.72)] px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8bf81]">
                {t("board.players.ability")}
              </div>
              <div className="mt-1 text-[14px] leading-6 text-[#dbe6b7]">
                <span className="font-semibold text-[#fff1bf]">
                  {abilityName}
                </span>
                <span className="text-[#b7c99e]">
                  {t("board.players.detailSeparator")}
                  {abilityText}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-[10px] border border-[rgba(111,89,51,0.42)] bg-[rgba(11,15,13,0.72)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8bf81]">
                  {t("board.players.inventory")}
                </div>
                <div className="rounded-[5px] border border-[rgba(214,191,129,0.22)] bg-[rgba(214,191,129,0.08)] px-2 py-0.5 text-[12px] font-semibold text-[#ead8a8]">
                  {explorer.inventory.length}
                </div>
              </div>
              {explorer.inventory.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {explorer.inventory.map((card) => (
                    <span
                      key={card.id}
                      className="rounded-[5px] border border-[rgba(214,191,129,0.18)] bg-[rgba(22,18,13,0.78)] px-2 py-1 text-[12px] text-[#efe2c4]"
                    >
                      {card.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-[#9e9174]">
                  {t("board.players.emptyInventory")}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </HudPortal>
  );
}

function resolveFloorLabel(floor: BetrayalRoomNode["floor"]): string {
  return FLOOR_TONE[floor].label;
}

function resolveOppositeRoomEdge(edge: BetrayalRoomEdge): BetrayalRoomEdge {
  switch (edge) {
    case "north":
      return "south";
    case "east":
      return "west";
    case "south":
      return "north";
    case "west":
    default:
      return "east";
  }
}

function resolveRoomEdgeLabel(
  edge: BetrayalRoomEdge,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return t(`board.rooms.edges.${edge}`);
}

function resolveExplorerBoardMarkerPosition(
  trait: BetrayalTraitKey,
  position: number,
  maxPosition: number,
) {
  const range = EXPLORER_BOARD_MARKER_RANGE[trait];
  const clampedPosition = Math.max(0, Math.min(maxPosition, Math.round(position)));
  const progress = clampedPosition / Math.max(1, maxPosition);
  return {
    left: `${range.from.x + (range.to.x - range.from.x) * progress}%`,
    top: `${range.from.y + (range.to.y - range.from.y) * progress}%`,
  };
}

function buildRoomOccupants(
  core: BetrayalCore,
): Record<string, BetrayalExplorerSummary[]> {
  const occupants: Record<string, BetrayalExplorerSummary[]> = {};
  for (const explorer of [core.currentExplorer, ...core.otherExplorers]) {
    occupants[explorer.roomId] ??= [];
    occupants[explorer.roomId]!.push(explorer);
  }
  return occupants;
}

function buildRoomMonsters(
  core: BetrayalCore,
): Record<string, BetrayalMonsterSummary[]> {
  const monsters: Record<string, BetrayalMonsterSummary[]> = {};
  for (const monster of core.monsters) {
    monsters[monster.roomId] ??= [];
    monsters[monster.roomId]!.push(monster);
  }
  return monsters;
}

function resolveOccupiedRoomMapFloors(
  core: BetrayalCore,
): BetrayalRoomNode["floor"][] {
  const roomFloorById = new Map(
    core.rooms.map((room) => [room.id, room.floor]),
  );
  const occupiedFloors = new Set<BetrayalRoomNode["floor"]>();
  for (const explorer of [core.currentExplorer, ...core.otherExplorers]) {
    const floor = roomFloorById.get(explorer.roomId);
    if (floor) {
      occupiedFloors.add(floor);
    }
  }
  for (const monster of core.monsters) {
    const floor = roomFloorById.get(monster.roomId);
    if (floor) {
      occupiedFloors.add(floor);
    }
  }
  return ROOM_MAP_FLOOR_ORDER.filter((floor) => occupiedFloors.has(floor));
}

const FIXED_LINK_ROOM_IDS_BY_VISUAL_ID: Partial<
  Record<BetrayalRoomVisualId, string>
> = {
  secretStaircase: "hallway",
};

const FIXED_LINK_TARGET_VISUAL_IDS_BY_VISUAL_ID: Partial<
  Record<BetrayalRoomVisualId, BetrayalRoomVisualId>
> = {
  graveyard: "undergroundCavern",
  undergroundCavern: "graveyard",
  gallery: "ballroom",
};

function resolveFixedLinkTargetRoomId(
  rooms: BetrayalRoomNode[],
  room: BetrayalRoomNode,
): string | null {
  const fixedTargetRoomId = FIXED_LINK_ROOM_IDS_BY_VISUAL_ID[room.visualId];
  if (fixedTargetRoomId) {
    return fixedTargetRoomId;
  }
  const fixedTargetVisualId =
    FIXED_LINK_TARGET_VISUAL_IDS_BY_VISUAL_ID[room.visualId];
  if (!fixedTargetVisualId) {
    return null;
  }
  return (
    rooms.find(
      (item) =>
        item.state === "discovered" && item.visualId === fixedTargetVisualId,
    )?.id ?? null
  );
}

function resolveConnectedRoomIds(
  rooms: BetrayalRoomNode[],
  roomId: string,
): Set<string> {
  const room = rooms.find((item) => item.id === roomId);
  if (!room) {
    return new Set();
  }
  const connectedIds = new Set(
    room.doorways
      .map((doorway) => doorway.connectsToRoomId)
      .filter((targetRoomId): targetRoomId is string => Boolean(targetRoomId)),
  );
  if (
    room.state === "discovered" &&
    room.markerTokens?.includes("secretPassage")
  ) {
    for (const secretPassageRoom of rooms) {
      if (
        secretPassageRoom.id !== room.id &&
        secretPassageRoom.state === "discovered" &&
        secretPassageRoom.markerTokens?.includes("secretPassage")
      ) {
        connectedIds.add(secretPassageRoom.id);
      }
    }
  }
  if (room.state === "discovered") {
    const fixedTargetRoomId = resolveFixedLinkTargetRoomId(rooms, room);
    if (fixedTargetRoomId) {
      connectedIds.add(fixedTargetRoomId);
    }
  }
  for (const sourceRoom of rooms) {
    if (sourceRoom.state !== "discovered") {
      continue;
    }
    const fixedTargetRoomId = resolveFixedLinkTargetRoomId(rooms, sourceRoom);
    if (fixedTargetRoomId === room.id) {
      connectedIds.add(sourceRoom.id);
    }
  }
  return connectedIds;
}

function resolveMoveTargetRooms(core: BetrayalCore): BetrayalRoomNode[] {
  const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
  if (!activeRoom) {
    return [];
  }
  const connectedIds = resolveConnectedRoomIds(core.rooms, activeRoom.id);
  return core.rooms.filter(
    (room) => room.state === "discovered" && connectedIds.has(room.id),
  );
}

function resolveDynamiteTargetRooms(core: BetrayalCore): BetrayalRoomNode[] {
  const currentRoom = core.rooms.find(
    (room) => room.id === core.currentExplorer.roomId,
  );
  if (!currentRoom || currentRoom.state !== "discovered") {
    return [];
  }
  const connectedIds = resolveConnectedRoomIds(core.rooms, currentRoom.id);
  return core.rooms.filter(
    (room) =>
      room.state === "discovered" &&
      (room.id === currentRoom.id || connectedIds.has(room.id)),
  );
}

function formatRoomTargetList(rooms: BetrayalRoomNode[]): string {
  return Array.from(new Set(rooms.map((room) => room.name))).join(" / ");
}

function resolveRoomVisualPosition(room: BetrayalRoomNode): {
  x: number;
  y: number;
} {
  return { x: room.x, y: room.y };
}

const ROOM_VISUAL_BY_ID: Partial<
  Record<BetrayalRoomVisualId, BetrayalRoomTileVisual>
> = {
  startTriple: BETRAYAL_ROOM_TILE_VISUALS.startTripleRoom,
  startHallway: BETRAYAL_ROOM_TILE_VISUALS.startHallway,
  upperLanding: BETRAYAL_ROOM_TILE_VISUALS.startUpperLanding,
  basementLanding: BETRAYAL_ROOM_TILE_VISUALS.startBasementLanding,
  conservatory: BETRAYAL_ROOM_TILE_VISUALS.conservatory,
  bedroom: BETRAYAL_ROOM_TILE_VISUALS.bedroom,
  study: BETRAYAL_ROOM_TILE_VISUALS.study,
  gallery: BETRAYAL_ROOM_TILE_VISUALS.gallery,
  entranceHall: BETRAYAL_ROOM_TILE_VISUALS.startEntranceHall,
  diningRoom: BETRAYAL_ROOM_TILE_VISUALS.diningRoom,
  foyer: BETRAYAL_ROOM_TILE_VISUALS.startGroundFloorStaircase,
  ballroom: BETRAYAL_ROOM_TILE_VISUALS.ballroom,
  kitchen: BETRAYAL_ROOM_TILE_VISUALS.kitchen,
  chapel: BETRAYAL_ROOM_TILE_VISUALS.chapel,
  larder: BETRAYAL_ROOM_TILE_VISUALS.larder,
  laboratory: BETRAYAL_ROOM_TILE_VISUALS.laboratory,
  graveyard: BETRAYAL_ROOM_TILE_VISUALS.graveyard,
  panicRoom: BETRAYAL_ROOM_TILE_VISUALS.panicRoom,
  undergroundCavern: BETRAYAL_ROOM_TILE_VISUALS.undergroundCavern,
  library: BETRAYAL_ROOM_TILE_VISUALS.library,
  ritualRoom: BETRAYAL_ROOM_TILE_VISUALS.ritualRoom,
  undergroundLake: BETRAYAL_ROOM_TILE_VISUALS.undergroundLake,
  catacombs: BETRAYAL_ROOM_TILE_VISUALS.catacombs,
  secretStaircase: BETRAYAL_ROOM_TILE_VISUALS.secretStaircase,
  furnaceRoom: BETRAYAL_ROOM_TILE_VISUALS.furnaceRoom,
  winterBedroom: BETRAYAL_ROOM_TILE_VISUALS.winterBedroom,
  guestQuarters: BETRAYAL_ROOM_TILE_VISUALS.guestQuarters,
  bloodyRoom: BETRAYAL_ROOM_TILE_VISUALS.bloodyRoom,
  collapsedRoom: BETRAYAL_ROOM_TILE_VISUALS.collapsedRoom,
  junkRoom: BETRAYAL_ROOM_TILE_VISUALS.junkRoom,
  specimenRoom: BETRAYAL_ROOM_TILE_VISUALS.specimenRoom,
  charredRoom: BETRAYAL_ROOM_TILE_VISUALS.charredRoom,
  salon: BETRAYAL_ROOM_TILE_VISUALS.salon,
  primaryBedroom: BETRAYAL_ROOM_TILE_VISUALS.primaryBedroom,
  organRoom: BETRAYAL_ROOM_TILE_VISUALS.organRoom,
  soundproofedRoom: BETRAYAL_ROOM_TILE_VISUALS.soundproofedRoom,
  nursery: BETRAYAL_ROOM_TILE_VISUALS.nursery,
  operatingTheatre: BETRAYAL_ROOM_TILE_VISUALS.operatingTheatre,
  crawlspace: BETRAYAL_ROOM_TILE_VISUALS.crawlspace,
  gameRoom: BETRAYAL_ROOM_TILE_VISUALS.gameRoom,
  gymnasium: BETRAYAL_ROOM_TILE_VISUALS.gymnasium,
  armory: BETRAYAL_ROOM_TILE_VISUALS.armory,
  crampedPassageway: BETRAYAL_ROOM_TILE_VISUALS.crampedPassageway,
  mysticElevator: BETRAYAL_ROOM_TILE_VISUALS.mysticElevator,
  backUpper: BETRAYAL_ROOM_TILE_VISUALS.backUpper,
  backGround: BETRAYAL_ROOM_TILE_VISUALS.backGround,
  backBasement: BETRAYAL_ROOM_TILE_VISUALS.backBasement,
};

function resolveRoomTileVisual(
  room: BetrayalRoomNode,
  isDiscovered: boolean,
): BetrayalRoomTileVisual {
  const visualId = isDiscovered ? room.visualId : room.backVisualId;
  return ROOM_VISUAL_BY_ID[visualId] ?? BETRAYAL_ROOM_TILE_VISUALS.conservatory;
}

type RoomCanvasLayout = {
  style: React.CSSProperties;
  offsetX: number;
  offsetY: number;
};

function resolveRoomCanvasLayout(
  rooms: BetrayalRoomNode[],
  focusRoomId: string | null = null,
): RoomCanvasLayout {
  const roomPositions = rooms.map(resolveRoomVisualPosition);
  const minX = Math.min(...roomPositions.map((position) => position.x), 1);
  const maxX = Math.max(...roomPositions.map((position) => position.x), 1);
  const minY = Math.min(...roomPositions.map((position) => position.y), 0);
  const maxY = Math.max(...roomPositions.map((position) => position.y), 1);
  const roomBoundsWidth = (maxX - minX) * ROOM_TILE_STEP_X + ROOM_TILE_SIZE;
  const roomBoundsHeight = (maxY - minY) * ROOM_TILE_STEP_Y + ROOM_TILE_SIZE;
  const width = Math.max(
    ROOM_CANVAS_MIN_WIDTH,
    ROOM_CANVAS_PADDING * 2 + roomBoundsWidth,
  );
  const height = Math.max(
    ROOM_CANVAS_MIN_HEIGHT,
    ROOM_CANVAS_PADDING * 2 + roomBoundsHeight,
  );
  const focusPosition = focusRoomId
    ? roomPositions[rooms.findIndex((room) => room.id === focusRoomId)]
    : null;

  return {
    style: {
      width,
      height,
      minWidth: width,
      minHeight: height,
    },
    offsetX: focusPosition
      ? width / 2 - focusPosition.x * ROOM_TILE_STEP_X - ROOM_TILE_SIZE / 2
      : (width - roomBoundsWidth) / 2 - minX * ROOM_TILE_STEP_X,
    offsetY: focusPosition
      ? height / 2 - focusPosition.y * ROOM_TILE_STEP_Y - ROOM_TILE_SIZE / 2
      : (height - roomBoundsHeight) / 2 - minY * ROOM_TILE_STEP_Y,
  };
}

function resolveRoomTileStyle(
  room: BetrayalRoomNode,
  layout: RoomCanvasLayout,
): React.CSSProperties {
  const roomPosition = resolveRoomVisualPosition(room);
  return {
    left: layout.offsetX + roomPosition.x * ROOM_TILE_STEP_X,
    top: layout.offsetY + roomPosition.y * ROOM_TILE_STEP_Y,
    width: ROOM_TILE_SIZE,
    height: ROOM_TILE_SIZE,
  };
}

function resolveRoomCenterPoint(
  room: BetrayalRoomNode,
  layout: RoomCanvasLayout,
): {
  x: number;
  y: number;
} {
  const roomPosition = resolveRoomVisualPosition(room);
  return {
    x: layout.offsetX + roomPosition.x * ROOM_TILE_STEP_X + ROOM_TILE_SIZE / 2,
    y: layout.offsetY + roomPosition.y * ROOM_TILE_STEP_Y + ROOM_TILE_SIZE / 2,
  };
}

function resolveExplorerFloor(core: BetrayalCore): BetrayalRoomNode["floor"] {
  return (
    core.rooms.find((room) => room.id === core.currentExplorer.roomId)?.floor ??
    "ground"
  );
}

function resolveExplorerFloorByPlayer(
  core: BetrayalCore,
  playerId: string,
): BetrayalRoomNode["floor"] {
  if (core.currentExplorer.playerId === playerId) {
    return resolveExplorerFloor(core);
  }
  const explorer = core.otherExplorers.find(
    (candidate) => candidate.playerId === playerId,
  );
  return (
    core.rooms.find((room) => room.id === explorer?.roomId)?.floor ??
    resolveExplorerFloor(core)
  );
}

function resolveTradeTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
  return core.otherExplorers.filter(
    (explorer) =>
      explorer.roomId === core.activeRoomId &&
      !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId),
  );
}

function resolveCorpseLootTargets(
  core: BetrayalCore,
): BetrayalExplorerSummary[] {
  return core.otherExplorers.filter(
    (explorer) =>
      explorer.roomId === core.activeRoomId &&
      core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId) &&
      explorer.inventory.length > 0 &&
      !core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn.includes(
        explorer.playerId,
      ),
  );
}

function resolveInventoryCardAccentAsset(card: BetrayalInventoryCard): string {
  const effect = resolveUseEffect(card);
  if (!effect) {
    return ASSETS.trait.knowledge;
  }
  if (effect.mode === "move") {
    return ASSETS.trait.speed;
  }
  if (effect.mode === "moveOthersInRoom") {
    return ASSETS.trait.speed;
  }
  if (effect.mode === "healTraits") {
    return ASSETS.trait.might;
  }
  if (effect.mode === "placeExplorer") {
    return ASSETS.trait.speed;
  }
  if (effect.mode === "nextNonCombatTraitReplacement") {
    return ASSETS.trait[effect.replacementTrait];
  }
  if (effect.mode === "nextNonCombatTraitRollTotalReplacement") {
    return ASSETS.trait.knowledge;
  }
  return ASSETS.trait[effect.trait ?? "knowledge"];
}

function formatSignedDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function resolvePreviewUseEffectLabel(
  cardOrEffect: BetrayalInventoryCard | PossessionUseEffectProfile | null,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (!cardOrEffect) {
    return t("board.status.noSelectedCard");
  }
  const profile =
    "mode" in cardOrEffect ? cardOrEffect : resolveUseEffect(cardOrEffect);
  if (!profile) {
    return "按卡面规则持有";
  }
  if (profile.mode === "move") {
    return t("board.useEffects.move", {
      value: formatSignedDelta(profile.amount),
    });
  }
  if (profile.mode === "moveOthersInRoom") {
    return "移动同板块其他角色到相邻板块";
  }
  if (profile.mode === "healTraits") {
    return `治疗${profile.traits.map((trait) => t(`board.traits.${trait}`)).join("和")}`;
  }
  if (profile.mode === "placeExplorer") {
    return "放置到已发现板块";
  }
  if (profile.mode === "nextNonCombatTraitReplacement") {
    return `下一次非战斗检定可用${t(`board.traits.${profile.replacementTrait}`)}替换`;
  }
  if (profile.mode === "nextNonCombatTraitRollTotalReplacement") {
    return `下一次属性检定可用 ${profile.minTotal}-${profile.maxTotal} 的结果替代投骰`;
  }
  return t("board.useEffects.trait", {
    trait: t(`board.traits.${profile.trait}`),
    value: formatSignedDelta(profile.amount),
  });
}

function resolveInventoryRulesSummary(
  card: BetrayalInventoryCard,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const activeLabel = resolvePreviewUseEffectLabel(card, t);
  const effectId = card.id
    .replace(/-preview-\d+$/, "")
    .replace(/-armory-\d+-\d+$/, "")
    .replace(/-\d+$/, "");
  const passiveLabels: string[] = [];

  if (effectId === "omen-book") passiveLabels.push("知识检定 +1");
  if (effectId === "skull")
    passiveLabels.push("知识检定 +1；濒死时投 3 骰，4+ 阻止死亡");
  if (effectId === "dog")
    passiveLabels.push("速度检定 +1；可与 4 格内队友交易");
  if (effectId === "mask") passiveLabels.push("速度检定 +1");
  if (effectId === "holy-symbol")
    passiveLabels.push("神志检定 +1；探索时可埋葬第一张板块");
  if (effectId === "ring")
    passiveLabels.push("神志检定 +1；攻击时可改用神志造成精神伤害");
  if (effectId === "idol")
    passiveLabels.push("力量检定 +1；发现事件符号板块时可跳过事件");
  if (effectId === "camera")
    passiveLabels.push(
      "知识检定可用神志替代；“说茄子！”作祟由相机持有者成为叛徒",
    );
  if (effectId === "flashlight" || effectId === "lantern")
    passiveLabels.push("事件属性检定额外投 2 骰");
  if (effectId === "strange-amulet") {
    passiveLabels.push("实际承受物理伤害后 +1 神志");
    passiveLabels.push("援手作祟中决定胜利并控制巨魔手");
  }
  if (effectId === "rope")
    passiveLabels.push("可重掷刚刚的投骰结果");
  if (effectId === "armor") passiveLabels.push("受到物理伤害 -1");
  if (effectId === "radio") passiveLabels.push("受到精神伤害 -1");
  if (effectId === "lockpick-tool")
    passiveLabels.push("移动时可穿过一格同层相邻墙体");
  if (effectId === "hunting-knife")
    passiveLabels.push("攻击时可选择砍刀，攻击结果 +1");
  if (effectId === "dagger")
    passiveLabels.push("攻击时可选择匕首，额外投 2 骰并失去 1 点速度");
  if (effectId === "leather-jacket")
    passiveLabels.push("防御攻击时额外投 1 骰");
  if (effectId === "chainsaw")
    passiveLabels.push("攻击时可选择电锯，额外投 1 骰");
  if (effectId === "gun")
    passiveLabels.push("攻击时可选择枪，攻击视线内目标，失败不反伤");
  if (effectId === "crossbow")
    passiveLabels.push("攻击时可选择十字弓，攻击同板块或相邻板块目标，失败不反伤");

  if (activeLabel !== "按卡面规则持有" && passiveLabels.length > 0) {
    return `${activeLabel}；${passiveLabels.join("；")}`;
  }
  if (activeLabel !== "按卡面规则持有") {
    return activeLabel;
  }
  return passiveLabels.length > 0 ? passiveLabels.join("；") : activeLabel;
}

function resolveDamageReductionCardNames(
  explorer: BetrayalExplorerSummary | null,
  damageKind: "physical" | "mental" | "general" | undefined,
): string[] {
  if (!explorer || damageKind === "general") {
    return [];
  }
  const reductionEffectId =
    damageKind === "physical" ? "armor" : damageKind === "mental" ? "radio" : null;
  if (!reductionEffectId) {
    return [];
  }
  return explorer.inventory
    .filter((card) => resolveInventoryEffectId(card.id) === reductionEffectId)
    .map((card) => card.name);
}

function resolveSelectedTradeTargetPlayerId(
  tradeTargets: BetrayalExplorerSummary[],
  selectedTradeTargetPlayerId: string | null,
): string | null {
  if (
    selectedTradeTargetPlayerId &&
    tradeTargets.some(
      (explorer) => explorer.playerId === selectedTradeTargetPlayerId,
    )
  ) {
    return selectedTradeTargetPlayerId;
  }
  return null;
}

function resolveSelectedDogTradeCardIds(
  inventory: BetrayalInventoryCard[],
  selectedCardIds: string[],
): string[] {
  const inventoryCardIds = new Set(inventory.map((card) => card.id));
  return selectedCardIds.filter(
    (cardId) => inventoryCardIds.has(cardId) && cardId !== "dog",
  );
}

function resolveSelectedTradeGiveCardIds(
  inventory: BetrayalInventoryCard[],
  selectedCardIds: string[],
  usedCardIdsThisTurn: string[],
): string[] {
  const inventoryCardIds = new Set(inventory.map((card) => card.id));
  const usedCardIds = new Set(usedCardIdsThisTurn);
  return selectedCardIds.filter(
    (cardId) => inventoryCardIds.has(cardId) && !usedCardIds.has(cardId),
  );
}

function resolveEventTraitChoices(
  effect: UseEffectProfile,
): BetrayalTraitKey[] {
  if (effect.mode === "chooseTraitRoll") {
    return effect.allowedTraits;
  }
  if (effect.mode === "chosenTrait" || effect.mode === "healChosenTrait") {
    return effect.chosenTrait ? [] : effect.allowedTraits;
  }
  if (effect.mode === "compound") {
    return effect.effects.flatMap(resolveEventTraitChoices);
  }
  return [];
}

function resolveEventPreviewEffect(
  core: BetrayalCore,
  effect: UseEffectProfile,
  selectedTrait: BetrayalTraitKey | null,
): UseEffectProfile | null {
  if (effect.mode !== "chooseTraitRoll") {
    return effect;
  }
  if (!selectedTrait || !effect.allowedTraits.includes(selectedTrait)) {
    return null;
  }
  const previewTotal = core.currentExplorer.traits[selectedTrait];
  return (
    [...effect.branches]
      .sort((left, right) => right.min - left.min)
      .find((branch) => previewTotal >= branch.min)?.effect ??
    effect.branches[effect.branches.length - 1]?.effect ??
    null
  );
}

function resolveEventTargetRooms(
  core: BetrayalCore,
  effect: UseEffectProfile | null,
): BetrayalRoomNode[] {
  if (!effect) {
    return [];
  }
  if (effect.mode === "compound") {
    return effect.effects.flatMap((childEffect) =>
      resolveEventTargetRooms(core, childEffect),
    );
  }
  if (effect.mode === "placeExplorerInDiscoveredRoomByFloor") {
    const currentRoom = core.rooms.find(
      (room) => room.id === core.currentExplorer.roomId,
    );
    const requiredRoom = effect.requiredIfDiscoveredVisualIds?.length
      ? core.rooms.find(
          (room) =>
            room.state === "discovered" &&
            effect.requiredIfDiscoveredVisualIds!.includes(room.visualId),
        )
      : null;
    return core.rooms.filter(
      (room) => {
        if (room.state !== "discovered") {
          return false;
        }
        if (requiredRoom) {
          return room.id === requiredRoom.id;
        }
        if (effect.targetRoomScope === "anyDiscovered") {
          return true;
        }
        if (effect.targetRoomScope === "groundDiscovered") {
          return room.floor === "ground";
        }
        if (effect.targetRoomScope === "basementDiscovered") {
          return room.floor === "basement";
        }
        if (effect.targetRoomScope === "groundOrBasementDiscovered") {
          return room.floor === "ground" || room.floor === "basement";
        }
        if (effect.targetRoomScope === "sameFloorDiscovered") {
          return Boolean(currentRoom && room.floor === currentRoom.floor);
        }
        if (effect.targetRoomScope === "differentFloorDiscovered") {
          return Boolean(currentRoom && room.floor !== currentRoom.floor);
        }
        return false;
      },
    );
  }
  if (effect.mode === "placeExplorerInAdjacentRoom") {
    const currentRoom = core.rooms.find(
      (room) => room.id === core.currentExplorer.roomId,
    );
    if (!currentRoom) {
      return [];
    }
    const connectedRoomIds = new Set(currentRoom.connectedRoomIds);
    for (const doorway of currentRoom.doorways) {
      if (doorway.connectsToRoomId) {
        connectedRoomIds.add(doorway.connectsToRoomId);
      }
    }
    return core.rooms.filter(
      (room) => room.state === "discovered" && connectedRoomIds.has(room.id),
    );
  }
  if (effect.mode === "placeSecretPassageToken") {
    if (!effect.targetRoomScope) {
      return [];
    }
    return core.rooms.filter(
      (room) =>
        room.state === "discovered" &&
        room.id !== core.currentExplorer.roomId &&
        !room.markerTokens?.includes("secretPassage") &&
        (!effect.targetRoomScope ||
          effect.targetRoomScope === "anyOtherDiscovered" ||
          (effect.targetRoomScope === "groundDiscovered" &&
            room.floor === "ground") ||
          (effect.targetRoomScope === "basementDiscovered" &&
            room.floor === "basement")),
    );
  }
  return [];
}

function resolveEventGeneralDamageChoice(
  effect: UseEffectProfile | null,
): Extract<UseEffectProfile, { mode: "generalDamageChoice" }> | null {
  if (!effect) {
    return null;
  }
  if (effect.mode === "generalDamageChoice") {
    return effect;
  }
  if (effect.mode === "compound") {
    for (const childEffect of effect.effects) {
      const damageChoice = resolveEventGeneralDamageChoice(childEffect);
      if (damageChoice) {
        return damageChoice;
      }
    }
  }
  return null;
}

function resolveEventActionEffect(
  effect: UseEffectProfile,
  accept: boolean,
): UseEffectProfile {
  if (effect.mode === "optionalItemEffect") {
    return accept ? effect.acceptEffect : effect.declineEffect;
  }
  if (!accept && effect.mode === "optionalHauntRoll") {
    return effect.skippedOrStartedEffect;
  }
  if (
    accept &&
    effect.mode === "allTraitChecks" &&
    effect.results?.every((result) => result.passed)
  ) {
    return effect.allPassEffect;
  }
  return effect;
}

function resolveEventItemChoiceCards(
  core: BetrayalCore,
  effect: UseEffectProfile | null,
): BetrayalInventoryCard[] {
  if (effect?.mode !== "optionalItemEffect") {
    return [];
  }
  const attackWeaponEffectIds = new Set(
    resolveAttackWeaponCardStatuses(core).map((status) =>
      resolveInventoryEffectId(status.card.id),
    ),
  );
  return core.currentExplorer.inventory.filter((card) => {
    if (card.kind !== "item") {
      return false;
    }
    if (effect.itemFilter === "nonWeaponItem") {
      return !attackWeaponEffectIds.has(resolveInventoryEffectId(card.id));
    }
    return true;
  });
}

function mergeEventTraitChoices(
  ...choices: BetrayalTraitKey[][]
): BetrayalTraitKey[] {
  return Array.from(new Set(choices.flat()));
}

function ExplorerPentagonCard({
  explorer,
  selected,
  ready,
  taken,
  playerLabel,
  compact = false,
  effectiveLocale,
  onClick,
}: {
  explorer: (typeof EXPLORER_CATALOG)[number];
  selected: boolean;
  ready: boolean;
  taken: boolean;
  playerLabel?: string | null;
  compact?: boolean;
  effectiveLocale: string;
  onClick?: () => void;
}) {
  const stateLabel =
    taken && !selected
      ? `${playerLabel ?? "其他玩家"}已占用`
      : ready
        ? `${playerLabel ?? "当前玩家"}已就绪`
        : selected
          ? `${playerLabel ?? "当前玩家"}已选择`
          : "选择";
  const assetHeightClass = compact
    ? "h-[118px] sm:h-[132px] lg:h-[232px]"
    : "h-[108px] sm:h-[148px] lg:h-[280px]";
  const widthClass = compact
    ? "w-[136px] sm:w-[152px] lg:w-[224px]"
    : "w-full max-w-[148px] sm:max-w-[216px] lg:max-w-[348px]";
  const statusBadgeClass =
    taken && !selected
      ? "border-[#5c5548] bg-[rgba(14,14,12,0.82)] text-[#9b917d]"
      : ready
        ? "border-[#77bb77] bg-[rgba(19,43,25,0.86)] text-[#b8f0a8]"
        : selected
          ? "border-[#b5ef42] bg-[rgba(34,55,18,0.88)] text-[#dfff8f]"
          : "border-[#8b744d] bg-[rgba(22,17,12,0.76)] text-[#e4c983]";
  const pentagonClipPath = "polygon(50% 1%, 96% 35%, 79% 99%, 21% 99%, 4% 35%)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={taken && !selected}
      data-testid={`betrayal-character-card-${explorer.explorerId}`}
      aria-label={`${explorer.displayName}，${stateLabel}`}
      title={stateLabel}
      className={`group relative ${widthClass} text-left transition duration-200 ${
        selected
          ? "drop-shadow-[0_0_28px_rgba(181,239,66,0.44)]"
          : taken
            ? "opacity-55 grayscale"
            : "hover:-translate-y-1 hover:drop-shadow-[0_0_18px_rgba(211,179,109,0.28)]"
      }`}
    >
      <div
        className={`relative flex w-full items-end justify-center ${assetHeightClass}`}
      >
        {selected ? (
          <div
            className="pointer-events-none absolute inset-x-[8%] bottom-[5%] top-[2%] bg-[rgba(181,239,66,0.18)] blur-2xl"
            style={{ clipPath: pentagonClipPath }}
          />
        ) : null}
        {selected || ready || taken ? (
          <div
            data-testid={`betrayal-character-card-${explorer.explorerId}-state-outline`}
            data-highlight-shape="pentagon"
            className={`pointer-events-none absolute inset-x-[8%] bottom-[5%] top-[2%] z-20 border-[3px] ${
              taken && !selected
                ? "border-[#5c5548]/80"
                : ready
                  ? "border-[#77bb77]/90 shadow-[0_0_18px_rgba(119,187,119,0.34)]"
                  : "border-[#b5ef42]/95 shadow-[0_0_22px_rgba(181,239,66,0.42)]"
            }`}
            style={{ clipPath: pentagonClipPath }}
          />
        ) : null}
        <OptimizedImage
          src={explorer.portraitAsset}
          locale={effectiveLocale}
          alt={explorer.displayName}
          className="relative z-10 h-full w-full object-contain"
          draggable={false}
        />
        {selected && playerLabel ? (
          <div
            className="pointer-events-none absolute left-1/2 top-[9%] z-30 -translate-x-1/2 border border-[#b5ef42] bg-[rgba(16,28,12,0.92)] px-2 py-1 text-[10px] font-black leading-none tracking-[0.12em] text-[#dfff8f] shadow-[0_8px_18px_rgba(0,0,0,0.34)]"
            aria-hidden="true"
          >
            {playerLabel}
          </div>
        ) : null}
      </div>
      {playerLabel && !selected ? (
        <div
          className={`pointer-events-none absolute right-2 top-2 z-30 min-w-8 border px-2 py-1 text-center text-[11px] font-black leading-none tracking-[0.08em] shadow-[0_8px_18px_rgba(0,0,0,0.32)] ${statusBadgeClass}`}
          aria-hidden="true"
        >
          {playerLabel}
        </div>
      ) : null}
    </button>
  );
}

function BetrayalSelectionChip({
  selected,
  children,
  className = "",
  selectedClassName = "",
  idleClassName = "",
  ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean;
  selectedClassName?: string;
  idleClassName?: string;
}) {
  return (
    <button
      {...buttonProps}
      className={`pointer-events-auto inline-flex min-h-[76px] min-w-[168px] cursor-pointer items-center justify-center rounded-[10px] border-2 px-7 py-4 text-[24px] font-black tracking-[0.08em] shadow-[0_12px_28px_rgba(0,0,0,0.32)] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4df9a] ${
        selected
          ? selectedClassName ||
            "border-[#d1b05f] bg-[rgba(209,176,95,0.22)] text-[#fff1b8] shadow-[0_0_16px_rgba(209,176,95,0.20)]"
          : idleClassName ||
            "border-[rgba(211,179,109,0.24)] bg-[rgba(18,15,10,0.34)] text-[#d6c498] hover:border-[rgba(211,179,109,0.44)] hover:bg-[rgba(209,176,95,0.10)] hover:text-[#f0dfad]"
      } disabled:cursor-not-allowed disabled:border-[rgba(123,106,74,0.24)] disabled:bg-[rgba(13,15,11,0.28)] disabled:text-[#7a6a4a] disabled:shadow-none ${className}`}
    >
      {children}
    </button>
  );
}

function ConditionalHudPortal({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return enabled ? <HudPortal>{children}</HudPortal> : <>{children}</>;
}

function ScenarioBookTurnSheet({
  direction,
  fromPages,
  toPages,
  title,
  isPhoneLandscapeLayout = false,
  onTurnComplete,
}: {
  direction: "back" | "forward" | null;
  fromPages: [ScenarioReaderPage | null, ScenarioReaderPage | null];
  toPages: [ScenarioReaderPage | null, ScenarioReaderPage | null];
  title: string;
  isPhoneLandscapeLayout?: boolean;
  onTurnComplete?: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  if (!direction) return null;

  const isForward = direction === "forward";
  const renderPageFace = (
    page: ScenarioReaderPage | null,
    section: ScenarioReaderSection | null,
    face: "front" | "back",
  ) => (
    <div
      className={`relative h-full w-full overflow-hidden border border-[#c7a06b] bg-[radial-gradient(circle_at_48%_18%,rgba(255,243,204,0.96),rgba(229,200,151,0.98)_58%,rgba(205,164,102,0.98)_100%)] p-3 text-[#3b2211] shadow-[inset_0_0_0_1px_rgba(255,246,215,0.36),inset_0_0_42px_rgba(95,54,19,0.18)] sm:p-4 lg:p-6 ${face === "back" ? "[backface-visibility:hidden]" : ""}`}
      style={{ backfaceVisibility: "hidden" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(0deg,rgba(92,55,24,0.08)_0_1px,transparent_1px_8px),radial-gradient(circle_at_18%_22%,rgba(88,49,18,0.12),transparent_18%),radial-gradient(circle_at_80%_70%,rgba(96,55,21,0.10),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-[10px] border border-[#b98343]/40" />
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d5129]">
          {page ? `剧本 ${String(page.pageNumber).padStart(2, "0")}` : title}
        </div>
        <h3 className="mt-2 text-[21px] font-black tracking-[0.04em] text-[#3b2211] lg:text-[27px]">
          {page?.type === "cover" ? title : section ? title : t("board.scenario.readerNext")}
        </h3>
        {section ? (
          <>
            <div className={`mt-3 border-l-4 ${section.accentClass} pl-3`}>
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#7d5129]">
                {t(section.labelKey)}
              </div>
              <p className="mt-2 max-h-[190px] overflow-hidden whitespace-pre-line text-[14px] leading-6 text-[#4e321c] lg:text-[16px] lg:leading-7">
                {t(section.bodyKey)}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-4 text-[15px] font-semibold leading-7 text-[#57361f] lg:text-[17px] lg:leading-8">
            {title}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between border-t border-[#b98343]/36 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86643f]">
          <span>{title}</span>
          <span>{page ? String(page.pageNumber).padStart(2, "0") : "—"}</span>
        </div>
      </div>
    </div>
  );

  const renderSpread = (
    leftPage: ScenarioReaderPage | null,
    rightPage: ScenarioReaderPage | null,
  ) => (
    <div className="grid h-full w-full grid-cols-2 gap-2 bg-[#2a170d] p-1.5">
      {renderPageFace(leftPage, leftPage?.sections?.[0] ?? null, "front")}
      {renderPageFace(rightPage, rightPage?.sections?.[0] ?? null, "front")}
    </div>
  );

  const viewportWidth =
    typeof window === "undefined" ? 1000 : Math.max(320, window.innerWidth);
  const viewportHeight =
    typeof window === "undefined" ? 680 : Math.max(260, window.innerHeight);
  const stageWidth = isPhoneLandscapeLayout
    ? Math.max(320, Math.min(viewportWidth * 0.94, 900))
    : Math.max(640, Math.min(viewportWidth * 0.9, 1080));
  const stageHeight = isPhoneLandscapeLayout
    ? Math.max(260, Math.min(viewportHeight - 88, 420))
    : Math.max(420, Math.min(viewportHeight * 0.78, 720));

  return (
    <div
      data-testid="betrayal-scenario-book-turning-sheet"
      data-flip-direction={direction}
      data-flip-implementation="turnjs-real-page-flip"
      data-flip-from-page={fromPages.map((page) => page?.id ?? "").join(",")}
      data-flip-to-page={toPages.map((page) => page?.id ?? "").join(",")}
      aria-hidden="true"
      className="pointer-events-none absolute inset-[7px] z-20 overflow-hidden"
    >
      <FoldLinePageFlipStage
        mode={isForward ? "flippingToDetail" : "flippingToOverview"}
        testId="betrayal-scenario-book-real-flip-stage"
        durationMs={SCENARIO_BOOK_TURN_DURATION_MS}
        renderOverviewStage={() =>
          renderSpread(
            ...(isForward ? fromPages : toPages),
          )
        }
        renderDetailStage={() =>
          renderSpread(
            ...(isForward ? toPages : fromPages),
          )
        }
        overviewStageSize={{ width: stageWidth, height: stageHeight }}
        detailStageSize={{ width: stageWidth, height: stageHeight }}
        leftPageRect={{ left: "0%", top: "0%", width: "50%", height: "100%" }}
        rightPageRect={{ left: "50%", top: "0%", width: "50%", height: "100%" }}
        onFlipToDetailComplete={onTurnComplete}
        onFlipToOverviewComplete={onTurnComplete}
      />
    </div>
  );
}

function CharacterSelectScreen({
  core,
  matchData,
  effectiveLocale,
  isPhoneLandscapeLayout,
  viewerPlayerId,
  selectedExplorerId,
  onSelectExplorer,
  onConfirmExplorer,
  onProposeScenarioCard,
  onConfirmScenarioCard,
  onStartScenario,
}: {
  core: BetrayalCore;
  matchData?: MatchPlayerInfo[];
  effectiveLocale: string;
  isPhoneLandscapeLayout: boolean;
  viewerPlayerId: string;
  selectedExplorerId: string;
  onSelectExplorer: (explorerId: string) => void;
  onConfirmExplorer: () => void;
  onProposeScenarioCard: (candidateId: BetrayalScenarioCardId) => void;
  onConfirmScenarioCard: () => void;
  onStartScenario: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const selectedExplorer =
    EXPLORER_CATALOG.find((item) => item.explorerId === selectedExplorerId) ??
    EXPLORER_CATALOG[0]!;
  const readySet = new Set(core.readyPlayerIds);
  const isReady = readySet.has(viewerPlayerId);
  const selectedByExplorerId = new Map(
    Object.entries(core.selectedExplorerByPlayerId).map(
      ([playerId, explorerId]) => [explorerId, playerId],
    ),
  );
  const availableExplorer =
    EXPLORER_CATALOG.find((explorer) => {
      const selectedByPlayer =
        selectedByExplorerId.get(explorer.explorerId) ?? null;
      return !selectedByPlayer || selectedByPlayer === viewerPlayerId;
    }) ?? EXPLORER_CATALOG[0]!;
  const scenarioCardCandidates = React.useMemo(
    () =>
      core.scenarioCandidateIds.map((candidateId) =>
        getBetrayalScenarioCardCandidate(candidateId),
      ),
    [core.scenarioCandidateIds],
  );
  const proposedScenarioCard = getBetrayalScenarioCardCandidate(
    core.proposedScenarioCardId,
  );
  const proposedScenarioCardTitle = formatScenarioCardTitle(
    proposedScenarioCard,
    effectiveLocale,
  );
  const proposedScenarioIsPlayable = Boolean(
    resolveImplementedScenarioIdForCard(core.proposedScenarioCardId),
  );
  const scenarioCardConfirmed =
    core.scenarioCardConfirmations[viewerPlayerId] ===
    core.proposedScenarioCardId;
  const scenarioParticipantPlayerIds = Object.keys(
    core.selectedExplorerByPlayerId,
  );
  const scenarioConfirmedCount = scenarioParticipantPlayerIds.filter(
    (playerId) =>
      core.scenarioCardConfirmations[playerId] === core.proposedScenarioCardId,
  ).length;
  const scenarioParticipantCount = scenarioParticipantPlayerIds.length;
  const scenarioAllParticipantsConfirmed =
    scenarioParticipantCount > 0 &&
    scenarioConfirmedCount === scenarioParticipantCount;
  const scenarioConfirmationStatusLabel =
    scenarioParticipantCount > 0
      ? t("board.characterSelect.scenarioConfirmationCount", {
          confirmed: scenarioConfirmedCount,
          total: scenarioParticipantCount,
        })
      : t("board.characterSelect.scenarioNoParticipants");
  const [
    scenarioCardConfirmationSettling,
    setScenarioCardConfirmationSettling,
  ] = React.useState(false);
  const scenarioCardConfirmationSettlingRef = React.useRef(false);
  const scenarioCardConfirmationSettlingTimerRef =
    React.useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const primaryActionDisabled =
    isReady &&
    scenarioCardConfirmed &&
    (!scenarioAllParticipantsConfirmed ||
      !proposedScenarioIsPlayable ||
      scenarioCardConfirmationSettling);
  const primaryActionLabel = !isReady
    ? t("board.characterSelect.confirm")
    : !scenarioCardConfirmed
      ? t("board.characterSelect.confirmScenarioCard")
      : !scenarioAllParticipantsConfirmed
        ? t("board.characterSelect.waitScenarioConfirmations")
      : proposedScenarioIsPlayable
        ? t("board.characterSelect.startScenario")
        : t("board.characterSelect.cannotStartPendingScenario");
  const [scenarioSelectionOpen, setScenarioSelectionOpen] =
    React.useState(false);
  const [scenarioDetailsOpen, setScenarioDetailsOpen] = React.useState(false);
  const [scenarioReaderSpreadIndex, setScenarioReaderSpreadIndex] =
    React.useState(0);
  const [scenarioReaderTurnDirection, setScenarioReaderTurnDirection] =
    React.useState<"back" | "forward" | null>(null);
  const [scenarioReaderTurnSnapshot, setScenarioReaderTurnSnapshot] =
    React.useState<ScenarioBookTurnSnapshot | null>(null);

  React.useEffect(() => {
    if (!isReady) {
      setScenarioSelectionOpen(false);
      setScenarioDetailsOpen(false);
      setScenarioReaderSpreadIndex(0);
      setScenarioReaderTurnSnapshot(null);
    }
  }, [isReady]);
  React.useEffect(
    () => () => {
      if (scenarioCardConfirmationSettlingTimerRef.current) {
        window.clearTimeout(scenarioCardConfirmationSettlingTimerRef.current);
      }
    },
    [],
  );

  const handlePrimaryAction = React.useCallback(() => {
    if (!isReady) {
      onConfirmExplorer();
      return;
    }
    if (!scenarioCardConfirmed) {
      scenarioCardConfirmationSettlingRef.current = true;
      setScenarioCardConfirmationSettling(true);
      if (scenarioCardConfirmationSettlingTimerRef.current) {
        window.clearTimeout(scenarioCardConfirmationSettlingTimerRef.current);
      }
      onConfirmScenarioCard();
      scenarioCardConfirmationSettlingTimerRef.current = window.setTimeout(() => {
        scenarioCardConfirmationSettlingRef.current = false;
        setScenarioCardConfirmationSettling(false);
        scenarioCardConfirmationSettlingTimerRef.current = null;
      }, 350);
      return;
    }
    if (scenarioCardConfirmationSettlingRef.current) {
      return;
    }
    onStartScenario();
  }, [
    isReady,
    onConfirmExplorer,
    onConfirmScenarioCard,
    onStartScenario,
    scenarioCardConfirmed,
  ]);

  const handleScenarioCardPropose = React.useCallback(
    (candidateId: BetrayalScenarioCardId) => {
      onProposeScenarioCard(candidateId);
      setScenarioDetailsOpen(false);
      setScenarioReaderSpreadIndex(0);
      setScenarioReaderTurnSnapshot(null);
    },
    [onProposeScenarioCard],
  );

  const handleScenarioDialogClose = React.useCallback(
    (event?: React.SyntheticEvent) => {
      event?.stopPropagation();
      window.setTimeout(() => {
        setScenarioSelectionOpen(false);
        setScenarioDetailsOpen(false);
        setScenarioReaderSpreadIndex(0);
        setScenarioReaderTurnSnapshot(null);
      }, 0);
    },
    [
      setScenarioDetailsOpen,
      setScenarioReaderSpreadIndex,
      setScenarioSelectionOpen,
    ],
  );
  const handleScenarioReaderClose = React.useCallback(
    (event?: React.SyntheticEvent) => {
      event?.stopPropagation();
      setScenarioDetailsOpen(false);
      setScenarioReaderSpreadIndex(0);
      setScenarioReaderTurnSnapshot(null);
    },
    [],
  );
  const handleScenarioDetailsOpen = React.useCallback(
    (event: React.SyntheticEvent) => {
      event.stopPropagation();
      setScenarioDetailsOpen(true);
    },
    [],
  );
  const scenarioReaderDossier = resolveScenarioCardDossier(
    proposedScenarioCard,
  );
  const scenarioReaderTitle = t(scenarioReaderDossier.titleKey);
  // 角色选择阶段只是阅读剧本预览，不属于进入游戏后的开局剧情幕。
  // 开局黑幕只由 preHaunt 的真实开始流程负责展示。
  const scenarioReaderOpeningSection = null;
  const scenarioReaderPages = buildScenarioReaderPages(
    scenarioReaderDossier,
    "all",
  );
  const scenarioReaderBookSpreadCount = Math.max(
    1,
    Math.ceil(scenarioReaderPages.length / 2),
  );
  const scenarioReaderHasOpeningStage = false;
  const scenarioReaderSpreadCount =
    scenarioReaderBookSpreadCount + (scenarioReaderHasOpeningStage ? 1 : 0);
  const isScenarioReaderOpeningStage =
    scenarioReaderHasOpeningStage && scenarioReaderSpreadIndex === 0;
  const scenarioReaderBookSpreadIndex = scenarioReaderHasOpeningStage
    ? Math.max(0, scenarioReaderSpreadIndex - 1)
    : scenarioReaderSpreadIndex;
  const scenarioReaderLeftPage =
    scenarioReaderPages[scenarioReaderBookSpreadIndex * 2] ?? null;
  const scenarioReaderRightPage =
    scenarioReaderPages[scenarioReaderBookSpreadIndex * 2 + 1] ?? null;
  const canTurnScenarioReaderBack = scenarioReaderSpreadIndex > 0;
  const canTurnScenarioReaderForward =
    scenarioReaderSpreadIndex < scenarioReaderSpreadCount - 1;
  const handleScenarioReaderTurn = (direction: "back" | "forward") => {
    const nextSpreadIndex =
      direction === "back"
        ? Math.max(0, scenarioReaderSpreadIndex - 1)
        : Math.min(
            scenarioReaderSpreadCount - 1,
            scenarioReaderSpreadIndex + 1,
          );
    const didTurn = nextSpreadIndex !== scenarioReaderSpreadIndex;
    if (!didTurn) return;
    setScenarioReaderTurnSnapshot({
      fromPages: resolveScenarioReaderSpreadPages(
        scenarioReaderPages,
        scenarioReaderHasOpeningStage,
        scenarioReaderSpreadIndex,
      ),
      toPages: resolveScenarioReaderSpreadPages(
        scenarioReaderPages,
        scenarioReaderHasOpeningStage,
        nextSpreadIndex,
      ),
    });
    playSound(BETRAYAL_SCENARIO_PAGE_TURN_KEY);
    setScenarioReaderTurnDirection(direction);
    setScenarioReaderSpreadIndex(nextSpreadIndex);
    window.setTimeout(() => {
      setScenarioReaderTurnDirection(null);
      setScenarioReaderTurnSnapshot(null);
    }, SCENARIO_BOOK_TURN_DURATION_MS + 80);
  };

  return (
    <div
      data-testid="betrayal-character-select-screen"
      data-tutorial-id="betrayal-character-select-screen"
      className="relative flex h-full min-h-full flex-col overflow-hidden bg-[#09110f] text-[#f1e8d4]"
      style={{
        backgroundImage: [
          "radial-gradient(circle at 18% 22%, rgba(118,178,82,0.16), transparent 19%)",
          "radial-gradient(circle at 72% 14%, rgba(196,167,98,0.08), transparent 24%)",
          "repeating-linear-gradient(90deg, rgba(38,52,44,0.03) 0 2px, rgba(0,0,0,0) 2px 28px)",
          "linear-gradient(180deg, #10201a 0%, #07100e 100%)",
        ].join(","),
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1760px] p-1.5 sm:p-2 lg:p-4">
        <div className="relative flex h-full w-full flex-col overflow-hidden border border-[#7d643a] bg-[rgba(8,15,13,0.94)] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
          <div className="pointer-events-none absolute inset-0 border border-[rgba(216,191,129,0.14)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(132,170,82,0.06),transparent_28%)]" />
          <div className="pointer-events-none absolute left-1 top-1 h-4 w-4 border-l border-t border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute right-1 top-1 h-4 w-4 border-r border-t border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 border-b border-l border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 border-b border-r border-[rgba(216,191,129,0.6)]" />

          <header className="grid min-h-[64px] grid-cols-[minmax(132px,1fr)_minmax(0,1fr)_86px] border-b border-[#6a5637] bg-[linear-gradient(180deg,rgba(10,16,14,0.98),rgba(9,15,13,0.94))] sm:grid-cols-[minmax(180px,1fr)_minmax(0,1fr)_112px] lg:min-h-[104px] lg:grid-cols-[360px_1fr_240px]">
            <div className="relative flex items-center overflow-hidden border-r border-[#5e4b2e] px-2 py-2 sm:px-3 lg:px-6 lg:py-3">
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.26),transparent)]" />
              <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
              <div className="relative flex h-[46px] w-full items-center overflow-hidden border border-[rgba(214,191,129,0.28)] bg-[linear-gradient(180deg,rgba(8,12,11,0.74),rgba(5,8,7,0.92))] px-2 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.08)] lg:h-[72px] lg:px-3">
                <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.12)]" />
                <OptimizedImage
                  src={ASSETS.titleBanner}
                  locale={effectiveLocale}
                  alt={t("title")}
                  className="relative h-[34px] w-full object-contain object-left lg:h-[56px]"
                  draggable={false}
                />
              </div>
            </div>
            <div className="relative flex items-center justify-center px-2 py-2 text-center lg:px-6 lg:py-4">
              <div className="pointer-events-none absolute left-[16%] top-1/2 hidden items-center gap-2 lg:flex">
                <span className="h-px w-16 bg-[linear-gradient(90deg,transparent,#9f854d)]" />
                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
              </div>
              <div className="pointer-events-none absolute right-[16%] top-1/2 hidden items-center gap-2 lg:flex">
                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
                <span className="h-px w-16 bg-[linear-gradient(90deg,#9f854d,transparent)]" />
              </div>
              <div className="text-[15px] font-semibold uppercase tracking-[0.16em] text-[#e7c783] sm:text-[18px] lg:text-[24px] lg:tracking-[0.28em]">
                {t("board.characterSelect.title")}
              </div>
            </div>
            <div className="border-l border-[#5e4b2e]">
              <div className="flex h-full flex-col items-center justify-center px-2 py-2 text-center lg:px-4 lg:py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#d8bf81] lg:text-xs lg:tracking-[0.2em]">
                  {t("board.characterSelect.playersLabel")}
                </div>
                <div className="mt-0.5 text-[16px] font-semibold text-[#a8e850] lg:mt-1 lg:text-[22px]">
                  {core.readyPlayerIds.length}/{core.playerIds.length}
                </div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-[#9e8c69] lg:mt-1 lg:text-[10px] lg:tracking-[0.16em]">
                  {t("board.characterSelect.readyCountLabel")}
                </div>
              </div>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 grid-cols-[minmax(212px,34%)_minmax(0,1fr)] gap-0 px-2 pb-2 pt-2 sm:grid-cols-[minmax(270px,35%)_minmax(0,1fr)] lg:grid-cols-[440px_minmax(0,1fr)] lg:px-5 lg:pb-3 lg:pt-4 xl:grid-cols-[472px_minmax(0,1fr)]">
            <aside className="relative flex min-h-0 flex-col pr-1.5 lg:pr-6">
              <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),rgba(214,191,129,0.22),transparent)]" />
              <section
                data-testid="betrayal-character-detail-scroll"
                className="custom-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-1.5 pb-1.5 pt-1.5 lg:px-5 lg:pb-4 lg:pt-4"
              >
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28),transparent)]" />
                <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
                <div className="flex justify-center px-1 pt-0 lg:px-2 lg:pt-1">
                  <ExplorerPentagonCard
                    explorer={selectedExplorer}
                    selected
                    ready={isReady}
                    taken={false}
                    effectiveLocale={effectiveLocale}
                  />
                </div>
                <section className="relative mt-0.5 flex-1 overflow-visible px-0 pb-1 pt-1 lg:mt-2 lg:px-1 lg:pb-2 lg:pt-2">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
                  <div className="grid gap-0.5 lg:gap-2">
                    <h2 className="truncate text-[12px] font-semibold uppercase tracking-[0.03em] text-[#f3dfae] sm:text-[14px] lg:text-[24px] lg:tracking-[0.14em]">
                      {selectedExplorer.displayName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-1 text-[7.5px] uppercase tracking-[0.06em] text-[#b9aa84] lg:text-[10px] lg:tracking-[0.12em]">
                      <span className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(214,191,129,0.18)] bg-[rgba(15,16,13,0.42)] px-1.5 py-0.5 lg:px-2 lg:py-1">
                        <span className="h-1.5 w-1.5 rounded-[2px] bg-[#d8bf81]" />
                        {t("board.characterSelect.currentSelection")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(110,133,66,0.26)] bg-[rgba(23,33,19,0.36)] px-1.5 py-0.5 text-[#b5ef42] lg:px-2 lg:py-1">
                        <span className="h-1.5 w-1.5 rounded-[2px] bg-[#b5ef42]" />
                        {isReady
                          ? t("board.characterSelect.ready")
                          : t("board.characterSelect.pending")}
                      </span>
                    </div>
                  </div>
                  <div className="relative mt-1 px-0.5 py-0.5 lg:mt-2 lg:px-0.5 lg:py-0.5">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                    <div className="mb-1 flex items-center gap-1.5 text-[7.5px] font-semibold uppercase tracking-[0.1em] text-[#d8bf81] lg:mb-2 lg:gap-2 lg:text-[10px] lg:tracking-[0.16em]">
                      <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28))]" />
                      <span>{t("board.characterSelect.traitsTitle")}</span>
                      <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(214,191,129,0.28),transparent)]" />
                    </div>
                    <div className="grid gap-1 lg:gap-2">
                      {(
                        [
                          "might",
                          "speed",
                          "knowledge",
                          "sanity",
                        ] as BetrayalTraitKey[]
                      ).map((trait) => (
                        <div
                          key={trait}
                          className="grid grid-cols-[38px_minmax(0,1fr)_14px] items-center gap-1 text-[8px] sm:grid-cols-[56px_minmax(0,1fr)_18px] sm:gap-1.5 sm:text-[10px] lg:grid-cols-[92px_minmax(0,1fr)_28px] lg:gap-3 lg:text-sm"
                        >
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${TRAIT_TONE_CLASS[trait].text}`}
                          >
                            <OptimizedImage
                              src={ASSETS.trait[trait]}
                              locale={effectiveLocale}
                              alt=""
                              className="h-2 w-2 object-contain opacity-86 sm:h-2.5 sm:w-2.5 lg:h-4 lg:w-4"
                              draggable={false}
                            />
                            {TRAIT_LABEL_LOCAL[trait]}
                          </span>
                          <div className="grid grid-cols-6 gap-[2px] lg:gap-1.5">
                            {Array.from({ length: 6 }).map((_, index) => (
                              <span
                                key={index}
                                className={`h-1 rounded-[2px] border sm:h-1.5 lg:h-3.5 ${
                                  index < selectedExplorer.traits[trait]
                                    ? TRAIT_TONE_CLASS[trait].active
                                    : TRAIT_TONE_CLASS[trait].inactive
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-right text-[10px] font-semibold text-[#f1e8d4] sm:text-[11px] lg:text-base">
                            {selectedExplorer.traits[trait]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-1 border-t border-[rgba(78,65,45,0.54)] pt-1 lg:mt-2 lg:pt-2">
                    <div className="relative px-0.5 py-0.5">
                      <div
                        data-testid="betrayal-character-ability-summary"
                        className="relative flex min-h-[36px] w-full items-start gap-1.5 rounded-[6px] border border-[rgba(110,133,66,0.46)] bg-[rgba(23,33,19,0.62)] px-2 py-1.5 text-left text-[10px] font-medium leading-relaxed tracking-[0.04em] text-[#e4f3d4] lg:min-h-[44px] lg:px-2.5 lg:text-[10px] lg:tracking-[0.06em]"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-[2px] bg-[#b5ef42]" />
                        <span className="shrink-0 font-semibold text-[#d8bf81]">
                          {t("board.characterSelect.abilityTitle")}：
                        </span>
                        <span className="font-semibold text-[#b5ef42]">
                          {selectedExplorer.abilityName}：
                        </span>
                        <span className="min-w-0 flex-1 text-[#e4f3d4]">
                          {selectedExplorer.abilityText}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </section>
            </aside>

            <section className="relative flex min-h-0 items-stretch justify-center px-0 lg:px-5">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.16),transparent)]" />
              <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.12),transparent)]" />
              <div
                className="no-scrollbar hidden min-h-0 max-w-[1056px] grid-cols-3 content-start justify-items-center gap-x-12 gap-y-10 overflow-x-hidden overflow-y-auto overscroll-contain py-4 lg:grid"
                data-testid="betrayal-character-selection-grid"
                data-tutorial-id="betrayal-character-selection-grid"
              >
                {EXPLORER_CATALOG.map((explorer) => {
                  const selectedByPlayer =
                    selectedByExplorerId.get(explorer.explorerId) ?? null;
                  const selected = explorer.explorerId === selectedExplorerId;
                  const taken = Boolean(
                    selectedByPlayer && selectedByPlayer !== viewerPlayerId,
                  );
                  const visualOwnerPlayerId =
                    selectedByPlayer ?? (selected ? viewerPlayerId : null);
                  return (
                    <ExplorerPentagonCard
                      key={explorer.explorerId}
                      explorer={explorer}
                      compact
                      selected={selected}
                      ready={
                        selectedByPlayer
                          ? readySet.has(selectedByPlayer)
                          : false
                      }
                      taken={taken}
                      playerLabel={
                        visualOwnerPlayerId
                          ? `P${core.playerIds.indexOf(visualOwnerPlayerId) + 1}`
                          : null
                      }
                      effectiveLocale={effectiveLocale}
                      onClick={() => onSelectExplorer(explorer.explorerId)}
                    />
                  );
                })}
              </div>
              <div
                className="no-scrollbar grid h-full min-h-0 w-full grid-cols-3 content-start justify-items-center gap-x-1 gap-y-1.5 overflow-x-hidden overflow-y-auto overscroll-contain px-0.5 py-0.5 sm:gap-x-2 sm:gap-y-1.5 lg:hidden"
                data-testid="betrayal-character-mobile-grid"
              >
                {EXPLORER_CATALOG.map((explorer) => {
                  const selectedByPlayer =
                    selectedByExplorerId.get(explorer.explorerId) ?? null;
                  const selected = explorer.explorerId === selectedExplorerId;
                  const taken = Boolean(
                    selectedByPlayer && selectedByPlayer !== viewerPlayerId,
                  );
                  const visualOwnerPlayerId =
                    selectedByPlayer ?? (selected ? viewerPlayerId : null);
                  return (
                    <ExplorerPentagonCard
                      key={explorer.explorerId}
                      explorer={explorer}
                      compact
                      selected={selected}
                      ready={
                        selectedByPlayer
                          ? readySet.has(selectedByPlayer)
                          : false
                      }
                      taken={taken}
                      playerLabel={
                        visualOwnerPlayerId
                          ? `P${core.playerIds.indexOf(visualOwnerPlayerId) + 1}`
                          : null
                      }
                      effectiveLocale={effectiveLocale}
                      onClick={() => onSelectExplorer(explorer.explorerId)}
                    />
                  );
                })}
              </div>
            </section>
          </main>

          <footer className="grid grid-cols-[minmax(0,1fr)_minmax(220px,260px)] border-t border-[#6a5637] bg-[linear-gradient(180deg,rgba(10,16,14,0.98),rgba(9,15,13,0.94))] lg:grid-cols-[minmax(0,1fr)_520px]">
            <div className="grid grid-cols-[54px_repeat(6,minmax(34px,1fr))] overflow-hidden lg:grid-cols-[124px_repeat(6,minmax(92px,1fr))]">
              <div className="flex flex-col justify-center border-r border-[#5e4b2e] px-1 py-1.5 text-center lg:px-3 lg:py-3">
                <div className="text-[8px] uppercase tracking-[0.12em] text-[#d8bf81] lg:text-[11px] lg:tracking-[0.2em]">
                  {t("board.characterSelect.playersLabel")}
                </div>
                <div className="mt-0.5 text-[13px] font-semibold text-[#a8e850] lg:mt-1 lg:text-[16px]">
                  {core.readyPlayerIds.length}/{core.playerIds.length}
                </div>
              </div>
              {Array.from({ length: 6 }).map((_, seatIndex) => {
                const playerId = core.playerIds[seatIndex] ?? null;
                const selectedId = playerId
                  ? (core.selectedExplorerByPlayerId[playerId] ??
                    (playerId === viewerPlayerId ? selectedExplorerId : null))
                  : null;
                const playerName = playerId
                  ? resolvePlayerName(
                      playerId,
                      `玩家${seatIndex + 1}`,
                      matchData,
                    )
                  : "—";
                const ready = playerId ? readySet.has(playerId) : false;
                const seatExplorer = selectedId
                  ? (EXPLORER_CATALOG.find(
                      (explorer) => explorer.explorerId === selectedId,
                    ) ?? null)
                  : null;
                return (
                  <div
                    key={playerId ?? `empty-seat-${seatIndex}`}
                    className={`flex min-w-0 flex-col items-center justify-center border-r border-[#5e4b2e] px-0.5 py-1 text-center last:border-r-0 lg:px-2 lg:py-2 ${
                      selectedId
                        ? "bg-[rgba(75,116,59,0.08)] text-[#d9f0b8]"
                        : "bg-[rgba(9,13,12,0.22)] text-[#8d8678]"
                    }`}
                  >
                    <div
                      className={`grid h-[28px] w-[28px] place-items-center overflow-hidden sm:h-[34px] sm:w-[34px] lg:h-[66px] lg:w-[66px] ${
                        selectedId
                          ? "bg-[rgba(13,19,16,0.78)]"
                          : "bg-[rgba(13,17,15,0.56)]"
                      }`}
                    >
                      {seatExplorer ? (
                        <OptimizedImage
                          src={seatExplorer.portraitAsset}
                          locale={effectiveLocale}
                          alt={seatExplorer.displayName}
                          className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.34)]"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-[24px] text-[#3f473f]">—</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[9px] font-semibold tracking-[0.08em] text-[#d7bf85] lg:mt-1 lg:text-[11px] lg:tracking-[0.12em]">
                      P{seatIndex + 1}
                    </div>
                    <div className="hidden mt-0.5 max-w-[82px] truncate text-[11px] lg:block">
                      {playerName}
                    </div>
                    <div
                      className={`mt-0.5 inline-flex items-center gap-1 rounded-[4px] px-1 py-0.5 text-[8px] lg:mt-1 lg:px-2 lg:text-[10px] ${
                        ready
                          ? "border border-[rgba(132,171,82,0.42)] bg-[rgba(39,57,28,0.42)] text-[#b5ef42]"
                          : selectedId
                            ? "border border-[rgba(214,191,129,0.22)] bg-[rgba(39,31,18,0.28)] text-[#d8bf81]"
                            : "border border-[rgba(93,79,54,0.18)] bg-transparent text-[#676253]"
                      }`}
                    >
                      {ready
                        ? t("board.characterSelect.ready")
                        : selectedId
                          ? t("board.characterSelect.pending")
                          : t("board.characterSelect.emptySeat")}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[58px_minmax(92px,0.72fr)_minmax(0,1fr)] lg:grid-cols-[120px_minmax(170px,0.75fr)_minmax(0,1fr)]">
              <button
                type="button"
                onClick={() => onSelectExplorer(availableExplorer.explorerId)}
                className="relative inline-flex min-h-[58px] items-center justify-center gap-1 border-l border-[#5e4b2e] px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#d8bf81] transition hover:bg-[rgba(214,191,129,0.06)] lg:min-h-[126px] lg:gap-3 lg:text-[16px] lg:tracking-[0.18em]"
              >
                <span className="pointer-events-none absolute inset-y-3 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                {t("board.characterSelect.random")}
              </button>
              <button
                type="button"
                onClick={() => setScenarioSelectionOpen(true)}
                data-testid="betrayal-character-scenario-button"
                aria-haspopup="dialog"
                aria-expanded={scenarioSelectionOpen}
                className="relative inline-flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 border-l border-[#5e4b2e] px-1 text-center transition hover:bg-[rgba(214,191,129,0.06)] lg:min-h-[126px] lg:px-3"
              >
                <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#c9a35e] lg:text-[11px] lg:tracking-[0.18em]">
                  {t("board.characterSelect.scenarioSelected")}
                </span>
                <span className="max-w-full truncate text-[11px] font-bold tracking-[0.04em] text-[#fff0b8] lg:text-[17px]">
                  {proposedScenarioCardTitle}
                </span>
                <span className="mt-0.5 max-w-full truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-[#9fb98b] lg:text-[10px]">
                  {scenarioCardConfirmed
                    ? t("board.characterSelect.scenarioConfirmed")
                    : t("board.characterSelect.scenarioNeedsConfirmation")}
                </span>
                <span
                  data-testid="betrayal-scenario-confirmation-count"
                  className="mt-0.5 max-w-full truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-[#d6b56d] lg:text-[10px]"
                >
                  {scenarioConfirmationStatusLabel}
                </span>
              </button>
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={primaryActionDisabled}
                data-testid="betrayal-character-confirm"
                data-tutorial-id="betrayal-character-confirm"
                className={`relative inline-flex min-h-[58px] items-center justify-center gap-2 border-l border-[#5e4b2e] px-2 text-[15px] font-semibold uppercase tracking-[0.1em] shadow-[inset_0_0_0_1px_rgba(181,239,66,0.12)] transition lg:min-h-[126px] lg:text-[26px] lg:tracking-[0.18em] ${
                  primaryActionDisabled
                    ? "cursor-not-allowed bg-[linear-gradient(180deg,rgba(78,72,58,0.22),rgba(31,30,25,0.72))] text-[#9b9178]"
                    : "bg-[linear-gradient(180deg,rgba(95,135,44,0.24),rgba(54,81,22,0.76))] text-[#dfff8f] hover:bg-[linear-gradient(180deg,rgba(108,149,51,0.3),rgba(61,91,25,0.82))]"
                }`}
              >
                <span className="pointer-events-none absolute inset-2 border border-[rgba(181,239,66,0.16)]" />
                {primaryActionLabel}
              </button>
            </div>
          </footer>
        </div>
      </div>
      {scenarioSelectionOpen ? (
        <HudPortal>
          <div
            role="dialog"
            aria-modal="true"
            data-testid="betrayal-scenario-select-dialog"
            className="pointer-events-auto fixed inset-0 grid place-items-center bg-[rgba(2,6,5,0.72)] px-4 py-3"
            style={{ zIndex: SCENARIO_READER_MODAL_Z_INDEX }}
            onClick={handleScenarioDialogClose}
          >
            <div
              className="pointer-events-auto relative max-h-[calc(100vh-24px)] w-full max-w-[640px] overflow-y-auto border border-[#7b633d] bg-[linear-gradient(135deg,rgba(48,37,22,0.98),rgba(20,17,12,0.98)_46%,rgba(7,10,8,0.98))] p-3 text-[#f3e0b4] shadow-[0_26px_70px_rgba(0,0,0,0.58)] lg:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-2 border border-[rgba(214,191,129,0.16)]" />
              <div className="pointer-events-none absolute left-0 top-0 h-full w-2 bg-[linear-gradient(180deg,rgba(198,152,71,0.5),rgba(58,31,18,0.34))]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#c9a35e] lg:text-[12px]">
                      {t("board.characterSelect.scenarioDossier")}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#8f8065]">
                      {t("board.characterSelect.scenarioCaseNo")}
                    </div>
                  </div>
                  <div className="border border-[rgba(214,191,129,0.3)] bg-[rgba(10,12,9,0.48)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d6b56d]">
                    {t("board.characterSelect.scenarioOnly")}
                  </div>
                </div>
                <div className="mt-3 border-l-2 border-[rgba(214,191,129,0.34)] pl-3 text-[12px] leading-5 text-[#e8dfc8] lg:text-[14px]">
                  {t("board.characterSelect.scenarioStepSubtitle")}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[rgba(214,191,129,0.16)] pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9a35e]">
                    {t("board.characterSelect.scenarioCardsTitle")}
                  </div>
                  <div
                    data-testid="betrayal-scenario-candidate-count"
                    className="border border-[rgba(214,191,129,0.24)] bg-[rgba(10,12,9,0.38)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d6b56d]"
                  >
                    {t("board.characterSelect.scenarioCardsCount")}
                  </div>
                  <div
                    data-testid="betrayal-scenario-dialog-confirmation-count"
                    className="border border-[rgba(214,191,129,0.24)] bg-[rgba(10,12,9,0.38)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d6b56d]"
                  >
                    {scenarioConfirmationStatusLabel}
                  </div>
                </div>
                <div
                  data-testid="betrayal-scenario-candidate-list"
                  className="mt-3 grid gap-2"
                >
                  {scenarioCardCandidates.map((candidate) => {
                    const isProposed =
                      candidate.id === core.proposedScenarioCardId;
                    const isConfirmed =
                      core.scenarioCardConfirmations[viewerPlayerId] ===
                      candidate.id;
                    const isPlayable =
                      candidate.implementationStatus !== "contract-pending";
                    const candidateTitle = formatScenarioCardTitle(
                      candidate,
                      effectiveLocale,
                    );
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        data-testid={`betrayal-scenario-option-${candidate.id}`}
                        data-scenario-card-status={candidate.implementationStatus}
                        aria-pressed={isProposed}
                        onClick={() => handleScenarioCardPropose(candidate.id)}
                        className={`group relative w-full border p-3 text-left shadow-[inset_0_0_0_1px_rgba(255,240,184,0.08)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c57e] lg:p-4 ${
                          isProposed
                            ? "border-[#b5ef42] bg-[linear-gradient(180deg,rgba(54,63,25,0.94),rgba(21,27,16,0.96))]"
                            : "border-[#8b7044] bg-[linear-gradient(180deg,rgba(54,43,25,0.92),rgba(21,23,16,0.94))] hover:border-[#d6bf81]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[17px] font-bold tracking-[0.06em] text-[#fff0b8] lg:text-[22px]">
                              {candidateTitle}
                            </div>
                            <div className="mt-1 text-[12px] uppercase tracking-[0.1em] text-[#9fb98b]">
                              {t("board.characterSelect.scenarioCardMeta", {
                                card: candidate.scenarioCardLabel,
                                omen: candidate.triggerOmenLabel,
                              })}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="border border-[rgba(214,191,129,0.28)] bg-[rgba(10,12,9,0.44)] px-2 py-1 text-[12px] font-bold uppercase tracking-[0.1em] text-[#d6b56d]">
                              {t("board.characterSelect.scenarioHauntNumber", {
                                number: candidate.hauntNumber,
                              })}
                            </span>
                            <span
                              className={`border px-2 py-1 text-[12px] font-bold uppercase tracking-[0.1em] ${
                                isPlayable
                                  ? "border-[rgba(181,239,66,0.36)] bg-[rgba(34,48,20,0.54)] text-[#dfff8f]"
                                  : "border-[rgba(214,191,129,0.28)] bg-[rgba(54,43,25,0.42)] text-[#cbb889]"
                              }`}
                            >
                              {isPlayable
                                ? t("board.characterSelect.scenarioImplemented")
                                : t(
                                    "board.characterSelect.scenarioContractPending",
                                  )}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-[12px] leading-5 text-[#e8dfc8] lg:text-[13px]">
                          {formatScenarioCardSummary(
                            candidate,
                            effectiveLocale,
                          )}
                        </div>
                        {isProposed || isConfirmed ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {isProposed ? (
                              <span className="border border-[rgba(181,239,66,0.32)] bg-[rgba(39,57,28,0.42)] px-2 py-1 text-[12px] font-bold uppercase tracking-[0.1em] text-[#dfff8f]">
                                {t("board.characterSelect.scenarioProposed")}
                              </span>
                            ) : null}
                            {isConfirmed ? (
                              <span className="border border-[rgba(132,171,82,0.42)] bg-[rgba(39,57,28,0.42)] px-2 py-1 text-[12px] font-bold uppercase tracking-[0.1em] text-[#b5ef42]">
                                {t("board.characterSelect.scenarioConfirmed")}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgba(214,191,129,0.16)] pt-3">
                  <button
                    type="button"
                    data-testid="betrayal-scenario-detail-toggle"
                    aria-haspopup="dialog"
                    aria-expanded={scenarioDetailsOpen}
                    disabled={!proposedScenarioIsPlayable}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={handleScenarioDetailsOpen}
                    className={`inline-flex min-h-11 items-center justify-center border px-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c57e] ${
                      proposedScenarioIsPlayable
                        ? "cursor-pointer border-[rgba(214,191,129,0.42)] bg-[rgba(18,23,18,0.78)] text-[#e2c57e] hover:border-[#e2c57e]"
                        : "cursor-not-allowed border-[rgba(114,101,78,0.28)] bg-[rgba(18,18,16,0.58)] text-[#8f8065]"
                    }`}
                  >
                    {t("board.characterSelect.viewScenarioDetails")}
                  </button>
                  <button
                    type="button"
                    data-testid="betrayal-scenario-select-current"
                    disabled={!isReady}
                    onClick={(event) => {
                      event.stopPropagation();
                      onConfirmScenarioCard();
                      handleScenarioDialogClose(event);
                    }}
                    className={`inline-flex min-h-11 items-center justify-center border px-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b5ef42] ${
                      isReady
                        ? "cursor-pointer border-[rgba(181,239,66,0.44)] bg-[rgba(32,52,18,0.68)] text-[#dfff8f] hover:border-[#b5ef42]"
                        : "cursor-not-allowed border-[rgba(114,101,78,0.28)] bg-[rgba(18,18,16,0.58)] text-[#8f8065]"
                    }`}
                  >
                    {scenarioCardConfirmed
                      ? t("board.characterSelect.scenarioConfirmed")
                      : t("board.characterSelect.confirmScenarioCard")}
                  </button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    data-testid="betrayal-scenario-dialog-close"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={handleScenarioDialogClose}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-[rgba(214,191,129,0.34)] bg-[rgba(18,23,18,0.72)] px-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#e2c57e] transition hover:border-[#e2c57e]"
                  >
                    {t("board.characterSelect.closeScenarioDialog")}
                  </button>
                </div>
              </div>
            </div>
            {scenarioDetailsOpen ? (
              <div
                role="dialog"
                aria-modal="true"
                data-testid="betrayal-scenario-reader-dialog"
                className={`pointer-events-auto fixed inset-0 grid ${
                  isScenarioReaderOpeningStage
                    ? "place-items-stretch bg-black p-0"
                    : "place-items-center bg-[radial-gradient(circle_at_50%_12%,rgba(96,67,29,0.34),rgba(2,6,5,0.9)_52%,rgba(0,0,0,0.96))] px-3 py-3"
                }`}
                style={{ zIndex: SCENARIO_READER_MODAL_Z_INDEX }}
                onClick={handleScenarioReaderClose}
              >
                <article
                  data-testid="betrayal-scenario-detail-panel"
                  className={`relative flex w-full flex-col overflow-hidden ${
                    isScenarioReaderOpeningStage
                      ? "h-screen max-h-none max-w-none border-0 bg-transparent text-[#f5e6c7] shadow-none"
                      : "max-h-[calc(100vh-18px)] max-w-[1120px] border border-[#9a7b46] bg-[linear-gradient(135deg,rgba(52,34,20,0.98),rgba(18,14,10,0.99)_48%,rgba(5,7,6,0.99))] text-[#3a2414] shadow-[0_34px_90px_rgba(0,0,0,0.72)]"
                  }`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="pointer-events-none absolute inset-2 border border-[rgba(214,191,129,0.14)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(216,171,88,0.16),transparent_34%)]" />
                  {isScenarioReaderOpeningStage ? null : (
                    <button
                      type="button"
                      data-testid="betrayal-scenario-reader-close"
                      onClick={handleScenarioReaderClose}
                      aria-label={t("board.characterSelect.hideScenarioDetails")}
                      className={`${isPhoneLandscapeLayout ? "relative ml-auto mr-2 mt-2 h-11 w-11 px-0" : "absolute right-3 top-3 min-h-11 min-w-11 px-3"} z-20 inline-flex cursor-pointer items-center justify-center border border-[rgba(214,191,129,0.42)] bg-[rgba(18,23,18,0.82)] text-[12px] font-semibold uppercase tracking-[0.12em] text-[#e2c57e] shadow-[0_8px_24px_rgba(0,0,0,0.38)] transition hover:border-[#e2c57e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c57e]`}
                    >
                      {isPhoneLandscapeLayout ? (
                        <X size={18} aria-hidden="true" />
                      ) : (
                        t("board.characterSelect.hideScenarioDetails")
                      )}
                    </button>
                  )}
                  <div
                    className={`relative min-h-0 ${
                      isScenarioReaderOpeningStage
                        ? "h-full p-0"
                        : `px-2 ${isPhoneLandscapeLayout ? "pb-2" : "py-2 lg:px-3 lg:py-3"}`
                    }`}
                  >
                    <div
                      data-testid={
                        isScenarioReaderOpeningStage
                          ? "betrayal-scenario-opening-stage"
                          : "betrayal-scenario-book"
                      }
                      className={`relative mx-auto w-full overflow-hidden ${
                        isScenarioReaderOpeningStage
                          ? "h-full max-w-none bg-transparent"
                          : "grid grid-cols-2 border border-[#5a371a] bg-[#2a170d] shadow-[0_26px_62px_rgba(0,0,0,0.58),inset_0_0_0_1px_rgba(236,196,117,0.18)]"
                      } ${
                        isScenarioReaderOpeningStage
                          ? "min-h-full p-0"
                          : isPhoneLandscapeLayout
                            ? "h-[calc(100vh-78px)] min-h-0 p-[5px]"
                            : "h-[min(84vh,760px)] min-h-[360px] p-[7px] lg:h-[min(86vh,780px)]"
                      }`}
                    >
                      {isScenarioReaderOpeningStage &&
                      scenarioReaderOpeningSection ? (
                        <CinematicNarrationPanel
                          testId="betrayal-scenario-opening-cinematic"
                          label={t(scenarioReaderOpeningSection.labelKey)}
                          text={t(scenarioReaderOpeningSection.bodyKey)}
                          variant="opening"
                          presentation="stage"
                          compact={isPhoneLandscapeLayout}
                          actionSlot={
                            <button
                              type="button"
                              data-testid="betrayal-scenario-reader-next-zone"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleScenarioReaderTurn("forward");
                              }}
                              disabled={!canTurnScenarioReaderForward}
                              aria-label={t("board.scenario.readerContinue")}
                              className="inline-flex min-h-11 min-w-[144px] cursor-pointer items-center justify-center gap-2 border border-[rgba(242,207,130,0.42)] bg-[rgba(8,10,9,0.82)] px-6 text-[12px] font-black uppercase tracking-[0.22em] text-[#f5e6c7] shadow-[0_16px_38px_rgba(0,0,0,0.58)] transition hover:border-[#f2cf82] hover:bg-[rgba(18,20,16,0.92)] disabled:opacity-35"
                            >
                              {t("board.scenario.readerContinue")}
                              <ChevronRight size={16} aria-hidden="true" />
                            </button>
                          }
                          className="h-full min-h-full"
                        />
                      ) : (
                        <>
                          <div className="pointer-events-none absolute inset-[7px] bg-[linear-gradient(90deg,rgba(53,30,14,0)_0%,rgba(52,30,15,0)_47%,rgba(52,30,15,0.74)_50%,rgba(255,236,187,0.10)_51%,rgba(52,30,15,0)_54%,rgba(52,30,15,0)_100%)]" />
                          <ScenarioBookTurnSheet
                            direction={scenarioReaderTurnDirection}
                            fromPages={
                              scenarioReaderTurnSnapshot?.fromPages ?? [null, null]
                            }
                            toPages={
                              scenarioReaderTurnSnapshot?.toPages ?? [null, null]
                            }
                            title={scenarioReaderTitle}
                            isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                          />
                          {[scenarioReaderLeftPage, scenarioReaderRightPage].map(
                        (page, sideIndex) => {
                          if (!page) {
                            return (
                              <div
                                key={`blank-${sideIndex}`}
                                className="relative hidden overflow-hidden border border-[#c7a06b] bg-[linear-gradient(135deg,#ead3a8,#d9b77b)] shadow-[inset_0_0_38px_rgba(96,55,22,0.24)] sm:block"
                              />
                            );
                          }

                          const pageSideClassName =
                            sideIndex === 0
                              ? "mr-[5px] border-r-0 sm:mr-[8px]"
                              : "ml-[5px] border-l-0 sm:ml-[8px]";

                          return (
                            <section
                              key={page.id}
                              data-testid={
                                page.type === "cover"
                                  ? "betrayal-scenario-book-cover-page"
                                  : `betrayal-scenario-book-page-${page.id}`
                              }
                              className={`relative min-h-0 overflow-hidden border border-[#c7a06b] bg-[radial-gradient(circle_at_48%_18%,rgba(255,243,204,0.92),rgba(229,200,151,0.98)_58%,rgba(205,164,102,0.98)_100%)] shadow-[inset_0_0_0_1px_rgba(255,246,215,0.36),inset_0_0_42px_rgba(95,54,19,0.18)] ${isPhoneLandscapeLayout ? "p-2" : "p-3 sm:p-4 lg:p-6"} ${pageSideClassName}`}
                            >
                              <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(0deg,rgba(92,55,24,0.08)_0_1px,transparent_1px_8px),radial-gradient(circle_at_18%_22%,rgba(88,49,18,0.12),transparent_18%),radial-gradient(circle_at_80%_70%,rgba(96,55,21,0.10),transparent_22%)]" />
                              <div className="pointer-events-none absolute inset-[10px] border border-[#b98343]/40" />
                              <div
                                data-testid={
                                  sideIndex === 0
                                    ? "betrayal-scenario-reader-page-label-desktop-left"
                                    : "betrayal-scenario-reader-page-label-desktop-right"
                                }
                                aria-hidden={sideIndex !== 0}
                                className="sr-only"
                              >
                                {String(page.pageNumber).padStart(2, "0")}
                              </div>
                              {page.type === "cover" ? (
                                <div className="relative flex h-full flex-col justify-between">
                                  <div>
                                    <h2 className="mt-3 text-[32px] font-black leading-none tracking-[0.08em] text-[#402411] lg:text-[46px]">
                                      {scenarioReaderTitle}
                                    </h2>
                                    <div className="mt-3 h-px w-28 bg-[#8f5a22]" />
                                    <p className="mt-4 text-[15px] font-semibold leading-7 text-[#57361f] lg:text-[17px] lg:leading-8">
                                      {t("board.scenario.readerLead")}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[12px] uppercase tracking-[0.1em] text-[#6b4727]">
                                    <div className="border border-[#b98343]/46 bg-[rgba(255,239,199,0.24)] p-2">
                                      <div>
                                        {t("board.scenario.readerCaseLabel")}
                                      </div>
                                      <div className="mt-1 font-bold text-[#402411]">
                                        {t(
                                          "board.characterSelect.scenarioCaseNo",
                                        )}
                                      </div>
                                    </div>
                                    <div className="border border-[#607f3a]/42 bg-[rgba(236,245,193,0.20)] p-2">
                                      <div>
                                        {t("board.scenario.readerStatusLabel")}
                                      </div>
                                      <div className="mt-1 font-bold text-[#425421]">
                                        {t(
                                          "board.characterSelect.scenarioOnly",
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86643f]">
                                    {String(page.pageNumber).padStart(2, "0")}
                                  </div>
                                </div>
                              ) : (
                                <div className="relative flex h-full flex-col">
                                  <div
                                    data-testid="betrayal-scenario-reader-body-scroll"
                                    className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1"
                                  >
                                    <div
                                      className={`grid ${isPhoneLandscapeLayout ? "gap-2" : "gap-4 lg:gap-5"}`}
                                    >
                                      {(page.sections ?? []).map((section) => {
                                          const isCinematicSection =
                                            SCENARIO_READER_CINEMATIC_SECTION_IDS.has(
                                              section.id,
                                            );

                                          return (
                                            <section
                                              key={section.id}
                                              data-testid={`betrayal-scenario-book-section-${section.id}`}
                                              data-cinematic-narration={
                                                isCinematicSection
                                                  ? "opening"
                                                  : undefined
                                              }
                                              className={
                                                isCinematicSection
                                                  ? "min-h-[260px]"
                                                  : `border-l-4 ${isPhoneLandscapeLayout ? "pl-2" : "pl-3"} ${section.accentClass}`
                                              }
                                            >
                                              {isCinematicSection ? (
                                                <CinematicNarrationPanel
                                                  label={t(section.labelKey)}
                                                  text={t(section.bodyKey)}
                                                  variant="opening"
                                                  compact={isPhoneLandscapeLayout}
                                                  className={
                                                    isPhoneLandscapeLayout
                                                      ? "min-h-[248px]"
                                                      : "min-h-[410px]"
                                                }
                                              />
                                              ) : (
                                                <>
                                                  <div
                                                    className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#7d5129]"
                                                    aria-hidden="true"
                                                  >
                                                    {String(
                                                      page.pageNumber,
                                                    ).padStart(2, "0")}
                                                  </div>
                                                  <h3
                                                    className={`${isPhoneLandscapeLayout ? "mt-0.5 text-[14px]" : "mt-1 text-[21px] lg:text-[25px]"} font-black tracking-[0.05em] text-[#3b2211]`}
                                                  >
                                                    {t(section.labelKey)}
                                                  </h3>
                                                  <p
                                                    className={`${isPhoneLandscapeLayout ? "mt-1 text-[12px] leading-[1.45]" : "mt-2 text-[14px] leading-[1.6] lg:text-[15px] lg:leading-[1.65]"} whitespace-pre-line font-medium text-[#4e321c]`}
                                                  >
                                                    {t(section.bodyKey)}
                                                  </p>
                                                </>
                                              )}
                                            </section>
                                          );
                                        },
                                      )}
                                    </div>
                                  </div>
                                  <div
                                    className={`${isPhoneLandscapeLayout ? "mt-1 pt-1" : "mt-3 pt-2"} flex items-center justify-between border-t border-[#b98343]/36 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86643f]`}
                                  >
                                    <span>
                                      {scenarioReaderTitle}
                                    </span>
                                    <span>
                                      {String(page.pageNumber).padStart(2, "0")}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </section>
                          );
                        },
                      )}
                        </>
                      )}
                    </div>
                    {isScenarioReaderOpeningStage ? null : (
                      <button
                        type="button"
                        data-testid="betrayal-scenario-reader-prev-zone"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleScenarioReaderTurn("back");
                        }}
                        disabled={!canTurnScenarioReaderBack}
                        aria-label={t("board.scenario.readerPrev")}
                        className="absolute bottom-3 left-3 top-3 z-10 w-[calc(50%_-_12px)] cursor-w-resize bg-transparent disabled:pointer-events-none"
                      />
                    )}
                    {isScenarioReaderOpeningStage ? null : (
                      <button
                        type="button"
                        data-testid="betrayal-scenario-reader-next-zone"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleScenarioReaderTurn("forward");
                        }}
                        disabled={!canTurnScenarioReaderForward}
                        aria-label={t("board.scenario.readerNext")}
                        className="absolute bottom-3 right-3 top-3 z-10 w-[calc(50%_-_12px)] cursor-e-resize bg-transparent disabled:pointer-events-none"
                      />
                    )}
                  </div>
                </article>
              </div>
            ) : null}
          </div>
        </HudPortal>
      ) : null}
    </div>
  );
}

const TRAIT_LABEL_LOCAL: Record<BetrayalTraitKey, string> = {
  might: "力量",
  speed: "速度",
  knowledge: "知识",
  sanity: "神志",
};
const TRAIT_SKULL_LABEL = "死亡";

const DUST_SEARCH_TRAIT_CHOICES: readonly BetrayalTraitKey[] = [
  "knowledge",
  "sanity",
];
const DUST_CURE_TRAIT_CHOICES: readonly BetrayalTraitKey[] = [
  "might",
  "speed",
  "knowledge",
  "sanity",
];

function isDustTraitChoice(
  choices: readonly BetrayalTraitKey[],
  trait: BetrayalTraitKey | null,
): trait is BetrayalTraitKey {
  return Boolean(trait && choices.includes(trait));
}

function resolveHighestTraitChoice(
  traits: Record<BetrayalTraitKey, number>,
  choices: readonly BetrayalTraitKey[],
): BetrayalTraitKey {
  return choices.reduce(
    (bestTrait, trait) =>
      traits[trait] > traits[bestTrait] ? trait : bestTrait,
    choices[0] ?? "knowledge",
  );
}

const TRAIT_TONE_CLASS: Record<
  BetrayalTraitKey,
  { active: string; inactive: string; text: string }
> = {
  might: {
    active: "border-[#cf715f] bg-[#cf715f]",
    inactive: "border-[rgba(207,113,95,0.34)] bg-[rgba(34,19,18,0.68)]",
    text: "text-[#e8b09f]",
  },
  speed: {
    active: "border-[#d6be67] bg-[#d6be67]",
    inactive: "border-[rgba(214,190,103,0.34)] bg-[rgba(35,31,18,0.68)]",
    text: "text-[#ebdca1]",
  },
  knowledge: {
    active: "border-[#8ebac5] bg-[#8ebac5]",
    inactive: "border-[rgba(142,186,197,0.32)] bg-[rgba(17,26,28,0.68)]",
    text: "text-[#cbe4ea]",
  },
  sanity: {
    active: "border-[#9f7bc5] bg-[#9f7bc5]",
    inactive: "border-[rgba(159,123,197,0.32)] bg-[rgba(24,19,31,0.68)]",
    text: "text-[#d9c4ef]",
  },
};

const TRAIT_CHOICE_TONE_CLASS: Record<
  BetrayalTraitKey,
  { selected: string; idle: string }
> = {
  might: {
    selected:
      "border-[#ff947f] bg-[rgba(207,113,95,0.74)] text-[#ffe1d8] shadow-[0_0_24px_rgba(207,113,95,0.34)]",
    idle: "border-[rgba(207,113,95,0.68)] bg-[rgba(54,22,19,0.66)] text-[#ffc6b8] hover:border-[#ff947f] hover:bg-[rgba(207,113,95,0.22)]",
  },
  speed: {
    selected:
      "border-[#f0d97b] bg-[rgba(214,190,103,0.72)] text-[#fff2b8] shadow-[0_0_24px_rgba(214,190,103,0.32)]",
    idle: "border-[rgba(214,190,103,0.68)] bg-[rgba(48,39,16,0.66)] text-[#ffeaa6] hover:border-[#f0d97b] hover:bg-[rgba(214,190,103,0.20)]",
  },
  knowledge: {
    selected:
      "border-[#a9d7e2] bg-[rgba(142,186,197,0.72)] text-[#e2f8ff] shadow-[0_0_24px_rgba(142,186,197,0.30)]",
    idle: "border-[rgba(142,186,197,0.66)] bg-[rgba(18,35,39,0.66)] text-[#dbf4fb] hover:border-[#a9d7e2] hover:bg-[rgba(142,186,197,0.20)]",
  },
  sanity: {
    selected:
      "border-[#c59af0] bg-[rgba(159,123,197,0.76)] text-[#f0dcff] shadow-[0_0_24px_rgba(159,123,197,0.34)]",
    idle: "border-[rgba(159,123,197,0.66)] bg-[rgba(35,22,48,0.66)] text-[#ead4ff] hover:border-[#c59af0] hover:bg-[rgba(159,123,197,0.20)]",
  },
};

const TRAIT_VALUE_TEXT_CLASS: Record<BetrayalTraitKey, string> = {
  might: "text-[#f0b29f]",
  speed: "text-[#f2e09e]",
  knowledge: "text-[#cbe7ee]",
  sanity: "text-[#dcc7f1]",
};

const TRAIT_DAMAGE_TONE: Record<
  BetrayalTraitKey,
  { color: string; glow: string }
> = {
  might: { color: "#ff9f8b", glow: "rgba(255, 112, 86, 0.62)" },
  speed: { color: "#ffe27a", glow: "rgba(255, 210, 82, 0.56)" },
  knowledge: { color: "#a9e6f2", glow: "rgba(116, 202, 224, 0.52)" },
  sanity: { color: "#d2a8ff", glow: "rgba(176, 111, 235, 0.56)" },
};

const TRAIT_DAMAGE_ORDER: BetrayalTraitKey[] = [
  "might",
  "speed",
  "knowledge",
  "sanity",
];

type TraitTrackRailDensity = "panel" | "detail" | "compact";

function resolveExplorerTraitTrack(
  explorer: BetrayalExplorerSummary,
  trait: BetrayalTraitKey,
): BetrayalTraitTrackState {
  const track = explorer.traitTracks?.[trait];
  if (track && Array.isArray(track.values) && track.values.length > 0) {
    return track;
  }
  const value = explorer.traits[trait] ?? 0;
  return {
    trackId: `${explorer.explorerId}-${trait}-fallback`,
    values: [value],
    position: 0,
    startPosition: 0,
    criticalPosition: 0,
    skullPosition: -1,
    maxPosition: 0,
  };
}

function clampTraitTrackPosition(track: BetrayalTraitTrackState): number {
  return Math.max(
    track.skullPosition,
    Math.min(track.maxPosition, track.position),
  );
}

function resolveTraitTrackValueAtPosition(
  track: BetrayalTraitTrackState,
  position: number,
): number {
  if (position <= track.skullPosition) {
    return 0;
  }
  const clampedPosition = Math.max(
    track.criticalPosition,
    Math.min(track.maxPosition, position),
  );
  return (
    track.values[clampedPosition] ??
    track.values[track.criticalPosition] ??
    0
  );
}

function resolveTraitTrackSlots(track: BetrayalTraitTrackState): number[] {
  const valuePositions = track.values.map((_, index) => index);
  return track.skullPosition < 0
    ? [track.skullPosition, ...valuePositions]
    : valuePositions;
}

function resolveTraitDamageFloorPosition(
  track: BetrayalTraitTrackState,
  phase: BetrayalCore["phase"],
): number {
  return phase === "haunt" ? track.skullPosition : track.criticalPosition;
}

function resolveTraitDamageAssignableSteps(
  explorer: BetrayalExplorerSummary,
  trait: BetrayalTraitKey,
  phase: BetrayalCore["phase"],
): number {
  const track = resolveExplorerTraitTrack(explorer, trait);
  const currentPosition = clampTraitTrackPosition(track);
  const floorPosition = resolveTraitDamageFloorPosition(track, phase);
  return Math.max(0, currentPosition - floorPosition);
}

function pruneSelectedDamageTraits(
  selectedTraits: BetrayalTraitKey[],
  allowedTraits: BetrayalTraitKey[],
  amount: number,
  explorer: BetrayalExplorerSummary,
  phase: BetrayalCore["phase"],
): BetrayalTraitKey[] {
  const allowed = new Set(allowedTraits);
  const counts = new Map<BetrayalTraitKey, number>();
  const pruned: BetrayalTraitKey[] = [];
  for (const trait of selectedTraits) {
    if (!allowed.has(trait) || pruned.length >= amount) {
      continue;
    }
    const currentCount = counts.get(trait) ?? 0;
    const maxCount = Math.min(
      amount,
      resolveTraitDamageAssignableSteps(explorer, trait, phase),
    );
    if (currentCount >= maxCount) {
      continue;
    }
    pruned.push(trait);
    counts.set(trait, currentCount + 1);
  }
  return pruned;
}

function countSelectedDamageTrait(
  selectedTraits: BetrayalTraitKey[],
  trait: BetrayalTraitKey,
): number {
  return selectedTraits.filter((selectedTrait) => selectedTrait === trait)
    .length;
}

function resolveTrackPositionPercent(slots: number[], position: number): number {
  if (slots.length <= 1) {
    return 50;
  }
  const slotIndex = slots.indexOf(position);
  const safeIndex =
    slotIndex >= 0
      ? slotIndex
      : slots.findIndex((candidate) => candidate >= position);
  const clampedIndex =
    safeIndex >= 0 ? safeIndex : position < slots[0]! ? 0 : slots.length - 1;
  return (clampedIndex / (slots.length - 1)) * 100;
}

function ExplorerTraitTrackRail({
  explorer,
  trait,
  locale,
  density = "panel",
  testIdPrefix = "betrayal-trait-track",
}: {
  explorer: BetrayalExplorerSummary;
  trait: BetrayalTraitKey;
  locale: string;
  density?: TraitTrackRailDensity;
  testIdPrefix?: string;
}) {
  const track = resolveExplorerTraitTrack(explorer, trait);
  const currentPosition = clampTraitTrackPosition(track);
  const slots = resolveTraitTrackSlots(track);
  const currentValue = explorer.traits[trait] ?? 0;
  const isCompact = density === "compact";
  const isDetail = density === "detail";
  const currentSlotIndex = Math.max(0, slots.indexOf(currentPosition));
  const railHeightClass = isCompact
    ? "h-[30px]"
    : isDetail
      ? "h-[44px]"
      : "h-[38px]";
  const trackBodyClass = isCompact
    ? "h-[22px]"
    : isDetail
      ? "h-[32px]"
      : "h-[28px]";
  const slotLabelClass = isCompact
    ? "relative z-10 flex h-full w-full items-center justify-center text-[9px] leading-none tabular-nums"
    : isDetail
      ? "relative z-10 flex h-full w-full items-center justify-center text-[13px] leading-none tabular-nums"
      : "relative z-10 flex h-full w-full items-center justify-center text-[12px] leading-none tabular-nums";

  return (
    <div
      data-testid={`${testIdPrefix}-${trait}`}
      data-player-id={explorer.playerId}
      data-explorer-id={explorer.explorerId}
      data-trait={trait}
      data-trait-track-id={track.trackId}
      data-trait-track-position={currentPosition}
      data-trait-track-start-position={track.startPosition}
      data-trait-track-critical-position={track.criticalPosition}
      data-trait-track-skull-position={track.skullPosition}
      data-trait-track-value={currentValue}
      className={`grid items-center gap-1.5 ${
        isCompact
          ? "grid-cols-[42px_minmax(0,1fr)] text-[9px]"
          : isDetail
            ? "grid-cols-[74px_minmax(0,1fr)] text-[12px]"
            : "grid-cols-[66px_minmax(0,1fr)] text-[12px]"
      }`}
    >
      <span
        className={`inline-flex min-w-0 items-center gap-1.5 font-semibold ${TRAIT_TONE_CLASS[trait].text}`}
      >
        {!isCompact ? (
          <OptimizedImage
            src={ASSETS.trait[trait]}
            locale={locale}
            alt=""
            className={`${isDetail ? "h-[18px] w-[18px]" : "h-4 w-4"} object-contain opacity-86`}
            draggable={false}
          />
        ) : null}
        <span className="truncate">{TRAIT_LABEL_LOCAL[trait]}</span>
      </span>
      <div
        data-trait-track-rail="true"
        data-trait-track-rail-shape="continuous-segmented"
        data-trait-track-repeat-value-policy="separate-physical-slots"
        data-trait-track-current-index={currentSlotIndex}
        className={`relative ${railHeightClass} min-w-0`}
        title={`${TRAIT_LABEL_LOCAL[trait]}属性轨：骷髅为死亡端点，当前指针在第 ${currentPosition} 位，数值 ${currentValue}`}
        aria-label={`${TRAIT_LABEL_LOCAL[trait]}属性轨，骷髅为死亡端点，当前指针在第 ${currentPosition} 位，数值 ${currentValue}`}
      >
        <div
          data-trait-track-segmented-rail="true"
          data-trait-track-visual-separation="continuous-rail-internal-dividers"
          className={`absolute inset-x-0 top-1/2 grid ${trackBodyClass} -translate-y-1/2 gap-0 overflow-hidden rounded-[7px] border border-[rgba(181,128,70,0.62)] bg-[linear-gradient(180deg,rgba(47,31,20,0.96)_0%,rgba(25,21,15,0.94)_50%,rgba(18,15,12,0.96)_100%)] p-[2px] shadow-[inset_0_0_0_1px_rgba(255,224,159,0.16),inset_0_0_12px_rgba(0,0,0,0.44),0_3px_10px_rgba(0,0,0,0.24)]`}
          style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
        >
          {slots.map((position, slotIndex) => {
            const isSkull = position === track.skullPosition;
            const isCurrent = position === currentPosition;
            const isStart = position === track.startPosition;
            const isCritical = position === track.criticalPosition;
            const hasInternalDivider = slotIndex > 0;
            const slotValue = isSkull ? null : track.values[position];
            return (
              <span
                key={`${trait}-${position}`}
                data-trait-track-slot="true"
                data-trait-track-position={position}
                data-trait-track-current={isCurrent ? "true" : "false"}
                data-trait-track-pointer={isCurrent ? "true" : undefined}
                data-trait-track-pointer-shape={isCurrent ? "material-slot-highlight" : undefined}
                data-trait-track-start={isStart ? "true" : "false"}
                data-trait-track-start-indicator={
                  isStart ? "in-slot-green-band" : undefined
                }
                data-trait-track-critical={isCritical ? "true" : "false"}
                data-trait-track-skull={isSkull ? "true" : "false"}
                data-trait-track-death={isSkull ? "true" : "false"}
                data-trait-track-slot-boundary={
                  hasInternalDivider ? "internal-divider" : "rail-start"
                }
                data-trait-track-value={isSkull ? undefined : slotValue}
                data-trait-track-color={
                  isCurrent
                    ? "current-green"
                    : isSkull
                      ? "death-red"
                      : isCritical
                        ? "critical-red"
                        : isStart
                          ? "start-green"
                          : "neutral"
                }
                title={`${TRAIT_LABEL_LOCAL[trait]} ${isSkull ? "死亡格（不是数值）" : slotValue}${isStart ? "，初始格" : ""}${isCurrent ? "，当前位置" : ""}`}
                aria-label={`${TRAIT_LABEL_LOCAL[trait]} ${isSkull ? "死亡格，不是数值" : slotValue}${isStart ? "，初始格" : ""}${isCurrent ? "，当前位置" : ""}`}
                className={`relative grid min-w-0 place-items-center border-0 text-center font-semibold leading-none ${
                  isCurrent
                    ? "bg-[linear-gradient(180deg,rgba(111,169,72,0.82)_0%,rgba(70,129,57,0.78)_52%,rgba(47,97,42,0.78)_100%)] text-[#f7ffd8] shadow-[inset_0_0_0_1px_rgba(231,255,172,0.30),inset_0_0_11px_rgba(236,255,177,0.18),0_0_13px_rgba(155,214,103,0.34)]"
                    : isSkull
                      ? "bg-[linear-gradient(180deg,rgba(86,26,21,0.58)_0%,rgba(53,18,15,0.46)_100%)] text-[#ffd0c6]"
                      : isCritical
                        ? "bg-[linear-gradient(180deg,rgba(97,41,33,0.34)_0%,rgba(55,22,18,0.26)_100%)] text-[#ffd7cd]"
                        : isStart
                          ? "bg-transparent text-[#e8ffd2]"
                          : "bg-transparent text-[rgba(238,220,176,0.84)]"
                } ${
                  hasInternalDivider
                    ? "before:pointer-events-none before:absolute before:bottom-[2px] before:left-0 before:top-[2px] before:z-20 before:w-px before:bg-[rgba(255,230,178,0.46)] before:shadow-[1px_0_0_rgba(0,0,0,0.30)] before:content-['']"
                    : ""
                } ${
                  isStart
                    ? "after:pointer-events-none after:absolute after:inset-x-[5px] after:bottom-[3px] after:z-10 after:h-[3px] after:rounded-full after:bg-[rgba(199,255,150,0.74)] after:shadow-[0_0_8px_rgba(199,255,150,0.48)] after:content-['']"
                    : ""
                }`}
              >
                {isSkull ? (
                  <>
                    <Skull
                      className={`${isCompact ? "h-3 w-3" : "h-4 w-4"} ${
                        isCurrent ? "text-[#fff0bf]" : "text-[#ffd0c6]"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="sr-only">{TRAIT_SKULL_LABEL}</span>
                  </>
                ) : (
                  <span
                    data-trait-track-slot-label="true"
                    data-trait-track-slot-label-align="center"
                    className={slotLabelClass}
                  >
                    {slotValue}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type TraitOutcomePreviewMode = "damage" | "heal";

function ExplorerTraitOutcomePreview({
  explorer,
  trait,
  mode,
  phase,
  stepCount,
  locale,
  t,
  testIdPrefix,
}: {
  explorer: BetrayalExplorerSummary;
  trait: BetrayalTraitKey;
  mode: TraitOutcomePreviewMode;
  phase: BetrayalCore["phase"];
  stepCount: number;
  locale: string;
  t: ReturnType<typeof useTranslation>["t"];
  testIdPrefix: string;
}) {
  const track = resolveExplorerTraitTrack(explorer, trait);
  const currentPosition = clampTraitTrackPosition(track);
  const floorPosition = resolveTraitDamageFloorPosition(track, phase);
  const targetPosition =
    mode === "heal"
      ? currentPosition < track.startPosition
        ? Math.min(track.startPosition, track.maxPosition)
        : currentPosition
      : Math.max(floorPosition, currentPosition - Math.max(0, stepCount));
  const actualSteps = Math.abs(targetPosition - currentPosition);
  const currentValue = resolveTraitTrackValueAtPosition(track, currentPosition);
  const targetValue = resolveTraitTrackValueAtPosition(track, targetPosition);
  const slots = resolveTraitTrackSlots(track);
  const currentPercent = resolveTrackPositionPercent(slots, currentPosition);
  const targetPercent = resolveTrackPositionPercent(slots, targetPosition);
  const isLockedForDamage = mode === "damage" && actualSteps === 0;
  const outcomeLabel =
    mode === "heal"
      ? actualSteps > 0
        ? t("board.traitPreview.healToStart")
        : t("board.traitPreview.noChange")
      : actualSteps > 0
        ? t("board.traitPreview.damageSteps", { count: actualSteps })
        : t("board.traitPreview.locked");
  const valueFlowLabel = t("board.traitPreview.valueFlow", {
    from: currentValue,
    to: targetValue,
  });

  return (
    <div
      data-testid={`${testIdPrefix}-${trait}`}
      data-trait-preview-mode={mode}
      data-trait-preview-current-position={currentPosition}
      data-trait-preview-target-position={targetPosition}
      data-trait-preview-step-count={actualSteps}
      data-trait-preview-current-value={currentValue}
      data-trait-preview-target-value={targetValue}
      data-trait-preview-locked={isLockedForDamage ? "true" : "false"}
      className={`grid gap-1.5 rounded-[8px] border px-2.5 py-2 ${
        isLockedForDamage
          ? "border-[rgba(115,54,47,0.56)] bg-[rgba(48,19,18,0.48)]"
          : "border-[rgba(211,179,109,0.28)] bg-[rgba(13,16,13,0.46)]"
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold ${TRAIT_TONE_CLASS[trait].text}`}>
          <OptimizedImage
            src={ASSETS.trait[trait]}
            locale={locale}
            alt=""
            className="h-3.5 w-3.5 object-contain opacity-86"
            draggable={false}
          />
          <span className="truncate">{TRAIT_LABEL_LOCAL[trait]}</span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-[#e8d59b]">
          {outcomeLabel}
        </span>
      </div>
      <div
        data-trait-preview-rail="true"
        className="relative h-[38px] min-w-0"
        title={`${TRAIT_LABEL_LOCAL[trait]}预览：从第 ${currentPosition} 位到第 ${targetPosition} 位，骷髅为死亡端点`}
        aria-label={`${TRAIT_LABEL_LOCAL[trait]}预览，从第 ${currentPosition} 位到第 ${targetPosition} 位，骷髅为死亡端点`}
      >
        <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full border border-[rgba(214,191,129,0.20)] bg-[linear-gradient(90deg,rgba(89,30,29,0.78),rgba(77,68,39,0.84),rgba(22,32,24,0.92))] shadow-[inset_0_0_8px_rgba(0,0,0,0.42)]" />
        <span
          data-trait-preview-pointer="current"
          data-trait-preview-position={currentPosition}
          data-trait-preview-current="true"
          className="pointer-events-none absolute top-1/2 z-20 flex h-[24px] w-[16px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center"
          style={{ left: `${currentPercent}%` }}
          title={`当前：${currentValue}`}
          aria-label={`当前${TRAIT_LABEL_LOCAL[trait]} ${currentValue}`}
        >
          <span className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[9px] border-l-transparent border-r-transparent border-t-[#f2cf82] drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]" />
          <span className="-mt-[1px] h-[10px] w-[4px] rounded-full bg-[#f2cf82] shadow-[0_0_10px_rgba(242,207,130,0.64)]" />
        </span>
        {targetPosition !== currentPosition ? (
          <span
            data-trait-preview-pointer="target"
            data-trait-preview-position={targetPosition}
            data-trait-preview-target="true"
            className="pointer-events-none absolute top-1/2 z-20 flex h-[24px] w-[16px] -translate-x-1/2 translate-y-[2px] flex-col items-center justify-center"
            style={{ left: `${targetPercent}%` }}
            title={`目标：${targetValue}`}
            aria-label={`目标${TRAIT_LABEL_LOCAL[trait]} ${targetValue}`}
          >
            <span className="h-[10px] w-[4px] rounded-full bg-[#c85f50] shadow-[0_0_10px_rgba(200,95,80,0.54)]" />
            <span className="-mt-[1px] h-0 w-0 border-b-[9px] border-l-[6px] border-r-[6px] border-b-[#c85f50] border-l-transparent border-r-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]" />
          </span>
        ) : null}
        {slots.map((position) => {
          const isSkull = position === track.skullPosition;
          const isCurrent = position === currentPosition;
          const isTarget = position === targetPosition;
          const slotValue = isSkull
            ? null
            : resolveTraitTrackValueAtPosition(track, position);
          return (
            <span
              key={`${trait}-preview-${position}`}
              data-trait-preview-slot="true"
              data-trait-preview-position={position}
              data-trait-preview-current="false"
              data-trait-preview-target="false"
              data-trait-preview-skull={isSkull ? "true" : "false"}
              title={`${TRAIT_LABEL_LOCAL[trait]} ${isSkull ? "死亡格（不是数值）" : slotValue}`}
              aria-label={`${TRAIT_LABEL_LOCAL[trait]} ${isSkull ? "死亡格，不是数值" : slotValue}`}
              className="absolute top-1/2 z-10 flex min-w-[14px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center text-[9px] font-semibold leading-none"
              style={{ left: `${resolveTrackPositionPercent(slots, position)}%` }}
            >
              {isSkull ? (
                <>
                  <span className={`grid h-[16px] w-[16px] place-items-center rounded-full border border-[#9a4038] bg-[rgba(91,31,28,0.88)] text-[#ffd0c6] ${isTarget || isCurrent ? "shadow-[0_0_10px_rgba(207,72,62,0.42)]" : ""}`}>
                    <Skull className="h-3 w-3" />
                  </span>
                  <span className="sr-only">{TRAIT_SKULL_LABEL}</span>
                </>
              ) : (
                <>
                  <span
                    data-trait-preview-tick="true"
                    className={`block ${position === track.criticalPosition ? "h-[13px] bg-[#c05b4d]" : "h-[9px] bg-[rgba(214,191,129,0.62)]"} w-px rounded-full`}
                  />
                  <span
                    className={`absolute top-[24px] ${
                      isTarget
                        ? "text-[#f0d27f]"
                        : isCurrent
                          ? TRAIT_VALUE_TEXT_CLASS[trait]
                          : position === track.criticalPosition
                            ? "text-[#d88f82]"
                            : "text-[rgba(232,216,174,0.72)]"
                    }`}
                  >
                    {slotValue}
                  </span>
                </>
              )}
            </span>
          );
        })}
      </div>
      <div className="text-[10px] font-semibold text-[#cbb37d]">
        {valueFlowLabel}
      </div>
    </div>
  );
}

const BETRAYAL_ATTACK_IMPACT_FLASH_RESET_MS = 2200;
const BETRAYAL_ATTACK_IMPACT_SLASH_DURATION_MS = 1100;
const BETRAYAL_ATTACK_IMPACT_SLASH_ACTIVE_MS = 1150;
const BETRAYAL_ATTACK_IMPACT_PULSE_DURATION_MS = 1200;
const BETRAYAL_ATTACK_IMPACT_COMPLETE_MS = 1800;
const BETRAYAL_ATTACK_IMPACT_SLASH_COLOR = "rgba(255, 95, 72, 0.96)";
const BETRAYAL_ATTACK_IMPACT_PULSE_COLOR = "rgba(220, 38, 38, 0.9)";

type BetrayalAttackImpactTraitLoss = {
  trait: BetrayalTraitKey;
  amount: number;
};

type BetrayalAttackImpactState = {
  playerId: string;
  damageKind: "physical" | "mental";
  role: "attacker" | "defender";
  damageAmount: number;
  losses: BetrayalAttackImpactTraitLoss[];
};

function resolveAttackImpactTraitLosses(
  before: Record<BetrayalTraitKey, number> | undefined,
  after: Record<BetrayalTraitKey, number> | undefined,
  ignoredLosses: Partial<Record<BetrayalTraitKey, number>> = {},
): BetrayalAttackImpactTraitLoss[] {
  if (!before || !after) {
    return [];
  }
  return TRAIT_DAMAGE_ORDER.map((trait) => ({
    trait,
    amount: Math.max(
      0,
      (before[trait] ?? 0) - (after[trait] ?? 0) - (ignoredLosses[trait] ?? 0),
    ),
  })).filter((entry) => entry.amount > 0);
}

function buildAttackImpactState(options: {
  playerId: string | undefined;
  role: BetrayalAttackImpactState["role"];
  damageKind: BetrayalAttackImpactState["damageKind"];
  damageAmount: number;
  traitsBeforeDamage: Record<BetrayalTraitKey, number> | undefined;
  traitsAfterDamage: Record<BetrayalTraitKey, number> | undefined;
  ignoredLosses?: Partial<Record<BetrayalTraitKey, number>>;
}): BetrayalAttackImpactState | null {
  if (!options.playerId) {
    return null;
  }
  const losses = resolveAttackImpactTraitLosses(
    options.traitsBeforeDamage,
    options.traitsAfterDamage,
    options.ignoredLosses,
  );
  if (options.damageAmount <= 0 && losses.length === 0) {
    return null;
  }
  return {
    playerId: options.playerId,
    role: options.role,
    damageKind: options.damageKind,
    damageAmount: options.damageAmount,
    losses,
  };
}

function resolveAttackImpactByPlayerId(
  core: BetrayalCore,
  explorers: BetrayalExplorerSummary[],
): Map<string, BetrayalAttackImpactState> {
  const impactByPlayerId = new Map<string, BetrayalAttackImpactState>();
  const recentRoll = core.recentRoll;
  if (recentRoll?.kind !== "attackRoll" || !recentRoll.attack) {
    return impactByPlayerId;
  }

  const { attack } = recentRoll;
  const defender = attack.defenderPlayerId
    ? explorers.find(
        (explorer) => explorer.playerId === attack.defenderPlayerId,
      )
    : null;
  const defenderImpact = buildAttackImpactState({
    playerId: defender?.playerId,
    role: "defender",
    damageKind: attack.damageKind,
    damageAmount: attack.previousDamageToDefender,
    traitsBeforeDamage: attack.defenderTraitsBeforeDamage,
    traitsAfterDamage: defender?.traits,
  });
  if (defenderImpact) {
    impactByPlayerId.set(defenderImpact.playerId, defenderImpact);
  }

  const attacker = explorers.find(
    (explorer) => explorer.playerId === recentRoll.playerId,
  );
  const attackerImpact = buildAttackImpactState({
    playerId: attacker?.playerId,
    role: "attacker",
    damageKind: attack.damageKind,
    damageAmount: attack.previousDamageToAttacker,
    traitsBeforeDamage: attack.attackerTraitsBeforeDamage,
    traitsAfterDamage: attacker?.traits,
    ignoredLosses: { speed: attack.weaponSpeedCost ?? 0 },
  });
  if (attackerImpact) {
    impactByPlayerId.set(attackerImpact.playerId, attackerImpact);
  }

  return impactByPlayerId;
}

function BetrayalAttackImpactSurface({
  impact,
  presentationKey,
  surface,
  traitLabel,
  children,
  density = "token",
}: {
  impact: BetrayalAttackImpactState;
  presentationKey: string;
  surface: string;
  traitLabel: (trait: BetrayalTraitKey) => string;
  children: React.ReactNode;
  density?: "token" | "panel";
}) {
  const impactFeedback = useImpactFeedback(undefined, {
    flashResetDelay: BETRAYAL_ATTACK_IMPACT_FLASH_RESET_MS,
  });
  const { trigger, shake, hitStop, flash } = impactFeedback;
  const primaryTrait =
    impact.losses[0]?.trait ??
    (impact.damageKind === "mental" ? "sanity" : "might");
  const primaryTone = TRAIT_DAMAGE_TONE[primaryTrait];
  const damageAmount = Math.max(
    1,
    impact.damageAmount,
    impact.losses.reduce((sum, entry) => sum + entry.amount, 0),
  );
  const testId = `betrayal-attack-impact-${surface}-${impact.playerId}`;
  const lossLabels =
    impact.losses.length > 0
      ? impact.losses
      : [{ trait: primaryTrait, amount: damageAmount }];

  React.useEffect(() => {
    trigger(damageAmount);
  }, [damageAmount, presentationKey, trigger]);

  return (
    <div
      key={presentationKey}
      data-testid={testId}
      data-attack-impact-active="true"
      data-attack-impact-role={impact.role}
      data-attack-impact-kind={impact.damageKind}
      data-attack-impact-traits={impact.losses
        .map((entry) => entry.trait)
        .join(",")}
      data-density={density}
      className="betrayal-attack-impact-surface"
      style={
        {
          "--betrayal-impact-color": primaryTone.color,
          "--betrayal-impact-glow": primaryTone.glow,
        } as React.CSSProperties
      }
    >
      <ShakeContainer
        isShaking={shake.isShaking}
        className="betrayal-attack-impact-shake"
      >
        <HitStopContainer
          isActive={hitStop.isActive}
          {...(hitStop.config ?? {})}
          className="betrayal-attack-impact-target"
        >
          {children}
        </HitStopContainer>
      </ShakeContainer>
      <span
        data-testid={`betrayal-attack-impact-flash-${surface}-${impact.playerId}`}
        data-attack-impact-flash="true"
        className="betrayal-attack-impact-flash"
      >
        <span
          data-testid={`betrayal-attack-impact-slash-${surface}-${impact.playerId}`}
          data-attack-impact-slash="true"
          className="betrayal-attack-impact-slash"
        >
          <DamageFlash
            active={flash.isActive}
            damage={damageAmount}
            intensity={damageAmount >= 3 ? "strong" : "normal"}
            showNumber={false}
            slashColor={BETRAYAL_ATTACK_IMPACT_SLASH_COLOR}
            pulseColor={BETRAYAL_ATTACK_IMPACT_PULSE_COLOR}
            slashDurationMs={BETRAYAL_ATTACK_IMPACT_SLASH_DURATION_MS}
            slashActiveMs={BETRAYAL_ATTACK_IMPACT_SLASH_ACTIVE_MS}
            pulseDurationMs={BETRAYAL_ATTACK_IMPACT_PULSE_DURATION_MS}
            pulseActiveMs={BETRAYAL_ATTACK_IMPACT_PULSE_DURATION_MS}
            completeMs={BETRAYAL_ATTACK_IMPACT_COMPLETE_MS}
          />
        </span>
      </span>
      <span
        data-testid={`betrayal-attack-impact-floating-${surface}-${impact.playerId}`}
        className="betrayal-attack-impact-floating"
      >
        {lossLabels.map((entry, index) => {
          const tone = TRAIT_DAMAGE_TONE[entry.trait];
          return (
            <span
              key={`${entry.trait}-${index}`}
              data-testid={`betrayal-attack-impact-floating-${surface}-${impact.playerId}-${entry.trait}`}
              data-attack-impact-trait={entry.trait}
              style={{
                color: tone.color,
                textShadow: `0 0 10px ${tone.glow}, 0 2px 4px rgba(0,0,0,0.86)`,
              }}
            >
              -{entry.amount} {traitLabel(entry.trait)}
            </span>
          );
        })}
      </span>
    </div>
  );
}

function BetrayalHauntRevealCue({
  revealProtocol,
  scenarioRuntime,
  isPhoneLandscapeLayout,
  onDismiss,
}: {
  revealProtocol: BetrayalHauntRevealProtocol;
  scenarioRuntime: BetrayalCore["scenarioRuntime"];
  isPhoneLandscapeLayout: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const hasHauntSource = Boolean(
    scenarioRuntime.hauntScenarioCardTitle &&
      scenarioRuntime.triggeringOmenName &&
      scenarioRuntime.hauntCardNumber,
  );

  return (
    <div
      data-testid="betrayal-haunt-reveal-cue"
      data-haunt-reveal-active="true"
      data-haunt-type={revealProtocol.hauntType}
      data-haunt-public-step-count={revealProtocol.publicSteps.length}
      data-haunt-setup-count={revealProtocol.setupQueue.length}
      className={`betrayal-haunt-reveal-cue pointer-events-none absolute left-1/2 -translate-x-1/2 ${
        isPhoneLandscapeLayout ? "top-2" : "top-[88px]"
      }`}
      style={{ zIndex: UI_Z_INDEX.overlayRaised + 4 }}
    >
      <div className="relative flex min-h-[44px] w-[min(760px,calc(100vw-2rem))] items-center justify-between gap-3 overflow-hidden rounded-[999px] border border-[rgba(255,207,137,0.34)] bg-[rgba(32,14,12,0.88)] px-4 py-2 text-left shadow-[0_14px_34px_rgba(0,0,0,0.34),0_0_24px_rgba(181,63,44,0.16)] backdrop-blur-[8px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,rgba(255,191,128,0),rgba(255,191,128,0.95),rgba(255,191,128,0))]" />
        <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            data-testid="betrayal-haunt-reveal-player-title"
            className="text-[14px] font-black tracking-[0.06em] text-[#fff1ca] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          >
            {t("board.status.hauntRevealPlayerTitle")}
          </span>
          <span
            data-testid="betrayal-haunt-reveal-lead"
            className="min-w-0 text-[13px] font-semibold tracking-[0.02em] text-[#ffe6bd]"
          >
            {t("board.status.hauntRevealLead")}
          </span>
          {hasHauntSource ? (
            <span
              data-testid="betrayal-haunt-reveal-source"
              data-haunt-scenario-card-id={scenarioRuntime.hauntScenarioCardId ?? undefined}
              data-haunt-triggering-omen-id={scenarioRuntime.triggeringOmenId ?? undefined}
              className="min-w-0 text-[11px] font-black tracking-[0.05em] text-[#ffd78e]"
            >
              {t("board.status.hauntRevealSource", {
                scenarioCard: scenarioRuntime.hauntScenarioCardTitle,
                omen: scenarioRuntime.triggeringOmenName,
                number: scenarioRuntime.hauntCardNumber,
              })}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          data-testid="betrayal-haunt-reveal-close"
          className="pointer-events-auto relative inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-full border border-[rgba(255,207,137,0.28)] bg-[rgba(255,238,201,0.08)] px-3 text-[12px] font-black tracking-[0.08em] text-[#ffe6b9] transition hover:bg-[rgba(255,207,137,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe3a3]"
          onClick={onDismiss}
        >
          {t("board.status.hauntRevealDismiss")}
        </button>
      </div>
    </div>
  );
}

function CinematicNarrationPanel({
  label,
  title,
  text,
  variant,
  compact = false,
  presentation = "panel",
  actionSlot,
  testId,
  className = "",
}: {
  label: string;
  title?: string;
  text: string;
  variant: "opening" | "ending-survivors" | "ending-traitor" | "ending-haunt";
  compact?: boolean;
  presentation?: "panel" | "stage";
  actionSlot?: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  const { t } = useTranslation("game-betrayal");
  const lines = splitCinematicNarrationText(text);
  const isStage = presentation === "stage";

  return (
    <div
      data-testid={testId}
      data-cinematic-narration={variant}
      data-cinematic-stage={isStage ? "standalone" : undefined}
      className={`betrayal-cinematic-narration relative flex min-h-full overflow-hidden text-[#f5e6c7] ${
        isStage
          ? "border-y border-[rgba(242,207,130,0.30)] bg-[rgba(0,0,0,0.42)] shadow-[0_24px_90px_rgba(0,0,0,0.44)]"
          : "border border-[rgba(222,184,92,0.44)] bg-[#030506] shadow-[0_18px_46px_rgba(0,0,0,0.42),inset_0_0_0_1px_rgba(255,224,143,0.08)]"
      } ${
        compact ? "px-3 py-4" : "px-8 py-8"
      } ${className}`}
    >
      {!isStage ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(126,95,48,0.28),rgba(10,12,10,0.42)_36%,rgba(0,0,0,0.94)_76%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:repeating-linear-gradient(90deg,rgba(255,240,182,0.12)_0_1px,transparent_1px_7px),repeating-linear-gradient(0deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_11px)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[18%] bg-[linear-gradient(180deg,rgba(0,0,0,0.98),rgba(0,0,0,0.64),transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%] bg-[linear-gradient(0deg,rgba(0,0,0,0.98),rgba(0,0,0,0.72),transparent)]" />
          <div className="pointer-events-none absolute inset-x-[8%] top-[14%] h-px bg-[linear-gradient(90deg,transparent,rgba(242,207,130,0.52),transparent)]" />
          <div className="pointer-events-none absolute inset-x-[12%] bottom-[16%] h-px bg-[linear-gradient(90deg,transparent,rgba(242,207,130,0.36),transparent)]" />
          <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t border-[rgba(242,207,130,0.52)]" />
          <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r border-t border-[rgba(242,207,130,0.52)]" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b border-l border-[rgba(242,207,130,0.42)]" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b border-r border-[rgba(242,207,130,0.42)]" />
        </>
      ) : null}

      <div className="relative z-10 flex min-h-full w-full flex-col justify-between text-center">
        <div>
          <div
            className={`font-black uppercase text-[#d8b15b] drop-shadow-[0_0_12px_rgba(228,173,76,0.32)] ${
              compact
                ? "text-[12px] tracking-[0.16em]"
                : "text-[12px] tracking-[0.22em]"
            }`}
          >
            {label}
          </div>
          {title ? (
            <div
              className={`mt-3 font-black text-[#fff0b8] drop-shadow-[0_0_18px_rgba(228,173,76,0.28)] ${
                compact
                  ? "text-[18px] tracking-[0.08em]"
                  : "text-[30px] tracking-[0.12em]"
              }`}
            >
              {title}
            </div>
          ) : null}
        </div>

        <div
          className={`mx-auto flex min-h-0 max-w-[680px] flex-1 flex-col justify-center ${
            compact ? "gap-2 py-3" : "gap-4 py-8"
          }`}
        >
          {lines.map((line, index) => (
            <p
              key={`${line}-${index}`}
              className={`betrayal-cinematic-narration__line mx-auto text-balance font-semibold text-[#fff2cd] shadow-black [text-shadow:0_2px_6px_rgba(0,0,0,0.92),0_0_18px_rgba(240,197,104,0.18)] ${
                compact
                  ? "max-w-[92%] text-[14px] leading-[1.55]"
                  : "max-w-[92%] text-[21px] leading-[1.75]"
              }`}
              style={{ animationDelay: `${120 + index * 130}ms` }}
            >
              {line}
            </p>
          ))}
        </div>

        <div
          className={`relative z-10 flex flex-col items-center ${
            compact ? "gap-2 pb-1" : "gap-3 pb-2"
          }`}
        >
          <div
            aria-hidden="true"
            data-testid="betrayal-cinematic-terminal-mark"
            className={`font-black uppercase text-[#8f7140] ${
              compact
                ? "text-[12px] tracking-[0.12em]"
                : "text-[12px] tracking-[0.16em]"
            }`}
          >
            {t(
              variant.startsWith("ending")
                ? "board.scenario.cinematicTerminalEnd"
                : "board.scenario.cinematicTerminalPrologue",
            )}
          </div>
          {actionSlot ? (
            <div
              data-testid="betrayal-cinematic-action-slot"
              className="pointer-events-auto flex w-full justify-center px-2"
            >
              {actionSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function resolveRecentRollTotal(roll: BetrayalRecentRollState): number {
  return roll.dice.reduce((sum, pip) => sum + pip, 0) + roll.passiveBonus;
}

const BETRAYAL_HOUSE_DICE_STYLE_PROFILE = {
  id: "betrayal-house-dice",
  surface: "transparent-virtual",
  colorset: "white",
  texture: "",
  material: "plastic",
  soundMaterial: "plastic",
  colorSpotlight: 0xf4df9a,
  shadows: true,
  gravityMultiplier: 540,
  lightIntensity: 1.08,
  baseScale: 64,
  cameraZoom: 0.9,
  strength: 0.58,
  iterationLimit: 900,
  customColorset: {
    name: "betrayal-house-aged-bone",
    foreground: "#2b2418",
    ["background"]: ["#fff0bd", "#ead18a", "#d2a95a", "#fff6d4"],
    outline: "#fff1c2",
    texture: "none",
    material: "plastic",
  },
} satisfies DiceBoxStyleProfile;

const BETRAYAL_HOUSE_DICE_MOBILE_STYLE_PROFILE = {
  ...BETRAYAL_HOUSE_DICE_STYLE_PROFILE,
  id: "betrayal-house-dice-mobile-landscape",
  cameraZoom: 1.2,
} satisfies DiceBoxStyleProfile;

const BETRAYAL_HOUSE_DICE_FACE_SYSTEM = "betrayal-house-0-1-2-per-die-skin";

const BETRAYAL_HOUSE_RULE_VALUE_TO_D6_FACE: Record<0 | 1 | 2, number> = {
  0: 1,
  1: 3,
  2: 5,
};

const BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE: Record<number, 0 | 1 | 2> = {
  1: 0,
  2: 0,
  3: 1,
  4: 1,
  5: 2,
  6: 2,
};

const resolveBetrayalHouseD6Face = (pip: number): number => {
  if (pip === 0 || pip === 1 || pip === 2) {
    return BETRAYAL_HOUSE_RULE_VALUE_TO_D6_FACE[pip];
  }
  return Math.max(1, Math.min(6, pip));
};

type RecentRollRerollSelection = {
  promptLabel: string;
  allowedDieIndices?: readonly number[];
  getDieActionLabel: (dieIndex: number) => string;
  onSelectDie: (dieIndex: number) => void;
};

const BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE = 1024;
const betrayalHouseDieFaceCanvasCache: Partial<
  Record<0 | 1 | 2, HTMLCanvasElement>
> = {};
let betrayalHouseDieEdgeCanvasCache: HTMLCanvasElement | null = null;

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function paintBetrayalHouseDieFaceBase(
  ctx: CanvasRenderingContext2D,
  options: { edgeOnly?: boolean } = {},
): void {
  const size = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  const radius = size * 0.14;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  roundedRectPath(ctx, 0, 0, size, size, radius);
  ctx.clip();

  const gradient = ctx.createRadialGradient(
    size * 0.38,
    size * 0.27,
    size * 0.06,
    size * 0.5,
    size * 0.52,
    size * 0.66,
  );
  gradient.addColorStop(0, "#fff8d6");
  gradient.addColorStop(0.48, "#edcf82");
  gradient.addColorStop(1, "#d49a4f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const grain = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.18,
    size * 0.5,
    size * 0.5,
    size * 0.72,
  );
  grain.addColorStop(0, "rgba(255,255,255,0.18)");
  grain.addColorStop(0.58, "rgba(100,62,27,0.04)");
  grain.addColorStop(1, "rgba(64,36,13,0.18)");
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  const outerStroke = ctx.createLinearGradient(0, 0, size, size);
  outerStroke.addColorStop(0, "rgba(255,244,203,0.86)");
  outerStroke.addColorStop(0.42, "rgba(132,82,35,0.38)");
  outerStroke.addColorStop(1, "rgba(66,36,14,0.72)");
  ctx.strokeStyle = outerStroke;
  ctx.lineWidth = size * (options.edgeOnly ? 0.052 : 0.038);
  roundedRectPath(
    ctx,
    size * 0.035,
    size * 0.035,
    size * 0.93,
    size * 0.93,
    radius * 0.88,
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = size * 0.012;
  roundedRectPath(
    ctx,
    size * 0.09,
    size * 0.09,
    size * 0.82,
    size * 0.82,
    radius * 0.68,
  );
  ctx.stroke();
}

function createBetrayalHouseDieFaceCanvas(value: 0 | 1 | 2): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  canvas.height = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  paintBetrayalHouseDieFaceBase(ctx);

  if (value === 0) {
    ctx.font = '900 520px Georgia, "Times New Roman", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 34;
    ctx.strokeStyle = "rgba(255,248,219,0.9)";
    ctx.strokeText("0", 512, 536);
    ctx.fillStyle = "#4d2a10";
    ctx.fillText("0", 512, 536);
  } else {
    const pipPositions: Record<1 | 2, Array<[number, number]>> = {
      1: [[512, 512]],
      2: [
        [356, 356],
        [668, 668],
      ],
    };

    for (const [x, y] of pipPositions[value]) {
      ctx.beginPath();
      ctx.arc(x, y, 132, 0, Math.PI * 2);
      ctx.fillStyle = "#4d2a10";
      ctx.fill();
      ctx.lineWidth = 18;
      ctx.strokeStyle = "rgba(255,248,219,0.78)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 36, y - 42, 32, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,248,219,0.36)";
      ctx.fill();
    }
  }

  return canvas;
}

function createBetrayalHouseDieEdgeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  canvas.height = BETRAYAL_HOUSE_DICE_FACE_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  paintBetrayalHouseDieFaceBase(ctx, { edgeOnly: true });
  return canvas;
}

function getBetrayalHouseDieFaceCanvas(value: 0 | 1 | 2): HTMLCanvasElement {
  const cached = betrayalHouseDieFaceCanvasCache[value];
  if (cached) {
    return cached;
  }
  const canvas = createBetrayalHouseDieFaceCanvas(value);
  betrayalHouseDieFaceCanvasCache[value] = canvas;
  return canvas;
}

function getBetrayalHouseDieEdgeCanvas(): HTMLCanvasElement {
  if (betrayalHouseDieEdgeCanvasCache) {
    return betrayalHouseDieEdgeCanvasCache;
  }
  betrayalHouseDieEdgeCanvasCache = createBetrayalHouseDieEdgeCanvas();
  return betrayalHouseDieEdgeCanvasCache;
}

const normalizeBetrayalHouseRuleValue = (pip: number): 0 | 1 | 2 =>
  pip === 0 || pip === 1 || pip === 2 ? pip : 0;

function createBetrayalHouseDiceSkin(value: 0 | 1 | 2): DiceBoxDieSkin {
  const ruleFaceCanvases: Record<0 | 1 | 2, HTMLCanvasElement> = {
    0: getBetrayalHouseDieFaceCanvas(0),
    1: getBetrayalHouseDieFaceCanvas(1),
    2: getBetrayalHouseDieFaceCanvas(2),
  };
  const edgeCanvas = getBetrayalHouseDieEdgeCanvas();
  const visibleValueCanvas = ruleFaceCanvases[value];
  const faceCanvases: Record<number, HTMLCanvasElement> = {
    1: visibleValueCanvas,
    2: visibleValueCanvas,
    3: visibleValueCanvas,
    4: visibleValueCanvas,
    5: visibleValueCanvas,
    6: visibleValueCanvas,
  };

  return {
    id: `${BETRAYAL_HOUSE_DICE_FACE_SYSTEM}-${value}`,
    edgeCanvas,
    faceCanvases,
    topFaceCanvas: visibleValueCanvas,
  };
}

function BetrayalHouseDice3DGroup({
  roll,
  className = "",
  canvasTestId,
  animateInitialRoll = true,
  rerollSelection,
  styleProfile = BETRAYAL_HOUSE_DICE_STYLE_PROFILE,
  visualScale = 1,
  onDiceSettledChange,
}: {
  roll: BetrayalRecentRollState;
  className?: string;
  locale: string;
  canvasTestId: string;
  animateInitialRoll?: boolean;
  styleProfile?: DiceBoxStyleProfile;
  visualScale?: number;
  rerollSelection?: RecentRollRerollSelection | null;
  onDiceSettledChange?: (rollId: string, settled: boolean) => void;
}) {
  const rollDice = roll.dice;
  const diceSignature = rollDice.join(",");
  const diceInputs = React.useMemo(
    () =>
      rollDice.map((pip, index) => ({
        id: index + 1,
        value: resolveBetrayalHouseD6Face(pip),
      })),
    [rollDice],
  );
  const physicalD6Faces = React.useMemo(
    () => rollDice.map(resolveBetrayalHouseD6Face),
    [rollDice],
  );
  const dieSkins = React.useMemo(
    () =>
      rollDice.map((pip) =>
        createBetrayalHouseDiceSkin(normalizeBetrayalHouseRuleValue(pip)),
      ),
    [rollDice],
  );
  const rerollingDieIndex = roll.lastRabbitFootRerollDieIndex ?? null;
  const rerollingDiceIds = React.useMemo(
    () => (rerollingDieIndex !== null ? [rerollingDieIndex + 1] : undefined),
    [rerollingDieIndex],
  );
  const [hasPhysicsState, setHasPhysicsState] = React.useState(false);
  const [physicsStates, setPhysicsStates] = React.useState<DicePhysicsState[]>(
    [],
  );
  React.useEffect(() => {
    setHasPhysicsState(false);
    setPhysicsStates([]);
  }, [diceSignature, roll.id]);
  const visibleRuleValues = React.useMemo(
    () =>
      rollDice.map((pip, index) => {
        const physicalValue = physicsStates[index]?.value;
        return physicalValue
          ? (BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE[physicalValue] ??
              normalizeBetrayalHouseRuleValue(pip))
          : normalizeBetrayalHouseRuleValue(pip);
      }),
    [physicsStates, rollDice],
  );
  const allowedRerollDieIndices = rerollSelection?.allowedDieIndices;
  const selectableDiceTargets = React.useMemo(() => {
    const allowedDieIndexSet = allowedRerollDieIndices
      ? new Set(allowedRerollDieIndices)
      : null;
    const physicsTargets = physicsStates
      .map((state) => ({
        dieIndex: state.id - 1,
        layout: state.layout,
        source: "physics" as const,
      }))
      .filter(
        (target) =>
          target.dieIndex >= 0 &&
          target.dieIndex < rollDice.length &&
          (!allowedDieIndexSet || allowedDieIndexSet.has(target.dieIndex)),
      );

    if (physicsTargets.length > 0) {
      return physicsTargets;
    }

    const spacing = 82;
    const totalWidth = Math.max(0, (rollDice.length - 1) * spacing);
    return rollDice
      .map((_, dieIndex) => ({
        dieIndex,
        layout: {
          id: dieIndex + 1,
          x: 0,
          y: 0,
          width: 64,
          height: 64,
          minX: 0,
          maxX: 0,
          minY: 0,
          maxY: 0,
          rotateX: 0,
          rotateY: 0,
          rotateZ: 0,
        },
        fallbackStyle: {
          left: `calc(50% + ${dieIndex * spacing - totalWidth / 2}px)`,
          top: "50%",
        },
        source: "fallback-projection" as const,
      }))
      .filter(
        (target) => !allowedDieIndexSet || allowedDieIndexSet.has(target.dieIndex),
      );
  }, [allowedRerollDieIndices, physicsStates, rollDice]);
  const handleRerollTargetKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, dieIndex: number) => {
      if (!rerollSelection) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      rerollSelection.onSelectDie(dieIndex);
    },
    [rerollSelection],
  );

  return (
    <div
      data-testid="betrayal-house-dice-3d-group"
      data-render-mode="betrayal-house-dice-box-visible"
      data-dice-tray-style="transparent-virtual"
      data-dice-surface-mode={
        styleProfile.surface === "transparent-virtual"
          ? "transparent-virtual"
          : "theme-surface"
      }
      data-dice-physics-ready={hasPhysicsState ? "true" : "false"}
      data-dice-preload-state="none"
      data-dice-physics-state-count={physicsStates.length}
      data-dice-count={roll.dice.length}
      data-dice-rule-values={roll.dice.join(",")}
      data-dice-visible-rule-values={visibleRuleValues.join(",")}
      data-dice-rule-subtotal={roll.dice.reduce((sum, pip) => sum + pip, 0)}
      data-dice-physical-d6-faces={physicalD6Faces.join(",")}
      data-dice-rerolling-die-index={rerollingDieIndex ?? undefined}
      data-dice-debug-key={canvasTestId}
      data-dice-boundary-highlight="subtle-open-stage"
      className={`relative min-h-0 bg-transparent ${
        styleProfile.surface === "transparent-virtual"
          ? "overflow-visible rounded-none"
          : "overflow-hidden rounded-[18px]"
      } ${className}`}
      style={
        visualScale !== 1
          ? {
              transform: `scale(${visualScale})`,
              transformOrigin: "center center",
            }
          : undefined
      }
    >
      <div
        aria-hidden="true"
        data-testid="betrayal-house-dice-tray-surface"
        data-dice-tray-surface="transparent"
        className={`pointer-events-none absolute inset-0 z-0 bg-transparent ${
          styleProfile.surface === "transparent-virtual"
            ? "rounded-none"
            : "rounded-[18px]"
        }`}
      />
      <div
        aria-hidden="true"
        data-testid="betrayal-house-dice-boundary-highlight"
        data-dice-boundary-highlight="runtime-visible"
        className="pointer-events-none absolute inset-[10px] z-30 rounded-[28px]"
        style={{
          backgroundImage: "none",
          border: "0",
          boxShadow: "none",
        }}
      />
      <DiceBoxPhysicsSource
        dice={diceInputs}
        isRolling={animateInitialRoll && rerollingDieIndex === null}
        rerollingDiceIds={rerollingDiceIds}
        styleProfile={styleProfile}
        dieSkins={dieSkins}
        testId="betrayal-house-dice-physics-source"
        canvasTestId={canvasTestId}
        rendererMode="debug-visible"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        dataAttributes={{
          "data-dice-face-system": BETRAYAL_HOUSE_DICE_FACE_SYSTEM,
          "data-dice-model-source":
            "dice-box-d6-with-per-die-betrayal-0-1-2-skin",
        }}
        onPhysicsStatesChange={(states) => {
          setHasPhysicsState(
            roll.dice.length > 0 && states.length >= roll.dice.length,
          );
          setPhysicsStates(states);
        }}
        onSettledChange={(settled) => {
          onDiceSettledChange?.(buildRecentRollDisplayKey(roll) ?? roll.id, settled);
        }}
      />
      {hasPhysicsState ? (
        <div
          data-testid="betrayal-house-dice-readable-faces"
          data-visual-layer="diagnostic-only"
          className="sr-only"
        >
          {physicsStates.map((state) => {
            const dieIndex = state.id - 1;
            const ruleValue =
              visibleRuleValues[dieIndex] ??
              normalizeBetrayalHouseRuleValue(roll.dice[dieIndex] ?? 0);
            const visualSize = Math.max(
              28,
              Math.min(
                46,
                Math.min(
                  state.layout.visualWidth ?? state.layout.width,
                  state.layout.visualHeight ?? state.layout.height,
                ) * 0.78,
              ),
            );
            const faceText =
              ruleValue === 0 ? "0" : ruleValue === 1 ? "●" : "●●";
            return (
              <span
                key={`${roll.id}-readable-face-${state.id}`}
                data-testid={`betrayal-house-dice-readable-face-${dieIndex}`}
                data-rule-value={ruleValue}
                data-projected-x={Math.round(state.layout.x)}
                data-projected-y={Math.round(state.layout.y)}
                data-projected-size={Math.round(visualSize)}
              >
                {faceText}
              </span>
            );
          })}
        </div>
      ) : null}
      {rerollSelection ? (
        <div
          data-testid="betrayal-rabbit-foot-dice"
          data-reroll-target-count={selectableDiceTargets.length}
          className="pointer-events-none absolute inset-0 z-20"
        >
          {selectableDiceTargets.map((target) => {
            const targetCircleSize =
              Math.max(target.layout.width, target.layout.height) + 18;
            return (
              <div
                key={`${roll.id}-reroll-target-${target.dieIndex}`}
                role="button"
                tabIndex={0}
                aria-label={rerollSelection.getDieActionLabel(target.dieIndex)}
                title={rerollSelection.getDieActionLabel(target.dieIndex)}
                data-testid={`betrayal-house-dice-reroll-target-${target.dieIndex}`}
                data-reroll-target-rotate-z={target.layout.rotateZ.toFixed(4)}
                data-reroll-target-source={target.source}
                data-reroll-target-shape="circle"
                className="group pointer-events-auto absolute outline-none"
                style={{
                  left:
                    target.source === "fallback-projection"
                      ? target.fallbackStyle.left
                      : `${target.layout.x}px`,
                  top:
                    target.source === "fallback-projection"
                      ? target.fallbackStyle.top
                      : `${target.layout.y}px`,
                  width: `${targetCircleSize}px`,
                  height: `${targetCircleSize}px`,
                  transform: `translate(-50%, -50%) rotate(${target.layout.rotateZ}rad)`,
                  transformOrigin: "center center",
                }}
                onClick={() => rerollSelection.onSelectDie(target.dieIndex)}
                onKeyDown={(event) => {
                  handleRerollTargetKeyDown(event, target.dieIndex);
                }}
              >
                <span className="sr-only">
                  {rerollSelection.getDieActionLabel(target.dieIndex)}
                </span>
                <span
                  aria-hidden="true"
                  data-highlight-shape="circle"
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#f2d27f] bg-[radial-gradient(circle,rgba(242,210,127,0.16),rgba(242,210,127,0.03)_60%,rgba(242,210,127,0)_78%)] shadow-[0_0_0_1px_rgba(23,16,8,0.96),0_0_18px_rgba(242,210,127,0.28)] transition group-hover:shadow-[0_0_0_1px_rgba(23,16,8,0.96),0_0_22px_rgba(242,210,127,0.38)]"
                />
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="sr-only">
        {roll.dice.map((pip, dieIndex) => (
          <span
            key={`${roll.id}-${dieIndex}`}
            data-testid={`betrayal-recent-roll-die-${dieIndex}`}
            data-render-mode="betrayal-house-die-dice-box-visible"
            data-dice-physics-source={
              hasPhysicsState ? "dice-box-threejs" : "pending"
            }
            data-rule-value={pip}
            data-physical-d6-face={physicalD6Faces[dieIndex]}
          >
            {pip}
          </span>
        ))}
      </div>
    </div>
  );
}
type DiscoveryAtlasFrameProps = {
  visual: BetrayalDiscoveryAtlasVisual | BetrayalPossessionAtlasVisual;
  locale: string;
  alt: string;
  testId?: string;
  className?: string;
};

function DiscoveryAtlasFrame({
  visual,
  locale,
  alt,
  testId,
  className = "",
}: DiscoveryAtlasFrameProps) {
  const imgStyle = React.useMemo(
    () => buildDiscoveryAtlasImageStyle(visual),
    [visual],
  );

  return (
    <div
      role="img"
      aria-label={alt}
      data-testid={testId}
      data-asset-src={visual.image}
      data-atlas-frame-index={visual.frameIndex}
      className={`relative overflow-hidden rounded-[10px] bg-[rgba(8,7,5,0.96)] shadow-[0_10px_24px_rgba(0,0,0,0.36)] ${className}`}
      style={{ aspectRatio: imgStyle.aspectRatio }}
    >
      <OptimizedImage
        src={visual.image}
        locale={locale}
        alt={alt}
        data-asset-src={visual.image}
        data-atlas-frame-index={visual.frameIndex}
        draggable={false}
        className="absolute left-0 top-0 max-w-none select-none"
        style={imgStyle}
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[rgba(227,206,170,0.16)]" />
    </div>
  );
}

function RecentRollPanel({
  roll,
  className = "",
  diceClassName,
  animateInitialRoll = true,
  rerollSelection = null,
  effectiveLocale = "zh-CN",
  showSource = true,
  showOutcome = true,
  showRollLabel = true,
  showBreakdown = true,
  openTable = false,
  compactResult = false,
  denseResult = false,
  denseResultPlacement = "stacked",
  diceStyleProfile = BETRAYAL_HOUSE_DICE_STYLE_PROFILE,
  diceVisualScale = 1,
  landscapeResultDock = false,
  floatingResultClassName = "",
  openTableResultDocked = false,
  resultStageClassName = "",
  compactRowsClassName = "",
  actorLabel = null,
  actionSlot = null,
  onDiceSettledChange,
}: {
  roll: BetrayalRecentRollState;
  className?: string;
  diceClassName?: string;
  animateInitialRoll?: boolean;
  rerollSelection?: RecentRollRerollSelection | null;
  effectiveLocale?: string;
  showSource?: boolean;
  showOutcome?: boolean;
  showRollLabel?: boolean;
  showBreakdown?: boolean;
  openTable?: boolean;
  compactResult?: boolean;
  denseResult?: boolean;
  denseResultPlacement?: "stacked" | "floatingSide";
  diceStyleProfile?: DiceBoxStyleProfile;
  diceVisualScale?: number;
  landscapeResultDock?: boolean;
  floatingResultClassName?: string;
  openTableResultDocked?: boolean;
  resultStageClassName?: string;
  compactRowsClassName?: string;
  actorLabel?: string | null;
  actionSlot?: React.ReactNode;
  onDiceSettledChange?: (rollId: string, settled: boolean) => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const bonusLabel =
    roll.passiveBonus > 0 ? `+${roll.passiveBonus}` : String(roll.passiveBonus);
  const diceSubtotal = roll.dice.reduce((sum, value) => sum + value, 0);
  const rollDetailText = t("board.roll.detail", {
    subtotal: diceSubtotal,
    bonus: bonusLabel,
    total: resolveRecentRollTotal(roll),
  });
  const totalLabel = t("board.roll.total", {
    value: resolveRecentRollTotal(roll),
  });
  const diceSubtotalLabel = t("board.roll.diceSubtotal", {
    value: diceSubtotal,
  });
  const passiveBonusLabel = t("board.roll.passiveBonus", { value: bonusLabel });
  const bonusText =
    roll.passiveBonus !== 0
      ? t("board.roll.bonus", { value: bonusLabel })
      : t("board.roll.noBonus");
  const attackComparisonText = roll.attack
    ? t(
        (roll.attack.defenderDefenseExtraDice ?? 0) > 0
          ? "board.roll.attackComparisonWithExtraDice"
          : "board.roll.attackComparison",
        {
          attacker: resolveRecentRollTotal(roll),
          defender: roll.attack.defenderRoll,
          extraDice: roll.attack.defenderDefenseExtraDice ?? 0,
        },
      )
    : null;
  const canvasTestId = React.useMemo(() => {
    const safeRollId =
      roll.id
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "roll";
    return `betrayal-house-dice-box-canvas-${safeRollId}`;
  }, [roll.id]);

  const diceStage = (
    <BetrayalHouseDice3DGroup
      roll={roll}
      locale={effectiveLocale}
      canvasTestId={canvasTestId}
      animateInitialRoll={animateInitialRoll}
      rerollSelection={rerollSelection}
      styleProfile={diceStyleProfile}
      visualScale={diceVisualScale}
      onDiceSettledChange={onDiceSettledChange}
      className={`h-full w-full min-w-0 ${diceClassName ?? ""}`}
    />
  );
  const shouldShowRerollPrompt = Boolean(rerollSelection);
  const diceStageWithPrompt = (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-visible">
      <div
        data-testid="betrayal-reroll-prompt-outside-dice"
        aria-hidden={shouldShowRerollPrompt ? undefined : "true"}
        className={
          shouldShowRerollPrompt
            ? "pointer-events-none mb-1 justify-self-center px-2 py-0.5 text-[11px] font-semibold tracking-[0.14em] text-[#f7e6ab] drop-shadow-[0_2px_7px_rgba(0,0,0,0.72)]"
            : "pointer-events-none h-0 overflow-hidden p-0 text-[0px] leading-none opacity-0"
        }
      >
        {rerollSelection?.promptLabel ?? ""}
      </div>
      {diceStage}
    </div>
  );
  const showResultCopy = Boolean(
    actorLabel ||
      showSource ||
      showRollLabel ||
      showOutcome ||
      (showBreakdown && attackComparisonText),
  );
  const actionSlotBelowResult = Boolean(actionSlot && openTable && !denseResult);
  const resultGridColumns = actionSlotBelowResult
    ? showResultCopy
      ? "grid-cols-[minmax(0,1fr)_auto]"
      : "grid-cols-[auto]"
    : showResultCopy
      ? actionSlot
        ? "grid-cols-[minmax(0,1fr)_auto_auto]"
        : "grid-cols-[minmax(0,1fr)_auto]"
      : actionSlot
        ? "grid-cols-[auto_auto]"
        : "grid-cols-[auto]";
  const breakdownStage = showBreakdown ? (
    <div
      data-testid="betrayal-recent-roll-breakdown"
      data-result-role="total-breakdown"
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-[7px] border border-[rgba(211,179,109,0.18)] bg-[rgba(211,179,109,0.06)] px-2 py-0.5 font-semibold text-[#d6c498] ${
        denseResult ? "text-[10px] leading-[14px]" : "text-[12px] leading-[16px]"
      }`}
    >
      <span data-testid="betrayal-recent-roll-detail" className="sr-only">
        {rollDetailText}
      </span>
      <span
        data-testid="betrayal-recent-roll-subtotal"
        className="text-[#e2cc91]"
      >
        {diceSubtotalLabel}
      </span>
      <span className="text-[rgba(214,191,129,0.42)]">/</span>
      <span
        data-testid="betrayal-recent-roll-passive-bonus"
        className="text-[#cdb783]"
      >
        {passiveBonusLabel}
      </span>
      <span
        data-testid="betrayal-recent-roll-a11y-summary"
        className="sr-only"
      >
        {rollDetailText}
      </span>
      <span data-testid="betrayal-recent-roll-bonus" className="sr-only">
        {bonusText}
      </span>
    </div>
  ) : (
    <span className="sr-only">{rollDetailText}</span>
  );
  const resultStage = (
    <div
      data-testid="betrayal-recent-roll-result-stage"
      data-result-layout="split-primary-total"
      data-result-surface={
        openTable
          ? compactResult
            ? "open-info-band"
            : "open-transparent"
          : "boxed"
      }
      className={`relative z-20 grid ${
        denseResult
          ? openTableResultDocked
            ? "h-[92px] max-h-[92px] w-[220px] max-w-full justify-self-end gap-1.5 px-2 py-1 text-right"
            : openTable
              ? "min-h-[72px] gap-2 px-2.5 py-1.5"
              : "min-h-[72px] gap-2 rounded-[10px] border border-[rgba(211,179,109,0.24)] bg-[rgba(5,9,8,0.86)] px-2.5 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.36)]"
          : compactResult
            ? "min-h-[92px] gap-4 px-3 py-2"
            : "min-h-[112px] gap-4 px-4 py-3"
      } ${resultGridColumns} ${
        showResultCopy ? "" : "justify-end"
      } items-center ${denseResult ? (actionSlot ? "overflow-visible" : "overflow-hidden") : "overflow-visible"} text-left ${resultStageClassName} ${
        denseResult
          ? openTable
            ? "bg-transparent shadow-none"
            : ""
        : openTable
          ? compactResult
            ? "rounded-[12px] border-0 bg-[rgba(7,11,9,0.34)] shadow-none"
            : "bg-transparent shadow-none"
          : "rounded-[12px] border border-[rgba(211,179,109,0.24)] bg-[rgba(9,10,8,0.72)] shadow-[0_8px_22px_rgba(0,0,0,0.28)]"
      }`}
    >
      {showResultCopy ? (
        <div className="min-w-0">
        {actorLabel ? (
          <div
            data-testid="betrayal-recent-roll-actor"
            className="mb-1 inline-flex max-w-full items-center rounded-[999px] border border-[rgba(214,181,109,0.30)] bg-[rgba(214,181,109,0.10)] px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-[#f4dda0]"
          >
            <span className="truncate">{actorLabel}</span>
          </div>
        ) : null}
        {showSource ? (
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c9a35e]">
            {roll.sourceTitle}
          </div>
        ) : null}
        {showRollLabel ? (
          <div className="mt-0.5 truncate text-[12px] font-semibold text-[#d8c38b]">
            {roll.rollLabel ?? t("board.roll.fallbackLabel")}
          </div>
        ) : null}
        {showOutcome ? (
          <div
            data-testid="betrayal-recent-roll-outcome"
            data-result-role="outcome-primary"
            className={`max-w-full font-bold tracking-[0.03em] text-[#fff7c8] drop-shadow-[0_2px_8px_rgba(0,0,0,0.62)] ${
              denseResult
                ? openTableResultDocked
                  ? "mt-0.5 max-h-[34px] overflow-hidden whitespace-normal break-words text-[12px] leading-[17px]"
                  : "mt-1 whitespace-normal break-words text-[13px] leading-[18px]"
                : "mt-2 truncate text-[16px] md:text-[18px]"
            }`}
          >
            {roll.latestLabel}
          </div>
        ) : null}
        {showBreakdown && attackComparisonText ? (
          <div
            data-testid="betrayal-recent-roll-attack-comparison"
            className="mt-1 truncate text-[11px] font-semibold text-[#cdb783]"
          >
            {attackComparisonText}
          </div>
        ) : null}
      </div>
      ) : null}
      <div
        data-testid="betrayal-recent-roll-total"
        data-result-emphasis="primary-total"
        className={`flex min-w-0 flex-col items-end gap-1 whitespace-nowrap text-right font-black tracking-[0.02em] text-[#fff0a3] drop-shadow-[0_3px_10px_rgba(0,0,0,0.72)] ${
          showResultCopy ? "border-l border-[rgba(211,179,109,0.20)]" : ""
        } ${
          denseResult
            ? openTableResultDocked
              ? "pl-1.5 text-[16px]"
              : "pl-2 text-[16px]"
          : "pl-4 text-[22px] md:text-[28px]"
        }`}
      >
        <span className="leading-none">{totalLabel}</span>
        {breakdownStage}
      </div>
      {actionSlot ? (
        <div
          className={`pointer-events-auto flex ${
            actionSlotBelowResult
              ? "col-span-full justify-center border-t border-[rgba(211,179,109,0.16)] pt-2"
              : "justify-end pl-1"
          }`}
        >
          {actionSlot}
        </div>
      ) : null}
    </div>
  );
  const srSummary = (
    <div className="sr-only">
      {actorLabel ? <span>{actorLabel}</span> : null}
      {showSource ? <span>{roll.sourceTitle}</span> : null}
      {showRollLabel ? (
        <span>{roll.rollLabel ?? t("board.roll.fallbackLabel")}</span>
      ) : null}
      <span>{bonusText}</span>
      {attackComparisonText ? <span>{attackComparisonText}</span> : null}
      <span>{totalLabel}</span>
      {showOutcome ? <span>{roll.latestLabel}</span> : null}
    </div>
  );

  if (landscapeResultDock) {
    return (
      <div
        data-testid="betrayal-recent-roll-panel"
        data-tutorial-id="betrayal-recent-roll-panel"
        data-roll-panel-style="mobile-landscape-open-dock"
        className={`pointer-events-none min-h-[214px] text-[#f3e0a6] ${className}`}
      >
        <div className="grid h-full min-h-[214px] grid-cols-[minmax(260px,1fr)_minmax(190px,0.58fr)] items-center gap-3">
          <div className="relative h-full min-h-[214px] min-w-0">
            {diceStageWithPrompt}
          </div>
          <div className="pointer-events-auto flex min-h-0 min-w-0 flex-col justify-center gap-2">
            {resultStage}
          </div>
        </div>
        {srSummary}
      </div>
    );
  }

  return (
    <div
      data-testid="betrayal-recent-roll-panel"
      data-tutorial-id="betrayal-recent-roll-panel"
      data-roll-panel-style={openTable ? "open-table-transparent" : "boxed"}
      className={`pointer-events-none relative ${
        openTable ? "overflow-visible rounded-none" : "overflow-hidden rounded-[20px]"
      } ${denseResult ? "min-h-[236px]" : "min-h-[260px]"} text-[#f3e0a6] ${
        openTable
          ? "bg-transparent p-0 shadow-none"
          : "border border-[rgba(211,179,109,0.42)] bg-[linear-gradient(180deg,rgba(22,18,12,0.96),rgba(9,12,10,0.94))] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.38)]"
      } ${className}`}
    >
      {denseResult ? (
        openTable && denseResultPlacement === "floatingSide" ? (
          <div className="relative z-10 h-full min-h-[236px] overflow-visible">
            <div
              className="relative h-[214px] min-h-[214px] min-w-[240px] max-w-[300px] -translate-y-16 overflow-visible"
              style={{ width: "calc(100% - 224px)" }}
            >
              {diceStageWithPrompt}
            </div>
            <div
              className={`pointer-events-none absolute right-0 z-10 w-[220px] ${floatingResultClassName || "top-0"}`}
            >
              {resultStage}
            </div>
          </div>
        ) : openTable ? (
          <div
            className={`relative z-10 grid h-full min-h-[236px] grid-rows-[minmax(156px,1fr)_auto] gap-1 ${
              openTableResultDocked ? "overflow-hidden" : "overflow-visible"
            }`}
          >
            <div
              className={`relative min-h-[156px] min-w-0 ${
                openTableResultDocked ? "overflow-hidden" : "overflow-visible"
              }`}
              >
                {diceStageWithPrompt}
              </div>
            <div
              className={`pointer-events-none relative z-10 ${
                openTableResultDocked
                  ? "max-h-[88px] min-w-0 overflow-hidden"
                  : ""
              }`}
            >
              {resultStage}
            </div>
          </div>
        ) : (
          <div className="relative z-10 h-full min-h-[236px] overflow-hidden">
            {diceStageWithPrompt}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
              {resultStage}
            </div>
          </div>
        )
      ) : (
        <div
          className={`relative z-10 grid h-full min-h-[260px] ${
            compactResult
              ? compactRowsClassName || "grid-rows-[minmax(174px,1fr)_auto]"
              : "grid-rows-[minmax(154px,1fr)_auto]"
          } gap-2`}
        >
          {diceStageWithPrompt}
          {resultStage}
        </div>
      )}
      {srSummary}
    </div>
  );
}

function StandardRecentRollOverlay({
  roll,
  isPhoneLandscapeLayout,
  canDismissByBackdrop,
  onDismiss,
  effectiveLocale,
  rerollSelection,
  actorLabel = null,
}: {
  roll: BetrayalRecentRollState;
  isPhoneLandscapeLayout: boolean;
  canDismissByBackdrop: boolean;
  onDismiss: () => void;
  effectiveLocale: string;
  rerollSelection?: RecentRollRerollSelection | null;
  actorLabel?: string | null;
}) {
  const { t } = useTranslation("game-betrayal");
  const continueButton = (
    <button
      type="button"
      data-testid="betrayal-roll-continue"
      className={`pointer-events-auto inline-flex min-h-[42px] max-w-full shrink-0 items-center justify-center whitespace-nowrap border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a] ${
        isPhoneLandscapeLayout ? "min-w-[132px]" : "min-w-[168px]"
      }`}
      onClick={onDismiss}
    >
      {t("board.roll.backToBoard")}
    </button>
  );
  const overlay = (
    <div
      data-testid="betrayal-roll-result-backdrop"
      data-backdrop-dismiss={canDismissByBackdrop ? "enabled" : "disabled"}
      data-render-layer={isPhoneLandscapeLayout ? "hud-portal" : "board-stage"}
      className={`${isPhoneLandscapeLayout ? "fixed inset-0" : "absolute inset-0 z-40"} ${
        canDismissByBackdrop ? "pointer-events-auto" : "pointer-events-none"
      }`}
      style={
        isPhoneLandscapeLayout
          ? {
              zIndex: UI_Z_INDEX.emergencyHud + 40,
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgba(6,18,13,0.86), rgba(2,8,6,0.94) 74%, rgba(2,8,6,0.98))",
            }
          : undefined
      }
      onClick={canDismissByBackdrop ? onDismiss : undefined}
    >
      <div
        data-testid="betrayal-roll-result-dock"
        className={
          isPhoneLandscapeLayout
            ? "pointer-events-auto absolute flex flex-col items-center gap-2"
            : "pointer-events-auto absolute bottom-[106px] left-[392px] right-[240px] z-40 flex flex-col items-center gap-2"
        }
        style={
          isPhoneLandscapeLayout
            ? {
                left: "50%",
                top: "clamp(82px, 22vh, 108px)",
                transform: "translateX(-50%)",
                width: "min(760px, calc(100vw - 5rem))",
              }
            : undefined
        }
        onClick={(event) => event.stopPropagation()}
      >
        <RecentRollPanel
          roll={roll}
          className={
            isPhoneLandscapeLayout
              ? "h-[min(54vh,238px)] min-h-[218px] w-full"
              : "h-[min(44vh,390px)] min-h-[360px] w-[min(700px,100%)]"
          }
          diceClassName={isPhoneLandscapeLayout ? "min-h-[214px]" : "min-h-[252px]"}
          rerollSelection={rerollSelection}
          openTable
          compactResult
          compactRowsClassName={
            isPhoneLandscapeLayout
              ? undefined
              : "grid-rows-[minmax(252px,1fr)_auto]"
          }
          resultStageClassName={isPhoneLandscapeLayout ? undefined : "mt-3"}
          denseResult={isPhoneLandscapeLayout}
          landscapeResultDock={isPhoneLandscapeLayout}
          diceStyleProfile={
            isPhoneLandscapeLayout
              ? BETRAYAL_HOUSE_DICE_MOBILE_STYLE_PROFILE
              : BETRAYAL_HOUSE_DICE_STYLE_PROFILE
          }
          diceVisualScale={isPhoneLandscapeLayout ? 1.16 : 1}
          effectiveLocale={effectiveLocale}
          actorLabel={actorLabel}
          actionSlot={isPhoneLandscapeLayout ? continueButton : null}
        />
        {isPhoneLandscapeLayout ? null : (
          <div
            data-testid="betrayal-roll-continue-dock"
            className="pointer-events-auto mt-2 flex w-[min(700px,100%)] justify-center"
          >
            {continueButton}
          </div>
        )}
      </div>
    </div>
  );

  return isPhoneLandscapeLayout ? <HudPortal>{overlay}</HudPortal> : overlay;
}

function EndgameScreen({
  core,
  matchData,
  effectiveLocale,
}: {
  core: BetrayalCore;
  matchData?: MatchPlayerInfo[];
  effectiveLocale: string;
}) {
  const { t } = useTranslation("game-betrayal");
  const result = core.endgameResult;
  const endgameDossier = resolveEndgameHauntDossier(core);
  const allExplorers = [core.currentExplorer, ...core.otherExplorers];
  const survivorsWon =
    result?.outcome === "survivors" || result?.outcome === "solo";
  const hauntWon = result?.outcome === "haunt";
  const survivors = result
    ? allExplorers.filter((explorer) =>
        result.survivorsEscaped.includes(explorer.playerId),
      )
    : allExplorers.slice(0, Math.max(1, allExplorers.length - 1));
  const traitor = result && !hauntWon
    ? (allExplorers.find(
        (explorer) => explorer.playerId === result.traitorPlayerId,
      ) ?? allExplorers[allExplorers.length - 1])
    : result
      ? null
      : allExplorers[allExplorers.length - 1];
  const outcomeTitle = survivorsWon
    ? t("board.endgame.victory")
    : t("board.endgame.defeat");
  const outcomeSubtitle = hauntWon
    ? t("board.endgame.hauntSucceeded")
    : survivorsWon
    ? t("board.endgame.survivorsEscaped")
    : t("board.endgame.traitorSucceeded");
  const survivorsTitle = survivorsWon
    ? t("board.endgame.survivorsStatusWin")
    : t("board.endgame.survivorsStatusLose");
  const antagonistLabel = hauntWon
    ? t("board.endgame.haunt")
    : t("board.endgame.traitor");
  const antagonistTitle = hauntWon
    ? t("board.endgame.hauntStatusWin")
    : survivorsWon
    ? t("board.endgame.traitorStatusLose")
    : t("board.endgame.traitorStatusWin");
  const endgameTraitOrder = [
    "might",
    "speed",
    "knowledge",
    "sanity",
  ] as BetrayalTraitKey[];
  const roomsExploredCount =
    result?.stats.roomsExplored ??
    core.rooms.filter((room) => room.state === "discovered").length;
  const omensDrawnCount = result?.stats.omensDrawn ?? 0;
  const eventsDrawnCount = result?.stats.eventsDrawn ?? 0;
  const endgameNarrationSectionId = resolveEndgameNarrationSectionId(
    endgameDossier,
    result?.outcome,
  );
  const endgameNarrationKey = `board.haunts.${endgameDossier.id}.reader.${endgameNarrationSectionId}`;
  const endgameNarrationVariant =
    result?.outcome === "haunt"
      ? "ending-haunt"
      : result?.outcome === "traitor"
        ? "ending-traitor"
        : "ending-survivors";
  const endgameNarrationIdentity = `${endgameDossier.id}:${result?.outcome ?? "unknown"}:${result?.traitorPlayerId ?? "none"}`;
  const [endingNarrationOpen, setEndingNarrationOpen] =
    React.useState(true);

  React.useEffect(() => {
    setEndingNarrationOpen(true);
  }, [endgameNarrationIdentity]);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    if (!endingNarrationOpen) {
      return undefined;
    }
    const root = document.documentElement;
    const attrName = "data-betrayal-cinematic-stage";
    root.setAttribute(attrName, "true");
    return () => {
      root.removeAttribute(attrName);
    };
  }, [endingNarrationOpen]);

  return (
    <div
      data-testid="betrayal-endgame-screen"
      data-tutorial-id="betrayal-endgame-screen"
      className="absolute inset-0 z-[240] flex h-full min-h-full flex-col overflow-hidden bg-transparent text-[#f1e8d4]"
      style={
        endingNarrationOpen
          ? undefined
          : {
              backgroundImage: [
                "radial-gradient(circle at 50% 10%, rgba(156,203,77,0.14), transparent 24%)",
                "repeating-linear-gradient(90deg, rgba(45,61,50,0.04) 0 2px, rgba(0,0,0,0) 2px 22px)",
                "repeating-linear-gradient(0deg, rgba(37,52,42,0.03) 0 2px, rgba(0,0,0,0) 2px 24px)",
                "linear-gradient(180deg, #0d1714 0%, #07100e 100%)",
              ].join(","),
            }
      }
    >
      {endingNarrationOpen ? (
        <section
          data-testid="betrayal-endgame-ending-stage"
          className="relative flex h-full min-h-full w-full flex-col overflow-hidden bg-[rgba(0,0,0,0.36)] backdrop-blur-[1px]"
        >
          <CinematicNarrationPanel
            testId="betrayal-endgame-ending-narration"
            label={t("board.endgame.endingNarrationLabel")}
            text={t(endgameNarrationKey)}
            variant={endgameNarrationVariant}
            presentation="stage"
            actionSlot={
              <button
                type="button"
                data-testid="betrayal-endgame-ending-continue"
                onClick={() => setEndingNarrationOpen(false)}
                className="inline-flex min-h-11 min-w-[168px] items-center justify-center gap-2 border border-[rgba(242,207,130,0.42)] bg-[rgba(8,10,9,0.82)] px-6 text-[12px] font-black uppercase tracking-[0.22em] text-[#f5e6c7] shadow-[0_16px_38px_rgba(0,0,0,0.58)] transition hover:border-[#f2cf82] hover:bg-[rgba(18,20,16,0.92)]"
              >
                {t("board.endgame.continueToReport")}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            }
            className="h-full min-h-full w-full"
          />
        </section>
      ) : (
      <div className="mx-auto flex h-full min-h-full w-full max-w-[1760px] p-3 md:p-4">
        <div className="relative flex min-h-full w-full flex-col overflow-hidden border border-[#876a3c] bg-[rgba(9,15,13,0.95)] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
          <div className="pointer-events-none absolute inset-0 border border-[rgba(216,191,129,0.14)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(132,170,82,0.08),transparent_28%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(38,51,44,0.03)_0_2px,rgba(0,0,0,0)_2px_26px)]" />
          <div className="pointer-events-none absolute left-1 top-1 h-4 w-4 border-l border-t border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute right-1 top-1 h-4 w-4 border-r border-t border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 border-b border-l border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 border-b border-r border-[rgba(216,191,129,0.6)]" />

          <header className="relative grid min-h-[118px] grid-cols-[minmax(300px,1fr)_1.42fr_minmax(330px,1fr)] divide-x divide-[#5e4b2e] border-b border-[#6a5637] bg-[linear-gradient(180deg,rgba(10,16,14,0.985),rgba(8,14,13,0.95))] px-5 py-3">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.3),transparent)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
            <div className="relative flex items-center overflow-hidden px-4 py-2.5">
              <div className="pointer-events-none absolute inset-y-2 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.42),transparent)]" />
              <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28),transparent)]" />
              <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.12),transparent)]" />
              <div className="relative flex h-[74px] w-full items-center overflow-hidden border border-[rgba(214,191,129,0.3)] bg-[linear-gradient(180deg,rgba(8,12,11,0.72),rgba(5,8,7,0.92))] px-3 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.08)]">
                <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.12)]" />
                <OptimizedImage
                  src={ASSETS.titleBanner}
                  locale={effectiveLocale}
                  alt={t("title")}
                  className="relative h-[58px] w-full object-contain object-left"
                  draggable={false}
                />
              </div>
            </div>
            <div className="relative flex flex-col items-center justify-center px-6 py-2 text-center">
              <div className="text-xs uppercase tracking-[0.34em] text-[#e1c480]">
                {t("board.endgame.title")}
              </div>
              <div
                className={`mt-1 text-[56px] font-bold tracking-[0.1em] drop-shadow-[0_0_18px_rgba(183,239,116,0.28)] ${
                  survivorsWon ? "text-[#b7ef74]" : "text-[#eb8a67]"
                }`}
              >
                {outcomeTitle}
              </div>
              <div className="mt-1 text-[17px] tracking-[0.24em] text-[#f1e1bb]">
                {outcomeSubtitle}
              </div>
              <div className="pointer-events-none absolute left-[14%] top-1/2 flex items-center gap-2">
                <span className="h-px w-16 bg-[linear-gradient(90deg,transparent,#9f854d)]" />
                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
              </div>
              <div className="pointer-events-none absolute right-[14%] top-1/2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
                <span className="h-px w-16 bg-[linear-gradient(90deg,#9f854d,transparent)]" />
              </div>
            </div>
            <div className="relative flex items-stretch overflow-hidden px-4 py-2.5">
              <div className="pointer-events-none absolute inset-y-2 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.42),transparent)]" />
              <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28),transparent)]" />
              <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.12),transparent)]" />
              <div className="relative flex flex-1 overflow-hidden border border-[rgba(214,191,129,0.3)] bg-[linear-gradient(180deg,rgba(8,12,11,0.72),rgba(5,8,7,0.92))] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.08)]">
                <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.12)]" />
                <div className="relative hidden w-[148px] overflow-hidden md:block">
                  <OptimizedImage
                    src={ASSETS.cover}
                    locale={effectiveLocale}
                    alt=""
                    className="h-full w-full object-cover opacity-46"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,11,0.1),rgba(8,12,11,0.52))]" />
                </div>
                <div className="relative flex flex-col justify-center px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.26em] text-[#ddb774]">
                    {t("board.scenario.button")}
                  </div>
                  <div className="mt-1 text-[28px] font-semibold tracking-[0.08em] text-[#f3e1bd]">
                    {result?.hauntTitle ?? scenarioConfig.hauntTitle}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 grid-cols-[318px_minmax(0,1.18fr)_286px] gap-0 px-4 pb-3 pt-3 xl:grid-cols-[336px_minmax(0,1.22fr)_304px]">
            <section className="relative flex min-h-0 flex-col gap-3 px-2 pb-1 pt-1 pr-4">
              <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.2),rgba(214,191,129,0.2),transparent)]" />
              <div className="relative overflow-hidden px-3 py-3">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(179,239,116,0.45),transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.16),transparent)]" />
                <div className="text-center text-[19px] font-semibold uppercase tracking-[0.16em] text-[#b7ef74]">
                  {t("board.endgame.survivors")}
                </div>
                <div className="mt-1 text-center text-[13px] uppercase tracking-[0.18em] text-[#d6e3b5]">
                  {survivorsTitle}
                </div>
                <div className="mt-4 space-y-2">
                  {survivors.map((explorer) => (
                    <div
                      key={explorer.playerId}
                      className="relative grid grid-cols-[50px_1fr_38px] items-center gap-3 border-y border-[rgba(126,102,61,0.3)] bg-[linear-gradient(180deg,rgba(15,21,19,0.34),rgba(8,11,10,0.42))] px-2 py-2"
                    >
                      <div className="relative grid h-[50px] w-[50px] place-items-center overflow-hidden rounded-full border border-[rgba(177,151,92,0.3)] bg-[radial-gradient(circle_at_50%_38%,rgba(61,89,72,0.18),rgba(8,11,10,0.74)_72%)]">
                        <OptimizedImage
                          src={explorer.portraitAsset}
                          locale={effectiveLocale}
                          alt={explorer.displayName}
                          className="h-[48px] w-[48px] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.32)]"
                          draggable={false}
                        />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="min-h-[18px] whitespace-normal pr-2 text-[11px] font-semibold leading-[1.08] tracking-[0.03em] text-[#f4e6c7]"
                          style={{ wordBreak: "break-word" }}
                        >
                          {resolveEndgameExplorerName(explorer, matchData)}
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          {endgameTraitOrder.map((key) => (
                            <span
                              key={key}
                              data-trait-value-shape="square"
                              className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(112,92,58,0.34)] bg-[rgba(17,15,12,0.42)] px-1 py-0.5 text-[9px] text-[#f3e6c9]"
                            >
                              <OptimizedImage
                                src={ASSETS.trait[key]}
                                locale={effectiveLocale}
                                alt={TRAIT_LABEL_LOCAL[key]}
                                className="h-3.5 w-3.5 object-contain opacity-90"
                                draggable={false}
                              />
                              <span className="font-semibold leading-none">
                                {explorer.traits[key]}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="grid place-items-center text-center">
                        <div
                          className="relative grid h-[42px] w-[38px] place-items-center border border-[rgba(132,171,82,0.44)] bg-[radial-gradient(circle_at_50%_24%,rgba(182,234,104,0.18),rgba(23,33,19,0.84)_72%)] text-[15px] font-semibold text-[#b7ef74] shadow-[0_8px_14px_rgba(0,0,0,0.18)]"
                          style={{ clipPath: ENDGAME_MEDALLION_CLIP_PATH }}
                        >
                          <span
                            className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.2)]"
                            style={{ clipPath: ENDGAME_MEDALLION_CLIP_PATH }}
                          />
                          {Object.values(explorer.traits).reduce(
                            (sum, value) => sum + value,
                            0,
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden px-2 pb-2 pt-2">
                <div className="mb-2.5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(221,183,116,0.34))]" />
                  <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#ddb774]">
                    {outcomeSubtitle}
                  </div>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(221,183,116,0.34),transparent)]" />
                </div>
                <div className="relative overflow-hidden border border-[rgba(108,84,53,0.64)] bg-[rgba(3,7,6,0.58)] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.06)]">
                  <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.08)]" />
                  <OptimizedImage
                    src={ASSETS.cover}
                    locale={effectiveLocale}
                    alt={outcomeSubtitle}
                    className="h-[104px] w-full object-cover opacity-78"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,8,0.14),rgba(6,10,8,0.62))]" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-center">
                    {survivors.map((explorer, index) => (
                      <OptimizedImage
                        key={explorer.playerId}
                        src={explorer.portraitAsset}
                        locale={effectiveLocale}
                        alt={explorer.displayName}
                        className="h-[56px] w-[56px] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                        style={{ marginLeft: index === 0 ? 0 : -20 }}
                        draggable={false}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="relative flex min-h-0 flex-col items-center justify-start gap-3 px-3">
              <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),rgba(214,191,129,0.22),transparent)]" />
              <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),rgba(214,191,129,0.22),transparent)]" />
              <div className="relative w-full max-w-[728px] border border-[#aa864b] bg-[linear-gradient(180deg,rgba(54,40,22,0.98),rgba(28,21,14,0.99))] p-[9px] shadow-[0_22px_48px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(226,185,102,0.12)]">
                <div className="pointer-events-none absolute inset-1 border border-[rgba(226,185,102,0.28)]" />
                <div className="pointer-events-none absolute inset-[5px] border border-[rgba(54,38,18,0.86)]" />
                <div className="pointer-events-none absolute inset-x-3 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(232,190,106,0.62),transparent)]" />
                <div className="pointer-events-none absolute inset-x-3 bottom-1 h-px bg-[linear-gradient(90deg,transparent,rgba(232,190,106,0.3),transparent)]" />
                <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                  <span className="h-10 w-1 rounded-full bg-[linear-gradient(180deg,rgba(232,190,106,0),rgba(232,190,106,0.95),rgba(232,190,106,0))]" />
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <span className="h-10 w-1 rounded-full bg-[linear-gradient(180deg,rgba(232,190,106,0),rgba(232,190,106,0.95),rgba(232,190,106,0))]" />
                </div>

                <div
                  data-testid="betrayal-endgame-result-report"
                  className="relative overflow-hidden border border-[#6f5935] px-5 pb-4 pt-4 text-[#2c2419] shadow-[inset_0_0_0_1px_rgba(255,238,198,0.1)]"
                  style={{
                    backgroundImage: [
                      "radial-gradient(circle at 14% 18%, rgba(246,229,187,0.34), transparent 15%)",
                      "radial-gradient(circle at 86% 18%, rgba(92,65,35,0.3), transparent 18%)",
                      "radial-gradient(circle at 52% 62%, rgba(62,43,22,0.23), transparent 54%)",
                      "radial-gradient(circle at 26% 82%, rgba(134,104,66,0.18), transparent 17%)",
                      "radial-gradient(circle at 72% 80%, rgba(89,67,41,0.16), transparent 16%)",
                      "linear-gradient(180deg, rgba(52,35,17,0.42) 0%, rgba(0,0,0,0) 9%, rgba(0,0,0,0) 91%, rgba(52,35,17,0.46) 100%)",
                      "repeating-linear-gradient(0deg, rgba(78,60,35,0.06) 0 2px, rgba(0,0,0,0) 2px 8px)",
                      "repeating-linear-gradient(90deg, rgba(117,94,58,0.045) 0 1px, rgba(0,0,0,0) 1px 8px)",
                      "linear-gradient(180deg, #b7a27a 0%, #a79068 25%, #8f7956 66%, #a38c65 100%)",
                    ].join(","),
                    boxShadow:
                      "inset 0 0 0 1px rgba(98,72,40,0.26), inset 0 0 84px rgba(44,30,15,0.32), inset 0 0 22px rgba(255,236,198,0.1)",
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(69,52,29,0.22),rgba(0,0,0,0)_7%,rgba(0,0,0,0)_93%,rgba(69,52,29,0.24))]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(52,39,22,0.16),rgba(0,0,0,0)_8%,rgba(0,0,0,0)_92%,rgba(52,39,22,0.2))]" />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-42 mix-blend-multiply"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 18% 28%, rgba(120,88,54,0.24) 0 1px, transparent 1px), radial-gradient(circle at 72% 64%, rgba(102,74,45,0.2) 0 1px, transparent 1px), radial-gradient(circle at 42% 78%, rgba(134,102,63,0.16) 0 1px, transparent 1px)",
                      backgroundSize: "128px 96px, 156px 112px, 138px 124px",
                    }}
                  />
                  <div className="pointer-events-none absolute inset-2 border border-[rgba(74,52,27,0.48)]" />
                  <div className="pointer-events-none absolute inset-[18px] border border-[rgba(132,108,68,0.24)]" />
                  <div className="pointer-events-none absolute inset-x-[72px] top-[48px] h-px bg-[linear-gradient(90deg,transparent,rgba(74,52,27,0.42),transparent)]" />
                  <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-[#6f5830]" />
                  <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-[#6f5830]" />
                  <div className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-[#6f5830]" />
                  <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-[#6f5830]" />

                  <div className="relative text-center">
                    <div className="pointer-events-none absolute left-[13%] top-1/2 h-px w-16 -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(73,49,24,0.9))]" />
                    <div className="pointer-events-none absolute right-[13%] top-1/2 h-px w-16 -translate-y-1/2 bg-[linear-gradient(90deg,rgba(73,49,24,0.9),transparent)]" />
                    <div className="text-[36px] font-bold tracking-[0.14em] text-[#302315] drop-shadow-[0_1px_0_rgba(229,207,159,0.32)]">
                      {result?.hauntTitle ?? scenarioConfig.hauntTitle}
                    </div>
                    <div className="pointer-events-none mt-2 flex items-center justify-center gap-2">
                      <span className="h-px w-20 bg-[linear-gradient(90deg,transparent,rgba(73,49,24,0.78))]" />
                      <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(73,49,24,0.78)] bg-[rgba(133,108,68,0.24)]" />
                      <span className="h-px w-20 bg-[linear-gradient(90deg,rgba(73,49,24,0.78),transparent)]" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_1fr] gap-0">
                    <div className="relative border-r border-[#6f5d3d] pr-4 pt-4">
                      <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">
                        {t("board.scenario.objectiveLabel")}
                      </div>
                      <div className="mt-4 flex h-14 items-center justify-center">
                        {survivors.slice(0, 2).map((explorer, index) => (
                          <OptimizedImage
                            key={explorer.playerId}
                            src={explorer.portraitAsset}
                            locale={effectiveLocale}
                            alt={explorer.displayName}
                            className="h-14 w-14 object-contain drop-shadow-[0_8px_18px_rgba(64,75,40,0.42)]"
                            style={{ marginLeft: index === 0 ? 0 : -20 }}
                            draggable={false}
                          />
                        ))}
                      </div>
                      <p className="mt-4 text-center text-[14px] font-semibold leading-[1.35] text-[#352a1e]">
                        {outcomeSubtitle}。
                      </p>
                      <div className="mt-4 flex justify-center">
                        <div className="relative grid h-[72px] w-[72px] rotate-[-11deg] place-items-center rounded-full border-[4px] border-[#476a31] text-[18px] font-bold tracking-[0.08em] text-[#476a31] opacity-90 shadow-[inset_0_0_0_2px_rgba(71,106,49,0.34)]">
                          <span className="pointer-events-none absolute inset-[11px] rounded-full border-2 border-[rgba(71,106,49,0.46)]" />
                          {t("board.endgame.completedStamp")}
                        </div>
                      </div>
                    </div>

                    <div className="pl-4 pt-4">
                      <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">
                        {t("board.endgame.resultLabel")}
                      </div>
                      <div className="mt-4 flex h-14 items-center justify-center">
                        {survivors.slice(0, 2).map((explorer, index) => (
                          <OptimizedImage
                            key={explorer.playerId}
                            src={explorer.portraitAsset}
                            locale={effectiveLocale}
                            alt={explorer.displayName}
                            className="h-14 w-14 object-contain drop-shadow-[0_8px_18px_rgba(64,75,40,0.42)]"
                            style={{ marginLeft: index === 0 ? 0 : -20 }}
                            draggable={false}
                          />
                        ))}
                      </div>
                      <div
                        className={`mt-4 text-center text-[38px] font-bold tracking-[0.12em] drop-shadow-[0_1px_0_rgba(230,211,163,0.28)] ${survivorsWon ? "text-[#4d7330]" : "text-[#92493e]"}`}
                      >
                        {outcomeTitle}
                      </div>
                      <div className="mt-4 border-t border-[#6f5d3d] pt-3">
                        <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">
                          {t("board.endgame.rewardsLabel")}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)] text-[32px] leading-none text-[#bf9647] drop-shadow-[0_2px_0_rgba(86,58,22,0.45)]">
                              ★
                            </span>
                            <div className="text-[30px] font-semibold">
                              {result?.reward.stars ?? 4}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)]">
                              <OptimizedImage
                                src={ASSETS.deck.omen}
                                locale={effectiveLocale}
                                alt=""
                                className="h-10 w-7 object-cover"
                                draggable={false}
                              />
                            </span>
                            <div className="text-[30px] font-semibold">
                              {result?.reward.omens ?? 2}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)]">
                              <BookOpen size={28} className="text-[#5d7d8d]" />
                            </span>
                            <div className="text-[30px] font-semibold">
                              {result?.reward.logs ?? 1}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute left-1/2 top-[82px] bottom-5 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(94,73,42,0),rgba(94,73,42,0.72),rgba(94,73,42,0.72),rgba(94,73,42,0))]" />
                </div>
              </div>

              <div className="flex shrink-0 gap-3 pb-1">
                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                  <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                  <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                  <RotateCcw size={22} />
                  <span>{t("board.endgame.rematch")}</span>
                </button>
                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                  <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                  <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                  <House size={22} />
                  <span>{t("board.endgame.lobby")}</span>
                </button>
                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                  <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                  <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                  <BookOpen size={22} />
                  <span>{t("board.endgame.logs")}</span>
                </button>
              </div>
            </section>

            <section className="relative flex min-h-0 flex-col gap-3 px-2 pb-1 pt-1 pl-4">
              <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.2),rgba(214,191,129,0.2),transparent)]" />
              <div className="relative overflow-hidden px-3 pb-2 pt-3">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(235,114,80,0.42),transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
                <div className="text-center text-[19px] font-semibold uppercase tracking-[0.16em] text-[#eb7250]">
                  {antagonistLabel}
                </div>
                <div className="mt-1 text-center text-[13px] uppercase tracking-[0.18em] text-[#f1b49d]">
                  {antagonistTitle}
                </div>
                {traitor ? (
                  <div className="relative mt-4 grid grid-cols-[50px_1fr_34px] items-center gap-3 border-y border-[rgba(151,92,74,0.34)] bg-[linear-gradient(180deg,rgba(11,14,12,0.34),rgba(17,10,9,0.48))] px-2 py-2">
                    <div className="relative grid h-[50px] w-[50px] place-items-center overflow-hidden rounded-full border border-[rgba(177,112,92,0.3)] bg-[radial-gradient(circle_at_50%_38%,rgba(119,50,51,0.16),rgba(11,12,12,0.76)_72%)]">
                      <OptimizedImage
                        src={traitor.portraitAsset}
                        locale={effectiveLocale}
                        alt={traitor.displayName}
                        className="h-[48px] w-[48px] object-contain"
                        draggable={false}
                      />
                    </div>
                    <div className="min-w-0">
                      <div
                        className="min-h-[18px] whitespace-normal pr-2 text-[11px] font-semibold leading-[1.08] tracking-[0.04em] text-[#f3e6c9]"
                        style={{ wordBreak: "break-word" }}
                      >
                        {resolveEndgameExplorerName(traitor, matchData)}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#d9a27f]">
                        {result?.hauntTitle ?? scenarioConfig.hauntTitle}
                      </div>
                    </div>
                    <div className="grid place-items-center">
                      <div className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(212,100,82,0.42)] bg-[radial-gradient(circle_at_35%_30%,rgba(214,112,87,0.14),rgba(36,12,11,0.8)_72%)] text-[16px] text-[#ea7659] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.06)]">
                        ☠
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_38%,rgba(112,35,32,0.14),rgba(17,8,8,0.02)_64%,rgba(0,0,0,0)_72%)] px-4 py-2">
                  <div className="grid h-[76px] w-[76px] place-items-center rounded-full border border-[rgba(202,85,69,0.2)] text-[34px] font-bold text-[#d55c49] shadow-[inset_0_0_0_7px_rgba(213,92,73,0.05)]">
                    ☠
                  </div>
                  <div className="mt-3 text-[28px] font-bold tracking-[0.08em] text-[#eb7250]">
                    {antagonistTitle}
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden px-2 pb-2 pt-2">
                <div className="flex items-center gap-3 text-center">
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(221,183,116,0.34))]" />
                  <div className="text-[15px] font-semibold uppercase tracking-[0.22em] text-[#ddb774]">
                    {t("board.endgame.statsLabel")}
                  </div>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(221,183,116,0.34),transparent)]" />
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                  <div className="border-r border-[rgba(76,60,39,0.44)] pr-2 last:border-r-0">
                    <Footprints size={28} className="mx-auto text-[#d0af6e]" />
                    <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">
                      {roomsExploredCount}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">
                      {t("board.endgame.roomsStat")}
                    </div>
                  </div>
                  <div className="border-r border-[rgba(76,60,39,0.44)] px-2 last:border-r-0">
                    <BookOpen size={28} className="mx-auto text-[#c3a166]" />
                    <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">
                      {omensDrawnCount}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">
                      {t("board.endgame.omensStat")}
                    </div>
                  </div>
                  <div className="px-2">
                    <Search size={28} className="mx-auto text-[#c3a166]" />
                    <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">
                      {eventsDrawnCount}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">
                      {t("board.endgame.eventsStat")}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
      )}
    </div>
  );
}

export default function BetrayalBoard({
  G,
  dispatch,
  playerID,
  matchData,
  locale,
}: Props) {
  const { t } = useTranslation(["game-betrayal", "common"]);
  const {
    isActive: isTutorialActive,
    currentStep: tutorialStep,
    nextStep,
  } = useTutorial();
  const runtimeViewport = useRuntimeViewport({ syncCssVars: false });
  useTutorialBridge(
    G?.sys?.tutorial,
    dispatch as (type: string, payload?: unknown) => void,
  );
  const effectiveLocale = locale || "zh-CN";
  const {
    beginSequence: beginVisualSequence,
    endSequence: endVisualSequence,
    isVisualBusy,
  } = useVisualSequenceGate();
  const [visualTransition, setVisualTransition] =
    React.useState<BetrayalVisualTransition | null>(null);
  const visualTransitionIdRef = React.useRef(0);
  const activeVisualTransitionIdRef = React.useRef<string | null>(null);
  const baseCore = React.useMemo(
    () =>
      isBetrayalCore(G?.core) ? G.core : createBetrayalCharacterSelectCore(),
    [G],
  );
  const viewerPlayerId = String(
    playerID ?? baseCore.currentPlayer ?? baseCore.playerIds[0] ?? "0",
  );
  const beginBetrayalVisualTransition = React.useCallback(
    (transition: Omit<BetrayalVisualTransition, "id">) => {
      if (isVisualBusy || activeVisualTransitionIdRef.current) {
        return false;
      }
      const id = `transition-${visualTransitionIdRef.current + 1}`;
      visualTransitionIdRef.current += 1;
      activeVisualTransitionIdRef.current = id;
      beginVisualSequence();
      setVisualTransition({ ...transition, id });
      return true;
    },
    [beginVisualSequence, isVisualBusy],
  );
  const finishBetrayalVisualTransition = React.useCallback(
    (transitionId: string) => {
      const currentTransition = visualTransition;
      if (
        activeVisualTransitionIdRef.current !== transitionId ||
        !currentTransition
      ) {
        return;
      }
      // 先提交原始动作，再释放活动标记，避免 core 变化被 AI/远端观察器误判为第二次动画。
      currentTransition.onComplete?.();
      activeVisualTransitionIdRef.current = null;
      setVisualTransition(null);
      endVisualSequence();
    },
    [endVisualSequence, visualTransition],
  );
  const displayBaseCore = React.useMemo<BetrayalCore>(() => {
    const playerViewCore = BetrayalDomain.playerView?.(
      baseCore,
      viewerPlayerId,
    ) as Partial<BetrayalCore> | undefined;
    if (!playerViewCore) {
      return baseCore;
    }
    return isBetrayalCore(playerViewCore)
      ? playerViewCore
      : { ...baseCore, ...playerViewCore };
  }, [baseCore, viewerPlayerId]);
  const isGameOver = Boolean(G?.sys?.gameover) || baseCore.phase === "endgame";
  useGameAudio({
    config: BETRAYAL_AUDIO_CONFIG,
    gameId: BETRAYAL_MANIFEST.id,
    G: baseCore,
    ctx: {
      phase: baseCore.phase,
      isGameOver,
      isWinner: baseCore.endgameResult
        ? baseCore.endgameResult.winners.includes(viewerPlayerId)
        : undefined,
    },
    eventEntries: G?.sys?.eventStream?.entries,
    meta: {
      playerID: playerID ?? null,
    },
  });
  const [selectedExplorerId, setSelectedExplorerId] = React.useState(
    () =>
      baseCore.selectedExplorerByPlayerId[viewerPlayerId] ??
      EXPLORER_CATALOG[0]!.explorerId,
  );
  const [previewState, setPreviewState] = React.useState<PreviewState>(() =>
    createInitialPreviewState(baseCore),
  );
  const [referenceOpen, setReferenceOpen] = React.useState(false);
  const [scenarioReaderOpen, setScenarioReaderOpen] = React.useState(false);
  const [referenceSide, setReferenceSide] =
    React.useState<ReferencePageId>("front");
  const [referenceScenarioSpreadIndex, setReferenceScenarioSpreadIndex] =
    React.useState(0);
  const [referenceScenarioOpeningStageActive, setReferenceScenarioOpeningStageActive] =
    React.useState(false);
  const [referenceScenarioTurnDirection, setReferenceScenarioTurnDirection] =
    React.useState<"back" | "forward" | null>(null);
  const [referenceScenarioTurnSnapshot, setReferenceScenarioTurnSnapshot] =
    React.useState<ScenarioBookTurnSnapshot | null>(null);
  const previousBoardPhaseRef = React.useRef<BetrayalCore["phase"]>(
    baseCore.phase,
  );
  const pendingScenarioStartOpeningKeyRef = React.useRef<string | null>(null);
  const [
    scenarioStartOpeningCinematicKey,
    setScenarioStartOpeningCinematicKey,
  ] = React.useState<string | null>(null);
  const [
    dismissedScenarioStartOpeningCinematicKey,
    setDismissedScenarioStartOpeningCinematicKey,
  ] = React.useState<string | null>(null);
  const [roomPreviewId, setRoomPreviewId] = React.useState<string | null>(null);
  const [inventoryPreviewCardId, setInventoryPreviewCardId] = React.useState<
    string | null
  >(null);
  const [
    latestDiscoverySearchRevealIndex,
    setLatestDiscoverySearchRevealIndex,
  ] = React.useState(0);
  const [confirmedExorciseRollId, setConfirmedExorciseRollId] = React.useState<
    string | null
  >(null);
  const [settledRecentRollId, setSettledRecentRollId] = React.useState<
    string | null
  >(null);
  const [selectedRoomMapFloor, setSelectedRoomMapFloor] = React.useState<
    BetrayalRoomNode["floor"]
  >(() => resolveExplorerFloor(baseCore));
  const [roomFocusPanTarget, setRoomFocusPanTarget] = React.useState<
    string | null
  >(null);
  const roomGridRef = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    const pendingTransition = visualTransition;
    if (!pendingTransition || pendingTransition.targetRect) {
      return undefined;
    }

    let attempts = 0;
    let frameId: number | null = null;
    const resolveTarget = () => {
      const targetRect = readBetrayalViewportRect(
        findBetrayalTestElement(pendingTransition.targetTestId),
      );
      const fallbackRoomRect = pendingTransition.fallbackRoomTestId
        ? readBetrayalViewportRect(
            findBetrayalTestElement(pendingTransition.fallbackRoomTestId),
          )
        : null;
      const resolvedRect =
        targetRect ??
        (fallbackRoomRect
          ? centerBetrayalRect(
              fallbackRoomRect,
              pendingTransition.sourceRect.width,
              pendingTransition.sourceRect.height,
            )
          : null);
      if (resolvedRect) {
        setVisualTransition((currentTransition) =>
          currentTransition?.id === pendingTransition.id
            ? { ...currentTransition, targetRect: resolvedRect }
            : currentTransition,
        );
        return;
      }

      attempts += 1;
      if (attempts >= 12) {
        finishBetrayalVisualTransition(pendingTransition.id);
        return;
      }
      frameId = window.requestAnimationFrame(resolveTarget);
    };

    frameId = window.requestAnimationFrame(resolveTarget);
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    baseCore,
    finishBetrayalVisualTransition,
    selectedRoomMapFloor,
    visualTransition,
  ]);
  const isPhoneLandscapeLayout =
    runtimeViewport.width > 0 &&
    runtimeViewport.width <= 1023 &&
    runtimeViewport.width > runtimeViewport.height;
  const isExorciseRollReview =
    displayBaseCore.recentRoll?.kind === "hauntActionTraitCheck" &&
    (displayBaseCore.recentRoll.sourceTitle === "驱魔" ||
      displayBaseCore.recentRoll.sourceTitle === "驱逐木乃伊") &&
    displayBaseCore.recentRoll.trait === "sanity" &&
    confirmedExorciseRollId !== displayBaseCore.recentRoll.id;
  const isEndgameExorciseRollReview =
    displayBaseCore.phase === "endgame" && isExorciseRollReview;
  const core = React.useMemo<BetrayalCore>(
    () =>
      isEndgameExorciseRollReview
        ? {
            ...displayBaseCore,
            phase: "haunt",
            recommendedAction: "endTurn",
            endgameResult: null,
          }
        : displayBaseCore,
    [displayBaseCore, isEndgameExorciseRollReview],
  );
  const turnStartSpeedForHud = Number.isFinite(core.turnStartSpeed)
    ? core.turnStartSpeed
    : core.currentExplorer.traits.speed;
  const [latestDiscoveryQueue, setLatestDiscoveryQueue] = React.useState<
    LatestDiscoveryDisplayEntry[]
  >([]);
  const [
    dismissedHauntRevealDiscoveryKey,
    setDismissedHauntRevealDiscoveryKey,
  ] = React.useState<string | null>(null);
  const dismissedLatestDiscoveryKeysRef = React.useRef<Set<string>>(
    new Set(),
  );
  const autoOpenedHauntScenarioReaderKeysRef = React.useRef<Set<string>>(
    new Set(),
  );
  const hasObservedHauntRevealAutoOpenStateRef = React.useRef(false);
  const previousHauntRevealAutoOpenKeyRef = React.useRef<string | null>(null);
  const [inspectedExplorerPlayerId, setInspectedExplorerPlayerId] =
    React.useState<string | null>(null);
  const allExplorers = React.useMemo(
    () => [core.currentExplorer, ...core.otherExplorers],
    [core.currentExplorer, core.otherExplorers],
  );
  const resolveRecentRollActorLabel = React.useCallback(
    (roll: BetrayalRecentRollState | null | undefined) => {
      if (!roll || roll.playerId === viewerPlayerId) {
        return null;
      }
      const actor = allExplorers.find(
        (explorer) => explorer.playerId === roll.playerId,
      );
      const actorName = actor
        ? resolvePlayerName(actor.playerId, actor.displayName, matchData)
        : resolvePlayerName(roll.playerId, "玩家", matchData);
      return `由 ${actorName} 触发`;
    },
    [allExplorers, matchData, viewerPlayerId],
  );
  const [observedExplorerPlayerId, setObservedExplorerPlayerId] =
    React.useState<string | null>(null);
  const observationReturnPlayerIdRef = React.useRef<string | null>(null);
  const observedExplorer =
    (observedExplorerPlayerId
      ? allExplorers.find(
          (explorer) => explorer.playerId === observedExplorerPlayerId,
        )
      : null) ?? core.currentExplorer;
  const observedExplorerRoomName =
    core.rooms.find((room) => room.id === observedExplorer.roomId)?.name ??
    t("board.rooms.unknown");
  const isObservingOtherExplorer =
    observedExplorer.playerId !== core.currentExplorer.playerId;
  const inspectedExplorer =
    allExplorers.find(
      (explorer) => explorer.playerId === inspectedExplorerPlayerId,
    ) ?? null;
  const inspectedExplorerTemplate = inspectedExplorer
    ? EXPLORER_CATALOG.find(
        (explorer) => explorer.explorerId === inspectedExplorer.explorerId,
      )
    : null;
  const inspectedExplorerRoomName = inspectedExplorer
    ? (core.rooms.find((room) => room.id === inspectedExplorer.roomId)?.name ??
      t("board.rooms.unknown"))
    : "";
  const openExplorerDetails = React.useCallback((playerId: string) => {
    setInspectedExplorerPlayerId(playerId);
  }, []);
  const closeExplorerDetails = React.useCallback(() => {
    setInspectedExplorerPlayerId(null);
  }, []);
  const focusRoomOnMap = React.useCallback(
    (roomId: string) => {
      const targetRoom = core.rooms.find((room) => room.id === roomId);
      if (!targetRoom) {
        return;
      }
      setSelectedRoomMapFloor(targetRoom.floor);
      const nextTarget = `betrayal-room-${targetRoom.id}`;
      setRoomFocusPanTarget(null);
      window.requestAnimationFrame(() => {
        setRoomFocusPanTarget(nextTarget);
      });
    },
    [core.rooms],
  );
  const focusExplorerRoom = React.useCallback(
    (playerId: string | null) => {
      const targetExplorer =
        (playerId
          ? allExplorers.find((explorer) => explorer.playerId === playerId)
          : null) ?? core.currentExplorer;
      const targetRoom = core.rooms.find(
        (room) => room.id === targetExplorer.roomId,
      );
      if (!targetRoom) {
        return;
      }
      focusRoomOnMap(targetRoom.id);
    },
    [allExplorers, core.currentExplorer, core.rooms, focusRoomOnMap],
  );
  const focusMonsterRoom = React.useCallback(
    (monsterId: string | null) => {
      const monster = monsterId
        ? core.monsters.find((candidate) => candidate.id === monsterId)
        : null;
      if (monster) {
        focusRoomOnMap(monster.roomId);
      }
    },
    [core.monsters, focusRoomOnMap],
  );
  const handleObserveExplorer = React.useCallback(
    (playerId: string) => {
      setInspectedExplorerPlayerId(null);
      if (playerId === core.currentExplorer.playerId) {
        observationReturnPlayerIdRef.current = null;
        setObservedExplorerPlayerId(null);
        focusExplorerRoom(null);
        return;
      }
      if (observedExplorerPlayerId === playerId) {
        const returnPlayerId = observationReturnPlayerIdRef.current;
        observationReturnPlayerIdRef.current = null;
        setObservedExplorerPlayerId(returnPlayerId);
        focusExplorerRoom(returnPlayerId);
        return;
      }
      observationReturnPlayerIdRef.current = observedExplorerPlayerId;
      setObservedExplorerPlayerId(playerId);
      focusExplorerRoom(playerId);
    },
    [core.currentExplorer.playerId, focusExplorerRoom, observedExplorerPlayerId],
  );
  const handleFocusSelfRoom = React.useCallback(() => {
    const selfRoom = core.rooms.find(
      (room) => room.id === core.currentExplorer.roomId,
    );
    if (!selfRoom) {
      return;
    }
    observationReturnPlayerIdRef.current = null;
    setObservedExplorerPlayerId(null);
    focusRoomOnMap(selfRoom.id);
  }, [core.currentExplorer.roomId, core.rooms, focusRoomOnMap]);
  const referencePages = React.useMemo(
    () => resolveReferencePages(core),
    [core],
  );
  const currentReferencePage =
    referencePages.find((page) => page.id === referenceSide) ??
    referencePages[0]!;
  const activeHauntDossier = resolveActiveHauntDossier(core);
  const activeHauntTitle = t(activeHauntDossier.titleKey);
  const activeHauntCaseLabel = t("board.haunts.goalCard.caseNo", {
    number: activeHauntDossier.cardNumber,
  });
  const scenarioReaderScope = resolveScenarioReaderScope(core, viewerPlayerId);
  const scenarioReaderScopeLabel =
    scenarioReaderScope === "traitor"
      ? t("board.scenario.readerStatusTraitorBook")
      : scenarioReaderScope === "heroes"
        ? t("board.scenario.readerStatusHeroBook")
        : t("board.scenario.readerStatusPublicBook");
  const scenarioReferenceButtonLabel = t("board.scenario.button");
  const scenarioReferenceAccessibleLabel = `${activeHauntCaseLabel} / ${activeHauntTitle}`;
  const referenceScenarioOpeningSection = findScenarioOpeningNarrationSection(
    activeHauntDossier,
    scenarioReaderScope,
  );
  const scenarioStartOpeningKey = referenceScenarioOpeningSection
    ? `${activeHauntDossier.id}:${scenarioReaderScope}:${referenceScenarioOpeningSection.id}`
    : null;
  const shouldShowScenarioStartOpening =
    core.phase === "preHaunt" &&
    Boolean(referenceScenarioOpeningSection) &&
    scenarioStartOpeningCinematicKey === scenarioStartOpeningKey &&
    dismissedScenarioStartOpeningCinematicKey !== scenarioStartOpeningKey;
  const referenceScenarioPages = buildScenarioReaderPages(
    activeHauntDossier,
    scenarioReaderScope,
  );
  const referenceScenarioBookSpreadCount = Math.max(
    1,
    Math.ceil(referenceScenarioPages.length / 2),
  );
  const referenceScenarioHasOpeningStage =
    referenceScenarioOpeningStageActive &&
    Boolean(referenceScenarioOpeningSection);
  const referenceScenarioSpreadCount =
    referenceScenarioBookSpreadCount +
    (referenceScenarioHasOpeningStage ? 1 : 0);
  const isReferenceScenarioOpeningStage =
    referenceScenarioHasOpeningStage && referenceScenarioSpreadIndex === 0;
  const referenceScenarioBookSpreadIndex = referenceScenarioHasOpeningStage
    ? Math.max(0, referenceScenarioSpreadIndex - 1)
    : referenceScenarioSpreadIndex;
  const referenceScenarioLeftPage =
    referenceScenarioPages[referenceScenarioBookSpreadIndex * 2] ?? null;
  const referenceScenarioRightPage =
    referenceScenarioPages[referenceScenarioBookSpreadIndex * 2 + 1] ?? null;
  const canTurnReferenceScenarioBack = referenceScenarioSpreadIndex > 0;
  const canTurnReferenceScenarioForward =
    referenceScenarioSpreadIndex < referenceScenarioSpreadCount - 1;

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    if (
      !(
        (scenarioReaderOpen && isReferenceScenarioOpeningStage) ||
        shouldShowScenarioStartOpening
      )
    ) {
      return undefined;
    }
    const root = document.documentElement;
    const attrName = "data-betrayal-cinematic-stage";
    root.setAttribute(attrName, "true");
    return () => {
      root.removeAttribute(attrName);
    };
  }, [
    isReferenceScenarioOpeningStage,
    scenarioReaderOpen,
    shouldShowScenarioStartOpening,
  ]);

  React.useEffect(() => {
    setPreviewState((previousState) => {
      if (baseCore.recommendedAction === "trade") {
        return createInitialPreviewState(baseCore);
      }
      const nextInitialState = createInitialPreviewState(baseCore);
      const canContinueMoveMode =
        previousState.interactionMode === "move" &&
        baseCore.movesRemaining > 0 &&
        (resolveMoveTargetRooms(baseCore).length > 0 ||
          baseCore.rooms.some((room) =>
            canUseSkeletonKeyForMove(baseCore, room.id),
          ));
      const nextInteractionMode = canContinueMoveMode
        ? "move"
        : nextInitialState.interactionMode;
      const preservedLastUsedInventoryCardId =
        previousState.lastUsedInventoryCardId &&
        baseCore.usedCardIdsThisTurn.includes(
          previousState.lastUsedInventoryCardId,
        )
          ? previousState.lastUsedInventoryCardId
          : null;
      if (
        baseCore.currentExplorerInventory.some(
          (card) => card.id === previousState.selectedInventoryCardId,
        )
      ) {
        return {
          ...nextInitialState,
          interactionMode: nextInteractionMode,
          selectedInventoryCardId: previousState.selectedInventoryCardId,
          lastUsedInventoryCardId: preservedLastUsedInventoryCardId,
          dismissedLatestDiscoveryKey:
            previousState.dismissedLatestDiscoveryKey,
          dismissedRecentRollId: previousState.dismissedRecentRollId,
        };
      }
      return {
        ...nextInitialState,
        interactionMode: nextInteractionMode,
        lastUsedInventoryCardId: preservedLastUsedInventoryCardId,
        dismissedLatestDiscoveryKey: previousState.dismissedLatestDiscoveryKey,
        dismissedRecentRollId: previousState.dismissedRecentRollId,
      };
    });
    setInventoryPreviewCardId(null);
  }, [baseCore]);
  React.useEffect(() => {
    if (!referencePages.some((page) => page.id === referenceSide)) {
      setReferenceSide(referencePages[0]?.id ?? "front");
    }
  }, [referencePages, referenceSide]);
  React.useEffect(() => {
    setReferenceScenarioSpreadIndex(0);
    setReferenceScenarioOpeningStageActive(false);
  }, [activeHauntDossier.id]);
  React.useEffect(() => {
    const previousPhase = previousBoardPhaseRef.current;
    previousBoardPhaseRef.current = core.phase;
    const requestedOpeningKey = pendingScenarioStartOpeningKeyRef.current;
    if (
      previousPhase === "characterSelect" &&
      core.phase === "preHaunt" &&
      requestedOpeningKey &&
      requestedOpeningKey === scenarioStartOpeningKey
    ) {
      pendingScenarioStartOpeningKeyRef.current = null;
      setScenarioStartOpeningCinematicKey(scenarioStartOpeningKey);
      setDismissedScenarioStartOpeningCinematicKey(null);
      return;
    }
    if (core.phase !== "characterSelect") {
      pendingScenarioStartOpeningKeyRef.current = null;
    }
  }, [core.phase, scenarioStartOpeningKey]);
  React.useEffect(() => {
    if (
      inspectedExplorerPlayerId &&
      !allExplorers.some(
        (explorer) => explorer.playerId === inspectedExplorerPlayerId,
      )
    ) {
      setInspectedExplorerPlayerId(null);
    }
  }, [allExplorers, inspectedExplorerPlayerId]);
  React.useEffect(() => {
    if (
      observedExplorerPlayerId &&
      !allExplorers.some(
        (explorer) => explorer.playerId === observedExplorerPlayerId,
      )
    ) {
      observationReturnPlayerIdRef.current = null;
      setObservedExplorerPlayerId(null);
    }
  }, [allExplorers, observedExplorerPlayerId]);

  const openScenarioReference = React.useCallback(() => {
    const tutorialScenarioStepId = tutorialStep?.id;
    const shouldAdvanceScenarioReferenceTutorial =
      isTutorialActive &&
      (tutorialScenarioStepId === "hero-attack-objective" ||
        tutorialScenarioStepId === "jack-spirit-objective" ||
        tutorialScenarioStepId === "traitor-objective");
    const initialScenarioSpreadIndex =
      tutorialScenarioStepId === "jack-spirit-objective" ||
      tutorialScenarioStepId === "traitor-objective"
        ? Math.min(1, referenceScenarioSpreadCount - 1)
        : 0;
    setReferenceScenarioSpreadIndex(initialScenarioSpreadIndex);
    setReferenceScenarioOpeningStageActive(false);
    setReferenceScenarioTurnDirection(null);
    setReferenceScenarioTurnSnapshot(null);
    setScenarioReaderOpen(true);
    if (shouldAdvanceScenarioReferenceTutorial) {
      nextStep("auto");
    }
  }, [
    isTutorialActive,
    nextStep,
    referenceScenarioSpreadCount,
    tutorialStep?.id,
  ]);

  React.useEffect(() => {
    if (!isHauntScenarioOpeningDiscovery(core)) {
      return;
    }
    setLatestDiscoveryQueue([]);
  }, [core]);

  const closeReferenceOverlay = React.useCallback(() => {
    setReferenceOpen(false);
    setScenarioReaderOpen(false);
    setReferenceScenarioOpeningStageActive(false);
  }, []);

  const openReferenceCards = React.useCallback(() => {
    setReferenceSide("front");
    setReferenceOpen(true);
  }, []);

  React.useEffect(() => {
    setSelectedExplorerId(
      baseCore.selectedExplorerByPlayerId[viewerPlayerId] ??
        EXPLORER_CATALOG[0]!.explorerId,
    );
  }, [baseCore, viewerPlayerId]);

  const dispatchCommand = React.useCallback(
    <Type extends keyof BetrayalCommandMap>(
      type: Type,
      payload: BetrayalCommandMap[Type],
    ) => {
      if (isVisualBusy) {
        return;
      }
      dispatch(type, payload);
    },
    [dispatch, isVisualBusy],
  );
  const startExplorerMoveVisual = React.useCallback(
    (roomId: string, onComplete: () => void) => {
      const explorer = core.currentExplorer;
      const sourceRect = readBetrayalViewportRect(
        findBetrayalTestElement(
          `betrayal-explorer-figure-token-${explorer.playerId}`,
        ),
      );
      if (!sourceRect) {
        return false;
      }
      return beginBetrayalVisualTransition({
        kind: "explorer-move",
        sourceRect,
        targetRect: null,
        targetTestId: `betrayal-room-${roomId}`,
        explorer,
        locale: effectiveLocale,
        tokenLabel: resolvePlayerName(
          explorer.playerId,
          explorer.displayName,
          matchData,
        ),
        tone: "self",
        missingTokenLabel: t("board.hauntTokens.officialTokenMissing"),
        onComplete,
      });
    },
    [
      beginBetrayalVisualTransition,
      core.currentExplorer,
      effectiveLocale,
      matchData,
      t,
    ],
  );
  const startMonsterMoveVisual = React.useCallback(
    (monsterId: string, roomId: string, onComplete: () => void) => {
      const monster = core.monsters.find((candidate) => candidate.id === monsterId);
      if (!monster) {
        return false;
      }
      const sourceRect = readBetrayalViewportRect(
        findBetrayalTestElement(`betrayal-monster-board-token-${monsterId}`),
      );
      if (!sourceRect) {
        return false;
      }
      const monsterStatus = resolveBetrayalMonsterStatuses(core).find(
        (status) => status.monsterId === monsterId,
      )?.status;
      return beginBetrayalVisualTransition({
        kind: "monster-move",
        sourceRect,
        targetRect: null,
        targetTestId: `betrayal-room-${roomId}`,
        monster,
        monsterStatus,
        locale: effectiveLocale,
        missingTokenLabel: t("board.hauntTokens.officialTokenMissing"),
        onComplete,
      });
    },
    [beginBetrayalVisualTransition, core, effectiveLocale, t],
  );
  const startGirlTransferVisual = React.useCallback(
    ({
      sourceRoomId,
      targetTestId,
      attachedTo,
      onComplete,
    }: {
      sourceRoomId: string;
      targetTestId: string;
      attachedTo: "room" | "explorer" | "mummy";
    }) => {
      const girlToken = resolveBetrayalHauntTokenInstances(core).find(
        (token) => token.id === "mummy-girl-token",
      );
      const sourceRect = readBetrayalViewportRect(
        findBetrayalTestElement(
          `betrayal-room-haunt-token-${sourceRoomId}-mummy-girl-token`,
        ),
      );
      if (!girlToken || !sourceRect) {
        return false;
      }
      return beginBetrayalVisualTransition({
        kind: "girl-transfer",
        sourceRect,
        targetRect: null,
        targetTestId,
        girlToken,
        locale: effectiveLocale,
        missingTokenLabel: t("board.hauntTokens.officialTokenMissing"),
        attachedTo,
        onComplete,
      });
    },
    [beginBetrayalVisualTransition, core, effectiveLocale, t],
  );
  const applyOptimisticPreviewAfterCommand = React.useCallback(
    <Type extends keyof BetrayalCommandMap>(
      type: Type,
      payload: BetrayalCommandMap[Type],
      options: {
        keepSelectedInventoryCardId?: string | null;
        lastUsedInventoryCardId?: string | null;
      } = {},
    ) => {
      const command = {
        type,
        payload,
        playerId: viewerPlayerId,
        timestamp: Date.now(),
      } as Parameters<typeof BetrayalDomain.execute>[1];
      const validation = BetrayalDomain.validate(
        { core: baseCore, sys: {} as never },
        command,
      );
      if (!validation.valid) {
        return;
      }
      const nextCore = BetrayalDomain.execute(
        { core: baseCore, sys: {} as never },
        command,
      ).reduce(
        (currentCore, event) => BetrayalDomain.reduce(currentCore, event),
        baseCore,
      );
      const nextPreviewState = createInitialPreviewState(nextCore);
      setPreviewState((previousState) => ({
        ...nextPreviewState,
        selectedInventoryCardId:
          options.keepSelectedInventoryCardId ??
          nextPreviewState.selectedInventoryCardId,
        lastUsedInventoryCardId:
          options.lastUsedInventoryCardId ??
          nextPreviewState.lastUsedInventoryCardId,
        dismissedLatestDiscoveryKey:
          buildLatestDiscoveryKey(nextCore) ===
          previousState.dismissedLatestDiscoveryKey
            ? previousState.dismissedLatestDiscoveryKey
            : nextPreviewState.dismissedLatestDiscoveryKey,
        dismissedRecentRollId:
          buildRecentRollDisplayKey(nextCore.recentRoll) ===
          previousState.dismissedRecentRollId
            ? previousState.dismissedRecentRollId
            : nextPreviewState.dismissedRecentRollId,
      }));
    },
    [baseCore, viewerPlayerId],
  );

  const handleSelectExplorer = React.useCallback(
    (explorerId: string) => {
      setSelectedExplorerId(explorerId);
      dispatchCommand(BETRAYAL_COMMANDS.SELECT_EXPLORER, { explorerId });
    },
    [dispatchCommand],
  );

  const handleConfirmExplorer = React.useCallback(() => {
    if (
      baseCore.selectedExplorerByPlayerId[viewerPlayerId] !== selectedExplorerId
    ) {
      dispatchCommand(BETRAYAL_COMMANDS.SELECT_EXPLORER, {
        explorerId: selectedExplorerId,
      });
    }
    dispatchCommand(BETRAYAL_COMMANDS.CONFIRM_EXPLORER, {});
  }, [
    baseCore.selectedExplorerByPlayerId,
    dispatchCommand,
    selectedExplorerId,
    viewerPlayerId,
  ]);

  const handleProposeScenarioCard = React.useCallback(
    (candidateId: BetrayalScenarioCardId) => {
      pendingScenarioStartOpeningKeyRef.current = null;
      dispatchCommand(BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD, {
        candidateId,
      });
    },
    [dispatchCommand],
  );

  const handleConfirmScenarioCard = React.useCallback(() => {
    pendingScenarioStartOpeningKeyRef.current = scenarioStartOpeningKey;
    dispatchCommand(BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, {});
  }, [dispatchCommand, scenarioStartOpeningKey]);

  const handleStartScenario = React.useCallback(() => {
    pendingScenarioStartOpeningKeyRef.current = scenarioStartOpeningKey;
    dispatchCommand(BETRAYAL_COMMANDS.START_SCENARIO, {});
  }, [dispatchCommand, scenarioStartOpeningKey]);
  const dismissScenarioStartOpening = React.useCallback(() => {
    if (scenarioStartOpeningKey) {
      setDismissedScenarioStartOpeningCinematicKey(scenarioStartOpeningKey);
    }
    setScenarioStartOpeningCinematicKey(null);
  }, [scenarioStartOpeningKey]);
  const roomOccupants = React.useMemo(() => buildRoomOccupants(core), [core]);
  const roomMonsters = React.useMemo(() => buildRoomMonsters(core), [core]);
  const movingExplorerPlayerId =
    visualTransition?.kind === "explorer-move"
      ? visualTransition.explorer?.playerId ?? null
      : null;
  const movingMonsterId =
    visualTransition?.kind === "monster-move"
      ? visualTransition.monster?.id ?? null
      : null;
  const movingGirlTokenId =
    visualTransition?.kind === "girl-transfer"
      ? visualTransition.girlToken?.id ?? null
      : null;
  const monsterStatusById = React.useMemo(
    () =>
      new Map(
        resolveBetrayalMonsterStatuses(core).map((status) => [
          status.monsterId,
          status.status,
        ]),
      ),
    [core],
  );
  const currentExplorerFloor = React.useMemo(
    () => resolveExplorerFloor(core),
    [core],
  );
  const viewerExplorerFloor = React.useMemo(
    () => resolveExplorerFloorByPlayer(core, viewerPlayerId),
    [core, viewerPlayerId],
  );
  const shouldFollowCurrentExplorerFloor =
    playerID != null && core.currentPlayer === viewerPlayerId;
  const previousFloorFollowTargetRef = React.useRef({
    currentPlayer: core.currentPlayer,
    currentExplorerFloor,
  });
  const currentRoom = React.useMemo(
    () =>
      core.rooms.find((room) => room.id === core.currentExplorer.roomId) ??
      null,
    [core.currentExplorer.roomId, core.rooms],
  );
  const roomEndTurnEffectHint = React.useMemo(
    () => resolveRoomEndTurnEffectHint(currentRoom, t),
    [currentRoom, t],
  );
  const occupiedRoomMapFloors = React.useMemo(
    () => resolveOccupiedRoomMapFloors(core),
    [core],
  );
  React.useEffect(() => {
    const previousTarget = previousFloorFollowTargetRef.current;
    if (
      shouldFollowCurrentExplorerFloor &&
      previousTarget.currentPlayer === core.currentPlayer &&
      previousTarget.currentExplorerFloor !== currentExplorerFloor
    ) {
      setSelectedRoomMapFloor(currentExplorerFloor);
    }
    previousFloorFollowTargetRef.current = {
      currentPlayer: core.currentPlayer,
      currentExplorerFloor,
    };
  }, [
    core.currentPlayer,
    currentExplorerFloor,
    shouldFollowCurrentExplorerFloor,
  ]);
  const visibleMapRooms = React.useMemo(
    () => core.rooms.filter((room) => room.floor === selectedRoomMapFloor),
    [core.rooms, selectedRoomMapFloor],
  );
  const selectedRoomMapFloorTone = FLOOR_TONE[selectedRoomMapFloor];
  const roomCanvasLayout = React.useMemo(
    () =>
      resolveRoomCanvasLayout(
        visibleMapRooms,
        isPhoneLandscapeLayout ? core.currentExplorer.roomId : null,
      ),
    [core.currentExplorer.roomId, isPhoneLandscapeLayout, visibleMapRooms],
  );
  const roomCanvasStyle = roomCanvasLayout.style;
  const roomCanvasWidth =
    typeof roomCanvasStyle.width === "number"
      ? roomCanvasStyle.width
      : ROOM_CANVAS_MIN_WIDTH;
  const roomCanvasHeight =
    typeof roomCanvasStyle.height === "number"
      ? roomCanvasStyle.height
      : ROOM_CANVAS_MIN_HEIGHT;
  const previewRoom = React.useMemo(
    () => core.rooms.find((room) => room.id === roomPreviewId) ?? null,
    [core.rooms, roomPreviewId],
  );
  const previewRoomVisual = previewRoom
    ? resolveRoomTileVisual(previewRoom, previewRoom.state === "discovered")
    : null;
  const roomCanvasTransformStyle = React.useMemo(
    () => ({
      ...roomCanvasStyle,
      transformOrigin: isPhoneLandscapeLayout ? "center top" : "center center",
    }),
    [isPhoneLandscapeLayout, roomCanvasStyle],
  );

  const phaseItems = React.useMemo(
    () => [
      { id: "preHaunt", label: t("board.phase.preHaunt") },
      { id: "haunt", label: t("board.phase.haunt") },
      { id: "endgame", label: t("board.phase.endgame") },
    ],
    [t],
  );
  const phaseLabel = React.useMemo(
    () =>
      phaseItems.find((item) => item.id === core.phase)?.label ??
      t("board.phase.preHaunt"),
    [core.phase, phaseItems, t],
  );
  const deckItems = React.useMemo(() => buildDeckItems(core, t), [core, t]);
  const discardItems = React.useMemo(
    () => buildDiscardItems(core, t),
    [core, t],
  );
  const hauntRisk = React.useMemo(() => resolveBetrayalHauntRisk(core), [core]);
  const numberTracks = React.useMemo(
    () => resolveBetrayalNumberTracks(core),
    [core],
  );
  const hauntRiskTrack =
    numberTracks.find((track) => track.id === "haunt-risk") ?? null;
  const hauntRiskTrackMin = hauntRiskTrack?.min ?? 0;
  const hauntRiskTrackMax = hauntRiskTrack?.max ?? 9;
  const hauntRiskTrackValue = Math.max(
    hauntRiskTrackMin,
    Math.min(hauntRiskTrackMax, hauntRiskTrack?.value ?? hauntRisk.omenCount),
  );
  const hauntRiskTrackPositionPercent = hauntRiskTrack?.progressPercent ?? 0;
  const hauntRiskTrackSlots = Array.from(
    { length: Math.max(1, hauntRiskTrackMax - hauntRiskTrackMin + 1) },
    (_, index) => hauntRiskTrackMin + index,
  );
  const hauntRiskText = hauntRisk.hauntStarted
    ? t("board.status.hauntRiskStarted")
    : hauntRisk.nextOmenAutomatic
      ? t("board.status.hauntRiskLastOmenShort", {
          omenCount: hauntRisk.omenCount,
        })
      : t("board.status.hauntRiskShort", {
          omenCount: hauntRisk.omenCount,
        });
  const hauntRiskDetailText = hauntRisk.hauntStarted
    ? t("board.status.hauntRiskStartedDetail")
    : hauntRisk.nextOmenAutomatic
      ? t("board.status.hauntRiskLastOmenDetail", {
          omenCount: hauntRisk.omenCount,
        })
      : t("board.status.hauntRiskRuleDetail", {
          omenCount: hauntRisk.omenCount,
          diceCount: hauntRisk.nextRollDiceCount,
          threshold: hauntRisk.threshold,
        });
  const recentRollRerollOwner = React.useMemo(() => {
    if (!core.recentRoll || core.recentRoll.playerId !== viewerPlayerId) {
      return null;
    }
    const owner = allExplorers.find(
      (explorer) => explorer.playerId === core.recentRoll?.playerId,
    );
    if (!owner) {
      return null;
    }
    return owner.inventory.some((card) =>
      canUseRecentRollRerollItemForRecentRoll(core, owner.playerId, card.id),
    )
      ? owner
      : null;
  }, [allExplorers, core, viewerPlayerId]);
  const inventoryActionPlayerId =
    recentRollRerollOwner?.playerId ?? core.currentExplorer.playerId;
  const pendingDiscoveryInventoryCardIds = React.useMemo(() => {
    const pending = core.pendingCardResolutionQueue?.[0];
    if (!pending) {
      return new Set<string>();
    }
    const cardIds = new Set(
      (pending.processCards ?? [])
        .filter((card) => card.outcome === "gained" && Boolean(card.cardId))
        .map((card) => card.cardId!),
    );
    if (
      cardIds.size === 0 &&
      pending.cardId &&
      (pending.deckKind === "item" || pending.deckKind === "omen")
    ) {
      cardIds.add(pending.cardId);
    }
    return cardIds;
  }, [core.pendingCardResolutionQueue]);
  const visibleInventoryCards = (
    recentRollRerollOwner?.inventory ?? core.currentExplorerInventory
  ).filter((card) => !pendingDiscoveryInventoryCardIds.has(card.id));
  const selectedInventoryCard =
    visibleInventoryCards.find(
      (item) => item.id === previewState.selectedInventoryCardId,
    ) ?? null;
  const selectedInventoryUseEffect = selectedInventoryCard
    ? resolveUseEffect(selectedInventoryCard)
    : null;
  const selectedInventoryUseEffectMode =
    selectedInventoryUseEffect?.mode ?? null;
  const selectedInventoryHealTarget =
    selectedInventoryUseEffect?.mode === "healTraits"
      ? selectedInventoryUseEffect.target
      : null;
  const selectedInventoryRollTotalReplacementEffect =
    selectedInventoryUseEffect?.mode === "nextNonCombatTraitRollTotalReplacement"
      ? selectedInventoryUseEffect
      : null;
  const selectedInventoryReplacementRollTotal =
    selectedInventoryRollTotalReplacementEffect &&
    Number.isInteger(previewState.selectedInventoryReplacementRollTotal) &&
    previewState.selectedInventoryReplacementRollTotal >=
      selectedInventoryRollTotalReplacementEffect.minTotal &&
    previewState.selectedInventoryReplacementRollTotal <=
      selectedInventoryRollTotalReplacementEffect.maxTotal
      ? previewState.selectedInventoryReplacementRollTotal
      : null;
  const selectedInventoryReplacementRollTotalOptions =
    selectedInventoryRollTotalReplacementEffect
      ? Array.from(
          {
            length:
              selectedInventoryRollTotalReplacementEffect.maxTotal -
              selectedInventoryRollTotalReplacementEffect.minTotal +
              1,
          },
          (_, index) => selectedInventoryRollTotalReplacementEffect.minTotal + index,
        )
      : [];
  const previewInventoryCard =
    core.currentExplorerInventory.find(
      (item) => item.id === inventoryPreviewCardId,
    ) ?? null;
  const inventoryPreviewFrameWidth = React.useMemo(() => {
    if (runtimeViewport.width <= 0 || runtimeViewport.height <= 0) {
      return `min(84vw, ${INVENTORY_PREVIEW_MAX_WIDTH}px)`;
    }

    const availableWidth = Math.max(
      0,
      runtimeViewport.width -
        runtimeViewport.safeArea.left -
        runtimeViewport.safeArea.right,
    );
    const availableHeight = Math.max(
      0,
      runtimeViewport.height -
        runtimeViewport.safeArea.top -
        runtimeViewport.safeArea.bottom -
        INVENTORY_PREVIEW_VERTICAL_GUTTER,
    );
    const width = Math.min(
      INVENTORY_PREVIEW_MAX_WIDTH,
      availableWidth * INVENTORY_PREVIEW_VIEWPORT_WIDTH_RATIO,
      availableHeight * BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
    );

    return `${Math.max(96, width).toFixed(3)}px`;
  }, [
    runtimeViewport.height,
    runtimeViewport.safeArea.bottom,
    runtimeViewport.safeArea.left,
    runtimeViewport.safeArea.right,
    runtimeViewport.safeArea.top,
    runtimeViewport.width,
  ]);
  const inventoryGroups = {
    item: visibleInventoryCards.filter((item) => item.kind === "item"),
    omen: visibleInventoryCards.filter((item) => item.kind === "omen"),
  };
  const visibleActivityEntries = React.useMemo(
    () =>
      core.activityLog.filter(
        (entry) => !entry.id.startsWith("scenario-started-"),
      ),
    [core.activityLog],
  );
  const latestLogEntry = visibleActivityEntries[0] ?? null;
  const earlierLogEntries = React.useMemo(
    () => visibleActivityEntries.slice(1, 4),
    [visibleActivityEntries],
  );
  const normalMoveTargetRooms = React.useMemo(
    () => resolveMoveTargetRooms(core),
    [core],
  );
  const skeletonKeyMoveTargetRooms = React.useMemo(
    () => core.rooms.filter((room) => canUseSkeletonKeyForMove(core, room.id)),
    [core],
  );
  const skeletonKeyMoveTargetRoomIds = React.useMemo(
    () => new Set(skeletonKeyMoveTargetRooms.map((room) => room.id)),
    [skeletonKeyMoveTargetRooms],
  );
  const moveTargetRooms = React.useMemo(() => {
    const byId = new Map<string, BetrayalRoomNode>();
    for (const room of normalMoveTargetRooms) {
      byId.set(room.id, room);
    }
    for (const room of skeletonKeyMoveTargetRooms) {
      byId.set(room.id, room);
    }
    return [...byId.values()];
  }, [normalMoveTargetRooms, skeletonKeyMoveTargetRooms]);
  const moveTargetRoomIds = React.useMemo(
    () => new Set(moveTargetRooms.map((room) => room.id)),
    [moveTargetRooms],
  );
  const maskTargetRooms = React.useMemo(
    () => resolveMoveTargetRooms(core),
    [core],
  );
  const inventoryTargetRooms = React.useMemo(
    () => core.rooms.filter((room) => room.state === "discovered"),
    [core.rooms],
  );
  const maskTargetTokens = (() => {
    if (selectedInventoryUseEffectMode !== "moveOthersInRoom") {
      return [];
    }

    return [
      ...core.otherExplorers
        .filter(
          (explorer) =>
            explorer.roomId === core.currentExplorer.roomId &&
            !core.scenarioRuntime.deadExplorerPlayerIds.includes(
              explorer.playerId,
            ),
        )
        .map((explorer) => ({
          id: explorer.playerId,
          name: resolvePlayerName(
            explorer.playerId,
            explorer.displayName,
            matchData,
          ),
          kind: "explorer" as const,
        })),
      ...core.monsters
        .filter((monster) => monster.roomId === core.currentExplorer.roomId)
        .map((monster) => ({
          id: monster.id,
          name: monster.name,
          kind: "monster" as const,
        })),
    ];
  })();
  const selectedMaskTargetRoomIdsByTokenId = (() => {
    if (selectedInventoryUseEffectMode !== "moveOthersInRoom") {
      return {};
    }

    const validTargetRoomIds = new Set(maskTargetRooms.map((room) => room.id));
    return Object.fromEntries(
      maskTargetTokens.map((token) => {
        const selectedRoomId =
          previewState.selectedMaskTargetRoomIdsByTokenId[token.id];
        return [
          token.id,
          selectedRoomId && validTargetRoomIds.has(selectedRoomId)
            ? selectedRoomId
            : "",
        ];
      }),
    );
  })();
  const activeMaskTargetTokenId =
    selectedInventoryUseEffectMode === "moveOthersInRoom"
      ? maskTargetTokens.some(
          (token) => token.id === previewState.activeMaskTargetTokenId,
        )
        ? previewState.activeMaskTargetTokenId
        : (maskTargetTokens.find(
            (token) => !selectedMaskTargetRoomIdsByTokenId[token.id],
          )?.id ??
          maskTargetTokens[0]?.id ??
          null)
      : null;
  const selectedInventoryTargetRoomId =
    selectedInventoryUseEffectMode === "moveOthersInRoom"
      ? maskTargetTokens[0]
        ? (selectedMaskTargetRoomIdsByTokenId[maskTargetTokens[0].id] ?? null)
        : null
      : selectedInventoryUseEffectMode === "placeExplorer"
        ? inventoryTargetRooms.some(
            (room) => room.id === previewState.selectedInventoryTargetRoomId,
          )
          ? previewState.selectedInventoryTargetRoomId
          : null
        : null;
  const pendingEventChoice = core.pendingEventChoice;
  const isToothNecklaceEndTurnChoice =
    pendingEventChoice?.itemResolution === "tooth-necklace-end-turn";
  const pendingDamageAllocation = core.pendingDamageAllocation;
  const pendingDamageExplorer = pendingDamageAllocation
    ? (allExplorers.find(
        (explorer) => explorer.playerId === pendingDamageAllocation.playerId,
      ) ?? null)
    : null;
  const pendingDamageExplorerName = pendingDamageExplorer
    ? resolvePlayerName(
        pendingDamageExplorer.playerId,
        pendingDamageExplorer.displayName,
        matchData,
      )
    : "";
  const pendingDamageAllocationPhase: BetrayalCore["phase"] =
    pendingDamageAllocation?.allowSkull ? "haunt" : "preHaunt";
  const canUseBroochForPendingDamageAllocation =
    Boolean(
      pendingDamageAllocation?.damageReplacement &&
        !pendingDamageAllocation.forcedTraitSequence &&
        pendingDamageAllocation.damageKind !== "general",
    );
  const pendingDamageUsesBrooch =
    canUseBroochForPendingDamageAllocation &&
    previewState.useBroochForDamageAllocation;
  const pendingDamageAllocationAllowedTraits =
    pendingDamageUsesBrooch
      ? TRAIT_DAMAGE_ORDER
      : (pendingDamageAllocation?.allowedTraits ?? []);
  const pendingDamageResolvedKind =
    pendingDamageUsesBrooch ? "general" : pendingDamageAllocation?.damageKind;
  const selectedDamageAllocationTraits =
    pendingDamageAllocation && pendingDamageExplorer
      ? pruneSelectedDamageTraits(
          previewState.selectedDamageAllocationTraits,
          pendingDamageAllocationAllowedTraits,
          pendingDamageAllocation.amount,
          pendingDamageExplorer,
          pendingDamageAllocationPhase,
        )
      : [];
  const pendingDamageKindLabel =
    pendingDamageResolvedKind === "mental"
      ? t("board.status.damageKindMental")
      : pendingDamageResolvedKind === "general"
        ? t("board.status.damageKindGeneral")
        : t("board.status.damageKindPhysical");
  const pendingDamageOriginalKindLabel =
    pendingDamageAllocation?.damageKind === "mental"
      ? t("board.status.damageKindMental")
      : pendingDamageAllocation?.damageKind === "general"
        ? t("board.status.damageKindGeneral")
        : t("board.status.damageKindPhysical");
  const pendingDamageReductionAmount = pendingDamageAllocation
    ? Math.max(0, pendingDamageAllocation.originalAmount - pendingDamageAllocation.amount)
    : 0;
  const pendingDamageReductionCardNames = resolveDamageReductionCardNames(
    pendingDamageExplorer,
    pendingDamageAllocation?.damageKind,
  );
  const pendingDamageReductionSourceLabel =
    pendingDamageReductionCardNames.length > 0
      ? pendingDamageReductionCardNames.join("、")
      : t("board.status.damageAllocationReductionFallback");
  const pendingDamageAllocationReady =
    Boolean(pendingDamageAllocation && pendingDamageExplorer) &&
    selectedDamageAllocationTraits.length === pendingDamageAllocation?.amount;
  const isPendingDamageAllocationForViewer =
    pendingDamageAllocation?.playerId === viewerPlayerId;
  const pendingEventAcceptsUnsupportedHaunt =
    pendingEventChoice?.effect.mode === "optionalHauntRoll" &&
    !isBetrayalOptionalHauntRollRuntimeSupported(
      pendingEventChoice.effect.successHauntId,
    );
  const pendingEventActionEffect =
    pendingEventChoice && !pendingEventAcceptsUnsupportedHaunt
      ? resolveEventActionEffect(pendingEventChoice.effect, true)
      : null;
  const pendingEventDeclineEffect = pendingEventChoice
    ? resolveEventActionEffect(pendingEventChoice.effect, false)
    : null;
  const pendingEventAcceptTraitChoices = pendingEventActionEffect
    ? resolveEventTraitChoices(pendingEventActionEffect)
    : [];
  const pendingEventDeclineTraitChoices = pendingEventDeclineEffect
    ? resolveEventTraitChoices(pendingEventDeclineEffect)
    : [];
  const pendingEventTraitChoices = mergeEventTraitChoices(
    pendingEventAcceptTraitChoices,
    pendingEventDeclineTraitChoices,
  );
  const selectedEventTrait = pendingEventTraitChoices.includes(
    previewState.selectedEventTrait!,
  )
    ? previewState.selectedEventTrait
    : null;
  const pendingEventPreviewEffect = pendingEventActionEffect
    ? resolveEventPreviewEffect(
        core,
        pendingEventActionEffect,
        selectedEventTrait,
      )
    : null;
  const pendingEventTargetRooms = resolveEventTargetRooms(
    core,
    pendingEventPreviewEffect,
  );
  const selectedEventTargetRoomId = pendingEventTargetRooms.some(
    (room) => room.id === previewState.selectedEventTargetRoomId,
  )
    ? previewState.selectedEventTargetRoomId
    : null;
  const pendingEventDamageChoice = resolveEventGeneralDamageChoice(
    pendingEventPreviewEffect,
  );
  const shouldShowPendingEventDamageChoice =
    Boolean(pendingEventDamageChoice) &&
    (!pendingEventTargetRooms.length || Boolean(selectedEventTargetRoomId));
  const selectedEventDamageTraits = pendingEventDamageChoice
    ? pruneSelectedDamageTraits(
        previewState.selectedEventDamageTraits,
        pendingEventDamageChoice.allowedTraits,
        pendingEventDamageChoice.amount,
        core.currentExplorer,
        core.phase,
      )
    : [];
  const pendingEventItemChoice =
    pendingEventChoice?.effect.mode === "optionalItemEffect"
      ? pendingEventChoice.effect
      : null;
  const pendingEventItemChoiceCards = React.useMemo(
    () => resolveEventItemChoiceCards(core, pendingEventItemChoice),
    [core, pendingEventItemChoice],
  );
  const selectedEventCardId = pendingEventItemChoiceCards.some(
    (card) => card.id === previewState.selectedEventCardId,
  )
    ? previewState.selectedEventCardId
    : null;
  const pendingEventChoiceRoll =
    pendingEventChoice &&
    core.recentRoll &&
    (core.recentRoll.kind === "eventTraitCheck" ||
      core.recentRoll.kind === "eventDiceRoll") &&
    core.recentRoll.sourceTitle === pendingEventChoice.sourceTitle
      ? core.recentRoll
      : null;
  const pendingEventChoiceAllTraitCheck =
    pendingEventChoice &&
    core.recentAllTraitCheck &&
    core.recentAllTraitCheck.sourceTitle === pendingEventChoice.sourceTitle
      ? core.recentAllTraitCheck
      : null;
  const pendingEventChoiceHasResultPanel = Boolean(
    pendingEventChoiceRoll || pendingEventChoiceAllTraitCheck,
  );
  const pendingEventReady =
    Boolean(pendingEventChoice) &&
    !pendingEventAcceptsUnsupportedHaunt &&
    (!pendingEventItemChoice || Boolean(selectedEventCardId)) &&
    (!pendingEventAcceptTraitChoices.length || Boolean(selectedEventTrait)) &&
    (!pendingEventTargetRooms.length || Boolean(selectedEventTargetRoomId)) &&
    (!pendingEventDamageChoice ||
      selectedEventDamageTraits.length === pendingEventDamageChoice.amount);
  const pendingEventNeedsAcceptSelection =
    pendingEventAcceptTraitChoices.length > 0 ||
    Boolean(pendingEventItemChoice) ||
    pendingEventTargetRooms.length > 0 ||
    Boolean(pendingEventDamageChoice);
  const shouldShowPendingEventAcceptButton =
    Boolean(pendingEventChoice) &&
    (Boolean(pendingEventChoice.declineLabel) ||
      !pendingEventNeedsAcceptSelection);
  const pendingEventAwaitsMapTargetClick =
    pendingEventTargetRooms.length > 0 &&
    !selectedEventTargetRoomId &&
    (!pendingEventTraitChoices.length || Boolean(selectedEventTrait)) &&
    !pendingEventChoice?.declineLabel;
  const pendingEventFocusesMapTarget =
    pendingEventAwaitsMapTargetClick && pendingEventTraitChoices.length > 0;
  const pendingEventCanDecline =
    Boolean(pendingEventChoice?.declineLabel) &&
    (isToothNecklaceEndTurnChoice ||
      !pendingEventDeclineTraitChoices.length ||
      Boolean(selectedEventTrait));
  const explorableRoomSlots = React.useMemo(
    () => resolveExplorableRoomSlots(core),
    [core],
  );
  const explorableRoomSlotIds = React.useMemo(
    () => new Set(explorableRoomSlots.map((room) => room.id)),
    [explorableRoomSlots],
  );
  const crossFloorMoveTargetRooms = React.useMemo(
    () => moveTargetRooms.filter((room) => room.floor !== currentExplorerFloor),
    [currentExplorerFloor, moveTargetRooms],
  );
  const hasCrossFloorMoveTargets = crossFloorMoveTargetRooms.length > 0;
  const bloodFromStoneSetupPlacementPlan = React.useMemo(
    () => resolveBloodFromStoneSetupPlacementPlan(core),
    [core],
  );
  const bloodFromStoneSetupCandidateRoomIds = React.useMemo(
    () => new Set(bloodFromStoneSetupPlacementPlan.playerChoiceCandidateRoomIds),
    [bloodFromStoneSetupPlacementPlan.playerChoiceCandidateRoomIds],
  );
  const bloodFromStoneSetupCandidateRooms = React.useMemo(
    () =>
      bloodFromStoneSetupPlacementPlan.playerChoiceCandidateRoomIds
        .map((roomId) => core.rooms.find((room) => room.id === roomId) ?? null)
        .filter((room): room is BetrayalRoomNode => Boolean(room)),
    [bloodFromStoneSetupPlacementPlan.playerChoiceCandidateRoomIds, core.rooms],
  );
  const selectedBloodFromStoneStoneCherubRoomIds = React.useMemo(
    () =>
      previewState.selectedBloodFromStoneStoneCherubRoomIds
        .filter((roomId) => bloodFromStoneSetupCandidateRoomIds.has(roomId))
        .slice(0, bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount),
    [
      bloodFromStoneSetupCandidateRoomIds,
      bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
      previewState.selectedBloodFromStoneStoneCherubRoomIds,
    ],
  );
  const selectedBloodFromStoneStoneCherubRoomCountByRoomId = React.useMemo(() => {
    const counts = new Map<string, number>();
    selectedBloodFromStoneStoneCherubRoomIds.forEach((roomId) => {
      counts.set(roomId, (counts.get(roomId) ?? 0) + 1);
    });
    return counts;
  }, [selectedBloodFromStoneStoneCherubRoomIds]);
  const remainingBloodFromStoneSetupPlacementCount = Math.max(
    0,
    bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount -
      selectedBloodFromStoneStoneCherubRoomIds.length,
  );
  const isBloodFromStoneSetupPlacementMode =
    previewState.interactionMode === "bloodFromStoneSetupPlacement" &&
    bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount > 0;
  React.useEffect(() => {
    const needsExit =
      bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount <= 0 &&
      (previewState.interactionMode === "bloodFromStoneSetupPlacement" ||
        previewState.selectedBloodFromStoneStoneCherubRoomIds.length > 0);
    const needsPrune =
      selectedBloodFromStoneStoneCherubRoomIds.length !==
        previewState.selectedBloodFromStoneStoneCherubRoomIds.length ||
      selectedBloodFromStoneStoneCherubRoomIds.some(
        (roomId, index) =>
          roomId !== previewState.selectedBloodFromStoneStoneCherubRoomIds[index],
      );
    if (!needsExit && !needsPrune) {
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      interactionMode:
        previousState.interactionMode === "bloodFromStoneSetupPlacement" &&
        bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount <= 0
          ? "default"
          : previousState.interactionMode,
      selectedBloodFromStoneStoneCherubRoomIds:
        bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount <= 0
          ? []
          : selectedBloodFromStoneStoneCherubRoomIds,
    }));
  }, [
    bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
    previewState.interactionMode,
    previewState.selectedBloodFromStoneStoneCherubRoomIds,
    selectedBloodFromStoneStoneCherubRoomIds,
  ]);
  const roomMapFloors = (() => {
    const floors = new Set<BetrayalRoomNode["floor"]>(occupiedRoomMapFloors);
    floors.add(currentExplorerFloor);
    if (hasCrossFloorMoveTargets || previewState.interactionMode === "move") {
      for (const room of moveTargetRooms) {
        floors.add(room.floor);
      }
    }
    if (selectedInventoryUseEffectMode === "placeExplorer") {
      for (const room of inventoryTargetRooms) {
        floors.add(room.floor);
      }
    }
    if (selectedInventoryUseEffectMode === "moveOthersInRoom") {
      for (const room of maskTargetRooms) {
        floors.add(room.floor);
      }
    }
    if (previewState.interactionMode === "explore") {
      for (const room of explorableRoomSlots) {
        floors.add(room.floor);
      }
    }
    if (
      bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount > 0 ||
      previewState.interactionMode === "bloodFromStoneSetupPlacement"
    ) {
      for (const room of bloodFromStoneSetupCandidateRooms) {
        floors.add(room.floor);
      }
    }
    if (pendingEventTargetRooms.length > 0) {
      for (const room of pendingEventTargetRooms) {
        floors.add(room.floor);
      }
    }
    return ROOM_MAP_FLOOR_ORDER.filter((floor) => floors.has(floor));
  })();
  React.useEffect(() => {
    if (!roomMapFloors.includes(selectedRoomMapFloor)) {
      setSelectedRoomMapFloor(
        shouldFollowCurrentExplorerFloor
          ? currentExplorerFloor
          : viewerExplorerFloor,
      );
    }
  }, [
    currentExplorerFloor,
    roomMapFloors,
    selectedRoomMapFloor,
    shouldFollowCurrentExplorerFloor,
    viewerExplorerFloor,
  ]);
  const selectedRoomMapFloorIndex = roomMapFloors.indexOf(selectedRoomMapFloor);
  const upperRoomMapFloor =
    selectedRoomMapFloorIndex > 0
      ? roomMapFloors[selectedRoomMapFloorIndex - 1]
      : null;
  const lowerRoomMapFloor =
    selectedRoomMapFloorIndex >= 0 &&
    selectedRoomMapFloorIndex < roomMapFloors.length - 1
      ? roomMapFloors[selectedRoomMapFloorIndex + 1]
      : null;
  const roomSelectionTargetFloors = (() => {
    const floors = new Set<BetrayalRoomNode["floor"]>();
    if (selectedInventoryUseEffectMode === "placeExplorer") {
      for (const room of inventoryTargetRooms) {
        floors.add(room.floor);
      }
    }
    if (selectedInventoryUseEffectMode === "moveOthersInRoom") {
      for (const room of maskTargetRooms) {
        floors.add(room.floor);
      }
    }
    for (const room of pendingEventTargetRooms) {
      floors.add(room.floor);
    }
    if (isBloodFromStoneSetupPlacementMode) {
      for (const room of bloodFromStoneSetupCandidateRooms) {
        floors.add(room.floor);
      }
    }
    return floors;
  })();
  const upperRoomMapFloorHasSelectionTarget = upperRoomMapFloor
    ? roomSelectionTargetFloors.has(upperRoomMapFloor)
    : false;
  const lowerRoomMapFloorHasSelectionTarget = lowerRoomMapFloor
    ? roomSelectionTargetFloors.has(lowerRoomMapFloor)
    : false;
  const hasCrossFloorRoomSelectionTargets =
    upperRoomMapFloorHasSelectionTarget || lowerRoomMapFloorHasSelectionTarget;
  const canDeclareHolySymbolExplore = canUseHolySymbolForDiscovery(core);
  const useHolySymbolForExplore =
    previewState.useHolySymbolForExplore && canDeclareHolySymbolExplore;
  const nextDeckKind = React.useMemo(
    () =>
      resolveNextRoomDiscoveryDeckKind(core, {
        useHolySymbol: useHolySymbolForExplore,
      }),
    [core, useHolySymbolForExplore],
  );
  const canStartExploreSelection = Boolean(
    (core.phase === "preHaunt" || core.phase === "haunt") &&
    !core.turnEndedByDiscovery &&
    explorableRoomSlots.length > 0,
  );
  const canDeclareIdolExplore =
    canUseIdolToSkipEvent(core) && nextDeckKind === "event";
  const canDeclareTraitorEventSkip =
    resolveBetrayalTraitorPowerStatus(core).canIgnoreEventSymbols &&
    nextDeckKind === "event";
  const hasExploreDeclarationOptions = Boolean(
    (canDeclareHolySymbolExplore ||
      canDeclareIdolExplore ||
      canDeclareTraitorEventSkip) &&
      canStartExploreSelection,
  );
  const exploreDeclarationLabel =
    canDeclareTraitorEventSkip &&
    !canDeclareHolySymbolExplore &&
    !canDeclareIdolExplore
      ? t("board.inventory.traitorPower")
      : t("board.inventory.exploreDeclaration");
  const useIdolForExplore =
    previewState.useIdolForExplore && canDeclareIdolExplore;
  const ignoreEventSymbolWithTraitorPower =
    previewState.ignoreEventSymbolWithTraitorPower &&
    canDeclareTraitorEventSkip;
  const pendingRoomPlacementPreview =
    React.useMemo<BetrayalRoomPlacementPreview | null>(
      () =>
        previewState.pendingRoomPlacementSlotId
          ? resolveRoomPlacementPreview(core, {
              roomId: previewState.pendingRoomPlacementSlotId,
              useHolySymbol: useHolySymbolForExplore,
            })
          : null,
      [core, previewState.pendingRoomPlacementSlotId, useHolySymbolForExplore],
    );
  const pendingRoomOrientationOptions = React.useMemo(
    () => pendingRoomPlacementPreview?.orientationOptions ?? [],
    [pendingRoomPlacementPreview],
  );
  const selectedRoomOrientationOption = React.useMemo(() => {
    if (!pendingRoomPlacementPreview) {
      return null;
    }
    return (
      pendingRoomOrientationOptions.find(
        (option) =>
          option.orientationTurns === previewState.pendingRoomOrientationTurns,
      ) ??
      pendingRoomOrientationOptions.find(
        (option) =>
          option.orientationTurns ===
          pendingRoomPlacementPreview.defaultOrientationTurns,
      ) ??
      pendingRoomOrientationOptions[0] ??
      null
    );
  }, [
    pendingRoomOrientationOptions,
    pendingRoomPlacementPreview,
    previewState.pendingRoomOrientationTurns,
  ]);
  const selectedRoomOrientationTurns =
    selectedRoomOrientationOption?.orientationTurns ??
    pendingRoomPlacementPreview?.defaultOrientationTurns ??
    0;
  const pendingRoomTileAdjustmentOptions = React.useMemo(
    () =>
      pendingRoomPlacementPreview?.requiresTileAdjustment
        ? resolveRoomTileAdjustmentOptions(core, {
            roomId: pendingRoomPlacementPreview.slotId,
            orientationTurns: selectedRoomOrientationTurns,
            useHolySymbol: useHolySymbolForExplore,
          })
        : [],
    [
      core,
      pendingRoomPlacementPreview,
      selectedRoomOrientationTurns,
      useHolySymbolForExplore,
    ],
  );
  const selectedRoomTileAdjustmentOption = React.useMemo(() => {
    if (!previewState.pendingRoomTileAdjustment) {
      return null;
    }
    return (
      pendingRoomTileAdjustmentOptions.find((option) =>
        roomTileAdjustmentSelectionsMatch(
          option,
          previewState.pendingRoomTileAdjustment!,
        ),
      ) ?? null
    );
  }, [
    pendingRoomTileAdjustmentOptions,
    previewState.pendingRoomTileAdjustment,
  ]);
  const pendingRoomPlacementFailureText = previewState.pendingRoomPlacementFailure
    ? t("board.rooms.floorExhausted", {
        floor: resolveFloorLabel(previewState.pendingRoomPlacementFailure.floor),
      })
    : null;
  const pendingRoomPlacementAdjustmentText =
    pendingRoomPlacementPreview?.requiresTileAdjustment
      ? t("board.rooms.adjustTilesRequired")
      : null;
  const pendingRoomPlacementVisual =
    pendingRoomPlacementPreview?.room.visualId
      ? ROOM_VISUAL_BY_ID[pendingRoomPlacementPreview.room.visualId] ??
        BETRAYAL_ROOM_TILE_VISUALS.conservatory
      : null;
  const tradeTargets = React.useMemo(() => resolveTradeTargets(core), [core]);
  const canUseDogTrade = canUseDogForTrade(core);
  const dogTradeTargets = React.useMemo(
    () => resolveDogTradeTargets(core),
    [core],
  );
  const activeTradeTargets =
    canUseDogTrade && dogTradeTargets.length > 0
      ? dogTradeTargets
      : tradeTargets;
  const corpseLootTargets = React.useMemo(
    () => resolveCorpseLootTargets(core),
    [core],
  );
  const hasCorpseLootTargets = corpseLootTargets.length > 0;
  const selectedTradeTargetPlayerId = React.useMemo(
    () =>
      resolveSelectedTradeTargetPlayerId(
        activeTradeTargets,
        previewState.selectedTradeTargetPlayerId,
      ),
    [previewState.selectedTradeTargetPlayerId, activeTradeTargets],
  );
  const selectedTradeTarget = React.useMemo(
    () =>
      activeTradeTargets.find(
        (explorer) => explorer.playerId === selectedTradeTargetPlayerId,
      ) ?? null,
    [selectedTradeTargetPlayerId, activeTradeTargets],
  );
  const selectedTradeReturnCardIds = React.useMemo(() => {
    if (!selectedTradeTarget) {
      return [];
    }
    const targetInventoryIds = new Set(
      selectedTradeTarget.inventory.map((card) => card.id),
    );
    return previewState.selectedTradeReturnCardIds.filter((cardId) =>
      targetInventoryIds.has(cardId),
    );
  }, [previewState.selectedTradeReturnCardIds, selectedTradeTarget]);
  const selectedTradeReturnCards = React.useMemo(
    () =>
      selectedTradeTarget?.inventory.filter((card) =>
        selectedTradeReturnCardIds.includes(card.id),
      ) ?? [],
    [selectedTradeReturnCardIds, selectedTradeTarget],
  );
  const selectedTradeReturnCardNames = selectedTradeReturnCards
    .map((card) => card.name)
    .join("、");
  const selectedTradeGiveCardIds = React.useMemo(
    () =>
      resolveSelectedTradeGiveCardIds(
        core.currentExplorerInventory,
        previewState.selectedTradeGiveCardIds,
        core.usedCardIdsThisTurn,
      ),
    [
      core.currentExplorerInventory,
      core.usedCardIdsThisTurn,
      previewState.selectedTradeGiveCardIds,
    ],
  );
  const selectedTradeGiveCards = React.useMemo(
    () =>
      core.currentExplorerInventory.filter((card) =>
        selectedTradeGiveCardIds.includes(card.id),
      ),
    [core.currentExplorerInventory, selectedTradeGiveCardIds],
  );
  const selectedNormalTradeGiveCardNames = selectedTradeGiveCards
    .map((card) => card.name)
    .join("、");
  const selectedDogTradeCardIds = React.useMemo(
    () =>
      resolveSelectedDogTradeCardIds(
        core.currentExplorerInventory,
        previewState.selectedDogTradeCardIds,
      ),
    [core.currentExplorerInventory, previewState.selectedDogTradeCardIds],
  );
  const selectedDogTradeCards = React.useMemo(
    () =>
      core.currentExplorerInventory.filter((card) =>
        selectedDogTradeCardIds.includes(card.id),
      ),
    [core.currentExplorerInventory, selectedDogTradeCardIds],
  );
  const selectedDogTradeCardNames = selectedDogTradeCards
    .map((card) => card.name)
    .join("、");
  const dogTradeFlowActive = canUseDogTrade && dogTradeTargets.length > 0;
  const selectedTargetNeedsDogTrade = Boolean(
    selectedTradeTarget &&
    dogTradeTargets.some(
      (target) => target.playerId === selectedTradeTarget.playerId,
    ) &&
    !tradeTargets.some(
      (target) => target.playerId === selectedTradeTarget.playerId,
    ),
  );
  const useDogTrade =
    dogTradeFlowActive &&
    (selectedDogTradeCardIds.length > 0 ||
      (selectedTargetNeedsDogTrade && selectedTradeReturnCardIds.length > 0));
  const selectedTradeGiveCardNames = useDogTrade
    ? selectedDogTradeCardNames
    : selectedNormalTradeGiveCardNames;
  const selectedTradeGiveText = selectedTradeGiveCardNames;
  const selectedTradeReturnText = selectedTradeReturnCardNames;
  const tradeReturnSelectorLabel = t("board.status.tradeReturnLabel");
  const isTradeOrLootTargetSelectionActive =
    core.recommendedAction === "trade" ||
    previewState.tradeSelectionTouched ||
    Boolean(selectedInventoryCard) ||
    selectedTradeGiveCardIds.length > 0 ||
    selectedDogTradeCardIds.length > 0 ||
    selectedTradeReturnCardIds.length > 0;
  const attackWeaponCardStatuses = React.useMemo(
    () => resolveAttackWeaponCardStatuses(core),
    [core],
  );
  const attackWeaponCards = React.useMemo(
    () =>
      attackWeaponCardStatuses
        .filter((status) => status.canUse)
        .map((status) => status.card),
    [attackWeaponCardStatuses],
  );
  const dynamiteAttackWeaponCard = React.useMemo(
    () =>
      attackWeaponCards.find(
        (card) => resolveInventoryEffectId(card.id) === "dynamite",
      ) ?? null,
    [attackWeaponCards],
  );
  const selectedAttackWeaponCardId = attackWeaponCards.some(
    (card) => card.id === previewState.selectedAttackWeaponCardId,
  )
    ? previewState.selectedAttackWeaponCardId
    : null;
  const selectedAttackWeaponEffectId = selectedAttackWeaponCardId
    ? resolveInventoryEffectId(selectedAttackWeaponCardId)
    : null;
  const selectedAttackWeaponCardIdRef = React.useRef<string | null>(null);
  React.useLayoutEffect(() => {
    selectedAttackWeaponCardIdRef.current = selectedAttackWeaponCardId;
  }, [selectedAttackWeaponCardId]);
  const selectedAttackTargetPlayerIds = React.useMemo(
    () =>
      resolveBetrayalAttackTargetPlayerIds(core, selectedAttackWeaponCardId),
    [core, selectedAttackWeaponCardId],
  );
  const attackDeclarationTargetPlayerIds = React.useMemo(() => {
    const traitorIds = new Set<string>();
    const heroIds = new Set<string>();
    const mergeTargets = (
      targets: ReturnType<typeof resolveBetrayalAttackTargetPlayerIds>,
    ) => {
      if (targets.traitorPlayerId) {
        traitorIds.add(targets.traitorPlayerId);
      }
      targets.heroPlayerIds.forEach((playerId) => heroIds.add(playerId));
    };

    mergeTargets(resolveBetrayalAttackTargetPlayerIds(core, null));
    attackWeaponCards.forEach((card) => {
      mergeTargets(resolveBetrayalAttackTargetPlayerIds(core, card.id));
    });

    return {
      traitorPlayerId: Array.from(traitorIds)[0] ?? null,
      heroPlayerIds: Array.from(heroIds),
    };
  }, [attackWeaponCards, core]);
  const healTargetExplorers = (() => {
    if (
      selectedInventoryUseEffectMode !== "healTraits" ||
      selectedInventoryHealTarget !== "selfOrSameRoomExplorer"
    ) {
      return [];
    }

    return [
      core.currentExplorer,
      ...core.otherExplorers.filter(
        (explorer) =>
          explorer.roomId === core.currentExplorer.roomId &&
          !core.scenarioRuntime.deadExplorerPlayerIds.includes(
            explorer.playerId,
          ),
      ),
    ];
  })();
  const selectedInventoryTargetPlayerId =
    selectedInventoryUseEffectMode === "healTraits" &&
    selectedInventoryHealTarget === "selfOrSameRoomExplorer"
      ? healTargetExplorers.some(
          (explorer) =>
            explorer.playerId === previewState.selectedInventoryTargetPlayerId,
        )
        ? previewState.selectedInventoryTargetPlayerId
        : null
      : null;
  const selectedInventoryHealPreviewExplorer =
    selectedInventoryUseEffect?.mode === "healTraits"
      ? selectedInventoryUseEffect.target === "self"
        ? core.currentExplorer
        : healTargetExplorers.find(
            (explorer) =>
              explorer.playerId === selectedInventoryTargetPlayerId,
          ) ?? null
      : null;
  const selectedInventoryHealPreviewTraits =
    selectedInventoryUseEffect?.mode === "healTraits"
      ? selectedInventoryUseEffect.traits
      : [];
  React.useEffect(() => {
    if (inventoryPreviewCardId && !previewInventoryCard) {
      setInventoryPreviewCardId(null);
    }
  }, [inventoryPreviewCardId, previewInventoryCard]);
  const selectedCorpseLootTargetPlayerId = corpseLootTargets.some(
    (explorer) =>
      explorer.playerId === previewState.selectedTradeTargetPlayerId,
  )
    ? previewState.selectedTradeTargetPlayerId
    : null;
  const selectedCorpseLootTarget = React.useMemo(
    () =>
      corpseLootTargets.find(
        (explorer) => explorer.playerId === selectedCorpseLootTargetPlayerId,
      ) ?? null,
    [corpseLootTargets, selectedCorpseLootTargetPlayerId],
  );
  const selectedCorpseLootCardId = selectedCorpseLootTarget?.inventory.some(
    (card) => card.id === previewState.selectedCorpseLootCardId,
  )
    ? previewState.selectedCorpseLootCardId
    : null;
  const selectedTradeTargetName = selectedTradeTarget
    ? resolvePlayerName(
        selectedTradeTarget.playerId,
        selectedTradeTarget.displayName,
        matchData,
      )
    : null;
  const dustRuntime = core.scenarioRuntime.dust ?? null;
  const visibleHauntTokensByRoomId = React.useMemo(() => {
    const tokensByRoomId = new Map<string, BetrayalHauntTokenInstanceSummary[]>();
    for (const token of resolveBetrayalHauntTokenInstances(core)) {
      const isBoardVisibleHauntToken =
        token.id.startsWith("dust-research-token-") ||
        token.id.startsWith("mummy-");
      if (
        !token.roomId ||
        token.visibility !== "public" ||
        !isBoardVisibleHauntToken
      ) {
        continue;
      }
      const roomTokens = tokensByRoomId.get(token.roomId) ?? [];
      roomTokens.push(token);
      tokensByRoomId.set(token.roomId, roomTokens);
    }
    return tokensByRoomId;
  }, [core]);
  const isDustHauntActive = Boolean(
    core.phase === "haunt" &&
    core.scenarioRuntime.hauntCardNumber === 3 &&
    dustRuntime,
  );
  const isCurrentExplorerDead =
    core.scenarioRuntime.deadExplorerPlayerIds.includes(
      core.currentExplorer.playerId,
    );
  const dustSameRoomLivingTargets = React.useMemo(
    () =>
      isDustHauntActive && !isCurrentExplorerDead
        ? core.otherExplorers.filter(
            (explorer) =>
              explorer.roomId === core.currentExplorer.roomId &&
              !core.scenarioRuntime.deadExplorerPlayerIds.includes(
                explorer.playerId,
              ),
          )
        : [],
    [
      core.currentExplorer.roomId,
      core.otherExplorers,
      core.scenarioRuntime.deadExplorerPlayerIds,
      isCurrentExplorerDead,
      isDustHauntActive,
    ],
  );
  const dustTargetPlayerIds = React.useMemo(
    () => new Set(dustSameRoomLivingTargets.map((target) => target.playerId)),
    [dustSameRoomLivingTargets],
  );
  const isDustSicknessExchangeAvailable = Boolean(
    dustSameRoomLivingTargets.length > 0 &&
    !core.usedCardIdsThisTurn.includes("sickness-exchange"),
  );
  const isDustSicknessExchangeMode =
    previewState.interactionMode === "sicknessExchange" &&
    isDustSicknessExchangeAvailable;
  const selectedDustTargetPlayerId =
    previewState.selectedTradeTargetPlayerId &&
    dustTargetPlayerIds.has(previewState.selectedTradeTargetPlayerId)
      ? previewState.selectedTradeTargetPlayerId
      : null;
  const selectedDustTarget = selectedDustTargetPlayerId
    ? (dustSameRoomLivingTargets.find(
        (explorer) => explorer.playerId === selectedDustTargetPlayerId,
      ) ?? null)
    : null;
  const selectedDustTargetName = selectedDustTarget
    ? resolvePlayerName(
        selectedDustTarget.playerId,
        selectedDustTarget.displayName,
        matchData,
      )
    : null;
  const pendingTradeAgreement = core.pendingTradeAgreement;
  const pendingSicknessExchange = dustRuntime?.pendingSicknessExchange ?? null;
  const viewerDustSicknessValues = React.useMemo(
    () =>
      (dustRuntime?.sicknessTokensByPlayerId[viewerPlayerId] ?? []).map(
        (token) =>
          token.value === null
            ? t("board.status.hauntDustProgressOwnSicknessUnknown")
            : String(token.value),
      ),
    [dustRuntime, t, viewerPlayerId],
  );
  const viewerPermanentInfectionValue =
    dustRuntime?.permanentTraitorPlayerIds.includes(viewerPlayerId)
      ? t("board.status.hauntDustProgressPermanentInfectionYes")
      : t("board.status.hauntDustProgressPermanentInfectionNo");
  const dustProgressItems = React.useMemo(() => {
    if (!isDustHauntActive || !dustRuntime) {
      return [];
    }
    const currentExplorerSicknessCount =
      dustRuntime.sicknessTokensByPlayerId[core.currentExplorer.playerId]
        ?.length ?? 0;
    return [
      {
        id: "research",
        label: t("board.haunts.dust.progress.research"),
        value: t("board.status.hauntDustProgressResearchValue", {
          count: dustRuntime.researchRoomIds.length,
        }),
      },
      {
        id: "sickness",
        label: t("board.haunts.dust.progress.sickness"),
        value: t("board.status.hauntDustProgressSicknessValue", {
          count: currentExplorerSicknessCount,
        }),
      },
      ...(viewerDustSicknessValues.length > 0
        ? [
            {
              id: "own-sickness",
              label: t("board.status.hauntDustProgressOwnSicknessLabel"),
              value: viewerDustSicknessValues.join(" / "),
            },
            {
              id: "permanent-infection",
              label: t(
                "board.status.hauntDustProgressPermanentInfectionLabel",
              ),
              value: viewerPermanentInfectionValue,
            },
          ]
        : []),
      {
        id: "exchange",
        label: t("board.haunts.dust.progress.exchange"),
        value: isDustSicknessExchangeAvailable
          ? t("board.status.hauntDustProgressExchangeAvailable")
          : t("board.status.hauntDustProgressExchangeUnavailable"),
      },
    ];
  }, [
    core.currentExplorer.playerId,
    dustRuntime,
    isDustHauntActive,
    isDustSicknessExchangeAvailable,
    t,
    viewerDustSicknessValues,
    viewerPermanentInfectionValue,
  ]);
  const pendingTradeRequester = pendingTradeAgreement
    ? (allExplorers.find(
        (explorer) => explorer.playerId === pendingTradeAgreement.playerId,
      ) ?? null)
    : null;
  const pendingTradeTarget = pendingTradeAgreement
    ? (allExplorers.find(
        (explorer) =>
          explorer.playerId === pendingTradeAgreement.targetPlayerId,
      ) ?? null)
    : null;
  const pendingTradeRequesterName = pendingTradeRequester
    ? resolvePlayerName(
        pendingTradeRequester.playerId,
        pendingTradeRequester.displayName,
        matchData,
      )
    : "";
  const pendingTradeTargetName = pendingTradeTarget
    ? resolvePlayerName(
        pendingTradeTarget.playerId,
        pendingTradeTarget.displayName,
        matchData,
      )
    : "";
  const pendingTradeCardNames = pendingTradeAgreement
    ? pendingTradeAgreement.cardIds
        .map(
          (cardId) =>
            pendingTradeRequester?.inventory.find((card) => card.id === cardId)
              ?.name,
        )
        .filter((name): name is string => Boolean(name))
        .join("、")
    : "";
  const pendingTradeReturnCardNames = pendingTradeAgreement
    ? pendingTradeAgreement.targetCardIds
        .map(
          (cardId) =>
            pendingTradeTarget?.inventory.find((card) => card.id === cardId)
              ?.name,
        )
        .filter((name): name is string => Boolean(name))
        .join("、")
    : "";
  const pendingTradeGiveText = pendingTradeAgreement
    ? pendingTradeAgreement.cardIds.length > 0
      ? pendingTradeCardNames || t("board.status.tradeAgreementUnknownCards")
      : ""
    : "";
  const pendingTradeReturnText = pendingTradeAgreement
    ? pendingTradeAgreement.targetCardIds.length > 0
      ? pendingTradeReturnCardNames ||
        t("board.status.tradeAgreementUnknownCards")
      : ""
    : "";
  const isPendingTradeForViewer =
    pendingTradeAgreement?.targetPlayerId === viewerPlayerId;
  const isPendingTradeFromViewer =
    pendingTradeAgreement?.playerId === viewerPlayerId;
  const pendingSicknessRequester = pendingSicknessExchange
    ? (allExplorers.find(
        (explorer) =>
          explorer.playerId === pendingSicknessExchange.requesterPlayerId,
      ) ?? null)
    : null;
  const pendingSicknessTarget = pendingSicknessExchange
    ? (allExplorers.find(
        (explorer) =>
          explorer.playerId === pendingSicknessExchange.targetPlayerId,
      ) ?? null)
    : null;
  const pendingSicknessRequesterName = pendingSicknessRequester
    ? resolvePlayerName(
        pendingSicknessRequester.playerId,
        pendingSicknessRequester.displayName,
        matchData,
      )
    : "";
  const pendingSicknessTargetName = pendingSicknessTarget
    ? resolvePlayerName(
        pendingSicknessTarget.playerId,
        pendingSicknessTarget.displayName,
        matchData,
      )
    : "";
  const isPendingSicknessForViewer =
    pendingSicknessExchange?.targetPlayerId === viewerPlayerId;
  const isPendingSicknessFromViewer =
    pendingSicknessExchange?.requesterPlayerId === viewerPlayerId;
  const helpingHandsPendingReward =
    resolveHelpingHandsPendingAttackReward(core);
  const helpingHandsRewardAttacker = helpingHandsPendingReward
    ? (allExplorers.find(
        (explorer) =>
          explorer.playerId === helpingHandsPendingReward.attackerPlayerId,
      ) ?? null)
    : null;
  const helpingHandsRewardDefender = helpingHandsPendingReward
    ? (allExplorers.find(
        (explorer) =>
          explorer.playerId === helpingHandsPendingReward.defenderPlayerId,
      ) ?? null)
    : null;
  const helpingHandsRewardAttackerName = helpingHandsRewardAttacker
    ? resolvePlayerName(
        helpingHandsRewardAttacker.playerId,
        helpingHandsRewardAttacker.displayName,
        matchData,
      )
    : "";
  const helpingHandsRewardDefenderName = helpingHandsRewardDefender
    ? resolvePlayerName(
        helpingHandsRewardDefender.playerId,
        helpingHandsRewardDefender.displayName,
        matchData,
      )
    : "";
  const helpingHandsStealableCards = helpingHandsPendingReward
    ? resolveHelpingHandsStealableCards(
        core,
        helpingHandsPendingReward.defenderPlayerId,
      )
    : [];
  const isHelpingHandsRewardChooser =
    helpingHandsPendingReward?.attackerPlayerId ===
    core.currentExplorer.playerId;
  const mummyPendingReward = resolveMummyPendingAttackReward(core);
  const mummyRewardController = mummyPendingReward
    ? (allExplorers.find(
        (explorer) =>
          explorer.playerId === mummyPendingReward.controllerPlayerId,
      ) ?? null)
    : null;
  const mummyRewardDefender = mummyPendingReward
    ? (allExplorers.find(
        (explorer) =>
          explorer.playerId === mummyPendingReward.defenderPlayerId,
      ) ?? null)
    : null;
  const mummyRewardControllerName = mummyRewardController
    ? resolvePlayerName(
        mummyRewardController.playerId,
        mummyRewardController.displayName,
        matchData,
      )
    : "";
  const mummyRewardDefenderName = mummyRewardDefender
    ? resolvePlayerName(
        mummyRewardDefender.playerId,
        mummyRewardDefender.displayName,
        matchData,
      )
    : "";
  const mummyStealableCards = mummyPendingReward
    ? resolveMummyStealableCards(core, mummyPendingReward.defenderPlayerId)
    : [];
  const mummyStealableCardIdSet = new Set(
    mummyStealableCards.map((card) => card.id),
  );
  const mummyUnavailableStealTargetCount = mummyPendingReward
    ? mummyPendingReward.stealableCardIds.filter(
        (cardId) => !mummyStealableCardIdSet.has(cardId),
      ).length
    : 0;
  const isMummyRewardChooser =
    mummyPendingReward?.controllerPlayerId === core.currentExplorer.playerId;
  const hasPendingPlayerAgreement = Boolean(
    pendingTradeAgreement ||
      pendingSicknessExchange ||
      mummyPendingReward ||
      helpingHandsPendingReward ||
      pendingDamageAllocation,
  );
  const hasUsedTradeThisTurn = core.tradeUsedThisTurnPlayerIds.includes(
    core.currentExplorer.playerId,
  );
  const tradeSelectionReady = Boolean(
    selectedTradeTarget &&
    (selectedTradeGiveCardIds.length > 0 ||
      selectedDogTradeCardIds.length > 0 ||
      selectedTradeReturnCardIds.length > 0),
  );
  const hasTradeDraftSelection =
    selectedTradeGiveCardIds.length > 0 ||
    selectedDogTradeCardIds.length > 0 ||
    selectedTradeReturnCardIds.length > 0 ||
    Boolean(selectedCorpseLootTarget);
  const shouldStartDustSicknessExchange =
    isDustSicknessExchangeAvailable && !hasTradeDraftSelection;
  const shouldShowInlineTradeConfirm = Boolean(
    !pendingTradeAgreement &&
    !pendingSicknessExchange &&
    !mummyPendingReward &&
    !helpingHandsPendingReward &&
    !isDustSicknessExchangeMode &&
    core.recommendedAction === "trade" &&
    !hasUsedTradeThisTurn &&
    tradeSelectionReady,
  );
  const hasTradeOfferCards = core.currentExplorerInventory.some(
    (card) => !core.usedCardIdsThisTurn.includes(card.id),
  );
  const hasTradeReturnCards = activeTradeTargets.some((target) =>
    target.inventory.some(
      (card) => !core.usedCardIdsThisTurn.includes(card.id),
    ),
  );
  const hasAnyTradeSelectableCards = hasTradeOfferCards || hasTradeReturnCards;
  const selectedCardUsedThisTurn = selectedInventoryCard
    ? core.usedCardIdsThisTurn.includes(selectedInventoryCard.id)
    : false;
  const lastUsedInventoryCardStillUsed =
    previewState.lastUsedInventoryCardId !== null &&
    core.usedCardIdsThisTurn.includes(previewState.lastUsedInventoryCardId);
  const selectedCardCanUseRecentRollRerollItem = selectedInventoryCard
    ? canUseRecentRollRerollItemForRecentRoll(
        core,
        inventoryActionPlayerId,
        selectedInventoryCard.id,
      )
    : false;
  const selectedCardSpecialActionStatus = selectedInventoryCard
    ? resolveBetrayalPossessionSpecialActionStatus(
        core,
        selectedInventoryCard.id,
      )
    : null;
  const selectedCardRecentRollRerollDieIndices =
    selectedInventoryCard && core.recentRoll
      ? resolveRecentRollRerollSelectableDieIndices(
          core.recentRoll,
          selectedInventoryCard.id,
        )
      : [];
  const recentRollRerollSelection =
    selectedCardCanUseRecentRollRerollItem && core.recentRoll
      ? {
          promptLabel: t("board.inventory.rollRerollItem"),
          allowedDieIndices: selectedCardRecentRollRerollDieIndices,
          getDieActionLabel: (dieIndex: number) =>
            t("board.inventory.rerollDie", { index: dieIndex + 1 }),
          onSelectDie: (dieIndex: number) => {
            setPreviewState((previousState) => ({
              ...previousState,
              selectedRollModifierDieIndex: dieIndex,
            }));
          },
        }
      : null;
  const selectedRollModifierCard =
    selectedCardCanUseRecentRollRerollItem && selectedInventoryCard
      ? selectedInventoryCard
      : null;
  const selectedRollModifierCardId = selectedRollModifierCard?.id ?? null;
  const selectedRollModifierDieIndex = previewState.selectedRollModifierDieIndex;
  const selectedRollModifierCanConfirm = Boolean(
    selectedRollModifierCard &&
      selectedRollModifierDieIndex !== null &&
      selectedCardRecentRollRerollDieIndices.includes(selectedRollModifierDieIndex),
  );
  const confirmSelectedRollModifier = React.useCallback(() => {
    if (selectedRollModifierCardId === null || selectedRollModifierDieIndex === null) {
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM, {
      cardId: selectedRollModifierCardId,
      dieIndex: selectedRollModifierDieIndex,
    });
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedInventoryCardId: null,
      selectedRollModifierDieIndex: null,
    }));
  }, [
    dispatchCommand,
    selectedRollModifierCardId,
    selectedRollModifierDieIndex,
  ]);
  const finalizePendingEventRoll = React.useCallback(() => {
    const pending = core.pendingEventRollResolution;
    if (!pending) {
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, {
      rollId: pending.rollId,
    });
  }, [core.pendingEventRollResolution, dispatchCommand]);
  const rollModifierCardIds = new Set(
    visibleInventoryCards
      .filter((card) =>
        canUseRecentRollRerollItemForRecentRoll(
          core,
          inventoryActionPlayerId,
          card.id,
        ),
      )
      .map((card) => card.id),
  );
  const selectedCardNeedsTargetRoom =
    selectedInventoryUseEffectMode === "moveOthersInRoom";
  const selectedCardNeedsPlaceRoom =
    selectedInventoryUseEffectMode === "placeExplorer";
  const selectedCardNeedsHealTarget =
    selectedInventoryUseEffectMode === "healTraits" &&
    selectedInventoryHealTarget === "selfOrSameRoomExplorer" &&
    healTargetExplorers.length > 0;
  const selectedCardNeedsReplacementRollTotal =
    selectedInventoryUseEffectMode === "nextNonCombatTraitRollTotalReplacement";
  const selectedCardBlockedBySpecialActionStatus = Boolean(
    selectedInventoryCard &&
      !selectedCardCanUseRecentRollRerollItem &&
      selectedCardSpecialActionStatus &&
      !selectedCardSpecialActionStatus.canUse,
  );
  const selectedCardMissingTarget =
    (selectedCardNeedsPlaceRoom && !selectedInventoryTargetRoomId) ||
    (selectedCardNeedsHealTarget && !selectedInventoryTargetPlayerId) ||
    (selectedCardNeedsReplacementRollTotal &&
      selectedInventoryReplacementRollTotal === null) ||
    (selectedCardNeedsTargetRoom &&
      (maskTargetTokens.length === 0 ||
        maskTargetTokens.some(
          (token) => !selectedMaskTargetRoomIdsByTokenId[token.id],
        )));
  const selectedCardUseDisabled =
    !selectedInventoryCard ||
    Boolean(
      selectedCardBlockedBySpecialActionStatus || selectedCardMissingTarget,
    );
  const selectedCardUseDisabledReason = (() => {
    if (!selectedInventoryCard) {
      return t("board.status.noSelectedCard");
    }
    if (selectedCardBlockedBySpecialActionStatus) {
      if (!selectedCardSpecialActionStatus?.active) {
        return t("board.status.cardNoActiveEffect");
      }
      if (selectedCardSpecialActionStatus.usedThisTurn) {
        return t("board.status.cardUsedThisTurn");
      }
      if (
        !selectedCardSpecialActionStatus.availableAtTurnStart ||
        selectedCardSpecialActionStatus.receivedThisTurn
      ) {
        return t("board.status.cardUnavailableThisTurn");
      }
      return (
        selectedCardSpecialActionStatus.reason ??
        t("board.status.cardCannotUseNow")
      );
    }
    if (selectedCardMissingTarget) {
      if (
        selectedCardNeedsReplacementRollTotal &&
        selectedInventoryReplacementRollTotal === null
      ) {
        return "请选择天使之羽的替代投骰结果。";
      }
      return t("board.status.cardNeedsTarget");
    }
    return null;
  })();
  const tradeStatusText = mummyPendingReward
    ? isMummyRewardChooser
      ? t("board.status.mummyRewardChoose", {
          player: mummyRewardDefenderName,
          damage: mummyPendingReward.damageToHero,
        })
      : t("board.status.mummyRewardWaiting", {
          player: mummyRewardControllerName,
        })
    : helpingHandsPendingReward
    ? isHelpingHandsRewardChooser
      ? t("board.status.helpingHandsRewardChoose", {
          player: helpingHandsRewardDefenderName,
          damage: helpingHandsPendingReward.damageToDefender,
        })
      : t("board.status.helpingHandsRewardWaiting", {
          player: helpingHandsRewardAttackerName,
        })
    : pendingSicknessExchange
    ? isPendingSicknessForViewer
      ? t("board.status.sicknessExchangeIncoming", {
          player: pendingSicknessRequesterName,
        })
      : t("board.status.sicknessExchangeWaiting", {
          player: pendingSicknessTargetName,
        })
    : isDustSicknessExchangeMode
      ? selectedDustTargetName
        ? t("board.status.sicknessExchangeTarget", {
            player: selectedDustTargetName,
          })
        : t("board.status.sicknessExchangeChoose")
      : shouldStartDustSicknessExchange
        ? t("board.status.sicknessExchangeTargetsAvailable", {
            count: dustSameRoomLivingTargets.length,
          })
        : pendingTradeAgreement
          ? isPendingTradeForViewer
            ? t("board.status.tradeAgreementIncoming", {
                player: pendingTradeRequesterName,
              })
            : t("board.status.tradeFlowWaiting", {
                player: pendingTradeTargetName,
              })
          : hasUsedTradeThisTurn
            ? t("board.status.tradeUsedThisTurn")
          : selectedTradeTarget
            ? t("board.status.tradeTarget", {
                player: selectedTradeTargetName,
              })
            : selectedCorpseLootTarget
              ? t("board.status.lootTarget", {
                  player: resolvePlayerName(
                    selectedCorpseLootTarget.playerId,
                    selectedCorpseLootTarget.displayName,
                    matchData,
                  ),
                })
              : hasCorpseLootTargets
                ? t("board.status.lootTargetsAvailable", {
                    count: corpseLootTargets.length,
                  })
                : activeTradeTargets.length > 0
                  ? dogTradeFlowActive
                    ? t("board.status.dogTradeTargetsAvailable", {
                        count: activeTradeTargets.length,
                      })
                    : t("board.status.tradeTargetsAvailable", {
                        count: activeTradeTargets.length,
                      })
                  : t("board.status.noTradeTargets");
  const tradeInstructionText = (() => {
    if (pendingSicknessExchange) {
      return isPendingSicknessForViewer
        ? t("board.status.sicknessExchangeIncomingDetail", {
            player: pendingSicknessRequesterName,
          })
        : t("board.status.sicknessExchangeRequestSent", {
            player: pendingSicknessTargetName,
          });
    }
    if (isDustSicknessExchangeMode) {
      return selectedDustTargetName
        ? t("board.status.sicknessExchangeTarget", {
            player: selectedDustTargetName,
          })
        : t("board.status.sicknessExchangeChoose");
    }
    if (shouldStartDustSicknessExchange) {
      return t("board.status.sicknessExchangeStart");
    }
    if (pendingTradeAgreement) {
      return isPendingTradeForViewer
        ? pendingTradeAgreement.targetCardIds.length > 0
          ? pendingTradeAgreement.cardIds.length > 0
            ? t("board.status.tradeAgreementDetailExchange", {
                player: pendingTradeRequesterName,
                give: pendingTradeGiveText,
                take: pendingTradeReturnText,
              })
            : t("board.status.tradeAgreementDetailRequestOnly", {
                player: pendingTradeRequesterName,
                take: pendingTradeReturnText,
              })
          : t("board.status.tradeAgreementDetailNoReturn", {
              player: pendingTradeRequesterName,
              give: pendingTradeGiveText,
            })
        : pendingTradeAgreement.targetCardIds.length > 0
          ? pendingTradeAgreement.cardIds.length > 0
            ? t("board.status.tradeRequestSentExchange", {
                player: pendingTradeTargetName,
                give: pendingTradeGiveText,
                take: pendingTradeReturnText,
              })
            : t("board.status.tradeRequestSentRequestOnly", {
                player: pendingTradeTargetName,
                take: pendingTradeReturnText,
              })
          : t("board.status.tradeRequestSentNoReturn", {
              player: pendingTradeTargetName,
              give: pendingTradeGiveText,
            });
    }
    if (hasUsedTradeThisTurn) {
      return t("board.status.tradeUsedThisTurn");
    }
    if (dogTradeFlowActive) {
      if (
        selectedTradeTarget &&
        (selectedDogTradeCardIds.length > 0 ||
          selectedTradeReturnCardIds.length > 0)
      ) {
        return selectedTradeReturnCardIds.length > 0
          ? selectedDogTradeCardIds.length > 0
            ? t("board.status.dogTradeFlowReadyExchange", {
                give: selectedTradeGiveText,
                take: selectedTradeReturnText,
                player: selectedTradeTargetName,
              })
            : t("board.status.dogTradeFlowReadyRequestOnly", {
                take: selectedTradeReturnText,
                player: selectedTradeTargetName,
              })
          : t("board.status.dogTradeFlowReadyNoReturn", {
              give: selectedTradeGiveText,
              player: selectedTradeTargetName,
            });
      }
      if (selectedDogTradeCardIds.length > 0) {
        return t("board.status.dogTradeFlowNeedTarget", {
          card: selectedDogTradeCardNames,
        });
      }
      if (selectedTradeTarget) {
        return t("board.status.dogTradeFlowNeedSelection", {
          player: selectedTradeTargetName,
        });
      }
      return t("board.status.dogTradeFlowStart");
    }
    if (
      selectedTradeTarget &&
      (selectedTradeGiveCardIds.length > 0 ||
        selectedTradeReturnCardIds.length > 0)
    ) {
      return selectedTradeReturnCardIds.length > 0
        ? selectedTradeGiveCardIds.length > 0
          ? t("board.status.tradeFlowReadyExchange", {
              give: selectedTradeGiveText,
              take: selectedTradeReturnText,
              player: selectedTradeTargetName,
            })
          : t("board.status.tradeFlowReadyRequestOnly", {
              take: selectedTradeReturnText,
              player: selectedTradeTargetName,
            })
        : t("board.status.tradeFlowReadyNoReturn", {
            give: selectedTradeGiveText,
            player: selectedTradeTargetName,
          });
    }
    if (selectedTradeGiveCardIds.length > 0) {
      return t("board.status.tradeFlowNeedTarget", {
        card: selectedTradeGiveText,
      });
    }
    if (selectedTradeTarget) {
      return t("board.status.tradeFlowNeedSelection", {
        player: selectedTradeTargetName,
      });
    }
    return t("board.status.tradeFlowStart");
  })();
  const shouldShowMobileTradeStatus =
    Boolean(pendingTradeAgreement) ||
    Boolean(pendingSicknessExchange) ||
    Boolean(mummyPendingReward) ||
    Boolean(helpingHandsPendingReward) ||
    shouldStartDustSicknessExchange ||
    core.recommendedAction !== "trade" ||
    Boolean(selectedCorpseLootTarget) ||
    hasCorpseLootTargets ||
    activeTradeTargets.length === 0;
  const useStatusText = selectedInventoryCard
    ? selectedCardUseDisabled && selectedCardUseDisabledReason
      ? selectedCardUseDisabledReason
      : t("board.status.usePreview", {
          effect: resolvePreviewUseEffectLabel(selectedInventoryCard, t),
        })
    : lastUsedInventoryCardStillUsed
      ? t("board.status.cardUsedThisTurn")
      : t("board.status.noSelectedCard");
  const selectedInventoryDisplayText =
    core.recommendedAction === "trade" && selectedTradeGiveText
      ? selectedTradeGiveText
      : (selectedInventoryCard?.name ?? t("board.status.noSelectedCard"));
  const hasSelectedInventoryDisplay =
    Boolean(selectedInventoryCard) ||
    (core.recommendedAction === "trade" && selectedTradeGiveText.length > 0);
  const magicCameraPhotoTargets = React.useMemo(
    () =>
      core.phase === "haunt"
        ? resolveMagicCameraPhotoTargets(core, core.currentExplorer)
        : [],
    [core],
  );
  const magicCameraPhotoTargetPlayerIds = React.useMemo(
    () => new Set(magicCameraPhotoTargets.map((target) => target.playerId)),
    [magicCameraPhotoTargets],
  );
  const magicCameraPhotoTarget =
    (previewState.selectedTradeTargetPlayerId &&
      magicCameraPhotoTargets.find(
        (explorer) =>
          explorer.playerId === previewState.selectedTradeTargetPlayerId,
      )) ||
    magicCameraPhotoTargets[0] ||
    null;
  const magicCameraPhotoTrait = React.useMemo(
    () =>
      (["might", "speed", "knowledge", "sanity"] as BetrayalTraitKey[]).reduce(
        (lowestTrait, trait) =>
          core.currentExplorer.traits[trait] <
          core.currentExplorer.traits[lowestTrait]
            ? trait
            : lowestTrait,
        "might" as BetrayalTraitKey,
      ),
    [core.currentExplorer.traits],
  );
  const phantomPhotographerAttackOptions = React.useMemo(() => {
    const magicCamera = core.scenarioRuntime.magicCamera;
    if (
      core.phase !== "haunt" ||
      core.scenarioRuntime.hauntCardNumber !== 33 ||
      core.scenarioRuntime.traitorPlayerId !== core.currentExplorer.playerId ||
      !magicCamera ||
      core.scenarioRuntime.deadExplorerPlayerIds.includes(
        core.currentExplorer.playerId,
      )
    ) {
      return [];
    }
    return core.monsters
      .filter(
        (monster) =>
          magicCamera.phantomPhotographerIds.includes(monster.id) &&
          !magicCamera.killedPhantomPhotographerIds.includes(monster.id) &&
          !magicCamera.stunnedPhantomPhotographerIds.includes(monster.id),
      )
      .flatMap((monster) =>
        resolveMagicCameraPhantomAttackTargets(core, monster).map((target) => ({
          monsterId: monster.id,
          targetPlayerId: target.playerId,
        })),
      );
  }, [core]);
  const helpingHandsTrollHandAttackOptions = React.useMemo(() => {
    if (
      core.phase !== "haunt" ||
      resolveHelpingHandsControllerPlayerId(core) !==
        viewerPlayerId
    ) {
      return [];
    }
    return resolveHelpingHandsTrollHandAttackOptions(core);
  }, [core, viewerPlayerId]);
  const helpingHandsMonsterTurnStatus = React.useMemo(
    () => resolveHelpingHandsMonsterTurnStatus(core),
    [core],
  );
  const isHelpingHandsMonsterTurnController =
    core.phase === "haunt" &&
    helpingHandsMonsterTurnStatus.active &&
    helpingHandsMonsterTurnStatus.controllerPlayerId === viewerPlayerId;
  const helpingHandsTrollHandMoveEntries = React.useMemo(() => {
    if (!isHelpingHandsMonsterTurnController) {
      return [];
    }
    return helpingHandsMonsterTurnStatus.trollHandIds
      .map((monsterId) => {
        const monster =
          core.monsters.find((candidate) => candidate.id === monsterId) ?? null;
        if (!monster) {
          return null;
        }
        const fromRoom =
          core.rooms.find((room) => room.id === monster.roomId) ?? null;
        const targetRooms = resolveHelpingHandsTrollHandMoveOptions(
          core,
          monster.id,
        );
        if (targetRooms.length === 0) {
          return null;
        }
        return {
          monster,
          fromRoom,
          targetRooms,
          targetRoomIds: new Set(targetRooms.map((room) => room.id)),
          moveRemaining:
            helpingHandsMonsterTurnStatus.moveRemainingById[monster.id] ?? 0,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          monster: BetrayalMonsterSummary;
          fromRoom: BetrayalRoomNode | null;
          targetRooms: BetrayalRoomNode[];
          targetRoomIds: Set<string>;
          moveRemaining: number;
        } => Boolean(entry),
      );
  }, [core, helpingHandsMonsterTurnStatus, isHelpingHandsMonsterTurnController]);
  const selectedHelpingHandsTrollHandMoveEntry =
    helpingHandsTrollHandMoveEntries.find(
      (entry) =>
        entry.monster.id ===
        previewState.selectedHelpingHandsTrollHandMoveMonsterId,
    ) ??
    helpingHandsTrollHandMoveEntries[0] ??
    null;
  const selectedHelpingHandsTrollHandMoveMonsterId =
    selectedHelpingHandsTrollHandMoveEntry?.monster.id ?? null;
  const isHelpingHandsTrollHandMoveMode =
    previewState.interactionMode === "helpingHandsTrollMove" &&
    Boolean(selectedHelpingHandsTrollHandMoveEntry);
  const helpingHandsMovableTrollHandIds = React.useMemo(
    () =>
      new Set(
        helpingHandsTrollHandMoveEntries.map((entry) => entry.monster.id),
      ),
    [helpingHandsTrollHandMoveEntries],
  );
  const monsterActionPanel = React.useMemo(
    () => resolveBetrayalMonsterActionPanel(core),
    [core],
  );
  const isDeadTraitorJackSpiritControlTurn =
    core.phase === "haunt" &&
    core.scenarioRuntime.traitorPlayerId === core.currentPlayer &&
    core.scenarioRuntime.deadExplorerPlayerIds.includes(core.currentPlayer) &&
    core.scenarioRuntime.jackSpiritReleased &&
    Boolean(core.scenarioRuntime.jackSpiritRoomId);
  const monsterTurnStartActionSlot =
    monsterActionPanel.slots.find(
      (slot) => slot.kind === "turn-start" && slot.enabled && slot.monsterId,
    ) ?? null;
  const monsterMovementRollActionSlot =
    !monsterTurnStartActionSlot
      ? (monsterActionPanel.slots.find(
          (slot) => slot.kind === "movement-roll" && slot.enabled && slot.groupId,
        ) ?? null)
      : null;
  const bloodFromStoneMonsterTurnEndActionSlot =
    !monsterTurnStartActionSlot && !monsterMovementRollActionSlot
      ? (monsterActionPanel.slots.find(
          (slot) =>
            slot.kind === "end-turn" &&
            slot.command === BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN &&
            slot.enabled,
        ) ?? null)
      : null;
  const monsterMoveSlots = React.useMemo(
    () =>
      monsterActionPanel.slots.filter(
        (
          slot,
        ): slot is BetrayalMonsterActionSlot & { monsterId: string } =>
          slot.kind === "move" && Boolean(slot.monsterId) && slot.enabled,
      ),
    [monsterActionPanel],
  );
  const selectedMonsterMoveSlot =
    monsterMoveSlots.find(
      (slot) => slot.monsterId === previewState.selectedMonsterMoveMonsterId,
    ) ??
    monsterMoveSlots[0] ??
    null;
  const selectedMonsterMoveEntry = React.useMemo(() => {
    if (!selectedMonsterMoveSlot) {
      return null;
    }
    const monster =
      core.monsters.find(
        (candidate) => candidate.id === selectedMonsterMoveSlot.monsterId,
      ) ?? null;
    if (!monster) {
      return null;
    }
    const targetRooms = selectedMonsterMoveSlot.targetRoomIds
      .map((roomId) => core.rooms.find((room) => room.id === roomId) ?? null)
      .filter((room): room is BetrayalRoomNode => Boolean(room));
    if (targetRooms.length === 0) {
      return null;
    }
    return {
      slot: selectedMonsterMoveSlot,
      monster,
      targetRooms,
      targetRoomIds: new Set(targetRooms.map((room) => room.id)),
      moveRemaining: selectedMonsterMoveSlot.moveRemaining ?? 0,
    };
  }, [core.monsters, core.rooms, selectedMonsterMoveSlot]);
  const selectedMonsterMoveMonsterId =
    selectedMonsterMoveEntry?.monster.id ?? null;
  const isMonsterMoveMode =
    previewState.interactionMode === "monsterMove" &&
    Boolean(selectedMonsterMoveEntry);
  const monsterMovableIds = React.useMemo(
    () => new Set(monsterMoveSlots.map((slot) => slot.monsterId)),
    [monsterMoveSlots],
  );
  const phantomPhotographerAttackMonsterIds = React.useMemo(
    () =>
      new Set(
        phantomPhotographerAttackOptions.map((option) => option.monsterId),
      ),
    [phantomPhotographerAttackOptions],
  );
  const monsterAttackSlots = React.useMemo(
    () =>
      monsterActionPanel.slots.filter(
        (
          slot,
        ): slot is BetrayalMonsterActionSlot & { monsterId: string } =>
          slot.kind === "attack" &&
          Boolean(slot.monsterId) &&
          slot.enabled &&
          (phantomPhotographerAttackMonsterIds.has(slot.monsterId) ||
            slot.monsterId === "jack-spirit" ||
            slot.command === BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO),
      ),
    [monsterActionPanel, phantomPhotographerAttackMonsterIds],
  );
  const selectedMonsterAttackSlot =
    monsterAttackSlots.find(
      (slot) =>
        slot.monsterId === previewState.selectedMonsterAttackMonsterId,
    ) ??
    monsterAttackSlots[0] ??
    null;
  const selectedMonsterAttackEntry = React.useMemo(() => {
    if (!selectedMonsterAttackSlot) {
      return null;
    }
    const monster =
      core.monsters.find(
        (candidate) => candidate.id === selectedMonsterAttackSlot.monsterId,
      ) ?? null;
    if (!monster) {
      return null;
    }
    const phantomPhotographerTargetPlayerIds = new Set(
      phantomPhotographerAttackOptions
        .filter((option) => option.monsterId === monster.id)
        .map((option) => option.targetPlayerId),
    );
    if (phantomPhotographerTargetPlayerIds.size > 0) {
      return {
        kind: "phantom-photographer" as const,
        slot: selectedMonsterAttackSlot,
        monster,
        targetPlayerIds: phantomPhotographerTargetPlayerIds,
      };
    }
    const normalAttackTargets = resolveBetrayalNormalMonsterAttackTargets(
      core,
      monster.id,
    );
    if (
      !normalAttackTargets?.canResolveWithExistingCommand ||
      normalAttackTargets.targetPlayerIds.length === 0
    ) {
      return null;
    }
    const targetPlayerIds = new Set(normalAttackTargets.targetPlayerIds);
    if (targetPlayerIds.size === 0) {
      return null;
    }
    return {
      kind: "normal" as const,
      slot: selectedMonsterAttackSlot,
      monster,
      targetPlayerIds,
    };
  }, [
    core,
    phantomPhotographerAttackOptions,
    selectedMonsterAttackSlot,
  ]);
  const selectedMonsterAttackMonsterId =
    selectedMonsterAttackEntry?.monster.id ?? null;
  const isMonsterAttackMode =
    previewState.interactionMode === "monsterAttack" &&
    Boolean(selectedMonsterAttackEntry);
  const monsterAttackableIds = React.useMemo(
    () => new Set(monsterAttackSlots.map((slot) => slot.monsterId)),
    [monsterAttackSlots],
  );
  const bloodFromStonePeekabooOptions = React.useMemo(
    () =>
      resolveBloodFromStonePeekabooOptions(
        core,
        core.currentExplorer.playerId,
      ),
    [core],
  );
  const bloodFromStonePeekabooSameRoomMonsterIds = React.useMemo(
    () =>
      new Set(
        bloodFromStonePeekabooOptions.map(
          (option) => option.sameRoomMonsterId,
        ),
      ),
    [bloodFromStonePeekabooOptions],
  );
  const bloodFromStonePeekabooLineOfSightMonsterIds = React.useMemo(() => {
    const selectedSameRoomMonsterId =
      previewState.selectedPeekabooSameRoomMonsterId;
    const options = selectedSameRoomMonsterId
      ? bloodFromStonePeekabooOptions.filter(
          (option) => option.sameRoomMonsterId === selectedSameRoomMonsterId,
        )
      : bloodFromStonePeekabooOptions;
    return new Set(options.map((option) => option.lineOfSightMonsterId));
  }, [
    bloodFromStonePeekabooOptions,
    previewState.selectedPeekabooSameRoomMonsterId,
  ]);
  const isBloodFromStonePeekabooMode =
    previewState.hauntTargetingActionKind === "play-peekaboo" &&
    bloodFromStonePeekabooOptions.length > 0;
  React.useEffect(() => {
    if (isBloodFromStonePeekabooMode) {
      return;
    }
    if (
      previewState.hauntTargetingActionKind !== "play-peekaboo" &&
      !previewState.selectedPeekabooSameRoomMonsterId &&
      !previewState.selectedPeekabooLineOfSightMonsterId
    ) {
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      hauntTargetingActionKind:
        previousState.hauntTargetingActionKind === "play-peekaboo"
          ? null
          : previousState.hauntTargetingActionKind,
      selectedPeekabooSameRoomMonsterId: null,
      selectedPeekabooLineOfSightMonsterId: null,
    }));
  }, [
    isBloodFromStonePeekabooMode,
    previewState.hauntTargetingActionKind,
    previewState.selectedPeekabooLineOfSightMonsterId,
    previewState.selectedPeekabooSameRoomMonsterId,
  ]);
  const phantomPhotographerTargetPlayerIds = React.useMemo(
    () =>
      isMonsterAttackMode &&
      selectedMonsterAttackEntry?.kind === "phantom-photographer"
        ? selectedMonsterAttackEntry.targetPlayerIds
        : new Set<string>(),
    [isMonsterAttackMode, selectedMonsterAttackEntry],
  );
  const selectedMonsterAttackTargetPlayerIds = React.useMemo(
    () =>
      isMonsterAttackMode && selectedMonsterAttackEntry
        ? selectedMonsterAttackEntry.targetPlayerIds
        : new Set<string>(),
    [isMonsterAttackMode, selectedMonsterAttackEntry],
  );
  const resolveMonsterActionSlotName = React.useCallback(
    (slot: BetrayalMonsterActionSlot | null): string => {
      if (!slot) {
        return "";
      }
      if (slot.monsterId) {
        return (
          core.monsters.find((monster) => monster.id === slot.monsterId)?.name ??
          slot.label
        );
      }
      return slot.label.replace(/移动骰$/, "");
    },
    [core.monsters],
  );
  const helpingHandsMonsterControllerName =
    helpingHandsMonsterTurnStatus.controllerPlayerId
      ? resolvePlayerName(
          helpingHandsMonsterTurnStatus.controllerPlayerId,
          allExplorers.find(
            (explorer) =>
              explorer.playerId ===
              helpingHandsMonsterTurnStatus.controllerPlayerId,
          )?.displayName ?? "",
          matchData,
        )
      : "";
  const shouldShowHelpingHandsMonsterTurnStatus =
    core.phase === "haunt" &&
    Boolean(helpingHandsMonsterTurnStatus.monsterTurnAfterPlayerId) &&
    (helpingHandsMonsterTurnStatus.active ||
      !helpingHandsMonsterTurnStatus.controllerPlayerId) &&
    !mummyPendingReward &&
    !helpingHandsPendingReward &&
    !pendingTradeAgreement &&
    !pendingSicknessExchange &&
    !isDustSicknessExchangeMode;
  const selectedHelpingHandsTrollHandTargetPlayerId =
    previewState.selectedTradeTargetPlayerId;
  const helpingHandsTrollHandAttackTargetsByOptionId = React.useMemo(() => {
    const targetsByOptionId = new Map<
      string,
      (typeof allExplorers)[number]
    >();
    helpingHandsTrollHandAttackOptions.forEach((option) => {
      const target =
        allExplorers.find(
          (explorer) =>
            explorer.playerId ===
              selectedHelpingHandsTrollHandTargetPlayerId &&
            option.targetPlayerIds.includes(explorer.playerId),
        ) ??
        allExplorers.find(
          (explorer) =>
            option.targetPlayerIds.includes(explorer.playerId) &&
            explorer.playerId !== core.currentExplorer.playerId,
        ) ??
        allExplorers.find((explorer) =>
          option.targetPlayerIds.includes(explorer.playerId),
        ) ??
        null;
      if (target) {
        targetsByOptionId.set(option.id, target);
      }
    });
    return targetsByOptionId;
  }, [
    allExplorers,
    core.currentExplorer.playerId,
    helpingHandsTrollHandAttackOptions,
    selectedHelpingHandsTrollHandTargetPlayerId,
  ]);
  const helpingHandsVisibleTrollHandAttackOptions = React.useMemo(
    () =>
      helpingHandsTrollHandAttackOptions.filter((option) =>
        helpingHandsTrollHandAttackTargetsByOptionId.has(option.id),
      ),
    [
      helpingHandsTrollHandAttackOptions,
      helpingHandsTrollHandAttackTargetsByOptionId,
    ],
  );
  const helpingHandsTrollHandAttackTargetPlayerIds = React.useMemo(
    () =>
      new Set(
        helpingHandsVisibleTrollHandAttackOptions.flatMap(
          (option) => option.targetPlayerIds,
        ),
      ),
    [helpingHandsVisibleTrollHandAttackOptions],
  );
  const helpingHandsCombinedTrollHandAttackOption =
    helpingHandsVisibleTrollHandAttackOptions.find(
      (option) => option.combined,
    ) ?? null;
  const helpingHandsTrollHandAttackOption =
    (selectedHelpingHandsTrollHandTargetPlayerId &&
      (helpingHandsVisibleTrollHandAttackOptions.find(
        (option) =>
          option.combined &&
          option.targetPlayerIds.includes(
            selectedHelpingHandsTrollHandTargetPlayerId,
          ),
      ) ??
        helpingHandsVisibleTrollHandAttackOptions.find((option) =>
          option.targetPlayerIds.includes(
            selectedHelpingHandsTrollHandTargetPlayerId,
          ),
        ))) ||
    helpingHandsCombinedTrollHandAttackOption ||
    helpingHandsVisibleTrollHandAttackOptions[0] ||
    null;
  const helpingHandsTrollHandAttackTarget = helpingHandsTrollHandAttackOption
    ? helpingHandsTrollHandAttackTargetsByOptionId.get(
        helpingHandsTrollHandAttackOption.id,
      ) ?? null
    : null;
  const helpingHandsTrollHandAttackTargetName =
    helpingHandsTrollHandAttackTarget
      ? resolvePlayerName(
          helpingHandsTrollHandAttackTarget.playerId,
          helpingHandsTrollHandAttackTarget.displayName,
          matchData,
        )
      : "";
  const heroAttackTargets = React.useMemo(
    () =>
      core.scenarioRuntime.traitorPlayerId === core.currentExplorer.playerId
        ? allExplorers.filter((explorer) =>
            attackDeclarationTargetPlayerIds.heroPlayerIds.includes(
              explorer.playerId,
            ),
          )
        : [],
    [
      allExplorers,
      attackDeclarationTargetPlayerIds.heroPlayerIds,
      core.currentExplorer.playerId,
      core.scenarioRuntime.traitorPlayerId,
    ],
  );
  const hauntRevealProtocol = resolveBetrayalHauntRevealProtocol(core);
  const currentHauntOpeningDiscovery = isHauntScenarioOpeningDiscovery(core)
    ? core.latestDiscovery
    : null;
  const queuedHauntOpeningDiscoveryEntryForActionPause =
    !currentHauntOpeningDiscovery &&
    latestDiscoveryQueue[0] &&
    isHauntScenarioOpeningDiscoverySummary(latestDiscoveryQueue[0].discovery)
      ? latestDiscoveryQueue[0]
      : null;
  const hauntOpeningDiscoveryForActionPause =
    currentHauntOpeningDiscovery ??
    queuedHauntOpeningDiscoveryEntryForActionPause?.discovery ??
    null;
  const hauntRevealDiscoveryKeyForActionPause =
    currentHauntOpeningDiscovery
      ? buildLatestDiscoveryKey(core)
      : (queuedHauntOpeningDiscoveryEntryForActionPause?.key ?? null);
  const shouldPauseHauntBoardActions = Boolean(
    core.phase === "haunt" &&
      core.scenarioRuntime.hauntTriggered &&
      hauntRevealProtocol.active &&
      hauntOpeningDiscoveryForActionPause &&
      hauntRevealDiscoveryKeyForActionPause !==
        dismissedHauntRevealDiscoveryKey,
  );
  const hauntActionContext = React.useMemo(() => {
    if (core.phase !== "haunt" || shouldPauseHauntBoardActions) {
      return null;
    }
    const isTraitor =
      core.scenarioRuntime.traitorPlayerId === core.currentExplorer.playerId;
    const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(
      core.currentExplorer.playerId,
    );
    const mummyRuntime = core.scenarioRuntime.mummy;
    const mummyMonster = mummyRuntime
      ? core.monsters.find(
          (monster) =>
            monster.id === mummyRuntime.mummyMonsterId ||
            monster.definitionId === "mummy",
        ) ?? null
      : null;
    const mummyWeddingOmenCard = core.currentExplorer.inventory.find(
      (card) =>
        card.kind === "omen" &&
        (card.id === "holy-symbol" || card.id === "ring"),
    ) ?? null;
    const resolveHauntSpecialActionDisabledReason = (
      status: BetrayalHauntSpecialActionStatus,
    ) => {
      if (status.canUse) {
        return null;
      }
      if (!status.phaseEligible) {
        return t("board.status.hauntSpecialActionPreHaunt");
      }
      if (!status.actorAlive) {
        return t("board.status.hauntSpecialActionDead");
      }
      if (status.usedThisTurn) {
        return t("board.status.hauntSpecialActionUsedThisTurn");
      }
      return t("board.status.hauntSpecialActionUnavailable");
    };
    const createBudgetedUseContext = <Type extends keyof BetrayalCommandMap>(
      actionId: BetrayalHauntSpecialActionId,
      context: HauntUseContext<Type>,
    ) => {
      const status = resolveBetrayalHauntSpecialActionStatus(
        core,
        actionId,
        core.currentExplorer.playerId,
      );
      if (!status.active) {
        return null;
      }
      return {
        ...context,
        hauntSpecialActionId: actionId,
        disabledReason: resolveHauntSpecialActionDisabledReason(status),
      };
    };
    const defaultDustSearchTrait = resolveHighestTraitChoice(
      core.currentExplorer.traits,
      DUST_SEARCH_TRAIT_CHOICES,
    );
    const dustSearchTrait = isDustTraitChoice(
      DUST_SEARCH_TRAIT_CHOICES,
      previewState.selectedDustSearchTrait,
    )
      ? previewState.selectedDustSearchTrait
      : defaultDustSearchTrait;
    const defaultDustCureTrait = resolveHighestTraitChoice(
      core.currentExplorer.traits,
      DUST_CURE_TRAIT_CHOICES,
    );
    const dustCureTrait = isDustTraitChoice(
      DUST_CURE_TRAIT_CHOICES,
      previewState.selectedDustCureTrait,
    )
      ? previewState.selectedDustCureTrait
      : defaultDustCureTrait;
    const canAttackTraitor =
      !isTraitor &&
      !isDead &&
      Boolean(attackDeclarationTargetPlayerIds.traitorPlayerId);
    const canUseDynamiteRoomAttack =
      !isDead &&
      Boolean(dynamiteAttackWeaponCard) &&
      resolveDynamiteTargetRooms(core).length > 0;

    if (
      helpingHandsTrollHandAttackOption &&
      helpingHandsTrollHandAttackTarget
    ) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK,
        payload: {
          ...(helpingHandsTrollHandAttackOption.combined
            ? { combined: true }
            : {
                monsterId:
                  helpingHandsTrollHandAttackOption.trollHandIds[0] ??
                  helpingHandsTrollHandAttackOption.id,
              }),
          targetPlayerId: helpingHandsTrollHandAttackTarget.playerId,
        },
        label: helpingHandsTrollHandAttackOption.combined
          ? t("board.status.focusHelpingHandsTrollCombinedAttack", {
              player: helpingHandsTrollHandAttackTargetName,
            })
          : t("board.status.focusHelpingHandsTrollAttack", {
              player: helpingHandsTrollHandAttackTargetName,
            }),
        cue: helpingHandsTrollHandAttackOption.combined
          ? t("board.status.actionCueHelpingHandsTrollCombinedAttack", {
              player: helpingHandsTrollHandAttackTargetName,
            })
          : t("board.status.actionCueHelpingHandsTrollAttack", {
              player: helpingHandsTrollHandAttackTargetName,
            }),
      };
    }
    if (magicCameraPhotoTarget) {
      return createBudgetedUseContext("take-photo", {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.TAKE_PHOTO,
        payload: {
          targetPlayerId: magicCameraPhotoTarget.playerId,
          trait: magicCameraPhotoTrait,
        },
        label: t("board.status.focusTakePhoto", {
          player: resolvePlayerName(
            magicCameraPhotoTarget.playerId,
            magicCameraPhotoTarget.displayName,
            matchData,
          ),
          trait: t(`board.traits.${magicCameraPhotoTrait}`),
        }),
        cue: t("board.status.actionCueTakePhoto", {
          player: resolvePlayerName(
            magicCameraPhotoTarget.playerId,
            magicCameraPhotoTarget.displayName,
            matchData,
          ),
        }),
      });
    }
    {
      const smashCameraContext = createBudgetedUseContext(
        "smash-magic-camera",
        {
          actionKind: "use" as const,
          commandType: BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA,
          label: t("board.status.focusSmashMagicCamera"),
          cue: t("board.status.actionCueSmashMagicCamera"),
        },
      );
      if (smashCameraContext) {
        return smashCameraContext;
      }
    }
    {
      const status = resolveBetrayalHauntSpecialActionStatus(
        core,
        "play-peekaboo",
        core.currentExplorer.playerId,
      );
      if (status.active) {
        return {
          actionKind: "play-peekaboo" as const,
          hauntSpecialActionId: "play-peekaboo" as const,
          disabledReason: resolveHauntSpecialActionDisabledReason(status),
          label: t("board.status.focusPlayPeekaboo"),
          cue: t("board.status.actionCuePlayPeekaboo"),
        };
      }
    }
    if (mummyRuntime && !isDead) {
      const currentRoomId = core.currentExplorer.roomId;
      if (
        mummyRuntime.girlRoomId === currentRoomId &&
        !mummyRuntime.girlHolderPlayerId &&
        !mummyRuntime.girlHeldByMummy
      ) {
        return {
          actionKind: "use" as const,
          commandType: BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL,
          label: t("board.status.focusPickUpMummyGirl"),
          cue: t("board.status.actionCuePickUpMummyGirl"),
        };
      }
      if (
        isTraitor &&
        mummyRuntime.girlHolderPlayerId === core.currentExplorer.playerId &&
        mummyMonster?.roomId === currentRoomId
      ) {
        return {
          actionKind: "use" as const,
          commandType: BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY,
          label: t("board.status.focusGiveGirlToMummy"),
          cue: t("board.status.actionCueGiveGirlToMummy"),
        };
      }
      if (
        isTraitor &&
        mummyWeddingOmenCard &&
        mummyMonster?.roomId === currentRoomId &&
        !mummyRuntime.mummyCarriedOmenIds.includes(mummyWeddingOmenCard.id)
      ) {
        return {
          actionKind: "use" as const,
          commandType: BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY,
          payload: { cardId: mummyWeddingOmenCard.id },
          label: t("board.status.focusGiveOmenToMummy", {
            card: mummyWeddingOmenCard.name,
          }),
          cue: t("board.status.actionCueGiveOmenToMummy", {
            card: mummyWeddingOmenCard.name,
          }),
        };
      }
    }
    {
      const banishMummyContext = createBudgetedUseContext("banish-mummy", {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.BANISH_MUMMY,
        label: t("board.status.focusBanishMummy"),
        cue: t("board.status.actionCueBanishMummy"),
      });
      if (banishMummyContext) {
        return banishMummyContext;
      }
    }
    {
      const learnMummyBanishmentContext = createBudgetedUseContext(
        "learn-mummy-banishment",
        {
          actionKind: "use" as const,
          commandType: BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT,
          label: t("board.status.focusLearnMummyBanishment"),
          cue: t("board.status.actionCueLearnMummyBanishment"),
        },
      );
      if (learnMummyBanishmentContext) {
        return learnMummyBanishmentContext;
      }
    }
    {
      const studyMummyNameContext = createBudgetedUseContext("study-mummy-name", {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.STUDY_MUMMY_NAME,
        label: t("board.status.focusStudyMummyName"),
        cue: t("board.status.actionCueStudyMummyName"),
      });
      if (studyMummyNameContext) {
        return studyMummyNameContext;
      }
    }
    {
      const exorciseJackContext = createBudgetedUseContext("exorcise-jack", {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.EXORCISE_JACK,
        label: t("board.status.focusExorciseJack"),
        cue: t("board.status.actionCueExorciseJack"),
      });
      if (exorciseJackContext) {
        return exorciseJackContext;
      }
    }
    if (isDustSicknessExchangeMode) {
      return {
        actionKind: "sickness-exchange" as const,
        label: t("board.status.focusSicknessExchange"),
        cue: t("board.status.actionCueSicknessExchange"),
      };
    }
    {
      const cureDustContext = createBudgetedUseContext("cure-the-dust", {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.CURE_THE_DUST,
        payload: { trait: dustCureTrait },
        label: t("board.status.focusCureTheDust", {
          trait: t(`board.traits.${dustCureTrait}`),
        }),
        cue: t("board.status.actionCueCureTheDust", {
          trait: t(`board.traits.${dustCureTrait}`),
        }),
      });
      if (cureDustContext) {
        return cureDustContext;
      }
    }
    {
      const searchDustContext = createBudgetedUseContext("search-for-cure", {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
        payload: { trait: dustSearchTrait },
        label: t("board.status.focusSearchForCure", {
          trait: t(`board.traits.${dustSearchTrait}`),
        }),
        cue: t("board.status.actionCueSearchForCure", {
          trait: t(`board.traits.${dustSearchTrait}`),
        }),
      });
      if (searchDustContext) {
        return searchDustContext;
      }
    }
    if (dustSameRoomLivingTargets.length > 0) {
      return {
        actionKind: "attack-dust" as const,
        label: t("board.status.focusAttackDust"),
        cue: t("board.status.actionCueAttackDust"),
      };
    }
    {
      const learnJackContext = createBudgetedUseContext("learn-about-jack", {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
        label: t("board.status.focusLearnAboutJack"),
        cue: t("board.status.actionCueLearnAboutJack"),
      });
      if (learnJackContext) {
        return learnJackContext;
      }
    }
    {
      const studyExorcismContext = createBudgetedUseContext("study-exorcism", {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.STUDY_EXORCISM,
        label: t("board.status.focusStudyExorcism"),
        cue: t("board.status.actionCueStudyExorcism"),
      });
      if (studyExorcismContext) {
        return studyExorcismContext;
      }
    }
    if (
      canUseDynamiteRoomAttack &&
      (selectedAttackWeaponEffectId === "dynamite" ||
        (!canAttackTraitor && heroAttackTargets.length === 0))
    ) {
      return {
        actionKind: "attack-room" as const,
        label: t("board.status.focusAttackDynamiteRoom"),
        cue: t("board.status.actionCueAttackDynamiteRoom"),
      };
    }
    if (canAttackTraitor) {
      return {
        actionKind: "attack-traitor" as const,
        label: t("board.status.focusAttackTraitor"),
        cue: t("board.status.actionCueAttackTraitor"),
      };
    }
    if (heroAttackTargets.length > 0) {
      return {
        actionKind: "attack-hero" as const,
        label: t("board.status.focusAttackHeroTarget"),
        cue: t("board.status.actionCueAttackHeroTarget"),
      };
    }
    return null;
  }, [
    core,
    dustSameRoomLivingTargets.length,
    dynamiteAttackWeaponCard,
    helpingHandsTrollHandAttackOption,
    helpingHandsTrollHandAttackTarget,
    helpingHandsTrollHandAttackTargetName,
    heroAttackTargets,
    attackDeclarationTargetPlayerIds.traitorPlayerId,
    isDustSicknessExchangeMode,
    magicCameraPhotoTarget,
    magicCameraPhotoTrait,
    matchData,
    selectedAttackWeaponEffectId,
    previewState.selectedDustCureTrait,
    previewState.selectedDustSearchTrait,
    shouldPauseHauntBoardActions,
    t,
  ]);
  const hauntActionDisabledReason =
    hauntActionContext && "disabledReason" in hauntActionContext
      ? (hauntActionContext.disabledReason ?? null)
      : null;
  const dustHauntTraitSelector = (() => {
    if (hauntActionContext?.actionKind !== "use") {
      return null;
    }
    const selectedTrait =
      (hauntActionContext.payload as { trait?: BetrayalTraitKey } | undefined)
        ?.trait ?? null;
    if (hauntActionContext.hauntSpecialActionId === "search-for-cure") {
      return {
        actionId: "search-for-cure" as const,
        choices: DUST_SEARCH_TRAIT_CHOICES,
        selectedTrait,
        testIdPrefix: "betrayal-dust-search-trait",
      };
    }
    if (hauntActionContext.hauntSpecialActionId === "cure-the-dust") {
      return {
        actionId: "cure-the-dust" as const,
        choices: DUST_CURE_TRAIT_CHOICES,
        selectedTrait,
        testIdPrefix: "betrayal-dust-cure-trait",
      };
    }
    return null;
  })();
  const hauntTargetGuide: HauntTargetGuide | null = React.useMemo(() => {
    if (core.phase !== "haunt" || shouldPauseHauntBoardActions) {
      return null;
    }
    const targetActionKind =
      previewState.interactionMode === "sicknessExchange"
        ? "sickness-exchange"
        : hauntActionContext?.actionKind;
    if (!targetActionKind) {
      return null;
    }
    if (
      targetActionKind.startsWith("attack-") &&
      selectedAttackWeaponEffectId === "dynamite"
    ) {
      return null;
    }
    const resolveExplorerGuide = (
      playerId: string | null | undefined,
      cue: string,
    ): HauntTargetGuide | null => {
      const explorer = allExplorers.find((item) => item.playerId === playerId);
      if (!explorer) {
        return null;
      }
      return {
        kind: "explorer",
        roomId: explorer.roomId,
        playerId: explorer.playerId,
        targetName: resolvePlayerName(
          explorer.playerId,
          explorer.displayName,
          matchData,
        ),
        cue,
      };
    };

    switch (targetActionKind) {
      case "sickness-exchange": {
        const target =
          dustSameRoomLivingTargets.find(
            (item) => item.playerId === selectedTradeTargetPlayerId,
          ) ??
          dustSameRoomLivingTargets[0] ??
          null;
        const targetName = target?.displayName ?? null;
        return resolveExplorerGuide(
          target?.playerId,
          targetName
            ? t("board.status.localCueExchangeSicknessTarget", {
                player: targetName,
              })
            : t("board.status.localCueExchangeSickness"),
        );
      }
      case "attack-dust": {
        const target =
          dustSameRoomLivingTargets.find(
            (item) => item.playerId === selectedTradeTargetPlayerId,
          ) ??
          dustSameRoomLivingTargets[0] ??
          null;
        return resolveExplorerGuide(
          target?.playerId,
          t("board.status.localCueAttackExplorer"),
        );
      }
      case "attack-traitor":
        return resolveExplorerGuide(
          selectedAttackTargetPlayerIds.traitorPlayerId,
          t("board.status.localCueAttackTraitor"),
        );
      case "attack-hero":
        if (hauntActionContext?.actionKind !== "attack-hero") {
          return null;
        }
        {
          const activeHeroAttackTargets = heroAttackTargets.filter((target) =>
            selectedAttackTargetPlayerIds.heroPlayerIds.includes(
              target.playerId,
            ),
          );
          if (activeHeroAttackTargets.length === 1) {
            return resolveExplorerGuide(
              activeHeroAttackTargets[0]?.playerId,
              t("board.status.localCueAttackExplorer"),
            );
          }
        }
        if (heroAttackTargets.length === 1) {
          return resolveExplorerGuide(
            null,
            t("board.status.localCueAttackExplorer"),
          );
        }
        return {
          kind: "explorer",
          roomId: null,
          targetName: t("board.status.targetAnyHero"),
          cue: t("board.status.localCueAttackAnyHero"),
        };
      case "play-peekaboo": {
        if (hauntActionContext?.actionKind !== "play-peekaboo") {
          return null;
        }
        const selectedSameRoomMonsterId =
          previewState.selectedPeekabooSameRoomMonsterId;
        const resolveMonsterGuide = (
          option: BetrayalBloodFromStonePeekabooOption,
          step: "same-room" | "line-of-sight",
        ): HauntTargetGuide => ({
          kind: "monster",
          roomId:
            step === "same-room"
              ? option.sameRoomRoomId
              : option.lineOfSightRoomId,
          monsterId:
            step === "same-room"
              ? option.sameRoomMonsterId
              : option.lineOfSightMonsterId,
          targetName:
            step === "same-room"
              ? option.sameRoomMonsterName
              : option.lineOfSightMonsterName,
          cue:
            step === "same-room"
              ? t("board.status.localCuePlayPeekabooSameRoom")
              : t("board.status.localCuePlayPeekabooLineOfSight"),
        });
        if (!selectedSameRoomMonsterId) {
          const option = bloodFromStonePeekabooOptions[0] ?? null;
          return option ? resolveMonsterGuide(option, "same-room") : null;
        }
        const option =
          bloodFromStonePeekabooOptions.find(
            (item) => item.sameRoomMonsterId === selectedSameRoomMonsterId,
          ) ?? bloodFromStonePeekabooOptions[0] ?? null;
        return option ? resolveMonsterGuide(option, "line-of-sight") : null;
      }
      default:
        return null;
    }
  }, [
    allExplorers,
    bloodFromStonePeekabooOptions,
    core.phase,
    dustSameRoomLivingTargets,
    hauntActionContext,
    heroAttackTargets,
    matchData,
    previewState.interactionMode,
    previewState.selectedPeekabooSameRoomMonsterId,
    selectedAttackWeaponEffectId,
    selectedAttackTargetPlayerIds.heroPlayerIds,
    selectedAttackTargetPlayerIds.traitorPlayerId,
    selectedTradeTargetPlayerId,
    shouldPauseHauntBoardActions,
    t,
  ]);
  const activeHauntTargetGuide =
    hauntTargetGuide &&
    (previewState.hauntTargetingActionKind === hauntActionContext?.actionKind ||
      previewState.interactionMode === "sicknessExchange")
      ? hauntTargetGuide
      : null;
  const shouldShowTradeFlowPrompt = Boolean(
    !shouldPauseHauntBoardActions &&
      !pendingSicknessExchange &&
      !mummyPendingReward &&
      !helpingHandsPendingReward &&
      !isDustSicknessExchangeMode &&
      !activeHauntTargetGuide &&
      (pendingTradeAgreement || core.recommendedAction === "trade"),
  );
  const tradeAgreementState = pendingTradeAgreement
    ? isPendingTradeForViewer
      ? "incoming"
      : isPendingTradeFromViewer
        ? "waiting"
        : "observing"
    : "draft";
  const tradeFlowTargetStepText = pendingTradeAgreement
    ? isPendingTradeForViewer
      ? t("board.status.tradeAgreementTitle")
      : t("board.status.tradeFlowWaiting", {
          player: pendingTradeTargetName,
        })
    : tradeSelectionReady
      ? t("board.status.tradeFlowRequest")
      : t("board.status.tradeFlowChoose");
  const shouldShowTradeActionPanel = Boolean(
    !shouldPauseHauntBoardActions &&
      !pendingSicknessExchange &&
      !mummyPendingReward &&
      !helpingHandsPendingReward &&
      !isDustSicknessExchangeMode &&
      !activeHauntTargetGuide &&
      (shouldShowInlineTradeConfirm ||
        (pendingTradeAgreement && isPendingTradeForViewer)),
  );
  const heroAttackTargetPlayerIds = React.useMemo(() => {
    if (
      core.phase !== "haunt" ||
      core.scenarioRuntime.traitorPlayerId !== core.currentExplorer.playerId
    ) {
      return new Set<string>();
    }
    return new Set(selectedAttackTargetPlayerIds.heroPlayerIds);
  }, [
    core.currentExplorer.playerId,
    core.phase,
    core.scenarioRuntime.traitorPlayerId,
    selectedAttackTargetPlayerIds.heroPlayerIds,
  ]);
  const isHeroAttackTargetingMode =
    previewState.hauntTargetingActionKind === "attack-hero" &&
    hauntActionContext?.actionKind === "attack-hero";
  const isDustAttackTargetingMode =
    previewState.hauntTargetingActionKind === "attack-dust" &&
    hauntActionContext?.actionKind === "attack-dust";
  const isDynamiteRoomTargetingMode =
    selectedAttackWeaponEffectId === "dynamite" &&
    Boolean(previewState.hauntTargetingActionKind?.startsWith("attack-")) &&
    Boolean(hauntActionContext?.actionKind?.startsWith("attack-"));
  const isHauntTargetingMode =
    Boolean(activeHauntTargetGuide) || isDynamiteRoomTargetingMode;
  const dynamiteTargetRooms = React.useMemo(
    () =>
      selectedAttackWeaponEffectId === "dynamite"
        ? resolveDynamiteTargetRooms(core)
        : [],
    [core, selectedAttackWeaponEffectId],
  );
  const dynamiteTargetRoomIds = React.useMemo(
    () => new Set(dynamiteTargetRooms.map((room) => room.id)),
    [dynamiteTargetRooms],
  );
  const attackLineOfSightSegments = React.useMemo(() => {
    const visibleRoomById = new Map(
      visibleMapRooms.map((room) => [room.id, room]),
    );
    const segments: Array<{
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
    }> = [];

    if (
      selectedAttackWeaponCardId &&
      selectedAttackWeaponEffectId === "gun" &&
      (previewState.hauntTargetingActionKind === "attack-traitor" ||
        previewState.hauntTargetingActionKind === "attack-hero")
    ) {
      const sourceRoom = visibleRoomById.get(core.currentExplorer.roomId);
      if (sourceRoom) {
        const lineOfSightRoomIds = new Set(
          resolveBetrayalLineOfSightRoomIds(core, sourceRoom.id),
        );
        const targetPlayerIds =
          previewState.hauntTargetingActionKind === "attack-traitor"
            ? selectedAttackTargetPlayerIds.traitorPlayerId
              ? [selectedAttackTargetPlayerIds.traitorPlayerId]
              : []
            : selectedAttackTargetPlayerIds.heroPlayerIds;
        const sourcePoint = resolveRoomCenterPoint(sourceRoom, roomCanvasLayout);

        targetPlayerIds.forEach((targetPlayerId) => {
          const targetExplorer = allExplorers.find(
            (explorer) => explorer.playerId === targetPlayerId,
          );
          const targetRoom = targetExplorer
            ? visibleRoomById.get(targetExplorer.roomId)
            : null;
          if (
            !targetRoom ||
            targetRoom.id === sourceRoom.id ||
            !lineOfSightRoomIds.has(targetRoom.id)
          ) {
            return;
          }
          const targetPoint = resolveRoomCenterPoint(
            targetRoom,
            roomCanvasLayout,
          );
          segments.push({
            sourceRoomId: sourceRoom.id,
            targetRoomId: targetRoom.id,
            targetPlayerId,
            weaponCardId: selectedAttackWeaponCardId,
            kind: "weapon",
            x1: sourcePoint.x,
            y1: sourcePoint.y,
            x2: targetPoint.x,
            y2: targetPoint.y,
          });
        });
      }
    }

    if (
      isMonsterAttackMode &&
      selectedMonsterAttackEntry?.kind === "phantom-photographer"
    ) {
      const monster = selectedMonsterAttackEntry.monster;
      const sourceRoom = visibleRoomById.get(monster.roomId);
      if (sourceRoom) {
        const lineOfSightRoomIds = new Set(
          resolveBetrayalLineOfSightRoomIds(core, sourceRoom.id),
        );
        selectedMonsterAttackEntry.targetPlayerIds.forEach((targetPlayerId) => {
          const targetExplorer = allExplorers.find(
            (explorer) => explorer.playerId === targetPlayerId,
          );
          const targetRoom = targetExplorer
            ? visibleRoomById.get(targetExplorer.roomId)
            : null;
          if (
            !targetRoom ||
            targetRoom.id === sourceRoom.id ||
            !lineOfSightRoomIds.has(targetRoom.id)
          ) {
            return;
          }
          const sourcePoint = resolveRoomCenterPoint(sourceRoom, roomCanvasLayout);
          const targetPoint = resolveRoomCenterPoint(targetRoom, roomCanvasLayout);
          segments.push({
            sourceRoomId: sourceRoom.id,
            sourceMonsterId: monster.id,
            targetRoomId: targetRoom.id,
            targetPlayerId,
            kind: "phantom-photographer",
            x1: sourcePoint.x,
            y1: sourcePoint.y,
            x2: targetPoint.x,
            y2: targetPoint.y,
          });
        });
      }
    }

    return segments;
  }, [
    allExplorers,
    core,
    isMonsterAttackMode,
    previewState.hauntTargetingActionKind,
    roomCanvasLayout,
    selectedAttackTargetPlayerIds.heroPlayerIds,
    selectedAttackTargetPlayerIds.traitorPlayerId,
    selectedAttackWeaponCardId,
    selectedAttackWeaponEffectId,
    selectedMonsterAttackEntry,
    visibleMapRooms,
  ]);

  React.useEffect(() => {
    const nextEntry = buildLatestDiscoveryDisplayEntry(core);
    if (!nextEntry) {
      return;
    }
    if (
      nextEntry.key === previewState.dismissedLatestDiscoveryKey ||
      dismissedLatestDiscoveryKeysRef.current.has(nextEntry.key)
    ) {
      return;
    }
    setLatestDiscoveryQueue((previousQueue) => {
      const existingIndex = previousQueue.findIndex(
        (entry) => entry.key === nextEntry.key,
      );
      if (existingIndex >= 0) {
        return previousQueue.map((entry, index) =>
          index === existingIndex ? nextEntry : entry,
        );
      }
      const currentEntry = previousQueue[0] ?? null;
      if (
        currentEntry &&
        currentEntry.sourceKey === nextEntry.sourceKey
      ) {
        return [nextEntry, ...previousQueue.slice(1)];
      }
      return [...previousQueue, nextEntry];
    });
  }, [
    core,
    previewState.dismissedLatestDiscoveryKey,
    viewerPlayerId,
  ]);
  const latestDiscoveryEntry = latestDiscoveryQueue[0] ?? null;
  const latestDiscovery = latestDiscoveryEntry?.discovery ?? null;
  const latestDiscoveryRecentRoll = latestDiscoveryEntry?.recentRoll ?? null;
  const latestDiscoveryOwnerPlayerId =
    latestDiscoveryEntry?.ownerPlayerId ?? null;
  const latestDiscoveryKey = latestDiscoveryEntry?.key ?? null;
  const coreRecentRollDisplayKey = buildRecentRollDisplayKey(core.recentRoll);
  const latestDiscoveryRecentRollDisplayKey = buildRecentRollDisplayKey(
    latestDiscoveryRecentRoll,
  );
  const currentHauntOpeningDisplayEntry = currentHauntOpeningDiscovery
    ? buildLatestDiscoveryDisplayEntry(core)
    : null;
  const hasLatestDiscoveryDisplayEntry = Boolean(
    latestDiscovery &&
    latestDiscoveryKey !== previewState.dismissedLatestDiscoveryKey,
  );
  const isConfirmedExorciseRoll =
    core.recentRoll?.kind === "hauntActionTraitCheck" &&
    (core.recentRoll.sourceTitle === "驱魔" ||
      core.recentRoll.sourceTitle === "驱逐木乃伊") &&
    core.recentRoll.trait === "sanity" &&
    confirmedExorciseRollId === core.recentRoll.id;
  const isRecentRollDismissed = Boolean(
    coreRecentRollDisplayKey &&
      previewState.dismissedRecentRollId === coreRecentRollDisplayKey,
  );
  React.useEffect(() => {
    setSettledRecentRollId((previousRollId) =>
      previousRollId === coreRecentRollDisplayKey ? previousRollId : null,
    );
  }, [coreRecentRollDisplayKey]);
  const handleRecentRollDiceSettledChange = React.useCallback(
    (rollId: string, settled: boolean) => {
      setSettledRecentRollId((previousRollId) => {
        if (settled) {
          return rollId;
        }
        return previousRollId === rollId ? null : previousRollId;
      });
    },
    [],
  );
  const attackImpactByPlayerId = React.useMemo(
    () => resolveAttackImpactByPlayerId(core, allExplorers),
    [allExplorers, core],
  );
  const isAttackImpactReady =
    isRecentRollDismissed ||
    (core.recentRoll?.kind === "attackRoll" &&
      settledRecentRollId === coreRecentRollDisplayKey);
  const attackImpactPresentationKey =
    core.recentRoll?.kind === "attackRoll" && isAttackImpactReady
      ? `${coreRecentRollDisplayKey ?? core.recentRoll.id}:${
          isRecentRollDismissed ? "board" : "review"
        }`
      : null;
  const resolveTraitLabel = React.useCallback(
    (trait: BetrayalTraitKey) => t(`board.traits.${trait}`),
    [t],
  );
  const renderAttackImpactSurface = React.useCallback(
    (
      playerId: string,
      surface: string,
      children: React.ReactNode,
      density: "token" | "panel" = "token",
    ) => {
      if (!attackImpactPresentationKey) {
        return children;
      }
      const impact = attackImpactByPlayerId.get(playerId);
      if (!impact) {
        return children;
      }
      const presentationKey = `${attackImpactPresentationKey}:${surface}:${playerId}`;
      return (
        <BetrayalAttackImpactSurface
          key={presentationKey}
          impact={impact}
          presentationKey={presentationKey}
          surface={surface}
          density={density}
          traitLabel={resolveTraitLabel}
        >
          {children}
        </BetrayalAttackImpactSurface>
      );
    },
    [attackImpactByPlayerId, attackImpactPresentationKey, resolveTraitLabel],
  );
  const queuedHauntOpeningDiscoveryEntry =
    !currentHauntOpeningDiscovery &&
    latestDiscoveryEntry &&
    isHauntScenarioOpeningDiscoverySummary(latestDiscoveryEntry.discovery)
      ? latestDiscoveryEntry
      : null;
  const hauntOpeningDiscovery =
    currentHauntOpeningDiscovery ??
    queuedHauntOpeningDiscoveryEntry?.discovery ??
    null;
  const hauntRevealDiscoveryKey = currentHauntOpeningDiscovery
    ? buildLatestDiscoveryKey(core)
    : (queuedHauntOpeningDiscoveryEntry?.key ?? null);
  const shouldDeferHauntRevealCueUntilDiscoveryRead = Boolean(
    (currentHauntOpeningDisplayEntry &&
      currentHauntOpeningDisplayEntry.key !==
        previewState.dismissedLatestDiscoveryKey) ||
      (queuedHauntOpeningDiscoveryEntry &&
        queuedHauntOpeningDiscoveryEntry.key !==
          previewState.dismissedLatestDiscoveryKey),
  );
  const shouldShowHauntRevealCue = Boolean(
    core.phase === "haunt" &&
      core.scenarioRuntime.hauntTriggered &&
      hauntRevealProtocol.active &&
      hauntOpeningDiscovery &&
      hauntRevealDiscoveryKey !== dismissedHauntRevealDiscoveryKey &&
      !shouldDeferHauntRevealCueUntilDiscoveryRead,
  );
  const hauntRevealAutoOpenKey = shouldShowHauntRevealCue
    ? [
        activeHauntDossier.id,
        core.scenarioRuntime.hauntCardNumber ?? "unknown-haunt",
        core.scenarioRuntime.triggeringOmenId ?? "unknown-omen",
        scenarioReaderScope,
        viewerPlayerId,
        hauntRevealDiscoveryKey ?? "current-reveal",
      ].join(":")
    : null;
  React.useEffect(() => {
    const previousAutoOpenKey = previousHauntRevealAutoOpenKeyRef.current;
    const hasObservedAutoOpenState =
      hasObservedHauntRevealAutoOpenStateRef.current;
    hasObservedHauntRevealAutoOpenStateRef.current = true;
    previousHauntRevealAutoOpenKeyRef.current = hauntRevealAutoOpenKey;

    if (
      !shouldShowHauntRevealCue ||
      !core.scenarioRuntime.hauntTriggered ||
      !hauntRevealAutoOpenKey
    ) {
      return;
    }
    const didEnterNewHauntReveal =
      hasObservedAutoOpenState && previousAutoOpenKey !== hauntRevealAutoOpenKey;
    if (!didEnterNewHauntReveal) {
      return;
    }
    if (scenarioReaderOpen) {
      autoOpenedHauntScenarioReaderKeysRef.current.add(hauntRevealAutoOpenKey);
      return;
    }
    if (autoOpenedHauntScenarioReaderKeysRef.current.has(hauntRevealAutoOpenKey)) {
      return;
    }
    if (referenceOpen) {
      return;
    }
    autoOpenedHauntScenarioReaderKeysRef.current.add(hauntRevealAutoOpenKey);
    setDismissedHauntRevealDiscoveryKey(hauntRevealDiscoveryKey);
    setReferenceScenarioSpreadIndex(0);
    setReferenceScenarioOpeningStageActive(true);
    setReferenceScenarioTurnDirection(null);
    setReferenceScenarioTurnSnapshot(null);
    setScenarioReaderOpen(true);
  }, [
    core.scenarioRuntime.hauntCardNumber,
    core.scenarioRuntime.hauntTriggered,
    core.scenarioRuntime.triggeringOmenId,
    hauntRevealAutoOpenKey,
    hauntRevealDiscoveryKey,
    referenceOpen,
    scenarioReaderOpen,
    shouldShowHauntRevealCue,
  ]);
  const visibleDustProgressItems = shouldShowHauntRevealCue
    ? []
    : dustProgressItems;
  const hasRecentRollModifier = rollModifierCardIds.size > 0;
  const isLatestDiscoveryRecentRollDismissed = Boolean(
    latestDiscoveryRecentRollDisplayKey &&
      previewState.dismissedRecentRollId === latestDiscoveryRecentRollDisplayKey,
  );
  const latestDiscoveryHasActionableRollModifier = Boolean(
    latestDiscovery &&
      latestDiscoveryRecentRoll &&
      hasRecentRollModifier &&
      coreRecentRollDisplayKey === latestDiscoveryRecentRollDisplayKey &&
      latestDiscoveryRecentRoll.playerId === core.currentExplorer.playerId,
  );
  const shouldAutoReturnAfterLatestDiscovery = Boolean(
    !pendingEventChoice &&
      (core.pendingCardResolutionQueue?.length ?? 0) === 0 &&
      core.turnEndedByDiscovery &&
      isSpiderAdjacentRoomResolutionDiscovery(core.latestDiscovery) &&
      !latestDiscoveryHasActionableRollModifier,
  );
  const shouldShowLatestDiscovery =
    hasLatestDiscoveryDisplayEntry &&
    !shouldAutoReturnAfterLatestDiscovery &&
    !shouldShowHauntRevealCue;
  const shouldShowLatestDiscoveryRoll = Boolean(
    shouldShowLatestDiscovery &&
    !shouldAutoReturnAfterLatestDiscovery &&
    !isLatestDiscoveryRecentRollDismissed &&
    latestDiscoveryRecentRoll &&
    ((latestDiscovery?.kind === "event" &&
      (latestDiscoveryRecentRoll.kind === "eventTraitCheck" ||
        latestDiscoveryRecentRoll.kind === "eventDiceRoll")) ||
      (latestDiscovery?.kind === "omen" &&
        latestDiscoveryRecentRoll.kind === "hauntRoll")) &&
    latestDiscoveryRecentRoll.sourceTitle === latestDiscovery?.title,
  );
  const canCurrentPlayerModifyLatestDiscoveryRoll = Boolean(
    shouldShowLatestDiscoveryRoll &&
      hasRecentRollModifier &&
      latestDiscoveryRecentRoll &&
      coreRecentRollDisplayKey === latestDiscoveryRecentRollDisplayKey &&
      latestDiscoveryRecentRoll.playerId === core.currentExplorer.playerId,
  );
  const latestDiscoveryRerollSelection =
    canCurrentPlayerModifyLatestDiscoveryRoll ? recentRollRerollSelection : null;
  const pendingLatestDiscoveryEventRoll =
    core.pendingEventRollResolution &&
    core.pendingEventRollResolution.rollId === latestDiscoveryRecentRoll?.id
      ? core.pendingEventRollResolution
      : null;
  const pendingLatestDiscoveryEventRollRequiredPlayerIds =
    pendingLatestDiscoveryEventRoll?.requiredPlayerIds?.length
      ? pendingLatestDiscoveryEventRoll.requiredPlayerIds
      : pendingLatestDiscoveryEventRoll
        ? core.playerIds
        : [];
  const pendingLatestDiscoveryEventRollAcknowledgedPlayerIds =
    pendingLatestDiscoveryEventRoll?.acknowledgedPlayerIds ?? [];
  const pendingLatestDiscoveryEventRollConfirmedCount =
    pendingLatestDiscoveryEventRollAcknowledgedPlayerIds.length;
  const pendingLatestDiscoveryEventRollTotalCount =
    pendingLatestDiscoveryEventRollRequiredPlayerIds.length;
  const hasCurrentViewerConfirmedLatestDiscoveryEventRoll =
    pendingLatestDiscoveryEventRollAcknowledgedPlayerIds.includes(viewerPlayerId);
  const canCurrentViewerFinalizeLatestDiscoveryEventRoll = Boolean(
    pendingLatestDiscoveryEventRoll &&
      pendingLatestDiscoveryEventRollRequiredPlayerIds.includes(viewerPlayerId) &&
      !hasCurrentViewerConfirmedLatestDiscoveryEventRoll,
  );
  const diceConfirmButtonClass =
    "min-h-[42px] border border-[#d6b56d] bg-[#d6b56d] px-4 py-2 text-[12px] font-bold tracking-[0.10em] text-[#19140d] transition hover:bg-[#f0d28a] disabled:cursor-not-allowed disabled:border-[rgba(214,181,109,0.32)] disabled:bg-[rgba(214,181,109,0.18)] disabled:text-[rgba(243,224,166,0.48)]";
  const latestDiscoveryRollActionSlot = selectedRollModifierCanConfirm ? (
    <div className="pointer-events-auto flex items-center gap-2">
      <button
        type="button"
        data-testid="betrayal-roll-modifier-cancel"
        className="min-h-[42px] border border-[rgba(214,181,109,0.42)] bg-[rgba(18,17,13,0.72)] px-4 py-2 text-[12px] font-bold tracking-[0.10em] text-[#f3e0a6]"
        onClick={() =>
          setPreviewState((previousState) => ({
            ...previousState,
            selectedRollModifierDieIndex: null,
          }))
        }
      >
        {t("board.roll.cancelModifier")}
      </button>
      <button
        type="button"
        data-testid="betrayal-roll-modifier-confirm"
        className={diceConfirmButtonClass}
        onClick={confirmSelectedRollModifier}
      >
        {t("board.roll.confirmModifier", { card: selectedRollModifierCard?.name ?? "" })}
      </button>
    </div>
  ) : null;
  const activePendingCardResolution =
    core.pendingCardResolutionQueue?.[0] ?? null;
  const hasLatestDiscoveryPendingCardResolution = Boolean(
    activePendingCardResolution &&
      latestDiscovery &&
      activePendingCardResolution.playerId === latestDiscoveryOwnerPlayerId &&
      activePendingCardResolution.discoveryTitle === latestDiscovery.title,
  );
  const canDismissLatestDiscoveryByBackdrop =
    !hasLatestDiscoveryPendingCardResolution &&
    !pendingLatestDiscoveryEventRoll &&
    (!shouldShowLatestDiscoveryRoll || !canCurrentPlayerModifyLatestDiscoveryRoll);
  const hasPendingAttackReward = Boolean(
    mummyPendingReward || helpingHandsPendingReward,
  );
  const canDismissRecentRollByBackdrop =
    !hasRecentRollModifier && !hasPendingAttackReward;
  const shouldShowBlockingRecentRollOverlay = Boolean(
    core.recentRoll &&
    !isRecentRollDismissed &&
    !isConfirmedExorciseRoll &&
    !pendingEventChoice &&
    !shouldAutoReturnAfterLatestDiscovery &&
    !shouldShowHauntRevealCue &&
    !shouldShowLatestDiscovery,
  );
  const shouldUseMobileEventOpenTableChrome =
    isPhoneLandscapeLayout &&
    !activeHauntTargetGuide &&
    Boolean(
      pendingEventChoice ||
        (shouldShowLatestDiscovery &&
          !shouldAutoReturnAfterLatestDiscovery &&
          latestDiscovery?.kind === "event"),
    );
  // 只用于非事件发现结果 / 独立投骰结果这类需要整桌退场的阻塞层。
  // 事件选择与事件结算必须保持 PC 同构的开放桌面叠层，不得把行动栏、HUD 等整套牌桌 UI 藏掉。
  const shouldHideTableChromeForBlockingOverlay = Boolean(
    !(
      shouldShowLatestDiscovery &&
      !shouldAutoReturnAfterLatestDiscovery &&
      latestDiscovery?.kind === "event"
    ) &&
      !shouldUseMobileEventOpenTableChrome &&
      ((shouldShowLatestDiscovery &&
        !shouldAutoReturnAfterLatestDiscovery &&
        !pendingEventChoice) ||
        shouldShowBlockingRecentRollOverlay),
  );
  const shouldSuppressMobileBlockingRollChrome =
    isPhoneLandscapeLayout && shouldShowBlockingRecentRollOverlay;
  const shouldShowMobileEventStatusRail = shouldUseMobileEventOpenTableChrome;
  React.useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const root = document.documentElement;
    const attrName = "data-betrayal-blocking-roll";
    if (shouldSuppressMobileBlockingRollChrome) {
      root.setAttribute(attrName, "true");
    } else {
      root.removeAttribute(attrName);
    }
    return () => {
      root.removeAttribute(attrName);
    };
  }, [shouldSuppressMobileBlockingRollChrome]);
  const latestDiscoveryTitle = latestDiscovery?.title;
  const latestDiscoveryKindLabel = latestDiscovery
    ? {
        event: t("board.discovery.eventCard"),
        item: t("board.discovery.itemCard"),
        omen: t("board.discovery.omenCard"),
        none: t("board.discovery.noCard"),
      }[latestDiscovery.kind]
    : "";
  const eventChoiceDiscoveryForVisual =
    React.useMemo<BetrayalDiscoverySummary | null>(
      () =>
        pendingEventChoice
          ? {
              kind: "event",
              title: pendingEventChoice.sourceTitle,
              summary: "",
              detail: "",
              tone: "accent",
            }
          : null,
      [pendingEventChoice],
    );
  const latestDiscoveryOwnerInventory = React.useMemo(() => {
    if (!latestDiscoveryOwnerPlayerId) {
      return core.currentExplorerInventory;
    }
    const owner = [core.currentExplorer, ...core.otherExplorers].find(
      (explorer) => explorer.playerId === latestDiscoveryOwnerPlayerId,
    );
    return owner?.inventory ?? core.currentExplorerInventory;
  }, [
    core.currentExplorer,
    core.currentExplorerInventory,
    core.otherExplorers,
    latestDiscoveryOwnerPlayerId,
  ]);
  const latestDiscoveryVisual = React.useMemo(
    () =>
      resolveDiscoveryAtlasVisual(
        latestDiscovery ?? eventChoiceDiscoveryForVisual,
        latestDiscoveryOwnerInventory,
      ),
    [
      eventChoiceDiscoveryForVisual,
      latestDiscovery,
      latestDiscoveryOwnerInventory,
    ],
  );
  const latestDiscoveryDisplaySummary = React.useMemo(() => {
    const summary = latestDiscovery?.summary?.trim() ?? "";
    if (latestDiscovery?.kind !== "none") {
      return summary;
    }
    return summary
      .replace(/[；;]\s*没有事件、物品或预兆发现牌[。.]?\s*$/, "")
      .trim();
  }, [latestDiscovery?.kind, latestDiscovery?.summary]);
  const shouldShowLatestDiscoveryCardFace = Boolean(
    latestDiscovery &&
      (latestDiscovery.kind !== "none" ||
        (activePendingCardResolution?.cardId &&
          (activePendingCardResolution.deckKind === "item" ||
            activePendingCardResolution.deckKind === "omen"))),
  );
  const latestDiscoveryPendingCardResolution =
    React.useMemo<BetrayalPendingCardResolutionState | null>(() => {
      const pendingResolution = activePendingCardResolution;
      if (!pendingResolution || !latestDiscovery) {
        return null;
      }
      if (pendingResolution.playerId !== latestDiscoveryOwnerPlayerId) {
        return null;
      }
      if (pendingResolution.discoveryTitle !== latestDiscovery.title) {
        return null;
      }
      return pendingResolution;
    }, [
      activePendingCardResolution,
      latestDiscovery,
      latestDiscoveryOwnerPlayerId,
    ]);
  const latestDiscoveryCardResolutionRequiredPlayerIds =
    latestDiscoveryPendingCardResolution?.requiredPlayerIds?.length
      ? latestDiscoveryPendingCardResolution.requiredPlayerIds
      : latestDiscoveryPendingCardResolution
        ? [latestDiscoveryPendingCardResolution.playerId]
        : [];
  const latestDiscoveryCardResolutionAcknowledgedPlayerIds =
    latestDiscoveryPendingCardResolution?.acknowledgedPlayerIds ?? [];
  const latestDiscoveryCardResolutionConfirmedCount =
    latestDiscoveryCardResolutionRequiredPlayerIds.filter((playerId) =>
      latestDiscoveryCardResolutionAcknowledgedPlayerIds.includes(playerId),
    ).length;
  const latestDiscoveryCardResolutionTotalCount =
    latestDiscoveryCardResolutionRequiredPlayerIds.length;
  const latestDiscoveryViewerHasAcknowledgedCardResolution =
    latestDiscoveryCardResolutionAcknowledgedPlayerIds.includes(viewerPlayerId);
  const latestDiscoverySearchSequence =
    latestDiscoveryPendingCardResolution?.processCards ?? [];
  const latestDiscoveryHasSearchSequence =
    latestDiscoverySearchSequence.length > 0;
  const isLatestDiscoverySearchOperator = Boolean(
    latestDiscoveryPendingCardResolution &&
      latestDiscoveryHasSearchSequence &&
      latestDiscoveryPendingCardResolution.playerId === viewerPlayerId,
  );
  const latestDiscoverySearchVisibleIndex = latestDiscoveryHasSearchSequence
    ? isLatestDiscoverySearchOperator
      ? Math.min(
          Math.max(0, latestDiscoverySearchRevealIndex),
          latestDiscoverySearchSequence.length - 1,
        )
      : latestDiscoverySearchSequence.length - 1
    : -1;
  const latestDiscoveryVisibleProcessCard =
    latestDiscoverySearchVisibleIndex >= 0
      ? latestDiscoverySearchSequence[latestDiscoverySearchVisibleIndex] ?? null
      : null;
  const canAdvanceLatestDiscoverySearch = Boolean(
    isLatestDiscoverySearchOperator &&
      !latestDiscoveryViewerHasAcknowledgedCardResolution &&
      latestDiscoverySearchVisibleIndex >= 0 &&
      latestDiscoverySearchVisibleIndex < latestDiscoverySearchSequence.length - 1,
  );
  React.useEffect(() => {
    setLatestDiscoverySearchRevealIndex(0);
  }, [
    latestDiscoveryPendingCardResolution?.id,
    latestDiscoveryPendingCardResolution?.processCards?.length,
    viewerPlayerId,
  ]);
  const canCurrentViewerAcknowledgeCardResolution = Boolean(
    latestDiscoveryPendingCardResolution
      && latestDiscoveryCardResolutionRequiredPlayerIds.includes(viewerPlayerId)
      && !latestDiscoveryViewerHasAcknowledgedCardResolution
      && !canAdvanceLatestDiscoverySearch,
  );
  const latestDiscoveryContinueLabel = (() => {
    if (pendingLatestDiscoveryEventRoll) {
      if (hasCurrentViewerConfirmedLatestDiscoveryEventRoll) {
        return t("board.discovery.waitingForAll", {
          confirmed: pendingLatestDiscoveryEventRollConfirmedCount,
          total: pendingLatestDiscoveryEventRollTotalCount,
        });
      }
      return t("board.discovery.confirmResultAndResolution", {
        confirmed: pendingLatestDiscoveryEventRollConfirmedCount,
        total: pendingLatestDiscoveryEventRollTotalCount,
      });
    }
    if (!latestDiscoveryPendingCardResolution) {
      return t("board.roll.backToBoard");
    }
    if (latestDiscoveryViewerHasAcknowledgedCardResolution) {
      return t("board.discovery.waitingForAll", {
        confirmed: latestDiscoveryCardResolutionConfirmedCount,
        total: latestDiscoveryCardResolutionTotalCount,
      });
    }
    if (canAdvanceLatestDiscoverySearch) {
      return t("board.discovery.nextSearchCard");
    }
    if (latestDiscoveryHasSearchSequence) {
      return t("board.discovery.confirmCard");
    }
    return t("board.discovery.confirmCard");
  })();
  const pendingDiscoveryGainVisualRef = React.useRef<{
    card: BetrayalInventoryCard;
    visual: BetrayalPossessionAtlasVisual;
  } | null>(null);
  const latestDiscoveryPendingResolutionSeenRef = React.useRef<{
    sourceKey: string;
    resolutionId: string;
  } | null>(null);
  const latestDiscoveryPendingEventRollSeenRef = React.useRef<{
    sourceKey: string;
    rollId: string;
  } | null>(null);
  const startPendingDiscoveryGainVisual = React.useCallback(
    (onComplete: () => void) => {
    const pendingGain = pendingDiscoveryGainVisualRef.current;
    if (!pendingGain) {
      return false;
    }
    const sourceRect = readBetrayalViewportRect(
      findBetrayalTestElement("betrayal-discovery-card-front-atlas"),
    );
    if (!sourceRect) {
      return false;
    }
    const ownerExplorer = latestDiscoveryOwnerPlayerId
      ? allExplorers.find(
          (explorer) => explorer.playerId === latestDiscoveryOwnerPlayerId,
        )
      : null;
    const ownerRoom = ownerExplorer
      ? core.rooms.find((room) => room.id === ownerExplorer.roomId)
      : null;
    if (ownerRoom) {
      // 接收者可能在另一层地图；先切到接收者所在楼层，让真实 token
      // 成为动画终点，而不是退回当前 viewer 的持有区。
      setSelectedRoomMapFloor(ownerRoom.floor);
    }
    return beginBetrayalVisualTransition({
      kind: "possession-gain",
      sourceRect,
      targetRect: null,
      targetTestId: latestDiscoveryOwnerPlayerId
        ? `betrayal-explorer-figure-token-${latestDiscoveryOwnerPlayerId}`
        : "betrayal-explorer-figure-token-unknown",
      fallbackRoomTestId: latestDiscoveryOwnerPlayerId
        ? `betrayal-room-${
            allExplorers.find(
              (explorer) => explorer.playerId === latestDiscoveryOwnerPlayerId,
            )?.roomId ?? "unknown"
          }`
        : undefined,
      possessionCard: pendingGain.card,
      possessionVisual: pendingGain.visual,
      locale: effectiveLocale,
      missingTokenLabel: t("board.hauntTokens.officialTokenMissing"),
      onComplete,
    });
    },
    [
      allExplorers,
      beginBetrayalVisualTransition,
      core.rooms,
      effectiveLocale,
      latestDiscoveryOwnerPlayerId,
      t,
    ],
  );
  const handleDismissLatestDiscovery = React.useCallback(() => {
    if (!latestDiscoveryKey) {
      return;
    }
    dismissedLatestDiscoveryKeysRef.current.add(latestDiscoveryKey);
    setLatestDiscoveryQueue((previousQueue) => {
      if (previousQueue[0]?.key === latestDiscoveryKey) {
        return previousQueue.slice(1);
      }
      return previousQueue.filter((entry) => entry.key !== latestDiscoveryKey);
    });
    setPreviewState((previousState) => ({
      ...previousState,
      dismissedLatestDiscoveryKey: latestDiscoveryKey,
      dismissedRecentRollId:
        latestDiscoveryRecentRoll?.sourceTitle === latestDiscoveryTitle
          ? latestDiscoveryRecentRollDisplayKey
          : previousState.dismissedRecentRollId,
    }));
  }, [
    latestDiscoveryKey,
    latestDiscoveryRecentRoll?.sourceTitle,
    latestDiscoveryRecentRollDisplayKey,
    latestDiscoveryTitle,
  ]);
  const handleContinueLatestDiscovery = React.useCallback(() => {
    if (isVisualBusy) {
      return;
    }
    if (pendingLatestDiscoveryEventRoll) {
      if (canCurrentViewerFinalizeLatestDiscoveryEventRoll) {
        finalizePendingEventRoll();
      }
      return;
    }
    if (latestDiscoveryPendingCardResolution) {
      if (canAdvanceLatestDiscoverySearch) {
        setLatestDiscoverySearchRevealIndex((previousIndex) =>
          Math.min(previousIndex + 1, latestDiscoverySearchSequence.length - 1),
        );
        return;
      }
      if (!canCurrentViewerAcknowledgeCardResolution) {
        return;
      }
      const acknowledge = () =>
        dispatch(BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, {
          resolutionId: latestDiscoveryPendingCardResolution.id,
        });
      const completesCardResolution =
        latestDiscoveryCardResolutionConfirmedCount + 1 >=
        latestDiscoveryCardResolutionTotalCount;
      if (!completesCardResolution) {
        acknowledge();
        return;
      }
      if (!startPendingDiscoveryGainVisual(acknowledge)) {
        acknowledge();
      }
      return;
    }
    handleDismissLatestDiscovery();
  }, [
    dispatch,
    finalizePendingEventRoll,
    handleDismissLatestDiscovery,
    isVisualBusy,
    pendingLatestDiscoveryEventRoll,
    canCurrentViewerFinalizeLatestDiscoveryEventRoll,
    canAdvanceLatestDiscoverySearch,
    canCurrentViewerAcknowledgeCardResolution,
    startPendingDiscoveryGainVisual,
    latestDiscoveryPendingCardResolution,
    latestDiscoveryCardResolutionConfirmedCount,
    latestDiscoveryCardResolutionTotalCount,
    latestDiscoverySearchSequence.length,
  ]);
  const renderLatestDiscoveryContinueButton = (
    actionPosition: "panel-corner" | "bottom",
    className: string,
    _options: { disabledWhilePendingRoll?: boolean } = {},
  ) => (
    <button
      type="button"
      data-testid="betrayal-discovery-continue"
      data-discovery-action-position={actionPosition}
      data-discovery-action-surface={actionPosition === "bottom" ? "card-external-dock" : undefined}
      data-pending-card-resolution-id={
        latestDiscoveryPendingCardResolution?.id ?? undefined
      }
      data-pending-card-resolution-step={
        latestDiscoveryPendingCardResolution
          ? `${latestDiscoveryPendingCardResolution.index}/${latestDiscoveryPendingCardResolution.total}`
          : undefined
      }
      data-card-resolution-confirmed-count={
        latestDiscoveryPendingCardResolution
          ? String(latestDiscoveryCardResolutionConfirmedCount)
          : undefined
      }
      data-card-resolution-required-count={
        latestDiscoveryPendingCardResolution
          ? String(latestDiscoveryCardResolutionTotalCount)
          : undefined
      }
      disabled={Boolean(
        (pendingLatestDiscoveryEventRoll &&
          !canCurrentViewerFinalizeLatestDiscoveryEventRoll) ||
          (latestDiscoveryPendingCardResolution &&
            !canAdvanceLatestDiscoverySearch &&
            !canCurrentViewerAcknowledgeCardResolution),
      )}
      className={className}
      onClick={handleContinueLatestDiscovery}
    >
      {latestDiscoveryContinueLabel}
    </button>
  );
  React.useEffect(() => {
    const pendingEventRoll = pendingLatestDiscoveryEventRoll;
    if (pendingEventRoll && latestDiscoveryEntry?.sourceKey) {
      latestDiscoveryPendingEventRollSeenRef.current = {
        sourceKey: latestDiscoveryEntry.sourceKey,
        rollId: pendingEventRoll.rollId,
      };
      return;
    }
    const seenEventRoll = latestDiscoveryPendingEventRollSeenRef.current;
    if (!seenEventRoll) {
      return;
    }
    latestDiscoveryPendingEventRollSeenRef.current = null;
    if (
      latestDiscoveryPendingCardResolution &&
      latestDiscoveryEntry?.sourceKey === seenEventRoll.sourceKey
    ) {
      return;
    }
    const dismissedDiscoveryKey =
      latestDiscoveryEntry?.sourceKey === seenEventRoll.sourceKey
        ? latestDiscoveryEntry.key
        : null;
    if (dismissedDiscoveryKey) {
      dismissedLatestDiscoveryKeysRef.current.add(dismissedDiscoveryKey);
    }
    setLatestDiscoveryQueue((previousQueue) => {
      let removedAnyEntry = false;
      const nextQueue = previousQueue.filter((entry) => {
        if (entry.sourceKey !== seenEventRoll.sourceKey) {
          return true;
        }
        dismissedLatestDiscoveryKeysRef.current.add(entry.key);
        removedAnyEntry = true;
        return false;
      });
      return removedAnyEntry ? nextQueue : previousQueue;
    });
    setPreviewState((previousState) => ({
      ...previousState,
      dismissedLatestDiscoveryKey:
        dismissedDiscoveryKey ?? previousState.dismissedLatestDiscoveryKey,
      dismissedRecentRollId:
        latestDiscoveryRecentRoll?.sourceTitle === latestDiscoveryTitle
          ? latestDiscoveryRecentRollDisplayKey
          : previousState.dismissedRecentRollId,
    }));
  }, [
    latestDiscoveryEntry?.key,
    latestDiscoveryEntry?.sourceKey,
    latestDiscoveryRecentRoll?.sourceTitle,
    latestDiscoveryRecentRollDisplayKey,
    latestDiscoveryTitle,
    latestDiscoveryPendingCardResolution,
    pendingLatestDiscoveryEventRoll,
  ]);
  React.useEffect(() => {
    const pendingResolution = latestDiscoveryPendingCardResolution;
    if (pendingResolution && latestDiscoveryEntry?.sourceKey) {
      latestDiscoveryPendingResolutionSeenRef.current = {
        sourceKey: latestDiscoveryEntry.sourceKey,
        resolutionId: pendingResolution.id,
      };
      return;
    }
    const seenResolution = latestDiscoveryPendingResolutionSeenRef.current;
    if (!seenResolution || seenResolution.sourceKey !== latestDiscoveryEntry?.sourceKey) {
      return;
    }
    latestDiscoveryPendingResolutionSeenRef.current = null;
    handleDismissLatestDiscovery();
  }, [
    handleDismissLatestDiscovery,
    latestDiscoveryEntry?.sourceKey,
    latestDiscoveryPendingCardResolution,
  ]);
  const handleDismissHauntRevealCue = () => {
    if (!hauntRevealDiscoveryKey) {
      return;
    }
    const nextDiscoveryEntry = buildLatestDiscoveryDisplayEntry(core);
    const shouldRestoreDiscoveryAfterRevealDismiss = Boolean(
      nextDiscoveryEntry &&
        nextDiscoveryEntry.ownerPlayerId === viewerPlayerId &&
        nextDiscoveryEntry.key !== previewState.dismissedLatestDiscoveryKey &&
        !dismissedLatestDiscoveryKeysRef.current.has(nextDiscoveryEntry.key),
    );
    setDismissedHauntRevealDiscoveryKey(hauntRevealDiscoveryKey);
    if (
      !shouldRestoreDiscoveryAfterRevealDismiss &&
      core.recentRoll?.sourceTitle === core.latestDiscovery?.title
    ) {
      setPreviewState((previousState) => ({
        ...previousState,
        dismissedRecentRollId:
          coreRecentRollDisplayKey ?? previousState.dismissedRecentRollId,
      }));
    }
    setLatestDiscoveryQueue((previousQueue) => {
      const queueAfterRevealDismiss = previousQueue.filter(
        (entry) => entry.key !== hauntRevealDiscoveryKey,
      );
      if (!shouldRestoreDiscoveryAfterRevealDismiss || !nextDiscoveryEntry) {
        return queueAfterRevealDismiss;
      }
      const existingIndex = queueAfterRevealDismiss.findIndex(
        (entry) => entry.key === nextDiscoveryEntry.key,
      );
      if (existingIndex >= 0) {
        return queueAfterRevealDismiss.map((entry, index) =>
          index === existingIndex ? nextDiscoveryEntry : entry,
        );
      }
      return [nextDiscoveryEntry, ...queueAfterRevealDismiss];
    });
  };
  const handleDismissRecentRoll = React.useCallback(() => {
    if (!coreRecentRollDisplayKey) {
      return;
    }
    if (
      core.recentRoll.roomEndTurn?.nextPlayerId ||
      core.recentRoll.deathPrevention?.nextPlayerId
    ) {
      dispatchCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, {});
    } else if (isAcknowledgeableRecentRollDisplay(core.recentRoll)) {
      dispatchCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, {});
    }
    setPreviewState((previousState) => ({
      ...previousState,
      dismissedRecentRollId:
        coreRecentRollDisplayKey ?? previousState.dismissedRecentRollId,
    }));
  }, [core.recentRoll, coreRecentRollDisplayKey, dispatchCommand]);
  const handleConfirmExorciseRollReview = React.useCallback(() => {
    setConfirmedExorciseRollId(core.recentRoll?.id ?? null);
  }, [core.recentRoll?.id]);
  const turnHintText =
    previewState.interactionMode === "helpingHandsTrollMove" &&
    selectedHelpingHandsTrollHandMoveEntry
      ? t("board.status.turnHintHelpingHandsTrollMove", {
          monster: selectedHelpingHandsTrollHandMoveEntry.monster.name,
          targets: formatRoomTargetList(
            selectedHelpingHandsTrollHandMoveEntry.targetRooms,
          ),
        })
      : previewState.interactionMode === "monsterMove" &&
          selectedMonsterMoveEntry
        ? t("board.status.turnHintMonsterMove", {
            monster: selectedMonsterMoveEntry.monster.name,
            targets: formatRoomTargetList(selectedMonsterMoveEntry.targetRooms),
          })
      : isBloodFromStoneSetupPlacementMode
        ? remainingBloodFromStoneSetupPlacementCount > 0
          ? t("board.status.turnHintBloodFromStoneSetupPlacement", {
              count: remainingBloodFromStoneSetupPlacementCount,
            })
          : t("board.status.turnHintBloodFromStoneSetupPlacementReady", {
              count: selectedBloodFromStoneStoneCherubRoomIds.length,
            })
      : bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount > 0
        ? t("board.status.bloodFromStoneSetupPlacementRemaining", {
            count: bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
          })
      : previewState.interactionMode === "move"
      ? t("board.activity.chooseMoveTarget")
      : previewState.interactionMode === "explore"
        ? pendingRoomPlacementPreview
          ? t("board.activity.chooseRoomOrientation")
          : t("board.activity.chooseExploreTarget")
        : core.turnEndedByDiscovery
          ? t("board.status.turnHintDiscoveryEndTurn")
        : moveTargetRooms.length > 0
          ? t("board.status.turnHintMove", {
              targets: formatRoomTargetList(moveTargetRooms),
            })
          : canStartExploreSelection
            ? t("board.status.turnHintExplore", {
                floor: resolveFloorLabel(explorableRoomSlots[0]!.floor),
              })
            : t("board.status.turnHintHold");
  const roomFocusState = (() => {
    if (
      core.recommendedAction === "use" &&
      selectedInventoryCard &&
      !selectedCardUseDisabled
    ) {
      return {
        label: t("board.status.focusUseCard", {
          card: selectedInventoryCard.name,
        }),
        actionKind: "use" as const,
        roomId: null,
      };
    }
    if (hauntActionContext?.actionKind === "use") {
      return {
        label: hauntActionContext.label,
        actionKind: "use" as const,
        roomId: core.activeRoomId,
      };
    }
    return null;
  })();
  const isMummyGirlRoomFocusAction =
    hauntActionContext?.actionKind === "use" &&
    (hauntActionContext.commandType === BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL ||
      hauntActionContext.commandType === BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY);
  const shouldShowRoomFocusTargetLabel =
    Boolean(roomFocusState) && !isMummyGirlRoomFocusAction;
  const tradeStatusCueState = (() => {
    if (core.recommendedAction === "trade") {
      return null;
    }
    if (
      activeTradeTargets.length !== 1 ||
      !selectedTradeTarget ||
      core.currentExplorerInventory.length === 0
    ) {
      return null;
    }
    return {
      label: t("board.status.focusTradeTarget", {
        player: resolvePlayerName(
          selectedTradeTarget.playerId,
          selectedTradeTarget.displayName,
          matchData,
        ),
      }),
    };
  })();
  const actionCueText = (() => {
    if (activeHauntTargetGuide?.cue) {
      return activeHauntTargetGuide.cue;
    }
    if (
      previewState.interactionMode === "helpingHandsTrollMove" &&
      selectedHelpingHandsTrollHandMoveEntry
    ) {
      if (selectedHelpingHandsTrollHandMoveEntry.targetRooms.length === 1) {
        return t("board.status.actionCueHelpingHandsTrollMoveSingle", {
          monster: selectedHelpingHandsTrollHandMoveEntry.monster.name,
          room: selectedHelpingHandsTrollHandMoveEntry.targetRooms[0]!.name,
        });
      }
      return t("board.status.actionCueHelpingHandsTrollMoveMode", {
        monster: selectedHelpingHandsTrollHandMoveEntry.monster.name,
      });
    }
    if (
      previewState.interactionMode === "monsterMove" &&
      selectedMonsterMoveEntry
    ) {
      if (selectedMonsterMoveEntry.targetRooms.length === 1) {
        return t("board.status.actionCueMonsterMoveSingle", {
          monster: selectedMonsterMoveEntry.monster.name,
          room: selectedMonsterMoveEntry.targetRooms[0]!.name,
        });
      }
      return t("board.status.actionCueMonsterMoveMode", {
        monster: selectedMonsterMoveEntry.monster.name,
      });
    }
    if (isMonsterAttackMode && selectedMonsterAttackEntry) {
      const targetPlayerIds = Array.from(
        selectedMonsterAttackEntry.targetPlayerIds,
      );
      if (targetPlayerIds.length === 1) {
        const target = allExplorers.find(
          (explorer) => explorer.playerId === targetPlayerIds[0],
        );
        return t("board.status.actionCueMonsterAttackSingle", {
          monster: selectedMonsterAttackEntry.monster.name,
          player: resolvePlayerName(
            targetPlayerIds[0]!,
            target?.displayName ?? targetPlayerIds[0]!,
            matchData,
          ),
        });
      }
      return t("board.status.actionCueMonsterAttackMode", {
        monster: selectedMonsterAttackEntry.monster.name,
      });
    }
    if (isBloodFromStoneSetupPlacementMode) {
      if (remainingBloodFromStoneSetupPlacementCount > 0) {
        return t("board.status.actionCueBloodFromStoneSetupPlacement", {
          count: remainingBloodFromStoneSetupPlacementCount,
        });
      }
      return t("board.status.actionCueBloodFromStoneSetupPlacementConfirm");
    }
    if (selectedInventoryCard && !selectedCardUsedThisTurn) {
      return t("board.status.actionCueUseCard", {
        card: selectedInventoryCard.name,
      });
    }
    if (hauntActionDisabledReason) {
      return hauntActionDisabledReason;
    }
    if (hauntActionContext?.cue) {
      return hauntActionContext.cue;
    }
    if (previewState.interactionMode === "move") {
      if (moveTargetRooms.length === 1) {
        return t("board.status.actionCueMoveSingle", {
          room: moveTargetRooms[0]!.name,
        });
      }
      return t("board.status.actionCueMoveMode");
    }
    if (previewState.interactionMode === "explore") {
      if (pendingRoomPlacementPreview) {
        return t("board.status.actionCueExploreOrient", {
          room: pendingRoomPlacementPreview.room.name,
        });
      }
      return canStartExploreSelection
        ? t("board.status.actionCueExploreSelect")
        : t("board.status.actionCueExplore", {
            floor: t("board.rooms.unknown"),
          });
    }
    if (core.turnEndedByDiscovery) {
      return t("board.status.actionCueDiscoveryEndTurn");
    }
    switch (core.recommendedAction) {
      case "move":
        if (moveTargetRooms.length === 1) {
          return t("board.status.actionCueMoveSingle", {
            room: moveTargetRooms[0]!.name,
          });
        }
        return t("board.status.actionCueMoveMany");
      case "explore":
        return canStartExploreSelection
          ? t("board.status.actionCueExplore", {
              floor: resolveFloorLabel(explorableRoomSlots[0]!.floor),
            })
          : t("board.status.actionCueExplore", {
              floor: t("board.rooms.unknown"),
            });
      case "use":
        return selectedInventoryCard && !selectedCardUsedThisTurn
          ? t("board.status.actionCueUseCard", {
              card: selectedInventoryCard.name,
            })
          : t("board.status.actionCueUse");
      case "trade":
        return selectedTradeTarget
          ? t("board.status.actionCueTradePlayer", {
              player: resolvePlayerName(
                selectedTradeTarget.playerId,
                selectedTradeTarget.displayName,
                matchData,
              ),
            })
          : t("board.status.actionCueTrade");
      case "endTurn":
        return roomEndTurnEffectHint
          ? t("board.status.actionCueEndTurnRoomEffect")
          : t("board.status.actionCueEndTurn");
      default:
        return t("board.status.actionCueMoveMany");
    }
  })();
  const shouldShowBoardActionStatus = !shouldShowHauntRevealCue;
  const toggleReferenceSide = React.useCallback(() => {
    setReferenceSide((previousSide) => {
      const currentIndex = referencePages.findIndex(
        (page) => page.id === previousSide,
      );
      const nextPage =
        referencePages[(currentIndex + 1) % referencePages.length] ??
        referencePages[0];
      return nextPage?.id ?? "front";
    });
  }, [referencePages]);
  const handleReferenceScenarioTurn = (direction: "back" | "forward") => {
    setReferenceScenarioSpreadIndex((previousIndex) => {
      const nextIndex =
        direction === "back"
          ? Math.max(0, previousIndex - 1)
          : Math.min(referenceScenarioSpreadCount - 1, previousIndex + 1);
      if (nextIndex !== previousIndex) {
        setReferenceScenarioTurnSnapshot({
          fromPages: resolveScenarioReaderSpreadPages(
            referenceScenarioPages,
            referenceScenarioHasOpeningStage,
            previousIndex,
          ),
          toPages: resolveScenarioReaderSpreadPages(
            referenceScenarioPages,
            referenceScenarioHasOpeningStage,
            nextIndex,
          ),
        });
        playSound(BETRAYAL_SCENARIO_PAGE_TURN_KEY);
        setReferenceScenarioTurnDirection(direction);
      }
      return nextIndex;
    });
  };
  const latestDiscoveryPendingPossessionCard = React.useMemo<
    BetrayalInventoryCard | null
  >(() => {
    if (
      latestDiscoveryVisibleProcessCard &&
      (latestDiscoveryVisibleProcessCard.deckKind === "item" ||
        latestDiscoveryVisibleProcessCard.deckKind === "omen")
    ) {
      return {
        id:
          latestDiscoveryVisibleProcessCard.cardId ??
          latestDiscoveryVisibleProcessCard.cardName,
        name: latestDiscoveryVisibleProcessCard.cardName,
        kind: latestDiscoveryVisibleProcessCard.deckKind,
      };
    }
    const pending = activePendingCardResolution;
    if (
      !pending?.cardId ||
      (pending.deckKind !== "item" && pending.deckKind !== "omen")
    ) {
      return null;
    }
    return {
      id: pending.cardId,
      name: pending.cardName,
      kind: pending.deckKind,
    };
  }, [activePendingCardResolution, latestDiscoveryVisibleProcessCard]);
  const latestDiscoveryPendingPossessionVisual = React.useMemo(
    () =>
      latestDiscoveryPendingPossessionCard
        ? resolvePossessionAtlasVisual(latestDiscoveryPendingPossessionCard)
        : null,
    [latestDiscoveryPendingPossessionCard],
  );
  React.useLayoutEffect(() => {
    pendingDiscoveryGainVisualRef.current =
      latestDiscoveryPendingPossessionCard &&
      latestDiscoveryPendingPossessionVisual
        ? {
            card: latestDiscoveryPendingPossessionCard,
            visual: latestDiscoveryPendingPossessionVisual,
          }
        : null;
  }, [
    latestDiscoveryPendingPossessionCard,
    latestDiscoveryPendingPossessionVisual,
  ]);
  const latestDiscoveryPanelVisual =
    latestDiscoveryPendingPossessionVisual ?? latestDiscoveryVisual;
  const latestDiscoveryDisplayedKindLabel = latestDiscoveryPendingPossessionCard
    ? latestDiscoveryPendingPossessionCard.kind === "item"
      ? t("board.discovery.itemCard")
      : t("board.discovery.omenCard")
    : latestDiscovery?.kind === "none" && latestDiscoveryPendingCardResolution
      ? t("board.discovery.roomEffect")
      : latestDiscoveryKindLabel;
  const latestDiscoveryDisplayedTitle =
    latestDiscoveryPendingPossessionCard?.name ?? latestDiscovery?.title ?? "";

  const scrollToSection = React.useCallback((sectionId: string) => {
    if (typeof document === "undefined") {
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  React.useEffect(() => {
    if (
      !latestDiscoveryTitle ||
      typeof window === "undefined" ||
      window.innerWidth >= 768
    ) {
      return;
    }
    document.getElementById("betrayal-room-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [latestDiscoveryTitle]);

  const handleMoveToRoom = React.useCallback(
    (roomId: string) => {
      if (isVisualBusy) {
        return;
      }
      const useSkeletonKey = skeletonKeyMoveTargetRoomIds.has(roomId);
      const move = () =>
        dispatch(BETRAYAL_COMMANDS.MOVE_TO_ROOM, {
          roomId,
          ...(useSkeletonKey ? { useSkeletonKey: true } : {}),
        });
      const finishMove = () => {
        move();
        focusRoomOnMap(roomId);
      };
      if (!startExplorerMoveVisual(roomId, finishMove)) {
        move();
        focusRoomOnMap(roomId);
      }
      setPreviewState((previousState) => ({
        ...previousState,
        interactionMode: useSkeletonKey ? "default" : "move",
      }));
    },
    [
      dispatch,
      focusRoomOnMap,
      isVisualBusy,
      skeletonKeyMoveTargetRoomIds,
      startExplorerMoveVisual,
    ],
  );

  const handleMoveAction = React.useCallback(() => {
    const shouldAdvanceOpenMoveTutorial =
      isTutorialActive &&
      tutorialStep?.id === "open-move-targets" &&
      previewState.interactionMode !== "move" &&
      core.movesRemaining > 0 &&
      moveTargetRooms.length > 0;
    const isEnteringMoveMode =
      previewState.interactionMode !== "move" &&
      core.movesRemaining > 0 &&
      moveTargetRooms.length > 0;
    setPreviewState((previousState) => {
      if (previousState.interactionMode === "move") {
        return {
          ...previousState,
          interactionMode: "default",
          selectedMonsterMoveMonsterId: null,
          selectedMonsterAttackMonsterId: null,
        };
      }
      if (core.movesRemaining <= 0 || moveTargetRooms.length === 0) {
        return previousState;
      }
      return {
        ...previousState,
        interactionMode: "move",
        selectedMonsterMoveMonsterId: null,
        selectedMonsterAttackMonsterId: null,
      };
    });
    if (isEnteringMoveMode) {
      focusExplorerRoom(null);
    }
    if (shouldAdvanceOpenMoveTutorial) {
      nextStep("auto");
    }
  }, [
    core.movesRemaining,
    focusExplorerRoom,
    isTutorialActive,
    moveTargetRooms.length,
    nextStep,
    previewState.interactionMode,
    tutorialStep?.id,
  ]);

  React.useEffect(() => {
    if (previewState.interactionMode !== "move") {
      return;
    }
    if (core.movesRemaining > 0 && moveTargetRooms.length > 0) {
      return;
    }
    setPreviewState((previousState) =>
      previousState.interactionMode === "move"
        ? {
            ...previousState,
            interactionMode: "default",
            selectedMonsterAttackMonsterId: null,
          }
        : previousState,
    );
  }, [
    core.movesRemaining,
    moveTargetRooms.length,
    previewState.interactionMode,
  ]);

  React.useEffect(() => {
    if (previewState.interactionMode !== "explore") {
      return;
    }
    if (canStartExploreSelection) {
      return;
    }
    setPreviewState((previousState) =>
      previousState.interactionMode === "explore"
        ? {
            ...previousState,
            pendingRoomPlacementSlotId: null,
            pendingRoomPlacementFailure: null,
            pendingRoomOrientationTurns: 0,
            pendingRoomTileAdjustment: null,
            interactionMode: "default",
            selectedMonsterAttackMonsterId: null,
          }
        : previousState,
    );
  }, [canStartExploreSelection, previewState.interactionMode]);

  const handleExploreAction = React.useCallback(() => {
    setPreviewState((previousState) => {
      if (previousState.interactionMode === "explore") {
        return {
          ...previousState,
          pendingRoomPlacementSlotId: null,
          pendingRoomPlacementFailure: null,
          pendingRoomOrientationTurns: 0,
          pendingRoomTileAdjustment: null,
          interactionMode: "default",
          selectedMonsterAttackMonsterId: null,
        };
      }
      if (!canStartExploreSelection) {
        return previousState;
      }
      return {
        ...previousState,
        pendingRoomPlacementSlotId: null,
        pendingRoomPlacementFailure: null,
        pendingRoomOrientationTurns: 0,
        pendingRoomTileAdjustment: null,
        interactionMode: "explore",
        selectedMonsterAttackMonsterId: null,
      };
    });
  }, [canStartExploreSelection]);

  const handlePrepareExploreRoom = React.useCallback(
    (roomId: string) => {
      const placementPreview = resolveRoomPlacementPreview(core, {
        roomId,
        useHolySymbol: useHolySymbolForExplore,
      });
      if (!placementPreview) {
        const exhaustedSlot =
          explorableRoomSlots.find((room) => room.id === roomId) ?? null;
        setPreviewState((previousState) => ({
          ...previousState,
          pendingRoomPlacementSlotId: null,
          pendingRoomPlacementFailure: exhaustedSlot
            ? { roomId, floor: exhaustedSlot.floor }
            : null,
          pendingRoomOrientationTurns: 0,
          pendingRoomTileAdjustment: null,
          interactionMode: "explore",
        }));
        return;
      }
      setPreviewState((previousState) => ({
        ...previousState,
        pendingRoomPlacementSlotId: roomId,
        pendingRoomPlacementFailure: null,
        pendingRoomOrientationTurns: placementPreview.defaultOrientationTurns,
        pendingRoomTileAdjustment: null,
        interactionMode: "explore",
      }));
      if (isTutorialActive && tutorialStep?.id === "explore-upper") {
        nextStep("auto");
      }
    },
    [
      core,
      explorableRoomSlots,
      isTutorialActive,
      nextStep,
      tutorialStep?.id,
      useHolySymbolForExplore,
    ],
  );

  const handleRotateRoomPlacement = React.useCallback(
    (direction: 1 | -1) => {
      if (!pendingRoomPlacementPreview || pendingRoomOrientationOptions.length === 0) {
        return;
      }
      const currentIndex = pendingRoomOrientationOptions.findIndex(
        (option) => option.orientationTurns === selectedRoomOrientationTurns,
      );
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (safeCurrentIndex + direction + pendingRoomOrientationOptions.length) %
        pendingRoomOrientationOptions.length;
      const nextOrientation =
        pendingRoomOrientationOptions[nextIndex]?.orientationTurns ??
        pendingRoomPlacementPreview.defaultOrientationTurns;
      setPreviewState((previousState) => ({
        ...previousState,
        pendingRoomOrientationTurns: nextOrientation,
        pendingRoomTileAdjustment: null,
      }));
    },
    [
      pendingRoomOrientationOptions,
      pendingRoomPlacementPreview,
      selectedRoomOrientationTurns,
    ],
  );

  const handleCancelRoomPlacement = React.useCallback(() => {
    setPreviewState((previousState) => ({
      ...previousState,
      pendingRoomPlacementSlotId: null,
      pendingRoomPlacementFailure: null,
      pendingRoomOrientationTurns: 0,
      pendingRoomTileAdjustment: null,
      interactionMode: "explore",
    }));
  }, []);

  const handleSelectRoomTileAdjustment = React.useCallback(
    (option: BetrayalRoomTileAdjustmentOption) => {
      setPreviewState((previousState) => ({
        ...previousState,
        pendingRoomTileAdjustment: toRoomTileAdjustmentSelection(option),
      }));
    },
    [],
  );

  const handleConfirmRoomPlacement = React.useCallback(() => {
    const roomTileAdjustment = selectedRoomTileAdjustmentOption
      ? toRoomTileAdjustmentSelection(selectedRoomTileAdjustmentOption)
      : null;
    if (
      !pendingRoomPlacementPreview ||
      !selectedRoomOrientationOption ||
      (pendingRoomPlacementPreview.requiresTileAdjustment &&
        !roomTileAdjustment)
    ) {
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, {
      roomId: pendingRoomPlacementPreview.slotId,
      orientationTurns: selectedRoomOrientationOption.orientationTurns,
      ...(roomTileAdjustment ? { roomTileAdjustment } : {}),
      ...(useHolySymbolForExplore ? { useHolySymbol: true } : {}),
      ...(useIdolForExplore ? { useIdol: true } : {}),
      ...(ignoreEventSymbolWithTraitorPower
        ? { ignoreEventSymbolWithTraitorPower: true }
        : {}),
    });
    setPreviewState((previousState) => ({
      ...previousState,
      useHolySymbolForExplore: false,
      useIdolForExplore: false,
      ignoreEventSymbolWithTraitorPower: false,
      pendingRoomPlacementSlotId: null,
      pendingRoomPlacementFailure: null,
      pendingRoomOrientationTurns: 0,
      pendingRoomTileAdjustment: null,
      interactionMode: "default",
      selectedMonsterAttackMonsterId: null,
    }));
  }, [
    dispatchCommand,
    pendingRoomPlacementPreview,
    selectedRoomOrientationOption,
    selectedRoomTileAdjustmentOption,
    useHolySymbolForExplore,
    useIdolForExplore,
    ignoreEventSymbolWithTraitorPower,
  ]);

  const handleToggleHolySymbolExplore = React.useCallback(() => {
    if (!canDeclareHolySymbolExplore) {
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      pendingRoomPlacementSlotId: null,
      pendingRoomPlacementFailure: null,
      pendingRoomOrientationTurns: 0,
      pendingRoomTileAdjustment: null,
      useHolySymbolForExplore: !previousState.useHolySymbolForExplore,
    }));
  }, [canDeclareHolySymbolExplore]);

  const handleToggleIdolExplore = React.useCallback(() => {
    if (!canDeclareIdolExplore) {
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      pendingRoomPlacementSlotId: null,
      pendingRoomPlacementFailure: null,
      pendingRoomOrientationTurns: 0,
      pendingRoomTileAdjustment: null,
      useIdolForExplore: !previousState.useIdolForExplore,
      ignoreEventSymbolWithTraitorPower: false,
    }));
  }, [canDeclareIdolExplore]);

  const handleToggleTraitorEventSkip = React.useCallback(() => {
    if (!canDeclareTraitorEventSkip) {
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      pendingRoomPlacementSlotId: null,
      pendingRoomPlacementFailure: null,
      pendingRoomOrientationTurns: 0,
      pendingRoomTileAdjustment: null,
      useIdolForExplore: false,
      ignoreEventSymbolWithTraitorPower:
        !previousState.ignoreEventSymbolWithTraitorPower,
    }));
  }, [canDeclareTraitorEventSkip]);

  function handleSelectMaskTargetRoom(tokenId: string, roomId: string) {
      setPreviewState((previousState) => {
        const selectedMaskTargetRoomIdsByTokenId = {
          ...previousState.selectedMaskTargetRoomIdsByTokenId,
          [tokenId]: roomId,
        };
        const nextActiveMaskTargetTokenId =
          maskTargetTokens.find(
            (token) =>
              token.id !== tokenId &&
              !selectedMaskTargetRoomIdsByTokenId[token.id],
          )?.id ?? tokenId;
        return {
          ...previousState,
          activeMaskTargetTokenId: nextActiveMaskTargetTokenId,
          selectedMaskTargetRoomIdsByTokenId,
        };
      });
  }

  const handleSelectInventoryTargetRoom = React.useCallback(
    (roomId: string) => {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedInventoryTargetRoomId: roomId,
      }));
    },
    [],
  );

  const handleSelectInventoryReplacementRollTotal = React.useCallback(
    (selectedTotal: number) => {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedInventoryReplacementRollTotal: selectedTotal,
      }));
    },
    [],
  );

  const handleSelectActiveMaskTargetToken = React.useCallback(
    (tokenId: string) => {
      setPreviewState((previousState) => ({
        ...previousState,
        activeMaskTargetTokenId: tokenId,
      }));
    },
    [],
  );

  function handleSelectMonsterTarget(monsterId: string) {
      if (isBloodFromStonePeekabooMode) {
        const selectedSameRoomMonsterId =
          previewState.selectedPeekabooSameRoomMonsterId;
        if (selectedSameRoomMonsterId) {
          const option = bloodFromStonePeekabooOptions.find(
            (candidate) =>
              candidate.sameRoomMonsterId === selectedSameRoomMonsterId &&
              candidate.lineOfSightMonsterId === monsterId,
          );
          if (option) {
            dispatchCommand(BETRAYAL_COMMANDS.PLAY_PEEKABOO, {
              sameRoomMonsterId: option.sameRoomMonsterId,
              lineOfSightMonsterId: option.lineOfSightMonsterId,
            });
            setInventoryPreviewCardId(null);
            setPreviewState((previousState) => ({
              ...previousState,
              selectedPeekabooSameRoomMonsterId: null,
              selectedPeekabooLineOfSightMonsterId: null,
              hauntTargetingActionKind: null,
              interactionMode: "default",
            }));
            return;
          }
        }
        const sameRoomOption = bloodFromStonePeekabooOptions.find(
          (candidate) => candidate.sameRoomMonsterId === monsterId,
        );
        if (sameRoomOption) {
          const lineOfSightRoom = core.rooms.find(
            (room) => room.id === sameRoomOption.lineOfSightRoomId,
          );
          if (lineOfSightRoom) {
            setSelectedRoomMapFloor(lineOfSightRoom.floor);
          }
          setPreviewState((previousState) => ({
            ...previousState,
            selectedPeekabooSameRoomMonsterId:
              sameRoomOption.sameRoomMonsterId,
            selectedPeekabooLineOfSightMonsterId: null,
            hauntTargetingActionKind: "play-peekaboo",
            interactionMode: "default",
          }));
        }
        return;
      }
      if (
        selectedInventoryUseEffectMode === "moveOthersInRoom" &&
        maskTargetTokens.some(
          (token) => token.kind === "monster" && token.id === monsterId,
        )
      ) {
        handleSelectActiveMaskTargetToken(monsterId);
      }
  }

  const handleSelectInventoryTargetPlayer = React.useCallback(
    (playerId: string) => {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedInventoryTargetPlayerId: playerId,
      }));
    },
    [],
  );

  function resolveEventAcceptPreview(selection: {
    trait?: BetrayalTraitKey | null;
    cardId?: string | null;
    targetRoomId?: string | null;
    damageTraits?: BetrayalTraitKey[];
  }) {
      if (!pendingEventChoice || !pendingEventActionEffect) {
        return null;
      }
      const trait = selection.trait ?? null;
      const cardId = selection.cardId ?? null;
      const previewEffect = resolveEventPreviewEffect(
        core,
        pendingEventActionEffect,
        trait,
      );
      const targetRooms = resolveEventTargetRooms(core, previewEffect);
      const targetRoomId = selection.targetRoomId ?? null;
      const damageChoice = resolveEventGeneralDamageChoice(previewEffect);
      const damageTraits = damageChoice
        ? pruneSelectedDamageTraits(
            selection.damageTraits ?? [],
            damageChoice.allowedTraits,
            damageChoice.amount,
            core.currentExplorer,
            core.phase,
          )
        : [];
      return {
        trait,
        cardId,
        targetRooms,
        targetRoomId,
        damageChoice,
        damageTraits,
        ready:
          !pendingEventAcceptsUnsupportedHaunt &&
          (!pendingEventItemChoice ||
            Boolean(
              cardId &&
                pendingEventItemChoiceCards.some((card) => card.id === cardId),
            )) &&
          (!pendingEventAcceptTraitChoices.length || Boolean(trait)) &&
          (!targetRooms.length ||
            Boolean(
              targetRoomId &&
                targetRooms.some((room) => room.id === targetRoomId),
            )) &&
          (!damageChoice || damageTraits.length === damageChoice.amount),
      };
  }

  const resetEventChoicePreview = React.useCallback(() => {
    setPreviewState((previousState) => ({
      ...previousState,
      selectedEventTrait: null,
      selectedEventCardId: null,
      selectedEventTargetRoomId: null,
      selectedEventDamageTraits: [],
      interactionMode: "default",
      selectedMonsterAttackMonsterId: null,
    }));
  }, []);

  function dispatchResolveEventChoice(
    accept: boolean,
    selection?: {
      trait?: BetrayalTraitKey | null;
      cardId?: string | null;
      targetRoomId?: string | null;
      damageTraits?: BetrayalTraitKey[];
    },
  ) {
      if (!pendingEventChoice) {
        return false;
      }
      if (accept) {
        const preview = resolveEventAcceptPreview({
          trait: selection?.trait ?? selectedEventTrait,
          cardId: selection?.cardId ?? selectedEventCardId,
          targetRoomId: selection?.targetRoomId ?? selectedEventTargetRoomId,
          damageTraits: selection?.damageTraits ?? selectedEventDamageTraits,
        });
        if (!preview?.ready) {
          return false;
        }
        dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, {
          ...(preview.trait ? { trait: preview.trait } : {}),
          ...(preview.cardId ? { cardId: preview.cardId } : {}),
          ...(preview.targetRoomId
            ? { targetRoomId: preview.targetRoomId }
            : {}),
          ...(preview.damageTraits.length > 0
            ? { traits: preview.damageTraits }
            : {}),
          accept: true,
        });
      } else {
        if (!pendingEventCanDecline) {
          return false;
        }
        dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, {
          ...(selectedEventTrait ? { trait: selectedEventTrait } : {}),
          accept: false,
        });
      }
      resetEventChoicePreview();
      return true;
  }

  function handleSelectEventTrait(trait: BetrayalTraitKey) {
      const nextSelection = {
        trait,
        cardId: selectedEventCardId,
        targetRoomId: null,
        damageTraits: [],
      };
      const preview = resolveEventAcceptPreview(nextSelection);
      if (!pendingEventChoice?.declineLabel && preview?.ready) {
        dispatchResolveEventChoice(true, nextSelection);
        return;
      }
      setPreviewState((previousState) => ({
        ...previousState,
        selectedEventTrait: trait,
        selectedEventTargetRoomId: null,
        selectedEventDamageTraits: [],
      }));
  }

  function handleSelectEventCard(cardId: string) {
      const nextSelectedCardId = selectedEventCardId === cardId ? null : cardId;
      const nextSelection = {
        trait: selectedEventTrait,
        cardId: nextSelectedCardId,
        targetRoomId: selectedEventTargetRoomId,
        damageTraits: selectedEventDamageTraits,
      };
      const preview = resolveEventAcceptPreview(nextSelection);
      if (!pendingEventChoice?.declineLabel && preview?.ready) {
        dispatchResolveEventChoice(true, nextSelection);
        return;
      }
      setPreviewState((previousState) => ({
        ...previousState,
        selectedEventCardId: nextSelectedCardId,
      }));
  }

  function handleSelectEventTargetRoom(roomId: string) {
      const nextSelection = {
        trait: selectedEventTrait,
        cardId: selectedEventCardId,
        targetRoomId: roomId,
        damageTraits: selectedEventDamageTraits,
      };
      const preview = resolveEventAcceptPreview(nextSelection);
      if (!pendingEventChoice?.declineLabel && preview?.ready) {
        dispatchResolveEventChoice(true, nextSelection);
        return;
      }
      setPreviewState((previousState) => ({
        ...previousState,
        selectedEventTargetRoomId: roomId,
      }));
  }

  function handleToggleEventDamageTrait(trait: BetrayalTraitKey) {
      if (!pendingEventDamageChoice) {
        return;
      }
      const selected = pruneSelectedDamageTraits(
        selectedEventDamageTraits,
        pendingEventDamageChoice.allowedTraits,
        pendingEventDamageChoice.amount,
        core.currentExplorer,
        core.phase,
      );
      const currentCount = countSelectedDamageTrait(selected, trait);
      const maxTraitCount = Math.min(
        pendingEventDamageChoice.amount,
        resolveTraitDamageAssignableSteps(
          core.currentExplorer,
          trait,
          core.phase,
        ),
      );
      if (
        !pendingEventDamageChoice.allowedTraits.includes(trait) ||
        maxTraitCount <= 0
      ) {
        return;
      }
      const nextSelectedDamageTraits =
        currentCount >= maxTraitCount ||
        selected.length >= pendingEventDamageChoice.amount
          ? selected.filter((selectedTrait) => selectedTrait !== trait)
          : [...selected, trait];
      const nextSelection = {
        trait: selectedEventTrait,
        cardId: selectedEventCardId,
        targetRoomId: selectedEventTargetRoomId,
        damageTraits: nextSelectedDamageTraits,
      };
      const preview = resolveEventAcceptPreview(nextSelection);
      if (!pendingEventChoice?.declineLabel && preview?.ready) {
        dispatchResolveEventChoice(true, nextSelection);
        return;
      }
      setPreviewState((previousState) => ({
        ...previousState,
        selectedEventDamageTraits: nextSelectedDamageTraits,
      }));
  }

  function handleToggleDamageAllocationBrooch() {
      if (!pendingDamageAllocation || !pendingDamageExplorer) {
        return;
      }
      if (!canUseBroochForPendingDamageAllocation || !isPendingDamageAllocationForViewer) {
        return;
      }
      const nextUseBrooch = !pendingDamageUsesBrooch;
      const nextAllowedTraits = nextUseBrooch
        ? TRAIT_DAMAGE_ORDER
        : pendingDamageAllocation.allowedTraits;
      const nextSelectedDamageTraits = pruneSelectedDamageTraits(
        selectedDamageAllocationTraits,
        nextAllowedTraits,
        pendingDamageAllocation.amount,
        pendingDamageExplorer,
        pendingDamageAllocationPhase,
      );
      setPreviewState((previousState) => ({
        ...previousState,
        useBroochForDamageAllocation: nextUseBrooch,
        selectedDamageAllocationTraits: nextSelectedDamageTraits,
      }));
  }

  function handleToggleDamageAllocationTrait(trait: BetrayalTraitKey) {
      if (!pendingDamageAllocation || !pendingDamageExplorer) {
        return;
      }
      const selected = pruneSelectedDamageTraits(
        selectedDamageAllocationTraits,
        pendingDamageAllocationAllowedTraits,
        pendingDamageAllocation.amount,
        pendingDamageExplorer,
        pendingDamageAllocationPhase,
      );
      const currentCount = countSelectedDamageTrait(selected, trait);
      const maxTraitCount = Math.min(
        pendingDamageAllocation.amount,
        resolveTraitDamageAssignableSteps(
          pendingDamageExplorer,
          trait,
          pendingDamageAllocationPhase,
        ),
      );
      if (
        !pendingDamageAllocationAllowedTraits.includes(trait) ||
        maxTraitCount <= 0
      ) {
        return;
      }
      const nextSelectedDamageTraits =
        currentCount >= maxTraitCount ||
        selected.length >= pendingDamageAllocation.amount
          ? selected.filter((selectedTrait) => selectedTrait !== trait)
          : [...selected, trait];
      setPreviewState((previousState) => ({
        ...previousState,
        selectedDamageAllocationTraits: nextSelectedDamageTraits,
      }));
  }

  function handleResolveDamageAllocation() {
      if (!pendingDamageAllocationReady) {
        return;
      }
      dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, {
        traits: selectedDamageAllocationTraits,
        ...(pendingDamageUsesBrooch ? { useBrooch: true } : {}),
      });
      setPreviewState((previousState) => ({
        ...previousState,
        selectedDamageAllocationTraits: [],
        useBroochForDamageAllocation: false,
        interactionMode: "default",
        selectedMonsterAttackMonsterId: null,
      }));
  }

  const handleResolveEventChoice = (accept: boolean) => {
    dispatchResolveEventChoice(accept);
  };

  const handleSelectAttackWeapon = React.useCallback(
    (cardId: string | null) => {
      setPreviewState((previousState) => {
        const nextSelectedAttackWeaponCardId =
          previousState.selectedAttackWeaponCardId === cardId ? null : cardId;
        selectedAttackWeaponCardIdRef.current = nextSelectedAttackWeaponCardId;
        return {
          ...previousState,
          selectedAttackWeaponCardId: nextSelectedAttackWeaponCardId,
        };
      });
    },
    [],
  );

  const handleSelectDustHauntTrait = React.useCallback(
    (actionId: "search-for-cure" | "cure-the-dust", trait: BetrayalTraitKey) => {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedDustSearchTrait:
          actionId === "search-for-cure"
            ? trait
            : previousState.selectedDustSearchTrait,
        selectedDustCureTrait:
          actionId === "cure-the-dust"
            ? trait
            : previousState.selectedDustCureTrait,
      }));
    },
    [],
  );

  const handleUseAction = () => {
    if (isVisualBusy) {
      return;
    }
    const cardId = selectedInventoryCard?.id;
    if (
      !cardId &&
      core.phase === "haunt" &&
      hauntActionContext?.actionKind === "use"
    ) {
      const dispatchHauntAction = () =>
        dispatch(
          hauntActionContext.commandType,
          hauntActionContext.payload ?? {},
        );
      let visualStarted = false;
      if (
        hauntActionContext.commandType === BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL
      ) {
        visualStarted = startGirlTransferVisual({
          sourceRoomId: core.currentExplorer.roomId,
          targetTestId: `betrayal-explorer-figure-token-${core.currentExplorer.playerId}`,
          attachedTo: "explorer",
          onComplete: dispatchHauntAction,
        });
      } else if (
        hauntActionContext.commandType === BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY
      ) {
        const mummyMonsterId =
          core.scenarioRuntime.mummy?.mummyMonsterId ??
          core.monsters.find((monster) => monster.definitionId === "mummy")?.id;
        if (mummyMonsterId) {
          visualStarted = startGirlTransferVisual({
            sourceRoomId: core.currentExplorer.roomId,
            targetTestId: `betrayal-monster-board-token-${mummyMonsterId}`,
            attachedTo: "mummy",
            onComplete: dispatchHauntAction,
          });
        }
      }
      if (!visualStarted) {
        dispatchHauntAction();
      }
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        interactionMode: "default",
        selectedMonsterAttackMonsterId: null,
        selectedDustSearchTrait: null,
        selectedDustCureTrait: null,
      }));
      return;
    }
    if (!cardId) {
      return;
    }
    if (cardId && selectedCardCanUseRecentRollRerollItem) {
      setInventoryPreviewCardId(null);
      return;
    }
    const payload = cardId
      ? {
          cardId,
          ...(selectedInventoryTargetPlayerId
            ? { targetPlayerId: selectedInventoryTargetPlayerId }
            : {}),
          ...(selectedInventoryTargetRoomId
            ? { targetRoomId: selectedInventoryTargetRoomId }
            : {}),
          ...(selectedInventoryUseEffectMode === "moveOthersInRoom"
            ? { targetRoomIdsByTokenId: selectedMaskTargetRoomIdsByTokenId }
            : {}),
          ...(selectedInventoryUseEffectMode ===
            "nextNonCombatTraitRollTotalReplacement" &&
          selectedInventoryReplacementRollTotal !== null
            ? { replacementRollTotal: selectedInventoryReplacementRollTotal }
            : {}),
        }
      : {};
    applyOptimisticPreviewAfterCommand(
      BETRAYAL_COMMANDS.USE_POSSESSION,
      payload,
      {
        lastUsedInventoryCardId: cardId,
      },
    );
    dispatchCommand(BETRAYAL_COMMANDS.USE_POSSESSION, payload);
    setInventoryPreviewCardId(null);
  };

  const handleTradeAction = () => {
    if (hasPendingPlayerAgreement) {
      return;
    }
    if (shouldStartDustSicknessExchange) {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedTradeTargetPlayerId: null,
        selectedTradeGiveCardIds: [],
        tradeSelectionTouched: false,
        interactionMode:
          previousState.interactionMode === "sicknessExchange"
            ? "default"
            : "sicknessExchange",
        hauntTargetingActionKind:
          previousState.interactionMode === "sicknessExchange"
            ? null
            : "sickness-exchange",
      }));
      return;
    }
    if (selectedCorpseLootTarget) {
      if (!selectedCorpseLootCardId) {
        setPreviewState((previousState) => ({
          ...previousState,
          tradeSelectionTouched: true,
        }));
        return;
      }
      dispatchCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, {
        sourcePlayerId: selectedCorpseLootTarget.playerId,
        cardId: selectedCorpseLootCardId,
      });
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        selectedCorpseLootCardId: null,
        selectedTradeTargetPlayerId: null,
        selectedTradeGiveCardIds: [],
        selectedTradeReturnCardIds: [],
        interactionMode: "default",
      }));
      return;
    }
    if (!tradeSelectionReady) {
      setPreviewState((previousState) => ({
        ...previousState,
        tradeSelectionTouched: true,
      }));
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, {
      ...(useDogTrade
        ? { useDog: true, cardIds: selectedDogTradeCardIds }
        : selectedTradeGiveCardIds.length > 0
          ? { cardIds: selectedTradeGiveCardIds }
          : {}),
      ...(selectedTradeReturnCardIds.length > 0
        ? { targetCardIds: selectedTradeReturnCardIds }
        : {}),
      ...(selectedTradeTargetPlayerId
        ? { targetPlayerId: selectedTradeTargetPlayerId }
        : {}),
    });
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedInventoryCardId: null,
      selectedTradeTargetPlayerId: null,
      selectedTradeGiveCardIds: [],
      selectedDogTradeCardIds: [],
      selectedTradeReturnCardIds: [],
      tradeSelectionTouched: false,
      interactionMode: "default",
    }));
  };

  const handleResolveTradeAgreement = React.useCallback(
    (accept: boolean) => {
      dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, { accept });
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        selectedInventoryCardId: null,
        selectedTradeTargetPlayerId: null,
        selectedTradeGiveCardIds: [],
        selectedDogTradeCardIds: [],
        selectedTradeReturnCardIds: [],
        tradeSelectionTouched: false,
        interactionMode: "default",
        hauntTargetingActionKind: null,
      }));
    },
    [dispatchCommand],
  );

  const handleResolveSicknessExchange = React.useCallback(
    (accept: boolean) => {
      dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE, { accept });
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        selectedTradeTargetPlayerId: null,
        selectedTradeGiveCardIds: [],
        tradeSelectionTouched: false,
        interactionMode: "default",
        hauntTargetingActionKind: null,
      }));
    },
    [dispatchCommand],
  );

  const handleResolveHelpingHandsAttackReward = React.useCallback(
    (choice: "damage" | "steal", cardId?: string) => {
      dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD, {
        choice,
        ...(cardId ? { cardId } : {}),
      });
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        selectedTradeTargetPlayerId: null,
        selectedTradeGiveCardIds: [],
        tradeSelectionTouched: false,
        interactionMode: "default",
        hauntTargetingActionKind: null,
      }));
    },
    [dispatchCommand],
  );

  const handleResolveMummyAttackReward = React.useCallback(
    (choice: "damage" | "steal", cardId?: string) => {
      dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD, {
        choice,
        ...(cardId ? { cardId } : {}),
      });
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        selectedTradeTargetPlayerId: null,
        selectedTradeGiveCardIds: [],
        tradeSelectionTouched: false,
        interactionMode: "default",
        hauntTargetingActionKind: null,
      }));
    },
    [dispatchCommand],
  );

  const handleHelpingHandsTrollHandAttack = React.useCallback(
    (
      option: BetrayalHelpingHandsTrollHandAttackOption,
      targetPlayerId: string,
    ) => {
      dispatchCommand(BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK, {
        ...(option.combined
          ? { combined: true }
          : { monsterId: option.trollHandIds[0] ?? option.id }),
        targetPlayerId,
      });
      setPreviewState((previousState) => ({
        ...previousState,
        selectedTradeTargetPlayerId: null,
        tradeSelectionTouched: false,
        interactionMode: "default",
        selectedMonsterAttackMonsterId: null,
        hauntTargetingActionKind: null,
      }));
    },
    [dispatchCommand],
  );

  const handleHelpingHandsTrollHandMoveAction = React.useCallback(() => {
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => {
      if (previousState.interactionMode === "helpingHandsTrollMove") {
        return {
          ...previousState,
          interactionMode: "default",
          selectedHelpingHandsTrollHandMoveMonsterId: null,
          selectedMonsterAttackMonsterId: null,
        };
      }
      const selectedMonsterId =
        helpingHandsTrollHandMoveEntries.some(
          (entry) =>
            entry.monster.id ===
            previousState.selectedHelpingHandsTrollHandMoveMonsterId,
        )
          ? previousState.selectedHelpingHandsTrollHandMoveMonsterId
          : (helpingHandsTrollHandMoveEntries[0]?.monster.id ?? null);
      if (!selectedMonsterId) {
        return previousState;
      }
      return {
        ...previousState,
        interactionMode: "helpingHandsTrollMove",
        selectedHelpingHandsTrollHandMoveMonsterId: selectedMonsterId,
        selectedMonsterAttackMonsterId: null,
        hauntTargetingActionKind: null,
      };
    });
  }, [helpingHandsTrollHandMoveEntries]);

  const handleSelectHelpingHandsTrollHandMoveMonster = React.useCallback(
    (monsterId: string) => {
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        interactionMode: "helpingHandsTrollMove",
        selectedHelpingHandsTrollHandMoveMonsterId: monsterId,
        selectedMonsterAttackMonsterId: null,
        hauntTargetingActionKind: null,
      }));
    },
    [],
  );

  function handleHelpingHandsTrollHandMoveToRoom(roomId: string) {
    if (!selectedHelpingHandsTrollHandMoveMonsterId || isVisualBusy) {
      return;
    }
    const monsterId = selectedHelpingHandsTrollHandMoveMonsterId;
    const move = () =>
      dispatch(BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND, {
        monsterId,
        roomId,
      });
    if (!startMonsterMoveVisual(monsterId, roomId, move)) {
      move();
    }
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      interactionMode: "default",
      selectedHelpingHandsTrollHandMoveMonsterId: null,
      selectedMonsterAttackMonsterId: null,
      selectedTradeTargetPlayerId: null,
      selectedTradeGiveCardIds: [],
      tradeSelectionTouched: false,
      hauntTargetingActionKind: null,
    }));
  }

  const handleResolveMonsterTurnStart = React.useCallback(() => {
    if (!monsterTurnStartActionSlot?.monsterId) {
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, {
      monsterId: monsterTurnStartActionSlot.monsterId,
    });
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      interactionMode:
        previousState.interactionMode === "monsterMove"
          ? "default"
          : previousState.interactionMode,
      selectedMonsterMoveMonsterId: null,
      selectedMonsterAttackMonsterId: null,
      hauntTargetingActionKind: null,
    }));
  }, [dispatchCommand, monsterTurnStartActionSlot?.monsterId]);

  const handleRollMonsterMovementGroup = React.useCallback(() => {
    if (!monsterMovementRollActionSlot?.groupId) {
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP, {
      groupId: monsterMovementRollActionSlot.groupId,
    });
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      interactionMode:
        previousState.interactionMode === "monsterMove"
          ? "default"
          : previousState.interactionMode,
      selectedMonsterMoveMonsterId: null,
      selectedMonsterAttackMonsterId: null,
      hauntTargetingActionKind: null,
    }));
  }, [dispatchCommand, monsterMovementRollActionSlot?.groupId]);

  const handleMonsterMoveAction = React.useCallback(() => {
    setInventoryPreviewCardId(null);
    const selectedMonsterId = monsterMoveSlots.some(
      (slot) => slot.monsterId === previewState.selectedMonsterMoveMonsterId,
    )
      ? previewState.selectedMonsterMoveMonsterId
      : (monsterMoveSlots[0]?.monsterId ?? null);
    setPreviewState((previousState) => {
      if (previousState.interactionMode === "monsterMove") {
        return {
          ...previousState,
          interactionMode: "default",
          selectedMonsterMoveMonsterId: null,
          selectedMonsterAttackMonsterId: null,
        };
      }
      const selectedMonsterId = monsterMoveSlots.some(
        (slot) => slot.monsterId === previousState.selectedMonsterMoveMonsterId,
      )
        ? previousState.selectedMonsterMoveMonsterId
        : (monsterMoveSlots[0]?.monsterId ?? null);
      if (!selectedMonsterId) {
        return previousState;
      }
      return {
        ...previousState,
        interactionMode: "monsterMove",
        selectedMonsterMoveMonsterId: selectedMonsterId,
        selectedMonsterAttackMonsterId: null,
        hauntTargetingActionKind: null,
      };
    });
    if (previewState.interactionMode !== "monsterMove" && selectedMonsterId) {
      focusMonsterRoom(selectedMonsterId);
    }
  }, [focusMonsterRoom, monsterMoveSlots, previewState.interactionMode, previewState.selectedMonsterMoveMonsterId]);

  const handleSelectMonsterMoveMonster = React.useCallback(
    (monsterId: string) => {
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        interactionMode: "monsterMove",
        selectedMonsterMoveMonsterId: monsterId,
        selectedMonsterAttackMonsterId: null,
        hauntTargetingActionKind: null,
      }));
      focusMonsterRoom(monsterId);
    },
    [focusMonsterRoom],
  );

  function handleMoveMonsterToRoom(roomId: string) {
    if (!selectedMonsterMoveMonsterId || isVisualBusy) {
      return;
    }
    const monsterId = selectedMonsterMoveMonsterId;
    const move = () =>
      dispatch(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, {
        monsterId,
        roomId,
      });
    const finishMove = () => {
      move();
      focusRoomOnMap(roomId);
    };
    if (!startMonsterMoveVisual(monsterId, roomId, finishMove)) {
      move();
      focusRoomOnMap(roomId);
    }
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      interactionMode: "monsterMove",
      selectedMonsterMoveMonsterId,
      selectedMonsterAttackMonsterId: null,
      selectedTradeTargetPlayerId: null,
      selectedTradeGiveCardIds: [],
      tradeSelectionTouched: false,
      hauntTargetingActionKind: null,
    }));
  }

  const handleMonsterAttackAction = React.useCallback(() => {
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => {
      if (previousState.interactionMode === "monsterAttack") {
        return {
          ...previousState,
          interactionMode: "default",
          selectedMonsterAttackMonsterId: null,
          selectedTradeTargetPlayerId: null,
          tradeSelectionTouched: false,
          hauntTargetingActionKind: null,
        };
      }
      const selectedMonsterId = monsterAttackSlots.some(
        (slot) =>
          slot.monsterId === previousState.selectedMonsterAttackMonsterId,
      )
        ? previousState.selectedMonsterAttackMonsterId
        : (monsterAttackSlots[0]?.monsterId ?? null);
      if (!selectedMonsterId) {
        return previousState;
      }
      return {
        ...previousState,
        interactionMode: "monsterAttack",
        selectedMonsterAttackMonsterId: selectedMonsterId,
        selectedTradeTargetPlayerId: null,
        tradeSelectionTouched: false,
        hauntTargetingActionKind: null,
      };
    });
  }, [monsterAttackSlots]);

  const handleSelectMonsterAttackMonster = React.useCallback(
    (monsterId: string) => {
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        interactionMode: "monsterAttack",
        selectedMonsterAttackMonsterId: monsterId,
        selectedTradeTargetPlayerId: null,
        tradeSelectionTouched: false,
        hauntTargetingActionKind: null,
      }));
    },
    [],
  );

  const handleEndHelpingHandsMonsterTurn = React.useCallback(() => {
    dispatchCommand(BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN, {});
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedTradeTargetPlayerId: null,
      selectedTradeGiveCardIds: [],
      selectedTradeReturnCardIds: [],
      tradeSelectionTouched: false,
      interactionMode: "default",
      selectedHelpingHandsTrollHandMoveMonsterId: null,
      selectedMonsterMoveMonsterId: null,
      selectedMonsterAttackMonsterId: null,
      hauntTargetingActionKind: null,
    }));
  }, [dispatchCommand]);

  const handleEndBloodFromStoneMonsterTurn = React.useCallback(() => {
    dispatchCommand(BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN, {});
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedTradeTargetPlayerId: null,
      selectedTradeGiveCardIds: [],
      selectedTradeReturnCardIds: [],
      tradeSelectionTouched: false,
      interactionMode: "default",
      selectedHelpingHandsTrollHandMoveMonsterId: null,
      selectedMonsterMoveMonsterId: null,
      selectedMonsterAttackMonsterId: null,
      hauntTargetingActionKind: null,
      selectedBloodFromStoneStoneCherubRoomIds: [],
    }));
  }, [dispatchCommand]);
  const handleBloodFromStoneSetupPlacementAction = React.useCallback(() => {
    setInventoryPreviewCardId(null);
    const firstCandidateRoom = bloodFromStoneSetupCandidateRooms[0] ?? null;
    if (firstCandidateRoom) {
      setSelectedRoomMapFloor(firstCandidateRoom.floor);
    }
    setPreviewState((previousState) => {
      if (previousState.interactionMode === "bloodFromStoneSetupPlacement") {
        return {
          ...previousState,
          interactionMode: "default",
          selectedBloodFromStoneStoneCherubRoomIds: [],
        };
      }
      if (bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount <= 0) {
        return previousState;
      }
      return {
        ...previousState,
        interactionMode: "bloodFromStoneSetupPlacement",
        selectedBloodFromStoneStoneCherubRoomIds: [],
        selectedHelpingHandsTrollHandMoveMonsterId: null,
        selectedMonsterMoveMonsterId: null,
        selectedMonsterAttackMonsterId: null,
        selectedTradeTargetPlayerId: null,
        tradeSelectionTouched: false,
        hauntTargetingActionKind: null,
      };
    });
  }, [
    bloodFromStoneSetupCandidateRooms,
    bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
  ]);

  const handleSelectBloodFromStoneSetupPlacementRoom = React.useCallback(
    (roomId: string) => {
      if (
        bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount <= 0 ||
        !bloodFromStoneSetupCandidateRoomIds.has(roomId)
      ) {
        return;
      }
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => {
        const selectedRoomIds =
          previousState.selectedBloodFromStoneStoneCherubRoomIds
            .filter((candidateRoomId) =>
              bloodFromStoneSetupCandidateRoomIds.has(candidateRoomId),
            )
            .slice(0, bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount);
        if (
          selectedRoomIds.length >=
          bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount
        ) {
          return {
            ...previousState,
            interactionMode: "bloodFromStoneSetupPlacement",
            selectedBloodFromStoneStoneCherubRoomIds: selectedRoomIds,
          };
        }
        return {
          ...previousState,
          interactionMode: "bloodFromStoneSetupPlacement",
          selectedBloodFromStoneStoneCherubRoomIds: [
            ...selectedRoomIds,
            roomId,
          ],
          selectedHelpingHandsTrollHandMoveMonsterId: null,
          selectedMonsterMoveMonsterId: null,
          selectedMonsterAttackMonsterId: null,
          hauntTargetingActionKind: null,
        };
      });
    },
    [
      bloodFromStoneSetupCandidateRoomIds,
      bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
    ],
  );

  const handleConfirmBloodFromStoneSetupPlacement = React.useCallback(() => {
    if (
      selectedBloodFromStoneStoneCherubRoomIds.length !==
        bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount ||
      bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount <= 0
    ) {
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS, {
      roomIds: selectedBloodFromStoneStoneCherubRoomIds,
    });
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      interactionMode: "default",
      selectedBloodFromStoneStoneCherubRoomIds: [],
      selectedHelpingHandsTrollHandMoveMonsterId: null,
      selectedMonsterMoveMonsterId: null,
      selectedMonsterAttackMonsterId: null,
      hauntTargetingActionKind: null,
    }));
  }, [
    bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
    dispatchCommand,
    selectedBloodFromStoneStoneCherubRoomIds,
  ]);

  const handleCancelHauntTargeting = React.useCallback(() => {
    selectedAttackWeaponCardIdRef.current = null;
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedAttackWeaponCardId: null,
      selectedTradeTargetPlayerId: null,
      selectedTradeGiveCardIds: [],
      tradeSelectionTouched: false,
      interactionMode:
        previousState.interactionMode === "sicknessExchange" ||
        previousState.interactionMode === "monsterAttack" ||
        previousState.interactionMode === "bloodFromStoneSetupPlacement"
          ? "default"
          : previousState.interactionMode,
      selectedMonsterAttackMonsterId: null,
      selectedBloodFromStoneStoneCherubRoomIds: [],
      hauntTargetingActionKind: null,
    }));
  }, []);

  const handleToggleDogTradeCard = React.useCallback((cardId: string) => {
    setPreviewState((previousState) => {
      const selected = new Set(previousState.selectedDogTradeCardIds);
      if (selected.has(cardId)) {
        selected.delete(cardId);
      } else {
        selected.add(cardId);
      }
      return {
        ...previousState,
        selectedDogTradeCardIds: Array.from(selected),
        tradeSelectionTouched: true,
      };
    });
  }, []);

  const handleToggleTradeGiveCard = React.useCallback((cardId: string) => {
    setPreviewState((previousState) => {
      const selected = new Set(previousState.selectedTradeGiveCardIds);
      if (selected.has(cardId)) {
        selected.delete(cardId);
      } else {
        selected.add(cardId);
      }
      const selectedTradeGiveCardIds = Array.from(selected);
      return {
        ...previousState,
        selectedInventoryCardId:
          selectedTradeGiveCardIds[selectedTradeGiveCardIds.length - 1] ?? null,
        selectedTradeGiveCardIds,
        selectedInventoryTargetPlayerId: null,
        selectedInventoryTargetRoomId: null,
        selectedInventoryReplacementRollTotal: null,
        selectedMaskTargetRoomIdsByTokenId: {},
        activeMaskTargetTokenId: null,
        tradeSelectionTouched: true,
      };
    });
  }, []);

  const handleToggleTradeReturnCard = React.useCallback((cardId: string) => {
    setPreviewState((previousState) => {
      const selected = new Set(previousState.selectedTradeReturnCardIds);
      if (selected.has(cardId)) {
        selected.delete(cardId);
      } else {
        selected.add(cardId);
      }
      return {
        ...previousState,
        selectedTradeReturnCardIds: Array.from(selected),
        tradeSelectionTouched: true,
      };
    });
  }, []);

  const handleAttackAction = React.useCallback(
    (
      target: "traitor" | "hero" | "jack-spirit",
      targetPlayerId?: string | null,
      targetMonsterId?: string | null,
    ) => {
      const attackWeaponCardId = selectedAttackWeaponCardIdRef.current;
      dispatchCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, {
        target,
        ...(targetPlayerId ? { targetPlayerId } : {}),
        ...(targetMonsterId ? { targetMonsterId } : {}),
        ...(attackWeaponCardId ? { weaponCardId: attackWeaponCardId } : {}),
      });
      selectedAttackWeaponCardIdRef.current = null;
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        selectedAttackWeaponCardId: null,
        interactionMode: "default",
        hauntTargetingActionKind: null,
      }));
    },
    [dispatchCommand],
  );

  const handleDynamiteRoomAttack = React.useCallback(
    (targetRoomId: string) => {
      const attackWeaponCardId = selectedAttackWeaponCardIdRef.current;
      if (!attackWeaponCardId) {
        return;
      }
      dispatchCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, {
        target: "dynamite-room",
        weaponCardId: attackWeaponCardId,
        targetRoomId,
      });
      selectedAttackWeaponCardIdRef.current = null;
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        selectedAttackWeaponCardId: null,
        interactionMode: "default",
        hauntTargetingActionKind: null,
      }));
    },
    [dispatchCommand],
  );

  const handleHauntPrimaryAction = () => {
    if (!hauntActionContext || hasPendingPlayerAgreement) {
      return;
    }
    if (hauntActionDisabledReason) {
      return;
    }

    const focusRoom = (roomId: string | null | undefined) => {
      const room = core.rooms.find((item) => item.id === roomId);
      if (room) {
        setSelectedRoomMapFloor(room.floor);
      }
    };
    const focusExplorer = (playerId: string | null | undefined) => {
      const explorer = allExplorers.find((item) => item.playerId === playerId);
      focusRoom(explorer?.roomId);
    };

    const isDynamiteRoomAttackAction =
      hauntActionContext.actionKind === "attack-room" ||
      (hauntActionContext.actionKind.startsWith("attack-") &&
        selectedAttackWeaponEffectId === "dynamite");
    if (isDynamiteRoomAttackAction) {
      if (
        selectedAttackWeaponEffectId !== "dynamite" &&
        dynamiteAttackWeaponCard
      ) {
        selectedAttackWeaponCardIdRef.current = dynamiteAttackWeaponCard.id;
      }
      focusRoom(core.currentExplorer.roomId);
    } else switch (hauntActionContext.actionKind) {
      case "use":
        handleUseAction();
        return;
      case "sickness-exchange":
        handleTradeAction();
        focusExplorer(dustSameRoomLivingTargets[0]?.playerId);
        return;
      case "attack-dust":
        focusExplorer(dustSameRoomLivingTargets[0]?.playerId);
        break;
      case "attack-traitor":
        focusExplorer(core.scenarioRuntime.traitorPlayerId);
        break;
      case "attack-hero":
        focusExplorer(heroAttackTargets[0]?.playerId);
        break;
      case "play-peekaboo":
        focusRoom(bloodFromStonePeekabooOptions[0]?.sameRoomRoomId);
        break;
      default:
        break;
    }

    setPreviewState((previousState) => ({
      ...previousState,
      selectedAttackWeaponCardId:
        isDynamiteRoomAttackAction && dynamiteAttackWeaponCard
          ? dynamiteAttackWeaponCard.id
          : previousState.selectedAttackWeaponCardId,
      interactionMode: "default",
      hauntTargetingActionKind: hauntActionContext.actionKind,
      selectedPeekabooSameRoomMonsterId: null,
      selectedPeekabooLineOfSightMonsterId: null,
    }));
  };

  function handleSelectExplorerTarget(explorer: BetrayalExplorerSummary) {
      if (
        isMonsterAttackMode &&
        selectedMonsterAttackEntry &&
        selectedMonsterAttackTargetPlayerIds.has(explorer.playerId)
      ) {
        if (selectedMonsterAttackEntry.kind === "phantom-photographer") {
          dispatchCommand(BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK, {
            monsterId: selectedMonsterAttackEntry.monster.id,
            targetPlayerId: explorer.playerId,
          });
        } else if (
          selectedMonsterAttackEntry.slot.command ===
          BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO
        ) {
          dispatchCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, {
            monsterId: selectedMonsterAttackEntry.monster.id,
            targetPlayerId: explorer.playerId,
          });
        } else {
          dispatchCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, {
            target: "hero",
            targetPlayerId: explorer.playerId,
          });
        }
        setPreviewState((previousState) => ({
          ...previousState,
          selectedTradeTargetPlayerId: null,
          selectedMonsterAttackMonsterId: null,
          tradeSelectionTouched: false,
          interactionMode: "default",
          hauntTargetingActionKind: null,
        }));
        return;
      }
      if (
        activeHauntTargetGuide?.kind === "explorer" &&
        activeHauntTargetGuide.playerId === explorer.playerId &&
        hauntActionContext?.actionKind === "attack-traitor" &&
        explorer.playerId === core.scenarioRuntime.traitorPlayerId
      ) {
        handleAttackAction("traitor");
        return;
      }
      if (
        hauntActionContext?.actionKind === "use" &&
        (magicCameraPhotoTargetPlayerIds.has(explorer.playerId) ||
          helpingHandsTrollHandAttackTargetPlayerIds.has(explorer.playerId))
      ) {
        setPreviewState((previousState) => ({
          ...previousState,
          selectedTradeTargetPlayerId: explorer.playerId,
          tradeSelectionTouched: true,
        }));
        return;
      }
      if (
        isHeroAttackTargetingMode &&
        heroAttackTargetPlayerIds.has(explorer.playerId)
      ) {
        handleAttackAction("hero", explorer.playerId);
        return;
      }
      if (
        isDustSicknessExchangeMode &&
        dustTargetPlayerIds.has(explorer.playerId)
      ) {
        dispatchCommand(BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE, {
          targetPlayerId: explorer.playerId,
        });
        setPreviewState((previousState) => ({
          ...previousState,
          selectedTradeTargetPlayerId: null,
          selectedTradeGiveCardIds: [],
          tradeSelectionTouched: false,
          interactionMode: "default",
          hauntTargetingActionKind: null,
        }));
        return;
      }
      if (
        isDustAttackTargetingMode &&
        dustTargetPlayerIds.has(explorer.playerId)
      ) {
        handleAttackAction("hero", explorer.playerId);
        return;
      }
      if (
        selectedInventoryUseEffectMode === "healTraits" &&
        healTargetExplorers.some(
          (target) => target.playerId === explorer.playerId,
        )
      ) {
        handleSelectInventoryTargetPlayer(explorer.playerId);
        return;
      }
      if (
        selectedInventoryUseEffectMode === "moveOthersInRoom" &&
        maskTargetTokens.some(
          (token) =>
            token.kind === "explorer" && token.id === explorer.playerId,
        )
      ) {
        handleSelectActiveMaskTargetToken(explorer.playerId);
        return;
      }
      if (
        isTradeOrLootTargetSelectionActive &&
        (activeTradeTargets.some(
          (target) => target.playerId === explorer.playerId,
        ) ||
          corpseLootTargets.some(
            (target) => target.playerId === explorer.playerId,
          ))
      ) {
        setPreviewState((previousState) => ({
          ...previousState,
          selectedTradeTargetPlayerId: explorer.playerId,
          selectedTradeReturnCardIds:
            previousState.selectedTradeTargetPlayerId === explorer.playerId
              ? previousState.selectedTradeReturnCardIds
              : [],
          selectedCorpseLootCardId: corpseLootTargets.some(
            (target) => target.playerId === explorer.playerId,
          )
            ? null
            : previousState.selectedCorpseLootCardId,
          tradeSelectionTouched: true,
        }));
      }
  }

  const handleEndTurnAction = React.useCallback(() => {
    dispatchCommand(BETRAYAL_COMMANDS.END_TURN, {});
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedTradeTargetPlayerId: null,
      selectedTradeGiveCardIds: [],
      selectedTradeReturnCardIds: [],
      tradeSelectionTouched: false,
      interactionMode: "default",
      selectedMonsterMoveMonsterId: null,
      selectedMonsterAttackMonsterId: null,
    }));
  }, [dispatchCommand]);

  const handleRoomEffectAction = React.useCallback(() => {
    dispatchCommand(BETRAYAL_COMMANDS.USE_ROOM_EFFECT, {});
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedTradeTargetPlayerId: null,
      selectedTradeGiveCardIds: [],
      selectedTradeReturnCardIds: [],
      tradeSelectionTouched: false,
      interactionMode: "default",
      selectedMonsterMoveMonsterId: null,
      selectedMonsterAttackMonsterId: null,
    }));
  }, [dispatchCommand]);

  const roomSpecialActionStatus = resolveBetrayalRoomSpecialActionStatus(core);
  const canUseRoomEffect = roomSpecialActionStatus.canUse;
  const shouldShowRoomEffectAction =
    roomSpecialActionStatus.availableInCurrentRoom;
  const roomEffectDisabledReason = (() => {
    if (roomSpecialActionStatus.canUse) {
      return null;
    }
    if (!roomSpecialActionStatus.phaseEligible) {
      return t("board.status.roomEffectWrongPhase");
    }
    if (roomSpecialActionStatus.turnEndedByDiscovery) {
      return t("board.status.roomEffectDiscoveryEnded");
    }
    if (roomSpecialActionStatus.usedThisTurn) {
      return t("board.status.roomEffectUsedThisTurn");
    }
    return t("board.status.roomEffectUnavailable");
  })();
  const visibleActionDisabledReason = (() => {
    if (selectedInventoryCard && selectedCardUseDisabled) {
      return selectedCardUseDisabledReason;
    }
    if (core.phase === "haunt" && hauntActionDisabledReason) {
      return hauntActionDisabledReason;
    }
    if (
      shouldShowRoomEffectAction &&
      !canUseRoomEffect &&
      roomEffectDisabledReason
    ) {
      return roomEffectDisabledReason;
    }
    return null;
  })();
  const actionItems: ActionBarAction[] = [
    {
      id: "move",
      label:
        previewState.interactionMode === "move"
          ? t("board.actions.cancelMove")
          : t("board.actions.move"),
      disabled: hasPendingPlayerAgreement || core.movesRemaining <= 0,
      variant: "secondary",
    },
    {
      id: "explore",
      label: t("board.actions.explore"),
      disabled: hasPendingPlayerAgreement || !canStartExploreSelection,
      variant: "primary",
    },
    {
      id: "trade",
      label: hasCorpseLootTargets
        ? t("board.actions.loot")
        : tradeSelectionReady && !hasPendingPlayerAgreement
          ? t("board.actions.sendTradeRequest")
          : shouldStartDustSicknessExchange
          ? isDustSicknessExchangeMode
            ? t("board.actions.cancelSicknessExchange")
            : t("board.actions.exchangeSickness")
            : t("board.actions.trade"),
      disabled: hasCorpseLootTargets
        ? hasPendingPlayerAgreement
        : hasPendingPlayerAgreement
          ? true
          : shouldStartDustSicknessExchange
            ? false
            : hasUsedTradeThisTurn ||
              !hasAnyTradeSelectableCards ||
              activeTradeTargets.length === 0,
      variant: "secondary",
    },
    {
      id: "use",
      label:
        core.phase === "haunt" && hauntActionContext && !selectedInventoryCard
          ? hauntActionContext.label
          : t("board.actions.use"),
      disabled: hasPendingPlayerAgreement
        ? true
        : core.phase === "haunt" && hauntActionContext && !selectedInventoryCard
          ? Boolean(hauntActionDisabledReason)
          : core.currentExplorerInventory.length === 0 ||
            selectedCardUseDisabled,
      description:
        core.phase === "haunt" && hauntActionContext && !selectedInventoryCard
          ? (hauntActionDisabledReason ?? undefined)
          : selectedCardUseDisabled
            ? (selectedCardUseDisabledReason ?? undefined)
          : undefined,
      variant: "secondary",
    },
    {
      id: "roomEffect",
      label: t("board.actions.roomEffectMysticElevator"),
      disabled: hasPendingPlayerAgreement || !canUseRoomEffect,
      description: !canUseRoomEffect
        ? (roomEffectDisabledReason ?? undefined)
        : undefined,
      variant: "secondary",
    },
    {
      id: "endTurn",
      label: roomEndTurnEffectHint
        ? t("board.actions.endTurnRoomEffect")
        : t("board.actions.endTurn"),
      disabled: hasPendingPlayerAgreement,
      variant: "ghost",
    },
  ];
  const helpingHandsMonsterTurnActionItems: ActionBarAction[] =
    isHelpingHandsMonsterTurnController
      ? [
          {
            id: "move",
            label:
              previewState.interactionMode === "helpingHandsTrollMove"
                ? t("board.actions.cancelTrollHandMove")
                : t("board.actions.moveTrollHand"),
            disabled:
              hasPendingPlayerAgreement ||
              helpingHandsTrollHandMoveEntries.length === 0,
            description:
              helpingHandsTrollHandMoveEntries.length === 0
                ? t("board.status.helpingHandsTrollNoMoveTarget")
                : undefined,
            variant: "secondary",
          },
          {
            id: "use",
            label: hauntActionContext
              ? hauntActionContext.label
              : t("board.actions.attack"),
            disabled:
              hasPendingPlayerAgreement ||
              !hauntActionContext ||
              Boolean(hauntActionDisabledReason),
            description:
              hauntActionDisabledReason ??
              (!hauntActionContext
                ? t("board.status.helpingHandsTrollNoAttackTarget")
                : undefined),
            variant: "secondary",
          },
          {
            id: "endTurn",
            label: t("board.actions.endHelpingHandsMonsterTurn"),
            disabled: hasPendingPlayerAgreement,
            variant: "ghost",
          },
        ]
      : [];
  const bloodFromStoneSetupPlacementActionItems: ActionBarAction[] =
    bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount > 0
      ? [
          {
            id: "bloodFromStoneSetupPlacement",
            label: isBloodFromStoneSetupPlacementMode
              ? t("board.actions.cancelBloodFromStoneStoneCherubPlacement")
              : t("board.actions.placeBloodFromStoneStoneCherubs"),
            disabled: hasPendingPlayerAgreement,
            description: t("board.status.bloodFromStoneSetupPlacementRemaining", {
              count: bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
            }),
            variant: "secondary",
          },
          ...(isBloodFromStoneSetupPlacementMode
            ? [
                {
                  id: "bloodFromStoneConfirmSetupPlacement",
                  label: t("board.actions.confirmBloodFromStoneStoneCherubPlacement"),
                  disabled:
                    hasPendingPlayerAgreement ||
                    selectedBloodFromStoneStoneCherubRoomIds.length !==
                      bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
                  description:
                    selectedBloodFromStoneStoneCherubRoomIds.length ===
                    bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount
                      ? undefined
                      : t("board.status.bloodFromStoneSetupPlacementSelected", {
                          selected:
                            selectedBloodFromStoneStoneCherubRoomIds.length,
                          total:
                            bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount,
                        }),
                  variant: "primary" as const,
                },
              ]
            : []),
        ]
      : [];
  const monsterActionItems: ActionBarAction[] =
    core.phase === "haunt" && !helpingHandsMonsterTurnStatus.active
      ? monsterTurnStartActionSlot?.monsterId
        ? [
            {
              id: "monsterTurnStart",
              label: t("board.actions.resolveMonsterTurnStart", {
                monster: resolveMonsterActionSlotName(
                  monsterTurnStartActionSlot,
                ),
              }),
              disabled: hasPendingPlayerAgreement,
              description: monsterTurnStartActionSlot.reason ?? undefined,
              variant: "secondary",
            },
          ]
        : monsterMovementRollActionSlot?.groupId
          ? [
              {
                id: "monsterMovementRoll",
                label: t("board.actions.rollMonsterMovement", {
                  monster: resolveMonsterActionSlotName(
                    monsterMovementRollActionSlot,
                  ),
                }),
                disabled: hasPendingPlayerAgreement,
                description:
                  monsterMovementRollActionSlot.reason ?? undefined,
                variant: "secondary",
              },
            ]
          : selectedMonsterMoveEntry
            ? [
                {
                  id: "monsterMove",
                  label:
                    previewState.interactionMode === "monsterMove"
                      ? t("board.actions.cancelMonsterMove")
                      : t("board.actions.moveMonster", {
                          monster: selectedMonsterMoveEntry.monster.name,
                        }),
                  disabled: hasPendingPlayerAgreement,
                  description:
                    selectedMonsterMoveEntry.slot.reason ?? undefined,
                  variant: "secondary",
                },
              ]
            : selectedMonsterAttackEntry
              ? [
                  {
                    id: "monsterAttack",
                    label:
                      previewState.interactionMode === "monsterAttack"
                        ? t("board.actions.cancelMonsterAttack")
                        : t("board.actions.attackMonster", {
                            monster: selectedMonsterAttackEntry.monster.name,
                          }),
                    disabled: hasPendingPlayerAgreement,
                    description:
                      selectedMonsterAttackEntry.slot.reason ?? undefined,
                    variant: "secondary",
                  },
                ]
              : bloodFromStoneMonsterTurnEndActionSlot
                ? [
                    {
                      id: "bloodFromStoneMonsterTurnEnd",
                      label: t("board.actions.endBloodFromStoneMonsterTurn"),
                      disabled: hasPendingPlayerAgreement,
                      description:
                        bloodFromStoneMonsterTurnEndActionSlot.reason ?? undefined,
                      variant: "secondary",
                    },
                  ]
                : []
      : [];
  const visibleActionItems = shouldShowHauntRevealCue
    ? []
    : activeHauntTargetGuide
    ? [
        {
          id: "use",
          label:
            activeHauntTargetGuide.cue ??
            t("board.status.hauntTargetingPrimary"),
          disabled: true,
          variant: "secondary" as const,
        },
        {
          id: "cancelTarget",
          label: t("board.status.hauntTargetingCancel"),
          disabled: false,
          variant: "ghost" as const,
        },
      ]
    : helpingHandsMonsterTurnStatus.active
    ? helpingHandsMonsterTurnActionItems
    : isDeadTraitorJackSpiritControlTurn
    ? actionItems.filter(
        (action) => action.id === "move" || action.id === "endTurn",
      )
    : bloodFromStoneSetupPlacementActionItems.length > 0
    ? bloodFromStoneSetupPlacementActionItems
    : core.turnEndedByDiscovery
    ? actionItems.filter((action) => action.id === "endTurn")
    : monsterActionItems.length > 0
    ? monsterActionItems
    : [
        ...actionItems.filter((action) => {
          if (action.id === "explore" && !canStartExploreSelection) {
            return false;
          }
          if (action.id === "roomEffect") {
            return shouldShowRoomEffectAction;
          }
          return true;
        }),
      ];

  const tutorialMapTargetRoomId = React.useMemo(() => {
    const target = tutorialStep?.highlightTarget;
    if (!isTutorialActive || !target) {
      return null;
    }
    if (
      target.startsWith("betrayal-room-") &&
      !target.startsWith("betrayal-room-preview-") &&
      !target.startsWith("betrayal-room-shell-")
    ) {
      return target.replace("betrayal-room-", "");
    }
    return null;
  }, [isTutorialActive, tutorialStep?.highlightTarget]);

  const actionHandlerMap: Record<ActionBarAction["id"], () => void> = {
    move: isHelpingHandsMonsterTurnController
      ? handleHelpingHandsTrollHandMoveAction
      : handleMoveAction,
    explore: handleExploreAction,
    trade: handleTradeAction,
    use:
      core.phase === "haunt" && hauntActionContext && !selectedInventoryCard
        ? handleHauntPrimaryAction
        : handleUseAction,
    roomEffect: handleRoomEffectAction,
    monsterTurnStart: handleResolveMonsterTurnStart,
    monsterMovementRoll: handleRollMonsterMovementGroup,
    monsterMove: handleMonsterMoveAction,
    monsterAttack: handleMonsterAttackAction,
    bloodFromStoneSetupPlacement: handleBloodFromStoneSetupPlacementAction,
    bloodFromStoneConfirmSetupPlacement:
      handleConfirmBloodFromStoneSetupPlacement,
    bloodFromStoneMonsterTurnEnd: handleEndBloodFromStoneMonsterTurn,
    endTurn: isHelpingHandsMonsterTurnController
      ? handleEndHelpingHandsMonsterTurn
      : handleEndTurnAction,
    cancelTarget: handleCancelHauntTargeting,
  };
  const renderInventoryCard = (
    item: BetrayalInventoryCard,
    options: {
      layout: "focus" | "compact" | "preview";
      testId?: string;
      compactDenseNoFront?: boolean;
      selected?: boolean;
      onSelect?: () => void;
      showTurnStatus?: boolean;
      tradeStatus?: BetrayalTradeCardStatus | null;
      disabled?: boolean;
      disabledReason?: string | null;
      instanceKey?: string;
    },
  ) => {
    const resolvedTradeStatus =
      options.tradeStatus ??
      (!isDustSicknessExchangeMode &&
      core.recommendedAction === "trade" &&
      !pendingTradeAgreement
        ? resolveBetrayalTradeCardStatus(core, item.id, {
            ownerPlayerId: core.currentExplorer.playerId,
            ownerRole: "requester",
          })
        : null);
    const disabledReason =
      options.disabledReason ?? resolvedTradeStatus?.reason ?? null;
    const isCardDisabled = Boolean(
      options.disabled ?? (resolvedTradeStatus && !resolvedTradeStatus.canTrade),
    );
    const isSelected =
      options.selected ??
      (core.recommendedAction === "trade" &&
      !isDustSicknessExchangeMode &&
      selectedTradeGiveCardIds.includes(item.id)
        ? true
        : item.id === selectedInventoryCard?.id);
    const shouldShowTurnStatus = options.showTurnStatus ?? true;
    const isUsedThisTurn =
      shouldShowTurnStatus && core.usedCardIdsThisTurn.includes(item.id);
    const isAvailableThisTurn =
      !shouldShowTurnStatus || core.turnStartInventoryCardIds.includes(item.id);
    const isUnavailableThisTurn = !isUsedThisTurn && !isAvailableThisTurn;
    const tone = INVENTORY_FACE_TONE[item.kind];
    const frontVisual = resolvePossessionAtlasVisual(item);
    const backAsset = INVENTORY_CARD_BACK_ASSET[item.kind];
    const accentAsset = resolveInventoryCardAccentAsset(item);
    const isFocus = options.layout === "focus";
    const isPreview = options.layout === "preview";
    const isCompact = options.layout === "compact";
    const isTutorialBookTarget =
      !isPreview &&
      isTutorialActive &&
      tutorialStep?.id === "use-book" &&
      item.id === "omen-book";
    const canModifyRecentRoll = !isPreview && rollModifierCardIds.has(item.id);
    const isTradeCompact =
      isCompact && Boolean(frontVisual) && core.recommendedAction === "trade";
    const isDenseNoFrontCompact =
      isCompact && !frontVisual && Boolean(options.compactDenseNoFront);
    const isCompactDenseOmen = isDenseNoFrontCompact && item.kind === "omen";
    const shellRadiusClass = isPreview
      ? "rounded-[16px]"
      : isFocus
        ? "rounded-[10px]"
        : "rounded-[6px]";
    const cardWidthStyle = isPreview
      ? { width: "100%" }
      : isCompact
        ? { width: `${COMPACT_INVENTORY_CARD_WIDTH}px` }
        : undefined;
    const showSelectedState = !isPreview && isSelected;
    const showActionTargetOutline =
      !showSelectedState && (isTutorialBookTarget || canModifyRecentRoll);
    const titleClass = isPreview
      ? `min-h-[52px] text-[18px] font-semibold leading-[22px] ${frontVisual ? "text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]" : "text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]"}`
      : isFocus
        ? `min-h-[34px] text-[13px] font-semibold leading-[16px] ${frontVisual ? "text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]" : "text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]"}`
        : `min-h-[16px] text-[8px] font-semibold leading-[9px] ${frontVisual ? "text-[#f7ecd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.68)]" : "text-[#f3ead8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.76)]"}`;

    const compactStackStyle = isCompact
      ? {
          zIndex: showSelectedState ? 12 : 2,
        }
      : undefined;
    const buttonOutlineClass = showSelectedState
      ? "z-30 -translate-y-0.5 shadow-[0_0_20px_rgba(238,204,126,0.48)]"
      : canModifyRecentRoll
        ? "z-30"
        : isPreview
          ? "z-10"
          : "z-10 hover:-translate-y-0.5";
    const outerRingClass = "";
    return (
      <div
        key={options.instanceKey ?? `${options.layout}-${item.id}`}
        className={`group relative isolate ${isCompact ? "shrink-0" : "w-full"}`}
        style={{ ...cardWidthStyle, ...compactStackStyle }}
      >
        <button
          type="button"
          onClick={() => {
            if (isPreview) {
              return;
            }
            if (options.onSelect) {
              options.onSelect();
              return;
            }
            if (
              core.recommendedAction === "trade" &&
              !isDustSicknessExchangeMode
            ) {
              handleToggleTradeGiveCard(item.id);
              return;
            }
            setPreviewState((previousState) => ({
              ...previousState,
              selectedInventoryCardId: item.id,
              selectedInventoryTargetPlayerId: null,
              selectedInventoryTargetRoomId: null,
              selectedInventoryReplacementRollTotal: null,
              selectedMaskTargetRoomIdsByTokenId: {},
              activeMaskTargetTokenId: null,
              tradeSelectionTouched: true,
            }));
          }}
          data-testid={options.testId}
          data-roll-modifier-available={canModifyRecentRoll ? "true" : "false"}
          data-trade-card-status={resolvedTradeStatus?.canTrade === false ? "disabled" : resolvedTradeStatus ? "available" : undefined}
          data-trade-card-disabled-reason={disabledReason ?? undefined}
          title={
            disabledReason
              ? `${item.name} · ${disabledReason}`
              : `${item.name} · ${resolveInventoryRulesSummary(item, t)} · 点击选择`
          }
          disabled={isCardDisabled}
          className={`pointer-events-auto relative w-full overflow-visible text-left outline-none transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${showSelectedState ? "" : "focus-visible:ring-0"} ${isCardDisabled ? "cursor-not-allowed" : buttonOutlineClass}`}
          aria-pressed={isPreview ? undefined : isSelected}
        >
          {showSelectedState ? (
            <span
              data-testid={
                options.testId
                  ? `${options.testId}-selected-outline`
                  : undefined
              }
              data-highlight-shape="card"
              aria-hidden="true"
              className={`pointer-events-none absolute z-20 ${shellRadiusClass} ${
                isCompact
                  ? "-inset-[3px]"
                  : isFocus
                    ? "-inset-[4px]"
                    : "-inset-[6px]"
              }`}
              style={{
                border: "2px solid #eecc7e",
                boxShadow:
                  "0 0 0 1px rgba(238, 204, 126, 0.32), 0 0 20px rgba(238, 204, 126, 0.48)",
              }}
            />
          ) : showActionTargetOutline ? (
            <span
              data-testid={
                options.testId
                  ? `${options.testId}-${isTutorialBookTarget ? "tutorial-target" : "roll-modifier"}`
                  : undefined
              }
              data-highlight-shape="card"
              aria-hidden="true"
              className={`pointer-events-none absolute z-20 ${shellRadiusClass} shadow-[0_0_20px_rgba(159,225,167,0.48)] ${
                isCompact
                  ? "inset-[3px]"
                  : isFocus
                    ? "inset-[4px]"
                    : "inset-[6px]"
              }`}
              style={{
                border: "2px solid #9fe1a7",
              }}
            />
          ) : null}
          {isUsedThisTurn || isUnavailableThisTurn ? (
            <div
              className={`pointer-events-none absolute right-2 top-2 z-10 border border-[#7c5941] bg-[rgba(58,31,24,0.82)] ${isFocus ? "px-2 py-1 text-[10px]" : "px-1.5 py-0.5 text-[9px]"} font-medium text-[#f0c1a2]`}
            >
              {t(
                isUsedThisTurn
                  ? "board.status.cardUsedTag"
                  : "board.status.cardUnavailableTag",
              )}
            </div>
          ) : null}
          <div
            data-testid={options.testId ? `${options.testId}-shell` : undefined}
            data-selected-outline={showSelectedState ? "true" : undefined}
            data-tutorial-target-outline={
              isTutorialBookTarget ? "true" : undefined
            }
            data-modifier-outline={
              canModifyRecentRoll && !showSelectedState ? "true" : undefined
            }
            data-rules-summary={resolveInventoryRulesSummary(item, t)}
            className={`relative flex w-full flex-col overflow-hidden ${shellRadiusClass} ${outerRingClass} border ${
              showSelectedState
                ? "border-[#eecc7e] bg-transparent"
                : frontVisual
                  ? isCompact
                    ? "border-[rgba(120,105,76,0.18)] bg-[rgba(10,8,6,0.18)]"
                    : "border-[rgba(60,47,32,0.82)] bg-[rgba(10,8,6,0.96)]"
                  : isCompact
                    ? "border-[rgba(98,92,71,0.18)] bg-[rgba(13,15,11,0.18)]"
                    : tone.cardSurfaceClass
            } ${!isPreview && (isUsedThisTurn || isUnavailableThisTurn || isCardDisabled) ? "opacity-60" : ""}`}
            style={{
              aspectRatio: BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
              ...(showSelectedState
                ? {
                    borderColor: "#eecc7e",
                    borderStyle: "solid",
                    borderWidth: "1px",
                  }
                : {}),
            }}
          >
            {frontVisual ? (
              <>
                <div
                  className={`absolute overflow-hidden ${
                    isCompact
                      ? "inset-[3px] rounded-[5px] bg-transparent"
                      : "inset-0 bg-[rgba(10,8,6,0.96)]"
                  }`}
                >
                  <PossessionAtlasFrame
                    visual={frontVisual}
                    locale={effectiveLocale}
                    alt={item.name}
                    testId={
                      options.testId
                        ? `${options.testId}-front-atlas`
                        : undefined
                    }
                  />
                  {isTradeCompact ? null : (
                    <div
                      className={`pointer-events-none absolute inset-0 ${
                        isCompact
                          ? "bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.02)_50%,rgba(7,6,5,0.1)_78%,rgba(7,6,5,0.54))]"
                          : "bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.02)_30%,rgba(0,0,0,0.08)_66%,rgba(7,6,5,0.72))]"
                      }`}
                    />
                  )}
                </div>
                <div
                  className={`pointer-events-none absolute inset-0 ring-1 ring-inset ${
                    isCompact
                      ? "ring-[rgba(227,206,170,0.04)]"
                      : "ring-[rgba(227,206,170,0.14)]"
                  }`}
                />
              </>
            ) : (
              <>
                <div
                  className={`absolute overflow-hidden ${
                    isCompact ? "inset-[3px] rounded-[5px]" : "inset-0"
                  }`}
                >
                  {isCompact ? (
                    <>
                      <OptimizedImage
                        src={backAsset}
                        locale={effectiveLocale}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16]"
                        draggable={false}
                      />
                      <div
                        className={`pointer-events-none absolute inset-0 ${
                          item.kind === "item"
                            ? "bg-[radial-gradient(circle_at_50%_24%,rgba(230,186,159,0.12),transparent_34%),linear-gradient(180deg,rgba(42,22,18,0.94),rgba(17,11,10,0.98))]"
                            : "bg-[radial-gradient(circle_at_50%_24%,rgba(194,232,178,0.1),transparent_34%),linear-gradient(180deg,rgba(24,40,25,0.94),rgba(12,20,13,0.98))]"
                        }`}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0.01)_40%,rgba(7,7,6,0.16)_58%,rgba(7,7,6,0.78))]" />
                    </>
                  ) : (
                    <>
                      <div className="pointer-events-none absolute inset-0 bg-[rgba(11,12,10,0.96)]" />
                      <OptimizedImage
                        src={backAsset}
                        locale={effectiveLocale}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18]"
                        draggable={false}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(239,226,188,0.1),transparent_34%),linear-gradient(180deg,rgba(14,15,11,0.5),rgba(8,10,7,0.82)_54%,rgba(7,6,5,0.94))]" />
                    </>
                  )}
                </div>
                <div
                  className={`pointer-events-none absolute border ${tone.frameClass} ${
                    isCompact
                      ? "inset-[3px] rounded-[5px] opacity-36"
                      : "inset-[8px] rounded-[8px] opacity-90"
                  }`}
                />
                {isPreview || isFocus ? (
                  <div
                    className={`pointer-events-none absolute inset-x-[14px] top-1/2 -translate-y-1/2 text-center font-semibold ${isPreview ? "text-[24px] leading-[28px]" : "text-[18px] leading-[22px]"} ${tone.nameClass} drop-shadow-[0_2px_4px_rgba(0,0,0,0.72)]`}
                  >
                    {item.name}
                  </div>
                ) : null}
              </>
            )}
            {isCompact ? (
              <>
                <div className="relative flex-1" />
                <div
                  className={`relative mt-auto ${isTradeCompact && frontVisual ? "px-1 pb-1" : isCompactDenseOmen ? "px-1 pb-1" : "px-2 pb-2"} ${
                    frontVisual
                      ? "pt-2"
                      : isCompactDenseOmen
                        ? "pt-0.5"
                        : isDenseNoFrontCompact
                          ? "pt-1.5"
                          : "pt-2.5"
                  } ${
                    frontVisual
                      ? isTradeCompact
                        ? "bg-transparent"
                        : "bg-[linear-gradient(180deg,rgba(8,7,6,0),rgba(8,7,6,0.08)_56%,rgba(8,7,6,0.7))]"
                      : "bg-[linear-gradient(180deg,rgba(8,7,6,0),rgba(8,7,6,0.18)_46%,rgba(8,7,6,0.82))]"
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`${
                        isTradeCompact && frontVisual
                          ? "sr-only"
                          : isCompactDenseOmen
                            ? "min-h-[26px] rounded-[4px] border border-[rgba(177,201,161,0.14)] bg-[rgba(234,226,206,0.92)] px-1 py-[3px] text-[8px] leading-[9px] line-clamp-2 text-[#2f291e] drop-shadow-none"
                            : isDenseNoFrontCompact
                              ? "min-h-[18px] truncate whitespace-nowrap text-[9px] leading-[10px]"
                              : "min-h-[26px] text-[11px] leading-[12px]"
                      } font-semibold ${isCompactDenseOmen ? "" : "text-[#ede2c8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.62)]"}`}
                    >
                      {item.name}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div
                  className={`relative flex items-center justify-between ${isPreview ? "px-4 pt-4" : "px-3 pt-3"}`}
                >
                  <span
                    className={`inline-flex rounded-full border ${isPreview ? "px-2.5 py-1 text-[10px]" : isFocus ? "px-2.5 py-1 text-[10px]" : "px-2 py-0.5 text-[9px]"} uppercase tracking-[0.12em] ${tone.badgeClass}`}
                  >
                    {item.kind === "item"
                      ? t("board.inventory.item")
                      : t("board.inventory.omen")}
                  </span>
                  <span
                    className={`inline-flex ${isPreview ? "h-8 w-8" : isFocus ? "h-7 w-7" : "h-6 w-6"} items-center justify-center rounded-full border ${
                      frontVisual
                        ? "border-[rgba(227,206,170,0.28)] bg-[rgba(14,12,10,0.78)]"
                        : tone.frameClass
                    }`}
                  >
                    <OptimizedImage
                      src={accentAsset}
                      locale={effectiveLocale}
                      alt=""
                      className={
                        isPreview
                          ? "h-5 w-5 object-contain opacity-90"
                          : isFocus
                            ? "h-[18px] w-[18px] object-contain opacity-90"
                            : "h-4 w-4 object-contain opacity-90"
                      }
                      draggable={false}
                    />
                  </span>
                </div>
                <div
                  className={`relative flex flex-1 items-end justify-start ${isPreview ? "px-6 py-5" : isFocus ? "px-4 py-4" : "px-4 py-3"}`}
                />
                <div
                  className={`${isPreview ? "px-4 pb-4 pt-2" : isFocus ? "px-4 pb-4 pt-2.5" : "px-3 pb-3 pt-1.5"} relative`}
                >
                  <div className={titleClass}>{item.name}</div>
                  {frontVisual ? null : (
                    <>
                      <div
                        className={`${isPreview ? "mt-2 text-[11px]" : isFocus ? "mt-2 text-[11px]" : "mt-1.5 text-[10px]"} uppercase tracking-[0.1em] ${tone.accentClass}`}
                      >
                        {item.kind === "item"
                          ? t("board.inventory.item")
                          : t("board.inventory.omen")}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </button>
        {!isPreview && disabledReason && options.testId ? (
          <div
            data-testid={`${options.testId}-disabled-reason`}
            className={`pointer-events-none mt-1 rounded-[4px] border border-[rgba(196,112,78,0.42)] bg-[rgba(58,31,24,0.72)] px-1.5 py-1 text-center font-semibold leading-tight text-[#f0c1a2] shadow-[0_4px_10px_rgba(0,0,0,0.20)] ${
              isCompact ? "text-[9px]" : "text-[11px]"
            }`}
          >
            {disabledReason}
          </div>
        ) : null}
        {!isPreview && options.testId ? (
          <button
            type="button"
            data-testid={`${options.testId}-magnify`}
            aria-label={`放大查看${item.name}`}
            title={`放大查看${item.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setInventoryPreviewCardId(item.id);
            }}
            className={`pointer-events-auto absolute ${isCompact ? "right-1 top-1 h-7 w-7" : "right-2 top-2 h-8 w-8"} z-[80] inline-flex items-center justify-center rounded-[5px] border border-[rgba(238,204,126,0.52)] bg-[rgba(18,15,12,0.86)] text-[#f3dfab] opacity-100 shadow-[0_8px_18px_rgba(0,0,0,0.34)] transition hover:border-[#f1d68d] hover:bg-[rgba(35,27,18,0.94)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100`}
          >
            <Search size={isCompact ? 13 : 16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  };

  if (baseCore.phase === "characterSelect") {
    return (
      <>
        <CharacterSelectScreen
          core={baseCore}
          matchData={matchData}
          effectiveLocale={effectiveLocale}
          isPhoneLandscapeLayout={isPhoneLandscapeLayout}
          viewerPlayerId={viewerPlayerId}
          selectedExplorerId={selectedExplorerId}
          onSelectExplorer={handleSelectExplorer}
          onConfirmExplorer={handleConfirmExplorer}
          onProposeScenarioCard={handleProposeScenarioCard}
          onConfirmScenarioCard={handleConfirmScenarioCard}
          onStartScenario={handleStartScenario}
        />
        <BetrayalDebugPanel G={G} dispatch={dispatch} playerID={playerID} />
      </>
    );
  }

  const observedExplorerTemplate = EXPLORER_CATALOG.find(
    (explorer) => explorer.explorerId === observedExplorer.explorerId,
  );
  const observedExplorerAbilityName =
    observedExplorer.abilityName ||
    observedExplorerTemplate?.abilityName ||
    "";
  const observedExplorerAbilityText =
    observedExplorer.abilityText ||
    observedExplorerTemplate?.abilityText ||
    "";

  return (
    <div
      data-testid="betrayal-board"
      data-betrayal-visual-busy={isVisualBusy ? "true" : "false"}
      className="relative h-full min-h-full overflow-hidden bg-[#0c1512] text-[#f1e8d4]"
      style={{
        backgroundImage: [
          "radial-gradient(circle at top, rgba(146, 116, 58, 0.18), transparent 30%)",
          "linear-gradient(180deg, rgba(11, 22, 18, 0.98) 0%, rgba(8, 15, 13, 1) 100%)",
        ].join(","),
        ...(isPhoneLandscapeLayout
          ? {
              height: "100dvh",
              minHeight: "100dvh",
              maxHeight: "100dvh",
            }
          : {}),
      }}
    >
      {!isHauntTargetingMode && !isPhoneLandscapeLayout ? (
        <BetrayalDebugPanel G={G} dispatch={dispatch} playerID={playerID} />
      ) : null}
      {shouldShowScenarioStartOpening && referenceScenarioOpeningSection ? (
        <div
          data-testid="betrayal-start-scenario-opening-stage"
          className="fixed inset-0 z-[240] bg-[rgba(0,0,0,0.58)] text-[#f5e6c7]"
        >
          <CinematicNarrationPanel
            testId="betrayal-start-scenario-opening-cinematic"
            label={t(referenceScenarioOpeningSection.labelKey)}
            title={activeHauntTitle}
            text={t(referenceScenarioOpeningSection.bodyKey)}
            variant="opening"
            presentation="stage"
            compact={isPhoneLandscapeLayout}
            actionSlot={
              <button
                type="button"
                data-testid="betrayal-start-scenario-opening-continue"
                onClick={dismissScenarioStartOpening}
                className="inline-flex min-h-11 min-w-[144px] cursor-pointer items-center justify-center gap-2 border border-[rgba(242,207,130,0.42)] bg-[rgba(8,10,9,0.82)] px-6 text-[12px] font-black uppercase tracking-[0.22em] text-[#f5e6c7] shadow-[0_16px_38px_rgba(0,0,0,0.58)] transition hover:border-[#f2cf82] hover:bg-[rgba(18,20,16,0.92)]"
              >
                {t("board.scenario.readerContinue")}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            }
            className="h-full min-h-full"
          />
        </div>
      ) : null}
      {inspectedExplorer ? (
        <ExplorerDetailsDialog
          explorer={inspectedExplorer}
          locale={effectiveLocale}
          playerName={resolvePlayerName(
            inspectedExplorer.playerId,
            inspectedExplorer.displayName,
            matchData,
          )}
          roomName={inspectedExplorerRoomName}
          abilityName={
            inspectedExplorerTemplate?.abilityName ??
            inspectedExplorer.displayName
          }
          abilityText={inspectedExplorerTemplate?.abilityText ?? ""}
          onClose={closeExplorerDetails}
        />
      ) : null}
      <div
        className={`relative h-full min-h-full w-full overflow-hidden ${
          isPhoneLandscapeLayout ? "p-0" : "px-3 py-3 md:px-4 md:py-4"
        }`}
        data-testid={
          isPhoneLandscapeLayout
            ? "betrayal-mobile-landscape-layout"
            : "betrayal-desktop-layout"
        }
        data-layout-mode={
          isPhoneLandscapeLayout ? "phone-landscape-native" : "desktop-board"
        }
      >
        <header className="pointer-events-none absolute inset-x-4 top-3 z-30 hidden lg:block">
            <div
              className="relative min-h-[58px]"
              data-testid="betrayal-runtime-header-grid"
            >
              <span className="sr-only">{phaseLabel}</span>
              {!isPhoneLandscapeLayout && !shouldHideTableChromeForBlockingOverlay ? (
                <HudPortal>
                  <div
                    data-testid="betrayal-phase-chip"
                    className="fixed left-1/2 top-3 flex min-w-[210px] flex-col items-center justify-center rounded-[8px] border border-[rgba(114,91,52,0.36)] bg-[rgba(8,13,11,0.68)] px-5 py-2 text-center shadow-[0_14px_30px_rgba(0,0,0,0.2)] backdrop-blur-md"
                    style={{
                      zIndex: UI_Z_INDEX.hud,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <span className="text-[11px] uppercase tracking-[0.28em] text-[#b99b5f]">
                      {t("board.hud.phaseLabel")}
                    </span>
                    <span className="mt-0.5 text-[21px] font-semibold uppercase tracking-[0.2em] text-[#f0d29a]">
                      {phaseLabel}
                    </span>
                  </div>
                </HudPortal>
              ) : null}
              <div
                className="absolute right-[244px] top-0 flex items-center justify-end gap-3 rounded-[8px] border border-[rgba(114,91,52,0.28)] bg-[rgba(8,13,11,0.58)] px-3 py-1.5 shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-md"
                data-testid="betrayal-status-chip"
              >
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#b99b5f]">
                    {t("board.hud.turnLabel")}
                  </div>
                  <div className="mt-0.5 text-[16px] font-semibold uppercase tracking-[0.12em] text-[#f0d29a]">
                    {resolvePlayerName(
                      core.currentPlayer,
                      core.currentExplorer.displayName,
                      matchData,
                    )}
                  </div>
                </div>
                <div
                  className="grid h-[54px] min-w-[58px] place-items-center rounded-[8px] border border-[#756244] bg-[radial-gradient(circle_at_35%_30%,rgba(190,233,97,0.22),rgba(20,28,18,0.94)_72%)] px-1 text-center shadow-[0_0_18px_rgba(130,177,76,0.18)]"
                  data-tutorial-id="betrayal-moves-remaining"
                  data-testid="betrayal-movement-snapshot"
                  data-moves-remaining={core.movesRemaining}
                  data-turn-start-speed={turnStartSpeedForHud}
                >
                  <div>
                    <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#b5ef42]">
                      {t("board.hud.moveLabel")}
                    </div>
                    <div className="text-[18px] font-bold leading-none text-[#c8f05e]">
                      {t("board.status.moveSnapshot", {
                        remaining: core.movesRemaining,
                        total: turnStartSpeedForHud,
                      })}
                    </div>
                    <div className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.08em] text-[#d4f58f]">
                      {t("board.status.turnStartSpeed", {
                        count: turnStartSpeedForHud,
                      })}
                    </div>
                    <span className="sr-only">
                      {t("board.status.movesRemaining", {
                        count: core.movesRemaining,
                      })}
                      {" "}
                      {t("board.status.turnStartSpeed", {
                        count: turnStartSpeedForHud,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
        </header>

        <main className="absolute inset-0 overflow-hidden">
          {shouldUseMobileEventOpenTableChrome ? (
            <div
              data-testid="betrayal-phase-chip"
              data-mobile-role="pc-isomorphic-phase-chip"
              className="pointer-events-none absolute left-1/2 top-0 z-[54] flex min-w-[136px] -translate-x-1/2 flex-col items-center justify-center rounded-[8px] border border-[rgba(114,91,52,0.36)] bg-[rgba(8,13,11,0.68)] px-2.5 py-1 text-center shadow-[0_14px_30px_rgba(0,0,0,0.2)] backdrop-blur-md"
            >
              <span className="text-[7px] uppercase tracking-[0.22em] text-[#b99b5f]">
                {t("board.hud.phaseLabel")}
              </span>
              <span className="mt-0 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#f0d29a]">
                {phaseLabel}
              </span>
            </div>
          ) : null}

          {shouldShowHauntRevealCue ? (
            <BetrayalHauntRevealCue
              revealProtocol={hauntRevealProtocol}
              scenarioRuntime={core.scenarioRuntime}
              isPhoneLandscapeLayout={isPhoneLandscapeLayout}
              onDismiss={handleDismissHauntRevealCue}
            />
          ) : null}

          {isPhoneLandscapeLayout &&
          !shouldHideTableChromeForBlockingOverlay &&
          !pendingEventFocusesMapTarget &&
          !shouldUseMobileEventOpenTableChrome &&
          (visibleDustProgressItems.length > 0 ||
            shouldShowTradeFlowPrompt ||
            mummyPendingReward ||
            helpingHandsPendingReward ||
            shouldShowHelpingHandsMonsterTurnStatus ||
            (!mummyPendingReward &&
              !helpingHandsPendingReward &&
              !pendingTradeAgreement &&
              !pendingSicknessExchange &&
              !isDustSicknessExchangeMode &&
              !activeHauntTargetGuide &&
              helpingHandsTrollHandAttackOption &&
              helpingHandsTrollHandAttackTarget)) ? (
            <div
              data-testid="betrayal-top-prompt-stack"
              data-mobile-role="top-prompt-stack"
              data-prompt-placement="top"
              className="pointer-events-none absolute left-[10.5rem] right-[8.25rem] top-[2.25rem] z-[58] flex flex-col items-center gap-1.5"
            >
              {visibleDustProgressItems.length > 0 &&
              !pendingSicknessExchange &&
              !mummyPendingReward &&
              !helpingHandsPendingReward &&
              !isDustSicknessExchangeMode ? (
                <div
                  data-testid="betrayal-dust-progress-strip"
                  data-haunt-progress-kind="dust"
                  data-prompt-placement="top"
                  className={`pointer-events-none flex min-h-[50px] w-full flex-wrap items-center justify-center gap-2 rounded-[9px] border border-[rgba(211,179,109,0.38)] bg-[rgba(10,13,10,0.82)] px-3 py-2 text-[12px] font-bold tracking-[0.045em] text-[#e6d8a8] shadow-[0_14px_30px_rgba(0,0,0,0.34),0_0_22px_rgba(211,179,109,0.16)] backdrop-blur-sm ${
                    activeHauntTargetGuide ? "opacity-[0.72]" : ""
                  }`}
                >
                  <span className="text-[#fff1b8]">
                    {activeHauntCaseLabel}
                  </span>
                  <span className="text-[15px] text-[#d1b05f]">
                    {activeHauntTitle}
                  </span>
                  {visibleDustProgressItems.map((item) => (
                    <span
                      key={item.id}
                      data-testid={`betrayal-dust-progress-item-${item.id}`}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded-[6px] bg-[rgba(211,179,109,0.16)] px-2 py-0.5"
                    >
                      <span className="text-[#efe1b5]">{item.label}</span>
                      <span className="text-[#f6ffc4]">{item.value}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              {shouldShowTradeFlowPrompt ? (
                <div
                  data-testid="betrayal-trade-flow-banner"
                  data-trade-agreement-state={tradeAgreementState}
                  data-prompt-placement="top"
                  className="pointer-events-none flex min-h-[56px] w-full flex-wrap items-center justify-center gap-2.5 rounded-[9px] border border-[rgba(238,204,126,0.50)] bg-[rgba(18,17,13,0.88)] px-4 py-2.5 text-center text-[13px] font-bold tracking-[0.045em] text-[#f3e0a6] shadow-[0_16px_34px_rgba(0,0,0,0.36),0_0_24px_rgba(238,204,126,0.20)] backdrop-blur-sm"
                  style={{
                    border: "1px solid rgba(238,204,126,0.50)",
                    boxShadow:
                      "0 16px 34px rgba(0,0,0,0.36), 0 0 24px rgba(238,204,126,0.20)",
                    textShadow:
                      "0 1px 2px rgba(0,0,0,0.86), 0 0 12px rgba(238,204,126,0.34)",
                  }}
                >
                  <Handshake size={18} strokeWidth={2.4} />
                  <span
                    data-testid="betrayal-trade-flow-item-step"
                    className="text-[13px] text-[#e3d2a1]"
                  >
                    {tradeInstructionText}
                  </span>
                  <span
                    data-testid="betrayal-trade-flow-target-step"
                    className={
                      pendingTradeAgreement
                        ? "text-[15px] text-[#fff1b8]"
                        : tradeSelectionReady
                          ? "text-[15px] text-[#f6ffc4]"
                          : "text-[14px] text-[#d6c498]"
                    }
                  >
                    {tradeFlowTargetStepText}
                  </span>
                  {!pendingTradeAgreement ? (
                    <span
                      data-testid="betrayal-trade-flow-steps"
                      className="basis-full text-[10px] uppercase tracking-[0.12em] text-[#baad82]"
                    >
                      {t("board.status.tradeStepItem")}
                      <span className="mx-1">→</span>
                      {t("board.status.tradeStepTarget")}
                      <span className="mx-1">→</span>
                      {t("board.status.tradeStepReturn")}
                      <span className="mx-1">→</span>
                      {t("board.status.tradeStepRequest")}
                      <span className="mx-1">→</span>
                      {t("board.status.tradeStepAgree")}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {mummyPendingReward ? (
                <div
                  data-testid="betrayal-mummy-reward-banner"
                  data-mummy-reward-state={
                    isMummyRewardChooser ? "choose" : "waiting"
                  }
                  data-prompt-placement="top"
                  className="pointer-events-none flex min-h-[56px] w-full flex-wrap items-center justify-center gap-2.5 rounded-[9px] border border-[rgba(238,204,126,0.52)] bg-[rgba(18,17,13,0.90)] px-4 py-2.5 text-center text-[13px] font-bold tracking-[0.045em] text-[#f3e0a6] shadow-[0_16px_34px_rgba(0,0,0,0.38),0_0_24px_rgba(238,204,126,0.20)] backdrop-blur-sm"
                  style={{
                    textShadow:
                      "0 1px 2px rgba(0,0,0,0.86), 0 0 12px rgba(238,204,126,0.34)",
                  }}
                >
                  <Skull size={18} strokeWidth={2.4} />
                  <span className="text-[16px] text-[#fff1b8]">
                    {t("board.status.mummyRewardTitle")}
                  </span>
                  <span
                    data-testid="betrayal-mummy-reward-step"
                    className="text-[13px] text-[#e3d2a1]"
                  >
                    {isMummyRewardChooser
                      ? t("board.status.mummyRewardChoose", {
                          player: mummyRewardDefenderName,
                          damage: mummyPendingReward.damageToHero,
                        })
                      : t("board.status.mummyRewardWaiting", {
                          player: mummyRewardControllerName,
                        })}
                  </span>
                  {mummyUnavailableStealTargetCount > 0 ? (
                    <span
                      data-testid="betrayal-mummy-reward-invalid-targets"
                      className="rounded-full border border-[rgba(245,155,92,0.42)] bg-[rgba(92,42,24,0.42)] px-2.5 py-1 text-[12px] font-bold text-[#ffd0a6]"
                    >
                      {t("board.status.mummyRewardInvalidTargets", {
                        count: mummyUnavailableStealTargetCount,
                      })}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {helpingHandsPendingReward ? (
                <div
                  data-testid="betrayal-helping-hands-reward-banner"
                  data-helping-hands-reward-state={
                    isHelpingHandsRewardChooser ? "choose" : "waiting"
                  }
                  data-prompt-placement="top"
                  className="pointer-events-none flex min-h-[56px] w-full flex-wrap items-center justify-center gap-2.5 rounded-[9px] border border-[rgba(238,204,126,0.52)] bg-[rgba(18,17,13,0.90)] px-4 py-2.5 text-center text-[13px] font-bold tracking-[0.045em] text-[#f3e0a6] shadow-[0_16px_34px_rgba(0,0,0,0.38),0_0_24px_rgba(238,204,126,0.20)] backdrop-blur-sm"
                  style={{
                    textShadow:
                      "0 1px 2px rgba(0,0,0,0.86), 0 0 12px rgba(238,204,126,0.34)",
                  }}
                >
                  <Skull size={18} strokeWidth={2.4} />
                  <span className="text-[16px] text-[#fff1b8]">
                    {t("board.status.helpingHandsRewardTitle")}
                  </span>
                  <span
                    data-testid="betrayal-helping-hands-reward-step"
                    className="text-[13px] text-[#e3d2a1]"
                  >
                    {isHelpingHandsRewardChooser
                      ? t("board.status.helpingHandsRewardChoose", {
                          player: helpingHandsRewardDefenderName,
                          damage: helpingHandsPendingReward.damageToDefender,
                        })
                      : t("board.status.helpingHandsRewardWaiting", {
                          player: helpingHandsRewardAttackerName,
                        })}
                  </span>
                </div>
              ) : null}
              {shouldShowHelpingHandsMonsterTurnStatus ? (
                <div
                  data-testid="betrayal-helping-hands-monster-turn-status"
                  data-helping-hands-monster-state={
                    helpingHandsMonsterTurnStatus.active
                      ? "controlled"
                      : "skipped-no-amulet"
                  }
                  data-prompt-placement="top"
                  className="pointer-events-none flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[9px] border border-[rgba(159,225,167,0.36)] bg-[rgba(10,18,14,0.82)] px-3 py-2 text-[12px] font-bold tracking-[0.045em] text-[#d9ffcf] shadow-[0_14px_30px_rgba(0,0,0,0.34),0_0_22px_rgba(159,225,167,0.16)] backdrop-blur-sm"
                >
                  <span className="text-[15px] text-[#fff1b8]">
                    {t("board.status.helpingHandsTrollAttackTitle")}
                  </span>
                  <span className="text-[#d8c692]">
                    {helpingHandsMonsterTurnStatus.active
                      ? t("board.status.helpingHandsMonsterControlledBy", {
                          player: helpingHandsMonsterControllerName,
                        })
                      : t("board.status.helpingHandsMonsterSkippedNoAmulet")}
                  </span>
                </div>
              ) : null}
              {!helpingHandsPendingReward &&
              !mummyPendingReward &&
              !pendingTradeAgreement &&
              !pendingSicknessExchange &&
              !isDustSicknessExchangeMode &&
              !activeHauntTargetGuide &&
              helpingHandsTrollHandAttackOption &&
              helpingHandsTrollHandAttackTarget ? (
                <div
                  data-testid="betrayal-helping-hands-troll-attack-banner"
                  data-prompt-placement="top"
                  className="pointer-events-none flex min-h-[56px] w-full flex-wrap items-center justify-center gap-2.5 rounded-[9px] border border-[rgba(159,225,167,0.48)] bg-[rgba(10,18,14,0.84)] px-4 py-2.5 text-[13px] font-bold tracking-[0.045em] text-[#d9ffcf] shadow-[0_16px_34px_rgba(0,0,0,0.36),0_0_24px_rgba(159,225,167,0.18)] backdrop-blur-sm"
                >
                  <span className="text-[16px] text-[#fff1b8]">
                    {t("board.status.helpingHandsTrollAttackTitle")}
                  </span>
                  <span
                    data-testid="betrayal-helping-hands-troll-target"
                    className="text-[13px] text-[#d8c692]"
                  >
                    {t("board.status.helpingHandsTrollAttackTarget", {
                      player: helpingHandsTrollHandAttackTargetName,
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <section
            data-testid={
              shouldShowMobileEventStatusRail
                ? "betrayal-mobile-event-status-hud"
                : "betrayal-left-status-rail"
            }
            data-mobile-role={
              shouldShowMobileEventStatusRail
                ? "pc-isomorphic-explorer-rail"
                : undefined
            }
            className={`pointer-events-none absolute z-40 max-h-[calc(100vh-1.5rem)] w-[286px] min-h-0 content-start gap-2 overflow-visible ${
              shouldShowMobileEventStatusRail
                ? "left-2 top-2 grid origin-top-left scale-[0.60]"
                : isPhoneLandscapeLayout
                  ? "hidden"
                  : `left-3 top-3 grid ${activeHauntTargetGuide ? "opacity-[0.72]" : ""}`
            }`}
          >
            <article className="pointer-events-none relative overflow-visible bg-transparent px-1 py-1">
              <div className="mx-auto flex w-full max-w-[252px] flex-col gap-1 pb-1 pt-1 xl:mx-0">
                <div
                  className="relative mx-auto w-full max-w-[188px]"
                  data-testid="betrayal-observed-explorer-panel"
                  data-panel-asset={observedExplorer.portraitAsset}
                  data-player-id={observedExplorer.playerId}
                  data-explorer-id={observedExplorer.explorerId}
                >
                  <div className="pointer-events-none absolute inset-[12%] rounded-full bg-[rgba(77,138,92,0.18)] blur-3xl" />
                  <OptimizedImage
                    src={observedExplorer.portraitAsset}
                    locale={effectiveLocale}
                    alt={observedExplorer.displayName}
                    className="relative z-10 aspect-[1/1.05] h-auto w-full object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.38)]"
                    draggable={false}
                  />
                  {(
                    Object.entries(observedExplorer.traits) as [
                      BetrayalTraitKey,
                      number,
                    ][]
                  ).map(([key, value]) => {
                    const track = resolveExplorerTraitTrack(
                      observedExplorer,
                      key,
                    );
                    const markerPosition = resolveExplorerBoardMarkerPosition(
                      key,
                      track.position,
                      track.maxPosition,
                    );
                    return (
                      <div
                        key={`explorer-board-marker-${key}`}
                        data-testid={`betrayal-explorer-board-marker-${key}`}
                        data-trait-track-position={track.position}
                        data-trait-track-value={value}
                        data-trait-board-marker-shape="blank-material-marker"
                        data-trait-board-marker-asset={ASSETS.marker.numberBlank}
                        data-trait-board-marker-visible-value="false"
                        aria-label={`${TRAIT_LABEL_LOCAL[key]}当前位置，第 ${track.position} 位，数值 ${value}`}
                        title={`${TRAIT_LABEL_LOCAL[key]}当前位置：第 ${track.position} 位，数值 ${value}`}
                        className="pointer-events-none absolute z-20 h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_3px_7px_rgba(0,0,0,0.44)]"
                        style={markerPosition}
                      >
                        <OptimizedImage
                          src={ASSETS.marker.numberBlank}
                          locale={effectiveLocale}
                          alt=""
                          className="h-full w-full object-contain"
                          draggable={false}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="-mt-4 flex justify-center px-2">
                  <div className="relative inline-flex min-w-[174px] max-w-[194px] items-center justify-between gap-2 overflow-hidden rounded-[7px] border border-[rgba(103,82,48,0.62)] bg-[linear-gradient(180deg,rgba(14,18,16,0.9),rgba(9,12,10,0.96))] px-2.5 py-1.5 shadow-[0_8px_16px_rgba(0,0,0,0.14)]">
                    <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                    <div className="min-w-0">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#95876d]">
                        {t("board.hud.locationLabel")}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[#efe2c4]">
                        {observedExplorerRoomName}
                      </div>
                    </div>
                    <div className="shrink-0 self-center rounded-[6px] border border-[rgba(105,83,47,0.58)] bg-[radial-gradient(circle_at_35%_25%,rgba(227,211,168,0.12),rgba(18,15,12,0.95))] px-2 py-0.5 text-center shadow-[0_4px_10px_rgba(0,0,0,0.14)]">
                      <div className="text-[7px] uppercase tracking-[0.16em] text-[#98886a]">
                        {t("board.hud.holdingLabel")}
                      </div>
                      <div className="text-[15px] font-semibold leading-none text-[#f0e2c0]">
                        {observedExplorer.inventory.length}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-1.5">
                  <div
                    className="relative overflow-hidden rounded-[10px] border border-[rgba(93,79,54,0.42)] bg-[rgba(13,17,15,0.52)] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.04)]"
                    data-testid="betrayal-current-traits"
                    data-tutorial-id="betrayal-current-traits"
                    data-player-id={observedExplorer.playerId}
                    data-explorer-id={observedExplorer.explorerId}
                    data-room-id={observedExplorer.roomId}
                    data-observed-player={
                      isObservingOtherExplorer ? "true" : "false"
                    }
                    data-observed-player-id={observedExplorer.playerId}
                  >
                    <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                    <div className="mb-1 flex items-center justify-between border-b border-[rgba(96,80,54,0.42)] pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8bf81]">
                        {t("board.hud.currentTraitsLabel")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(181,239,66,0.28)] bg-[rgba(40,58,21,0.52)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-[#d9ff97]">
                        {isObservingOtherExplorer ? (
                          <Eye size={11} aria-hidden="true" />
                        ) : null}
                        {resolvePlayerName(
                          observedExplorer.playerId,
                          observedExplorer.displayName,
                          matchData,
                        )}
                      </span>
                    </div>
                    <div className="grid gap-0.5">
                      {(
                        [
                          "might",
                          "speed",
                          "knowledge",
                          "sanity",
                        ] as BetrayalTraitKey[]
                      ).map((trait) => (
                        <div
                          key={trait}
                          data-testid={`betrayal-current-trait-row-${trait}`}
                        >
                          <ExplorerTraitTrackRail
                            explorer={observedExplorer}
                            trait={trait}
                            locale={effectiveLocale}
                            testIdPrefix="betrayal-current-trait-track"
                          />
                        </div>
                      ))}
                    </div>
                    <div
                      data-testid="betrayal-current-ability"
                      className="mt-1.5 border-t border-[rgba(96,80,54,0.34)] pt-1 text-[10px] leading-4 text-[#d9ff97]"
                    >
                      <span className="font-semibold text-[#d8bf81]">
                        {t("board.characterSelect.abilityTitle")}：
                      </span>
                      <span className="font-semibold">
                        {observedExplorerAbilityName}：
                      </span>
                      <span className="text-[#c8d8a2]">
                        {observedExplorerAbilityText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="hidden px-2 py-1 md:px-1 xl:hidden">
              <div className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-[#a89d84]">
                {t("board.sections.players")}
              </div>
              <div className="grid gap-1.5">
                {core.otherExplorers.map((explorer) => {
                  const isTradeCandidate = activeTradeTargets.some(
                    (item) => item.playerId === explorer.playerId,
                  );
                  const isCorpseLootCandidate = corpseLootTargets.some(
                    (item) => item.playerId === explorer.playerId,
                  );
                  const isDustTarget = dustTargetPlayerIds.has(
                    explorer.playerId,
                  );
                  const isSicknessExchangeTarget =
                    isDustSicknessExchangeMode && isDustTarget;
                  const isMagicCameraPhotoTarget =
                    magicCameraPhotoTargetPlayerIds.has(explorer.playerId);
                  const isPhantomPhotographerTarget =
                    phantomPhotographerTargetPlayerIds.has(explorer.playerId);
                  const isMonsterAttackTarget =
                    selectedMonsterAttackTargetPlayerIds.has(
                      explorer.playerId,
                    );
                  const isHelpingHandsTrollHandTarget =
                    helpingHandsTrollHandAttackTargetPlayerIds.has(
                      explorer.playerId,
                    );
                  const isAttackTarget =
                    (isHeroAttackTargetingMode &&
                      heroAttackTargetPlayerIds.has(explorer.playerId)) ||
                    isMagicCameraPhotoTarget ||
                    isMonsterAttackTarget ||
                    isHelpingHandsTrollHandTarget ||
                    (isDustAttackTargetingMode && isDustTarget);
                  const isSelectedAttackTarget =
                    isHeroAttackTargetingMode &&
                    hauntActionContext?.actionKind === "attack-hero" &&
                    hauntActionContext.targetPlayerId === explorer.playerId;
                  const isSelectedTradeTarget =
                    explorer.playerId === selectedTradeTargetPlayerId ||
                    explorer.playerId === selectedCorpseLootTargetPlayerId ||
                    (previewState.selectedTradeTargetPlayerId ===
                      explorer.playerId &&
                      (isMagicCameraPhotoTarget ||
                        isMonsterAttackTarget ||
                        isHelpingHandsTrollHandTarget ||
                        isDustTarget)) ||
                    isSelectedAttackTarget ||
                    (isSicknessExchangeTarget &&
                      explorer.playerId === selectedDustTargetPlayerId);
                  const isSameRoom =
                    core.currentExplorer.roomId === explorer.roomId;
                  const isDogTradeTarget = dogTradeTargets.some(
                    (item) => item.playerId === explorer.playerId,
                  );
                  const isPassiveSameRoomCue =
                    isTradeCandidate &&
                    isSameRoom &&
                    !isCorpseLootCandidate &&
                    !isSicknessExchangeTarget &&
                    !isMagicCameraPhotoTarget &&
                    !isPhantomPhotographerTarget &&
                    !isMonsterAttackTarget &&
                    !isHelpingHandsTrollHandTarget &&
                    !isDustTarget &&
                    !isAttackTarget &&
                    !isDogTradeTarget;
                  const isObservedExplorer =
                    observedExplorer.playerId === explorer.playerId;
                  const panel = (
                    <button
                      key={explorer.playerId}
                      type="button"
                      onClick={() => {
                        if (isAttackTarget || isSicknessExchangeTarget) {
                          handleSelectExplorerTarget(explorer);
                          return;
                        }
                        handleObserveExplorer(explorer.playerId);
                      }}
                      data-testid={`betrayal-teammate-panel-${explorer.playerId}`}
                      data-player-id={explorer.playerId}
                      data-player-seat-anchor={explorer.playerId}
                      data-explorer-id={explorer.explorerId}
                      data-room-id={explorer.roomId}
                      data-observed-player={
                        isObservedExplorer ? "true" : "false"
                      }
                      title={`切换观察视角：${resolvePlayerName(
                        explorer.playerId,
                        explorer.displayName,
                        matchData,
                      )}`}
                      aria-label={`切换观察视角：${resolvePlayerName(
                        explorer.playerId,
                        explorer.displayName,
                        matchData,
                      )}`}
                      className={`group pointer-events-auto grid w-full grid-cols-[50px_minmax(0,1fr)_122px] items-center gap-2 rounded-[8px] border px-1.5 py-2 text-left transition ${
                        isSelectedTradeTarget
                          ? "border-[#eecc7e] bg-[linear-gradient(180deg,rgba(53,40,20,0.58),rgba(22,19,14,0.70))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_18px_rgba(238,204,126,0.30)]"
                          : (isTradeCandidate && !isPassiveSameRoomCue) ||
                              isCorpseLootCandidate ||
                              isAttackTarget
                            ? "border-[rgba(118,189,153,0.46)] bg-[rgba(12,18,15,0.20)] hover:border-[rgba(159,225,167,0.64)] hover:bg-[rgba(255,224,138,0.06)]"
                            : isObservedExplorer
                              ? "border-[rgba(224,189,114,0.62)] bg-[rgba(55,38,21,0.44)] shadow-[0_0_0_1px_rgba(24,17,8,0.80),0_0_15px_rgba(224,189,114,0.22)]"
                              : "border-transparent bg-transparent hover:border-[rgba(117,98,68,0.34)] hover:bg-[rgba(28,24,19,0.5)]"
                      }`}
                    >
                      <div className="relative h-12 w-12 overflow-visible">
                        <span className="block h-12 w-12 overflow-hidden">
                          <OptimizedImage
                            src={explorer.portraitAsset}
                            locale={effectiveLocale}
                            alt={explorer.displayName}
                            className="h-full w-full object-contain"
                            draggable={false}
                          />
                        </span>
                        {isObservedExplorer ? (
                          <span
                            data-testid={`betrayal-teammate-observed-${explorer.playerId}`}
                            className="pointer-events-none absolute -right-1 -top-1 z-20 grid h-5 w-5 place-items-center rounded-full border border-[rgba(224,189,114,0.72)] bg-[rgba(20,14,8,0.92)] text-[#f5d993] shadow-[0_4px_9px_rgba(0,0,0,0.34)]"
                            aria-hidden="true"
                          >
                            <Eye size={12} />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-medium text-[#f1e8d4]">
                            {resolvePlayerName(
                              explorer.playerId,
                              explorer.displayName,
                              matchData,
                            )}
                          </div>
                          {isTradeCandidate ||
                          isCorpseLootCandidate ||
                          isSicknessExchangeTarget ||
                          isAttackTarget ? (
                            <span
                              data-player-status-tone={
                                isSelectedTradeTarget
                                  ? "selected"
                                  : isPassiveSameRoomCue
                                    ? "neutral"
                                    : "target"
                              }
                              className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[10px] font-medium ${
                                isSelectedTradeTarget
                                  ? "border-[#eecc7e] bg-[rgba(238,204,126,0.18)] text-[#ffe4a0]"
                                  : isPassiveSameRoomCue
                                    ? "border-[rgba(117,98,68,0.44)] bg-[rgba(28,24,19,0.54)] text-[#c9bda1]"
                                  : "border-[rgba(118,189,153,0.30)] bg-[rgba(40,63,50,0.18)] text-[#bddac2]"
                              }`}
                            >
                              {isSicknessExchangeTarget
                                ? t("board.status.sicknessExchangeShort")
                                : isMagicCameraPhotoTarget
                                  ? t("board.actions.takePhoto")
                                  : isPhantomPhotographerTarget
                                    ? t(
                                        "board.actions.phantomPhotographerAttack",
                                      )
                                    : isAttackTarget
                                      ? t("board.actions.attack")
                                      : isCorpseLootCandidate
                                        ? t("board.players.corpse")
                                        : isDogTradeTarget && !isSameRoom
                                          ? t("board.inventory.dog")
                                          : isSameRoom
                                            ? t("board.players.sameRoom")
                                            : t("board.players.tradeTarget")}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-[#b7aa92]">
                          {core.rooms.find(
                            (room) => room.id === explorer.roomId,
                          )?.name || t("board.rooms.unknown")}
                        </div>
                        <div className="text-[11px] text-[#b7aa92]">
                          {t("board.players.inventoryCount", {
                            count: explorer.inventory.length,
                          })}
                        </div>
                      </div>
                      <div className="grid min-w-0 gap-0.5 text-[#c8bda4]">
                        {(
                          [
                            "might",
                            "speed",
                            "knowledge",
                            "sanity",
                          ] as BetrayalTraitKey[]
                        ).map((key) => (
                          <ExplorerTraitTrackRail
                            key={key}
                            explorer={explorer}
                            trait={key}
                            locale={effectiveLocale}
                            density="compact"
                            testIdPrefix={`betrayal-teammate-trait-track-${explorer.playerId}`}
                          />
                        ))}
                      </div>
                    </button>
                  );

                  return panel;
                })}
              </div>
            </article>
          </section>
          <div
            id="betrayal-inventory-section"
            data-testid="betrayal-inventory-section"
            data-tutorial-id="betrayal-inventory-zone"
            className={`pointer-events-none absolute z-40 mt-0 px-0 ${
              activeHauntTargetGuide ? "opacity-[0.72]" : ""
            } ${
              isPhoneLandscapeLayout
                ? "bottom-[58px] left-2 w-[min(312px,calc(100vw-6.25rem))]"
                : "bottom-[86px] left-2 w-[320px] max-w-[calc(100vw-1rem)] lg:bottom-2 lg:left-1 lg:w-[calc(62px*5.35+0.5rem*4+0.75rem)] lg:max-w-[calc(62px*5.35+0.5rem*4+0.75rem)]"
            }`}
            data-mobile-role={
              isPhoneLandscapeLayout ? "possession-rail" : undefined
            }
          >
            <div
              className={`${isPhoneLandscapeLayout ? "sr-only" : "mb-1 flex items-center justify-between gap-3 px-1 xl:pr-4"}`}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#a89d84]">
                <span className="h-px w-3 bg-[rgba(214,191,129,0.22)]" />
                {t("board.sections.inventory")}
                <span className="h-px w-8 bg-[rgba(214,191,129,0.12)]" />
              </div>
              <div className="sr-only">
                {hasSelectedInventoryDisplay
                  ? t("board.status.selectedCard", {
                      card: selectedInventoryDisplayText,
                    })
                  : t("board.status.noSelectedCard")}
              </div>
              <div className="sr-only" data-testid="betrayal-use-status">
                {useStatusText}
              </div>
            </div>
            <div
              className={`${isPhoneLandscapeLayout ? "grid gap-1 px-0" : "grid gap-2 px-1 xl:px-0 xl:pr-2"}`}
            >
              <section data-testid="betrayal-inventory-group-item">
                <div
                  className={`${inventoryGroups.item.length === 0 ? "pointer-events-none hidden lg:flex" : "flex"} ${
                    isPhoneLandscapeLayout
                      ? "max-w-full min-h-[52px] items-end gap-1 overflow-x-auto overflow-y-hidden px-0 pb-0.5 pt-0"
                      : "max-w-[calc(62px*4.35+0.375rem*3)] min-h-[92px] items-end gap-1.5 overflow-x-auto overflow-y-hidden px-1 pb-2 pt-1 xl:max-w-[calc(62px*5.35+0.5rem*4)] xl:gap-2"
                  } min-w-0 smashup-h-scrollbar`}
                  data-testid="betrayal-inventory-row-item"
                >
                  {inventoryGroups.item.map((item, index) =>
                    renderInventoryCard(item, {
                      layout: "compact",
                      testId: `betrayal-inventory-${item.id}`,
                      instanceKey: `inventory-item-${item.id}-${index}`,
                    }),
                  )}
                </div>
              </section>
              <section data-testid="betrayal-inventory-group-omen">
                <div
                  className={`${inventoryGroups.omen.length === 0 ? "pointer-events-none hidden lg:flex" : "flex"} ${
                    isPhoneLandscapeLayout
                      ? "max-w-full min-h-[52px] items-end gap-1 overflow-x-auto overflow-y-hidden px-0 pb-0.5 pt-0"
                      : "max-w-[calc(62px*4.35+0.375rem*3)] min-h-[92px] items-end gap-1.5 overflow-x-auto overflow-y-hidden px-1 pb-2 pt-1 xl:max-w-[calc(62px*5.35+0.5rem*4)] xl:gap-2"
                  } min-w-0 smashup-h-scrollbar`}
                  data-testid="betrayal-inventory-row-omen"
                >
                  {inventoryGroups.omen.map((item, index) =>
                    renderInventoryCard(item, {
                      layout: "compact",
                      testId: `betrayal-inventory-${item.id}`,
                      compactDenseNoFront: true,
                      instanceKey: `inventory-omen-${item.id}-${index}`,
                    }),
                  )}
                </div>
              </section>
            </div>
            {hasSelectedInventoryDisplay ? (
              <div
                className="sr-only"
                data-testid="betrayal-selected-inventory-card-name"
              >
                {selectedInventoryDisplayText}
              </div>
            ) : null}
          </div>

            <section className="absolute inset-0 z-10 grid min-h-0">
              <div className="sr-only">
                {shouldShowBoardActionStatus ? (
                  <>
                    <span data-testid="betrayal-action-cue">
                      {actionCueText}
                    </span>
                    <span data-testid="betrayal-trade-status">
                      {tradeStatusText}
                    </span>
                    <span data-testid="betrayal-turn-hint">
                      {turnHintText}
                    </span>
                  </>
                ) : null}
                {roomEndTurnEffectHint ? (
                  <span data-testid="betrayal-room-end-turn-effect-status">
                    {roomEndTurnEffectHint.title} {roomEndTurnEffectHint.detail}
                  </span>
                ) : null}
                {visibleDustProgressItems.length > 0 ? (
                  <span data-testid="betrayal-dust-progress-status">
                    {activeHauntCaseLabel} {activeHauntTitle}{" "}
                    {visibleDustProgressItems
                      .map((item) => `${item.label} ${item.value}`)
                      .join(" ")}
                  </span>
                ) : null}
              </div>

            <article
              id="betrayal-room-panel"
              data-testid="betrayal-room-panel"
              data-tutorial-id="betrayal-room-board"
              className={`flex min-h-0 flex-col bg-transparent p-0 ${
                isPhoneLandscapeLayout ? "pb-0 pt-0" : "pb-[86px] lg:pb-0"
              }`}
              data-mobile-role={
                isPhoneLandscapeLayout ? "primary-board-stage" : undefined
              }
            >
              <div className="sr-only">
                <span data-testid="betrayal-room-latest-feedback">
                  {latestLogEntry?.text || t("board.feedback.idle")}
                </span>
                {shouldShowLatestDiscovery && !shouldAutoReturnAfterLatestDiscovery ? (
                  <span>
                    {t("board.discovery.label")} {latestDiscovery!.title}{" "}
                    {latestDiscoveryDisplaySummary}
                  </span>
                ) : null}
                {shouldShowRoomFocusTargetLabel ? (
                  <span>{roomFocusState?.label}</span>
                ) : null}
                {tradeStatusCueState ? (
                  <span>{tradeStatusCueState.label}</span>
                ) : null}
              </div>

              {shouldShowLatestDiscovery &&
              !shouldAutoReturnAfterLatestDiscovery &&
              !pendingEventChoice ? (
                <div
                  data-testid="betrayal-discovery-panel"
                  data-card-testid="betrayal-discovery-card-reveal"
                  data-tutorial-id="betrayal-latest-discovery"
                  aria-label={`${latestDiscoveryDisplayedKindLabel} ${latestDiscoveryDisplayedTitle}`}
                  data-allows-inventory-roll-modifiers={
                    canCurrentPlayerModifyLatestDiscoveryRoll ? "true" : "false"
                  }
                  data-backdrop-dismiss={
                    canDismissLatestDiscoveryByBackdrop ? "enabled" : "disabled"
                  }
                  onClick={
                    canDismissLatestDiscoveryByBackdrop
                      ? handleDismissLatestDiscovery
                      : undefined
                  }
                  className={`pointer-events-auto absolute flex cursor-default ${
                    isPhoneLandscapeLayout
                      ? shouldUseMobileEventOpenTableChrome
                        ? "inset-0 z-50 items-start justify-end bg-transparent px-2 pb-[74px] pr-[8.25rem] pt-[92px]"
                        : "inset-0 z-[120] items-center justify-center bg-[rgba(3,7,6,0.92)] px-3 pb-[76px] pt-[5.75rem]"
                      : `inset-y-0 left-0 right-0 z-[120] items-center justify-center px-4 py-16 md:left-[392px] md:right-[240px] ${shouldShowLatestDiscoveryRoll && latestDiscoveryRecentRoll ? "" : "bg-[rgba(3,7,6,0.76)]"}`
                  }`}
                >
                  {latestDiscoveryPanelVisual ? null : (
                    <div
                      data-testid="betrayal-discovery-top-banner"
                      data-prompt-placement="top"
                      className={`pointer-events-none absolute z-30 flex min-h-[76px] flex-wrap items-center justify-center gap-2.5 rounded-[11px] border border-[rgba(238,204,126,0.48)] bg-[rgba(18,17,13,0.88)] px-5 py-3 text-center font-bold tracking-[0.05em] text-[#f3e0a6] shadow-[0_20px_42px_rgba(0,0,0,0.38),0_0_30px_rgba(238,204,126,0.20)] backdrop-blur-sm ${
                        isPhoneLandscapeLayout
                          ? shouldUseMobileEventOpenTableChrome
                            ? "left-2 right-[8.25rem] top-1 min-h-[58px] px-3 py-2 text-[12px]"
                            : "left-3 right-3 top-2 min-h-[60px] px-3 py-2 text-[13px]"
                          : "left-4 right-4 top-4 text-[16px]"
                      }`}
                      style={{
                        textShadow:
                          "0 1px 2px rgba(0,0,0,0.88), 0 0 14px rgba(238,204,126,0.34)",
                      }}
                    >
                      <span className="rounded-[6px] border border-[rgba(238,204,126,0.26)] bg-[rgba(238,204,126,0.12)] px-2 py-1 text-[#fff1b8]">
                        {t("board.discovery.label")}
                      </span>
                      <span className="text-[#d8c692]">
                        {latestDiscoveryDisplayedKindLabel}
                      </span>
                      <span
                        data-testid="betrayal-discovery-top-banner-title"
                        className={`text-[#fff7c8] ${
                          isPhoneLandscapeLayout ? "text-[17px]" : "text-[24px]"
                        }`}
                      >
                        {latestDiscoveryDisplayedTitle}
                      </span>
                      <span
                        data-testid="betrayal-discovery-top-banner-detail"
                        className={`basis-full leading-snug text-[#e8d7a5] ${
                          isPhoneLandscapeLayout ? "text-[13px]" : "text-[16px]"
                        }`}
                      >
                        {latestDiscoveryDisplaySummary}
                      </span>
                    </div>
                  )}
                  <div
                    data-testid="betrayal-discovery-panel-content"
                    onClick={(event) => event.stopPropagation()}
                    className={`flex flex-col items-center ${
                      shouldShowLatestDiscoveryRoll && latestDiscoveryRecentRoll
                        ? "w-full"
                        : "w-fit"
                    } ${
                      isPhoneLandscapeLayout
                        ? shouldUseMobileEventOpenTableChrome
                          ? "relative justify-start gap-1.5 max-h-[calc(100vh-5.25rem)] w-[min(604px,calc(100vw-20.75rem))] max-w-[calc(100vw-20.75rem)] px-2 py-2"
                          : "justify-center gap-3 max-h-[calc(100vh-4.5rem)] max-w-[calc(100vw-2rem)]"
                        : shouldShowLatestDiscoveryRoll && latestDiscoveryRecentRoll
                          ? "relative isolate justify-center gap-3 max-h-[calc(100vh-8rem)] bg-transparent"
                          : "relative isolate justify-center gap-3 max-h-[calc(100vh-8rem)] rounded-[28px] bg-[radial-gradient(ellipse_at_center,rgba(4,12,10,0.86),rgba(4,12,10,0.62)_52%,rgba(4,12,10,0.46)_72%,rgba(4,12,10,0)_88%)]"
                    }`}
                  >
                    {isPhoneLandscapeLayout &&
                    shouldShowLatestDiscoveryRoll &&
                    latestDiscoveryRecentRoll ? (
                      renderLatestDiscoveryContinueButton(
                        "panel-corner",
                        pendingLatestDiscoveryEventRoll
                          ? `pointer-events-auto absolute right-2 top-2 z-20 inline-flex min-w-[132px] shrink-0 items-center justify-center leading-tight ${diceConfirmButtonClass}`
                          : "pointer-events-auto absolute right-2 top-2 z-20 inline-flex min-h-[44px] min-w-[92px] shrink-0 items-center justify-center border border-[#d6b56d] bg-[rgba(214,181,109,0.22)] px-3 py-1.5 text-[12px] font-bold leading-tight tracking-[0.10em] text-[#fff1b8] shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition hover:bg-[rgba(214,181,109,0.32)]",
                      )
                    ) : null}
                    <span
                      className="sr-only"
                      data-testid="betrayal-discovery-detail"
                    >
                      {latestDiscoveryDisplayedKindLabel} {latestDiscoveryDisplayedTitle}{" "}
                      {latestDiscoveryDisplaySummary}{" "}
                      {latestDiscovery?.detail ?? ""}
                    </span>
                    {shouldShowLatestDiscoveryCardFace ||
                    (shouldShowLatestDiscoveryRoll &&
                      latestDiscoveryRecentRoll) ? (
                    <div
                      data-testid="betrayal-discovery-panel-main"
                      className={`flex min-h-0 items-center justify-center ${
                        isPhoneLandscapeLayout &&
                        shouldShowLatestDiscoveryRoll &&
                        latestDiscoveryRecentRoll
                          ? "h-[min(228px,calc(100vh-10.625rem))] w-full max-w-[calc(100vw-1rem)] flex-row gap-3"
                          : `max-w-[calc(100vw-2rem)] flex-col gap-4 md:flex-row ${
                              shouldShowLatestDiscoveryRoll &&
                              latestDiscoveryRecentRoll
                                ? canCurrentPlayerModifyLatestDiscoveryRoll
                                  ? "w-full md:max-w-[900px] md:gap-5"
                                  : "w-full md:max-w-[920px] md:gap-5"
                                : canCurrentPlayerModifyLatestDiscoveryRoll
                                  ? "md:max-w-[min(780px,calc(100vw-18rem))]"
                                  : "md:max-w-[900px]"
                            }`
                      }`}
                    >
                      {shouldShowLatestDiscoveryCardFace ? (
                      <div
                          className={`relative shrink-0 transition-opacity duration-100 ${
                          visualTransition?.kind === "possession-gain"
                            ? "opacity-0"
                            : "opacity-100"
                        } ${
                          isPhoneLandscapeLayout &&
                          shouldShowLatestDiscoveryRoll &&
                          latestDiscoveryRecentRoll
                            ? "w-[120px]"
                            : shouldShowLatestDiscoveryRoll &&
                                latestDiscoveryRecentRoll
                              ? "w-[min(300px,calc(100vw-2rem))] md:w-[300px]"
                              : "w-[min(300px,calc(100vw-2rem))] md:w-[300px]"
                        }`}
                      >
                        {latestDiscoveryPanelVisual ? (
                          <DiscoveryAtlasFrame
                            visual={latestDiscoveryPanelVisual}
                            locale={effectiveLocale}
                            alt={latestDiscoveryDisplayedTitle}
                            testId="betrayal-discovery-card-front-atlas"
                          />
                        ) : (
                          <div
                            data-testid="betrayal-discovery-card-front-missing"
                            className="flex aspect-[675/1275] flex-col items-center justify-center gap-2 rounded-[10px] border border-[rgba(211,179,109,0.28)] bg-[rgba(13,15,11,0.94)] px-4 text-center leading-tight text-[#d6c498]"
                          >
                            <span className="text-[11px] font-semibold tracking-[0.12em] text-[#9d8f66]">
                              {latestDiscoveryDisplayedKindLabel}
                            </span>
                            <span className="text-[18px] font-black text-[#eadbb0]">
                              {latestDiscovery!.title}
                            </span>
                            </div>
                          )}
                        </div>
                      ) : null}
                      {shouldShowLatestDiscoveryRoll &&
                      latestDiscoveryRecentRoll ? (
                        <RecentRollPanel
                          roll={latestDiscoveryRecentRoll}
                          className={
                            isPhoneLandscapeLayout
                              ? "h-full min-h-[208px] min-w-0 flex-1"
                              : "h-[min(46vh,380px)] min-h-[332px] w-[min(640px,calc(100vw-2rem))] shrink-0 md:w-[560px]"
                          }
                          diceClassName={
                            isPhoneLandscapeLayout
                              ? "min-h-[164px]"
                              : "min-h-[236px]"
                          }
                          rerollSelection={latestDiscoveryRerollSelection}
                          effectiveLocale={effectiveLocale}
                          actorLabel={resolveRecentRollActorLabel(
                            latestDiscoveryRecentRoll,
                          )}
                          showSource={false}
                          showRollLabel={false}
                          openTable
                          compactResult
                          denseResult={isPhoneLandscapeLayout}
                          denseResultPlacement={
                            isPhoneLandscapeLayout ? "floatingSide" : "stacked"
                          }
                          actionSlot={latestDiscoveryRollActionSlot}
                          floatingResultClassName={
                            isPhoneLandscapeLayout ? "top-[52px]" : ""
                          }
                        />
                      ) : null}
                    </div>
                    ) : null}
                    {(isPhoneLandscapeLayout &&
                      shouldShowLatestDiscoveryRoll &&
                      latestDiscoveryRecentRoll) ||
                    latestDiscoveryRollActionSlot
                      ? null
                      : (
                        <div
                          data-testid="betrayal-discovery-card-external-action-dock"
                          className={`pointer-events-auto z-10 flex min-h-[62px] justify-center ${isPhoneLandscapeLayout ? "relative w-full" : "relative mt-2 w-full"}`}
                        >
                          {renderLatestDiscoveryContinueButton(
                            "bottom",
                            pendingLatestDiscoveryEventRoll
                              ? `pointer-events-auto inline-flex min-w-[132px] shrink-0 items-center justify-center ${diceConfirmButtonClass}`
                              : "pointer-events-auto min-h-[46px] min-w-[118px] shrink-0 rounded-[10px] border border-[rgba(214,181,109,0.72)] bg-[linear-gradient(180deg,rgba(31,25,13,0.96),rgba(11,10,7,0.94))] px-6 py-2 text-[12px] font-black tracking-[0.14em] text-[#fff1b8] shadow-[0_14px_28px_rgba(0,0,0,0.52),0_0_18px_rgba(214,181,109,0.16)] transition hover:border-[#f0cc7a] hover:bg-[linear-gradient(180deg,rgba(46,36,15,0.98),rgba(18,14,8,0.96))]",
                            { disabledWhilePendingRoll: true },
                          )}
                        </div>
                      )}
                  </div>
                </div>
              ) : null}

              {core.recentRoll &&
              core.phase !== "endgame" &&
              !isRecentRollDismissed &&
              !isConfirmedExorciseRoll &&
              !pendingEventChoice &&
              !shouldAutoReturnAfterLatestDiscovery &&
              !shouldShowHauntRevealCue &&
              !shouldShowLatestDiscovery ? (
                isExorciseRollReview ||
                core.recentRoll.kind === "attackRoll" ? (
                  <div
                    data-testid="betrayal-roll-review-backdrop"
                    data-backdrop-dismiss={
                      canDismissRecentRollByBackdrop ? "enabled" : "disabled"
                    }
                    className={`absolute inset-0 z-50 flex items-center justify-center px-4 py-12 ${
                      isPhoneLandscapeLayout ? "bg-[rgba(3,7,6,0.92)]" : ""
                    } ${
                      canDismissRecentRollByBackdrop
                        ? "pointer-events-auto"
                        : "pointer-events-none"
                    }`}
                    onClick={
                      canDismissRecentRollByBackdrop
                        ? isExorciseRollReview
                          ? handleConfirmExorciseRollReview
                          : handleDismissRecentRoll
                        : undefined
                    }
                  >
                    <div
                      data-testid={
                        isExorciseRollReview
                          ? "betrayal-exorcise-roll-review"
                          : "betrayal-attack-roll-review"
                      }
                      data-tutorial-id={
                        isExorciseRollReview
                          ? "betrayal-exorcise-roll-review"
                          : "betrayal-attack-roll-review"
                      }
                      className="pointer-events-auto flex w-[min(640px,calc(100vw-2rem))] flex-col items-center gap-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <RecentRollPanel
                        roll={core.recentRoll}
                        className={
                          isPhoneLandscapeLayout
                            ? "h-[min(72vh,320px)] min-h-[286px] w-full rounded-[18px] border border-[rgba(211,179,109,0.30)] bg-[rgba(8,12,10,0.34)] p-2 shadow-[0_16px_34px_rgba(0,0,0,0.24)]"
                            : "h-[min(42vh,360px)] min-h-[300px] w-[min(560px,calc(100vw-2rem))] rounded-[18px] border border-[rgba(211,179,109,0.40)] bg-[rgba(15,24,19,0.54)] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.30)]"
                        }
                        diceClassName={
                          isPhoneLandscapeLayout
                            ? "min-h-[204px]"
                            : "min-h-[190px]"
                        }
                        effectiveLocale={effectiveLocale}
                        actorLabel={resolveRecentRollActorLabel(core.recentRoll)}
                        openTable
                        compactResult
                        resultStageClassName="w-full max-w-[520px] justify-self-center"
                        compactRowsClassName="grid-rows-[minmax(150px,1fr)_auto]"
                        actionSlot={
                          isExorciseRollReview ? (
                            <button
                              type="button"
                              data-testid="betrayal-exorcise-roll-continue"
                              className="inline-flex min-h-[42px] min-w-[168px] items-center justify-center border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a]"
                              onClick={handleConfirmExorciseRollReview}
                            >
                              {isEndgameExorciseRollReview
                                ? t("board.endgame.enterEndgame")
                                : t("board.roll.backToBoard")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid="betrayal-roll-continue"
                              className="inline-flex min-h-[42px] min-w-[168px] items-center justify-center border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a]"
                              onClick={handleDismissRecentRoll}
                            >
                              {t("board.roll.backToBoard")}
                            </button>
                          )
                        }
                        onDiceSettledChange={handleRecentRollDiceSettledChange}
                      />
                    </div>
                  </div>
                ) : (
                  <StandardRecentRollOverlay
                    roll={core.recentRoll}
                    isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                    canDismissByBackdrop={canDismissRecentRollByBackdrop}
                    onDismiss={handleDismissRecentRoll}
                    effectiveLocale={effectiveLocale}
                    rerollSelection={recentRollRerollSelection}
                    actorLabel={resolveRecentRollActorLabel(core.recentRoll)}
                  />
                )
              ) : null}

              {pendingDamageAllocation && pendingDamageExplorer ? (
                <ConditionalHudPortal enabled={true}>
                  <div
                    data-testid="betrayal-damage-allocation-backdrop"
                    className={`pointer-events-auto flex items-center justify-center ${
                      isPhoneLandscapeLayout
                        ? "fixed inset-0 px-3 pb-[74px] pt-6"
                        : "fixed bottom-[96px] left-[248px] right-[232px] top-[92px] px-4 py-8"
                    }`}
                    style={{ zIndex: UI_Z_INDEX.overlayRaised + 170 }}
                  >
                    <div
                      data-testid="betrayal-damage-allocation-panel"
                      data-player-id={pendingDamageAllocation.playerId}
                      className={`grid w-full max-w-[720px] gap-4 border border-[rgba(214,181,109,0.38)] bg-[rgba(12,14,12,0.94)] p-5 text-[#f3e0a6] shadow-[0_26px_54px_rgba(0,0,0,0.58)] ${
                        isPhoneLandscapeLayout ? "max-h-full overflow-y-auto" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="grid gap-1">
                          <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#f2d27f]">
                            {t("board.status.damageAllocationTitle")}
                          </span>
                          <span
                            data-testid="betrayal-damage-allocation-source"
                            className="text-[22px] font-black leading-tight text-[#fff4c7]"
                          >
                            {pendingDamageAllocation.sourceTitle}
                          </span>
                        </div>
                        <div className="grid gap-1 text-right">
                          <span
                            data-testid="betrayal-damage-allocation-player"
                            className="text-[12px] font-semibold text-[#d6c498]"
                          >
                            {pendingDamageExplorerName}
                          </span>
                          <span
                            data-testid="betrayal-damage-allocation-amount"
                            className="text-[16px] font-black text-[#ffccb8]"
                          >
                            {t("board.status.damageAllocationAmount", {
                              amount: pendingDamageAllocation.amount,
                              kind: pendingDamageKindLabel,
                            })}
                          </span>
                        </div>
                      </div>

                      {pendingDamageReductionAmount > 0 ? (
                        <div
                          data-testid="betrayal-damage-allocation-reduction"
                          className="border border-[rgba(122,188,132,0.32)] bg-[rgba(42,82,48,0.24)] px-4 py-3 text-[12px] font-semibold leading-snug text-[#bce8b9]"
                        >
                          {t("board.status.damageAllocationReduction", {
                            originalAmount: pendingDamageAllocation.originalAmount,
                            reducedAmount: pendingDamageAllocation.amount,
                            reductionAmount: pendingDamageReductionAmount,
                            kind: pendingDamageOriginalKindLabel,
                            source: pendingDamageReductionSourceLabel,
                          })}
                        </div>
                      ) : null}

                      {canUseBroochForPendingDamageAllocation &&
                      pendingDamageAllocation.damageReplacement ? (
                        <div
                          data-testid="betrayal-damage-allocation-brooch"
                          data-brooch-active={
                            pendingDamageUsesBrooch ? "true" : "false"
                          }
                          className="grid gap-2 border border-[rgba(169,230,242,0.32)] bg-[rgba(33,67,73,0.28)] px-4 py-3"
                        >
                          <button
                            type="button"
                            data-testid="betrayal-damage-allocation-brooch-toggle"
                            data-brooch-active={
                              pendingDamageUsesBrooch ? "true" : "false"
                            }
                            disabled={!isPendingDamageAllocationForViewer}
                            onClick={handleToggleDamageAllocationBrooch}
                            className={`inline-flex min-h-[42px] items-center justify-center border px-4 py-2 text-[13px] font-black tracking-[0.08em] transition ${
                              pendingDamageUsesBrooch
                                ? "border-[#a9e6f2] bg-[#a9e6f2] text-[#10272d] shadow-[0_0_22px_rgba(116,202,224,0.36)]"
                                : "border-[rgba(169,230,242,0.48)] bg-[rgba(12,14,12,0.38)] text-[#c6f3fb] hover:bg-[rgba(169,230,242,0.12)]"
                            } disabled:cursor-not-allowed disabled:border-[rgba(169,230,242,0.20)] disabled:bg-[rgba(12,14,12,0.22)] disabled:text-[rgba(198,243,251,0.42)]`}
                          >
                            {t(
                              pendingDamageUsesBrooch
                                ? "board.status.damageAllocationBroochActive"
                                : "board.status.damageAllocationBroochInactive",
                              {
                                cardName:
                                  pendingDamageAllocation.damageReplacement
                                    .cardName,
                              },
                            )}
                          </button>
                          <span
                            data-testid="betrayal-damage-allocation-brooch-note"
                            className="text-[12px] font-semibold leading-snug text-[#a9e6f2]"
                          >
                            {t("board.status.damageAllocationBroochNote")}
                          </span>
                        </div>
                      ) : null}

                      <div
                        data-testid="betrayal-damage-allocation-traits"
                        className="flex flex-wrap gap-3"
                      >
                        {pendingDamageAllocationAllowedTraits.map((trait) => {
                          const selectedDamageTraitCount =
                            countSelectedDamageTrait(
                              selectedDamageAllocationTraits,
                              trait,
                            );
                          const maxDamageTraitCount =
                            pendingDamageExplorer
                              ? resolveTraitDamageAssignableSteps(
                                  pendingDamageExplorer,
                                  trait,
                                  pendingDamageAllocationPhase,
                                )
                              : 0;
                          const isSelectedDamageTrait =
                            selectedDamageTraitCount > 0;
                          const isDamageTraitDisabled =
                            !isPendingDamageAllocationForViewer ||
                            (!isSelectedDamageTrait &&
                              (maxDamageTraitCount <= 0 ||
                                selectedDamageAllocationTraits.length >=
                                  pendingDamageAllocation.amount));
                          return (
                            <BetrayalSelectionChip
                              key={trait}
                              type="button"
                              onClick={() =>
                                handleToggleDamageAllocationTrait(trait)
                              }
                              disabled={isDamageTraitDisabled}
                              data-testid={`betrayal-damage-allocation-trait-${trait}`}
                              data-damage-selected-count={
                                selectedDamageTraitCount
                              }
                              data-damage-locked={
                                maxDamageTraitCount <= 0 ? "true" : "false"
                              }
                              selected={isSelectedDamageTrait}
                              selectedClassName={
                                TRAIT_CHOICE_TONE_CLASS[trait].selected
                              }
                              idleClassName={
                                TRAIT_CHOICE_TONE_CLASS[trait].idle
                              }
                            >
                              {TRAIT_LABEL_LOCAL[trait]}
                              {selectedDamageTraitCount > 0
                                ? ` ×${selectedDamageTraitCount}`
                                : ""}
                            </BetrayalSelectionChip>
                          );
                        })}
                      </div>

                      <div
                        data-testid="betrayal-damage-allocation-preview"
                        className="grid grid-cols-2 gap-2.5"
                      >
                        {pendingDamageAllocationAllowedTraits.map((trait) => (
                          <ExplorerTraitOutcomePreview
                            key={`pending-damage-preview-${trait}`}
                            explorer={pendingDamageExplorer}
                            trait={trait}
                            mode="damage"
                            phase={pendingDamageAllocationPhase}
                            stepCount={countSelectedDamageTrait(
                              selectedDamageAllocationTraits,
                              trait,
                            )}
                            locale={effectiveLocale}
                            t={t}
                            testIdPrefix="betrayal-damage-allocation-preview"
                          />
                        ))}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          data-testid="betrayal-damage-allocation-confirm"
                          disabled={
                            !pendingDamageAllocationReady ||
                            !isPendingDamageAllocationForViewer
                          }
                          className="inline-flex min-h-[42px] min-w-[132px] items-center justify-center border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a] disabled:cursor-not-allowed disabled:border-[rgba(214,181,109,0.32)] disabled:bg-[rgba(214,181,109,0.18)] disabled:text-[rgba(243,224,166,0.48)]"
                          onClick={handleResolveDamageAllocation}
                        >
                          {t(
                            isPendingDamageAllocationForViewer
                              ? "board.status.damageAllocationConfirm"
                              : "board.status.damageAllocationWaiting",
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </ConditionalHudPortal>
              ) : null}

              {pendingEventChoice && !pendingEventFocusesMapTarget ? (
                <ConditionalHudPortal enabled={true}>
                <div
                  data-testid="betrayal-event-choice-backdrop"
                  data-scene-visibility={
                    pendingEventTargetRooms.length > 0
                      ? "interactive-map"
                      : "receded"
                  }
                  className={`${
                    pendingEventAwaitsMapTargetClick
                      ? "pointer-events-none"
                      : "pointer-events-auto"
                  } flex items-center ${
                    isPhoneLandscapeLayout
                      ? "fixed inset-0 justify-end px-2 pb-[74px] pr-[8.25rem] pt-6"
                      : "fixed bottom-[96px] left-[248px] right-[232px] top-[92px] items-start justify-center px-2 py-0"
                  }`}
                  style={{ zIndex: UI_Z_INDEX.overlayRaised + 160 }}
                >
                  <div
                    data-testid="betrayal-event-choice-panel"
                    data-layout="main-stage"
                    data-surface="open-table"
                    aria-label={pendingEventChoice.sourceTitle}
                    className={`${
                      pendingEventAwaitsMapTargetClick
                        ? "pointer-events-none"
                        : "pointer-events-auto"
                    } grid overflow-visible text-[#f3e0a6] ${
                      isPhoneLandscapeLayout
                        ? pendingEventChoiceHasResultPanel
                          ? "max-h-[calc(100vh-5.25rem)] w-[min(608px,calc(100vw-20.5rem))] grid-cols-[132px_minmax(294px,1fr)_minmax(158px,158px)] gap-2"
                          : "max-h-[calc(100vh-5.25rem)] w-[min(604px,calc(100vw-19.125rem))] grid-cols-[minmax(132px,168px)_minmax(236px,1fr)] gap-3"
                        : pendingEventChoiceHasResultPanel
                          ? "max-h-full w-full max-w-[1100px] grid-cols-[minmax(230px,260px)_minmax(330px,1fr)_minmax(352px,360px)] items-start gap-5"
                          : "max-h-full w-full max-w-[820px] grid-cols-[minmax(240px,280px)_minmax(380px,1fr)] items-start gap-6"
                    }`}
                  >
                    <div className="pointer-events-none w-full min-w-0 justify-self-center drop-shadow-[0_26px_54px_rgba(0,0,0,0.58)]">
                      {latestDiscoveryVisual ? (
                        <DiscoveryAtlasFrame
                          visual={latestDiscoveryVisual}
                          locale={effectiveLocale}
                          alt={pendingEventChoice.sourceTitle}
                          testId="betrayal-event-choice-card-front-atlas"
                          className={
                            isPhoneLandscapeLayout
                              ? "w-[132px]"
                              : "w-full"
                          }
                        />
                      ) : (
                        <div
                          data-testid="betrayal-event-choice-card-front-missing"
                          className="flex aspect-[675/1275] items-center justify-center border border-[rgba(211,179,109,0.34)] bg-[rgba(13,15,11,0.74)] px-3 text-center text-[14px] font-semibold leading-tight text-[#d6c498]"
                        >
                          {pendingEventChoice.sourceTitle}
                        </div>
                      )}
                    </div>
                    {pendingEventChoiceRoll ? (
                      <RecentRollPanel
                        roll={pendingEventChoiceRoll}
                        className={
                          isPhoneLandscapeLayout
                            ? "col-start-2 row-start-1 h-[262px] min-h-[262px] w-full min-w-0 justify-self-start"
                            : "col-start-2 row-start-1 h-[410px] min-h-[410px] w-full min-w-0 justify-self-start"
                        }
                        diceClassName={
                          isPhoneLandscapeLayout
                            ? "min-h-[156px]"
                            : "min-h-[236px]"
                        }
                        animateInitialRoll={false}
                        effectiveLocale={effectiveLocale}
                        actorLabel={resolveRecentRollActorLabel(pendingEventChoiceRoll)}
                        showSource={false}
                        showRollLabel={false}
                        openTable
                        compactResult={false}
                        denseResult
                        denseResultPlacement="stacked"
                        openTableResultDocked={isPhoneLandscapeLayout}
                        diceVisualScale={isPhoneLandscapeLayout ? 1.04 : 1}
                      />
                    ) : pendingEventChoiceAllTraitCheck ? (
                      <div
                        data-testid="betrayal-event-choice-all-trait-check"
                        className={
                          isPhoneLandscapeLayout
                            ? "pointer-events-none flex h-[min(57vh,276px)] min-h-[236px] min-w-0 flex-col justify-center gap-4 border-l border-[rgba(214,191,129,0.24)] pl-3"
                            : "pointer-events-none flex h-[min(52vh,430px)] min-h-[340px] min-w-0 flex-col justify-center gap-4 border-l border-[rgba(214,191,129,0.24)] pl-6"
                        }
                      >
                        <span className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                          {t("board.roll.allTraitCheckTitle")}
                        </span>
                        <div className="grid gap-3">
                          {pendingEventChoiceAllTraitCheck.results.map(
                            (result) => (
                              <div
                                key={result.trait}
                                data-testid={`betrayal-event-choice-all-trait-check-${result.trait}`}
                                className="grid gap-1 border-b border-[rgba(214,191,129,0.18)] pb-2 last:border-b-0 last:pb-0"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span
                                    className={`text-[18px] font-black ${TRAIT_TONE_CLASS[result.trait].text}`}
                                  >
                                    {TRAIT_LABEL_LOCAL[result.trait]}
                                  </span>
                                  <span
                                    className={
                                      result.passed
                                        ? "text-[18px] font-black text-[#c8f6a5]"
                                        : "text-[18px] font-black text-[#ffb1a1]"
                                    }
                                  >
                                    {result.total} /{" "}
                                    {result.passed
                                      ? t("board.roll.passed")
                                      : t("board.roll.failed")}
                                  </span>
                                </div>
                                <span className="text-[12px] font-semibold tracking-[0.08em] text-[#d6c498]">
                                  {t("board.roll.diceFaces", {
                                    value: result.dice.join(" + "),
                                  })}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div
                      className={`flex min-h-0 min-w-0 flex-col justify-center ${
                        pendingEventChoiceRoll
                          ? isPhoneLandscapeLayout
                            ? "pointer-events-auto relative col-start-3 row-start-1 z-[140] h-[262px] justify-center"
                            : "pointer-events-auto relative col-start-3 row-start-1 z-[140] h-[410px] justify-center"
                          : "pointer-events-auto"
                      }`}
                    >
                      <div
                        className={`custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 ${
                          isPhoneLandscapeLayout
                            ? "justify-start gap-2"
                            : "justify-center gap-6"
                        }`}
                      >
                        {pendingEventTraitChoices.length > 0 ? (
                          <div
                            className={
                              isPhoneLandscapeLayout
                                ? "grid gap-3"
                                : "grid gap-3.5"
                            }
                            data-testid="betrayal-event-choice-traits"
                          >
                            <span
                              className={`font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] ${
                                isPhoneLandscapeLayout
                                  ? "text-[14px]"
                                  : "text-[14px]"
                              }`}
                            >
                              {t("board.sections.traits")}
                            </span>
                            <div
                              className={
                                isPhoneLandscapeLayout
                                  ? "flex flex-nowrap gap-3"
                                  : "flex flex-nowrap gap-4"
                              }
                            >
                              {pendingEventTraitChoices.map((trait) => {
                                const isSelectedTrait =
                                  selectedEventTrait === trait;
                                return (
                                  <BetrayalSelectionChip
                                    key={trait}
                                    type="button"
                                    onClick={() =>
                                      handleSelectEventTrait(trait)
                                    }
                                    data-testid={`betrayal-event-choice-trait-${trait}`}
                                    selected={isSelectedTrait}
                                    selectedClassName={
                                      TRAIT_CHOICE_TONE_CLASS[trait].selected
                                    }
                                    idleClassName={
                                      TRAIT_CHOICE_TONE_CLASS[trait].idle
                                    }
                                    className={
                                      isPhoneLandscapeLayout
                                        ? "!min-h-[44px] !min-w-[72px] !px-3 !py-2 !text-[16px]"
                                        : ""
                                    }
                                  >
                                    {TRAIT_LABEL_LOCAL[trait]}
                                  </BetrayalSelectionChip>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {pendingEventItemChoice ? (
                          <div
                            className={
                              isPhoneLandscapeLayout
                                ? "grid gap-3"
                                : "grid gap-3.5"
                            }
                            data-testid="betrayal-event-choice-items"
                          >
                            <span
                              className={`font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] ${
                                isPhoneLandscapeLayout
                                  ? "text-[14px]"
                                  : "text-[14px]"
                              }`}
                            >
                              {t("board.inventory.eventItemChoice")}
                            </span>
                            {pendingEventItemChoiceCards.length > 0 ? (
                              <div
                                className={
                                  isPhoneLandscapeLayout
                                    ? "flex flex-wrap gap-3"
                                    : "flex flex-wrap gap-4"
                                }
                              >
                                {pendingEventItemChoiceCards.map((card) => (
                                  <BetrayalSelectionChip
                                    key={card.id}
                                    type="button"
                                    onClick={() => handleSelectEventCard(card.id)}
                                    data-testid={`betrayal-event-choice-card-${card.id}`}
                                    selected={selectedEventCardId === card.id}
                                    selectedClassName="border-[#f0d27f] bg-[#d1b05f] text-[#17130d] shadow-[0_0_18px_rgba(209,176,95,0.30)]"
                                    idleClassName="border-[rgba(211,179,109,0.32)] bg-[rgba(18,15,10,0.44)] text-[#d6c498] hover:border-[rgba(211,179,109,0.54)] hover:bg-[rgba(209,176,95,0.12)]"
                                    className={
                                      isPhoneLandscapeLayout
                                        ? "!min-h-[44px] !min-w-[112px] !px-3 !py-2 !text-[14px]"
                                        : "!min-h-[58px] !min-w-[136px] !px-4 !py-3 !text-[16px]"
                                    }
                                  >
                                    {card.name}
                                  </BetrayalSelectionChip>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[13px] font-semibold tracking-[0.06em] text-[#9f8c62]">
                                {t("board.inventory.noEventItemChoices")}
                              </span>
                            )}
                          </div>
                        ) : null}
                        {shouldShowPendingEventDamageChoice &&
                        pendingEventDamageChoice ? (
                          <div
                            className={
                              isPhoneLandscapeLayout
                                ? "grid gap-3"
                                : "grid gap-3.5"
                            }
                            data-testid="betrayal-event-choice-damage-traits"
                          >
                            <span
                              className={`font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] ${
                                isPhoneLandscapeLayout
                                  ? "text-[14px]"
                                  : "text-[14px]"
                              }`}
                            >
                              {t("board.status.damage")}
                            </span>
                            <div
                              className={
                                isPhoneLandscapeLayout
                                  ? "flex flex-wrap gap-3"
                                  : "flex flex-wrap gap-4"
                              }
                            >
                              {pendingEventDamageChoice.allowedTraits.map(
                                (trait) => {
                                  const selectedDamageTraitCount =
                                    countSelectedDamageTrait(
                                      selectedEventDamageTraits,
                                      trait,
                                    );
                                  const maxDamageTraitCount =
                                    resolveTraitDamageAssignableSteps(
                                      core.currentExplorer,
                                      trait,
                                      core.phase,
                                    );
                                  const isSelectedDamageTrait =
                                    selectedDamageTraitCount > 0;
                                  const isDamageTraitDisabled =
                                    !isSelectedDamageTrait &&
                                    (maxDamageTraitCount <= 0 ||
                                      selectedEventDamageTraits.length >=
                                        pendingEventDamageChoice.amount);
                                  return (
                                    <BetrayalSelectionChip
                                      key={trait}
                                      type="button"
                                      onClick={() =>
                                        handleToggleEventDamageTrait(trait)
                                      }
                                      disabled={isDamageTraitDisabled}
                                      data-testid={`betrayal-event-choice-damage-${trait}`}
                                      data-damage-selected-count={
                                        selectedDamageTraitCount
                                      }
                                      data-damage-locked={
                                        maxDamageTraitCount <= 0
                                          ? "true"
                                          : "false"
                                      }
                                      selected={isSelectedDamageTrait}
                                      selectedClassName={
                                        TRAIT_CHOICE_TONE_CLASS[trait].selected
                                      }
                                      idleClassName={
                                        TRAIT_CHOICE_TONE_CLASS[trait].idle
                                      }
                                      className={
                                        isPhoneLandscapeLayout
                                          ? "!min-h-[44px] !min-w-[92px] !px-4 !py-2 !text-[16px]"
                                          : ""
                                      }
                                    >
                                      {TRAIT_LABEL_LOCAL[trait]}
                                      {selectedDamageTraitCount > 0
                                        ? ` ×${selectedDamageTraitCount}`
                                        : ""}
                                    </BetrayalSelectionChip>
                                  );
                                },
                              )}
                            </div>
                            <div
                              data-testid="betrayal-event-damage-preview"
                              className={
                                isPhoneLandscapeLayout
                                  ? "grid grid-cols-2 gap-2"
                                  : "grid grid-cols-2 gap-2.5"
                              }
                            >
                              {pendingEventDamageChoice.allowedTraits.map(
                                (trait) => (
                                  <ExplorerTraitOutcomePreview
                                    key={`damage-preview-${trait}`}
                                    explorer={core.currentExplorer}
                                    trait={trait}
                                    mode="damage"
                                    phase={core.phase}
                                    stepCount={countSelectedDamageTrait(
                                      selectedEventDamageTraits,
                                      trait,
                                    )}
                                    locale={effectiveLocale}
                                    t={t}
                                    testIdPrefix="betrayal-event-damage-preview"
                                  />
                                ),
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      {pendingEventChoice.declineLabel ||
                      shouldShowPendingEventAcceptButton ? (
                        <div
                          className={`shrink-0 ${
                            isPhoneLandscapeLayout
                              ? "mt-4 flex justify-end gap-3 pt-2"
                              : "mt-7 flex justify-end gap-4 pt-3"
                          }`}
                        >
                        {pendingEventChoice.declineLabel ? (
                          <button
                            type="button"
                            onClick={() => handleResolveEventChoice(false)}
                            disabled={!pendingEventCanDecline}
                            data-testid="betrayal-event-choice-decline"
                            className={`pointer-events-auto cursor-pointer rounded-[10px] border-2 border-[rgba(211,179,109,0.42)] bg-[rgba(18,15,10,0.58)] font-black tracking-[0.06em] text-[#d6c498] shadow-[0_12px_26px_rgba(0,0,0,0.30)] transition-colors duration-150 hover:border-[rgba(211,179,109,0.68)] hover:text-[#f0dfad] disabled:cursor-not-allowed disabled:border-[rgba(123,106,74,0.24)] disabled:text-[#7a6a4a] disabled:shadow-none ${
                              isPhoneLandscapeLayout
                                ? "min-h-[56px] min-w-[136px] px-5 text-[16px]"
                                : "min-h-[72px] min-w-[160px] px-8 text-[18px]"
                            }`}
                          >
                            {pendingEventChoice.declineLabel}
                          </button>
                        ) : null}
                        {shouldShowPendingEventAcceptButton ? (
                          <button
                            type="button"
                            onClick={() => handleResolveEventChoice(true)}
                            disabled={!pendingEventReady}
                            data-testid="betrayal-event-choice-confirm"
                            className={`pointer-events-auto cursor-pointer rounded-[10px] border-2 border-[#f0d27f] bg-[#d1b05f] font-black tracking-[0.06em] text-[#17130d] shadow-[0_0_30px_rgba(209,176,95,0.42)] transition-shadow duration-150 hover:bg-[#e5c86f] disabled:cursor-not-allowed disabled:border-[rgba(123,106,74,0.26)] disabled:bg-[rgba(13,15,11,0.34)] disabled:text-[#7a6a4a] disabled:shadow-none ${
                              isPhoneLandscapeLayout
                                ? "min-h-[56px] min-w-[136px] px-5 text-[16px]"
                                : "min-h-[72px] min-w-[160px] px-8 text-[18px]"
                            }`}
                          >
                            {pendingEventChoice.acceptLabel ??
                              t("common:button.confirm")}
                          </button>
                        ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                </ConditionalHudPortal>
              ) : null}

              {!shouldHideTableChromeForBlockingOverlay &&
              (shouldShowRoomFocusTargetLabel ||
                (tradeStatusCueState && core.recommendedAction !== "trade") ||
                useDogTrade ||
                selectedCorpseLootTarget ||
                Boolean(dustHauntTraitSelector) ||
                (hauntActionContext?.actionKind?.startsWith("attack-") &&
                  attackWeaponCardStatuses.length > 0) ||
                (selectedInventoryUseEffectMode === "healTraits" &&
                  healTargetExplorers.length > 0) ||
                Boolean(selectedInventoryHealPreviewExplorer) ||
                Boolean(selectedInventoryRollTotalReplacementEffect) ||
                hasExploreDeclarationOptions ||
                (selectedInventoryUseEffectMode === "placeExplorer" &&
                  inventoryTargetRooms.length > 0) ||
                (selectedCardNeedsTargetRoom &&
                  maskTargetTokens.length > 0 &&
                  maskTargetRooms.length > 0)) ? (
                <ConditionalHudPortal enabled={hasExploreDeclarationOptions}>
                <div
                  className={`${hasExploreDeclarationOptions ? "pointer-events-none" : "pointer-events-auto absolute left-1/2 z-50 -translate-x-1/2"} flex w-[min(880px,calc(100vw-2rem))] flex-wrap items-center justify-center gap-1.5 px-2 pb-1 pt-1 ${
                    core.phase === "haunt"
                      ? isPhoneLandscapeLayout
                        ? "top-[88px]"
                        : "top-[204px]"
                      : "top-[86px]"
                  }`}
                  style={
                    hasExploreDeclarationOptions
                      ? {
                          position: "fixed",
                          left: "50%",
                          top:
                            core.phase === "haunt"
                              ? isPhoneLandscapeLayout
                                ? 88
                                : 204
                              : 86,
                          transform: "translateX(-50%)",
                          zIndex: UI_Z_INDEX.hud + 20,
                        }
                      : undefined
                  }
                >
                  {shouldShowRoomFocusTargetLabel ? (
                    <span
                      data-testid="betrayal-room-focus-target"
                      data-role="status"
                      className="rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold text-[#eef4a8] underline decoration-[#c9a35e] decoration-2 underline-offset-4 shadow-none transition hover:text-[#f6ffc4]"
                    >
                      {roomFocusState?.label}
                    </span>
                  ) : null}
                  {tradeStatusCueState && core.recommendedAction !== "trade" ? (
                    <span
                      data-testid="betrayal-room-trade-status-cue"
                      data-role="status"
                      className="rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold text-[#d4ead0] underline decoration-[#9fe1a7] decoration-2 underline-offset-4 shadow-none transition hover:text-[#e8f7e4]"
                    >
                      {tradeStatusCueState.label}
                    </span>
                  ) : null}
                  {dustHauntTraitSelector ? (
                    <div
                      data-testid="betrayal-dust-trait-selector"
                      data-action-id={dustHauntTraitSelector.actionId}
                      className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.sections.traits")}
                      </span>
                      {dustHauntTraitSelector.choices.map((trait) => {
                        const isSelected =
                          dustHauntTraitSelector.selectedTrait === trait;
                        return (
                          <button
                            key={trait}
                            type="button"
                            onClick={() =>
                              handleSelectDustHauntTrait(
                                dustHauntTraitSelector.actionId,
                                trait,
                              )
                            }
                            data-testid={`${dustHauntTraitSelector.testIdPrefix}-${trait}`}
                            data-selected={isSelected ? "true" : "false"}
                            className={`min-h-[26px] rounded-none border px-1 text-[11px] font-semibold shadow-none transition ${
                              isSelected
                                ? TRAIT_CHOICE_TONE_CLASS[trait].selected
                                : TRAIT_CHOICE_TONE_CLASS[trait].idle
                            }`}
                          >
                            {TRAIT_LABEL_LOCAL[trait]}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {selectedInventoryUseEffectMode === "placeExplorer" &&
                  inventoryTargetRooms.length > 0 ? (
                    <div
                      data-testid="betrayal-inventory-target-room-selector"
                      className="inline-flex max-w-[min(720px,calc(100vw-2rem))] flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.inventory.map")}
                      </span>
                      {inventoryTargetRooms.map((room) => {
                        const isSelectedRoom =
                          selectedInventoryTargetRoomId === room.id;
                        return (
                          <span
                            key={room.id}
                            data-testid={`betrayal-inventory-target-room-${room.id}`}
                            className={`inline-flex min-h-[26px] items-center px-1 text-[11px] font-semibold ${
                              isSelectedRoom
                                ? "text-[#eef4a8]"
                                : "text-[#d6c498]"
                            }`}
                          >
                            {room.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  {selectedInventoryUseEffectMode === "healTraits" &&
                  healTargetExplorers.length > 0 ? (
                    <div
                      data-testid="betrayal-inventory-target-player-selector"
                      className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.inventory.healWithCard", {
                          card:
                            selectedInventoryCard?.name ??
                            t("board.inventory.heal"),
                        })}
                      </span>
                      {healTargetExplorers.map((explorer) => {
                        const isSelectedPlayer =
                          selectedInventoryTargetPlayerId === explorer.playerId;
                        return (
                          <span
                            key={explorer.playerId}
                            data-testid={`betrayal-inventory-target-player-${explorer.playerId}`}
                            className={`inline-flex min-h-[26px] items-center px-1 text-[11px] font-semibold ${
                              isSelectedPlayer
                                ? "text-[#eef4a8]"
                                : "text-[#d6c498]"
                            }`}
                          >
                            {resolvePlayerName(
                              explorer.playerId,
                              explorer.displayName,
                              matchData,
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  {selectedInventoryRollTotalReplacementEffect ? (
                    <div
                      data-testid="betrayal-inventory-roll-total-selector"
                      className="inline-grid max-w-[min(360px,calc(100vw-2rem))] grid-cols-[auto_repeat(9,1.5rem)] items-center justify-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="whitespace-nowrap px-0 pr-1 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.inventory.rollTotalReplacement")}
                      </span>
                      {selectedInventoryReplacementRollTotalOptions.map(
                        (total) => {
                          const isSelected =
                            selectedInventoryReplacementRollTotal === total;
                          return (
                            <button
                              key={total}
                              type="button"
                              onClick={() =>
                                handleSelectInventoryReplacementRollTotal(total)
                              }
                              data-testid={`betrayal-inventory-roll-total-${total}`}
                              data-selected={isSelected ? "true" : "false"}
                              className={`flex h-6 w-6 items-center justify-center rounded-none border p-0 text-[11px] font-semibold shadow-none transition ${
                                isSelected
                                  ? "border-[#e4d36f] bg-[rgba(228,211,111,0.18)] text-[#fff7b8]"
                                  : "border-[rgba(214,196,152,0.32)] bg-transparent text-[#d6c498] hover:text-[#f0dfad]"
                              }`}
                            >
                              {total}
                            </button>
                          );
                        },
                      )}
                    </div>
                  ) : null}
                  {selectedInventoryHealPreviewExplorer ? (
                    <div
                      data-testid="betrayal-inventory-heal-preview"
                      data-player-id={
                        selectedInventoryHealPreviewExplorer.playerId
                      }
                      className="grid max-w-[min(620px,calc(100vw-2rem))] grid-cols-2 gap-1.5 rounded-[9px] border border-[rgba(211,179,109,0.22)] bg-[rgba(12,14,12,0.58)] p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                    >
                      {selectedInventoryHealPreviewTraits.map((trait) => (
                        <ExplorerTraitOutcomePreview
                          key={`heal-preview-${trait}`}
                          explorer={selectedInventoryHealPreviewExplorer}
                          trait={trait}
                          mode="heal"
                          phase={core.phase}
                          stepCount={0}
                          locale={effectiveLocale}
                          t={t}
                          testIdPrefix="betrayal-inventory-heal-preview"
                        />
                      ))}
                    </div>
                  ) : null}
                  {hauntActionContext?.actionKind?.startsWith("attack-") &&
                  attackWeaponCardStatuses.length > 0 ? (
                    <div
                      data-testid="betrayal-attack-weapon-selector"
                      className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.inventory.weapon")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectAttackWeapon(null)}
                        data-testid="betrayal-attack-weapon-none"
                        className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                          selectedAttackWeaponCardId === null
                            ? "text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4"
                            : "text-[#d6c498] hover:text-[#f0dfad]"
                        }`}
                      >
                        {t("board.inventory.unarmed")}
                      </button>
                      {attackWeaponCardStatuses.map((status) => {
                        const { card } = status;
                        const isSelectedWeapon =
                          selectedAttackWeaponCardId === card.id;
                        return (
                          <span
                            key={card.id}
                            data-testid={`betrayal-attack-weapon-option-${card.id}`}
                            data-attack-weapon-can-use={
                              status.canUse ? "true" : "false"
                            }
                            data-action-disabled-reason={
                              status.reason ?? undefined
                            }
                            className="inline-flex items-center gap-1"
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectAttackWeapon(card.id)}
                              disabled={!status.canUse}
                              data-testid={`betrayal-attack-weapon-${card.id}`}
                              title={status.reason ?? card.name}
                              className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition disabled:cursor-not-allowed ${
                                isSelectedWeapon
                                  ? "text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4"
                                  : status.canUse
                                    ? "text-[#d6c498] hover:text-[#f0dfad]"
                                    : "text-[#7a6a4a]"
                              }`}
                            >
                              {card.name}
                            </button>
                            {status.reason ? (
                              <span
                                data-testid={`betrayal-attack-weapon-${card.id}-disabled-reason`}
                                className="text-[10px] font-semibold text-[#b28a75]"
                              >
                                {status.reason.replace(/。$/, "")}
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  {selectedCorpseLootTarget ? (
                    <div
                      data-testid="betrayal-corpse-loot-card-selector"
                      className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.players.corpse")}
                      </span>
                      {selectedCorpseLootTarget.inventory.map((card) => {
                        const isSelectedLootCard =
                          selectedCorpseLootCardId === card.id;
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() =>
                              setPreviewState((previousState) => ({
                                ...previousState,
                                selectedCorpseLootCardId: card.id,
                                tradeSelectionTouched: true,
                              }))
                            }
                            data-testid={`betrayal-corpse-loot-card-${card.id}`}
                            className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                              isSelectedLootCard
                                ? "text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4"
                                : "text-[#d6c498] hover:text-[#f0dfad]"
                            }`}
                          >
                            {card.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {hasExploreDeclarationOptions ? (
                    <div
                      data-testid="betrayal-explore-options"
                      className="flex w-full flex-col items-center justify-center gap-1.5 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="px-0 text-center text-[11px] font-semibold text-[#d9c68f]">
                        {exploreDeclarationLabel}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {canDeclareHolySymbolExplore ? (
                          <button
                            type="button"
                            onClick={handleToggleHolySymbolExplore}
                            data-testid="betrayal-explore-option-holy-symbol"
                            className={`pointer-events-auto min-h-[44px] rounded-[10px] border px-3 text-[13px] font-bold shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] ${
                              useHolySymbolForExplore
                                ? "border-[#d6b56d] bg-[rgba(214,181,109,0.24)] text-[#fff1b8]"
                                : "border-[rgba(214,181,109,0.34)] bg-[rgba(28,24,18,0.72)] text-[#ead7a5] hover:border-[#d6b56d] hover:bg-[rgba(214,181,109,0.16)] hover:text-[#fff1b8]"
                            }`}
                          >
                            {t("board.inventory.holySymbol")}
                          </button>
                        ) : null}
                        {canDeclareIdolExplore ? (
                          <button
                            type="button"
                            onClick={handleToggleIdolExplore}
                            data-testid="betrayal-explore-option-idol"
                            className={`pointer-events-auto min-h-[44px] rounded-[10px] border px-3 text-[13px] font-bold shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] ${
                              useIdolForExplore
                                ? "border-[#d6b56d] bg-[rgba(214,181,109,0.24)] text-[#fff1b8]"
                                : "border-[rgba(214,181,109,0.34)] bg-[rgba(28,24,18,0.72)] text-[#ead7a5] hover:border-[#d6b56d] hover:bg-[rgba(214,181,109,0.16)] hover:text-[#fff1b8]"
                            }`}
                          >
                            {t("board.inventory.idol")}
                          </button>
                        ) : null}
                        {canDeclareTraitorEventSkip ? (
                          <button
                            type="button"
                            onClick={handleToggleTraitorEventSkip}
                            data-testid="betrayal-explore-option-traitor-event-skip"
                            className={`pointer-events-auto min-h-[44px] rounded-[10px] border px-3 text-[13px] font-bold shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] ${
                              ignoreEventSymbolWithTraitorPower
                                ? "border-[#d6b56d] bg-[rgba(214,181,109,0.24)] text-[#fff1b8]"
                                : "border-[rgba(214,181,109,0.34)] bg-[rgba(28,24,18,0.72)] text-[#ead7a5] hover:border-[#d6b56d] hover:bg-[rgba(214,181,109,0.16)] hover:text-[#fff1b8]"
                            }`}
                          >
                            {t("board.inventory.traitorEventSkip")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {selectedCardNeedsTargetRoom &&
                  maskTargetTokens.length > 0 &&
                  maskTargetRooms.length > 0 ? (
                    <div
                      data-testid="betrayal-mask-target-selector"
                      className="inline-flex max-w-[min(720px,calc(100vw-2rem))] flex-wrap items-center gap-2 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="px-1 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.inventory.mask")}
                      </span>
                      {maskTargetTokens.map((token) => (
                        <div
                          key={token.id}
                          data-testid={`betrayal-mask-target-row-${token.id}`}
                          className="inline-flex items-center gap-1"
                        >
                          <span className="max-w-[84px] truncate text-[11px] text-[#ead7a5]">
                            {token.name}
                          </span>
                          <span
                            data-testid={`betrayal-mask-active-target-${token.id}`}
                            className={`inline-flex min-h-[26px] items-center px-1 text-[11px] font-semibold ${
                              activeMaskTargetTokenId === token.id
                                ? "text-[#eef4a8]"
                                : "text-[#d6c498]"
                            }`}
                          >
                            {selectedMaskTargetRoomIdsByTokenId[token.id]
                              ? maskTargetRooms.find(
                                  (room) =>
                                    room.id ===
                                    selectedMaskTargetRoomIdsByTokenId[
                                      token.id
                                    ],
                                )?.name
                              : t("board.status.tradeStepPending")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                </ConditionalHudPortal>
              ) : null}

              <div className="relative min-h-0 flex-1">
                <ZoomPanViewport
                  key={selectedRoomMapFloor}
                  ref={roomGridRef}
                  className={`relative h-full min-h-0 w-full bg-transparent ${
                    isPhoneLandscapeLayout
                      ? "mx-auto grid max-w-none place-items-center"
                      : "pt-[72px] pb-[72px]"
                  }`}
                  contentClassName={`relative ${
                    isPhoneLandscapeLayout
                        ? "mx-auto"
                        : "mx-auto"
                  }`}
                  containerTestId="betrayal-room-grid"
                  contentTestId="betrayal-room-canvas"
                  scaleTestId="betrayal-room-map-scale"
                  initialScale={1}
                  minScale={0.55}
                  maxScale={2.4}
                  panToTarget={
                    roomFocusPanTarget ??
                    (isPhoneLandscapeLayout
                      ? `betrayal-room-${core.currentExplorer.roomId}`
                      : null)
                  }
                  panToScale={isPhoneLandscapeLayout ? 1 : undefined}
                  panBoundsMode="free"
                  dragBoundsPaddingRatioY={0.18}
                  containerProps={{
                    "data-haunt-targeting-mode": isHauntTargetingMode
                      ? "true"
                      : "false",
                    "data-room-focus-pan-target": roomFocusPanTarget ?? "",
                  }}
                  interactionDisabled={isHauntTargetingMode}
                  contentStyle={roomCanvasTransformStyle}
                  ariaLabel={t("board.sections.rooms")}
                >
                  {attackLineOfSightSegments.length > 0 ? (
                    <svg
                      data-testid="betrayal-line-of-sight-overlay"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-visible"
                      style={{
                        width: roomCanvasWidth,
                        height: roomCanvasHeight,
                        zIndex: 42,
                      }}
                      viewBox={`0 0 ${roomCanvasWidth} ${roomCanvasHeight}`}
                    >
                      {attackLineOfSightSegments.map((segment) => (
                        <g
                          key={`${segment.sourceRoomId}-${segment.targetRoomId}-${segment.targetPlayerId}`}
                          data-testid={`betrayal-line-of-sight-line-${segment.sourceRoomId}-${segment.targetRoomId}-${segment.targetPlayerId}`}
                          data-line-of-sight-source-room={segment.sourceRoomId}
                          data-line-of-sight-target-room={segment.targetRoomId}
                          data-line-of-sight-target-player={
                            segment.targetPlayerId
                          }
                          data-line-of-sight-source-monster={
                            segment.sourceMonsterId
                          }
                          data-line-of-sight-kind={segment.kind}
                          data-line-of-sight-weapon={
                            segment.weaponCardId
                          }
                        >
                          <line
                            x1={segment.x1}
                            y1={segment.y1}
                            x2={segment.x2}
                            y2={segment.y2}
                            stroke="rgba(8, 12, 8, 0.72)"
                            strokeWidth={10}
                            strokeLinecap="round"
                          />
                          <line
                            x1={segment.x1}
                            y1={segment.y1}
                            x2={segment.x2}
                            y2={segment.y2}
                            stroke="rgba(238, 244, 168, 0.86)"
                            strokeWidth={6}
                            strokeDasharray="12 8"
                            strokeLinecap="round"
                          />
                          <circle
                            cx={segment.x2}
                            cy={segment.y2}
                            r={9}
                            fill="rgba(238, 244, 168, 0.18)"
                            stroke="rgba(238, 244, 168, 0.68)"
                            strokeWidth={2}
                          />
                        </g>
                      ))}
                    </svg>
                  ) : null}
                  {visibleMapRooms.map((room) => {
                      const tone = FLOOR_TONE[room.floor];
                      const isActive = room.id === core.activeRoomId;
                      const occupants = (roomOccupants[room.id] ?? []).filter(
                        (occupant) =>
                          occupant.playerId !== movingExplorerPlayerId,
                      );
                      const monsters = (roomMonsters[room.id] ?? []).filter(
                        (monster) => monster.id !== movingMonsterId,
                      );
                      const visibleHauntRoomTokens =
                        (visibleHauntTokensByRoomId.get(room.id) ?? []).filter(
                          (token) => token.id !== movingGirlTokenId,
                        );
                      const visibleGirlToken = visibleHauntRoomTokens.find(
                        (token) => token.id === "mummy-girl-token",
                      );
                      const visibleRoomHauntTokens =
                        visibleHauntRoomTokens.filter(
                          (token) => token.id !== "mummy-girl-token",
                        );
                      const canPickUpMummyGirl =
                        visibleGirlToken?.status === "placed" &&
                        core.currentExplorer.roomId === room.id &&
                        hauntActionContext?.actionKind === "use" &&
                        hauntActionContext.commandType ===
                          BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL;
                      const girlHeldByExplorer =
                        visibleGirlToken?.status === "held-by-player";
                      const girlHeldByMummy =
                        visibleGirlToken?.status === "held-by-mummy";
                      const isDiscovered = room.state === "discovered";
                      const isReachableRoom = moveTargetRoomIds.has(room.id);
                      const isSkeletonKeyMoveTarget =
                        skeletonKeyMoveTargetRoomIds.has(room.id);
                      const isMoveTarget =
                        previewState.interactionMode === "move" &&
                        moveTargetRoomIds.has(room.id);
                      const isHelpingHandsTrollMoveTarget =
                        isHelpingHandsTrollHandMoveMode &&
                        Boolean(
                          selectedHelpingHandsTrollHandMoveEntry?.targetRoomIds.has(
                            room.id,
                          ),
                        );
                      const isMonsterMoveTarget =
                        isMonsterMoveMode &&
                        Boolean(
                          selectedMonsterMoveEntry?.targetRoomIds.has(room.id),
                        );
                      const isExploreTarget =
                        previewState.interactionMode === "explore" &&
                        explorableRoomSlotIds.has(room.id);
                      const isInventoryTargetRoom =
                        selectedInventoryUseEffectMode === "placeExplorer" &&
                        inventoryTargetRooms.some(
                          (targetRoom) => targetRoom.id === room.id,
                        );
                      const isSelectedInventoryTargetRoom =
                        isInventoryTargetRoom &&
                        selectedInventoryTargetRoomId === room.id;
                      const isEventChoiceTargetRoom =
                        pendingEventTargetRooms.some(
                          (targetRoom) => targetRoom.id === room.id,
                        );
                      const isSelectedEventChoiceTargetRoom =
                        isEventChoiceTargetRoom &&
                        selectedEventTargetRoomId === room.id;
                      const isMaskTargetRoom =
                        selectedInventoryUseEffectMode === "moveOthersInRoom" &&
                        maskTargetRooms.some(
                          (targetRoom) => targetRoom.id === room.id,
                        );
                      const activeMaskTargetRoomId = activeMaskTargetTokenId
                        ? selectedMaskTargetRoomIdsByTokenId[
                            activeMaskTargetTokenId
                          ]
                        : null;
                      const isSelectedActiveMaskTargetRoom =
                        isMaskTargetRoom && activeMaskTargetRoomId === room.id;
                      const canSelectInventoryRoom = isInventoryTargetRoom;
                      const canSelectEventRoom = isEventChoiceTargetRoom;
                      const canSelectMaskRoom =
                        Boolean(activeMaskTargetTokenId) && isMaskTargetRoom;
                      const isDynamiteTargetRoom =
                        isDynamiteRoomTargetingMode &&
                        dynamiteTargetRoomIds.has(room.id);
                      const canSelectDynamiteRoom = isDynamiteTargetRoom;
                      const canMoveToRoom =
                        previewState.interactionMode === "move" &&
                        isDiscovered &&
                        !isActive &&
                        core.movesRemaining > 0 &&
                        isReachableRoom;
                      const canMoveHelpingHandsTrollHandToRoom =
                        isDiscovered && isHelpingHandsTrollMoveTarget;
                      const canMoveMonsterToRoom =
                        isDiscovered && isMonsterMoveTarget;
                      const isBloodFromStoneSetupPlacementTarget =
                        isBloodFromStoneSetupPlacementMode &&
                        bloodFromStoneSetupCandidateRoomIds.has(room.id);
                      const bloodFromStoneSetupPlacementCountForRoom =
                        selectedBloodFromStoneStoneCherubRoomCountByRoomId.get(
                          room.id,
                        ) ?? 0;
                      const canSelectBloodFromStoneSetupPlacementRoom =
                        isBloodFromStoneSetupPlacementTarget &&
                        selectedBloodFromStoneStoneCherubRoomIds.length <
                          bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount;
                      const isPendingRoomPlacementSlot =
                        pendingRoomPlacementPreview?.slotId === room.id;
                      const canExploreRoom =
                        isExploreTarget && !pendingRoomPlacementPreview;
                      const canSelectRoomFocusAction =
                        !isHelpingHandsTrollHandMoveMode &&
                        !isMonsterMoveMode &&
                        !isBloodFromStoneSetupPlacementMode &&
                        roomFocusState?.actionKind === "use" &&
                        roomFocusState.roomId === room.id;
                      const isHauntTargetRoom =
                        activeHauntTargetGuide?.roomId === room.id;
                      const shouldDimForHauntTargetGuide = Boolean(
                        activeHauntTargetGuide && !isHauntTargetRoom,
                      );
                      const canSelectRoom =
                        canSelectEventRoom ||
                        canSelectInventoryRoom ||
                        canSelectMaskRoom ||
                        canSelectDynamiteRoom ||
                        canSelectBloodFromStoneSetupPlacementRoom ||
                        canSelectRoomFocusAction ||
                        canMoveHelpingHandsTrollHandToRoom ||
                        canMoveMonsterToRoom ||
                        canMoveToRoom ||
                        canExploreRoom;
                      const isRoomSelectionTarget =
                        canSelectEventRoom ||
                        canSelectInventoryRoom ||
                        canSelectMaskRoom ||
                        canSelectDynamiteRoom ||
                        canMoveHelpingHandsTrollHandToRoom ||
                        canMoveMonsterToRoom;
                      const roomTileVisual = resolveRoomTileVisual(
                        room,
                        isDiscovered,
                      );
                      const identityKey = room.discoveryReward
                        ? room.discoveryReward
                        : room.startingTile
                          ? "starting"
                          : isExploreTarget
                            ? "explorable"
                            : !isDiscovered
                              ? "unrevealed"
                              : null;
                      const identityLabel = room.discoveryReward
                        ? t(`board.rooms.rewards.${room.discoveryReward}`)
                        : room.startingTile
                          ? (room.tags[0] ?? t("board.rooms.active"))
                          : isExploreTarget
                            ? t("board.rooms.explorable")
                            : !isDiscovered
                              ? t("board.rooms.slotUndiscovered")
                              : null;
                      const identityTone = identityKey
                        ? ROOM_IDENTITY_TONE[identityKey]
                        : null;
                      const note = isDiscovered
                        ? room.hint
                        : isExploreTarget
                          ? t("board.rooms.slotReady")
                          : t("board.rooms.slotUndiscovered");
                      return (
                        <div
                          key={room.id}
                          data-testid={`betrayal-room-shell-${room.id}`}
                          data-zoom-pan-target={`betrayal-room-${room.id}`}
                          className="group absolute overflow-visible"
                          style={{
                            ...resolveRoomTileStyle(room, roomCanvasLayout),
                            zIndex: isHauntTargetRoom
                              ? 36
                              : isRoomSelectionTarget ||
                                  canSelectRoomFocusAction ||
                                  isHelpingHandsTrollMoveTarget ||
                                  isMonsterMoveTarget ||
                                  isBloodFromStoneSetupPlacementTarget ||
                                  isMoveTarget ||
                                  isExploreTarget ||
                                  isPendingRoomPlacementSlot
                                ? 30
                                : isActive
                                  ? 25
                                  : isReachableRoom
                                    ? 20
                                    : 1,
                          }}
                        >
                          <button
                            type="button"
                            onPointerDown={(event) => {
                              if (canSelectRoom) {
                                event.stopPropagation();
                              }
                            }}
                            onPointerUp={(event) => {
                              if (canSelectRoom) {
                                event.stopPropagation();
                              }
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (canSelectEventRoom) {
                                handleSelectEventTargetRoom(room.id);
                                return;
                              }
                              if (
                                canSelectBloodFromStoneSetupPlacementRoom
                              ) {
                                handleSelectBloodFromStoneSetupPlacementRoom(
                                  room.id,
                                );
                                return;
                              }
                              if (canSelectInventoryRoom) {
                                handleSelectInventoryTargetRoom(room.id);
                                return;
                              }
                              if (
                                canSelectMaskRoom &&
                                activeMaskTargetTokenId
                              ) {
                                handleSelectMaskTargetRoom(
                                  activeMaskTargetTokenId,
                                  room.id,
                                );
                                return;
                              }
                              if (canSelectDynamiteRoom) {
                                handleDynamiteRoomAttack(room.id);
                                return;
                              }
                              if (canMoveHelpingHandsTrollHandToRoom) {
                                handleHelpingHandsTrollHandMoveToRoom(room.id);
                                return;
                              }
                              if (canMoveMonsterToRoom) {
                                handleMoveMonsterToRoom(room.id);
                                return;
                              }
                              if (canSelectRoomFocusAction) {
                                handleUseAction();
                                return;
                              }
                              if (canExploreRoom) {
                                handlePrepareExploreRoom(room.id);
                                return;
                              }
                              if (canMoveToRoom) {
                                handleMoveToRoom(room.id);
                              }
                            }}
                            disabled={!canSelectRoom}
                            data-testid={`betrayal-room-${room.id}`}
                            data-haunt-target-room={
                              isHauntTargetRoom ? "true" : undefined
                            }
                            data-haunt-target-dimmed={
                              shouldDimForHauntTargetGuide ? "true" : undefined
                            }
                            data-direct-target={
                              canSelectRoomFocusAction ||
                              canSelectBloodFromStoneSetupPlacementRoom ||
                              canSelectDynamiteRoom ||
                              canMoveHelpingHandsTrollHandToRoom ||
                              canMoveMonsterToRoom
                                ? "true"
                                : undefined
                            }
                            data-direct-action={
                              canSelectRoomFocusAction
                                ? "room-focus"
                                : canSelectBloodFromStoneSetupPlacementRoom
                                  ? "blood-from-stone-setup-placement"
                                  : canSelectDynamiteRoom
                                    ? "dynamite-room"
                                  : canMoveHelpingHandsTrollHandToRoom
                                    ? "helping-hands-troll-move"
                                    : canMoveMonsterToRoom
                                      ? "monster-move"
                                      : undefined
                            }
                            data-tutorial-id={
                              tutorialMapTargetRoomId === room.id
                                ? tutorialStep?.highlightTarget
                                : undefined
                            }
                            title={
                              isDynamiteTargetRoom
                                ? `炸药目标：${room.name}`
                                : note
                            }
                            className="relative h-full w-full overflow-visible rounded-[4px] border p-0 text-left transition duration-200 disabled:cursor-default"
                            style={{
                              borderColor: isHelpingHandsTrollMoveTarget
                                ? "rgba(159, 225, 167, 0.96)"
                                : isBloodFromStoneSetupPlacementTarget
                                  ? "rgba(238, 204, 126, 0.96)"
                                : isMonsterMoveTarget
                                  ? "rgba(159, 225, 167, 0.96)"
                                : isDynamiteTargetRoom
                                  ? "rgba(238, 204, 126, 0.96)"
                                : isMoveTarget
                                ? "rgba(118, 189, 153, 0.92)"
                                : isPendingRoomPlacementSlot
                                  ? "rgba(238, 204, 126, 0.96)"
                                : isHauntTargetRoom
                                  ? "rgba(217, 255, 151, 0.44)"
                                  : canSelectRoomFocusAction
                                    ? "rgba(238, 244, 168, 0.94)"
                                    : isSelectedInventoryTargetRoom ||
                                        isSelectedEventChoiceTargetRoom ||
                                        isSelectedActiveMaskTargetRoom
                                      ? "rgba(209, 176, 95, 0.94)"
                                      : isRoomSelectionTarget
                                        ? "rgba(209, 176, 95, 0.58)"
                                        : isReachableRoom
                                          ? "rgba(96, 155, 125, 0.42)"
                                          : isExploreTarget
                                            ? "rgba(164, 141, 84, 0.16)"
                                            : "rgba(0, 0, 0, 0)",
                              backgroundColor: "transparent",
                              boxShadow: isActive
                                ? "0 0 16px rgba(105,174,128,0.14), 0 12px 22px rgba(0,0,0,0.22)"
                                : isHauntTargetRoom
                                  ? "0 0 0 1px rgba(217,255,151,0.28), 0 0 16px rgba(217,255,151,0.18), 0 10px 18px rgba(0,0,0,0.18)"
                                  : canSelectRoomFocusAction
                                    ? "0 0 0 3px rgba(238,244,168,0.52), 0 0 24px rgba(238,244,168,0.34), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isHelpingHandsTrollMoveTarget
                                    ? "0 0 0 3px rgba(159,225,167,0.58), 0 0 26px rgba(159,225,167,0.46), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isBloodFromStoneSetupPlacementTarget
                                    ? "0 0 0 3px rgba(238,204,126,0.58), 0 0 26px rgba(238,204,126,0.44), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isMonsterMoveTarget
                                    ? "0 0 0 3px rgba(159,225,167,0.58), 0 0 26px rgba(159,225,167,0.46), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isDynamiteTargetRoom
                                    ? "0 0 0 3px rgba(238,204,126,0.58), 0 0 26px rgba(238,204,126,0.44), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isMoveTarget
                                      ? "0 0 0 3px rgba(118,189,153,0.52), 0 0 22px rgba(118,189,153,0.40), 0 8px 16px rgba(0,0,0,0.18)"
                                      : isSelectedInventoryTargetRoom ||
                                          isSelectedEventChoiceTargetRoom ||
                                          isSelectedActiveMaskTargetRoom
                                        ? "0 0 0 3px rgba(209,176,95,0.52), 0 0 24px rgba(209,176,95,0.44), 0 8px 16px rgba(0,0,0,0.18)"
                                        : isRoomSelectionTarget
                                          ? "0 0 0 2px rgba(209,176,95,0.36), 0 0 18px rgba(209,176,95,0.24), 0 8px 16px rgba(0,0,0,0.16)"
                                          : isReachableRoom
                                            ? "0 0 0 2px rgba(96,155,125,0.46), 0 0 18px rgba(96,155,125,0.24), 0 8px 16px rgba(0,0,0,0.16)"
                                            : isPendingRoomPlacementSlot
                                              ? "0 0 0 3px rgba(238,204,126,0.58), 0 0 26px rgba(238,204,126,0.44), 0 8px 16px rgba(0,0,0,0.18)"
                                              : isExploreTarget
                                                ? "0 0 0 2px rgba(211,179,109,0.42), 0 0 18px rgba(211,179,109,0.22), 0 8px 16px rgba(0,0,0,0.16)"
                                                : "0 8px 16px rgba(0,0,0,0.14)",
                              opacity: !isDiscovered
                                ? shouldDimForHauntTargetGuide
                                  ? 0.58
                                  : 1
                                : shouldDimForHauntTargetGuide
                                  ? 0.62
                                  : isActive ||
                                      isHauntTargetRoom ||
                                      canSelectRoomFocusAction ||
                                      isBloodFromStoneSetupPlacementTarget ||
                                      isHelpingHandsTrollMoveTarget ||
                                      isMonsterMoveTarget ||
                                      isDynamiteTargetRoom ||
                                      isMoveTarget ||
                                      isRoomSelectionTarget ||
                                      isReachableRoom ||
                                      isExploreTarget
                                    ? 1
                                    : 0.92,
                              filter: shouldDimForHauntTargetGuide
                                ? "saturate(0.70) brightness(0.76)"
                                : isHauntTargetRoom
                                  ? "saturate(1.08) brightness(1.04)"
                                  : undefined,
                            }}
                          >
                            <div className="pointer-events-none absolute -inset-0.5 -z-10 rounded-[6px] bg-[rgba(0,0,0,0.12)] blur-[1px]" />
                            <RoomTileSprite
                              visual={roomTileVisual}
                              locale={effectiveLocale}
                              alt=""
                              className={`pointer-events-none absolute inset-0 rounded-[3px] bg-[#15110d] ${
                                isDiscovered ? "opacity-95" : "opacity-82"
                              }`}
                            />
                            <div
                              className={`pointer-events-none absolute inset-0 rounded-[3px] ${
                                isActive
                                  ? "bg-[radial-gradient(circle_at_50%_42%,rgba(126,189,145,0.12),transparent_58%),linear-gradient(180deg,rgba(6,11,9,0.02),rgba(4,7,6,0.24))]"
                                  : isHelpingHandsTrollMoveTarget
                                    ? "bg-[radial-gradient(circle_at_50%_42%,rgba(159,225,167,0.16),transparent_58%)]"
                                  : isMonsterMoveTarget
                                    ? "bg-[radial-gradient(circle_at_50%_42%,rgba(159,225,167,0.16),transparent_58%)]"
                                  : isDynamiteTargetRoom
                                    ? "bg-[radial-gradient(circle_at_50%_42%,rgba(238,204,126,0.16),transparent_58%)]"
                                  : isMoveTarget
                                    ? "bg-[radial-gradient(circle_at_50%_42%,rgba(118,189,153,0.10),transparent_58%)]"
                                    : isReachableRoom
                                      ? "bg-[radial-gradient(circle_at_50%_42%,rgba(96,155,125,0.07),transparent_58%)]"
                                      : "bg-[linear-gradient(180deg,rgba(3,6,5,0.02),rgba(3,5,5,0.16))]"
                              }`}
                            />
                            {isRoomSelectionTarget ? (
                              <span
                                data-testid={
                                  isEventChoiceTargetRoom
                                    ? `betrayal-room-event-choice-target-${room.id}`
                                    : isInventoryTargetRoom
                                      ? `betrayal-room-inventory-target-card-highlight-${room.id}`
                                      : isDynamiteTargetRoom
                                        ? `betrayal-room-dynamite-target-card-highlight-${room.id}`
                                        : `betrayal-room-mask-target-card-highlight-${room.id}`
                                }
                                data-event-target-selected={
                                  isEventChoiceTargetRoom
                                    ? isSelectedEventChoiceTargetRoom
                                      ? "true"
                                      : "false"
                                    : undefined
                                }
                                className={`pointer-events-none absolute inset-0 z-30 rounded-[4px] border-2 bg-[linear-gradient(180deg,rgba(209,176,95,0.16),rgba(209,176,95,0.04))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_24px_rgba(209,176,95,0.52)] ${
                                  isSelectedInventoryTargetRoom ||
                                  isSelectedEventChoiceTargetRoom ||
                                  isSelectedActiveMaskTargetRoom
                                    ? "border-[#d1b05f]"
                                    : "border-[rgba(209,176,95,0.62)]"
                                }`}
                              />
                            ) : null}
                            {canSelectRoomFocusAction ? (
                              <span
                                data-testid={`betrayal-room-focus-card-highlight-${room.id}`}
                                data-highlight-shape="room"
                                className="pointer-events-none absolute inset-0 z-30 rounded-[4px] border-2 border-[#eef4a8] bg-[linear-gradient(180deg,rgba(238,244,168,0.14),rgba(238,244,168,0.04))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_24px_rgba(238,244,168,0.42)]"
                              />
                            ) : null}
                            {canExploreRoom ? (
                              <span
                                data-testid={`betrayal-room-explore-card-highlight-${room.id}`}
                                className="pointer-events-none absolute inset-0 z-20 rounded-[4px] border-2 border-[#d3b36d] bg-[radial-gradient(circle_at_50%_46%,rgba(211,179,109,0.18),rgba(211,179,109,0.04)_62%,transparent_82%)] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_26px_rgba(211,179,109,0.58)]"
                              />
                            ) : null}
                            {identityTone ? (
                              <div
                                data-testid={`betrayal-room-stripe-${room.id}`}
                                className={`absolute left-2 top-2 h-5 w-1.5 border border-white/10 ${identityTone.stripe} ${canExploreRoom ? "hidden" : ""}`}
                              />
                            ) : null}
                            <div className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-inset ring-[rgba(222,192,133,0.05)]" />
                            <div className="sr-only">
                              <span>{room.name}</span>
                              <span>{tone.label}</span>
                              {identityTone && identityLabel ? (
                                <span
                                  data-testid={`betrayal-room-identity-${room.id}`}
                                >
                                  {identityLabel}
                                </span>
                              ) : null}
                              {isActive ? (
                                <span>{t("board.rooms.active")}</span>
                              ) : null}
                            </div>
                            {room.markerTokens?.includes("obstacle") ? (
                              <span
                                data-testid={`betrayal-room-marker-${room.id}-obstacle`}
                                className="pointer-events-none absolute bottom-2 left-2 z-20 grid h-6 w-6 place-items-center rounded-[5px] border border-[#b8914f] bg-[rgba(20,14,9,0.84)] shadow-[0_0_12px_rgba(184,145,79,0.42)]"
                                title={t("board.rooms.obstacle")}
                              >
                                <OptimizedImage
                                  src={ASSETS.marker.obstacle}
                                  locale={effectiveLocale}
                                  alt={t("board.rooms.obstacle")}
                                  className="h-5 w-5 object-contain"
                                  draggable={false}
                                />
                              </span>
                            ) : null}
                            {room.markerTokens?.includes("secretPassage") ? (
                              <span
                                data-testid={`betrayal-room-marker-${room.id}-secret-passage`}
                                className="pointer-events-none absolute bottom-2 left-9 z-20 grid h-6 w-6 place-items-center rounded-[5px] border border-[#71b7aa] bg-[rgba(7,22,20,0.84)] shadow-[0_0_12px_rgba(113,183,170,0.42)]"
                                title={t("board.rooms.secretPassage")}
                              >
                                <OptimizedImage
                                  src={ASSETS.marker.portal}
                                  locale={effectiveLocale}
                                  alt={t("board.rooms.secretPassage")}
                                  className="h-5 w-5 object-contain"
                                  draggable={false}
                                />
                              </span>
                            ) : null}
                            {room.markerTokens?.includes("blessing") ? (
                              <span
                                data-testid={`betrayal-room-marker-${room.id}-blessing`}
                                className="pointer-events-none absolute bottom-2 left-16 z-20 grid h-6 w-6 place-items-center rounded-[5px] border border-[#d8cf78] bg-[rgba(28,25,9,0.84)] shadow-[0_0_12px_rgba(216,207,120,0.42)]"
                                title={t("board.rooms.blessing")}
                              >
                                <OptimizedImage
                                  src={ASSETS.marker.blessing}
                                  locale={effectiveLocale}
                                  alt={t("board.rooms.blessing")}
                                  className="h-5 w-5 object-contain"
                                  draggable={false}
                                />
                              </span>
                            ) : null}
                            {visibleRoomHauntTokens.length > 0 ? (
                              <div
                                data-testid={`betrayal-room-haunt-token-layer-${room.id}`}
                                className="pointer-events-none absolute bottom-2 right-2 z-20 flex max-w-[84px] flex-wrap justify-end gap-1"
                              >
                                {visibleRoomHauntTokens.map((token) => {
                                  const isMummySarcophagusToken =
                                    token.id === "mummy-sarcophagus";
                                  return (
                                    <span
                                      key={token.id}
                                      data-testid={`betrayal-room-haunt-token-${room.id}-${token.id}`}
                                      data-token-kind={token.kind}
                                      data-token-status={
                                        token.status ?? undefined
                                      }
                                      data-token-owner-player-id={
                                        token.ownerPlayerId ?? undefined
                                      }
                                      title={token.label}
                                      className={`grid h-7 min-w-7 place-items-center rounded-full border px-1 text-[10px] font-black leading-none ${
                                        isMummySarcophagusToken
                                            ? "border-[#c3b293] bg-[radial-gradient(circle_at_35%_28%,rgba(232,221,196,0.94),rgba(139,119,82,0.90)_52%,rgba(44,34,22,0.94))] text-[#1f1710] shadow-[0_0_0_1px_rgba(20,12,5,0.88),0_0_14px_rgba(195,178,147,0.44)]"
                                            : "border-[#d8c477] bg-[radial-gradient(circle_at_35%_28%,rgba(255,249,190,0.95),rgba(177,142,68,0.92)_52%,rgba(53,37,18,0.94))] text-[#211407] shadow-[0_0_0_1px_rgba(20,12,5,0.88),0_0_14px_rgba(238,220,126,0.48)]"
                                      }`}
                                    >
                                      {isMummySarcophagusToken
                                          ? t(
                                              "board.hauntTokens.sarcophagusShort",
                                            )
                                          : t(
                                              "board.hauntTokens.researchTokenShort",
                                            )}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : null}
                          </button>

                          {(() => {
                            const hasPlayers = occupants.length > 0;
                            const hasMonsters = monsters.length > 0;
                            const tokenClusterClass =
                              hasPlayers && hasMonsters ? "gap-1.5" : "gap-0";
                            const playerContainerClass = hasMonsters
                              ? "items-center"
                              : "items-center";
                            const monsterContainerClass = hasPlayers
                              ? "items-center"
                              : "items-center";
                            return (
                              <div
                                className={`pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center ${tokenClusterClass}`}
                              >
                                {hasPlayers ? (
                                  <div
                                    className={`flex max-h-[146px] flex-col justify-center gap-2 ${playerContainerClass}`}
                                  >
                                    {occupants.map((occupant) => {
                                      const canSelectTraitorTarget =
                                        activeHauntTargetGuide?.kind ===
                                          "explorer" &&
                                        activeHauntTargetGuide.playerId ===
                                          occupant.playerId &&
                                        hauntActionContext?.actionKind ===
                                          "attack-traitor" &&
                                        occupant.playerId ===
                                          core.scenarioRuntime.traitorPlayerId;
                                      const canSelectDustTarget =
                                        dustTargetPlayerIds.has(
                                          occupant.playerId,
                                        ) &&
                                        (isDustAttackTargetingMode ||
                                          isDustSicknessExchangeMode);
                                      const canSelectHelpingHandsTrollHandTarget =
                                        helpingHandsTrollHandAttackTargetPlayerIds.has(
                                          occupant.playerId,
                                        );
                                      const canSelectMagicCameraTarget =
                                        magicCameraPhotoTargetPlayerIds.has(
                                          occupant.playerId,
                                        );
                                      const canSelectMonsterAttackTarget =
                                        selectedMonsterAttackTargetPlayerIds.has(
                                          occupant.playerId,
                                        );
                                      const canSelectExplorerTarget =
                                        canSelectTraitorTarget ||
                                        canSelectDustTarget ||
                                        canSelectHelpingHandsTrollHandTarget ||
                                        canSelectMagicCameraTarget ||
                                        canSelectMonsterAttackTarget ||
                                        (isHeroAttackTargetingMode &&
                                          heroAttackTargetPlayerIds.has(
                                            occupant.playerId,
                                          )) ||
                                        (selectedInventoryUseEffectMode ===
                                          "healTraits" &&
                                          healTargetExplorers.some(
                                            (target) =>
                                              target.playerId ===
                                              occupant.playerId,
                                          )) ||
                                        (selectedInventoryUseEffectMode ===
                                          "moveOthersInRoom" &&
                                          maskTargetTokens.some(
                                            (target) =>
                                              target.kind === "explorer" &&
                                              target.id === occupant.playerId,
                                          )) ||
                                        (isTradeOrLootTargetSelectionActive &&
                                          (activeTradeTargets.some(
                                            (target) =>
                                              target.playerId ===
                                              occupant.playerId,
                                          ) ||
                                            corpseLootTargets.some(
                                              (target) =>
                                                target.playerId ===
                                                occupant.playerId,
                                            )));
                                      const isHauntGuideExplorerTarget =
                                        activeHauntTargetGuide?.kind ===
                                          "explorer" &&
                                        activeHauntTargetGuide.playerId ===
                                          occupant.playerId;
                                      const isSelectedExplorerTarget =
                                        occupant.playerId ===
                                          selectedTradeTargetPlayerId ||
                                        occupant.playerId ===
                                          selectedCorpseLootTargetPlayerId ||
                                        occupant.playerId ===
                                          selectedInventoryTargetPlayerId ||
                                        occupant.playerId ===
                                          activeMaskTargetTokenId ||
                                        (previewState.selectedTradeTargetPlayerId ===
                                          occupant.playerId &&
                                          (canSelectMagicCameraTarget ||
                                            canSelectMonsterAttackTarget ||
                                            canSelectHelpingHandsTrollHandTarget ||
                                            canSelectDustTarget)) ||
                                        canSelectTraitorTarget ||
                                        (isDustSicknessExchangeMode &&
                                          occupant.playerId ===
                                            selectedDustTargetPlayerId) ||
                                        hauntActionContext?.targetPlayerId ===
                                          occupant.playerId;
                                      const tokenLabel = resolvePlayerName(
                                        occupant.playerId,
                                        occupant.displayName,
                                        matchData,
                                      );
                                      const occupantCarriesGirl =
                                        girlHeldByExplorer &&
                                        visibleGirlToken?.ownerPlayerId ===
                                          occupant.playerId;
                                      const tokenContent = (
                                        <>
                                          <span className="relative inline-flex items-end gap-1">
                                            {renderAttackImpactSurface(
                                              occupant.playerId,
                                              "map",
                                              <ExplorerFigureToken
                                                explorer={occupant}
                                                locale={effectiveLocale}
                                                label={tokenLabel}
                                                tone={
                                                  occupant.playerId ===
                                                  core.currentExplorer.playerId
                                                    ? "self"
                                                    : "ally"
                                                }
                                                missingTokenLabel={t(
                                                  "board.hauntTokens.officialTokenMissing",
                                                )}
                                              />,
                                            )}
                                            {occupantCarriesGirl &&
                                            visibleGirlToken ? (
                                              <GirlBoardToken
                                                token={visibleGirlToken}
                                                t={t}
                                                attachedTo="explorer"
                                              />
                                            ) : null}
                                          </span>
                                          {canSelectExplorerTarget ? (
                                            <span
                                              data-testid={`betrayal-room-occupant-target-outline-${room.id}-${occupant.playerId}`}
                                              data-highlight-shape="pentagon"
                                              data-selected={
                                                isSelectedExplorerTarget ||
                                                isHauntGuideExplorerTarget
                                                  ? "true"
                                                  : "false"
                                              }
                                              className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_24px_rgba(255,224,138,0.58)] ${
                                                isHauntGuideExplorerTarget
                                                  ? "h-[76px] w-[72px] border-[4px] motion-safe:animate-pulse"
                                                  : "h-[62px] w-[58px] border-[3px]"
                                              } ${
                                                isSelectedExplorerTarget ||
                                                isHauntGuideExplorerTarget
                                                  ? "border-[#ffe08a] bg-[rgba(255,224,138,0.16)]"
                                                  : "border-[rgba(209,176,95,0.58)] bg-[rgba(209,176,95,0.06)]"
                                              }`}
                                              style={{
                                                clipPath:
                                                  "polygon(50% 0%, 96% 30%, 82% 100%, 18% 100%, 4% 30%)",
                                              }}
                                            />
                                          ) : null}
                                          {isHauntGuideExplorerTarget ? (
                                            <span
                                              data-testid={`betrayal-room-occupant-target-cue-${room.id}-${occupant.playerId}`}
                                              className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 max-w-[180px] -translate-x-1/2 whitespace-nowrap rounded-[5px] border border-[rgba(217,255,151,0.72)] bg-[rgba(7,14,10,0.92)] px-2 py-1 text-[11px] font-black leading-none tracking-[0.04em] text-[#f2ffd2] shadow-[0_0_0_1px_rgba(7,14,10,0.92),0_8px_18px_rgba(0,0,0,0.34),0_0_20px_rgba(217,255,151,0.24)]"
                                            >
                                              {activeHauntTargetGuide.cue}
                                            </span>
                                          ) : null}
                                        </>
                                      );

                                      if (canSelectExplorerTarget) {
                                        return (
                                          <button
                                            key={occupant.playerId}
                                            type="button"
                                            data-testid={`betrayal-room-occupant-${room.id}-${occupant.playerId}`}
                                            data-highlight-shape="pentagon"
                                            data-direct-target="true"
                                            data-haunt-target-hitbox={
                                              isHauntGuideExplorerTarget
                                                ? "true"
                                                : undefined
                                            }
                                            title={
                                              isHauntGuideExplorerTarget
                                                ? `${tokenLabel} · ${activeHauntTargetGuide.cue}`
                                                : tokenLabel
                                            }
                                            aria-label={
                                              isHauntGuideExplorerTarget
                                                ? `${tokenLabel}，${activeHauntTargetGuide.cue}`
                                                : tokenLabel
                                            }
                                            className={`pointer-events-auto relative cursor-pointer outline-none transition hover:drop-shadow-[0_0_14px_rgba(209,176,95,0.46)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1b05f] ${
                                              isHauntGuideExplorerTarget
                                                ? "grid min-h-[72px] min-w-[72px] place-items-center rounded-[14px] p-3 drop-shadow-[0_0_18px_rgba(255,224,138,0.48)]"
                                                : ""
                                            }`}
                                            onPointerDown={(event) =>
                                              event.stopPropagation()
                                            }
                                            onPointerUp={(event) =>
                                              event.stopPropagation()
                                            }
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleSelectExplorerTarget(
                                                occupant,
                                              );
                                            }}
                                          >
                                            {tokenContent}
                                          </button>
                                        );
                                      }

                                      return (
                                        <button
                                          key={occupant.playerId}
                                          type="button"
                                          className={`relative outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1b05f] ${
                                            canSelectRoomFocusAction
                                              ? "pointer-events-none cursor-default"
                                              : "pointer-events-auto cursor-pointer hover:drop-shadow-[0_0_14px_rgba(209,176,95,0.34)]"
                                          }`}
                                          data-testid={`betrayal-room-occupant-${room.id}-${occupant.playerId}`}
                                          tabIndex={
                                            canSelectRoomFocusAction
                                              ? -1
                                              : undefined
                                          }
                                          title={t(
                                            "board.players.detailsAria",
                                            {
                                              player: tokenLabel,
                                            },
                                          )}
                                          aria-label={t(
                                            "board.players.detailsAria",
                                            { player: tokenLabel },
                                          )}
                                          onPointerDown={(event) =>
                                            event.stopPropagation()
                                          }
                                          onPointerUp={(event) =>
                                            event.stopPropagation()
                                          }
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openExplorerDetails(
                                              occupant.playerId,
                                            );
                                          }}
                                        >
                                          {tokenContent}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {hasMonsters ? (
                                  <div
                                    className={`relative flex justify-center ${
                                      isHauntTargetRoom
                                        ? "max-w-[176px] flex-row gap-1"
                                        : "max-h-[146px] flex-col gap-2"
                                    } ${monsterContainerClass}`}
                                  >
                                    {monsters.map((monster) => {
                                      const canSelectMonsterTarget =
                                        selectedInventoryUseEffectMode ===
                                          "moveOthersInRoom" &&
                                        maskTargetTokens.some(
                                          (target) =>
                                            target.kind === "monster" &&
                                            target.id === monster.id,
                                        );
                                      const canSelectHelpingHandsTrollMoveMonster =
                                        isHelpingHandsTrollHandMoveMode &&
                                        helpingHandsMovableTrollHandIds.has(
                                          monster.id,
                                        );
                                      const canSelectMonsterMoveMonster =
                                        isMonsterMoveMode &&
                                        monsterMovableIds.has(monster.id);
                                      const canSelectMonsterAttackMonster =
                                        isMonsterAttackMode &&
                                        monsterAttackableIds.has(monster.id);
                                      const canSelectPeekabooMonsterTarget =
                                        isBloodFromStonePeekabooMode &&
                                        (bloodFromStonePeekabooSameRoomMonsterIds.has(
                                          monster.id,
                                        ) ||
                                          bloodFromStonePeekabooLineOfSightMonsterIds.has(
                                            monster.id,
                                          ));
                                      const monsterStatus =
                                        monsterStatusById.get(monster.id) ??
                                        "active";
                                      const isSelectedMonsterAttackTarget =
                                        isMonsterAttackMode &&
                                        (selectedMonsterAttackMonsterId ===
                                          monster.id ||
                                          selectedMonsterAttackEntry?.monster
                                            .id === monster.id);
                                      const isSelectedMonsterTarget =
                                        activeMaskTargetTokenId ===
                                          monster.id ||
                                        selectedHelpingHandsTrollHandMoveEntry
                                          ?.monster.id === monster.id ||
                                        selectedMonsterMoveEntry?.monster.id ===
                                          monster.id ||
                                        isSelectedMonsterAttackTarget ||
                                        previewState.selectedPeekabooSameRoomMonsterId ===
                                          monster.id ||
                                        previewState.selectedPeekabooLineOfSightMonsterId ===
                                          monster.id;
                                      const isHauntGuideMonsterTarget =
                                        activeHauntTargetGuide?.kind ===
                                          "monster" &&
                                        activeHauntTargetGuide.monsterId ===
                                          monster.id;
                                      const hauntGuideMonsterCue =
                                        activeHauntTargetGuide?.cue ??
                                        monster.name;
                                      const monsterCarriesGirl =
                                        girlHeldByMummy &&
                                        monster.id ===
                                          core.scenarioRuntime.mummy
                                            ?.mummyMonsterId;
                                      const monsterContent = (
                                        <>
                                          {(canSelectMonsterTarget ||
                                            canSelectHelpingHandsTrollMoveMonster ||
                                            canSelectMonsterMoveMonster ||
                                            canSelectMonsterAttackMonster ||
                                            canSelectPeekabooMonsterTarget) &&
                                          !isHauntGuideMonsterTarget ? (
                                            <span
                                              data-testid={`betrayal-room-monster-target-outline-${room.id}-${monster.id}`}
                                              data-highlight-shape="token"
                                              className={`pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-[12px] border-[4px] bg-transparent shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_28px_rgba(255,224,138,0.74),0_0_42px_rgba(181,239,66,0.18)] ${
                                                isHauntGuideMonsterTarget
                                                  ? "h-[82px] w-[82px] motion-safe:animate-pulse"
                                                  : "h-[68px] w-[68px]"
                                              } ${
                                                isSelectedMonsterTarget ||
                                                isHauntGuideMonsterTarget
                                                  ? "border-[#ffe08a]"
                                                  : "border-[rgba(255,224,138,0.74)]"
                                              }`}
                                            />
                                          ) : null}
                                          <span className="relative z-10 inline-flex items-end gap-1">
                                            <MonsterBoardToken
                                              monster={monster}
                                              locale={effectiveLocale}
                                              t={t}
                                              quietFrame={
                                                isHauntGuideMonsterTarget
                                              }
                                              status={monsterStatus}
                                            />
                                            {monsterCarriesGirl &&
                                            visibleGirlToken ? (
                                              <GirlBoardToken
                                                token={visibleGirlToken}
                                                t={t}
                                                attachedTo="mummy"
                                              />
                                            ) : null}
                                          </span>
                                          {canSelectMonsterTarget ||
                                          canSelectHelpingHandsTrollMoveMonster ||
                                          canSelectMonsterMoveMonster ||
                                          canSelectMonsterAttackMonster ||
                                          canSelectPeekabooMonsterTarget ? (
                                            <span
                                              data-testid={
                                                isHauntGuideMonsterTarget
                                                  ? `betrayal-room-monster-target-affordance-${room.id}-${monster.id}`
                                                  : undefined
                                              }
                                              data-haunt-target-affordance={
                                                isHauntGuideMonsterTarget
                                                  ? "true"
                                                  : undefined
                                              }
                                              data-highlight-shape={
                                                isHauntGuideMonsterTarget
                                                  ? "token"
                                                  : undefined
                                              }
                                              aria-hidden={
                                                isHauntGuideMonsterTarget
                                                  ? "true"
                                                  : undefined
                                              }
                                              className={
                                                isHauntGuideMonsterTarget
                                                  ? "pointer-events-none absolute left-1/2 top-1/2 z-20 h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border-0 bg-[radial-gradient(circle_at_50%_50%,rgba(217,255,151,0.26),rgba(217,255,151,0.12)_48%,transparent_72%)] shadow-[0_0_14px_rgba(217,255,151,0.20)] motion-safe:animate-pulse"
                                                  : "pointer-events-none absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-[4px] border border-[rgba(255,224,138,0.62)] bg-[rgba(18,10,8,0.92)] px-1.5 py-0.5 text-[8px] font-black leading-none tracking-[0.04em] text-[#ffe08a] shadow-[0_3px_8px_rgba(0,0,0,0.38)]"
                                              }
                                            >
                                              {isHauntGuideMonsterTarget
                                                ? null
                                                  : canSelectHelpingHandsTrollMoveMonster ||
                                                      canSelectMonsterMoveMonster ||
                                                      canSelectMonsterAttackMonster ||
                                                      canSelectPeekabooMonsterTarget
                                                    ? t(
                                                        canSelectHelpingHandsTrollMoveMonster
                                                          ? "board.status.helpingHandsTrollMoveToken"
                                                          : canSelectMonsterMoveMonster
                                                            ? "board.status.monsterMoveToken"
                                                            : canSelectMonsterAttackMonster
                                                              ? "board.status.monsterAttackToken"
                                                              : previewState.selectedPeekabooSameRoomMonsterId
                                                                ? "board.status.playPeekabooLineOfSightToken"
                                                                : "board.status.playPeekabooSameRoomToken",
                                                      )
                                                    : monster.name}
                                            </span>
                                          ) : null}
                                          {isHauntGuideMonsterTarget ? (
                                            <span
                                              data-testid={`betrayal-room-monster-target-cue-${room.id}-${monster.id}`}
                                              className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 max-w-[190px] -translate-x-1/2 whitespace-nowrap rounded-[5px] border border-[rgba(217,255,151,0.72)] bg-[rgba(7,14,10,0.92)] px-2 py-1 text-[11px] font-black leading-none tracking-[0.04em] text-[#f2ffd2] shadow-[0_0_0_1px_rgba(7,14,10,0.92),0_8px_18px_rgba(0,0,0,0.34),0_0_20px_rgba(217,255,151,0.24)]"
                                            >
                                              {hauntGuideMonsterCue}
                                            </span>
                                          ) : null}
                                        </>
                                      );

                                      if (
                                        canSelectMonsterTarget ||
                                        canSelectHelpingHandsTrollMoveMonster ||
                                        canSelectMonsterMoveMonster ||
                                        canSelectMonsterAttackMonster ||
                                        canSelectPeekabooMonsterTarget
                                      ) {
                                        return (
                                          <button
                                            key={monster.id}
                                            type="button"
                                            data-testid={`betrayal-room-monster-${room.id}-${monster.id}`}
                                            data-highlight-shape="token"
                                            data-direct-target="true"
                                            data-monster-status={monsterStatus}
                                            data-token-asset={
                                              monster.tokenAsset ??
                                              monster.portraitAsset
                                            }
                                            data-haunt-target-hitbox={
                                              isHauntGuideMonsterTarget
                                                ? "true"
                                                : undefined
                                            }
                                            title={
                                              isHauntGuideMonsterTarget
                                                ? `${monster.name} · ${hauntGuideMonsterCue}`
                                                : canSelectHelpingHandsTrollMoveMonster
                                                    ? `${monster.name} · ${t("board.status.helpingHandsTrollMoveToken")}`
                                                    : canSelectMonsterMoveMonster
                                                      ? `${monster.name} · ${t("board.status.monsterMoveToken")}`
                                                      : canSelectMonsterAttackMonster
                                                        ? `${monster.name} · ${t("board.status.monsterAttackToken")}`
                                                        : canSelectPeekabooMonsterTarget
                                                          ? `${monster.name} · ${t(
                                                              previewState.selectedPeekabooSameRoomMonsterId
                                                                ? "board.status.playPeekabooLineOfSightToken"
                                                                : "board.status.playPeekabooSameRoomToken",
                                                            )}`
                                                        : `${monster.name} · 力量 ${monster.might} · 速度 ${monster.speed}`
                                            }
                                            aria-label={
                                              isHauntGuideMonsterTarget
                                                ? `${monster.name}，${hauntGuideMonsterCue}`
                                                : monster.name
                                            }
                                            className={`pointer-events-auto relative cursor-pointer outline-none transition hover:drop-shadow-[0_0_14px_rgba(209,176,95,0.46)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1b05f] ${
                                              isHauntGuideMonsterTarget
                                                ? "grid min-h-[52px] min-w-[52px] place-items-center rounded-[10px] drop-shadow-[0_0_10px_rgba(217,255,151,0.20)]"
                                                : ""
                                            }`}
                                            onPointerDown={(event) =>
                                              event.stopPropagation()
                                            }
                                            onPointerUp={(event) =>
                                              event.stopPropagation()
                                            }
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              if (
                                                canSelectHelpingHandsTrollMoveMonster
                                              ) {
                                                handleSelectHelpingHandsTrollHandMoveMonster(
                                                  monster.id,
                                                );
                                                return;
                                              }
                                              if (canSelectMonsterMoveMonster) {
                                                handleSelectMonsterMoveMonster(
                                                  monster.id,
                                                );
                                                return;
                                              }
                                              if (
                                                canSelectMonsterAttackMonster
                                              ) {
                                                handleSelectMonsterAttackMonster(
                                                  monster.id,
                                                );
                                                return;
                                              }
                                              if (
                                                canSelectPeekabooMonsterTarget
                                              ) {
                                                handleSelectMonsterTarget(
                                                  monster.id,
                                                );
                                                return;
                                              }
                                              handleSelectMonsterTarget(
                                                monster.id,
                                              );
                                            }}
                                          >
                                            {monsterContent}
                                          </button>
                                        );
                                      }

                                      return (
                                        <span
                                          key={monster.id}
                                          className="relative"
                                          data-testid={`betrayal-room-monster-${room.id}-${monster.id}`}
                                          data-monster-status={monsterStatus}
                                          data-token-asset={
                                            monster.tokenAsset ??
                                            monster.portraitAsset
                                          }
                                          title={`${monster.name} · 力量 ${monster.might} · 速度 ${monster.speed}`}
                                        >
                                          {monsterContent}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {visibleGirlToken?.status === "placed" ? (
                                  <div className="relative flex flex-col items-center justify-center">
                                    <GirlBoardToken
                                      token={visibleGirlToken}
                                      t={t}
                                      attachedTo="room"
                                      interactive={canPickUpMummyGirl}
                                      onClick={
                                        canPickUpMummyGirl
                                          ? handleHauntPrimaryAction
                                          : undefined
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                          {isReachableRoom && !isMoveTarget ? (
                            <span
                              data-testid={`betrayal-room-move-card-highlight-${room.id}`}
                              className="pointer-events-none absolute inset-0 z-20 rounded-[4px] border-2 border-[#6aa986] bg-[linear-gradient(180deg,rgba(106,169,134,0.10),rgba(106,169,134,0.03))] shadow-[0_0_0_1px_rgba(8,24,16,0.86),0_0_18px_rgba(106,169,134,0.38)]"
                              title={
                                isSkeletonKeyMoveTarget
                                  ? t("board.rooms.skeletonKeyMoveTarget")
                                  : t("board.rooms.moveTarget")
                              }
                            />
                          ) : null}
                          {isHelpingHandsTrollMoveTarget ? (
                            <span
                              data-testid={`betrayal-room-helping-hands-troll-move-target-${room.id}`}
                              className="pointer-events-none absolute inset-0 z-30 rounded-[4px] border-2 border-[#9fe1a7] bg-[linear-gradient(180deg,rgba(159,225,167,0.16),rgba(159,225,167,0.04))] shadow-[0_0_0_1px_rgba(8,24,16,0.88),0_0_24px_rgba(159,225,167,0.52)]"
                              title={t(
                                "board.status.helpingHandsTrollMoveTarget",
                                {
                                  monster:
                                    selectedHelpingHandsTrollHandMoveEntry
                                      ?.monster.name ?? "",
                                  room: room.name,
                                },
                              )}
                            />
                          ) : null}
                          {isMonsterMoveTarget ? (
                            <span
                              data-testid={`betrayal-room-monster-move-target-${room.id}`}
                              className="pointer-events-none absolute inset-0 z-30 rounded-[4px] border-2 border-[#9fe1a7] bg-[linear-gradient(180deg,rgba(159,225,167,0.16),rgba(159,225,167,0.04))] shadow-[0_0_0_1px_rgba(8,24,16,0.88),0_0_24px_rgba(159,225,167,0.52)]"
                              title={t("board.status.monsterMoveTarget", {
                                monster:
                                  selectedMonsterMoveEntry?.monster.name ?? "",
                                room: room.name,
                              })}
                            />
                          ) : null}
                          {isBloodFromStoneSetupPlacementTarget ? (
                            <>
                              <span
                                data-testid={`betrayal-room-blood-from-stone-setup-target-${room.id}`}
                                data-blood-from-stone-setup-selected-count={
                                  bloodFromStoneSetupPlacementCountForRoom
                                }
                                data-blood-from-stone-setup-selectable={
                                  canSelectBloodFromStoneSetupPlacementRoom
                                    ? "true"
                                    : "false"
                                }
                                className={`pointer-events-none absolute inset-0 z-30 rounded-[4px] border-2 bg-[linear-gradient(180deg,rgba(238,204,126,0.18),rgba(238,204,126,0.05))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_26px_rgba(238,204,126,0.54)] ${
                                  bloodFromStoneSetupPlacementCountForRoom > 0
                                    ? "border-[#f6ffc4]"
                                    : "border-[#eecc7e]"
                                }`}
                                title={t(
                                  "board.status.bloodFromStoneSetupPlacementTarget",
                                  { room: room.name },
                                )}
                              />
                              {bloodFromStoneSetupPlacementCountForRoom > 0 ? (
                                <span
                                  data-testid={`betrayal-room-blood-from-stone-setup-count-${room.id}`}
                                  className="pointer-events-none absolute right-1 top-1 z-40 rounded-[4px] border border-[#f6ffc4] bg-[rgba(21,17,10,0.92)] px-1.5 py-0.5 text-[10px] font-black leading-none text-[#f6ffc4] shadow-[0_3px_10px_rgba(0,0,0,0.34)]"
                                  aria-hidden="true"
                                >
                                  {t(
                                    "board.status.bloodFromStoneSetupPlacementRoomToken",
                                    {
                                      count:
                                        bloodFromStoneSetupPlacementCountForRoom,
                                    },
                                  )}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                          {isExploreTarget ? (
                            <span
                              data-testid={`betrayal-room-explore-target-${room.id}`}
                              data-room-placement-selected={
                                isPendingRoomPlacementSlot ? "true" : undefined
                              }
                              className={`pointer-events-none absolute inset-0 z-30 rounded-[4px] border-2 bg-[linear-gradient(180deg,rgba(211,179,109,0.16),rgba(211,179,109,0.04))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_26px_rgba(211,179,109,0.58)] ${
                                isPendingRoomPlacementSlot
                                  ? "border-[#eecc7e]"
                                  : "border-[#d3b36d]"
                              }`}
                              title={t("board.rooms.explorable")}
                            />
                          ) : null}
                          {pendingEventFocusesMapTarget ? null : (
                            <button
                              type="button"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setRoomPreviewId(room.id);
                              }}
                              data-testid={`betrayal-room-preview-${room.id}`}
                              className="absolute bottom-2 right-2 z-30 grid h-7 w-7 place-items-center rounded-[5px] border border-[rgba(222,192,133,0.34)] bg-[rgba(7,10,8,0.7)] text-[#f0d29a] opacity-0 shadow-[0_5px_10px_rgba(0,0,0,0.24)] transition group-hover:opacity-78 hover:bg-[rgba(36,28,19,0.88)] hover:opacity-100 focus:opacity-100"
                              title={t("board.rooms.preview")}
                            >
                              <Search size={13} />
                              <span className="sr-only">
                                {t("board.rooms.preview")}
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                </ZoomPanViewport>
                {pendingRoomPlacementFailureText ? (
                  <div
                    data-testid="betrayal-room-placement-failure"
                    className="pointer-events-auto absolute top-3 z-[70] flex min-h-[54px] items-center gap-2 rounded-[10px] border border-[rgba(238,204,126,0.42)] bg-[rgba(10,12,10,0.88)] px-3 py-2 text-[#ead7a5] shadow-[0_14px_34px_rgba(0,0,0,0.44),0_0_20px_rgba(238,204,126,0.16)] backdrop-blur-md"
                    style={{
                      left: "clamp(1rem, 20vw, 20rem)",
                      width: "min(300px, 76vw)",
                    }}
                    aria-live="polite"
                  >
                    <Search size={15} className="shrink-0 text-[#f5d98d]" />
                    <div className="min-w-0 text-[12px] font-black leading-snug text-[#f2dfaa]">
                      {pendingRoomPlacementFailureText}
                    </div>
                  </div>
                ) : null}
                {pendingRoomPlacementPreview &&
                selectedRoomOrientationOption &&
                pendingRoomPlacementVisual
                  ? (() => {
                      const connectingEdge = resolveOppositeRoomEdge(
                        pendingRoomPlacementPreview.entryEdge,
                      );
                      const orientationDegrees =
                        ROOM_ORIENTATION_DEGREES[selectedRoomOrientationTurns];
                      const buriedRoomNames =
                        pendingRoomPlacementPreview.buriedRoomNames ?? [];
                      const buriedRoomSeparator = effectiveLocale.startsWith(
                        "zh",
                      )
                        ? "、"
                        : ", ";
                      const requiresRoomTileAdjustment =
                        pendingRoomPlacementPreview.requiresTileAdjustment;

                      return (
                        <div
                          data-testid="betrayal-room-placement-panel"
                          data-room-placement-slot={
                            pendingRoomPlacementPreview.slotId
                          }
                          data-room-orientation-turns={
                            selectedRoomOrientationTurns
                          }
                          data-room-entry-edge={connectingEdge}
                          className="pointer-events-auto absolute top-3 z-[70] rounded-[10px] border border-[rgba(238,204,126,0.50)] bg-[rgba(10,12,10,0.88)] p-3 text-[#ead7a5] shadow-[0_14px_34px_rgba(0,0,0,0.44),0_0_24px_rgba(238,204,126,0.20)] backdrop-blur-md"
                          style={{
                            left: "clamp(1rem, 20vw, 20rem)",
                            width: "min(300px, 76vw)",
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onPointerUp={(event) => event.stopPropagation()}
                          aria-live="polite"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#cdb16f]">
                                <House size={12} aria-hidden="true" />
                                {t("board.rooms.placementTitle")}
                              </div>
                              <h3 className="mt-0.5 truncate text-[15px] font-black leading-tight text-[#fff1b8]">
                                {pendingRoomPlacementPreview.room.name}
                              </h3>
                            </div>
                            <span className="shrink-0 rounded-[4px] border border-[rgba(238,204,126,0.34)] bg-[rgba(238,204,126,0.12)] px-2 py-1 text-[10px] font-black text-[#f5d98d]">
                              {t(
                                `board.rooms.rewards.${pendingRoomPlacementPreview.deckKind ?? "none"}`,
                              )}
                            </span>
                          </div>
                          <div className="mt-3 flex gap-3">
                            <div
                              data-testid="betrayal-room-placement-preview"
                              className="relative h-[104px] w-[104px] shrink-0 rounded-[8px] border border-[rgba(238,204,126,0.35)] bg-[rgba(0,0,0,0.28)] p-2 shadow-[inset_0_0_18px_rgba(0,0,0,0.36)]"
                            >
                              <div
                                className="absolute inset-2 origin-center transition-transform duration-200 ease-out"
                                style={{
                                  transform: `rotate(${orientationDegrees}deg)`,
                                }}
                              >
                                <RoomTileSprite
                                  visual={pendingRoomPlacementVisual}
                                  locale={effectiveLocale}
                                  alt={pendingRoomPlacementPreview.room.name}
                                  className="h-full w-full rounded-[5px] bg-[#15110d] opacity-95"
                                />
                              </div>
                              {selectedRoomOrientationOption.doorways.map(
                                (doorway, doorwayIndex) => {
                                  const isConnectingDoor =
                                    doorway.edge === connectingEdge;
                                  return (
                                    <span
                                      key={`${doorway.edge}-${doorwayIndex}`}
                                      data-testid={`betrayal-room-placement-door-${doorway.edge}-${doorwayIndex}`}
                                      data-connecting-door={
                                        isConnectingDoor ? "true" : undefined
                                      }
                                      aria-hidden="true"
                                      className={`pointer-events-none absolute z-20 grid h-4 w-4 place-items-center rounded-full border text-[8px] font-black leading-none ${
                                        ROOM_EDGE_MARKER_CLASS[doorway.edge]
                                      } ${
                                        isConnectingDoor
                                          ? "border-[#fff1b8] bg-[#f4cf77] text-[#1e1609] shadow-[0_0_14px_rgba(244,207,119,0.86)]"
                                          : "border-[rgba(238,204,126,0.74)] bg-[rgba(21,15,8,0.86)] text-[#f4cf77]"
                                      }`}
                                    >
                                      {isConnectingDoor ? "•" : ""}
                                    </span>
                                  );
                                },
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9f8d68]">
                                {t("board.rooms.placementSubtitle")}
                              </div>
                              <div
                                data-testid="betrayal-room-placement-entry-label"
                                className="mt-1 text-[12px] font-bold leading-snug text-[#f2dfaa]"
                              >
                                {t("board.rooms.entryDoor")}:{" "}
                                {resolveFloorLabel(
                                  pendingRoomPlacementPreview.floor,
                                )}
                                {" · "}
                                {resolveRoomEdgeLabel(connectingEdge, t)}
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-[#bda773]">
                                {t("board.rooms.orientation", {
                                  degrees: orientationDegrees,
                                })}
                              </div>
                              {buriedRoomNames.length > 0 ? (
                                <div
                                  data-testid="betrayal-room-placement-buried-rooms"
                                  className="mt-2 rounded-[6px] border border-[rgba(177,128,76,0.34)] bg-[rgba(92,54,27,0.32)] px-2 py-1.5 text-[11px] font-bold leading-snug text-[#e7bd83]"
                                >
                                  {t("board.rooms.buriedRooms", {
                                    rooms: buriedRoomNames.join(
                                      buriedRoomSeparator,
                                    ),
                                  })}
                                </div>
                                  ) : null}
                              {pendingRoomPlacementAdjustmentText ? (
                                <div
                                  data-testid="betrayal-room-placement-adjustment-required"
                                  className="mt-2 rounded-[6px] border border-[rgba(238,204,126,0.38)] bg-[rgba(96,78,34,0.34)] px-2 py-1.5 text-[11px] font-bold leading-snug text-[#f2dfaa]"
                                >
                                  {pendingRoomPlacementAdjustmentText}
                                </div>
                              ) : null}
                              {requiresRoomTileAdjustment ? (
                                <div
                                  data-testid="betrayal-room-tile-adjustment-options"
                                  className="mt-2 rounded-[7px] border border-[rgba(238,204,126,0.28)] bg-[rgba(14,12,8,0.42)] p-2"
                                >
                                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#cdb16f]">
                                    {t("board.rooms.adjustmentOptionsTitle")}
                                  </div>
                                  {pendingRoomTileAdjustmentOptions.length > 0 ? (
                                    <div className="mt-1.5 grid gap-1.5">
                                      {pendingRoomTileAdjustmentOptions.map(
                                        (option) => {
                                          const isSelected =
                                            selectedRoomTileAdjustmentOption
                                              ? roomTileAdjustmentSelectionsMatch(
                                                  option,
                                                  selectedRoomTileAdjustmentOption,
                                                )
                                              : false;
                                          const entryEdgeLabel =
                                            resolveRoomEdgeLabel(
                                              option.entryEdge,
                                              t,
                                            );
                                          return (
                                            <button
                                              key={`${option.roomId}-${option.x}-${option.y}-${option.entryRoomId}-${option.entryEdge}-${option.orientationTurns}`}
                                              type="button"
                                              data-testid="betrayal-room-tile-adjustment-option"
                                              data-room-id={option.roomId}
                                              data-entry-room-id={
                                                option.entryRoomId
                                              }
                                              data-selected={
                                                isSelected ? "true" : "false"
                                              }
                                              aria-pressed={isSelected}
                                              onClick={() =>
                                                handleSelectRoomTileAdjustment(
                                                  option,
                                                )
                                              }
                                              className={`min-h-[42px] rounded-[6px] border px-2 py-1.5 text-left transition ${
                                                isSelected
                                                  ? "border-[#f4cf77] bg-[rgba(244,207,119,0.24)] text-[#fff1b8] shadow-[0_0_14px_rgba(244,207,119,0.24)]"
                                                  : "border-[rgba(238,204,126,0.24)] bg-[rgba(255,255,255,0.045)] text-[#ead7a5] hover:border-[rgba(238,204,126,0.42)] hover:bg-[rgba(238,204,126,0.10)]"
                                              }`}
                                            >
                                              <span className="block text-[11px] font-black leading-tight">
                                                {t(
                                                  "board.rooms.adjustmentOption",
                                                  {
                                                    room: option.roomName,
                                                    entryRoom:
                                                      option.entryRoomName,
                                                    edge: entryEdgeLabel,
                                                  },
                                                )}
                                              </span>
                                              <span className="mt-0.5 flex items-center justify-between gap-2 text-[10px] font-bold text-[#bda773]">
                                                <span>
                                                  {t(
                                                    "board.rooms.adjustmentOpenDoorways",
                                                    {
                                                      count:
                                                        option.openDoorwayCount,
                                                    },
                                                  )}
                                                </span>
                                                {isSelected ? (
                                                  <span className="text-[#f4cf77]">
                                                    {t(
                                                      "board.rooms.adjustmentSelected",
                                                    )}
                                                  </span>
                                                ) : null}
                                              </span>
                                            </button>
                                          );
                                        },
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      data-testid="betrayal-room-tile-adjustment-no-options"
                                      className="mt-1.5 rounded-[6px] border border-[rgba(238,204,126,0.18)] bg-[rgba(0,0,0,0.18)] px-2 py-1.5 text-[11px] font-bold text-[#bda773]"
                                    >
                                      {t("board.rooms.adjustmentNoOptions")}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  data-testid="betrayal-room-placement-rotate-left"
                                  onClick={() => handleRotateRoomPlacement(-1)}
                                  disabled={
                                    pendingRoomOrientationOptions.length < 2
                                  }
                                  className="grid min-h-[36px] place-items-center rounded-[6px] border border-[rgba(238,204,126,0.34)] bg-[rgba(238,204,126,0.10)] text-[#f5d98d] transition hover:bg-[rgba(238,204,126,0.18)] disabled:opacity-45 disabled:hover:bg-[rgba(238,204,126,0.10)]"
                                  aria-label={t("board.rooms.rotateLeft")}
                                  title={t("board.rooms.rotateLeft")}
                                >
                                  <RotateCcw size={16} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  data-testid="betrayal-room-placement-rotate-right"
                                  onClick={() => handleRotateRoomPlacement(1)}
                                  disabled={
                                    pendingRoomOrientationOptions.length < 2
                                  }
                                  className="grid min-h-[36px] place-items-center rounded-[6px] border border-[rgba(238,204,126,0.34)] bg-[rgba(238,204,126,0.10)] text-[#f5d98d] transition hover:bg-[rgba(238,204,126,0.18)] disabled:opacity-45 disabled:hover:bg-[rgba(238,204,126,0.10)]"
                                  aria-label={t("board.rooms.rotateRight")}
                                  title={t("board.rooms.rotateRight")}
                                >
                                  <RotateCw size={16} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-[1fr_1.4fr] gap-2">
                            <button
                              type="button"
                              data-testid="betrayal-room-placement-cancel"
                              onClick={handleCancelRoomPlacement}
                              className="min-h-[38px] rounded-[7px] border border-[rgba(238,204,126,0.26)] bg-[rgba(255,255,255,0.04)] px-2 text-[12px] font-black text-[#d7c08b] transition hover:bg-[rgba(255,255,255,0.08)]"
                            >
                              {t("board.rooms.cancelPlacement")}
                            </button>
                            <button
                              type="button"
                              data-testid="betrayal-room-placement-confirm"
                              data-tutorial-id="betrayal-room-placement-confirm"
                              onClick={handleConfirmRoomPlacement}
                              disabled={
                                requiresRoomTileAdjustment &&
                                !selectedRoomTileAdjustmentOption
                              }
                              title={
                                requiresRoomTileAdjustment &&
                                !selectedRoomTileAdjustmentOption
                                  ? pendingRoomPlacementAdjustmentText ?? undefined
                                  : undefined
                              }
                              className="min-h-[38px] rounded-[7px] border border-[#f4cf77] bg-[#d2a84e] px-2 text-[12px] font-black text-[#1e1609] shadow-[0_6px_14px_rgba(0,0,0,0.28),inset_0_-2px_0_rgba(60,38,12,0.24)] transition hover:bg-[#e0bb63] disabled:cursor-not-allowed disabled:border-[rgba(238,204,126,0.32)] disabled:bg-[rgba(238,204,126,0.16)] disabled:text-[#b9a372] disabled:shadow-none disabled:hover:bg-[rgba(238,204,126,0.16)]"
                            >
                              {t("board.rooms.confirmPlacement")}
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  : null}
                <div
                  data-testid="betrayal-room-floor-switcher"
                   className={`pointer-events-auto absolute top-1/2 z-[60] w-[54px] -translate-y-1/2 flex-col items-center overflow-hidden rounded-[10px] border bg-[rgba(8,10,8,0.76)] text-[11px] font-semibold text-[#d6c498] shadow-[0_10px_24px_rgba(0,0,0,0.36)] backdrop-blur-sm ${
                    isPhoneLandscapeLayout ? "right-3" : "right-[228px]"
                  } ${
                    shouldHideTableChromeForBlockingOverlay
                      ? "hidden"
                      : "flex"
                  } ${
                    hasCrossFloorMoveTargets ||
                    hasCrossFloorRoomSelectionTargets
                      ? "border-[#d1b05f] shadow-[0_0_26px_rgba(209,176,95,0.34),0_10px_24px_rgba(0,0,0,0.36)] ring-2 ring-[#d1b05f] ring-offset-2 ring-offset-[rgba(8,10,8,0.78)]"
                      : "border-[rgba(211,179,109,0.30)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (upperRoomMapFloor) {
                        setSelectedRoomMapFloor(upperRoomMapFloor);
                      }
                    }}
                    data-testid="betrayal-room-floor-up"
                    aria-label={t("board.status.floorUp")}
                    disabled={!upperRoomMapFloor}
                    className={`grid h-8 w-full place-items-center border-b border-[rgba(211,179,109,0.20)] transition disabled:text-[#5d5744] disabled:hover:bg-transparent ${
                      upperRoomMapFloorHasSelectionTarget
                        ? "bg-[rgba(209,176,95,0.22)] text-[#fff1b8] shadow-[inset_0_0_16px_rgba(209,176,95,0.36)] hover:bg-[rgba(209,176,95,0.32)]"
                        : hasCrossFloorMoveTargets && upperRoomMapFloor
                          ? "bg-[rgba(34,197,94,0.22)] text-[#c5ffd1] shadow-[inset_0_0_16px_rgba(34,197,94,0.38)] hover:bg-[rgba(34,197,94,0.34)]"
                          : "text-[#ecd294] hover:bg-[rgba(211,179,109,0.14)]"
                    }`}
                  >
                    <ChevronUp size={16} strokeWidth={2.4} />
                  </button>
                  <div
                    data-testid={`betrayal-room-floor-${selectedRoomMapFloor}`}
                    aria-pressed="true"
                    className="grid min-h-[44px] w-full place-items-center px-1 py-1 text-center leading-tight text-[#fff1b8]"
                    style={{
                      boxShadow: `inset 0 0 18px ${selectedRoomMapFloorTone.glow}`,
                    }}
                  >
                    <span>{selectedRoomMapFloorTone.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (lowerRoomMapFloor) {
                        setSelectedRoomMapFloor(lowerRoomMapFloor);
                      }
                    }}
                    data-testid="betrayal-room-floor-down"
                    aria-label={t("board.status.floorDown")}
                    disabled={!lowerRoomMapFloor}
                    className={`grid h-8 w-full place-items-center border-t border-[rgba(211,179,109,0.20)] transition disabled:text-[#5d5744] disabled:hover:bg-transparent ${
                      lowerRoomMapFloorHasSelectionTarget
                        ? "bg-[rgba(209,176,95,0.22)] text-[#fff1b8] shadow-[inset_0_0_16px_rgba(209,176,95,0.36)] hover:bg-[rgba(209,176,95,0.32)]"
                        : hasCrossFloorMoveTargets && lowerRoomMapFloor
                          ? "bg-[rgba(34,197,94,0.22)] text-[#c5ffd1] shadow-[inset_0_0_16px_rgba(34,197,94,0.38)] hover:bg-[rgba(34,197,94,0.34)]"
                          : "text-[#ecd294] hover:bg-[rgba(211,179,109,0.14)]"
                    }`}
                  >
                    <ChevronDown size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
              {!isEndgameExorciseRollReview &&
              !shouldHideTableChromeForBlockingOverlay &&
              !isPhoneLandscapeLayout &&
              (visibleDustProgressItems.length > 0 ||
                shouldShowTradeFlowPrompt ||
                mummyPendingReward ||
                helpingHandsPendingReward ||
                shouldShowHelpingHandsMonsterTurnStatus ||
                (!mummyPendingReward &&
                  !helpingHandsPendingReward &&
                  !pendingTradeAgreement &&
                  !pendingSicknessExchange &&
                  !isDustSicknessExchangeMode &&
                  !activeHauntTargetGuide &&
                  helpingHandsTrollHandAttackOption &&
                  helpingHandsTrollHandAttackTarget)) ? (
                <div
                  data-testid="betrayal-top-prompt-stack"
                  data-prompt-placement="top"
                  className="pointer-events-none absolute left-[248px] right-[232px] top-[84px] z-[58] hidden flex-col items-center gap-2 md:flex"
                >
                  {visibleDustProgressItems.length > 0 &&
                  !pendingSicknessExchange &&
                  !mummyPendingReward &&
                  !helpingHandsPendingReward &&
                  !isDustSicknessExchangeMode ? (
                    <div
                      data-testid="betrayal-dust-progress-strip"
                      data-haunt-progress-kind="dust"
                      data-prompt-placement="top"
                      className={`pointer-events-none flex min-h-[70px] w-[min(960px,calc(100vw-31rem))] flex-wrap items-center justify-center gap-2.5 rounded-[12px] border border-[rgba(211,179,109,0.42)] bg-[rgba(10,13,10,0.82)] px-5 py-3 text-[16px] font-bold tracking-[0.05em] text-[#e6d8a8] shadow-[0_20px_42px_rgba(0,0,0,0.36),0_0_34px_rgba(211,179,109,0.18)] backdrop-blur-sm ${
                        activeHauntTargetGuide ? "opacity-[0.72]" : ""
                      }`}
                    >
                      <span className="text-[17px] text-[#fff1b8]">
                        {activeHauntCaseLabel}
                      </span>
                      <span className="text-[21px] text-[#d1b05f]">
                        {activeHauntTitle}
                      </span>
                      {visibleDustProgressItems.map((item) => (
                        <span
                          key={item.id}
                          data-testid={`betrayal-dust-progress-item-${item.id}`}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[7px] bg-[rgba(211,179,109,0.16)] px-3 py-1"
                        >
                          <span className="text-[#efe1b5]">{item.label}</span>
                          <span className="text-[#f6ffc4]">{item.value}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {shouldShowTradeFlowPrompt ? (
                    <div
                      data-testid="betrayal-trade-flow-banner"
                      data-trade-agreement-state={tradeAgreementState}
                      data-prompt-placement="top"
                      className="pointer-events-none flex min-h-[78px] w-[min(960px,calc(100vw-31rem))] flex-wrap items-center justify-center gap-3.5 rounded-[12px] border border-[rgba(238,204,126,0.56)] bg-[rgba(18,17,13,0.90)] px-6 py-4 text-[17px] font-bold tracking-[0.05em] text-[#f3e0a6] shadow-[0_22px_46px_rgba(0,0,0,0.40),0_0_34px_rgba(238,204,126,0.24)] backdrop-blur-sm"
                      style={{
                        border: "1px solid rgba(238,204,126,0.56)",
                        boxShadow:
                          "0 22px 46px rgba(0,0,0,0.40), 0 0 34px rgba(238,204,126,0.24)",
                        textShadow:
                          "0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(238,204,126,0.38)",
                      }}
                    >
                      <Handshake size={24} strokeWidth={2.4} />
                      <span
                        data-testid="betrayal-trade-flow-item-step"
                        className="text-[17px] text-[#e3d2a1]"
                      >
                        {tradeInstructionText}
                      </span>
                      <span
                        data-testid="betrayal-trade-flow-target-step"
                        className={
                          pendingTradeAgreement
                            ? "text-[22px] text-[#fff1b8]"
                            : tradeSelectionReady
                              ? "text-[22px] text-[#f6ffc4]"
                              : "text-[19px] text-[#d6c498]"
                        }
                      >
                        {tradeFlowTargetStepText}
                      </span>
                      {!pendingTradeAgreement ? (
                        <span
                          data-testid="betrayal-trade-flow-steps"
                          className="basis-full text-center text-[12px] uppercase tracking-[0.13em] text-[#baad82]"
                        >
                          {t("board.status.tradeStepItem")}
                          <span className="mx-1.5">→</span>
                          {t("board.status.tradeStepTarget")}
                          <span className="mx-1.5">→</span>
                          {t("board.status.tradeStepReturn")}
                          <span className="mx-1.5">→</span>
                          {t("board.status.tradeStepRequest")}
                          <span className="mx-1.5">→</span>
                          {t("board.status.tradeStepAgree")}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {mummyPendingReward ? (
                    <div
                      data-testid="betrayal-mummy-reward-banner"
                      data-mummy-reward-state={
                        isMummyRewardChooser ? "choose" : "waiting"
                      }
                      data-prompt-placement="top"
                      className="pointer-events-none flex min-h-[78px] w-[min(960px,calc(100vw-31rem))] flex-wrap items-center justify-center gap-3.5 rounded-[12px] border border-[rgba(238,204,126,0.56)] bg-[rgba(18,17,13,0.90)] px-6 py-4 text-[17px] font-bold tracking-[0.05em] text-[#f3e0a6] shadow-[0_22px_46px_rgba(0,0,0,0.40),0_0_34px_rgba(238,204,126,0.24)] backdrop-blur-sm"
                      style={{
                        textShadow:
                          "0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(238,204,126,0.38)",
                      }}
                    >
                      <Skull size={24} strokeWidth={2.4} />
                      <span className="text-[22px] text-[#fff1b8]">
                        {t("board.status.mummyRewardTitle")}
                      </span>
                      <span
                        data-testid="betrayal-mummy-reward-step"
                        className="text-[17px] text-[#e3d2a1]"
                      >
                        {isMummyRewardChooser
                          ? t("board.status.mummyRewardChoose", {
                              player: mummyRewardDefenderName,
                              damage: mummyPendingReward.damageToHero,
                            })
                          : t("board.status.mummyRewardWaiting", {
                              player: mummyRewardControllerName,
                            })}
                      </span>
                      {mummyUnavailableStealTargetCount > 0 ? (
                        <span
                          data-testid="betrayal-mummy-reward-invalid-targets"
                          className="rounded-full border border-[rgba(245,155,92,0.44)] bg-[rgba(92,42,24,0.44)] px-3 py-1.5 text-[13px] font-bold text-[#ffd0a6]"
                        >
                          {t("board.status.mummyRewardInvalidTargets", {
                            count: mummyUnavailableStealTargetCount,
                          })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {helpingHandsPendingReward ? (
                    <div
                      data-testid="betrayal-helping-hands-reward-banner"
                      data-helping-hands-reward-state={
                        isHelpingHandsRewardChooser ? "choose" : "waiting"
                      }
                      data-prompt-placement="top"
                      className="pointer-events-none flex min-h-[78px] w-[min(960px,calc(100vw-31rem))] flex-wrap items-center justify-center gap-3.5 rounded-[12px] border border-[rgba(238,204,126,0.56)] bg-[rgba(18,17,13,0.90)] px-6 py-4 text-[17px] font-bold tracking-[0.05em] text-[#f3e0a6] shadow-[0_22px_46px_rgba(0,0,0,0.40),0_0_34px_rgba(238,204,126,0.24)] backdrop-blur-sm"
                      style={{
                        textShadow:
                          "0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(238,204,126,0.38)",
                      }}
                    >
                      <Skull size={24} strokeWidth={2.4} />
                      <span className="text-[22px] text-[#fff1b8]">
                        {t("board.status.helpingHandsRewardTitle")}
                      </span>
                      <span
                        data-testid="betrayal-helping-hands-reward-step"
                        className="text-[17px] text-[#e3d2a1]"
                      >
                        {isHelpingHandsRewardChooser
                          ? t("board.status.helpingHandsRewardChoose", {
                              player: helpingHandsRewardDefenderName,
                              damage:
                                helpingHandsPendingReward.damageToDefender,
                            })
                          : t("board.status.helpingHandsRewardWaiting", {
                              player: helpingHandsRewardAttackerName,
                            })}
                      </span>
                    </div>
                  ) : null}
                  {shouldShowHelpingHandsMonsterTurnStatus ? (
                    <div
                      data-testid="betrayal-helping-hands-monster-turn-status"
                      data-helping-hands-monster-state={
                        helpingHandsMonsterTurnStatus.active
                          ? "controlled"
                          : "skipped-no-amulet"
                      }
                      data-prompt-placement="top"
                      className="pointer-events-none inline-flex min-h-[66px] w-[min(860px,calc(100vw-31rem))] items-center justify-center gap-3 rounded-[12px] border border-[rgba(159,225,167,0.38)] bg-[rgba(10,18,14,0.82)] px-5 py-3 text-[16px] font-bold tracking-[0.05em] text-[#d9ffcf] shadow-[0_20px_42px_rgba(0,0,0,0.36),0_0_30px_rgba(159,225,167,0.18)] backdrop-blur-sm"
                    >
                      <span className="text-[21px] text-[#fff1b8]">
                        {t("board.status.helpingHandsTrollAttackTitle")}
                      </span>
                      <span className="text-[#d8c692]">
                        {helpingHandsMonsterTurnStatus.active
                          ? t("board.status.helpingHandsMonsterControlledBy", {
                              player: helpingHandsMonsterControllerName,
                            })
                          : t("board.status.helpingHandsMonsterSkippedNoAmulet")}
                      </span>
                    </div>
                  ) : null}
                  {!helpingHandsPendingReward &&
                  !mummyPendingReward &&
                  !pendingTradeAgreement &&
                  !pendingSicknessExchange &&
                  !isDustSicknessExchangeMode &&
                  !activeHauntTargetGuide &&
                  helpingHandsTrollHandAttackOption &&
                  helpingHandsTrollHandAttackTarget ? (
                    <div
                      data-testid="betrayal-helping-hands-troll-attack-banner"
                      data-prompt-placement="top"
                      className="pointer-events-none flex min-h-[76px] w-[min(940px,calc(100vw-31rem))] flex-wrap items-center justify-center gap-3.5 rounded-[12px] border border-[rgba(159,225,167,0.52)] bg-[rgba(10,18,14,0.86)] px-6 py-4 text-[17px] font-bold tracking-[0.05em] text-[#d9ffcf] shadow-[0_22px_46px_rgba(0,0,0,0.38),0_0_32px_rgba(159,225,167,0.22)] backdrop-blur-sm"
                    >
                      <span className="text-[22px] text-[#fff1b8]">
                        {t("board.status.helpingHandsTrollAttackTitle")}
                      </span>
                      <span
                        data-testid="betrayal-helping-hands-troll-target"
                        className="text-[17px] text-[#d8c692]"
                      >
                        {t("board.status.helpingHandsTrollAttackTarget", {
                          player: helpingHandsTrollHandAttackTargetName,
                        })}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {visibleActionItems.length > 0 &&
              !isEndgameExorciseRollReview &&
              !shouldHideTableChromeForBlockingOverlay &&
              !isPhoneLandscapeLayout ? (
                <div
                  data-testid="betrayal-action-rail"
                  className="pointer-events-none absolute inset-x-0 bottom-1 z-50 hidden flex-col items-center justify-end gap-0.5 md:flex"
                >
                  {mummyPendingReward && isMummyRewardChooser ? (
                    <div
                      data-testid="betrayal-mummy-reward-actions"
                      data-prompt-actions-for="betrayal-mummy-reward-banner"
                      className="pointer-events-auto flex max-w-[760px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(238,204,126,0.34)] bg-[rgba(18,17,13,0.66)] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(238,204,126,0.12)]"
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleResolveMummyAttackReward("damage");
                        }}
                        data-testid="betrayal-mummy-reward-damage"
                        className="min-h-[46px] rounded-[7px] border border-[#d7c16f] bg-[rgba(215,193,111,0.26)] px-5 py-2 text-[15px] font-black text-[#fff4ba] shadow-[0_0_18px_rgba(215,193,111,0.24)] transition hover:bg-[rgba(215,193,111,0.36)]"
                      >
                        {t("board.status.mummyRewardDamage", {
                          damage: mummyPendingReward.damageToHero,
                        })}
                      </button>
                      {mummyStealableCards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleResolveMummyAttackReward("steal", card.id);
                          }}
                          data-testid={`betrayal-mummy-reward-steal-${card.id}`}
                          className="min-h-[46px] rounded-[7px] border border-[rgba(159,225,167,0.52)] bg-[rgba(40,63,50,0.38)] px-5 py-2 text-[15px] font-bold text-[#d9ffcf] transition hover:bg-[rgba(48,78,58,0.50)]"
                        >
                          {t("board.status.mummyRewardSteal", {
                            card: card.name,
                          })}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {helpingHandsPendingReward && isHelpingHandsRewardChooser ? (
                    <div
                      data-testid="betrayal-helping-hands-reward-actions"
                      data-prompt-actions-for="betrayal-helping-hands-reward-banner"
                      className="pointer-events-auto flex max-w-[760px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(238,204,126,0.34)] bg-[rgba(18,17,13,0.66)] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(238,204,126,0.12)]"
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleResolveHelpingHandsAttackReward("damage");
                        }}
                        data-testid="betrayal-helping-hands-reward-damage"
                        className="min-h-[46px] rounded-[7px] border border-[#d7c16f] bg-[rgba(215,193,111,0.26)] px-5 py-2 text-[15px] font-black text-[#fff4ba] shadow-[0_0_18px_rgba(215,193,111,0.24)] transition hover:bg-[rgba(215,193,111,0.36)]"
                      >
                        {t("board.status.helpingHandsRewardDamage", {
                          damage: helpingHandsPendingReward.damageToDefender,
                        })}
                      </button>
                      {helpingHandsStealableCards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleResolveHelpingHandsAttackReward(
                              "steal",
                              card.id,
                            );
                          }}
                          data-testid={`betrayal-helping-hands-reward-steal-${card.id}`}
                            className="min-h-[46px] rounded-[7px] border border-[rgba(159,225,167,0.52)] bg-[rgba(40,63,50,0.38)] px-5 py-2 text-[15px] font-bold text-[#d9ffcf] transition hover:bg-[rgba(48,78,58,0.50)]"
                        >
                          {t("board.status.helpingHandsRewardSteal", {
                            card: card.name,
                          })}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {!mummyPendingReward &&
                  !helpingHandsPendingReward &&
                  !pendingTradeAgreement &&
                  !pendingSicknessExchange &&
                  !isDustSicknessExchangeMode &&
                  !activeHauntTargetGuide &&
                  helpingHandsVisibleTrollHandAttackOptions.length > 0 ? (
                    <div
                      data-testid="betrayal-helping-hands-troll-attack-actions"
                      data-prompt-actions-for="betrayal-helping-hands-troll-attack-banner"
                      className="pointer-events-auto flex max-w-[560px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(159,225,167,0.34)] bg-[rgba(10,18,14,0.62)] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(159,225,167,0.12)]"
                    >
                      {helpingHandsVisibleTrollHandAttackOptions.map(
                        (option) => {
                          const target =
                            helpingHandsTrollHandAttackTargetsByOptionId.get(
                              option.id,
                            );
                          if (!target) {
                            return null;
                          }
                          const singleAttackIndex = option.combined
                            ? 0
                            : helpingHandsMonsterTurnStatus.trollHandIds.indexOf(
                                option.trollHandIds[0] ?? "",
                              ) + 1;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleHelpingHandsTrollHandAttack(
                                  option,
                                  target.playerId,
                                );
                              }}
                              data-testid={
                                option.combined
                                  ? "betrayal-helping-hands-troll-combined"
                                  : `betrayal-helping-hands-troll-single-${option.trollHandIds[0] ?? "unknown"}`
                              }
                              className="min-h-[46px] rounded-[7px] border border-[rgba(159,225,167,0.60)] bg-[rgba(40,78,58,0.40)] px-5 py-2 text-[15px] font-black text-[#e5ffd8] shadow-[0_0_18px_rgba(159,225,167,0.18)] transition hover:bg-[rgba(48,88,66,0.52)]"
                            >
                              {option.combined
                                ? t(
                                    "board.status.helpingHandsTrollCombinedAttack",
                                  )
                                : singleAttackIndex > 0
                                  ? t(
                                      "board.status.helpingHandsTrollSingleAttackWithIndex",
                                      { index: singleAttackIndex },
                                    )
                                  : t(
                                      "board.status.helpingHandsTrollSingleAttack",
                                    )}
                            </button>
                          );
                        },
                      )}
                    </div>
                  ) : null}
                  {!pendingTradeAgreement &&
                  !pendingSicknessExchange &&
                  !mummyPendingReward &&
                  !helpingHandsPendingReward &&
                  !isDustSicknessExchangeMode &&
                  !activeHauntTargetGuide &&
                  core.recommendedAction === "trade" &&
                  canUseDogTrade &&
                  dogTradeTargets.length > 0 ? (
                    <div
                      data-testid="betrayal-dog-trade-selector"
                      data-current-flow-choice="dog-trade-give"
                      className="pointer-events-auto flex max-w-[min(620px,calc(100vw-2rem))] flex-wrap items-end justify-center gap-1.5 rounded-[8px] border border-[rgba(238,204,126,0.26)] bg-[rgba(12,13,10,0.58)] px-2 py-1.5 shadow-[0_10px_26px_rgba(0,0,0,0.24)] backdrop-blur-sm"
                    >
                      <span className="self-center px-1 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.inventory.dog")}
                      </span>
                      {core.currentExplorerInventory
                        .filter((card) => card.id !== "dog")
                        .map((card, index) => {
                          const isDogCardSelected =
                            selectedDogTradeCardIds.includes(card.id);
                          const tradeStatus = resolveBetrayalTradeCardStatus(
                            core,
                            card.id,
                            {
                              ownerPlayerId: core.currentExplorer.playerId,
                              ownerRole: "requester",
                              useDogTrade: true,
                            },
                          );
                          return renderInventoryCard(card, {
                            layout: "compact",
                            testId: `betrayal-dog-trade-card-${card.id}`,
                            compactDenseNoFront: card.kind === "omen",
                            selected: isDogCardSelected,
                            onSelect: () => handleToggleDogTradeCard(card.id),
                            showTurnStatus: false,
                            tradeStatus,
                            instanceKey: `dog-trade-${card.id}-${index}`,
                          });
                        })}
                    </div>
                  ) : null}
                  {!pendingTradeAgreement &&
                  !pendingSicknessExchange &&
                  !mummyPendingReward &&
                  !helpingHandsPendingReward &&
                  !isDustSicknessExchangeMode &&
                  !activeHauntTargetGuide &&
                  core.recommendedAction === "trade" &&
                  selectedTradeTarget &&
                  !selectedCorpseLootTarget &&
                  selectedTradeTarget.inventory.length > 0 ? (
                    <div
                      data-testid="betrayal-trade-return-selector"
                      data-current-flow-choice="trade-return"
                      className="pointer-events-auto flex max-w-[min(620px,calc(100vw-2rem))] flex-wrap items-end justify-center gap-1.5 rounded-[8px] border border-[rgba(238,204,126,0.26)] bg-[rgba(12,13,10,0.58)] px-2 py-1.5 shadow-[0_10px_26px_rgba(0,0,0,0.24)] backdrop-blur-sm"
                    >
                      <span className="self-center px-1 text-[11px] font-semibold text-[#d9c68f]">
                        {tradeReturnSelectorLabel}
                      </span>
                      {selectedTradeTarget.inventory
                        .map((card, index) => {
                          const isReturnCardSelected =
                            selectedTradeReturnCardIds.includes(card.id);
                          const tradeStatus = resolveBetrayalTradeCardStatus(
                            core,
                            card.id,
                            {
                              ownerPlayerId: selectedTradeTarget.playerId,
                              ownerRole: "target",
                            },
                          );
                          return renderInventoryCard(card, {
                            layout: "compact",
                            testId: `betrayal-trade-return-card-${card.id}`,
                            compactDenseNoFront: card.kind === "omen",
                            selected: isReturnCardSelected,
                            onSelect: () =>
                              handleToggleTradeReturnCard(card.id),
                            showTurnStatus: false,
                            tradeStatus,
                            instanceKey: `trade-return-${card.id}-${index}`,
                          });
                        })}
                    </div>
                  ) : null}
                  {pendingSicknessExchange ? (
                    <div
                      data-testid="betrayal-sickness-exchange-banner"
                      data-sickness-exchange-state={
                        isPendingSicknessForViewer
                          ? "incoming"
                          : isPendingSicknessFromViewer
                            ? "waiting"
                            : "observing"
                      }
                      className="pointer-events-auto flex max-w-[760px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(238,204,126,0.38)] bg-[rgba(18,17,13,0.78)] px-3 py-2 text-[12px] font-semibold tracking-[0.05em] text-[#f3e0a6] shadow-[0_12px_28px_rgba(0,0,0,0.30),0_0_22px_rgba(238,204,126,0.16)]"
                      style={{
                        border: "1px solid rgba(238,204,126,0.38)",
                        boxShadow:
                          "0 12px 28px rgba(0,0,0,0.30), 0 0 22px rgba(238,204,126,0.16)",
                        textShadow:
                          "0 1px 2px rgba(0,0,0,0.85), 0 0 12px rgba(238,204,126,0.36)",
                      }}
                    >
                      <Handshake size={15} strokeWidth={2.4} />
                      <span data-testid="betrayal-sickness-exchange-step">
                        {tradeInstructionText}
                      </span>
                      <span
                        data-testid="betrayal-sickness-exchange-target-step"
                        className="text-[#fff1b8]"
                      >
                        {isPendingSicknessForViewer
                          ? t("board.status.sicknessExchangeTitle")
                          : t("board.status.sicknessExchangeWaiting", {
                              player: pendingSicknessTargetName,
                            })}
                      </span>
                      {isPendingSicknessForViewer ? (
                        <div
                          data-testid="betrayal-sickness-exchange-panel"
                          className="ml-1 flex items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveSicknessExchange(true);
                            }}
                            data-testid="betrayal-sickness-exchange-accept"
                            className="min-h-[34px] rounded-[5px] border border-[#d7c16f] bg-[rgba(215,193,111,0.20)] px-3 py-1 text-[12px] font-black text-[#fff4ba] shadow-[0_0_16px_rgba(215,193,111,0.22)] transition hover:bg-[rgba(215,193,111,0.30)]"
                          >
                            {t("board.status.sicknessExchangeAccept")}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveSicknessExchange(false);
                            }}
                            data-testid="betrayal-sickness-exchange-decline"
                            className="min-h-[34px] rounded-[5px] border border-[rgba(244,164,120,0.42)] bg-[rgba(96,48,30,0.36)] px-3 py-1 text-[12px] font-bold text-[#f3c1a1] transition hover:bg-[rgba(116,58,36,0.46)]"
                          >
                            {t("board.status.sicknessExchangeDecline")}
                          </button>
                        </div>
                      ) : (
                        <span
                          data-testid="betrayal-sickness-exchange-waiting"
                          className="text-[11px] uppercase tracking-[0.14em] text-[#bba979]"
                        >
                          {t("board.status.tradeStepAgree")}
                        </span>
                      )}
                    </div>
                  ) : null}
                  {shouldShowTradeActionPanel ? (
                    <div
                      data-testid="betrayal-trade-action-panel"
                      data-prompt-actions-for="betrayal-trade-flow-banner"
                      className="pointer-events-auto flex max-w-[760px] flex-wrap items-center justify-center gap-2 rounded-[8px] border border-[rgba(238,204,126,0.34)] bg-[rgba(18,17,13,0.66)] px-3 py-2 text-[12px] font-semibold tracking-[0.05em] text-[#f3e0a6] shadow-[0_12px_26px_rgba(0,0,0,0.24),0_0_18px_rgba(238,204,126,0.12)]"
                      style={{
                        border: "1px solid rgba(238,204,126,0.34)",
                        boxShadow:
                          "0 12px 26px rgba(0,0,0,0.24), 0 0 18px rgba(238,204,126,0.12)",
                        textShadow:
                          "0 1px 2px rgba(0,0,0,0.85), 0 0 12px rgba(238,204,126,0.36)",
                      }}
                    >
                      {shouldShowInlineTradeConfirm ? (
                        <button
                          type="button"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                          onPointerUp={(event) => {
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleTradeAction();
                          }}
                          data-testid="betrayal-action-trade"
                          data-trade-confirm-placement="bottom-action-panel"
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[7px] border border-[#d7c16f] bg-[rgba(215,193,111,0.26)] px-5 py-2 text-[15px] font-black tracking-[0.08em] text-[#fff4ba] shadow-[0_0_18px_rgba(215,193,111,0.24)] transition hover:bg-[rgba(215,193,111,0.36)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff1b8]"
                        >
                          <Handshake size={17} strokeWidth={2.4} />
                          <span>{t("board.status.tradeFlowRequest")}</span>
                        </button>
                      ) : null}
                      {pendingTradeAgreement && isPendingTradeForViewer ? (
                        <div
                          data-testid="betrayal-trade-agreement-panel"
                          className="flex items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveTradeAgreement(true);
                            }}
                            data-testid="betrayal-trade-agreement-accept"
                            className="min-h-[46px] rounded-[7px] border border-[#d7c16f] bg-[rgba(215,193,111,0.24)] px-5 py-2 text-[15px] font-black text-[#fff4ba] shadow-[0_0_16px_rgba(215,193,111,0.22)] transition hover:bg-[rgba(215,193,111,0.34)]"
                          >
                            {t("board.status.tradeAgreementAccept")}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveTradeAgreement(false);
                            }}
                            data-testid="betrayal-trade-agreement-decline"
                            className="min-h-[46px] rounded-[7px] border border-[rgba(244,164,120,0.46)] bg-[rgba(96,48,30,0.40)] px-5 py-2 text-[15px] font-bold text-[#f3c1a1] transition hover:bg-[rgba(116,58,36,0.50)]"
                          >
                            {t("board.status.tradeAgreementDecline")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {visibleActionDisabledReason ? (
                    <div
                      data-testid="betrayal-action-disabled-reason-visible"
                      className="pointer-events-none flex max-w-[520px] items-center gap-2 rounded-[6px] border border-[rgba(240,193,162,0.44)] bg-[rgba(57,30,22,0.78)] px-3 py-1 text-[12px] font-semibold tracking-[0.04em] text-[#f0c1a2] shadow-[0_10px_22px_rgba(0,0,0,0.22)]"
                    >
                      <span>{visibleActionDisabledReason}</span>
                    </div>
                  ) : null}
                  {roomEndTurnEffectHint ? (
                    <div
                      data-testid="betrayal-room-end-turn-effect-hint"
                      className="pointer-events-none flex max-w-[520px] items-center gap-2 rounded-[6px] border border-[#b66b36] bg-[rgba(55,24,15,0.78)] px-3 py-1 text-[12px] font-semibold tracking-[0.04em] text-[#ffd59a] shadow-[0_10px_22px_rgba(0,0,0,0.22)]"
                    >
                      <Hourglass size={15} strokeWidth={2.4} />
                      <span className="text-[#ffe0aa]">
                        {roomEndTurnEffectHint.title}
                      </span>
                      <span className="text-[#eebd82]">
                        {roomEndTurnEffectHint.detail}
                      </span>
                    </div>
                  ) : null}
                  <div className="pointer-events-auto relative flex min-h-[48px] w-full items-end justify-center gap-5">
                    {visibleActionItems.map((action) => {
                      if (
                        action.id === "trade" &&
                        shouldShowInlineTradeConfirm
                      ) {
                        return null;
                      }
                      const Icon =
                        ACTION_ICON_BY_ID[
                          action.id as keyof typeof ACTION_ICON_BY_ID
                        ] || Compass;
                      const isRoomEndTurnEffectAction =
                        action.id === "endTurn" &&
                        Boolean(roomEndTurnEffectHint);
                      const isHauntPrimaryButton =
                        core.phase === "haunt" &&
                        action.id === "use" &&
                        !selectedInventoryCard;
                      const isHauntTargetCancelButton =
                        action.id === "cancelTarget";
                      const hauntPrimaryActionMode = isHauntTargetCancelButton
                        ? "targeting"
                        : isHauntPrimaryButton
                          ? activeHauntTargetGuide
                            ? "targeting"
                            : hauntActionContext?.actionKind === "use"
                            ? "execute"
                            : hauntActionContext
                              ? "choose-target"
                              : "unavailable"
                          : undefined;
                      const hauntPrimaryActionKind = isHauntTargetCancelButton
                        ? (previewState.hauntTargetingActionKind ?? "none")
                        : isHauntPrimaryButton
                          ? (hauntActionContext?.actionKind ?? "none")
                          : undefined;
                      const isBloodFromStoneSetupPlacementButton =
                        action.id === "bloodFromStoneSetupPlacement";
                      const isBloodFromStoneSetupConfirmButton =
                        action.id === "bloodFromStoneConfirmSetupPlacement";
                      const isRecommended =
                        action.id === core.recommendedAction ||
                        (previewState.interactionMode === "move" &&
                          action.id === "move") ||
                        (previewState.interactionMode === "monsterMove" &&
                          action.id === "monsterMove") ||
                        (previewState.interactionMode === "monsterAttack" &&
                          action.id === "monsterAttack") ||
                        (isBloodFromStoneSetupPlacementMode &&
                          isBloodFromStoneSetupPlacementButton) ||
                        (isBloodFromStoneSetupConfirmButton &&
                          !action.disabled) ||
                        (isDustSicknessExchangeMode && action.id === "trade") ||
                        action.id === "monsterTurnStart" ||
                        action.id === "monsterMovementRoll" ||
                        isRoomEndTurnEffectAction ||
                        isHauntPrimaryButton ||
                        isHauntTargetCancelButton;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                          }}
                          onPointerUp={(event) => {
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            actionHandlerMap[action.id]?.();
                          }}
                          disabled={action.disabled}
                          data-testid={
                            isHauntTargetCancelButton
                              ? "betrayal-haunt-target-cancel"
                              : `betrayal-action-${action.id}`
                          }
                          data-tutorial-id={`betrayal-action-${action.id}`}
                          data-haunt-primary-action-mode={
                            hauntPrimaryActionMode
                          }
                          data-haunt-primary-action-kind={
                            hauntPrimaryActionKind
                          }
                          data-haunt-targeting-status={
                            isHauntTargetCancelButton ||
                            (isHauntPrimaryButton && activeHauntTargetGuide)
                              ? "true"
                              : undefined
                          }
                          data-action-disabled-reason={
                            action.disabled && action.description
                              ? action.description
                              : undefined
                          }
                          title={
                            action.disabled && action.description
                              ? action.description
                              : actionCueText
                          }
                          className={`flex min-h-[48px] min-w-[80px] flex-col items-center justify-end gap-0.5 rounded-[5px] border-0 bg-transparent px-1.5 py-1 text-[13px] font-bold uppercase tracking-[0.08em] shadow-none transition ${
                            isHauntTargetCancelButton && isHauntTargetingMode
                              ? "absolute"
                              : ""
                          } ${
                            action.disabled
                              ? "cursor-not-allowed text-[#5f584d] opacity-55"
                              : isRoomEndTurnEffectAction
                                ? "text-[#ffd59a] underline decoration-[#f59e0b] decoration-2 underline-offset-4 hover:text-[#ffe6b8]"
                                : isRecommended
                                  ? "text-[#f6ffc4] underline decoration-[#f2cc79] decoration-2 underline-offset-4 hover:text-[#fbffd2]"
                                  : "text-[#ead8a8] hover:text-[#fff0ba]"
                          }`}
                          style={{
                            backgroundColor: "transparent",
                            backgroundImage: "none",
                            border: 0,
                            boxShadow: "none",
                            textShadow: action.disabled
                              ? "none"
                              : isRoomEndTurnEffectAction
                                ? "0 1px 2px rgba(0,0,0,0.9), 0 0 16px rgba(245,158,11,0.52)"
                                : isRecommended
                                  ? "0 1px 2px rgba(0,0,0,0.9), 0 0 14px rgba(238,244,168,0.48)"
                                  : "0 1px 2px rgba(0,0,0,0.88), 0 0 8px rgba(234,216,168,0.28)",
                            ...(isHauntTargetCancelButton &&
                            isHauntTargetingMode
                              ? {
                                  bottom: 0,
                                  left: "50%",
                                  position: "absolute",
                                  transform: "translateX(208px)",
                                }
                              : {}),
                          }}
                        >
                          <Icon size={20} strokeWidth={2.35} />
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          </section>

          <section
            data-testid="betrayal-status-rail"
            data-mobile-role={
              shouldShowMobileEventStatusRail
                ? "pc-isomorphic-status-rail"
                : undefined
            }
            className={`pointer-events-auto absolute z-40 w-[216px] min-h-0 flex-col gap-2 overflow-y-auto px-1 py-1 md:px-1 ${
              shouldShowMobileEventStatusRail
                ? "bottom-[76px] right-2 top-8 flex origin-top-right scale-[0.56]"
                : "bottom-3 right-3 top-3"
            } ${
              shouldShowMobileEventStatusRail
                ? ""
                : isPhoneLandscapeLayout ||
                    shouldHideTableChromeForBlockingOverlay
                  ? "hidden"
                  : `flex ${activeHauntTargetGuide ? "opacity-[0.72]" : ""}`
            }`}
          >
            <article
              id="betrayal-decks-section"
              className="relative ml-auto w-full max-w-[198px] overflow-visible bg-transparent px-0 pb-2 pt-3"
            >
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.32))]" />
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#c4a265]">
                  {t("board.sections.decks")}
                </div>
                <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(196,162,101,0.32),transparent)]" />
              </div>
              <ResourceTraySkeleton
                items={deckItems}
                canInteract={false}
                layout="column"
                className="mt-3 grid grid-cols-3 gap-2.5"
                renderItem={(item) => {
                  const isHighlighted =
                    item.id === `deck-${core.highlightedDeckKind}`;
                  const deckTiltClass =
                    item.kind === "omen"
                      ? "-rotate-[1.25deg]"
                      : item.kind === "item"
                        ? "rotate-[0.85deg]"
                        : "-rotate-[0.55deg]";
                  return (
                    <div className="relative pt-2 text-center">
                      <span className="pointer-events-none absolute left-1/2 top-[10px] h-[122px] w-[70%] -translate-x-1/2 translate-x-[2px] bg-[rgba(12,10,8,0.18)]" />
                      <span className="pointer-events-none absolute left-1/2 top-[6px] h-[122px] w-[70%] -translate-x-1/2 -translate-x-[2px] bg-[rgba(18,14,11,0.16)]" />
                      <div
                        className={`relative overflow-hidden bg-[rgba(28,20,15,0.34)] shadow-[0_10px_18px_rgba(0,0,0,0.16)] ${deckTiltClass} ${
                          isHighlighted
                            ? "shadow-[0_0_0_1px_rgba(210,171,97,0.38),0_10px_20px_rgba(0,0,0,0.2)]"
                            : ""
                        }`}
                      >
                        <OptimizedImage
                          src={item.asset}
                          locale={effectiveLocale}
                          alt={item.label}
                          className="h-[124px] w-full object-cover"
                          draggable={false}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.9))] px-2 py-2">
                          <div className="truncate text-[8px] uppercase tracking-[0.12em] text-[#d8c596]">
                            {item.label}
                          </div>
                        </div>
                      </div>
                      <div
                        data-resource-count-shape="square"
                        className="-mt-2.5 inline-flex h-9 min-w-9 items-center justify-center rounded-[6px] border border-[#6f5933] bg-[radial-gradient(circle_at_35%_25%,rgba(229,210,174,0.14),rgba(21,18,14,0.92))] px-2 text-[20px] font-semibold text-[#e3d2ae] shadow-[0_6px_12px_rgba(0,0,0,0.16)]"
                      >
                        {item.count}
                      </div>
                    </div>
                  );
                }}
              />

              <div
                data-testid="betrayal-haunt-risk-status"
                data-tutorial-id="betrayal-haunt-risk-status"
                data-haunt-started={hauntRisk.hauntStarted ? "true" : "false"}
                data-omen-count={hauntRisk.omenCount}
                data-next-dice-count={hauntRisk.nextRollDiceCount}
                data-threshold={hauntRisk.threshold}
                data-next-omen-automatic={
                  hauntRisk.nextOmenAutomatic ? "true" : "false"
                }
                title={hauntRiskDetailText}
                aria-label={hauntRiskDetailText}
                className="mt-3 rounded-[7px] border border-[rgba(169,42,46,0.42)] bg-[linear-gradient(180deg,rgba(72,20,24,0.44),rgba(18,12,12,0.60))] px-2.5 py-2 shadow-[0_10px_18px_rgba(0,0,0,0.14)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-black uppercase tracking-[0.08em] text-[#d99a72]">
                    {t("board.status.hauntRiskLabel")}
                  </span>
                  <span className="rounded-[4px] border border-[rgba(245,211,137,0.20)] bg-[rgba(245,211,137,0.08)] px-1.5 py-0.5 text-[12px] font-bold leading-none text-[#f7df9d]">
                    {hauntRisk.hauntStarted
                      ? t("board.status.hauntRiskPhaseHaunt")
                      : t("board.status.hauntRiskPhasePreHaunt")}
                  </span>
                </div>
                <div className="mt-1 text-[12px] font-semibold leading-snug text-[#f4e8c6]">
                  {hauntRiskText}
                </div>
                <div
                  data-testid="betrayal-haunt-risk-progress"
                  data-number-track-id={hauntRiskTrack?.id ?? "haunt-risk"}
                  data-track-min={hauntRiskTrackMin}
                  data-track-max={hauntRiskTrackMax}
                  data-current-omen-count={hauntRisk.omenCount}
                  data-track-value={hauntRiskTrackValue}
                  data-progress-percent={hauntRiskTrackPositionPercent}
                  data-track-position-percent={hauntRiskTrackPositionPercent}
                  data-current-display="material-slot-highlight"
                  data-haunt-risk-style="official-asset-track"
                  data-haunt-risk-track-shape="material-0-9-bar"
                  role="progressbar"
                  aria-label={hauntRiskDetailText}
                  aria-valuemin={hauntRiskTrackMin}
                  aria-valuemax={hauntRiskTrackMax}
                  aria-valuenow={hauntRiskTrackValue}
                  className="relative mt-2 w-full overflow-visible rounded-[7px]"
                >
                  <div
                    aria-hidden="true"
                    className="relative min-h-[36px] w-full overflow-hidden rounded-[7px] shadow-[0_8px_16px_rgba(0,0,0,0.22)]"
                    style={{ aspectRatio: "1794 / 349" }}
                  >
                    <OptimizedImage
                      data-testid="betrayal-haunt-risk-track-image"
                      data-haunt-risk-track-image="official-0-9"
                      src={ASSETS.ui.hauntRiskTrack}
                      locale={effectiveLocale}
                      alt=""
                      className="absolute inset-0 h-full w-full object-fill"
                      draggable={false}
                    />
                    <div
                      data-haunt-risk-slot-grid="true"
                      className="absolute inset-0 grid"
                      style={{
                        gridTemplateColumns: `repeat(${hauntRiskTrackSlots.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {hauntRiskTrackSlots.map((slot) => {
                        const isCurrentSlot = slot === hauntRiskTrackValue;
                        return (
                          <span
                            key={`haunt-risk-slot-${slot}`}
                            data-testid="betrayal-haunt-risk-slot"
                            data-haunt-risk-slot={slot}
                            data-haunt-risk-segment="true"
                            data-haunt-risk-current-slot={
                              isCurrentSlot ? "true" : "false"
                            }
                            data-haunt-risk-cell="true"
                            data-haunt-risk-current-cell={
                              isCurrentSlot ? "true" : "false"
                            }
                            className={`min-w-0 rounded-[4px] transition-[background-color,box-shadow] duration-200 ${
                              isCurrentSlot
                                ? "bg-[rgba(103,185,93,0.30)] shadow-[inset_0_0_0_2px_rgba(213,255,153,0.82),0_0_14px_rgba(103,185,93,0.52)]"
                                : "bg-transparent shadow-none"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.24))]" />
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#c4a265]">
                  {t("board.sections.discard")}
                </div>
                <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(196,162,101,0.24),transparent)]" />
              </div>
              <ResourceTraySkeleton
                items={discardItems}
                canInteract={false}
                layout="column"
                className="mt-3 grid grid-cols-3 gap-2.5"
                renderItem={(item) => (
                  <div className="relative pt-1 text-center">
                    <span className="pointer-events-none absolute left-1/2 top-[8px] h-[94px] w-[70%] -translate-x-1/2 translate-x-[2px] bg-[rgba(16,13,11,0.12)]" />
                    <div
                      className="relative overflow-hidden bg-[rgba(31,23,18,0.28)] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                      title={
                        item.count > 0
                          ? t("board.decks.faceUp")
                          : t("board.decks.emptySlot")
                      }
                    >
                      <OptimizedImage
                        src={item.asset}
                        locale={effectiveLocale}
                        alt={item.label}
                        className={`h-[96px] w-full object-cover ${item.count === 0 ? "grayscale opacity-22" : "opacity-38"}`}
                        draggable={false}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-[#c5b693]">
                      {item.count}
                    </div>
                  </div>
                )}
              />
            </article>

            <article className="bg-transparent pt-1">
              <div className="mt-0.5 flex justify-start gap-1.5">
                {!isPhoneLandscapeLayout &&
                !shouldHideTableChromeForBlockingOverlay ? (
                  <button
                    type="button"
                    onClick={openScenarioReference}
                    data-testid="betrayal-open-scenario"
                    data-tutorial-id="betrayal-open-scenario"
                    className={`inline-flex h-[40px] min-w-[84px] items-center gap-1.5 rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] px-2.5 text-[#d8bf81] transition hover:border-[#8b744d] ${
                      activeHauntTargetGuide ? "opacity-[0.72]" : ""
                    }`}
                    aria-label={scenarioReferenceAccessibleLabel}
                    title={scenarioReferenceAccessibleLabel}
                  >
                    <BookOpen size={15} />
                    <span className="text-[11px] font-semibold tracking-[0.06em]">
                      {scenarioReferenceButtonLabel}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openReferenceCards}
                  data-testid="betrayal-open-reference"
                  data-tutorial-id="betrayal-reference-entry"
                  className="inline-flex h-[40px] min-w-[72px] items-center gap-1.5 rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] px-2.5 text-[#d8bf81] transition hover:border-[#8b744d]"
                  title={t("board.reference.button")}
                >
                  <BookOpen size={15} />
                  <span className="text-[11px] font-semibold tracking-[0.06em]">
                    {t("board.reference.button")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleFocusSelfRoom}
                  data-testid="betrayal-focus-self-room"
                  data-tutorial-id="betrayal-focus-self-room"
                  data-room-focus-action="self-room"
                  data-room-focus-target-id={core.currentExplorer.roomId}
                  data-room-focus-icon="locate-fixed"
                  className="grid h-[40px] w-[40px] place-items-center rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] text-[#d8bf81] transition hover:border-[#8b744d]"
                  title={t("board.rooms.focusSelf")}
                  aria-label={t("board.rooms.focusSelf")}
                >
                  <LocateFixed size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 hidden xl:block">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.18))]" />
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89d84]">
                    {t("board.hud.teammatesLabel")}
                  </div>
                </div>
                <div className="mt-2 grid gap-1.5">
                  {core.otherExplorers.map((explorer) => {
                    const isTradeCandidate = activeTradeTargets.some(
                      (item) => item.playerId === explorer.playerId,
                    );
                    const isCorpseLootCandidate = corpseLootTargets.some(
                      (item) => item.playerId === explorer.playerId,
                    );
                    const isDustTarget = dustTargetPlayerIds.has(
                      explorer.playerId,
                    );
                    const isSicknessExchangeTarget =
                      isDustSicknessExchangeMode && isDustTarget;
                    const isMagicCameraPhotoTarget =
                      magicCameraPhotoTargetPlayerIds.has(explorer.playerId);
                    const isPhantomPhotographerTarget =
                      phantomPhotographerTargetPlayerIds.has(explorer.playerId);
                    const isMonsterAttackTarget =
                      selectedMonsterAttackTargetPlayerIds.has(
                        explorer.playerId,
                      );
                    const isHelpingHandsTrollHandTarget =
                      helpingHandsTrollHandAttackTargetPlayerIds.has(
                        explorer.playerId,
                      );
                    const isAttackTarget =
                      (isHeroAttackTargetingMode &&
                        heroAttackTargetPlayerIds.has(explorer.playerId)) ||
                      isMagicCameraPhotoTarget ||
                      isMonsterAttackTarget ||
                      isHelpingHandsTrollHandTarget ||
                      (isDustAttackTargetingMode && isDustTarget);
                    const isSelectedAttackTarget =
                      isHeroAttackTargetingMode &&
                      hauntActionContext?.actionKind === "attack-hero" &&
                      hauntActionContext.targetPlayerId === explorer.playerId;
                    const isSelectedTradeTarget =
                      explorer.playerId === selectedTradeTargetPlayerId ||
                      explorer.playerId === selectedCorpseLootTargetPlayerId ||
                      (previewState.selectedTradeTargetPlayerId ===
                        explorer.playerId &&
                        (isMagicCameraPhotoTarget ||
                          isMonsterAttackTarget ||
                          isHelpingHandsTrollHandTarget ||
                          isDustTarget)) ||
                      isSelectedAttackTarget ||
                      (isSicknessExchangeTarget &&
                        explorer.playerId === selectedDustTargetPlayerId);
                    const isSameRoom =
                      core.currentExplorer.roomId === explorer.roomId;
                    const isDogTradeTarget = dogTradeTargets.some(
                      (item) => item.playerId === explorer.playerId,
                    );
                    const isPassiveSameRoomCue =
                      isTradeCandidate &&
                      isSameRoom &&
                      !isCorpseLootCandidate &&
                      !isSicknessExchangeTarget &&
                      !isMagicCameraPhotoTarget &&
                      !isPhantomPhotographerTarget &&
                      !isMonsterAttackTarget &&
                      !isHelpingHandsTrollHandTarget &&
                      !isDustTarget &&
                      !isAttackTarget &&
                      !isDogTradeTarget;
                    const isObservedExplorer =
                      observedExplorer.playerId === explorer.playerId;
                    const roomName =
                      core.rooms.find((room) => room.id === explorer.roomId)
                        ?.name || t("board.rooms.unknown");
                    return (
                      <button
                        key={`sidebar-teammate-${explorer.playerId}`}
                        type="button"
                        onClick={() => {
                          if (isAttackTarget || isSicknessExchangeTarget) {
                            handleSelectExplorerTarget(explorer);
                            return;
                          }
                          handleObserveExplorer(explorer.playerId);
                        }}
                        data-testid={`betrayal-bottom-teammate-${explorer.playerId}`}
                        data-tutorial-id={`betrayal-bottom-teammate-${explorer.playerId}`}
                        data-player-id={explorer.playerId}
                        data-player-seat-anchor={explorer.playerId}
                        data-explorer-id={explorer.explorerId}
                        data-room-id={explorer.roomId}
                        data-observed-player={
                          isObservedExplorer ? "true" : "false"
                        }
                        className={`group pointer-events-auto relative grid grid-cols-[34px_minmax(0,1fr)] items-start gap-2 rounded-[8px] border px-1.5 py-1.5 text-left transition ${
                          isSelectedTradeTarget
                            ? "border-[#eecc7e] bg-[linear-gradient(180deg,rgba(53,40,20,0.72),rgba(22,19,14,0.82))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_18px_rgba(238,204,126,0.34)]"
                            : (isTradeCandidate && !isPassiveSameRoomCue) ||
                                isCorpseLootCandidate ||
                                isAttackTarget
                              ? "border-[rgba(118,189,153,0.46)] bg-[rgba(12,18,15,0.20)] hover:bg-[rgba(28,24,19,0.5)] hover:border-[rgba(159,225,167,0.64)]"
                              : isObservedExplorer
                                ? "border-[rgba(224,189,114,0.62)] bg-[rgba(55,38,21,0.44)] shadow-[0_0_0_1px_rgba(24,17,8,0.80),0_0_15px_rgba(224,189,114,0.22)]"
                                : "border-transparent hover:bg-[rgba(28,24,19,0.5)]"
                        }`}
                        title={`切换观察视角：${resolvePlayerName(
                          explorer.playerId,
                          explorer.displayName,
                          matchData,
                        )}`}
                        aria-label={`切换观察视角：${resolvePlayerName(
                          explorer.playerId,
                          explorer.displayName,
                          matchData,
                        )}`}
                      >
                        <div
                          className={`relative h-[34px] w-[34px] overflow-visible rounded-[6px] border ${
                            (isTradeCandidate && !isPassiveSameRoomCue) ||
                            isCorpseLootCandidate ||
                            isSicknessExchangeTarget ||
                            isAttackTarget
                              ? "border-[rgba(118,189,153,0.42)]"
                              : "border-[rgba(117,98,68,0.34)]"
                          } bg-[rgba(12,14,13,0.62)]`}
                        >
                          <span className="block h-full w-full overflow-hidden rounded-[6px]">
                            <OptimizedImage
                              src={explorer.portraitAsset}
                              locale={effectiveLocale}
                              alt={explorer.displayName}
                              className="h-full w-full object-contain"
                              draggable={false}
                            />
                          </span>
                          <span
                            className={`pointer-events-none absolute inset-0 rounded-[6px] ring-1 ${
                              isObservedExplorer
                                ? "ring-[rgba(224,189,114,0.54)]"
                                : "ring-transparent"
                            }`}
                          />
                          {isObservedExplorer ? (
                            <span
                              data-testid={`betrayal-bottom-teammate-observed-${explorer.playerId}`}
                              className="pointer-events-none absolute -right-1 -top-1 z-20 grid h-[18px] w-[18px] place-items-center rounded-full border border-[rgba(224,189,114,0.72)] bg-[rgba(20,14,8,0.92)] text-[#f5d993] shadow-[0_4px_9px_rgba(0,0,0,0.34)]"
                              aria-hidden="true"
                            >
                              <Eye size={10} />
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-[11px] font-medium tracking-[0.04em] text-[#efe5cf]">
                              {resolvePlayerName(
                                explorer.playerId,
                                explorer.displayName,
                                matchData,
                              )}
                            </div>
                            {isTradeCandidate ||
                            isCorpseLootCandidate ||
                            isSicknessExchangeTarget ||
                            isAttackTarget ? (
                              <span
                                data-player-status-tone={
                                  isSelectedTradeTarget
                                    ? "selected"
                                    : isPassiveSameRoomCue
                                      ? "neutral"
                                      : "target"
                                }
                                className={`shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[9px] ${
                                  isSelectedTradeTarget
                                    ? "border-[#eecc7e] bg-[rgba(238,204,126,0.18)] text-[#ffe4a0]"
                                    : isPassiveSameRoomCue
                                      ? "border-[rgba(117,98,68,0.44)] bg-[rgba(28,24,19,0.54)] text-[#c9bda1]"
                                    : "border-[rgba(118,189,153,0.30)] bg-[rgba(40,63,50,0.18)] text-[#bddac2]"
                                }`}
                              >
                                {isSicknessExchangeTarget
                                  ? t("board.status.sicknessExchangeShort")
                                  : isMagicCameraPhotoTarget
                                    ? t("board.actions.takePhoto")
                                    : isPhantomPhotographerTarget
                                      ? t(
                                          "board.actions.phantomPhotographerAttack",
                                        )
                                      : isAttackTarget
                                        ? t("board.actions.attack")
                                        : isCorpseLootCandidate
                                          ? t("board.players.corpse")
                                          : isSameRoom
                                            ? t("board.players.sameRoom")
                                            : isDogTradeTarget
                                              ? t("board.inventory.dog")
                                            : t("board.players.tradeTarget")}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-[#b7aa92]">
                            {roomName}
                          </div>
                          {core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(
                            explorer.playerId,
                          ) ? (
                            <div
                              className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#c5df6b]"
                              data-testid={`betrayal-bottom-teammate-knowledge-${explorer.playerId}`}
                            >
                              {t("board.players.knowledgeOfJack")}
                            </div>
                          ) : null}
                          <div className="mt-1 flex items-center gap-1">
                            {(
                              [
                                "might",
                                "speed",
                                "knowledge",
                                "sanity",
                              ] as BetrayalTraitKey[]
                            ).map((key) => (
                              <span
                                key={`${explorer.playerId}-${key}`}
                                data-trait-value-shape="square"
                                className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-[rgba(21,18,14,0.84)] px-1 text-[9px] font-semibold ${TRAIT_VALUE_TEXT_CLASS[key]}`}
                                title={`${TRAIT_LABEL_LOCAL[key]} ${explorer.traits[key]}`}
                              >
                                {explorer.traits[key]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sr-only" data-testid="betrayal-activity-list">
                {earlierLogEntries.length > 0 ? (
                  earlierLogEntries.map((entry) => (
                    <span key={entry.id}>{entry.text}</span>
                  ))
                ) : (
                  <span>{t("board.activity.earlierEmpty")}</span>
                )}
              </div>
            </article>
          </section>
        </main>

        <MagnifyOverlay
          isOpen={referenceOpen || scenarioReaderOpen}
          onClose={closeReferenceOverlay}
          overlayTestId={
            scenarioReaderOpen
              ? "betrayal-scenario-reader-dialog"
              : "betrayal-reference-overlay"
          }
          overlayClassName={
            scenarioReaderOpen && isReferenceScenarioOpeningStage
              ? "bg-[rgba(0,0,0,0.58)] p-0 backdrop-blur-[1px]"
              : "bg-[rgba(3,6,5,0.82)] p-3 md:p-6"
          }
          containerClassName="rounded-none overflow-visible bg-transparent"
          zIndex={
            scenarioReaderOpen
              ? SCENARIO_READER_MODAL_Z_INDEX
              : UI_Z_INDEX.magnify
          }
        >
          <div
            className="pointer-events-auto relative"
            style={
              scenarioReaderOpen
                ? isReferenceScenarioOpeningStage
                  ? {
                      width: "100vw",
                      height: "100vh",
                    }
                  : {
                      width: isPhoneLandscapeLayout
                        ? "min(96vw, 900px)"
                        : SCENARIO_REFERENCE_BOOK_FRAME_WIDTH,
                      height: isPhoneLandscapeLayout
                        ? "min(94vh, 420px)"
                        : SCENARIO_REFERENCE_BOOK_FRAME_HEIGHT,
                    }
                : {
                    width: REFERENCE_CARD_FRAME_WIDTH,
                    aspectRatio: `${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO} / 1`,
                  }
            }
          >
            {!scenarioReaderOpen ? (
              <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleReferenceSide}
                  data-testid="betrayal-reference-toggle"
                  className="inline-flex items-center gap-1 rounded-[5px] bg-[rgba(9,13,12,0.84)] px-3 py-1.5 text-xs font-medium text-[#f3e0b4] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.92)]"
                >
                  <ChevronRight size={14} />
                  <span>{t("board.reference.toggle")}</span>
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={closeReferenceOverlay}
              data-testid={
                scenarioReaderOpen
                  ? "betrayal-scenario-reader-close"
                  : "betrayal-reference-close"
              }
              className="pointer-events-auto absolute right-3 top-3 z-50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[5px] bg-[rgba(9,13,12,0.84)] px-4 text-[12px] font-medium text-[#f3e0b4] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.92)]"
            >
              {scenarioReaderOpen
                ? t("board.characterSelect.hideScenarioDetails")
                : t("board.reference.close")}
            </button>
            {scenarioReaderOpen ? (
              <div
                data-testid="betrayal-scenario-objective-page"
                data-reference-page="scenario"
                data-scenario-reader-scope={scenarioReaderScope}
                  className={`relative flex h-full w-full flex-col overflow-hidden text-[#f3e0b4] ${
                    isReferenceScenarioOpeningStage
                      ? "border border-transparent bg-transparent p-0 shadow-none"
                      : `border border-[#7b633d] bg-[linear-gradient(180deg,rgba(31,24,15,0.98),rgba(10,12,9,0.98))] shadow-[0_24px_56px_rgba(0,0,0,0.44)] ${isPhoneLandscapeLayout ? "p-3" : "p-5"}`
                  }`}
              >
                <div
                  className={`flex items-start justify-between gap-4 border-b border-[rgba(211,179,109,0.24)] pr-32 ${
                    isReferenceScenarioOpeningStage
                      ? "sr-only"
                      : isPhoneLandscapeLayout
                        ? "pb-2"
                        : "pb-3"
                  }`}
                >
                  <div>
                    <div
                      className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#c9a35e]"
                    >
                      {activeHauntCaseLabel}
                    </div>
                    <div
                      className={`${isPhoneLandscapeLayout ? "text-[18px]" : "mt-1 text-[24px]"} font-bold tracking-[0.04em] text-[#fff0b8]`}
                    >
                      {activeHauntTitle}
                    </div>
                  </div>
                  <div className="rounded-[4px] border border-[rgba(211,179,109,0.22)] bg-[rgba(8,11,9,0.48)] px-3 py-1.5 text-right text-[12px] font-semibold text-[#d5c5a2]">
                    <span
                      data-testid="betrayal-scenario-reader-role"
                      className="block text-[12px] uppercase tracking-[0.12em] text-[#c9a35e]"
                    >
                      {scenarioReaderScopeLabel}
                    </span>
                    <span data-testid="betrayal-scenario-reader-header-progress">
                      {referenceScenarioSpreadIndex + 1}/
                      {referenceScenarioSpreadCount}
                    </span>
                  </div>
                </div>
                <div
                  data-testid={
                    isReferenceScenarioOpeningStage
                      ? "betrayal-scenario-opening-stage"
                      : "betrayal-scenario-book"
                  }
                  className={`relative min-h-0 flex-1 overflow-hidden ${
                    isReferenceScenarioOpeningStage
                      ? "mt-0"
                      : `grid grid-cols-2 ${isPhoneLandscapeLayout ? "mt-2 gap-2" : "mt-4 gap-3"}`
                  }`}
                >
                  {isReferenceScenarioOpeningStage &&
                  referenceScenarioOpeningSection ? (
                    <CinematicNarrationPanel
                      testId="betrayal-scenario-opening-cinematic"
                      label={t(referenceScenarioOpeningSection.labelKey)}
                      title={activeHauntTitle}
                      text={t(referenceScenarioOpeningSection.bodyKey)}
                      variant="opening"
                      presentation="stage"
                      compact={isPhoneLandscapeLayout}
                      actionSlot={
                        <>
                          <span
                            data-testid="betrayal-scenario-reader-footer-progress"
                            className="sr-only"
                          >
                            {referenceScenarioSpreadIndex + 1}/
                            {referenceScenarioSpreadCount}
                          </span>
                          <button
                            type="button"
                            data-testid="betrayal-scenario-reader-next-zone"
                            onClick={() =>
                              handleReferenceScenarioTurn("forward")
                            }
                            disabled={!canTurnReferenceScenarioForward}
                            className="inline-flex min-h-11 min-w-[144px] items-center justify-center gap-2 border border-[rgba(242,207,130,0.42)] bg-[rgba(8,10,9,0.82)] px-6 text-[12px] font-black uppercase tracking-[0.22em] text-[#f5e6c7] shadow-[0_16px_38px_rgba(0,0,0,0.58)] transition hover:border-[#f2cf82] hover:bg-[rgba(18,20,16,0.92)] disabled:opacity-35"
                          >
                            {t("board.scenario.readerContinue")}
                            <ChevronRight size={16} aria-hidden="true" />
                          </button>
                        </>
                      }
                      className="h-full min-h-full"
                    />
                  ) : (
                    <>
                      <ScenarioBookTurnSheet
                        direction={referenceScenarioTurnDirection}
                        fromPages={
                          referenceScenarioTurnSnapshot?.fromPages ?? [null, null]
                        }
                        toPages={
                          referenceScenarioTurnSnapshot?.toPages ?? [null, null]
                        }
                        title={activeHauntTitle}
                        isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                        onTurnComplete={() => {
                          setReferenceScenarioTurnDirection(null);
                          setReferenceScenarioTurnSnapshot(null);
                        }}
                      />
                      {[
                        referenceScenarioLeftPage,
                        referenceScenarioRightPage,
                      ].map(
                    (page, sideIndex) => (
                      <section
                        key={page?.id ?? `blank-${sideIndex}`}
                        data-testid={
                          page
                            ? `betrayal-scenario-book-page-${page.id}`
                            : `betrayal-scenario-book-page-blank-${sideIndex}`
                        }
                        className={`relative min-h-0 overflow-hidden border border-[#c7a06b] bg-[radial-gradient(circle_at_48%_18%,rgba(255,243,204,0.94),rgba(229,200,151,0.98)_58%,rgba(205,164,102,0.98)_100%)] text-[#3b2211] shadow-[inset_0_0_0_1px_rgba(255,246,215,0.36),inset_0_0_42px_rgba(95,54,19,0.18)] ${isPhoneLandscapeLayout ? "p-3" : "p-6"}`}
                      >
                        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(0deg,rgba(92,55,24,0.08)_0_1px,transparent_1px_8px),radial-gradient(circle_at_18%_22%,rgba(88,49,18,0.12),transparent_18%),radial-gradient(circle_at_80%_70%,rgba(96,55,21,0.10),transparent_22%)]" />
                        {page ? (
                          <div className="relative flex h-full flex-col">
                            <div
                              data-testid={
                                sideIndex === 0
                                  ? "betrayal-scenario-reader-page-label-desktop-left"
                                  : "betrayal-scenario-reader-page-label-desktop-right"
                              }
                              className="absolute left-0 top-0 text-[12px] font-bold tracking-[0.14em] text-[#86643f]"
                            >
                              {String(page.pageNumber).padStart(2, "0")}
                            </div>
                            <div
                              data-testid="betrayal-scenario-reader-body-scroll"
                              className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1"
                            >
                              <div
                                className={`grid min-h-full content-center ${isPhoneLandscapeLayout ? "gap-2 py-5" : "gap-6 px-3 py-10"}`}
                              >
                                {(page.sections ?? []).map((section) => {
                                  const isCinematicSection =
                                    SCENARIO_READER_CINEMATIC_SECTION_IDS.has(
                                      section.id,
                                    );

                                  return (
                                    <section
                                      key={section.id}
                                      data-testid={`betrayal-scenario-book-section-${section.id}`}
                                      data-cinematic-narration={
                                        isCinematicSection
                                          ? "opening"
                                          : undefined
                                      }
                                      className={
                                        isCinematicSection
                                          ? "min-h-[250px]"
                                          : `border-l-4 ${isPhoneLandscapeLayout ? "pl-2" : "pl-4"} ${section.accentClass}`
                                      }
                                    >
                                      {isCinematicSection ? (
                                        <CinematicNarrationPanel
                                          label={t(section.labelKey)}
                                          text={t(section.bodyKey)}
                                          variant="opening"
                                          compact={isPhoneLandscapeLayout}
                                          className={
                                            isPhoneLandscapeLayout
                                              ? "min-h-[232px]"
                                              : "min-h-[390px]"
                                          }
                                        />
                                      ) : (
                                        <>
                                          <h3
                                            className={`${isPhoneLandscapeLayout ? "text-[14px]" : "text-[22px]"} font-black tracking-[0.03em] text-[#3b2211]`}
                                          >
                                            {t(section.labelKey)}
                                          </h3>
                                          <p
                                            className={`${isPhoneLandscapeLayout ? "mt-1 text-[12px] leading-[1.45]" : "mt-3 text-[14px] leading-[1.6]"} whitespace-pre-line font-medium text-[#4e321c]`}
                                          >
                                            {t(section.bodyKey)}
                                          </p>
                                        </>
                                      )}
                                    </section>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </section>
                    ),
                  )}
                    </>
                  )}
                </div>
                {isReferenceScenarioOpeningStage ? null : (
                  <div
                    className={`flex items-center justify-between border-t border-[rgba(211,179,109,0.24)] text-[12px] font-semibold text-[#d5c5a2] ${isPhoneLandscapeLayout ? "mt-2 pt-2" : "mt-3 pt-3"}`}
                  >
                    <button
                      type="button"
                      data-testid="betrayal-scenario-reader-prev-zone"
                      onClick={() => handleReferenceScenarioTurn("back")}
                      disabled={!canTurnReferenceScenarioBack}
                      className="inline-flex min-h-11 min-w-[112px] items-center justify-center gap-2 rounded-[5px] border border-[rgba(211,179,109,0.22)] bg-[rgba(9,13,12,0.84)] px-4 text-[#f3e0b4] transition hover:bg-[rgba(22,31,27,0.92)] disabled:opacity-35 disabled:hover:bg-[rgba(9,13,12,0.84)]"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                      {t("board.scenario.readerPrev")}
                    </button>
                    <span
                      data-testid="betrayal-scenario-reader-footer-progress"
                      className="sr-only"
                    >
                      {referenceScenarioSpreadIndex + 1}/
                      {referenceScenarioSpreadCount}
                    </span>
                    <button
                      type="button"
                      data-testid="betrayal-scenario-reader-next-zone"
                      onClick={() => handleReferenceScenarioTurn("forward")}
                      disabled={!canTurnReferenceScenarioForward}
                      className="inline-flex min-h-11 min-w-[112px] items-center justify-center gap-2 rounded-[5px] border border-[rgba(211,179,109,0.22)] bg-[rgba(9,13,12,0.84)] px-4 text-[#f3e0b4] transition hover:bg-[rgba(22,31,27,0.92)] disabled:opacity-35 disabled:hover:bg-[rgba(9,13,12,0.84)]"
                    >
                      {t("board.scenario.readerNext")}
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <OptimizedImage
                src={currentReferencePage.asset ?? ASSETS.playerReference.front}
                locale={effectiveLocale}
                alt={t(`board.reference.${currentReferencePage.id}`)}
                data-testid="betrayal-reference-card-image"
                data-asset-src={currentReferencePage.asset}
                className="h-full w-full object-contain shadow-[0_24px_56px_rgba(0,0,0,0.44)]"
                draggable={false}
              />
            )}
          </div>
        </MagnifyOverlay>

        <MagnifyOverlay
          isOpen={Boolean(previewRoom && previewRoomVisual)}
          onClose={() => setRoomPreviewId(null)}
          overlayTestId="betrayal-room-preview-overlay"
          overlayClassName="bg-[rgba(3,6,5,0.76)] p-4 md:p-6"
          containerClassName="rounded-none overflow-visible bg-transparent"
          closeLabel={t("board.reference.close")}
          closeButtonClassName="!top-2 !right-2 !min-h-11 !min-w-[72px] !border !border-[rgba(238,204,126,0.55)] !bg-[rgba(18,15,12,0.90)] !text-[#f3dfab] !opacity-100 shadow-[0_8px_18px_rgba(0,0,0,0.36)]"
        >
          {previewRoom && previewRoomVisual ? (
            <button
              type="button"
              data-testid="betrayal-room-preview-card"
              aria-label={t("board.reference.close")}
              className="pointer-events-auto block max-h-[92vh] max-w-[92vw] cursor-zoom-out border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#f4cf77] focus-visible:ring-offset-2 focus-visible:ring-offset-[#030605]"
              onClick={() => setRoomPreviewId(null)}
            >
              <span className="sr-only">
                {t("board.rooms.preview")} {previewRoom.name}
              </span>
              <RoomTileSprite
                visual={previewRoomVisual}
                locale={effectiveLocale}
                alt={previewRoom.name}
                className="aspect-square h-[min(92vh,92vw)] w-[min(92vh,92vw)] max-h-[92vh] max-w-[92vw] drop-shadow-[0_26px_70px_rgba(0,0,0,0.55)]"
              />
            </button>
          ) : null}
        </MagnifyOverlay>

        <MagnifyOverlay
          isOpen={Boolean(previewInventoryCard)}
          onClose={() => setInventoryPreviewCardId(null)}
          overlayTestId="betrayal-inventory-preview-overlay"
          overlayClassName="bg-[rgba(3,6,5,0.74)] p-4 md:p-6"
          containerClassName="rounded-none overflow-visible bg-transparent"
          closeLabel={t("board.reference.close")}
        >
          {previewInventoryCard ? (
            <div
              className="pointer-events-auto relative cursor-zoom-out"
              onClick={() => setInventoryPreviewCardId(null)}
              style={{
                width: inventoryPreviewFrameWidth,
                aspectRatio: `${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO} / 1`,
              }}
            >
              <div className="pointer-events-none">
                {renderInventoryCard(previewInventoryCard, {
                  layout: "preview",
                  testId: "betrayal-inventory-preview-card",
                })}
              </div>
            </div>
          ) : null}
        </MagnifyOverlay>

        {(!activeHauntTargetGuide &&
          core.recommendedAction === "trade" &&
          !pendingTradeAgreement &&
          !pendingSicknessExchange &&
          !mummyPendingReward &&
          !helpingHandsPendingReward &&
          !isDustSicknessExchangeMode &&
          !shouldShowInlineTradeConfirm) ||
        isEndgameExorciseRollReview ||
        (isPhoneLandscapeLayout && pendingEventFocusesMapTarget) ||
        shouldHideTableChromeForBlockingOverlay ? null : (
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${
              isPhoneLandscapeLayout ? "block" : "md:hidden"
            } ${
              isPhoneLandscapeLayout
                ? "px-1.5 pb-[calc(var(--safe-area-bottom)+0.2rem)]"
                : "px-3 pb-[calc(var(--safe-area-bottom)+0.75rem)]"
            }`}
          >
            <div
              data-testid="betrayal-mobile-action-rail"
              data-mobile-role={
                isPhoneLandscapeLayout ? "native-action-rail" : undefined
              }
              className={`pointer-events-auto ${
                isPhoneLandscapeLayout
                  ? "min-h-[56px] border-0 bg-transparent p-0 shadow-none"
                  : "rounded-[18px] border border-[#5f4d31] bg-[rgba(14,20,18,0.92)] p-2 shadow-[0_16px_32px_rgba(0,0,0,0.34)] backdrop-blur-sm"
              }`}
              style={isPhoneLandscapeLayout ? { minHeight: 56 } : undefined}
            >
              <div
                className={`${isPhoneLandscapeLayout ? "grid grid-cols-1 items-stretch gap-1.5" : "mb-2 flex items-center gap-2"}`}
              >
                {isPhoneLandscapeLayout ? (
                  <div
                    className="sr-only"
                    data-testid="betrayal-mobile-a11y-status"
                  >
                    <span data-testid="betrayal-mobile-selected-card">
                      {selectedInventoryDisplayText}
                    </span>
                    <span data-testid="betrayal-mobile-use-status">
                      {useStatusText}
                    </span>
                    {shouldShowBoardActionStatus &&
                    shouldShowMobileTradeStatus ? (
                      <span data-testid="betrayal-mobile-trade-status">
                        {tradeStatusText}
                      </span>
                    ) : null}
                    {shouldShowBoardActionStatus ? (
                      <span data-testid="betrayal-mobile-action-cue">
                        {actionCueText}
                      </span>
                    ) : null}
                    {visibleDustProgressItems.length > 0 ? (
                      <span data-testid="betrayal-mobile-dust-progress-status">
                        {activeHauntCaseLabel} {activeHauntTitle}{" "}
                        {visibleDustProgressItems
                          .map((item) => `${item.label} ${item.value}`)
                          .join(" ")}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[#a89d84]">
                      {t("board.mobile.selectedLabel")}
                    </div>
                    <div
                      className="truncate text-sm font-medium text-[#f3ead6]"
                      data-testid="betrayal-mobile-selected-card"
                    >
                      {selectedInventoryDisplayText}
                    </div>
                    <div
                      className={`mt-1 truncate text-[11px] ${selectedCardUseDisabled ? "text-[#f0c1a2]" : "text-[#8db29a]"}`}
                      data-testid="betrayal-mobile-use-status"
                    >
                      {useStatusText}
                    </div>
                    {shouldShowBoardActionStatus &&
                    shouldShowMobileTradeStatus ? (
                      <div
                        className={`mt-1 truncate text-[11px] ${
                          pendingTradeAgreement ||
                          pendingSicknessExchange ||
                          mummyPendingReward ||
                          isDustSicknessExchangeMode ||
                          selectedTradeTarget
                            ? "text-[#8db29a]"
                            : "text-[#b8ae98]"
                        }`}
                        data-testid="betrayal-mobile-trade-status"
                      >
                        {tradeStatusText}
                      </div>
                    ) : null}
                    {shouldShowInlineTradeConfirm ? (
                      <button
                        type="button"
                        onClick={() => handleTradeAction()}
                        data-testid="betrayal-mobile-trade-flow-confirm"
                        className="mt-2 min-h-[38px] w-full rounded-[9px] border border-[#d7c16f] bg-[rgba(215,193,111,0.22)] px-3 text-[12px] font-black tracking-[0.06em] text-[#fff4ba] shadow-[0_0_16px_rgba(215,193,111,0.20)]"
                      >
                        {t("board.status.tradeFlowRequest")}
                      </button>
                    ) : mummyPendingReward && isMummyRewardChooser ? (
                      <div
                        data-testid="betrayal-mobile-mummy-reward-panel"
                        data-prompt-actions-for="betrayal-mummy-reward-banner"
                        className="mt-2 grid gap-2"
                      >
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleResolveMummyAttackReward("damage")
                            }
                            data-testid="betrayal-mobile-mummy-reward-damage"
                            className="min-h-[44px] flex-1 rounded-[8px] border border-[#d7c16f] bg-[rgba(215,193,111,0.24)] px-2.5 text-[13px] font-black text-[#fff4ba]"
                          >
                            {t("board.status.mummyRewardDamage", {
                              damage: mummyPendingReward.damageToHero,
                            })}
                          </button>
                          {mummyStealableCards.map((card) => (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() =>
                                handleResolveMummyAttackReward(
                                  "steal",
                                  card.id,
                                )
                              }
                              data-testid={`betrayal-mobile-mummy-reward-steal-${card.id}`}
                              className="min-h-[44px] flex-1 rounded-[8px] border border-[rgba(159,225,167,0.48)] bg-[rgba(40,63,50,0.38)] px-2.5 text-[13px] font-bold text-[#d9ffcf]"
                            >
                              {t("board.status.mummyRewardSteal", {
                                card: card.name,
                              })}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : helpingHandsPendingReward &&
                      isHelpingHandsRewardChooser ? (
                      <div
                        data-testid="betrayal-mobile-helping-hands-reward-panel"
                        data-prompt-actions-for="betrayal-helping-hands-reward-banner"
                        className="mt-2 grid gap-2"
                      >
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleResolveHelpingHandsAttackReward("damage")
                            }
                            data-testid="betrayal-mobile-helping-hands-reward-damage"
                            className="min-h-[44px] flex-1 rounded-[8px] border border-[#d7c16f] bg-[rgba(215,193,111,0.24)] px-2.5 text-[13px] font-black text-[#fff4ba]"
                          >
                            {t("board.status.helpingHandsRewardDamage", {
                              damage:
                                helpingHandsPendingReward.damageToDefender,
                            })}
                          </button>
                          {helpingHandsStealableCards.map((card) => (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() =>
                                handleResolveHelpingHandsAttackReward(
                                  "steal",
                                  card.id,
                                )
                              }
                              data-testid={`betrayal-mobile-helping-hands-reward-steal-${card.id}`}
                              className="min-h-[44px] flex-1 rounded-[8px] border border-[rgba(159,225,167,0.48)] bg-[rgba(40,63,50,0.38)] px-2.5 text-[13px] font-bold text-[#d9ffcf]"
                            >
                              {t("board.status.helpingHandsRewardSteal", {
                                card: card.name,
                              })}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : pendingSicknessExchange ? (
                      <div
                        data-testid="betrayal-mobile-sickness-exchange-panel"
                        className="mt-2 flex items-center gap-2"
                      >
                        {isPendingSicknessForViewer ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleResolveSicknessExchange(true)
                              }
                              data-testid="betrayal-mobile-sickness-exchange-accept"
                              className="min-h-[36px] flex-1 rounded-[8px] border border-[#d7c16f] bg-[rgba(215,193,111,0.20)] px-2 text-[12px] font-black text-[#fff4ba]"
                            >
                              {t("board.status.sicknessExchangeAccept")}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleResolveSicknessExchange(false)
                              }
                              data-testid="betrayal-mobile-sickness-exchange-decline"
                              className="min-h-[36px] flex-1 rounded-[8px] border border-[rgba(244,164,120,0.42)] bg-[rgba(96,48,30,0.36)] px-2 text-[12px] font-bold text-[#f3c1a1]"
                            >
                              {t("board.status.sicknessExchangeDecline")}
                            </button>
                          </>
                        ) : (
                          <span
                            data-testid="betrayal-mobile-sickness-exchange-waiting"
                            className="text-[11px] font-semibold text-[#d9c68d]"
                          >
                            {t("board.status.tradeStepAgree")}
                          </span>
                        )}
                      </div>
                    ) : pendingTradeAgreement ? (
                      <div
                        data-testid="betrayal-mobile-trade-agreement-panel"
                        className="mt-2 flex items-center gap-2"
                      >
                        {isPendingTradeForViewer ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResolveTradeAgreement(true)}
                              data-testid="betrayal-mobile-trade-agreement-accept"
                              className="min-h-[36px] flex-1 rounded-[8px] border border-[#d7c16f] bg-[rgba(215,193,111,0.20)] px-2 text-[12px] font-black text-[#fff4ba]"
                            >
                              {t("board.status.tradeAgreementAccept")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveTradeAgreement(false)}
                              data-testid="betrayal-mobile-trade-agreement-decline"
                              className="min-h-[36px] flex-1 rounded-[8px] border border-[rgba(244,164,120,0.42)] bg-[rgba(96,48,30,0.36)] px-2 text-[12px] font-bold text-[#f3c1a1]"
                            >
                              {t("board.status.tradeAgreementDecline")}
                            </button>
                          </>
                        ) : (
                          <span
                            data-testid="betrayal-mobile-trade-agreement-waiting"
                            className="text-[11px] font-semibold text-[#d9c68d]"
                          >
                            {t("board.status.tradeStepAgree")}
                          </span>
                        )}
                      </div>
                    ) : helpingHandsVisibleTrollHandAttackOptions.length > 0 ? (
                      <div
                        data-testid="betrayal-mobile-helping-hands-troll-attack-actions"
                        className="mt-2 grid w-full grid-cols-1 gap-2"
                      >
                        {helpingHandsVisibleTrollHandAttackOptions.map(
                          (option) => {
                            const target =
                              helpingHandsTrollHandAttackTargetsByOptionId.get(
                                option.id,
                              );
                            if (!target) {
                              return null;
                            }
                            const singleAttackIndex = option.combined
                              ? 0
                              : helpingHandsMonsterTurnStatus.trollHandIds.indexOf(
                                  option.trollHandIds[0] ?? "",
                                ) + 1;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  handleHelpingHandsTrollHandAttack(
                                    option,
                                    target.playerId,
                                  )
                                }
                                data-testid={
                                  option.combined
                                    ? "betrayal-mobile-helping-hands-troll-combined"
                                    : `betrayal-mobile-helping-hands-troll-single-${option.trollHandIds[0] ?? "unknown"}`
                                }
                                className="min-h-[44px] w-full rounded-[9px] border border-[rgba(159,225,167,0.48)] bg-[rgba(40,63,50,0.36)] px-3 text-[13px] font-black tracking-[0.06em] text-[#d9ffcf]"
                              >
                                {option.combined
                                  ? t(
                                      "board.status.helpingHandsTrollCombinedAttack",
                                    )
                                  : singleAttackIndex > 0
                                    ? t(
                                        "board.status.helpingHandsTrollSingleAttackWithIndex",
                                        { index: singleAttackIndex },
                                      )
                                    : t(
                                        "board.status.helpingHandsTrollSingleAttack",
                                      )}
                              </button>
                            );
                          },
                        )}
                      </div>
                    ) : null}
                    {shouldShowBoardActionStatus ? (
                      <div
                        className="sr-only"
                        data-testid="betrayal-mobile-action-cue"
                      >
                        {actionCueText}
                      </div>
                    ) : null}
                  </div>
                )}
                {isPhoneLandscapeLayout &&
                !pendingSicknessExchange &&
                !mummyPendingReward &&
                !helpingHandsPendingReward &&
                !isDustSicknessExchangeMode &&
                !pendingEventFocusesMapTarget ? (
                  <button
                    type="button"
                    onClick={openScenarioReference}
                    data-testid="betrayal-open-scenario"
                    data-tutorial-id="betrayal-open-scenario"
                    className={`mx-auto inline-flex min-h-[30px] items-center justify-center gap-1 rounded-[5px] border border-[rgba(211,179,109,0.28)] bg-[rgba(10,13,10,0.48)] px-2 text-[10px] font-semibold tracking-[0.04em] text-[#fff1b8] transition hover:border-[#e2c57e] hover:bg-[rgba(211,179,109,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#e2c57e] ${
                      activeHauntTargetGuide ? "opacity-[0.72]" : ""
                    }`}
                    aria-label={scenarioReferenceAccessibleLabel}
                    title={scenarioReferenceAccessibleLabel}
                  >
                    <BookOpen size={12} strokeWidth={2.35} />
                    {scenarioReferenceButtonLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => scrollToSection("betrayal-inventory-section")}
                  data-testid="betrayal-mobile-jump-inventory"
                  className={`${isPhoneLandscapeLayout ? "hidden" : ""} shrink-0 rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2 text-xs font-medium text-[#dbcfae]`}
                >
                  {t("board.sections.inventory")}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("betrayal-decks-section")}
                  data-testid="betrayal-mobile-jump-decks"
                  className={`${isPhoneLandscapeLayout ? "hidden" : ""} shrink-0 rounded-[14px] border border-[#5a4930] bg-[rgba(27,20,16,0.82)] px-3 py-2 text-xs font-medium text-[#dbcfae]`}
                >
                  {t("board.sections.decks")}
                </button>
                <div
                  className={
                    isHauntTargetingMode && isPhoneLandscapeLayout
                      ? "relative min-h-[56px] min-w-0"
                      : `grid min-w-0 ${
                          isPhoneLandscapeLayout
                            ? "grid-cols-5"
                            : "flex-1 grid-cols-5"
                        } ${
                          isPhoneLandscapeLayout
                            ? "min-h-[56px] items-stretch gap-3"
                            : "gap-2"
                        }`
                  }
                >
                  {visibleActionItems.map((action) => {
                    if (action.id === "trade" && shouldShowInlineTradeConfirm) {
                      return null;
                    }
                    const Icon =
                      ACTION_ICON_BY_ID[
                        action.id as keyof typeof ACTION_ICON_BY_ID
                      ] || Compass;
                    const isRoomEndTurnEffectAction =
                      action.id === "endTurn" && Boolean(roomEndTurnEffectHint);
                    const isHauntPrimaryButton =
                      core.phase === "haunt" &&
                      action.id === "use" &&
                      !selectedInventoryCard;
                    const isHauntTargetCancelButton =
                      action.id === "cancelTarget";
                    const hauntPrimaryActionMode = isHauntTargetCancelButton
                      ? "targeting"
                      : isHauntPrimaryButton
                        ? activeHauntTargetGuide
                          ? "targeting"
                          : hauntActionContext?.actionKind === "use"
                          ? "execute"
                          : hauntActionContext
                            ? "choose-target"
                            : "unavailable"
                        : undefined;
                    const hauntPrimaryActionKind = isHauntTargetCancelButton
                      ? (previewState.hauntTargetingActionKind ?? "none")
                      : isHauntPrimaryButton
                        ? (hauntActionContext?.actionKind ?? "none")
                        : undefined;
                    const isBloodFromStoneSetupPlacementButton =
                      action.id === "bloodFromStoneSetupPlacement";
                    const isBloodFromStoneSetupConfirmButton =
                      action.id === "bloodFromStoneConfirmSetupPlacement";
                    const isRecommended =
                      action.id === core.recommendedAction ||
                      (previewState.interactionMode === "move" &&
                        action.id === "move") ||
                      (previewState.interactionMode === "monsterMove" &&
                        action.id === "monsterMove") ||
                      (previewState.interactionMode === "monsterAttack" &&
                        action.id === "monsterAttack") ||
                      (isBloodFromStoneSetupPlacementMode &&
                        isBloodFromStoneSetupPlacementButton) ||
                      (isBloodFromStoneSetupConfirmButton && !action.disabled) ||
                      (isDustSicknessExchangeMode && action.id === "trade") ||
                      action.id === "monsterTurnStart" ||
                      action.id === "monsterMovementRoll" ||
                      isRoomEndTurnEffectAction ||
                      isHauntPrimaryButton ||
                      isHauntTargetCancelButton;
                    return (
                      <button
                        key={`mobile-dock-${action.id}`}
                        type="button"
                        onClick={actionHandlerMap[action.id]}
                        disabled={action.disabled}
                        data-testid={
                          isHauntTargetCancelButton
                            ? "betrayal-haunt-target-cancel"
                            : `betrayal-mobile-dock-${action.id}`
                        }
                        data-tutorial-id={`betrayal-action-${action.id}`}
                        data-haunt-primary-action-mode={
                          hauntPrimaryActionMode
                        }
                        data-haunt-primary-action-kind={
                          hauntPrimaryActionKind
                        }
                        data-haunt-targeting-status={
                          isHauntTargetCancelButton ||
                          (isHauntPrimaryButton && activeHauntTargetGuide)
                            ? "true"
                            : undefined
                        }
                        data-action-disabled-reason={
                          action.disabled && action.description
                            ? action.description
                            : undefined
                        }
                        title={
                          action.disabled && action.description
                            ? action.description
                            : actionCueText
                        }
                        className={`flex flex-col items-center justify-center transition ${
                          isPhoneLandscapeLayout && isHauntTargetingMode
                            ? isHauntTargetCancelButton
                              ? "absolute"
                              : isHauntPrimaryButton
                                ? "absolute"
                                : ""
                            : ""
                        } ${
                          isPhoneLandscapeLayout
                            ? "min-h-[56px] gap-0.5 rounded-[5px] border-0 bg-transparent px-1 py-1 text-[11px] font-bold uppercase tracking-[0.08em] shadow-none"
                            : "min-h-[54px] gap-1 rounded-[14px] border px-1.5 py-1.5 text-[10px] font-medium"
                        } ${
                          action.disabled
                            ? isPhoneLandscapeLayout
                              ? "cursor-not-allowed text-[#5f584d] opacity-55"
                              : "cursor-not-allowed border-[#3e3526] bg-[rgba(22,17,13,0.72)] text-[#6f6758]"
                            : isRoomEndTurnEffectAction
                              ? isPhoneLandscapeLayout
                                ? "text-[#ffd59a] underline decoration-[#f59e0b] decoration-2 underline-offset-4 hover:text-[#ffe6b8]"
                                : "border-[#b66b36] bg-[rgba(105,45,18,0.34)] text-[#ffd59a]"
                              : isRecommended
                                ? isPhoneLandscapeLayout
                                  ? "text-[#f6ffc4] underline decoration-[#f2cc79] decoration-2 underline-offset-4 hover:text-[#fbffd2]"
                                  : "border-[#c9a35e] bg-[rgba(201,163,94,0.16)] text-[#f3e0b4]"
                                : isPhoneLandscapeLayout
                                  ? "text-[#ead8a8] hover:text-[#fff0ba]"
                                  : "border-[#5c4d35] bg-[rgba(30,22,17,0.88)] text-[#d8ccb0]"
                        }`}
                        style={{
                          ...(isPhoneLandscapeLayout
                            ? {
                                backgroundColor: "transparent",
                                backgroundImage: "none",
                                border: 0,
                                boxShadow: "none",
                                textShadow: action.disabled
                                  ? "none"
                                  : isRoomEndTurnEffectAction
                                    ? "0 1px 2px rgba(0,0,0,0.9), 0 0 16px rgba(245,158,11,0.52)"
                                    : isRecommended
                                      ? "0 1px 2px rgba(0,0,0,0.9), 0 0 14px rgba(238,244,168,0.48)"
                                      : "0 1px 2px rgba(0,0,0,0.88), 0 0 8px rgba(234,216,168,0.28)",
                              }
                            : {}),
                          ...(isPhoneLandscapeLayout &&
                          isHauntTargetingMode &&
                          isHauntTargetCancelButton
                            ? {
                                bottom: 0,
                                left: "50%",
                                position: "absolute",
                                transform: "translateX(184px)",
                              }
                            : {}),
                          ...(isPhoneLandscapeLayout &&
                          isHauntTargetingMode &&
                          isHauntPrimaryButton
                            ? {
                                bottom: 0,
                                left: "50%",
                                position: "absolute",
                                transform: "translateX(-50%)",
                              }
                            : {}),
                        }}
                      >
                        <Icon
                          size={isPhoneLandscapeLayout ? 18 : 14}
                          strokeWidth={
                            isPhoneLandscapeLayout ? 2.35 : undefined
                          }
                        />
                        <span>{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {visualTransition ? (
        <BetrayalVisualTransitionLayer
          transition={visualTransition}
          onComplete={finishBetrayalVisualTransition}
        />
      ) : null}
      {core.phase === "endgame" ? (
        <EndgameScreen
          core={core}
          matchData={matchData}
          effectiveLocale={effectiveLocale}
        />
      ) : null}
    </div>
  );
}
