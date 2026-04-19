/**
 * 召唤师战争 - 回合阶段追踪器
 * 参考 dicethrone 的 PhaseIndicator，带 tooltip 和数字
 * 使用 SVG 图标而非 emoji
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GamePhase } from '../domain/types';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';

interface PhaseConfig {
  id: Exclude<GamePhase, 'factionSelect'>;
  label: string;
  desc: string[];
  /** 显示的数字（如移动次数、攻击次数） */
  count?: number;
  /** 数字的最大值 */
  maxCount?: number;
}

const PHASE_ORDER: Exclude<GamePhase, 'factionSelect'>[] = ['summon', 'move', 'build', 'attack', 'magic', 'draw'];

const PHASE_DESC_KEYS: Record<Exclude<GamePhase, 'factionSelect'>, string[]> = {
  summon: ['phaseDesc.summon.0', 'phaseDesc.summon.1'],
  move: ['phaseDesc.move.0', 'phaseDesc.move.1', 'phaseDesc.move.2'],
  build: ['phaseDesc.build.0', 'phaseDesc.build.1'],
  attack: ['phaseDesc.attack.0', 'phaseDesc.attack.1', 'phaseDesc.attack.2'],
  magic: ['phaseDesc.magic.0', 'phaseDesc.magic.1'],
  draw: ['phaseDesc.draw.0', 'phaseDesc.draw.1'],
};

export interface PhaseTrackerProps {
  currentPhase: GamePhase;
  turnNumber: number;
  isMyTurn: boolean;
  /** 本回合已移动次数 */
  moveCount?: number;
  /** 本回合已攻击次数 */
  attackCount?: number;
  compact?: boolean;
  className?: string;
}

export const PhaseTracker: React.FC<PhaseTrackerProps> = ({
  currentPhase,
  turnNumber,
  isMyTurn,
  moveCount = 0,
  attackCount = 0,
  compact = false,
  className = '',
}) => {
  const { t, i18n } = useTranslation('game-summonerwars');
  const isCoarsePointer = useCoarsePointer();
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);
  const [selectedPhaseState, setSelectedPhaseState] = useState<{
    scope: string;
    id: Exclude<GamePhase, 'factionSelect'>;
  } | null>(null);
  const phaseCursor: Exclude<GamePhase, 'factionSelect'> = currentPhase === 'factionSelect'
    ? PHASE_ORDER[0]
    : currentPhase;
  const selectionScope = `${currentPhase}:${isCoarsePointer ? 'coarse' : 'fine'}`;
  const selectedPhaseId = selectedPhaseState?.scope === selectionScope ? selectedPhaseState.id : null;

  const phasesBase: Omit<PhaseConfig, 'count' | 'maxCount'>[] = PHASE_ORDER.map((phaseId) => ({
    id: phaseId,
    label: t(`phase.${phaseId}`),
    desc: PHASE_DESC_KEYS[phaseId].map((key) => (
      i18n.exists(key, { ns: 'game-summonerwars' }) ? t(key) : key
    )),
  }));

  // 构建带数字的阶段配置
  const phasesWithCount: PhaseConfig[] = phasesBase.map(phase => {
    if (phase.id === 'move') {
      return { ...phase, count: 3 - moveCount, maxCount: 3 };
    }
    if (phase.id === 'attack') {
      return { ...phase, count: 3 - attackCount, maxCount: 3 };
    }
    return phase;
  });

  const detailPhaseId = isCoarsePointer ? selectedPhaseId : hoveredPhaseId;
  const detailPhase = detailPhaseId
    ? phasesWithCount.find(phase => phase.id === detailPhaseId) ?? null
    : null;
  const turnHeaderClass = compact
    ? 'text-center mb-1 pb-1 border-b border-slate-600/50'
    : 'text-center mb-2 pb-2 border-b border-slate-600/50';
  const turnLabelClass = compact
    ? 'text-[13px] text-amber-400 font-bold'
    : 'text-base text-amber-400 font-bold';
  const listClass = compact ? 'flex flex-col gap-0.5' : 'flex flex-col gap-1.5';
  const itemClass = compact
    ? 'flex items-center justify-between px-2 py-1 rounded-lg text-[11px] transition-all'
    : 'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all';
  const countBadgeClass = compact
    ? 'px-1 py-0.5 rounded text-[9px] font-bold min-w-[1.1rem] text-center'
    : 'px-2 py-0.5 rounded text-xs font-bold min-w-[1.5rem] text-center';
  const currentDotClass = compact ? 'h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse' : 'w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse';

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`}>
      {/* 回合数 */}
      <div className={turnHeaderClass}>
        <span className={turnLabelClass}>
          {t('phaseTracker.turn', { count: turnNumber })}
        </span>
      </div>
      
      {/* 阶段列表 */}
      <div className={listClass}>
        {phasesWithCount.map((phase) => {
          const isCurrent = phase.id === phaseCursor;
          const isPast = PHASE_ORDER.indexOf(phaseCursor) > PHASE_ORDER.indexOf(phase.id);
          const isHovered = hoveredPhaseId === phase.id;
          
          return (
            <div
              key={phase.id}
              className="relative"
              data-testid={`sw-phase-item-${phase.id}`}
              onMouseEnter={() => {
                if (!isCoarsePointer) setHoveredPhaseId(phase.id);
              }}
              onMouseLeave={() => {
                if (!isCoarsePointer) setHoveredPhaseId(null);
              }}
            >
              <div
                key={`${String(isCoarsePointer)}-${phase.id}`}
                role={isCoarsePointer ? 'button' : undefined}
                tabIndex={isCoarsePointer ? 0 : undefined}
                onClick={() => {
                  if (!isCoarsePointer) return;
                  setSelectedPhaseState((prev) => (
                    prev?.scope === selectionScope && prev.id === phase.id
                      ? null
                      : { scope: selectionScope, id: phase.id }
                  ));
                }}
                onKeyDown={(event) => {
                  if (!isCoarsePointer) return;
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setSelectedPhaseState({ scope: selectionScope, id: phase.id });
                }}
                className={`
                  ${itemClass}
                  ${isCurrent 
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-500/30' 
                    : isPast 
                      ? 'text-slate-500 bg-slate-800/30' 
                      : 'text-slate-300 bg-slate-800/50 hover:bg-slate-700/50'
                  }
                  ${isCoarsePointer ? 'cursor-pointer' : 'cursor-help'}
                  ${isCoarsePointer && selectedPhaseId === phase.id && !isCurrent ? 'ring-1 ring-amber-400/70' : ''}
                `}
              >
                <span className={`font-medium ${isPast ? 'line-through' : ''}`}>
                  {phase.label}
                </span>
                
                <div className="flex items-center gap-1.5">
                  {/* 数字显示 */}
                  {phase.count !== undefined && (
                    <span
                      className={`
                        ${countBadgeClass}
                        ${isCurrent ? 'bg-amber-500/50 text-white' : 'bg-slate-700 text-slate-300'}
                      `}
                      data-testid={`sw-phase-count-${phase.id}`}
                    >
                      {phase.count}
                    </span>
                  )}
                  
                  {/* 当前阶段指示点 */}
                  {isCurrent && isMyTurn && (
                    <span className={currentDotClass} />
                  )}
                </div>
              </div>
              
              {/* Tooltip */}
              {!isCoarsePointer && (
                <InfoTooltip
                  title={phase.label}
                  content={phase.desc}
                  isVisible={isHovered}
                  position="left"
                />
              )}
            </div>
          );
        })}
      </div>

      {isCoarsePointer && detailPhase && (
        <div
          className={compact
            ? 'relative z-10 mt-1 w-[9.5rem] rounded-lg border border-amber-500/30 bg-slate-950/96 px-2 py-1.5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.45)]'
            : 'rounded-lg border border-amber-500/30 bg-slate-950/92 px-3 py-2 text-left shadow-[0_12px_40px_rgba(0,0,0,0.45)]'}
          data-testid="sw-phase-detail-panel"
        >
          <div className={compact ? 'mb-1 text-[10px] font-bold tracking-wide text-amber-300' : 'mb-1 text-xs font-bold tracking-wide text-amber-300'}>
            {detailPhase.label}
          </div>
          <div className={compact ? 'flex flex-col gap-0.5' : 'flex flex-col gap-1'}>
            {detailPhase.desc.map((line, index) => (
              <div key={`${detailPhase.id}-${index}`} className={compact ? 'text-[9px] leading-snug text-slate-200' : 'text-[11px] leading-relaxed text-slate-200'}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhaseTracker;
