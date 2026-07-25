import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Flame, Plus, Skull, Sparkles, Trophy, Zap } from 'lucide-react';
import i18next from 'i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { UI_Z_INDEX, type CardPreviewRef } from '../../../core';
import type { FxRendererProps } from '../../../engine/fx';
import { getCardDef, resolveCardName } from '../data/cards';

type ScreenPoint = { left: number; top: number };
export type AbilityHighlightTone = 'info' | 'danger' | 'buff' | 'score';
type AbilityActionKind = 'destroy' | 'buff' | 'score' | 'info';

const PROJECTILE_COUNT = 6;
const SHARD_COUNT = 9;

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
      cardRing: 'border-red-300/95 shadow-[0_0_44px_rgba(248,113,113,0.58)]',
      orb: 'from-red-100 via-rose-300 to-orange-400',
      targetTint: 'rgba(127,29,29,0.42)',
    };
  }
  if (actionKind === 'buff' || tone === 'buff') {
    return {
      accent: '#34d399',
      accentSoft: 'rgba(52,211,153,0.22)',
      glow: 'rgba(52,211,153,0.44)',
      cardRing: 'border-emerald-200/95 shadow-[0_0_46px_rgba(52,211,153,0.56)]',
      orb: 'from-emerald-100 via-emerald-300 to-lime-300',
      targetTint: 'rgba(6,95,70,0.38)',
    };
  }
  if (actionKind === 'score' || tone === 'score') {
    return {
      accent: '#facc15',
      accentSoft: 'rgba(250,204,21,0.24)',
      glow: 'rgba(250,204,21,0.46)',
      cardRing: 'border-yellow-200/95 shadow-[0_0_46px_rgba(250,204,21,0.6)]',
      orb: 'from-yellow-100 via-amber-300 to-orange-300',
      targetTint: 'rgba(113,63,18,0.38)',
    };
  }
  return {
    accent: '#38bdf8',
    accentSoft: 'rgba(56,189,248,0.20)',
    glow: 'rgba(56,189,248,0.4)',
    cardRing: 'border-sky-200/95 shadow-[0_0_42px_rgba(56,189,248,0.54)]',
    orb: 'from-sky-100 via-cyan-300 to-amber-200',
    targetTint: 'rgba(12,74,110,0.36)',
  };
}

function ActionGlyph({ actionKind, accent }: { actionKind: AbilityActionKind; accent: string }) {
  const common = { size: 42, strokeWidth: 2.6 };
  const icon = actionKind === 'destroy'
    ? <Skull {...common} />
    : actionKind === 'buff'
      ? <Plus {...common} />
      : actionKind === 'score'
        ? <Trophy {...common} />
        : <Sparkles {...common} />;

  return (
    <motion.div
      className="absolute flex h-24 w-24 items-center justify-center rounded-full border-[3px] bg-slate-950/90 text-white shadow-2xl"
      style={{ left: '50%', top: '50%', marginLeft: -48, marginTop: -48, borderColor: accent, boxShadow: `0 0 52px ${accent}` }}
      initial={{ opacity: 0, scale: 0.35, rotate: -18 }}
      animate={{ opacity: [0, 1, 1, 0.88, 0], scale: [0.35, 1.22, 1, 1.08, 1.34], rotate: [-18, 7, 0, 0, 18] }}
      transition={{ duration: 2.7, times: [0, 0.14, 0.42, 0.78, 1], delay: 0.62, ease: 'easeOut' }}
      data-testid="smashup-triggered-fx-action-glyph"
    >
      {icon}
    </motion.div>
  );
}

function AttackBeam({
  eventId,
  sourcePos,
  targetPos,
  tone,
  actionKind,
  totalDurationS,
}: {
  eventId: string;
  sourcePos: ScreenPoint;
  targetPos: ScreenPoint;
  tone: ReturnType<typeof resolveAbilityTone>;
  actionKind: AbilityActionKind;
  totalDurationS: number;
}) {
  const dx = targetPos.left - sourcePos.left;
  const dy = targetPos.top - sourcePos.top;
  const distance = Math.max(48, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const beamHeight = actionKind === 'destroy' ? 112 : 86;

  return (
    <motion.div
      className="fixed pointer-events-none select-none"
      style={{
        left: sourcePos.left,
        top: sourcePos.top - beamHeight / 2,
        width: distance,
        height: beamHeight,
        transformOrigin: '0 50%',
        zIndex: UI_Z_INDEX.overlayRaised + 2,
        mixBlendMode: 'screen',
      }}
      initial={{ opacity: 0, scaleX: 0.04, rotate: angle }}
      animate={{ opacity: [0, 1, 1, 0], scaleX: [0.04, 0.72, 1, 1.02], rotate: angle }}
      transition={{ duration: Math.min(1.25, totalDurationS * 0.36), delay: 0.24, times: [0, 0.18, 0.72, 1], ease: 'easeOut' }}
      data-testid="smashup-triggered-fx-beam"
    >
      <div
        className="absolute left-0 top-1/2 h-7 w-full -translate-y-1/2 rounded-full blur-md"
        style={{
          background: `linear-gradient(90deg, rgba(255,255,255,0), ${tone.accent}, #fff 64%, ${tone.accent})`,
          boxShadow: `0 0 38px ${tone.accent}`,
        }}
      />
      <div
        className="absolute left-[10%] top-1/2 h-2.5 w-[86%] -translate-y-1/2 rounded-full"
        style={{
          background: `linear-gradient(90deg, rgba(255,255,255,0), #fff 52%, ${tone.accent})`,
          boxShadow: `0 0 28px ${tone.accent}`,
        }}
      />
      {actionKind === 'destroy' && (
        <>
          <motion.div
            className="absolute right-2 top-1/2 h-[108px] w-4 origin-center -translate-y-1/2 rounded-full bg-white shadow-[0_0_34px_rgba(255,255,255,0.95)]"
            initial={{ opacity: 0, scaleY: 0.15, rotate: -46 }}
            animate={{ opacity: [0, 1, 1, 0], scaleY: [0.15, 1.12, 1, 0.72], rotate: [-46, -46, -40, -36] }}
            transition={{ duration: 0.95, delay: 0.52, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute right-8 top-1/2 h-[96px] w-3 origin-center -translate-y-1/2 rounded-full bg-red-200 shadow-[0_0_28px_rgba(248,113,113,0.95)]"
            initial={{ opacity: 0, scaleY: 0.15, rotate: 46 }}
            animate={{ opacity: [0, 1, 0.82, 0], scaleY: [0.15, 1.08, 1, 0.7], rotate: [46, 46, 40, 36] }}
            transition={{ duration: 0.95, delay: 0.6, ease: 'easeOut' }}
          />
        </>
      )}
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${distance} ${beamHeight}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`su-ability-beam-sparks-${eventId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="55%" stopColor="#fff" />
            <stop offset="100%" stopColor={tone.accent} />
          </linearGradient>
        </defs>
        <path
          d={`M ${distance * 0.12} ${beamHeight * 0.28} L ${distance * 0.94} ${beamHeight * 0.50} L ${distance * 0.12} ${beamHeight * 0.72}`}
          fill="none"
          stroke={`url(#su-ability-beam-sparks-${eventId})`}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.82"
        />
      </svg>
    </motion.div>
  );
}

function TargetImpact({
  actionKind,
  tone,
  targetCardPreview,
  resolvedTargetName,
  renderCardBody,
}: {
  actionKind: AbilityActionKind;
  tone: ReturnType<typeof resolveAbilityTone>;
  targetCardPreview: CardPreviewRef | undefined;
  resolvedTargetName: string | undefined;
  renderCardBody: boolean;
}) {
  const shards = useMemo(() => Array.from({ length: SHARD_COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / SHARD_COUNT - Math.PI / 2;
    const distance = 42 + (i % 3) * 18;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      rotate: angle * 58,
      size: 6 + (i % 3) * 3,
    };
  }), []);

  const targetMotion = actionKind === 'destroy'
    ? {
      opacity: renderCardBody ? [0, 1, 1, 0.82, 0] : [0, 1, 1, 0.92, 0.82],
      scale: [0.82, 1.08, 1, 1.12, 1.05],
      rotate: [0, 0, -6, 8, 10],
      y: [12, 0, 0, 10, 14],
      filter: ['grayscale(0) brightness(1)', 'grayscale(0) brightness(1.1)', 'grayscale(0) brightness(1.1)', 'grayscale(0.75) brightness(0.72)', 'grayscale(1) brightness(0.48)'],
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
        ? `relative h-[168px] w-[118px] rounded-2xl border-[4px] bg-slate-900 ${tone.cardRing}`
        : 'relative h-[148px] w-[148px] rounded-full'}
      initial={{ opacity: 0, scale: 0.82, rotate: 0, y: 12 }}
      animate={targetMotion}
      transition={{ duration: 2.1, times: [0, 0.14, 0.46, 0.74, 1], delay: 0.58, ease: 'easeOut' }}
      data-testid="smashup-triggered-fx-target-card"
    >
      {renderCardBody && (
        targetCardPreview ? (
          <CardPreview
            previewRef={targetCardPreview}
            className="h-full w-full rounded-lg object-cover"
            title={resolvedTargetName}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-slate-800">
            <Sparkles size={34} />
          </div>
        )
      )}
      <div
        className={`absolute inset-0 ${renderCardBody ? 'rounded-lg' : 'rounded-full'}`}
        style={{ background: `radial-gradient(circle, transparent 18%, ${tone.targetTint} 100%)` }}
      />

      {actionKind === 'destroy' && (
        <>
          <motion.div
            className="absolute inset-[-14px] rounded-2xl bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,rgba(248,113,113,0.34)_34%,rgba(15,23,42,0.82)_72%)]"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: [0, 0.18, 0.72, 0.86, 0.52], scale: [0.72, 1.04, 1.14, 1.02, 0.98] }}
            transition={{ duration: 2.85, delay: 0.56, times: [0, 0.16, 0.36, 0.76, 1], ease: 'easeOut' }}
            data-testid="smashup-triggered-fx-destroy-wash"
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-[188px] w-4 origin-center rounded-full bg-gradient-to-b from-white via-red-200 to-red-500 shadow-[0_0_36px_rgba(248,113,113,0.95)]"
            initial={{ opacity: 0, scaleY: 0, rotate: -48, x: '-50%', y: '-50%' }}
            animate={{ opacity: [0, 1, 1, 0.72], scaleY: [0, 1, 1.08, 0.9], rotate: -48, x: '-50%', y: '-50%' }}
            transition={{ duration: 2.15, delay: 0.72, times: [0, 0.2, 0.68, 1], ease: 'easeOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-[188px] w-3 origin-center rounded-full bg-gradient-to-b from-white via-orange-200 to-red-500 shadow-[0_0_32px_rgba(251,146,60,0.95)]"
            initial={{ opacity: 0, scaleY: 0, rotate: 48, x: '-50%', y: '-50%' }}
            animate={{ opacity: [0, 1, 0.95, 0.68], scaleY: [0, 1, 1.06, 0.88], rotate: 48, x: '-50%', y: '-50%' }}
            transition={{ duration: 2.05, delay: 0.84, times: [0, 0.22, 0.66, 1], ease: 'easeOut' }}
          />
          {shards.map((shard, i) => (
            <motion.span
              key={`shard-${i}`}
              className="absolute left-1/2 top-1/2 rounded-sm bg-red-200 shadow-[0_0_12px_rgba(254,202,202,0.9)]"
              style={{ width: shard.size, height: shard.size * 1.7 }}
              initial={{ opacity: 0, x: '-50%', y: '-50%', rotate: 0, scale: 0.2 }}
              animate={{
                opacity: [0, 1, 0],
                x: `calc(-50% + ${shard.x}px)`,
                y: `calc(-50% + ${shard.y}px)`,
                rotate: shard.rotate,
                scale: [0.2, 1, 0.4],
              }}
              transition={{ duration: 0.82, delay: 0.92 + i * 0.015, ease: 'easeOut' }}
            />
          ))}
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

  const viewport = getViewportSize();
  const targetPos = explicitTargetPosition ?? { left: viewport.width / 2, top: viewport.height * 0.36 };
  const sourcePos = sourcePosition ?? { left: Math.max(120, targetPos.left - 240), top: Math.max(120, targetPos.top + 120) };
  const midPos = {
    left: (sourcePos.left + targetPos.left) / 2,
    top: (sourcePos.top + targetPos.top) / 2 - 44,
  };
  const tone = resolveAbilityTone(highlightTone, actionKind);
  const renderSourceCardBody = !sourcePosition;
  const renderTargetCardBody = !explicitTargetPosition;
  const pathD = `M ${sourcePos.left} ${sourcePos.top} C ${sourcePos.left + 104} ${sourcePos.top - 142}, ${targetPos.left - 132} ${targetPos.top - 132}, ${targetPos.left} ${targetPos.top}`;

  return (
    <>
      <motion.svg
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: UI_Z_INDEX.overlayRaised + 1, mixBlendMode: 'screen' }}
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        data-testid="smashup-triggered-fx-path"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: totalDurationS, times: [0, 0.12, 0.82, 1], ease: 'easeOut' }}
      >
        <defs>
          <filter id={`su-ability-glow-${event.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`su-ability-gradient-${event.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="36%" stopColor={tone.accent} />
            <stop offset="68%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={tone.accent} />
          </linearGradient>
        </defs>
        <motion.path
          d={pathD}
          fill="none"
          stroke={tone.accent}
          strokeWidth="30"
          strokeLinecap="round"
          opacity="0.36"
          filter={`url(#su-ability-glow-${event.id})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1] }}
          transition={{ duration: totalDurationS * 0.46, times: [0, 0.72, 1], ease: 'easeOut' }}
        />
        <motion.path
          d={pathD}
          fill="none"
          stroke={`url(#su-ability-gradient-${event.id})`}
          strokeWidth="7"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
          transition={{ duration: totalDurationS * 0.52, times: [0, 0.6, 1], ease: 'easeOut' }}
        />
      </motion.svg>

      <AttackBeam
        eventId={event.id}
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
          {renderSourceCardBody && (
            <motion.div
              className="absolute inset-[-16px] rounded-2xl"
              style={{ background: `radial-gradient(circle, ${tone.glow} 0%, rgba(0,0,0,0) 70%)` }}
              animate={{ opacity: [0, 0.55, 0.45, 0], scale: [0.7, 1.18, 1.05, 1.42] }}
              transition={{ duration: totalDurationS * 0.76, times: [0, 0.18, 0.66, 1], ease: 'easeOut' }}
            />
          )}
          <div className={renderSourceCardBody
            ? 'relative h-[min(17vw,142px)] w-[min(12vw,100px)] overflow-hidden rounded-xl border-[3px] border-amber-200 bg-white shadow-[0_18px_44px_rgba(0,0,0,0.6)]'
            : 'relative h-[218px] w-[158px] rounded-2xl border-[4px] border-amber-200/90 bg-transparent shadow-[0_0_46px_rgba(251,191,36,0.72),inset_0_0_20px_rgba(251,191,36,0.18)]'
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

      {Array.from({ length: PROJECTILE_COUNT }, (_, i) => (
        <motion.div
          key={`projectile-${i}`}
          className="fixed pointer-events-none select-none"
          style={{
            left: sourcePos.left - 14,
            top: sourcePos.top - 14,
            zIndex: UI_Z_INDEX.overlayRaised + 1,
          }}
          initial={{ opacity: 0, scale: 0.28, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 1, 0.7, 0],
            scale: [0.28, 1.1, 0.88, 1.22, 0.92],
            x: [0, (midPos.left - sourcePos.left) * (0.72 + i * 0.045), targetPos.left - sourcePos.left],
            y: [0, (midPos.top - sourcePos.top) * (0.72 + i * 0.035), targetPos.top - sourcePos.top],
          }}
          transition={{ duration: 1.32 + i * 0.06, delay: 0.18 + i * 0.06, times: [0, 0.18, 0.64, 0.82, 1], ease: 'easeOut' }}
          data-testid={i === 0 ? 'smashup-triggered-fx-orb' : undefined}
        >
          <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${tone.orb} shadow-[0_0_34px_rgba(255,255,255,0.82)]`} />
        </motion.div>
      ))}

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
        <motion.div
          className="absolute left-1/2 top-1/2 rounded-full border-2"
          style={{
            width: 224,
            height: 224,
            marginLeft: -112,
            marginTop: -112,
            borderColor: tone.accent,
            background: `radial-gradient(circle, ${tone.accentSoft} 0%, rgba(0,0,0,0) 68%)`,
          }}
          initial={{ opacity: 0, scale: 0.28 }}
          animate={{ opacity: [0, 1, 0.9, 0], scale: [0.24, 1.02, 1.42, 1.88] }}
          transition={{ duration: 2, delay: 0.5, times: [0, 0.24, 0.68, 1], ease: 'easeOut' }}
          data-testid="smashup-triggered-fx-target-ring"
        />
        <TargetImpact
          actionKind={actionKind}
          tone={tone}
          targetCardPreview={targetCardPreview}
          resolvedTargetName={resolvedTargetName}
          renderCardBody={renderTargetCardBody}
        />
        <ActionGlyph actionKind={actionKind} accent={tone.accent} />
        {resolvedTargetName && renderTargetCardBody && (
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

      {actionKind === 'destroy' && (
        <motion.div
          className="fixed pointer-events-none select-none"
          style={{
            left: targetPos.left + 70,
            top: targetPos.top + 62,
            zIndex: UI_Z_INDEX.overlayRaised - 1,
          }}
          initial={{ opacity: 0, scale: 0.35, rotate: -12 }}
          animate={{ opacity: [0, 0, 1, 0.95, 0], scale: [0.35, 0.35, 1.08, 1, 0.8], rotate: [-12, -12, 7, 12, 18] }}
          transition={{ duration: 2, delay: 0.95, times: [0, 0.16, 0.36, 0.72, 1], ease: 'easeOut' }}
        >
          <div className="flex h-12 w-10 items-center justify-center rounded-md border border-red-200/60 bg-red-950/82 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.56)]">
            <Flame size={22} />
          </div>
        </motion.div>
      )}
    </>
  );
};
