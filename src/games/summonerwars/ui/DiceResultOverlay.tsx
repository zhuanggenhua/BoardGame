/**
 * 召唤师战争 - 3D骰子结果浮层
 * 
 * 参考 Dice Throne 的 Dice3D 组件，用 CSS 3D transform 实现立体骰子
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Swords, Crosshair, Zap } from 'lucide-react';
import type { DiceFace } from '../config/dice';
import { getSpriteAtlasSource, getSpriteAtlasStyle, DICE_FACE_SPRITE_MAP } from './cardAtlas';

interface DiceResultOverlayProps {
  results: DiceFace[] | null;
  attackType: 'melee' | 'ranged' | null;
  hits: number;
  /** 是否为对手攻击（用于翻转显示） */
  isOpponentAttack?: boolean;
  duration?: number;
  onClose?: () => void;
}

/** 获取骰子面的精灵图样式（从 dice.png 裁切） */
function getDiceFaceStyle(face: DiceFace, faceVariant = 0) {
  const source = getSpriteAtlasSource('sw:dice');
  if (!source) return {};

  const spriteIndices = DICE_FACE_SPRITE_MAP[face];
  const idx = spriteIndices[faceVariant % spriteIndices.length];
  const atlasStyle = getSpriteAtlasStyle(idx, source.config);

  return {
    backgroundImage: `url(${source.image})`,
    ...atlasStyle,
    backgroundRepeat: 'no-repeat' as const,
  };
}

/** 单个3D骰子（使用精灵图） */
const Dice3D: React.FC<{
  face: DiceFace;
  isHit: boolean;
  index: number;
  size?: string;
}> = ({ face, isHit, index, size = '4vw' }) => {
  const [isRolling, setIsRolling] = useState(true);
  const translateZ = `calc(${size} / 2)`;

  useEffect(() => {
    const timer = setTimeout(() => setIsRolling(false), 600 + index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  // 6个立方体面的 transform + 对应精灵图帧
  const cubeTransforms = [
    `translateZ(${translateZ})`,
    `rotateY(180deg) translateZ(${translateZ})`,
    `rotateY(90deg) translateZ(${translateZ})`,
    `rotateY(-90deg) translateZ(${translateZ})`,
    `rotateX(90deg) translateZ(${translateZ})`,
    `rotateX(-90deg) translateZ(${translateZ})`,
  ];

  // 每个面使用不同的精灵图变体（增加翻转时的视觉丰富度）
  const allFaces: DiceFace[] = ['melee', 'ranged', 'special', 'melee', 'ranged', 'melee'];

  return (
    <div
      className="relative"
      style={{ width: size, height: size, perspective: '800px' }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: isRolling
            ? `rotateX(${720 + index * 90}deg) rotateY(${720 + index * 90}deg)`
            : 'rotateX(0deg) rotateY(0deg)',
          transition: isRolling ? 'none' : 'transform 0.8s cubic-bezier(0.2, 0.8, 0.3, 1)',
          animation: isRolling ? 'sw-dice-tumble 0.5s linear infinite' : 'none',
        }}
      >
        {cubeTransforms.map((transform, i) => {
          // 正面（i===0）显示实际结果，其他面显示随机面
          const faceType = i === 0 ? face : allFaces[i];
          const spriteStyle = getDiceFaceStyle(faceType, i);

          return (
            <div
              key={i}
              className="absolute inset-0 w-full h-full rounded-[0.5vw] select-none"
              style={{
                transform,
                backfaceVisibility: 'hidden',
                ...spriteStyle,
                backgroundColor: '#8b2020',
                border: '0.12vw solid rgba(255,255,255,0.15)',
                boxShadow: 'inset 0 0 0.8vw rgba(0,0,0,0.5)',
              }}
            />
          );
        })}
      </div>
      {/* 命中高亮光晕 */}
      {!isRolling && isHit && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-[-0.3vw] rounded-[0.7vw] pointer-events-none"
          style={{ boxShadow: '0 0 1.5vw 0.5vw rgba(74,222,128,0.5)' }}
        />
      )}
      {/* 未命中灰色遮罩 */}
      {!isRolling && !isHit && (
        <div
          className="absolute inset-0 rounded-[0.5vw] pointer-events-none"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        />
      )}
      {/* 底部投影 */}
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: '80%',
          height: '15%',
          bottom: '-12%',
          left: '10%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.7), transparent)',
          filter: 'blur(3px)',
        }}
      />
    </div>
  );
};

/** 骰子结果浮层 */
export const DiceResultOverlay: React.FC<DiceResultOverlayProps> = ({
  results,
  attackType,
  hits,
  isOpponentAttack = false,
  duration = 2500,
  onClose,
}) => {
  const { t } = useTranslation('game-summonerwars');
  const [visible, setVisible] = useState(() => Boolean(results && results.length > 0));
  const timerRef = useRef<number | null>(null);
  const closeNow = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (results && results.length > 0) {
      setVisible(true);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(closeNow, duration);
      return () => {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    return undefined;
  }, [results, duration, closeNow]);

  if (!results || results.length === 0) return null;

  return (
    <>
      {/* CSS 动画 */}
      <style>{`
        @keyframes sw-dice-tumble {
          0% { transform: rotateX(0) rotateY(0); }
          100% { transform: rotateX(1440deg) rotateY(1440deg); }
        }
      `}</style>
      <AnimatePresence>
        {visible && (
          <motion.div
            data-testid="sw-dice-result-overlay"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
            onClick={closeNow}
          >
            <div
              className="flex flex-col items-center gap-[0.8vw]"
              style={{ transform: isOpponentAttack ? 'rotate(180deg)' : 'none' }}
            >
              {/* 标题（无背景框） */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-[0.5vw] text-[1.3vw] font-black tracking-wider text-white" style={{ textShadow: '0 0 1vw rgba(255,255,255,0.3)' }}>
                  {attackType === 'melee' ? <Swords className="w-[1.4em] h-[1.4em]" /> : <Crosshair className="w-[1.4em] h-[1.4em]" />}
                  <span>{attackType === 'melee' ? t('diceResult.meleeAttack') : t('diceResult.rangedAttack')}</span>
                </div>
              </div>

              {/* 3D骰子结果 */}
              <div className="flex gap-[1.2vw] justify-center">
                {results.map((face, index) => (
                  <Dice3D
                    key={index}
                    face={face}
                    isHit={face === attackType}
                    index={index}
                  />
                ))}
              </div>

              {/* 命中结果 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-center"
              >
                <div className={`flex items-center justify-center gap-[0.5vw] text-[1.6vw] font-black tracking-wide ${hits > 0 ? 'text-red-400' : 'text-slate-500'
                  }`} style={{ textShadow: hits > 0 ? '0 0 1vw rgba(248,113,113,0.5)' : 'none' }}>
                  {hits > 0 ? (
                    <>
                      <Zap className="w-[1.2em] h-[1.2em] text-yellow-400" />
                      <span>{t('diceResult.damage', { count: hits })}</span>
                    </>
                  ) : (
                    t('diceResult.miss')
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DiceResultOverlay;
