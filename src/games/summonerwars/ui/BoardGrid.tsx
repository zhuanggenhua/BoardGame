/**
 * 召唤师战争 - 棋盘网格与卡牌渲染层
 * 
 * 包含：网格高亮层、卡牌层（单位/建筑/残影）
 */

import React from 'react';
import { motion } from 'framer-motion';
import { HitStopContainer, getHitStopPresetByDamage } from '../../../components/common/animations/HitStopContainer';
import type { GridConfig } from '../../../core/ui/board-layout.types';
import { cellToNormalizedBounds } from '../../../core/ui/board-hit-test';
import type { SummonerWarsCore, CellCoord } from '../domain/types';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import { CardSprite } from './CardSprite';
import { getUnitSpriteConfig, getStructureSpriteConfig, getGhostSpriteConfig } from './spriteHelpers';
import type { AbilityModeState } from './useGameEvents';
import type { AnnihilateModeState } from './StatusBanners';
import type { DeathGhost, PendingAttack } from './useGameEvents';

// ============================================================================
// 辅助函数
// ============================================================================

/** 计算格子位置（百分比） */
export function getCellPosition(row: number, col: number, grid: GridConfig) {
  const cellBounds = cellToNormalizedBounds({ row, col }, grid);
  return {
    left: cellBounds.x * 100,
    top: cellBounds.y * 100,
    width: cellBounds.width * 100,
    height: cellBounds.height * 100,
  };
}

// ============================================================================
// Props
// ============================================================================

interface BoardGridProps {
  core: SummonerWarsCore;
  currentGrid: GridConfig;
  myPlayerId: string;
  shouldFlipView: boolean;
  // 高亮数据
  selectedHandCardId: string | null;
  validSummonPositions: CellCoord[];
  validBuildPositions: CellCoord[];
  validMovePositions: CellCoord[];
  validAttackPositions: CellCoord[];
  validEventTargets: CellCoord[];
  validAbilityPositions: CellCoord[];
  validAbilityUnits: CellCoord[];
  actionableUnitPositions: CellCoord[];
  bloodSummonHighlights: CellCoord[];
  annihilateHighlights: CellCoord[];
  annihilateMode: AnnihilateModeState | null;
  abilityMode: AbilityModeState | null;
  // 欺心巫族事件卡高亮
  mindControlHighlights: CellCoord[];
  mindControlSelectedTargets: CellCoord[];
  stunHighlights: CellCoord[];
  hypnoticLureHighlights: CellCoord[];
  // 攻击后技能高亮（念力/高阶念力/读心传念）
  afterAttackAbilityHighlights: CellCoord[];
  // 动画状态
  attackAnimState: { attacker: CellCoord; target: CellCoord; hits: number } | null;
  hitStopTarget: CellCoord | null;
  deathGhosts: DeathGhost[];
  pendingAttackRef: React.RefObject<PendingAttack | null>;
  // 回调
  onCellClick: (row: number, col: number) => void;
  onAttackAnimComplete: () => void;
  onMagnifyUnit: (unit: import('../domain/types').BoardUnit) => void;
  onMagnifyStructure: (structure: import('../domain/types').BoardStructure) => void;
}

// ============================================================================
// 坐标转换
// ============================================================================

function useViewCoords(shouldFlipView: boolean) {
  const toViewCoord = (coord: CellCoord): CellCoord => (
    shouldFlipView
      ? { row: BOARD_ROWS - 1 - coord.row, col: BOARD_COLS - 1 - coord.col }
      : coord
  );
  const fromViewCoord = (coord: CellCoord): CellCoord => (
    shouldFlipView
      ? { row: BOARD_ROWS - 1 - coord.row, col: BOARD_COLS - 1 - coord.col }
      : coord
  );
  return { toViewCoord, fromViewCoord };
}

// ============================================================================
// 网格层
// ============================================================================

const GridLayer: React.FC<{
  currentGrid: GridConfig;
  core: SummonerWarsCore;
  fromViewCoord: (c: CellCoord) => CellCoord;
  props: BoardGridProps;
}> = ({ currentGrid, core, fromViewCoord, props }) => (
  <div className="absolute inset-0">
    {Array.from({ length: currentGrid.rows }).map((_, row) =>
      Array.from({ length: currentGrid.cols }).map((_, col) => {
        const viewCoord = { row, col };
        const gameCoord = fromViewCoord(viewCoord);
        const pos = getCellPosition(viewCoord.row, viewCoord.col, currentGrid);
        const cellKey = `${gameCoord.row}-${gameCoord.col}`;
        const isSelected = core.selectedUnit?.row === gameCoord.row && core.selectedUnit?.col === gameCoord.col;

        const cellStyle = getCellStyle(gameCoord, isSelected, props);

        return (
          <div
            key={cellKey}
            onClick={() => props.onCellClick(viewCoord.row, viewCoord.col)}
            data-testid={`sw-cell-${gameCoord.row}-${gameCoord.col}`}
            data-row={gameCoord.row}
            data-col={gameCoord.col}
            data-selected={isSelected ? 'true' : 'false'}
            data-valid-summon={props.validSummonPositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-build={props.validBuildPositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-move={props.validMovePositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-attack={props.validAttackPositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-event-target={props.validEventTargets.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            className={`absolute bg-transparent border transition-colors cursor-pointer ${cellStyle}`}
            style={{
              left: `${pos.left}%`, top: `${pos.top}%`,
              width: `${pos.width}%`, height: `${pos.height}%`,
            }}
          />
        );
      })
    )}
  </div>
);

/** 计算格子高亮样式 */
function getCellStyle(gameCoord: CellCoord, _isSelected: boolean, props: BoardGridProps): string {
  const { row, col } = gameCoord;
  const isAnnihilateSelected = props.annihilateMode?.selectedTargets.some(p => p.row === row && p.col === col);
  const isAnnihilateTarget = props.annihilateHighlights.some(p => p.row === row && p.col === col);
  const isBloodSummonTarget = props.bloodSummonHighlights.some(p => p.row === row && p.col === col);
  const isValidEventTarget = props.validEventTargets.some(p => p.row === row && p.col === col);
  const isValidSummon = props.selectedHandCardId && props.validSummonPositions.some(p => p.row === row && p.col === col);
  const isValidBuild = props.selectedHandCardId && props.validBuildPositions.some(p => p.row === row && p.col === col);
  const isAbilityPos = props.abilityMode?.step === 'selectPosition' && props.validAbilityPositions.some(p => p.row === row && p.col === col);
  const isAbilityUnit = props.abilityMode?.step === 'selectUnit' && props.validAbilityUnits.some(p => p.row === row && p.col === col);
  const isValidMove = props.validMovePositions.some(p => p.row === row && p.col === col);
  const isValidAttack = props.validAttackPositions.some(p => p.row === row && p.col === col);
  // 欺心巫族事件卡高亮
  const isMindControlSelected = props.mindControlSelectedTargets.some(p => p.row === row && p.col === col);
  const isMindControlTarget = props.mindControlHighlights.some(p => p.row === row && p.col === col);
  const isStunTarget = props.stunHighlights.some(p => p.row === row && p.col === col);
  const isHypnoticLureTarget = props.hypnoticLureHighlights.some(p => p.row === row && p.col === col);
  const isAfterAttackAbilityTarget = props.afterAttackAbilityHighlights.some(p => p.row === row && p.col === col);

  if (isAnnihilateSelected) return 'border-purple-400 bg-purple-400/50 border-2 ring-2 ring-purple-300';
  if (isAnnihilateTarget) return 'border-purple-500 bg-purple-500/30 border-2 animate-pulse';
  if (isMindControlSelected) return 'border-cyan-400 bg-cyan-400/50 border-2 ring-2 ring-cyan-300';
  if (isMindControlTarget) return 'border-cyan-500 bg-cyan-500/30 border-2 animate-pulse';
  if (isStunTarget) return 'border-yellow-400 bg-yellow-400/30 border-2 animate-pulse';
  if (isHypnoticLureTarget) return 'border-pink-400 bg-pink-400/30 border-2 animate-pulse';
  if (isAfterAttackAbilityTarget) return 'border-teal-400 bg-teal-400/30 border-2 animate-pulse';
  if (isBloodSummonTarget) return 'border-rose-500 bg-rose-500/30 border-2 animate-pulse';
  if (isValidEventTarget) return 'border-orange-400 bg-orange-400/30 border-2 animate-pulse';
  if (isValidSummon) return 'border-green-400 bg-green-400/30 border-2';
  if (isValidBuild) return 'border-purple-400 bg-purple-400/30 border-2';
  if (isAbilityPos) return 'border-green-400 bg-green-400/50 border-2 animate-pulse';
  if (isAbilityUnit) return 'border-amber-400 bg-amber-400/40 border-2 animate-pulse';
  if (isValidMove) return 'border-blue-400 bg-blue-400/25 border-2';
  if (isValidAttack) return 'border-red-400 bg-red-400/30 border-2';
  return 'border-transparent';
}

// ============================================================================
// 卡牌层
// ============================================================================

const CardLayer: React.FC<{
  core: SummonerWarsCore;
  currentGrid: GridConfig;
  myPlayerId: string;
  toViewCoord: (c: CellCoord) => CellCoord;
  props: BoardGridProps;
}> = ({ core, currentGrid, myPlayerId, toViewCoord, props }) => (
  <div className="absolute inset-0 pointer-events-none">
    {Array.from({ length: BOARD_ROWS }).map((_, row) =>
      Array.from({ length: BOARD_COLS }).map((_, col) => {
        const cell = core.board[row]?.[col];
        if (!cell) return null;

        const viewCoord = toViewCoord({ row, col });
        const pos = getCellPosition(viewCoord.row, viewCoord.col, currentGrid);
        const cellKey = `card-${row}-${col}`;

        if (cell.unit) {
          return (
            <UnitCell
              key={cellKey}
              row={row} col={col}
              unit={cell.unit}
              pos={pos}
              viewCoord={viewCoord}
              core={core}
              myPlayerId={myPlayerId}
              toViewCoord={toViewCoord}
              currentGrid={currentGrid}
              props={props}
            />
          );
        }

        if (cell.structure) {
          return (
            <StructureCell
              key={cellKey}
              row={row} col={col}
              structure={cell.structure}
              pos={pos}
              viewCoord={viewCoord}
              myPlayerId={myPlayerId}
              props={props}
            />
          );
        }

        return null;
      })
    )}
    {/* 死亡残影 */}
    {props.deathGhosts.map((ghost) => {
      const vc = toViewCoord(ghost.position);
      const pos = getCellPosition(vc.row, vc.col, currentGrid);
      const spriteConfig = getGhostSpriteConfig(ghost.card);
      const isMine = ghost.owner === myPlayerId;
      return (
        <div
          key={ghost.id}
          className="absolute flex items-center justify-center pointer-events-none"
          style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: `${pos.width}%`, height: `${pos.height}%`, zIndex: 40 }}
        >
          <CardSprite
            atlasId={spriteConfig.atlasId}
            frameIndex={spriteConfig.frameIndex}
            className={`rounded shadow-lg opacity-80 ${!isMine ? 'rotate-180' : ''}`}
          />
        </div>
      );
    })}
  </div>
);

// ============================================================================
// 单位格子
// ============================================================================

const UnitCell: React.FC<{
  row: number; col: number;
  unit: import('../domain/types').BoardUnit;
  pos: { left: number; top: number; width: number; height: number };
  viewCoord: CellCoord;
  core: SummonerWarsCore;
  myPlayerId: string;
  toViewCoord: (c: CellCoord) => CellCoord;
  currentGrid: GridConfig;
  props: BoardGridProps;
}> = ({ row, col, unit, pos, viewCoord, core, myPlayerId, toViewCoord, currentGrid, props }) => {
  const spriteConfig = getUnitSpriteConfig(unit);
  const isMyUnit = unit.owner === myPlayerId;
  const damage = unit.damage;
  const life = unit.card.life;
  const isUnitSelected = core.selectedUnit?.row === row && core.selectedUnit?.col === col;
  const damageRatio = damage / life;
  const hasAttached = (unit.attachedCards?.length ?? 0) > 0;

  const isAttacker = props.attackAnimState
    && props.attackAnimState.attacker.row === row
    && props.attackAnimState.attacker.col === col;
  const isHitStopActive = props.hitStopTarget
    && props.hitStopTarget.row === row
    && props.hitStopTarget.col === col;

  let lungeX = '0%';
  let lungeY = '0%';
  if (isAttacker && props.attackAnimState) {
    const tgtView = toViewCoord(props.attackAnimState.target);
    const tgtPos = getCellPosition(tgtView.row, tgtView.col, currentGrid);
    const dx = (tgtPos.left + tgtPos.width / 2) - (pos.left + pos.width / 2);
    const dy = (tgtPos.top + tgtPos.height / 2) - (pos.top + pos.height / 2);
    lungeX = `${dx * 70 / pos.width}%`;
    lungeY = `${dy * 70 / pos.height}%`;
  }

  const hitStopPreset = isHitStopActive
    ? getHitStopPresetByDamage(props.pendingAttackRef.current?.hits ?? 1)
    : undefined;

  return (
    <motion.div
      className="absolute flex items-center justify-center cursor-pointer pointer-events-auto"
      data-testid={`sw-unit-${row}-${col}`}
      data-tutorial-id={unit.card.unitClass === 'summoner' && unit.owner === myPlayerId ? 'sw-my-summoner' : unit.card.unitClass === 'summoner' && unit.owner !== myPlayerId ? 'sw-enemy-summoner' : undefined}
      data-owner={unit.owner}
      data-unit-class={unit.card.unitClass}
      data-unit-name={unit.card.name}
      data-unit-life={unit.card.life}
      data-unit-damage={unit.damage}
      style={{
        left: `${pos.left}%`, top: `${pos.top}%`,
        width: `${pos.width}%`, height: `${pos.height}%`,
        zIndex: isAttacker ? 50 : undefined,
      }}
      onClick={() => props.onCellClick(viewCoord.row, viewCoord.col)}
      animate={isAttacker ? {
        x: ['0%', '0%', lungeX, '0%'],
        y: ['0%', '-15%', lungeY, '0%'],
        scale: [1, 1.15, 1.05, 1],
      } : { x: '0%', y: '0%', scale: 1 }}
      transition={isAttacker ? {
        duration: 0.4, times: [0, 0.2, 0.6, 1], ease: [0.25, 0, 0.3, 1],
      } : { duration: 0 }}
      onAnimationComplete={isAttacker ? props.onAttackAnimComplete : undefined}
    >
      <HitStopContainer
        isActive={!!isHitStopActive}
        {...(hitStopPreset ?? {})}
        className={`relative w-[85%] group transition-all duration-200 ${isUnitSelected
          ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] rounded-lg scale-105 z-10'
          : isMyUnit && props.actionableUnitPositions.some(p => p.row === row && p.col === col)
            ? 'ring-2 ring-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] rounded-lg'
            : 'hover:ring-1 hover:ring-white/40 hover:shadow-[0_0_8px_rgba(255,255,255,0.2)] rounded-lg'
        }`}
      >
        <CardSprite
          atlasId={spriteConfig.atlasId}
          frameIndex={spriteConfig.frameIndex}
          className={`rounded shadow-lg ${!isMyUnit ? 'rotate-180' : ''}`}
        />
        {/* 伤害红色遮罩 */}
        {damage > 0 && (
          <div
            className={`absolute inset-x-0 ${isMyUnit ? 'bottom-0 rounded-b' : 'top-0 rounded-t'} pointer-events-none`}
            style={{
              height: `${Math.min(damageRatio * 100, 100)}%`,
              background: isMyUnit
                ? `linear-gradient(to top, rgba(220,38,38,${0.25 + damageRatio * 0.45}) 0%, rgba(185,28,28,${0.05 + damageRatio * 0.15}) 100%)`
                : `linear-gradient(to bottom, rgba(220,38,38,${0.25 + damageRatio * 0.45}) 0%, rgba(185,28,28,${0.05 + damageRatio * 0.15}) 100%)`,
              transition: 'height 0.3s ease-out',
            }}
          />
        )}
        {/* 悬停显示生命值 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <span className={`text-[1vw] font-bold px-[0.4vw] py-[0.1vw] rounded ${damage > 0 ? 'bg-red-900/80 text-red-200' : 'bg-black/60 text-white'}`}>
            {life - damage}/{life}
          </span>
        </div>
        {/* 附加卡指示 */}
        {hasAttached && (
          <div className="absolute -bottom-[0.2vw] left-1/2 -translate-x-1/2 bg-orange-500/90 text-white text-[0.5vw] px-[0.3vw] rounded-sm shadow">
            附加
          </div>
        )}
        {/* 充能指示器 */}
        {(unit.boosts ?? 0) > 0 && (() => {
          const boosts = unit.boosts ?? 0;
          const rows: number[][] = [];
          for (let i = 0; i < boosts; i += 5) {
            rows.push(Array.from({ length: Math.min(5, boosts - i) }, (_, j) => i + j));
          }
          return (
            <div className={`absolute ${isMyUnit ? 'top-[3%] right-[3%] items-end' : 'bottom-[3%] left-[3%] items-start'} flex flex-col gap-[2%] z-10 pointer-events-none`}>
              {rows.map((r, ri) => (
                <div key={ri} className="flex gap-[3%]">
                  {r.map(idx => (
                    <div key={idx} className="w-[15%] aspect-square rounded-full bg-blue-400 border border-blue-200 shadow-[0_0_4px_rgba(96,165,250,0.9)]" style={{ width: '15%', minWidth: '0.8vw' }} />
                  ))}
                </div>
              ))}
            </div>
          );
        })()}
        {/* 放大镜按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); props.onMagnifyUnit(unit); }}
          className="absolute top-[0.2vw] left-[0.2vw] w-[1.4vw] h-[1.4vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 z-20"
        >
          <svg className="w-[0.8vw] h-[0.8vw] fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </button>
      </HitStopContainer>
    </motion.div>
  );
};

// ============================================================================
// 建筑格子
// ============================================================================

const StructureCell: React.FC<{
  row: number; col: number;
  structure: import('../domain/types').BoardStructure;
  pos: { left: number; top: number; width: number; height: number };
  viewCoord: CellCoord;
  myPlayerId: string;
  props: BoardGridProps;
}> = ({ row, col, structure, pos, viewCoord, myPlayerId, props }) => {
  const spriteConfig = getStructureSpriteConfig(structure);
  const isMyStructure = structure.owner === myPlayerId;
  const damage = structure.damage;
  const life = structure.card.life;

  return (
    <div
      className="absolute flex items-center justify-center cursor-pointer pointer-events-auto"
      data-testid={`sw-structure-${row}-${col}`}
      data-tutorial-id={structure.card.isGate && structure.owner === myPlayerId ? 'sw-my-gate' : undefined}
      data-owner={structure.owner}
      data-structure-name={structure.card.name}
      data-structure-life={structure.card.life}
      data-structure-damage={structure.damage}
      data-structure-gate={structure.card.isGate ? 'true' : 'false'}
      style={{
        left: `${pos.left}%`, top: `${pos.top}%`,
        width: `${pos.width}%`, height: `${pos.height}%`,
      }}
      onClick={() => props.onCellClick(viewCoord.row, viewCoord.col)}
    >
      <div className="relative w-[85%] group">
        <CardSprite
          atlasId={spriteConfig.atlasId}
          frameIndex={spriteConfig.frameIndex}
          className={`rounded shadow-lg ${!isMyStructure ? 'rotate-180' : ''}`}
        />
        {/* 伤害红色遮罩 */}
        {damage > 0 && (() => {
          const damageRatio = damage / life;
          return (
            <div
              className={`absolute inset-x-0 ${isMyStructure ? 'bottom-0 rounded-b' : 'top-0 rounded-t'} pointer-events-none`}
              style={{
                height: `${Math.min(damageRatio * 100, 100)}%`,
                background: isMyStructure
                  ? `linear-gradient(to top, rgba(220,38,38,${0.25 + damageRatio * 0.45}) 0%, rgba(185,28,28,${0.05 + damageRatio * 0.15}) 100%)`
                  : `linear-gradient(to bottom, rgba(220,38,38,${0.25 + damageRatio * 0.45}) 0%, rgba(185,28,28,${0.05 + damageRatio * 0.15}) 100%)`,
                transition: 'height 0.3s ease-out',
              }}
            />
          );
        })()}
        {/* 悬停显示生命值 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <span className={`text-[1vw] font-bold px-[0.4vw] py-[0.1vw] rounded ${damage > 0 ? 'bg-red-900/80 text-red-200' : 'bg-black/60 text-white'}`}>
            {life - damage}/{life}
          </span>
        </div>
        {/* 放大镜按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); props.onMagnifyStructure(structure); }}
          className="absolute top-[0.2vw] left-[0.2vw] w-[1.4vw] h-[1.4vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 z-20"
        >
          <svg className="w-[0.8vw] h-[0.8vw] fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 主组件
// ============================================================================

export const BoardGrid: React.FC<BoardGridProps> = (props) => {
  const { core, currentGrid, shouldFlipView, myPlayerId } = props;
  const { toViewCoord, fromViewCoord } = useViewCoords(shouldFlipView);

  return (
    <>
      <GridLayer currentGrid={currentGrid} core={core} fromViewCoord={fromViewCoord} props={props} />
      <CardLayer core={core} currentGrid={currentGrid} myPlayerId={myPlayerId} toViewCoord={toViewCoord} props={props} />
    </>
  );
};
