/**
 * 召唤师战争 - 回合阶段追踪器
 * 参考 dicethrone 的 PhaseIndicator，带 tooltip 和数字
 * 使用 SVG 图标而非 emoji
 */

import React, { useState } from 'react';
import type { GamePhase } from '../domain/types';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';

interface PhaseConfig {
  id: GamePhase;
  label: string;
  desc: string[];
  /** 显示的数字（如移动次数、攻击次数） */
  count?: number;
  /** 数字的最大值 */
  maxCount?: number;
}

const PHASES: Omit<PhaseConfig, 'count' | 'maxCount'>[] = [
  { id: 'summon', label: '召唤', desc: ['从手牌召唤单位', '放置在城门相邻的空格'] },
  { id: 'move', label: '移动', desc: ['移动最多3个单位', '每个单位最多移动2格', '不能对角线移动'] },
  { id: 'build', label: '建造', desc: ['建造城门或建筑', '放置在后方3行或召唤师相邻'] },
  { id: 'attack', label: '攻击', desc: ['用最多3个单位攻击', '近战：相邻目标', '远程：最多3格直线'] },
  { id: 'magic', label: '魔力', desc: ['弃置手牌获取魔力', '每张牌+1魔力'] },
  { id: 'draw', label: '抽牌', desc: ['抽牌至5张', '牌堆空时无法抽牌'] },
];

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
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);

  // 构建带数字的阶段配置
  const phasesWithCount: PhaseConfig[] = PHASES.map(phase => {
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
        <span className="text-base text-amber-400 font-bold">回合 {turnNumber}</span>
      </div>
      
      {/* 阶段列表 */}
      <div className="flex flex-col gap-1.5">
        {phasesWithCount.map((phase) => {
          const isCurrent = phase.id === currentPhase;
          const isPast = PHASES.findIndex(p => p.id === currentPhase) > PHASES.findIndex(p => p.id === phase.id);
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
