/**
 * 召唤师战争 - 骰子结果浮层
 * 
 * 攻击时显示骰子掷骰结果
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { DiceFace } from '../config/dice';
import { DICE_FACE_CONFIG } from '../config/dice';

interface DiceResultOverlayProps {
  /** 骰子结果 */
  results: DiceFace[] | null;
  /** 攻击类型 */
  attackType: 'melee' | 'ranged' | null;
  /** 命中数 */
  hits: number;
  /** 显示时长（毫秒） */
  duration?: number;
  /** 关闭回调 */
  onClose?: () => void;
}

/** 骰子结果浮层 */
export const DiceResultOverlay: React.FC<DiceResultOverlayProps> = ({
  results,
  attackType,
  hits,
  duration = 2000,
  onClose,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (results && results.length > 0) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [results, duration, onClose]);

  if (!results || results.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="sw-dice-result-overlay"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-black/80 backdrop-blur-sm rounded-[1vw] p-[1.5vw] border border-white/20 shadow-2xl">
            {/* 标题 */}
            <div className="text-center mb-[1vw]">
              <span className="text-[1.2vw] font-bold text-white">
                {attackType === 'melee' ? '⚔️ 近战攻击' : '🏹 远程攻击'}
              </span>
            </div>

            {/* 骰子结果 */}
            <div className="flex gap-[0.8vw] justify-center mb-[1vw]">
              {results.map((face, index) => {
                const config = DICE_FACE_CONFIG[face];
                const isHit = face === attackType;
                
                return (
                  <motion.div
                    key={index}
                    initial={{ rotateY: 0, scale: 0 }}
                    animate={{ 
                      rotateY: [0, 360, 720, 1080],
                      scale: [0, 1.2, 1],
                    }}
                    transition={{ 
                      duration: 0.6,
                      delay: index * 0.1,
                      ease: 'easeOut',
                    }}
                    className={`
                      w-[3vw] h-[3vw] rounded-[0.4vw] flex items-center justify-center
                      text-[1.5vw] font-bold shadow-lg
                      ${isHit 
                        ? 'bg-green-600 border-[0.15vw] border-green-400 text-white' 
                        : 'bg-slate-700 border-[0.15vw] border-slate-500 text-slate-300'
                      }
                    `}
                  >
                    {config.icon}
                  </motion.div>
                );
              })}
            </div>

            {/* 命中结果 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center"
            >
              <span className={`text-[1.4vw] font-black ${hits > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {hits > 0 ? `💥 ${hits} 点伤害！` : '未命中'}
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DiceResultOverlay;
