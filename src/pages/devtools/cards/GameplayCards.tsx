/**
 * 游戏玩法类特效预览卡片
 *
 * 包含与游戏机制相关的特效（基地占领、得分等）。
 */
/* eslint-disable react-refresh/only-export-components -- devtools preview cards */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Castle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BaseCaptureEffect } from '../../../components/common/animations/BaseCaptureEffect';
import { BurstParticles } from '../../../components/common/animations/BurstParticles';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { CardPreviewRef } from '../../../core';
import { FxLayer, useFxBus } from '../../../engine/fx';
import { smashUpFxRegistry, SU_FX } from '../../../games/smashup/ui/fxSetup';
import '../../../games/smashup/ui/SmashUpCardRenderer';
import {
  type PreviewCardProps, type EffectEntryMeta,
  EffectCard, TriggerButton, ToggleChip,
  useEffectTrigger,
} from './shared';

const BREAKPOINT_LABEL_KEY = 'devtools.effectPreview.gameplay.shared.breakpoint';
const ABILITY_TRIGGERED_PREVIEW_DURATION_MS = 4200;
const EMPTY_FX_CELL_POSITION = () => ({ left: 0, top: 0, width: 0, height: 0 });
const SMASHUP_CARD_RENDERER_ID = 'smashup-card-renderer';

const buildSmashUpPreviewRef = (defId: string): CardPreviewRef => ({
  type: 'renderer',
  rendererId: SMASHUP_CARD_RENDERER_ID,
  payload: { defId, disableHoverOverlay: true },
});

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
    previewRef: buildSmashUpPreviewRef('trickster_leprechaun'),
    targetSlot: 1,
    actionKind: 'destroy' as const,
  },
  {
    defId: 'trickster_flame_trap',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.trickster_flame_trap.label',
    previewRef: buildSmashUpPreviewRef('trickster_flame_trap'),
    targetSlot: 2,
    actionKind: 'destroy' as const,
  },
  {
    defId: 'ninja_assassination',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.ninja_assassination.label',
    previewRef: buildSmashUpPreviewRef('ninja_assassination'),
    targetSlot: 2,
    actionKind: 'destroy' as const,
  },
  {
    defId: 'bear_cavalry_high_ground',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.bear_cavalry_high_ground.label',
    previewRef: buildSmashUpPreviewRef('bear_cavalry_high_ground'),
    targetSlot: 0,
    actionKind: 'buff' as const,
  },
] as const;

const MINION_SLOTS = [
  {
    key: 'brownie',
    defId: 'trickster_brownie',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.preview.minions.brownie',
    power: 4,
    color: 'border-emerald-600/50 bg-emerald-900/30',
    previewRef: buildSmashUpPreviewRef('trickster_brownie'),
  },
  {
    key: 'gnome',
    defId: 'trickster_gnome',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.preview.minions.gnome',
    power: 3,
    color: 'border-blue-600/50 bg-blue-900/30',
    previewRef: buildSmashUpPreviewRef('trickster_gnome'),
  },
  {
    key: 'imp',
    defId: 'trickster_gremlin',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.preview.minions.imp',
    power: 2,
    color: 'border-purple-600/50 bg-purple-900/30',
    previewRef: buildSmashUpPreviewRef('trickster_gremlin'),
  },
] as const;

/** 模拟基地场景中的随从卡槽 */
const FakeMinionSlot = React.forwardRef<HTMLDivElement, {
  slotKey: string;
  label: string;
  power: number;
  color: string;
  previewRef: CardPreviewRef;
  active: boolean;
  reacting: boolean;
  actionKind: 'destroy' | 'buff';
}>(({ slotKey, label, power, color, previewRef, active, reacting, actionKind }, ref) => (
  <motion.div
    ref={ref}
    data-testid={`smashup-triggered-preview-minion-${slotKey}`}
    className={`relative isolate h-[136px] w-[96px] shrink-0 rounded-lg border ${color} flex flex-col items-center justify-center overflow-hidden text-[8px] shadow-lg transition-[border-color,box-shadow,transform] ${
      reacting && actionKind === 'destroy'
        ? 'border-red-200/20 shadow-[0_16px_36px_rgba(15,23,42,0.64)]'
        : active
          ? 'border-amber-200/30 shadow-[0_0_18px_rgba(251,191,36,0.16)]'
          : ''
    }`}
    animate={reacting && actionKind === 'destroy'
      ? {
        opacity: [1, 1, 0],
        scale: [1, 1, 0.98],
        rotate: [0, 0, 0, 0],
        y: [0, 0, 0, 0],
        filter: [
          'grayscale(0) brightness(1)',
          'grayscale(0) brightness(1)',
          'grayscale(0.2) brightness(0.74)',
        ],
      }
      : reacting && actionKind === 'buff'
        ? {
          scale: [1, 1.12, 1.02, 1],
          y: [0, -8, -4, 0],
          filter: ['brightness(1)', 'brightness(1.25)', 'brightness(1.12)', 'brightness(1)'],
        }
        : { opacity: 1, scale: 1, rotate: 0, y: 0, filter: 'grayscale(0) brightness(1)' }}
    transition={reacting
      ? actionKind === 'destroy'
        ? { duration: 0.08, delay: 0.62, times: [0, 1], ease: 'linear' }
        : { duration: 1.05, delay: 0.84, ease: 'easeOut' }
      : { duration: 0.22, ease: 'easeOut' }}
  >
    <CardPreview
      previewRef={previewRef}
      className="absolute inset-0 h-full w-full opacity-[0.94]"
      title={label}
    />
    <div className="absolute inset-x-0 bottom-0 bg-slate-950/82 px-1.5 py-1 text-center">
      <span className="block truncate font-bold text-white/90">{label}</span>
    </div>
    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-amber-100 bg-amber-400 text-[11px] font-black text-slate-950 shadow">
      {power}
    </span>
  </motion.div>
));
FakeMinionSlot.displayName = 'FakeMinionSlot';

function getElementCenter(element: HTMLElement | null) {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  return { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 };
}

function hasRenderedCardImage(element: HTMLElement | null) {
  if (!element) return false;
  if (element.querySelector('.atlas-shimmer')) return false;
  const images = Array.from(element.querySelectorAll<HTMLImageElement>('[data-card-atlas-img="true"], img[src]'));
  return images.some(img => img.complete && img.naturalWidth > 16 && img.naturalHeight > 16);
}

function waitForPreviewCardImages(sourceElement: HTMLElement | null, targetElements: Array<HTMLElement | null>) {
  const startedAt = performance.now();
  const timeoutMs = 12000;
  return new Promise<void>((resolve) => {
    const tick = () => {
      if (hasRenderedCardImage(sourceElement) && targetElements.every(hasRenderedCardImage)) {
        resolve();
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

export const AbilityTriggeredCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const fxBus = useFxBus(smashUpFxRegistry);
  const [activeKey, setActiveKey] = useState(0);
  const [presetIdx, setPresetIdx] = useState(0);
  const [queuedPreviewIdx, setQueuedPreviewIdx] = useState<number | null>(null);
  const { stats, startMeasure } = useEffectTrigger(2000);
  const previewCompleteTimerRef = useRef<number | null>(null);
  const triggerRunRef = useRef(0);
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const targetRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => () => {
    if (previewCompleteTimerRef.current !== null) {
      window.clearTimeout(previewCompleteTimerRef.current);
    }
  }, []);

  const playPreview = useCallback((nextIdx: number, sceneChanged: boolean) => {
    const nextScene = TRIGGER_SCENES[nextIdx];
    const nextTarget = MINION_SLOTS[nextScene.targetSlot];
    const runId = triggerRunRef.current + 1;
    triggerRunRef.current = runId;
    if (previewCompleteTimerRef.current !== null) {
      window.clearTimeout(previewCompleteTimerRef.current);
      previewCompleteTimerRef.current = null;
    }
    setActiveKey(0);

    const paintDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, sceneChanged ? 360 : 40);
    });

    void paintDelay.then(async () => {
      if (triggerRunRef.current !== runId) return;
      const sourceElement = sourceRef.current;
      const targetElement = targetRefs.current[nextScene.targetSlot] ?? null;
      await waitForPreviewCardImages(sourceElement, MINION_SLOTS.map((_, index) => targetRefs.current[index] ?? null));
      if (triggerRunRef.current !== runId) return;
      requestAnimationFrame(() => {
        if (triggerRunRef.current !== runId) return;
        const nextPoints = {
          sourcePosition: getElementCenter(sourceElement),
          targetPosition: getElementCenter(targetElement),
        };
        requestAnimationFrame(() => {
          if (triggerRunRef.current !== runId) return;
          setActiveKey(k => k + 1);
          if (nextPoints.sourcePosition && nextPoints.targetPosition) {
            fxBus.push(SU_FX.ABILITY_TRIGGERED, { space: 'screen' }, {
              sourceDefId: nextScene.defId,
              sourceLabel: t(nextScene.labelKey),
              sourcePosition: nextPoints.sourcePosition,
              sourcePreviewRef: nextScene.previewRef,
              targetDefId: nextTarget.defId,
              targetLabel: t(nextTarget.labelKey),
              targetPosition: nextPoints.targetPosition,
              targetPreviewRef: nextTarget.previewRef,
              actionKind: nextScene.actionKind,
              effectLabel: nextScene.actionKind === 'destroy' ? '消灭' : '力量提升',
              highlightTone: nextScene.actionKind === 'destroy' ? 'danger' : 'buff',
              durationMs: ABILITY_TRIGGERED_PREVIEW_DURATION_MS,
            });
          }
          previewCompleteTimerRef.current = window.setTimeout(() => {
            setActiveKey(0);
            previewCompleteTimerRef.current = null;
          }, ABILITY_TRIGGERED_PREVIEW_DURATION_MS);
          startMeasure();
        });
      });
    });
  }, [fxBus, startMeasure, t]);

  useEffect(() => {
    if (queuedPreviewIdx === null) return undefined;
    const nextIdx = queuedPreviewIdx;
    const timer = window.setTimeout(() => {
      playPreview(nextIdx, true);
      setQueuedPreviewIdx(current => (current === nextIdx ? null : current));
    }, 90);
    return () => window.clearTimeout(timer);
  }, [playPreview, queuedPreviewIdx]);

  const trigger = useCallback((idx?: number) => {
    const nextIdx = idx ?? presetIdx;
    if (idx !== undefined && idx !== presetIdx) {
      setPresetIdx(idx);
      setQueuedPreviewIdx(idx);
      return;
    }
    setQueuedPreviewIdx(null);
    playPreview(nextIdx, false);
  }, [playPreview, presetIdx]);

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
            className="relative h-[224px] w-[160px] rounded-xl"
            animate={activeKey > 0
              ? {
                y: [0, -8, -8, -2, 0],
                scale: [1, 1.18, 1.1, 1.04, 1],
                rotate: [0, -1.2, 0.8, 0, 0],
                filter: ['brightness(1)', 'brightness(1.28)', 'brightness(1.16)', 'brightness(1.06)', 'brightness(1)'],
              }
              : { y: 0, scale: 1, rotate: 0, filter: 'brightness(1)' }}
            transition={activeKey > 0
              ? { duration: 1.12, times: [0, 0.18, 0.48, 0.78, 1], ease: 'easeOut' }
              : { duration: 0.24, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-xl border border-slate-200/25 bg-slate-800 shadow-[0_20px_52px_rgba(0,0,0,0.5)]">
              <CardPreview
                previewRef={scene.previewRef}
                className="h-full w-full"
                title={t(scene.labelKey)}
              />
            </div>
          </motion.div>
        </div>

        {/* 右侧：模拟基地场景 */}
        <div className="relative flex flex-col items-center gap-1.5">
          <div className="rounded-full bg-slate-950/36 px-3 py-1 text-[12px] font-bold text-slate-500/80">
            {t('devtools.effectPreview.gameplay.ability_triggered.preview.base_title')}
          </div>
          <div className="flex gap-3 p-2">
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
                previewRef={slot.previewRef}
                active={i === scene.targetSlot}
                reacting={activeKey > 0 && i === scene.targetSlot}
                actionKind={scene.actionKind}
              />
            ))}
          </div>
        </div>

        <FxLayer
          bus={fxBus}
          getCellPosition={EMPTY_FX_CELL_POSITION}
          className="fixed z-[70]"
        />
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
