import React from "react";
import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTutorial, useTutorialBridge } from "../../contexts/TutorialContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { HudPortal, UI_Z_INDEX } from "../../core";
import type { ActionBarAction } from "../../core/ui/types";
import { playSound, useGameAudio } from "../../lib/audio/useGameAudio";
import { useVisualSequenceGate } from "../../components/game/framework";
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
  BetrayalRoomNode,
  BetrayalRoomPlacementPreview,
  BetrayalRoomTileAdjustmentOption,
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
  resolveActiveHauntDossier,
  resolveScenarioReaderOpenPlan,
  resolveScenarioReaderScope,
  resolveScenarioReaderSpreadPages,
  type ScenarioBookTurnSnapshot,
} from "./scenarioReader";
import { BetrayalHauntRevealCue } from "./hauntRevealCueSurface";
import {
  ROOM_CANVAS_MIN_HEIGHT,
  ROOM_CANVAS_MIN_WIDTH,
  ROOM_MAP_FLOOR_ORDER,
  buildRoomMonsters,
  buildRoomOccupants,
  formatRoomTargetList,
  resolveDynamiteTargetRooms,
  resolveExplorerFloor,
  resolveExplorerFloorByPlayer,
  resolveFloorLabel,
  resolveOccupiedRoomMapFloors,
  resolveRoomCanvasLayout,
  roomTileAdjustmentSelectionsMatch,
  toRoomTileAdjustmentSelection,
} from "./roomMapModel";
import { resolveRoomEndTurnEffectHint } from "./roomPresentation";
import {
  buildDeckItems,
  buildDiscardItems,
} from "./deckPresentation";
import { BetrayalDeckStatusRailSurface } from "./deckStatusRailSurface";
import {
  resolveReferencePages,
  type ReferencePageId,
} from "./referencePresentation";
import {
  resolveDamageReductionCardNames,
  resolvePreviewUseEffectLabel,
} from "./inventoryPresentation";
import {
  resolveEventActionEffect,
  resolveEventGeneralDamageChoice,
  resolveEventItemChoiceCards,
  resolveEventPreviewEffect,
  resolveEventTargetRooms,
  resolveEventTraitChoices,
  mergeEventTraitChoices,
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
  resolveBetrayalAttackLineOfSightSegments,
} from "./attackLineOfSightPresentation";
import {
  resolveBetrayalAttackTargetPlayerIds,
  resolveAttackWeaponCardStatuses,
} from "./attackRules";
import {
  TRAIT_DAMAGE_ORDER,
  adjustSelectedDamageTrait,
  countSelectedDamageTrait,
  pruneSelectedDamageTraits,
  resolveHighestTraitChoice,
  resolveTraitDamageAssignableSteps,
} from "./traitPresentation";
import { BETRAYAL_TRAIT_MARKER_ASSETS } from "./traitAssets";
import {
  BETRAYAL_COVER_ASSET,
  BETRAYAL_OMEN_DECK_ASSET,
  BETRAYAL_TITLE_BANNER_ASSET,
} from "./uiAssets";
import {
  resolveDiscoveryAtlasVisual,
} from "./discoveryAtlas";
import { BetrayalInventoryRailSurface } from "./inventoryRailSurface";
import { BetrayalDamageAllocationSurface } from "./damageAllocationSurface";
import {
  BETRAYAL_ROOM_TILE_VISUALS,
  resolveBetrayalRoomNodeTileVisual,
  resolveBetrayalRoomTileVisual,
} from "./roomAtlas";
import { BetrayalTopPromptStackSurface } from "./topPromptStackSurface";
import {
  BetrayalHelpingHandsRewardActionsSurface,
  BetrayalHelpingHandsTrollAttackActionsSurface,
  BetrayalMummyRewardActionsSurface,
} from "./attackRewardActionSurface";
import { BetrayalEventChoiceSurface } from "./eventChoiceSurface";
import { BetrayalTableActionCueSurface } from "./tableActionCueSurface";
import { BetrayalActionDockSurface } from "./actionDockSurface";
import {
  BetrayalSicknessExchangeBannerSurface,
  BetrayalTradeActionPanelSurface,
  BetrayalTradeCardSelectorSurface,
} from "./tradeCardSelectorSurface";
import {
  BETRAYAL_AUDIO_CONFIG,
  BETRAYAL_SCENARIO_PAGE_TURN_KEY,
} from "./audio.config";
import { BETRAYAL_MANIFEST } from "./manifest";
import {
  BetrayalConfirmButton,
  BETRAYAL_CONFIRM_BUTTON_CLASS,
} from "./confirmButtonSurface";
import { BetrayalDebugPanel } from "./debugPanelSurface";
import { EndgameScreen } from "./endgameScreen";
import { CharacterSelectScreen } from "./characterSelectSurface";
import { ExplorerDetailsDialog, MonsterDetailsDialog } from "./entityDetailsSurface";
import { BetrayalRoomMapSurface } from "./roomMapSurface";
import { BetrayalRecentRollReviewSurface } from "./recentRollReviewSurface";
import {
  BetrayalVisualTransitionLayer,
  centerBetrayalRect,
  findBetrayalTestElement,
  readBetrayalViewportRect,
  type BetrayalVisualTransition,
} from "./visualTransitionSurface";
import { BetrayalReferenceOverlaySurface } from "./referenceOverlaySurface";
import {
  BetrayalReferenceQuickActionsSurface,
} from "./referenceQuickActionsSurface";
import { BetrayalPreviewOverlaySurface } from "./previewOverlaySurface";
import { BetrayalScenarioStartOpeningStageSurface } from "./scenarioStartOpeningStageSurface";
import {
  BetrayalObservedExplorerPanelSurface,
  BetrayalTeammateListSurface,
} from "./playerStatusRailSurface";
import {
  createInitialPreviewState,
  resolvePreservedExplorePlacementState,
  type PreviewState,
} from "./previewStateModel";
import { BetrayalMobileActionRailSurface } from "./mobileActionRailSurface";
import { BetrayalLatestDiscoverySurface } from "./latestDiscoverySurface";
import {
  DUST_CURE_TRAIT_CHOICES,
  DUST_SEARCH_TRAIT_CHOICES,
  isDustTraitChoice,
} from "./dustHauntRules";

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
    numberBlank: "betrayal/markers/number-blank",
  } as const,
  ui: {
    hauntRiskTrack: "betrayal/ui/trait-track-0-9",
  } as const,
} as const;

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
  const pendingScenarioTurnTutorialAdvanceRef = React.useRef(false);
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
  const [dismissedLatestDiscoveryKeys, setDismissedLatestDiscoveryKeys] =
    React.useState<ReadonlySet<string>>(() => new Set());
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
    const openPlan = resolveScenarioReaderOpenPlan(core, viewerPlayerId, {
      mode: shouldAdvanceScenarioReferenceTutorial
        ? "tutorialObjective"
        : "manualReview",
      hasOpeningSection: Boolean(referenceScenarioOpeningSection),
      bookSpreadCount: referenceScenarioBookSpreadCount,
    });
    const initialScenarioSpreadIndex =
      tutorialScenarioStepId === "jack-spirit-objective" ||
      tutorialScenarioStepId === "traitor-objective"
        ? Math.min(1, openPlan.spreadCount - 1)
        : openPlan.initialSpreadIndex;
    const hauntRevealKey = openPlan.isPublicHauntRevealReader
      ? buildLatestDiscoveryKey(core)
      : null;
    pendingScenarioTurnTutorialAdvanceRef.current = false;
    if (hauntRevealKey) {
      setDismissedLatestDiscoveryKeys((previousKeys) => {
        if (previousKeys.has(hauntRevealKey)) {
          return previousKeys;
        }
        const nextKeys = new Set(previousKeys);
        nextKeys.add(hauntRevealKey);
        return nextKeys;
      });
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
    setReferenceScenarioOpeningStageActive(openPlan.includeOpeningStage);
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
    referenceScenarioBookSpreadCount,
    referenceScenarioOpeningSection,
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
    const shouldAdvanceScenarioReaderCloseTutorial =
      isTutorialActive &&
      scenarioReaderOpen &&
      tutorialStep?.id === "haunt-hero-reader-close";
    setReferenceOpen(false);
    setScenarioReaderOpen(false);
    setReferenceScenarioOpeningStageActive(false);
    pendingScenarioTurnTutorialAdvanceRef.current = false;
    if (shouldAdvanceScenarioReaderCloseTutorial) {
      nextStep("auto");
    }
  }, [isTutorialActive, nextStep, scenarioReaderOpen, tutorialStep?.id]);

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
    ? resolveBetrayalRoomNodeTileVisual(
        previewRoom,
        previewRoom.state === "discovered",
      )
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
      ? resolveBetrayalRoomTileVisual(pendingRoomPlacementPreview.room.visualId) ??
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
  const attackLineOfSightSegments = React.useMemo(
    () =>
      resolveBetrayalAttackLineOfSightSegments({
        core,
        visibleRooms: visibleMapRooms,
        roomCanvasLayout,
        allExplorers,
        selectedAttackWeaponCardId,
        selectedAttackWeaponEffectId,
        hauntTargetingActionKind: previewState.hauntTargetingActionKind,
        selectedAttackTargetPlayerIds,
        isMonsterAttackMode,
        selectedMonsterAttackSourceId,
        selectedMonsterAttackEntry,
      }),
    [
      allExplorers,
      core,
      isMonsterAttackMode,
      previewState.hauntTargetingActionKind,
      roomCanvasLayout,
      selectedAttackTargetPlayerIds,
      selectedAttackWeaponCardId,
      selectedAttackWeaponEffectId,
      selectedMonsterAttackEntry,
      selectedMonsterAttackSourceId,
      visibleMapRooms,
    ],
  );

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
      dismissedLatestDiscoveryKeys.has(nextEntry.key)
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
    dismissedLatestDiscoveryKeys,
    previewState.dismissedLatestDiscoveryKey,
    viewerPlayerId,
  ]);
  const queuedLatestDiscoveryEntry = latestDiscoveryQueue[0] ?? null;
  const visibleCurrentLatestDiscoveryEntry =
    currentLatestDiscoveryEntry &&
    currentLatestDiscoveryEntry.key !== previewState.dismissedLatestDiscoveryKey &&
    !dismissedLatestDiscoveryKeys.has(currentLatestDiscoveryEntry.key)
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
    }, 2400);
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
    const openPlan = resolveScenarioReaderOpenPlan(core, viewerPlayerId, {
      mode: "hauntReveal",
      hasOpeningSection: Boolean(referenceScenarioOpeningSection),
      bookSpreadCount: referenceScenarioBookSpreadCount,
    });
    setDismissedHauntRevealDiscoveryKey(hauntRevealDiscoveryKey);
    setReferenceScenarioSpreadIndex(openPlan.initialSpreadIndex);
    setReferenceScenarioOpeningStageActive(openPlan.includeOpeningStage);
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
    referenceScenarioBookSpreadCount,
    referenceScenarioOpeningSection,
    scenarioReaderOpen,
    shouldShowHauntRevealCue,
    viewerPlayerId,
  ]);
  const visibleDustProgressItems = shouldShowHauntRevealCue
    ? []
    : dustProgressItems;
  const shouldShowDustProgressPrompt = Boolean(
    visibleDustProgressItems.length > 0 &&
      !pendingSicknessExchange &&
      !mummyPendingReward &&
      !helpingHandsPendingReward &&
      !isDustSicknessExchangeMode,
  );
  const shouldShowHelpingHandsTrollAttackBanner = Boolean(
    !helpingHandsPendingReward &&
      !mummyPendingReward &&
      !pendingTradeAgreement &&
      !pendingSicknessExchange &&
      !isDustSicknessExchangeMode &&
      !activeHauntTargetGuide &&
      helpingHandsTrollHandAttackOption &&
      helpingHandsTrollHandAttackTarget,
  );
  const shouldShowTopPromptStack = Boolean(
    visibleDustProgressItems.length > 0 ||
      shouldShowTradeFlowPrompt ||
      mummyPendingReward ||
      helpingHandsPendingReward ||
      shouldShowHelpingHandsMonsterTurnStatus ||
      shouldShowHelpingHandsTrollAttackBanner,
  );
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
  const latestDiscoveryContinueButton = {
    label: latestDiscoveryContinueLabel,
    disabled: Boolean(
      (core.pendingEventRollResolution &&
        !eventRollConfirmation.canViewerAcknowledge) ||
        (latestDiscoveryPendingCardResolution &&
          !canAdvanceLatestDiscoverySearch &&
          !canCurrentViewerAcknowledgeCardResolution),
    ),
    pendingCardResolutionId:
      latestDiscoveryPendingCardResolution?.id ?? undefined,
    pendingCardResolutionStep:
      latestDiscoveryPendingCardResolution &&
      !isLatestDiscoverySearchFinalAcknowledgement
        ? `${latestDiscoveryPendingCardResolution.index}/${latestDiscoveryPendingCardResolution.total}`
        : undefined,
    cardResolutionConfirmedCount: latestDiscoveryPendingCardResolution
      ? latestDiscoveryCardResolutionConfirmedCount
      : undefined,
    cardResolutionRequiredCount: latestDiscoveryPendingCardResolution
      ? latestDiscoveryCardResolutionTotalCount
      : undefined,
    eventRollConfirmedCount: core.pendingEventRollResolution
      ? eventRollConfirmation.confirmedCount
      : isLatestDiscoverySearchFinalAcknowledgement
        ? latestDiscoveryCardResolutionConfirmedCount
        : undefined,
    eventRollRequiredCount: core.pendingEventRollResolution
      ? eventRollConfirmation.totalCount
      : isLatestDiscoverySearchFinalAcknowledgement
        ? latestDiscoveryCardResolutionTotalCount
        : undefined,
  };
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
    setDismissedLatestDiscoveryKeys((previousKeys) => {
      if (previousKeys.has(latestDiscoveryKey)) {
        return previousKeys;
      }
      const nextKeys = new Set(previousKeys);
      nextKeys.add(latestDiscoveryKey);
      return nextKeys;
    });
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
        latestDiscoveryRecentRoll?.sourceTitle === latestDiscoveryTitle &&
        latestDiscoveryRecentRoll.kind !== "eventRolledDamage"
          ? latestDiscoveryRecentRollDisplayKey
          : previousState.dismissedRecentRollId,
    }));
  }, [
    latestDiscoveryKey,
    latestDiscoveryRecentRoll?.kind,
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
        !dismissedLatestDiscoveryKeys.has(nextDiscoveryEntry.key),
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
  const canPickUpMummyGirlRoomId =
    hauntActionContext?.actionKind === "use" &&
    hauntActionContext.commandType === BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL
      ? core.currentExplorer.roomId
      : null;
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
    const shouldAdvanceScenarioTurnTutorial =
      isTutorialActive &&
      direction === "forward" &&
      tutorialStep?.id === "haunt-hero-reader-turn-page";
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
        if (shouldAdvanceScenarioTurnTutorial) {
          pendingScenarioTurnTutorialAdvanceRef.current = true;
        }
      }
      return nextIndex;
    });
  };

  const handleReferenceScenarioTurnComplete = React.useCallback(() => {
    setReferenceScenarioTurnDirection(null);
    setReferenceScenarioTurnSnapshot(null);
    if (pendingScenarioTurnTutorialAdvanceRef.current) {
      pendingScenarioTurnTutorialAdvanceRef.current = false;
      nextStep("auto");
    }
  }, [nextStep]);
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

  const resolveInventoryCardSurfaceTradeStatus = React.useCallback(
    (cardId: string): BetrayalTradeCardStatus | null => {
      if (
        isInventoryDisplayReadOnly ||
        isDustSicknessExchangeMode ||
        !isTradeDraftActive ||
        pendingTradeAgreement
      ) {
        return null;
      }
      return resolveBetrayalTradeCardStatus(core, cardId, {
        ownerPlayerId: core.currentExplorer.playerId,
        ownerRole: "requester",
      });
    },
    [
      core,
      isDustSicknessExchangeMode,
      isInventoryDisplayReadOnly,
      isTradeDraftActive,
      pendingTradeAgreement,
    ],
  );

  const resolveInventoryCardSurfaceSelected = React.useCallback(
    (cardId: string): boolean => {
      if (isInventoryDisplayReadOnly) {
        return false;
      }
      if (
        isTradeDraftActive &&
        !isDustSicknessExchangeMode &&
        selectedTradeGiveCardIds.includes(cardId)
      ) {
        return true;
      }
      return cardId === selectedInventoryCard?.id;
    },
    [
      isDustSicknessExchangeMode,
      isInventoryDisplayReadOnly,
      isTradeDraftActive,
      selectedInventoryCard?.id,
      selectedTradeGiveCardIds,
    ],
  );

  const handleInventoryCardSurfacePrimarySelect = React.useCallback(
    (cardId: string) => {
      if (isTradeDraftActive && !isDustSicknessExchangeMode) {
        handleToggleTradeGiveCard(cardId);
        return;
      }
      setPreviewState((previousState) => ({
        ...previousState,
        selectedInventoryCardId: cardId,
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
    },
    [handleToggleTradeGiveCard, isDustSicknessExchangeMode, isTradeDraftActive],
  );

  const handleInventoryCardSurfaceEventRollBookUse = React.useCallback(
    (cardId: string) => {
      dispatchCommand(BETRAYAL_COMMANDS.USE_POSSESSION, {
        cardId,
      });
      setInventoryPreviewCardId(null);
      setPreviewState((previousState) => ({
        ...previousState,
        selectedInventoryCardId: null,
        selectedRollModifierDieIndex: null,
      }));
    },
    [dispatchCommand],
  );

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
        <BetrayalScenarioStartOpeningStageSurface
          label={t(scenarioStartOpeningSection.labelKey)}
          text={t(scenarioStartOpeningSection.bodyKey)}
          continueLabel={t("board.scenario.readerContinue")}
          compact={isPhoneLandscapeLayout}
          onContinue={dismissScenarioStartOpening}
        />
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

          <BetrayalTopPromptStackSurface
            variant="mobile"
            enabled={
              isPhoneLandscapeLayout &&
              !shouldHideTableChromeForBlockingOverlay &&
              !pendingEventFocusesMapTarget &&
              !shouldUseMobileEventOpenTableChrome &&
              shouldShowTopPromptStack
            }
            dustProgressItems={visibleDustProgressItems}
            showDustProgress={shouldShowDustProgressPrompt}
            dustProgressDimmed={Boolean(activeHauntTargetGuide)}
            activeHauntCaseLabel={activeHauntCaseLabel}
            activeHauntTitle={activeHauntTitle}
            showTradeFlowPrompt={shouldShowTradeFlowPrompt}
            tradeAgreementState={tradeAgreementState}
            tradeBannerStatusText={tradeBannerStatusText}
            mummyReward={
              mummyPendingReward
                ? {
                    isChooser: isMummyRewardChooser,
                    chooserTargetName: mummyRewardDefenderName,
                    waitingPlayerName: mummyRewardControllerName,
                    damage: mummyPendingReward.damageToHero,
                    unavailableStealTargetCount:
                      mummyUnavailableStealTargetCount,
                  }
                : null
            }
            helpingHandsReward={
              helpingHandsPendingReward
                ? {
                    isChooser: isHelpingHandsRewardChooser,
                    chooserTargetName: helpingHandsRewardDefenderName,
                    waitingPlayerName: helpingHandsRewardAttackerName,
                    damage: helpingHandsPendingReward.damageToDefender,
                  }
                : null
            }
            helpingHandsMonsterTurnStatus={
              shouldShowHelpingHandsMonsterTurnStatus
                ? {
                    active: helpingHandsMonsterTurnStatus.active,
                    controllerName: helpingHandsMonsterControllerName,
                  }
                : null
            }
            showHelpingHandsTrollAttack={
              shouldShowHelpingHandsTrollAttackBanner
            }
            helpingHandsTrollAttackTargetName={
              helpingHandsTrollHandAttackTargetName
            }
          />

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
            <BetrayalObservedExplorerPanelSurface
              explorer={observedExplorer}
              roomName={observedExplorerRoomName}
              abilityName={observedExplorerAbilityName}
              abilityText={observedExplorerAbilityText}
              markerAsset={ASSETS.marker.numberBlank}
              locale={effectiveLocale}
              matchData={matchData}
              isObservingOtherExplorer={isObservingOtherExplorer}
            />

            <article className="hidden px-2 py-1 md:px-1 xl:hidden">
              <div className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-[#a89d84]">
                {t("board.sections.players")}
              </div>
              <div className="grid gap-1.5">
                <BetrayalTeammateListSurface
                  variant="compact"
                  explorers={core.otherExplorers}
                  rooms={core.rooms}
                  currentExplorerRoomId={core.currentExplorer.roomId}
                  observedExplorerPlayerId={observedExplorer.playerId}
                  activeTradeTargets={activeTradeTargets}
                  corpseLootTargets={corpseLootTargets}
                  dogTradeTargets={dogTradeTargets}
                  dustTargetPlayerIds={dustTargetPlayerIds}
                  magicCameraPhotoTargetPlayerIds={magicCameraPhotoTargetPlayerIds}
                  phantomPhotographerTargetPlayerIds={phantomPhotographerTargetPlayerIds}
                  selectedMonsterAttackTargetPlayerIds={selectedMonsterAttackTargetPlayerIds}
                  helpingHandsTrollHandAttackTargetPlayerIds={helpingHandsTrollHandAttackTargetPlayerIds}
                  heroAttackTargetPlayerIds={heroAttackTargetPlayerIds}
                  knowledgeOfJackPlayerIds={core.scenarioRuntime.knowledgeOfJackPlayerIds}
                  isDustSicknessExchangeMode={isDustSicknessExchangeMode}
                  isHeroAttackTargetingMode={isHeroAttackTargetingMode}
                  isDustAttackTargetingMode={isDustAttackTargetingMode}
                  hauntActionKind={hauntActionContext?.actionKind}
                  hauntActionTargetPlayerId={hauntActionContext?.targetPlayerId}
                  selectedTradeTargetPlayerId={selectedTradeTargetPlayerId}
                  selectedCorpseLootTargetPlayerId={selectedCorpseLootTargetPlayerId}
                  selectedPreviewTradeTargetPlayerId={previewState.selectedTradeTargetPlayerId}
                  selectedDustTargetPlayerId={selectedDustTargetPlayerId}
                  locale={effectiveLocale}
                  matchData={matchData}
                  onSelectTarget={handleSelectExplorerTarget}
                  onObserveExplorer={handleObserveExplorer}
                />
              </div>
            </article>
          </section>
          <BetrayalInventoryRailSurface
            explorer={inventoryDisplayExplorer}
            cards={visibleInventoryCards}
            isReadOnly={isInventoryDisplayReadOnly}
            ownerLabel={
              isInventoryDisplayReadOnly
                ? resolvePlayerName(
                    inventoryDisplayExplorer.playerId,
                    inventoryDisplayExplorer.displayName,
                    matchData,
                  )
                : null
            }
            selectedDisplayText={selectedInventoryDisplayText}
            hasSelectedDisplay={hasSelectedInventoryDisplay}
            useStatusText={useStatusText}
            isPhoneLandscapeLayout={isPhoneLandscapeLayout}
            isDimmed={Boolean(activeHauntTargetGuide)}
            elevatedForRollModifier={
              shouldShowLatestDiscovery &&
              !shouldAutoReturnAfterLatestDiscovery &&
              !pendingEventChoice &&
              canCurrentPlayerModifyLatestDiscoveryRoll
            }
            usedCardIdsThisTurn={core.usedCardIdsThisTurn}
            availableCardIdsThisTurn={core.turnStartInventoryCardIds}
            isTradeDraftActive={isTradeDraftActive}
            rollModifierCardIds={rollModifierCardIds}
            eventRollBookCardIds={eventRollBookCardIds}
            isTutorialUseBookActive={
              isTutorialActive && tutorialStep?.id === "use-book"
            }
            deckAssets={ASSETS.deck}
            traitAssets={ASSETS.trait}
            locale={effectiveLocale}
            resolveCardSelected={resolveInventoryCardSurfaceSelected}
            resolveTradeStatus={resolveInventoryCardSurfaceTradeStatus}
            onUseBookForEventRoll={handleInventoryCardSurfaceEventRollBookUse}
            onPrimarySelect={handleInventoryCardSurfacePrimarySelect}
            onPreview={setInventoryPreviewCardId}
          />

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

              <BetrayalLatestDiscoverySurface
                visible={
                  shouldShowLatestDiscovery &&
                  !shouldAutoReturnAfterLatestDiscovery &&
                  !pendingEventChoice
                }
                discovery={latestDiscovery}
                displayedKindLabel={latestDiscoveryDisplayedKindLabel}
                displayedTitle={latestDiscoveryDisplayedTitle}
                displaySummary={latestDiscoveryDisplaySummary}
                panelVisual={latestDiscoveryPanelVisual}
                resolutionSteps={latestDiscoveryResolutionSteps}
                visibleProcessCard={latestDiscoveryVisibleProcessCard}
                searchStepNumber={latestDiscoverySearchStepNumber}
                searchSequenceLength={latestDiscoverySearchSequence.length}
                searchFinalEffectText={latestDiscoverySearchFinalEffectText}
                shouldShowCardFace={shouldShowLatestDiscoveryCardFace}
                shouldShowRoll={shouldShowLatestDiscoveryRoll}
                recentRoll={latestDiscoveryRecentRoll}
                rerollSelection={latestDiscoveryRerollSelection}
                canModifyRoll={canCurrentPlayerModifyLatestDiscoveryRoll}
                rollActorLabel={
                  latestDiscoveryRecentRoll
                    ? resolveRecentRollActorLabel(latestDiscoveryRecentRoll)
                    : ""
                }
                rollModifierActionSlot={rollModifierActionSlot}
                pendingEventRollRequiresNoAcknowledgement={Boolean(
                  core.pendingEventRollResolution?.requiresAcknowledgement ===
                    false,
                )}
                hasPendingEventRollStart={Boolean(
                  pendingLatestDiscoveryEventRollStart,
                )}
                canStartPendingEventRoll={
                  canCurrentViewerStartLatestDiscoveryEventRoll
                }
                continueButton={latestDiscoveryContinueButton}
                isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                shouldUseMobileEventOpenTableChrome={
                  shouldUseMobileEventOpenTableChrome
                }
                effectiveLocale={effectiveLocale}
                canDismissByBackdrop={canDismissLatestDiscoveryByBackdrop}
                isPossessionGainTransitionActive={
                  visualTransition?.kind === "possession-gain"
                }
                onDismiss={handleDismissLatestDiscovery}
                onRollLatestDiscoveryEvent={handleRollLatestDiscoveryEvent}
                onContinue={handleContinueLatestDiscovery}
                onDiceSettledChange={handleRecentRollDiceSettledChange}
              />

              <BetrayalRecentRollReviewSurface
                roll={core.recentRoll}
                visible={Boolean(
                  core.recentRoll &&
                    core.phase !== "endgame" &&
                    !isRecentRollDismissed &&
                    !isConfirmedExorciseRoll &&
                    !pendingEventChoice &&
                    !shouldAutoReturnAfterLatestDiscovery &&
                    !shouldShowHauntRevealCue &&
                    !shouldPauseHauntBoardActions &&
                    !scenarioReaderOpen &&
                    !shouldShowScenarioStartOpening &&
                    !shouldShowLatestDiscovery,
                )}
                isExorciseRollReview={isExorciseRollReview}
                isEndgameExorciseRollReview={isEndgameExorciseRollReview}
                isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                canDismissByBackdrop={canDismissRecentRollByBackdrop}
                effectiveLocale={effectiveLocale}
                rerollSelection={recentRollRerollSelection}
                actionSlot={
                  rollModifierActionSlot ?? recentRollAcknowledgeActionSlot
                }
                actorLabel={
                  core.recentRoll
                    ? resolveRecentRollActorLabel(core.recentRoll)
                    : ""
                }
                onDismiss={handleDismissRecentRoll}
                onConfirmExorciseRollReview={handleConfirmExorciseRollReview}
                onDiceSettledChange={handleRecentRollDiceSettledChange}
              />

              {pendingDamageAllocation &&
              pendingDamageExplorer &&
              !shouldGateDamageAllocationBehindRecentRoll ? (
                <BetrayalDamageAllocationSurface
                  allocation={pendingDamageAllocation}
                  explorer={pendingDamageExplorer}
                  explorerName={pendingDamageExplorerName}
                  phase={pendingDamageAllocationPhase}
                  allowedTraits={pendingDamageAllocationAllowedTraits}
                  selectedTraits={selectedDamageAllocationTraits}
                  resolvedDamageKind={
                    pendingDamageUsesBrooch
                      ? "general"
                      : pendingDamageAllocation.damageKind
                  }
                  reductionAmount={pendingDamageReductionAmount}
                  reductionSourceLabel={pendingDamageReductionSourceLabel}
                  sourceHasVisibleOwner={damageAllocationSourceHasVisibleOwner}
                  canUseBrooch={canUseBroochForPendingDamageAllocation}
                  usesBrooch={pendingDamageUsesBrooch}
                  canAct={isPendingDamageAllocationForViewer}
                  ready={pendingDamageAllocationReady}
                  locale={effectiveLocale}
                  isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                  onToggleBrooch={handleToggleDamageAllocationBrooch}
                  onAdjustTrait={handleAdjustDamageAllocationTrait}
                  canIncrementTrait={canIncrementDamageAllocationTrait}
                  onResolve={handleResolveDamageAllocation}
                />
              ) : null}

              {pendingEventChoice && !pendingEventFocusesMapTarget ? (
                <BetrayalEventChoiceSurface
                  choice={pendingEventChoice}
                  isEventSymbolSkip={pendingEventChoiceIsEventSymbolSkip}
                  isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                  awaitsMapTargetClick={pendingEventAwaitsMapTargetClick}
                  hasMapTargetRooms={pendingEventTargetRooms.length > 0}
                  hasResultPanel={pendingEventChoiceHasResultPanel}
                  latestDiscoveryVisual={latestDiscoveryVisual}
                  roll={pendingEventChoiceRoll}
                  rollActorLabel={
                    pendingEventChoiceRoll
                      ? resolveRecentRollActorLabel(pendingEventChoiceRoll)
                      : null
                  }
                  allTraitCheck={pendingEventChoiceAllTraitCheck}
                  traitChoices={pendingEventTraitChoices}
                  selectedTrait={selectedEventTrait}
                  hasItemChoice={Boolean(pendingEventItemChoice)}
                  itemChoiceCards={pendingEventItemChoiceCards}
                  selectedCardId={selectedEventCardId}
                  showDamageChoice={shouldShowPendingEventDamageChoice}
                  damageChoice={pendingEventDamageChoice}
                  selectedDamageTraits={selectedEventDamageTraits}
                  explorer={core.currentExplorer}
                  phase={core.phase}
                  locale={effectiveLocale}
                  ready={pendingEventReady}
                  canDecline={pendingEventCanDecline}
                  showAcceptButton={shouldShowPendingEventAcceptButton}
                  onSelectTrait={handleSelectEventTrait}
                  onSelectCard={handleSelectEventCard}
                  onAdjustDamageTrait={handleAdjustEventDamageTrait}
                  canIncrementDamageTrait={canIncrementEventDamageTrait}
                  onResolve={handleResolveEventChoice}
                />
              ) : null}

              <BetrayalTableActionCueSurface
                hidden={shouldHideTableChromeForBlockingOverlay}
                forceVisible={useDogTrade}
                phase={core.phase}
                isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                roomFocusLabel={
                  shouldShowRoomFocusTargetLabel
                    ? (roomFocusState?.label ?? null)
                    : null
                }
                tradeStatusCueLabel={
                  tradeStatusCueState && !isTradeDraftActive
                    ? tradeStatusCueState.label
                    : null
                }
                dustHauntTraitSelector={dustHauntTraitSelector}
                inventoryTargetRooms={
                  selectedInventoryUseEffectMode === "placeExplorer"
                    ? inventoryTargetRooms
                    : []
                }
                selectedInventoryTargetRoomId={selectedInventoryTargetRoomId}
                healTargetOptions={
                  selectedInventoryUseEffectMode === "healTraits"
                    ? healTargetExplorers.map((explorer) => ({
                        playerId: explorer.playerId,
                        displayName: resolvePlayerName(
                          explorer.playerId,
                          explorer.displayName,
                          matchData,
                        ),
                        selected:
                          selectedInventoryTargetPlayerId === explorer.playerId,
                      }))
                    : []
                }
                selectedHealCardName={selectedInventoryCard?.name ?? null}
                rollTotalReplacementOptions={
                  selectedInventoryRollTotalReplacementEffect
                    ? selectedInventoryReplacementRollTotalOptions
                    : []
                }
                selectedInventoryReplacementRollTotal={
                  selectedInventoryReplacementRollTotal
                }
                selectedInventoryHealPreviewExplorer={
                  selectedInventoryHealPreviewExplorer
                }
                selectedInventoryHealPreviewTraits={
                  selectedInventoryHealPreviewTraits
                }
                attackWeaponCardStatuses={
                  hauntActionContext?.actionKind?.startsWith("attack-")
                    ? attackWeaponCardStatuses
                    : []
                }
                selectedAttackWeaponCardId={selectedAttackWeaponCardId}
                selectedCorpseLootTarget={selectedCorpseLootTarget}
                selectedCorpseLootCardId={selectedCorpseLootCardId}
                exploreDeclarationOptions={
                  hasExploreDeclarationOptions
                    ? {
                        label: exploreDeclarationLabel,
                        canDeclareHolySymbolExplore,
                        useHolySymbolForExplore,
                        canDeclareIdolExplore,
                        useIdolForExplore,
                        canDeclareTraitorEventSkip,
                        ignoreEventSymbolWithTraitorPower,
                      }
                    : null
                }
                maskTargetTokens={
                  selectedCardNeedsTargetRoom ? maskTargetTokens : []
                }
                maskTargetRooms={selectedCardNeedsTargetRoom ? maskTargetRooms : []}
                activeMaskTargetTokenId={activeMaskTargetTokenId}
                selectedMaskTargetRoomIdsByTokenId={
                  selectedMaskTargetRoomIdsByTokenId
                }
                locale={effectiveLocale}
                onSelectDustHauntTrait={handleSelectDustHauntTrait}
                onSelectInventoryReplacementRollTotal={
                  handleSelectInventoryReplacementRollTotal
                }
                onSelectAttackWeapon={handleSelectAttackWeapon}
                onSelectCorpseLootCard={(cardId) =>
                  setPreviewState((previousState) => ({
                    ...previousState,
                    selectedCorpseLootCardId: cardId,
                    tradeSelectionTouched: true,
                  }))
                }
                onToggleHolySymbolExplore={handleToggleHolySymbolExplore}
                onToggleIdolExplore={handleToggleIdolExplore}
                onToggleTraitorEventSkip={handleToggleTraitorEventSkip}
              />

              <BetrayalRoomMapSurface
                core={core}
                locale={effectiveLocale}
                matchData={matchData}
                roomGridRef={roomGridRef}
                selectedFloor={selectedRoomMapFloor}
                visibleRooms={visibleMapRooms}
                roomCanvasLayout={roomCanvasLayout}
                roomCanvasTransformStyle={roomCanvasTransformStyle}
                roomCanvasWidth={roomCanvasWidth}
                roomCanvasHeight={roomCanvasHeight}
                isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                isHauntTargetingMode={isHauntTargetingMode}
                roomFocusPanTarget={roomFocusPanTarget}
                attackLineOfSightSegments={attackLineOfSightSegments}
                roomOccupants={roomOccupants}
                roomMonsters={roomMonsters}
                visibleHauntTokensByRoomId={visibleHauntTokensByRoomId}
                movingGirlTokenId={movingGirlTokenId}
                movingExplorerPlayerId={movingExplorerPlayerId}
                movingMonsterId={movingMonsterId}
                activeHauntTargetGuide={activeHauntTargetGuide}
                hauntActionKind={hauntActionContext?.actionKind}
                canPickUpMummyGirlRoomId={canPickUpMummyGirlRoomId}
                moveTargetRoomIds={moveTargetRoomIds}
                skeletonKeyMoveTargetRoomIds={skeletonKeyMoveTargetRoomIds}
                explorableRoomSlotIds={explorableRoomSlotIds}
                interactionMode={previewState.interactionMode}
                selectedInventoryUseEffectMode={selectedInventoryUseEffectMode}
                inventoryTargetRooms={inventoryTargetRooms}
                selectedInventoryTargetRoomId={selectedInventoryTargetRoomId}
                pendingEventTargetRooms={pendingEventTargetRooms}
                selectedEventTargetRoomId={selectedEventTargetRoomId}
                maskTargetRooms={maskTargetRooms}
                maskTargetTokens={maskTargetTokens}
                activeMaskTargetTokenId={activeMaskTargetTokenId}
                selectedMaskTargetRoomIdsByTokenId={selectedMaskTargetRoomIdsByTokenId}
                isDynamiteRoomTargetingMode={isDynamiteRoomTargetingMode}
                dynamiteTargetRoomIds={dynamiteTargetRoomIds}
                isHelpingHandsTrollHandMoveMode={isHelpingHandsTrollHandMoveMode}
                helpingHandsTrollMoveTargetRoomIds={selectedHelpingHandsTrollHandMoveEntry?.targetRoomIds ?? null}
                helpingHandsTrollMoveMonsterName={selectedHelpingHandsTrollHandMoveEntry?.monster.name ?? null}
                isMonsterMoveMode={isMonsterMoveMode}
                monsterMoveTargetRoomIds={selectedMonsterMoveEntry?.targetRoomIds ?? null}
                monsterMoveMonsterName={selectedMonsterMoveEntry?.monster.name ?? null}
                isBloodFromStoneSetupPlacementMode={isBloodFromStoneSetupPlacementMode}
                bloodFromStoneSetupCandidateRoomIds={bloodFromStoneSetupCandidateRoomIds}
                selectedBloodFromStoneStoneCherubRoomIds={selectedBloodFromStoneStoneCherubRoomIds}
                bloodFromStoneSetupPlacementCountByRoomId={selectedBloodFromStoneStoneCherubRoomCountByRoomId}
                bloodFromStoneSetupPendingPlayerChoiceCount={bloodFromStoneSetupPlacementPlan.pendingPlayerChoiceCount}
                pendingRoomPlacementPreview={pendingRoomPlacementPreview}
                pendingEventFocusesMapTarget={pendingEventFocusesMapTarget}
                tutorialMapTargetRoomId={tutorialMapTargetRoomId}
                tutorialHighlightTarget={tutorialStep?.highlightTarget ?? null}
                roomFocusState={roomFocusState}
                isTradeOrLootTargetSelectionActive={isTradeOrLootTargetSelectionActive}
                activeTradeTargets={activeTradeTargets}
                corpseLootTargets={corpseLootTargets}
                healTargetExplorers={healTargetExplorers}
                dustTargetPlayerIds={dustTargetPlayerIds}
                magicCameraPhotoTargetPlayerIds={magicCameraPhotoTargetPlayerIds}
                helpingHandsTrollHandAttackTargetPlayerIds={helpingHandsTrollHandAttackTargetPlayerIds}
                selectedMonsterAttackTargetPlayerIds={selectedMonsterAttackTargetPlayerIds}
                heroAttackTargetPlayerIds={heroAttackTargetPlayerIds}
                isDustAttackTargetingMode={isDustAttackTargetingMode}
                isDustSicknessExchangeMode={isDustSicknessExchangeMode}
                isHeroAttackTargetingMode={isHeroAttackTargetingMode}
                selectedTradeTargetPlayerId={selectedTradeTargetPlayerId}
                selectedCorpseLootTargetPlayerId={selectedCorpseLootTargetPlayerId}
                selectedInventoryTargetPlayerId={selectedInventoryTargetPlayerId}
                selectedPreviewTradeTargetPlayerId={previewState.selectedTradeTargetPlayerId}
                selectedDustTargetPlayerId={selectedDustTargetPlayerId}
                visibleFeedback={visibleBoardResultFeedback}
                helpingHandsMovableTrollHandIds={helpingHandsMovableTrollHandIds}
                monsterMovableIds={monsterMovableIds}
                isMonsterAttackMode={isMonsterAttackMode}
                monsterAttackableIds={monsterAttackableIds}
                isBloodFromStonePeekabooMode={isBloodFromStonePeekabooMode}
                bloodFromStonePeekabooSameRoomMonsterIds={bloodFromStonePeekabooSameRoomMonsterIds}
                bloodFromStonePeekabooLineOfSightMonsterIds={bloodFromStonePeekabooLineOfSightMonsterIds}
                selectedMonsterAttackSourceId={selectedMonsterAttackSourceId}
                selectedPeekabooSameRoomMonsterId={previewState.selectedPeekabooSameRoomMonsterId}
                monsterStatusById={monsterStatusById}
                resolveMonsterRelationToExplorer={(monsterId, explorerPlayerId) =>
                  resolveBetrayalMonsterRelationToExplorer(
                    core,
                    monsterId,
                    explorerPlayerId,
                  )
                }
                renderAttackImpactSurface={renderAttackImpactSurface}
                pendingRoomPlacementFailureText={pendingRoomPlacementFailureText}
                selectedRoomOrientationOption={selectedRoomOrientationOption}
                selectedRoomOrientationTurns={selectedRoomOrientationTurns}
                pendingRoomPlacementVisual={pendingRoomPlacementVisual}
                pendingRoomPlacementAdjustmentText={pendingRoomPlacementAdjustmentText}
                pendingRoomTileAdjustmentOptions={pendingRoomTileAdjustmentOptions}
                selectedRoomTileAdjustmentOption={selectedRoomTileAdjustmentOption}
                upperFloor={upperRoomMapFloor ?? null}
                lowerFloor={lowerRoomMapFloor ?? null}
                upperFloorHasSelectionTarget={upperRoomMapFloorHasSelectionTarget}
                lowerFloorHasSelectionTarget={lowerRoomMapFloorHasSelectionTarget}
                hasCrossFloorMoveTargets={hasCrossFloorMoveTargets}
                hasCrossFloorRoomSelectionTargets={hasCrossFloorRoomSelectionTargets}
                hiddenTableChrome={shouldHideTableChromeForBlockingOverlay}
                onSelectEventTargetRoom={handleSelectEventTargetRoom}
                onSelectBloodFromStoneSetupPlacementRoom={handleSelectBloodFromStoneSetupPlacementRoom}
                onSelectInventoryTargetRoom={handleSelectInventoryTargetRoom}
                onSelectMaskTargetRoom={handleSelectMaskTargetRoom}
                onDynamiteRoomAttack={handleDynamiteRoomAttack}
                onMoveHelpingHandsTrollHandToRoom={handleHelpingHandsTrollHandMoveToRoom}
                onMoveMonsterToRoom={handleMoveMonsterToRoom}
                onSelectRoomFocusAction={handleUseAction}
                onPrepareExploreRoom={handlePrepareExploreRoom}
                onMoveToRoom={handleMoveToRoom}
                onOpenRoomPreview={setRoomPreviewId}
                onSelectExplorerTarget={handleSelectExplorerTarget}
                onOpenExplorerDetails={openExplorerDetails}
                onSelectMonsterTarget={handleSelectMonsterTarget}
                onSelectHelpingHandsTrollHandMoveMonster={handleSelectHelpingHandsTrollHandMoveMonster}
                onSelectMonsterMoveMonster={handleSelectMonsterMoveMonster}
                onSelectMonsterAttackMonster={handleSelectMonsterAttackMonster}
                onOpenMonsterDetails={openMonsterDetails}
                onPickUpMummyGirl={handleHauntPrimaryAction}
                onRotateRoomPlacement={handleRotateRoomPlacement}
                onCancelRoomPlacement={handleCancelRoomPlacement}
                onConfirmRoomPlacement={handleConfirmRoomPlacement}
                onSelectRoomTileAdjustment={handleSelectRoomTileAdjustment}
                onSelectFloor={setSelectedRoomMapFloor}
              />
              <BetrayalTopPromptStackSurface
                variant="desktop"
                enabled={
                  !isEndgameExorciseRollReview &&
                  !shouldHideTableChromeForBlockingOverlay &&
                  !isPhoneLandscapeLayout &&
                  shouldShowTopPromptStack
                }
                dustProgressItems={visibleDustProgressItems}
                showDustProgress={shouldShowDustProgressPrompt}
                dustProgressDimmed={Boolean(activeHauntTargetGuide)}
                activeHauntCaseLabel={activeHauntCaseLabel}
                activeHauntTitle={activeHauntTitle}
                showTradeFlowPrompt={shouldShowTradeFlowPrompt}
                tradeAgreementState={tradeAgreementState}
                tradeBannerStatusText={tradeBannerStatusText}
                mummyReward={
                  mummyPendingReward
                    ? {
                        isChooser: isMummyRewardChooser,
                        chooserTargetName: mummyRewardDefenderName,
                        waitingPlayerName: mummyRewardControllerName,
                        damage: mummyPendingReward.damageToHero,
                        unavailableStealTargetCount:
                          mummyUnavailableStealTargetCount,
                      }
                    : null
                }
                helpingHandsReward={
                  helpingHandsPendingReward
                    ? {
                        isChooser: isHelpingHandsRewardChooser,
                        chooserTargetName: helpingHandsRewardDefenderName,
                        waitingPlayerName: helpingHandsRewardAttackerName,
                        damage: helpingHandsPendingReward.damageToDefender,
                      }
                    : null
                }
                helpingHandsMonsterTurnStatus={
                  shouldShowHelpingHandsMonsterTurnStatus
                    ? {
                        active: helpingHandsMonsterTurnStatus.active,
                        controllerName: helpingHandsMonsterControllerName,
                      }
                    : null
                }
                showHelpingHandsTrollAttack={
                  shouldShowHelpingHandsTrollAttackBanner
                }
                helpingHandsTrollAttackTargetName={
                  helpingHandsTrollHandAttackTargetName
                }
              />

              {visibleActionItems.length > 0 &&
              !isEndgameExorciseRollReview &&
              !shouldHideTableChromeForBlockingOverlay &&
              !isPhoneLandscapeLayout ? (
                <div
                  data-testid="betrayal-action-rail"
                  className="pointer-events-none absolute inset-x-0 bottom-1 z-50 hidden flex-col items-center justify-end gap-0.5 md:flex"
                >
                  {mummyPendingReward && isMummyRewardChooser ? (
                    <BetrayalMummyRewardActionsSurface
                      variant="desktop"
                      damage={mummyPendingReward.damageToHero}
                      stealableCards={mummyStealableCards}
                      onResolveDamage={() =>
                        handleResolveMummyAttackReward("damage")
                      }
                      onStealCard={(cardId) =>
                        handleResolveMummyAttackReward("steal", cardId)
                      }
                    />
                  ) : null}
                  {helpingHandsPendingReward && isHelpingHandsRewardChooser ? (
                    <BetrayalHelpingHandsRewardActionsSurface
                      variant="desktop"
                      damage={helpingHandsPendingReward.damageToDefender}
                      stealableCards={helpingHandsStealableCards}
                      onResolveDamage={() =>
                        handleResolveHelpingHandsAttackReward("damage")
                      }
                      onStealCard={(cardId) =>
                        handleResolveHelpingHandsAttackReward("steal", cardId)
                      }
                    />
                  ) : null}
                  {!mummyPendingReward &&
                  !helpingHandsPendingReward &&
                  !pendingTradeAgreement &&
                  !pendingSicknessExchange &&
                  !isDustSicknessExchangeMode &&
                  !activeHauntTargetGuide &&
                  helpingHandsVisibleTrollHandAttackOptions.length > 0 ? (
                    <BetrayalHelpingHandsTrollAttackActionsSurface
                      variant="desktop"
                      attackOptions={helpingHandsVisibleTrollHandAttackOptions}
                      attackTargetsByOptionId={
                        helpingHandsTrollHandAttackTargetsByOptionId
                      }
                      trollHandIds={helpingHandsMonsterTurnStatus.trollHandIds}
                      onAttack={handleHelpingHandsTrollHandAttack}
                    />
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
                    <BetrayalTradeCardSelectorSurface
                      testId="betrayal-dog-trade-selector"
                      currentFlowChoice="dog-trade-give"
                      label={t("board.inventory.dog")}
                      cards={core.currentExplorerInventory.filter(
                        (card) => card.id !== "dog",
                      )}
                      selectedCardIds={selectedDogTradeCardIds}
                      cardTestIdPrefix="betrayal-dog-trade-card"
                      isTradeDraftActive={isTradeDraftActive}
                      rollModifierCardIds={rollModifierCardIds}
                      eventRollBookCardIds={eventRollBookCardIds}
                      isTutorialUseBookActive={
                        isTutorialActive && tutorialStep?.id === "use-book"
                      }
                      deckAssets={ASSETS.deck}
                      traitAssets={ASSETS.trait}
                      locale={effectiveLocale}
                      resolveTradeStatus={(card) =>
                        resolveBetrayalTradeCardStatus(core, card.id, {
                          ownerPlayerId: core.currentExplorer.playerId,
                          ownerRole: "requester",
                          useDogTrade: true,
                        })
                      }
                      onToggleCard={handleToggleDogTradeCard}
                      onUseBookForEventRoll={
                        handleInventoryCardSurfaceEventRollBookUse
                      }
                      onPrimarySelect={handleInventoryCardSurfacePrimarySelect}
                      onPreview={setInventoryPreviewCardId}
                    />
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
                    <BetrayalTradeCardSelectorSurface
                      testId="betrayal-trade-return-selector"
                      currentFlowChoice="trade-return"
                      label={tradeReturnSelectorLabel}
                      cards={selectedTradeTarget.inventory}
                      selectedCardIds={selectedTradeReturnCardIds}
                      cardTestIdPrefix="betrayal-trade-return-card"
                      isTradeDraftActive={isTradeDraftActive}
                      rollModifierCardIds={rollModifierCardIds}
                      eventRollBookCardIds={eventRollBookCardIds}
                      isTutorialUseBookActive={
                        isTutorialActive && tutorialStep?.id === "use-book"
                      }
                      deckAssets={ASSETS.deck}
                      traitAssets={ASSETS.trait}
                      locale={effectiveLocale}
                      resolveTradeStatus={(card) =>
                        resolveBetrayalTradeCardStatus(core, card.id, {
                          ownerPlayerId: selectedTradeTarget.playerId,
                          ownerRole: "target",
                        })
                      }
                      onToggleCard={handleToggleTradeReturnCard}
                      onUseBookForEventRoll={
                        handleInventoryCardSurfaceEventRollBookUse
                      }
                      onPrimarySelect={handleInventoryCardSurfacePrimarySelect}
                      onPreview={setInventoryPreviewCardId}
                    />
                  ) : null}
                  {pendingSicknessExchange ? (
                    <BetrayalSicknessExchangeBannerSurface
                      isPendingForViewer={isPendingSicknessForViewer}
                      isPendingFromViewer={isPendingSicknessFromViewer}
                      instructionText={tradeInstructionText}
                      targetStepText={
                        isPendingSicknessForViewer
                          ? t("board.status.sicknessExchangeTitle")
                          : t("board.status.sicknessExchangeWaiting", {
                              player: pendingSicknessTargetName,
                            })
                      }
                      acceptLabel={t("board.status.sicknessExchangeAccept")}
                      declineLabel={t("board.status.sicknessExchangeDecline")}
                      waitingLabel={t("board.status.tradeStepAgree")}
                      onAccept={() => handleResolveSicknessExchange(true)}
                      onDecline={() => handleResolveSicknessExchange(false)}
                    />
                  ) : null}
                  {shouldShowTradeActionPanel ? (
                    <BetrayalTradeActionPanelSurface
                      instructionText={tradeInstructionText}
                      targetStepText={tradeFlowTargetStepText}
                      showInlineTradeConfirm={shouldShowInlineTradeConfirm}
                      showTradeAgreementActions={Boolean(
                        pendingTradeAgreement && isPendingTradeForViewer,
                      )}
                      requestLabel={t("board.status.tradeFlowRequest")}
                      acceptLabel={t("board.status.tradeAgreementAccept")}
                      declineLabel={t("board.status.tradeAgreementDecline")}
                      onRequest={handleTradeAction}
                      onAccept={() => handleResolveTradeAgreement(true)}
                      onDecline={() => handleResolveTradeAgreement(false)}
                    />
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
                    <BetrayalActionDockSurface
                      actions={visibleActionItems}
                      variant="desktop"
                      phase={core.phase}
                      recommendedAction={core.recommendedAction}
                      interactionMode={previewState.interactionMode}
                      hauntActionKind={hauntActionContext?.actionKind}
                      hauntTargetingActionKind={
                        previewState.hauntTargetingActionKind
                      }
                      hasActiveHauntTargetGuide={Boolean(activeHauntTargetGuide)}
                      hasSelectedInventoryCard={Boolean(selectedInventoryCard)}
                      hasRoomEndTurnEffect={Boolean(roomEndTurnEffectHint)}
                      isBloodFromStoneSetupPlacementMode={
                        isBloodFromStoneSetupPlacementMode
                      }
                      isDustSicknessExchangeMode={isDustSicknessExchangeMode}
                      isHauntTargetingMode={isHauntTargetingMode}
                      isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                      hideTradeAction={shouldShowInlineTradeConfirm}
                      actionCueText={actionCueText}
                      actionHandlers={actionHandlerMap}
                    />
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
            <BetrayalDeckStatusRailSurface
              deckItems={deckItems}
              discardItems={discardItems}
              hauntRisk={hauntRisk}
              hauntRiskTrack={hauntRiskTrack}
              highlightedDeckKind={core.highlightedDeckKind}
              hauntRiskTrackAsset={ASSETS.ui.hauntRiskTrack}
              locale={effectiveLocale}
            />

            <article className="bg-transparent pt-1">
              <BetrayalReferenceQuickActionsSurface
                showScenarioReferenceButton={
                  !isPhoneLandscapeLayout &&
                  !shouldHideTableChromeForBlockingOverlay
                }
                dimScenarioReferenceButton={Boolean(activeHauntTargetGuide)}
                scenarioReferenceAccessibleLabel={scenarioReferenceAccessibleLabel}
                scenarioReferenceButtonLabel={scenarioReferenceButtonLabel}
                currentExplorerRoomId={core.currentExplorer.roomId}
                onOpenScenarioReference={openScenarioReference}
                onOpenReferenceCards={openReferenceCards}
                onFocusSelfRoom={handleFocusSelfRoom}
              />
              <div className="mt-3 hidden xl:block">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(196,162,101,0.18))]" />
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#a89d84]">
                    {t("board.hud.teammatesLabel")}
                  </div>
                </div>
                <div className="mt-2 grid gap-1.5">
                  <BetrayalTeammateListSurface
                    variant="sidebar"
                    explorers={core.otherExplorers}
                    rooms={core.rooms}
                    currentExplorerRoomId={core.currentExplorer.roomId}
                    observedExplorerPlayerId={observedExplorer.playerId}
                    activeTradeTargets={activeTradeTargets}
                    corpseLootTargets={corpseLootTargets}
                    dogTradeTargets={dogTradeTargets}
                    dustTargetPlayerIds={dustTargetPlayerIds}
                    magicCameraPhotoTargetPlayerIds={magicCameraPhotoTargetPlayerIds}
                    phantomPhotographerTargetPlayerIds={phantomPhotographerTargetPlayerIds}
                    selectedMonsterAttackTargetPlayerIds={selectedMonsterAttackTargetPlayerIds}
                    helpingHandsTrollHandAttackTargetPlayerIds={helpingHandsTrollHandAttackTargetPlayerIds}
                    heroAttackTargetPlayerIds={heroAttackTargetPlayerIds}
                    knowledgeOfJackPlayerIds={core.scenarioRuntime.knowledgeOfJackPlayerIds}
                    isDustSicknessExchangeMode={isDustSicknessExchangeMode}
                    isHeroAttackTargetingMode={isHeroAttackTargetingMode}
                    isDustAttackTargetingMode={isDustAttackTargetingMode}
                    hauntActionKind={hauntActionContext?.actionKind}
                    hauntActionTargetPlayerId={hauntActionContext?.targetPlayerId}
                    selectedTradeTargetPlayerId={selectedTradeTargetPlayerId}
                    selectedCorpseLootTargetPlayerId={selectedCorpseLootTargetPlayerId}
                    selectedPreviewTradeTargetPlayerId={previewState.selectedTradeTargetPlayerId}
                    selectedDustTargetPlayerId={selectedDustTargetPlayerId}
                    locale={effectiveLocale}
                    matchData={matchData}
                    onSelectTarget={handleSelectExplorerTarget}
                    onObserveExplorer={handleObserveExplorer}
                  />                </div>
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

        <BetrayalReferenceOverlaySurface
          referenceOpen={referenceOpen}
          scenarioReaderOpen={scenarioReaderOpen}
          isReferenceScenarioOpeningStage={isReferenceScenarioOpeningStage}
          isPhoneLandscapeLayout={isPhoneLandscapeLayout}
          currentReferencePage={currentReferencePage}
          referenceFallbackAsset={ASSETS.playerReference.front}
          effectiveLocale={effectiveLocale}
          scenarioReaderScope={scenarioReaderScope}
          scenarioReaderScopeLabel={scenarioReaderScopeLabel}
          activeHauntCaseLabel={activeHauntCaseLabel}
          activeHauntTitle={activeHauntTitle}
          referenceScenarioSpreadIndex={referenceScenarioSpreadIndex}
          referenceScenarioSpreadCount={referenceScenarioSpreadCount}
          referenceScenarioOpeningSection={referenceScenarioOpeningSection}
          referenceScenarioTurnDirection={referenceScenarioTurnDirection}
          referenceScenarioTurnSnapshot={referenceScenarioTurnSnapshot}
          referenceScenarioLeftPage={referenceScenarioLeftPage}
          referenceScenarioRightPage={referenceScenarioRightPage}
          canTurnReferenceScenarioBack={canTurnReferenceScenarioBack}
          canTurnReferenceScenarioForward={canTurnReferenceScenarioForward}
          onClose={closeReferenceOverlay}
          onToggleReferenceSide={toggleReferenceSide}
          onReferenceScenarioTurn={handleReferenceScenarioTurn}
          onScenarioTurnComplete={handleReferenceScenarioTurnComplete}
        />
        <BetrayalPreviewOverlaySurface
          previewRoom={previewRoom}
          previewRoomVisual={previewRoomVisual}
          previewInventoryCard={previewInventoryCard}
          deckAssets={ASSETS.deck}
          traitAssets={ASSETS.trait}
          locale={effectiveLocale}
          onCloseRoomPreview={() => setRoomPreviewId(null)}
          onCloseInventoryPreview={() => setInventoryPreviewCardId(null)}
        />

        <BetrayalMobileActionRailSurface
          hasActiveHauntTargetGuide={Boolean(activeHauntTargetGuide)}
          isTradeDraftActive={isTradeDraftActive}
          hasPendingSicknessExchange={Boolean(pendingSicknessExchange)}
          hasPendingTradeAgreement={Boolean(pendingTradeAgreement)}
          isDustSicknessExchangeMode={isDustSicknessExchangeMode}
          shouldShowInlineTradeConfirm={shouldShowInlineTradeConfirm}
          isEndgameExorciseRollReview={isEndgameExorciseRollReview}
          isPhoneLandscapeLayout={isPhoneLandscapeLayout}
          pendingEventFocusesMapTarget={pendingEventFocusesMapTarget}
          shouldHideTableChromeForBlockingOverlay={
            shouldHideTableChromeForBlockingOverlay
          }
          selectedInventoryDisplayText={selectedInventoryDisplayText}
          useStatusText={useStatusText}
          selectedCardUseDisabled={Boolean(selectedCardUseDisabled)}
          shouldShowBoardActionStatus={shouldShowBoardActionStatus}
          shouldShowMobileTradeStatus={shouldShowMobileTradeStatus}
          hasSelectedTradeTarget={Boolean(selectedTradeTarget)}
          tradeStatusText={tradeStatusText}
          actionCueText={actionCueText}
          visibleDustProgressItems={visibleDustProgressItems}
          activeHauntCaseLabel={activeHauntCaseLabel}
          activeHauntTitle={activeHauntTitle}
          tradeInstructionText={tradeInstructionText}
          tradeFlowTargetStepText={tradeFlowTargetStepText}
          mummyReward={
            mummyPendingReward
              ? {
                  isChooser: isMummyRewardChooser,
                  damage: mummyPendingReward.damageToHero,
                  stealableCards: mummyStealableCards,
                }
              : null
          }
          helpingHandsReward={
            helpingHandsPendingReward
              ? {
                  isChooser: isHelpingHandsRewardChooser,
                  damage: helpingHandsPendingReward.damageToDefender,
                  stealableCards: helpingHandsStealableCards,
                }
              : null
          }
          isPendingSicknessForViewer={isPendingSicknessForViewer}
          isPendingTradeForViewer={isPendingTradeForViewer}
          helpingHandsTrollAttack={
            helpingHandsVisibleTrollHandAttackOptions.length > 0
              ? {
                  attackOptions: helpingHandsVisibleTrollHandAttackOptions,
                  attackTargetsByOptionId:
                    helpingHandsTrollHandAttackTargetsByOptionId,
                  trollHandIds: helpingHandsMonsterTurnStatus.trollHandIds,
                }
              : null
          }
          scenarioReferenceAccessibleLabel={scenarioReferenceAccessibleLabel}
          scenarioReferenceButtonLabel={scenarioReferenceButtonLabel}
          visibleActionItems={visibleActionItems}
          phase={core.phase}
          recommendedAction={core.recommendedAction}
          interactionMode={previewState.interactionMode}
          hauntActionKind={hauntActionContext?.actionKind}
          hauntTargetingActionKind={previewState.hauntTargetingActionKind}
          hasSelectedInventoryCard={Boolean(selectedInventoryCard)}
          hasRoomEndTurnEffect={Boolean(roomEndTurnEffectHint)}
          isBloodFromStoneSetupPlacementMode={isBloodFromStoneSetupPlacementMode}
          isHauntTargetingMode={isHauntTargetingMode}
          actionHandlers={actionHandlerMap}
          onTradeAction={handleTradeAction}
          onResolveMummyDamage={() => handleResolveMummyAttackReward("damage")}
          onStealMummyCard={(cardId) =>
            handleResolveMummyAttackReward("steal", cardId)
          }
          onResolveHelpingHandsDamage={() =>
            handleResolveHelpingHandsAttackReward("damage")
          }
          onStealHelpingHandsCard={(cardId) =>
            handleResolveHelpingHandsAttackReward("steal", cardId)
          }
          onAcceptSicknessExchange={() => handleResolveSicknessExchange(true)}
          onDeclineSicknessExchange={() => handleResolveSicknessExchange(false)}
          onAcceptTradeAgreement={() => handleResolveTradeAgreement(true)}
          onDeclineTradeAgreement={() => handleResolveTradeAgreement(false)}
          onHelpingHandsTrollHandAttack={handleHelpingHandsTrollHandAttack}
          onOpenScenarioReference={openScenarioReference}
          onJumpInventory={() => scrollToSection("betrayal-inventory-section")}
          onJumpDecks={() => scrollToSection("betrayal-decks-section")}
        />
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
