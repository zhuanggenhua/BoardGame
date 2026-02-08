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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { MatchState } from '../../engine/types';
import type { SummonerWarsCore } from './domain';
import { SW_COMMANDS } from './domain';
import { GameDebugPanel } from '../../components/GameDebugPanel';
import { SummonerWarsDebugConfig } from './debug-config';
import { EndgameOverlay } from '../../components/game/EndgameOverlay';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { useGameAudio } from '../../lib/audio/useGameAudio';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { BoardLayoutEditor } from '../../components/game/framework/BoardLayoutEditor';
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
import { BoardEffectsLayer, useBoardEffects, useScreenShake } from './ui/BoardEffects';
import type { Card, BoardUnit, BoardStructure, CellCoord, UnitCard, PlayerId } from './domain/types';
import { CardSelectorOverlay } from './ui/CardSelectorOverlay';
import { DiscardPileOverlay } from './ui/DiscardPileOverlay';
import { getPlayerUnits } from './domain/helpers';
import { FactionSelection } from './ui/FactionSelectionAdapter';
import type { FactionId } from './domain/types';
import { BOARD_ROWS, BOARD_COLS } from './config/board';
// 提取的子模块
import { CardSprite } from './ui/CardSprite';
import { getUnitSpriteConfig, getStructureSpriteConfig, getEventSpriteConfig } from './ui/spriteHelpers';
import { useGameEvents } from './ui/useGameEvents';
import { useCellInteraction } from './ui/useCellInteraction';
import { StatusBanners } from './ui/StatusBanners';
import { BoardGrid, getCellPosition } from './ui/BoardGrid';
import { SUMMONER_WARS_AUDIO_CONFIG } from './audio.config';

type Props = BoardProps<MatchState<SummonerWarsCore>>;

/** 默认网格配置 */
const DEFAULT_GRID_CONFIG: GridConfig = {
  rows: BOARD_ROWS,
  cols: BOARD_COLS,
  bounds: { x: 0.038, y: 0.135, width: 0.924, height: 0.73 },
};

export const SummonerWarsBoard: React.FC<Props> = ({
  ctx, G, moves, events, playerID, reset, matchData, isMultiplayer,
}) => {
  const isGameOver = ctx.gameover;
  const gameMode = useGameMode();
  const isLocalMatch = gameMode ? !gameMode.isMultiplayer : !isMultiplayer;
  const isSpectator = !!gameMode?.isSpectator;

  // 阵营选择状态
  const rootPid = (playerID || '0') as PlayerId;
  const isInFactionSelection = !G.core.hostStarted;

  // 玩家名称映射
  const playerNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const pid of ['0', '1']) {
      names[pid] = matchData?.find(p => String(p.id) === pid)?.name ?? (pid === '0' ? '玩家1' : '玩家2');
    }
    return names;
  }, [matchData]);

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
  const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();

  // 教程纯信息步骤时禁止地图拖拽/缩放（防止蓝色高亮框与元素脱节）
  // 有 allowedCommands 或 advanceOnEvents 的步骤需要用户与地图交互，不禁用
  const mapInteractionDisabled = isTutorialActive && !!tutorialStep
    && !tutorialStep.requireAction
    && !(tutorialStep.allowedCommands && tutorialStep.allowedCommands.length > 0)
    && !(tutorialStep.advanceOnEvents && tutorialStep.advanceOnEvents.length > 0);

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
  // 棋盘特效
  const { effects: boardEffects, pushEffect: pushBoardEffect, removeEffect: removeBoardEffect } = useBoardEffects();
  // 全屏震动
  const { shakeStyle, triggerShake } = useScreenShake();

  // 攻击动画状态
  const [attackAnimState, setAttackAnimState] = useState<{
    attacker: CellCoord; target: CellCoord; hits: number;
  } | null>(null);
  const [hitStopTarget, setHitStopTarget] = useState<CellCoord | null>(null);

  // 事件流消费 Hook
  const {
    diceResult, deathGhosts,
    abilityMode, setAbilityMode,
    soulTransferMode, setSoulTransferMode,
    mindCaptureMode, setMindCaptureMode,
    afterAttackAbilityMode, setAfterAttackAbilityMode,
    pendingAttackRef, handleCloseDiceResult: rawCloseDiceResult,
    clearPendingAttack, flushPendingDestroys,
  } = useGameEvents({
    G, core, myPlayerId,
    pushDestroyEffect: (data) => pushDestroyEffect(data),
    pushBoardEffect: (data) => pushBoardEffect(data as Parameters<typeof pushBoardEffect>[0]),
    triggerShake: (intensity, type) => triggerShake(intensity as 'normal' | 'strong', type as 'impact' | 'hit'),
  });

  // 格子交互 Hook
  const interaction = useCellInteraction({
    core, moves: moves as Record<string, (payload?: unknown) => void>,
    currentPhase, isMyTurn, isGameOver: !!isGameOver,
    myPlayerId, activePlayerId, myHand, fromViewCoord,
    abilityMode, setAbilityMode, soulTransferMode,
    mindCaptureMode, setMindCaptureMode,
    afterAttackAbilityMode, setAfterAttackAbilityMode,
  });

  // 关闭骰子结果 → 播放攻击动画
  const handleCloseDiceResult = useCallback(() => {
    const pending = rawCloseDiceResult();
    if (!pending) return;

    if (pending.attackType === 'ranged') {
      // 远程攻击：骰子结束后稍作延迟再播放特效
      clearPendingAttack();
      const attackSnapshot = { ...pending };
      window.setTimeout(() => {
        const hitIntensity = attackSnapshot.hits >= 3 ? 'strong' : 'normal';
        pushBoardEffect({ type: 'shockwave', position: attackSnapshot.target, sourcePosition: attackSnapshot.attacker, intensity: hitIntensity, attackType: attackSnapshot.attackType });
        for (const dmg of attackSnapshot.damages) {
          pushBoardEffect({ type: 'damage', position: dmg.position, intensity: dmg.damage >= 3 ? 'strong' : 'normal', damageAmount: dmg.damage });
        }
        if (attackSnapshot.hits >= 3) triggerShake('normal', 'hit');
        flushPendingDestroys();
      }, 180);
    } else {
      // 近战攻击：启动卡牌本体碰撞动画
      setAttackAnimState({ attacker: pending.attacker, target: pending.target, hits: pending.hits });
    }
  }, [rawCloseDiceResult, clearPendingAttack, pushBoardEffect, triggerShake, flushPendingDestroys]);

  // 卡牌碰撞动画完成回调
  const handleAttackAnimComplete = useCallback(() => {
    const pending = pendingAttackRef.current;
    if (!pending) { setAttackAnimState(null); return; }
    clearPendingAttack();

    const hitIntensity = pending.hits >= 3 ? 'strong' : 'normal';
    if (pending.hits > 0) {
      setHitStopTarget(pending.target);
      setTimeout(() => setHitStopTarget(null), 200);
    }
    pushBoardEffect({ type: 'shockwave', position: pending.target, sourcePosition: pending.attacker, intensity: hitIntensity, attackType: pending.attackType });
    for (const dmg of pending.damages) {
      pushBoardEffect({ type: 'damage', position: dmg.position, intensity: dmg.damage >= 3 ? 'strong' : 'normal', damageAmount: dmg.damage });
    }
    if (pending.hits >= 3) triggerShake('normal', 'hit');
    flushPendingDestroys();
    setAttackAnimState(null);
  }, [pendingAttackRef, clearPendingAttack, pushBoardEffect, pushDestroyEffect, triggerShake, flushPendingDestroys]);

  // 卡牌放大
  const handleMagnifyCard = useCallback((card: Card) => {
    const spriteIndex = 'spriteIndex' in card ? card.spriteIndex : undefined;
    const spriteAtlas = 'spriteAtlas' in card ? card.spriteAtlas : undefined;
    if (spriteIndex === undefined) return;
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

  // StatusBanners 回调
  const handleCancelAbility = useCallback(() => setAbilityMode(null), [setAbilityMode]);
  const handleCancelBloodSummon = useCallback(() => interaction.setBloodSummonMode(null), [interaction]);
  const handleContinueBloodSummon = useCallback(() => {
    interaction.setBloodSummonMode({
      step: 'selectTarget',
      cardId: interaction.bloodSummonMode?.cardId,
      completedCount: interaction.bloodSummonMode?.completedCount,
    });
  }, [interaction]);
  const handleCancelAnnihilate = useCallback(() => interaction.setAnnihilateMode(null), [interaction]);
  const handleConfirmAnnihilateTargets = useCallback(() => {
    if (!interaction.annihilateMode) return;
    interaction.setAnnihilateMode({
      ...interaction.annihilateMode,
      step: 'selectDamageTarget',
      currentTargetIndex: 0,
      damageTargets: [],
    });
  }, [interaction]);
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
  const handleCancelMindControl = useCallback(() => interaction.setMindControlMode(null), [interaction]);
  const handleConfirmStun = useCallback((direction: 'push' | 'pull', distance: number) => {
    interaction.handleConfirmStun(direction, distance);
  }, [interaction]);
  const handleCancelStun = useCallback(() => interaction.setStunMode(null), [interaction]);
  const handleCancelHypnoticLure = useCallback(() => interaction.setHypnoticLureMode(null), [interaction]);

  // 心灵捕获 + 攻击后技能回调
  const handleConfirmMindCapture = useCallback((choice: 'control' | 'damage') => {
    interaction.handleConfirmMindCapture(choice);
  }, [interaction]);
  const handleCancelAfterAttackAbility = useCallback(() => setAfterAttackAbilityMode(null), [setAfterAttackAbilityMode]);
  const handleConfirmTelekinesis = useCallback((direction: 'push' | 'pull') => {
    interaction.handleConfirmTelekinesis(direction);
  }, [interaction]);
  const handleCancelTelekinesis = useCallback(() => interaction.setTelekinesisTargetMode(null), [interaction]);

  const handleSaveLayout = useCallback(async (config: BoardLayoutConfig) => saveSummonerWarsLayout(config), []);

  return (
    <UndoProvider value={{ G, ctx, moves, playerID, isGameOver: !!isGameOver, isLocalMode: isLocalMatch }}>
      {/* 阵营选择阶段 */}
      {isInFactionSelection ? (
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
      ) : (
      <div className="h-[100dvh] w-full bg-neutral-900 overflow-hidden relative flex flex-col">
        {isEditingLayout ? (
          <div className="flex-1 overflow-auto p-4">
            <div className="mb-2 flex items-center gap-2">
              <button onClick={handleExitLayoutEditor} className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600">← 返回游戏</button>
            </div>
            <BoardLayoutEditor
              initialConfig={layoutConfig ?? undefined}
              backgroundImage="/assets/summonerwars/common/map.png"
              onChange={setLayoutConfig}
              onSave={handleSaveLayout}
              saveLabel="保存布局"
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
                containerTestId="sw-map-container"
                contentTestId="sw-map-content"
                scaleTestId="sw-map-scale"
              >
                <div className="relative inline-block">
                  <div className="relative">
                    <OptimizedImage
                      src="summonerwars/common/map.png"
                      alt=""
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
                      bloodSummonHighlights={interaction.bloodSummonHighlights}
                      annihilateHighlights={interaction.annihilateHighlights}
                      annihilateMode={interaction.annihilateMode}
                      abilityMode={abilityMode}
                      mindControlHighlights={interaction.mindControlHighlights}
                      mindControlSelectedTargets={interaction.mindControlMode?.selectedTargets ?? []}
                      stunHighlights={interaction.stunHighlights}
                      hypnoticLureHighlights={interaction.hypnoticLureHighlights}
                      afterAttackAbilityHighlights={interaction.afterAttackAbilityHighlights}
                      attackAnimState={attackAnimState}
                      hitStopTarget={hitStopTarget}
                      deathGhosts={deathGhosts}
                      pendingAttackRef={pendingAttackRef}
                      onCellClick={interaction.handleCellClick}
                      onAttackAnimComplete={handleAttackAnimComplete}
                      onMagnifyUnit={handleMagnifyBoardUnit}
                      onMagnifyStructure={handleMagnifyBoardStructure}
                    />
                    {/* 摧毁效果层 */}
                    <DestroyEffectsLayer
                      effects={destroyEffects}
                      getCellPosition={(row, col) => {
                        const vc = toViewCoord({ row, col });
                        return getCellPosition(vc.row, vc.col, currentGrid);
                      }}
                      onEffectComplete={removeDestroyEffect}
                    />
                    {/* 棋盘特效层 */}
                    <BoardEffectsLayer
                      effects={boardEffects}
                      getCellPosition={(row, col) => {
                        const vc = toViewCoord({ row, col });
                        return getCellPosition(vc.row, vc.col, currentGrid);
                      }}
                      onEffectComplete={removeBoardEffect}
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

              {/* 右上：对手名+魔力条 */}
              <div className="absolute top-3 right-3 pointer-events-auto flex flex-col items-end gap-2" data-testid="sw-opponent-bar">
                <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-600/20">
                  <span className="text-sm text-white font-medium text-opacity-100">
                    {matchData?.[playerID === '1' ? 0 : 1]?.name ?? '对手'}
                  </span>
                  <EnergyBar current={opponentMagic} testId="sw-energy-opponent" />
                </div>
              </div>

              {/* 右侧：对手持续效果 */}
              {opponentActiveEvents.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex flex-row-reverse items-center gap-2"
                  style={{ marginTop: '-8rem' }} data-testid="sw-opponent-active-events">
                  <span className="text-[0.8vw] text-amber-300/80 font-bold tracking-wider writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>对方持续效果</span>
                  <div className="flex flex-col gap-1">
                    {opponentActiveEvents.map((ev) => {
                      const sprite = getEventSpriteConfig(ev);
                      return (
                        <div key={ev.id} className="relative cursor-pointer group" onClick={() => handleMagnifyCard(ev)}>
                          <CardSprite atlasId={sprite.atlasId} frameIndex={sprite.frameIndex} className="w-[7vw] rounded shadow-md border border-amber-500/40" />
                          <div className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/30 transition-colors" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[0.7vw] text-amber-200 text-center py-[0.1vw] rounded-b truncate px-[0.2vw]">{ev.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 左侧：己方持续效果 */}
              {myActiveEvents.length > 0 && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex flex-row items-center gap-2" data-testid="sw-my-active-events">
                  <span className="text-[0.8vw] text-amber-300/80 font-bold tracking-wider writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>持续效果</span>
                  <div className="flex flex-col gap-1">
                    {myActiveEvents.map((ev) => {
                      const sprite = getEventSpriteConfig(ev);
                      return (
                        <div key={ev.id} className="relative cursor-pointer group" onClick={() => handleMagnifyCard(ev)}>
                          <CardSprite atlasId={sprite.atlasId} frameIndex={sprite.frameIndex} className="w-[7vw] rounded shadow-md border border-amber-500/40" />
                          <div className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/30 transition-colors" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[0.7vw] text-amber-200 text-center py-[0.1vw] rounded-b truncate px-[0.2vw]">{ev.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 左下区域：玩家名+魔力条 + 抽牌堆 */}
              <div className="absolute left-3 bottom-3 z-20 pointer-events-auto flex flex-col items-start gap-[3.75rem]" data-testid="sw-player-bar" data-tutorial-id="sw-player-bar">
                <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-600/20">
                  <span className="text-sm text-white font-medium text-opacity-100">
                    {matchData?.[playerID === '1' ? 1 : 0]?.name ?? '玩家'}
                  </span>
                  <EnergyBar current={myMagic} testId="sw-energy-player" />
                </div>
                <div data-tutorial-id="sw-deck-draw">
                  <DeckPile type="draw" count={myDeckCount} position="left" testId="sw-deck-draw" />
                </div>
              </div>

              {/* 右下区域：结束阶段按钮 + 弃牌堆 */}
              <div className="absolute right-3 bottom-3 z-20 pointer-events-auto flex flex-col items-end gap-3" data-testid="sw-phase-controls">
                <div className="flex gap-2">
                  {currentPhase === 'magic' && isMyTurn && interaction.selectedCardsForDiscard.length > 0 && (
                    <GameButton onClick={interaction.handleConfirmDiscard} variant="secondary" size="sm" data-testid="sw-confirm-discard">
                      弃牌 +{interaction.selectedCardsForDiscard.length}
                    </GameButton>
                  )}
                  <GameButton onClick={interaction.handleEndPhase} disabled={!isMyTurn} variant="primary" size="md" data-testid="sw-end-phase" data-tutorial-id="sw-end-phase-btn">
                    结束阶段
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
                  className="bg-slate-900/30 backdrop-blur-sm px-3 py-3 rounded-lg border border-slate-700/20 min-w-[8rem]"
                />
              </div>

              {/* 顶部中央：提示横幅 */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto z-30" data-tutorial-id="sw-action-banner">
                <StatusBanners
                  currentPhase={currentPhase}
                  isMyTurn={isMyTurn}
                  abilityMode={abilityMode}
                  bloodSummonMode={interaction.bloodSummonMode}
                  annihilateMode={interaction.annihilateMode}
                  soulTransferMode={soulTransferMode}
                  funeralPyreMode={interaction.funeralPyreMode}
                  mindControlMode={interaction.mindControlMode}
                  stunMode={interaction.stunMode}
                  hypnoticLureMode={interaction.hypnoticLureMode}
                  mindCaptureMode={mindCaptureMode}
                  afterAttackAbilityMode={afterAttackAbilityMode}
                  telekinesisTargetMode={interaction.telekinesisTargetMode}
                  onCancelAbility={handleCancelAbility}
                  onCancelBloodSummon={handleCancelBloodSummon}
                  onContinueBloodSummon={handleContinueBloodSummon}
                  onCancelAnnihilate={handleCancelAnnihilate}
                  onConfirmAnnihilateTargets={handleConfirmAnnihilateTargets}
                  onConfirmSoulTransfer={handleConfirmSoulTransfer}
                  onSkipSoulTransfer={handleSkipSoulTransfer}
                  onSkipFuneralPyre={handleSkipFuneralPyre}
                  onConfirmMindControl={handleConfirmMindControl}
                  onCancelMindControl={handleCancelMindControl}
                  onConfirmStun={handleConfirmStun}
                  onCancelStun={handleCancelStun}
                  onCancelHypnoticLure={handleCancelHypnoticLure}
                  onConfirmMindCapture={handleConfirmMindCapture}
                  onCancelAfterAttackAbility={handleCancelAfterAttackAbility}
                  onConfirmTelekinesis={handleConfirmTelekinesis}
                  onCancelTelekinesis={handleCancelTelekinesis}
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
                  selectedCardIds={interaction.selectedCardsForDiscard}
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
                  abilityMode.abilityId === 'revive_undead' ? '复活死灵：选择弃牌堆中的亡灵单位' :
                    abilityMode.abilityId === 'infection' ? '感染：选择弃牌堆中的疫病体' : '选择卡牌'
                }
                cards={core.players[myPlayerId]?.discard.filter(c => {
                  if (abilityMode.abilityId === 'revive_undead') {
                    return c.cardType === 'unit' && (c.id.includes('undead') || c.name.includes('亡灵') || (c as UnitCard).faction === '堕落王国');
                  }
                  if (abilityMode.abilityId === 'infection') {
                    return c.cardType === 'unit' && (c.id.includes('plague-zombie') || c.name.includes('疫病体'));
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
                  } else {
                    setAbilityMode(abilityMode ? { ...abilityMode, step: 'selectPosition', selectedCardId: card.id } : null);
                  }
                }}
                onCancel={() => setAbilityMode(null)}
              />
            )}

            {/* 单位操作面板（主动技能按钮） */}
            {!abilityMode && !interaction.bloodSummonMode && !interaction.eventTargetMode && core.selectedUnit && isMyTurn && (() => {
              const unit = core.board[core.selectedUnit.row]?.[core.selectedUnit.col]?.unit;
              if (!unit || unit.owner !== myPlayerId) return null;
              const abilities = unit.card.abilities ?? [];
              const buttons: React.ReactNode[] = [];

              if (abilities.includes('revive_undead') && currentPhase === 'summon') {
                const hasUndeadInDiscard = core.players[myPlayerId]?.discard.some(c =>
                  c.cardType === 'unit' && (c.id.includes('undead') || c.name.includes('亡灵') || (c as UnitCard).faction === '堕落王国')
                );
                if (hasUndeadInDiscard) {
                  buttons.push(
                    <GameButton key="revive_undead" onClick={() => setAbilityMode({ abilityId: 'revive_undead', step: 'selectCard', sourceUnitId: unit.cardId })} variant="primary" size="md">
                      🗡️ 复活死灵 (受到2点伤害)
                    </GameButton>
                  );
                }
              }
              if (abilities.includes('fire_sacrifice_summon') && currentPhase === 'summon') {
                const hasOtherUnits = getPlayerUnits(core, myPlayerId as '0' | '1').some(u => u.cardId !== unit.cardId);
                if (hasOtherUnits) {
                  buttons.push(
                    <GameButton key="fire_sacrifice_summon" onClick={() => setAbilityMode({ abilityId: 'fire_sacrifice_summon', step: 'selectUnit', sourceUnitId: unit.cardId })} variant="secondary" size="md">
                      🔥 火祀召唤 (消灭友方单位并移动)
                    </GameButton>
                  );
                }
              }
              if (abilities.includes('life_drain') && currentPhase === 'attack') {
                const nearbyUnits = getPlayerUnits(core, myPlayerId as '0' | '1')
                  .filter(u => {
                    if (u.cardId === unit.cardId) return false;
                    const dist = Math.abs(u.position.row - core.selectedUnit!.row) + Math.abs(u.position.col - core.selectedUnit!.col);
                    return dist <= 2;
                  });
                if (nearbyUnits.length > 0) {
                  buttons.push(
                    <GameButton key="life_drain" onClick={() => setAbilityMode({ abilityId: 'life_drain', step: 'selectUnit', sourceUnitId: unit.cardId })} variant="secondary" size="md">
                      💀 吸取生命 (消灭友方，战力翻倍)
                    </GameButton>
                  );
                }
              }
              if (buttons.length === 0) return null;
              return <div className="absolute bottom-[220px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex gap-2">{buttons}</div>;
            })()}

            {/* 卡牌放大预览 */}
            <MagnifyOverlay isOpen={!!magnifiedCard} onClose={() => setMagnifiedCard(null)} containerClassName="max-h-[85vh] max-w-[90vw]" closeLabel="关闭预览">
              {magnifiedCard && <CardSprite atlasId={magnifiedCard.atlasId} frameIndex={magnifiedCard.frameIndex} className="h-[75vh] w-auto rounded-xl shadow-2xl" />}
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

            {/* 结束页面遮罩 */}
            <EndgameOverlay
              isGameOver={!!isGameOver}
              result={isGameOver}
              playerID={playerID}
              reset={isSpectator ? undefined : reset}
              isMultiplayer={isSpectator ? false : isMultiplayer}
              totalPlayers={matchData?.length}
              rematchState={rematchState}
              onVote={isSpectator ? undefined : handleRematchVote}
            />

            {/* 调试面板 */}
            {!isSpectator && (
              <GameDebugPanel G={G} ctx={ctx} moves={moves} events={events} playerID={playerID} autoSwitch={!isMultiplayer}>
                <SummonerWarsDebugConfig G={G} ctx={ctx} moves={moves} />
                <button
                  onClick={() => { if (isEditingLayout) { void handleExitLayoutEditor(); return; } setIsEditingLayout(true); }}
                  className="px-2 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-500"
                >
                  {isEditingLayout ? '退出编辑' : '编辑布局'}
                </button>
              </GameDebugPanel>
            )}
          </div>
        )}
      </div>
      )}
    </UndoProvider>
  );
};

export default SummonerWarsBoard;
