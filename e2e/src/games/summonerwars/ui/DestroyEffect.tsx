/**
 * 召唤师战争 - 单位/建筑摧毁动画
 *
 * 当单位或建筑被摧毁时，将卡图碎裂飞散（ShatterEffect）
 * 同时显示摧毁文字提示
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ShatterEffect } from '../../../components/common/animations/ShatterEffect';
import type { ShatterImageSource } from '../../../components/common/animations/ShatterEffect';
import { getSpriteAtlasSource, getSpriteAtlasStyle } from './cardAtlas';

export interface DestroyEffectData {
  id: string;
  position: { row: number; col: number };
  cardName: string;
  type: 'unit' | 'structure';
  /** 精灵图集 ID（可选，有则渲染卡图碎裂） */
  atlasId?: string;
  /** 精灵图帧索引 */
  frameIndex?: number;
}

interface DestroyEffectProps {
  effect: DestroyEffectData;
  /** 格子位置计算函数 */
  getCellPosition: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  onComplete: (id: string) => void;
}

/** 卡牌宽高比（与 CardSprite / BoardEffects 一致） */
const CARD_ASPECT_RATIO = 1044 / 729;
/** 卡牌在格子内的宽度比例（与 UnitCell 的 w-[85%] 一致） */
const CARD_WIDTH_RATIO = 0.85;

/** 单个摧毁效果 */
const DestroyEffectItem: React.FC<DestroyEffectProps> = ({
  effect,
  getCellPosition,
  onComplete,
}) => {
  const { t } = useTranslation('game-summonerwars');
  const pos = getCellPosition(effect.position.row, effect.position.col);
  const isStructure = effect.type === 'structure';
  const [cardHidden, setCardHidden] = useState(false);

  // 获取精灵图样式
  const spriteSource = effect.atlasId ? getSpriteAtlasSource(effect.atlasId) : undefined;
  const spriteStyle = spriteSource && effect.frameIndex != null
    ? getSpriteAtlasStyle(effect.frameIndex, spriteSource.config)
    : undefined;

  // 构建直接图片源（useMemo 稳定引用，防止 ShatterEffect 动画重启）
  const imageSource = useMemo<ShatterImageSource | undefined>(() => {
    if (!spriteSource || !spriteStyle) return undefined;
    return {
      url: spriteSource.image,
      bgSize: spriteStyle.backgroundSize as string,
      bgPosition: spriteStyle.backgroundPosition as string,
    };
  }, [spriteSource, spriteStyle]);

  return (
    <motion.div
      className="absolute pointer-events-none flex items-center justify-center"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: `${pos.width}%`,
        height: `${pos.height}%`,
      }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 卡图 + 碎裂效果：与卡牌相同的宽度比例 + 宽高比 */}
      <div
        className="relative"
        style={{ width: `${CARD_WIDTH_RATIO * 100}%`, aspectRatio: `${CARD_ASPECT_RATIO}`, maxHeight: '100%', overflow: 'visible' }}
      >
        {spriteSource ? (
          <>
            {/* 卡图内容（碎裂时隐藏） */}
            <div
              data-shatter-target
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${spriteSource.image})`,
                backgroundRepeat: 'no-repeat',
                ...spriteStyle,
                visibility: cardHidden ? 'hidden' : 'visible',
              }}
            />
            <ShatterEffect
              active
              intensity={isStructure ? 'strong' : 'normal'}
              imageSource={imageSource}
              onStart={() => setCardHidden(true)}
              onComplete={() => onComplete(effect.id)}
            />
          </>
        ) : (
          /* 无精灵图时用闪光 + 延时完成 */
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5, 2], opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            onAnimationComplete={() => onComplete(effect.id)}
          >
            <div
              className={`w-full h-full rounded-full ${
                isStructure ? 'bg-purple-400/60' : 'bg-red-400/60'
              }`}
              style={{
                boxShadow: isStructure
                  ? '0 0 2vw 1vw rgba(168, 85, 247, 0.5)'
                  : '0 0 2vw 1vw rgba(248, 113, 113, 0.5)',
              }}
            />
          </motion.div>
        )}
      </div>

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
          style={{ textShadow: '0 0 0.5vw rgba(0,0,0,0.8)' }}
        >
          {t('destroyEffect.destroyed', { name: effect.cardName })}
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
    <div className="absolute inset-0 pointer-events-none z-20" style={{ overflow: 'visible' }}>
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
    </div>
  );
};

/** Hook：管理摧毁效果状态 */
export const useDestroyEffects = () => {
  const [effects, setEffects] = useState<DestroyEffectData[]>([]);
  const backlogLogRef = useRef(0);
  const LOG_THRESHOLD = 12;
  const LOG_STEP = 6;

  const pushEffect = useCallback((effect: Omit<DestroyEffectData, 'id'>) => {
    const id = `destroy-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setEffects((prev) => {
      const next = [...prev, { ...effect, id }];
      if (next.length >= LOG_THRESHOLD && next.length >= backlogLogRef.current + LOG_STEP) {
        backlogLogRef.current = next.length;
        console.warn(`[SW-FX] event=destroy_effects_backlog size=${next.length}`);
      }
      return next;
    });
  }, []);

  const removeEffect = useCallback((id: string) => {
    setEffects((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (next.length < backlogLogRef.current) {
        backlogLogRef.current = next.length;
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEffects([]);
    backlogLogRef.current = 0;
  }, []);

  return { effects, pushEffect, removeEffect, clearAll };
};

export default DestroyEffectsLayer;
