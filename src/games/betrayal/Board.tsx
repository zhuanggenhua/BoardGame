import React from "react";
import { useInRouterContext } from "react-router-dom";
import {
  BookOpen,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Crosshair,
  Footprints,
  Handshake,
  House,
  Hourglass,
  RotateCcw,
  Search,
  Skull,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTutorial, useTutorialBridge } from "../../contexts/TutorialContext";
import { HudPortal, UI_Z_INDEX } from "../../core";
import type { ActionBarAction } from "../../core/ui/types";
import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import { MagnifyOverlay } from "../../components/common/overlays/MagnifyOverlay";
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
} from "../../components/game/framework";
import { GameDebugPanel } from "../../components/game/framework/widgets/GameDebugPanel";
import { useRuntimeViewport } from "../../hooks/ui/useRuntimeViewport";
import type { MatchPlayerInfo } from "../../engine/transport/protocol";
import type { GameBoardProps } from "../../engine/transport/protocol";
import type {
  BetrayalCommandMap,
  BetrayalCore,
  BetrayalDeckKind,
  BetrayalDiscoverySummary,
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
  BetrayalMonsterSummary,
  BetrayalRecentRollState,
  BetrayalRoomVisualId,
  BetrayalRoomNode,
  BetrayalTraitKey,
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
  canUseRabbitFootForRecentRoll,
  canUseSkeletonKeyForMove,
  canUseMysticElevator,
  canSearchForCure,
  canCureTheDust,
  canTakeMagicCameraPhoto,
  canSmashMagicCamera,
  createBetrayalCharacterSelectCore,
  getBetrayalScenarioConfig,
  isBetrayalLibraryRoom,
  resolveAttackWeaponCards,
  resolveDogTradeTargets,
  resolveExplorableRoomSlots,
  resolveHungryHouseCarriableCorpses,
  resolveMagicCameraPhantomAttackTargets,
  resolveUseEffect,
} from "./game";
import {
  BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
  buildPossessionAtlasImageStyle,
  resolvePossessionAtlasVisual,
  type BetrayalPossessionAtlasVisual,
} from "./possessionAtlas";
import { isImplementedBetrayalHauntCardNumber } from "./scenarioConfig";
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

type Props = GameBoardProps<BetrayalCore, BetrayalCommandMap>;

type ScenarioReaderSection = {
  id: string;
  labelKey: string;
  bodyKey: string;
  accentClass: string;
};

type ScenarioReaderPage = {
  id: string;
  type: "cover" | "section";
  pageNumber: number;
  sections?: ScenarioReaderSection[];
};

type HauntDossierId = "crimsonJack" | "dust" | "hungryHouse" | "magicCamera";

type HauntDossier = {
  id: HauntDossierId;
  cardNumber: number;
  titleKey: string;
  referenceTitleKey: string;
  objectiveKey: string;
  heroGoalKey: string;
  traitorGoalKey: string;
  sections: ScenarioReaderSection[];
};

type HauntGoalProgressRow = {
  id: string;
  label: string;
  value: string;
};

type HauntTargetGuide = {
  kind: "room" | "explorer" | "monster";
  roomId: string | null;
  playerId?: string;
  monsterId?: string;
  targetName: string;
  cue: string;
};

const createHauntSection = (
  dossierId: HauntDossierId,
  id: string,
  accentClass: string,
): ScenarioReaderSection => ({
  id,
  labelKey: `game-betrayal:board.haunts.${dossierId}.reader.${id}Label`,
  bodyKey: `game-betrayal:board.haunts.${dossierId}.reader.${id}`,
  accentClass,
});

const HAUNT_DOSSIERS: Record<HauntDossierId, HauntDossier> = {
  crimsonJack: {
    id: "crimsonJack",
    cardNumber: 1,
    titleKey: "game-betrayal:board.haunts.crimsonJack.title",
    referenceTitleKey: "game-betrayal:board.haunts.crimsonJack.referenceTitle",
    objectiveKey: "game-betrayal:board.haunts.crimsonJack.objective",
    heroGoalKey: "game-betrayal:board.haunts.crimsonJack.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.crimsonJack.traitorGoal",
    sections: [
      createHauntSection("crimsonJack", "prologue", "border-[#8f5a22]"),
      createHauntSection("crimsonJack", "setup", "border-[#607f3a]"),
      createHauntSection("crimsonJack", "heroes", "border-[#43717a]"),
      createHauntSection("crimsonJack", "special", "border-[#a16c24]"),
      createHauntSection("crimsonJack", "traitor", "border-[#8f3c2e]"),
      createHauntSection("crimsonJack", "monster", "border-[#684b87]"),
      createHauntSection("crimsonJack", "ending", "border-[#8f5a22]"),
    ],
  },
  dust: {
    id: "dust",
    cardNumber: 3,
    titleKey: "game-betrayal:board.haunts.dust.title",
    referenceTitleKey: "game-betrayal:board.haunts.dust.referenceTitle",
    objectiveKey: "game-betrayal:board.haunts.dust.objective",
    heroGoalKey: "game-betrayal:board.haunts.dust.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.dust.traitorGoal",
    sections: [
      createHauntSection("dust", "prologue", "border-[#8f5a22]"),
      createHauntSection("dust", "setup", "border-[#607f3a]"),
      createHauntSection("dust", "heroes", "border-[#43717a]"),
      createHauntSection("dust", "special", "border-[#a16c24]"),
      createHauntSection("dust", "traitor", "border-[#8f3c2e]"),
      createHauntSection("dust", "ending", "border-[#8f5a22]"),
    ],
  },
  hungryHouse: {
    id: "hungryHouse",
    cardNumber: 12,
    titleKey: "game-betrayal:board.haunts.hungryHouse.title",
    referenceTitleKey: "game-betrayal:board.haunts.hungryHouse.referenceTitle",
    objectiveKey: "game-betrayal:board.haunts.hungryHouse.objective",
    heroGoalKey: "game-betrayal:board.haunts.hungryHouse.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.hungryHouse.traitorGoal",
    sections: [
      createHauntSection("hungryHouse", "prologue", "border-[#8f5a22]"),
      createHauntSection("hungryHouse", "setup", "border-[#607f3a]"),
      createHauntSection("hungryHouse", "heroes", "border-[#43717a]"),
      createHauntSection("hungryHouse", "special", "border-[#a16c24]"),
      createHauntSection("hungryHouse", "traitor", "border-[#8f3c2e]"),
      createHauntSection("hungryHouse", "ending", "border-[#8f5a22]"),
    ],
  },
  magicCamera: {
    id: "magicCamera",
    cardNumber: 33,
    titleKey: "game-betrayal:board.haunts.magicCamera.title",
    referenceTitleKey: "game-betrayal:board.haunts.magicCamera.referenceTitle",
    objectiveKey: "game-betrayal:board.haunts.magicCamera.objective",
    heroGoalKey: "game-betrayal:board.haunts.magicCamera.heroGoal",
    traitorGoalKey: "game-betrayal:board.haunts.magicCamera.traitorGoal",
    sections: [
      createHauntSection("magicCamera", "prologue", "border-[#8f5a22]"),
      createHauntSection("magicCamera", "setup", "border-[#607f3a]"),
      createHauntSection("magicCamera", "heroes", "border-[#43717a]"),
      createHauntSection("magicCamera", "special", "border-[#a16c24]"),
      createHauntSection("magicCamera", "traitor", "border-[#8f3c2e]"),
      createHauntSection("magicCamera", "ending", "border-[#8f5a22]"),
    ],
  },
};

const HAUNT_DOSSIER_BY_CARD_NUMBER: Record<number, HauntDossierId> = {
  1: "crimsonJack",
  3: "dust",
  12: "hungryHouse",
  33: "magicCamera",
};

function resolveActiveHauntDossier(core: BetrayalCore): HauntDossier {
  if (core.phase === "haunt" && core.scenarioRuntime.hauntCardNumber) {
    const dossierId =
      HAUNT_DOSSIER_BY_CARD_NUMBER[core.scenarioRuntime.hauntCardNumber] ??
      "crimsonJack";
    return HAUNT_DOSSIERS[dossierId];
  }
  return HAUNT_DOSSIERS.crimsonJack;
}

function buildScenarioReaderPages(
  dossier: HauntDossier = HAUNT_DOSSIERS.crimsonJack,
): ScenarioReaderPage[] {
  const pageCount = Math.min(4, Math.max(2, dossier.sections.length));
  const baseSectionsPerPage = Math.floor(dossier.sections.length / pageCount);
  const pagesWithExtraSection = dossier.sections.length % pageCount;
  let sectionOffset = 0;

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const sectionCount =
      baseSectionsPerPage + (pageIndex < pagesWithExtraSection ? 1 : 0);
    const sections = dossier.sections.slice(
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
  selectedDogTradeCardIds: string[];
  selectedTradeReturnCardIds: string[];
  selectedAttackWeaponCardId: string | null;
  selectedInventoryTargetPlayerId: string | null;
  selectedInventoryTargetRoomId: string | null;
  selectedMaskTargetRoomIdsByTokenId: Record<string, string>;
  activeMaskTargetTokenId: string | null;
  selectedEventTrait: BetrayalTraitKey | null;
  selectedEventTargetRoomId: string | null;
  selectedEventDamageTraits: BetrayalTraitKey[];
  useHolySymbolForExplore: boolean;
  useIdolForExplore: boolean;
  tradeSelectionTouched: boolean;
  dismissedLatestDiscoveryKey: string | null;
  dismissedRecentRollId: string | null;
  interactionMode: "default" | "move" | "explore" | "sicknessExchange";
  hauntTargetingActionKind: string | null;
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

const EXPLORER_BOARD_MARKER_RANGE: Record<
  BetrayalTraitKey,
  { from: { x: number; y: number }; to: { x: number; y: number } }
> = {
  might: { from: { x: 14.5, y: 44.5 }, to: { x: 35.5, y: 23.5 } },
  speed: { from: { x: 18.5, y: 79.5 }, to: { x: 18.5, y: 54.5 } },
  knowledge: { from: { x: 85.5, y: 44.5 }, to: { x: 64.5, y: 23.5 } },
  sanity: { from: { x: 81.5, y: 79.5 }, to: { x: 81.5, y: 54.5 } },
};

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
    videotape: "betrayal/markers/videotape",
  } as const,
  numberMarker: {
    blank: "betrayal/markers/number-blank",
    1: "betrayal/markers/number-1",
    2: "betrayal/markers/number-2",
    3: "betrayal/markers/number-3",
    4: "betrayal/markers/number-4",
    5: "betrayal/markers/number-5",
    6: "betrayal/markers/number-6",
    7: "betrayal/markers/number-7",
    8: "betrayal/markers/number-8",
    9: "betrayal/markers/number-9",
  } as const,
} as const;

const ACTION_ICON_BY_ID = {
  move: Footprints,
  explore: Search,
  trade: Handshake,
  use: BookOpen,
  roomEffect: RotateCcw,
  endTurn: Hourglass,
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
    selectedDogTradeCardIds: [],
    selectedTradeReturnCardIds: [],
    selectedAttackWeaponCardId: null,
    selectedInventoryTargetPlayerId: null,
    selectedInventoryTargetRoomId: null,
    selectedMaskTargetRoomIdsByTokenId: {},
    activeMaskTargetTokenId: null,
    selectedEventTrait: null,
    selectedEventTargetRoomId: null,
    selectedEventDamageTraits: [],
    useHolySymbolForExplore: false,
    useIdolForExplore: false,
    tradeSelectionTouched: false,
    dismissedLatestDiscoveryKey: null,
    dismissedRecentRollId: null,
    interactionMode: "default",
    hauntTargetingActionKind: null,
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
  testIdPrefix = "betrayal-explorer-figure-token",
}: {
  explorer: BetrayalExplorerSummary;
  locale: string;
  label: string;
  tone: "self" | "ally";
  size?: "board" | "panel";
  testIdPrefix?: string;
}) {
  const tokenAsset = explorer.tokenAsset ?? explorer.portraitAsset;
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
      data-token-asset={tokenAsset}
      data-token-tone={tone}
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
        <OptimizedImage
          src={tokenAsset}
          locale={locale}
          alt={label}
          className={
            hasOfficialToken ? sizeClass.officialImage : sizeClass.fallbackImage
          }
          draggable={false}
        />
      </span>
    </span>
  );
}

function MonsterBoardToken({
  monster,
  locale,
}: {
  monster: BetrayalMonsterSummary;
  locale: string;
}) {
  const tokenAsset = monster.tokenAsset ?? monster.portraitAsset;
  const hasOfficialToken = Boolean(monster.tokenAsset);
  const outlineColor = "rgba(218,74,57,0.98)";
  const cultistMatch = /^cultist-(\d+)$/.exec(monster.id);

  if (cultistMatch) {
    return (
      <span
        className="relative inline-flex h-[52px] w-[52px] items-center justify-center"
        data-testid={`betrayal-monster-board-token-${monster.id}`}
      >
        <span
          className="relative grid h-[46px] w-[46px] place-items-center rounded-[9px] border-2 border-[#d95c4d] bg-[radial-gradient(circle_at_50%_34%,rgba(139,46,38,0.96),rgba(49,18,16,0.98)_72%)] text-[#ffe2b8] shadow-[0_5px_10px_rgba(0,0,0,0.38),inset_0_0_0_1px_rgba(255,222,174,0.12)]"
          data-testid={`betrayal-monster-board-token-outline-${monster.id}`}
          data-cultist-token="true"
        >
          <Skull
            aria-hidden="true"
            size={25}
            strokeWidth={1.9}
            data-testid={`betrayal-cultist-token-symbol-${monster.id}`}
          />
          <span className="absolute bottom-0.5 right-1 text-[9px] font-black leading-none text-[#ffd27a]">
            {cultistMatch[1]}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span
      className="relative inline-flex h-[52px] w-[52px] items-center justify-center"
      data-testid={`betrayal-monster-board-token-${monster.id}`}
    >
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 rounded-[7px]"
        data-testid={`betrayal-monster-board-token-outline-${monster.id}`}
        style={{
          backgroundColor: outlineColor,
          filter: "drop-shadow(0 5px 10px rgba(0,0,0,0.36))",
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
    </span>
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
  const tokenAsset = explorer.tokenAsset ?? explorer.portraitAsset;
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

            <div className="mt-4 grid grid-cols-4 gap-2">
              {(
                ["might", "speed", "knowledge", "sanity"] as BetrayalTraitKey[]
              ).map((trait) => (
                <div
                  key={`${explorer.playerId}-detail-${trait}`}
                  className="rounded-[8px] border border-[rgba(111,89,51,0.46)] bg-[rgba(19,17,13,0.74)] px-2.5 py-2 text-center"
                >
                  <div
                    className={`text-[11px] font-semibold ${TRAIT_TONE_CLASS[trait].text}`}
                  >
                    {TRAIT_LABEL_LOCAL[trait]}
                  </div>
                  <div
                    className={`mt-1 text-[22px] font-black leading-none ${TRAIT_VALUE_TEXT_CLASS[trait]}`}
                  >
                    {explorer.traits[trait]}
                  </div>
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

function resolveNumberMarkerAsset(value: number): string {
  const clamped = Math.max(1, Math.min(9, Math.round(value))) as
    1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  return ASSETS.numberMarker[clamped];
}

function resolveExplorerBoardMarkerPosition(
  trait: BetrayalTraitKey,
  value: number,
) {
  const range = EXPLORER_BOARD_MARKER_RANGE[trait];
  const clampedValue = Math.max(1, Math.min(8, Math.round(value)));
  const progress = (clampedValue - 1) / 7;
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
  if (effectId === "armor") passiveLabels.push("受到物理伤害 -1");
  if (effectId === "radio") passiveLabels.push("受到精神伤害 -1");
  if (effectId === "lockpick-tool")
    passiveLabels.push("移动时可穿过一格同层相邻墙体");
  if (effectId === "hunting-knife")
    passiveLabels.push("攻击时可选择砍刀，攻击结果 +1");
  if (effectId === "dagger")
    passiveLabels.push("攻击时可选择匕首，额外投 2 骰并失去 1 点速度");

  if (activeLabel !== "按卡面规则持有" && passiveLabels.length > 0) {
    return `${activeLabel}；${passiveLabels.join("；")}`;
  }
  if (activeLabel !== "按卡面规则持有") {
    return activeLabel;
  }
  return passiveLabels.length > 0 ? passiveLabels.join("；") : activeLabel;
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
    return core.rooms.filter(
      (room) =>
        room.state === "discovered" &&
        (effect.targetRoomScope === "anyDiscovered" ||
          (effect.targetRoomScope === "groundDiscovered" &&
            room.floor === "ground") ||
          (effect.targetRoomScope === "basementDiscovered" &&
            room.floor === "basement")),
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
        !(room.tokens ?? []).some((token) => token.kind === "secretPassage") &&
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
        <div className="pointer-events-none absolute inset-x-[13%] bottom-[7%] h-[18%] rounded-[18px] bg-[linear-gradient(180deg,rgba(9,13,11,0),rgba(8,12,10,0.64))]" />
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
      } ${className}`}
    >
      {children}
    </button>
  );
}

function ScenarioBookTurnSheet({
  direction,
}: {
  direction: "back" | "forward" | null;
}) {
  if (!direction) return null;

  const isForward = direction === "forward";
  return (
    <div
      data-testid="betrayal-scenario-book-turning-sheet"
      data-turn-direction={direction}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-[7px] z-20 w-[calc(50%_-_7px)] border border-[#d8b77d]/72 bg-[linear-gradient(105deg,rgba(255,243,208,0.88)_0%,rgba(235,204,151,0.96)_42%,rgba(138,83,36,0.44)_50%,rgba(255,239,199,0.74)_58%,rgba(194,137,74,0.26)_100%)] shadow-[0_18px_44px_rgba(0,0,0,0.42),inset_0_0_36px_rgba(82,48,20,0.16)] transition-[transform,opacity,filter] duration-500 ease-out ${
        isForward
          ? "right-[7px] origin-left [transform:perspective(720px)_rotateY(-15deg)_translateX(-8%)_skewY(-2deg)]"
          : "left-[7px] origin-right [transform:perspective(720px)_rotateY(15deg)_translateX(8%)_skewY(2deg)]"
      }`}
    >
      <div className="absolute inset-0 opacity-[0.18] [background-image:repeating-linear-gradient(0deg,rgba(82,48,20,0.14)_0_1px,transparent_1px_9px)]" />
      <div
        className={`absolute inset-y-0 w-[46%] ${
          isForward
            ? "left-0 bg-[linear-gradient(90deg,rgba(65,36,17,0.50),transparent)]"
            : "right-0 bg-[linear-gradient(270deg,rgba(65,36,17,0.50),transparent)]"
        }`}
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
  const scenarioConfig = getBetrayalScenarioConfig(core.scenarioId);
  const [scenarioSelectionOpen, setScenarioSelectionOpen] =
    React.useState(false);
  const [scenarioDetailsOpen, setScenarioDetailsOpen] = React.useState(false);
  const [scenarioReaderSpreadIndex, setScenarioReaderSpreadIndex] =
    React.useState(0);
  const [scenarioReaderTurnDirection, setScenarioReaderTurnDirection] =
    React.useState<"back" | "forward" | null>(null);

  React.useEffect(() => {
    if (!isReady) {
      setScenarioSelectionOpen(false);
      setScenarioDetailsOpen(false);
      setScenarioReaderSpreadIndex(0);
    }
  }, [isReady]);

  const handlePrimaryAction = React.useCallback(() => {
    if (!isReady) {
      onConfirmExplorer();
      return;
    }
    onStartScenario();
  }, [isReady, onConfirmExplorer, onStartScenario]);

  const handleScenarioDialogClose = React.useCallback(
    (event?: React.SyntheticEvent) => {
      event?.stopPropagation();
      window.setTimeout(() => {
        setScenarioSelectionOpen(false);
        setScenarioDetailsOpen(false);
        setScenarioReaderSpreadIndex(0);
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
  const scenarioReaderPages = React.useMemo(
    () => buildScenarioReaderPages(),
    [],
  );
  const scenarioReaderSpreadCount = Math.max(
    1,
    Math.ceil(scenarioReaderPages.length / 2),
  );
  const scenarioReaderLeftPage =
    scenarioReaderPages[scenarioReaderSpreadIndex * 2] ?? null;
  const scenarioReaderRightPage =
    scenarioReaderPages[scenarioReaderSpreadIndex * 2 + 1] ?? null;
  const canTurnScenarioReaderBack = scenarioReaderSpreadIndex > 0;
  const canTurnScenarioReaderForward =
    scenarioReaderSpreadIndex < scenarioReaderSpreadCount - 1;
  const handleScenarioReaderTurn = React.useCallback(
    (direction: "back" | "forward") => {
      const nextSpreadIndex =
        direction === "back"
          ? Math.max(0, scenarioReaderSpreadIndex - 1)
          : Math.min(
              scenarioReaderSpreadCount - 1,
              scenarioReaderSpreadIndex + 1,
            );
      const didTurn = nextSpreadIndex !== scenarioReaderSpreadIndex;
      if (!didTurn) return;
      playSound(BETRAYAL_SCENARIO_PAGE_TURN_KEY);
      setScenarioReaderTurnDirection(direction);
      setScenarioReaderSpreadIndex(nextSpreadIndex);
      window.setTimeout(() => setScenarioReaderTurnDirection(null), 720);
    },
    [scenarioReaderSpreadCount, scenarioReaderSpreadIndex],
  );

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
                  {t("board.scenario.hauntValue")}
                </span>
              </button>
              <button
                type="button"
                onClick={handlePrimaryAction}
                data-testid="betrayal-character-confirm"
                data-tutorial-id="betrayal-character-confirm"
                className="relative inline-flex min-h-[58px] items-center justify-center gap-2 border-l border-[#5e4b2e] bg-[linear-gradient(180deg,rgba(95,135,44,0.24),rgba(54,81,22,0.76))] px-2 text-[15px] font-semibold uppercase tracking-[0.1em] text-[#dfff8f] shadow-[inset_0_0_0_1px_rgba(181,239,66,0.12)] transition hover:bg-[linear-gradient(180deg,rgba(108,149,51,0.3),rgba(61,91,25,0.82))] lg:min-h-[126px] lg:text-[26px] lg:tracking-[0.18em]"
              >
                <span className="pointer-events-none absolute inset-2 border border-[rgba(181,239,66,0.16)]" />
                {!isReady
                  ? t("board.characterSelect.confirm")
                  : t("board.characterSelect.startScenario")}
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
                <div
                  data-testid="betrayal-scenario-option-first-scenario"
                  className="mt-3 w-full border border-[#8b7044] bg-[linear-gradient(180deg,rgba(54,43,25,0.92),rgba(21,23,16,0.94))] p-3 text-left shadow-[inset_0_0_0_1px_rgba(255,240,184,0.08)] lg:p-4"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[rgba(214,191,129,0.2)] pb-2">
                    <div>
                      <div className="text-[18px] font-bold tracking-[0.08em] text-[#fff0b8] lg:text-[26px]">
                        {t("board.scenario.hauntValue")}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#9fb98b] lg:text-[13px]">
                        {scenarioConfig.presentation.runtimeObjective}
                      </div>
                    </div>
                    <div className="shrink-0 border border-[rgba(181,239,66,0.36)] bg-[rgba(34,48,20,0.54)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#dfff8f]">
                      {t("board.characterSelect.scenarioSelected")}
                    </div>
                  </div>
                  <div className="mt-3 border-l-2 border-[rgba(214,191,129,0.34)] pl-3 text-[12px] leading-5 text-[#e8dfc8] lg:text-[14px]">
                    {t("board.characterSelect.scenarioStepSubtitle")}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgba(214,191,129,0.16)] pt-3">
                    <button
                      type="button"
                      data-testid="betrayal-scenario-detail-toggle"
                      aria-haspopup="dialog"
                      aria-expanded={scenarioDetailsOpen}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={handleScenarioDetailsOpen}
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-[rgba(214,191,129,0.42)] bg-[rgba(18,23,18,0.78)] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e2c57e] transition hover:border-[#e2c57e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c57e]"
                    >
                      {t("board.characterSelect.viewScenarioDetails")}
                    </button>
                    <button
                      type="button"
                      data-testid="betrayal-scenario-select-current"
                      onClick={handleScenarioDialogClose}
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-[rgba(181,239,66,0.44)] bg-[rgba(32,52,18,0.68)] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#dfff8f] transition hover:border-[#b5ef42] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b5ef42]"
                    >
                      {t("board.characterSelect.useScenario")}
                    </button>
                  </div>
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
                className="pointer-events-auto fixed inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_12%,rgba(96,67,29,0.34),rgba(2,6,5,0.9)_52%,rgba(0,0,0,0.96))] px-3 py-3"
                style={{ zIndex: SCENARIO_READER_MODAL_Z_INDEX }}
                onClick={handleScenarioReaderClose}
              >
                <article
                  data-testid="betrayal-scenario-detail-panel"
                  className="relative flex max-h-[calc(100vh-18px)] w-full max-w-[1120px] flex-col overflow-hidden border border-[#9a7b46] bg-[linear-gradient(135deg,rgba(52,34,20,0.98),rgba(18,14,10,0.99)_48%,rgba(5,7,6,0.99))] text-[#3a2414] shadow-[0_34px_90px_rgba(0,0,0,0.72)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="pointer-events-none absolute inset-2 border border-[rgba(214,191,129,0.14)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(216,171,88,0.16),transparent_34%)]" />
                  <button
                    type="button"
                    data-testid="betrayal-scenario-reader-close"
                    onClick={handleScenarioReaderClose}
                    aria-label={t("board.characterSelect.hideScenarioDetails")}
                    className={`${isPhoneLandscapeLayout ? "relative ml-auto mr-2 mt-2 h-11 w-11 px-0" : "absolute right-3 top-3 min-h-11 min-w-11 px-3"} z-20 inline-flex cursor-pointer items-center justify-center border border-[rgba(214,191,129,0.42)] bg-[rgba(18,23,18,0.82)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e2c57e] shadow-[0_8px_24px_rgba(0,0,0,0.38)] transition hover:border-[#e2c57e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c57e]`}
                  >
                    {isPhoneLandscapeLayout ? (
                      <X size={18} aria-hidden="true" />
                    ) : (
                      t("board.characterSelect.hideScenarioDetails")
                    )}
                  </button>
                  <div
                    className={`relative min-h-0 px-2 ${isPhoneLandscapeLayout ? "pb-2" : "py-2 lg:px-3 lg:py-3"}`}
                  >
                    <div
                      data-testid="betrayal-scenario-book"
                      className={`relative mx-auto grid w-full max-w-[1120px] grid-cols-2 overflow-hidden border border-[#5a371a] bg-[#2a170d] shadow-[0_26px_62px_rgba(0,0,0,0.58),inset_0_0_0_1px_rgba(236,196,117,0.18)] transition-[transform,opacity,filter] duration-300 ease-out ${isPhoneLandscapeLayout ? "h-[calc(100vh-78px)] min-h-0 p-[5px]" : "h-[min(84vh,760px)] min-h-[360px] p-[7px] lg:h-[min(86vh,780px)]"} ${
                        scenarioReaderTurnDirection === "forward"
                          ? "translate-x-1 opacity-95 brightness-110"
                          : scenarioReaderTurnDirection === "back"
                            ? "-translate-x-1 opacity-95 brightness-110"
                            : "translate-x-0 opacity-100 brightness-100"
                      }`}
                    >
                      <div className="pointer-events-none absolute inset-[7px] bg-[linear-gradient(90deg,rgba(53,30,14,0)_0%,rgba(52,30,15,0)_47%,rgba(52,30,15,0.74)_50%,rgba(255,236,187,0.10)_51%,rgba(52,30,15,0)_54%,rgba(52,30,15,0)_100%)]" />
                      <ScenarioBookTurnSheet
                        direction={scenarioReaderTurnDirection}
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
                                      {t("board.scenario.hauntValue")}
                                    </h2>
                                    <div className="mt-3 h-px w-28 bg-[#8f5a22]" />
                                    <p className="mt-4 text-[15px] font-semibold leading-7 text-[#57361f] lg:text-[17px] lg:leading-8">
                                      {t("board.scenario.readerLead")}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.12em] text-[#6b4727] lg:text-[11px]">
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
                                  <div className="text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86643f]">
                                    {String(page.pageNumber).padStart(2, "0")}
                                  </div>
                                </div>
                              ) : (
                                <div className="relative flex h-full flex-col">
                                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                    <div
                                      className={`grid ${isPhoneLandscapeLayout ? "gap-2" : "gap-4 lg:gap-5"}`}
                                    >
                                      {(page.sections ?? []).map(
                                        (section, sectionIndex) => (
                                          <section
                                            key={section.id}
                                            data-testid={`betrayal-scenario-book-section-${section.id}`}
                                            className={`border-l-4 ${isPhoneLandscapeLayout ? "pl-2" : "pl-3"} ${section.accentClass}`}
                                          >
                                            <div
                                              className={`${isPhoneLandscapeLayout ? "text-[8px]" : "text-[10px]"} font-bold uppercase tracking-[0.2em] text-[#7d5129]`}
                                              aria-hidden="true"
                                            >
                                              {String(
                                                sectionIndex + 1,
                                              ).padStart(2, "0")}
                                            </div>
                                            <h3
                                              className={`${isPhoneLandscapeLayout ? "mt-0.5 text-[14px]" : "mt-1 text-[21px] lg:text-[25px]"} font-black tracking-[0.05em] text-[#3b2211]`}
                                            >
                                              {t(section.labelKey)}
                                            </h3>
                                            <p
                                              className={`${isPhoneLandscapeLayout ? "mt-1 text-[11px] leading-[1.4]" : "mt-2 text-[15px] leading-7 lg:text-[16px] lg:leading-7"} whitespace-pre-line font-medium text-[#4e321c]`}
                                            >
                                              {t(section.bodyKey)}
                                            </p>
                                          </section>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                  <div
                                    className={`${isPhoneLandscapeLayout ? "mt-1 pt-1 text-[8px]" : "mt-3 pt-2 text-[10px]"} flex items-center justify-between border-t border-[#b98343]/36 font-semibold uppercase tracking-[0.18em] text-[#86643f]`}
                                  >
                                    <span>
                                      {t("board.scenario.hauntValue")}
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
                    </div>
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
      "border-[#ff947f] bg-[rgba(207,113,95,0.38)] text-[#ffe1d8] shadow-[0_0_24px_rgba(207,113,95,0.34)]",
    idle: "border-[rgba(207,113,95,0.68)] bg-[rgba(54,22,19,0.66)] text-[#ffc6b8] hover:border-[#ff947f] hover:bg-[rgba(207,113,95,0.22)]",
  },
  speed: {
    selected:
      "border-[#f0d97b] bg-[rgba(214,190,103,0.36)] text-[#fff2b8] shadow-[0_0_24px_rgba(214,190,103,0.32)]",
    idle: "border-[rgba(214,190,103,0.68)] bg-[rgba(48,39,16,0.66)] text-[#ffeaa6] hover:border-[#f0d97b] hover:bg-[rgba(214,190,103,0.20)]",
  },
  knowledge: {
    selected:
      "border-[#a9d7e2] bg-[rgba(142,186,197,0.36)] text-[#e2f8ff] shadow-[0_0_24px_rgba(142,186,197,0.30)]",
    idle: "border-[rgba(142,186,197,0.66)] bg-[rgba(18,35,39,0.66)] text-[#dbf4fb] hover:border-[#a9d7e2] hover:bg-[rgba(142,186,197,0.20)]",
  },
  sanity: {
    selected:
      "border-[#c59af0] bg-[rgba(159,123,197,0.38)] text-[#f0dcff] shadow-[0_0_24px_rgba(159,123,197,0.34)]",
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
  title,
  scenarioTitle,
  traitorName,
  triggerLabel,
  isPhoneLandscapeLayout,
}: {
  title: string;
  scenarioTitle: string;
  traitorName: string;
  triggerLabel: string | null;
  isPhoneLandscapeLayout: boolean;
}) {
  return (
    <div
      data-testid="betrayal-haunt-reveal-cue"
      data-haunt-reveal-active="true"
      className={`betrayal-haunt-reveal-cue pointer-events-none absolute left-1/2 -translate-x-1/2 ${
        isPhoneLandscapeLayout ? "top-3" : "top-[86px]"
      }`}
      style={{ zIndex: UI_Z_INDEX.overlayRaised + 4 }}
    >
      <div className="betrayal-haunt-reveal-cue__slash" />
      <div className="relative min-w-[min(460px,calc(100vw-2rem))] overflow-hidden border border-[#f05f4f] bg-[linear-gradient(115deg,rgba(52,13,10,0.96),rgba(14,10,10,0.92)_58%,rgba(84,25,18,0.96))] px-5 py-3 text-center shadow-[0_0_0_1px_rgba(255,212,144,0.18),0_22px_54px_rgba(0,0,0,0.48),0_0_42px_rgba(208,54,44,0.30)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,186,110,0.28),transparent_42%)]" />
        <div className="relative text-[11px] font-black uppercase tracking-[0.34em] text-[#ffb37a]">
          {title}
        </div>
        <div className="relative mt-1 text-[22px] font-black tracking-[0.16em] text-[#ffe2ad] drop-shadow-[0_3px_10px_rgba(0,0,0,0.76)]">
          {scenarioTitle}
        </div>
        <div className="relative mt-1 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[#ffd0c7]">
          {triggerLabel ? <span>{triggerLabel}</span> : null}
          <span>{traitorName}</span>
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
  surface: "green-felt",
  colorset: "white",
  texture: "",
  material: "plastic",
  soundMaterial: "plastic",
  colorSpotlight: 0xf4df9a,
  shadows: true,
  gravityMultiplier: 420,
  lightIntensity: 1.08,
  baseScale: 82,
  cameraZoom: 1.2,
  initialThrowSpread: 0.86,
  settledSpreadAnimationMs: 180,
  settledFaceForwardAnimationMs: 160,
  fitWorldToCameraView: true,
  worldWidthScale: 0.82,
  worldHeightScale: 0.78,
  strength: 0.9,
  iterationLimit: 900,
  arrangeSettledDice: true,
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
  cameraZoom: 1.34,
  worldWidthScale: 0.76,
  worldHeightScale: 0.78,
  settledScreenZScale: 0.86,
  settledLayoutScale: 0.84,
  settledLayout: [
    { x: -0.72, y: -0.26, yaw: -0.12 },
    { x: 0.72, y: -0.18, yaw: 0.1 },
    { x: 0, y: 0.44, yaw: -0.04 },
  ],
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
  const diceInputs = React.useMemo(
    () =>
      roll.dice.map((pip, index) => ({
        id: index + 1,
        value: resolveBetrayalHouseD6Face(pip),
      })),
    [roll.dice],
  );
  const physicalD6Faces = React.useMemo(
    () => roll.dice.map(resolveBetrayalHouseD6Face),
    [roll.dice],
  );
  const dieSkins = React.useMemo(
    () =>
      roll.dice.map((pip) =>
        createBetrayalHouseDiceSkin(normalizeBetrayalHouseRuleValue(pip)),
      ),
    [roll.dice],
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
  const visibleRuleValues = React.useMemo(
    () =>
      roll.dice.map((pip, index) => {
        const physicalValue = physicsStates[index]?.value;
        return physicalValue
          ? (BETRAYAL_HOUSE_D6_FACE_TO_RULE_VALUE[physicalValue] ??
              normalizeBetrayalHouseRuleValue(pip))
          : normalizeBetrayalHouseRuleValue(pip);
      }),
    [physicsStates, roll.dice],
  );
  const selectableDiceTargets = React.useMemo(() => {
    const physicsTargets = physicsStates
      .map((state) => ({
        dieIndex: state.id - 1,
        layout: state.layout,
        source: "physics" as const,
      }))
      .filter(
        (target) => target.dieIndex >= 0 && target.dieIndex < roll.dice.length,
      );

    if (physicsTargets.length > 0) {
      return physicsTargets;
    }

    const spacing = 82;
    const totalWidth = Math.max(0, (roll.dice.length - 1) * spacing);
    return roll.dice.map((_, dieIndex) => ({
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
    }));
  }, [physicsStates, roll.dice]);
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
      data-dice-physics-ready={hasPhysicsState ? "true" : "false"}
      data-dice-count={roll.dice.length}
      data-dice-rule-values={roll.dice.join(",")}
      data-dice-visible-rule-values={visibleRuleValues.join(",")}
      data-dice-rule-subtotal={roll.dice.reduce((sum, pip) => sum + pip, 0)}
      data-dice-physical-d6-faces={physicalD6Faces.join(",")}
      data-dice-rerolling-die-index={rerollingDieIndex ?? undefined}
      data-dice-debug-key={canvasTestId}
      className={`relative min-h-0 overflow-visible rounded-[14px] bg-transparent ${className}`}
      style={
        visualScale !== 1
          ? {
              transform: `scale(${visualScale})`,
              transformOrigin: "center center",
            }
          : undefined
      }
    >
      <DiceBoxPhysicsSource
        dice={diceInputs}
        isRolling={animateInitialRoll && rerollingDieIndex === null}
        rerollingDiceIds={rerollingDiceIds}
        styleProfile={styleProfile}
        dieSkins={dieSkins}
        testId="betrayal-house-dice-physics-source"
        canvasTestId={canvasTestId}
        rendererMode="debug-visible"
        className="pointer-events-none absolute inset-0 h-full w-full"
        dataAttributes={{
          "data-dice-face-system": BETRAYAL_HOUSE_DICE_FACE_SYSTEM,
          "data-dice-model-source":
            "dice-box-d6-with-per-die-betrayal-0-1-2-skin",
        }}
        onPhysicsStatesChange={(states) => {
          setHasPhysicsState(states.length > 0);
          setPhysicsStates(states);
        }}
        onSettledChange={(settled) => {
          onDiceSettledChange?.(roll.id, settled);
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
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-[6px] border border-[rgba(241,221,146,0.44)] bg-[rgba(16,12,8,0.74)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#f7e6ab] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
            {rerollSelection.promptLabel}
          </div>
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
  openTable = false,
  compactResult = false,
  denseResult = false,
  diceStyleProfile = BETRAYAL_HOUSE_DICE_STYLE_PROFILE,
  diceVisualScale = 1,
  landscapeResultDock = false,
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
  openTable?: boolean;
  compactResult?: boolean;
  denseResult?: boolean;
  diceStyleProfile?: DiceBoxStyleProfile;
  diceVisualScale?: number;
  landscapeResultDock?: boolean;
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
  const resultStage = (
    <div
      data-testid="betrayal-recent-roll-result-stage"
      data-result-layout="split-primary-total"
      className={`relative grid ${
        denseResult
          ? "min-h-[72px] gap-2 px-2.5 py-1.5"
          : compactResult
            ? "min-h-[92px] gap-4 px-3 py-2"
            : "min-h-[112px] gap-4 px-4 py-3"
      } grid-cols-[minmax(0,1fr)_auto] items-center overflow-visible text-left ${
        openTable
          ? "bg-transparent shadow-none"
          : "rounded-[12px] border border-[rgba(211,179,109,0.24)] bg-[rgba(9,10,8,0.72)] shadow-[0_8px_22px_rgba(0,0,0,0.28)]"
      }`}
    >
      <div className="min-w-0">
        {showSource ? (
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c9a35e]">
            {roll.sourceTitle}
          </div>
        ) : null}
        <div className="mt-0.5 truncate text-[12px] font-semibold text-[#d8c38b]">
          {roll.rollLabel ?? t("board.roll.fallbackLabel")}
        </div>
        {showOutcome ? (
          <div
            data-testid="betrayal-recent-roll-outcome"
            data-result-role="outcome-primary"
            className={`max-w-full font-bold tracking-[0.03em] text-[#fff7c8] drop-shadow-[0_2px_8px_rgba(0,0,0,0.62)] ${
              denseResult
                ? "mt-1 whitespace-normal break-words text-[13px] leading-[18px]"
                : "mt-2 truncate text-[16px] md:text-[18px]"
            }`}
          >
            {roll.latestLabel}
          </div>
        ) : (
          <span className="sr-only">{roll.latestLabel}</span>
        )}
        <div
          data-testid="betrayal-recent-roll-breakdown"
          className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-[7px] border border-[rgba(211,179,109,0.18)] bg-[rgba(211,179,109,0.06)] px-2 py-0.5 text-[12px] font-semibold text-[#d6c498]"
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
      </div>
      <div
        data-testid="betrayal-recent-roll-total"
        data-result-emphasis="primary-total"
        className={`whitespace-nowrap border-l border-[rgba(211,179,109,0.20)] text-right font-black leading-none tracking-[0.02em] text-[#fff0a3] drop-shadow-[0_3px_10px_rgba(0,0,0,0.72)] ${
          denseResult ? "pl-2 text-[16px]" : "pl-4 text-[22px] md:text-[26px]"
        }`}
      >
        {totalLabel}
      </div>
    </div>
  );
  const srSummary = (
    <div className="sr-only">
      {showSource ? <span>{roll.sourceTitle}</span> : null}
      <span>{roll.rollLabel ?? t("board.roll.fallbackLabel")}</span>
      <span>{bonusText}</span>
      <span>{totalLabel}</span>
      <span>{roll.latestLabel}</span>
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
        <div className="grid h-full min-h-[214px] grid-cols-[minmax(300px,1fr)_minmax(214px,0.55fr)] items-center gap-3">
          <div className="relative h-full min-h-[214px] min-w-0">
            {diceStage}
          </div>
          <div className="pointer-events-auto -ml-14 flex min-h-0 min-w-0 flex-col justify-center gap-2">
            {resultStage}
            {actionSlot ? (
              <div className="flex justify-end">{actionSlot}</div>
            ) : null}
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
      className={`pointer-events-none min-h-[260px] text-[#f3e0a6] ${
        openTable
          ? "bg-transparent p-0 shadow-none"
          : "border border-[rgba(211,179,109,0.42)] bg-[linear-gradient(180deg,rgba(22,18,12,0.96),rgba(9,12,10,0.94))] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.38)]"
      } ${className}`}
    >
      <div
        className={`grid h-full min-h-[260px] ${
          denseResult
            ? "grid-rows-[minmax(210px,1fr)_auto]"
            : compactResult
              ? "grid-rows-[minmax(174px,1fr)_auto]"
              : "grid-rows-[minmax(154px,1fr)_auto]"
        } gap-2`}
      >
        {diceStage}
        {resultStage}
      </div>
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
}: {
  roll: BetrayalRecentRollState;
  isPhoneLandscapeLayout: boolean;
  canDismissByBackdrop: boolean;
  onDismiss: () => void;
  effectiveLocale: string;
  rerollSelection?: RecentRollRerollSelection | null;
}) {
  const { t } = useTranslation("game-betrayal");
  const continueButton = (
    <button
      type="button"
      data-testid="betrayal-roll-continue"
      className={`pointer-events-auto inline-flex min-h-[42px] items-center justify-center border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a] ${
        isPhoneLandscapeLayout ? "w-full min-w-0" : "min-w-[168px]"
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
              : "h-[min(38vh,330px)] min-h-[300px] w-[min(620px,100%)]"
          }
          diceClassName="min-h-[214px]"
          rerollSelection={rerollSelection}
          openTable
          compactResult
          denseResult={isPhoneLandscapeLayout}
          landscapeResultDock={isPhoneLandscapeLayout}
          actionSlot={isPhoneLandscapeLayout ? continueButton : null}
          diceStyleProfile={
            isPhoneLandscapeLayout
              ? BETRAYAL_HOUSE_DICE_MOBILE_STYLE_PROFILE
              : BETRAYAL_HOUSE_DICE_STYLE_PROFILE
          }
          diceVisualScale={isPhoneLandscapeLayout ? 1.32 : 1}
          effectiveLocale={effectiveLocale}
        />
        {isPhoneLandscapeLayout ? null : continueButton}
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
  const allExplorers = [core.currentExplorer, ...core.otherExplorers];
  const survivors = result
    ? allExplorers.filter((explorer) =>
        result.survivorsEscaped.includes(explorer.playerId),
      )
    : allExplorers.slice(0, Math.max(1, allExplorers.length - 1));
  const traitor = result
    ? (allExplorers.find(
        (explorer) => explorer.playerId === result.traitorPlayerId,
      ) ?? allExplorers[allExplorers.length - 1])
    : allExplorers[allExplorers.length - 1];
  const survivorsWon = result?.outcome !== "traitor";
  const outcomeTitle = survivorsWon
    ? t("board.endgame.victory")
    : t("board.endgame.defeat");
  const outcomeSubtitle = survivorsWon
    ? t("board.endgame.survivorsEscaped")
    : t("board.endgame.traitorSucceeded");
  const survivorsTitle = survivorsWon
    ? t("board.endgame.survivorsStatusWin")
    : t("board.endgame.survivorsStatusLose");
  const traitorTitle = survivorsWon
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
  const shouldShowEndgameRecentRoll =
    Boolean(core.recentRoll) &&
    !(
      core.recentRoll?.kind === "hauntActionTraitCheck" &&
      core.recentRoll.sourceTitle === "驱魔" &&
      core.recentRoll.trait === "sanity"
    );

  return (
    <div
      data-testid="betrayal-endgame-screen"
      data-tutorial-id="betrayal-endgame-screen"
      className="relative flex h-full min-h-full flex-col overflow-hidden bg-[#08110f] text-[#f1e8d4]"
      style={{
        backgroundImage: [
          "radial-gradient(circle at 50% 10%, rgba(156,203,77,0.14), transparent 24%)",
          "repeating-linear-gradient(90deg, rgba(45,61,50,0.04) 0 2px, rgba(0,0,0,0) 2px 22px)",
          "repeating-linear-gradient(0deg, rgba(37,52,42,0.03) 0 2px, rgba(0,0,0,0) 2px 24px)",
          "linear-gradient(180deg, #0d1714 0%, #07100e 100%)",
        ].join(","),
      }}
    >
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
              {shouldShowEndgameRecentRoll && core.recentRoll ? (
                <RecentRollPanel
                  roll={core.recentRoll}
                  className="relative z-10 w-full max-w-[520px]"
                  effectiveLocale={effectiveLocale}
                />
              ) : null}
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

                  <div className="mt-4 grid grid-cols-[1fr_1fr] gap-0 border-t border-[#6f5d3d]">
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
                        {t("board.endgame.survivorsEscaped")}。
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
                  {t("board.endgame.traitor")}
                </div>
                <div className="mt-1 text-center text-[13px] uppercase tracking-[0.18em] text-[#f1b49d]">
                  {traitorTitle}
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
                    {traitorTitle}
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
  const baseCore = React.useMemo(
    () =>
      isBetrayalCore(G?.core) ? G.core : createBetrayalCharacterSelectCore(),
    [G],
  );
  const viewerPlayerId = String(
    playerID ?? baseCore.currentPlayer ?? baseCore.playerIds[0] ?? "0",
  );
  useGameAudio({
    config: BETRAYAL_AUDIO_CONFIG,
    gameId: BETRAYAL_MANIFEST.id,
    G: baseCore,
    ctx: {
      phase: baseCore.phase,
      isGameOver: Boolean(G?.sys?.gameover) || baseCore.phase === "endgame",
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
  const [referenceScenarioTurnDirection, setReferenceScenarioTurnDirection] =
    React.useState<"back" | "forward" | null>(null);
  const [roomPreviewId, setRoomPreviewId] = React.useState<string | null>(null);
  const [inventoryPreviewCardId, setInventoryPreviewCardId] = React.useState<
    string | null
  >(null);
  const [confirmedExorciseRollId, setConfirmedExorciseRollId] = React.useState<
    string | null
  >(null);
  const [settledRecentRollId, setSettledRecentRollId] = React.useState<
    string | null
  >(null);
  const [selectedRoomMapFloor, setSelectedRoomMapFloor] = React.useState<
    BetrayalRoomNode["floor"]
  >(() => resolveExplorerFloor(baseCore));
  const roomGridRef = React.useRef<HTMLDivElement | null>(null);
  const isPhoneLandscapeLayout =
    runtimeViewport.width > 0 &&
    runtimeViewport.width <= 1023 &&
    runtimeViewport.width > runtimeViewport.height;
  const isExorciseRollReview =
    baseCore.recentRoll?.kind === "hauntActionTraitCheck" &&
    baseCore.recentRoll.sourceTitle === "驱魔" &&
    baseCore.recentRoll.trait === "sanity" &&
    confirmedExorciseRollId !== baseCore.recentRoll.id;
  const isEndgameExorciseRollReview =
    baseCore.phase === "endgame" && isExorciseRollReview;
  const core = React.useMemo<BetrayalCore>(
    () =>
      isEndgameExorciseRollReview
        ? {
            ...baseCore,
            phase: "haunt",
            recommendedAction: "endTurn",
            endgameResult: null,
          }
        : baseCore,
    [baseCore, isEndgameExorciseRollReview],
  );
  const [inspectedExplorerPlayerId, setInspectedExplorerPlayerId] =
    React.useState<string | null>(null);
  const allExplorers = React.useMemo(
    () => [core.currentExplorer, ...core.otherExplorers],
    [core.currentExplorer, core.otherExplorers],
  );
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
  const referencePages = React.useMemo(
    () => resolveReferencePages(core),
    [core],
  );
  const currentReferencePage =
    referencePages.find((page) => page.id === referenceSide) ??
    referencePages[0]!;
  const activeHauntDossier = resolveActiveHauntDossier(core);
  const activeHauntTitle = t(activeHauntDossier.titleKey);
  const activeHauntReferenceTitle = t(activeHauntDossier.referenceTitleKey);
  const referenceScenarioPages = React.useMemo(
    () => buildScenarioReaderPages(activeHauntDossier),
    [activeHauntDossier],
  );
  const referenceScenarioSpreadCount = Math.max(
    1,
    Math.ceil(referenceScenarioPages.length / 2),
  );
  const referenceScenarioLeftPage =
    referenceScenarioPages[referenceScenarioSpreadIndex * 2] ?? null;
  const referenceScenarioRightPage =
    referenceScenarioPages[referenceScenarioSpreadIndex * 2 + 1] ?? null;
  const canTurnReferenceScenarioBack = referenceScenarioSpreadIndex > 0;
  const canTurnReferenceScenarioForward =
    referenceScenarioSpreadIndex < referenceScenarioSpreadCount - 1;

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
  }, [activeHauntDossier.id]);
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

  const openScenarioReference = React.useCallback(() => {
    setReferenceScenarioSpreadIndex(0);
    setReferenceScenarioTurnDirection(null);
    setScenarioReaderOpen(true);
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
      dispatch(type, payload);
    },
    [dispatch],
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
          nextCore.recentRoll?.id === previousState.dismissedRecentRollId
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

  const handleStartScenario = React.useCallback(() => {
    dispatchCommand(BETRAYAL_COMMANDS.START_SCENARIO, {
      scenarioId: baseCore.scenarioId,
    });
  }, [baseCore.scenarioId, dispatchCommand]);
  const roomOccupants = React.useMemo(() => buildRoomOccupants(core), [core]);
  const roomMonsters = React.useMemo(() => buildRoomMonsters(core), [core]);
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
  const selectedInventoryCard =
    core.currentExplorerInventory.find(
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
  const inventoryGroups = React.useMemo(
    () => ({
      item: core.currentExplorerInventory.filter(
        (item) => item.kind === "item",
      ),
      omen: core.currentExplorerInventory.filter(
        (item) => item.kind === "omen",
      ),
    }),
    [core.currentExplorerInventory],
  );
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
  const maskTargetTokens = React.useMemo(
    () =>
      selectedInventoryUseEffectMode === "moveOthersInRoom"
        ? [
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
              .filter(
                (monster) => monster.roomId === core.currentExplorer.roomId,
              )
              .map((monster) => ({
                id: monster.id,
                name: monster.name,
                kind: "monster" as const,
              })),
          ]
        : [],
    [
      core.currentExplorer.roomId,
      core.monsters,
      core.otherExplorers,
      core.scenarioRuntime.deadExplorerPlayerIds,
      matchData,
      selectedInventoryUseEffectMode,
    ],
  );
  const selectedMaskTargetRoomIdsByTokenId =
    selectedInventoryUseEffectMode === "moveOthersInRoom"
      ? Object.fromEntries(
          maskTargetTokens.map((token) => {
            const selectedRoomId =
              previewState.selectedMaskTargetRoomIdsByTokenId[token.id];
            const validTargetRoomIds = new Set(
              maskTargetRooms.map((room) => room.id),
            );
            return [
              token.id,
              selectedRoomId && validTargetRoomIds.has(selectedRoomId)
                ? selectedRoomId
                : "",
            ];
          }),
        )
      : {};
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
  const pendingEventAcceptsUnsupportedHaunt =
    pendingEventChoice?.effect.mode === "optionalHauntRoll" &&
    !isImplementedBetrayalHauntCardNumber(
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
    ? previewState.selectedEventDamageTraits
        .filter((trait) =>
          pendingEventDamageChoice.allowedTraits.includes(trait),
        )
        .slice(0, pendingEventDamageChoice.amount)
    : [];
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
    (!pendingEventAcceptTraitChoices.length || Boolean(selectedEventTrait)) &&
    (!pendingEventTargetRooms.length || Boolean(selectedEventTargetRoomId)) &&
    (!pendingEventDamageChoice ||
      selectedEventDamageTraits.length === pendingEventDamageChoice.amount);
  const pendingEventCanDecline =
    Boolean(pendingEventChoice?.declineLabel) &&
    (!pendingEventDeclineTraitChoices.length || Boolean(selectedEventTrait));
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
  const roomMapFloors = React.useMemo(() => {
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
    if (pendingEventTargetRooms.length > 0) {
      for (const room of pendingEventTargetRooms) {
        floors.add(room.floor);
      }
    }
    return ROOM_MAP_FLOOR_ORDER.filter((floor) => floors.has(floor));
  }, [
    currentExplorerFloor,
    explorableRoomSlots,
    hasCrossFloorMoveTargets,
    inventoryTargetRooms,
    maskTargetRooms,
    moveTargetRooms,
    occupiedRoomMapFloors,
    pendingEventTargetRooms,
    previewState.interactionMode,
    selectedInventoryUseEffectMode,
  ]);
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
  const roomSelectionTargetFloors = React.useMemo(() => {
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
    return floors;
  }, [
    inventoryTargetRooms,
    maskTargetRooms,
    pendingEventTargetRooms,
    selectedInventoryUseEffectMode,
  ]);
  const upperRoomMapFloorHasSelectionTarget = upperRoomMapFloor
    ? roomSelectionTargetFloors.has(upperRoomMapFloor)
    : false;
  const lowerRoomMapFloorHasSelectionTarget = lowerRoomMapFloor
    ? roomSelectionTargetFloors.has(lowerRoomMapFloor)
    : false;
  const hasCrossFloorRoomSelectionTargets =
    upperRoomMapFloorHasSelectionTarget || lowerRoomMapFloorHasSelectionTarget;
  const nextDeckKind = React.useMemo(() => {
    for (let index = 0; index < core.drawOrder.length; index += 1) {
      const kind =
        core.drawOrder[(core.exploreIndex + index) % core.drawOrder.length]!;
      if (core.deckCounts[kind] > 0) {
        return kind;
      }
    }
    return null;
  }, [core.deckCounts, core.drawOrder, core.exploreIndex]);
  const canStartExploreSelection = Boolean(
    core.phase === "preHaunt" &&
    !core.turnEndedByDiscovery &&
    nextDeckKind &&
    explorableRoomSlots.length > 0,
  );
  const canDeclareHolySymbolExplore = canUseHolySymbolForDiscovery(core);
  const canDeclareIdolExplore =
    canUseIdolToSkipEvent(core) && nextDeckKind === "event";
  const useHolySymbolForExplore =
    previewState.useHolySymbolForExplore && canDeclareHolySymbolExplore;
  const useIdolForExplore =
    previewState.useIdolForExplore && canDeclareIdolExplore;
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
    : (selectedInventoryCard?.name ?? "");
  const selectedTradeGiveText =
    selectedTradeGiveCardNames || t("board.status.tradeOfferNone");
  const selectedTradeReturnText =
    selectedTradeReturnCardNames || t("board.status.tradeReturnNone");
  const tradeReturnSelectorLabel = t("board.status.tradeReturnLabel");
  const isTradeOrLootTargetSelectionActive =
    core.recommendedAction === "trade" ||
    previewState.tradeSelectionTouched ||
    Boolean(selectedInventoryCard) ||
    selectedDogTradeCardIds.length > 0 ||
    selectedTradeReturnCardIds.length > 0;
  const attackWeaponCards = React.useMemo(
    () => resolveAttackWeaponCards(core),
    [core],
  );
  const selectedAttackWeaponCardId = attackWeaponCards.some(
    (card) => card.id === previewState.selectedAttackWeaponCardId,
  )
    ? previewState.selectedAttackWeaponCardId
    : null;
  const selectedAttackWeaponCardIdRef = React.useRef<string | null>(null);
  React.useLayoutEffect(() => {
    selectedAttackWeaponCardIdRef.current = selectedAttackWeaponCardId;
  }, [selectedAttackWeaponCardId]);
  const healTargetExplorers = React.useMemo(
    () =>
      selectedInventoryUseEffectMode === "healTraits" &&
      selectedInventoryHealTarget === "selfOrSameRoomExplorer"
        ? [
            core.currentExplorer,
            ...core.otherExplorers.filter(
              (explorer) =>
                explorer.roomId === core.currentExplorer.roomId &&
                !core.scenarioRuntime.deadExplorerPlayerIds.includes(
                  explorer.playerId,
                ),
            ),
          ]
        : [],
    [
      core.currentExplorer,
      core.otherExplorers,
      core.scenarioRuntime.deadExplorerPlayerIds,
      selectedInventoryHealTarget,
      selectedInventoryUseEffectMode,
    ],
  );
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
      : t("board.status.tradeOfferNone")
    : "";
  const pendingTradeReturnText = pendingTradeAgreement
    ? pendingTradeAgreement.targetCardIds.length > 0
      ? pendingTradeReturnCardNames ||
        t("board.status.tradeAgreementUnknownCards")
      : t("board.status.tradeReturnNone")
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
  const hasPendingPlayerAgreement = Boolean(
    pendingTradeAgreement || pendingSicknessExchange,
  );
  const tradeSelectionReady = Boolean(
    selectedTradeTarget &&
    (selectedInventoryCard ||
      selectedDogTradeCardIds.length > 0 ||
      selectedTradeReturnCardIds.length > 0),
  );
  const shouldShowInlineTradeConfirm = Boolean(
    !pendingTradeAgreement &&
    !pendingSicknessExchange &&
    !isDustSicknessExchangeMode &&
    core.recommendedAction === "trade" &&
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
  const selectedCardAvailableThisTurn = selectedInventoryCard
    ? core.turnStartInventoryCardIds.includes(selectedInventoryCard.id)
    : false;
  const selectedCardCanUseRabbitFoot = selectedInventoryCard
    ? canUseRabbitFootForRecentRoll(
        core,
        core.currentExplorer.playerId,
        selectedInventoryCard.id,
      )
    : false;
  const rabbitFootRerollSelection =
    selectedCardCanUseRabbitFoot && core.recentRoll
      ? {
          promptLabel: t("board.inventory.rabbitFoot"),
          getDieActionLabel: (dieIndex: number) =>
            t("board.inventory.rerollDie", { index: dieIndex + 1 }),
          onSelectDie: (dieIndex: number) => {
            dispatchCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, {
              cardId: selectedInventoryCard?.id,
              dieIndex,
            });
            setInventoryPreviewCardId(null);
            setPreviewState((previousState) => ({
              ...previousState,
              selectedInventoryCardId: null,
            }));
          },
        }
      : null;
  const rollModifierCardIds = React.useMemo(
    () =>
      new Set(
        core.currentExplorerInventory
          .filter((card) =>
            canUseRabbitFootForRecentRoll(
              core,
              core.currentExplorer.playerId,
              card.id,
            ),
          )
          .map((card) => card.id),
      ),
    [core],
  );
  const selectedCardNeedsTargetRoom =
    selectedInventoryUseEffectMode === "moveOthersInRoom";
  const selectedCardNeedsPlaceRoom =
    selectedInventoryUseEffectMode === "placeExplorer";
  const selectedCardNeedsHealTarget =
    selectedInventoryUseEffectMode === "healTraits" &&
    selectedInventoryHealTarget === "selfOrSameRoomExplorer" &&
    healTargetExplorers.length > 0;
  const selectedCardUseDisabled =
    !selectedInventoryCard ||
    Boolean(
      (!selectedInventoryUseEffect && !selectedCardCanUseRabbitFoot) ||
      !selectedCardAvailableThisTurn ||
      selectedCardUsedThisTurn ||
      (selectedCardNeedsPlaceRoom && !selectedInventoryTargetRoomId) ||
      (selectedCardNeedsHealTarget && !selectedInventoryTargetPlayerId) ||
      (selectedCardNeedsTargetRoom &&
        (maskTargetTokens.length === 0 ||
          maskTargetTokens.some(
            (token) => !selectedMaskTargetRoomIdsByTokenId[token.id],
          ))),
    );
  const tradeStatusText = pendingSicknessExchange
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
      : isDustSicknessExchangeAvailable
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
    if (isDustSicknessExchangeAvailable) {
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
      (selectedInventoryCard || selectedTradeReturnCardIds.length > 0)
    ) {
      return selectedTradeReturnCardIds.length > 0
        ? selectedInventoryCard
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
    if (selectedInventoryCard) {
      return t("board.status.tradeFlowNeedTarget", {
        card: selectedInventoryCard.name,
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
    isDustSicknessExchangeAvailable ||
    core.recommendedAction !== "trade" ||
    Boolean(selectedCorpseLootTarget) ||
    hasCorpseLootTargets ||
    activeTradeTargets.length === 0;
  const useStatusText = selectedInventoryCard
    ? selectedCardUsedThisTurn
      ? t("board.status.cardUsedThisTurn")
      : selectedCardAvailableThisTurn
        ? t("board.status.usePreview", {
            effect: resolvePreviewUseEffectLabel(selectedInventoryCard, t),
          })
        : t("board.status.cardUnavailableThisTurn")
    : lastUsedInventoryCardStillUsed
      ? t("board.status.cardUsedThisTurn")
      : t("board.status.noSelectedCard");
  const magicCameraPhotoTargets = React.useMemo(
    () =>
      core.phase === "haunt"
        ? core.otherExplorers.filter((explorer) =>
            canTakeMagicCameraPhoto(
              core,
              core.currentExplorer,
              explorer.playerId,
            ),
          )
        : [],
    [core],
  );
  const magicCameraPhotoTargetPlayerIds = React.useMemo(
    () => new Set(magicCameraPhotoTargets.map((target) => target.playerId)),
    [magicCameraPhotoTargets],
  );
  const magicCameraPhotoTarget =
    (selectedTradeTargetPlayerId &&
      magicCameraPhotoTargets.find(
        (explorer) => explorer.playerId === selectedTradeTargetPlayerId,
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
  const phantomPhotographerTargetPlayerIds = React.useMemo(
    () =>
      new Set(
        phantomPhotographerAttackOptions.map((option) => option.targetPlayerId),
      ),
    [phantomPhotographerAttackOptions],
  );
  const phantomPhotographerAttackOption =
    (selectedTradeTargetPlayerId &&
      phantomPhotographerAttackOptions.find(
        (option) => option.targetPlayerId === selectedTradeTargetPlayerId,
      )) ||
    phantomPhotographerAttackOptions[0] ||
    null;
  const hungryHouseRuntime = core.scenarioRuntime.hungryHouse ?? null;
  const isHungryHouseHauntActive = Boolean(
    core.phase === "haunt" &&
    core.scenarioRuntime.hauntCardNumber === 12 &&
    hungryHouseRuntime,
  );
  const hungryHouseCarriableCorpses = React.useMemo(
    () =>
      isHungryHouseHauntActive
        ? resolveHungryHouseCarriableCorpses(core, core.currentExplorer)
        : [],
    [core, isHungryHouseHauntActive],
  );
  const hungryHouseCarriableCorpse = hungryHouseCarriableCorpses[0] ?? null;
  const hungryHouseCarriedCorpse =
    hungryHouseRuntime?.carriedCorpseByPlayerId[
      core.currentExplorer.playerId
    ] ?? null;
  const hungryHouseCanFeed = Boolean(
    isHungryHouseHauntActive &&
    hungryHouseRuntime &&
    !isCurrentExplorerDead &&
    hungryHouseCarriedCorpse &&
    core.currentExplorer.roomId === hungryHouseRuntime.chasmRoomId &&
    !core.usedCardIdsThisTurn.includes("feed-her"),
  );
  const hungryHouseSameRoomCultists = React.useMemo(
    () =>
      isHungryHouseHauntActive && hungryHouseRuntime && !isCurrentExplorerDead
        ? core.monsters.filter(
            (monster) =>
              hungryHouseRuntime.cultistIds.includes(monster.id) &&
              monster.roomId === core.currentExplorer.roomId,
          )
        : [],
    [
      core.currentExplorer.roomId,
      core.monsters,
      hungryHouseRuntime,
      isCurrentExplorerDead,
      isHungryHouseHauntActive,
    ],
  );
  const hungryHouseTargetCultist = hungryHouseSameRoomCultists[0] ?? null;
  const hungryHouseTargetCultistIds = React.useMemo(
    () => new Set(hungryHouseSameRoomCultists.map((monster) => monster.id)),
    [hungryHouseSameRoomCultists],
  );
  const hungryHouseCultistAttackOptions = React.useMemo(() => {
    if (!isHungryHouseHauntActive || !hungryHouseRuntime) {
      return [];
    }
    return core.monsters
      .filter((monster) => hungryHouseRuntime.cultistIds.includes(monster.id))
      .flatMap((monster) =>
        allExplorers
          .filter(
            (explorer) =>
              explorer.roomId === monster.roomId &&
              !core.scenarioRuntime.deadExplorerPlayerIds.includes(
                explorer.playerId,
              ),
          )
          .map((explorer) => ({
            monsterId: monster.id,
            targetPlayerId: explorer.playerId,
          })),
      );
  }, [
    allExplorers,
    core.monsters,
    core.scenarioRuntime.deadExplorerPlayerIds,
    hungryHouseRuntime,
    isHungryHouseHauntActive,
  ]);
  const hungryHouseCultistTargetPlayerIds = React.useMemo(
    () =>
      new Set(
        hungryHouseCultistAttackOptions.map((option) => option.targetPlayerId),
      ),
    [hungryHouseCultistAttackOptions],
  );
  const hungryHouseCultistAttackOption =
    (previewState.selectedTradeTargetPlayerId &&
      hungryHouseCultistAttackOptions.find(
        (option) =>
          option.targetPlayerId === previewState.selectedTradeTargetPlayerId,
      )) ||
    hungryHouseCultistAttackOptions[0] ||
    null;
  const hungryHouseRitualRoomName = hungryHouseRuntime
    ? (core.rooms.find((room) => room.id === hungryHouseRuntime.ritualRoomId)
        ?.name ?? t("board.rooms.unknown"))
    : "";
  const hungryHouseChasmRoomName = hungryHouseRuntime
    ? (core.rooms.find((room) => room.id === hungryHouseRuntime.chasmRoomId)
        ?.name ?? t("board.rooms.unknown"))
    : "";
  const hungryHouseCultistCorpseCount = hungryHouseRuntime
    ? Object.keys(hungryHouseRuntime.cultistCorpseRoomIds).length
    : 0;
  const hungryHouseCarriedCorpseName =
    hungryHouseCarriedCorpse?.name ?? t("board.hungryHouse.none");
  const hauntActionContext = React.useMemo(() => {
    if (core.phase !== "haunt") {
      return null;
    }
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    const isTraitor =
      core.scenarioRuntime.traitorPlayerId === core.currentExplorer.playerId;
    const isCrimsonJackHaunt = core.scenarioRuntime.hauntCardNumber === 1;
    const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(
      core.currentExplorer.playerId,
    );
    const canLearnAboutJack =
      isCrimsonJackHaunt &&
      !isTraitor &&
      !isDead &&
      isBetrayalLibraryRoom(activeRoom) &&
      [core.currentExplorer, ...core.otherExplorers].some(
        (explorer) =>
          explorer.playerId !== core.scenarioRuntime.traitorPlayerId &&
          !core.scenarioRuntime.deadExplorerPlayerIds.includes(
            explorer.playerId,
          ) &&
          !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(
            explorer.playerId,
          ),
      ) &&
      !core.usedCardIdsThisTurn.includes("learn-about-jack");
    const canStudyExorcism =
      isCrimsonJackHaunt &&
      !isTraitor &&
      !isDead &&
      activeRoom?.discoveryReward === "event" &&
      !core.usedCardIdsThisTurn.includes("study-exorcism");
    const canExorciseJack =
      isCrimsonJackHaunt &&
      !isTraitor &&
      !isDead &&
      Boolean(core.scenarioRuntime.jackSpiritReleased) &&
      core.activeRoomId === core.scenarioRuntime.jackSpiritRoomId &&
      !core.usedCardIdsThisTurn.includes("exorcise-jack");
    const dustSearchTrait =
      core.currentExplorer.traits.knowledge >=
      core.currentExplorer.traits.sanity
        ? ("knowledge" as const)
        : ("sanity" as const);
    const dustCureTrait = (
      ["might", "speed", "knowledge", "sanity"] as BetrayalTraitKey[]
    ).reduce(
      (bestTrait, trait) =>
        core.currentExplorer.traits[trait] >
        core.currentExplorer.traits[bestTrait]
          ? trait
          : bestTrait,
      "knowledge" as BetrayalTraitKey,
    );
    const canSearchDustCure =
      !isDead &&
      canSearchForCure(core, core.currentExplorer) &&
      !core.usedCardIdsThisTurn.includes("search-for-cure");
    const canCureDust =
      !isDead &&
      canCureTheDust(core, core.currentExplorer) &&
      !core.usedCardIdsThisTurn.includes("cure-the-dust");
    const canAttackTraitor =
      !isTraitor &&
      !isDead &&
      core.otherExplorers.some(
        (explorer) =>
          explorer.playerId === core.scenarioRuntime.traitorPlayerId &&
          explorer.roomId === core.activeRoomId,
      );
    const heroAttackTargets = isTraitor
      ? core.otherExplorers.filter(
          (explorer) =>
            !core.scenarioRuntime.deadExplorerPlayerIds.includes(
              explorer.playerId,
            ) && explorer.roomId === core.activeRoomId,
        )
      : [];
    const canSmashCamera = canSmashMagicCamera(core, core.currentExplorer);

    if (hungryHouseCarriableCorpse) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.PICK_UP_CORPSE,
        payload: {
          corpseKind: hungryHouseCarriableCorpse.kind,
          corpseId: hungryHouseCarriableCorpse.corpseId,
          ...(hungryHouseCarriableCorpse.sourcePlayerId
            ? { sourcePlayerId: hungryHouseCarriableCorpse.sourcePlayerId }
            : {}),
        },
        label: t("board.status.focusPickUpCorpse", {
          corpse: hungryHouseCarriableCorpse.name,
        }),
        cue: t("board.status.actionCuePickUpCorpse", {
          corpse: hungryHouseCarriableCorpse.name,
        }),
      };
    }
    if (hungryHouseCanFeed) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.FEED_HER,
        label: t("board.status.focusFeedHer"),
        cue: t("board.status.actionCueFeedHer"),
      };
    }
    if (hungryHouseTargetCultist) {
      return {
        actionKind: "attack-cultist" as const,
        targetMonsterId: hungryHouseTargetCultist.id,
        label: t("board.status.focusAttackCultist"),
        cue: t("board.status.actionCueAttackCultist"),
      };
    }
    if (hungryHouseCultistAttackOption) {
      const target = allExplorers.find(
        (explorer) =>
          explorer.playerId === hungryHouseCultistAttackOption.targetPlayerId,
      );
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.CULTIST_ATTACK,
        payload: {
          monsterId: hungryHouseCultistAttackOption.monsterId,
          targetPlayerId: hungryHouseCultistAttackOption.targetPlayerId,
        },
        label: t("board.status.focusCultistAttack", {
          player: resolvePlayerName(
            hungryHouseCultistAttackOption.targetPlayerId,
            target?.displayName ??
              hungryHouseCultistAttackOption.targetPlayerId,
            matchData,
          ),
        }),
        cue: t("board.status.actionCueCultistAttack", {
          player: resolvePlayerName(
            hungryHouseCultistAttackOption.targetPlayerId,
            target?.displayName ??
              hungryHouseCultistAttackOption.targetPlayerId,
            matchData,
          ),
        }),
      };
    }
    if (magicCameraPhotoTarget) {
      return {
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
      };
    }
    if (canSmashCamera) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA,
        label: t("board.status.focusSmashMagicCamera"),
        cue: t("board.status.actionCueSmashMagicCamera"),
      };
    }
    if (phantomPhotographerAttackOption) {
      const target = core.otherExplorers.find(
        (explorer) =>
          explorer.playerId === phantomPhotographerAttackOption.targetPlayerId,
      );
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK,
        payload: {
          monsterId: phantomPhotographerAttackOption.monsterId,
          targetPlayerId: phantomPhotographerAttackOption.targetPlayerId,
        },
        label: t("board.status.focusPhantomPhotographerAttack", {
          player: resolvePlayerName(
            phantomPhotographerAttackOption.targetPlayerId,
            target?.displayName ??
              phantomPhotographerAttackOption.targetPlayerId,
            matchData,
          ),
        }),
        cue: t("board.status.actionCuePhantomPhotographerAttack", {
          player: resolvePlayerName(
            phantomPhotographerAttackOption.targetPlayerId,
            target?.displayName ??
              phantomPhotographerAttackOption.targetPlayerId,
            matchData,
          ),
        }),
      };
    }
    if (canExorciseJack) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.EXORCISE_JACK,
        label: t("board.status.focusExorciseJack"),
        cue: t("board.status.actionCueExorciseJack"),
      };
    }
    if (isDustSicknessExchangeMode) {
      return {
        actionKind: "sickness-exchange" as const,
        label: t("board.status.focusSicknessExchange"),
        cue: t("board.status.actionCueSicknessExchange"),
      };
    }
    if (canCureDust) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.CURE_THE_DUST,
        payload: { trait: dustCureTrait },
        label: t("board.status.focusCureTheDust", {
          trait: t(`board.traits.${dustCureTrait}`),
        }),
        cue: t("board.status.actionCueCureTheDust", {
          trait: t(`board.traits.${dustCureTrait}`),
        }),
      };
    }
    if (canSearchDustCure) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
        payload: { trait: dustSearchTrait },
        label: t("board.status.focusSearchForCure", {
          trait: t(`board.traits.${dustSearchTrait}`),
        }),
        cue: t("board.status.actionCueSearchForCure", {
          trait: t(`board.traits.${dustSearchTrait}`),
        }),
      };
    }
    if (dustSameRoomLivingTargets.length > 0) {
      return {
        actionKind: "attack-dust" as const,
        label: t("board.status.focusAttackDust"),
        cue: t("board.status.actionCueAttackDust"),
      };
    }
    if (canLearnAboutJack) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
        label: t("board.status.focusLearnAboutJack"),
        cue: t("board.status.actionCueLearnAboutJack"),
      };
    }
    if (canStudyExorcism) {
      return {
        actionKind: "use" as const,
        commandType: BETRAYAL_COMMANDS.STUDY_EXORCISM,
        label: t("board.status.focusStudyExorcism"),
        cue: t("board.status.actionCueStudyExorcism"),
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
      const heroTarget =
        heroAttackTargets.find(
          (explorer) => explorer.playerId === selectedTradeTargetPlayerId,
        ) ?? null;
      if (!heroTarget) {
        return null;
      }
      return {
        actionKind: "attack-hero" as const,
        label: t("board.status.focusAttackHero", {
          player: resolvePlayerName(
            heroTarget.playerId,
            heroTarget.displayName,
            matchData,
          ),
        }),
        cue: t("board.status.actionCueAttackHero", {
          player: resolvePlayerName(
            heroTarget.playerId,
            heroTarget.displayName,
            matchData,
          ),
        }),
        targetPlayerId: heroTarget.playerId,
      };
    }
    return null;
  }, [
    allExplorers,
    core,
    dustSameRoomLivingTargets.length,
    hungryHouseCanFeed,
    hungryHouseCarriableCorpse,
    hungryHouseCultistAttackOption,
    hungryHouseTargetCultist,
    isDustSicknessExchangeMode,
    magicCameraPhotoTarget,
    magicCameraPhotoTrait,
    matchData,
    phantomPhotographerAttackOption,
    selectedTradeTargetPlayerId,
    t,
  ]);
  const hauntGoalProgressRows: HauntGoalProgressRow[] = (() => {
    switch (activeHauntDossier.id) {
      case "dust": {
        const sicknessTokenCount = Object.values(
          dustRuntime?.sicknessTokensByPlayerId ?? {},
        ).reduce((total, tokens) => total + tokens.length, 0);
        return [
          {
            id: "research",
            label: t("board.haunts.dust.progress.research"),
            value: t("board.haunts.goalCard.count", {
              current: dustRuntime?.researchRoomIds.length ?? 0,
              total: 3,
            }),
          },
          {
            id: "sickness",
            label: t("board.haunts.dust.progress.sickness"),
            value: String(sicknessTokenCount),
          },
          {
            id: "exchange",
            label: t("board.haunts.dust.progress.exchange"),
            value: dustSameRoomLivingTargets.length
              ? t("board.haunts.goalCard.available")
              : t("board.haunts.goalCard.waiting"),
          },
        ];
      }
      case "hungryHouse":
        return [
          {
            id: "hunger",
            label: t("board.haunts.hungryHouse.progress.hunger"),
            value: String(hungryHouseRuntime?.ritualProgress ?? 0),
          },
          {
            id: "rooms",
            label: t("board.haunts.hungryHouse.progress.rooms"),
            value: t("board.haunts.hungryHouse.progress.roomsValue", {
              ritual: hungryHouseRitualRoomName,
              chasm: hungryHouseChasmRoomName,
            }),
          },
          {
            id: "corpse",
            label: t("board.haunts.hungryHouse.progress.corpse"),
            value: hungryHouseCarriedCorpseName,
          },
          {
            id: "corpseCount",
            label: t("board.haunts.hungryHouse.progress.corpseCount"),
            value: String(hungryHouseCultistCorpseCount),
          },
        ];
      case "magicCamera": {
        const magicCamera = core.scenarioRuntime.magicCamera;
        const remainingEssence = magicCamera?.heroEssencePlayerIds.length ?? 0;
        const capturedEssence =
          magicCamera?.capturedEssencePlayerIds.length ?? 0;
        const activePhotographers =
          magicCamera?.phantomPhotographerIds.filter(
            (id) => !magicCamera.killedPhantomPhotographerIds.includes(id),
          ).length ?? 0;
        return [
          {
            id: "essence",
            label: t("board.haunts.magicCamera.progress.essence"),
            value: t("board.haunts.magicCamera.progress.essenceValue", {
              captured: capturedEssence,
              remaining: remainingEssence,
            }),
          },
          {
            id: "photographers",
            label: t("board.haunts.magicCamera.progress.photographers"),
            value: String(activePhotographers),
          },
          {
            id: "camera",
            label: t("board.haunts.magicCamera.progress.camera"),
            value: magicCamera?.cameraDestroyed
              ? t("board.haunts.magicCamera.progress.cameraDestroyed")
              : t("board.haunts.magicCamera.progress.cameraActive"),
          },
        ];
      }
      case "crimsonJack":
      default:
        return [
          {
            id: "knowledge",
            label: t("board.haunts.crimsonJack.progress.knowledge"),
            value: t("board.haunts.goalCard.count", {
              current: core.scenarioRuntime.knowledgeOfJackPlayerIds.length,
              total: 2,
            }),
          },
          {
            id: "circles",
            label: t("board.haunts.crimsonJack.progress.circles"),
            value: t("board.haunts.goalCard.count", {
              current: core.scenarioRuntime.exorcismCircleRoomIds.length,
              total: 2,
            }),
          },
          {
            id: "spirit",
            label: t("board.haunts.crimsonJack.progress.spirit"),
            value: core.scenarioRuntime.jackSpiritReleased
              ? t("board.haunts.goalCard.yes")
              : t("board.haunts.goalCard.no"),
          },
        ];
    }
  })();
  const hauntTargetGuide: HauntTargetGuide | null = React.useMemo(() => {
    if (core.phase !== "haunt") {
      return null;
    }
    const targetActionKind =
      previewState.interactionMode === "sicknessExchange"
        ? "sickness-exchange"
        : hauntActionContext?.actionKind;
    if (!targetActionKind) {
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
      case "attack-cultist": {
        if (hauntActionContext?.actionKind !== "attack-cultist") {
          return null;
        }
        const monster = core.monsters.find(
          (item) => item.id === hauntActionContext.targetMonsterId,
        );
        const hasMultipleCultistTargets =
          hungryHouseSameRoomCultists.length > 1;
        return {
          kind: "monster",
          roomId: monster?.roomId ?? null,
          monsterId: hauntActionContext.targetMonsterId,
          targetName: hasMultipleCultistTargets
            ? t("board.status.targetAnyCultist")
            : (monster?.name ?? t("board.status.targetCultist")),
          cue: hasMultipleCultistTargets
            ? t("board.status.localCueAttackAnyCultist")
            : t("board.status.localCueAttackCultist"),
        };
      }
      case "sickness-exchange": {
        const target =
          dustSameRoomLivingTargets.find(
            (item) => item.playerId === selectedTradeTargetPlayerId,
          ) ??
          dustSameRoomLivingTargets[0] ??
          null;
        return resolveExplorerGuide(
          target?.playerId,
          t("board.status.localCueExchangeSickness"),
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
          core.scenarioRuntime.traitorPlayerId,
          t("board.status.localCueAttackExplorer"),
        );
      case "attack-hero":
        if (hauntActionContext?.actionKind !== "attack-hero") {
          return null;
        }
        return resolveExplorerGuide(
          hauntActionContext.targetPlayerId,
          t("board.status.localCueAttackExplorer"),
        );
      default:
        return null;
    }
  }, [
    allExplorers,
    core.monsters,
    core.phase,
    core.scenarioRuntime.traitorPlayerId,
    dustSameRoomLivingTargets,
    hauntActionContext,
    hungryHouseSameRoomCultists.length,
    matchData,
    previewState.interactionMode,
    selectedTradeTargetPlayerId,
    t,
  ]);
  const activeHauntTargetGuide =
    hauntTargetGuide &&
    (previewState.hauntTargetingActionKind === hauntActionContext?.actionKind ||
      previewState.interactionMode === "sicknessExchange")
      ? hauntTargetGuide
      : null;
  const isHauntTargetingMode = Boolean(activeHauntTargetGuide);
  const activeHauntNextStepText = isHauntTargetingMode
    ? t("board.status.hauntTargetingNext")
    : (hauntActionContext?.label ??
      t(`board.haunts.${activeHauntDossier.id}.nextFallback`));
  const activeHauntPrimaryActionText = isHauntTargetingMode
    ? t("board.status.hauntTargetingPrimary")
    : hauntActionContext
      ? hauntActionContext.label
      : t("board.haunts.goalCard.noPrimaryAction");
  const activeHauntActionHintText = isHauntTargetingMode
    ? t("board.status.hauntTargetingHint", {
        cue: activeHauntTargetGuide?.cue,
        target: activeHauntTargetGuide?.targetName,
      })
    : (hauntActionContext?.cue ?? t("board.haunts.goalCard.noActionHint"));
  const activeHauntPrimaryActionMode = isHauntTargetingMode
    ? "targeting"
    : hauntActionContext?.actionKind === "use"
      ? "execute"
      : hauntActionContext
        ? "choose-target"
        : "unavailable";
  const heroAttackTargetPlayerIds = React.useMemo(() => {
    if (
      core.phase !== "haunt" ||
      core.scenarioRuntime.traitorPlayerId !== core.currentExplorer.playerId
    ) {
      return new Set<string>();
    }
    return new Set(
      core.otherExplorers
        .filter(
          (explorer) =>
            !core.scenarioRuntime.deadExplorerPlayerIds.includes(
              explorer.playerId,
            ) && explorer.roomId === core.activeRoomId,
        )
        .map((explorer) => explorer.playerId),
    );
  }, [
    core.activeRoomId,
    core.currentExplorer.playerId,
    core.otherExplorers,
    core.phase,
    core.scenarioRuntime.deadExplorerPlayerIds,
    core.scenarioRuntime.traitorPlayerId,
  ]);
  const latestDiscoveryKey = buildLatestDiscoveryKey(core);
  const latestDiscoveryHauntRollForOwner = Boolean(
    core.latestDiscovery?.kind === "omen" &&
    core.recentRoll?.kind === "hauntRoll" &&
    core.latestDiscoveryOwnerPlayerId === core.recentRoll.playerId &&
    core.recentRoll.sourceTitle === core.latestDiscovery.title,
  );
  const shouldShowLatestDiscovery = Boolean(
    core.latestDiscovery &&
    (core.latestDiscoveryOwnerPlayerId === core.currentExplorer.playerId ||
      latestDiscoveryHauntRollForOwner) &&
    latestDiscoveryKey !== previewState.dismissedLatestDiscoveryKey,
  );
  const isConfirmedExorciseRoll =
    core.recentRoll?.kind === "hauntActionTraitCheck" &&
    core.recentRoll.sourceTitle === "驱魔" &&
    core.recentRoll.trait === "sanity" &&
    confirmedExorciseRollId === core.recentRoll.id;
  const isRecentRollDismissed = Boolean(
    core.recentRoll &&
    previewState.dismissedRecentRollId === core.recentRoll.id,
  );
  React.useEffect(() => {
    setSettledRecentRollId((previousRollId) =>
      previousRollId === core.recentRoll?.id ? previousRollId : null,
    );
  }, [core.recentRoll?.id]);
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
      settledRecentRollId === core.recentRoll.id);
  const attackImpactPresentationKey =
    core.recentRoll?.kind === "attackRoll" && isAttackImpactReady
      ? `${core.recentRoll.id}:${isRecentRollDismissed ? "board" : "review"}`
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
  const hauntRevealTraitor = core.scenarioRuntime.traitorPlayerId
    ? (allExplorers.find(
        (explorer) =>
          explorer.playerId === core.scenarioRuntime.traitorPlayerId,
      ) ?? null)
    : null;
  const shouldShowHauntRevealCue = Boolean(
    core.phase === "haunt" &&
    core.scenarioRuntime.hauntTriggered &&
    core.latestDiscovery &&
    latestDiscoveryKey !== previewState.dismissedLatestDiscoveryKey,
  );
  const hauntRevealTraitorName = hauntRevealTraitor
    ? t("board.status.hauntRevealTraitor", {
        player: resolvePlayerName(
          hauntRevealTraitor.playerId,
          hauntRevealTraitor.displayName,
          matchData,
        ),
      })
    : t("board.status.hauntRevealTraitorUnknown");
  const hasRecentRollModifier = rollModifierCardIds.size > 0;
  const shouldShowLatestDiscoveryRoll = Boolean(
    shouldShowLatestDiscovery &&
    !isRecentRollDismissed &&
    core.recentRoll &&
    ((core.latestDiscovery?.kind === "event" &&
      (core.recentRoll.kind === "eventTraitCheck" ||
        core.recentRoll.kind === "eventDiceRoll")) ||
      (core.latestDiscovery?.kind === "omen" &&
        core.recentRoll.kind === "hauntRoll")) &&
    core.recentRoll.sourceTitle === core.latestDiscovery.title,
  );
  const canDismissLatestDiscoveryByBackdrop =
    !shouldShowLatestDiscoveryRoll || !hasRecentRollModifier;
  const canDismissRecentRollByBackdrop = !hasRecentRollModifier;
  const shouldShowBlockingRecentRollOverlay = Boolean(
    core.recentRoll &&
    !isRecentRollDismissed &&
    !isConfirmedExorciseRoll &&
    !pendingEventChoice &&
    !shouldShowLatestDiscovery,
  );
  const shouldHideBlockingTableChrome = Boolean(
    shouldShowLatestDiscovery || shouldShowBlockingRecentRollOverlay,
  );
  const shouldSuppressMobileBlockingRollChrome =
    isPhoneLandscapeLayout && shouldShowBlockingRecentRollOverlay;
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
  const latestDiscoveryTitle = core.latestDiscovery?.title;
  const latestDiscoveryKindLabel = core.latestDiscovery
    ? {
        event: t("board.discovery.eventCard"),
        item: t("board.discovery.itemCard"),
        omen: t("board.discovery.omenCard"),
      }[core.latestDiscovery.kind]
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
    if (!core.latestDiscoveryOwnerPlayerId) {
      return core.currentExplorerInventory;
    }
    const owner = [core.currentExplorer, ...core.otherExplorers].find(
      (explorer) => explorer.playerId === core.latestDiscoveryOwnerPlayerId,
    );
    return owner?.inventory ?? core.currentExplorerInventory;
  }, [
    core.currentExplorer,
    core.currentExplorerInventory,
    core.latestDiscoveryOwnerPlayerId,
    core.otherExplorers,
  ]);
  const latestDiscoveryVisual = React.useMemo(
    () =>
      resolveDiscoveryAtlasVisual(
        core.latestDiscovery ?? eventChoiceDiscoveryForVisual,
        latestDiscoveryOwnerInventory,
      ),
    [
      core.latestDiscovery,
      eventChoiceDiscoveryForVisual,
      latestDiscoveryOwnerInventory,
    ],
  );
  const handleDismissLatestDiscovery = React.useCallback(() => {
    if (!latestDiscoveryKey) {
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      dismissedLatestDiscoveryKey: latestDiscoveryKey,
      dismissedRecentRollId:
        core.recentRoll?.sourceTitle === latestDiscoveryTitle
          ? core.recentRoll.id
          : previousState.dismissedRecentRollId,
    }));
  }, [core.recentRoll, latestDiscoveryKey, latestDiscoveryTitle]);
  const handleDismissRecentRoll = React.useCallback(() => {
    if (!core.recentRoll?.id) {
      return;
    }
    if (
      core.recentRoll.kind === "roomEndTurnTraitCheck" &&
      core.recentRoll.roomEndTurn?.nextPlayerId
    ) {
      dispatchCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, {});
    }
    setPreviewState((previousState) => ({
      ...previousState,
      dismissedRecentRollId:
        core.recentRoll?.id ?? previousState.dismissedRecentRollId,
    }));
  }, [core.recentRoll, dispatchCommand]);
  const handleConfirmExorciseRollReview = React.useCallback(() => {
    setConfirmedExorciseRollId(core.recentRoll?.id ?? null);
  }, [core.recentRoll?.id]);
  const turnHintText =
    previewState.interactionMode === "move"
      ? t("board.activity.chooseMoveTarget")
      : previewState.interactionMode === "explore"
        ? t("board.activity.chooseExploreTarget")
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
    if (hauntActionContext?.actionKind === "use") {
      return {
        label: hauntActionContext.label,
        actionKind: "use" as const,
        roomId: core.activeRoomId,
      };
    }
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
    return null;
  })();
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
      return canStartExploreSelection
        ? t("board.status.actionCueExploreSelect")
        : t("board.status.actionCueExplore", {
            floor: t("board.rooms.unknown"),
          });
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
  const handleReferenceScenarioTurn = React.useCallback(
    (direction: "back" | "forward") => {
      setReferenceScenarioSpreadIndex((previousIndex) => {
        const nextIndex =
          direction === "back"
            ? Math.max(0, previousIndex - 1)
            : Math.min(referenceScenarioSpreadCount - 1, previousIndex + 1);
        if (nextIndex !== previousIndex) {
          playSound(BETRAYAL_SCENARIO_PAGE_TURN_KEY);
          setReferenceScenarioTurnDirection(direction);
          window.setTimeout(() => setReferenceScenarioTurnDirection(null), 720);
        }
        return nextIndex;
      });
    },
    [referenceScenarioSpreadCount],
  );

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
      dispatchCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, {
        roomId,
        ...(skeletonKeyMoveTargetRoomIds.has(roomId)
          ? { useSkeletonKey: true }
          : {}),
      });
      setPreviewState((previousState) => ({
        ...previousState,
        interactionMode: "move",
      }));
    },
    [dispatchCommand, skeletonKeyMoveTargetRoomIds],
  );

  const handleMoveAction = React.useCallback(() => {
    const shouldAdvanceOpenMoveTutorial =
      isTutorialActive &&
      tutorialStep?.id === "open-move-targets" &&
      previewState.interactionMode !== "move" &&
      core.movesRemaining > 0 &&
      moveTargetRooms.length > 0;
    setPreviewState((previousState) => {
      if (previousState.interactionMode === "move") {
        return {
          ...previousState,
          interactionMode: "default",
        };
      }
      if (core.movesRemaining <= 0 || moveTargetRooms.length === 0) {
        return previousState;
      }
      return {
        ...previousState,
        interactionMode: "move",
      };
    });
    if (shouldAdvanceOpenMoveTutorial) {
      nextStep("auto");
    }
  }, [
    core.movesRemaining,
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
        ? { ...previousState, interactionMode: "default" }
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
        ? { ...previousState, interactionMode: "default" }
        : previousState,
    );
  }, [canStartExploreSelection, previewState.interactionMode]);

  const handleExploreAction = React.useCallback(() => {
    setPreviewState((previousState) => {
      if (previousState.interactionMode === "explore") {
        return {
          ...previousState,
          interactionMode: "default",
        };
      }
      if (!canStartExploreSelection) {
        return previousState;
      }
      return {
        ...previousState,
        interactionMode: "explore",
      };
    });
  }, [canStartExploreSelection]);

  const handleExploreRoom = React.useCallback(
    (roomId: string) => {
      dispatchCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, {
        roomId,
        ...(useHolySymbolForExplore ? { useHolySymbol: true } : {}),
        ...(useIdolForExplore ? { useIdol: true } : {}),
      });
      setPreviewState((previousState) => ({
        ...previousState,
        useHolySymbolForExplore: false,
        useIdolForExplore: false,
        interactionMode: "default",
      }));
    },
    [dispatchCommand, useHolySymbolForExplore, useIdolForExplore],
  );

  const handleToggleHolySymbolExplore = React.useCallback(() => {
    if (!canDeclareHolySymbolExplore) {
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      useHolySymbolForExplore: !previousState.useHolySymbolForExplore,
    }));
  }, [canDeclareHolySymbolExplore]);

  const handleToggleIdolExplore = React.useCallback(() => {
    if (!canDeclareIdolExplore) {
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      useIdolForExplore: !previousState.useIdolForExplore,
    }));
  }, [canDeclareIdolExplore]);

  const handleSelectMaskTargetRoom = React.useCallback(
    (tokenId: string, roomId: string) => {
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
    },
    [maskTargetTokens],
  );

  const handleSelectInventoryTargetRoom = React.useCallback(
    (roomId: string) => {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedInventoryTargetRoomId: roomId,
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

  const handleSelectMonsterTarget = React.useCallback(
    (monsterId: string) => {
      if (
        hauntActionContext?.actionKind === "attack-cultist" &&
        hungryHouseTargetCultistIds.has(monsterId)
      ) {
        const attackWeaponCardId = selectedAttackWeaponCardIdRef.current;
        dispatchCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, {
          target: "cultist",
          targetMonsterId: monsterId,
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
    },
    [
      handleSelectActiveMaskTargetToken,
      hauntActionContext,
      dispatchCommand,
      hungryHouseTargetCultistIds,
      maskTargetTokens,
      selectedInventoryUseEffectMode,
    ],
  );

  const handleSelectInventoryTargetPlayer = React.useCallback(
    (playerId: string) => {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedInventoryTargetPlayerId: playerId,
      }));
    },
    [],
  );

  const handleSelectEventTrait = React.useCallback(
    (trait: BetrayalTraitKey) => {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedEventTrait: trait,
        selectedEventTargetRoomId: null,
        selectedEventDamageTraits: [],
      }));
    },
    [],
  );

  const handleSelectEventTargetRoom = React.useCallback((roomId: string) => {
    setPreviewState((previousState) => ({
      ...previousState,
      selectedEventTargetRoomId: roomId,
    }));
  }, []);

  const handleToggleEventDamageTrait = React.useCallback(
    (trait: BetrayalTraitKey) => {
      setPreviewState((previousState) => {
        const selected = new Set(previousState.selectedEventDamageTraits);
        if (selected.has(trait)) {
          selected.delete(trait);
        } else {
          selected.add(trait);
        }
        return {
          ...previousState,
          selectedEventDamageTraits: Array.from(selected),
        };
      });
    },
    [],
  );

  const handleResolveEventChoice = (accept: boolean) => {
    if (
      !pendingEventChoice ||
      (accept ? !pendingEventReady : !pendingEventCanDecline)
    ) {
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, {
      ...(selectedEventTrait ? { trait: selectedEventTrait } : {}),
      ...(selectedEventTargetRoomId
        ? { targetRoomId: selectedEventTargetRoomId }
        : {}),
      ...(selectedEventDamageTraits.length > 0
        ? { traits: selectedEventDamageTraits }
        : {}),
      accept,
    });
    setPreviewState((previousState) => ({
      ...previousState,
      selectedEventTrait: null,
      selectedEventTargetRoomId: null,
      selectedEventDamageTraits: [],
      interactionMode: "default",
    }));
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

  const handleUseAction = () => {
    if (core.phase === "haunt" && hauntActionContext?.actionKind === "use") {
      dispatchCommand(
        hauntActionContext.commandType,
        hauntActionContext.payload ?? {},
      );
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        interactionMode: "default",
      }));
      return;
    }
    const cardId = selectedInventoryCard?.id;
    if (!cardId) {
      return;
    }
    if (cardId && selectedCardCanUseRabbitFoot) {
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
    if (isDustSicknessExchangeAvailable) {
      setPreviewState((previousState) => ({
        ...previousState,
        selectedTradeTargetPlayerId: null,
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
    const cardId = selectedInventoryCard?.id;
    dispatchCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, {
      ...(useDogTrade
        ? { useDog: true, cardIds: selectedDogTradeCardIds }
        : cardId
          ? { cardId }
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
        tradeSelectionTouched: false,
        interactionMode: "default",
        hauntTargetingActionKind: null,
      }));
    },
    [dispatchCommand],
  );

  const handleCancelHauntTargeting = React.useCallback(() => {
    selectedAttackWeaponCardIdRef.current = null;
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedAttackWeaponCardId: null,
      selectedTradeTargetPlayerId: null,
      tradeSelectionTouched: false,
      interactionMode:
        previousState.interactionMode === "sicknessExchange"
          ? "default"
          : previousState.interactionMode,
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
      target: "traitor" | "hero" | "jack-spirit" | "cultist",
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

  const handleHauntPrimaryAction = () => {
    if (!hauntActionContext || hasPendingPlayerAgreement) {
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

    switch (hauntActionContext.actionKind) {
      case "use":
        handleUseAction();
        return;
      case "sickness-exchange":
        handleTradeAction();
        focusExplorer(dustSameRoomLivingTargets[0]?.playerId);
        return;
      case "attack-cultist": {
        const monster = core.monsters.find(
          (item) => item.id === hauntActionContext.targetMonsterId,
        );
        focusRoom(monster?.roomId);
        break;
      }
      case "attack-dust":
        focusExplorer(dustSameRoomLivingTargets[0]?.playerId);
        break;
      case "attack-traitor":
        focusExplorer(core.scenarioRuntime.traitorPlayerId);
        break;
      case "attack-hero":
        focusExplorer(hauntActionContext.targetPlayerId);
        break;
      default:
        break;
    }

    setPreviewState((previousState) => ({
      ...previousState,
      interactionMode: "default",
      hauntTargetingActionKind: hauntActionContext.actionKind,
    }));
  };

  const handleSelectExplorerTarget = React.useCallback(
    (explorer: BetrayalExplorerSummary) => {
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
          phantomPhotographerTargetPlayerIds.has(explorer.playerId) ||
          hungryHouseCultistTargetPlayerIds.has(explorer.playerId))
      ) {
        setPreviewState((previousState) => ({
          ...previousState,
          selectedTradeTargetPlayerId: explorer.playerId,
          tradeSelectionTouched: true,
        }));
        return;
      }
      if (heroAttackTargetPlayerIds.has(explorer.playerId)) {
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
          tradeSelectionTouched: false,
          interactionMode: "default",
          hauntTargetingActionKind: null,
        }));
        return;
      }
      if (
        hauntActionContext?.actionKind === "attack-dust" &&
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
    },
    [
      activeHauntTargetGuide,
      activeTradeTargets,
      corpseLootTargets,
      core.scenarioRuntime.traitorPlayerId,
      dispatchCommand,
      dustTargetPlayerIds,
      handleAttackAction,
      handleSelectActiveMaskTargetToken,
      handleSelectInventoryTargetPlayer,
      healTargetExplorers,
      hungryHouseCultistTargetPlayerIds,
      hauntActionContext?.actionKind,
      heroAttackTargetPlayerIds,
      isDustSicknessExchangeMode,
      isTradeOrLootTargetSelectionActive,
      magicCameraPhotoTargetPlayerIds,
      maskTargetTokens,
      phantomPhotographerTargetPlayerIds,
      selectedInventoryUseEffectMode,
    ],
  );

  const handleEndTurnAction = React.useCallback(() => {
    dispatchCommand(BETRAYAL_COMMANDS.END_TURN, {});
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedTradeTargetPlayerId: null,
      selectedTradeReturnCardIds: [],
      tradeSelectionTouched: false,
      interactionMode: "default",
    }));
  }, [dispatchCommand]);

  const handleRoomEffectAction = React.useCallback(() => {
    dispatchCommand(BETRAYAL_COMMANDS.USE_ROOM_EFFECT, {});
    setInventoryPreviewCardId(null);
    setPreviewState((previousState) => ({
      ...previousState,
      selectedTradeTargetPlayerId: null,
      selectedTradeReturnCardIds: [],
      tradeSelectionTouched: false,
      interactionMode: "default",
    }));
  }, [dispatchCommand]);

  const canUseRoomEffect = canUseMysticElevator(core);
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
        : isDustSicknessExchangeAvailable
          ? isDustSicknessExchangeMode
            ? t("board.actions.cancelSicknessExchange")
            : t("board.actions.exchangeSickness")
          : tradeSelectionReady && !hasPendingPlayerAgreement
            ? t("board.actions.sendTradeRequest")
            : t("board.actions.trade"),
      disabled: hasCorpseLootTargets
        ? hasPendingPlayerAgreement
        : hasPendingPlayerAgreement
          ? true
          : isDustSicknessExchangeAvailable
            ? false
            : !hasAnyTradeSelectableCards || activeTradeTargets.length === 0,
      variant: "secondary",
    },
    {
      id: "use",
      label:
        hauntActionContext?.actionKind === "use"
          ? hauntActionContext.commandType ===
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK
            ? t("board.actions.learnAboutJack")
            : hauntActionContext.commandType === BETRAYAL_COMMANDS.TAKE_PHOTO
              ? t("board.actions.takePhoto")
              : hauntActionContext.commandType ===
                  BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA
                ? t("board.actions.smashMagicCamera")
                : hauntActionContext.commandType ===
                    BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK
                  ? t("board.actions.phantomPhotographerAttack")
                  : hauntActionContext.commandType ===
                      BETRAYAL_COMMANDS.EXORCISE_JACK
                    ? t("board.actions.exorciseJack")
                    : hauntActionContext.commandType ===
                        BETRAYAL_COMMANDS.SEARCH_FOR_CURE
                      ? t("board.actions.searchForCure")
                      : hauntActionContext.commandType ===
                          BETRAYAL_COMMANDS.CURE_THE_DUST
                        ? t("board.actions.cureTheDust")
                        : hauntActionContext.commandType ===
                            BETRAYAL_COMMANDS.PICK_UP_CORPSE
                          ? t("board.actions.pickUpCorpse")
                          : hauntActionContext.commandType ===
                              BETRAYAL_COMMANDS.FEED_HER
                            ? t("board.actions.feedHer")
                            : hauntActionContext.commandType ===
                                BETRAYAL_COMMANDS.CULTIST_ATTACK
                              ? t("board.actions.cultistAttack")
                              : t("board.actions.studyExorcism")
          : t("board.actions.use"),
      disabled: hasPendingPlayerAgreement
        ? true
        : hauntActionContext?.actionKind === "use"
          ? false
          : core.currentExplorerInventory.length === 0 ||
            selectedCardUseDisabled,
      variant: "secondary",
    },
    {
      id: "roomEffect",
      label: t("board.actions.roomEffectMysticElevator"),
      disabled: hasPendingPlayerAgreement || !canUseRoomEffect,
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
  const visibleActionItems = actionItems.filter((action) => {
    if (activeHauntTargetGuide) {
      return false;
    }
    if (action.id === "explore" && core.phase !== "preHaunt") {
      return false;
    }
    if (
      action.id === "use" &&
      core.phase === "haunt" &&
      hauntActionContext?.actionKind === "use"
    ) {
      return false;
    }
    if (action.id === "roomEffect") {
      return canUseRoomEffect;
    }
    return true;
  });

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
    move: handleMoveAction,
    explore: handleExploreAction,
    trade: handleTradeAction,
    use: handleUseAction,
    roomEffect: handleRoomEffectAction,
    endTurn: handleEndTurnAction,
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
    },
  ) => {
    const isSelected =
      options.selected ?? item.id === selectedInventoryCard?.id;
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
        key={`${options.layout}-${item.id}`}
        className={`group relative ${isCompact ? "shrink-0" : "w-full"}`}
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
            setPreviewState((previousState) => ({
              ...previousState,
              selectedInventoryCardId: item.id,
              selectedInventoryTargetPlayerId: null,
              selectedInventoryTargetRoomId: null,
              selectedMaskTargetRoomIdsByTokenId: {},
              activeMaskTargetTokenId: null,
              tradeSelectionTouched: true,
            }));
          }}
          data-testid={options.testId}
          data-roll-modifier-available={canModifyRecentRoll ? "true" : "false"}
          title={`${item.name} · ${resolveInventoryRulesSummary(item, t)} · 点击选择`}
          className={`pointer-events-auto relative w-full overflow-visible text-left outline-none transition focus:outline-none focus-visible:outline-none ${showSelectedState ? "" : "focus-visible:ring-0"} ${buttonOutlineClass}`}
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
              className={`absolute right-2 top-2 z-10 border border-[#7c5941] bg-[rgba(58,31,24,0.82)] ${isFocus ? "px-2 py-1 text-[10px]" : "px-1.5 py-0.5 text-[9px]"} font-medium text-[#f0c1a2]`}
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
            } ${!isPreview && (isUsedThisTurn || isUnavailableThisTurn) ? "opacity-60" : ""}`}
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
                      <div className="pointer-events-none absolute inset-x-0 top-[10%] flex justify-center">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold tracking-[0.08em] ${
                            item.kind === "item"
                              ? "border-[rgba(215,162,134,0.24)] bg-[rgba(43,24,20,0.78)] text-[#f0ccb9]"
                              : "border-[rgba(173,212,161,0.2)] bg-[rgba(20,34,22,0.82)] text-[#d6ebd1]"
                          }`}
                        >
                          {t("board.status.frontMissing")}
                        </span>
                      </div>
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
                {isCompact ? null : (
                  <div
                    className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full border ${tone.badgeClass} ${isPreview ? "bottom-16 px-3 py-1 text-[10px]" : isFocus ? "bottom-11 px-2 py-0.5 text-[9px]" : "bottom-8 px-1.5 py-0.5 text-[8px]"} uppercase tracking-[0.12em]`}
                  >
                    {t("board.status.frontMissing")}
                  </div>
                )}
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
                      {isFocus ? (
                        <div className="mt-2 inline-flex rounded-full border border-[rgba(111,140,102,0.26)] bg-[rgba(20,30,21,0.72)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#d4e5cf]">
                          {t("board.status.frontMissing")}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </button>
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
            className={`absolute ${isCompact ? "right-1 top-1 h-6 w-6" : "right-2 top-2 h-8 w-8"} z-30 inline-flex items-center justify-center rounded-[5px] border border-[rgba(238,204,126,0.52)] bg-[rgba(18,15,12,0.86)] text-[#f3dfab] opacity-100 shadow-[0_8px_18px_rgba(0,0,0,0.34)] transition hover:border-[#f1d68d] hover:bg-[rgba(35,27,18,0.94)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100`}
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
          onStartScenario={handleStartScenario}
        />
        <BetrayalDebugPanel G={G} dispatch={dispatch} playerID={playerID} />
      </>
    );
  }

  if (core.phase === "endgame") {
    return (
      <>
        <EndgameScreen
          core={core}
          matchData={matchData}
          effectiveLocale={effectiveLocale}
        />
        <BetrayalDebugPanel G={G} dispatch={dispatch} playerID={playerID} />
      </>
    );
  }

  const currentExplorerTemplate = EXPLORER_CATALOG.find(
    (explorer) => explorer.explorerId === core.currentExplorer.explorerId,
  );
  const currentExplorerAbilityName =
    core.currentExplorer.abilityName ||
    currentExplorerTemplate?.abilityName ||
    "";
  const currentExplorerAbilityText =
    core.currentExplorer.abilityText ||
    currentExplorerTemplate?.abilityText ||
    "";

  return (
    <div
      data-testid="betrayal-board"
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
        {!isHauntTargetingMode ? (
          <header className="pointer-events-none absolute inset-x-4 top-3 z-30 hidden lg:block">
            <div
              className="relative min-h-[58px]"
              data-testid="betrayal-runtime-header-grid"
            >
              <span className="sr-only">{phaseLabel}</span>
              {!isPhoneLandscapeLayout && !shouldHideBlockingTableChrome ? (
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
                  className="grid h-[50px] w-[50px] place-items-center rounded-[8px] border border-[#756244] bg-[radial-gradient(circle_at_35%_30%,rgba(190,233,97,0.22),rgba(20,28,18,0.94)_72%)] text-center shadow-[0_0_18px_rgba(130,177,76,0.18)]"
                  data-tutorial-id="betrayal-moves-remaining"
                >
                  <div>
                    <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#b5ef42]">
                      {t("board.hud.moveLabel")}
                    </div>
                    <div className="text-[20px] font-bold text-[#c8f05e]">
                      {core.movesRemaining}
                    </div>
                    <span className="sr-only">
                      {t("board.status.movesRemaining", {
                        count: core.movesRemaining,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>
        ) : null}

        <main className="absolute inset-0 overflow-hidden">
          {shouldShowHauntRevealCue ? (
            <BetrayalHauntRevealCue
              title={t("board.status.hauntRevealTitle")}
              scenarioTitle={activeHauntTitle}
              traitorName={hauntRevealTraitorName}
              triggerLabel={core.scenarioRuntime.hauntTriggerLabel}
              isPhoneLandscapeLayout={isPhoneLandscapeLayout}
            />
          ) : null}

          {core.phase === "haunt" && !shouldHideBlockingTableChrome ? (
            <HudPortal>
              <div
                data-testid="betrayal-haunt-command-banner"
                data-haunt-id={activeHauntDossier.id}
                data-haunt-card-number={activeHauntDossier.cardNumber}
                className={`pointer-events-auto fixed z-50 overflow-hidden border border-[rgba(238,204,126,0.52)] bg-[linear-gradient(180deg,rgba(34,24,18,0.92),rgba(8,13,10,0.94))] text-[#f0dfbd] shadow-[0_18px_38px_rgba(0,0,0,0.34),0_0_34px_rgba(181,239,66,0.12),inset_0_0_0_1px_rgba(255,244,190,0.06)] backdrop-blur-md ${
                  isPhoneLandscapeLayout
                    ? "left-3 right-3 top-3 rounded-[10px] px-3 py-2"
                    : isHauntTargetingMode
                      ? "left-1/2 top-5 w-[min(560px,calc(100vw-3rem))] rounded-[10px] px-3 py-2"
                      : "left-1/2 top-[82px] w-[min(700px,calc(100vw-38rem))] rounded-[12px] px-4 py-3"
                }`}
                style={{
                  zIndex: UI_Z_INDEX.overlayRaised + 12,
                  transform: isPhoneLandscapeLayout
                    ? undefined
                    : "translateX(-50%)",
                }}
                role="region"
                aria-live="polite"
              >
                {isHauntTargetingMode ? (
                  <div className="flex min-h-[54px] items-center gap-3">
                    <div
                      role="status"
                      aria-live="polite"
                      aria-disabled="true"
                      data-testid="betrayal-haunt-command-primary"
                      data-haunt-primary-action-mode={
                        activeHauntPrimaryActionMode
                      }
                      data-haunt-primary-action-kind={
                        hauntActionContext?.actionKind ?? "none"
                      }
                      data-haunt-targeting-status="true"
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(217,255,151,0.62)] bg-[rgba(72,96,35,0.32)] text-[#d9ff97] shadow-[0_0_18px_rgba(217,255,151,0.22)]">
                        <Crosshair
                          aria-hidden="true"
                          size={20}
                          strokeWidth={2.2}
                        />
                      </span>
                      <span className="min-w-0">
                        <span
                          data-testid="betrayal-haunt-command-next"
                          className="block text-[10px] font-bold tracking-[0.12em] text-[#d9ff97]"
                        >
                          {t("board.status.hauntTargetingNext")}
                        </span>
                        <span className="block truncate text-[15px] font-black text-[#fff1b8]">
                          {activeHauntTargetGuide?.targetName}
                        </span>
                      </span>
                    </div>
                    <span
                      data-testid="betrayal-haunt-command-cue"
                      className="sr-only"
                    >
                      {activeHauntActionHintText}
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelHauntTargeting}
                      data-testid="betrayal-haunt-target-cancel"
                      className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] border border-[rgba(244,164,120,0.52)] bg-[rgba(82,39,26,0.54)] px-3 text-[12px] font-bold text-[#f4c1a2] transition-colors duration-150 hover:border-[#ffc09b] hover:bg-[rgba(108,52,34,0.66)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc09b]"
                      title={t("board.status.hauntTargetingCancel")}
                    >
                      <X size={15} strokeWidth={2.4} />
                      <span>{t("board.status.hauntTargetingCancel")}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-[5px] border border-[rgba(238,204,126,0.26)] bg-[rgba(238,204,126,0.1)] px-2 py-0.5 text-[10px] font-black tracking-[0.14em] text-[#ffe4a0]">
                          {t("board.haunts.goalCard.caseNo", {
                            number: activeHauntDossier.cardNumber,
                          })}
                        </span>
                        <span
                          data-testid="betrayal-haunt-command-title"
                          className="truncate text-[16px] font-black tracking-[0.05em] text-[#fff0b8]"
                          title={activeHauntTitle}
                        >
                          {activeHauntTitle}
                        </span>
                      </div>
                      <div
                        data-testid="betrayal-haunt-command-next"
                        className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-semibold leading-5 text-[#d9ff97]"
                      >
                        <span className="text-[#9fb98b]">
                          {t("board.haunts.goalCard.nextLabel")}：
                        </span>
                        <span>{activeHauntNextStepText}</span>
                      </div>
                      <div
                        data-testid="betrayal-haunt-command-cue"
                        className="mt-1 text-[11px] font-semibold leading-5 text-[#bddac2]"
                      >
                        {activeHauntActionHintText}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {hauntGoalProgressRows.slice(0, 3).map((row) => (
                          <span
                            key={row.id}
                            data-testid={`betrayal-haunt-command-progress-${row.id}`}
                            className="inline-flex min-h-[24px] items-center gap-1 rounded-[5px] border border-[rgba(214,191,129,0.16)] bg-[rgba(8,12,10,0.42)] px-2 text-[10px] font-semibold text-[#d8bf81]"
                          >
                            <span className="text-[#9fb98b]">{row.label}</span>
                            <span className="text-[#f0d29a]">{row.value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-stretch gap-2">
                      {isHauntTargetingMode ? (
                        <div
                          role="status"
                          aria-live="polite"
                          aria-disabled="true"
                          data-testid="betrayal-haunt-command-primary"
                          data-haunt-primary-action-mode={
                            activeHauntPrimaryActionMode
                          }
                          data-haunt-primary-action-kind={
                            hauntActionContext?.actionKind ?? "none"
                          }
                          data-haunt-targeting-status="true"
                          className="inline-flex min-h-[52px] min-w-[164px] cursor-default items-center gap-2 border-l-2 border-[#ffe08a] bg-transparent px-3 py-1 text-left text-[12px] font-black tracking-[0.04em] text-[#fff1b8]"
                          title={activeHauntActionHintText}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ffe08a] shadow-[0_0_12px_rgba(255,224,138,0.52)]" />
                          <span className="min-w-0">
                            <span className="block text-[10px] font-bold tracking-[0.12em] text-[#d9ff97]">
                              {t("board.status.hauntTargetingNext")}
                            </span>
                            <span className="block truncate">
                              {activeHauntPrimaryActionText}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleHauntPrimaryAction}
                          disabled={
                            !hauntActionContext || hasPendingPlayerAgreement
                          }
                          data-testid="betrayal-haunt-command-primary"
                          data-haunt-primary-action-mode={
                            activeHauntPrimaryActionMode
                          }
                          data-haunt-primary-action-kind={
                            hauntActionContext?.actionKind ?? "none"
                          }
                          className="inline-flex min-h-[52px] min-w-[176px] cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-[#d1b05f] bg-[linear-gradient(180deg,rgba(181,239,66,0.30),rgba(48,72,28,0.78))] px-4 text-[14px] font-black tracking-[0.06em] text-[#f6ffc4] shadow-[0_0_22px_rgba(181,239,66,0.22),0_10px_22px_rgba(0,0,0,0.24)] transition-colors duration-150 hover:border-[#eef4a8] hover:bg-[linear-gradient(180deg,rgba(181,239,66,0.40),rgba(55,82,31,0.86))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#eef4a8] disabled:cursor-not-allowed disabled:border-[rgba(123,106,74,0.26)] disabled:bg-[rgba(13,15,11,0.44)] disabled:text-[#7a6a4a] disabled:shadow-none"
                          title={activeHauntActionHintText}
                        >
                          <Compass size={18} strokeWidth={2.6} />
                          <span className="truncate">
                            {activeHauntPrimaryActionText}
                          </span>
                        </button>
                      )}
                      {isHauntTargetingMode ? (
                        <button
                          type="button"
                          onClick={handleCancelHauntTargeting}
                          data-testid="betrayal-haunt-target-cancel"
                          className="inline-flex min-h-[52px] min-w-[92px] cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-[rgba(244,164,120,0.52)] bg-[rgba(82,39,26,0.54)] px-3 text-[12px] font-bold tracking-[0.08em] text-[#f4c1a2] transition-colors duration-150 hover:border-[#ffc09b] hover:bg-[rgba(108,52,34,0.66)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffc09b]"
                          title={t("board.status.hauntTargetingCancel")}
                        >
                          <X size={15} strokeWidth={2.4} />
                          <span>{t("board.status.hauntTargetingCancel")}</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={openScenarioReference}
                        data-testid="betrayal-haunt-command-book"
                        className="inline-flex min-h-[52px] min-w-[92px] cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-[rgba(143,116,65,0.72)] bg-[rgba(73,47,25,0.42)] px-3 text-[12px] font-bold tracking-[0.08em] text-[#d8bf81] transition-colors duration-150 hover:border-[#d9b66a] hover:text-[#fff0b8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b66a]"
                        title={activeHauntReferenceTitle}
                      >
                        <BookOpen size={15} />
                        <span>{t("board.haunts.goalCard.openBook")}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </HudPortal>
          ) : null}

          <section
            data-testid="betrayal-left-status-rail"
            className={`pointer-events-none absolute left-3 top-3 z-40 max-h-[calc(100vh-1.5rem)] w-[286px] min-h-0 content-start gap-2 overflow-visible ${
              isPhoneLandscapeLayout || activeHauntTargetGuide
                ? "hidden"
                : "grid"
            }`}
          >
            <article className="pointer-events-none relative overflow-visible bg-transparent px-1 py-1">
              <div className="mx-auto flex w-full max-w-[252px] flex-col gap-1 pb-1 pt-1 xl:mx-0">
                <div className="relative mx-auto w-full max-w-[188px]">
                  <div className="pointer-events-none absolute inset-[12%] rounded-full bg-[rgba(77,138,92,0.18)] blur-3xl" />
                  <OptimizedImage
                    src={core.currentExplorer.portraitAsset}
                    locale={effectiveLocale}
                    alt={core.currentExplorer.displayName}
                    className="relative z-10 aspect-[1/1.05] h-auto w-full object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.38)]"
                    draggable={false}
                  />
                  {(
                    Object.entries(core.currentExplorer.traits) as [
                      BetrayalTraitKey,
                      number,
                    ][]
                  ).map(([key, value]) => {
                    const markerPosition = resolveExplorerBoardMarkerPosition(
                      key,
                      value,
                    );
                    return (
                      <div
                        key={`explorer-board-marker-${key}`}
                        className="pointer-events-none absolute z-20 h-7 w-7 -translate-x-1/2 -translate-y-1/2"
                        style={markerPosition}
                      >
                        <OptimizedImage
                          src={resolveNumberMarkerAsset(value)}
                          locale={effectiveLocale}
                          alt={`${TRAIT_LABEL_LOCAL[key]} ${value}`}
                          className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.38)]"
                          draggable={false}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="-mt-4 flex justify-center px-2">
                  <div className="relative inline-flex min-w-[194px] max-w-[214px] items-center justify-between gap-2 overflow-hidden rounded-[7px] border border-[rgba(103,82,48,0.62)] bg-[linear-gradient(180deg,rgba(14,18,16,0.9),rgba(9,12,10,0.96))] px-2.5 py-1.5 shadow-[0_8px_16px_rgba(0,0,0,0.14)]">
                    <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                    {renderAttackImpactSurface(
                      core.currentExplorer.playerId,
                      "current-panel",
                      <ExplorerFigureToken
                        explorer={core.currentExplorer}
                        locale={effectiveLocale}
                        label={resolvePlayerName(
                          core.currentExplorer.playerId,
                          core.currentExplorer.displayName,
                          matchData,
                        )}
                        tone="self"
                        size="panel"
                        testIdPrefix="betrayal-current-panel-token"
                      />,
                      "panel",
                    )}
                    <div className="min-w-0">
                      <div className="text-[8px] uppercase tracking-[0.18em] text-[#95876d]">
                        {t("board.hud.locationLabel")}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[#efe2c4]">
                        {core.rooms.find(
                          (room) => room.id === core.currentExplorer.roomId,
                        )?.name || t("board.rooms.unknown")}
                      </div>
                    </div>
                    <div className="shrink-0 self-center rounded-[6px] border border-[rgba(105,83,47,0.58)] bg-[radial-gradient(circle_at_35%_25%,rgba(227,211,168,0.12),rgba(18,15,12,0.95))] px-2 py-0.5 text-center shadow-[0_4px_10px_rgba(0,0,0,0.14)]">
                      <div className="text-[7px] uppercase tracking-[0.16em] text-[#98886a]">
                        {t("board.hud.holdingLabel")}
                      </div>
                      <div className="text-[15px] font-semibold leading-none text-[#f0e2c0]">
                        {core.currentExplorerInventory.length}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-1.5">
                  <div
                    className="relative overflow-hidden rounded-[10px] border border-[rgba(93,79,54,0.42)] bg-[rgba(13,17,15,0.52)] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.04)]"
                    data-testid="betrayal-current-traits"
                    data-tutorial-id="betrayal-current-traits"
                    data-player-id={core.currentExplorer.playerId}
                    data-explorer-id={core.currentExplorer.explorerId}
                    data-room-id={core.currentExplorer.roomId}
                    data-token-asset={
                      core.currentExplorer.tokenAsset ??
                      core.currentExplorer.portraitAsset
                    }
                  >
                    <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
                    <div className="mb-1 flex items-center justify-between border-b border-[rgba(96,80,54,0.42)] pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d8bf81]">
                        {t("board.hud.currentTraitsLabel")}
                      </span>
                      <span className="rounded-[4px] border border-[rgba(181,239,66,0.28)] bg-[rgba(40,58,21,0.52)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-[#d9ff97]">
                        {resolvePlayerName(
                          core.currentExplorer.playerId,
                          core.currentExplorer.displayName,
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
                          className="grid grid-cols-[66px_minmax(0,1fr)_24px] items-center gap-1.5 text-[12px]"
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 font-semibold ${TRAIT_TONE_CLASS[trait].text}`}
                          >
                            <OptimizedImage
                              src={ASSETS.trait[trait]}
                              locale={effectiveLocale}
                              alt=""
                              className="h-4 w-4 object-contain opacity-86"
                              draggable={false}
                            />
                            <span className="truncate">
                              {TRAIT_LABEL_LOCAL[trait]}
                            </span>
                          </span>
                          <div className="grid grid-cols-6 gap-1">
                            {Array.from({ length: 6 }).map((_, index) => {
                              const isFilled =
                                index < core.currentExplorer.traits[trait];
                              const isDangerSlot = index === 0;
                              return (
                                <span
                                  key={`${trait}-${index}`}
                                  data-trait-pip-shape="square"
                                  title={
                                    isDangerSlot
                                      ? t("board.hud.dangerZone")
                                      : undefined
                                  }
                                  className={`h-2.5 rounded-[2px] border ${
                                    isDangerSlot
                                      ? isFilled
                                        ? "border-[#bd5545] bg-[linear-gradient(180deg,#e07159,#9e3b32)] shadow-[0_0_6px_rgba(213,78,57,0.28)]"
                                        : "border-[#73362f] bg-[rgba(91,31,28,0.5)]"
                                      : isFilled
                                        ? `${TRAIT_TONE_CLASS[trait].active} shadow-[0_0_6px_rgba(214,191,129,0.14)]`
                                        : TRAIT_TONE_CLASS[trait].inactive
                                  }`}
                                />
                              );
                            })}
                          </div>
                          <span
                            className={`text-right text-[14px] font-semibold ${TRAIT_VALUE_TEXT_CLASS[trait]}`}
                          >
                            {core.currentExplorer.traits[trait]}
                          </span>
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
                        {currentExplorerAbilityName}：
                      </span>
                      <span className="text-[#c8d8a2]">
                        {currentExplorerAbilityText}
                      </span>
                    </div>
                    {isHungryHouseHauntActive && hungryHouseRuntime ? (
                      <div
                        data-testid="betrayal-hungry-house-status"
                        className="mt-1.5 grid gap-1 border-t border-[rgba(96,80,54,0.34)] pt-1 text-[10px] leading-4 text-[#e7d4aa]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#d8bf81]">
                            {t("board.hungryHouse.track")}：
                          </span>
                          <span className="text-[12px] font-semibold text-[#f0d29a]">
                            {hungryHouseRuntime.ritualProgress}
                          </span>
                        </div>
                        <div>
                          {t("board.hungryHouse.rooms", {
                            ritual: hungryHouseRitualRoomName,
                            chasm: hungryHouseChasmRoomName,
                          })}
                        </div>
                        <div>
                          {t("board.hungryHouse.carrying", {
                            corpse: hungryHouseCarriedCorpseName,
                          })}
                        </div>
                        <div>
                          {t("board.hungryHouse.corpses", {
                            count: hungryHouseCultistCorpseCount,
                          })}
                        </div>
                      </div>
                    ) : null}
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
                  const isHungryHouseCultistTarget =
                    hungryHouseCultistTargetPlayerIds.has(explorer.playerId);
                  const isAttackTarget =
                    heroAttackTargetPlayerIds.has(explorer.playerId) ||
                    isMagicCameraPhotoTarget ||
                    isPhantomPhotographerTarget ||
                    isHungryHouseCultistTarget ||
                    (hauntActionContext?.actionKind === "attack-dust" &&
                      isDustTarget);
                  const isSelectedAttackTarget =
                    hauntActionContext?.actionKind === "attack-hero" &&
                    hauntActionContext.targetPlayerId === explorer.playerId;
                  const isSelectedTradeTarget =
                    explorer.playerId === selectedTradeTargetPlayerId ||
                    explorer.playerId === selectedCorpseLootTargetPlayerId ||
                    isSelectedAttackTarget ||
                    (isSicknessExchangeTarget &&
                      explorer.playerId === selectedDustTargetPlayerId);
                  const isSameRoom =
                    core.currentExplorer.roomId === explorer.roomId;
                  const isDogTradeTarget = dogTradeTargets.some(
                    (item) => item.playerId === explorer.playerId,
                  );
                  const panel = (
                    <div
                      key={explorer.playerId}
                      data-testid={`betrayal-teammate-panel-${explorer.playerId}`}
                      data-player-id={explorer.playerId}
                      data-explorer-id={explorer.explorerId}
                      data-room-id={explorer.roomId}
                      data-token-asset={
                        explorer.tokenAsset ?? explorer.portraitAsset
                      }
                      className={`grid grid-cols-[50px_minmax(0,1fr)_52px] items-center gap-2 rounded-[8px] border px-1.5 py-2 transition ${
                        isSelectedTradeTarget
                          ? "border-[#eecc7e] bg-[linear-gradient(180deg,rgba(53,40,20,0.58),rgba(22,19,14,0.70))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_18px_rgba(238,204,126,0.30)]"
                          : isTradeCandidate ||
                              isCorpseLootCandidate ||
                              isAttackTarget
                            ? "border-[rgba(118,189,153,0.46)] bg-[rgba(12,18,15,0.20)] hover:border-[rgba(159,225,167,0.64)] hover:bg-[rgba(255,224,138,0.06)]"
                            : "border-transparent bg-transparent"
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
                        <div className="pointer-events-none absolute -bottom-1 -right-1">
                          {renderAttackImpactSurface(
                            explorer.playerId,
                            "teammate-panel",
                            <ExplorerFigureToken
                              explorer={explorer}
                              locale={effectiveLocale}
                              label={resolvePlayerName(
                                explorer.playerId,
                                explorer.displayName,
                                matchData,
                              )}
                              tone="ally"
                              size="panel"
                              testIdPrefix="betrayal-teammate-panel-token"
                            />,
                            "panel",
                          )}
                        </div>
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
                              className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[10px] font-medium ${
                                isSelectedTradeTarget
                                  ? "border-[#eecc7e] bg-[rgba(238,204,126,0.18)] text-[#ffe4a0]"
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
                        <div className="text-[11px] text-[#8db29a]">
                          {t("board.players.inventoryCount", {
                            count: explorer.inventory.length,
                          })}
                        </div>
                      </div>
                      <div className="grid gap-0.5 text-[10px] text-[#c8bda4]">
                        {(
                          [
                            "might",
                            "speed",
                            "knowledge",
                            "sanity",
                          ] as BetrayalTraitKey[]
                        ).map((key) => (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>{t(`board.traits.${key}`)}</span>
                            <span className="font-semibold text-[#f3ead6]">
                              {explorer.traits[key]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
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
              activeHauntTargetGuide ? "hidden" : ""
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
                {selectedInventoryCard
                  ? t("board.status.selectedCard", {
                      card: selectedInventoryCard.name,
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
                  {inventoryGroups.item.map((item) =>
                    renderInventoryCard(item, {
                      layout: "compact",
                      testId: `betrayal-inventory-${item.id}`,
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
                  {inventoryGroups.omen.map((item) =>
                    renderInventoryCard(item, {
                      layout: "compact",
                      testId: `betrayal-inventory-${item.id}`,
                      compactDenseNoFront: true,
                    }),
                  )}
                </div>
              </section>
            </div>
            {selectedInventoryCard ? (
              <div
                className="sr-only"
                data-testid="betrayal-selected-inventory-card-name"
              >
                {selectedInventoryCard.name}
              </div>
            ) : null}
          </div>

          <section className="absolute inset-0 z-10 grid min-h-0">
            <div className="sr-only">
              <span data-testid="betrayal-action-cue">{actionCueText}</span>
              <span data-testid="betrayal-trade-status">{tradeStatusText}</span>
              <span data-testid="betrayal-turn-hint">{turnHintText}</span>
              {roomEndTurnEffectHint ? (
                <span data-testid="betrayal-room-end-turn-effect-status">
                  {roomEndTurnEffectHint.title} {roomEndTurnEffectHint.detail}
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
                {shouldShowLatestDiscovery ? (
                  <span>
                    {t("board.discovery.label")} {core.latestDiscovery!.title}{" "}
                    {core.latestDiscovery!.summary}{" "}
                    {core.latestDiscovery!.detail}
                  </span>
                ) : null}
                {roomFocusState ? <span>{roomFocusState.label}</span> : null}
                {tradeStatusCueState ? (
                  <span>{tradeStatusCueState.label}</span>
                ) : null}
              </div>

              {shouldShowLatestDiscovery && !pendingEventChoice ? (
                <div
                  data-testid="betrayal-discovery-panel"
                  data-card-testid="betrayal-discovery-card-reveal"
                  data-tutorial-id="betrayal-latest-discovery"
                  aria-label={`${latestDiscoveryKindLabel} ${core.latestDiscovery!.title}`}
                  data-allows-inventory-roll-modifiers={
                    rollModifierCardIds.size > 0 ? "true" : "false"
                  }
                  data-backdrop-dismiss={
                    canDismissLatestDiscoveryByBackdrop ? "enabled" : "disabled"
                  }
                  onClick={
                    canDismissLatestDiscoveryByBackdrop
                      ? handleDismissLatestDiscovery
                      : undefined
                  }
                  className={`pointer-events-auto absolute z-[120] flex cursor-default items-center justify-center ${
                    isPhoneLandscapeLayout
                      ? "inset-0 bg-[rgba(3,7,6,0.92)] px-3 pb-[76px] pt-8"
                      : "inset-y-0 left-0 right-0 px-4 py-16 md:left-[392px] md:right-[240px]"
                  }`}
                >
                  <div
                    data-testid="betrayal-discovery-panel-content"
                    onClick={(event) => event.stopPropagation()}
                    className={`flex w-fit max-w-[calc(100vw-2rem)] flex-col items-center justify-center gap-3 ${
                      isPhoneLandscapeLayout
                        ? "max-h-[calc(100vh-4.5rem)]"
                        : "max-h-[calc(100vh-8rem)]"
                    }`}
                  >
                    <div
                      data-testid="betrayal-discovery-panel-main"
                      className={`flex min-h-0 items-center justify-center ${
                        isPhoneLandscapeLayout &&
                        shouldShowLatestDiscoveryRoll &&
                        core.recentRoll
                          ? "h-[min(270px,calc(100vh-8rem))] max-w-[calc(100vw-1rem)] flex-row gap-3"
                          : `max-w-[calc(100vw-2rem)] flex-col gap-4 md:flex-row ${
                              shouldShowLatestDiscoveryRoll && core.recentRoll
                                ? rollModifierCardIds.size > 0
                                  ? "md:max-w-[900px]"
                                  : "md:max-w-[940px]"
                                : rollModifierCardIds.size > 0
                                  ? "md:max-w-[min(780px,calc(100vw-18rem))]"
                                  : "md:max-w-[900px]"
                            }`
                      }`}
                    >
                      <div
                        className={`shrink-0 ${
                          isPhoneLandscapeLayout &&
                          shouldShowLatestDiscoveryRoll &&
                          core.recentRoll
                            ? "w-[min(144px,22vw)]"
                            : shouldShowLatestDiscoveryRoll && core.recentRoll
                              ? "w-[min(300px,calc(100vw-2rem))] md:w-[270px]"
                              : "w-[min(340px,calc(100vw-2rem))] md:w-[340px]"
                        }`}
                      >
                        <span
                          className="sr-only"
                          data-testid="betrayal-discovery-detail"
                        >
                          {core.latestDiscovery!.summary}{" "}
                          {core.latestDiscovery!.detail}
                        </span>
                        {latestDiscoveryVisual ? (
                          <DiscoveryAtlasFrame
                            visual={latestDiscoveryVisual}
                            locale={effectiveLocale}
                            alt={core.latestDiscovery!.title}
                            testId="betrayal-discovery-card-front-atlas"
                          />
                        ) : (
                          <div
                            data-testid="betrayal-discovery-card-front-missing"
                            className="flex aspect-[675/1275] items-center justify-center rounded-[10px] border border-[rgba(211,179,109,0.28)] bg-[rgba(13,15,11,0.94)] px-3 text-center text-[12px] font-semibold leading-tight text-[#d6c498]"
                          >
                            {t("board.status.frontMissing")}
                          </div>
                        )}
                      </div>
                      {shouldShowLatestDiscoveryRoll && core.recentRoll ? (
                        <RecentRollPanel
                          roll={core.recentRoll}
                          className={
                            isPhoneLandscapeLayout
                              ? "h-full min-h-[220px] min-w-0 flex-1"
                              : "h-[min(52vh,440px)] min-h-[360px] w-[min(700px,calc(100vw-2rem))] shrink-0 md:w-[610px]"
                          }
                          diceClassName={
                            isPhoneLandscapeLayout
                              ? "min-h-[188px]"
                              : "min-h-[280px]"
                          }
                          rerollSelection={rabbitFootRerollSelection}
                          effectiveLocale={effectiveLocale}
                          openTable
                          compactResult
                        />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      data-testid="betrayal-discovery-continue"
                      data-discovery-action-position="bottom"
                      className={`pointer-events-auto shrink-0 border border-[#d6b56d] bg-[rgba(214,181,109,0.20)] font-bold tracking-[0.12em] text-[#fff1b8] shadow-[0_10px_22px_rgba(0,0,0,0.22)] transition hover:bg-[rgba(214,181,109,0.30)] ${
                        isPhoneLandscapeLayout &&
                        shouldShowLatestDiscoveryRoll &&
                        core.recentRoll
                          ? "min-h-[42px] w-[min(220px,calc(100vw-2rem))] px-4 py-2 text-[12px] leading-tight"
                          : "min-h-[42px] px-5 py-2 text-[12px]"
                      }`}
                      onClick={handleDismissLatestDiscovery}
                    >
                      {t("board.roll.backToBoard")}
                    </button>
                  </div>
                </div>
              ) : null}

              {core.recentRoll &&
              !isRecentRollDismissed &&
              !isConfirmedExorciseRoll &&
              !pendingEventChoice &&
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
                            ? "h-[min(72vh,320px)] min-h-[286px] w-full"
                            : "h-[min(48vh,430px)] min-h-[340px] w-full"
                        }
                        diceClassName={
                          isPhoneLandscapeLayout
                            ? "min-h-[204px]"
                            : "min-h-[260px]"
                        }
                        effectiveLocale={effectiveLocale}
                        openTable
                        compactResult
                        onDiceSettledChange={handleRecentRollDiceSettledChange}
                      />
                      {isExorciseRollReview ? (
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
                      )}
                    </div>
                  </div>
                ) : (
                  <StandardRecentRollOverlay
                    roll={core.recentRoll}
                    isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                    canDismissByBackdrop={canDismissRecentRollByBackdrop}
                    onDismiss={handleDismissRecentRoll}
                    effectiveLocale={effectiveLocale}
                    rerollSelection={rabbitFootRerollSelection}
                  />
                )
              ) : null}

              {pendingEventChoice ? (
                <div
                  data-testid="betrayal-event-choice-backdrop"
                  data-scene-visibility={
                    pendingEventTargetRooms.length > 0
                      ? "interactive-map"
                      : "receded"
                  }
                  className={`pointer-events-none absolute inset-0 z-50 flex items-center justify-center ${
                    isPhoneLandscapeLayout
                      ? "px-4 pb-[74px] pt-6"
                      : "px-4 py-14"
                  }`}
                >
                  <div
                    data-testid="betrayal-event-choice-panel"
                    data-layout="main-stage"
                    data-surface="open-table"
                    aria-label={pendingEventChoice.sourceTitle}
                    className={`pointer-events-none grid overflow-visible text-[#f3e0a6] ${
                      isPhoneLandscapeLayout
                        ? pendingEventChoiceHasResultPanel
                          ? "max-h-[calc(100vh-5.25rem)] w-[min(820px,calc(100vw-1.5rem))] grid-cols-[minmax(176px,218px)_minmax(236px,0.9fr)_minmax(220px,0.72fr)] gap-3"
                          : "max-h-[calc(100vh-5.25rem)] w-[min(720px,calc(100vw-1.5rem))] grid-cols-[minmax(176px,235px)_minmax(300px,1fr)] gap-4"
                        : pendingEventChoiceHasResultPanel
                          ? "max-h-[min(680px,calc(100vh-7rem))] w-[min(980px,calc(100vw-20rem))] min-w-[760px] grid-cols-[minmax(200px,240px)_minmax(280px,0.76fr)_minmax(240px,0.56fr)] gap-4"
                          : "max-h-[min(680px,calc(100vh-7rem))] w-[min(820px,calc(100vw-24rem))] min-w-[640px] grid-cols-[minmax(210px,270px)_minmax(300px,1fr)] gap-5"
                    }`}
                  >
                    <div className="pointer-events-none w-full min-w-0 justify-self-center drop-shadow-[0_26px_54px_rgba(0,0,0,0.58)]">
                      {latestDiscoveryVisual ? (
                        <DiscoveryAtlasFrame
                          visual={latestDiscoveryVisual}
                          locale={effectiveLocale}
                          alt={pendingEventChoice.sourceTitle}
                          testId="betrayal-event-choice-card-front-atlas"
                          className={isPhoneLandscapeLayout ? "w-full" : ""}
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
                            ? "h-[min(57vh,286px)] min-h-[248px] w-full min-w-0 justify-self-start"
                            : "h-[min(52vh,430px)] min-h-[340px] w-full min-w-0"
                        }
                        diceClassName={
                          isPhoneLandscapeLayout
                            ? "min-h-[180px]"
                            : "min-h-[260px]"
                        }
                        animateInitialRoll={false}
                        effectiveLocale={effectiveLocale}
                        openTable
                        compactResult={false}
                        denseResult={isPhoneLandscapeLayout}
                        diceVisualScale={isPhoneLandscapeLayout ? 1.04 : 1}
                      />
                    ) : pendingEventChoiceAllTraitCheck ? (
                      <div
                        data-testid="betrayal-event-choice-all-trait-check"
                        className={
                          isPhoneLandscapeLayout
                            ? "pointer-events-none flex h-[min(57vh,286px)] min-h-[248px] min-w-0 flex-col justify-center gap-4 border-l border-[rgba(214,191,129,0.24)] pl-4"
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
                    <div className="pointer-events-none flex min-h-0 min-w-0 flex-col justify-center">
                      <div
                        className={`custom-scrollbar flex min-h-0 flex-1 flex-col justify-center overflow-y-auto pr-1 ${
                          isPhoneLandscapeLayout ? "gap-3" : "gap-6"
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
                                  ? "flex flex-wrap gap-3"
                                  : "flex flex-wrap gap-4"
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
                                        ? "!min-h-[44px] !min-w-[92px] !px-4 !py-2 !text-[16px]"
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
                        {pendingEventTargetRooms.length > 0 ? (
                          <div
                            className={
                              isPhoneLandscapeLayout
                                ? "grid gap-3"
                                : "grid gap-3.5"
                            }
                            data-testid="betrayal-event-choice-rooms"
                          >
                            <span
                              className={`font-bold uppercase tracking-[0.18em] text-[#f2d27f] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] ${
                                isPhoneLandscapeLayout
                                  ? "text-[14px]"
                                  : "text-[14px]"
                              }`}
                            >
                              {t("board.inventory.map")}
                            </span>
                            <div
                              className={
                                isPhoneLandscapeLayout
                                  ? "flex flex-wrap gap-3"
                                  : "flex flex-wrap gap-4"
                              }
                            >
                              {pendingEventTargetRooms.map((room) => {
                                const isSelectedRoom =
                                  selectedEventTargetRoomId === room.id;
                                return (
                                  <span
                                    key={room.id}
                                    data-testid={`betrayal-event-choice-room-${room.id}`}
                                    className={`inline-flex min-h-[38px] items-center rounded-[7px] border px-3 text-[13px] font-semibold ${
                                      isPhoneLandscapeLayout
                                        ? "justify-center px-3 text-[13px]"
                                        : ""
                                    } ${
                                      isSelectedRoom
                                        ? "border-[#d1b05f] bg-[rgba(209,176,95,0.18)] text-[#eef4a8]"
                                        : "border-[rgba(211,179,109,0.20)] bg-[rgba(18,15,10,0.30)] text-[#d6c498]"
                                    }`}
                                  >
                                    {room.name}
                                  </span>
                                );
                              })}
                            </div>
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
                                  const isSelectedDamageTrait =
                                    selectedEventDamageTraits.includes(trait);
                                  return (
                                    <BetrayalSelectionChip
                                      key={trait}
                                      type="button"
                                      onClick={() =>
                                        handleToggleEventDamageTrait(trait)
                                      }
                                      data-testid={`betrayal-event-choice-damage-${trait}`}
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
                                    </BetrayalSelectionChip>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
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
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {!shouldHideBlockingTableChrome &&
              (roomFocusState ||
                (tradeStatusCueState && core.recommendedAction !== "trade") ||
                useDogTrade ||
                selectedCorpseLootTarget ||
                (hauntActionContext?.actionKind?.startsWith("attack-") &&
                  attackWeaponCards.length > 0) ||
                (selectedInventoryUseEffectMode === "healTraits" &&
                  healTargetExplorers.length > 0) ||
                ((canDeclareHolySymbolExplore || canDeclareIdolExplore) &&
                  canStartExploreSelection) ||
                (selectedInventoryUseEffectMode === "placeExplorer" &&
                  inventoryTargetRooms.length > 0) ||
                (selectedCardNeedsTargetRoom &&
                  maskTargetTokens.length > 0 &&
                  maskTargetRooms.length > 0)) ? (
                <div
                  className={`pointer-events-auto absolute left-1/2 z-50 flex max-w-[min(880px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 px-2 pb-1 pt-1 ${
                    core.phase === "haunt"
                      ? isPhoneLandscapeLayout
                        ? "top-[88px]"
                        : "top-[204px]"
                      : "top-[86px]"
                  }`}
                >
                  {roomFocusState ? (
                    <span
                      data-testid="betrayal-room-focus-target"
                      data-role="status"
                      className="rounded-none border-0 bg-transparent px-0 py-0 text-[12px] font-semibold text-[#eef4a8] underline decoration-[#c9a35e] decoration-2 underline-offset-4 shadow-none transition hover:text-[#f6ffc4]"
                    >
                      {roomFocusState.label}
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
                  {hauntActionContext?.actionKind?.startsWith("attack-") &&
                  attackWeaponCards.length > 0 ? (
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
                      {attackWeaponCards.map((card) => {
                        const isSelectedWeapon =
                          selectedAttackWeaponCardId === card.id;
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => handleSelectAttackWeapon(card.id)}
                            data-testid={`betrayal-attack-weapon-${card.id}`}
                            className={`min-h-[26px] rounded-none border-0 bg-transparent px-1 text-[11px] font-semibold shadow-none transition ${
                              isSelectedWeapon
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
                  {(canDeclareHolySymbolExplore || canDeclareIdolExplore) &&
                  canStartExploreSelection ? (
                    <div
                      data-testid="betrayal-explore-options"
                      className="inline-flex flex-wrap items-center gap-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
                    >
                      <span className="px-0 text-[11px] font-semibold text-[#d9c68f]">
                        {t("board.inventory.explore")}
                      </span>
                      {canDeclareHolySymbolExplore ? (
                        <button
                          type="button"
                          onClick={handleToggleHolySymbolExplore}
                          data-testid="betrayal-explore-option-holy-symbol"
                          className={`min-h-[36px] rounded-none border-0 bg-transparent px-2 text-[12px] font-semibold shadow-none transition ${
                            useHolySymbolForExplore
                              ? "text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4"
                              : "text-[#d6c498] hover:text-[#f0dfad]"
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
                          className={`min-h-[36px] rounded-none border-0 bg-transparent px-2 text-[12px] font-semibold shadow-none transition ${
                            useIdolForExplore
                              ? "text-[#eef4a8] underline decoration-[#c9a35e] underline-offset-4"
                              : "text-[#d6c498] hover:text-[#f0dfad]"
                          }`}
                        >
                          {t("board.inventory.idol")}
                        </button>
                      ) : null}
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
              ) : null}

              <div className="relative min-h-0 flex-1">
                <ZoomPanViewport
                  key={`${selectedRoomMapFloor}-${isHauntTargetingMode ? "haunt-target" : "normal"}`}
                  ref={roomGridRef}
                  className={`relative h-full min-h-0 w-full bg-transparent ${
                    isPhoneLandscapeLayout
                      ? "mx-auto grid max-w-none place-items-center"
                      : ""
                  }`}
                  contentClassName={`relative ${
                    isHauntTargetingMode
                      ? "h-full w-full"
                      : isPhoneLandscapeLayout
                        ? "mx-auto"
                        : "mx-auto xl:ml-0 xl:mr-auto"
                  }`}
                  containerTestId="betrayal-room-grid"
                  contentTestId="betrayal-room-canvas"
                  scaleTestId="betrayal-room-map-scale"
                  initialScale={1}
                  minScale={0.55}
                  maxScale={2.4}
                  panToTarget={
                    isPhoneLandscapeLayout
                      ? `betrayal-room-${core.currentExplorer.roomId}`
                      : null
                  }
                  panToScale={isPhoneLandscapeLayout ? 1 : undefined}
                  panBoundsMode="free"
                  dragBoundsPaddingRatioY={0.18}
                  containerProps={{
                    "data-haunt-targeting-mode": isHauntTargetingMode
                      ? "true"
                      : "false",
                  }}
                  interactionDisabled={isHauntTargetingMode}
                  contentStyle={
                    isHauntTargetingMode
                      ? {
                          width: "100%",
                          height: "100%",
                          transformOrigin: "center center",
                        }
                      : roomCanvasTransformStyle
                  }
                  ariaLabel={t("board.sections.rooms")}
                >
                  {visibleMapRooms
                    .filter(
                      (room) =>
                        !activeHauntTargetGuide?.roomId ||
                        room.id === activeHauntTargetGuide.roomId,
                    )
                    .map((room) => {
                      const tone = FLOOR_TONE[room.floor];
                      const isActive = room.id === core.activeRoomId;
                      const occupants = roomOccupants[room.id] ?? [];
                      const monsters = roomMonsters[room.id] ?? [];
                      const isDiscovered = room.state === "discovered";
                      const isReachableRoom = moveTargetRoomIds.has(room.id);
                      const isSkeletonKeyMoveTarget =
                        skeletonKeyMoveTargetRoomIds.has(room.id);
                      const isMoveTarget =
                        previewState.interactionMode === "move" &&
                        moveTargetRoomIds.has(room.id);
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
                      const canMoveToRoom =
                        previewState.interactionMode === "move" &&
                        isDiscovered &&
                        !isActive &&
                        core.movesRemaining > 0 &&
                        isReachableRoom;
                      const canExploreRoom = isExploreTarget;
                      const canSelectRoomFocusAction =
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
                        canSelectRoomFocusAction ||
                        canMoveToRoom ||
                        canExploreRoom;
                      const isRoomSelectionTarget =
                        canSelectEventRoom ||
                        canSelectInventoryRoom ||
                        canSelectMaskRoom;
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
                            ...(isHauntTargetRoom
                              ? {
                                  left: "50%",
                                  top: isPhoneLandscapeLayout ? "58%" : "52%",
                                  width: isPhoneLandscapeLayout ? 260 : 400,
                                  height: isPhoneLandscapeLayout ? 260 : 400,
                                  transform: "translate(-50%, -50%)",
                                  transformOrigin: "center center",
                                }
                              : {}),
                            zIndex: isHauntTargetRoom
                              ? 36
                              : isRoomSelectionTarget ||
                                  canSelectRoomFocusAction ||
                                  isMoveTarget ||
                                  isExploreTarget
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
                              if (canSelectRoomFocusAction) {
                                handleUseAction();
                                return;
                              }
                              if (canExploreRoom) {
                                handleExploreRoom(room.id);
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
                              canSelectRoomFocusAction ? "true" : undefined
                            }
                            data-direct-action={
                              canSelectRoomFocusAction
                                ? "room-focus"
                                : undefined
                            }
                            data-tutorial-id={
                              tutorialMapTargetRoomId === room.id
                                ? tutorialStep?.highlightTarget
                                : undefined
                            }
                            title={note}
                            className="relative h-full w-full overflow-visible rounded-[4px] border p-0 text-left transition duration-200 disabled:cursor-default"
                            style={{
                              borderColor: isMoveTarget
                                ? "rgba(118, 189, 153, 0.92)"
                                : isHauntTargetRoom
                                  ? "rgba(255, 224, 138, 0.98)"
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
                                  ? "0 0 0 4px rgba(255,224,138,0.72), 0 0 34px rgba(255,224,138,0.60), 0 0 70px rgba(181,239,66,0.22), 0 14px 26px rgba(0,0,0,0.26)"
                                  : canSelectRoomFocusAction
                                    ? "0 0 0 3px rgba(238,244,168,0.52), 0 0 24px rgba(238,244,168,0.34), 0 8px 16px rgba(0,0,0,0.18)"
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
                                            : isExploreTarget
                                              ? "0 0 0 2px rgba(211,179,109,0.42), 0 0 18px rgba(211,179,109,0.22), 0 8px 16px rgba(0,0,0,0.16)"
                                              : "0 8px 16px rgba(0,0,0,0.14)",
                              opacity: !isDiscovered
                                ? shouldDimForHauntTargetGuide
                                  ? 0.45
                                  : 1
                                : shouldDimForHauntTargetGuide
                                  ? 0.42
                                  : isActive ||
                                      isHauntTargetRoom ||
                                      canSelectRoomFocusAction ||
                                      isMoveTarget ||
                                      isRoomSelectionTarget ||
                                      isReachableRoom ||
                                      isExploreTarget
                                    ? 1
                                    : 0.92,
                              filter: shouldDimForHauntTargetGuide
                                ? "saturate(0.58) brightness(0.58)"
                                : isHauntTargetRoom
                                  ? "saturate(1.18) brightness(1.12)"
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
                            {isHauntTargetRoom ? (
                              <span
                                data-testid={`betrayal-haunt-target-room-spotlight-${room.id}`}
                                className="pointer-events-none absolute -inset-2 z-[18] rounded-[8px] border border-[#ffe08a] bg-[radial-gradient(circle_at_50%_44%,rgba(255,224,138,0.20),rgba(255,224,138,0.06)_54%,transparent_76%)] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_36px_rgba(255,224,138,0.66)]"
                              />
                            ) : null}
                            <div
                              className={`pointer-events-none absolute inset-0 rounded-[3px] ${
                                isActive
                                  ? "bg-[radial-gradient(circle_at_50%_42%,rgba(126,189,145,0.12),transparent_58%),linear-gradient(180deg,rgba(6,11,9,0.02),rgba(4,7,6,0.24))]"
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
                                      : `betrayal-room-mask-target-card-highlight-${room.id}`
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
                                        (hauntActionContext?.actionKind ===
                                          "attack-dust" ||
                                          isDustSicknessExchangeMode);
                                      const canSelectHungryHouseCultistTarget =
                                        hungryHouseCultistTargetPlayerIds.has(
                                          occupant.playerId,
                                        );
                                      const canSelectMagicCameraTarget =
                                        magicCameraPhotoTargetPlayerIds.has(
                                          occupant.playerId,
                                        ) ||
                                        phantomPhotographerTargetPlayerIds.has(
                                          occupant.playerId,
                                        );
                                      const canSelectExplorerTarget =
                                        canSelectTraitorTarget ||
                                        canSelectDustTarget ||
                                        canSelectHungryHouseCultistTarget ||
                                        canSelectMagicCameraTarget ||
                                        heroAttackTargetPlayerIds.has(
                                          occupant.playerId,
                                        ) ||
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
                                      const tokenContent = (
                                        <>
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
                                            />,
                                          )}
                                          {canSelectExplorerTarget ? (
                                            <span
                                              data-testid={`betrayal-room-occupant-target-outline-${room.id}-${occupant.playerId}`}
                                              data-highlight-shape="pentagon"
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
                                            title={tokenLabel}
                                            aria-label={tokenLabel}
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
                                    className={`flex justify-center ${
                                      isHauntTargetRoom
                                        ? "max-w-[300px] flex-row gap-3"
                                        : "max-h-[146px] flex-col gap-2"
                                    } ${monsterContainerClass}`}
                                  >
                                    {monsters.map((monster) => {
                                      const isHungryHouseCultistTarget =
                                        hungryHouseTargetCultistIds.has(
                                          monster.id,
                                        );
                                      const canSelectHungryHouseCultistTarget =
                                        isHungryHouseCultistTarget &&
                                        activeHauntTargetGuide?.kind ===
                                          "monster" &&
                                        hauntActionContext?.actionKind ===
                                          "attack-cultist";
                                      const canSelectMonsterTarget =
                                        canSelectHungryHouseCultistTarget ||
                                        (selectedInventoryUseEffectMode ===
                                          "moveOthersInRoom" &&
                                          maskTargetTokens.some(
                                            (target) =>
                                              target.kind === "monster" &&
                                              target.id === monster.id,
                                          ));
                                      const isSelectedMonsterTarget =
                                        activeMaskTargetTokenId ===
                                          monster.id ||
                                        (hauntActionContext?.actionKind ===
                                          "attack-cultist" &&
                                          hauntActionContext.targetMonsterId ===
                                            monster.id);
                                      const isHauntGuideMonsterTarget =
                                        canSelectHungryHouseCultistTarget;
                                      const monsterContent = (
                                        <>
                                          {canSelectMonsterTarget &&
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
                                          <span className="relative z-10">
                                            <MonsterBoardToken
                                              monster={monster}
                                              locale={effectiveLocale}
                                            />
                                          </span>
                                          {canSelectMonsterTarget ? (
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
                                                  ? "pointer-events-none absolute left-1/2 top-1/2 z-20 h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border-2 border-[#d9ff97] bg-transparent shadow-[0_0_0_1px_rgba(24,17,8,0.9),0_0_22px_rgba(217,255,151,0.52)] motion-safe:animate-pulse"
                                                  : "pointer-events-none absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-[4px] border border-[rgba(255,224,138,0.62)] bg-[rgba(18,10,8,0.92)] px-1.5 py-0.5 text-[8px] font-black leading-none tracking-[0.04em] text-[#ffe08a] shadow-[0_3px_8px_rgba(0,0,0,0.38)]"
                                              }
                                            >
                                              {isHauntGuideMonsterTarget
                                                ? null
                                                : monster.name}
                                            </span>
                                          ) : null}
                                        </>
                                      );

                                      if (canSelectMonsterTarget) {
                                        return (
                                          <button
                                            key={monster.id}
                                            type="button"
                                            data-testid={`betrayal-room-monster-${room.id}-${monster.id}`}
                                            data-highlight-shape="token"
                                            data-direct-target="true"
                                            data-haunt-target-hitbox={
                                              isHauntGuideMonsterTarget
                                                ? "true"
                                                : undefined
                                            }
                                            title={
                                              isHauntGuideMonsterTarget
                                                ? `${monster.name} · ${
                                                    activeHauntTargetGuide?.cue ??
                                                    monster.name
                                                  }`
                                                : `${monster.name} · 力量 ${monster.might} · 速度 ${monster.speed}`
                                            }
                                            aria-label={
                                              isHauntGuideMonsterTarget
                                                ? `${monster.name}，${
                                                    activeHauntTargetGuide?.cue ??
                                                    monster.name
                                                  }`
                                                : monster.name
                                            }
                                            className={`pointer-events-auto relative cursor-pointer outline-none transition hover:drop-shadow-[0_0_14px_rgba(209,176,95,0.46)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1b05f] ${
                                              isHauntGuideMonsterTarget
                                                ? "grid min-h-[76px] min-w-[76px] place-items-center rounded-[14px] p-3 drop-shadow-[0_0_18px_rgba(255,224,138,0.48)]"
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
                                          title={`${monster.name} · 力量 ${monster.might} · 速度 ${monster.speed}`}
                                        >
                                          {monsterContent}
                                        </span>
                                      );
                                    })}
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
                          {isExploreTarget ? (
                            <span
                              data-testid={`betrayal-room-explore-target-${room.id}`}
                              className="pointer-events-none absolute inset-0 z-30 rounded-[4px] border-2 border-[#d3b36d] bg-[linear-gradient(180deg,rgba(211,179,109,0.16),rgba(211,179,109,0.04))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_26px_rgba(211,179,109,0.58)]"
                              title={t("board.rooms.explorable")}
                            />
                          ) : null}
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
                        </div>
                      );
                    })}
                </ZoomPanViewport>
                <div
                  data-testid="betrayal-room-floor-switcher"
                  className={`pointer-events-auto absolute bottom-3 right-3 z-[60] w-[54px] flex-col items-center overflow-hidden rounded-[10px] border bg-[rgba(8,10,8,0.76)] text-[11px] font-semibold text-[#d6c498] shadow-[0_10px_24px_rgba(0,0,0,0.36)] backdrop-blur-sm lg:right-[236px] ${
                    shouldHideBlockingTableChrome || activeHauntTargetGuide
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
              {visibleActionItems.length > 0 &&
              !isEndgameExorciseRollReview &&
              !shouldHideBlockingTableChrome &&
              !isPhoneLandscapeLayout ? (
                <div
                  data-testid="betrayal-action-rail"
                  className="pointer-events-none absolute inset-x-0 bottom-1 z-50 hidden flex-col items-center justify-end gap-0.5 md:flex"
                >
                  {!pendingTradeAgreement &&
                  !pendingSicknessExchange &&
                  !isDustSicknessExchangeMode &&
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
                        .filter(
                          (card) =>
                            card.id !== "dog" &&
                            !core.usedCardIdsThisTurn.includes(card.id),
                        )
                        .map((card) => {
                          const isDogCardSelected =
                            selectedDogTradeCardIds.includes(card.id);
                          return renderInventoryCard(card, {
                            layout: "compact",
                            testId: `betrayal-dog-trade-card-${card.id}`,
                            compactDenseNoFront: card.kind === "omen",
                            selected: isDogCardSelected,
                            onSelect: () => handleToggleDogTradeCard(card.id),
                            showTurnStatus: false,
                          });
                        })}
                    </div>
                  ) : null}
                  {!pendingTradeAgreement &&
                  !pendingSicknessExchange &&
                  !isDustSicknessExchangeMode &&
                  core.recommendedAction === "trade" &&
                  selectedTradeTarget &&
                  !selectedCorpseLootTarget &&
                  selectedTradeTarget.inventory.some(
                    (card) => !core.usedCardIdsThisTurn.includes(card.id),
                  ) ? (
                    <div
                      data-testid="betrayal-trade-return-selector"
                      data-current-flow-choice="trade-return"
                      className="pointer-events-auto flex max-w-[min(620px,calc(100vw-2rem))] flex-wrap items-end justify-center gap-1.5 rounded-[8px] border border-[rgba(238,204,126,0.26)] bg-[rgba(12,13,10,0.58)] px-2 py-1.5 shadow-[0_10px_26px_rgba(0,0,0,0.24)] backdrop-blur-sm"
                    >
                      <span className="self-center px-1 text-[11px] font-semibold text-[#d9c68f]">
                        {tradeReturnSelectorLabel}
                      </span>
                      {selectedTradeTarget.inventory
                        .filter(
                          (card) => !core.usedCardIdsThisTurn.includes(card.id),
                        )
                        .map((card) => {
                          const isReturnCardSelected =
                            selectedTradeReturnCardIds.includes(card.id);
                          return renderInventoryCard(card, {
                            layout: "compact",
                            testId: `betrayal-trade-return-card-${card.id}`,
                            compactDenseNoFront: card.kind === "omen",
                            selected: isReturnCardSelected,
                            onSelect: () =>
                              handleToggleTradeReturnCard(card.id),
                            showTurnStatus: false,
                          });
                        })}
                    </div>
                  ) : null}
                  {pendingSicknessExchange || isDustSicknessExchangeMode ? (
                    <div
                      data-testid="betrayal-sickness-exchange-banner"
                      data-sickness-exchange-state={
                        pendingSicknessExchange
                          ? isPendingSicknessForViewer
                            ? "incoming"
                            : isPendingSicknessFromViewer
                              ? "waiting"
                              : "observing"
                          : "selecting"
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
                        className={
                          pendingSicknessExchange
                            ? "text-[#fff1b8]"
                            : "text-[#d6c498]"
                        }
                      >
                        {pendingSicknessExchange
                          ? isPendingSicknessForViewer
                            ? t("board.status.sicknessExchangeTitle")
                            : t("board.status.sicknessExchangeWaiting", {
                                player: pendingSicknessTargetName,
                              })
                          : t("board.status.sicknessExchangeChoose")}
                      </span>
                      {pendingSicknessExchange && isPendingSicknessForViewer ? (
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
                      ) : pendingSicknessExchange ? (
                        <span
                          data-testid="betrayal-sickness-exchange-waiting"
                          className="text-[11px] uppercase tracking-[0.14em] text-[#bba979]"
                        >
                          {t("board.status.tradeStepAgree")}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {!pendingSicknessExchange &&
                  !isDustSicknessExchangeMode &&
                  (pendingTradeAgreement ||
                    core.recommendedAction === "trade") ? (
                    <div
                      data-testid="betrayal-trade-flow-banner"
                      data-trade-agreement-state={
                        pendingTradeAgreement
                          ? isPendingTradeForViewer
                            ? "incoming"
                            : isPendingTradeFromViewer
                              ? "waiting"
                              : "observing"
                          : "draft"
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
                      <span data-testid="betrayal-trade-flow-item-step">
                        {tradeInstructionText}
                      </span>
                      <span
                        data-testid="betrayal-trade-flow-target-step"
                        className={
                          pendingTradeAgreement
                            ? "text-[#fff1b8]"
                            : tradeSelectionReady
                              ? "text-[#f6ffc4]"
                              : "text-[#d6c498]"
                        }
                      >
                        {pendingTradeAgreement
                          ? isPendingTradeForViewer
                            ? t("board.status.tradeAgreementTitle")
                            : t("board.status.tradeFlowWaiting", {
                                player: pendingTradeTargetName,
                              })
                          : tradeSelectionReady
                            ? t("board.status.tradeFlowRequest")
                            : t("board.status.tradeFlowChoose")}
                      </span>
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
                          data-trade-confirm-placement="flow-banner"
                          className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[6px] border border-[#d7c16f] bg-[rgba(215,193,111,0.24)] px-3 py-1 text-[12px] font-black tracking-[0.08em] text-[#fff4ba] shadow-[0_0_18px_rgba(215,193,111,0.24)] transition hover:bg-[rgba(215,193,111,0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff1b8]"
                        >
                          <Handshake size={14} strokeWidth={2.4} />
                          <span>{t("board.status.tradeFlowRequest")}</span>
                        </button>
                      ) : null}
                      {!pendingTradeAgreement ? (
                        <span
                          data-testid="betrayal-trade-flow-steps"
                          className="flex flex-wrap items-center justify-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[#baad82]"
                        >
                          <span>{t("board.status.tradeStepItem")}</span>
                          <span>→</span>
                          <span>{t("board.status.tradeStepTarget")}</span>
                          <span>→</span>
                          <span>{t("board.status.tradeStepReturn")}</span>
                          <span>→</span>
                          <span>{t("board.status.tradeStepRequest")}</span>
                          <span>→</span>
                          <span>{t("board.status.tradeStepAgree")}</span>
                        </span>
                      ) : null}
                      {pendingTradeAgreement && isPendingTradeForViewer ? (
                        <div
                          data-testid="betrayal-trade-agreement-panel"
                          className="ml-1 flex items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveTradeAgreement(true);
                            }}
                            data-testid="betrayal-trade-agreement-accept"
                            className="min-h-[34px] rounded-[5px] border border-[#d7c16f] bg-[rgba(215,193,111,0.20)] px-3 py-1 text-[12px] font-black text-[#fff4ba] shadow-[0_0_16px_rgba(215,193,111,0.22)] transition hover:bg-[rgba(215,193,111,0.30)]"
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
                            className="min-h-[34px] rounded-[5px] border border-[rgba(244,164,120,0.42)] bg-[rgba(96,48,30,0.36)] px-3 py-1 text-[12px] font-bold text-[#f3c1a1] transition hover:bg-[rgba(116,58,36,0.46)]"
                          >
                            {t("board.status.tradeAgreementDecline")}
                          </button>
                        </div>
                      ) : pendingTradeAgreement ? (
                        <span
                          data-testid="betrayal-trade-agreement-waiting"
                          className="text-[11px] uppercase tracking-[0.14em] text-[#bba979]"
                        >
                          {t("board.status.tradeStepAgree")}
                        </span>
                      ) : null}
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
                  <div className="pointer-events-auto flex items-end justify-center gap-5">
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
                      const isRecommended =
                        action.id === core.recommendedAction ||
                        (previewState.interactionMode === "move" &&
                          action.id === "move") ||
                        (isDustSicknessExchangeMode && action.id === "trade") ||
                        isRoomEndTurnEffectAction;
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
                          data-testid={`betrayal-action-${action.id}`}
                          data-tutorial-id={`betrayal-action-${action.id}`}
                          title={actionCueText}
                          className={`flex min-h-[48px] min-w-[80px] flex-col items-center justify-end gap-0.5 rounded-[5px] border-0 bg-transparent px-1.5 py-1 text-[13px] font-bold uppercase tracking-[0.08em] shadow-none transition ${
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
            className={`pointer-events-auto absolute bottom-3 right-3 top-3 z-40 w-[216px] min-h-0 flex-col gap-2 overflow-y-auto px-1 py-1 md:px-1 ${
              isPhoneLandscapeLayout ||
              shouldHideBlockingTableChrome ||
              activeHauntTargetGuide
                ? "hidden"
                : "flex"
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
                <button
                  type="button"
                  onClick={openScenarioReference}
                  data-testid="betrayal-open-scenario"
                  className="inline-flex h-[40px] min-w-[84px] items-center gap-1.5 rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] px-2.5 text-[#d8bf81] transition hover:border-[#8b744d]"
                  title={activeHauntReferenceTitle}
                >
                  <BookOpen size={15} />
                  <span className="text-[11px] font-semibold tracking-[0.06em]">
                    {activeHauntReferenceTitle}
                  </span>
                </button>
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
                  onClick={() => setRoomPreviewId(core.activeRoomId)}
                  data-testid="betrayal-open-active-room-preview"
                  className="grid h-[40px] w-[40px] place-items-center rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] text-[#d8bf81] transition hover:border-[#8b744d]"
                  title={t("board.rooms.preview")}
                >
                  <House size={16} />
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
                    const isHungryHouseCultistTarget =
                      hungryHouseCultistTargetPlayerIds.has(explorer.playerId);
                    const isAttackTarget =
                      heroAttackTargetPlayerIds.has(explorer.playerId) ||
                      isMagicCameraPhotoTarget ||
                      isPhantomPhotographerTarget ||
                      isHungryHouseCultistTarget ||
                      (hauntActionContext?.actionKind === "attack-dust" &&
                        isDustTarget);
                    const isSelectedAttackTarget =
                      hauntActionContext?.actionKind === "attack-hero" &&
                      hauntActionContext.targetPlayerId === explorer.playerId;
                    const isSelectedTradeTarget =
                      explorer.playerId === selectedTradeTargetPlayerId ||
                      explorer.playerId === selectedCorpseLootTargetPlayerId ||
                      isSelectedAttackTarget ||
                      (isSicknessExchangeTarget &&
                        explorer.playerId === selectedDustTargetPlayerId);
                    const isSameRoom =
                      core.currentExplorer.roomId === explorer.roomId;
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
                          openExplorerDetails(explorer.playerId);
                        }}
                        data-testid={`betrayal-bottom-teammate-${explorer.playerId}`}
                        data-player-id={explorer.playerId}
                        data-explorer-id={explorer.explorerId}
                        data-room-id={explorer.roomId}
                        data-token-asset={
                          explorer.tokenAsset ?? explorer.portraitAsset
                        }
                        className={`group relative grid grid-cols-[34px_minmax(0,1fr)] items-start gap-2 rounded-[8px] border px-1.5 py-1.5 text-left transition ${
                          isSelectedTradeTarget
                            ? "border-[#eecc7e] bg-[linear-gradient(180deg,rgba(53,40,20,0.72),rgba(22,19,14,0.82))] shadow-[0_0_0_1px_rgba(24,17,8,0.92),0_0_18px_rgba(238,204,126,0.34)]"
                            : isTradeCandidate ||
                                isCorpseLootCandidate ||
                                isAttackTarget
                              ? "border-[rgba(118,189,153,0.46)] bg-[rgba(12,18,15,0.20)] hover:bg-[rgba(28,24,19,0.5)] hover:border-[rgba(159,225,167,0.64)]"
                              : "border-transparent hover:bg-[rgba(28,24,19,0.5)]"
                        }`}
                        title={t("board.players.detailsAria", {
                          player: resolvePlayerName(
                            explorer.playerId,
                            explorer.displayName,
                            matchData,
                          ),
                        })}
                      >
                        <div
                          className={`relative h-[34px] w-[34px] overflow-visible rounded-[6px] border ${
                            isTradeCandidate ||
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
                          <div className="pointer-events-none absolute -bottom-2 -right-2">
                            {renderAttackImpactSurface(
                              explorer.playerId,
                              "bottom-teammate",
                              <ExplorerFigureToken
                                explorer={explorer}
                                locale={effectiveLocale}
                                label={resolvePlayerName(
                                  explorer.playerId,
                                  explorer.displayName,
                                  matchData,
                                )}
                                tone="ally"
                                size="panel"
                                testIdPrefix="betrayal-bottom-teammate-token"
                              />,
                              "panel",
                            )}
                          </div>
                          <span
                            className={`pointer-events-none absolute inset-0 rounded-[6px] ring-1 ${
                              isSameRoom
                                ? "ring-[rgba(174,230,133,0.34)]"
                                : "ring-transparent"
                            }`}
                          />
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
                                className={`shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[9px] ${
                                  isSelectedTradeTarget
                                    ? "border-[#eecc7e] bg-[rgba(238,204,126,0.18)] text-[#ffe4a0]"
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
          onClose={() => {
            setReferenceOpen(false);
            setScenarioReaderOpen(false);
          }}
          overlayTestId={
            scenarioReaderOpen
              ? "betrayal-scenario-reader-dialog"
              : "betrayal-reference-overlay"
          }
          overlayClassName="bg-[rgba(3,6,5,0.82)] p-3 md:p-6"
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
                ? {
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
              onClick={() => {
                setReferenceOpen(false);
                setScenarioReaderOpen(false);
              }}
              data-testid={
                scenarioReaderOpen
                  ? "betrayal-scenario-reader-close"
                  : "betrayal-reference-close"
              }
              className="absolute right-3 top-3 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[5px] bg-[rgba(9,13,12,0.84)] px-4 text-xs font-medium text-[#f3e0b4] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.92)]"
            >
              {scenarioReaderOpen
                ? t("board.characterSelect.hideScenarioDetails")
                : t("board.reference.close")}
            </button>
            {scenarioReaderOpen ? (
              <div
                data-testid="betrayal-scenario-objective-page"
                data-reference-page="scenario"
                className={`relative flex h-full w-full flex-col overflow-hidden border border-[#7b633d] bg-[linear-gradient(180deg,rgba(31,24,15,0.98),rgba(10,12,9,0.98))] text-[#f3e0b4] shadow-[0_24px_56px_rgba(0,0,0,0.44)] ${isPhoneLandscapeLayout ? "p-3" : "p-5"}`}
              >
                <div
                  className={`flex items-start justify-between gap-4 border-b border-[rgba(211,179,109,0.24)] pr-32 ${isPhoneLandscapeLayout ? "pb-2" : "pb-3"}`}
                >
                  <div>
                    <div
                      className={`${isPhoneLandscapeLayout ? "text-[10px]" : "text-[12px]"} font-bold uppercase tracking-[0.18em] text-[#c9a35e]`}
                    >
                      {activeHauntReferenceTitle}
                    </div>
                    <div
                      className={`${isPhoneLandscapeLayout ? "text-[18px]" : "mt-1 text-[24px]"} font-bold tracking-[0.04em] text-[#fff0b8]`}
                    >
                      {activeHauntTitle}
                    </div>
                  </div>
                  <div className="rounded-[4px] border border-[rgba(211,179,109,0.22)] bg-[rgba(8,11,9,0.48)] px-3 py-1.5 text-right text-[12px] font-semibold text-[#d5c5a2]">
                    <span data-testid="betrayal-scenario-reader-header-progress">
                      {referenceScenarioSpreadIndex + 1}/
                      {referenceScenarioSpreadCount}
                    </span>
                  </div>
                </div>
                <div
                  data-testid="betrayal-scenario-book"
                  className={`relative grid min-h-0 flex-1 grid-cols-2 overflow-hidden transition-[transform,opacity,filter] duration-300 ease-out ${isPhoneLandscapeLayout ? "mt-2 gap-2" : "mt-4 gap-3"} ${
                    referenceScenarioTurnDirection === "forward"
                      ? "translate-x-1 opacity-95 brightness-110"
                      : referenceScenarioTurnDirection === "back"
                        ? "-translate-x-1 opacity-95 brightness-110"
                        : "translate-x-0 opacity-100 brightness-100"
                  }`}
                >
                  <ScenarioBookTurnSheet
                    direction={referenceScenarioTurnDirection}
                  />
                  {[referenceScenarioLeftPage, referenceScenarioRightPage].map(
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
                              className="absolute left-0 top-0 text-[11px] font-bold tracking-[0.18em] text-[#86643f]"
                            >
                              {String(page.pageNumber).padStart(2, "0")}
                            </div>
                            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                              <div
                                className={`grid min-h-full content-center ${isPhoneLandscapeLayout ? "gap-2 py-5" : "gap-6 px-3 py-10"}`}
                              >
                                {(page.sections ?? []).map((section) => (
                                  <section
                                    key={section.id}
                                    data-testid={`betrayal-scenario-book-section-${section.id}`}
                                    className={`border-l-4 ${isPhoneLandscapeLayout ? "pl-2" : "pl-4"} ${section.accentClass}`}
                                  >
                                    <h3
                                      className={`${isPhoneLandscapeLayout ? "text-[14px]" : "text-[22px]"} font-black tracking-[0.03em] text-[#3b2211]`}
                                    >
                                      {t(section.labelKey)}
                                    </h3>
                                    <p
                                      className={`${isPhoneLandscapeLayout ? "mt-1 text-[11px] leading-[1.45]" : "mt-3 text-[15px] leading-7"} whitespace-pre-line font-medium text-[#4e321c]`}
                                    >
                                      {t(section.bodyKey)}
                                    </p>
                                  </section>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </section>
                    ),
                  )}
                </div>
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

        {previewRoom && previewRoomVisual ? (
          <div
            className="absolute inset-0 z-50 grid place-items-center bg-[rgba(3,6,5,0.76)] p-4"
            data-testid="betrayal-room-preview-overlay"
            onClick={() => setRoomPreviewId(null)}
          >
            <div
              className="pointer-events-auto max-h-[92vh] max-w-[92vw]"
              onClick={(event) => event.stopPropagation()}
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
            </div>
          </div>
        ) : null}

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

        {(core.recommendedAction === "trade" &&
          !pendingTradeAgreement &&
          !pendingSicknessExchange &&
          !isDustSicknessExchangeMode &&
          !shouldShowInlineTradeConfirm) ||
        isEndgameExorciseRollReview ||
        shouldHideBlockingTableChrome ? null : (
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
                      {selectedInventoryCard?.name ||
                        t("board.status.noSelectedCard")}
                    </span>
                    <span data-testid="betrayal-mobile-use-status">
                      {useStatusText}
                    </span>
                    {shouldShowMobileTradeStatus ? (
                      <span data-testid="betrayal-mobile-trade-status">
                        {tradeStatusText}
                      </span>
                    ) : null}
                    <span data-testid="betrayal-mobile-action-cue">
                      {actionCueText}
                    </span>
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
                      {selectedInventoryCard?.name ||
                        t("board.status.noSelectedCard")}
                    </div>
                    <div
                      className={`mt-1 truncate text-[11px] ${selectedCardUseDisabled ? "text-[#f0c1a2]" : "text-[#8db29a]"}`}
                      data-testid="betrayal-mobile-use-status"
                    >
                      {useStatusText}
                    </div>
                    {shouldShowMobileTradeStatus ? (
                      <div
                        className={`mt-1 truncate text-[11px] ${
                          pendingTradeAgreement ||
                          pendingSicknessExchange ||
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
                    ) : null}
                    <div
                      className="sr-only"
                      data-testid="betrayal-mobile-action-cue"
                    >
                      {actionCueText}
                    </div>
                  </div>
                )}
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
                  className={`grid min-w-0 ${
                    isPhoneLandscapeLayout
                      ? "grid-cols-5"
                      : "flex-1 grid-cols-5"
                  } ${isPhoneLandscapeLayout ? "min-h-[56px] items-stretch gap-3" : "gap-2"}`}
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
                    const isRecommended =
                      action.id === core.recommendedAction ||
                      (previewState.interactionMode === "move" &&
                        action.id === "move") ||
                      (isDustSicknessExchangeMode && action.id === "trade") ||
                      isRoomEndTurnEffectAction;
                    return (
                      <button
                        key={`mobile-dock-${action.id}`}
                        type="button"
                        onClick={actionHandlerMap[action.id]}
                        disabled={action.disabled}
                        data-testid={`betrayal-mobile-dock-${action.id}`}
                        data-tutorial-id={`betrayal-action-${action.id}`}
                        className={`flex flex-col items-center justify-center transition ${
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
                        style={
                          isPhoneLandscapeLayout
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
                            : undefined
                        }
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
    </div>
  );
}
