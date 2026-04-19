/**
 * DamageNumber — 伤害数字飘出原子组件
 *
 * 弹出 → 上浮 → 淡出的伤害数字。
 * 通过 key 驱动重复触发，不受父组件 active 生命周期限制。
 */

import React, { useRef, useState, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';

/** 参考容器宽度（px），用于计算自适应缩放比例 */
const REF_CONTAINER_WIDTH = 120;

export interface DamageNumberProps {
  /** 触发 key，每次变化触发新一轮动画 */
  triggerKey: number;
  /** 伤害值 */
  damage: number;
  /** 是否强力（影响字号） */
  strong?: boolean;
  /** 自定义颜色 class，默认 text-red-400 */
  colorClass?: string;
  className?: string;
}

export const DamageNumber: React.FC<DamageNumberProps> = ({
  triggerKey,
  damage,
  strong = false,
  colorClass = 'text-red-400',
  className = '',
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerScale, setContainerScale] = useState(1);

  // 测量父容器宽度，计算自适应缩放比例（在浏览器绘制前同步完成）
  useLayoutEffect(() => {
    const parent = wrapRef.current?.parentElement;
    if (parent) {
      const w = parent.offsetWidth;
      setContainerScale(Math.max(0.5, Math.min(2.5, w / REF_CONTAINER_WIDTH)));
    }
  }, [triggerKey]);

  if (triggerKey <= 0) return null;

  const baseFontSize = strong ? 19 : 14;
  const fontSize = baseFontSize * containerScale;
  const floatY = -50 * containerScale;

  return (
    <motion.div
      ref={wrapRef}
      key={triggerKey}
      className={`absolute left-1/2 top-0 -translate-x-1/2 pointer-events-none z-20 ${className}`}
      initial={{ y: 0, opacity: 0, scale: 0.5 }}
      animate={{ y: floatY, opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.1, 0.8] }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <span
        className={`font-black whitespace-nowrap ${colorClass}`}
        style={{
          fontSize: `${fontSize}px`,
          textShadow: '0 0 6px rgba(220,38,38,0.8), 0 2px 4px rgba(0,0,0,0.6)',
        }}
      >
        -{damage}
      </span>
    </motion.div>
  );
};
