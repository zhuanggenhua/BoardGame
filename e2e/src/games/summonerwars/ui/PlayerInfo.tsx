/**
 * 召唤师战争 - 玩家信息面板
 * 显示玩家名、头像、魔力条
 */

import React from 'react';
import { User } from 'lucide-react';
import { EnergyBar } from './EnergyBar';

export interface PlayerInfoProps {
  name: string;
  magic: number;
  maxMagic?: number;
  isCurrentTurn: boolean;
  isOpponent?: boolean;
  avatarUrl?: string;
  className?: string;
}

export const PlayerInfo: React.FC<PlayerInfoProps> = ({
  name,
  magic,
  maxMagic = 15,
  isCurrentTurn,
  isOpponent = false,
  avatarUrl,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 头像 */}
      <div className={`
        relative w-12 h-12 rounded-lg overflow-hidden border-2 
        ${isCurrentTurn ? 'border-amber-400 shadow-lg shadow-amber-400/30' : 'border-slate-600'}
      `}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
            <User size={24} className={isOpponent ? 'text-slate-400' : 'text-purple-400'} />
          </div>
        )}
        {isCurrentTurn && (
          <div className="absolute inset-0 bg-amber-400/20 animate-pulse" />
        )}
      </div>
      
      {/* 名称和魔力 */}
      <div className="flex flex-col gap-1">
        <span className={`text-sm font-medium ${isCurrentTurn ? 'text-amber-200' : 'text-slate-300'}`}>
          {name}
        </span>
        <EnergyBar 
          current={magic} 
          max={maxMagic} 
          isOpponent={isOpponent}
          className="scale-90 origin-left"
        />
      </div>
    </div>
  );
};

export default PlayerInfo;
