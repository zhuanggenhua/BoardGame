import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Skull, Sparkles, Trophy, Zap } from 'lucide-react';
import i18next from 'i18next';
import { ShatterEffect, type ShatterImageSource } from '../../../components/common/animations/ShatterEffect';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';
import {
  getLocalizedAssetPath,
  getOptimizedImageUrls,
  getResolvedImageCandidateUrl,
  getRuntimeImageCandidateUrls,
  UI_Z_INDEX,
  type CardPreviewRef,
} from '../../../core';
import type { FxRendererProps } from '../../../engine/fx';
import { computeSpriteStyle } from '../../../engine/primitives/spriteAtlas';
import { getCardDef, resolveCardName } from '../data/cards';

type ScreenPoint = { left: number; top: number };
export type AbilityHighlightTone = 'info' | 'danger' | 'buff' | 'score';
type AbilityActionKind = 'destroy' | 'buff' | 'score' | 'info';

function useStableComplete(onComplete: () => void): () => void {
  const ref = useRef(onComplete);
  useEffect(() => { ref.current = onComplete; }, [onComplete]);
  return useCallback(() => ref.current(), []);
}

function readScreenPoint(value: unknown): ScreenPoint | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const point = value as Partial<ScreenPoint>;
  return typeof point.left === 'number' && typeof point.top === 'number'
    ? { left: point.left, top: point.top }
    : undefined;
}

function getViewportSize() {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function resolveActionKind(
  explicit: unknown,
  tone: AbilityHighlightTone | undefined,
  effectLabel: string | undefined,
): AbilityActionKind {
  if (explicit === 'destroy' || explicit === 'buff' || explicit === 'score' || explicit === 'info') {
    return explicit;
  }
  const label = effectLabel ?? '';
  if (tone === 'danger' || /消灭|摧毁|陷阱|暗杀|discard|destroy/i.test(label)) return 'destroy';
  if (tone === 'buff' || /\+|加成|力量|power|buff/i.test(label)) return 'buff';
  if (tone === 'score' || /vp|分|得分|score/i.test(label)) return 'score';
  return 'info';
}

function resolveAbilityTone(tone: AbilityHighlightTone | undefined, actionKind: AbilityActionKind) {
  if (actionKind === 'destroy' || tone === 'danger') {
    return {
      accent: '#fb7185',
      accentSoft: 'rgba(251,113,133,0.22)',
      glow: 'rgba(248,113,113,0.44)',
      cardRing: 'shadow-[0_0_42px_rgba(248,113,113,0.54)]',
      orb: 'from-red-100 via-rose-300 to-orange-400',
      targetTint: 'rgba(127,29,29,0.42)',
    };
  }
  if (actionKind === 'buff' || tone === 'buff') {
    return {
      accent: '#34d399',
      accentSoft: 'rgba(52,211,153,0.22)',
      glow: 'rgba(52,211,153,0.44)',
      cardRing: 'shadow-[0_0_42px_rgba(52,211,153,0.52)]',
      orb: 'from-emerald-100 via-emerald-300 to-lime-300',
      targetTint: 'rgba(6,95,70,0.38)',
    };
  }
  if (actionKind === 'score' || tone === 'score') {
    return {
      accent: '#facc15',
      accentSoft: 'rgba(250,204,21,0.24)',
      glow: 'rgba(250,204,21,0.46)',
      cardRing: 'shadow-[0_0_42px_rgba(250,204,21,0.56)]',
      orb: 'from-yellow-100 via-amber-300 to-orange-300',
      targetTint: 'rgba(113,63,18,0.38)',
    };
  }
  return {
    accent: '#38bdf8',
    accentSoft: 'rgba(56,189,248,0.20)',
    glow: 'rgba(56,189,248,0.4)',
    cardRing: 'shadow-[0_0_40px_rgba(56,189,248,0.5)]',
    orb: 'from-sky-100 via-cyan-300 to-amber-200',
    targetTint: 'rgba(12,74,110,0.36)',
  };
}

type AbilityTone = ReturnType<typeof resolveAbilityTone>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const easeInOutCubic = (value: number) => (value < 0.5
  ? 4 * value * value * value
  : 1 - ((-2 * value + 2) ** 3) / 2);

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map(ch => `${ch}${ch}`).join('')
    : normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveShatterImageSource(previewRef: CardPreviewRef | undefined, locale: string): ShatterImageSource | undefined {
  if (!previewRef || previewRef.type !== 'atlas') return undefined;
  const source = getCardAtlasSource(previewRef.atlasId, locale);
  if (!source) return undefined;
  const style = computeSpriteStyle(previewRef.index, source.config);
  const candidateUrls = getRuntimeImageCandidateUrls(source.image, locale);
  const url = getResolvedImageCandidateUrl(candidateUrls, source.image, locale)
    || candidateUrls[0]
    || getOptimizedImageUrls(getLocalizedAssetPath(source.image, locale)).webp;
  if (!url) return undefined;
  return {
    url,
    bgSize: String(style.backgroundSize ?? '100% 100%'),
    bgPosition: String(style.backgroundPosition ?? '0% 0%'),
  };
}

function curvePoint(source: ScreenPoint, target: ScreenPoint, t: number): ScreenPoint {
  const c1 = { left: source.left + 112, top: source.top - 150 };
  const c2 = { left: target.left - 144, top: target.top - 126 };
  const mt = 1 - t;
  return {
    left: mt ** 3 * source.left + 3 * mt ** 2 * t * c1.left + 3 * mt * t ** 2 * c2.left + t ** 3 * target.left,
    top: mt ** 3 * source.top + 3 * mt ** 2 * t * c1.top + 3 * mt * t ** 2 * c2.top + t ** 3 * target.top,
  };
}

function drawCurveSegment(
  ctx: CanvasRenderingContext2D,
  source: ScreenPoint,
  target: ScreenPoint,
  from: number,
  to: number,
) {
  const steps = Math.max(2, Math.ceil((to - from) * 80));
  for (let i = 0; i <= steps; i += 1) {
    const t = from + ((to - from) * i) / steps;
    const p = curvePoint(source, target, clamp01(t));
    if (i === 0) ctx.moveTo(p.left, p.top);
    else ctx.lineTo(p.left, p.top);
  }
}

function drawGlowOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(0.32, rgba(color, alpha * 0.88));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function AbilityArcCanvas({
  sourcePos,
  targetPos,
  tone,
  actionKind,
  totalDurationS,
}: {
  sourcePos: ScreenPoint;
  targetPos: ScreenPoint;
  tone: AbilityTone;
  actionKind: AbilityActionKind;
  totalDurationS: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceLeft = sourcePos.left;
  const sourceTop = sourcePos.top;
  const targetLeft = targetPos.left;
  const targetTop = targetPos.top;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const sourcePoint = { left: sourceLeft, top: sourceTop };
    const targetPoint = { left: targetLeft, top: targetTop };
    const vectorX = targetPoint.left - sourcePoint.left;
    const vectorY = targetPoint.top - sourcePoint.top;
    const vectorLength = Math.max(1, Math.hypot(vectorX, vectorY));
    const pathSourcePoint = {
      left: sourcePoint.left + (vectorX / vectorLength) * 84,
      top: sourcePoint.top + (vectorY / vectorLength) * 84,
    };
    let rafId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const durationMs = totalDurationS * 1000;
    const startTime = performance.now();
    const particleCount = actionKind === 'destroy' ? 12 : 10;

    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth * dpr);
      canvas.height = Math.ceil(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    const draw = (now: number) => {
      const elapsedMs = now - startTime;
      const progress = clamp01(elapsedMs / durationMs);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.globalCompositeOperation = 'lighter';

      const wake = easeOutCubic(clamp01(elapsedMs / 360));
      const wakeFade = 1 - clamp01((elapsedMs - 540) / 520);
      if (wakeFade > 0) {
        drawGlowOrb(ctx, sourcePoint.left, sourcePoint.top, 38 + wake * 28, tone.accent, 0.16 * wakeFade);
        drawGlowOrb(ctx, sourcePoint.left, sourcePoint.top, 12 + wake * 10, '#ffffff', 0.14 * wakeFade);
      }

      const travel = easeInOutCubic(clamp01((elapsedMs - 230) / 920));
      if (travel > 0 && elapsedMs < 1900) {
        const head = clamp01(travel);
        const tail = 0;
        const headPoint = curvePoint(pathSourcePoint, targetPoint, head);
        const gradient = ctx.createLinearGradient(pathSourcePoint.left, pathSourcePoint.top, targetPoint.left, targetPoint.top);
        gradient.addColorStop(0, rgba(tone.accent, 0));
        gradient.addColorStop(0.28, rgba(tone.accent, 0.92));
        gradient.addColorStop(0.62, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, rgba(tone.accent, 0.94));

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        drawCurveSegment(ctx, pathSourcePoint, targetPoint, tail, head);
        ctx.strokeStyle = rgba(tone.accent, 0.12);
        ctx.lineWidth = actionKind === 'destroy' ? 4.4 : 3.8;
        ctx.stroke();

        ctx.beginPath();
        drawCurveSegment(ctx, pathSourcePoint, targetPoint, tail, head);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = actionKind === 'destroy' ? 1.8 : 1.5;
        ctx.stroke();

        ctx.beginPath();
        drawCurveSegment(ctx, pathSourcePoint, targetPoint, Math.max(tail, head - 0.2), head);
        ctx.strokeStyle = 'rgba(255,255,255,0.72)';
        ctx.lineWidth = 0.7;
        ctx.stroke();

        drawGlowOrb(ctx, headPoint.left, headPoint.top, actionKind === 'destroy' ? 8 : 7, tone.accent, 0.34);
        drawGlowOrb(ctx, headPoint.left, headPoint.top, 2.8, '#ffffff', 0.42);

        for (let i = 0; i < 4; i += 1) {
          const localT = clamp01(head - i * 0.09);
          if (localT <= tail) continue;
          const p = curvePoint(pathSourcePoint, targetPoint, localT);
          const size = Math.max(1.1, 2.6 - i * 0.35);
          drawGlowOrb(ctx, p.left, p.top, size * 1.8, tone.accent, 0.12);
        }
      }

      const impact = easeOutCubic(clamp01((elapsedMs - 1120) / 360));
      const impactFade = 1 - clamp01((elapsedMs - 1420) / 560);
      if (impact > 0 && impactFade > 0) {
        drawGlowOrb(ctx, targetPoint.left, targetPoint.top, 24 + impact * 34, tone.accent, 0.18 * impactFade);
        drawGlowOrb(ctx, targetPoint.left, targetPoint.top, 8 + impact * 15, '#ffffff', 0.16 * impactFade);
      }

      const burst = clamp01((elapsedMs - 1120) / 540);
      if (burst > 0 && burst < 1) {
        const fade = 1 - burst;
        for (let i = 0; i < particleCount; i += 1) {
          const angle = (Math.PI * 2 * i) / particleCount + ((i % 5) - 2) * 0.09;
          const distance = (actionKind === 'destroy' ? 52 : 42) * easeOutCubic(burst) * (0.58 + (i % 7) * 0.07);
          const x = targetPoint.left + Math.cos(angle) * distance;
          const y = targetPoint.top + Math.sin(angle) * distance;
          const radius = (i % 3 === 0 ? 2.5 : 1.8) * (0.65 + fade);
          drawGlowOrb(ctx, x, y, radius * 3.2, tone.accent, 0.12 * fade);
          ctx.fillStyle = i % 4 === 0 ? `rgba(255,255,255,${0.88 * fade})` : rgba(tone.accent, 0.76 * fade);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      if (progress < 1) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [actionKind, sourceLeft, sourceTop, targetLeft, targetTop, tone.accent, totalDurationS]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: UI_Z_INDEX.overlayRaised + 1, mixBlendMode: 'screen' }}
      data-testid="smashup-triggered-fx-canvas"
    />
  );
}

function ActionGlyph({ actionKind, accent, delayS }: { actionKind: AbilityActionKind; accent: string; delayS: number }) {
  const isDestroy = actionKind === 'destroy';
  const common = { size: isDestroy ? 20 : 42, strokeWidth: isDestroy ? 2.2 : 2.6 };
  const icon = actionKind === 'destroy'
    ? <Skull {...common} />
    : actionKind === 'buff'
      ? <Plus {...common} />
      : actionKind === 'score'
        ? <Trophy {...common} />
        : <Sparkles {...common} />;

  return (
    <motion.div
      className={`absolute flex items-center justify-center bg-slate-950/78 text-white shadow-2xl ${
        isDestroy ? 'h-9 w-9 rounded-full' : 'h-20 w-20 rounded-[22px]'
      }`}
      style={{
        left: isDestroy ? '64%' : '50%',
        top: isDestroy ? '32%' : '50%',
        marginLeft: isDestroy ? -18 : -40,
        marginTop: isDestroy ? -18 : -40,
        boxShadow: isDestroy ? `0 0 18px ${accent}` : `0 0 34px ${accent}, inset 0 0 18px ${accent}`,
      }}
      initial={{ opacity: 0, scale: 0.35, rotate: -18 }}
      animate={isDestroy
        ? { opacity: [0, 0.92, 0.88, 0], scale: [0.35, 1.08, 1, 0.82], rotate: [-10, 4, 0, 0] }
        : { opacity: [0, 1, 1, 0.88, 0], scale: [0.35, 1.22, 1, 1.08, 1.34], rotate: [-18, 7, 0, 0, 18] }}
      transition={{ duration: isDestroy ? 1.45 : 2.2, times: isDestroy ? [0, 0.22, 0.72, 1] : [0, 0.14, 0.42, 0.78, 1], delay: delayS + (isDestroy ? 0.42 : 0), ease: 'easeOut' }}
      data-testid="smashup-triggered-fx-action-glyph"
    >
      {icon}
    </motion.div>
  );
}

function CardSplitEffect({
  shatterImageSource,
  onShatterStart,
}: {
  shatterImageSource: ShatterImageSource | undefined;
  onShatterStart: () => void;
}) {
  const [shatterActive, setShatterActive] = useState(false);
  const shatterKey = shatterImageSource
    ? `${shatterImageSource.url}|${shatterImageSource.bgSize}|${shatterImageSource.bgPosition}`
    : '';

  useEffect(() => {
    const timer = window.setTimeout(() => setShatterActive(true), 960);
    return () => window.clearTimeout(timer);
  }, [shatterKey]);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      data-testid="smashup-triggered-fx-card-split"
    >
      {shatterImageSource && shatterActive ? (
        <ShatterEffect
          active
          intensity="strong"
          cols={5}
          rows={4}
          imageSource={shatterImageSource}
          quality="full"
          spreadScale={1.18}
          durationScale={1.6}
          fadePower={1.12}
          minScale={0.72}
          onStart={onShatterStart}
        />
      ) : null}
    </div>
  );
}

function TargetImpact({
  actionKind,
  tone,
  targetCardPreview,
  resolvedTargetName,
  renderCardBody,
  compactCardBody,
  shatterImageSource,
}: {
  actionKind: AbilityActionKind;
  tone: ReturnType<typeof resolveAbilityTone>;
  targetCardPreview: CardPreviewRef | undefined;
  resolvedTargetName: string | undefined;
  renderCardBody: boolean;
  compactCardBody: boolean;
  shatterImageSource: ShatterImageSource | undefined;
}) {
  const [hideDestroyedCard, setHideDestroyedCard] = useState(false);

  const targetMotion = actionKind === 'destroy'
    ? {
      opacity: renderCardBody ? [0, 1, 1, 1, 0.36] : [0, 1, 1, 0.8, 0],
      scale: renderCardBody ? [0.92, 1.08, 1, 1.02, 0.98] : [0.82, 1.02, 1, 1.04, 0.96],
      rotate: renderCardBody ? [0, 0, -2, 1, 0] : [0, 0, -4, 5, 4],
      y: renderCardBody ? [8, 0, 0, 0, 6] : [12, 0, 0, 6, 12],
      filter: renderCardBody
        ? ['brightness(1)', 'brightness(1.18)', 'brightness(1.08)', 'brightness(1)', 'brightness(0.82)']
        : ['grayscale(0) brightness(1)', 'grayscale(0) brightness(1.1)', 'grayscale(0.75) brightness(0.72)', 'grayscale(1) brightness(0.48)', 'grayscale(1) brightness(0.36)'],
    }
    : {
      opacity: renderCardBody ? [0, 1, 1, 0.92, 0] : [0, 1, 1, 0],
      scale: [0.84, 1.08, 1, 1.04, 0.96],
      rotate: [0, -2, 1, 0, 0],
      y: [14, 0, -6, -4, -18],
      filter: ['brightness(1)', 'brightness(1.15)', 'brightness(1.06)', 'brightness(1.1)', 'brightness(1)'],
    };

  return (
    <motion.div
      className={renderCardBody
        ? `relative ${compactCardBody ? 'h-[136px] w-[96px]' : 'h-[168px] w-[118px]'} rounded-xl bg-slate-900 ${compactCardBody ? 'shadow-[0_16px_34px_rgba(0,0,0,0.42)]' : tone.cardRing}`
        : 'relative h-[164px] w-[164px] rounded-[28px]'}
      initial={{ opacity: 0, scale: 0.82, rotate: 0, y: 12 }}
      animate={targetMotion}
      transition={{ duration: actionKind === 'destroy' && renderCardBody ? 2.65 : 2.1, times: [0, 0.14, 0.46, 0.74, 1], delay: 0.58, ease: 'easeOut' }}
      data-testid="smashup-triggered-fx-target-card"
    >
      {renderCardBody && (
        <>
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-lg"
            animate={actionKind === 'destroy'
              ? hideDestroyedCard ? {
                opacity: 0,
                scale: 1.02,
                filter: 'brightness(0.9) saturate(0.8)',
              } : {
                opacity: [1, 1, 0, 0],
                scale: [1, 1.03, 1.02, 1.02],
                filter: ['brightness(1)', 'brightness(1.2)', 'brightness(1.1) saturate(0.95)', 'brightness(1) saturate(0.9)'],
              }
              : { opacity: 1, scale: 1, filter: 'brightness(1)' }}
            transition={actionKind === 'destroy'
              ? hideDestroyedCard
                ? { duration: 0.08, ease: 'easeOut' }
                : { duration: 1.42, delay: 0.72, times: [0, 0.38, 0.78, 1], ease: 'easeOut' }
              : { duration: 0.2 }}
          >
            {targetCardPreview ? (
              <CardPreview
                previewRef={targetCardPreview}
                className="h-full w-full rounded-lg object-cover"
                title={resolvedTargetName}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-slate-800">
                <Sparkles size={34} />
              </div>
            )}
            <div
              className="absolute inset-0 rounded-lg"
              style={{ background: `radial-gradient(circle, transparent 22%, ${tone.targetTint} 100%)` }}
            />
          </motion.div>
          {actionKind === 'destroy' && (
            <CardSplitEffect
              key={shatterImageSource
                ? `${shatterImageSource.url}|${shatterImageSource.bgSize}|${shatterImageSource.bgPosition}`
                : 'no-shatter-source'}
              shatterImageSource={shatterImageSource}
              onShatterStart={() => setHideDestroyedCard(true)}
            />
          )}
        </>
      )}

      {actionKind === 'destroy' && (
        <>
          <motion.div
            className="absolute inset-[-14px] rounded-[24px] bg-[radial-gradient(circle,rgba(255,255,255,0.11)_0%,rgba(248,113,113,0.18)_36%,rgba(15,23,42,0.20)_70%,transparent_100%)]"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: [0, 0.12, 0.46, 0.38, 0], scale: [0.72, 1.02, 1.08, 1.02, 0.98] }}
            transition={{ duration: 1.6, delay: 0.56, times: [0, 0.16, 0.36, 0.76, 1], ease: 'easeOut' }}
            data-testid="smashup-triggered-fx-destroy-wash"
          />
        </>
      )}

      {actionKind === 'buff' && (
        <motion.div
          className="absolute -right-3 -top-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-emerald-400 text-2xl font-black text-slate-950 shadow-[0_0_28px_rgba(52,211,153,0.72)]"
          initial={{ opacity: 0, scale: 0.3, y: 14 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.28, 1, 1.16], y: [14, -8, -18, -34] }}
          transition={{ duration: 1.4, delay: 0.86, ease: 'easeOut' }}
        >
          +1
        </motion.div>
      )}

      {actionKind === 'score' && (
        <motion.div
          className="absolute -right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-yellow-100 bg-yellow-300 text-base font-black text-slate-950 shadow-[0_0_28px_rgba(250,204,21,0.72)]"
          initial={{ opacity: 0, scale: 0.3, x: -16, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.18, 1, 1], x: [-16, 0, 56, 120], y: [20, -8, -40, -72] }}
          transition={{ duration: 1.5, delay: 0.86, ease: 'easeOut' }}
        >
          VP
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * 大杀四方能力触发动效。
 *
 * 视觉语法：来源卡牌先醒目抬起，能量沿轨迹打到目标，目标对象在冲击帧发生
 * 消灭/增益/得分等可见变化。文字只保留对象名，不承担解释效果的职责。
 */
export const SmashUpAbilityTriggeredEffect: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const sourceDefId = event.params?.sourceDefId as string | undefined;
  const sourcePosition = readScreenPoint(event.params?.sourcePosition);
  const explicitTargetPosition = readScreenPoint(event.params?.targetPosition) ?? readScreenPoint(event.params?.position);
  const targetDefId = event.params?.targetDefId as string | undefined;
  const sourcePreviewRef = event.params?.sourcePreviewRef as CardPreviewRef | undefined;
  const targetPreviewRef = event.params?.targetPreviewRef as CardPreviewRef | undefined;
  const sourceLabel = event.params?.sourceLabel as string | undefined;
  const targetLabel = event.params?.targetLabel as string | undefined;
  const effectLabel = event.params?.effectLabel as string | undefined;
  const highlightTone = event.params?.highlightTone as AbilityHighlightTone | undefined;
  const actionKind = resolveActionKind(event.params?.actionKind, highlightTone, effectLabel);
  const durationMsParam = event.params?.durationMs;
  const totalDurationS = Math.min(
    6,
    Math.max(1.6, typeof durationMsParam === 'number' && Number.isFinite(durationMsParam) ? durationMsParam / 1000 : 2.6),
  );
  const totalDurationMs = totalDurationS * 1000;
  const shouldRender = !!sourceDefId;

  const impactFired = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!impactFired.current) {
        impactFired.current = true;
        onImpact();
      }
    }, Math.min(1350, totalDurationMs * 0.42));
    return () => window.clearTimeout(timer);
  }, [onImpact, totalDurationMs]);

  useEffect(() => {
    if (!shouldRender) return;
    const timer = window.setTimeout(stableComplete, totalDurationMs);
    return () => window.clearTimeout(timer);
  }, [shouldRender, stableComplete, totalDurationMs]);

  useEffect(() => {
    if (!shouldRender) {
      stableComplete();
    }
  }, [shouldRender, stableComplete]);

  if (!shouldRender) return null;

  const t = i18next.getFixedT(null, 'game-smashup');
  const def = getCardDef(sourceDefId);
  const resolvedName = sourceLabel || resolveCardName(def, t) || sourceDefId;
  const targetDef = targetDefId ? getCardDef(targetDefId) : undefined;
  const resolvedTargetName = targetLabel || (targetDefId ? (resolveCardName(targetDef, t) || targetDefId) : undefined);
  const sourceCardPreview = sourcePreviewRef ?? def?.previewRef;
  const targetCardPreview = targetPreviewRef ?? targetDef?.previewRef;
  const targetAtlasPreview = targetCardPreview?.type === 'atlas'
    ? targetCardPreview
    : targetDef?.previewRef?.type === 'atlas'
      ? targetDef.previewRef
      : undefined;
  const targetShatterSource = resolveShatterImageSource(targetAtlasPreview, i18next.language || 'zh-CN');

  const viewport = getViewportSize();
  const targetPos = explicitTargetPosition ?? { left: viewport.width / 2, top: viewport.height * 0.36 };
  const sourcePos = sourcePosition ?? { left: Math.max(120, targetPos.left - 240), top: Math.max(120, targetPos.top + 120) };
  const tone = resolveAbilityTone(highlightTone, actionKind);
  const renderSourceCardBody = !sourcePosition;
  const renderTargetCardBody = !explicitTargetPosition || actionKind === 'destroy';
  const renderTargetLabel = !explicitTargetPosition;
  const compactTargetCardBody = !!explicitTargetPosition;
  const impactDelayS = Math.min(1.35, totalDurationS * 0.42);

  return (
    <>
      <AbilityArcCanvas
        sourcePos={sourcePos}
        targetPos={targetPos}
        tone={tone}
        actionKind={actionKind}
        totalDurationS={totalDurationS}
      />

      <div
        className="fixed pointer-events-none select-none"
        style={{
          left: sourcePos.left,
          top: sourcePos.top,
          transform: 'translate(-50%, -50%)',
          zIndex: UI_Z_INDEX.overlayRaised,
          fontFamily: "'Caveat', 'Comic Sans MS', cursive",
        }}
        data-testid="smashup-triggered-fx-source"
      >
        <motion.div
          className="relative flex flex-col items-center gap-1.5"
          initial={{ opacity: 0, scale: 0.58, rotate: -9, y: 18 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.58, 1.16, 1.04, 0.92], rotate: [-9, 4, 1, -3], y: [18, -8, -8, -34] }}
          transition={{ duration: totalDurationS, times: [0, 0.18, 0.72, 1], ease: 'easeOut' }}
        >
          <motion.div
            className={renderSourceCardBody ? 'absolute inset-[-16px] rounded-2xl' : 'absolute inset-[-42px] rounded-[34px]'}
            style={{ background: `radial-gradient(circle, ${tone.glow} 0%, rgba(0,0,0,0) 70%)` }}
            animate={{ opacity: [0, 0.55, 0.45, 0], scale: [0.7, 1.18, 1.05, 1.42] }}
            transition={{ duration: totalDurationS * 0.76, times: [0, 0.18, 0.66, 1], ease: 'easeOut' }}
          />
          <div className={renderSourceCardBody
            ? 'relative h-[min(17vw,142px)] w-[min(12vw,100px)] overflow-hidden rounded-xl border-[3px] border-amber-200 bg-white shadow-[0_18px_44px_rgba(0,0,0,0.6)]'
            : 'relative h-[218px] w-[158px] rounded-2xl bg-transparent'
          }>
            {renderSourceCardBody && (
              sourceCardPreview ? (
                <CardPreview
                  previewRef={sourceCardPreview}
                  className="h-full w-full object-cover"
                  title={resolvedName}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-amber-100 p-2 text-center text-xs font-black text-slate-900">
                  {resolvedName}
                </div>
              )
            )}
            <motion.div
              className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-slate-950 shadow-[0_0_22px_rgba(251,191,36,0.82)]"
              initial={{ scale: 0, rotate: -24 }}
              animate={{ scale: [0, 1.26, 1], rotate: [-24, 14, 6] }}
              transition={{ delay: 0.08, duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Zap size={18} fill="currentColor" strokeWidth={1.5} />
            </motion.div>
          </div>
          {renderSourceCardBody && (
            <div className="max-w-[150px] truncate rounded-md border border-amber-300/55 bg-slate-950/82 px-2.5 py-1 text-center text-[15px] font-black leading-none text-amber-100 shadow-xl">
              {resolvedName}
            </div>
          )}
        </motion.div>
      </div>

      <div
        className="fixed pointer-events-none select-none"
        style={{
          left: targetPos.left,
          top: targetPos.top,
          transform: 'translate(-50%, -50%)',
          zIndex: UI_Z_INDEX.overlayRaised,
          fontFamily: "'Caveat', 'Comic Sans MS', cursive",
        }}
        data-testid="smashup-triggered-fx-target"
      >
        <TargetImpact
          actionKind={actionKind}
          tone={tone}
          targetCardPreview={targetCardPreview}
          resolvedTargetName={resolvedTargetName}
          renderCardBody={renderTargetCardBody}
          compactCardBody={compactTargetCardBody}
          shatterImageSource={targetShatterSource}
        />
        {actionKind !== 'destroy' && (
          <ActionGlyph actionKind={actionKind} accent={tone.accent} delayS={impactDelayS} />
        )}
        {resolvedTargetName && renderTargetLabel && (
          <motion.div
            className="mx-auto mt-2 max-w-[150px] truncate rounded-md border border-white/18 bg-slate-950/70 px-2 py-0.5 text-center text-[13px] font-black leading-none text-white/90 shadow-lg"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -10] }}
            transition={{ duration: totalDurationS * 0.62, delay: 0.62, times: [0, 0.2, 0.74, 1], ease: 'easeOut' }}
          >
            {resolvedTargetName}
          </motion.div>
        )}
      </div>

    </>
  );
};
