/**
 * 召唤师战争 - 回合阶段追踪器
 * 参考 dicethrone 的 PhaseIndicator，带 tooltip 和数字
 * 使用 SVG 图标而非 emoji
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GamePhase } from '../domain/types';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';

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
  className?: string;
}

export const PhaseTracker: React.FC<PhaseTrackerProps> = ({
  currentPhase,
  turnNumber,
  isMyTurn,
  moveCount = 0,
  attackCount = 0,
  className = '',
}) => {
  const { t } = useTranslation('game-summonerwars');
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);
  const phaseCursor: Exclude<GamePhase, 'factionSelect'> = currentPhase === 'factionSelect'
    ? PHASE_ORDER[0]
    : currentPhase;

  const phasesBase: Omit<PhaseConfig, 'count' | 'maxCount'>[] = PHASE_ORDER.map((phaseId) => ({
    id: phaseId,
    label: t(`phase.${phaseId}`),
    desc: PHASE_DESC_KEYS[phaseId].map(key => t(key)),
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

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* 回合数 */}
      <div className="text-center mb-2 pb-2 border-b border-slate-600/50">
        <span className="text-base text-amber-400 font-bold">
          {t('phaseTracker.turn', { count: turnNumber })}
        </span>
      </div>
      
      {/* 阶段列表 */}
      <div className="flex flex-col gap-1.5">
        {phasesWithCount.map((phase) => {
          const isCurrent = phase.id === phaseCursor;
          const isPast = PHASE_ORDER.indexOf(phaseCursor) > PHASE_ORDER.indexOf(phase.id);
          const isHovered = hoveredPhaseId === phase.id;
          
          return (
            <div
              key={phase.id}
              className="relative"
              data-testid={`sw-phase-item-${phase.id}`}
              onMouseEnter={() => setHoveredPhaseId(phase.id)}
              onMouseLeave={() => setHoveredPhaseId(null)}
            >
              <div
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all cursor-help
                  ${isCurrent 
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-500/30' 
                    : isPast 
                      ? 'text-slate-500 bg-slate-800/30' 
                      : 'text-slate-300 bg-slate-800/50 hover:bg-slate-700/50'
                  }
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
                        px-2 py-0.5 rounded text-xs font-bold min-w-[1.5rem] text-center
                        ${isCurrent ? 'bg-amber-500/50 text-white' : 'bg-slate-700 text-slate-300'}
                      `}
                      data-testid={`sw-phase-count-${phase.id}`}
                    >
                      {phase.count}
                    </span>
                  )}
                  
                  {/* 当前阶段指示点 */}
                  {isCurrent && isMyTurn && (
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  )}
                </div>
              </div>
              
              {/* Tooltip */}
              <InfoTooltip
                title={phase.label}
                content={phase.desc}
                isVisible={isHovered}
                position="left"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PhaseTracker;
