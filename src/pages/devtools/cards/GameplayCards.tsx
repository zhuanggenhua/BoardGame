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

type TriggerActionKind =
  | 'destroy'
  | 'buff'
  | 'move'
  | 'return'
  | 'discard';
type PreviewZoneKey = 'baseA' | 'baseB' | 'hand' | 'discard' | 'emptySlot';
type TriggerStep = {
  actionKind: TriggerActionKind;
  targetKey: 'minion' | PreviewZoneKey;
  targetSlot?: number;
  resultKey?: PreviewZoneKey;
  targetDefId?: string;
  targetPreviewRef?: CardPreviewRef;
  effectLabel: string;
  highlightTone?: 'info' | 'danger' | 'buff';
  durationMs?: number;
};
type TriggerScene = {
  id: string;
  defId: string;
  labelKey: string;
  previewRef: CardPreviewRef;
  actionKind: TriggerActionKind;
  targetKey: TriggerStep['targetKey'];
  targetSlot?: number;
  resultKey?: PreviewZoneKey;
  targetDefId?: string;
  targetPreviewRef?: CardPreviewRef;
  effectLabel: string;
  highlightTone?: TriggerStep['highlightTone'];
  steps?: TriggerStep[];
};

/** 预设的触发器场景（按钮只选案例，动效本体回答来源/路径/结果） */
const TRIGGER_SCENES: readonly TriggerScene[] = [
  {
    id: 'destroy_leprechaun',
    defId: 'trickster_leprechaun',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.trickster_leprechaun.label',
    previewRef: buildSmashUpPreviewRef('trickster_leprechaun'),
    targetKey: 'minion',
    targetSlot: 1,
    actionKind: 'destroy',
    effectLabel: '消灭',
    highlightTone: 'danger',
  },
  {
    id: 'buff_power',
    defId: 'cowboys_quick_draw',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.buff_power.label',
    previewRef: buildSmashUpPreviewRef('cowboys_quick_draw'),
    targetKey: 'minion',
    targetSlot: 0,
    actionKind: 'buff',
    effectLabel: '力量提升',
    highlightTone: 'buff',
  },
  {
    id: 'move_minion',
    defId: 'shield_reassignment',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.move_minion.label',
    previewRef: buildSmashUpPreviewRef('shield_reassignment'),
    targetKey: 'minion',
    targetSlot: 0,
    resultKey: 'emptySlot',
    actionKind: 'move',
    effectLabel: '移动',
    highlightTone: 'info',
  },
  {
    id: 'return_to_hand',
    defId: 'alien_scout',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.return_to_hand.label',
    previewRef: buildSmashUpPreviewRef('alien_scout'),
    targetKey: 'minion',
    targetSlot: 1,
    resultKey: 'hand',
    actionKind: 'return',
    effectLabel: '返回手牌',
    highlightTone: 'info',
  },
  {
    id: 'discard_card',
    defId: 'super_spies_discards_are_forever',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.discard_card.label',
    previewRef: buildSmashUpPreviewRef('super_spies_discards_are_forever'),
    targetKey: 'minion',
    targetSlot: 2,
    resultKey: 'discard',
    actionKind: 'discard',
    effectLabel: '弃置',
    highlightTone: 'danger',
  },
  {
    id: 'chain_trigger',
    defId: 'bear_cavalry_high_ground_pod',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.chain_trigger.label',
    previewRef: buildSmashUpPreviewRef('bear_cavalry_high_ground_pod'),
    targetKey: 'minion',
    targetSlot: 0,
    actionKind: 'buff',
    effectLabel: '连环触发',
    highlightTone: 'buff',
    steps: [
      {
        actionKind: 'buff',
        targetKey: 'minion',
        targetSlot: 0,
        effectLabel: '力量提升',
        highlightTone: 'buff',
        durationMs: 1750,
      },
      {
        actionKind: 'discard',
        targetKey: 'minion',
        targetSlot: 2,
        resultKey: 'discard',
        effectLabel: '弃置',
        highlightTone: 'danger',
        durationMs: 1900,
      },
    ],
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

type PreviewPhase = 'wake' | 'impact' | 'settle';
type RunningPreview = {
  runId: number;
  sceneId: string;
  stepIndex: number;
  actionKind: TriggerActionKind;
  targetKey: TriggerStep['targetKey'];
  targetSlot?: number;
  resultKey?: PreviewZoneKey;
  phase: PreviewPhase;
  moveDx: number;
  moveDy: number;
};

/** 模拟基地场景中的随从卡槽 */
const FakeMinionSlot = React.forwardRef<HTMLDivElement, {
  slotKey: string;
  label: string;
  power: number;
  color: string;
  previewRef: CardPreviewRef;
  active: boolean;
  running: RunningPreview | null;
}>(({ slotKey, label, power, color, previewRef, active, running }, ref) => {
  const reacting = running?.targetKey === 'minion' && running.targetSlot !== undefined
    && MINION_SLOTS[running.targetSlot]?.key === slotKey;
  const actionKind = running?.actionKind;
  const moving = reacting && (actionKind === 'move' || actionKind === 'return' || actionKind === 'discard');
  const buffed = reacting && actionKind === 'buff' && running.phase !== 'wake';
  const hiddenByResult = reacting
    && (actionKind === 'destroy' || actionKind === 'discard' || actionKind === 'return' || actionKind === 'move')
    && running.phase === 'settle';

  return (
    <motion.div
      ref={ref}
      data-testid={`smashup-triggered-preview-minion-${slotKey}`}
      className={`relative isolate h-[136px] w-[96px] shrink-0 rounded-lg border ${color} flex flex-col items-center justify-center overflow-visible text-[8px] shadow-lg transition-[border-color,box-shadow,transform] ${
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
          rotate: [0, 0, 0],
          x: 0,
          y: 0,
          filter: [
            'grayscale(0) brightness(1)',
            'grayscale(0) brightness(1)',
            'grayscale(0.2) brightness(0.74)',
          ],
        }
        : moving
          ? {
            opacity: [1, running.phase === 'wake' ? 1 : 0.38, running.phase === 'settle' ? 0.08 : 0.22],
            scale: [1, 1.03, 0.94],
            x: 0,
            y: [0, -4, 0],
            rotate: [0, actionKind === 'discard' ? 2 : -1, 0],
            filter: [
              'brightness(1)',
              'brightness(1.12)',
              actionKind === 'discard' ? 'grayscale(0.7) brightness(0.7)' : 'brightness(0.82)',
            ],
          }
          : reacting && actionKind === 'buff'
            ? {
              scale: [1, 1.12, 1.02, 1],
              y: [0, -8, -4, 0],
              filter: ['brightness(1)', 'brightness(1.25)', 'brightness(1.12)', 'brightness(1)'],
            }
            : { opacity: 1, scale: 1, rotate: 0, x: 0, y: 0, filter: 'grayscale(0) brightness(1)' }}
      transition={reacting
        ? actionKind === 'destroy'
          ? { duration: 0.08, delay: 0.62, times: [0, 1], ease: 'linear' }
          : moving
            ? { duration: 0.72, delay: running.phase === 'wake' ? 0.72 : 0, ease: 'easeOut' }
            : { duration: 1.05, delay: 0.84, ease: 'easeOut' }
        : { duration: 0.22, ease: 'easeOut' }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        <CardPreview
          previewRef={previewRef}
          className="absolute inset-0 h-full w-full opacity-[0.94]"
          title={label}
        />
        <div className="absolute inset-x-0 bottom-0 bg-slate-950/82 px-1.5 py-1 text-center">
          <span className="block truncate font-bold text-white/90">{label}</span>
        </div>
      </div>
      {hiddenByResult ? (
        <div className="absolute inset-0 rounded-lg bg-slate-950/50" />
      ) : null}
      <span className={`absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[11px] font-black text-slate-950 shadow ${
        buffed ? 'border-white bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.75)]' : 'border-amber-100 bg-amber-400'
      }`}>
        {buffed ? power + 1 : power}
      </span>
    </motion.div>
  );
});
FakeMinionSlot.displayName = 'FakeMinionSlot';

const PreviewZone = React.forwardRef<HTMLDivElement, {
  zoneKey: PreviewZoneKey;
  label: string;
  variant: 'base' | 'hand' | 'discard' | 'empty';
  active?: boolean;
  children?: React.ReactNode;
}>(({ zoneKey, label, variant, active, children }, ref) => {
  const baseClasses = {
    base: 'h-[96px] w-[190px] rounded-xl border border-amber-300/30 bg-amber-950/18',
    hand: 'h-[86px] w-[120px] rounded-xl border border-slate-300/30 bg-slate-950/34',
    discard: 'h-[86px] w-[72px] rounded-lg border border-rose-300/35 bg-rose-950/24',
    empty: 'h-[136px] w-[96px] rounded-lg border border-dashed border-slate-400/35 bg-slate-950/24',
  }[variant];

  return (
    <motion.div
      ref={ref}
      data-testid={`smashup-triggered-preview-zone-${zoneKey}`}
      className={`relative flex shrink-0 items-center justify-center overflow-visible ${baseClasses} ${
        active ? 'shadow-[0_0_22px_rgba(251,191,36,0.22)]' : ''
      }`}
      animate={active
        ? { scale: [1, 1.04, 1], filter: ['brightness(1)', 'brightness(1.22)', 'brightness(1)'] }
        : { scale: 1, filter: 'brightness(1)' }}
      transition={{ duration: 1.1, ease: 'easeOut' }}
    >
      <span className="absolute left-2 top-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/50">
        {label}
      </span>
      {children}
    </motion.div>
  );
});
PreviewZone.displayName = 'PreviewZone';

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
  const [running, setRunning] = useState<RunningPreview | null>(null);
  const { stats, startMeasure } = useEffectTrigger(2600);
  const previewTimersRef = useRef<number[]>([]);
  const triggerRunRef = useRef(0);
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const targetRefs = useRef<Array<HTMLDivElement | null>>([]);
  const zoneRefs = useRef<Partial<Record<PreviewZoneKey, HTMLDivElement | null>>>({});

  const clearPreviewTimers = useCallback(() => {
    previewTimersRef.current.forEach(timer => window.clearTimeout(timer));
    previewTimersRef.current = [];
  }, []);

  const setZoneRef = useCallback((key: PreviewZoneKey) => (node: HTMLDivElement | null) => {
    zoneRefs.current[key] = node;
  }, []);

  const getTargetElement = useCallback((step: TriggerStep) => {
    if (step.targetKey === 'minion') {
      return step.targetSlot === undefined ? null : targetRefs.current[step.targetSlot] ?? null;
    }
    return zoneRefs.current[step.targetKey] ?? null;
  }, []);

  const getResultElement = useCallback((step: TriggerStep) => (
    step.resultKey ? zoneRefs.current[step.resultKey] ?? null : null
  ), []);

  const resolveStepTarget = useCallback((step: TriggerStep) => {
    if (step.targetKey === 'minion' && step.targetSlot !== undefined) {
      const slot = MINION_SLOTS[step.targetSlot];
      if (slot) {
        return {
          targetDefId: step.targetDefId ?? slot.defId,
          targetLabel: t(slot.labelKey),
          targetPreviewRef: step.targetPreviewRef ?? slot.previewRef,
        };
      }
    }
    return {
      targetDefId: step.targetDefId,
      targetLabel: undefined,
      targetPreviewRef: step.targetPreviewRef,
    };
  }, [t]);

  const toSingleStep = useCallback((scene: TriggerScene): TriggerStep => ({
    actionKind: scene.actionKind,
    targetKey: scene.targetKey,
    targetSlot: scene.targetSlot,
    resultKey: scene.resultKey,
    targetDefId: scene.targetDefId,
    targetPreviewRef: scene.targetPreviewRef,
    effectLabel: scene.effectLabel,
    highlightTone: scene.highlightTone,
  }), []);

  const scheduleTimer = useCallback((delayMs: number, fn: () => void) => {
    const timer = window.setTimeout(fn, delayMs);
    previewTimersRef.current.push(timer);
  }, []);

  useEffect(() => () => {
    clearPreviewTimers();
  }, [clearPreviewTimers]);

  const playPreview = useCallback((nextIdx: number, sceneChanged: boolean) => {
    const nextScene = TRIGGER_SCENES[nextIdx];
    const runId = triggerRunRef.current + 1;
    triggerRunRef.current = runId;
    clearPreviewTimers();
    setRunning(null);
    setActiveKey(0);

    const paintDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, sceneChanged ? 360 : 40);
    });

    void paintDelay.then(async () => {
      if (triggerRunRef.current !== runId) return;
      const sourceElement = sourceRef.current;
      await waitForPreviewCardImages(sourceElement, MINION_SLOTS.map((_, index) => targetRefs.current[index] ?? null));
      if (triggerRunRef.current !== runId) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (triggerRunRef.current !== runId) return;
          const sourcePosition = getElementCenter(sourceElement);
          if (!sourcePosition) return;

          const sceneSteps = nextScene.steps ?? [toSingleStep(nextScene)];
          const fxSteps: Array<{
            cue: typeof SU_FX.ABILITY_TRIGGERED;
            ctx: { space: 'screen' };
            params: Record<string, unknown>;
            delayAfter?: number;
          }> = [];
          let elapsedMs = 0;

          sceneSteps.forEach((step, stepIndex) => {
            const targetElement = getTargetElement(step);
            const resultElement = getResultElement(step);
            const targetPosition = getElementCenter(targetElement);
            if (!targetPosition) return;
            const resultPosition = getElementCenter(resultElement);
            const stepDurationMs = step.durationMs ?? (sceneSteps.length > 1 ? 1800 : ABILITY_TRIGGERED_PREVIEW_DURATION_MS);
            const delayAfter = stepIndex < sceneSteps.length - 1 ? 180 : 0;
            const settleDelayMs = sceneSteps.length > 1
              ? Math.max(1280, stepDurationMs - 420)
              : Math.min(2350, Math.max(1700, stepDurationMs * 0.52));
            const moveDx = resultPosition ? resultPosition.left - targetPosition.left : 0;
            const moveDy = resultPosition ? resultPosition.top - targetPosition.top : 0;
            const targetInfo = resolveStepTarget(step);

            fxSteps.push({
              cue: SU_FX.ABILITY_TRIGGERED,
              ctx: { space: 'screen' },
              params: {
                sourceDefId: nextScene.defId,
                sourceLabel: t(nextScene.labelKey),
                sourcePosition,
                sourcePreviewRef: nextScene.previewRef,
                targetDefId: targetInfo.targetDefId,
                targetLabel: targetInfo.targetLabel,
                targetPosition,
                targetPreviewRef: targetInfo.targetPreviewRef,
                resultPosition,
                actionKind: step.actionKind,
                effectLabel: step.effectLabel,
                highlightTone: step.highlightTone,
                durationMs: stepDurationMs,
              },
              delayAfter,
            });

            scheduleTimer(elapsedMs, () => {
              if (triggerRunRef.current !== runId) return;
              setActiveKey(k => k + 1);
              setRunning({
                runId,
                sceneId: nextScene.id,
                stepIndex,
                actionKind: step.actionKind,
                targetKey: step.targetKey,
                targetSlot: step.targetSlot,
                resultKey: step.resultKey,
                phase: 'wake',
                moveDx,
                moveDy,
              });
            });
            scheduleTimer(elapsedMs + Math.min(880, stepDurationMs * 0.42), () => {
              setRunning(current => current?.runId === runId && current.stepIndex === stepIndex
                ? { ...current, phase: 'impact' }
                : current);
            });
            scheduleTimer(elapsedMs + settleDelayMs, () => {
              setRunning(current => current?.runId === runId && current.stepIndex === stepIndex
                ? { ...current, phase: 'settle' }
                : current);
            });

            elapsedMs += stepDurationMs + delayAfter;
          });

          if (fxSteps.length === 0) return;
          if (fxSteps.length === 1) {
            const [onlyStep] = fxSteps;
            fxBus.push(onlyStep.cue, onlyStep.ctx, onlyStep.params);
          } else {
            fxBus.pushSequence(fxSteps);
          }

          scheduleTimer(elapsedMs + 120, () => {
            if (triggerRunRef.current !== runId) return;
            setRunning(null);
            setActiveKey(0);
          });
          startMeasure();
        });
      });
    });
  }, [
    clearPreviewTimers,
    fxBus,
    getResultElement,
    getTargetElement,
    resolveStepTarget,
    scheduleTimer,
    startMeasure,
    t,
    toSingleStep,
  ]);

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
  const activeTargetSlot = running?.targetSlot ?? (scene.targetKey === 'minion' ? scene.targetSlot : undefined);
  const zoneActive = (key: PreviewZoneKey) => running?.targetKey === key || running?.resultKey === key;
  const runningTargetSlot = running?.targetSlot !== undefined ? MINION_SLOTS[running.targetSlot] : undefined;
  const runningTargetPreviewRef = runningTargetSlot?.previewRef ?? scene.targetPreviewRef;
  const runningTargetLabel = runningTargetSlot ? t(runningTargetSlot.labelKey) : t(scene.labelKey);
  const showMovedCard = running?.actionKind === 'move' && running.phase === 'settle' && runningTargetPreviewRef;
  const showReturnedCard = running?.actionKind === 'return' && running.phase === 'settle' && runningTargetPreviewRef;
  const showDiscardedCard = running?.actionKind === 'discard' && running.phase === 'settle' && runningTargetPreviewRef;

  return (
    <EffectCard
      title={t('devtools.effectPreview.gameplay.ability_triggered.title')}
      icon={Zap}
      iconColor={iconColor}
      stats={stats}
      buttons={<>
        {TRIGGER_SCENES.map((s, i) => (
          <TriggerButton
            key={s.id}
            label={t(s.labelKey)}
            onClick={() => trigger(i)}
            color={i === presetIdx ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-600 hover:bg-slate-500'}
            testId={`smashup-triggered-preview-scene-${s.id}`}
          />
        ))}
      </>}
    >
      <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(120,83,39,0.18),transparent_54%)] px-5 py-4">
        <div className="grid h-full min-h-[330px] grid-cols-[145px_minmax(0,1fr)] items-center gap-4">
          <div className="relative flex flex-col items-center gap-2">
            <motion.div
              ref={sourceRef}
              data-testid="smashup-triggered-preview-source-card"
              className="relative h-[202px] w-[144px] rounded-xl"
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

          <div className="relative flex min-w-0 items-center justify-center gap-7">
            <div className="flex flex-col items-center gap-2">
              <PreviewZone
                ref={setZoneRef('baseA')}
                zoneKey="baseA"
                label={t('devtools.effectPreview.gameplay.ability_triggered.preview.base_title')}
                variant="base"
                active={zoneActive('baseA')}
              >
                <span className="text-2xl font-black text-amber-100">20</span>
              </PreviewZone>
              <div className="flex gap-3 p-1">
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
                    active={i === activeTargetSlot}
                    running={running}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <PreviewZone
                ref={setZoneRef('baseB')}
                zoneKey="baseB"
                label={t('devtools.effectPreview.gameplay.ability_triggered.preview.zones.second_base')}
                variant="base"
                active={zoneActive('baseB')}
              >
                <span className="text-2xl font-black text-slate-100">18</span>
              </PreviewZone>
              <div className="flex items-center gap-3">
                <PreviewZone
                  ref={setZoneRef('emptySlot')}
                  zoneKey="emptySlot"
                  label={t('devtools.effectPreview.gameplay.ability_triggered.preview.zones.empty_slot')}
                  variant="empty"
                  active={zoneActive('emptySlot')}
                >
                  {showMovedCard ? (
                    <motion.div
                      className="absolute inset-0 overflow-hidden rounded-lg"
                      initial={{ opacity: 0, scale: 0.72 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.32, delay: 0.12 }}
                      data-testid="smashup-triggered-preview-moved-card"
                    >
                      <CardPreview
                        previewRef={runningTargetPreviewRef}
                        className="h-full w-full"
                        title={runningTargetLabel}
                      />
                    </motion.div>
                  ) : (
                    <div className="h-[74px] w-[52px] rounded-md border border-dashed border-white/18 bg-slate-950/28" />
                  )}
                </PreviewZone>
                <div className="flex flex-col gap-3">
                  <PreviewZone
                    ref={setZoneRef('hand')}
                    zoneKey="hand"
                    label={t('devtools.effectPreview.gameplay.ability_triggered.preview.zones.hand')}
                    variant="hand"
                    active={zoneActive('hand')}
                  >
                    {[0, 1, 2].map(index => (
                      <div
                        key={index}
                        className="absolute h-[58px] w-[42px] rounded border border-white/35 bg-[linear-gradient(135deg,#78350f,#d97706_52%,#fde68a)] shadow"
                        style={{
                          left: 23 + index * 22,
                          top: 22 - Math.abs(index - 1) * 2,
                          transform: `rotate(${(index - 1) * 7}deg)`,
                        }}
                      />
                    ))}
                    {showReturnedCard ? (
                      <motion.div
                        className="absolute right-3 top-3 h-[58px] w-[42px] overflow-hidden rounded border border-white/55 shadow-[0_0_20px_rgba(251,191,36,0.38)]"
                        initial={{ opacity: 0, scale: 0.78, rotate: 8 }}
                        animate={{ opacity: 1, scale: 1, rotate: 2 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        data-testid="smashup-triggered-preview-returned-card"
                      >
                        <CardPreview
                          previewRef={runningTargetPreviewRef}
                          className="h-full w-full"
                          title={runningTargetLabel}
                        />
                      </motion.div>
                    ) : null}
                  </PreviewZone>
                  <PreviewZone
                    ref={setZoneRef('discard')}
                    zoneKey="discard"
                    label={t('devtools.effectPreview.gameplay.ability_triggered.preview.zones.discard')}
                    variant="discard"
                    active={zoneActive('discard')}
                  >
                    <div className="h-[58px] w-[42px] rotate-[-9deg] rounded border border-rose-100/35 bg-slate-800 shadow" />
                    {showDiscardedCard ? (
                      <motion.div
                        className="absolute left-[15px] top-[14px] h-[58px] w-[42px] overflow-hidden rounded border border-rose-100/45 shadow-[0_0_18px_rgba(251,113,133,0.4)]"
                        initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
                        animate={{ opacity: 0.92, scale: 1, rotate: -8, filter: 'grayscale(0.55) brightness(0.78)' }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        data-testid="smashup-triggered-preview-discarded-card"
                      >
                        <CardPreview
                          previewRef={runningTargetPreviewRef}
                          className="h-full w-full"
                          title={runningTargetLabel}
                        />
                      </motion.div>
                    ) : null}
                  </PreviewZone>
                </div>
              </div>
            </div>
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
