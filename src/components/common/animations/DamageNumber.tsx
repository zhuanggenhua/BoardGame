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
  /** 延迟播放（秒），用于和投射物命中帧对齐 */
  delay?: number;
  /** 稳定测试选择器 */
  testId?: string;
  /** 字号倍率，用于棋盘级攻击结算等远景过程帧 */
  fontScale?: number;
  /** 自定义颜色 class，默认 text-red-400 */
  colorClass?: string;
  /** 飘字动画时长，默认 0.8s */
  durationSeconds?: number;
  className?: string;
}

export const DamageNumber: React.FC<DamageNumberProps> = ({
  triggerKey,
  damage,
  strong = false,
  delay = 0,
  testId = 'damage-number-float',
  fontScale = 1,
  colorClass = 'text-red-400',
  durationSeconds = 0.8,
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

  const baseFontSize = strong ? 24 : 14;
  const fontSize = baseFontSize * containerScale * fontScale;
  const floatY = -50 * containerScale;

  return (
    <motion.div
      ref={wrapRef}
      key={triggerKey}
      className={`absolute left-1/2 top-0 -translate-x-1/2 pointer-events-none z-20 ${className}`}
      data-testid={testId}
      data-damage-value={damage}
      aria-label={`伤害 -${damage}`}
      initial={{ y: 0, opacity: 0, scale: 0.5 }}
      animate={{ y: floatY, opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.1, 0.8] }}
      transition={{ duration: durationSeconds, delay, ease: 'easeOut' }}
    >
      <span
        className={`font-black whitespace-nowrap ${colorClass}`}
        style={{
          fontSize: `${fontSize}px`,
          WebkitTextStroke: `${Math.max(1, fontSize * 0.045)}px rgba(12,6,4,0.95)`,
          textShadow: '0 0 10px rgba(248,113,113,0.95), 0 3px 8px rgba(0,0,0,0.95), 0 0 18px rgba(127,29,29,0.8)',
        }}
      >
        -{damage}
      </span>
    </motion.div>
  );
};
