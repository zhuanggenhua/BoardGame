/**
 * 召唤师战争 - 游戏界面
 * 
 * 布局：
 * - 两边渐变黑边，地图居中
 * - 左下：玩家名+魔力条（抽牌堆上方）
 * - 右上：对手名+魔力条
 * - 右侧：回合进度
 * - 右下：结束阶段按钮
 * - 底部中央：提示横幅
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { SummonerWarsCore } from './domain';
import { SW_COMMANDS } from './domain';
import './cursor'; // Register cursor themes
import { GameDebugPanel } from '../../components/game/framework/widgets/GameDebugPanel';
import { SummonerWarsDebugConfig } from './debug-config';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import { UndoProvider } from '../../contexts/UndoContext';
import { getUndoSnapshotCount } from '../../engine/systems/UndoSystem';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { useEndgame } from '../../hooks/game/useEndgame';
import { useGameAudio, playSound } from '../../lib/audio/useGameAudio';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { BoardLayoutEditor } from '../../components/game/framework/BoardLayoutEditor';
import { TutorialSelectionGate, useMatchPlayerViewModel } from '../../components/game/framework';
import { saveSummonerWarsLayout } from '../../api/layout';
import type { BoardLayoutConfig, GridConfig } from '../../core/ui/board-layout.types';
import { SUMMONER_WARS_MANIFEST } from './manifest';
import { initSpriteAtlases, resolveCardAtlasId } from './ui/cardAtlas';
import { EnergyBar } from './ui/EnergyBar';
import { DeckPile } from './ui/DeckPile';
import { MapContainer } from './ui/MapContainer';
import { PhaseTracker } from './ui/PhaseTracker';
import { GameButton } from './ui/GameButton';
import { HandArea } from './ui/HandArea';
import { MagnifyOverlay } from '../../components/common/overlays/MagnifyOverlay';
import { DiceResultOverlay } from './ui/DiceResultOverlay';
import { DestroyEffectsLayer, useDestroyEffects } from './ui/DestroyEffect';
import { useScreenShake } from './ui/BoardEffects';
import { useFxBus, FxLayer } from '../../engine/fx';
import { useVisualSequenceGate } from '../../components/game/framework/hooks/useVisualSequenceGate';
import { summonerWarsFxRegistry, SW_FX } from './ui/fxSetup';
import type { Card, BoardUnit, BoardStructure, CellCoord, EventCard, PlayerId } from './domain/types';
import { CardSelectorOverlay } from './ui/CardSelectorOverlay';
import { DiscardPileOverlay } from './ui/DiscardPileOverlay';
import { FactionSelection } from './ui/FactionSelectionAdapter';
import type { FactionId } from './domain/types';
import { BOARD_ROWS, BOARD_COLS } from './config/board';
import { MAX_MOVES_PER_TURN, MAX_ATTACKS_PER_TURN } from './domain/helpers';
// 提取的子模块
import { CardSprite } from './ui/CardSprite';
import { getUnitSpriteConfig, getStructureSpriteConfig, getEventSpriteConfig } from './ui/spriteHelpers';
import { useGameEvents } from './ui/useGameEvents';
import type { AbilityModeState, AfterAttackAbilityModeState } from './ui/useGameEvents';
import { useCellInteraction } from './ui/useCellInteraction';
import { StatusBanners } from './ui/StatusBanners';
import { BoardGrid } from './ui/BoardGrid';
import { getCellPosition } from './ui/boardGridGeometry';
import { AbilityButtonsPanel } from './ui/AbilityButtonsPanel';
import { PathTrailEffect } from './ui/PathTrailEffect';
import {
  deriveInteractionCardsByOptionIds,
  deriveAfterAttackAbilityMode,
  deriveMindCaptureMode,
  deriveRapidFireMode,
  deriveSoulTransferMode,
  deriveSystemAbilityMode,
  findSystemCardSelectorOptionByCardId,
  getSystemAbilityUiRoute,
  getSystemCardSelectorAbilityId,
  getSystemCardSelectorTitleKey,
  isSwSimpleChoiceType,
  listSystemCardSelectorTargetCardIds,
  type SwSimpleChoiceInteraction,
} from './ui/systemInteractionAdapter';
import { useMovementTrails } from './ui/useMovementTrails';
import {
  BOARD_SHELL_REFERENCE_WIDTH,
  SUMMONER_WARS_DESKTOP_HUD_REFERENCE_WIDTH_PX,
  SUMMONER_WARS_MOBILE_BOARD_REFERENCE_WIDTH_PX,
} from './ui/layoutConstants';
import { getEventStreamEntries } from '../../engine/systems/EventStreamSystem';
import { SUMMONER_WARS_AUDIO_CONFIG, resolveDiceRollSound, resolveAttackSoundKey, resolveDamageSoundKey } from './audio.config';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import type { InteractionDescriptor, PromptOption } from '../../engine/systems/InteractionSystem';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { shouldBlockHandInteraction } from './ui/handInteractionBusy';
import { swAttackDebugLog } from './ui/attackDebug';
import { isTestEnvironment } from '../../engine/testing/environment';
import { useSummonerWarsCombatEffectPreference } from './ui/useSummonerWarsCombatEffectPreference';
import { countHits } from './config/dice';

type Props = GameBoardProps<SummonerWarsCore>;

/** 默认网格配置 */
const DEFAULT_GRID_CONFIG: GridConfig = {
  rows: BOARD_ROWS,
  cols: BOARD_COLS,
  bounds: { x: 0.038, y: 0.135, width: 0.924, height: 0.73 },
};
const MOBILE_LANDSCAPE_MAP_INITIAL_SCALE = 1.18;
const MOBILE_LANDSCAPE_MAP_PADDING = '4vw';
const DESKTOP_MAP_SIDE_RATIO = 0.1;
const SUMMONER_WARS_CARD_ASPECT_RATIO = 1044 / 729;
const DICE_RESULT_OVERLAY_DURATION_MS = 3000;

export const SummonerWarsBoard: React.FC<Props> = ({
  G, dispatch, playerID, reset, matchData, isMultiplayer, locale,
}) => {
  const isGameOver = G.sys.gameover;
  const gameMode = useGameMode();
  const isLocalMatch = gameMode ? !gameMode.isMultiplayer : !isMultiplayer;
  const isSpectator = !!gameMode?.isSpectator;
  const isTutorialMode = gameMode?.mode === 'tutorial';
  const effectiveLocale = locale || 'zh-CN';
  const { t } = useTranslation('game-summonerwars');
  const { reducedCombatEffects } = useSummonerWarsCombatEffectPreference();
  const viewport = useRuntimeViewport();
  const viewportSafeWidth = useMemo(() => {
    const safeWidth = viewport.width - viewport.safeArea.left - viewport.safeArea.right;
    return safeWidth > 0 ? safeWidth : viewport.width;
  }, [viewport.safeArea.left, viewport.safeArea.right, viewport.width]);
  const isMobileViewport = viewport.width <= 1023;
  const isLandscapeMobileViewport = isMobileViewport && viewport.width > viewport.height;
  const shouldShowLifeToggle = true;
  const shouldReduceCombatEffects = reducedCombatEffects && isMobileViewport;
  const desktopReferenceWidth = Math.min(
    SUMMONER_WARS_DESKTOP_HUD_REFERENCE_WIDTH_PX,
    viewportSafeWidth || SUMMONER_WARS_DESKTOP_HUD_REFERENCE_WIDTH_PX,
  );
  const useCompactHandLayout = isLandscapeMobileViewport || (!isMobileViewport && desktopReferenceWidth < 1100);
  const mapInitialScale = isLandscapeMobileViewport ? MOBILE_LANDSCAPE_MAP_INITIAL_SCALE : 1;
  const desktopMapPadding = `calc(${BOARD_SHELL_REFERENCE_WIDTH} * ${DESKTOP_MAP_SIDE_RATIO})`;
  const mapPaddingLeft = isLandscapeMobileViewport ? MOBILE_LANDSCAPE_MAP_PADDING : desktopMapPadding;
  const mapPaddingRight = isLandscapeMobileViewport ? MOBILE_LANDSCAPE_MAP_PADDING : desktopMapPadding;
  const mapShadeWidth = isLandscapeMobileViewport ? MOBILE_LANDSCAPE_MAP_PADDING : desktopMapPadding;
  const activeEventLabelClass = 'text-xs px-1.5 py-0.5';
  const activeEventCardStyle = { width: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.045)` };
  const activeEventNameClass = 'text-[11px] py-0.5 px-1';
  const activeEventChargeDotStyle = {
    width: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.004)`,
    height: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.004)`,
  };
  const opponentBarClass = 'absolute top-3 right-3 pointer-events-auto flex flex-col items-end gap-2';
  const playerBarClass = 'absolute left-3 bottom-3 z-20 pointer-events-auto flex flex-col items-start gap-3';
  const phaseControlsClass = isLandscapeMobileViewport
    ? 'absolute right-3 bottom-3 z-50 pointer-events-auto flex flex-col items-end gap-3'
    : 'absolute right-3 bottom-3 z-20 pointer-events-auto flex flex-col items-end gap-3';
  const phaseTrackerClass = isLandscapeMobileViewport
    ? 'bg-slate-900/46 backdrop-blur-sm px-2 py-1.5 rounded-lg border border-slate-700/20 min-w-[5.75rem] max-w-[5.75rem] pointer-events-auto'
    : 'bg-slate-900/40 backdrop-blur-sm px-3 py-3 rounded-lg border border-slate-700/20 min-w-[8rem] pointer-events-auto';
  const phaseTrackerRailClass = isLandscapeMobileViewport
    ? ''
    : 'absolute inset-y-0 right-2 z-20 flex items-center pointer-events-none';
  const phaseTrackerWrapperClass = isLandscapeMobileViewport
    ? 'absolute top-3 right-3 z-60 pointer-events-auto'
    : 'pointer-events-auto';
  const boardReferenceWidthCss = isLandscapeMobileViewport
    ? `var(--mobile-board-shell-design-width, ${SUMMONER_WARS_MOBILE_BOARD_REFERENCE_WIDTH_PX}px)`
    : !isMobileViewport
      ? `${desktopReferenceWidth}px`
      : '100vw';
  const mobileLandscapeCenteredContentWidth = `calc(100vw - (${MOBILE_LANDSCAPE_MAP_PADDING} * 2))`;
  const handReferenceWidthCss = isLandscapeMobileViewport
    ? mobileLandscapeCenteredContentWidth
    : !isMobileViewport
      ? `${desktopReferenceWidth}px`
      : '100vw';
  const boardShellStyle = {
    '--sw-board-reference-width': boardReferenceWidthCss,
    '--sw-hand-reference-width': handReferenceWidthCss,
    ...(isLandscapeMobileViewport ? { '--sw-hand-card-width-ratio': '0.145' } : {}),
  } as React.CSSProperties;

  const handAreaStyle: React.CSSProperties = {
    left: '50%',
    transform: 'translateX(-50%)',
    ...(isLandscapeMobileViewport
      ? {
          width: mobileLandscapeCenteredContentWidth,
          maxWidth: mobileLandscapeCenteredContentWidth,
        }
      : {}),
  };
  const statusBannersWrapperStyle: React.CSSProperties | undefined = isLandscapeMobileViewport
    ? {
        left: '50%',
        transform: 'translateX(-50%)',
        width: `min(${mobileLandscapeCenteredContentWidth}, 34rem)`,
        maxWidth: mobileLandscapeCenteredContentWidth,
      }
    : undefined;
  const useSafeCombatVisualFallback = isTestEnvironment() || (typeof navigator !== 'undefined' && navigator.webdriver);

  // 阵营选择状态
  const playerView = useMatchPlayerViewModel({
    core: G.core,
    playerID,
    matchData,
    getFallbackName: (pid) => pid === '0' ? t('player.default1') : t('player.default2'),
    resolvePreferredOrder: ({ core }) => core ? ['0', '1'].filter((pid) => !!core.players?.[pid as PlayerId]) : undefined,
    resolveTurnPlayerId: ({ core }) => core?.currentPlayer,
  });
  const rootPid = (playerView.selfPlayerId ?? '0') as PlayerId;
  const isInFactionSelection = !G.core.hostStarted;

  // 玩家名称映射
  const playerNames = playerView.playerNames;

  // 阵营选择回调
  const handleSelectFaction = useCallback((factionId: FactionId) => {
    dispatch(SW_COMMANDS.SELECT_FACTION, { factionId });
  }, [dispatch]);
  const handleSelectCustomDeck = useCallback((deck: import('./config/deckSerializer').SerializedCustomDeck) => {
    dispatch(SW_COMMANDS.SELECT_CUSTOM_DECK, { deckData: deck });
  }, [dispatch]);
  const handlePlayerReady = useCallback(() => {
    dispatch(SW_COMMANDS.PLAYER_READY, {});
  }, [dispatch]);
  const handlePlayerUnready = useCallback(() => {
    dispatch(SW_COMMANDS.PLAYER_UNREADY, {});
  }, [dispatch]);
  const handleHostStart = useCallback(() => {
    dispatch(SW_COMMANDS.HOST_START_GAME, {});
  }, [dispatch]);

  // 教学系统集成
  useTutorialBridge(G.sys.tutorial, dispatch);
  const {
    isActive: isTutorialActive,
    currentStep: tutorialStep,
    animationComplete: tutorialAnimationComplete,
  } = useTutorial();

  // 教程纯信息步骤时禁止地图拖拽/缩放（防止蓝色高亮框与元素脱节）
  // 有 allowedCommands 或 advanceOnEvents 的步骤需要用户与地图交互，不禁用
  const mapInteractionDisabled = isTutorialActive && !!tutorialStep
    && !tutorialStep.requireAction
    && !(tutorialStep.allowedCommands && tutorialStep.allowedCommands.length > 0)
    && !(tutorialStep.advanceOnEvents && tutorialStep.advanceOnEvents.length > 0);

  // 重赛系统（通用 hook，同时修复缺失的 registerReset）
  const { overlayProps: endgameProps } = useEndgame({
    result: isGameOver || undefined,
    playerID,
    reset,
    matchData,
    isMultiplayer,
  });

  // 初始化精灵图
  useEffect(() => { initSpriteAtlases(effectiveLocale); }, [effectiveLocale]);

  // 布局编辑器状态
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<BoardLayoutConfig | null>(null);

  const fetchLayoutConfig = useCallback(async () => {
    try {
      const response = await fetch(`/game-data/summonerwars.layout.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || typeof data !== 'object') return null;
      return data as BoardLayoutConfig;
    } catch { return null; }
  }, []);

  const handleExitLayoutEditor = useCallback(async () => {
    setIsEditingLayout(false);
    const data = await fetchLayoutConfig();
    if (data) setLayoutConfig(data);
  }, [fetchLayoutConfig]);

  useEffect(() => {
    let cancelled = false;
    const loadLayout = async () => {
      const data = await fetchLayoutConfig();
      if (!cancelled && data) setLayoutConfig(data);
    };
    loadLayout();
    return () => { cancelled = true; };
  }, [fetchLayoutConfig]);

  const currentGrid = useMemo<GridConfig>(() => layoutConfig?.grid ?? DEFAULT_GRID_CONFIG, [layoutConfig]);

  // 游戏状态
  const core = G.core;
  const currentPhase = core.phase;
  const activePlayerId = (playerView.turnPlayerId ?? core.currentPlayer) as PlayerId;
  const isMyTurn = isLocalMatch || (playerID !== null && playerID !== undefined && activePlayerId === playerID);
  const myPlayerId = isLocalMatch ? '0' : (playerID === '1' ? '1' : '0');
  const opponentPlayerId = (playerView.orderedPlayerIds.find((pid) => pid !== myPlayerId) ?? (myPlayerId === '0' ? '1' : '0')) as PlayerId;
  const isWinner = !!isGameOver && isGameOver?.winner === rootPid;
  const shouldFlipView = !isLocalMatch && !isSpectator && myPlayerId === '1';
  const toViewCoord = useCallback((coord: CellCoord): CellCoord => (
    shouldFlipView ? { row: BOARD_ROWS - 1 - coord.row, col: BOARD_COLS - 1 - coord.col } : coord
  ), [shouldFlipView]);
  const fromViewCoord = useCallback((coord: CellCoord): CellCoord => (
    shouldFlipView ? { row: BOARD_ROWS - 1 - coord.row, col: BOARD_COLS - 1 - coord.col } : coord
  ), [shouldFlipView]);

  // 稳定的 getCellPosition 回调（用于特效层，避免内联函数导致子组件重新渲染）
  const getCellPositionWithView = useCallback((row: number, col: number) => {
    const vc = shouldFlipView
      ? { row: BOARD_ROWS - 1 - row, col: BOARD_COLS - 1 - col }
      : { row, col };
    return getCellPosition(vc.row, vc.col, currentGrid);
  }, [shouldFlipView, currentGrid]);

  // 移动轨迹效果
  const eventStreamEntries = getEventStreamEntries(G);
  const { trails, removeTrail } = useMovementTrails({ entries: eventStreamEntries });

  const myMagic = core.players[myPlayerId]?.magic ?? 0;
  const opponentMagic = core.players[opponentPlayerId]?.magic ?? 0;
  const myDeckCount = core.players[myPlayerId]?.deck?.length ?? 0;
  const myDiscardCount = core.players[myPlayerId]?.discard?.length ?? 0;
  const myDiscard = core.players[myPlayerId]?.discard ?? [];
  const myHand = core.players[myPlayerId]?.hand ?? [];
  const myActiveEvents = core.players[myPlayerId]?.activeEvents ?? [];
  const opponentActiveEvents = core.players[opponentPlayerId]?.activeEvents ?? [];

  // 音效系统
  useGameAudio({
    config: SUMMONER_WARS_AUDIO_CONFIG,
    gameId: SUMMONER_WARS_MANIFEST.id,
    G: G.core,
    ctx: {
      currentPhase,
      isGameOver: !!isGameOver,
      isWinner,
    },
    meta: {
      currentPlayerId: rootPid as PlayerId,
    },
    eventEntries: G.sys.eventStream.entries,
  });

  // 卡牌放大预览状态
  const [magnifiedCard, setMagnifiedCard] = useState<{ atlasId: string; frameIndex: number } | null>(null);
  const [showDiscardOverlay, setShowDiscardOverlay] = useState(false);
  const [showBoardLifeTotals, setShowBoardLifeTotals] = useState(false);

  // 摧毁效果
  const { effects: destroyEffects, pushEffect: pushDestroyEffect, removeEffect: removeDestroyEffect } = useDestroyEffects();
  // 全屏震动
  const { shakeTargetRef, triggerShake } = useScreenShake();
  // FX 系统（替代原 useBoardEffects，注入音效/震动回调实现反馈包自动触发）
  const fxBus = useFxBus(summonerWarsFxRegistry, {
    playSound,
    triggerShake,
    quality: shouldReduceCombatEffects ? 'reduced' : 'full',
    reduceWhenHighCostActiveAt: 1,
  });

  // 视觉序列门控（攻击动画期间延迟交互事件 + 游戏结束 overlay）
  const gate = useVisualSequenceGate();

  // 远程攻击气浪完成后才 flush 摧毁效果的标记
  const waitingForShockwaveRef = useRef(false);
  // 远程攻击气浪到达目标后才播放的伤害特效
  const pendingRangedDamagesRef = useRef<Array<{ position: CellCoord; damage: number; eventId: number }>>([]);
  // 远程攻击气浪到达后是否需要震动
  const pendingRangedShakeRef = useRef(false);
  const destroyingCells = useMemo(() => {
    const next = new Set<string>();
    destroyEffects.forEach(effect => {
      next.add(`${effect.position.row}-${effect.position.col}`);
    });
    return next;
  }, [destroyEffects]);

  // 攻击动画状态
  const [attackAnimState, setAttackAnimState] = useState<{
    attacker: CellCoord; target: CellCoord; hits: number;
  } | null>(null);
  const startedAttackAnimEventIdRef = useRef<number | null>(null);

  // 事件流消费 Hook（回调函数在 hook 内部通过 ref 稳定化，无需外部包装）
  const {
    diceResult,
    dyingEntities,
    damageBuffer,
    isVisualBusy,
    pendingAttackRef, handleCloseDiceResult: rawCloseDiceResult,
    clearPendingAttack, flushPendingDestroys,
    releaseDamageSnapshot,
  } = useGameEvents({
    G, core, myPlayerId, currentPhase,
    pushDestroyEffect,
    fxBus,
    onDiceRollSound: (diceCount) => {
      playSound(resolveDiceRollSound(diceCount));
    },
    gate,
  });

  const currentInteraction = G.sys.interaction?.current as InteractionDescriptor | undefined;
  const swInteraction = useMemo(() => {
    if (!currentInteraction || currentInteraction.kind !== 'simple-choice') return null;
    if (currentInteraction.playerId !== (myPlayerId as PlayerId)) return null;
    const data = currentInteraction.data as { sw?: { type?: string }; options?: PromptOption[] };
    if (!data?.sw || typeof data.sw !== 'object') return null;
    return {
      id: currentInteraction.id,
      type: (data.sw as { type?: string }).type ?? '',
      meta: data.sw as Record<string, unknown>,
      options: (data.options ?? []) as PromptOption[],
    } satisfies SwSimpleChoiceInteraction;
  }, [currentInteraction, myPlayerId]);
  const pendingEncourage = swInteraction?.type === 'shouren_encourage'
    ? core.pendingAttackRoll
    : undefined;
  const afterAttackAbilityMode = useMemo<AfterAttackAbilityModeState | null>(() => {
    return deriveAfterAttackAbilityMode(swInteraction);
  }, [swInteraction]);
  const [interactionAbilityDraft, setInteractionAbilityDraft] = useState<{
    interactionId: string;
    selectedCardIds: string[];
  } | null>(null);

  const systemAbilityMode = useMemo<AbilityModeState | null>(
    () => deriveSystemAbilityMode(swInteraction, interactionAbilityDraft),
    [interactionAbilityDraft, swInteraction],
  );

  const setAbilityMode = useCallback((mode: AbilityModeState | null) => {
    if (systemAbilityMode?.context === 'beforeAttack') {
      if (!mode) {
        setInteractionAbilityDraft(null);
        return;
      }
      if (mode.step === 'selectCards') {
        if (!swInteraction) return;
        setInteractionAbilityDraft({
          interactionId: swInteraction.id,
          selectedCardIds: mode.selectedCardIds ?? [],
        });
      }
      return;
    }
    setInteractionAbilityDraft(null);
  }, [swInteraction, systemAbilityMode?.context]);

  const findInteractionOptionId = useCallback(
    (matcher: (option: PromptOption) => boolean): string | null => {
      if (!swInteraction) return null;
      const option = swInteraction.options.find(matcher);
      return typeof option?.id === 'string' ? option.id : null;
    },
    [swInteraction],
  );

  const respondInteractionOption = useCallback((optionId: string | null, optionIds?: string[]) => {
    if (!swInteraction) return;
    if (Array.isArray(optionIds) && optionIds.length > 0) {
      dispatch(INTERACTION_COMMANDS.RESPOND, { interactionId: swInteraction.id, optionIds });
      return;
    }
    if (!optionId) return;
    dispatch(INTERACTION_COMMANDS.RESPOND, { interactionId: swInteraction.id, optionId });
  }, [dispatch, swInteraction]);
  const findSkipInteractionOptionId = useCallback((): string | null => {
    return findInteractionOptionId((option) => {
      const value = option.value as { skip?: boolean } | undefined;
      return option.id === 'skip' || value?.skip === true;
    });
  }, [findInteractionOptionId]);
  const cancelSwInteraction = useCallback((preferSkip = true): boolean => {
    if (!swInteraction) return false;
    if (preferSkip) {
      const skipOptionId = findSkipInteractionOptionId();
      if (skipOptionId) {
        respondInteractionOption(skipOptionId);
        return true;
      }
    }
    dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
    return true;
  }, [dispatch, findSkipInteractionOptionId, respondInteractionOption, swInteraction]);

  const soulTransferMode = useMemo(() => {
    return deriveSoulTransferMode(swInteraction);
  }, [swInteraction]);

  const mindCaptureMode = useMemo(() => {
    return deriveMindCaptureMode(swInteraction);
  }, [swInteraction]);

  const effectiveRapidFireMode = useMemo(() => {
    return deriveRapidFireMode(swInteraction);
  }, [swInteraction]);

  const abilityMode = systemAbilityMode;
  const abilityUiRoute = useMemo(
    () => getSystemAbilityUiRoute(abilityMode),
    [abilityMode],
  );
  const systemCardSelectorAbilityId = getSystemCardSelectorAbilityId(abilityMode);
  const isSystemCardSelectorActive = systemCardSelectorAbilityId !== null && abilityUiRoute === 'card-selector';
  const systemAbilitySelectableCardIds = systemCardSelectorAbilityId
    ? (() => {
      const ids = listSystemCardSelectorTargetCardIds(swInteraction, systemCardSelectorAbilityId);
      return ids.length > 0 ? new Set(ids) : null;
    })()
    : null;
  const systemCardSelectorCards = useMemo(() => {
    if (!systemCardSelectorAbilityId || !systemAbilitySelectableCardIds) return [];
    const sourceCards = core.players[myPlayerId]?.discard ?? [];
    return sourceCards.filter((card) => systemAbilitySelectableCardIds.has(card.id));
  }, [core.players, myPlayerId, systemAbilitySelectableCardIds, systemCardSelectorAbilityId]);
  useEffect(() => {
    if (abilityMode?.step === 'selectCard' && abilityUiRoute !== 'card-selector') {
      console.warn('[SummonerWars] 未处理的系统能力卡牌选择器分支', {
        abilityId: abilityMode.abilityId,
        step: abilityMode.step,
        context: abilityMode.context,
        swInteractionType: swInteraction?.type ?? null,
        route: abilityUiRoute,
      });
    }
  }, [abilityMode, abilityUiRoute, swInteraction]);

  const systemInfectionCards = useMemo(() => {
    return deriveInteractionCardsByOptionIds(swInteraction, 'infection', core.players[myPlayerId]?.discard ?? []);
  }, [core.players, myPlayerId, swInteraction]);

  const systemGrabFollowMode = isSwSimpleChoiceType(swInteraction, 'grab_follow');
  const systemFeedBeastMode = isSwSimpleChoiceType(swInteraction, 'feed_beast');
  const systemMoguParasiteMode = isSwSimpleChoiceType(swInteraction, 'mogu_parasite');

  // 格子交互 Hook
  const interaction = useCellInteraction({
    core, dispatch,
    currentPhase, isMyTurn, isGameOver: !!isGameOver,
    myPlayerId, activePlayerId, myHand, fromViewCoord,
    undoSnapshotCount: getUndoSnapshotCount(G.sys?.undo),
    interaction: currentInteraction,
    abilityMode, setAbilityMode, soulTransferMode,
    mindCaptureMode,
    afterAttackAbilityMode,
    rapidFireMode: effectiveRapidFireMode,
  });

  const engineInteractionBusy = !!currentInteraction && currentInteraction.playerId === (myPlayerId as PlayerId);
  const handInteractionBusy = shouldBlockHandInteraction({
    hasAbilityMode: !!abilityMode,
    hasActiveEventMode: interaction.hasActiveEventMode,
    hasEngineInteraction: engineInteractionBusy,
    hasSwInteraction: !!swInteraction,
  });

  const startPendingAttackVisual = useCallback((reason: 'dice-reveal-complete' | 'dice-close') => {
    const pending = pendingAttackRef.current;
    if (!pending) {
      swAttackDebugLog('board_start_attack_visual_no_pending_attack', { reason });
      return;
    }
    if (startedAttackAnimEventIdRef.current === pending.attackEventId) {
      swAttackDebugLog('board_start_attack_visual_duplicate_ignored', {
        reason,
        attackEventId: pending.attackEventId,
      });
      return;
    }
    startedAttackAnimEventIdRef.current = pending.attackEventId;

    swAttackDebugLog('board_start_attack_visual_received_pending_attack', {
      reason,
      attackEventId: pending.attackEventId,
      attackType: pending.attackType,
      hits: pending.hits,
      attacker: pending.attacker,
      target: pending.target,
      damageCount: pending.damages.length,
    });

    // 未命中：直接清理并推进。
    if (pending.hits === 0) {
      swAttackDebugLog('board_attack_miss_skip_fx', {
        attackEventId: pending.attackEventId,
      });
      clearPendingAttack();
      flushPendingDestroys();
      return;
    }

    if (useSafeCombatVisualFallback && pending.pendingDestroys.length > 0) {
      swAttackDebugLog('board_skip_lethal_combat_visuals_in_test_env', {
        attackEventId: pending.attackEventId,
        attackType: pending.attackType,
        pendingDestroyCount: pending.pendingDestroys.length,
        damageCount: pending.damages.length,
      });
      const impactPositions = pending.damages.map(d => d.position);
      if (impactPositions.length > 0) {
        releaseDamageSnapshot(impactPositions);
      }
      clearPendingAttack();
      flushPendingDestroys();
      setAttackAnimState(null);
      return;
    }

    if (pending.attackType === 'ranged') {
      // 远程攻击：骰子结束后稍作延迟再播放气浪特效
      // 注意：不在此处 clearPendingAttack，确保 180ms 内到达的 UNIT_DESTROYED 事件仍能排队
      const attackSnapshot = { ...pending };
      swAttackDebugLog('board_schedule_ranged_shockwave', {
        attackEventId: attackSnapshot.attackEventId,
        delayMs: 180,
        damageCount: attackSnapshot.damages.length,
      });
      window.setTimeout(() => {
        clearPendingAttack();
        const hitIntensity = attackSnapshot.hits >= 3 ? 'strong' : 'normal';
        const reducedHitIntensity = shouldReduceCombatEffects ? 'normal' : hitIntensity;
        const attackSoundKey = resolveAttackSoundKey(attackSnapshot.attackType, core, attackSnapshot.attacker);
        // 只 push 气浪，伤害特效等气浪到达目标后再播放
        waitingForShockwaveRef.current = true;
        pendingRangedDamagesRef.current = [...attackSnapshot.damages];
        pendingRangedShakeRef.current = attackSnapshot.hits >= 3;
        // 远程攻击音 + 震动：由 COMBAT_SHOCKWAVE 的 FeedbackPack 自动处理
        swAttackDebugLog('board_push_ranged_shockwave', {
          attackEventId: attackSnapshot.attackEventId,
          attackType: attackSnapshot.attackType,
          hitIntensity: reducedHitIntensity,
          pendingRangedDamageCount: pendingRangedDamagesRef.current.length,
          attacker: attackSnapshot.attacker,
          target: attackSnapshot.target,
        });
        fxBus.push(SW_FX.COMBAT_SHOCKWAVE, { cell: attackSnapshot.target, intensity: reducedHitIntensity }, { attackType: attackSnapshot.attackType, source: attackSnapshot.attacker, soundKey: attackSoundKey, quality: shouldReduceCombatEffects ? 'reduced' : 'full' });
        // 伤害特效和 flushPendingDestroys 由 handleFxComplete 在气浪完成时触发
      }, 180);
    } else {
      // 近战攻击：立即启动卡牌本体碰撞动画。
      swAttackDebugLog('board_start_melee_attack_anim', {
        attackEventId: pending.attackEventId,
        attacker: pending.attacker,
        target: pending.target,
        hits: pending.hits,
      });
      setAttackAnimState({ attacker: pending.attacker, target: pending.target, hits: pending.hits });
    }
  }, [clearPendingAttack, core, flushPendingDestroys, fxBus, pendingAttackRef, releaseDamageSnapshot, shouldReduceCombatEffects, useSafeCombatVisualFallback]);

  // 关闭骰子结果只负责关闭浮层；攻击动画由骰子揭示完成独立触发，关闭时兜底触发一次。
  const handleCloseDiceResult = () => {
    startPendingAttackVisual('dice-close');
    rawCloseDiceResult();
  };

  // 近战攻击命中回调（卡牌冲到目标时触发，播放伤害特效）
  const handleAttackHit = () => {
    const pending = pendingAttackRef.current;
    if (!pending) return;
    swAttackDebugLog('board_melee_attack_hit', {
      attackEventId: pending.attackEventId,
      damageCount: pending.damages.length,
      hits: pending.hits,
    });

    // 释放视觉快照：impact 瞬间让血条变化
    const impactPositions = pending.damages.map(d => d.position);
    if (impactPositions.length > 0) {
      releaseDamageSnapshot(impactPositions);
    }

    const hitIntensity = shouldReduceCombatEffects ? 'normal' : pending.hits >= 3 ? 'strong' : 'normal';
    // 近战攻击音 + 震动：由 COMBAT_SHOCKWAVE 的 FeedbackPack 自动处理
    const attackSoundKey = resolveAttackSoundKey(pending.attackType, core, pending.attacker);
    swAttackDebugLog('board_push_melee_shockwave', {
      attackEventId: pending.attackEventId,
      hitIntensity,
      attacker: pending.attacker,
      target: pending.target,
    });
    if (!shouldReduceCombatEffects) {
      fxBus.push(SW_FX.COMBAT_SHOCKWAVE, { cell: pending.target, intensity: hitIntensity }, { attackType: pending.attackType, source: pending.attacker, soundKey: attackSoundKey });
    } else {
      playSound(attackSoundKey);
    }
    for (const dmg of pending.damages) {
      // 受伤音：由 COMBAT_DAMAGE 的 FeedbackPack 自动处理
      const damageSoundKey = resolveDamageSoundKey(dmg.damage);
      fxBus.push(SW_FX.COMBAT_DAMAGE, { cell: dmg.position, intensity: shouldReduceCombatEffects ? 'normal' : dmg.damage >= 3 ? 'strong' : 'normal' }, { damageAmount: dmg.damage, soundKey: damageSoundKey, suppressShake: true, reduced: shouldReduceCombatEffects });
    }
  };

  // 近战攻击回弹完成回调（卡牌回到原位后触发，flush 摧毁效果）
  const handleAttackReturn = () => {
    swAttackDebugLog('board_melee_attack_return', {
      attackEventId: pendingAttackRef.current?.attackEventId,
    });
    clearPendingAttack();
    flushPendingDestroys();
    setAttackAnimState(null);
    startedAttackAnimEventIdRef.current = null;
  };

  // FX 特效完成回调：远程气浪到达目标时播放伤害特效 + flush 摧毁
  const handleFxComplete = useCallback((id: string, cue: string) => {
    swAttackDebugLog('board_fx_complete', {
      fxId: id,
      cue,
      waitingForShockwave: waitingForShockwaveRef.current,
      pendingRangedDamageCount: pendingRangedDamagesRef.current.length,
    });
    if (waitingForShockwaveRef.current && cue === SW_FX.COMBAT_SHOCKWAVE) {
      waitingForShockwaveRef.current = false;

      // 释放视觉快照：气浪到达目标，让血条变化
      const impactPositions = pendingRangedDamagesRef.current.map(d => d.position);
      if (impactPositions.length > 0) {
        releaseDamageSnapshot(impactPositions);
      }

      // 气浪到达目标：播放伤害特效（音效 + 震动由 FeedbackPack 自动处理）
      for (const dmg of pendingRangedDamagesRef.current) {
        const damageSoundKey = resolveDamageSoundKey(dmg.damage);
        fxBus.push(SW_FX.COMBAT_DAMAGE, { cell: dmg.position, intensity: shouldReduceCombatEffects ? 'normal' : dmg.damage >= 3 ? 'strong' : 'normal' }, { damageAmount: dmg.damage, soundKey: damageSoundKey, suppressShake: true, reduced: shouldReduceCombatEffects });
      }
      swAttackDebugLog('board_ranged_shockwave_resolved', {
        fxId: id,
        replayedDamageCount: pendingRangedDamagesRef.current.length,
      });
      pendingRangedDamagesRef.current = [];
      pendingRangedShakeRef.current = false;
      flushPendingDestroys();
    }
    // 召唤/攻击动画完成时，通知教程系统。
    // 这里不依赖当前渲染帧里的 pending 标志，避免动画完成得太快时漏发推进信号。
    if (cue === SW_FX.SUMMON || cue === SW_FX.COMBAT_SHOCKWAVE) {
      tutorialAnimationComplete();
    }
  }, [flushPendingDestroys, fxBus, releaseDamageSnapshot, shouldReduceCombatEffects, tutorialAnimationComplete]);

  // 卡牌放大
  const handleMagnifyCard = useCallback((card: Card) => {
    const spriteIndex = 'spriteIndex' in card ? card.spriteIndex : undefined;
    const spriteAtlas = 'spriteAtlas' in card ? card.spriteAtlas : undefined;
    if (spriteIndex === undefined) return;
    // 传送门使用全局共用图集
    if (spriteAtlas === 'portal') {
      setMagnifiedCard({ atlasId: 'sw:portal', frameIndex: spriteIndex });
      return;
    }
    const atlasType = (spriteAtlas ?? 'cards') as 'hero' | 'cards';
    const atlasId = resolveCardAtlasId(card as { id: string; faction?: string }, atlasType);
    setMagnifiedCard({ atlasId, frameIndex: spriteIndex });
  }, []);
  const handleMagnifyBoardUnit = useCallback((unit: BoardUnit) => {
    setMagnifiedCard(getUnitSpriteConfig(unit));
  }, []);
  const handleMagnifyBoardStructure = useCallback((structure: BoardStructure) => {
    setMagnifiedCard(getStructureSpriteConfig(structure));
  }, []);
  const handleMagnifyEventCard = useCallback((card: EventCard) => {
    setMagnifiedCard(getEventSpriteConfig(card));
  }, []);
  const handleMagnifySpriteConfig = useCallback((config: { atlasId: string; frameIndex: number }) => {
    setMagnifiedCard(config);
  }, []);

  // StatusBanners 回调
  const handleCancelAbility = useCallback(() => {
    if (abilityMode) {
      cancelSwInteraction(true);
      return;
    }
    if (swInteraction && ['after_attack_mind_transmission', 'fire_sacrifice_summon'].includes(swInteraction.type)) {
      cancelSwInteraction(true);
      return;
    }
    setAbilityMode(null);
  }, [abilityMode, cancelSwInteraction, setAbilityMode, swInteraction]);
  const handleCancelBeforeAttack = useCallback(() => interaction.handleCancelBeforeAttack(), [interaction]);
  const handleCancelBloodSummon = useCallback(() => {
    if (swInteraction?.type?.startsWith('blood_summon')) {
      if (swInteraction.type === 'blood_summon_confirm') {
        const optionId = findInteractionOptionId((option) => {
          const value = option.value as { action?: string } | undefined;
          return value?.action === 'blood_summon_finish';
        });
        respondInteractionOption(optionId);
      } else {
        dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      }
      return;
    }
  }, [dispatch, findInteractionOptionId, interaction, respondInteractionOption, swInteraction]);
  const handleContinueBloodSummon = useCallback(() => {
    if (swInteraction?.type === 'blood_summon_confirm') {
      const optionId = findInteractionOptionId((option) => {
        const value = option.value as { action?: string } | undefined;
        return value?.action === 'blood_summon_continue';
      });
      respondInteractionOption(optionId);
    }
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);
  const handleCancelAnnihilate = useCallback(() => {
    if (swInteraction?.type === 'annihilate_select_targets' || swInteraction?.type === 'annihilate_select_damage') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
  }, [dispatch, interaction, swInteraction]);
  const handleConfirmAnnihilateTargets = useCallback(() => {
    if (!interaction.annihilateMode || interaction.annihilateMode.selectedTargets.length === 0) return;
    if (swInteraction?.type === 'annihilate_select_targets') {
      const optionIds = interaction.annihilateMode.selectedTargets
        .map((pos) => findInteractionOptionId((option) => {
          const value = option.value as { action?: string; targetPosition?: CellCoord } | undefined;
          return value?.action === 'annihilate_target'
            && value.targetPosition?.row === pos.row
            && value.targetPosition?.col === pos.col;
        }))
        .filter((id): id is string => !!id);
      if (optionIds.length !== interaction.annihilateMode.selectedTargets.length) return;
      respondInteractionOption(null, optionIds);
    }
  }, [findInteractionOptionId, interaction, respondInteractionOption, swInteraction]);
  // 除灭：跳过当前目标的伤害分配（描述中"你可以"表示可选）
  const handleSkipAnnihilateDamage = useCallback(() => {
    if (swInteraction?.type === 'annihilate_select_damage') {
      const optionId = findInteractionOptionId((option) => {
        const value = option.value as { action?: string; skip?: boolean } | undefined;
        return value?.action === 'annihilate_damage_skip' || value?.skip === true;
      });
      respondInteractionOption(optionId);
    }
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);
  const handleConfirmSoulTransfer = useCallback(() => {
    if (!soulTransferMode) return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string } | undefined;
      return value?.action === 'soul_transfer';
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, soulTransferMode]);
  const handleSkipSoulTransfer = useCallback(() => {
    if (!soulTransferMode) return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { skip?: boolean } | undefined;
      return value?.skip === true;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, soulTransferMode]);
  const handleSkipFuneralPyre = useCallback(() => {
    if (swInteraction?.type === 'funeral_pyre') {
      const optionId = findInteractionOptionId((option) => {
        const value = option.value as { action?: string; skip?: boolean } | undefined;
        return value?.action === 'funeral_pyre_skip' || value?.skip === true;
      });
      respondInteractionOption(optionId);
      return;
    }
  }, [dispatch, findInteractionOptionId, interaction, respondInteractionOption, swInteraction]);

  // 欺心巫族事件卡回调
  const handleConfirmMindControl = useCallback(() => interaction.handleConfirmMindControl(), [interaction]);
  const handleCancelMindControl = useCallback(() => {
    if (swInteraction?.type === 'mind_control_select_targets') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
  }, [dispatch, interaction, swInteraction]);
  const handleConfirmEntanglement = useCallback(() => interaction.handleConfirmEntanglement(), [interaction]);
  const handleCancelEntanglement = useCallback(() => {
    if (swInteraction?.type === 'chant_entanglement_select_targets') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
  }, [dispatch, interaction, swInteraction]);
  const handleConfirmSneak = useCallback(() => interaction.handleConfirmSneak(), [interaction]);
  const handleCancelSneak = useCallback(() => {
    if (swInteraction?.type === 'sneak_select_unit' || swInteraction?.type === 'sneak_select_direction') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
  }, [dispatch, interaction, swInteraction]);
  const handleConfirmGlacialShift = useCallback(() => interaction.handleConfirmGlacialShift(), [interaction]);
  const handleCancelGlacialShift = useCallback(() => {
    if (swInteraction?.type === 'glacial_shift_select_building' || swInteraction?.type === 'glacial_shift_select_destination') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
  }, [dispatch, interaction, swInteraction]);
  const handleWithdrawCostSelect = useCallback((costType: 'charge' | 'magic') => {
    if (!interaction.withdrawMode) return;
    if (swInteraction?.type === 'after_attack_withdraw_cost') {
      const optionId = findInteractionOptionId((option) => {
        const value = option.value as { action?: string; costType?: 'charge' | 'magic' } | undefined;
        return value?.action === 'after_attack_withdraw_cost' && value.costType === costType;
      });
      if (!optionId) return;
      respondInteractionOption(optionId);
    }
  }, [findInteractionOptionId, interaction, respondInteractionOption, swInteraction]);
  const handleCancelWithdraw = useCallback(() => {
    if (swInteraction?.type === 'after_attack_withdraw_cost' || swInteraction?.type === 'after_attack_withdraw_position') {
      cancelSwInteraction(true);
    }
  }, [cancelSwInteraction, swInteraction]);
  const handleCancelStun = useCallback(() => {
    if (swInteraction?.type === 'stun_select_target' || swInteraction?.type === 'stun_select_destination') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
  }, [dispatch, interaction, swInteraction]);
  const handleCancelHypnoticLure = useCallback(() => {
    if (swInteraction?.type === 'hypnotic_lure_select_target') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
  }, [dispatch, interaction, swInteraction]);

  // 心灵捕获 + 攻击后技能回调
  const handleConfirmMindCapture = useCallback((choice: 'control' | 'damage') => {
    if (!mindCaptureMode) return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return value?.action === 'mind_capture' && value.choice === choice;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, mindCaptureMode, respondInteractionOption]);
  const handleCancelAfterAttackAbility = useCallback(() => {
    if (afterAttackAbilityMode || effectiveRapidFireMode) {
      cancelSwInteraction(true);
    }
  }, [afterAttackAbilityMode, cancelSwInteraction, effectiveRapidFireMode]);

  // 连续射击确认/取消
  const handleConfirmRapidFire = useCallback(() => {
    if (!effectiveRapidFireMode) return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; skip?: boolean } | undefined;
      return value?.action === 'after_attack_rapid_fire' && value.skip !== true;
    });
    respondInteractionOption(optionId);
  }, [effectiveRapidFireMode, findInteractionOptionId, respondInteractionOption]);
  const handleCancelRapidFire = useCallback(() => {
    if (effectiveRapidFireMode) {
      cancelSwInteraction(true);
    }
  }, [cancelSwInteraction, effectiveRapidFireMode]);
  // 鲜血符文选择回调
  const handleConfirmBloodRune = useCallback((choice: 'damage' | 'charge') => {
    if (abilityMode?.abilityId !== 'blood_rune') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return value?.action === 'on_phase_start_blood_rune' && value.choice === choice;
    });
    respondInteractionOption(optionId);
    setAbilityMode(null);
  }, [abilityMode?.abilityId, findInteractionOptionId, respondInteractionOption, setAbilityMode]);
  const handleSkipGrabFollow = useCallback(() => {
    if (!systemGrabFollowMode) return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { skip?: boolean } | undefined;
      return option.id === 'skip' || value?.skip === true;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, systemGrabFollowMode]);
  // 喂养巨食兽自毁回调
  const handleConfirmFeedBeastSelfDestroy = useCallback(() => {
    if (!systemFeedBeastMode) return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return value?.action === 'feed_beast' && value.choice === 'self_destroy';
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, systemFeedBeastMode]);
  const handleConfirmMoguParasite = useCallback((choice: 'consume_charge' | 'take_damage') => {
    if (!systemMoguParasiteMode) return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return value?.action === 'mogu_parasite' && value.choice === choice;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, systemMoguParasiteMode]);
  const handleSelectInfectionCard = useCallback((card: Card) => {
    if (!systemInfectionCards) return;
    respondInteractionOption(card.id);
  }, [respondInteractionOption, systemInfectionCards]);
  const handleSkipInfection = useCallback(() => {
    if (!systemInfectionCards) return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { skip?: boolean } | undefined;
      return option.id === 'skip' || value?.skip === true;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, systemInfectionCards]);
  const handleCancelTelekinesis = useCallback(() => {
    if (interaction.telekinesisTargetMode || swInteraction?.type === 'after_attack_telekinesis_target') {
      cancelSwInteraction(true);
    }
  }, [cancelSwInteraction, interaction.telekinesisTargetMode, swInteraction?.type]);
  // afterMove 技能：充能自身
  const handleAfterMoveSelfCharge = useCallback(() => {
    if (abilityMode?.abilityId !== 'spirit_bond' && abilityMode?.abilityId !== 'frost_axe') {
      return;
    }
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return (value?.action === 'after_move_spirit_bond' || value?.action === 'after_move_frost_axe')
        && value.choice === 'self';
    });
    respondInteractionOption(optionId);
    setAbilityMode(null);
  }, [abilityMode?.abilityId, findInteractionOptionId, respondInteractionOption, setAbilityMode]);
  const handleSaveLayout = useCallback(async (config: BoardLayoutConfig) => saveSummonerWarsLayout(config), []);

  const debugPanel = !isSpectator ? (
    <GameDebugPanel
      G={G}
      dispatch={dispatch}
      playerID={playerID}
      autoSwitch={!isMultiplayer}
      aiSupport={SUMMONER_WARS_MANIFEST.ai}
      playerOptions={SUMMONER_WARS_MANIFEST.playerOptions}
    >
      <SummonerWarsDebugConfig G={G} dispatch={dispatch} />
      <button
        onClick={() => { if (isEditingLayout) { void handleExitLayoutEditor(); return; } setIsEditingLayout(true); }}
        className="px-2 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-500"
      >
        {isEditingLayout ? t('layoutEditor.exitEdit') : t('layoutEditor.editLayout')}
      </button>
    </GameDebugPanel>
  ) : null;

  const phaseControlsNode = (
    <div className="pointer-events-auto flex flex-col items-end gap-3">
      <div className="flex gap-2">
        {currentPhase === 'magic' && isMyTurn && interaction.selectedCardsForDiscard.length > 0 && (
          <GameButton onClick={interaction.handleConfirmDiscard} variant="secondary" size="sm" data-testid="sw-confirm-discard">
            {t('action.discardSelected', { count: interaction.selectedCardsForDiscard.length })}
          </GameButton>
        )}
        <GameButton onClick={interaction.handleEndPhase} disabled={!isMyTurn || interaction.isMandatoryAbilityActive || interaction.isPhaseAdvanceLocked} variant={interaction.endPhaseConfirmPending ? 'danger' : 'primary'} size="md" data-testid="sw-end-phase" data-tutorial-id="sw-end-phase-btn">
          {interaction.endPhaseConfirmPending
            ? t(currentPhase === 'move' ? 'action.confirmEndMove' : 'action.confirmEndAttack', {
              count: currentPhase === 'move'
                ? MAX_MOVES_PER_TURN - (core.players[myPlayerId]?.moveCount ?? 0)
                : MAX_ATTACKS_PER_TURN - (core.players[myPlayerId]?.attackCount ?? 0),
            })
            : t('action.endPhase')}
        </GameButton>
      </div>
      <div data-tutorial-id="sw-discard-pile">
        <DeckPile
          type="discard" count={myDiscardCount} position="right"
          topCard={myDiscard[myDiscard.length - 1] ?? null}
          onClick={() => setShowDiscardOverlay(true)} testId="sw-deck-discard"
        />
      </div>
    </div>
  );

  const phaseTrackerNode = (
    <PhaseTracker
      currentPhase={currentPhase}
      turnNumber={core.turnNumber}
      isMyTurn={isMyTurn}
      moveCount={core.players[playerID === '1' ? '1' : '0']?.moveCount ?? 0}
      attackCount={core.players[playerID === '1' ? '1' : '0']?.attackCount ?? 0}
      compact={isLandscapeMobileViewport}
      className={phaseTrackerClass}
    />
  );

  return (
    <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: isLocalMatch }}>
      <div
        className="relative h-full w-full"
        data-game-page
        data-game-id="summonerwars"
        data-mobile-profile={SUMMONER_WARS_MANIFEST.mobileProfile}
        data-mobile-layout-preset={SUMMONER_WARS_MANIFEST.mobileLayoutPreset}
        data-preferred-orientation={SUMMONER_WARS_MANIFEST.preferredOrientation}
        style={boardShellStyle}
      >
        <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-neutral-900">
          {/* 阵营选择阶段 */}
          {isInFactionSelection ? (
            <TutorialSelectionGate
              isTutorialMode={isTutorialMode}
              isTutorialActive={isTutorialActive}
              containerClassName="bg-neutral-900"
              textClassName="text-lg"
            >
              <>
                <FactionSelection
                  isOpen={true}
                  currentPlayerId={rootPid}
                  hostPlayerId={G.core.hostPlayerId}
                  selectedFactions={G.core.selectedFactions}
                  readyPlayers={G.core.readyPlayers ?? {}}
                  playerNames={playerNames as Record<PlayerId, string>}
                  customDeckData={G.core.customDeckData}
                  onSelect={handleSelectFaction}
                  onSelectCustomDeck={handleSelectCustomDeck}
                  onReady={handlePlayerReady}
                  onUnready={handlePlayerUnready}
                  onStart={handleHostStart}
                />
                {debugPanel}
              </>
            </TutorialSelectionGate>
          ) : isEditingLayout ? (
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-2 flex items-center gap-2">
                <button onClick={handleExitLayoutEditor} className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600">{t('layoutEditor.backToGame')}</button>
              </div>
              <BoardLayoutEditor
                initialConfig={layoutConfig ?? undefined}
                backgroundImage="/assets/summonerwars/common/map.png"
                onChange={setLayoutConfig}
                onSave={handleSaveLayout}
                saveLabel={t('layoutEditor.saveLayout')}
              />
            </div>
          ) : (
            <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className="relative h-full overflow-hidden">
                  {/* 地图层 */}
                  <div ref={shakeTargetRef} className="absolute inset-0 z-10 flex items-center justify-center" data-testid="sw-map-layer" data-tutorial-id="sw-map-area">
                <MapContainer
                  className="w-full h-full flex items-center justify-center"
                  style={{ paddingLeft: mapPaddingLeft, paddingRight: mapPaddingRight }}
                  initialScale={mapInitialScale}
                  dragBoundsPaddingRatioY={0.3}
                  interactionDisabled={mapInteractionDisabled}
                  containerTestId="sw-map-container"
                  contentTestId="sw-map-content"
                  scaleTestId="sw-map-scale"
                  scaleBadgeAddon={shouldShowLifeToggle ? (
                    <button
                      type="button"
                      data-testid="sw-life-toggle"
                      data-tutorial-id="sw-life-toggle"
                      aria-label={t(showBoardLifeTotals ? 'ui.hideAllLifeTotals' : 'ui.showAllLifeTotals')}
                      aria-pressed={showBoardLifeTotals}
                      title={t(showBoardLifeTotals ? 'ui.hideAllLifeTotals' : 'ui.showAllLifeTotals')}
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setShowBoardLifeTotals((value) => !value);
                      }}
                      className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border text-white shadow-lg transition-[background-color,border-color,box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-amber-200/80 ${
                        showBoardLifeTotals
                          ? 'border-amber-300/70 bg-amber-500/80 shadow-[0_0_14px_rgba(245,158,11,0.45)]'
                          : 'border-white/20 bg-black/70 hover:border-amber-300/60 hover:bg-slate-800/90'
                      }`}
                    >
                      <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </button>
                  ) : undefined}
                >
                  <div className="relative inline-block">
                    <div className="relative">
                      <OptimizedImage
                        src="summonerwars/common/map.png"
                        alt={t('ui.mapAlt')}
                        className="block w-auto h-auto max-w-none pointer-events-none select-none"
                        draggable={false}
                      />
                      {/* 网格 + 卡牌层 */}
                      <BoardGrid
                        core={core}
                        currentGrid={currentGrid}
                        myPlayerId={myPlayerId}
                        shouldFlipView={shouldFlipView}
                        selectedHandCardId={interaction.selectedHandCardId}
                        validSummonPositions={interaction.validSummonPositions}
                        validBuildPositions={interaction.validBuildPositions}
                        validMovePositions={interaction.validMovePositions}
                        validAttackPositions={interaction.validAttackPositions}
                        validEventTargets={interaction.validEventTargets}
                        validAbilityPositions={interaction.validAbilityPositions}
                        validAbilityUnits={interaction.validAbilityUnits}
                        actionableUnitPositions={interaction.actionableUnitPositions}
                        abilityReadyPositions={interaction.abilityReadyPositions}
                        bloodSummonHighlights={interaction.bloodSummonHighlights}
                        annihilateHighlights={interaction.annihilateHighlights}
                        annihilateMode={interaction.annihilateMode}
                        mindControlHighlights={interaction.mindControlHighlights}
                        mindControlSelectedTargets={interaction.mindControlMode?.selectedTargets ?? []}
                        entanglementHighlights={interaction.entanglementHighlights}
                        entanglementSelectedTargets={interaction.chantEntanglementMode?.selectedTargets ?? []}
                        moguSymbioticSelfHealingHighlights={interaction.moguSymbioticSelfHealingHighlights}
                        moguSymbioticSelfHealingSelectedTargets={interaction.moguSymbioticSelfHealingMode?.selectedTargets ?? []}
                        moguReleaseSporesHighlights={interaction.moguReleaseSporesHighlights}
                        moguReleaseSporesSelectedTargets={interaction.moguReleaseSporesMode?.selectedTargets ?? []}
                        sneakHighlights={interaction.sneakHighlights}
                        glacialShiftHighlights={interaction.glacialShiftHighlights}
                        withdrawHighlights={interaction.withdrawHighlights}
                        stunHighlights={interaction.stunHighlights}
                        hypnoticLureHighlights={interaction.hypnoticLureHighlights}
                        afterAttackAbilityHighlights={interaction.afterAttackAbilityHighlights}
                        telekinesisHighlights={interaction.telekinesisHighlights}
                        attackAnimState={attackAnimState}
                        reducedCombatEffects={shouldReduceCombatEffects}
                        destroyingCells={destroyingCells}
                        dyingEntities={dyingEntities}
                        damageBuffer={damageBuffer}
                        showLifeTotals={shouldShowLifeToggle && showBoardLifeTotals}
                        onCellClick={interaction.handleCellClick}
                        onAttackHit={handleAttackHit}
                        onAttackReturn={handleAttackReturn}
                        onMagnifyUnit={handleMagnifyBoardUnit}
                        onMagnifyStructure={handleMagnifyBoardStructure}
                        onMagnifyEventCard={handleMagnifyEventCard}
                        onMagnifySpriteConfig={handleMagnifySpriteConfig}
                      />
                      {/* 移动轨迹效果层 */}
                      {trails.map((trail) => (
                        <PathTrailEffect
                          key={trail.id}
                          path={trail.path}
                          grid={currentGrid}
                          toViewCoord={toViewCoord}
                          onComplete={() => removeTrail(trail.id)}
                        />
                      ))}
                      {/* 摧毁效果层 */}
                      <DestroyEffectsLayer
                        effects={destroyEffects}
                        getCellPosition={getCellPositionWithView}
                        quality={shouldReduceCombatEffects ? 'reduced' : 'full'}
                        onEffectComplete={removeDestroyEffect}
                      />
                      {/* 召唤暗角已内置于 SummonShaderEffect（dimStrength），此处不再需要 CSS 遮罩 */}
                      {/* FX 特效层 */}
                      <FxLayer
                        bus={fxBus}
                        getCellPosition={getCellPositionWithView}
                        onEffectComplete={handleFxComplete}
                      />
                    </div>
                  </div>
                </MapContainer>
                  </div>

                  {/* UI 层 */}
                  <div className="absolute inset-0 z-20 pointer-events-none">
                {/* 左侧黑边渐变 */}
                <div className="absolute inset-y-0 left-0" style={{ width: mapShadeWidth, background: 'linear-gradient(to right, rgba(0,0,0,0.95), rgba(0,0,0,0.75), rgba(0,0,0,0))' }} />
                {/* 右侧黑边渐变 */}
                <div className="absolute inset-y-0 right-0" style={{ width: mapShadeWidth, background: 'linear-gradient(to left, rgba(0,0,0,0.95), rgba(0,0,0,0.75), rgba(0,0,0,0))' }} />

                {/* 全局暗角 (Vignette) 效果 */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: isLandscapeMobileViewport
                      ? 'radial-gradient(circle at center, transparent 42%, rgba(0,0,0,0.14) 82%, rgba(0,0,0,0.24) 100%)'
                      : 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0.5) 100%)',
                    mixBlendMode: isLandscapeMobileViewport ? undefined : 'multiply'
                  }}
                />

                {/* 右上：对手名+魔力条 + 持续效果 */}
                <div className={opponentBarClass} data-testid="sw-opponent-bar">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-600/20 bg-black/60 px-3 py-2">
                    <span className="max-w-[9rem] truncate text-sm font-medium text-white text-opacity-100">
                      {playerView.getPlayerName(opponentPlayerId)}
                    </span>
                    <EnergyBar current={opponentMagic} testId="sw-energy-opponent" size="normal" />
                  </div>

                  {/* 对手持续效果 - 紧贴魔力条下方，竖直向下排列 */}
                  {opponentActiveEvents.length > 0 && (
                    <div className="flex flex-col items-end gap-1.5" data-testid="sw-opponent-active-events">
                      <span className={`${activeEventLabelClass} text-amber-400/70 font-bold tracking-tight bg-black/40 rounded border border-amber-900/30 backdrop-blur-[2px]`}>{t('ui.activeEvents')}</span>
                      {opponentActiveEvents.map((ev) => {
                        const sprite = getEventSpriteConfig(ev);
                        const charges = ev.charges ?? 0;
                        return (
                          <div key={ev.id} className="relative cursor-pointer group" onClick={() => handleMagnifyCard(ev)}>
                            <CardSprite atlasId={sprite.atlasId} frameIndex={sprite.frameIndex} className="rounded shadow-lg border border-amber-500/40 hover:border-amber-400 transition-all hover:scale-105" style={activeEventCardStyle} />
                            <div className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/20 transition-colors" />
                            <div className={`absolute bottom-0 left-0 right-0 bg-black/80 text-amber-200 text-center rounded-b truncate border-t border-amber-500/20 ${activeEventNameClass}`}>{ev.name}</div>
                            {/* 充能标记 - 右上角 */}
                            {charges > 0 && (() => {
                              const rows: number[][] = [];
                              for (let i = 0; i < charges; i += 5) {
                                rows.push(Array.from({ length: Math.min(5, charges - i) }, (_, j) => i + j));
                              }
                              return (
                                <div className="absolute top-[3%] right-[3%] items-end flex flex-col gap-[2%] pointer-events-none z-10">
                                  {rows.map((r, ri) => (
                                    <div key={ri} className="flex gap-[3%]">
                                      {r.map(idx => (
                                        <div key={idx} className="rounded-full bg-blue-400 border border-blue-200 shadow-[0_0_4px_rgba(96,165,250,0.9)]" style={activeEventChargeDotStyle} />
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 左下区域：玩家名+魔力条 + 持续效果 + 抽牌堆 */}
                <div className={playerBarClass} data-testid="sw-player-bar" data-tutorial-id="sw-player-bar">
                  {/* 玩家持续效果 - 放在魔力条上方，竖直向上排列 */}
                  {myActiveEvents.length > 0 && (
                    <div className="flex flex-col-reverse items-start gap-1.5 mb-1" data-testid="sw-my-active-events">
                      <span className={`${activeEventLabelClass} text-amber-400/70 font-bold tracking-tight bg-black/40 rounded border border-amber-900/30 backdrop-blur-[2px]`}>{t('ui.activeEvents')}</span>
                      {myActiveEvents.map((ev) => {
                        const sprite = getEventSpriteConfig(ev);
                        const charges = ev.charges ?? 0;
                        return (
                          <div key={ev.id} className="relative cursor-pointer group" onClick={() => handleMagnifyCard(ev)}>
                            <CardSprite atlasId={sprite.atlasId} frameIndex={sprite.frameIndex} className="rounded shadow-lg border border-amber-500/40 hover:border-amber-400 transition-all hover:scale-105" style={activeEventCardStyle} />
                            <div className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/20 transition-colors" />
                            <div className={`absolute bottom-0 left-0 right-0 bg-black/80 text-amber-200 text-center rounded-b truncate border-t border-amber-500/20 ${activeEventNameClass}`}>{ev.name}</div>
                            {/* 充能标记 - 右上角 */}
                            {charges > 0 && (() => {
                              const rows: number[][] = [];
                              for (let i = 0; i < charges; i += 5) {
                                rows.push(Array.from({ length: Math.min(5, charges - i) }, (_, j) => i + j));
                              }
                              return (
                                <div className="absolute top-[3%] right-[3%] items-end flex flex-col gap-[2%] pointer-events-none z-10">
                                  {rows.map((r, ri) => (
                                    <div key={ri} className="flex gap-[3%]">
                                      {r.map(idx => (
                                        <div key={idx} className="rounded-full bg-blue-400 border border-blue-200 shadow-[0_0_4px_rgba(96,165,250,0.9)]" style={activeEventChargeDotStyle} />
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-3 rounded-lg border border-slate-600/20 bg-black/60 px-3 py-2">
                    <span className="max-w-[9rem] truncate text-sm font-medium text-white text-opacity-100">
                      {playerView.getPlayerName(myPlayerId)}
                    </span>
                    <EnergyBar current={myMagic} testId="sw-energy-player" size="normal" />
                  </div>
                  <div data-tutorial-id="sw-deck-draw" className="mt-8">
                    <DeckPile type="draw" count={myDeckCount} position="left" testId="sw-deck-draw" />
                  </div>
                </div>

                {/* 右下区域：结束阶段按钮 + 弃牌堆 */}
                <div className={phaseControlsClass} data-testid="sw-phase-controls">
                  {phaseControlsNode}
                </div>

                {/* 右侧：阶段指示器（桌面端独立右侧中线 rail，不再和对手/底部 HUD 共用经验值定位） */}
                <div className={phaseTrackerRailClass}>
                  <div className={phaseTrackerWrapperClass} data-testid="sw-phase-tracker" data-tutorial-id="sw-phase-tracker">
                    {phaseTrackerNode}
                  </div>
                </div>

                {/* 顶部中央：提示横幅 */}
                <div
                  className={`absolute top-3 z-30 pointer-events-none ${isLandscapeMobileViewport ? '' : 'left-0 right-0 flex justify-center'}`}
                  style={statusBannersWrapperStyle}
                  data-tutorial-id="sw-action-banner"
                >
                  <div className="pointer-events-auto">
                    <StatusBanners
                      currentPhase={currentPhase}
                      isMyTurn={isMyTurn}
                      core={core}
                      abilityMode={abilityMode}
                      fireSacrificeSummonMode={interaction.fireSacrificeSummonMode}
                      onCancelFireSacrifice={() => {
                        if (swInteraction?.type === 'fire_sacrifice_summon') {
                          cancelSwInteraction(true);
                          return;
                        }
                        interaction.handleCardSelect(null);
                      }}
                      bloodSummonMode={interaction.bloodSummonMode}
                      annihilateMode={interaction.annihilateMode}
                      soulTransferMode={soulTransferMode}
                      funeralPyreMode={interaction.funeralPyreMode}
                      mindControlMode={interaction.mindControlMode}
                      chantEntanglementMode={interaction.chantEntanglementMode}
                      moguSymbioticSelfHealingMode={interaction.moguSymbioticSelfHealingMode}
                      moguReleaseSporesMode={interaction.moguReleaseSporesMode}
                      sneakMode={interaction.sneakMode}
                      glacialShiftMode={interaction.glacialShiftMode}
                      withdrawMode={interaction.withdrawMode}
                      stunMode={interaction.stunMode}
                      hypnoticLureMode={interaction.hypnoticLureMode}
                      mindCaptureMode={mindCaptureMode}
                      afterAttackAbilityMode={afterAttackAbilityMode}
                      telekinesisTargetMode={interaction.telekinesisTargetMode}
                      magicEventChoiceMode={interaction.magicEventChoiceMode}
                      eventTargetMode={interaction.eventTargetMode}
                      systemGrabFollowMode={systemGrabFollowMode}
                      systemFeedBeastMode={systemFeedBeastMode}
                      systemMoguParasiteMode={systemMoguParasiteMode}
                      onCancelAbility={handleCancelAbility}
                      onConfirmBeforeAttackCards={interaction.handleConfirmBeforeAttackCards}
                      onConfirmBloodRune={handleConfirmBloodRune}
                      onSkipGrabFollow={handleSkipGrabFollow}
                      onConfirmFeedBeastSelfDestroy={handleConfirmFeedBeastSelfDestroy}
                      onConfirmMoguParasite={handleConfirmMoguParasite}
                      onCancelBeforeAttack={handleCancelBeforeAttack}
                      onCancelBloodSummon={handleCancelBloodSummon}
                      onContinueBloodSummon={handleContinueBloodSummon}
                      onCancelAnnihilate={handleCancelAnnihilate}
                      onConfirmAnnihilateTargets={handleConfirmAnnihilateTargets}
                      onSkipAnnihilateDamage={handleSkipAnnihilateDamage}
                      onConfirmSoulTransfer={handleConfirmSoulTransfer}
                      onSkipSoulTransfer={handleSkipSoulTransfer}
                      onSkipFuneralPyre={handleSkipFuneralPyre}
                      onConfirmMindControl={handleConfirmMindControl}
                      onCancelMindControl={handleCancelMindControl}
                      onConfirmEntanglement={handleConfirmEntanglement}
                      onCancelEntanglement={handleCancelEntanglement}
                      onConfirmMoguSymbioticSelfHealing={interaction.handleConfirmMoguSymbioticSelfHealing}
                      onSkipMoguSymbioticSelfHealing={interaction.handleSkipMoguSymbioticSelfHealing}
                      onConfirmMoguReleaseSpores={interaction.handleConfirmMoguReleaseSpores}
                      onSkipMoguReleaseSpores={interaction.handleSkipMoguReleaseSpores}
                      onConfirmSneak={handleConfirmSneak}
                      onCancelSneak={handleCancelSneak}
                      onConfirmGlacialShift={handleConfirmGlacialShift}
                      onCancelGlacialShift={handleCancelGlacialShift}
                      onWithdrawCostSelect={handleWithdrawCostSelect}
                      onCancelWithdraw={handleCancelWithdraw}
                      onCancelStun={handleCancelStun}
                      onCancelHypnoticLure={handleCancelHypnoticLure}
                      onConfirmMindCapture={handleConfirmMindCapture}
                      onCancelAfterAttackAbility={handleCancelAfterAttackAbility}
                      rapidFireMode={effectiveRapidFireMode}
                      onConfirmRapidFire={handleConfirmRapidFire}
                      onCancelRapidFire={handleCancelRapidFire}
                      onCancelTelekinesis={handleCancelTelekinesis}
                      onAfterMoveSelfCharge={handleAfterMoveSelfCharge}
                      onSystemAbilityChoice={interaction.handleSystemAbilityChoice}
                      onPlayMagicEvent={interaction.handlePlayMagicEvent}
                      onDiscardMagicEvent={interaction.handleDiscardMagicEvent}
                      onCancelMagicEventChoice={interaction.handleCancelMagicEventChoice}
                      onCancelEventTargetInteraction={interaction.handleCancelEventTargetInteraction}
                    />
                  </div>
                </div>

                  {/* 底部：手牌区（中心对齐到左右 HUD 留出的“安全走廊”，避免侵入右侧 controls） */}
                  <div
                    className="absolute bottom-0 z-30 pointer-events-auto"
                    style={handAreaStyle}
                    data-tutorial-id="sw-hand-area"
                  >
                    <HandArea
                      cards={myHand}
                      phase={currentPhase}
                      isMyTurn={isMyTurn}
                      currentMagic={myMagic}
                      selectedCardId={interaction.selectedHandCardId}
                      selectedCardIds={abilityMode?.step === 'selectCards'
                        ? interaction.abilitySelectedCardIds
                        : interaction.selectedCardsForDiscard}
                      abilitySelectableCardIds={abilityMode?.step === 'selectCards'
                        ? abilityMode.selectableCardIds
                        : undefined}
                      onCardClick={interaction.handleCardClick}
                      onCardSelect={interaction.handleCardSelect}
                      onPlayEvent={interaction.handlePlayEvent}
                      onMagnifyCard={handleMagnifyCard}
                      bloodSummonSelectingCard={interaction.bloodSummonMode?.step === 'selectCard'}
                      abilitySelectingCards={abilityMode?.step === 'selectCards'}
                      interactionBusy={handInteractionBusy}
                      compactLayout={useCompactHandLayout}
                    />
                  </div>
                </div>
                </div>

              {/* 技能卡牌选择器 */}
              {isSystemCardSelectorActive && (
                <CardSelectorOverlay
                  title={t(getSystemCardSelectorTitleKey(systemCardSelectorAbilityId))}
                  cards={systemCardSelectorCards}
                  onSelect={(card) => {
                    if (!isSystemCardSelectorActive || !swInteraction) return;
                    const option = findSystemCardSelectorOptionByCardId(
                      swInteraction,
                      systemCardSelectorAbilityId,
                      card.id,
                    );
                    if (!option) return;
                    respondInteractionOption(option.id);
                  }}
                  onCancel={() => {
                    if (!isSystemCardSelectorActive || !swInteraction) return;
                    cancelSwInteraction(true);
                  }}
                />
              )}

              {/* 系统交互：感染（从弃牌堆选择疫病体） */}
              {systemInfectionCards && (
                <CardSelectorOverlay
                  title={t('cardSelector.infection')}
                  cards={systemInfectionCards}
                  onSelect={handleSelectInfectionCard}
                  onCancel={handleSkipInfection}
                  cancelLabelKey="actions.skip"
                />
              )}

              {/* 单位操作面板（主动技能按钮） */}
              <AbilityButtonsPanel
                core={core}
                currentPhase={currentPhase}
                isMyTurn={isMyTurn}
                myPlayerId={myPlayerId}
                myHand={myHand}
                abilityMode={abilityMode}
                bloodSummonMode={interaction.bloodSummonMode}
                eventTargetMode={interaction.eventTargetMode}
                dispatch={dispatch}
              />

              {/* 卡牌放大预览 */}
              <MagnifyOverlay isOpen={!!magnifiedCard} onClose={() => setMagnifiedCard(null)} containerClassName="max-h-[85vh] max-w-[90vw]" overlayTestId="sw-magnify-overlay" closeLabel={t('actions.close')}>
                {magnifiedCard && (
                  <div
                    style={{
                      width: `min(90vw, max(40vw, calc(75vh * ${SUMMONER_WARS_CARD_ASPECT_RATIO})))`,
                    }}
                  >
                    <CardSprite
                      atlasId={magnifiedCard.atlasId}
                      frameIndex={magnifiedCard.frameIndex}
                      className="w-full rounded-xl shadow-2xl"
                    />
                  </div>
                )}
              </MagnifyOverlay>

              {/* 弃牌堆查看浮层 */}
              {showDiscardOverlay && (
                <DiscardPileOverlay cards={myDiscard} onClose={() => setShowDiscardOverlay(false)} onMagnify={handleMagnifyCard} />
              )}

              {/* 骰子结果浮层 */}
              <DiceResultOverlay
                results={pendingEncourage?.diceResults ?? diceResult?.results ?? null}
                attackType={pendingEncourage?.attackType ?? diceResult?.attackType ?? null}
                hits={pendingEncourage
                  ? countHits(pendingEncourage.diceResults, pendingEncourage.attackType)
                  : diceResult?.hits ?? 0}
                damageReduced={diceResult?.damageReduced}
                isOpponentAttack={diceResult?.isOpponentAttack ?? false}
                duration={DICE_RESULT_OVERLAY_DURATION_MS}
                pendingDecision={!!pendingEncourage}
                onReroll={pendingEncourage ? () => dispatch(INTERACTION_COMMANDS.RESPOND, {
                  interactionId: swInteraction!.id,
                  optionId: 'reroll',
                }) : undefined}
                onKeep={pendingEncourage ? () => dispatch(INTERACTION_COMMANDS.RESPOND, {
                  interactionId: swInteraction!.id,
                  optionId: 'keep',
                }) : undefined}
                onRevealComplete={pendingEncourage ? undefined : () => startPendingAttackVisual('dice-reveal-complete')}
                onClose={pendingEncourage ? undefined : handleCloseDiceResult}
              />

              {/* 结束页面遮罩（视觉序列进行中延迟显示，确保死亡动画播完） */}
              <EndgameOverlay {...endgameProps} isGameOver={!!isGameOver && !isVisualBusy} />

              {/* 调试面板 */}
              {debugPanel}
            </div>
          )}
        </div>
      </div>
    </UndoProvider>
  );
};

export default SummonerWarsBoard;
