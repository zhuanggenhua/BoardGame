/**
 * RedPulse — 红色脉冲原子组件
 *
 * 受击时的红色闪烁覆盖层，纯视觉反馈。
 * 可独立使用，也可作为 ImpactContainer 的子效果。
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface RedPulseProps {
  /** 是否激活 */
  active: boolean;
  /** 是否强力（影响闪烁节奏和峰值） */
  strong?: boolean;
  /** 自定义颜色，默认红色 */
  color?: string;
  className?: string;
}

export const RedPulse: React.FC<RedPulseProps> = ({
  active,
  strong = false,
  color = 'rgba(220, 38, 38, 0.6)',
  className = '',
}) => {
  if (!active) return null;

  return (
    <motion.div
      className={`absolute inset-0 rounded pointer-events-none ${className}`}
      style={{ backgroundColor: color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: strong ? [0, 0.7, 0.1, 0.5, 0] : [0, 0.6, 0, 0.3, 0] }}
      transition={{ duration: strong ? 0.45 : 0.3, delay: 0.05 }}
    />
  );
};
