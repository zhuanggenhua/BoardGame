/**
 * 召唤师战争 - 棋盘网格与卡牌渲染层
 * 
 * 包含：网格高亮层、卡牌层（单位/建筑/残影）
 */

import React, { useEffect, useRef } from 'react';
import { motion, useAnimate } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { GridConfig } from '../../../core/ui/board-layout.types';
import type { SummonerWarsCore, CellCoord, PlayerId } from '../domain/types';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';
import { CardSprite } from './CardSprite';
import { getUnitSpriteConfig, getStructureSpriteConfig } from './spriteHelpers';
import type { DyingEntity } from './useGameEvents';
import type { AnnihilateModeState } from './StatusBanners';
import { AbilityReadyIndicator } from './AbilityReadyIndicator';
import { BuffIcons, getBuffGlowStyle, BuffDetailsPanel } from './BuffIcons';
import type { BuffInstance } from '../../../components/game/framework/widgets/BuffSystem';
import { abilityRegistry } from '../domain/abilities';
import { getEffectiveStructureLife, getEffectiveLife } from '../domain/abilityResolver';
import { normalizeUnitBoosts } from '../domain/helpers';
import { StrengthBoostIndicator } from './StrengthBoostIndicator';
import type { UseVisualStateBufferReturn } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import { useTouchInspectGesture } from '../../../hooks/ui/useTouchInspectGesture';
import { BOARD_SHELL_REFERENCE_WIDTH } from './layoutConstants';
import { getCellPosition } from './boardGridGeometry';

// ============================================================================
// 辅助函数
// ============================================================================

const BOARD_GRID_Z = {
  attachedLabel: 5,
  overlay: 10,
  magnifyButton: 20,
  dyingEntity: 35,
  attacker: 50,
} as const;

const LIFE_BADGE_CONTAINER_STYLE: React.CSSProperties = {
  containerType: 'inline-size',
};

const LIFE_BADGE_STYLE: React.CSSProperties = {
  fontSize: 'clamp(15px, 30cqw, 32px)',
  lineHeight: 0.95,
  paddingInline: '0.18em',
  paddingBlock: '0.04em',
  boxShadow: '0 2px 8px rgba(0,0,0,0.65)',
  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
};
const MAGNIFY_BUTTON_STYLE: React.CSSProperties = {
  top: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.006)`,
  right: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.006)`,
  width: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.04)`,
  height: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.04)`,
};
const MAGNIFY_ICON_STYLE: React.CSSProperties = {
  width: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.021)`,
  height: `calc(${BOARD_SHELL_REFERENCE_WIDTH} * 0.021)`,
};
const UNIT_CHARGE_MARKER_STACK_STYLE: React.CSSProperties = {
  width: '55%',
};
const UNIT_CHARGE_MARKER_DOT_STYLE: React.CSSProperties = {
  width: '16%',
  height: 0,
  paddingTop: '16%',
};

/** 格子唯一 key */
const getCellKey = (row: number, col: number) => `${row}-${col}`;

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
  abilityReadyPositions: CellCoord[];
  bloodSummonHighlights: CellCoord[];
  annihilateHighlights: CellCoord[];
  annihilateMode: AnnihilateModeState | null;
  // 欺心巫族事件卡高亮
  mindControlHighlights: CellCoord[];
  mindControlSelectedTargets: CellCoord[];
  // 交缠颂歌高亮
  entanglementHighlights: CellCoord[];
  entanglementSelectedTargets: CellCoord[];
  // 莫古事件牌高亮
  moguSymbioticSelfHealingHighlights: CellCoord[];
  moguSymbioticSelfHealingSelectedTargets: CellCoord[];
  moguReleaseSporesHighlights: CellCoord[];
  moguReleaseSporesSelectedTargets: CellCoord[];
  shadowPulseHighlights: CellCoord[];
  shadowPulseSelectedTargets: CellCoord[];
  // 潜行高亮
  sneakHighlights: CellCoord[];
  // 冰川位移高亮
  glacialShiftHighlights: CellCoord[];
  // 撤退高亮
  withdrawHighlights: CellCoord[];
  stunHighlights: CellCoord[];
  hypnoticLureHighlights: CellCoord[];
  // 攻击后技能高亮（念力/高阶念力/读心传念）
  afterAttackAbilityHighlights: CellCoord[];
  // 念力终点高亮（棋盘点击终点模式）
  telekinesisHighlights: CellCoord[];
  // 动画状态
  attackAnimState: { attacker: CellCoord; target: CellCoord; hits: number } | null;
  // 播放摧毁动画中的格子（用于隐藏本体）
  destroyingCells?: Set<string>;
  // 临时本体缓存（死亡动画前保留）
  dyingEntities?: DyingEntity[];
  // 视觉伤害缓冲：攻击动画期间冻结 damage 值，使用框架层 useVisualStateBuffer
  damageBuffer?: UseVisualStateBufferReturn;
  showLifeTotals?: boolean;
  // 降低攻击表现成本：保留命中反馈，跳过卡牌本体冲刺
  reducedCombatEffects?: boolean;
  // 回调
  onCellClick: (row: number, col: number) => void;
  onAttackHit: () => void;
  onAttackReturn: () => void;
  onMagnifyUnit: (unit: import('../domain/types').BoardUnit) => void;
  onMagnifyStructure: (structure: import('../domain/types').BoardStructure) => void;
  onMagnifyEventCard?: (card: import('../domain/types').EventCard) => void;
  onMagnifySpriteConfig?: (config: { atlasId: string; frameIndex: number }) => void;
  // 首屏完成后允许新挂载单位播放入场动画
  enableEntryAnimations?: boolean;
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
  onCellClick: (row: number, col: number) => void;
}> = ({ currentGrid, core, fromViewCoord, props, onCellClick }) => (
  <div className="absolute inset-0">
    {Array.from({ length: currentGrid.rows }).map((_, row) =>
      Array.from({ length: currentGrid.cols }).map((_, col) => {
        const viewCoord = { row, col };
        const gameCoord = fromViewCoord(viewCoord);
        const pos = getCellPosition(viewCoord.row, viewCoord.col, currentGrid);
        const cellKey = `${gameCoord.row}-${gameCoord.col}`;
        const isSelected = core.selectedUnit?.row === gameCoord.row && core.selectedUnit?.col === gameCoord.col;

        const cellVisual = getCellStyle(gameCoord, isSelected, props);

        return (
          <div
            key={cellKey}
            onClick={() => onCellClick(viewCoord.row, viewCoord.col)}
            data-testid={`sw-cell-${gameCoord.row}-${gameCoord.col}`}
            data-cell-coord={`${gameCoord.row}-${gameCoord.col}`}
            data-row={gameCoord.row}
            data-col={gameCoord.col}
            data-selected={isSelected ? 'true' : 'false'}
            data-valid-summon={props.validSummonPositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-build={props.validBuildPositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-move={props.validMovePositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-attack={props.validAttackPositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-event-target={props.validEventTargets.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-ability-pos={props.validAbilityPositions.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            data-valid-ability-unit={props.validAbilityUnits.some(p => p.row === gameCoord.row && p.col === gameCoord.col) ? 'true' : 'false'}
            className={`absolute transition-colors cursor-pointer ${cellVisual.className}`}
            style={{
              left: `${pos.left}%`, top: `${pos.top}%`,
              width: `${pos.width}%`, height: `${pos.height}%`,
              ...cellVisual.style,
            }}
          />
        );
      })
    )}
  </div>
);

/**
 * 计算卡牌本体的目标高亮样式
 * 当格子处于各种事件/技能选择高亮时，给卡牌加 ring + glow，让用户能直观看到哪些单位可选
 */
function getCardTargetHighlight(row: number, col: number, props: BoardGridProps): string {
  const isAnnihilateSelected = props.annihilateMode?.selectedTargets.some(p => p.row === row && p.col === col);
  const isAnnihilateTarget = props.annihilateHighlights.some(p => p.row === row && p.col === col);
  if (isAnnihilateSelected) return 'ring-2 ring-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.7)]';
  if (isAnnihilateTarget) return 'ring-2 ring-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.6)] animate-pulse';

  const isMindControlSelected = props.mindControlSelectedTargets.some(p => p.row === row && p.col === col);
  const isMindControlTarget = props.mindControlHighlights.some(p => p.row === row && p.col === col);
  if (isMindControlSelected) return 'ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]';
  if (isMindControlTarget) return 'ring-2 ring-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.6)] animate-pulse';

  const isEntanglementSelected = props.entanglementSelectedTargets.some(p => p.row === row && p.col === col);
  const isEntanglementTarget = props.entanglementHighlights.some(p => p.row === row && p.col === col);
  if (isEntanglementSelected) return 'ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]';
  if (isEntanglementTarget) return 'ring-2 ring-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse';

  const isMoguSelfHealingSelected = props.moguSymbioticSelfHealingSelectedTargets.some(p => p.row === row && p.col === col);
  const isMoguSelfHealingTarget = props.moguSymbioticSelfHealingHighlights.some(p => p.row === row && p.col === col);
  if (isMoguSelfHealingSelected) return 'ring-2 ring-fuchsia-300 shadow-[0_0_12px_rgba(240,171,252,0.75)]';
  if (isMoguSelfHealingTarget) return 'ring-2 ring-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.65)] animate-pulse';

  const isMoguReleaseSporesSelected = props.moguReleaseSporesSelectedTargets.some(p => p.row === row && p.col === col);
  const isMoguReleaseSporesTarget = props.moguReleaseSporesHighlights.some(p => p.row === row && p.col === col);
  if (isMoguReleaseSporesSelected) return 'ring-2 ring-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.75)]';
  if (isMoguReleaseSporesTarget) return 'ring-2 ring-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.65)] animate-pulse';

  const isShadowPulseSelected = props.shadowPulseSelectedTargets.some(p => p.row === row && p.col === col);
  const isShadowPulseTarget = props.shadowPulseHighlights.some(p => p.row === row && p.col === col);
  if (isShadowPulseSelected) return 'ring-2 ring-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.75)]';
  if (isShadowPulseTarget) return 'ring-2 ring-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.65)] animate-pulse';

  if (props.sneakHighlights.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.6)] animate-pulse';
  if (props.glacialShiftHighlights.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.6)] animate-pulse';
  if (props.withdrawHighlights.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)] animate-pulse';
  if (props.stunHighlights.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)] animate-pulse';
  if (props.hypnoticLureHighlights.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.6)] animate-pulse';
  if (props.afterAttackAbilityHighlights.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.6)] animate-pulse';
  if (props.telekinesisHighlights.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-teal-300 shadow-[0_0_12px_rgba(94,234,212,0.7)] animate-pulse';
  if (props.bloodSummonHighlights.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse';
  if (props.validEventTargets.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.6)] animate-pulse';
  if (props.validAttackPositions.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-red-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]';
  if (props.validAbilityUnits.length > 0 && props.validAbilityUnits.some(p => p.row === row && p.col === col))
    return 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)] animate-pulse';

  return '';
}

type CellVisualStyle = {
  className: string;
  style: React.CSSProperties;
};

const baseCellVisualStyle = (
  borderColor: string,
  backgroundColor: string,
  className = '',
): CellVisualStyle => ({
  className,
  style: {
    borderStyle: 'solid',
    borderWidth: '2px',
    borderColor,
    backgroundColor,
  },
});

/** 计算格子高亮样式 */
function getCellStyle(gameCoord: CellCoord, _isSelected: boolean, props: BoardGridProps): CellVisualStyle {
  const { row, col } = gameCoord;
  const isAnnihilateSelected = props.annihilateMode?.selectedTargets.some(p => p.row === row && p.col === col);
  const isAnnihilateTarget = props.annihilateHighlights.some(p => p.row === row && p.col === col);
  const isBloodSummonTarget = props.bloodSummonHighlights.some(p => p.row === row && p.col === col);
  const isValidEventTarget = props.validEventTargets.some(p => p.row === row && p.col === col);
  const isValidSummon = props.selectedHandCardId && props.validSummonPositions.some(p => p.row === row && p.col === col);
  const isValidBuild = props.selectedHandCardId && props.validBuildPositions.some(p => p.row === row && p.col === col);
  // 技能高亮：BoardGrid 不关心具体 step，由 useCellInteraction 的 memo 控制数组内容
  const isAbilityPos = props.validAbilityPositions.length > 0 && props.validAbilityPositions.some(p => p.row === row && p.col === col);
  const isAbilityUnit = props.validAbilityUnits.length > 0 && props.validAbilityUnits.some(p => p.row === row && p.col === col);
  const isValidMove = props.validMovePositions.some(p => p.row === row && p.col === col);
  const isValidAttack = props.validAttackPositions.some(p => p.row === row && p.col === col);
  // 欺心巫族事件卡高亮
  const isMindControlSelected = props.mindControlSelectedTargets.some(p => p.row === row && p.col === col);
  const isMindControlTarget = props.mindControlHighlights.some(p => p.row === row && p.col === col);
  const isEntanglementSelected = props.entanglementSelectedTargets.some(p => p.row === row && p.col === col);
  const isEntanglementTarget = props.entanglementHighlights.some(p => p.row === row && p.col === col);
  const isMoguSelfHealingSelected = props.moguSymbioticSelfHealingSelectedTargets.some(p => p.row === row && p.col === col);
  const isMoguSelfHealingTarget = props.moguSymbioticSelfHealingHighlights.some(p => p.row === row && p.col === col);
  const isMoguReleaseSporesSelected = props.moguReleaseSporesSelectedTargets.some(p => p.row === row && p.col === col);
  const isMoguReleaseSporesTarget = props.moguReleaseSporesHighlights.some(p => p.row === row && p.col === col);
  const isShadowPulseSelected = props.shadowPulseSelectedTargets.some(p => p.row === row && p.col === col);
  const isShadowPulseTarget = props.shadowPulseHighlights.some(p => p.row === row && p.col === col);
  const isSneakTarget = props.sneakHighlights.some(p => p.row === row && p.col === col);
  const isGlacialShiftTarget = props.glacialShiftHighlights.some(p => p.row === row && p.col === col);
  const isWithdrawTarget = props.withdrawHighlights.some(p => p.row === row && p.col === col);
  const isStunTarget = props.stunHighlights.some(p => p.row === row && p.col === col);
  const isHypnoticLureTarget = props.hypnoticLureHighlights.some(p => p.row === row && p.col === col);
  const isAfterAttackAbilityTarget = props.afterAttackAbilityHighlights.some(p => p.row === row && p.col === col);
  const isTelekinesisTarget = props.telekinesisHighlights.some(p => p.row === row && p.col === col);

  if (isAnnihilateSelected) return baseCellVisualStyle('rgba(192,132,252,1)', 'rgba(192,132,252,0.5)', 'ring-2 ring-purple-300');
  if (isAnnihilateTarget) return baseCellVisualStyle('rgba(168,85,247,1)', 'rgba(168,85,247,0.3)', 'animate-pulse');
  if (isMindControlSelected) return baseCellVisualStyle('rgba(34,211,238,1)', 'rgba(34,211,238,0.5)', 'ring-2 ring-cyan-300');
  if (isMindControlTarget) return baseCellVisualStyle('rgba(6,182,212,1)', 'rgba(6,182,212,0.3)', 'animate-pulse');
  if (isEntanglementSelected) return baseCellVisualStyle('rgba(52,211,153,1)', 'rgba(52,211,153,0.5)', 'ring-2 ring-emerald-300');
  if (isEntanglementTarget) return baseCellVisualStyle('rgba(16,185,129,1)', 'rgba(16,185,129,0.3)', 'animate-pulse');
  if (isMoguSelfHealingSelected) return baseCellVisualStyle('rgba(240,171,252,1)', 'rgba(240,171,252,0.5)', 'ring-2 ring-fuchsia-200');
  if (isMoguSelfHealingTarget) return baseCellVisualStyle('rgba(232,121,249,1)', 'rgba(232,121,249,0.3)', 'animate-pulse');
  if (isMoguReleaseSporesSelected) return baseCellVisualStyle('rgba(190,242,100,1)', 'rgba(190,242,100,0.5)', 'ring-2 ring-lime-200');
  if (isMoguReleaseSporesTarget) return baseCellVisualStyle('rgba(163,230,53,1)', 'rgba(163,230,53,0.3)', 'animate-pulse');
  if (isShadowPulseSelected) return baseCellVisualStyle('rgba(196,181,253,1)', 'rgba(196,181,253,0.5)', 'ring-2 ring-violet-200');
  if (isShadowPulseTarget) return baseCellVisualStyle('rgba(167,139,250,1)', 'rgba(167,139,250,0.3)', 'animate-pulse');
  if (isSneakTarget) return baseCellVisualStyle('rgba(163,230,53,1)', 'rgba(163,230,53,0.3)', 'animate-pulse');
  if (isGlacialShiftTarget) return baseCellVisualStyle('rgba(56,189,248,1)', 'rgba(56,189,248,0.3)', 'animate-pulse');
  if (isWithdrawTarget) return baseCellVisualStyle('rgba(251,191,36,1)', 'rgba(251,191,36,0.3)', 'animate-pulse');
  if (isStunTarget) return baseCellVisualStyle('rgba(250,204,21,1)', 'rgba(250,204,21,0.3)', 'animate-pulse');
  if (isHypnoticLureTarget) return baseCellVisualStyle('rgba(244,114,182,1)', 'rgba(244,114,182,0.3)', 'animate-pulse');
  if (isAfterAttackAbilityTarget) return baseCellVisualStyle('rgba(45,212,191,1)', 'rgba(45,212,191,0.3)', 'animate-pulse');
  if (isTelekinesisTarget) return baseCellVisualStyle('rgba(94,234,212,1)', 'rgba(94,234,212,0.3)', 'animate-pulse');
  if (isBloodSummonTarget) return baseCellVisualStyle('rgba(244,63,94,1)', 'rgba(244,63,94,0.3)', 'animate-pulse');
  if (isValidEventTarget) return baseCellVisualStyle('rgba(251,146,60,1)', 'rgba(251,146,60,0.3)', 'animate-pulse');
  if (isValidSummon) return baseCellVisualStyle('rgba(74,222,128,1)', 'rgba(74,222,128,0.3)');
  if (isValidBuild) return baseCellVisualStyle('rgba(74,222,128,1)', 'rgba(74,222,128,0.3)');
  if (isAbilityPos) return baseCellVisualStyle('rgba(74,222,128,1)', 'rgba(74,222,128,0.5)', 'animate-pulse');
  if (isAbilityUnit) return baseCellVisualStyle('rgba(251,191,36,1)', 'rgba(251,191,36,0.4)', 'animate-pulse');
  if (isValidMove) return baseCellVisualStyle('rgba(96,165,250,1)', 'rgba(96,165,250,0.25)');
  if (isValidAttack) return baseCellVisualStyle('rgba(248,113,113,1)', 'rgba(248,113,113,0.3)');
  return {
    className: '',
    style: {
      borderStyle: 'solid',
      borderWidth: '1px',
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
  };
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
  onCellClick: (row: number, col: number) => void;
}> = ({
  core,
  currentGrid,
  myPlayerId,
  toViewCoord,
  props,
  onCellClick,
}) => (
  <div className="absolute inset-0 pointer-events-none">
    {Array.from({ length: BOARD_ROWS }).map((_, row) =>
      Array.from({ length: BOARD_COLS }).map((_, col) => {
        const cell = core.board[row]?.[col];
        if (!cell) return null;

        const isDestroying = props.destroyingCells?.has(getCellKey(row, col));
        if (isDestroying) return null;

        const viewCoord = toViewCoord({ row, col });
        const pos = getCellPosition(viewCoord.row, viewCoord.col, currentGrid);
        const cellKey = `card-${row}-${col}`;

        const dyingEntity = props.dyingEntities?.find(entity => entity.position.row === row && entity.position.col === col);

        if (cell.unit) {
          return (
            <UnitCell
              key={`unit-${cell.unit.instanceId}`}
              row={row} col={col}
              unit={cell.unit}
              pos={pos}
              viewCoord={viewCoord}
              core={core}
              myPlayerId={myPlayerId}
              toViewCoord={toViewCoord}
              currentGrid={currentGrid}
              props={props}
              onCellClick={onCellClick}
            />
          );
        }

        if (cell.structure) {
          return (
            <StructureCell
              key={`structure-${row}-${col}`}
              row={row} col={col}
              structure={cell.structure}
              pos={pos}
              viewCoord={viewCoord}
              myPlayerId={myPlayerId}
              props={props}
              onCellClick={onCellClick}
            />
          );
        }

        if (dyingEntity) {
          return (
            <DyingEntityCell
              key={cellKey}
              entity={dyingEntity}
              pos={pos}
              isMine={dyingEntity.owner === myPlayerId}
            />
          );
        }

        return null;
      })
    )}
  </div>
);

const DyingEntityCell: React.FC<{
  entity: DyingEntity;
  pos: { left: number; top: number; width: number; height: number };
  isMine: boolean;
}> = ({ entity, pos, isMine }) => (
  <div
    className="absolute flex items-center justify-center pointer-events-none"
    style={{
      left: `${pos.left}%`,
      top: `${pos.top}%`,
      width: `${pos.width}%`,
      height: `${pos.height}%`,
      zIndex: BOARD_GRID_Z.dyingEntity,
    }}
  >
    <div className={`relative w-[85%] shadow-[0_4px_12px_rgba(0,0,0,0.5),0_12px_24px_rgba(0,0,0,0.4)] rounded-lg ${!isMine ? 'rotate-180' : ''}`}>
      <CardSprite
        atlasId={entity.atlasId}
        frameIndex={entity.frameIndex}
        className="rounded"
      />
    </div>
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
  onCellClick: (row: number, col: number) => void;
}> = ({
  row,
  col,
  unit,
  pos,
  viewCoord,
  core,
  myPlayerId,
  toViewCoord,
  currentGrid,
  props,
  onCellClick,
}) => {
  const shouldAnimateEntry = props.enableEntryAnimations ?? false;
  const { t, i18n } = useTranslation('game-summonerwars');
  const spriteConfig = getUnitSpriteConfig(unit);
  const isMyUnit = unit.owner === myPlayerId;
  const unitInspectKey = `unit-${unit.instanceId}`;
  // 视觉伤害：攻击动画期間优先读缓冲值，避免血条在动画 impact 前就变化
  const damage = props.damageBuffer
    ? props.damageBuffer.get(`${row}-${col}`, unit.damage)
    : unit.damage;
  const life = getEffectiveLife(unit, core);
  const isUnitSelected = core.selectedUnit?.row === row && core.selectedUnit?.col === col;
  const damageRatio = damage / life;
  // 卡牌目标高亮（除灭/心灵操控/攻击等模式下让卡牌本体发光）
  const cardHighlight = getCardTargetHighlight(row, col, props);

  // Buff 图标点击：展示附加的牌
  // Buff 图标点击：统一通过 spriteConfig 展示来源卡牌大图
  const handleBuffClick = React.useCallback((buff: BuffInstance) => {
    if (buff.spriteConfig) {
      props.onMagnifySpriteConfig?.(buff.spriteConfig);
    }
  }, [props]);
  const {
    showDesktopInspectButton: showDesktopMagnifyButton,
    getTouchInspectProps: getTouchInspectProps,
    shouldBlockInspectClick,
  } = useTouchInspectGesture<string, import('../domain/types').BoardUnit>({
    enabled: true,
    onInspect: (_key, payload) => {
      props.onMagnifyUnit(payload);
    },
  });
  const touchInspectProps = getTouchInspectProps(unitInspectKey, unit);

  const isAttacker = props.attackAnimState
    && props.attackAnimState.attacker.row === row
    && props.attackAnimState.attacker.col === col;

  // 命令式 lunge 动画（useAnimate）
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const animatingRef = useRef(false);

  let lungeXPct = 0;
  let lungeYPct = 0;
  if (isAttacker && props.attackAnimState) {
    const tgtView = toViewCoord(props.attackAnimState.target);
    const tgtPos = getCellPosition(tgtView.row, tgtView.col, currentGrid);
    const dx = (tgtPos.left + tgtPos.width / 2) - (pos.left + pos.width / 2);
    const dy = (tgtPos.top + tgtPos.height / 2) - (pos.top + pos.height / 2);
    lungeXPct = dx * 70 / pos.width;
    lungeYPct = dy * 70 / pos.height;
  }

  useEffect(() => {
    if (!isAttacker || animatingRef.current) return;
    animatingRef.current = true;

    const run = async () => {
      try {
        if (props.reducedCombatEffects) {
          props.onAttackHit();
          await new Promise(r => window.setTimeout(r, 120));
          return;
        }

        // 冲向目标
        await animate(scope.current, {
          x: `${lungeXPct}%`, y: `${lungeYPct}%`, scale: 1.05,
        }, { duration: 0.16, ease: [0.2, 0, 0.3, 1] });

        // 命中：触发伤害特效
        props.onAttackHit();

        // 短暂停留让命中感更强
        await new Promise(r => setTimeout(r, 80));

        // 回弹归位
        await animate(scope.current, {
          x: '0%', y: '0%', scale: 1,
        }, { duration: 0.16, ease: [0, 0, 0.2, 1] });
      } finally {
        animatingRef.current = false;
        props.onAttackReturn();
      }
    };
    run();
  }, [isAttacker]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      ref={scope}
      className="absolute flex items-center justify-center cursor-pointer pointer-events-auto"
      data-testid={`sw-unit-${row}-${col}`}
      data-cell-coord={`${row}-${col}`}
      data-unit-id={unit.instanceId}
      data-tutorial-id={
        unit.card.unitClass === 'summoner' && unit.owner === myPlayerId ? 'sw-my-summoner'
        : unit.card.unitClass === 'summoner' && unit.owner !== myPlayerId ? 'sw-enemy-summoner'
        : unit.card.attackType === 'ranged' && unit.card.unitClass !== 'summoner' && unit.owner === myPlayerId ? 'sw-start-archer'
        : undefined
      }
      data-owner={unit.owner}
      data-unit-class={unit.card.unitClass}
      data-unit-name={unit.card.name}
      data-unit-life={life}
      data-unit-damage={unit.damage}
      {...touchInspectProps}
      onPointerDown={(event) => {
        touchInspectProps.onPointerDown(event);
      }}
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: `${pos.width}%`,
        height: `${pos.height}%`,
        zIndex: isAttacker ? BOARD_GRID_Z.attacker : undefined,
      }}
      onClick={() => {
        if (shouldBlockInspectClick(unitInspectKey)) return;
        onCellClick(viewCoord.row, viewCoord.col);
      }}
      initial={shouldAnimateEntry ? { opacity: 0, scale: 1.1 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={shouldAnimateEntry ? {
        type: 'spring', stiffness: 80, damping: 15, mass: 1.2,
      } : {
        layout: { type: 'spring', stiffness: 300, damping: 30 },
      }}
      layout="position"
    >
      <div
        className={`relative w-[85%] group transition-transform duration-200 ${!isMyUnit ? 'rotate-180' : ''} ${
          isUnitSelected ? 'scale-105 -translate-y-[5%]' : ''
        }`}
        style={isUnitSelected ? { zIndex: BOARD_GRID_Z.overlay } : undefined}
      >
        <div
          className={`relative rounded-lg transition-[background-color,box-shadow] duration-200 ${
          isUnitSelected
            ? 'ring-2 ring-amber-400 shadow-[0_15px_30px_rgba(0,0,0,0.6),0_0_12px_rgba(251,191,36,0.6)]'
            : cardHighlight
              ? cardHighlight
              : isMyUnit && props.actionableUnitPositions.some(p => p.row === row && p.col === col)
                ? 'ring-2 ring-green-400 shadow-[0_10px_20px_rgba(0,0,0,0.4),0_0_10px_rgba(74,222,128,0.5)]'
                : 'hover:ring-1 hover:ring-white/40 shadow-[0_4px_12px_rgba(0,0,0,0.5),0_12px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.6),0_20px_40px_rgba(0,0,0,0.5)]'
          } ${getBuffGlowStyle(unit, core.players[unit.owner]?.activeEvents ?? [], core)}`}
          style={LIFE_BADGE_CONTAINER_STYLE}
        >
          {/* 技能准备就绪指示器（青色波纹） */}
          {isMyUnit && props.abilityReadyPositions.some(p => p.row === row && p.col === col) && !isUnitSelected && (
            <AbilityReadyIndicator />
          )}

          <CardSprite
            atlasId={spriteConfig.atlasId}
            frameIndex={spriteConfig.frameIndex}
            className="rounded"
          />
          {/* 伤害红色遮罩 - 统一从底部向上长（对手卡旋转后自动变为从顶部向下） */}
          {damage > 0 && (
            <div
              className="absolute inset-x-0 bottom-0 rounded-b pointer-events-none"
              style={{
                height: `${Math.min(damageRatio * 100, 100)}%`,
                background: `linear-gradient(to top, rgba(220,38,38,${0.25 + damageRatio * 0.45}) 0%, rgba(185,28,28,${0.05 + damageRatio * 0.15}) 100%)`,
                transition: 'height 0.3s ease-out',
              }}
            />
          )}
          {/* 悬停显示生命值 - 保持正向可读 */}
          <div
            data-testid={`sw-unit-life-${row}-${col}`}
            data-life-visible={props.showLifeTotals ? 'true' : 'false'}
            className={`absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none ${
              props.showLifeTotals ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } ${!isMyUnit ? 'rotate-180' : ''}`}
            style={{ zIndex: BOARD_GRID_Z.overlay }}
          >
            <span
              className={`font-bold rounded ${damage > 0 ? 'bg-red-900/80 text-red-200' : 'bg-black/60 text-white'}`}
              style={LIFE_BADGE_STYLE}
            >
              {life - damage}/{life}
            </span>
          </div>
          {/* 充能指示器 - 统一右上角（对手卡旋转后自动变为左下角） */}
          {normalizeUnitBoosts(unit.boosts) > 0 && (() => {
            const boosts = normalizeUnitBoosts(unit.boosts);
            const rows: number[][] = [];
            for (let i = 0; i < boosts; i += 5) {
              rows.push(Array.from({ length: Math.min(5, boosts - i) }, (_, j) => i + j));
            }
            return (
              <div
                className="absolute top-[3%] right-[3%] items-end flex flex-col gap-[2%] pointer-events-none"
                style={{ ...UNIT_CHARGE_MARKER_STACK_STYLE, zIndex: BOARD_GRID_Z.overlay }}
              >
                {rows.map((r, ri) => (
                  <div key={ri} className="flex w-full justify-end gap-[3%]">
                    {r.map(idx => (
                      <div
                        key={idx}
                        data-testid={`sw-unit-charge-marker-${row}-${col}-${idx}`}
                        className="shrink-0 rounded-full bg-blue-400 border border-blue-200 shadow-[0_0_4px_rgba(96,165,250,0.9)]"
                        style={UNIT_CHARGE_MARKER_DOT_STYLE}
                      />
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}
          {/* 战力增幅指示器 - 右下角，需跳过附加卡名条区域 */}
          <StrengthBoostIndicator unit={unit} core={core} attachedCount={unit.attachedCards?.length ?? 0} />
        </div>
        {/* 放大镜按钮 - 保持正向可读 */}
        {showDesktopMagnifyButton && (
          <button
            onClick={(e) => { e.stopPropagation(); props.onMagnifyUnit(unit); }}
            className={`absolute flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 ${!isMyUnit ? 'rotate-180' : ''}`}
            style={{ ...MAGNIFY_BUTTON_STYLE, zIndex: BOARD_GRID_Z.magnifyButton }}
          >
            <svg className="fill-current" style={MAGNIFY_ICON_STYLE} viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        
        {/* Buff 图标区域 - 统一左下角（对手卡旋转后自动变为右上角） */}
        <BuffIcons
          unit={unit}
          isMyUnit={true}
          activeEvents={core.players[unit.owner]?.activeEvents ?? []}
          myPlayerId={myPlayerId as PlayerId}
          core={core}
          onBuffClick={handleBuffClick}
        />
        
        {/* Buff 详细信息悬停面板 - 保持正向可读 */}
        <div className={`absolute top-full left-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 ${!isMyUnit ? 'rotate-180' : ''}`}>
          <BuffDetailsPanel
            unit={unit}
            activeEvents={core.players[unit.owner]?.activeEvents ?? []}
            getAbilityName={(abilityId) => {
              const abilityNameKey = abilityRegistry.get(abilityId)?.name;
              if (!abilityNameKey) return abilityId;
              return i18n.exists(abilityNameKey, { ns: 'game-summonerwars' })
                ? t(abilityNameKey)
                : abilityId;
            }}
            core={core}
          />
        </div>
        

      </div>
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
  onCellClick: (row: number, col: number) => void;
}> = ({
  row,
  col,
  structure,
  pos,
  viewCoord,
  myPlayerId,
  props,
  onCellClick,
}) => {
  const spriteConfig = getStructureSpriteConfig(structure);
  const isMyStructure = structure.owner === myPlayerId;
  const shouldAnimateEntry = props.enableEntryAnimations ?? false;
  const structureInspectKey = `structure-${row}-${col}-${structure.cardId}`;
  // 视觉伤害：攻击动画期间优先读缓冲值
  const damage = props.damageBuffer
    ? props.damageBuffer.get(`${row}-${col}`, structure.damage)
    : structure.damage;
  const life = getEffectiveStructureLife(props.core, structure);
  // 卡牌目标高亮（冰川位移/攻击等模式下让建筑本体发光）
  const cardHighlight = getCardTargetHighlight(row, col, props);
  const {
    showDesktopInspectButton: showDesktopMagnifyButton,
    getTouchInspectProps: getTouchInspectProps,
    shouldBlockInspectClick,
  } = useTouchInspectGesture<string, import('../domain/types').BoardStructure>({
    enabled: true,
    onInspect: (_key, payload) => {
      props.onMagnifyStructure(payload);
    },
  });
  const touchInspectProps = getTouchInspectProps(structureInspectKey, structure);

  return (
    <motion.div
      className="absolute flex items-center justify-center cursor-pointer pointer-events-auto"
      data-testid={`sw-structure-${row}-${col}`}
      data-cell-coord={`${row}-${col}`}
      data-structure-id={structure.cardId}
      data-tutorial-id={structure.card.isGate && structure.owner === myPlayerId ? 'sw-my-gate' : undefined}
      data-owner={structure.owner}
      data-structure-name={structure.card.name}
      data-structure-life={life}
      data-structure-damage={structure.damage}
      data-structure-gate={structure.card.isGate ? 'true' : 'false'}
      {...touchInspectProps}
      onPointerDown={touchInspectProps.onPointerDown}
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: `${pos.width}%`,
        height: `${pos.height}%`,
      }}
      initial={shouldAnimateEntry ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{
        layout: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0 },
      }}
      layout="position"
      onClick={() => {
        if (shouldBlockInspectClick(structureInspectKey)) return;
        onCellClick(viewCoord.row, viewCoord.col);
      }}
    >
      <motion.div
        className={`relative w-[85%] group ${!isMyStructure ? 'rotate-180' : ''}`}
        initial={shouldAnimateEntry ? { opacity: 0, scale: 1.1 } : false}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        <div
          className={`relative rounded-lg transition-shadow ${cardHighlight
            ? cardHighlight
            : 'shadow-[0_4px_12px_rgba(0,0,0,0.5),0_12px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.6),0_20px_40px_rgba(0,0,0,0.5)]'
          }`}
          style={LIFE_BADGE_CONTAINER_STYLE}
        >
          <CardSprite
            atlasId={spriteConfig.atlasId}
            frameIndex={spriteConfig.frameIndex}
            className="rounded"
          />
          {/* 伤害红色遮罩 - 统一从底部向上长（对手建筑旋转后自动变为从顶部向下） */}
          {damage > 0 && (() => {
            const damageRatio = damage / life;
            return (
              <div
                className="absolute inset-x-0 bottom-0 rounded-b pointer-events-none"
                style={{
                  height: `${Math.min(damageRatio * 100, 100)}%`,
                  background: `linear-gradient(to top, rgba(220,38,38,${0.25 + damageRatio * 0.45}) 0%, rgba(185,28,28,${0.05 + damageRatio * 0.15}) 100%)`,
                  transition: 'height 0.3s ease-out',
                }}
              />
            );
          })()}
          {/* 悬停显示生命值 - 保持正向可读 */}
          <div
            data-testid={`sw-structure-life-${row}-${col}`}
            data-life-visible={props.showLifeTotals ? 'true' : 'false'}
            className={`absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none ${
              props.showLifeTotals ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } ${!isMyStructure ? 'rotate-180' : ''}`}
            style={{ zIndex: BOARD_GRID_Z.overlay }}
          >
            <span
              className={`font-bold rounded ${damage > 0 ? 'bg-red-900/80 text-red-200' : 'bg-black/60 text-white'}`}
              style={LIFE_BADGE_STYLE}
            >
              {life - damage}/{life}
            </span>
          </div>
        </div>
        {/* 放大镜按钮 - 保持正向可读 */}
        {showDesktopMagnifyButton && (
          <button
            onClick={(e) => { e.stopPropagation(); props.onMagnifyStructure(structure); }}
            className={`absolute flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-[opacity,background-color] duration-200 shadow-lg border border-white/20 ${!isMyStructure ? 'rotate-180' : ''}`}
            style={{ ...MAGNIFY_BUTTON_STYLE, zIndex: BOARD_GRID_Z.magnifyButton }}
          >
            <svg className="fill-current" style={MAGNIFY_ICON_STYLE} viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// 主组件
// ============================================================================

export const BoardGrid: React.FC<BoardGridProps> = (props) => {
  const {
    core,
    currentGrid,
    shouldFlipView,
    myPlayerId,
    onCellClick,
  } = props;
  const { toViewCoord, fromViewCoord } = useViewCoords(shouldFlipView);

  const handleGridCellClick = React.useCallback((row: number, col: number) => {
    onCellClick(row, col);
  }, [onCellClick]);

  const handleCardCellClick = React.useCallback((row: number, col: number) => {
    onCellClick(row, col);
  }, [onCellClick]);

  const [enableEntryAnimations, setEnableEntryAnimations] = React.useState(false);
  React.useEffect(() => {
    setEnableEntryAnimations(true);
  }, []);

  return (
    <>
      <GridLayer
        currentGrid={currentGrid}
        core={core}
        fromViewCoord={fromViewCoord}
        props={props}
        onCellClick={handleGridCellClick}
      />
      <CardLayer
        core={core}
        currentGrid={currentGrid}
        myPlayerId={myPlayerId}
        toViewCoord={toViewCoord}
        props={{ ...props, enableEntryAnimations }}
        onCellClick={handleCardCellClick}
      />
    </>
  );
};
