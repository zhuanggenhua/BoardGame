/**
 * 召唤师战争 - 3D骰子结果浮层
 * 
 * 参考 Dice Throne 的 Dice3D 组件，用 CSS 3D transform 实现立体骰子
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Crosshair, RotateCcw, Swords, Zap } from 'lucide-react';
import type { DiceFaceResult, DiceMark } from '../config/dice';
import { getSpriteAtlasSource, getSpriteAtlasStyle, DICE_FACE_SPRITE_MAP } from './cardAtlas';
import { swAttackDebugLog } from './attackDebug';
import { UI_Z_INDEX } from '../../../core';
import { useResultRevealAnimation } from '../../../hooks/ui/useResultRevealAnimation';

interface DiceResultOverlayProps {
  results: DiceFaceResult[] | null;
  attackType: 'melee' | 'ranged' | null;
  hits: number;
  /** 被减少的命中数（迷魂/神圣护盾等） */
  damageReduced?: number;
  /** 区分相同骰面但不同攻击/不同激励决策，避免复用旧展示状态。 */
  resultKey?: string;
  /** 是否为对手攻击（用于翻转显示） */
  isOpponentAttack?: boolean;
  duration?: number;
  pendingDecision?: boolean;
  onReroll?: () => void;
  onKeep?: () => void;
  onRevealComplete?: () => void;
  onClose?: () => void;
}

/** 获取骰子面的精灵图样式（从 dice.png 裁切，使用帧索引） */
function getDiceFaceStyleByIndex(faceIndex: number) {
  const source = getSpriteAtlasSource('sw:dice');
  if (!source) return {};

  const atlasStyle = getSpriteAtlasStyle(faceIndex, source.config);
  return {
    backgroundImage: `url(${source.image})`,
    ...atlasStyle,
    backgroundRepeat: 'no-repeat' as const,
  };
}

/** 获取骰子面的精灵图样式（从标记类型，用于立方体非正面） */
function getDiceFaceStyleByMark(mark: DiceMark, variant = 0) {
  const source = getSpriteAtlasSource('sw:dice');
  if (!source) return {};

  const spriteIndices = DICE_FACE_SPRITE_MAP[mark];
  const idx = spriteIndices[variant % spriteIndices.length];
  const atlasStyle = getSpriteAtlasStyle(idx, source.config);
  return {
    backgroundImage: `url(${source.image})`,
    ...atlasStyle,
    backgroundRepeat: 'no-repeat' as const,
  };
}

/** 单个3D骰子（使用精灵图） */
const Dice3D: React.FC<{
  face: DiceFaceResult;
  isHit: boolean;
  index: number;
  presentationKey?: string | number;
  size?: string;
}> = ({ face, isHit, index, presentationKey, size = '4vw' }) => {
  const { isRevealing: isRolling } = useResultRevealAnimation({
    value: face.faceIndex,
    presentationKey,
    durationMs: 600 + index * 100,
    animateOnMount: true,
  });
  const translateZ = `calc(${size} / 2)`;

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
  const decorativeFaces: DiceMark[] = ['melee', 'ranged', 'special', 'melee', 'ranged', 'melee'];

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
          // 正面（i===0）显示实际骰子面，其他面显示装饰性随机面
          const spriteStyle = i === 0
            ? getDiceFaceStyleByIndex(face.faceIndex)
            : getDiceFaceStyleByMark(decorativeFaces[i], i);

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
  damageReduced,
  resultKey,
  isOpponentAttack: _isOpponentAttack = false,
  duration = 2500,
  pendingDecision = false,
  onReroll,
  onKeep,
  onRevealComplete,
  onClose,
}) => {
  const { t } = useTranslation('game-summonerwars');
  const resultSignature = useMemo(() => resultKey ?? JSON.stringify(results ?? []), [resultKey, results]);
  const hasResults = Boolean(results && results.length > 0);
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);
  const dismissed = dismissedSignature === resultSignature;
  const visible = hasResults && !dismissed;
  const timerRef = useRef<number | null>(null);
  const revealCompleteTimerRef = useRef<number | null>(null);
  const revealedSignatureRef = useRef<string | null>(null);
  const resultSignatureRef = useRef(resultSignature);
  const onRevealCompleteRef = useRef(onRevealComplete);
  const onCloseRef = useRef(onClose);
  const closeNow = useCallback(() => {
    const latestSignature = resultSignatureRef.current;
    swAttackDebugLog('dice_overlay_close_now', {
      resultSignature: latestSignature,
      duration,
    });
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (revealCompleteTimerRef.current) {
      window.clearTimeout(revealCompleteTimerRef.current);
      revealCompleteTimerRef.current = null;
    }
    setDismissedSignature(latestSignature);
    onCloseRef.current?.();
  }, [duration]);

  useEffect(() => {
    resultSignatureRef.current = resultSignature;
    onRevealCompleteRef.current = onRevealComplete;
    onCloseRef.current = onClose;
  }, [onClose, onRevealComplete, resultSignature]);

  useEffect(() => {
    if (!hasResults) {
      const timer = window.setTimeout(() => setDismissedSignature(null), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [hasResults]);

  useEffect(() => {
    if (visible) {
      if (pendingDecision) return undefined;
      swAttackDebugLog('dice_overlay_timer_scheduled', {
        resultSignature,
        duration,
      });
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(closeNow, duration);
      if (revealCompleteTimerRef.current) {
        window.clearTimeout(revealCompleteTimerRef.current);
      }
      const revealDelayMs = Math.max(800, 600 + Math.max(0, (results?.length ?? 1) - 1) * 100);
      revealCompleteTimerRef.current = window.setTimeout(() => {
        if (revealedSignatureRef.current === resultSignature) return;
        revealedSignatureRef.current = resultSignature;
        swAttackDebugLog('dice_overlay_reveal_complete', {
          resultSignature,
          revealDelayMs,
        });
        onRevealCompleteRef.current?.();
      }, revealDelayMs);
      return () => {
        swAttackDebugLog('dice_overlay_timer_cleared', {
          resultSignature,
        });
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (revealCompleteTimerRef.current) {
          window.clearTimeout(revealCompleteTimerRef.current);
          revealCompleteTimerRef.current = null;
        }
      };
    }
    return undefined;
  }, [visible, duration, closeNow, pendingDecision, resultSignature, results?.length]);

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
            className={`fixed inset-0 flex items-center justify-center ${pendingDecision ? 'cursor-default' : 'cursor-pointer'}`}
            style={{ zIndex: UI_Z_INDEX.overlayRaised }}
            onClick={pendingDecision ? undefined : closeNow}
          >
            <div className="flex flex-col items-center gap-[0.8vw]">
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
                    isHit={face.marks.includes(attackType as DiceMark)}
                    index={index}
                    presentationKey={`${resultSignature}:${index}`}
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
                {damageReduced != null && damageReduced > 0 && (
                  <div className="flex items-center justify-center gap-[0.4vw] text-[1vw] font-semibold text-cyan-300 mt-[0.2vw]"
                    style={{ textShadow: '0 0 0.8vw rgba(103,232,249,0.5)' }}>
                    <span>🌀 {t('diceResult.evasionReduced', { count: damageReduced })}</span>
                  </div>
                )}
              </motion.div>

              {pendingDecision && (
                <div className="mt-3 flex min-h-11 items-center justify-center gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-red-700 px-4 text-sm font-semibold text-white shadow-lg hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReroll?.();
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('actions.shourenRerollAll')}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white shadow-lg hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      onKeep?.();
                    }}
                  >
                    <Check className="h-4 w-4" />
                    {t('actions.shourenKeepRoll')}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DiceResultOverlay;
