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
import type { MatchState } from '../../engine/types';
import type { SummonerWarsCore } from './domain';
import { SW_COMMANDS } from './domain';
import { isUndeadCard, isPlagueZombieCard, isFortressUnit } from './domain/ids';
import { GameDebugPanel } from '../../components/game/framework/widgets/GameDebugPanel';
import { SummonerWarsDebugConfig } from './debug-config';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';
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
import type { Card, BoardUnit, BoardStructure, CellCoord, UnitCard, EventCard, PlayerId } from './domain/types';
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
import { useCellInteraction } from './ui/useCellInteraction';
import { StatusBanners } from './ui/StatusBanners';
import { BoardGrid, getCellPosition } from './ui/BoardGrid';
import { AbilityButtonsPanel } from './ui/AbilityButtonsPanel';
import { SUMMONER_WARS_AUDIO_CONFIG, resolveDiceRollSound, resolveAttackSoundKey, resolveDamageSoundKey } from './audio.config';
import { SUMMONER_WARS_MANIFEST } from './manifest';

type Props = GameBoardProps<SummonerWarsCore>;

/** 默认网格配置 */
const DEFAULT_GRID_CONFIG: GridConfig = {
  rows: BOARD_ROWS,
  cols: BOARD_COLS,
  bounds: { x: 0.038, y: 0.135, width: 0.924, height: 0.73 },
};

export const SummonerWarsBoard: React.FC<Props> = ({
  ctx, G, moves, playerID, reset, matchData, isMultiplayer,
}) => {
  const isGameOver = ctx.gameover;
  const gameMode = useGameMode();
  const isLocalMatch = gameMode ? !gameMode.isMultiplayer : !isMultiplayer;
  const isSpectator = !!gameMode?.isSpectator;
  const isTutorialMode = gameMode?.mode === 'tutorial';
  const { t } = useTranslation('game-summonerwars');

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
    moves[SW_COMMANDS.SELECT_FACTION]?.({ factionId });
  }, [moves]);
  const handlePlayerReady = useCallback(() => {
    moves[SW_COMMANDS.PLAYER_READY]?.({});
  }, [moves]);
  const handleHostStart = useCallback(() => {
    moves[SW_COMMANDS.HOST_START_GAME]?.({});
  }, [moves]);

  // 教学系统集成
  useTutorialBridge(G.sys.tutorial, moves as Record<string, unknown>);
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
  const MAP_INTERNAL_TARGETS = useMemo(() => new Set([
    'sw-my-summoner', 'sw-enemy-summoner', 'sw-my-gate', 'sw-start-archer',
  ]), []);
  const mapPanTarget = useMemo(() => {
    if (!isTutorialActive || !tutorialStep?.highlightTarget) return null;
    return MAP_INTERNAL_TARGETS.has(tutorialStep.highlightTarget) ? tutorialStep.highlightTarget : null;
  }, [isTutorialActive, tutorialStep?.highlightTarget, MAP_INTERNAL_TARGETS]);
  // 聚焦到单个单位/建筑时放大到 1.8x，让卡牌清晰可见
  const MAP_PAN_SCALE = 1.8;

  // 重赛系统
  const { state: rematchState, vote: handleRematchVote } = useRematch();

  // 初始化精灵图
  useEffect(() => { initSpriteAtlases(); }, []);

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
  const activePlayerId = core.currentPlayer ?? ctx.currentPlayer;
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
    abilityMode, setAbilityMode,
    soulTransferMode, setSoulTransferMode,
    mindCaptureMode, setMindCaptureMode,
    afterAttackAbilityMode, setAfterAttackAbilityMode,
    rapidFireMode, setRapidFireMode,
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

  // 格子交互 Hook
  const interaction = useCellInteraction({
    core, moves: moves as Record<string, (payload?: unknown) => void>,
    currentPhase, isMyTurn, isGameOver: !!isGameOver,
    myPlayerId, activePlayerId, myHand, fromViewCoord,
    undoSnapshotCount: G.sys?.undo?.snapshots?.length ?? 0,
    abilityMode, setAbilityMode, soulTransferMode,
    mindCaptureMode, setMindCaptureMode,
    afterAttackAbilityMode, setAfterAttackAbilityMode,
    rapidFireMode,
  });

  // 关闭骰子结果 → 播放攻击动画
  const handleCloseDiceResult = useCallback(() => {
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
  }, [rawCloseDiceResult, clearPendingAttack, flushPendingDestroys, fxBus]);

  // 近战攻击命中回调（卡牌冲到目标时触发，播放伤害特效）
  const handleAttackHit = useCallback(() => {
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
  }, [pendingAttackRef, fxBus, releaseDamageSnapshot]);

  // 近战攻击回弹完成回调（卡牌回到原位后触发，flush 摧毁效果）
  const handleAttackReturn = useCallback(() => {
    clearPendingAttack();
    flushPendingDestroys();
    setAttackAnimState(null);
  }, [clearPendingAttack, flushPendingDestroys]);

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

  // StatusBanners 回调
  const handleCancelAbility = useCallback(() => {
    // 寒冰冲撞推拉步骤跳过：仍然发送命令（造成伤害但不推拉）
    if (abilityMode?.abilityId === 'ice_ram' && abilityMode.step === 'selectPushDirection'
      && abilityMode.targetPosition && abilityMode.structurePosition) {
      moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
        abilityId: 'ice_ram',
        sourceUnitId: 'ice_ram',
        targetPosition: abilityMode.targetPosition,
        structurePosition: abilityMode.structurePosition,
      });
    }
    setAbilityMode(null);
  }, [setAbilityMode, abilityMode, moves]);
  const handleCancelBeforeAttack = useCallback(() => interaction.handleCancelBeforeAttack(), [interaction]);
  const handleCancelBloodSummon = useCallback(() => {
    interaction.setBloodSummonMode(null);
    // 清除血契召唤期间选中的手牌高亮
    interaction.handleCardSelect(null);
  }, [interaction]);
  const handleContinueBloodSummon = useCallback(() => {
    // 直接设置状态，避免经过 handleCardSelect 触发 clearAllEventModes
    interaction.setBloodSummonMode({
      step: 'selectTarget',
      cardId: interaction.bloodSummonMode?.cardId,
      completedCount: interaction.bloodSummonMode?.completedCount,
    });
  }, [interaction]);
  const handleCancelAnnihilate = useCallback(() => {
    interaction.setAnnihilateMode(null);
    interaction.handleCardSelect(null);
  }, [interaction]);
  const handleConfirmAnnihilateTargets = useCallback(() => {
    if (!interaction.annihilateMode) return;
    interaction.setAnnihilateMode({
      ...interaction.annihilateMode,
      step: 'selectDamageTarget',
      currentTargetIndex: 0,
      damageTargets: [],
    });
  }, [interaction]);
  // 除灭：跳过当前目标的伤害分配（描述中"你可以"表示可选）
  const handleSkipAnnihilateDamage = useCallback(() => {
    if (!interaction.annihilateMode || interaction.annihilateMode.step !== 'selectDamageTarget') return;
    const newDamageTargets = [...interaction.annihilateMode.damageTargets];
    newDamageTargets[interaction.annihilateMode.currentTargetIndex] = null;
    const nextIndex = interaction.annihilateMode.currentTargetIndex + 1;
    if (nextIndex < interaction.annihilateMode.selectedTargets.length) {
      interaction.setAnnihilateMode({ ...interaction.annihilateMode, damageTargets: newDamageTargets, currentTargetIndex: nextIndex });
    } else {
      moves[SW_COMMANDS.PLAY_EVENT]?.({
        cardId: interaction.annihilateMode.cardId,
        targets: interaction.annihilateMode.selectedTargets,
        damageTargets: newDamageTargets,
      });
      interaction.setAnnihilateMode(null);
    }
  }, [interaction, moves]);
  const handleConfirmSoulTransfer = useCallback(() => {
    if (!soulTransferMode) return;
    moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
      abilityId: 'soul_transfer',
      sourceUnitId: soulTransferMode.sourceUnitId,
      targetPosition: soulTransferMode.victimPosition,
    });
    setSoulTransferMode(null);
  }, [soulTransferMode, moves, setSoulTransferMode]);
  const handleSkipSoulTransfer = useCallback(() => setSoulTransferMode(null), [setSoulTransferMode]);
  const handleSkipFuneralPyre = useCallback(() => {
    if (!interaction.funeralPyreMode) return;
    moves[SW_COMMANDS.FUNERAL_PYRE_HEAL]?.({
      cardId: interaction.funeralPyreMode.cardId,
      skip: true,
    });
    interaction.setFuneralPyreMode(null);
  }, [interaction, moves]);

  // 欺心巫族事件卡回调
  const handleConfirmMindControl = useCallback(() => interaction.handleConfirmMindControl(), [interaction]);
  const handleCancelMindControl = useCallback(() => {
    interaction.setMindControlMode(null);
    interaction.handleCardSelect(null);
  }, [interaction]);
  const handleConfirmEntanglement = useCallback(() => interaction.handleConfirmEntanglement(), [interaction]);
  const handleCancelEntanglement = useCallback(() => {
    interaction.setChantEntanglementMode(null);
    interaction.handleCardSelect(null);
  }, [interaction]);
  const handleConfirmSneak = useCallback(() => interaction.handleConfirmSneak(), [interaction]);
  const handleCancelSneak = useCallback(() => {
    interaction.setSneakMode(null);
    interaction.handleCardSelect(null);
  }, [interaction]);
  const handleConfirmGlacialShift = useCallback(() => interaction.handleConfirmGlacialShift(), [interaction]);
  const handleCancelGlacialShift = useCallback(() => {
    interaction.setGlacialShiftMode(null);
    interaction.handleCardSelect(null);
  }, [interaction]);
  const handleWithdrawCostSelect = useCallback((costType: 'charge' | 'magic') => {
    if (!interaction.withdrawMode) return;
    interaction.setWithdrawMode({ ...interaction.withdrawMode, step: 'selectPosition', costType });
  }, [interaction]);
  const handleCancelWithdraw = useCallback(() => interaction.setWithdrawMode(null), [interaction]);
  const handleConfirmStun = useCallback((direction: 'push' | 'pull', distance: number) => {
    interaction.handleConfirmStun(direction, distance);
  }, [interaction]);
  const handleCancelStun = useCallback(() => {
    interaction.setStunMode(null);
    interaction.handleCardSelect(null);
  }, [interaction]);
  const handleCancelHypnoticLure = useCallback(() => {
    interaction.setHypnoticLureMode(null);
    interaction.handleCardSelect(null);
  }, [interaction]);

  // 心灵捕获 + 攻击后技能回调
  const handleConfirmMindCapture = useCallback((choice: 'control' | 'damage') => {
    interaction.handleConfirmMindCapture(choice);
  }, [interaction]);
  const handleCancelAfterAttackAbility = useCallback(() => setAfterAttackAbilityMode(null), [setAfterAttackAbilityMode]);

  // 连续射击确认/取消
  const handleConfirmRapidFire = useCallback(() => {
    if (!rapidFireMode) return;
    moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({ abilityId: 'rapid_fire', sourceUnitId: rapidFireMode.sourceUnitId });
    setRapidFireMode(null);
  }, [moves, rapidFireMode, setRapidFireMode]);
  const handleCancelRapidFire = useCallback(() => setRapidFireMode(null), [setRapidFireMode]);
  // 鲜血符文选择回调
  const handleConfirmBloodRune = useCallback((choice: 'damage' | 'charge') => {
    if (!abilityMode || abilityMode.abilityId !== 'blood_rune') return;
    moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
      abilityId: 'blood_rune',
      sourceUnitId: abilityMode.sourceUnitId,
      choice,
    });
    setAbilityMode(null);
  }, [abilityMode, moves, setAbilityMode]);
  // 寒冰碎屑确认回调
  const handleConfirmIceShards = useCallback(() => {
    if (!abilityMode || abilityMode.abilityId !== 'ice_shards') return;
    moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
      abilityId: 'ice_shards',
      sourceUnitId: abilityMode.sourceUnitId,
    });
    setAbilityMode(null);
  }, [abilityMode, moves, setAbilityMode]);
  // 喂养巨食兽自毁回调
  const handleConfirmFeedBeastSelfDestroy = useCallback(() => {
    if (!abilityMode || abilityMode.abilityId !== 'feed_beast') return;
    moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
      abilityId: 'feed_beast',
      sourceUnitId: abilityMode.sourceUnitId,
      choice: 'self_destroy',
    });
    setAbilityMode(null);
  }, [abilityMode, moves, setAbilityMode]);
  const handleConfirmTelekinesis = useCallback((direction: 'push' | 'pull') => {
    interaction.handleConfirmTelekinesis(direction);
  }, [interaction]);
  const handleCancelTelekinesis = useCallback(() => interaction.setTelekinesisTargetMode(null), [interaction]);
  // afterMove 技能：充能自身
  const handleAfterMoveSelfCharge = useCallback(() => {
    if (!abilityMode) return;
    moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
      abilityId: abilityMode.abilityId,
      sourceUnitId: abilityMode.sourceUnitId,
      choice: 'self',
    });
    setAbilityMode(null);
  }, [abilityMode, moves, setAbilityMode]);
  // 冰霜战斧：进入附加目标选择
  const handleFrostAxeAttach = useCallback(() => {
    if (!abilityMode || abilityMode.abilityId !== 'frost_axe') return;
    setAbilityMode({ ...abilityMode, step: 'selectAttachTarget' });
  }, [abilityMode, setAbilityMode]);

  const handleSaveLayout = useCallback(async (config: BoardLayoutConfig) => saveSummonerWarsLayout(config), []);

  const debugPanel = !isSpectator ? (
    <GameDebugPanel G={G} ctx={ctx} moves={moves} playerID={playerID} autoSwitch={!isMultiplayer}>
      <SummonerWarsDebugConfig G={G} ctx={ctx} moves={moves} />
      <button
        onClick={() => { if (isEditingLayout) { void handleExitLayoutEditor(); return; } setIsEditingLayout(true); }}
        className="px-2 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-500"
      >
        {isEditingLayout ? t('layoutEditor.exitEdit') : t('layoutEditor.editLayout')}
      </button>
    </GameDebugPanel>
  ) : null;

  return (
    <UndoProvider value={{ G, ctx, moves, playerID, isGameOver: !!isGameOver, isLocalMode: isLocalMatch }}>
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
              onSelect={handleSelectFaction}
              onReady={handlePlayerReady}
              onStart={handleHostStart}
            />
            {debugPanel}
          </>
        </TutorialSelectionGate>
      ) : (
        <div className="h-[100dvh] w-full bg-neutral-900 overflow-hidden relative flex flex-col">
          {isEditingLayout ? (
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
            <div className="flex-1 relative overflow-hidden">
              {/* 地图层 */}
              <div className="absolute inset-0 z-10 flex items-center justify-center" data-testid="sw-map-layer" data-tutorial-id="sw-map-area" style={shakeStyle}>
                <MapContainer
                  className="w-full h-full flex items-center justify-center px-[10vw]"
                  initialScale={1}
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
                      />
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
                <div className="absolute inset-y-0 left-0" style={{ width: '10vw', background: 'linear-gradient(to right, rgba(0,0,0,0.95), rgba(0,0,0,0.75), rgba(0,0,0,0))' }} />
                {/* 右侧黑边渐变 */}
                <div className="absolute inset-y-0 right-0" style={{ width: '10vw', background: 'linear-gradient(to left, rgba(0,0,0,0.95), rgba(0,0,0,0.75), rgba(0,0,0,0))' }} />

                {/* 全局暗角 (Vignette) 效果 */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0.5) 100%)',
                    mixBlendMode: 'multiply'
                  }}
                />

                {/* 右上：对手名+魔力条 + 持续效果 */}
                <div className="absolute top-3 right-3 pointer-events-auto flex flex-col items-end gap-2" data-testid="sw-opponent-bar">
                  <div className="flex items-center gap-3 bg-black/60 px-3 py-2 rounded-lg border border-slate-600/20">
                    <span className="text-sm text-white font-medium text-opacity-100">
                      {matchData?.[playerID === '1' ? 0 : 1]?.name ?? t('player.opponent')}
                    </span>
                    <EnergyBar current={opponentMagic} testId="sw-energy-opponent" />
                  </div>

                  {/* 对手持续效果 - 紧贴魔力条下方 */}
                  {opponentActiveEvents.length > 0 && (
                    <div className="flex flex-row-reverse items-start gap-1.5" data-testid="sw-opponent-active-events">
                      {opponentActiveEvents.map((ev) => {
                        const sprite = getEventSpriteConfig(ev);
                        return (
                          <div key={ev.id} className="relative cursor-pointer group" onClick={() => handleMagnifyCard(ev)}>
                            <CardSprite atlasId={sprite.atlasId} frameIndex={sprite.frameIndex} className="w-[4.5vw] rounded shadow-lg border border-amber-500/40 hover:border-amber-400 transition-all hover:scale-105" />
                            <div className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/20 transition-colors" />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[0.6vw] text-amber-200 text-center py-0.5 rounded-b truncate px-1 border-t border-amber-500/20">{ev.name}</div>
                          </div>
                        );
                      })}
                      <span className="text-[0.65vw] text-amber-400/70 font-bold tracking-tight bg-black/40 px-1.5 py-0.5 rounded border border-amber-900/30 backdrop-blur-[2px] mt-1">{t('ui.activeEvents')}</span>
                    </div>
                  )}
                </div>

                {/* 左下区域：玩家名+魔力条 + 持续效果 + 抽牌堆 */}
                <div className="absolute left-3 bottom-3 z-20 pointer-events-auto flex flex-col items-start gap-3" data-testid="sw-player-bar" data-tutorial-id="sw-player-bar">
                  {/* 玩家持续效果 - 放在魔力条上方 */}
                  {myActiveEvents.length > 0 && (
                    <div className="flex flex-row items-end gap-1.5 mb-1" data-testid="sw-my-active-events">
                      <span className="text-[0.65vw] text-amber-400/70 font-bold tracking-tight bg-black/40 px-1.5 py-0.5 rounded border border-amber-900/30 backdrop-blur-[2px] mb-1">{t('ui.activeEvents')}</span>
                      {myActiveEvents.map((ev) => {
                        const sprite = getEventSpriteConfig(ev);
                        return (
                          <div key={ev.id} className="relative cursor-pointer group" onClick={() => handleMagnifyCard(ev)}>
                            <CardSprite atlasId={sprite.atlasId} frameIndex={sprite.frameIndex} className="w-[4.5vw] rounded shadow-lg border border-amber-500/40 hover:border-amber-400 transition-all hover:scale-105" />
                            <div className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/20 transition-colors" />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[0.6vw] text-amber-200 text-center py-0.5 rounded-b truncate px-1 border-t border-amber-500/20">{ev.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-3 bg-black/60 px-3 py-2 rounded-lg border border-slate-600/20">
                    <span className="text-sm text-white font-medium text-opacity-100">
                      {matchData?.[playerID === '1' ? 1 : 0]?.name ?? t('player.self')}
                    </span>
                    <EnergyBar current={myMagic} testId="sw-energy-player" />
                  </div>
                  <div data-tutorial-id="sw-deck-draw" className="mt-8">
                    <DeckPile type="draw" count={myDeckCount} position="left" testId="sw-deck-draw" />
                  </div>
                </div>

                {/* 右下区域：结束阶段按钮 + 弃牌堆 */}
                <div className="absolute right-3 bottom-3 z-20 pointer-events-auto flex flex-col items-end gap-3" data-testid="sw-phase-controls">
                  <div className="flex gap-2">
                    {currentPhase === 'magic' && isMyTurn && interaction.selectedCardsForDiscard.length > 0 && (
                      <GameButton onClick={interaction.handleConfirmDiscard} variant="secondary" size="sm" data-testid="sw-confirm-discard">
                        {t('action.discardSelected', { count: interaction.selectedCardsForDiscard.length })}
                      </GameButton>
                    )}
                    <GameButton onClick={interaction.handleEndPhase} disabled={!isMyTurn} variant={interaction.endPhaseConfirmPending ? 'danger' : 'primary'} size="md" data-testid="sw-end-phase" data-tutorial-id="sw-end-phase-btn">
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

                {/* 右侧：阶段指示器 */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-auto" data-testid="sw-phase-tracker" data-tutorial-id="sw-phase-tracker">
                  <PhaseTracker
                    currentPhase={currentPhase}
                    turnNumber={core.turnNumber}
                    isMyTurn={isMyTurn}
                    moveCount={core.players[playerID === '1' ? '1' : '0']?.moveCount ?? 0}
                    attackCount={core.players[playerID === '1' ? '1' : '0']?.attackCount ?? 0}
                    className="bg-slate-900/40 backdrop-blur-sm px-3 py-3 rounded-lg border border-slate-700/20 min-w-[8rem]"
                  />
                </div>

                {/* 顶部中央：提示横幅 */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto z-30" data-tutorial-id="sw-action-banner">
                  <StatusBanners
                    currentPhase={currentPhase}
                    isMyTurn={isMyTurn}
                    core={G}
                    abilityMode={abilityMode}
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
                    rapidFireMode={rapidFireMode}
                    onConfirmRapidFire={handleConfirmRapidFire}
                    onCancelRapidFire={handleCancelRapidFire}
                    onConfirmTelekinesis={handleConfirmTelekinesis}
                    onCancelTelekinesis={handleCancelTelekinesis}
                    onAfterMoveSelfCharge={handleAfterMoveSelfCharge}
                    onFrostAxeAttach={handleFrostAxeAttach}
                  />
                </div>

                {/* 底部：手牌区 */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-auto z-30" data-tutorial-id="sw-hand-area">
                  <HandArea
                    cards={myHand}
                    phase={currentPhase}
                    isMyTurn={isMyTurn}
                    currentMagic={myMagic}
                    selectedCardId={interaction.selectedHandCardId}
                    selectedCardIds={abilityMode?.step === 'selectCards'
                      ? interaction.abilitySelectedCardIds
                      : interaction.selectedCardsForDiscard}
                    onCardClick={interaction.handleCardClick}
                    onCardSelect={interaction.handleCardSelect}
                    onPlayEvent={interaction.handlePlayEvent}
                    onMagnifyCard={handleMagnifyCard}
                    bloodSummonSelectingCard={interaction.bloodSummonMode?.step === 'selectCard'}
                  />
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
                      moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
                        abilityId: 'infection', sourceUnitId: abilityMode.sourceUnitId,
                        targetCardId: card.id, targetPosition: abilityMode.targetPosition,
                      });
                      setAbilityMode(null);
                    } else if (abilityMode.abilityId === 'fortress_power') {
                      moves[SW_COMMANDS.ACTIVATE_ABILITY]?.({
                        abilityId: 'fortress_power', sourceUnitId: abilityMode.sourceUnitId,
                        targetCardId: card.id,
                      });
                      setAbilityMode(null);
                    } else {
                      setAbilityMode(abilityMode ? { ...abilityMode, step: 'selectPosition', selectedCardId: card.id } : null);
                    }
                  }}
                  onCancel={() => setAbilityMode(null)}
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
                moves={moves as Record<string, (payload?: unknown) => void>}
                setAbilityMode={setAbilityMode}
                setWithdrawMode={interaction.setWithdrawMode}
              />

              {/* 卡牌放大预览 */}
              <MagnifyOverlay isOpen={!!magnifiedCard} onClose={() => setMagnifiedCard(null)} containerClassName="max-h-[85vh] max-w-[90vw]">
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
                isOpponentAttack={diceResult?.isOpponentAttack ?? false}
                onClose={handleCloseDiceResult}
              />

              {/* 结束页面遮罩（视觉序列进行中延迟显示，确保死亡动画播完） */}
              <EndgameOverlay
                isGameOver={!!isGameOver && !isVisualBusy}
                result={isGameOver}
                playerID={playerID}
                reset={isSpectator ? undefined : reset}
                isMultiplayer={isSpectator ? false : isMultiplayer}
                totalPlayers={matchData?.length}
                rematchState={rematchState}
                onVote={isSpectator ? undefined : handleRematchVote}
              />

              {/* 调试面板 */}
              {debugPanel}
            </div>
          )}
        </div>
      )}
    </UndoProvider>
  );
};

export default SummonerWarsBoard;
