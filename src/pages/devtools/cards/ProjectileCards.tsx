/**
 * 投射类特效预览卡片
 */

import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, Wind } from 'lucide-react';
import {
  FlyingEffectsLayer,
  useFlyingEffects,
  type FlyingEffectData,
} from '../../../components/common/animations/FlyingEffect';
import { ConeBlast } from '../../../components/common/animations/ConeBlast';
import {
  type PreviewCardProps, type EffectEntryMeta,
  EffectCard, TriggerButton, CardSprite,
  usePerfCounter, useEffectTrigger,
} from './shared';

// ============================================================================
// 飞行特效
// ============================================================================

export const FlyingCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const { effects, pushEffect, removeEffect } = useFlyingEffects();
  const containerRef = useRef<HTMLDivElement>(null);
  const { stats, startMeasure } = usePerfCounter();

  const fire = useCallback((type: FlyingEffectData['type'], intensity: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const content = type === 'damage' ? `-${intensity}` : type === 'heal' ? `+${intensity}` : '✨';
    pushEffect({
      type, content, intensity,
      startPos: { x: rect.left + rect.width * 0.15, y: rect.top + rect.height * 0.5 },
      endPos: { x: rect.left + rect.width * 0.85, y: rect.top + rect.height * 0.5 },
    });
    const stop = startMeasure();
    setTimeout(stop, 1200);
  }, [pushEffect, startMeasure]);

  return (
    <EffectCard
      title={t('devtools.effectPreview.projectile.flying.title')}
      icon={Rocket}
      iconColor={iconColor}
      desc={t('devtools.effectPreview.projectile.flying.description')}
      stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.projectile.flying.buttons.damage_1')} onClick={() => fire('damage', 1)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label={t('devtools.effectPreview.projectile.flying.buttons.damage_5')} onClick={() => fire('damage', 5)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label={t('devtools.effectPreview.projectile.flying.buttons.damage_10')} onClick={() => fire('damage', 10)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label={t('devtools.effectPreview.projectile.flying.buttons.heal_3')} onClick={() => fire('heal', 3)} color="bg-emerald-700 hover:bg-emerald-600" />
        <TriggerButton label={t('devtools.effectPreview.projectile.flying.buttons.buff')} onClick={() => fire('buff', 1)} color="bg-amber-700 hover:bg-amber-600" />
      </>}
    >
      <div ref={containerRef} className="absolute inset-0 flex items-center justify-between px-4">
        <div className="w-5 h-5 rounded-full bg-indigo-500/30 border border-indigo-400/50 flex items-center justify-center text-[8px] text-indigo-300">
          {t('devtools.effectPreview.projectile.flying.preview.start')}
        </div>
        <div className="w-5 h-5 rounded-full bg-red-500/30 border border-red-400/50 flex items-center justify-center text-[8px] text-red-300">
          {t('devtools.effectPreview.projectile.flying.preview.end')}
        </div>
      </div>
      <FlyingEffectsLayer effects={effects} onEffectComplete={removeEffect} />
    </EffectCard>
  );
};

// ============================================================================
// 锥形气浪
// ============================================================================

export const ConeBlastCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { t } = useTranslation('lobby');
  const [intensity, setIntensity] = React.useState<'normal' | 'strong'>('normal');
  const { active, fire, reset, stats } = useEffectTrigger(1000);

  const trigger = useCallback((int: 'normal' | 'strong') => {
    setIntensity(int);
    fire();
  }, [fire]);

  return (
    <EffectCard
      title={t('devtools.effectPreview.projectile.cone_blast.title')}
      icon={Wind}
      iconColor={iconColor}
      desc={t('devtools.effectPreview.projectile.cone_blast.description')}
      stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.projectile.cone_blast.buttons.normal')} onClick={() => trigger('normal')} color="bg-cyan-700 hover:bg-cyan-600" />
        <TriggerButton label={t('devtools.effectPreview.projectile.cone_blast.buttons.strong')} onClick={() => trigger('strong')} color="bg-cyan-700 hover:bg-cyan-600" />
      </>}
    >
      {/* 源点（左侧） */}
      <div className="absolute left-[15%] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-500/30 border border-cyan-400/50 flex items-center justify-center text-[8px] text-cyan-300">
        {t('devtools.effectPreview.projectile.cone_blast.preview.source')}
      </div>
      {/* 目标点（右侧） */}
      {useRealCards ? (
        <div className="absolute left-[85%] top-1/2 -translate-y-1/2 -translate-x-full w-36 h-24 rounded border border-slate-600/50">
          <CardSprite className="absolute inset-0 rounded" />
        </div>
      ) : (
        <div className="absolute left-[85%] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-500/30 border border-red-400/50 flex items-center justify-center text-[8px] text-red-300">
          {t('devtools.effectPreview.projectile.cone_blast.preview.target')}
        </div>
      )}
      {active && (
        <ConeBlast start={{ xPct: 15, yPct: 50 }} end={{ xPct: 85, yPct: 50 }} intensity={intensity} onComplete={reset} />
      )}
    </EffectCard>
  );
};

// ============================================================================
// 自动注册元数据
// ============================================================================

export const meta: EffectEntryMeta[] = [
  {
    id: 'flying',
    labelKey: 'devtools.effectPreview.entries.projectile.flying.label',
    icon: Rocket,
    component: FlyingCard,
    group: 'projectile',
    usageDescKey: 'devtools.effectPreview.entries.projectile.flying.usage',
  },
  {
    id: 'coneblast',
    labelKey: 'devtools.effectPreview.entries.projectile.coneblast.label',
    icon: Wind,
    component: ConeBlastCard,
    group: 'projectile',
    usageDescKey: 'devtools.effectPreview.entries.projectile.coneblast.usage',
  },
];
