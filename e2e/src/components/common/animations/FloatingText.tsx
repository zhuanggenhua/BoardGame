/**
 * FloatingText — 通用飘字组件（原神风格）
 *
 * 三阶段动画：
 * 1. Pop（弹出 ~60ms）：快速从小放大到超过目标尺寸
 * 2. Hold（缩回 ~100ms）：弹性缩回到正常大小
 * 3. Float（上浮淡出 ~800ms）：斜向上浮 + 淡出
 *
 * 高 intensity 时字号略大，模拟暴击效果。
 * 纯飘字，不附带粒子/飞行效果。
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, useAnimate } from 'framer-motion';
import { createPortal } from 'react-dom';
import { UI_Z_INDEX } from '../../../core';

// ============================================================================
// 颜色配置
// ============================================================================

const FLOAT_COLORS: Record<string, string> = {
  damage: 'text-red-400',
  heal: 'text-emerald-400',
  buff: 'text-amber-400',
  custom: 'text-slate-300',
};

// ============================================================================
// 单条飘字
// ============================================================================

export interface FloatingTextData {
  id: string;
  content: React.ReactNode;
  type: 'damage' | 'heal' | 'buff' | 'custom';
  /** 视口绝对坐标 */
  position: { x: number; y: number };
  /** 强度（影响字号），默认 1 */
  intensity?: number;
}

const FloatingTextItem: React.FC<{
  data: FloatingTextData;
  onComplete: (id: string) => void;
}> = ({ data, onComplete }) => {
  const [scope, animate] = useAnimate();
  const intensity = data.intensity ?? 1;
  const isCritical = intensity >= 5;
  const fontSize = isCritical
    ? Math.min(2.2, 1.4 + intensity * 0.08)
    : Math.min(1.6, 1.0 + intensity * 0.06);

  const popScale = isCritical ? 1.8 : 1.3;
  const holdScale = isCritical ? 1.15 : 1.0;
  // 使用 vw 相对值，使飘字运动距离自适应视口尺寸（在 1920px 下与原 50/20px 一致）
  const vw = typeof window !== 'undefined' ? window.innerWidth / 100 : 19.2;
  const floatDistance = Math.round(2.6 * vw);
  const driftX = Math.round(1 * vw);
  const floatColor = FLOAT_COLORS[data.type] ?? FLOAT_COLORS.custom;

  useEffect(() => {
    const run = async () => {
      // 阶段 1：Pop — 爆发弹出（极快，从 0.3 → popScale）
      await animate(scope.current, {
        scale: popScale,
        opacity: 1,
      }, {
        duration: 0.05,
        ease: [0.0, 0.9, 0.3, 1.2], // 过冲曲线：瞬间到位并略微超调
      });

      // 阶段 2：Hold — 弹性回弹（短促有力）
      await animate(scope.current, {
        scale: holdScale,
      }, {
        duration: 0.08,
        ease: [0.22, 1.8, 0.5, 1], // 强弹性：快速回弹带轻微过冲
      });

      // 阶段 3：Float — 先快后慢上浮 + 淡出
      await animate(scope.current, {
        x: driftX,
        y: -floatDistance,
        opacity: 0,
        scale: holdScale * 0.8,
      }, {
        duration: 0.7,
        ease: [0.05, 0.7, 0.1, 1], // 强减速：起步快、后半段极慢地飘散
      });

      onComplete(data.id);
    };
    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      ref={scope}
      className="fixed pointer-events-none"
      style={{
        left: data.position.x,
        top: data.position.y,
        translateX: '-50%',
        translateY: '-50%',
        opacity: 0,
        scale: 0.3,
        zIndex: UI_Z_INDEX.overlayRaised,
      }}
    >
      <span
        className={`font-black whitespace-nowrap ${floatColor}`}
        style={{
          fontSize: `${fontSize}vw`,
          textShadow: '0 0 4px currentColor, 0 2px 6px rgba(0,0,0,0.9)',
          WebkitTextStroke: '0.3px rgba(0,0,0,0.4)',
        }}
      >
        {data.content}
      </span>
    </motion.div>
  );
};

// ============================================================================
// 飘字层 + Hook
// ============================================================================

export const FloatingTextLayer: React.FC<{
  texts: FloatingTextData[];
  onComplete: (id: string) => void;
}> = ({ texts, onComplete }) =>
  createPortal(
    <>
      {texts.map(t => (
        <FloatingTextItem key={t.id} data={t} onComplete={onComplete} />
      ))}
    </>,
    document.body,
  );

export const useFloatingText = () => {
  const [texts, setTexts] = useState<FloatingTextData[]>([]);

  const pushText = useCallback((data: Omit<FloatingTextData, 'id'>) => {
    const id = `ft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setTexts(prev => [...prev, { ...data, id }]);
  }, []);

  const removeText = useCallback((id: string) => {
    setTexts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { texts, pushText, removeText };
};
