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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { MatchState } from '../../engine/types';
import type { SummonerWarsCore } from './domain';
import { SW_COMMANDS, SW_EVENTS } from './domain';
import { FLOW_COMMANDS } from '../../engine';
import { getEvents } from '../../engine/systems/LogSystem';
import { GameDebugPanel } from '../../components/GameDebugPanel';
import { EndgameOverlay } from '../../components/game/EndgameOverlay';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { BoardLayoutEditor } from '../../components/game/framework/BoardLayoutEditor';
import { saveSummonerWarsLayout } from '../../api/layout';
import type { BoardLayoutConfig, GridConfig } from '../../core/ui/board-layout.types';
import { cellToNormalizedBounds } from '../../core/ui/board-hit-test';
import { initSpriteAtlases, getSpriteAtlasSource, getSpriteAtlasStyle, getFrameAspectRatio } from './ui/cardAtlas';
import { EnergyBar } from './ui/EnergyBar';
import { DeckPile } from './ui/DeckPile';
import { MapContainer } from './ui/MapContainer';
import { PhaseTracker } from './ui/PhaseTracker';
import { ActionBanner } from './ui/ActionBanner';
import { GameButton } from './ui/GameButton';
import { HandArea } from './ui/HandArea';
import { MagnifyOverlay } from '../../components/common/overlays/MagnifyOverlay';
import { DiceResultOverlay } from './ui/DiceResultOverlay';
import { DestroyEffectsLayer, useDestroyEffects } from './ui/DestroyEffect';
import type { Card, BoardUnit, BoardStructure, CellCoord } from './domain/types';
import type { DiceFace } from './config/dice';
import { getValidSummonPositions, getValidBuildPositions, getValidMoveTargets, getValidAttackTargets } from './domain/helpers';
import { BOARD_ROWS, BOARD_COLS } from './config/board';

type Props = BoardProps<MatchState<SummonerWarsCore>>;

// 默认网格配置（与 config/board.ts 保持一致）
const DEFAULT_GRID_CONFIG: GridConfig = {
  rows: BOARD_ROWS,
  cols: BOARD_COLS,
  bounds: {
    x: 0.038,
    y: 0.135,
    width: 0.924,
    height: 0.73,
  },
};

/** 卡牌精灵图组件 */
const CardSprite: React.FC<{
  atlasId: string;
  frameIndex: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ atlasId, frameIndex, className = '', style }) => {
  const source = getSpriteAtlasSource(atlasId);
  if (!source) {
    return <div className={`bg-slate-700 ${className}`} style={style} />;
  }
  const atlasStyle = getSpriteAtlasStyle(frameIndex, source.config);
  const aspectRatio = getFrameAspectRatio(frameIndex, source.config);
  return (
    <div
      className={className}
      style={{
        aspectRatio: `${aspectRatio}`,
        backgroundImage: `url(${source.image})`,
        backgroundRepeat: 'no-repeat',
        ...atlasStyle,
        ...style,
      }}
    />
  );
};

/** 获取卡牌精灵图配置 */
function getUnitSpriteConfig(unit: BoardUnit): { atlasId: string; frameIndex: number } {
  const card = unit.card;
  const spriteIndex = card.spriteIndex ?? 0;
  const spriteAtlas = card.spriteAtlas ?? 'cards';
  const atlasId = spriteAtlas === 'hero' ? 'sw:necromancer:hero' : 'sw:necromancer:cards';
  return { atlasId, frameIndex: spriteIndex };
}

/** 获取建筑精灵图配置 */
function getStructureSpriteConfig(structure: BoardStructure): { atlasId: string; frameIndex: number } {
  const card = structure.card;
  const spriteIndex = card.spriteIndex ?? 1;
  const spriteAtlas = card.spriteAtlas ?? 'hero';
  const atlasId = spriteAtlas === 'hero' ? 'sw:necromancer:hero' : 'sw:necromancer:cards';
  return { atlasId, frameIndex: spriteIndex };
}

/** 计算格子位置 */
function getCellPosition(row: number, col: number, grid: GridConfig) {
  const cellBounds = cellToNormalizedBounds({ row, col }, grid);
  return {
    left: cellBounds.x * 100,
    top: cellBounds.y * 100,
    width: cellBounds.width * 100,
    height: cellBounds.height * 100,
  };
}

export const SummonerWarsBoard: React.FC<Props> = ({
  ctx,
  G,
  moves,
  events,
  playerID,
  reset,
  matchData,
  isMultiplayer,
}) => {
  const isGameOver = ctx.gameover;
  const gameMode = useGameMode();
  const isLocalMatch = gameMode ? !gameMode.isMultiplayer : !isMultiplayer;
  const isSpectator = !!gameMode?.isSpectator;

  // 教学系统集成
  useTutorialBridge(G.sys.tutorial, moves as Record<string, unknown>);
  useTutorial();

  // 重赛系统
  const { state: rematchState, vote: handleRematchVote } = useRematch();

  // 初始化精灵图
  useEffect(() => {
    initSpriteAtlases();
  }, []);

  // 布局编辑器状态
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<BoardLayoutConfig | null>(null);

  const fetchLayoutConfig = useCallback(async () => {
    try {
      const response = await fetch(`/game-data/summonerwars.layout.json?ts=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (!data || typeof data !== 'object') {
        return null;
      }
      return data as BoardLayoutConfig;
    } catch (error) {
      return null;
    }
  }, []);

  const handleExitLayoutEditor = useCallback(async () => {
    setIsEditingLayout(false);
    const data = await fetchLayoutConfig();
    if (data) {
      setLayoutConfig(data);
    }
  }, [fetchLayoutConfig]);

  useEffect(() => {
    let cancelled = false;
    const loadLayout = async () => {
      const data = await fetchLayoutConfig();
      if (!cancelled && data) {
        setLayoutConfig(data);
      }
    };
    loadLayout();
    return () => { cancelled = true; };
  }, [fetchLayoutConfig]);

  // 当前网格配置
  const currentGrid = useMemo<GridConfig>(() => (
    layoutConfig?.grid ?? DEFAULT_GRID_CONFIG
  ), [layoutConfig]);

  // 游戏状态
  const core = G.core;
  const currentPhase = core.phase;
  const activePlayerId = core.currentPlayer ?? ctx.currentPlayer;
  const isMyTurn = isLocalMatch
    || (playerID !== null && playerID !== undefined && activePlayerId === playerID);
  // 本地模式下，视角固定为玩家0（底部）
  const myPlayerId = isLocalMatch ? '0' : (playerID === '1' ? '1' : '0');
  const opponentPlayerId = myPlayerId === '0' ? '1' : '0';
  const shouldFlipView = !isLocalMatch && !isSpectator && myPlayerId === '1';
  const toViewCoord = useCallback((coord: CellCoord): CellCoord => (
    shouldFlipView
      ? { row: BOARD_ROWS - 1 - coord.row, col: BOARD_COLS - 1 - coord.col }
      : coord
  ), [shouldFlipView]);
  const fromViewCoord = useCallback((coord: CellCoord): CellCoord => (
    shouldFlipView
      ? { row: BOARD_ROWS - 1 - coord.row, col: BOARD_COLS - 1 - coord.col }
      : coord
  ), [shouldFlipView]);
  const myMagic = core.players[myPlayerId]?.magic ?? 0;
  const opponentMagic = core.players[opponentPlayerId]?.magic ?? 0;
  const myDeckCount = core.players[myPlayerId]?.deck?.length ?? 0;
  const myDiscardCount = core.players[myPlayerId]?.discard?.length ?? 0;

  // 手牌：直接使用实际数据
  const myHand = core.players[myPlayerId]?.hand ?? [];

  // 召唤相关状态
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedCardsForDiscard, setSelectedCardsForDiscard] = useState<string[]>([]);
  
  // 卡牌放大预览状态
  const [magnifiedCard, setMagnifiedCard] = useState<{ atlasId: string; frameIndex: number } | null>(null);
  
  // 骰子结果状态
  const [diceResult, setDiceResult] = useState<{
    results: DiceFace[];
    attackType: 'melee' | 'ranged';
    hits: number;
  } | null>(null);
  
  // 摧毁效果状态
  const { effects: destroyEffects, pushEffect: pushDestroyEffect, removeEffect: removeDestroyEffect } = useDestroyEffects();
  
  // 追踪已处理的事件数量
  const processedEventCount = useRef(0);
  
  // 监听攻击事件和摧毁事件
  useEffect(() => {
    const events = getEvents(G);
    const newEvents = events.slice(processedEventCount.current);
    processedEventCount.current = events.length;
    
    for (const event of newEvents) {
      // 攻击事件 - 显示骰子结果
      if (event.type === SW_EVENTS.UNIT_ATTACKED) {
        const payload = event.payload as {
          attackType: 'melee' | 'ranged';
          diceResults: DiceFace[];
          hits: number;
        };
        setDiceResult({
          results: payload.diceResults,
          attackType: payload.attackType,
          hits: payload.hits,
        });
      }
      
      // 单位摧毁事件 - 显示摧毁动画
      if (event.type === SW_EVENTS.UNIT_DESTROYED) {
        const payload = event.payload as {
          position: { row: number; col: number };
          cardName: string;
        };
        pushDestroyEffect({
          position: payload.position,
          cardName: payload.cardName,
          type: 'unit',
        });
      }
      
      // 建筑摧毁事件 - 显示摧毁动画
      if (event.type === SW_EVENTS.STRUCTURE_DESTROYED) {
        const payload = event.payload as {
          position: { row: number; col: number };
          cardName: string;
        };
        pushDestroyEffect({
          position: payload.position,
          cardName: payload.cardName,
          type: 'structure',
        });
      }
    }
  }, [G, pushDestroyEffect]);
  
  // 关闭骰子结果浮层
  const handleCloseDiceResult = useCallback(() => {
    setDiceResult(null);
  }, []);
  
  const handleMagnifyCard = useCallback((card: Card) => {
    const spriteIndex = 'spriteIndex' in card ? card.spriteIndex : undefined;
    const spriteAtlas = 'spriteAtlas' in card ? card.spriteAtlas : undefined;
    if (spriteIndex === undefined) return;
    const atlasId = spriteAtlas === 'hero' ? 'sw:necromancer:hero' : 'sw:necromancer:cards';
    setMagnifiedCard({ atlasId, frameIndex: spriteIndex });
  }, []);
  
  const handleMagnifyBoardUnit = useCallback((unit: BoardUnit) => {
    const spriteConfig = getUnitSpriteConfig(unit);
    setMagnifiedCard(spriteConfig);
  }, []);
  
  const handleMagnifyBoardStructure = useCallback((structure: BoardStructure) => {
    const spriteConfig = getStructureSpriteConfig(structure);
    setMagnifiedCard(spriteConfig);
  }, []);
  
  const handleCloseMagnify = useCallback(() => {
    setMagnifiedCard(null);
  }, []);
  
  // 获取选中的手牌
  const selectedHandCard = useMemo(() => {
    if (!selectedHandCardId) return null;
    return myHand.find(c => c.id === selectedHandCardId) ?? null;
  }, [selectedHandCardId, myHand]);
  
  // 获取可召唤位置
  const validSummonPositions = useMemo(() => {
    if (currentPhase !== 'summon' || !isMyTurn || !selectedHandCard) {
      return [];
    }
    if (selectedHandCard.cardType !== 'unit') {
      return [];
    }
    const positions = getValidSummonPositions(core, myPlayerId as '0' | '1');
    return positions;
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard]);
  
  // 获取可建造位置
  const validBuildPositions = useMemo(() => {
    if (currentPhase !== 'build' || !isMyTurn || !selectedHandCard) return [];
    if (selectedHandCard.cardType !== 'structure') return [];
    return getValidBuildPositions(core, myPlayerId as '0' | '1');
  }, [core, currentPhase, isMyTurn, myPlayerId, selectedHandCard]);
  
  // 获取可移动位置
  const validMovePositions = useMemo(() => {
    if (currentPhase !== 'move' || !isMyTurn || !core.selectedUnit) return [];
    return getValidMoveTargets(core, core.selectedUnit);
  }, [core, currentPhase, isMyTurn]);
  
  // 获取可攻击位置
  const validAttackPositions = useMemo(() => {
    if (currentPhase !== 'attack' || !isMyTurn || !core.selectedUnit) return [];
    return getValidAttackTargets(core, core.selectedUnit);
  }, [core, currentPhase, isMyTurn]);

  // 点击格子
  const handleCellClick = useCallback((row: number, col: number) => {
    const { row: gameRow, col: gameCol } = fromViewCoord({ row, col });
    // 召唤阶段：如果选中了手牌且是有效召唤位置，执行召唤
    if (currentPhase === 'summon' && selectedHandCardId) {
      const isValidPosition = validSummonPositions.some(
        p => p.row === gameRow && p.col === gameCol
      );
      if (isValidPosition) {
        moves[SW_COMMANDS.SUMMON_UNIT]?.({
          cardId: selectedHandCardId,
          position: { row: gameRow, col: gameCol },
        });
        setSelectedHandCardId(null);
        return;
      }
      // 点击无效位置，取消选中
      setSelectedHandCardId(null);
      return;
    }
    
    // 建造阶段：如果选中了建筑卡且是有效建造位置，执行建造
    if (currentPhase === 'build' && selectedHandCardId) {
      const isValidPosition = validBuildPositions.some(
        p => p.row === gameRow && p.col === gameCol
      );
      if (isValidPosition) {
        moves[SW_COMMANDS.BUILD_STRUCTURE]?.({
          cardId: selectedHandCardId,
          position: { row: gameRow, col: gameCol },
        });
        setSelectedHandCardId(null);
        return;
      }
      // 点击无效位置，取消选中
      setSelectedHandCardId(null);
      return;
    }
    
    // 移动阶段
    if (currentPhase === 'move') {
      if (core.selectedUnit) {
        // 已选中单位，尝试移动
        const isValidMove = validMovePositions.some(
          p => p.row === gameRow && p.col === gameCol
        );
        if (isValidMove) {
          moves[SW_COMMANDS.MOVE_UNIT]?.({
            from: core.selectedUnit,
            to: { row: gameRow, col: gameCol },
          });
        } else {
          // 点击其他位置，尝试选择新单位或取消选择
          const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
          if (clickedUnit && clickedUnit.owner === myPlayerId) {
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
          } else {
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: -1, col: -1 } }); // 取消选择
          }
        }
      } else {
        // 未选中单位，尝试选择
        moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
      }
      return;
    }
    
    // 攻击阶段
    if (currentPhase === 'attack') {
      if (core.selectedUnit) {
        // 已选中单位，尝试攻击
        const isValidAttack = validAttackPositions.some(
          p => p.row === gameRow && p.col === gameCol
        );
        if (isValidAttack) {
          moves[SW_COMMANDS.DECLARE_ATTACK]?.({
            attacker: core.selectedUnit,
            target: { row: gameRow, col: gameCol },
          });
        } else {
          // 点击其他位置，尝试选择新单位或取消选择
          const clickedUnit = core.board[gameRow]?.[gameCol]?.unit;
          if (clickedUnit && clickedUnit.owner === myPlayerId) {
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
          } else {
            moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: -1, col: -1 } });
          }
        }
      } else {
        // 未选中单位，尝试选择
        moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
      }
      return;
    }
    
    // 其他阶段：普通选择
    moves[SW_COMMANDS.SELECT_UNIT]?.({ position: { row: gameRow, col: gameCol } });
  }, [core, moves, currentPhase, selectedHandCardId, validSummonPositions, validBuildPositions, validMovePositions, validAttackPositions, myPlayerId, fromViewCoord]);

  // 手牌点击（魔力阶段弃牌多选）
  const handleCardClick = useCallback((cardId: string) => {
    if (currentPhase === 'magic' && isMyTurn) {
      // 魔力阶段：切换选中状态用于弃牌
      setSelectedCardsForDiscard(prev => 
        prev.includes(cardId) 
          ? prev.filter(id => id !== cardId)
          : [...prev, cardId]
      );
    }
  }, [currentPhase, isMyTurn]);

  // 手牌选中（召唤/建造阶段单选）
  const handleCardSelect = useCallback((cardId: string | null) => {
    setSelectedHandCardId(cardId);
  }, []);

  // 确认弃牌换魔力
  const handleConfirmDiscard = useCallback(() => {
    if (selectedCardsForDiscard.length > 0) {
      moves[SW_COMMANDS.DISCARD_FOR_MAGIC]?.({
        cardIds: selectedCardsForDiscard,
      });
      setSelectedCardsForDiscard([]);
    }
  }, [moves, selectedCardsForDiscard]);

  // 结束阶段（使用 FlowSystem 的 ADVANCE_PHASE）
  const handleEndPhase = useCallback(() => {
    moves[FLOW_COMMANDS.ADVANCE_PHASE]?.({});
  }, [moves]);

  const handleSaveLayout = useCallback(async (config: BoardLayoutConfig) => (
    saveSummonerWarsLayout(config)
  ), []);

  return (
    <UndoProvider
      value={{
        G,
        ctx,
        moves,
        playerID,
        isGameOver: !!isGameOver,
        isLocalMode: isLocalMatch,
      }}
    >
      {/* 全屏容器 */}
      <div className="h-[100dvh] w-full bg-neutral-900 overflow-hidden relative flex flex-col">
        {/* 布局编辑器模式 */}
        {isEditingLayout ? (
          <div className="flex-1 overflow-auto p-4">
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={handleExitLayoutEditor}
                className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600"
              >
                ← 返回游戏
              </button>
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
          /* 游戏模式 */
          <div className="flex-1 relative overflow-hidden">
            {/* 地图层（仅地图可拖拽/缩放） */}
            <div className="absolute inset-0 z-10 flex items-center justify-center" data-testid="sw-map-layer">
              <MapContainer 
                className="w-full h-full flex items-center justify-center px-[10vw]" 
                initialScale={1}
                dragBoundsPaddingRatioY={0.3}
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
                    
                    {/* 网格层 */}
                    <div className="absolute inset-0">
                      {Array.from({ length: currentGrid.rows }).map((_, row) =>
                        Array.from({ length: currentGrid.cols }).map((_, col) => {
                          const viewCoord = { row, col };
                          const gameCoord = fromViewCoord(viewCoord);
                          const pos = getCellPosition(viewCoord.row, viewCoord.col, currentGrid);
                          const cellKey = `${gameCoord.row}-${gameCoord.col}`;
                          const isSelected = core.selectedUnit?.row === gameCoord.row && core.selectedUnit?.col === gameCoord.col;
                          const isValidSummon = selectedHandCardId && validSummonPositions.some(
                            p => p.row === gameCoord.row && p.col === gameCoord.col
                          );
                          const isValidBuild = selectedHandCardId && validBuildPositions.some(
                            p => p.row === gameCoord.row && p.col === gameCoord.col
                          );
                          const isValidMove = validMovePositions.some(
                            p => p.row === gameCoord.row && p.col === gameCoord.col
                          );
                          const isValidAttack = validAttackPositions.some(
                            p => p.row === gameCoord.row && p.col === gameCoord.col
                          );
                          
                          // 确定格子样式
                          let cellStyle = 'border-white/20 hover:border-amber-400/80 hover:bg-amber-400/10';
                          if (isSelected) {
                            cellStyle = 'border-amber-400 bg-amber-400/20 border-2';
                          } else if (isValidSummon) {
                            cellStyle = 'border-green-400 bg-green-400/30 border-2';
                          } else if (isValidBuild) {
                            cellStyle = 'border-purple-400 bg-purple-400/30 border-2'; // 紫色表示可建造
                          } else if (isValidMove) {
                            cellStyle = 'border-blue-400 bg-blue-400/25 border-2';
                          } else if (isValidAttack) {
                            cellStyle = 'border-red-400 bg-red-400/30 border-2';
                          }
                          
                          return (
                            <div
                              key={cellKey}
                              onClick={() => handleCellClick(viewCoord.row, viewCoord.col)}
                              data-testid={`sw-cell-${gameCoord.row}-${gameCoord.col}`}
                              data-row={gameCoord.row}
                              data-col={gameCoord.col}
                              data-selected={isSelected ? 'true' : 'false'}
                              data-valid-summon={isValidSummon ? 'true' : 'false'}
                              data-valid-build={isValidBuild ? 'true' : 'false'}
                              data-valid-move={isValidMove ? 'true' : 'false'}
                              data-valid-attack={isValidAttack ? 'true' : 'false'}
                              className={`
                                absolute bg-transparent border transition-colors cursor-pointer
                                ${cellStyle}
                              `}
                              style={{
                                left: `${pos.left}%`,
                                top: `${pos.top}%`,
                                width: `${pos.width}%`,
                                height: `${pos.height}%`,
                              }}
                            />
                          );
                        })
                      )}
                    </div>

                    {/* 卡牌层 - 从实际游戏状态渲染 */}
                    <div className="absolute inset-0">
                      {Array.from({ length: BOARD_ROWS }).map((_, row) =>
                        Array.from({ length: BOARD_COLS }).map((_, col) => {
                          const cell = core.board[row]?.[col];
                          if (!cell) return null;
                          
                          const viewCoord = toViewCoord({ row, col });
                          const pos = getCellPosition(viewCoord.row, viewCoord.col, currentGrid);
                          const cellKey = `card-${row}-${col}`;
                          
                          // 渲染单位
                          if (cell.unit) {
                            const spriteConfig = getUnitSpriteConfig(cell.unit);
                            const isMyUnit = cell.unit.owner === myPlayerId;
                            const damage = cell.unit.damage;
                            const life = cell.unit.card.life;
                            const unit = cell.unit;
                            
                            return (
                              <div
                                key={cellKey}
                                className="absolute flex items-center justify-center cursor-pointer"
                                data-testid={`sw-unit-${row}-${col}`}
                                data-owner={unit.owner}
                                data-unit-class={unit.card.unitClass}
                                data-unit-name={unit.card.name}
                                data-unit-life={unit.card.life}
                                data-unit-damage={unit.damage}
                                style={{
                                  left: `${pos.left}%`,
                                  top: `${pos.top}%`,
                                  width: `${pos.width}%`,
                                  height: `${pos.height}%`,
                                }}
                                onClick={() => handleCellClick(viewCoord.row, viewCoord.col)}
                              >
                                <div className="relative w-[85%] group">
                                  <CardSprite
                                    atlasId={spriteConfig.atlasId}
                                    frameIndex={spriteConfig.frameIndex}
                                    className={`rounded shadow-lg ${!isMyUnit ? 'rotate-180' : ''}`}
                                  />
                                  {/* 伤害指示器 */}
                                  {damage > 0 && (
                                    <div className="absolute -top-[0.2vw] -right-[0.2vw] w-[1.2vw] h-[1.2vw] rounded-full bg-red-600 border border-red-400 flex items-center justify-center text-[0.7vw] text-white font-bold shadow">
                                      {life - damage}
                                    </div>
                                  )}
                                  {/* 放大镜按钮 */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleMagnifyBoardUnit(unit); }}
                                    className="absolute top-[0.2vw] left-[0.2vw] w-[1.4vw] h-[1.4vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 z-20"
                                  >
                                    <svg className="w-[0.8vw] h-[0.8vw] fill-current" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          
                          // 渲染建筑
                          if (cell.structure) {
                            const spriteConfig = getStructureSpriteConfig(cell.structure);
                            const isMyStructure = cell.structure.owner === myPlayerId;
                            const damage = cell.structure.damage;
                            const life = cell.structure.card.life;
                            const structure = cell.structure;
                            
                            return (
                              <div
                                key={cellKey}
                                className="absolute flex items-center justify-center cursor-pointer"
                                data-testid={`sw-structure-${row}-${col}`}
                                data-owner={structure.owner}
                                data-structure-name={structure.card.name}
                                data-structure-life={structure.card.life}
                                data-structure-damage={structure.damage}
                                data-structure-gate={structure.card.isGate ? 'true' : 'false'}
                                style={{
                                  left: `${pos.left}%`,
                                  top: `${pos.top}%`,
                                  width: `${pos.width}%`,
                                  height: `${pos.height}%`,
                                }}
                                onClick={() => handleCellClick(viewCoord.row, viewCoord.col)}
                              >
                                <div className="relative w-[85%] group">
                                  <CardSprite
                                    atlasId={spriteConfig.atlasId}
                                    frameIndex={spriteConfig.frameIndex}
                                    className={`rounded shadow-lg ${!isMyStructure ? 'rotate-180' : ''}`}
                                  />
                                  {/* 生命指示器 */}
                                  <div className={`absolute -top-[0.2vw] -right-[0.2vw] w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center text-[0.7vw] text-white font-bold shadow ${damage > 0 ? 'bg-red-600 border-red-400' : 'bg-slate-600 border-slate-400'} border`}>
                                    {life - damage}
                                  </div>
                                  {/* 放大镜按钮 */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleMagnifyBoardStructure(structure); }}
                                    className="absolute top-[0.2vw] left-[0.2vw] w-[1.4vw] h-[1.4vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 z-20"
                                  >
                                    <svg className="w-[0.8vw] h-[0.8vw] fill-current" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          
                          return null;
                        })
                      )}
                    </div>
                    
                    {/* 摧毁效果层 */}
                    <DestroyEffectsLayer
                      effects={destroyEffects}
                      getCellPosition={(row, col) => getCellPosition(row, col, currentGrid)}
                      onEffectComplete={removeDestroyEffect}
                    />
                  </div>
                </div>
              </MapContainer>
            </div>

            {/* UI 层（左右黑边 + UI 覆盖） */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              {/* 左侧黑边渐变 */}
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: '10vw',
                  background: 'linear-gradient(to right, rgba(0,0,0,0.95), rgba(0,0,0,0.75), rgba(0,0,0,0))',
                }}
              />
              {/* 右侧黑边渐变 */}
              <div
                className="absolute inset-y-0 right-0"
                style={{
                  width: '10vw',
                  background: 'linear-gradient(to left, rgba(0,0,0,0.95), rgba(0,0,0,0.75), rgba(0,0,0,0))',
                }}
              />

              {/* 右上：对手名+魔力条 */}
              <div className="absolute top-3 right-3 pointer-events-auto" data-testid="sw-opponent-bar">
                <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-600/20">
                  <span className="text-sm text-white font-medium text-opacity-100">
                    {matchData?.[playerID === '1' ? 0 : 1]?.name ?? '对手'}
                  </span>
                  <EnergyBar current={opponentMagic} testId="sw-energy-opponent" />
                </div>
              </div>

              {/* 左下区域：玩家名+魔力条（上）+ 抽牌堆（下） - 与右下角对齐 */}
              <div className="absolute left-3 bottom-3 z-20 pointer-events-auto flex flex-col items-start gap-[3.75rem]" data-testid="sw-player-bar">
                {/* 玩家名+魔力条 - 放在上面 */}
                <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-600/20">
                  <span className="text-sm text-white font-medium text-opacity-100">
                    {matchData?.[playerID === '1' ? 1 : 0]?.name ?? '玩家'}
                  </span>
                  <EnergyBar current={myMagic} testId="sw-energy-player" />
                </div>
                {/* 抽牌堆 - 放在下面，与右下角弃牌堆对齐 */}
                <DeckPile type="draw" count={myDeckCount} position="left" testId="sw-deck-draw" />
              </div>

              {/* 右下区域：结束阶段按钮（上）+ 弃牌堆（下） */}
              <div className="absolute right-3 bottom-3 z-20 pointer-events-auto flex flex-col items-end gap-3" data-testid="sw-phase-controls">
                {/* 结束阶段按钮 - 放在上面 */}
                <div className="flex gap-2">
                  {/* 魔力阶段显示确认弃牌按钮 */}
                  {currentPhase === 'magic' && isMyTurn && selectedCardsForDiscard.length > 0 && (
                    <GameButton
                      onClick={handleConfirmDiscard}
                      variant="secondary"
                      size="sm"
                      data-testid="sw-confirm-discard"
                    >
                      弃牌 +{selectedCardsForDiscard.length}
                    </GameButton>
                  )}
                  <GameButton
                    onClick={handleEndPhase}
                    disabled={!isMyTurn}
                    variant="primary"
                    size="md"
                    data-testid="sw-end-phase"
                  >
                    结束阶段
                  </GameButton>
                </div>
                {/* 弃牌堆 - 放在下面 */}
                <DeckPile type="discard" count={myDiscardCount} position="right" testId="sw-deck-discard" />
              </div>
              
              {/* 右侧：阶段指示器（垂直居中） */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-auto" data-testid="sw-phase-tracker">
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
              <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto z-30">
                <ActionBanner phase={currentPhase} isMyTurn={isMyTurn} />
              </div>

              {/* 底部：手牌区 - 贴底显示 */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-auto z-30">
                <HandArea
                  cards={myHand}
                  phase={currentPhase}
                  isMyTurn={isMyTurn}
                  currentMagic={myMagic}
                  selectedCardId={selectedHandCardId}
                  selectedCardIds={selectedCardsForDiscard}
                  onCardClick={handleCardClick}
                  onCardSelect={handleCardSelect}
                  onMagnifyCard={handleMagnifyCard}
                />
              </div>
            </div>
          </div>
        )}

        {/* 卡牌放大预览 */}
        <MagnifyOverlay
          isOpen={!!magnifiedCard}
          onClose={handleCloseMagnify}
          containerClassName="max-h-[85vh] max-w-[90vw]"
          closeLabel="关闭预览"
        >
          {magnifiedCard && (
            <CardSprite
              atlasId={magnifiedCard.atlasId}
              frameIndex={magnifiedCard.frameIndex}
              className="h-[75vh] w-auto rounded-xl shadow-2xl"
            />
          )}
        </MagnifyOverlay>

        {/* 骰子结果浮层 */}
        <DiceResultOverlay
          results={diceResult?.results ?? null}
          attackType={diceResult?.attackType ?? null}
          hits={diceResult?.hits ?? 0}
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
          <GameDebugPanel
            G={G}
            ctx={ctx}
            moves={moves}
            events={events}
            playerID={playerID}
            autoSwitch={!isMultiplayer}
          >
            <button
              onClick={() => {
                if (isEditingLayout) {
                  void handleExitLayoutEditor();
                  return;
                }
                setIsEditingLayout(true);
              }}
              className="px-2 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-500"
            >
              {isEditingLayout ? '退出编辑' : '编辑布局'}
            </button>
          </GameDebugPanel>
        )}
      </div>
    </UndoProvider>
  );
};

export default SummonerWarsBoard;
