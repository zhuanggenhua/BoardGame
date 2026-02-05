/**
 * 召唤师战争 - 单位/建筑摧毁动画
 * 
 * 当单位或建筑被摧毁时显示爆炸消散效果
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DestroyEffectData {
  id: string;
  position: { row: number; col: number };
  cardName: string;
  type: 'unit' | 'structure';
}

interface DestroyEffectProps {
  effect: DestroyEffectData;
  /** 格子位置计算函数 */
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onComplete: (id: string) => void;
}

/** 单个摧毁效果 */
const DestroyEffectItem: React.FC<DestroyEffectProps> = ({
  effect,
  getCellPosition,
  onComplete,
}) => {
  const pos = getCellPosition(effect.position.row, effect.position.col);
  const isStructure = effect.type === 'structure';
  
  // 粒子数量
  const particleCount = isStructure ? 12 : 8;
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    angle: (360 / particleCount) * i + Math.random() * 30 - 15,
    distance: 2 + Math.random() * 2, // vw
    size: 0.3 + Math.random() * 0.4, // vw
    delay: Math.random() * 0.1,
  }));
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: `${pos.width}%`,
        height: `${pos.height}%`,
      }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => onComplete(effect.id)}
    >
      {/* 中心闪光 */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.5, 2], opacity: [0, 1, 0] }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div 
          className={`w-full h-full rounded-full ${
            isStructure 
              ? 'bg-purple-400/60' 
              : 'bg-red-400/60'
          }`}
          style={{
            boxShadow: isStructure
              ? '0 0 2vw 1vw rgba(168, 85, 247, 0.5)'
              : '0 0 2vw 1vw rgba(248, 113, 113, 0.5)',
          }}
        />
      </motion.div>
      
      {/* 爆炸粒子 */}
      {particles.map((particle) => {
        const radians = (particle.angle * Math.PI) / 180;
        const endX = Math.cos(radians) * particle.distance;
        const endY = Math.sin(radians) * particle.distance;
        
        return (
          <motion.div
            key={particle.id}
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              width: `${particle.size}vw`,
              height: `${particle.size}vw`,
              marginLeft: `-${particle.size / 2}vw`,
              marginTop: `-${particle.size / 2}vw`,
            }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{
              x: `${endX}vw`,
              y: `${endY}vw`,
              scale: [1, 1.2, 0],
              opacity: [1, 0.8, 0],
            }}
            transition={{
              duration: 0.5,
              delay: particle.delay,
              ease: 'easeOut',
            }}
          >
            <div 
              className={`w-full h-full rounded-full ${
                isStructure 
                  ? 'bg-purple-300' 
                  : 'bg-orange-300'
              }`}
              style={{
                boxShadow: isStructure
                  ? '0 0 0.5vw 0.2vw rgba(168, 85, 247, 0.6)'
                  : '0 0 0.5vw 0.2vw rgba(251, 146, 60, 0.6)',
              }}
            />
          </motion.div>
        );
      })}
      
      {/* 摧毁文字提示 */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
        style={{ top: '-1.5vw' }}
        initial={{ y: 0, opacity: 0, scale: 0.8 }}
        animate={{ y: '-1vw', opacity: [0, 1, 1, 0], scale: 1 }}
        transition={{ duration: 0.8, times: [0, 0.2, 0.7, 1] }}
      >
        <span 
          className={`text-[0.9vw] font-bold ${
            isStructure ? 'text-purple-300' : 'text-red-300'
          }`}
          style={{
            textShadow: '0 0 0.5vw rgba(0,0,0,0.8)',
          }}
        >
          {effect.cardName} 被摧毁！
        </span>
      </motion.div>
    </motion.div>
  );
};

/** 摧毁效果层 */
export const DestroyEffectsLayer: React.FC<{
  effects: DestroyEffectData[];
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onEffectComplete: (id: string) => void;
}> = ({ effects, getCellPosition, onEffectComplete }) => {
  return (
    <AnimatePresence>
      {effects.map((effect) => (
        <DestroyEffectItem
          key={effect.id}
          effect={effect}
          getCellPosition={getCellPosition}
          onComplete={onEffectComplete}
        />
      ))}
    </AnimatePresence>
  );
};

/** Hook：管理摧毁效果状态 */
export const useDestroyEffects = () => {
  const [effects, setEffects] = useState<DestroyEffectData[]>([]);

  const pushEffect = useCallback((effect: Omit<DestroyEffectData, 'id'>) => {
    const id = `destroy-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setEffects((prev) => [...prev, { ...effect, id }]);
  }, []);

  const removeEffect = useCallback((id: string) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setEffects([]);
  }, []);

  return { effects, pushEffect, removeEffect, clearAll };
};

export default DestroyEffectsLayer;
