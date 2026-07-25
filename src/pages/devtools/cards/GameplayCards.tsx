/**
 * 游戏玩法类特效预览卡片
 *
 * 包含与游戏机制相关的特效（基地占领、得分等）。
 */
/* eslint-disable react-refresh/only-export-components -- devtools preview cards */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Castle, Plus, Skull, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BaseCaptureEffect } from '../../../components/common/animations/BaseCaptureEffect';
import { BurstParticles } from '../../../components/common/animations/BurstParticles';
import { initSmashUpCardAtlases } from '../../../games/smashup/ui/cardAtlas';
import { getLocalizedAssetPath, getOptimizedImageUrls } from '../../../core/AssetLoader';
import { UI_Z_INDEX } from '../../../core';
import {
  type PreviewCardProps, type EffectEntryMeta,
  EffectCard, TriggerButton, ToggleChip,
  useEffectTrigger,
} from './shared';

const BREAKPOINT_LABEL_KEY = 'devtools.effectPreview.gameplay.shared.breakpoint';
const ABILITY_TRIGGERED_PREVIEW_DURATION_MS = 4200;

// ============================================================================
// 基地占领特效
// ============================================================================

/** 模拟基地卡牌 */
const FakeBaseCard: React.FC<{
  label: string;
  breakpointLabel: string;
  color: string;
  visible: boolean;
}> = ({ label, breakpointLabel, color, visible }) => (
  <motion.div
    className={`absolute inset-0 rounded-lg border-2 flex flex-col items-center justify-center ${color}`}
    initial={false}
    animate={{
      opacity: visible ? 1 : 0,
      scale: visible ? 1 : 0.3,
    }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
  >
    <span className="text-xs font-bold text-white drop-shadow">{label}</span>
    <span className="text-[9px] text-white/60 mt-0.5">{breakpointLabel}</span>
  </motion.div>
);

export const BaseCaptureCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const [phase, setPhase] = useState<'idle' | 'capturing' | 'done'>('idle');
  const [showOld, setShowOld] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showParticles, setShowParticles] = useState(true);
  const [showGlow, setShowGlow] = useState(true);
  const { stats, startMeasure } = useEffectTrigger(2000);

  const trigger = useCallback(() => {
    // 重置状态
    setPhase('idle');
    setShowOld(true);
    setShowNew(false);
    requestAnimationFrame(() => {
      setPhase('capturing');
      startMeasure();
    });
  }, [startMeasure]);

  const handleTransition = useCallback(() => {
    // 碎裂完成，切换到新基地
    setShowOld(false);
    setShowNew(true);
  }, []);

  const handleComplete = useCallback(() => {
    setPhase('done');
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setShowOld(true);
    setShowNew(false);
  }, []);

  return (
    <EffectCard
      title={t('devtools.effectPreview.gameplay.base_capture.title')}
      icon={Castle}
      iconColor={iconColor}
      desc={t('devtools.effectPreview.gameplay.base_capture.description')}
      stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.gameplay.base_capture.buttons.trigger')} onClick={trigger} color="bg-amber-700 hover:bg-amber-600" />
        <TriggerButton label={t('devtools.effectPreview.gameplay.base_capture.buttons.reset')} onClick={reset} color="bg-slate-600 hover:bg-slate-500" />
        <div className="flex flex-wrap gap-1">
          <ToggleChip label={t('devtools.effectPreview.gameplay.base_capture.toggles.particles')} active={showParticles} onClick={() => setShowParticles(v => !v)} />
          <ToggleChip label={t('devtools.effectPreview.gameplay.base_capture.toggles.glow')} active={showGlow} onClick={() => setShowGlow(v => !v)} />
        </div>
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* 基地容器 */}
        <div className="relative w-40 h-28 rounded-lg">
          {/* 旧基地 */}
          <FakeBaseCard
            label={t('devtools.effectPreview.gameplay.base_capture.preview.old_base')}
            breakpointLabel={t(BREAKPOINT_LABEL_KEY, { value: 20 })}
            color="bg-gradient-to-br from-slate-700 to-slate-800 border-slate-500/50"
            visible={showOld}
          />

          {/* 新基地 */}
          <FakeBaseCard
            label={t('devtools.effectPreview.gameplay.base_capture.preview.new_base')}
            breakpointLabel={t(BREAKPOINT_LABEL_KEY, { value: 20 })}
            color="bg-gradient-to-br from-amber-700 to-orange-800 border-amber-400/50"
            visible={showNew}
          />

          {/* 占领特效 */}
          {phase === 'capturing' && (
            <>
              <BaseCaptureEffect
                active
                showParticles={showParticles}
                showGlow={showGlow}
                onTransition={handleTransition}
                onComplete={handleComplete}
              />
              {/* 额外爆发粒子（可选） */}
              {showParticles && (
                <BurstParticles
                  active
                  preset="explosion"
                  color={['#94a3b8', '#64748b', '#475569']}
                  onComplete={() => {}}
                />
              )}
            </>
          )}

          {/* 新基地出现时的庆祝粒子 */}
          <AnimatePresence>
            {showNew && phase === 'capturing' && showParticles && (
              <BurstParticles
                active
                preset="summonGlow"
                color={['#fbbf24', '#f59e0b', '#fcd34d', '#fff']}
                onComplete={() => {}}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 触发器激活特效
// ============================================================================

/** 预设的触发器场景（含卡图引用和中文名，不依赖 i18n） */
const TRIGGER_SCENES = [
  {
    defId: 'trickster_leprechaun',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.trickster_leprechaun.label',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards4', index: 24 },
    previewImage: 'smashup/cards/effect-preview/leprechaun',
    targetSlot: 1,
    actionKind: 'destroy' as const,
  },
  {
    defId: 'trickster_flame_trap',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.trickster_flame_trap.label',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards4', index: 31 },
    previewImage: 'smashup/cards/effect-preview/flame-trap',
    targetSlot: 2,
    actionKind: 'destroy' as const,
  },
  {
    defId: 'ninja_assassination',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.ninja_assassination.label',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards1', index: 18 },
    previewImage: 'smashup/cards/effect-preview/assassination',
    targetSlot: 2,
    actionKind: 'destroy' as const,
  },
  {
    defId: 'bear_cavalry_high_ground',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.bear_cavalry_high_ground.label',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards3', index: 22 },
    previewImage: 'smashup/cards/effect-preview/high-ground',
    targetSlot: 0,
    actionKind: 'buff' as const,
  },
] as const;

const MINION_SLOTS = [
  {
    key: 'brownie',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.preview.minions.brownie',
    power: 4,
    color: 'border-emerald-600/50 bg-emerald-900/30',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards4', index: 23 },
    previewImage: 'smashup/cards/effect-preview/brownie',
  },
  {
    key: 'gnome',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.preview.minions.gnome',
    power: 3,
    color: 'border-blue-600/50 bg-blue-900/30',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards4', index: 25 },
    previewImage: 'smashup/cards/effect-preview/gnome',
  },
  {
    key: 'imp',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.preview.minions.imp',
    power: 2,
    color: 'border-purple-600/50 bg-purple-900/30',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards4', index: 26 },
    previewImage: 'smashup/cards/effect-preview/imp',
  },
] as const;

type PreviewPoint = { left: number; top: number };
type TriggerActionKind = (typeof TRIGGER_SCENES)[number]['actionKind'];

const PREVIEW_SPARK_COUNT = 7;
const PREVIEW_SHARD_COUNT = 10;
const previewImageLoadCache = new Map<string, Promise<void>>();

function getSmashUpPreviewImageUrl(src: string): string {
  return getOptimizedImageUrls(getLocalizedAssetPath(src, 'zh-CN')).webp;
}

function ensureSmashUpPreviewImageLoaded(src: string): Promise<void> {
  const url = getSmashUpPreviewImageUrl(src);
  const cached = previewImageLoadCache.get(url);
  if (cached) return cached;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'sync';
    img.loading = 'eager';
    img.onload = () => {
      void img.decode?.().catch(() => undefined).finally(resolve);
    };
    img.onerror = () => resolve();
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      resolve();
    }
  });

  previewImageLoadCache.set(url, promise);
  return promise;
}

function SmashUpPreviewImageCard({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const webp = getSmashUpPreviewImageUrl(src);

  return (
    <div
      data-testid="smashup-triggered-preview-image-card"
      className={className}
      title={title}
      role="img"
      aria-label={title}
      style={{
        backgroundImage: `url("${webp}")`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }}
    />
  );
}

const ABILITY_TRIGGERED_PRELOAD_IMAGES = Array.from(new Set([
  ...TRIGGER_SCENES.map(scene => scene.previewImage),
  ...MINION_SLOTS.map(slot => slot.previewImage),
]));

/** 模拟基地场景中的随从卡槽 */
const FakeMinionSlot = React.forwardRef<HTMLDivElement, {
  slotKey: string;
  label: string;
  power: number;
  color: string;
  previewImage: string;
  active: boolean;
  reacting: boolean;
  actionKind: 'destroy' | 'buff';
}>(({ slotKey, label, power, color, previewImage, active, reacting, actionKind }, ref) => (
  <motion.div
    ref={ref}
    data-testid={`smashup-triggered-preview-minion-${slotKey}`}
    className={`relative isolate h-[118px] w-[84px] shrink-0 rounded-lg border-2 ${color} flex flex-col items-center justify-center overflow-hidden text-[8px] shadow-lg transition-[border-color,box-shadow,transform] ${
      reacting && actionKind === 'destroy'
        ? 'border-red-200 shadow-[0_0_48px_rgba(248,113,113,0.82)] ring-4 ring-red-400/60'
        : active
          ? 'border-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.42)] ring-2 ring-amber-300/35'
          : ''
    }`}
    animate={reacting && actionKind === 'destroy'
      ? {
        opacity: [1, 1, 1, 0.9],
        scale: [1, 1.18, 1.06, 0.94],
        rotate: [0, -6, 9, 12],
        y: [0, -10, 5, 11],
        filter: ['grayscale(0) brightness(1)', 'grayscale(0) brightness(1.3)', 'grayscale(0.9) brightness(0.62)', 'grayscale(1) brightness(0.36)'],
      }
      : reacting && actionKind === 'buff'
        ? {
          scale: [1, 1.12, 1.02, 1],
          y: [0, -8, -4, 0],
          filter: ['brightness(1)', 'brightness(1.25)', 'brightness(1.12)', 'brightness(1)'],
        }
        : { opacity: 1, scale: 1, rotate: 0, y: 0, filter: 'grayscale(0) brightness(1)' }}
    transition={reacting
      ? { duration: actionKind === 'destroy' ? 3.15 : 0.9, delay: 0.48, ease: 'easeOut' }
      : { duration: 0.22, ease: 'easeOut' }}
  >
    <SmashUpPreviewImageCard
      src={previewImage}
      className="absolute inset-0 h-full w-full object-cover opacity-[0.92]"
      title={label}
    />
    <div className="absolute inset-x-0 bottom-0 bg-slate-950/82 px-1.5 py-1 text-center">
      <span className="block truncate font-bold text-white/90">{label}</span>
    </div>
    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-amber-100 bg-amber-400 text-[11px] font-black text-slate-950 shadow">
      {power}
    </span>
    {reacting && actionKind === 'destroy' && (
      <>
        <motion.div
          className="absolute inset-[-10px] z-10 bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,rgba(248,113,113,0.42)_34%,rgba(15,23,42,0.92)_76%)]"
          initial={{ opacity: 0, scale: 0.72 }}
          animate={{ opacity: [0, 0.15, 0.82, 0.94], scale: [0.72, 1.1, 1.02, 1] }}
          transition={{ duration: 2.65, delay: 0.68, times: [0, 0.18, 0.48, 1], ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-red-950/45 to-slate-950/96"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.35, 0.98] }}
          transition={{ duration: 1.5, delay: 0.78, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 z-20 h-[154px] w-3 origin-center rounded-full bg-red-100 shadow-[0_0_30px_rgba(248,113,113,0.95)]"
          initial={{ opacity: 0, scaleY: 0, rotate: -48, x: '-50%', y: '-50%' }}
          animate={{ opacity: [0, 1, 1, 0.82], scaleY: [0, 1, 1, 0.92], rotate: -48, x: '-50%', y: '-50%' }}
          transition={{ duration: 2.45, delay: 0.68, times: [0, 0.18, 0.7, 1], ease: 'easeOut' }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 z-20 h-[154px] w-3 origin-center rounded-full bg-orange-100 shadow-[0_0_26px_rgba(251,146,60,0.9)]"
          initial={{ opacity: 0, scaleY: 0, rotate: 48, x: '-50%', y: '-50%' }}
          animate={{ opacity: [0, 1, 0.96, 0.78], scaleY: [0, 1, 1, 0.9], rotate: 48, x: '-50%', y: '-50%' }}
          transition={{ duration: 2.35, delay: 0.78, times: [0, 0.2, 0.7, 1], ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-0 z-30 flex items-center justify-center text-red-50 drop-shadow-[0_0_18px_rgba(248,113,113,0.95)]"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0.96], scale: [0.4, 1.24, 1.02, 1] }}
          transition={{ duration: 2.55, delay: 0.72, times: [0, 0.18, 0.68, 1], ease: 'easeOut' }}
        >
          <Skull size={34} strokeWidth={2.5} />
        </motion.div>
      </>
    )}
  </motion.div>
));
FakeMinionSlot.displayName = 'FakeMinionSlot';

function getElementCenter(element: HTMLElement | null) {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  return { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 };
}

function AbilityTriggeredPreviewOverlay({
  runKey,
  sourcePosition,
  targetPosition,
  actionKind,
}: {
  runKey: number;
  sourcePosition?: PreviewPoint;
  targetPosition?: PreviewPoint;
  actionKind: TriggerActionKind;
}) {
  if (!sourcePosition || !targetPosition) return null;

  const isDestroy = actionKind === 'destroy';
  const accent = isDestroy ? '#fb7185' : '#34d399';
  const accentSoft = isDestroy ? 'rgba(248,113,113,0.22)' : 'rgba(52,211,153,0.22)';
  const beamStart = {
    left: sourcePosition.left + 72,
    top: sourcePosition.top - 4,
  };
  const dx = targetPosition.left - beamStart.left;
  const dy = targetPosition.top - beamStart.top;
  const distance = Math.max(72, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const beamHeight = isDestroy ? 86 : 72;

  return (
    <div
      key={runKey}
      className="fixed inset-0 pointer-events-none select-none"
      style={{ zIndex: UI_Z_INDEX.overlayRaised + 6, mixBlendMode: 'screen' }}
      aria-hidden="true"
      data-testid="smashup-triggered-preview-overlay"
    >
      <motion.div
        className="absolute rounded-3xl border-[3px] border-amber-100/95 shadow-[0_0_42px_rgba(251,191,36,0.9)]"
        style={{
          left: sourcePosition.left - 76,
          top: sourcePosition.top - 104,
          width: 152,
          height: 210,
          zIndex: 5,
        }}
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: [0, 1, 0.72, 0], scale: [0.86, 1.08, 1.02, 1.18] }}
        transition={{ duration: 1.45, times: [0, 0.16, 0.62, 1], ease: 'easeOut' }}
        data-testid="smashup-triggered-preview-source-pulse"
      />
      {Array.from({ length: PREVIEW_SPARK_COUNT }, (_, i) => {
        const offset = i - (PREVIEW_SPARK_COUNT - 1) / 2;
        return (
          <motion.span
            key={`source-spark-${i}`}
            className="absolute h-2.5 w-2.5 rounded-full bg-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.95)]"
            style={{
              left: sourcePosition.left - 5,
              top: sourcePosition.top - 5,
            }}
            initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.2, 1, 0.45],
              x: offset * 17,
              y: -86 - Math.abs(offset) * 6,
            }}
            transition={{ duration: 0.82, delay: 0.08 + i * 0.025, ease: 'easeOut' }}
          />
        );
      })}

      <motion.div
        className="absolute"
        style={{
          left: beamStart.left,
          top: beamStart.top - beamHeight / 2,
          width: distance,
          height: beamHeight,
          transformOrigin: '0 50%',
          zIndex: 3,
        }}
        initial={{ opacity: 0, scaleX: 0.04, rotate: angle }}
        animate={{ opacity: [0, 1, 1, 0], scaleX: [0.04, 0.8, 1, 1.02], rotate: angle }}
        transition={{ duration: 1.28, delay: 0.22, times: [0, 0.2, 0.72, 1], ease: 'easeOut' }}
        data-testid="smashup-triggered-preview-beam"
      >
        <div
          className="absolute left-0 top-1/2 h-5 w-full -translate-y-1/2 rounded-full blur-md"
          style={{
            background: `linear-gradient(90deg, rgba(255,255,255,0), ${accent} 22%, #fff 72%, ${accent})`,
            boxShadow: `0 0 30px ${accent}`,
          }}
        />
        <div
          className="absolute left-[3%] top-1/2 h-1.5 w-[96%] -translate-y-1/2 rounded-full bg-white"
          style={{ boxShadow: `0 0 20px ${accent}` }}
        />
        {isDestroy && (
          <>
            <motion.div
              className="absolute right-3 top-1/2 h-[122px] w-4 origin-center -translate-y-1/2 rounded-full bg-white shadow-[0_0_36px_rgba(255,255,255,0.95)]"
              initial={{ opacity: 0, scaleY: 0.1, rotate: -48 }}
              animate={{ opacity: [0, 1, 1, 0.72], scaleY: [0.1, 1.12, 1, 0.82], rotate: [-48, -48, -42, -36] }}
              transition={{ duration: 1.12, delay: 0.46, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute right-9 top-1/2 h-[108px] w-3 origin-center -translate-y-1/2 rounded-full bg-red-200 shadow-[0_0_32px_rgba(248,113,113,0.98)]"
              initial={{ opacity: 0, scaleY: 0.1, rotate: 48 }}
              animate={{ opacity: [0, 1, 0.92, 0.68], scaleY: [0.1, 1.1, 1, 0.78], rotate: [48, 48, 42, 36] }}
              transition={{ duration: 1.06, delay: 0.56, ease: 'easeOut' }}
            />
          </>
        )}
      </motion.div>

      <motion.div
        className="absolute rounded-full border-[3px]"
        style={{
          left: targetPosition.left - 76,
          top: targetPosition.top - 76,
          width: 152,
          height: 152,
          borderColor: accent,
          background: `radial-gradient(circle, rgba(255,255,255,0.1) 0%, ${accentSoft} 36%, rgba(0,0,0,0) 72%)`,
          boxShadow: `0 0 30px ${accent}`,
          zIndex: 2,
        }}
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0.9, 0], scale: [0.2, 1, 1.42, 1.74] }}
        transition={{ duration: 2.05, delay: 0.55, times: [0, 0.24, 0.66, 1], ease: 'easeOut' }}
        data-testid="smashup-triggered-preview-impact-ring"
      />

      {isDestroy ? (
        <>
          <motion.div
            className="absolute h-[132px] w-3 origin-center rounded-full bg-gradient-to-b from-white via-red-200 to-red-500 shadow-[0_0_28px_rgba(248,113,113,0.9)]"
            style={{ left: targetPosition.left - 2, top: targetPosition.top - 66 }}
            initial={{ opacity: 0, scaleY: 0, rotate: -48 }}
            animate={{ opacity: [0, 1, 0.82, 0.52], scaleY: [0, 1, 1.02, 0.76], rotate: -48 }}
            transition={{ duration: 2.35, delay: 0.72, times: [0, 0.18, 0.72, 1], ease: 'easeOut' }}
            data-testid="smashup-triggered-preview-slash-a"
          />
          <motion.div
            className="absolute h-[132px] w-2.5 origin-center rounded-full bg-gradient-to-b from-white via-orange-200 to-red-500 shadow-[0_0_24px_rgba(251,146,60,0.88)]"
            style={{ left: targetPosition.left - 1, top: targetPosition.top - 66 }}
            initial={{ opacity: 0, scaleY: 0, rotate: 48 }}
            animate={{ opacity: [0, 0.95, 0.76, 0.48], scaleY: [0, 1, 1, 0.72], rotate: 48 }}
            transition={{ duration: 2.2, delay: 0.82, times: [0, 0.2, 0.7, 1], ease: 'easeOut' }}
            data-testid="smashup-triggered-preview-slash-b"
          />
          <motion.div
            className="absolute flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-100 bg-red-950/78 text-red-50 shadow-[0_0_26px_rgba(248,113,113,0.78)]"
            style={{ left: targetPosition.left - 24, top: targetPosition.top - 24 }}
            initial={{ opacity: 0, scale: 0.35, rotate: -12 }}
            animate={{ opacity: [0, 1, 0.92, 0.74], scale: [0.35, 1.16, 0.96, 0.98], rotate: [-12, 6, 0, 0] }}
            transition={{ duration: 2.3, delay: 0.82, times: [0, 0.18, 0.68, 1], ease: 'easeOut' }}
            data-testid="smashup-triggered-preview-skull"
          >
            <Skull size={28} strokeWidth={2.5} />
          </motion.div>
          {Array.from({ length: PREVIEW_SHARD_COUNT }, (_, i) => {
            const shardAngle = (Math.PI * 2 * i) / PREVIEW_SHARD_COUNT - Math.PI / 2;
            const shardDistance = 46 + (i % 4) * 16;
            return (
              <motion.span
                key={`impact-shard-${i}`}
                className="absolute rounded-sm bg-red-100 shadow-[0_0_14px_rgba(254,202,202,0.95)]"
                style={{
                  left: targetPosition.left,
                  top: targetPosition.top,
                  width: 6 + (i % 3) * 3,
                  height: 12 + (i % 3) * 5,
                }}
                initial={{ opacity: 0, scale: 0.18, x: '-50%', y: '-50%', rotate: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.18, 1, 0.38],
                  x: `calc(-50% + ${Math.cos(shardAngle) * shardDistance}px)`,
                  y: `calc(-50% + ${Math.sin(shardAngle) * shardDistance}px)`,
                  rotate: shardAngle * 90,
                }}
                transition={{ duration: 0.95, delay: 0.95 + i * 0.018, ease: 'easeOut' }}
              />
            );
          })}
        </>
      ) : (
        <motion.div
          className="absolute flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-emerald-400 text-slate-950 shadow-[0_0_34px_rgba(52,211,153,0.82)]"
          style={{ left: targetPosition.left + 18, top: targetPosition.top - 72 }}
          initial={{ opacity: 0, scale: 0.28, y: 18 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.28, 1.24, 1, 1.1], y: [18, -8, -24, -44] }}
          transition={{ duration: 1.45, delay: 0.76, ease: 'easeOut' }}
          data-testid="smashup-triggered-preview-buff"
        >
          <Plus size={34} strokeWidth={3} />
        </motion.div>
      )}
    </div>
  );
}

export const AbilityTriggeredCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const [activeKey, setActiveKey] = useState(0);
  const [presetIdx, setPresetIdx] = useState(0);
  const [fxPoints, setFxPoints] = useState<{
    sourcePosition?: { left: number; top: number };
    targetPosition?: { left: number; top: number };
  }>({});
  const { stats, startMeasure } = useEffectTrigger(2000);
  const atlasInitRef = useRef(false);
  const previewCompleteTimerRef = useRef<number | null>(null);
  const preloadedPreviewImagesRef = useRef<HTMLImageElement[]>([]);
  const triggerRunRef = useRef(0);
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const targetRefs = useRef<Array<HTMLDivElement | null>>([]);

  // 初始化 SmashUp 卡牌图集（仅一次）
  useEffect(() => {
    if (!atlasInitRef.current) {
      atlasInitRef.current = true;
      initSmashUpCardAtlases();
    }
  }, []);

  useEffect(() => {
    preloadedPreviewImagesRef.current = ABILITY_TRIGGERED_PRELOAD_IMAGES.map((src) => {
      const img = new Image();
      img.decoding = 'sync';
      img.loading = 'eager';
      img.src = getSmashUpPreviewImageUrl(src);
      void img.decode?.().catch(() => undefined);
      void ensureSmashUpPreviewImageLoaded(src);
      return img;
    });
  }, []);

  useEffect(() => () => {
    if (previewCompleteTimerRef.current !== null) {
      window.clearTimeout(previewCompleteTimerRef.current);
    }
  }, []);

  const trigger = useCallback((idx?: number) => {
    const nextIdx = idx ?? presetIdx;
    const nextScene = TRIGGER_SCENES[nextIdx];
    const nextTarget = MINION_SLOTS[nextScene.targetSlot];
    const runId = triggerRunRef.current + 1;
    triggerRunRef.current = runId;
    if (idx !== undefined) setPresetIdx(idx);
    if (previewCompleteTimerRef.current !== null) {
      window.clearTimeout(previewCompleteTimerRef.current);
      previewCompleteTimerRef.current = null;
    }
    setActiveKey(0);
    void Promise.all([
      ensureSmashUpPreviewImageLoaded(nextScene.previewImage),
      ensureSmashUpPreviewImageLoaded(nextTarget.previewImage),
    ]).then(() => {
      if (triggerRunRef.current !== runId) return;
      setFxPoints({
        sourcePosition: getElementCenter(sourceRef.current),
        targetPosition: getElementCenter(targetRefs.current[nextScene.targetSlot] ?? null),
      });
      requestAnimationFrame(() => {
        if (triggerRunRef.current !== runId) return;
        setActiveKey(k => k + 1);
        previewCompleteTimerRef.current = window.setTimeout(() => {
          setActiveKey(0);
          previewCompleteTimerRef.current = null;
        }, ABILITY_TRIGGERED_PREVIEW_DURATION_MS);
        startMeasure();
      });
    });
  }, [presetIdx, startMeasure]);

  const scene = TRIGGER_SCENES[presetIdx];

  return (
    <EffectCard
      title={t('devtools.effectPreview.gameplay.ability_triggered.title')}
      icon={Zap}
      iconColor={iconColor}
      stats={stats}
      buttons={<>
        {TRIGGER_SCENES.map((s, i) => (
          <TriggerButton
            key={s.defId}
            label={t(s.labelKey)}
            onClick={() => trigger(i)}
            color={i === presetIdx ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-600 hover:bg-slate-500'}
            testId={`smashup-triggered-preview-scene-${s.defId}`}
          />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center gap-[clamp(24px,6vw,96px)] bg-[radial-gradient(circle_at_50%_45%,rgba(120,83,39,0.18),transparent_52%)] p-6">
        {/* 左侧：触发源卡牌（带卡图） */}
        <div className="relative flex flex-col items-center gap-1.5 shrink-0">
          <motion.div
            ref={sourceRef}
            data-testid="smashup-triggered-preview-source-card"
            className="relative h-[190px] w-[136px] rounded-xl"
            animate={activeKey > 0
              ? {
                y: [0, -14, -9, -2],
                scale: [1, 1.08, 1.04, 1.01],
                rotate: [0, -1.5, 1, 0],
                filter: ['brightness(1)', 'brightness(1.22)', 'brightness(1.1)', 'brightness(1.04)'],
              }
              : { y: 0, scale: 1, rotate: 0, filter: 'brightness(1)' }}
            transition={activeKey > 0
              ? { duration: 1.45, times: [0, 0.18, 0.62, 1], ease: 'easeOut' }
              : { duration: 0.24, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-xl border-[3px] border-amber-500/70 bg-slate-800 shadow-[0_18px_48px_rgba(0,0,0,0.5)]">
              <SmashUpPreviewImageCard
                src={scene.previewImage}
                className="h-full w-full object-cover"
                title={t(scene.labelKey)}
              />
            </div>
            <AnimatePresence>
              {activeKey > 0 && (
                <>
                  <motion.div
                    className="absolute inset-[-12px] rounded-[22px] border-[3px] border-amber-100/95 shadow-[0_0_54px_rgba(251,191,36,0.92)]"
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: [0, 1, 0.82, 0], scale: [0.88, 1.1, 1.04, 1.2] }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 1.55, times: [0, 0.15, 0.68, 1], ease: 'easeOut' }}
                  />
                  <motion.div
                    className="absolute -right-4 -top-4 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-amber-300 text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.86)]"
                    initial={{ opacity: 0, scale: 0.2, rotate: -24 }}
                    animate={{ opacity: [0, 1, 1, 0.75], scale: [0.2, 1.25, 1, 1.05], rotate: [-24, 14, 4, 0] }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 1.12, ease: 'easeOut' }}
                  >
                    <Zap size={22} fill="currentColor" strokeWidth={1.6} />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* 右侧：模拟基地场景 */}
        <div className="relative flex flex-col items-center gap-1.5">
          {/* 基地标题 */}
          <div className="rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-1 text-[12px] font-bold text-slate-400">
            {t('devtools.effectPreview.gameplay.ability_triggered.preview.base_title')}
          </div>
          {/* 随从区 */}
          <div className="flex gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/58 p-4 shadow-[inset_0_0_36px_rgba(0,0,0,0.28)]">
            {MINION_SLOTS.map((slot, i) => (
              <FakeMinionSlot
                key={slot.key}
                ref={(node) => {
                  targetRefs.current[i] = node;
                }}
                slotKey={slot.key}
                label={t(slot.labelKey)}
                power={slot.power}
                color={slot.color}
                previewImage={slot.previewImage}
                active={i === scene.targetSlot}
                reacting={activeKey > 0 && i === scene.targetSlot}
                actionKind={scene.actionKind}
              />
            ))}
          </div>
        </div>

        {/* 触发动画浮层：只驱动真实源卡、轨迹和真实目标，不再渲染说明式空卡壳 */}
        {activeKey > 0 && (
          <AbilityTriggeredPreviewOverlay
            runKey={activeKey}
            sourcePosition={fxPoints.sourcePosition}
            targetPosition={fxPoints.targetPosition}
            actionKind={scene.actionKind}
          />
        )}
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 自动注册元数据
// ============================================================================

export const meta: EffectEntryMeta[] = [
  {
    id: 'baseCapture',
    labelKey: 'devtools.effectPreview.entries.gameplay.baseCapture.label',
    icon: Castle,
    component: BaseCaptureCard,
    group: 'gameplay',
    usageDescKey: 'devtools.effectPreview.entries.gameplay.baseCapture.usage',
  },
  {
    id: 'abilityTriggered',
    labelKey: 'devtools.effectPreview.entries.gameplay.abilityTriggered.label',
    icon: Zap,
    component: AbilityTriggeredCard,
    group: 'gameplay',
    usageDescKey: 'devtools.effectPreview.entries.gameplay.abilityTriggered.usage',
  },
];
