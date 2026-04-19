/**
 * 玩家占用标签（通用组件）
 * 显示在角色/阵营卡片上，标识哪个玩家已选择该选项
 * 
 * 用法：在角色选择/阵营选择界面中，叠加在卡片右上角
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface PlayerBadgeColorScheme {
  bg: string;
  text: string;
  glow: string;
}

export interface PlayerOccupancyBadgeProps {
  /** 玩家 ID */
  playerId: string;
  /** 玩家标签（如 P1/P2） */
  label: string;
  /** 颜色方案 */
  colors: PlayerBadgeColorScheme;
  /** 尺寸（vw 单位，默认 1.2） */
  size?: number;
}

export const PlayerOccupancyBadge: React.FC<PlayerOccupancyBadgeProps> = ({
  playerId,
  label,
  colors,
  size = 1.2,
}) => {
  return (
    <motion.div
      layoutId={`occupied-${playerId}`}
      className="rounded-full border border-white/80 flex items-center justify-center font-black shadow-lg"
      style={{
        width: `${size}vw`,
        height: `${size}vw`,
        fontSize: `${size * 0.42}vw`,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {label}
    </motion.div>
  );
};
