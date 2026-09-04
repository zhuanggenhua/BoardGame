import React from "react";
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
  LocateFixed,
  RotateCcw,
  RotateCw,
  Search,
  Skull,
  Swords,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTutorial, useTutorialBridge } from "../../contexts/TutorialContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { HudPortal, UI_Z_INDEX } from "../../core";
import type { ActionBarAction } from "../../core/ui/types";
import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import { MagnifyOverlay } from "../../components/common/overlays/MagnifyOverlay";
import { playSound, useGameAudio } from "../../lib/audio/useGameAudio";
import {
  ResourceTraySkeleton,
  ZoomPanViewport,
  useVisualSequenceGate,
} from "../../components/game/framework";
import { useRuntimeViewport } from "../../hooks/ui/useRuntimeViewport";
import type { GameBoardProps } from "../../engine/transport/protocol";
import type {
  BetrayalCommandMap,
  BetrayalCore,
  BetrayalDeckKind,
  BetrayalDiscoverySummary,
  BetrayalExplorerSummary,
  BetrayalInventoryCard,
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
} from "./game";
import {
  BETRAYAL_COMMANDS,
  BetrayalDomain,
  EXPLORER_CATALOG,
  createBetrayalCharacterSelectCore,
  resolveInventoryEffectId,
  resolveUseEffect,
} from "./game";
import { resolveMoveTargetRooms as resolveDomainMoveTargetRooms } from "./movementReadModel";
import {
  resolveExplorableRoomSlots,
  resolveNextRoomDiscoveryDeckKind,
  resolveRoomPlacementPreview,
  resolveRoomTileAdjustmentOptions,
} from "./roomDiscoveryModel";
import {
  resolveHelpingHandsPendingAttackReward,
  resolveHelpingHandsStealableCards,
  resolveHelpingHandsTrollHandAttackOptions,
  resolveHelpingHandsTrollHandMoveOptions,
  resolveMummyPendingAttackReward,
  resolveMummyStealableCards,
  type BetrayalHelpingHandsTrollHandAttackOption,
} from "./hauntAttackRewardReadModel";
import { resolveBloodFromStoneSetupPlacementPlan } from "./bloodFromStoneSetupReadModel";
import { resolveCorpseLootTargets } from "./deathStateReadModel";
import { resolveBetrayalMonsterRelationToExplorer } from "./entityRelationModel";
import { resolveHelpingHandsControllerPlayerId } from "./hauntScenarioReadModel";
import { resolveBetrayalHauntRevealProtocol } from "./hauntSetupModel";
import {
  resolveBetrayalMonsterActionPanel,
  resolveBetrayalNormalMonsterAttackTargets,
  resolveHelpingHandsMonsterTurnStatus,
  resolveMagicCameraPhantomAttackTargets,
  type BetrayalMonsterActionSlot,
} from "./monsterActionReadModel";
import { resolveBetrayalMonsterStatuses } from "./monsterReadModel";
import {
  resolveBetrayalHauntSpecialActionStatus,
  resolveBloodFromStonePeekabooOptions,
  resolveMagicCameraPhotoTargets,
  type BetrayalBloodFromStonePeekabooOption,
  type BetrayalHauntSpecialActionId,
  type BetrayalHauntSpecialActionStatus,
} from "./hauntSpecialActionReadModel";
import {
  resolveBetrayalHauntTokenInstances,
  type BetrayalHauntTokenInstanceSummary,
} from "./hauntTokenModel";
import {
  canUseBookForPendingEventRoll,
  canUseHolySymbolForDiscovery,
  canUseIdolToSkipEvent,
  canUseRecentRollRerollItemForRecentRoll,
  canUseSkeletonKeyForMove,
  resolveBetrayalPossessionSpecialActionStatus,
  resolveRecentRollRerollSelectableDieIndices,
} from "./possessionActionReadModel";
import {
  resolveBetrayalHauntRisk,
  resolveBetrayalNumberTracks,
} from "./hauntProgress";
import { resolveBetrayalRoomSpecialActionStatus } from "./roomActionReadModel";
import {
  canUseDogForTrade,
  resolveBetrayalTradeCardStatus,
  resolveDogTradeTargets,
  resolveSelectedDogTradeCardIds,
  resolveSelectedTradeGiveCardIds,
  resolveSelectedTradeTargetPlayerId,
  resolveTradeTargets,
  type BetrayalTradeCardStatus,
} from "./trade";
import {
  BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
  resolvePossessionAtlasVisual,
  type BetrayalPossessionAtlasVisual,
} from "./possessionAtlas";
import {
  isBetrayalOptionalHauntRollRuntimeSupported,
  type BetrayalScenarioCardId,
} from "./scenarioConfig";
import {
  buildScenarioReaderPages,
  findScenarioOpeningNarrationSection,
  isScenarioReaderCinematicSection,
  resolveActiveHauntDossier,
  resolveScenarioReaderScope,
  resolveScenarioReaderSpreadPages,
  type ScenarioBookTurnSnapshot,
} from "./scenarioReader";
import { CinematicNarrationPanel } from "./cinematicNarrationSurface";
import { BetrayalHauntRevealCue } from "./hauntRevealCueSurface";
import {
  FLOOR_TONE,
  ROOM_CANVAS_MIN_HEIGHT,
  ROOM_CANVAS_MIN_WIDTH,
  ROOM_MAP_FLOOR_ORDER,
  ROOM_ORIENTATION_DEGREES,
  buildRoomMonsters,
  buildRoomOccupants,
  formatRoomTargetList,
  resolveDynamiteTargetRooms,
  resolveBetrayalLineOfSightRoomIds,
  resolveExplorerFloor,
  resolveExplorerFloorByPlayer,
  resolveFloorLabel,
  resolveOccupiedRoomMapFloors,
  resolveOppositeRoomEdge,
  resolveRoomCanvasLayout,
  resolveRoomCenterPoint,
  resolveRoomTileStyle,
  roomTileAdjustmentSelectionsMatch,
  toRoomTileAdjustmentSelection,
  type RoomOrientationTurns,
} from "./roomMapModel";
import {
  resolveRoomEdgeMarkerClass,
  resolveRoomEndTurnEffectHint,
  resolveRoomIdentityPresentation,
} from "./roomPresentation";
import {
  buildDeckItems,
  buildDiscardItems,
} from "./deckPresentation";
import {
  resolveReferencePages,
  type ReferencePageId,
} from "./referencePresentation";
import {
  resolveDamageReductionCardNames,
  resolveInventoryCardAccentAsset,
  resolveInventoryCardBackAsset,
  resolveInventoryFaceTone,
  resolveInventoryRulesSummary,
  resolvePreviewUseEffectLabel,
} from "./inventoryPresentation";
import {
  resolveEventActionEffect,
  resolveEventGeneralDamageChoice,
  resolveEventItemChoiceCards,
  resolveEventPreviewEffect,
  resolveEventTargetRooms,
  resolveEventTraitChoices,
} from "./eventChoicePreview";
import { isBetrayalCore } from "./coreSnapshotGuard";
import {
  buildEventSymbolSkipSourceKey,
  buildLatestDiscoveryDisplayEntry,
  buildLatestDiscoveryKey,
  isEventSymbolNoCardDiscovery,
  isHauntScenarioOpeningDiscovery,
  isHauntScenarioOpeningDiscoverySummary,
  isSpiderAdjacentRoomResolutionDiscovery,
  type LatestDiscoveryDisplayEntry,
} from "./latestDiscoveryPresentation";
import {
  buildRecentRollDisplayKey,
  isAcknowledgeableRecentRollDisplay,
  resolveEventRollConfirmationPresentation,
  resolveRecentRollActorLabel as resolveRecentRollActorLabelPresentation,
  resolveRecentRollAcknowledgedPlayerIdsForDisplay,
  resolveRecentRollRequiredPlayerIdsForDisplay,
} from "./recentRollPresentation";
import { resolvePlayerName } from "./playerPresentation";
import {
  resolveAttackImpactByPlayerId,
} from "./attackImpactPresentation";
import { BetrayalAttackImpactSurface } from "./attackImpactSurface";
import {
  resolveBetrayalAttackTargetPlayerIds,
  resolveAttackWeaponCardStatuses,
} from "./attackRules";
import {
  TRAIT_DAMAGE_ORDER,
  adjustSelectedDamageTrait,
  countSelectedDamageTrait,
  pruneSelectedDamageTraits,
  resolveExplorerBoardMarkerPosition,
  resolveExplorerTraitTrack,
  resolveHighestTraitChoice,
  resolveTraitDamageAssignableSteps,
  resolveTraitTrackValueAtPosition,
} from "./traitPresentation";
import { BETRAYAL_TRAIT_MARKER_ASSETS } from "./traitAssets";
import {
  BETRAYAL_COVER_ASSET,
  BETRAYAL_OMEN_DECK_ASSET,
  BETRAYAL_TITLE_BANNER_ASSET,
} from "./uiAssets";
import {
  ExplorerTraitOutcomePreview,
  ExplorerTraitTrackRail,
  TRAIT_CHOICE_TONE_CLASS,
  TRAIT_LABEL_LOCAL,
  TRAIT_TONE_CLASS,
  TRAIT_VALUE_TEXT_CLASS,
} from "./traitTrackSurface";
import {
  resolveDiscoveryAtlasVisual,
} from "./discoveryAtlas";
import {
  DiscoveryAtlasFrame,
  PossessionAtlasFrame,
} from "./atlasFrameSurface";
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
import {
  BetrayalConfirmButton,
  BetrayalSecondaryButton,
  BETRAYAL_CONFIRM_BUTTON_CLASS,
} from "./confirmButtonSurface";
import { BetrayalDebugPanel } from "./debugPanelSurface";
import { EndgameScreen } from "./endgameScreen";
import { ScenarioBookTurnSheet } from "./scenarioBookTurnSurface";
import { CharacterSelectScreen } from "./characterSelectSurface";
import { ExplorerFigureToken, GirlBoardToken, MonsterBoardToken } from "./entityTokenSurface";
import { ExplorerDetailsDialog, MonsterDetailsDialog, formatMonsterTraitSummary } from "./entityDetailsSurface";
import { RecentRollPanel, StandardRecentRollOverlay } from "./recentRollSurface";
import {
  BetrayalVisualTransitionLayer,
  centerBetrayalRect,
  findBetrayalTestElement,
  readBetrayalViewportRect,
  type BetrayalVisualTransition,
} from "./visualTransitionSurface";

type Props = GameBoardProps<BetrayalCore, BetrayalCommandMap>;

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

const ASSETS = {
  titleBanner: BETRAYAL_TITLE_BANNER_ASSET,
  cover: BETRAYAL_COVER_ASSET,
  playerReference: {
    front: "betrayal/cards/player-reference-zh-front",
    back: "betrayal/cards/player-reference-zh-back",
    traitor: "betrayal/cards/traitor-reference-zh",
    monster: "betrayal/cards/monster-reference-zh",
  },
  traitorBack: "betrayal/cards/back-traitor",
  deck: {
    omen: BETRAYAL_OMEN_DECK_ASSET,
    item: "betrayal/cards/back-item",
    event: "betrayal/cards/back-event",
  } satisfies Record<BetrayalDeckKind, string>,
  trait: {
    ...BETRAYAL_TRAIT_MARKER_ASSETS,
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
const REFERENCE_CARD_FRAME_WIDTH = `min(92vw, calc(86vh * ${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO}))`;
const SCENARIO_REFERENCE_BOOK_FRAME_WIDTH = "min(94vw, 1120px)";
const SCENARIO_REFERENCE_BOOK_FRAME_HEIGHT = "min(86vh, 760px)";
const INVENTORY_PREVIEW_MAX_WIDTH = 360;
const INVENTORY_PREVIEW_VIEWPORT_WIDTH_RATIO = 0.84;
const INVENTORY_PREVIEW_VERTICAL_GUTTER = 80;
const COMPACT_INVENTORY_CARD_WIDTH = 62;
// 剧本书是普通阅读模态层；教程讲读本时，通用 TutorialOverlay 必须仍在其上方可见。
const SCENARIO_READER_MODAL_Z_INDEX = UI_Z_INDEX.modalContent;

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

function resolvePreservedExplorePlacementState(
  core: BetrayalCore,
  previousState: PreviewState,
): Partial<PreviewState> | null {
  if (
    previousState.interactionMode !== "explore" ||
    !previousState.pendingRoomPlacementSlotId
  ) {
    return null;
  }
  const useHolySymbol =
    previousState.useHolySymbolForExplore && canUseHolySymbolForDiscovery(core);
  const placementPreview = resolveRoomPlacementPreview(core, {
    roomId: previousState.pendingRoomPlacementSlotId,
    useHolySymbol,
  });
  if (!placementPreview) {
    return null;
  }
  const selectedOrientationOption =
    placementPreview.orientationOptions.find(
      (option) =>
        option.orientationTurns === previousState.pendingRoomOrientationTurns,
    ) ??
    placementPreview.orientationOptions.find(
      (option) =>
        option.orientationTurns === placementPreview.defaultOrientationTurns,
    ) ??
    placementPreview.orientationOptions[0] ??
    null;
  const orientationTurns =
    selectedOrientationOption?.orientationTurns ??
    placementPreview.defaultOrientationTurns;
  const tileAdjustmentOption =
    previousState.pendingRoomTileAdjustment && placementPreview.requiresTileAdjustment
      ? resolveRoomTileAdjustmentOptions(core, {
          roomId: placementPreview.slotId,
          orientationTurns,
          useHolySymbol,
        }).find((option) =>
          roomTileAdjustmentSelectionsMatch(
            option,
            previousState.pendingRoomTileAdjustment!,
          ),
        ) ?? null
      : null;
  return {
    interactionMode: "explore",
    useHolySymbolForExplore: useHolySymbol,
    useIdolForExplore: false,
    ignoreEventSymbolWithTraitorPower: false,
    pendingRoomPlacementSlotId: placementPreview.slotId,
    pendingRoomPlacementFailure: null,
    pendingRoomOrientationTurns: orientationTurns,
    pendingRoomTileAdjustment: tileAdjustmentOption
      ? toRoomTileAdjustmentSelection(tileAdjustmentOption)
      : null,
  };
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

function resolveRoomEdgeLabel(
  edge: BetrayalRoomEdge,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return t(`board.rooms.edges.${edge}`);
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

function mergeEventTraitChoices(
  ...choices: BetrayalTraitKey[][]
): BetrayalTraitKey[] {
  return Array.from(new Set(choices.flat()));
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

export default function BetrayalBoard({
  G,
  dispatch,
  playerID,
  matchData,
  isMultiplayer,
  locale,
}: Props) {
  const { t } = useTranslation(["game-betrayal", "common"]);
  const {
    isActive: isTutorialActive,
    currentStep: tutorialStep,
    nextStep,
  } = useTutorial();
  const runtimeViewport = useRuntimeViewport({ syncCssVars: false });
  const runtimeDispatch = dispatch as unknown as (
    type: string,
    payload?: unknown,
  ) => void;
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
  const tutorialRuntimeSyncKey = React.useMemo(() => {
    const explorers = [baseCore.currentExplorer, ...baseCore.otherExplorers]
      .map((explorer) => [
        explorer.playerId,
        explorer.roomId,
        explorer.inventory.map((card) => card.id).join("/"),
      ].join(":"))
      .join(";");
    const pendingCards = (baseCore.pendingCardResolutionQueue ?? [])
      .map((resolution) => [
        resolution.id,
        resolution.playerId,
        resolution.cardName,
        (resolution.requiredPlayerIds ?? []).join("/"),
        (resolution.acknowledgedPlayerIds ?? []).join("/"),
      ].join(":"))
      .join(";");
    const discoveredRooms = baseCore.rooms
      .filter((room) => room.state === "discovered")
      .map((room) => `${room.id}:${room.visualId}`)
      .join(",");

    return [
      G?.sys?.eventStream?.nextId ?? 0,
      G?.sys?.eventStream?.entries?.length ?? 0,
      G?.sys?.decisionEpoch ?? 0,
      G?.sys?.interaction?.current?.id ?? "",
      G?.sys?.responseWindow?.current?.id ?? "",
      G?.sys?.responseWindow?.current?.currentResponderIndex ?? "",
      baseCore.phase,
      baseCore.currentPlayer,
      baseCore.recommendedAction,
      baseCore.movesRemaining,
      baseCore.activeRoomId,
      baseCore.latestDiscovery?.kind ?? "",
      baseCore.latestDiscovery?.title ?? "",
      baseCore.latestDiscoveryOwnerPlayerId ?? "",
      baseCore.recentRoll?.id ?? "",
      baseCore.recentRoll?.kind ?? "",
      baseCore.recentRoll?.dice.join("/") ?? "",
      baseCore.scenarioRuntime.hauntTriggered ? "haunt" : "pre-haunt",
      baseCore.scenarioRuntime.hauntScenarioCardId ?? "",
      baseCore.scenarioRuntime.traitorPlayerId ?? "",
      pendingCards,
      explorers,
      discoveredRooms,
    ].join("|");
  }, [G, baseCore]);
  useTutorialBridge(
    G?.sys?.tutorial,
    runtimeDispatch,
    tutorialRuntimeSyncKey,
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
  const undoProviderValue = React.useMemo(
    () => ({
      G,
      dispatch: runtimeDispatch,
      playerID,
      isGameOver,
      isLocalMode: !isMultiplayer,
    }),
    [G, isGameOver, isMultiplayer, playerID, runtimeDispatch],
  );
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
  const [inspectedMonsterId, setInspectedMonsterId] = React.useState<
    string | null
  >(null);
  const allExplorers = React.useMemo(
    () => [core.currentExplorer, ...core.otherExplorers],
    [core.currentExplorer, core.otherExplorers],
  );
  const resolveRecentRollActorLabel = React.useCallback(
    (roll: BetrayalRecentRollState | null | undefined) =>
      resolveRecentRollActorLabelPresentation({
        roll,
        viewerPlayerId,
        explorers: allExplorers,
        matchData,
      }),
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
  const inspectedMonster =
    core.monsters.find((monster) => monster.id === inspectedMonsterId) ?? null;
  const inspectedMonsterRoomName = inspectedMonster
    ? (core.rooms.find((room) => room.id === inspectedMonster.roomId)?.name ??
      t("board.rooms.unknown"))
    : "";
  const openExplorerDetails = React.useCallback((playerId: string) => {
    setInspectedExplorerPlayerId(playerId);
  }, []);
  const closeExplorerDetails = React.useCallback(() => {
    setInspectedExplorerPlayerId(null);
  }, []);
  const openMonsterDetails = React.useCallback((monsterId: string) => {
    setInspectedMonsterId(monsterId);
  }, []);
  const closeMonsterDetails = React.useCallback(() => {
    setInspectedMonsterId(null);
  }, []);
  React.useEffect(() => {
    if (
      inspectedMonsterId &&
      !core.monsters.some((monster) => monster.id === inspectedMonsterId)
    ) {
      setInspectedMonsterId(null);
    }
  }, [core.monsters, inspectedMonsterId]);
  const focusRoomOnMap = React.useCallback(
    (roomId: string, options: { pan?: boolean } = {}) => {
      const targetRoom = core.rooms.find((room) => room.id === roomId);
      if (!targetRoom) {
        return;
      }
      setSelectedRoomMapFloor(targetRoom.floor);
      const nextTarget = `betrayal-room-${targetRoom.id}`;
      setRoomFocusPanTarget(null);
      if (options.pan === false) {
        return;
      }
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
  const clearSelectedInventoryInteraction = React.useCallback(() => {
    setPreviewState((previousState) => ({
      ...previousState,
      selectedInventoryCardId: null,
      selectedInventoryTargetPlayerId: null,
      selectedInventoryTargetRoomId: null,
      selectedInventoryReplacementRollTotal: null,
      selectedMaskTargetRoomIdsByTokenId: {},
      activeMaskTargetTokenId: null,
    }));
  }, []);
  const handleObserveExplorer = React.useCallback(
    (playerId: string) => {
      setInspectedExplorerPlayerId(null);
      clearSelectedInventoryInteraction();
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
    [
      clearSelectedInventoryInteraction,
      core.currentExplorer.playerId,
      focusExplorerRoom,
      observedExplorerPlayerId,
    ],
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
    () => resolveReferencePages(core, ASSETS.playerReference),
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
  const scenarioStartOpeningScope =
    core.phase === "characterSelect" || core.phase === "preHaunt"
      ? "heroes"
      : scenarioReaderScope;
  const scenarioStartOpeningSection = findScenarioOpeningNarrationSection(
    activeHauntDossier,
    scenarioStartOpeningScope,
  );
  const scenarioStartOpeningKey = scenarioStartOpeningSection
    ? `${activeHauntDossier.id}:${scenarioStartOpeningScope}:${scenarioStartOpeningSection.id}`
    : null;
  const shouldShowScenarioStartOpening =
    core.phase === "preHaunt" &&
    Boolean(scenarioStartOpeningSection) &&
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
      const nextInitialState = createInitialPreviewState(baseCore);
      const hasActiveTradeDraft =
        previousState.tradeSelectionTouched ||
        previousState.selectedTradeTargetPlayerId !== null ||
        previousState.selectedTradeGiveCardIds.length > 0 ||
        previousState.selectedDogTradeCardIds.length > 0 ||
        previousState.selectedTradeReturnCardIds.length > 0;
      if (baseCore.recommendedAction === "trade" || hasActiveTradeDraft) {
        if (
          baseCore.pendingTradeAgreement ||
          baseCore.tradeUsedThisTurnPlayerIds.includes(
            baseCore.currentExplorer.playerId,
          )
        ) {
          return nextInitialState;
        }
        const tradeTargetsForCore = resolveTradeTargets(baseCore);
        const canUseDogTradeForCore = canUseDogForTrade(baseCore);
        const dogTradeTargetsForCore = canUseDogTradeForCore
          ? resolveDogTradeTargets(baseCore)
          : [];
        const activeTradeTargetsForCore =
          canUseDogTradeForCore && dogTradeTargetsForCore.length > 0
            ? dogTradeTargetsForCore
            : tradeTargetsForCore;
        const nextSelectedTradeTargetPlayerId =
          resolveSelectedTradeTargetPlayerId(
            activeTradeTargetsForCore,
            previousState.selectedTradeTargetPlayerId,
          );
        const nextSelectedTradeTarget =
          activeTradeTargetsForCore.find(
            (explorer) =>
              explorer.playerId === nextSelectedTradeTargetPlayerId,
          ) ?? null;
        const usedCardIds = new Set(baseCore.usedCardIdsThisTurn);
        const nextSelectedTradeGiveCardIds = resolveSelectedTradeGiveCardIds(
          baseCore.currentExplorerInventory,
          previousState.selectedTradeGiveCardIds,
          baseCore.usedCardIdsThisTurn,
        );
        const nextSelectedDogTradeCardIds = resolveSelectedDogTradeCardIds(
          baseCore.currentExplorerInventory,
          previousState.selectedDogTradeCardIds,
        ).filter((cardId) => !usedCardIds.has(cardId));
        const nextTargetInventoryIds = new Set(
          nextSelectedTradeTarget?.inventory.map((card) => card.id) ?? [],
        );
        const nextSelectedTradeReturnCardIds =
          nextSelectedTradeTarget === null
            ? []
            : previousState.selectedTradeReturnCardIds.filter(
                (cardId) =>
                  nextTargetInventoryIds.has(cardId) &&
                  !usedCardIds.has(cardId),
              );
        return {
          ...nextInitialState,
          selectedInventoryCardId: null,
          selectedTradeTargetPlayerId: nextSelectedTradeTargetPlayerId,
          selectedTradeGiveCardIds: nextSelectedTradeGiveCardIds,
          selectedDogTradeCardIds: nextSelectedDogTradeCardIds,
          selectedTradeReturnCardIds: nextSelectedTradeReturnCardIds,
          tradeSelectionTouched:
            previousState.tradeSelectionTouched ||
            nextSelectedTradeTargetPlayerId !== null ||
            nextSelectedTradeGiveCardIds.length > 0 ||
            nextSelectedDogTradeCardIds.length > 0 ||
            nextSelectedTradeReturnCardIds.length > 0,
        };
      }
      const preservedLastUsedInventoryCardId =
        previousState.lastUsedInventoryCardId &&
        baseCore.usedCardIdsThisTurn.includes(
          previousState.lastUsedInventoryCardId,
        )
          ? previousState.lastUsedInventoryCardId
          : null;
      const preservedExplorePlacementState =
        resolvePreservedExplorePlacementState(baseCore, previousState);
      if (preservedExplorePlacementState) {
        return {
          ...nextInitialState,
          ...preservedExplorePlacementState,
          lastUsedInventoryCardId: preservedLastUsedInventoryCardId,
          dismissedLatestDiscoveryKey:
            previousState.dismissedLatestDiscoveryKey,
          dismissedRecentRollId: previousState.dismissedRecentRollId,
        };
      }
      const canContinueMoveMode =
        previousState.interactionMode === "move" &&
        baseCore.movesRemaining > 0 &&
        (resolveDomainMoveTargetRooms(baseCore).length > 0 ||
          baseCore.rooms.some((room) =>
            canUseSkeletonKeyForMove(baseCore, room.id),
          ));
      const nextInteractionMode = canContinueMoveMode
        ? "move"
        : nextInitialState.interactionMode;
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
    const isPublicHauntRevealReader =
      core.phase === "haunt" &&
      resolveScenarioReaderScope(core, viewerPlayerId) === "all" &&
      isHauntScenarioOpeningDiscovery(core);
    const hauntRevealKey = isPublicHauntRevealReader
      ? buildLatestDiscoveryKey(core)
      : null;
    if (hauntRevealKey) {
      dismissedLatestDiscoveryKeysRef.current.add(hauntRevealKey);
      setDismissedHauntRevealDiscoveryKey(hauntRevealKey);
      setLatestDiscoveryQueue((previousQueue) =>
        previousQueue.filter((entry) => entry.key !== hauntRevealKey),
      );
      if (
        core.recentRoll?.sourceTitle === core.latestDiscovery?.title &&
        buildRecentRollDisplayKey(core.recentRoll)
      ) {
        setPreviewState((previousState) => ({
          ...previousState,
          dismissedRecentRollId: buildRecentRollDisplayKey(core.recentRoll),
        }));
      }
    }
    setReferenceScenarioSpreadIndex(initialScenarioSpreadIndex);
    setReferenceScenarioOpeningStageActive(isPublicHauntRevealReader);
    setReferenceScenarioTurnDirection(null);
    setReferenceScenarioTurnSnapshot(null);
    setScenarioReaderOpen(true);
    if (shouldAdvanceScenarioReferenceTutorial) {
      nextStep("auto");
    }
  }, [
    core,
    isTutorialActive,
    nextStep,
    referenceScenarioSpreadCount,
    tutorialStep?.id,
    viewerPlayerId,
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
      options: { allowDuringVisualBusy?: boolean } = {},
    ) => {
      if (isVisualBusy && !options.allowDuringVisualBusy) {
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
        targetTestId: `betrayal-room-occupant-${roomId}-${explorer.playerId}`,
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
        targetTestId: `betrayal-room-monster-${roomId}-${monsterId}`,
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
  const monsterStatuses = React.useMemo(
    () => resolveBetrayalMonsterStatuses(core),
    [core],
  );
  const monsterStatusById = React.useMemo(
    () =>
      new Map(
        monsterStatuses.map((status) => [
          status.monsterId,
          status.status,
        ]),
      ),
    [monsterStatuses],
  );
  const inspectedMonsterStatus = React.useMemo(
    () =>
      inspectedMonster
        ? (monsterStatuses.find(
            (status) => status.monsterId === inspectedMonster.id,
          ) ?? null)
        : null,
    [inspectedMonster, monsterStatuses],
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
  const deckItems = React.useMemo(
    () => buildDeckItems(core, t, ASSETS.deck),
    [core, t],
  );
  const discardItems = React.useMemo(
    () => buildDiscardItems(core, t, ASSETS.deck),
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
  const recentRollInterventionOwner = React.useMemo(() => {
    if (!core.recentRoll || core.recentRoll.playerId !== viewerPlayerId) {
      return null;
    }
    const owner = allExplorers.find(
      (explorer) => explorer.playerId === core.recentRoll?.playerId,
    );
    if (!owner) {
      return null;
    }
    return owner.inventory.some((card) => (
      canUseRecentRollRerollItemForRecentRoll(core, owner.playerId, card.id)
      || canUseBookForPendingEventRoll(core, owner.playerId, card.id)
    ))
      ? owner
      : null;
  }, [allExplorers, core, viewerPlayerId]);
  const inventoryActionPlayerId =
    recentRollInterventionOwner?.playerId ?? core.currentExplorer.playerId;
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
  const actionInventoryCards = (
    recentRollInterventionOwner?.inventory ?? core.currentExplorerInventory
  ).filter((card) => !pendingDiscoveryInventoryCardIds.has(card.id));
  const inventoryDisplayExplorer = recentRollInterventionOwner ?? observedExplorer;
  const isInventoryDisplayReadOnly =
    inventoryDisplayExplorer.playerId !== inventoryActionPlayerId;
  const visibleInventoryCards = inventoryDisplayExplorer.inventory.filter(
    (card) => !pendingDiscoveryInventoryCardIds.has(card.id),
  );
  const selectedInventoryCard =
    actionInventoryCards.find(
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
    [
      ...visibleInventoryCards,
      ...core.currentExplorerInventory,
      ...core.otherExplorers.flatMap((explorer) => explorer.inventory),
    ].find((item) => item.id === inventoryPreviewCardId) ?? null;
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
  const visibleBoardResultFeedback = React.useMemo(() => {
    const text = latestLogEntry?.text?.trim();
    if (!text) {
      return null;
    }
    const healMatch = text.match(/埋葬([^，,。]+)[，,]\s*(治疗.+)$/);
    if (!healMatch) {
      return null;
    }
    const cardName = healMatch[1]?.trim() || t("board.inventory.item");
    const resultText = healMatch[2]?.trim() ?? "";
    const healDetailMatch = resultText.match(/^治疗(.+?)的(.+)$/);
    const targetName = healDetailMatch?.[1]?.trim() ?? null;
    const traitText = healDetailMatch?.[2]?.trim() ?? "";
    const traitNames = traitText
      ? traitText.split("和").map((item) => item.trim()).filter(Boolean)
      : [];
    return {
      kind: "heal" as const,
      title: `${cardName}已使用`,
      detail: resultText,
      targetName,
      targetLabel: targetName ? `治疗目标：${targetName}` : null,
      traitSummary: traitNames.length > 0 ? traitNames.join(" / ") : traitText,
      traitCount: traitNames.length,
      meta: "物品已移除",
    };
  }, [latestLogEntry?.text, t]);
  const earlierLogEntries = React.useMemo(
    () => visibleActivityEntries.slice(1, 4),
    [visibleActivityEntries],
  );
  const normalMoveTargetRooms = React.useMemo(
    () => resolveDomainMoveTargetRooms(core),
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
    () => resolveDomainMoveTargetRooms(core),
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
  const pendingEventChoiceIsEventSymbolSkip =
    pendingEventChoice?.sourceKind === "event-symbol-skip";
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
    ? (pendingDamageAllocation.damageReductionAmount ??
        Math.max(
          0,
          pendingDamageAllocation.originalAmount - pendingDamageAllocation.amount,
        ))
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
  const attackWeaponCardStatuses = React.useMemo(
    () => resolveAttackWeaponCardStatuses(core),
    [core],
  );
  const pendingEventItemChoiceCards = React.useMemo(
    () =>
      resolveEventItemChoiceCards(
        core.currentExplorer.inventory,
        pendingEventItemChoice,
        attackWeaponCardStatuses,
      ),
    [attackWeaponCardStatuses, core.currentExplorer.inventory, pendingEventItemChoice],
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
  const canStartExploreSelection = Boolean(
    (core.phase === "preHaunt" || core.phase === "haunt") &&
    !core.turnEndedByDiscovery &&
    explorableRoomSlots.length > 0,
  );
  const nextExploreDeckKind = resolveNextRoomDiscoveryDeckKind(core, {
    useHolySymbol: useHolySymbolForExplore,
  });
  const canDeclareIdolExplore =
    canStartExploreSelection &&
    nextExploreDeckKind === "event" &&
    canUseIdolToSkipEvent(core);
  const canDeclareTraitorEventSkip =
    false;
  const hasExploreDeclarationOptions = Boolean(
    canStartExploreSelection &&
    (canDeclareHolySymbolExplore ||
      canDeclareIdolExplore ||
      canDeclareTraitorEventSkip),
  );
  const exploreDeclarationLabel = t("board.inventory.exploreDeclaration");
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
  const isTradeDraftActive = Boolean(
    !pendingTradeAgreement &&
      !pendingSicknessExchange &&
      !mummyPendingReward &&
      !helpingHandsPendingReward &&
      !isDustSicknessExchangeMode &&
      !selectedCorpseLootTarget &&
      !hasUsedTradeThisTurn &&
      (core.recommendedAction === "trade" ||
        previewState.tradeSelectionTouched ||
        Boolean(selectedTradeTarget) ||
        selectedTradeGiveCardIds.length > 0 ||
        selectedDogTradeCardIds.length > 0 ||
        selectedTradeReturnCardIds.length > 0),
  );
  const isTradeOrLootTargetSelectionActive =
    isTradeDraftActive ||
    previewState.tradeSelectionTouched ||
    Boolean(selectedCorpseLootTarget);
  const shouldStartDustSicknessExchange =
    isDustSicknessExchangeAvailable && !hasTradeDraftSelection;
  const shouldShowInlineTradeConfirm = Boolean(
    !pendingTradeAgreement &&
    !pendingSicknessExchange &&
    !mummyPendingReward &&
    !helpingHandsPendingReward &&
    !isDustSicknessExchangeMode &&
    isTradeDraftActive &&
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
        inventoryActionPlayerId,
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
          selectedDieIndex: previewState.selectedRollModifierDieIndex,
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
  const rollModifierCardIds = new Set(
    actionInventoryCards
      .filter((card) =>
        canUseRecentRollRerollItemForRecentRoll(
          core,
          inventoryActionPlayerId,
          card.id,
        ),
      )
      .map((card) => card.id),
  );
  const eventRollBookCardIds = new Set(
    actionInventoryCards
      .filter((card) => canUseBookForPendingEventRoll(core, inventoryActionPlayerId, card.id))
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
    isTradeDraftActive && selectedTradeGiveText
      ? selectedTradeGiveText
      : (selectedInventoryCard?.name ?? t("board.status.noSelectedCard"));
  const hasSelectedInventoryDisplay =
    Boolean(selectedInventoryCard) ||
    (isTradeDraftActive && selectedTradeGiveText.length > 0);
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
  const controlledMoveMonsterId = React.useMemo(() => {
    if (
      isDeadTraitorJackSpiritControlTurn &&
      core.monsters.some((monster) => monster.id === "jack-spirit")
    ) {
      return "jack-spirit";
    }
    const feverishMonsterId = `feverish-${core.currentExplorer.playerId}`;
    const controlsFeverish =
      core.phase === "haunt" &&
      core.scenarioRuntime.deadExplorerPlayerIds.includes(
        core.currentExplorer.playerId,
      ) &&
      (core.scenarioRuntime.dust?.feverishPlayerIds ?? []).includes(
        core.currentExplorer.playerId,
      ) &&
      core.monsters.some((monster) => monster.id === feverishMonsterId);
    return controlsFeverish ? feverishMonsterId : null;
  }, [
    core.currentExplorer.playerId,
    core.monsters,
    core.phase,
    core.scenarioRuntime.deadExplorerPlayerIds,
    core.scenarioRuntime.dust?.feverishPlayerIds,
    isDeadTraitorJackSpiritControlTurn,
  ]);
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
  const selectedMonsterAttackSourceId =
    previewState.interactionMode === "monsterAttack" &&
    previewState.selectedMonsterAttackMonsterId &&
    monsterAttackSlots.some(
      (slot) => slot.monsterId === previewState.selectedMonsterAttackMonsterId,
    )
      ? previewState.selectedMonsterAttackMonsterId
      : null;
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
      selectedMonsterAttackSourceId &&
      selectedMonsterAttackEntry?.kind === "phantom-photographer"
        ? selectedMonsterAttackEntry.targetPlayerIds
        : new Set<string>(),
    [
      isMonsterAttackMode,
      selectedMonsterAttackEntry,
      selectedMonsterAttackSourceId,
    ],
  );
  const selectedMonsterAttackTargetPlayerIds = React.useMemo(
    () =>
      isMonsterAttackMode &&
      selectedMonsterAttackSourceId &&
      selectedMonsterAttackEntry
        ? selectedMonsterAttackEntry.targetPlayerIds
        : new Set<string>(),
    [
      isMonsterAttackMode,
      selectedMonsterAttackEntry,
      selectedMonsterAttackSourceId,
    ],
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
      (pendingTradeAgreement || isTradeDraftActive),
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
      ? t("board.status.tradeAgreementDecision")
      : t("board.status.tradeFlowWaiting", {
          player: pendingTradeTargetName,
        })
    : tradeSelectionReady
      ? t("board.status.tradeFlowRequest")
      : t("board.status.tradeFlowChoose");
  const tradeBannerStatusText = pendingTradeAgreement
    ? isPendingTradeForViewer
      ? t("board.status.tradeAgreementIncoming", {
          player: pendingTradeRequesterName,
        })
      : t("board.status.tradeFlowWaiting", {
          player: pendingTradeTargetName,
        })
    : tradeSelectionReady
      ? t("board.status.tradeBannerReady")
      : t("board.status.tradeBannerDraft");
  const shouldShowTradeActionPanel = Boolean(
    !shouldPauseHauntBoardActions &&
      !pendingSicknessExchange &&
      !mummyPendingReward &&
      !helpingHandsPendingReward &&
      !isDustSicknessExchangeMode &&
      !activeHauntTargetGuide &&
      (shouldShowInlineTradeConfirm ||
        (pendingTradeAgreement &&
          (isPendingTradeForViewer || isPendingTradeFromViewer))),
  );
  const renderTradeFlowBanner = (variant: "mobile" | "desktop") => {
    if (!shouldShowTradeFlowPrompt) {
      return null;
    }
    const isMobile = variant === "mobile";
    return (
      <div
        data-testid="betrayal-trade-flow-banner"
        data-trade-agreement-state={tradeAgreementState}
        data-trade-summary-role="status-summary"
        data-trade-progress-visible="status-only"
        data-prompt-placement="top"
        className={`pointer-events-none inline-flex max-w-full items-center justify-center gap-1.5 rounded-[5px] border border-[rgba(238,204,126,0.22)] bg-[rgba(18,17,13,0.52)] text-center font-semibold tracking-[0.02em] text-[#f3e0a6] shadow-[0_6px_14px_rgba(0,0,0,0.22)] backdrop-blur-sm ${
          isMobile
            ? "min-h-[30px] px-2.5 py-1 text-[11px]"
            : "min-h-[30px] w-auto px-3 py-1 text-[12px]"
        }`}
        style={{
          border: "1px solid rgba(238,204,126,0.22)",
          boxShadow: "0 6px 14px rgba(0,0,0,0.22)",
          textShadow: "0 1px 2px rgba(0,0,0,0.78)",
        }}
      >
        <Handshake size={isMobile ? 13 : 14} strokeWidth={2.3} />
        <span
          data-testid="betrayal-trade-banner-status"
          className={`min-w-0 truncate leading-snug ${
            isMobile ? "max-w-[min(460px,calc(100vw-24rem))]" : "max-w-[460px]"
          }`}
        >
          {tradeBannerStatusText}
        </span>
      </div>
    );
  };
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
      selectedMonsterAttackSourceId &&
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
    selectedMonsterAttackSourceId,
    visibleMapRooms,
  ]);

  const currentLatestDiscoveryEntry = React.useMemo(
    () => buildLatestDiscoveryDisplayEntry(core),
    [core],
  );
  React.useEffect(() => {
    if (isEventSymbolNoCardDiscovery(core.latestDiscovery)) {
      const skippedEventSymbolSourceKey = buildEventSymbolSkipSourceKey(
        core.latestDiscoveryOwnerPlayerId,
      );
      setLatestDiscoveryQueue((previousQueue) =>
        previousQueue.filter(
          (entry) =>
            entry.sourceKey !== skippedEventSymbolSourceKey &&
            !isEventSymbolNoCardDiscovery(entry.discovery),
        ),
      );
      return;
    }
    const nextEntry = currentLatestDiscoveryEntry;
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
      const existingSourceIndex = previousQueue.findIndex(
        (entry) => entry.sourceKey === nextEntry.sourceKey,
      );
      if (existingSourceIndex >= 0) {
        return previousQueue
          .map((entry, index) =>
            index === existingSourceIndex ? nextEntry : entry,
          )
          .filter(
            (entry, index) =>
              index === existingSourceIndex ||
              entry.sourceKey !== nextEntry.sourceKey,
          );
      }
      return [...previousQueue, nextEntry];
    });
  }, [
    core,
    currentLatestDiscoveryEntry,
    previewState.dismissedLatestDiscoveryKey,
    viewerPlayerId,
  ]);
  const queuedLatestDiscoveryEntry = latestDiscoveryQueue[0] ?? null;
  const visibleCurrentLatestDiscoveryEntry =
    currentLatestDiscoveryEntry &&
    currentLatestDiscoveryEntry.key !== previewState.dismissedLatestDiscoveryKey &&
    !dismissedLatestDiscoveryKeysRef.current.has(currentLatestDiscoveryEntry.key)
      ? currentLatestDiscoveryEntry
      : null;
  const latestDiscoveryEntry =
    visibleCurrentLatestDiscoveryEntry &&
    (!queuedLatestDiscoveryEntry ||
      queuedLatestDiscoveryEntry.sourceKey ===
        visibleCurrentLatestDiscoveryEntry.sourceKey)
      ? visibleCurrentLatestDiscoveryEntry
      : queuedLatestDiscoveryEntry;
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
    ? currentLatestDiscoveryEntry
    : null;
  const hasLatestDiscoveryDisplayEntry = Boolean(
    latestDiscovery &&
    latestDiscoveryKey !== previewState.dismissedLatestDiscoveryKey,
  );
  const shouldDisplayEventRolledDamageAsIndependentRoll = Boolean(
    core.recentRoll?.kind === "eventRolledDamage" &&
      latestDiscoveryRecentRoll?.kind === "eventRolledDamage" &&
      coreRecentRollDisplayKey === latestDiscoveryRecentRollDisplayKey,
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
  const pendingEventRollPlayerId =
    core.pendingEventRollResolution?.playerId ?? null;
  const pendingEventRollRequiresAcknowledgement =
    core.pendingEventRollResolution?.requiresAcknowledgement ?? null;
  const pendingEventRollRollId =
    core.pendingEventRollResolution?.rollId ?? null;
  React.useEffect(() => {
    const rollId = core.recentRoll?.id ?? null;
    const displayKey = coreRecentRollDisplayKey;
    const tutorialIsTeachingEventRollModifier =
      isTutorialActive &&
      (tutorialStep?.id === "view-book" ||
        tutorialStep?.id === "use-book" ||
        tutorialStep?.id === "use-rabbit-foot");
    if (
      viewerPlayerId !== pendingEventRollPlayerId ||
      pendingEventRollRequiresAcknowledgement !== false ||
      tutorialIsTeachingEventRollModifier ||
      !rollId ||
      !pendingEventRollRollId ||
      settledRecentRollId !== displayKey ||
      rollId !== pendingEventRollRollId
    ) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (
        pendingEventRollRequiresAcknowledgement === false &&
        pendingEventRollRollId === rollId
      ) {
        dispatchCommand(
          BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
          { rollId: pendingEventRollRollId },
          { allowDuringVisualBusy: true },
        );
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [
    core.recentRoll?.id,
    coreRecentRollDisplayKey,
    dispatchCommand,
    isTutorialActive,
    pendingEventRollPlayerId,
    pendingEventRollRequiresAcknowledgement,
    pendingEventRollRollId,
    settledRecentRollId,
    tutorialStep?.id,
    viewerPlayerId,
  ]);
  React.useEffect(() => {
    if (
      core.pendingEventRollResolution ||
      core.pendingEventRollStart ||
      core.pendingEventChoice ||
      core.latestDiscovery?.kind !== "event" ||
      !core.recentRoll ||
      (core.recentRoll.kind !== "eventTraitCheck" &&
        core.recentRoll.kind !== "eventDiceRoll") ||
      core.recentRoll.sourceTitle !== core.latestDiscovery.title ||
      !core.turnEndedByDiscovery ||
      !coreRecentRollDisplayKey
    ) {
      return;
    }
    setPreviewState((previousState) =>
      previousState.dismissedRecentRollId === coreRecentRollDisplayKey
        ? previousState
        : { ...previousState, dismissedRecentRollId: coreRecentRollDisplayKey },
    );
  }, [
    core.pendingEventChoice,
    core.pendingEventRollResolution,
    core.pendingEventRollStart,
    core.recentRoll,
    core.turnEndedByDiscovery,
    core.latestDiscovery?.kind,
    core.latestDiscovery?.title,
    coreRecentRollDisplayKey,
  ]);
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
    if (
      core.recentRoll?.sourceTitle === core.latestDiscovery?.title &&
      coreRecentRollDisplayKey
    ) {
      setPreviewState((previousState) => ({
        ...previousState,
        dismissedRecentRollId:
          coreRecentRollDisplayKey ?? previousState.dismissedRecentRollId,
      }));
    }
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
    core.recentRoll?.sourceTitle,
    core.latestDiscovery?.title,
    coreRecentRollDisplayKey,
    hauntRevealAutoOpenKey,
    hauntRevealDiscoveryKey,
    referenceOpen,
    scenarioReaderOpen,
    shouldShowHauntRevealCue,
  ]);
  const visibleDustProgressItems = shouldShowHauntRevealCue
    ? []
    : dustProgressItems;
  const hasRecentRollModifier = rollModifierCardIds.size > 0 || eventRollBookCardIds.size > 0;
  const isLatestDiscoveryRecentRollDismissed = Boolean(
    latestDiscoveryRecentRollDisplayKey &&
      previewState.dismissedRecentRollId === latestDiscoveryRecentRollDisplayKey,
  );
  const latestDiscoveryHasActionableRollModifier = Boolean(
    latestDiscovery &&
      latestDiscoveryRecentRoll &&
      hasRecentRollModifier &&
      coreRecentRollDisplayKey === latestDiscoveryRecentRollDisplayKey &&
      latestDiscoveryRecentRoll.playerId === inventoryActionPlayerId,
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
    !shouldShowHauntRevealCue &&
    !shouldDisplayEventRolledDamageAsIndependentRoll;
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
      latestDiscoveryRecentRoll.playerId === inventoryActionPlayerId,
  );
  const latestDiscoveryRerollSelection =
    canCurrentPlayerModifyLatestDiscoveryRoll ? recentRollRerollSelection : null;
  const pendingLatestDiscoveryEventRollStart =
    core.pendingEventRollStart &&
    core.pendingEventRollStart.playerId === core.latestDiscoveryOwnerPlayerId &&
    core.pendingEventRollStart.sourceTitle === core.latestDiscovery?.title
      ? core.pendingEventRollStart
      : null;
  const canCurrentViewerStartLatestDiscoveryEventRoll = Boolean(
    pendingLatestDiscoveryEventRollStart &&
      pendingLatestDiscoveryEventRollStart.playerId === viewerPlayerId,
  );
  const betrayalConfirmButtonClass = BETRAYAL_CONFIRM_BUTTON_CLASS;
  const rollModifierActionSlot = selectedRollModifierCanConfirm ? (
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
      <BetrayalConfirmButton
        type="button"
        data-testid="betrayal-roll-modifier-confirm"
        onClick={confirmSelectedRollModifier}
      >
        {t("board.roll.confirmModifier", { card: selectedRollModifierCard?.name ?? "" })}
      </BetrayalConfirmButton>
    </div>
  ) : null;
  const recentRollDecisionPlayerIds = new Set(
    [core.currentPlayer, core.activePlayerId].filter(
      (playerId): playerId is string => Boolean(playerId),
    ),
  );
  const hasRecentRollAcknowledgement = Boolean(
    core.recentRoll &&
      isAcknowledgeableRecentRollDisplay(core.recentRoll) &&
      recentRollDecisionPlayerIds.has(core.recentRoll.playerId),
  );
  const recentRollRequiredPlayerIds =
    hasRecentRollAcknowledgement && core.recentRoll
      ? resolveRecentRollRequiredPlayerIdsForDisplay(core, core.recentRoll)
      : [];
  const recentRollAcknowledgedPlayerIds =
    hasRecentRollAcknowledgement && core.recentRoll
      ? resolveRecentRollAcknowledgedPlayerIdsForDisplay(core.recentRoll)
      : [];
  const recentRollConfirmedCount = recentRollRequiredPlayerIds.filter(
    (playerId) => recentRollAcknowledgedPlayerIds.includes(playerId),
  ).length;
  const recentRollTotalCount = recentRollRequiredPlayerIds.length;
  const recentRollFullyAcknowledged = recentRollRequiredPlayerIds.every((playerId) =>
    recentRollAcknowledgedPlayerIds.includes(playerId),
  );
  const hasAcknowledgeableRecentRoll =
    hasRecentRollAcknowledgement && !recentRollFullyAcknowledged;
  const hasCurrentViewerAcknowledgedRecentRoll =
    recentRollAcknowledgedPlayerIds.includes(viewerPlayerId);
  const canCurrentViewerAcknowledgeRecentRoll = Boolean(
    hasAcknowledgeableRecentRoll &&
      recentRollRequiredPlayerIds.includes(viewerPlayerId) &&
      !hasCurrentViewerAcknowledgedRecentRoll,
  );
  const activePendingCardResolution =
    core.pendingCardResolutionQueue?.[0] ?? null;
  const canDismissLatestDiscoveryByBackdrop = false;
  const canDismissRecentRollByBackdrop = false;
  const shouldGateDamageAllocationBehindRecentRoll = Boolean(
    pendingDamageAllocation &&
      core.recentRoll?.kind === "eventRolledDamage" &&
      hasRecentRollAcknowledgement &&
      !recentRollFullyAcknowledged &&
      !isRecentRollDismissed,
  );
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
        pendingEventChoice && pendingEventChoice.sourceKind !== "event-symbol-skip"
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
  const latestDiscoveryIsEventSymbolNoCard =
    isEventSymbolNoCardDiscovery(latestDiscovery);
  const latestDiscoveryDisplaySummary = React.useMemo(() => {
    const summary = latestDiscovery?.summary?.trim() ?? "";
    if (latestDiscovery?.kind !== "none") {
      return summary;
    }
    return summary
      .replace(/[；;]\s*没有事件、物品或预兆发现牌[。.]?\s*$/, "")
      .trim();
  }, [
    latestDiscovery?.kind,
    latestDiscovery?.summary,
  ]);
  const shouldShowLatestDiscoveryCardFace = Boolean(
    latestDiscovery &&
      ((latestDiscovery.kind !== "none" && !latestDiscoveryIsEventSymbolNoCard) ||
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
  const eventRollConfirmation = React.useMemo(
    () => resolveEventRollConfirmationPresentation(core, viewerPlayerId),
    [core, viewerPlayerId],
  );
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
  const latestDiscoveryResolutionSteps =
    latestDiscovery?.resolutionSteps?.length
      ? latestDiscovery.resolutionSteps
      : latestDiscovery &&
          latestDiscovery.detail.trim() &&
          !isEventSymbolNoCardDiscovery(latestDiscovery)
        ? [
            {
              id: `event-effect-${latestDiscovery.title}`,
              kind: "event-effect" as const,
              text: `事件效果：${latestDiscovery.detail.trim()}`,
              deckKind: "event" as const,
            },
          ]
        : [];
  const latestDiscoverySearchStepNumber =
    latestDiscoveryVisibleProcessCard && latestDiscoverySearchVisibleIndex >= 0
      ? latestDiscoverySearchVisibleIndex + 1
      : 0;
  const latestDiscoverySearchFinalEffectText =
    latestDiscoveryHasSearchSequence &&
    latestDiscoverySearchVisibleIndex === latestDiscoverySearchSequence.length - 1
      ? latestDiscoveryPendingCardResolution?.text ?? ""
      : "";
  const canAdvanceLatestDiscoverySearch = Boolean(
    isLatestDiscoverySearchOperator &&
      !latestDiscoveryViewerHasAcknowledgedCardResolution &&
      latestDiscoverySearchVisibleIndex >= 0 &&
      latestDiscoverySearchVisibleIndex < latestDiscoverySearchSequence.length - 1,
  );
  const isLatestDiscoverySearchFinalAcknowledgement = Boolean(
    latestDiscoveryPendingCardResolution &&
      latestDiscoveryHasSearchSequence &&
      latestDiscoverySearchVisibleIndex === latestDiscoverySearchSequence.length - 1 &&
      !canAdvanceLatestDiscoverySearch,
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
    if (core.pendingEventRollResolution) {
      if (core.pendingEventRollResolution.requiresAcknowledgement === false) {
        return t("board.roll.backToBoard");
      }
      return eventRollConfirmation.viewerHasAcknowledged
        ? t("board.discovery.confirmedWithProgress", {
            confirmed: eventRollConfirmation.confirmedCount,
            total: eventRollConfirmation.totalCount,
          })
        : t("board.discovery.confirmWithProgress", {
            confirmed: eventRollConfirmation.confirmedCount,
            total: eventRollConfirmation.totalCount,
          });
    }
    if (!latestDiscoveryPendingCardResolution) {
      return t("board.roll.backToBoard");
    }
    if (latestDiscoveryViewerHasAcknowledgedCardResolution) {
      return t("board.discovery.confirmedWithProgress", {
        confirmed: latestDiscoveryCardResolutionConfirmedCount,
        total: latestDiscoveryCardResolutionTotalCount,
      });
    }
    if (canAdvanceLatestDiscoverySearch) {
      return t("board.discovery.nextSearchCard");
    }
    if (isLatestDiscoverySearchFinalAcknowledgement) {
      return t("board.discovery.confirmWithProgress", {
        confirmed: latestDiscoveryCardResolutionConfirmedCount,
        total: latestDiscoveryCardResolutionTotalCount,
      });
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
    (onComplete?: () => void) => {
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
  const handleRollLatestDiscoveryEvent = React.useCallback(() => {
    if (!canCurrentViewerStartLatestDiscoveryEventRoll || isVisualBusy) {
      return;
    }
    dispatchCommand(BETRAYAL_COMMANDS.ROLL_EVENT, {
      sourceTitle: pendingLatestDiscoveryEventRollStart?.sourceTitle,
    });
  }, [
    canCurrentViewerStartLatestDiscoveryEventRoll,
    dispatchCommand,
    isVisualBusy,
    pendingLatestDiscoveryEventRollStart?.sourceTitle,
  ]);
  const handleContinueLatestDiscovery = React.useCallback(() => {
    if (isVisualBusy) {
      return;
    }
    if (core.pendingEventRollResolution) {
      if (!eventRollConfirmation.canViewerAcknowledge) {
        return;
      }
      dispatchCommand(BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, {
        rollId: core.pendingEventRollResolution.rollId,
      });
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
      startPendingDiscoveryGainVisual();
      acknowledge();
      return;
    }
    handleDismissLatestDiscovery();
  }, [
    dispatch,
    core.pendingEventRollResolution,
    dispatchCommand,
    eventRollConfirmation.canViewerAcknowledge,
    handleDismissLatestDiscovery,
    isVisualBusy,
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
    <BetrayalConfirmButton
      type="button"
      data-testid="betrayal-discovery-continue"
      data-discovery-action-position={actionPosition}
      data-discovery-action-surface={actionPosition === "bottom" ? "card-external-dock" : undefined}
      data-pending-card-resolution-id={
        latestDiscoveryPendingCardResolution?.id ?? undefined
      }
      data-pending-card-resolution-step={
        latestDiscoveryPendingCardResolution && !isLatestDiscoverySearchFinalAcknowledgement
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
        (core.pendingEventRollResolution && !eventRollConfirmation.canViewerAcknowledge) ||
        (latestDiscoveryPendingCardResolution &&
            !canAdvanceLatestDiscoverySearch &&
            !canCurrentViewerAcknowledgeCardResolution),
      )}
      data-event-roll-confirmed-count={
        core.pendingEventRollResolution
          ? String(eventRollConfirmation.confirmedCount)
          : isLatestDiscoverySearchFinalAcknowledgement
            ? String(latestDiscoveryCardResolutionConfirmedCount)
            : undefined
      }
      data-event-roll-required-count={
        core.pendingEventRollResolution
          ? String(eventRollConfirmation.totalCount)
          : isLatestDiscoverySearchFinalAcknowledgement
            ? String(latestDiscoveryCardResolutionTotalCount)
            : undefined
      }
      className={className}
      onClick={handleContinueLatestDiscovery}
    >
      {latestDiscoveryContinueLabel}
    </BetrayalConfirmButton>
  );
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
  React.useEffect(() => {
    const pendingResolution = core.pendingEventRollResolution;
    if (pendingResolution && latestDiscoveryEntry?.sourceKey) {
      latestDiscoveryPendingEventRollSeenRef.current = {
        sourceKey: latestDiscoveryEntry.sourceKey,
        rollId: pendingResolution.rollId,
      };
      return;
    }
    const seenResolution = latestDiscoveryPendingEventRollSeenRef.current;
    if (!seenResolution || seenResolution.sourceKey !== latestDiscoveryEntry?.sourceKey) {
      return;
    }
    if (latestDiscoveryPendingCardResolution) {
      return;
    }
    latestDiscoveryPendingEventRollSeenRef.current = null;
    handleDismissLatestDiscovery();
  }, [
    core.pendingEventRollResolution,
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
    } else if (hasAcknowledgeableRecentRoll) {
      if (canCurrentViewerAcknowledgeRecentRoll) {
        dispatchCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, {});
      }
      return;
    }
    setPreviewState((previousState) => ({
      ...previousState,
      dismissedRecentRollId:
        coreRecentRollDisplayKey ?? previousState.dismissedRecentRollId,
    }));
  }, [
    canCurrentViewerAcknowledgeRecentRoll,
    core.recentRoll,
    coreRecentRollDisplayKey,
    dispatchCommand,
    hasAcknowledgeableRecentRoll,
  ]);
  const handleConfirmExorciseRollReview = React.useCallback(() => {
    setConfirmedExorciseRollId(core.recentRoll?.id ?? null);
  }, [core.recentRoll?.id]);
  const recentRollAcknowledgeLabel = !hasAcknowledgeableRecentRoll
    ? t("board.roll.backToBoard")
    : canCurrentViewerAcknowledgeRecentRoll
      ? t("board.discovery.confirmWithProgress", {
          confirmed: recentRollConfirmedCount,
          total: recentRollTotalCount,
        })
      : t("board.discovery.confirmedWithProgress", {
          confirmed: recentRollConfirmedCount,
          total: recentRollTotalCount,
        });
  const recentRollAcknowledgeActionSlot = hasAcknowledgeableRecentRoll ? (
    <BetrayalConfirmButton
      type="button"
      data-testid="betrayal-roll-continue"
      data-recent-roll-confirmed-count={String(recentRollConfirmedCount)}
      data-recent-roll-required-count={String(recentRollTotalCount)}
      className={`pointer-events-auto min-w-[168px] shrink-0 px-5 text-[14px] shadow-[0_10px_22px_rgba(0,0,0,0.34)] ${betrayalConfirmButtonClass}`}
      disabled={!canCurrentViewerAcknowledgeRecentRoll}
      onClick={handleDismissRecentRoll}
    >
      {recentRollAcknowledgeLabel}
    </BetrayalConfirmButton>
  ) : null;
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
    if (isTradeDraftActive) {
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
    if (isMonsterAttackMode && !selectedMonsterAttackSourceId) {
      return t("board.status.actionCueMonsterAttackChooseSource");
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
    if (isTradeDraftActive && !hasUsedTradeThisTurn) {
      if (tradeSelectionReady) {
        return t("board.status.actionCueTradeRequest");
      }
      if (
        selectedTradeGiveCardIds.length > 0 ||
        selectedDogTradeCardIds.length > 0
      ) {
        return t("board.status.actionCueTradeTarget");
      }
      if (selectedTradeTarget) {
        return t("board.status.actionCueTradePlayer", {
          player: resolvePlayerName(
            selectedTradeTarget.playerId,
            selectedTradeTarget.displayName,
            matchData,
          ),
        });
      }
      return t("board.status.actionCueTradeTarget");
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
  const damageAllocationSourceHasVisibleOwner = Boolean(
    pendingDamageAllocation?.sourceTitle &&
      shouldShowLatestDiscovery &&
      latestDiscoveryDisplayedTitle === pendingDamageAllocation.sourceTitle,
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
      if (isVisualBusy) {
        return;
      }
      const useSkeletonKey = skeletonKeyMoveTargetRoomIds.has(roomId);
      const move = () =>
        dispatch(BETRAYAL_COMMANDS.MOVE_TO_ROOM, {
          roomId,
          ...(useSkeletonKey ? { useSkeletonKey: true } : {}),
        });
      const focusTargetRoom = () => focusRoomOnMap(roomId);
      const visualStarted = controlledMoveMonsterId
        ? startMonsterMoveVisual(controlledMoveMonsterId, roomId, focusTargetRoom)
        : startExplorerMoveVisual(roomId, focusTargetRoom);
      move();
      if (visualStarted) {
        focusRoomOnMap(roomId, { pan: false });
      } else {
        focusTargetRoom();
      }
      setPreviewState((previousState) => ({
        ...previousState,
        interactionMode: useSkeletonKey ? "default" : "move",
      }));
    },
    [
      controlledMoveMonsterId,
      dispatch,
      focusRoomOnMap,
      isVisualBusy,
      skeletonKeyMoveTargetRoomIds,
      startExplorerMoveVisual,
      startMonsterMoveVisual,
    ],
  );

  const handleMoveAction = React.useCallback(() => {
    const shouldAdvanceOpenMoveTutorial =
      isTutorialActive &&
      (tutorialStep?.id === "open-move-targets" ||
        (tutorialStep?.requireAction === true &&
          tutorialStep?.highlightTarget === "betrayal-action-move" &&
          tutorialStep?.allowedCommands?.length === 0)) &&
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
    if (shouldAdvanceOpenMoveTutorial) {
      nextStep("auto");
    }
  }, [
    core.movesRemaining,
    isTutorialActive,
    moveTargetRooms.length,
    nextStep,
    previewState.interactionMode,
    tutorialStep?.allowedCommands?.length,
    tutorialStep?.highlightTarget,
    tutorialStep?.id,
    tutorialStep?.requireAction,
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
      if (
        isTutorialActive &&
        tutorialStep?.requireAction === true &&
        tutorialStep?.highlightTarget === "betrayal-action-explore" &&
        tutorialStep?.allowedCommands?.length === 0
      ) {
        nextStep("auto");
      }
    },
    [
      core,
      explorableRoomSlots,
      isTutorialActive,
      nextStep,
      tutorialStep?.allowedCommands?.length,
      tutorialStep?.highlightTarget,
      tutorialStep?.id,
      tutorialStep?.requireAction,
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
      if (
        isTutorialActive &&
        tutorialStep?.requireAction === true &&
        tutorialStep?.highlightTarget === "betrayal-room-placement-rotate-right" &&
        tutorialStep?.allowedCommands?.length === 0
      ) {
        nextStep("auto");
      }
    },
    [
      isTutorialActive,
      nextStep,
      pendingRoomOrientationOptions,
      pendingRoomPlacementPreview,
      selectedRoomOrientationTurns,
      tutorialStep?.allowedCommands?.length,
      tutorialStep?.highlightTarget,
      tutorialStep?.id,
      tutorialStep?.requireAction,
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
        const trait = selection?.trait ?? selectedEventTrait;
        const cardId = selection?.cardId ?? selectedEventCardId;
        const targetRoomId = selection?.targetRoomId ?? selectedEventTargetRoomId;
        const damageTraits =
          selection?.damageTraits ?? selectedEventDamageTraits;
        const preview = resolveEventAcceptPreview({
          trait,
          cardId,
          targetRoomId,
          damageTraits,
        });
        const ready = selection ? preview?.ready : pendingEventReady;
        if (!ready) {
          return false;
        }
        dispatchCommand(
          BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
          {
            ...((preview?.trait ?? trait)
              ? { trait: preview?.trait ?? trait! }
              : {}),
            ...((preview?.cardId ?? cardId)
              ? { cardId: preview?.cardId ?? cardId! }
              : {}),
            ...((preview?.targetRoomId ?? targetRoomId)
              ? { targetRoomId: preview?.targetRoomId ?? targetRoomId! }
              : {}),
            ...((preview?.damageTraits ?? damageTraits).length > 0
              ? { traits: preview?.damageTraits ?? damageTraits }
              : {}),
            accept: true,
          },
          { allowDuringVisualBusy: true },
        );
      } else {
        if (!pendingEventCanDecline) {
          return false;
        }
        dispatchCommand(
          BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
          {
            ...(selectedEventTrait ? { trait: selectedEventTrait } : {}),
            accept: false,
          },
          { allowDuringVisualBusy: true },
        );
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

  function applyEventDamageTraitSelection(nextSelectedDamageTraits: BetrayalTraitKey[]) {
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

  function handleAdjustEventDamageTrait(
    trait: BetrayalTraitKey,
    delta: -1 | 1,
  ) {
      if (!pendingEventDamageChoice) {
        return;
      }
      const nextSelectedDamageTraits = adjustSelectedDamageTrait({
        selectedTraits: selectedEventDamageTraits,
        trait,
        delta,
        allowedTraits: pendingEventDamageChoice.allowedTraits,
        amount: pendingEventDamageChoice.amount,
        explorer: core.currentExplorer,
        phase: core.phase,
      });
      applyEventDamageTraitSelection(nextSelectedDamageTraits);
  }

  function canIncrementEventDamageTrait(trait: BetrayalTraitKey): boolean {
      if (!pendingEventDamageChoice) {
        return false;
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
      return (
        pendingEventDamageChoice.allowedTraits.includes(trait) &&
        currentCount < maxTraitCount &&
        selected.length < pendingEventDamageChoice.amount
      );
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

  function handleAdjustDamageAllocationTrait(
    trait: BetrayalTraitKey,
    delta: -1 | 1,
  ) {
      if (!pendingDamageAllocation || !pendingDamageExplorer) {
        return;
      }
      const nextSelectedDamageTraits = adjustSelectedDamageTrait({
        selectedTraits: selectedDamageAllocationTraits,
        trait,
        delta,
        allowedTraits: pendingDamageAllocationAllowedTraits,
        amount: pendingDamageAllocation.amount,
        explorer: pendingDamageExplorer,
        phase: pendingDamageAllocationPhase,
      });
      setPreviewState((previousState) => ({
        ...previousState,
        selectedDamageAllocationTraits: nextSelectedDamageTraits,
      }));
  }

  function canIncrementDamageAllocationTrait(trait: BetrayalTraitKey): boolean {
      if (!pendingDamageAllocation || !pendingDamageExplorer) {
        return false;
      }
      const selected = pruneSelectedDamageTraits(
        selectedDamageAllocationTraits,
        pendingDamageAllocationAllowedTraits,
        pendingDamageAllocation.amount,
        pendingDamageExplorer,
        pendingDamageAllocationPhase,
      );
      const currentCount = countSelectedDamageTrait(
        selected,
        trait,
      );
      const maxTraitCount = Math.min(
        pendingDamageAllocation.amount,
        resolveTraitDamageAssignableSteps(
          pendingDamageExplorer,
          trait,
          pendingDamageAllocationPhase,
        ),
      );
      return (
        isPendingDamageAllocationForViewer &&
        pendingDamageAllocationAllowedTraits.includes(trait) &&
        currentCount < maxTraitCount &&
        selected.length < pendingDamageAllocation.amount
      );
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
        interactionMode: "default",
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
    const focusTargetRoom = () => focusRoomOnMap(roomId);
    const visualStarted = startMonsterMoveVisual(
      monsterId,
      roomId,
      focusTargetRoom,
    );
    move();
    if (visualStarted) {
      focusRoomOnMap(roomId, { pan: false });
    } else {
      focusTargetRoom();
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
    const focusTargetRoom = () => focusRoomOnMap(roomId);
    const visualStarted = startMonsterMoveVisual(
      monsterId,
      roomId,
      focusTargetRoom,
    );
    move();
    if (visualStarted) {
      focusRoomOnMap(roomId, { pan: false });
    } else {
      focusTargetRoom();
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
      if (monsterAttackSlots.length === 0) {
        return previousState;
      }
      return {
        ...previousState,
        interactionMode: "monsterAttack",
        selectedMonsterAttackMonsterId: null,
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
        interactionMode: "default",
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
        interactionMode: "default",
        selectedInventoryCardId: null,
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
        interactionMode: "default",
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
          interactionMode: "default",
          selectedInventoryTargetPlayerId: null,
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
  const hauntSpecialActionItem =
    core.phase === "haunt" && hauntActionContext && !selectedInventoryCard
      ? actionItems.find((action) => action.id === "use") ?? null
      : null;
  const monsterActionItemsWithHauntAction =
    monsterActionItems.length > 0 && hauntSpecialActionItem
    ? [...monsterActionItems, hauntSpecialActionItem]
    : monsterActionItems;
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
    ? monsterActionItemsWithHauntAction.length > 0
      ? monsterActionItemsWithHauntAction
      : actionItems.filter(
          (action) => action.id === "move" || action.id === "endTurn",
        )
    : bloodFromStoneSetupPlacementActionItems.length > 0
    ? bloodFromStoneSetupPlacementActionItems
    : core.turnEndedByDiscovery
    ? actionItems.filter((action) => action.id === "endTurn")
    : monsterActionItemsWithHauntAction.length > 0
    ? monsterActionItemsWithHauntAction
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
      readOnly?: boolean;
      instanceKey?: string;
    },
  ) => {
    const isReadOnly = Boolean(options.readOnly);
    const isFocus = options.layout === "focus";
    const isPreview = options.layout === "preview";
    const isCompact = options.layout === "compact";
    const resolvedTradeStatus =
      isReadOnly
        ? null
        : (options.tradeStatus ??
          (!isDustSicknessExchangeMode &&
      isTradeDraftActive &&
      !pendingTradeAgreement
        ? resolveBetrayalTradeCardStatus(core, item.id, {
            ownerPlayerId: core.currentExplorer.playerId,
            ownerRole: "requester",
          })
        : null));
    const disabledReason =
      options.disabledReason ?? resolvedTradeStatus?.reason ?? null;
    const isCardDisabled = Boolean(
      options.disabled ?? (resolvedTradeStatus && !resolvedTradeStatus.canTrade),
    );
    const isSelected =
      !isReadOnly &&
      (options.selected ??
        (isTradeDraftActive &&
      !isDustSicknessExchangeMode &&
      selectedTradeGiveCardIds.includes(item.id)
        ? true
        : item.id === selectedInventoryCard?.id));
    const shouldShowTurnStatus =
      options.showTurnStatus ?? (!isReadOnly && !isPreview);
    const isUsedThisTurn =
      shouldShowTurnStatus && core.usedCardIdsThisTurn.includes(item.id);
    const isAvailableThisTurn =
      !shouldShowTurnStatus || core.turnStartInventoryCardIds.includes(item.id);
    const isUnavailableThisTurn = !isUsedThisTurn && !isAvailableThisTurn;
    const tone = resolveInventoryFaceTone(item.kind);
    const frontVisual = resolvePossessionAtlasVisual(item);
    const backAsset = resolveInventoryCardBackAsset(item, ASSETS.deck);
    const accentAsset = resolveInventoryCardAccentAsset(item, ASSETS.trait);
    const isTutorialBookTarget =
      !isPreview &&
      isTutorialActive &&
      tutorialStep?.id === "use-book" &&
      item.id === "omen-book";
    const canModifyRecentRoll =
      !isReadOnly &&
      !isPreview &&
      (rollModifierCardIds.has(item.id) || eventRollBookCardIds.has(item.id));
    const canUseBookForCurrentEventRoll =
      !isReadOnly && !isPreview && eventRollBookCardIds.has(item.id);
    const isTradeCompact =
      isCompact && Boolean(frontVisual) && isTradeDraftActive;
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
            if (isReadOnly) {
              setInventoryPreviewCardId(item.id);
              return;
            }
            if (canUseBookForCurrentEventRoll) {
              dispatchCommand(BETRAYAL_COMMANDS.USE_POSSESSION, {
                cardId: item.id,
              });
              setInventoryPreviewCardId(null);
              setPreviewState((previousState) => ({
                ...previousState,
                selectedInventoryCardId: null,
                selectedRollModifierDieIndex: null,
              }));
              return;
            }
            if (options.onSelect) {
              options.onSelect();
              return;
            }
            if (isTradeDraftActive && !isDustSicknessExchangeMode) {
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
              selectedTradeGiveCardIds: [],
              selectedDogTradeCardIds: [],
              selectedTradeReturnCardIds: [],
              tradeSelectionTouched: false,
            }));
          }}
          data-testid={options.testId}
          data-inventory-read-only={isReadOnly ? "true" : undefined}
          data-roll-modifier-available={canModifyRecentRoll ? "true" : "false"}
          data-event-roll-book-available={canUseBookForCurrentEventRoll ? "true" : "false"}
          data-trade-card-status={resolvedTradeStatus?.canTrade === false ? "disabled" : resolvedTradeStatus ? "available" : undefined}
          data-trade-card-disabled-reason={disabledReason ?? undefined}
          title={
            isReadOnly
              ? `${item.name} · ${resolveInventoryRulesSummary(item, t)} · 点击查看`
              : disabledReason
              ? `${item.name} · ${disabledReason}`
              : `${item.name} · ${resolveInventoryRulesSummary(item, t)} · 点击选择`
          }
          disabled={isCardDisabled}
          className={`pointer-events-auto relative w-full overflow-visible text-left outline-none transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${showSelectedState ? "" : "focus-visible:ring-0"} ${isCardDisabled ? "cursor-not-allowed" : buttonOutlineClass}`}
          aria-pressed={isPreview || isReadOnly ? undefined : isSelected}
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
                  ? `${options.testId}-${isTutorialBookTarget ? "tutorial-target" : canUseBookForCurrentEventRoll ? "event-roll-book" : "roll-modifier"}`
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
            data-event-roll-book-outline={
              canUseBookForCurrentEventRoll && !showSelectedState ? "true" : undefined
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
      <UndoProvider value={undoProviderValue}>
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
      </UndoProvider>
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
    <UndoProvider value={undoProviderValue}>
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
      {shouldShowScenarioStartOpening && scenarioStartOpeningSection ? (
        <div
          data-testid="betrayal-start-scenario-opening-stage"
          className="fixed inset-0 z-[240] bg-[rgba(0,0,0,0.58)] text-[#f5e6c7]"
        >
          <CinematicNarrationPanel
            testId="betrayal-start-scenario-opening-cinematic"
            label={t(scenarioStartOpeningSection.labelKey)}
            text={t(scenarioStartOpeningSection.bodyKey)}
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
      {inspectedMonster ? (
        <MonsterDetailsDialog
          monster={inspectedMonster}
          status={inspectedMonsterStatus}
          locale={effectiveLocale}
          roomName={inspectedMonsterRoomName}
          onClose={closeMonsterDetails}
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
              readerScope={scenarioReaderScope}
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
              {renderTradeFlowBanner("mobile")}
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
                    [
                      "might",
                      "speed",
                      "knowledge",
                      "sanity",
                    ] as BetrayalTraitKey[]
                  ).map((key) => {
                    const track = resolveExplorerTraitTrack(
                      observedExplorer,
                      key,
                    );
                    const value = resolveTraitTrackValueAtPosition(
                      track,
                      track.position,
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
            data-player-id={inventoryDisplayExplorer.playerId}
            data-observed-player={
              isInventoryDisplayReadOnly ? "true" : "false"
            }
            className={`pointer-events-none absolute ${
              shouldShowLatestDiscovery &&
              !shouldAutoReturnAfterLatestDiscovery &&
              !pendingEventChoice &&
              canCurrentPlayerModifyLatestDiscoveryRoll
                ? "z-[150]"
                : "z-40"
            } mt-0 px-0 ${
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
                {isInventoryDisplayReadOnly ? (
                  <span
                    data-testid="betrayal-inventory-owner-label"
                    className="max-w-[130px] truncate text-[#d8bf81]"
                  >
                    {resolvePlayerName(
                      inventoryDisplayExplorer.playerId,
                      inventoryDisplayExplorer.displayName,
                      matchData,
                    )}
                  </span>
                ) : null}
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
                      readOnly: isInventoryDisplayReadOnly,
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
                      readOnly: isInventoryDisplayReadOnly,
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

            <section
              className={`absolute inset-0 grid min-h-0 ${
                shouldShowLatestDiscovery &&
                !shouldAutoReturnAfterLatestDiscovery &&
                !pendingEventChoice
                  ? "z-[130]"
                  : "z-10"
              }`}
            >
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
                      : `inset-0 z-[120] items-center justify-center px-4 py-16 ${shouldShowLatestDiscoveryRoll && latestDiscoveryRecentRoll ? "" : "bg-[rgba(3,7,6,0.76)]"}`
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
                    latestDiscoveryRecentRoll &&
                    rollModifierActionSlot ? (
                      <div className="pointer-events-auto absolute right-2 top-2 z-20">
                        {rollModifierActionSlot}
                      </div>
                    ) : null}
                    <span
                      className="sr-only"
                      data-testid="betrayal-discovery-detail"
                    >
                      {latestDiscoveryDisplayedKindLabel} {latestDiscoveryDisplayedTitle}{" "}
                      {latestDiscoveryDisplaySummary}{" "}
                      {latestDiscovery?.detail ?? ""}
                    </span>
                    {latestDiscoveryResolutionSteps.length > 0 ? (
                      <ol
                        hidden
                        aria-hidden="true"
                        data-testid="betrayal-discovery-resolution-steps"
                        data-ui-role="nonvisual-resolution-ledger"
                      >
                        {latestDiscoveryResolutionSteps.map((step) => (
                          <li
                            key={step.id}
                            data-testid="betrayal-discovery-resolution-step"
                            data-resolution-step-kind={step.kind}
                            data-resolution-step-deck-kind={step.deckKind ?? undefined}
                            data-resolution-step-card-id={step.cardId ?? undefined}
                          >
                            {step.text}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    {latestDiscoveryVisibleProcessCard ? (
                      <div
                        data-testid="betrayal-discovery-search-step"
                        data-room-discovery-search-index={String(latestDiscoverySearchStepNumber)}
                        data-room-discovery-search-total={String(latestDiscoverySearchSequence.length)}
                        data-room-discovery-search-outcome={latestDiscoveryVisibleProcessCard.outcome}
                        className="pointer-events-none z-10 max-w-[min(520px,calc(100vw-2rem))] rounded-[10px] border border-[rgba(214,181,109,0.42)] bg-[rgba(14,12,8,0.78)] px-4 py-2 text-center text-[13px] font-bold leading-snug tracking-[0.04em] text-[#f4e3b5] shadow-[0_10px_24px_rgba(0,0,0,0.30)]"
                      >
                        {latestDiscoveryVisibleProcessCard.text}
                      </div>
                    ) : null}
                    {latestDiscoverySearchFinalEffectText ? (
                      <div
                        data-testid="betrayal-discovery-final-effect"
                        className="sr-only"
                      >
                        {latestDiscoverySearchFinalEffectText}
                      </div>
                    ) : null}
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
                          deferEventDamageStage={false}
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
                          actionSlot={rollModifierActionSlot}
                          floatingResultClassName={
                            isPhoneLandscapeLayout ? "top-[52px]" : ""
                          }
                          onDiceSettledChange={handleRecentRollDiceSettledChange}
                        />
                      ) : null}
                    </div>
                    ) : null}
                    {(isPhoneLandscapeLayout &&
                      shouldShowLatestDiscoveryRoll &&
                      latestDiscoveryRecentRoll &&
                      rollModifierActionSlot) ||
                    rollModifierActionSlot
                      ? null
                      : (
                        <div
                          data-testid="betrayal-discovery-card-external-action-dock"
                          className={`pointer-events-auto z-10 flex min-h-[62px] justify-center ${isPhoneLandscapeLayout ? "relative w-full" : "relative mt-2 w-full"}`}
                        >
                          {pendingLatestDiscoveryEventRollStart ? (
                            <button
                              type="button"
                              data-testid="betrayal-event-roll-start"
                              className={betrayalConfirmButtonClass}
                              disabled={!canCurrentViewerStartLatestDiscoveryEventRoll}
                              onClick={handleRollLatestDiscoveryEvent}
                            >
                              {t("board.discovery.rollEvent")}
                            </button>
                          ) : core.pendingEventRollResolution?.requiresAcknowledgement === false ? null : renderLatestDiscoveryContinueButton(
                            "bottom",
                            `pointer-events-auto min-w-[132px] shrink-0 ${betrayalConfirmButtonClass}`,
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
              !shouldPauseHauntBoardActions &&
              !scenarioReaderOpen &&
              !shouldShowScenarioStartOpening &&
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
                    } pointer-events-auto`}
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
                          isEndgameExorciseRollReview ? (
                            <button
                              type="button"
                              data-testid="betrayal-exorcise-roll-continue"
                              className="inline-flex min-h-[42px] min-w-[168px] items-center justify-center border border-[#d6b56d] bg-[#d6b56d] px-5 py-2 text-[14px] font-bold tracking-[0.12em] text-[#19140d] shadow-[0_10px_22px_rgba(0,0,0,0.34)] transition hover:bg-[#f0d28a]"
                              onClick={handleConfirmExorciseRollReview}
                            >
                              {t("board.endgame.enterEndgame")}
                            </button>
                          ) : recentRollAcknowledgeActionSlot ?? (
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
                    actionSlot={rollModifierActionSlot ?? recentRollAcknowledgeActionSlot}
                    actorLabel={resolveRecentRollActorLabel(core.recentRoll)}
                  />
                )
              ) : null}

              {pendingDamageAllocation &&
              pendingDamageExplorer &&
              !shouldGateDamageAllocationBehindRecentRoll ? (
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
                            data-testid="betrayal-damage-allocation-amount"
                            className="text-[22px] font-black leading-tight text-[#fff4c7]"
                          >
                            {t("board.status.damageAllocationHeading", {
                              amount: pendingDamageAllocation.amount,
                              kind: pendingDamageKindLabel,
                            })}
                          </span>
                          {pendingDamageAllocation.sourceTitle ? (
                            <span
                              data-testid="betrayal-damage-allocation-source"
                              data-visible-source-owner={
                                damageAllocationSourceHasVisibleOwner
                                  ? "discovery-card"
                                  : "panel"
                              }
                              className={
                                damageAllocationSourceHasVisibleOwner
                                  ? "sr-only"
                                  : "text-[12px] font-semibold leading-snug text-[#d6c498]"
                              }
                            >
                              {damageAllocationSourceHasVisibleOwner
                                ? pendingDamageAllocation.sourceTitle
                                : t("board.status.damageAllocationSource", {
                                    source: pendingDamageAllocation.sourceTitle,
                                  })}
                            </span>
                          ) : null}
                        </div>
                        <div className="grid gap-1 text-right">
                          <span
                            data-testid="betrayal-damage-allocation-player"
                            className="text-[12px] font-semibold text-[#d6c498]"
                          >
                            {pendingDamageExplorerName}
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
                        className="grid grid-cols-2 gap-2.5"
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
                            <ExplorerTraitOutcomePreview
                              key={`pending-damage-preview-${trait}`}
                              explorer={pendingDamageExplorer}
                              trait={trait}
                              mode="damage"
                              phase={pendingDamageAllocationPhase}
                              stepCount={selectedDamageTraitCount}
                              locale={effectiveLocale}
                              t={t}
                              testIdPrefix="betrayal-damage-allocation-trait"
                              selected={isSelectedDamageTrait}
                              disabled={isDamageTraitDisabled}
                              selectedCount={selectedDamageTraitCount}
                              locked={maxDamageTraitCount <= 0}
                              onIncrement={() =>
                                handleAdjustDamageAllocationTrait(trait, 1)
                              }
                              onDecrement={() =>
                                handleAdjustDamageAllocationTrait(trait, -1)
                              }
                              canIncrement={canIncrementDamageAllocationTrait(trait)}
                              canDecrement={
                                isPendingDamageAllocationForViewer &&
                                selectedDamageTraitCount > 0
                              }
                            />
                          );
                        })}
                      </div>

                      <div className="flex justify-end">
                            <BetrayalConfirmButton
                              type="button"
                              data-testid="betrayal-damage-allocation-confirm"
                          disabled={
                            !pendingDamageAllocationReady ||
                            !isPendingDamageAllocationForViewer
                          }
                              className="min-w-[132px] px-5 text-[14px] shadow-[0_10px_22px_rgba(0,0,0,0.34)]"
                          onClick={handleResolveDamageAllocation}
                        >
                          {t(
                            isPendingDamageAllocationForViewer
                              ? "board.status.damageAllocationConfirm"
                              : "board.status.damageAllocationWaiting",
                          )}
                        </BetrayalConfirmButton>
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
                      ? pendingEventChoiceIsEventSymbolSkip
                        ? "fixed inset-0 items-end justify-end px-2 pb-[88px] pr-[8.25rem] pt-6"
                        : "fixed inset-0 justify-end px-2 pb-[74px] pr-[8.25rem] pt-6"
                      : pendingEventChoiceIsEventSymbolSkip
                        ? "fixed bottom-[96px] left-[248px] right-[232px] top-[92px] items-end justify-center px-2 pb-6 pt-0"
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
                      pendingEventChoiceIsEventSymbolSkip
                        ? isPhoneLandscapeLayout
                          ? "max-h-[calc(100vh-6.25rem)] w-[min(500px,calc(100vw-19.125rem))] grid-cols-1 gap-3"
                          : "max-h-[min(58vh,440px)] w-[min(620px,calc(100vw-30rem))] grid-cols-1 gap-4"
                        : isPhoneLandscapeLayout
                        ? pendingEventChoiceHasResultPanel
                          ? "max-h-[calc(100vh-5.25rem)] w-[min(608px,calc(100vw-20.5rem))] grid-cols-[132px_minmax(294px,1fr)_minmax(158px,158px)] gap-2"
                          : "max-h-[calc(100vh-5.25rem)] w-[min(604px,calc(100vw-19.125rem))] grid-cols-[minmax(132px,168px)_minmax(236px,1fr)] gap-3"
                        : pendingEventChoiceHasResultPanel
                          ? "max-h-full w-full max-w-[1100px] grid-cols-[minmax(230px,260px)_minmax(330px,1fr)_minmax(352px,360px)] items-start gap-5"
                          : "max-h-full w-full max-w-[820px] grid-cols-[minmax(240px,280px)_minmax(380px,1fr)] items-start gap-6"
                      }`}
                  >
                    {pendingEventChoiceIsEventSymbolSkip ? null : (
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
                    )}
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
                        pendingEventChoiceIsEventSymbolSkip
                          ? "pointer-events-auto justify-start gap-4"
                          : pendingEventChoiceRoll
                          ? isPhoneLandscapeLayout
                            ? "pointer-events-auto relative col-start-3 row-start-1 z-[140] h-[262px] justify-center"
                            : "pointer-events-auto relative col-start-3 row-start-1 z-[140] h-[410px] justify-center"
                          : "pointer-events-auto"
                        }`}
                    >
                      {pendingEventChoiceIsEventSymbolSkip ? (
                        <div
                          data-testid="betrayal-event-choice-symbol-summary"
                          className="rounded-[14px] border-2 border-[#4ade80] bg-[rgba(9,24,15,0.90)] px-5 py-4 text-center text-[#d9ffcf] shadow-[0_0_0_1px_rgba(5,46,22,0.92),0_14px_28px_rgba(0,0,0,0.34)]"
                        >
                          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#86efac]">
                            {t("board.discovery.eventSymbol")}
                          </div>
                          <div className="mt-1 text-[22px] font-black leading-tight text-[#ecfdf5]">
                            {pendingEventChoice.eventSymbolSkip?.roomName ??
                              pendingEventChoice.sourceTitle}
                          </div>
                          <p className="mt-2 text-[14px] font-semibold leading-snug text-[#bbf7d0]">
                            {t("board.discovery.eventSymbolSkipPrompt")}
                          </p>
                        </div>
                      ) : null}
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
                                  ? "grid grid-cols-2 gap-2"
                                  : "grid grid-cols-2 gap-2.5"
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
                                    <ExplorerTraitOutcomePreview
                                      key={`damage-preview-${trait}`}
                                      explorer={core.currentExplorer}
                                      trait={trait}
                                      mode="damage"
                                      phase={core.phase}
                                      stepCount={selectedDamageTraitCount}
                                      locale={effectiveLocale}
                                      t={t}
                                      testIdPrefix="betrayal-event-choice-damage"
                                      selected={isSelectedDamageTrait}
                                      disabled={isDamageTraitDisabled}
                                      selectedCount={selectedDamageTraitCount}
                                      locked={maxDamageTraitCount <= 0}
                                      onIncrement={() =>
                                        handleAdjustEventDamageTrait(trait, 1)
                                      }
                                      onDecrement={() =>
                                        handleAdjustEventDamageTrait(trait, -1)
                                      }
                                      canIncrement={canIncrementEventDamageTrait(trait)}
                                      canDecrement={selectedDamageTraitCount > 0}
                                    />
                                  );
                                },
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      {pendingEventChoice.declineLabel ||
                      shouldShowPendingEventAcceptButton ? (
                        <div
                          className={`shrink-0 ${
                            pendingEventChoiceIsEventSymbolSkip
                              ? isPhoneLandscapeLayout
                                ? "mt-1 grid grid-cols-2 gap-3 border-t border-[rgba(74,222,128,0.24)] pt-3"
                                : "mt-1 grid grid-cols-2 gap-4 border-t border-[rgba(74,222,128,0.24)] pt-4"
                              : isPhoneLandscapeLayout
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
                (tradeStatusCueState && !isTradeDraftActive) ||
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
                  {tradeStatusCueState && !isTradeDraftActive ? (
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
                            title={t("board.inventory.traitorEventSkipDescription")}
                            className={`pointer-events-auto inline-flex min-h-[44px] flex-col items-start justify-center gap-0.5 rounded-[10px] border px-3 text-left text-[13px] font-bold shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efd17c] ${
                              ignoreEventSymbolWithTraitorPower
                                ? "border-[#d6b56d] bg-[rgba(214,181,109,0.24)] text-[#fff1b8]"
                                : "border-[rgba(214,181,109,0.34)] bg-[rgba(28,24,18,0.72)] text-[#ead7a5] hover:border-[#d6b56d] hover:bg-[rgba(214,181,109,0.16)] hover:text-[#fff1b8]"
                            }`}
                          >
                            <span>{t("board.inventory.traitorEventSkip")}</span>
                            <span
                              data-testid="betrayal-explore-option-traitor-event-skip-description"
                              className="text-[10px] font-semibold leading-tight text-[#d9c68f]"
                            >
                              {t("board.inventory.traitorEventSkipDescription")}
                            </span>
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
                      const occupants = roomOccupants[room.id] ?? [];
                      const monsters = roomMonsters[room.id] ?? [];
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
                      const identityPresentation =
                        resolveRoomIdentityPresentation(room, {
                          isDiscovered,
                          isExploreTarget,
                          t,
                        });
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
                                  ? "rgba(74, 222, 128, 0.96)"
                                : isMonsterMoveTarget
                                  ? "rgba(159, 225, 167, 0.96)"
                                : isDynamiteTargetRoom
                                  ? "rgba(74, 222, 128, 0.96)"
                                : isMoveTarget
                                ? "rgba(118, 189, 153, 0.92)"
                                : isPendingRoomPlacementSlot
                                  ? "rgba(74, 222, 128, 0.96)"
                                : isHauntTargetRoom
                                  ? "rgba(74, 222, 128, 0.62)"
                                  : canSelectRoomFocusAction
                                    ? "rgba(134, 239, 172, 0.96)"
                                    : isSelectedInventoryTargetRoom ||
                                        isSelectedEventChoiceTargetRoom ||
                                        isSelectedActiveMaskTargetRoom
                                      ? "rgba(34, 197, 94, 0.96)"
                                      : isRoomSelectionTarget
                                        ? "rgba(34, 197, 94, 0.68)"
                                        : isReachableRoom
                                          ? "rgba(96, 155, 125, 0.42)"
                                          : isExploreTarget
                                            ? "rgba(34, 197, 94, 0.20)"
                                            : "rgba(0, 0, 0, 0)",
                              backgroundColor: "transparent",
                              boxShadow: isActive
                                ? "0 0 16px rgba(105,174,128,0.14), 0 12px 22px rgba(0,0,0,0.22)"
                                : isHauntTargetRoom
                                  ? "0 0 0 2px rgba(34,197,94,0.42), 0 0 20px rgba(34,197,94,0.28), 0 10px 18px rgba(0,0,0,0.18)"
                                  : canSelectRoomFocusAction
                                    ? "0 0 0 3px rgba(74,222,128,0.62), 0 0 28px rgba(34,197,94,0.48), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isHelpingHandsTrollMoveTarget
                                    ? "0 0 0 3px rgba(159,225,167,0.58), 0 0 26px rgba(159,225,167,0.46), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isBloodFromStoneSetupPlacementTarget
                                    ? "0 0 0 3px rgba(74,222,128,0.62), 0 0 28px rgba(34,197,94,0.48), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isMonsterMoveTarget
                                    ? "0 0 0 3px rgba(159,225,167,0.58), 0 0 26px rgba(159,225,167,0.46), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isDynamiteTargetRoom
                                    ? "0 0 0 3px rgba(74,222,128,0.62), 0 0 28px rgba(34,197,94,0.48), 0 8px 16px rgba(0,0,0,0.18)"
                                  : isMoveTarget
                                      ? "0 0 0 3px rgba(118,189,153,0.52), 0 0 22px rgba(118,189,153,0.40), 0 8px 16px rgba(0,0,0,0.18)"
                                      : isSelectedInventoryTargetRoom ||
                                          isSelectedEventChoiceTargetRoom ||
                                          isSelectedActiveMaskTargetRoom
                                        ? "0 0 0 3px rgba(74,222,128,0.62), 0 0 28px rgba(34,197,94,0.48), 0 8px 16px rgba(0,0,0,0.18)"
                                        : isRoomSelectionTarget
                                          ? "0 0 0 2px rgba(74,222,128,0.48), 0 0 22px rgba(34,197,94,0.34), 0 8px 16px rgba(0,0,0,0.16)"
                                          : isReachableRoom
                                            ? "0 0 0 2px rgba(96,155,125,0.46), 0 0 18px rgba(96,155,125,0.24), 0 8px 16px rgba(0,0,0,0.16)"
                                            : isPendingRoomPlacementSlot
                                              ? "0 0 0 3px rgba(74,222,128,0.62), 0 0 28px rgba(34,197,94,0.48), 0 8px 16px rgba(0,0,0,0.18)"
                                              : isExploreTarget
                                                ? "0 0 0 2px rgba(74,222,128,0.48), 0 0 22px rgba(34,197,94,0.34), 0 8px 16px rgba(0,0,0,0.16)"
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
                                    ? "bg-[radial-gradient(circle_at_50%_42%,rgba(34,197,94,0.14),transparent_58%)]"
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
                                data-highlight-layer-count="1"
                                data-highlight-style="solid"
                                className={`pointer-events-none absolute inset-0 z-30 rounded-[4px] border-[3px] bg-[rgba(34,197,94,0.07)] ${
                                  isSelectedInventoryTargetRoom ||
                                  isSelectedEventChoiceTargetRoom ||
                                  isSelectedActiveMaskTargetRoom
                                    ? "border-[#bbf7d0]"
                                    : "border-[#4ade80]"
                                }`}
                              />
                            ) : null}
                            {canSelectRoomFocusAction ? (
                            <span
                              data-testid={`betrayal-room-focus-card-highlight-${room.id}`}
                              data-highlight-shape="room"
                              data-highlight-layer-count="1"
                              data-highlight-style="solid"
                              className="pointer-events-none absolute inset-0 z-30 rounded-[4px] border-[3px] border-[#86efac] bg-[rgba(34,197,94,0.07)]"
                            />
                          ) : null}
                          {canExploreRoom ? (
                            <span
                              data-testid={`betrayal-room-explore-card-highlight-${room.id}`}
                              data-highlight-layer-count="1"
                              data-highlight-style="solid"
                              className="pointer-events-none absolute inset-0 z-20 rounded-[4px] border-[3px] border-[#4ade80] bg-[rgba(34,197,94,0.07)]"
                            />
                          ) : null}
                            {identityPresentation ? (
                              <div
                                data-testid={`betrayal-room-stripe-${room.id}`}
                                className={`absolute left-2 top-2 h-5 w-1.5 border border-white/10 ${identityPresentation.tone.stripe} ${canExploreRoom ? "hidden" : ""}`}
                              />
                            ) : null}
                            <div className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-inset ring-[rgba(222,192,133,0.05)]" />
                            <div className="sr-only">
                              <span>{room.name}</span>
                              <span>{tone.label}</span>
                              {identityPresentation ? (
                                <span
                                  data-testid={`betrayal-room-identity-${room.id}`}
                                >
                                  {identityPresentation.label}
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
                            const hasCrowdedEntityRoom = hasPlayers && hasMonsters;
                            const tokenClusterClass =
                              hasCrowdedEntityRoom ? "gap-2" : "gap-0";
                            const playerContainerClass = hasMonsters
                              ? "items-center"
                              : "items-center";
                            const monsterContainerClass = hasPlayers
                              ? "items-center"
                              : "items-center";
                            return (
                              <div
                                className={`pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center ${tokenClusterClass}`}
                                data-room-token-layout={
                                  hasCrowdedEntityRoom
                                    ? "stable-entity-lanes"
                                    : "single-entity-cluster"
                                }
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
                                      const isVisibleFeedbackTarget =
                                        visibleBoardResultFeedback?.kind ===
                                          "heal" &&
                                        (visibleBoardResultFeedback.targetName ===
                                          tokenLabel ||
                                          visibleBoardResultFeedback.targetName ===
                                            occupant.displayName);
                                      const occupantCarriesGirl =
                                        girlHeldByExplorer &&
                                        visibleGirlToken?.ownerPlayerId ===
                                          occupant.playerId;
                                      const isMovingExplorerAnchor =
                                        occupant.playerId ===
                                        movingExplorerPlayerId;
                                      const tokenContent = (
                                        <>
                                          <span className="relative z-10 inline-flex items-end gap-1.5">
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
                                                targetHighlight={
                                                  canSelectExplorerTarget
                                                }
                                                targetHighlightSelected={
                                                  isSelectedExplorerTarget ||
                                                  isHauntGuideExplorerTarget
                                                }
                                                targetHighlightTestId={`betrayal-room-occupant-target-outline-${room.id}-${occupant.playerId}`}
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
                                          {isHauntGuideExplorerTarget ? (
                                            <span
                                              data-testid={`betrayal-room-occupant-target-cue-${room.id}-${occupant.playerId}`}
                                              className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 max-w-[180px] -translate-x-1/2 whitespace-nowrap rounded-[5px] border border-[rgba(217,255,151,0.72)] bg-[rgba(7,14,10,0.92)] px-2 py-1 text-[11px] font-black leading-none tracking-[0.04em] text-[#f2ffd2] shadow-[0_0_0_1px_rgba(7,14,10,0.92),0_8px_18px_rgba(0,0,0,0.34),0_0_20px_rgba(217,255,151,0.24)]"
                                            >
                                              {activeHauntTargetGuide.cue}
                                            </span>
                                          ) : null}
                                          {isVisibleFeedbackTarget ? (
                                            <span
                                              data-testid={`betrayal-room-occupant-feedback-${room.id}-${occupant.playerId}`}
                                              data-feedback-style="floating-text"
                                              data-feedback-anchor="target-token"
                                              aria-label={`${t("board.feedback.healTraitCount", {
                                                count:
                                                  visibleBoardResultFeedback.traitCount ||
                                                  1,
                                              })}：${visibleBoardResultFeedback.traitSummary}`}
                                              className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap text-[16px] font-black leading-none text-[#dcfce7] [text-shadow:0_2px_3px_rgba(0,0,0,0.96),0_0_10px_rgba(34,197,94,0.76),0_0_18px_rgba(34,197,94,0.48)]"
                                            >
                                              {t("board.feedback.healFloatingText", {
                                                count:
                                                  visibleBoardResultFeedback.traitCount ||
                                                  1,
                                              })}
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
                                            data-visual-transition-anchor-hidden={
                                              isMovingExplorerAnchor
                                                ? "true"
                                                : undefined
                                            }
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
                                            className={`pointer-events-auto relative cursor-pointer outline-none transition hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-[#86efac] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86efac] ${
                                              isMovingExplorerAnchor
                                                ? "invisible"
                                                : ""
                                            } ${
                                              isHauntGuideExplorerTarget
                                                ? "grid min-h-[72px] min-w-[72px] place-items-center rounded-[14px] p-3"
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
                                            isMovingExplorerAnchor
                                              ? "invisible"
                                              : ""
                                          } ${
                                            canSelectRoom
                                              ? "pointer-events-none cursor-default"
                                              : "pointer-events-auto cursor-pointer hover:drop-shadow-[0_0_14px_rgba(209,176,95,0.34)]"
                                          }`}
                                          data-testid={`betrayal-room-occupant-${room.id}-${occupant.playerId}`}
                                          data-visual-transition-anchor-hidden={
                                            isMovingExplorerAnchor
                                              ? "true"
                                              : undefined
                                          }
                                          tabIndex={
                                            canSelectRoom
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
                                      const monsterTraitSummary =
                                        formatMonsterTraitSummary(monster);
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
                                      const isSelectedMonsterAttackSource =
                                        isMonsterAttackMode &&
                                        selectedMonsterAttackSourceId ===
                                          monster.id;
                                      const selectedMonsterAttackTargetPlayerId =
                                        isSelectedMonsterAttackSource &&
                                        selectedMonsterAttackEntry
                                          ? Array.from(
                                              selectedMonsterAttackEntry.targetPlayerIds,
                                            )[0] ?? null
                                          : null;
                                      const monsterHighlightRelation =
                                        selectedMonsterAttackTargetPlayerId
                                          ? resolveBetrayalMonsterRelationToExplorer(
                                              core,
                                              monster.id,
                                              selectedMonsterAttackTargetPlayerId,
                                            )
                                          : canSelectMonsterAttackMonster ||
                                            canSelectPeekabooMonsterTarget
                                            ? resolveBetrayalMonsterRelationToExplorer(
                                                core,
                                                monster.id,
                                                core.currentExplorer.playerId,
                                              )
                                            : undefined;
                                      const isMovingMonsterAnchor =
                                        monster.id === movingMonsterId;
                                      const monsterContent = (
                                        <>
                                          <span
                                            className={
                                              monsterCarriesGirl
                                                ? "relative z-10 inline-flex h-[86px] w-[50px] items-start justify-center"
                                                : "relative z-10 inline-flex items-end gap-1.5"
                                            }
                                            data-monster-token-cluster={
                                              monsterCarriesGirl
                                                ? "mummy-carrying-girl"
                                                : undefined
                                            }
                                          >
                                            <MonsterBoardToken
                                              monster={monster}
                                              locale={effectiveLocale}
                                              t={t}
                                              quietFrame={
                                                isHauntGuideMonsterTarget
                                              }
                                              status={monsterStatus}
                                              targetHighlight={
                                                canSelectMonsterTarget ||
                                                canSelectHelpingHandsTrollMoveMonster ||
                                                canSelectMonsterMoveMonster ||
                                                canSelectMonsterAttackMonster ||
                                                canSelectPeekabooMonsterTarget
                                              }
                                              targetHighlightRole={
                                                isSelectedMonsterAttackSource
                                                  ? "source"
                                                  : "target"
                                              }
                                              targetHighlightRelation={
                                                monsterHighlightRelation
                                              }
                                              targetHighlightTestId={
                                                (canSelectMonsterTarget ||
                                                  canSelectHelpingHandsTrollMoveMonster ||
                                                  canSelectMonsterMoveMonster ||
                                                  canSelectMonsterAttackMonster ||
                                                  canSelectPeekabooMonsterTarget)
                                                  ? `betrayal-room-monster-target-outline-${room.id}-${monster.id}`
                                                  : undefined
                                              }
                                            />
                                            {monsterCarriesGirl &&
                                            visibleGirlToken ? (
                                              <span className="pointer-events-none absolute left-1/2 top-[62px] z-30 inline-flex -translate-x-1/2">
                                                <GirlBoardToken
                                                  token={visibleGirlToken}
                                                  t={t}
                                                  attachedTo="mummy"
                                                />
                                              </span>
                                            ) : null}
                                          </span>
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
                                            data-visual-transition-anchor-hidden={
                                              isMovingMonsterAnchor
                                                ? "true"
                                                : undefined
                                            }
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
                                                        : `${monster.name} · ${monsterTraitSummary}`
                                            }
                                            aria-label={
                                              isHauntGuideMonsterTarget
                                                ? `${monster.name}，${hauntGuideMonsterCue}`
                                                : monster.name
                                            }
                                            className={`pointer-events-auto relative cursor-pointer outline-none transition hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-[#86efac] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86efac] ${
                                              isMovingMonsterAnchor
                                                ? "invisible"
                                                : ""
                                            } ${
                                              isHauntGuideMonsterTarget
                                                ? "grid min-h-[52px] min-w-[52px] place-items-center rounded-[10px]"
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
                                        <button
                                          key={monster.id}
                                          type="button"
                                          className={`relative border-0 bg-transparent p-0 outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d1b05f] ${
                                            isMovingMonsterAnchor
                                              ? "invisible"
                                              : ""
                                          } ${
                                            canSelectRoom
                                              ? "pointer-events-none cursor-default"
                                              : "pointer-events-auto cursor-pointer hover:drop-shadow-[0_0_14px_rgba(209,176,95,0.34)]"
                                          }`}
                                          data-testid={`betrayal-room-monster-${room.id}-${monster.id}`}
                                          data-monster-status={monsterStatus}
                                          data-visual-transition-anchor-hidden={
                                            isMovingMonsterAnchor
                                              ? "true"
                                              : undefined
                                          }
                                          data-token-asset={
                                            monster.tokenAsset ??
                                            monster.portraitAsset
                                          }
                                          data-monster-detail-entry="true"
                                          tabIndex={
                                            canSelectRoom ? -1 : undefined
                                          }
                                          title={`${monster.name} · ${monsterTraitSummary}`}
                                          aria-label={t(
                                            "board.monster.openDetails",
                                            { monster: monster.name },
                                          )}
                                          onPointerDown={(event) =>
                                            event.stopPropagation()
                                          }
                                          onPointerUp={(event) =>
                                            event.stopPropagation()
                                          }
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openMonsterDetails(monster.id);
                                          }}
                                        >
                                          {monsterContent}
                                        </button>
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
                              data-highlight-layer-count="1"
                              data-highlight-style="solid"
                              className="pointer-events-none absolute inset-0 z-20 rounded-[4px] border-[3px] border-[#6aa986] bg-[rgba(106,169,134,0.06)]"
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
                              data-highlight-layer-count="1"
                              data-highlight-style="solid"
                              className="pointer-events-none absolute inset-0 z-30 rounded-[4px] border-[3px] border-[#9fe1a7] bg-[rgba(159,225,167,0.07)]"
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
                              data-highlight-layer-count="1"
                              data-highlight-style="solid"
                              className="pointer-events-none absolute inset-0 z-30 rounded-[4px] border-[3px] border-[#9fe1a7] bg-[rgba(159,225,167,0.07)]"
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
                                data-highlight-layer-count="1"
                                data-highlight-style="solid"
                                className={`pointer-events-none absolute inset-0 z-30 rounded-[4px] border-[3px] bg-[rgba(34,197,94,0.07)] ${
                                  bloodFromStoneSetupPlacementCountForRoom > 0
                                    ? "border-[#bbf7d0]"
                                    : "border-[#4ade80]"
                                }`}
                                title={t(
                                  "board.status.bloodFromStoneSetupPlacementTarget",
                                  { room: room.name },
                                )}
                              />
                              {bloodFromStoneSetupPlacementCountForRoom > 0 ? (
                                <span
                                  data-testid={`betrayal-room-blood-from-stone-setup-count-${room.id}`}
                                  className="pointer-events-none absolute right-1 top-1 z-40 rounded-[4px] border border-[#bbf7d0] bg-[rgba(5,46,22,0.92)] px-1.5 py-0.5 text-[10px] font-black leading-none text-[#dcfce7] shadow-[0_3px_10px_rgba(0,0,0,0.34)]"
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
                              data-highlight-layer-count="1"
                              data-highlight-style="solid"
                              className={`pointer-events-none absolute inset-0 z-30 rounded-[4px] border-[3px] bg-[rgba(34,197,94,0.07)] ${
                                isPendingRoomPlacementSlot
                                  ? "border-[#bbf7d0]"
                                  : "border-[#4ade80]"
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
                                        resolveRoomEdgeMarkerClass(doorway.edge)
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
                                  data-tutorial-id="betrayal-room-placement-rotate-right"
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
                            <BetrayalConfirmButton
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
                              className="min-h-[38px] px-2 shadow-[0_6px_14px_rgba(0,0,0,0.28),inset_0_-2px_0_rgba(60,38,12,0.24)] disabled:shadow-none"
                            >
                              {t("board.rooms.confirmPlacement")}
                            </BetrayalConfirmButton>
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
                  {renderTradeFlowBanner("desktop")}
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
                  isTradeDraftActive &&
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
                  isTradeDraftActive &&
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
                          <BetrayalConfirmButton
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveSicknessExchange(true);
                            }}
                            data-testid="betrayal-sickness-exchange-accept"
                            className="min-h-[34px] px-3 py-1 text-[12px] tracking-[0.05em] shadow-[0_0_16px_rgba(215,193,111,0.22)]"
                          >
                            {t("board.status.sicknessExchangeAccept")}
                          </BetrayalConfirmButton>
                          <BetrayalSecondaryButton
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveSicknessExchange(false);
                            }}
                            data-testid="betrayal-sickness-exchange-decline"
                            className="min-h-[34px] px-3 py-1 text-[12px] tracking-[0.05em]"
                          >
                            {t("board.status.sicknessExchangeDecline")}
                          </BetrayalSecondaryButton>
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
                      <div
                        data-testid="betrayal-trade-offer-summary"
                        data-trade-summary-role="proposal-detail"
                        className="flex min-h-[38px] max-w-[460px] items-center gap-2 rounded-[6px] border border-[rgba(238,204,126,0.20)] bg-[rgba(8,9,7,0.36)] px-3 py-1.5"
                      >
                        <span
                          data-testid="betrayal-trade-flow-item-step"
                          className="min-w-0 truncate leading-snug text-[#e3d2a1]"
                        >
                          {tradeInstructionText}
                        </span>
                        <span
                          className="text-[10px] text-[#8f7f5f]"
                          aria-hidden="true"
                        >
                          |
                        </span>
                        <span
                          data-testid="betrayal-trade-flow-target-step"
                          className="shrink-0 font-bold text-[#fff1b8]"
                        >
                          {tradeFlowTargetStepText}
                        </span>
                      </div>
                      {shouldShowInlineTradeConfirm ? (
                        <BetrayalConfirmButton
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
                          data-trade-confirm-role="proposal-submit"
                          className="min-w-[132px] px-5 text-[15px] tracking-[0.08em] shadow-[0_0_18px_rgba(215,193,111,0.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff1b8]"
                        >
                          <Handshake size={17} strokeWidth={2.4} />
                          <span>{t("board.status.tradeFlowRequest")}</span>
                        </BetrayalConfirmButton>
                      ) : null}
                      {pendingTradeAgreement && isPendingTradeForViewer ? (
                        <div
                          data-testid="betrayal-trade-agreement-panel"
                          className="flex items-center gap-2"
                        >
                          <BetrayalConfirmButton
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveTradeAgreement(true);
                            }}
                            data-testid="betrayal-trade-agreement-accept"
                            className="min-w-[112px] px-5 text-[15px] shadow-[0_0_16px_rgba(215,193,111,0.22)]"
                          >
                            {t("board.status.tradeAgreementAccept")}
                          </BetrayalConfirmButton>
                          <BetrayalSecondaryButton
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResolveTradeAgreement(false);
                            }}
                            data-testid="betrayal-trade-agreement-decline"
                            className="min-w-[112px] px-5 text-[15px]"
                          >
                            {t("board.status.tradeAgreementDecline")}
                          </BetrayalSecondaryButton>
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
                      const isInventoryUseConfirmation =
                        action.id === "use" &&
                        Boolean(selectedInventoryCard) &&
                        !isHauntPrimaryButton;
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
                      const ActionButton = isInventoryUseConfirmation
                        ? BetrayalConfirmButton
                        : "button";
                      return (
                        <ActionButton
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
                          className={isInventoryUseConfirmation
                            ? "min-w-[132px] px-5 text-[14px] shadow-[0_10px_22px_rgba(0,0,0,0.34)]"
                            : `flex min-h-[48px] min-w-[80px] flex-col items-center justify-end gap-0.5 rounded-[5px] border-0 bg-transparent px-1.5 py-1 text-[13px] font-bold uppercase tracking-[0.08em] shadow-none transition ${
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
                          style={isInventoryUseConfirmation ? undefined : {
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
                        </ActionButton>
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
          closeOnBackdrop={false}
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
                      data-testid="betrayal-scenario-reader-case-label"
                      className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#c9a35e]"
                    >
                      {activeHauntCaseLabel}
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
                                    isScenarioReaderCinematicSection(
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
                                          <h2
                                            data-testid={`betrayal-scenario-book-section-title-${section.id}`}
                                            className={`${isPhoneLandscapeLayout ? "text-[14px]" : "text-[22px]"} font-black tracking-[0.03em] text-[#3b2211]`}
                                          >
                                            {t(section.labelKey)}
                                          </h2>
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
          closeOnBackdrop={false}
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
          closeOnBackdrop={false}
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
          isTradeDraftActive &&
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
                      <div
                        data-testid="betrayal-mobile-trade-action-panel"
                        data-prompt-actions-for="betrayal-trade-flow-banner"
                        className="mt-2 grid gap-2"
                      >
                        <div
                          data-testid="betrayal-mobile-trade-offer-summary"
                          data-trade-summary-role="proposal-detail"
                          className="grid gap-1 rounded-[7px] border border-[rgba(238,204,126,0.22)] bg-[rgba(8,9,7,0.34)] px-2.5 py-2 text-[11px] font-semibold text-[#e3d2a1]"
                        >
                          <span data-testid="betrayal-trade-flow-item-step">
                            {tradeInstructionText}
                          </span>
                          <span
                            data-testid="betrayal-trade-flow-target-step"
                            className="font-bold text-[#fff1b8]"
                          >
                            {tradeFlowTargetStepText}
                          </span>
                        </div>
                        <BetrayalConfirmButton
                          type="button"
                          onClick={() => handleTradeAction()}
                          data-testid="betrayal-mobile-trade-flow-confirm"
                          data-trade-confirm-role="proposal-submit"
                          className="min-h-[42px] w-full px-3 text-[12px] tracking-[0.06em] shadow-[0_0_16px_rgba(215,193,111,0.20)]"
                        >
                          {t("board.status.tradeFlowRequest")}
                        </BetrayalConfirmButton>
                      </div>
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
                            <BetrayalConfirmButton
                              type="button"
                              onClick={() =>
                                handleResolveSicknessExchange(true)
                              }
                              data-testid="betrayal-mobile-sickness-exchange-accept"
                              className="min-h-[42px] flex-1 px-2 text-[12px]"
                            >
                              {t("board.status.sicknessExchangeAccept")}
                            </BetrayalConfirmButton>
                            <BetrayalSecondaryButton
                              type="button"
                              onClick={() =>
                                handleResolveSicknessExchange(false)
                              }
                              data-testid="betrayal-mobile-sickness-exchange-decline"
                              className="min-h-[42px] flex-1 px-2 text-[12px]"
                            >
                              {t("board.status.sicknessExchangeDecline")}
                            </BetrayalSecondaryButton>
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
                        className="mt-2 grid gap-2"
                      >
                        <div
                          data-testid="betrayal-mobile-trade-offer-summary"
                          data-trade-summary-role="proposal-detail"
                          className="grid gap-1 rounded-[7px] border border-[rgba(238,204,126,0.22)] bg-[rgba(8,9,7,0.34)] px-2.5 py-2 text-[11px] font-semibold text-[#e3d2a1]"
                        >
                          <span data-testid="betrayal-trade-flow-item-step">
                            {tradeInstructionText}
                          </span>
                          <span
                            data-testid="betrayal-trade-flow-target-step"
                            className="font-bold text-[#fff1b8]"
                          >
                            {tradeFlowTargetStepText}
                          </span>
                        </div>
                        {isPendingTradeForViewer ? (
                          <div className="flex items-center gap-2">
                            <BetrayalConfirmButton
                              type="button"
                              onClick={() => handleResolveTradeAgreement(true)}
                              data-testid="betrayal-mobile-trade-agreement-accept"
                              className="flex-1 px-2 text-[12px]"
                            >
                              {t("board.status.tradeAgreementAccept")}
                            </BetrayalConfirmButton>
                            <BetrayalSecondaryButton
                              type="button"
                              onClick={() => handleResolveTradeAgreement(false)}
                              data-testid="betrayal-mobile-trade-agreement-decline"
                              className="min-h-[42px] flex-1 px-2 text-[12px]"
                            >
                              {t("board.status.tradeAgreementDecline")}
                            </BetrayalSecondaryButton>
                          </div>
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
                    const isInventoryUseConfirmation =
                      action.id === "use" &&
                      Boolean(selectedInventoryCard) &&
                      !isHauntPrimaryButton;
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
                    const ActionButton = isInventoryUseConfirmation
                      ? BetrayalConfirmButton
                      : "button";
                    return (
                      <ActionButton
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
                        className={isInventoryUseConfirmation
                            ? "min-w-[132px] px-5 text-[14px] shadow-[0_10px_22px_rgba(0,0,0,0.34)]"
                            : `flex flex-col items-center justify-center transition ${
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
                        style={isInventoryUseConfirmation ? undefined : {
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
                        </ActionButton>
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
    </UndoProvider>
  );
}
