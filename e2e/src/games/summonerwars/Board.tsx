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
import { isUndeadCard, isPlagueZombieCard, isFortressUnit } from './domain/ids';
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
import { TutorialSelectionGate } from '../../components/game/framework';
import { saveSummonerWarsLayout } from '../../api/layout';
import type { BoardLayoutConfig, GridConfig } from '../../core/ui/board-layout.types';
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
import { MAX_MOVES_PER_TURN, MAX_ATTACKS_PER_TURN, findUnitPositionByInstanceId } from './domain/helpers';
// 提取的子模块
import { CardSprite } from './ui/CardSprite';
import { getUnitSpriteConfig, getStructureSpriteConfig, getEventSpriteConfig } from './ui/spriteHelpers';
import { useGameEvents } from './ui/useGameEvents';
import type { AbilityModeState, AfterAttackAbilityModeState } from './ui/useGameEvents';
import { useCellInteraction } from './ui/useCellInteraction';
import { StatusBanners } from './ui/StatusBanners';
import { BoardGrid, getCellPosition } from './ui/BoardGrid';
import { AbilityButtonsPanel } from './ui/AbilityButtonsPanel';
import { PathTrailEffect } from './ui/PathTrailEffect';
import { useMovementTrails } from './ui/useMovementTrails';
import {
  BOARD_SHELL_REFERENCE_WIDTH,
  SUMMONER_WARS_DESKTOP_HUD_REFERENCE_WIDTH_PX,
  SUMMONER_WARS_MOBILE_BOARD_REFERENCE_WIDTH_PX,
} from './ui/layoutConstants';
import { getEventStreamEntries } from '../../engine/systems/EventStreamSystem';
import { SUMMONER_WARS_AUDIO_CONFIG, resolveDiceRollSound, resolveAttackSoundKey, resolveDamageSoundKey } from './audio.config';
import { SUMMONER_WARS_MANIFEST } from './manifest';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import type { InteractionDescriptor, PromptOption } from '../../engine/systems/InteractionSystem';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { shouldBlockHandInteraction } from './ui/handInteractionBusy';

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
const MAP_INTERNAL_TARGETS = new Set([
  'sw-my-summoner', 'sw-enemy-summoner', 'sw-my-gate', 'sw-start-archer',
]);

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
  const viewport = useRuntimeViewport();
  const viewportSafeWidth = useMemo(() => {
    const safeWidth = viewport.width - viewport.safeArea.left - viewport.safeArea.right;
    return safeWidth > 0 ? safeWidth : viewport.width;
  }, [viewport.safeArea.left, viewport.safeArea.right, viewport.width]);
  const isMobileViewport = viewport.width <= 1023;
  const isLandscapeMobileViewport = isMobileViewport && viewport.width > viewport.height;
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

  // 阵营选择状态
  const rootPid = (playerID || '0') as PlayerId;
  const isInFactionSelection = !G.core.hostStarted;

  // 玩家名称映射
  const playerNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const pid of ['0', '1']) {
      names[pid] = matchData?.find(p => String(p.id) === pid)?.name
        ?? (pid === '0' ? t('player.default1') : t('player.default2'));
    }
    return names;
  }, [matchData, t]);

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
    isPendingAnimation: isTutorialPendingAnimation,
    animationComplete: tutorialAnimationComplete,
  } = useTutorial();

  // 教程纯信息步骤时禁止地图拖拽/缩放（防止蓝色高亮框与元素脱节）
  // 有 allowedCommands 或 advanceOnEvents 的步骤需要用户与地图交互，不禁用
  const mapInteractionDisabled = isTutorialActive && !!tutorialStep
    && !tutorialStep.requireAction
    && !(tutorialStep.allowedCommands && tutorialStep.allowedCommands.length > 0)
    && !(tutorialStep.advanceOnEvents && tutorialStep.advanceOnEvents.length > 0);

  // 教程自动平移：当高亮目标在地图内部时，传给 MapContainer 让其自动居中并放大
  // 地图内部的 tutorial-id：sw-my-summoner, sw-enemy-summoner, sw-my-gate, sw-start-archer（在 BoardGrid 内）
  const mapPanTarget = (isTutorialActive && tutorialStep?.highlightTarget && MAP_INTERNAL_TARGETS.has(tutorialStep.highlightTarget))
    ? tutorialStep.highlightTarget
    : null;
  // 聚焦到单个单位/建筑时放大到 1.8x，让卡牌清晰可见
  const MAP_PAN_SCALE = 1.8;

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
  const activePlayerId = core.currentPlayer;
  const isMyTurn = isLocalMatch || (playerID !== null && playerID !== undefined && activePlayerId === playerID);
  const myPlayerId = isLocalMatch ? '0' : (playerID === '1' ? '1' : '0');
  const opponentPlayerId = myPlayerId === '0' ? '1' : '0';
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

  // 摧毁效果
  const { effects: destroyEffects, pushEffect: pushDestroyEffect, removeEffect: removeDestroyEffect } = useDestroyEffects();
  // 全屏震动
  const { shakeStyle, triggerShake } = useScreenShake();
  // FX 系统（替代原 useBoardEffects，注入音效/震动回调实现反馈包自动触发）
  const fxBus = useFxBus(summonerWarsFxRegistry, {
    playSound,
    triggerShake,
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

  // 事件流消费 Hook（回调函数在 hook 内部通过 ref 稳定化，无需外部包装）
  const {
    diceResult,
    dyingEntities,
    damageBuffer,
    isVisualBusy,
    abilityMode: localAbilityMode, setAbilityMode: setLocalAbilityMode,
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
    };
  }, [currentInteraction, myPlayerId]);
  const afterAttackAbilityMode = useMemo<AfterAttackAbilityModeState | null>(() => {
    if (!swInteraction) return null;
    if (
      swInteraction.type !== 'after_attack_mind_transmission'
      && swInteraction.type !== 'after_attack_telekinesis_target'
    ) {
      return null;
    }
    const sourceUnitId = typeof swInteraction.meta?.sourceUnitId === 'string' ? swInteraction.meta.sourceUnitId : undefined;
    const sourcePosition = swInteraction.meta?.sourcePosition as CellCoord | undefined;
    const abilityId = swInteraction.meta?.abilityId as AfterAttackAbilityModeState['abilityId'] | undefined;
    if (!sourceUnitId || !sourcePosition || !abilityId) return null;
    return {
      abilityId,
      sourceUnitId,
      sourcePosition,
    };
  }, [swInteraction]);
  const [interactionAbilityDraft, setInteractionAbilityDraft] = useState<{
    interactionId: string;
    selectedCardIds: string[];
  } | null>(null);
  const noopSetAfterAttackAbilityMode = useCallback((_mode: AfterAttackAbilityModeState | null) => {}, []);

  const systemAbilityMode = useMemo<AbilityModeState | null>(() => {
    if (!swInteraction) return null;
    const meta = swInteraction.meta as {
      sourceUnitId?: string;
      sourcePosition?: CellCoord;
      structurePosition?: CellCoord;
      targetPosition?: CellCoord;
    };
    if (!meta.sourceUnitId) return null;

    if (swInteraction.type === 'on_phase_start_illusion') {
      return {
        abilityId: 'illusion',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (swInteraction.type === 'on_phase_start_blood_rune') {
      return {
        abilityId: 'blood_rune',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (swInteraction.type === 'after_move_spirit_bond') {
      return {
        abilityId: 'spirit_bond',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (swInteraction.type === 'after_move_ancestral_bond') {
      return {
        abilityId: 'ancestral_bond',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (swInteraction.type === 'after_move_structure_shift_target') {
      return {
        abilityId: 'structure_shift',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (swInteraction.type === 'after_move_structure_shift_direction') {
      return {
        abilityId: 'structure_shift',
        step: 'selectNewPosition',
        sourceUnitId: meta.sourceUnitId,
        targetPosition: meta.targetPosition,
      };
    }

    if (swInteraction.type === 'after_move_frost_axe') {
      return {
        abilityId: 'frost_axe',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
      };
    }

    if (swInteraction.type === 'ice_ram_target') {
      return {
        abilityId: 'ice_ram',
        step: 'selectUnit',
        sourceUnitId: 'ice_ram',
        structurePosition: meta.structurePosition,
      };
    }

    if (swInteraction.type === 'ice_ram_push') {
      return {
        abilityId: 'ice_ram',
        step: 'selectPushDirection',
        sourceUnitId: 'ice_ram',
        structurePosition: meta.structurePosition,
        targetPosition: meta.targetPosition,
      };
    }

    if (!meta.targetPosition) return null;

    if (swInteraction.type === 'before_attack_life_drain') {
      return {
        abilityId: 'life_drain',
        step: 'selectUnit',
        sourceUnitId: meta.sourceUnitId,
        context: 'beforeAttack',
        pendingAttackTarget: meta.targetPosition,
      };
    }

    if (swInteraction.type === 'before_attack_holy_arrow' || swInteraction.type === 'before_attack_healing') {
      const expectedAction = swInteraction.type;
      const selectableCardIds = swInteraction.options
        .map((option) => {
          const value = option.value as { action?: string; cardId?: string } | undefined;
          return value?.action === expectedAction && typeof value.cardId === 'string' ? value.cardId : null;
        })
        .filter((cardId): cardId is string => !!cardId);
      const selectedCardIds = interactionAbilityDraft?.interactionId === swInteraction.id
        ? interactionAbilityDraft.selectedCardIds.filter((cardId) => selectableCardIds.includes(cardId))
        : [];
      return {
        abilityId: swInteraction.type === 'before_attack_holy_arrow' ? 'holy_arrow' : 'healing',
        step: 'selectCards',
        sourceUnitId: meta.sourceUnitId,
        context: 'beforeAttack',
        selectedCardIds,
        selectableCardIds,
        pendingAttackTarget: meta.targetPosition,
      };
    }
    return null;
  }, [interactionAbilityDraft, swInteraction]);

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
    setLocalAbilityMode(mode);
  }, [setLocalAbilityMode, swInteraction, systemAbilityMode?.context]);

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
    if (!swInteraction || swInteraction.type !== 'soul_transfer') return null;
    const meta = swInteraction.meta as { sourceUnitId?: string; sourcePosition?: CellCoord; victimPosition?: CellCoord };
    if (!meta.sourceUnitId || !meta.sourcePosition || !meta.victimPosition) return null;
    return {
      sourceUnitId: meta.sourceUnitId,
      sourcePosition: meta.sourcePosition,
      victimPosition: meta.victimPosition,
    };
  }, [swInteraction]);

  const mindCaptureMode = useMemo(() => {
    if (!swInteraction || swInteraction.type !== 'mind_capture') return null;
    const meta = swInteraction.meta as {
      sourceUnitId?: string;
      sourcePosition?: CellCoord;
      targetPosition?: CellCoord;
      targetUnitId?: string;
      hits?: number;
    };
    if (!meta.sourceUnitId || !meta.sourcePosition || !meta.targetPosition || !meta.targetUnitId || !meta.hits) return null;
    return {
      sourceUnitId: meta.sourceUnitId,
      sourcePosition: meta.sourcePosition,
      targetPosition: meta.targetPosition,
      targetUnitId: meta.targetUnitId,
      hits: meta.hits,
    };
  }, [swInteraction]);

  const effectiveRapidFireMode = useMemo(() => {
    if (swInteraction?.type !== 'after_attack_rapid_fire') return null;
    const meta = swInteraction.meta as { sourceUnitId?: string; sourcePosition?: CellCoord };
    if (!meta.sourceUnitId || !meta.sourcePosition) return null;
    return {
      sourceUnitId: meta.sourceUnitId,
      sourcePosition: meta.sourcePosition,
    };
  }, [swInteraction]);

  const abilityMode = systemAbilityMode ?? localAbilityMode;

  const systemIceShardsMode = useMemo(() => {
    if (!swInteraction || swInteraction.type !== 'ice_shards') return null;
    const meta = swInteraction.meta as { sourceUnitId?: string };
    if (!meta.sourceUnitId) return null;
    const pos = findUnitPositionByInstanceId(core, meta.sourceUnitId);
    const unit = pos ? core.board[pos.row]?.[pos.col]?.unit : null;
    return {
      sourceBoosts: unit?.boosts ?? 0,
    };
  }, [core, swInteraction]);

  const systemInfectionCards = useMemo(() => {
    if (!swInteraction || swInteraction.type !== 'infection') return null;
    const discard = core.players[myPlayerId]?.discard ?? [];
    const cardLookup = new Map(discard.map((card) => [card.id, card]));
    return swInteraction.options
      .map((option) => cardLookup.get(option.id))
      .filter((card): card is Card => !!card);
  }, [core.players, myPlayerId, swInteraction]);

  const systemFeedBeastMode = !!swInteraction && swInteraction.type === 'feed_beast';

  const noopSetGrabFollowMode = useCallback(() => {}, []);
  const noopSetMindCaptureMode = useCallback(() => {}, []);

  // 格子交互 Hook
  const interaction = useCellInteraction({
    core, dispatch,
    currentPhase, isMyTurn, isGameOver: !!isGameOver,
    myPlayerId, activePlayerId, myHand, fromViewCoord,
    undoSnapshotCount: getUndoSnapshotCount(G.sys?.undo),
    interaction: currentInteraction,
    abilityMode, setAbilityMode, soulTransferMode,
    mindCaptureMode, setMindCaptureMode: noopSetMindCaptureMode,
    afterAttackAbilityMode, setAfterAttackAbilityMode: noopSetAfterAttackAbilityMode,
    rapidFireMode: effectiveRapidFireMode,
    grabFollowMode: null,
    setGrabFollowMode: noopSetGrabFollowMode,
  });

  const engineInteractionBusy = !!currentInteraction && currentInteraction.playerId === (myPlayerId as PlayerId);
  const handInteractionBusy = shouldBlockHandInteraction({
    hasAbilityMode: !!abilityMode,
    hasActiveEventMode: interaction.hasActiveEventMode,
    hasEngineInteraction: engineInteractionBusy,
    hasSwInteraction: !!swInteraction,
  });

  // 关闭骰子结果 → 播放攻击动画
  const handleCloseDiceResult = () => {
    const pending = rawCloseDiceResult();
    if (!pending) return;

    // 未命中：跳过所有攻击动画和音效，直接清理
    if (pending.hits === 0) {
      clearPendingAttack();
      flushPendingDestroys();
      return;
    }

    if (pending.attackType === 'ranged') {
      // 远程攻击：骰子结束后稍作延迟再播放气浪特效
      // 注意：不在此处 clearPendingAttack，确保 180ms 内到达的 UNIT_DESTROYED 事件仍能排队
      const attackSnapshot = { ...pending };
      window.setTimeout(() => {
        clearPendingAttack();
        const hitIntensity = attackSnapshot.hits >= 3 ? 'strong' : 'normal';
        // 只 push 气浪，伤害特效等气浪到达目标后再播放
        waitingForShockwaveRef.current = true;
        pendingRangedDamagesRef.current = [...attackSnapshot.damages];
        pendingRangedShakeRef.current = attackSnapshot.hits >= 3;
        // 远程攻击音 + 震动：由 COMBAT_SHOCKWAVE 的 FeedbackPack 自动处理
        const attackSoundKey = resolveAttackSoundKey(attackSnapshot.attackType, core, attackSnapshot.attacker);
        fxBus.push(SW_FX.COMBAT_SHOCKWAVE, { cell: attackSnapshot.target, intensity: hitIntensity }, { attackType: attackSnapshot.attackType, source: attackSnapshot.attacker, soundKey: attackSoundKey });
        // 伤害特效和 flushPendingDestroys 由 handleFxComplete 在气浪完成时触发
      }, 180);
    } else {
      // 近战攻击：启动卡牌本体碰撞动画
      setAttackAnimState({ attacker: pending.attacker, target: pending.target, hits: pending.hits });
    }
  };

  // 近战攻击命中回调（卡牌冲到目标时触发，播放伤害特效）
  const handleAttackHit = () => {
    const pending = pendingAttackRef.current;
    if (!pending) return;

    // 释放视觉快照：impact 瞬间让血条变化
    const impactPositions = pending.damages.map(d => d.position);
    if (impactPositions.length > 0) {
      releaseDamageSnapshot(impactPositions);
    }

    const hitIntensity = pending.hits >= 3 ? 'strong' : 'normal';
    // 近战攻击音 + 震动：由 COMBAT_SHOCKWAVE 的 FeedbackPack 自动处理
    const attackSoundKey = resolveAttackSoundKey(pending.attackType, core, pending.attacker);
    fxBus.push(SW_FX.COMBAT_SHOCKWAVE, { cell: pending.target, intensity: hitIntensity }, { attackType: pending.attackType, source: pending.attacker, soundKey: attackSoundKey });
    for (const dmg of pending.damages) {
      // 受伤音：由 COMBAT_DAMAGE 的 FeedbackPack 自动处理
      const damageSoundKey = resolveDamageSoundKey(dmg.damage);
      fxBus.push(SW_FX.COMBAT_DAMAGE, { cell: dmg.position, intensity: dmg.damage >= 3 ? 'strong' : 'normal' }, { damageAmount: dmg.damage, soundKey: damageSoundKey });
    }
  };

  // 近战攻击回弹完成回调（卡牌回到原位后触发，flush 摧毁效果）
  const handleAttackReturn = () => {
    clearPendingAttack();
    flushPendingDestroys();
    setAttackAnimState(null);
  };

  // FX 特效完成回调：远程气浪到达目标时播放伤害特效 + flush 摧毁
  const handleFxComplete = useCallback((id: string, cue: string) => {
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
        fxBus.push(SW_FX.COMBAT_DAMAGE, { cell: dmg.position, intensity: dmg.damage >= 3 ? 'strong' : 'normal' }, { damageAmount: dmg.damage, soundKey: damageSoundKey });
      }
      pendingRangedDamagesRef.current = [];
      pendingRangedShakeRef.current = false;
      flushPendingDestroys();
    }
    // 召唤/攻击动画完成时，通知教程系统
    if (isTutorialPendingAnimation && (cue === SW_FX.SUMMON || cue === SW_FX.COMBAT_SHOCKWAVE)) {
      tutorialAnimationComplete();
    }
  }, [flushPendingDestroys, fxBus, releaseDamageSnapshot, isTutorialPendingAnimation, tutorialAnimationComplete]);

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
    if (
      swInteraction
      && [
        'ice_shards',
        'on_phase_start_blood_rune',
        'on_phase_start_illusion',
        'after_move_spirit_bond',
        'after_move_ancestral_bond',
        'after_move_structure_shift_target',
        'after_move_structure_shift_direction',
        'after_move_frost_axe',
        'after_attack_mind_transmission',
        'activated_ability_target',
        'fire_sacrifice_summon',
        'ice_ram_target',
        'ice_ram_push',
      ].includes(swInteraction.type)
    ) {
      cancelSwInteraction(true);
      return;
    }
    // 寒冰冲撞推拉步骤跳过：仍然发送命令（造成伤害但不推拉）
    if (abilityMode?.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection'
      && abilityMode.targetPosition && abilityMode.structurePosition) {
      dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
        abilityId: 'ice_ram',
        sourceUnitId: 'ice_ram',
        targetPosition: abilityMode.targetPosition,
        structurePosition: abilityMode.structurePosition,
        _noSnapshot: true,
      });
    }
    setAbilityMode(null);
  }, [abilityMode, cancelSwInteraction, dispatch, setAbilityMode, swInteraction]);
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
    interaction.setBloodSummonMode(null);
    // 清除血契召唤期间选中的手牌高亮
    interaction.handleCardSelect(null);
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
    interaction.setAnnihilateMode(null);
    interaction.handleCardSelect(null);
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
    if (!swInteraction || swInteraction.type !== 'soul_transfer') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string } | undefined;
      return value?.action === 'soul_transfer';
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);
  const handleSkipSoulTransfer = useCallback(() => {
    if (!swInteraction || swInteraction.type !== 'soul_transfer') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { skip?: boolean } | undefined;
      return value?.skip === true;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);
  const handleSkipFuneralPyre = useCallback(() => {
    if (swInteraction?.type === 'funeral_pyre') {
      const optionId = findInteractionOptionId((option) => {
        const value = option.value as { action?: string; skip?: boolean } | undefined;
        return value?.action === 'funeral_pyre_skip' || value?.skip === true;
      });
      respondInteractionOption(optionId);
      return;
    }
    if (!interaction.funeralPyreMode) return;
    dispatch(SW_COMMANDS.FUNERAL_PYRE_HEAL, {
      cardId: interaction.funeralPyreMode.cardId,
      skip: true,
    });
    interaction.setFuneralPyreMode(null);
  }, [dispatch, findInteractionOptionId, interaction, respondInteractionOption, swInteraction]);

  // 欺心巫族事件卡回调
  const handleConfirmMindControl = useCallback(() => interaction.handleConfirmMindControl(), [interaction]);
  const handleCancelMindControl = useCallback(() => {
    if (swInteraction?.type === 'mind_control_select_targets') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
    interaction.setMindControlMode(null);
    interaction.handleCardSelect(null);
  }, [dispatch, interaction, swInteraction]);
  const handleConfirmEntanglement = useCallback(() => interaction.handleConfirmEntanglement(), [interaction]);
  const handleCancelEntanglement = useCallback(() => {
    if (swInteraction?.type === 'chant_entanglement_select_targets') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
    interaction.setChantEntanglementMode(null);
    interaction.handleCardSelect(null);
  }, [dispatch, interaction, swInteraction]);
  const handleConfirmSneak = useCallback(() => interaction.handleConfirmSneak(), [interaction]);
  const handleCancelSneak = useCallback(() => {
    if (swInteraction?.type === 'sneak_select_unit' || swInteraction?.type === 'sneak_select_direction') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
    interaction.setSneakMode(null);
    interaction.handleCardSelect(null);
  }, [dispatch, interaction, swInteraction]);
  const handleConfirmGlacialShift = useCallback(() => interaction.handleConfirmGlacialShift(), [interaction]);
  const handleCancelGlacialShift = useCallback(() => {
    if (swInteraction?.type === 'glacial_shift_select_building' || swInteraction?.type === 'glacial_shift_select_destination') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
    interaction.setGlacialShiftMode(null);
    interaction.handleCardSelect(null);
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
    interaction.setWithdrawMode(null);
  }, [cancelSwInteraction, interaction, swInteraction]);
  const handleConfirmStun = useCallback(() => {
    interaction.handleConfirmStun();
  }, [interaction]);
  const handleCancelStun = useCallback(() => {
    if (swInteraction?.type === 'stun_select_target' || swInteraction?.type === 'stun_select_destination') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
    interaction.setStunMode(null);
    interaction.handleCardSelect(null);
  }, [dispatch, interaction, swInteraction]);
  const handleCancelHypnoticLure = useCallback(() => {
    if (swInteraction?.type === 'hypnotic_lure_select_target') {
      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
      return;
    }
    interaction.setHypnoticLureMode(null);
    interaction.handleCardSelect(null);
  }, [dispatch, interaction, swInteraction]);

  // 心灵捕获 + 攻击后技能回调
  const handleConfirmMindCapture = useCallback((choice: 'control' | 'damage') => {
    if (!swInteraction || swInteraction.type !== 'mind_capture') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return value?.action === 'mind_capture' && value.choice === choice;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);
  const handleCancelAfterAttackAbility = useCallback(() => {
    if (
      swInteraction?.type === 'after_attack_mind_transmission'
      || swInteraction?.type === 'after_attack_telekinesis_target'
      || swInteraction?.type === 'after_attack_telekinesis_direction'
      || swInteraction?.type === 'after_attack_rapid_fire'
    ) {
      cancelSwInteraction(true);
    }
  }, [cancelSwInteraction, swInteraction]);

  // 连续射击确认/取消
  const handleConfirmRapidFire = useCallback(() => {
    if (swInteraction?.type === 'after_attack_rapid_fire') {
      const optionId = findInteractionOptionId((option) => {
        const value = option.value as { action?: string; skip?: boolean } | undefined;
        return value?.action === 'after_attack_rapid_fire' && value.skip !== true;
      });
      respondInteractionOption(optionId);
      return;
    }
    if (!effectiveRapidFireMode) return;
    dispatch(SW_COMMANDS.ACTIVATE_ABILITY, { abilityId: 'rapid_fire', sourceUnitId: effectiveRapidFireMode.sourceUnitId, _noSnapshot: true });
  }, [dispatch, effectiveRapidFireMode, findInteractionOptionId, respondInteractionOption, swInteraction]);
  const handleCancelRapidFire = useCallback(() => {
    if (swInteraction?.type === 'after_attack_rapid_fire') {
      cancelSwInteraction(true);
    }
  }, [cancelSwInteraction, swInteraction]);
  // 鲜血符文选择回调
  const handleConfirmBloodRune = useCallback((choice: 'damage' | 'charge') => {
    if (swInteraction?.type === 'on_phase_start_blood_rune') {
      const optionId = findInteractionOptionId((option) => {
        const value = option.value as { action?: string; choice?: string } | undefined;
        return value?.action === 'on_phase_start_blood_rune' && value.choice === choice;
      });
      respondInteractionOption(optionId);
      setAbilityMode(null);
      return;
    }
    if (!abilityMode || abilityMode.abilityId !== 'blood_rune') return;
    dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'blood_rune',
      sourceUnitId: abilityMode.sourceUnitId,
      choice,
      _noSnapshot: true,
    });
    setAbilityMode(null);
  }, [abilityMode, dispatch, findInteractionOptionId, respondInteractionOption, setAbilityMode, swInteraction]);
  // 寒冰碎屑确认回调
  const handleConfirmIceShards = useCallback(() => {
    if (!swInteraction || swInteraction.type !== 'ice_shards') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; skip?: boolean } | undefined;
      return value?.action === 'ice_shards' && value.skip !== true;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);
  // 喂养巨食兽自毁回调
  const handleConfirmFeedBeastSelfDestroy = useCallback(() => {
    if (!swInteraction || swInteraction.type !== 'feed_beast') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { action?: string; choice?: string } | undefined;
      return value?.action === 'feed_beast' && value.choice === 'self_destroy';
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);
  const handleSelectInfectionCard = useCallback((card: Card) => {
    if (!swInteraction || swInteraction.type !== 'infection') return;
    respondInteractionOption(card.id);
  }, [respondInteractionOption, swInteraction]);
  const handleSkipInfection = useCallback(() => {
    if (!swInteraction || swInteraction.type !== 'infection') return;
    const optionId = findInteractionOptionId((option) => {
      const value = option.value as { skip?: boolean } | undefined;
      return option.id === 'skip' || value?.skip === true;
    });
    respondInteractionOption(optionId);
  }, [findInteractionOptionId, respondInteractionOption, swInteraction]);
  const handleConfirmTelekinesis = useCallback((_direction?: 'push' | 'pull', _axis?: 'row' | 'col') => {
    // 念力已改为棋盘点击终点模式，此回调为空实现
    interaction.handleConfirmTelekinesis();
  }, [interaction]);
  const handleCancelTelekinesis = useCallback(() => {
    if (
      swInteraction?.type === 'after_attack_telekinesis_target'
      || swInteraction?.type === 'after_attack_telekinesis_direction'
      || swInteraction?.type === 'activated_ability_target'
    ) {
      cancelSwInteraction(true);
    }
    interaction.setTelekinesisTargetMode(null);
  }, [cancelSwInteraction, interaction, swInteraction]);
  // afterMove 技能：充能自身
  const handleAfterMoveSelfCharge = useCallback(() => {
    if (swInteraction?.type === 'after_move_spirit_bond' || swInteraction?.type === 'after_move_frost_axe') {
      const optionId = findInteractionOptionId((option) => {
        const value = option.value as { action?: string; choice?: string } | undefined;
        return (value?.action === 'after_move_spirit_bond' || value?.action === 'after_move_frost_axe')
          && value.choice === 'self';
      });
      respondInteractionOption(optionId);
      setAbilityMode(null);
      return;
    }
    if (!abilityMode) return;
    dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: abilityMode.abilityId,
      sourceUnitId: abilityMode.sourceUnitId,
      choice: 'self',
      _noSnapshot: true,
    });
    setAbilityMode(null);
  }, [abilityMode, dispatch, findInteractionOptionId, respondInteractionOption, setAbilityMode, swInteraction]);
  const handleSaveLayout = useCallback(async (config: BoardLayoutConfig) => saveSummonerWarsLayout(config), []);

  const debugPanel = !isSpectator ? (
    <GameDebugPanel G={G} dispatch={dispatch} playerID={playerID} autoSwitch={!isMultiplayer}>
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
        <GameButton onClick={interaction.handleEndPhase} disabled={!isMyTurn || interaction.isMandatoryAbilityActive} variant={interaction.endPhaseConfirmPending ? 'danger' : 'primary'} size="md" data-testid="sw-end-phase" data-tutorial-id="sw-end-phase-btn">
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
                  <div className="absolute inset-0 z-10 flex items-center justify-center" data-testid="sw-map-layer" data-tutorial-id="sw-map-area" style={shakeStyle}>
                <MapContainer
                  className="w-full h-full flex items-center justify-center"
                  style={{ paddingLeft: mapPaddingLeft, paddingRight: mapPaddingRight }}
                  initialScale={mapInitialScale}
                  dragBoundsPaddingRatioY={0.3}
                  interactionDisabled={mapInteractionDisabled}
                  panToTarget={mapPanTarget}
                  panToScale={mapPanTarget ? MAP_PAN_SCALE : undefined}
                  containerTestId="sw-map-container"
                  contentTestId="sw-map-content"
                  scaleTestId="sw-map-scale"
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
                        sneakHighlights={interaction.sneakHighlights}
                        glacialShiftHighlights={interaction.glacialShiftHighlights}
                        withdrawHighlights={interaction.withdrawHighlights}
                        stunHighlights={interaction.stunHighlights}
                        hypnoticLureHighlights={interaction.hypnoticLureHighlights}
                        afterAttackAbilityHighlights={interaction.afterAttackAbilityHighlights}
                        telekinesisHighlights={interaction.telekinesisHighlights}
                        attackAnimState={attackAnimState}
                        destroyingCells={destroyingCells}
                        dyingEntities={dyingEntities}
                        damageBuffer={damageBuffer}
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
                    background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0.5) 100%)',
                    mixBlendMode: 'multiply'
                  }}
                />

                {/* 右上：对手名+魔力条 + 持续效果 */}
                <div className={opponentBarClass} data-testid="sw-opponent-bar">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-600/20 bg-black/60 px-3 py-2">
                    <span className="max-w-[9rem] truncate text-sm font-medium text-white text-opacity-100">
                      {matchData?.[playerID === '1' ? 0 : 1]?.name ?? t('player.opponent')}
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
                      {matchData?.[playerID === '1' ? 1 : 0]?.name ?? t('player.self')}
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
                  className={`absolute top-3 z-30 pointer-events-auto ${isLandscapeMobileViewport ? '' : 'left-0 right-0 flex justify-center'}`}
                  style={statusBannersWrapperStyle}
                  data-tutorial-id="sw-action-banner"
                >
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
                    pendingBeforeAttack={interaction.pendingBeforeAttack}
                    bloodSummonMode={interaction.bloodSummonMode}
                    annihilateMode={interaction.annihilateMode}
                    soulTransferMode={soulTransferMode}
                    funeralPyreMode={interaction.funeralPyreMode}
                    mindControlMode={interaction.mindControlMode}
                    chantEntanglementMode={interaction.chantEntanglementMode}
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
                    systemIceShardsMode={systemIceShardsMode}
                    systemFeedBeastMode={systemFeedBeastMode}
                    onCancelAbility={handleCancelAbility}
                    onConfirmBeforeAttackCards={interaction.handleConfirmBeforeAttackCards}
                    onConfirmBloodRune={handleConfirmBloodRune}
                    onConfirmIceShards={handleConfirmIceShards}
                    onConfirmFeedBeastSelfDestroy={handleConfirmFeedBeastSelfDestroy}
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
                    onConfirmSneak={handleConfirmSneak}
                    onCancelSneak={handleCancelSneak}
                    onConfirmGlacialShift={handleConfirmGlacialShift}
                    onCancelGlacialShift={handleCancelGlacialShift}
                    onWithdrawCostSelect={handleWithdrawCostSelect}
                    onCancelWithdraw={handleCancelWithdraw}
                    onConfirmStun={handleConfirmStun}
                    onCancelStun={handleCancelStun}
                    onCancelHypnoticLure={handleCancelHypnoticLure}
                    onConfirmMindCapture={handleConfirmMindCapture}
                    onCancelAfterAttackAbility={handleCancelAfterAttackAbility}
                    rapidFireMode={effectiveRapidFireMode}
                    onConfirmRapidFire={handleConfirmRapidFire}
                    onCancelRapidFire={handleCancelRapidFire}
                    onConfirmTelekinesis={handleConfirmTelekinesis}
                    onCancelTelekinesis={handleCancelTelekinesis}
                    onAfterMoveSelfCharge={handleAfterMoveSelfCharge}
                    onPlayMagicEvent={interaction.handlePlayMagicEvent}
                    onDiscardMagicEvent={interaction.handleDiscardMagicEvent}
                    onCancelMagicEventChoice={interaction.handleCancelMagicEventChoice}
                    onCancelEventTargetInteraction={interaction.handleCancelEventTargetInteraction}
                  />
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
              {abilityMode && abilityMode.step === 'selectCard' && (
                <CardSelectorOverlay
                  title={
                    abilityMode.abilityId === 'revive_undead' ? t('cardSelector.reviveUndead') :
                      abilityMode.abilityId === 'infection' ? t('cardSelector.infection') :
                        abilityMode.abilityId === 'fortress_power' ? t('cardSelector.fortressPower') : t('cardSelector.default')
                  }
                  cards={core.players[myPlayerId]?.discard.filter(c => {
                    if (abilityMode.abilityId === 'revive_undead') {
                      return isUndeadCard(c);
                    }
                    if (abilityMode.abilityId === 'infection') {
                      return c.cardType === 'unit' && isPlagueZombieCard(c);
                    }
                    if (abilityMode.abilityId === 'fortress_power') {
                      return c.cardType === 'unit' && isFortressUnit(c);
                    }
                    return true;
                  }) ?? []}
                  onSelect={(card) => {
                    if (abilityMode.abilityId === 'infection' && abilityMode.targetPosition) {
                      if (swInteraction?.type === 'infection') {
                        respondInteractionOption(card.id);
                        return;
                      }
                      dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
                        abilityId: 'infection', sourceUnitId: abilityMode.sourceUnitId,
                        targetCardId: card.id, targetPosition: abilityMode.targetPosition,
                        _noSnapshot: true,
                      });
                      setAbilityMode(null);
                    } else if (abilityMode.abilityId === 'fortress_power') {
                      dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
                        abilityId: 'fortress_power', sourceUnitId: abilityMode.sourceUnitId,
                        targetCardId: card.id,
                        _noSnapshot: true,
                      });
                      setAbilityMode(null);
                    } else {
                      setAbilityMode(abilityMode ? { ...abilityMode, step: 'selectPosition', selectedCardId: card.id } : null);
                    }
                  }}
                  onCancel={() => {
                    if (swInteraction?.type === 'infection') {
                      dispatch(INTERACTION_COMMANDS.CANCEL, { interactionId: swInteraction.id });
                      return;
                    }
                    setAbilityMode(null);
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
                setAbilityMode={setAbilityMode}
                setWithdrawMode={interaction.setWithdrawMode}
              />

              {/* 卡牌放大预览 */}
              <MagnifyOverlay isOpen={!!magnifiedCard} onClose={() => setMagnifiedCard(null)} containerClassName="max-h-[85vh] max-w-[90vw]" overlayTestId="sw-magnify-overlay" closeLabel={t('actions.close')}>
                {magnifiedCard && <CardSprite atlasId={magnifiedCard.atlasId} frameIndex={magnifiedCard.frameIndex} className="h-[75vh] rounded-xl shadow-2xl" style={{ minWidth: '40vw' }} />}
              </MagnifyOverlay>

              {/* 弃牌堆查看浮层 */}
              {showDiscardOverlay && (
                <DiscardPileOverlay cards={myDiscard} onClose={() => setShowDiscardOverlay(false)} onMagnify={handleMagnifyCard} />
              )}

              {/* 骰子结果浮层 */}
              <DiceResultOverlay
                results={diceResult?.results ?? null}
                attackType={diceResult?.attackType ?? null}
                hits={diceResult?.hits ?? 0}
                damageReduced={diceResult?.damageReduced}
                isOpponentAttack={diceResult?.isOpponentAttack ?? false}
                onClose={handleCloseDiceResult}
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
