/**
 * 加载动画预览卡片
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheckBig, Star, WandSparkles, Globe, Clock } from 'lucide-react';
import {
  LoadingArcaneAether,
  LoadingArcaneGrandmaster,
  LoadingMagicTrickCards,
  LoadingCelestialOrrery,
  LoadingSteampunkClock,
} from '../../../components/system/LoadingVariants';
import { EffectCard, TriggerButton, usePerfCounter, type PreviewCardProps, type EffectEntryMeta } from './shared';

// ============================================================================
// 通用加载动画卡片
// ============================================================================

const LoadingVariantCard: React.FC<{
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  desc: string;
  component: React.FC<{ className?: string }>;
  iconColor?: string;
}> = ({ title, icon, desc, component: Comp, iconColor }) => {
  const { t } = useTranslation('lobby');
  const { stats, startMeasure } = usePerfCounter();
  const [active, setActive] = useState(false);

  React.useEffect(() => {
    if (active) {
      const stop = startMeasure();
      return stop;
    }
  }, [active, startMeasure]);

  return (
    <EffectCard
      title={title} icon={icon} desc={desc} stats={stats}
      iconColor={iconColor}
      className="md:col-span-2 xl:col-span-3"
      renderH="180px"
      buttons={
        <TriggerButton
          label={active ? t('devtools.effectPreview.loading.shared.stop') : t('devtools.effectPreview.loading.shared.start')}
          onClick={() => setActive(prev => !prev)}
          color={active ? 'bg-slate-700' : 'bg-emerald-700'}
        />
      }
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-slate-900/50">
        {active && (
          <div className="w-full h-full flex items-center justify-center">
            <Comp className="scale-100 transform-gpu" />
          </div>
        )}
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 各加载动画实例
// ============================================================================

export const ArcaneQualifiedCard: React.FC<PreviewCardProps> = (props) => {
  const { t } = useTranslation('lobby');
  return <LoadingVariantCard title={t('devtools.effectPreview.loading.arcane_qualified.title')} icon={CircleCheckBig} desc={t('devtools.effectPreview.loading.arcane_qualified.description')} component={LoadingArcaneAether} {...props} />;
};
export const ArcaneGrandmasterCard: React.FC<PreviewCardProps> = (props) => {
  const { t } = useTranslation('lobby');
  return <LoadingVariantCard title={t('devtools.effectPreview.loading.arcane_grandmaster.title')} icon={Star} desc={t('devtools.effectPreview.loading.arcane_grandmaster.description')} component={LoadingArcaneGrandmaster} {...props} />;
};
export const MagicCardsCard: React.FC<PreviewCardProps> = (props) => {
  const { t } = useTranslation('lobby');
  return <LoadingVariantCard title={t('devtools.effectPreview.loading.magic_cards.title')} icon={WandSparkles} desc={t('devtools.effectPreview.loading.magic_cards.description')} component={LoadingMagicTrickCards} {...props} />;
};
export const OrreryCard: React.FC<PreviewCardProps> = (props) => {
  const { t } = useTranslation('lobby');
  return <LoadingVariantCard title={t('devtools.effectPreview.loading.orrery.title')} icon={Globe} desc={t('devtools.effectPreview.loading.orrery.description')} component={LoadingCelestialOrrery} {...props} />;
};
export const GrandClockCard: React.FC<PreviewCardProps> = (props) => {
  const { t } = useTranslation('lobby');
  return <LoadingVariantCard title={t('devtools.effectPreview.loading.grand_clock.title')} icon={Clock} desc={t('devtools.effectPreview.loading.grand_clock.description')} component={LoadingSteampunkClock} {...props} />;
};

// ============================================================================
// 自动注册元数据
// ============================================================================

export const meta: EffectEntryMeta[] = [
  { id: 'arcane_qualified', labelKey: 'devtools.effectPreview.entries.loading.arcane_qualified.label', icon: CircleCheckBig, component: ArcaneQualifiedCard, group: 'loading', usageDescKey: 'devtools.effectPreview.entries.loading.arcane_qualified.usage' },
  { id: 'arcane_grandmaster', labelKey: 'devtools.effectPreview.entries.loading.arcane_grandmaster.label', icon: Star, component: ArcaneGrandmasterCard, group: 'loading', usageDescKey: 'devtools.effectPreview.entries.loading.arcane_grandmaster.usage' },
  { id: 'magic_cards', labelKey: 'devtools.effectPreview.entries.loading.magic_cards.label', icon: WandSparkles, component: MagicCardsCard, group: 'loading', usageDescKey: 'devtools.effectPreview.entries.loading.magic_cards.usage' },
  { id: 'solar_system', labelKey: 'devtools.effectPreview.entries.loading.solar_system.label', icon: Globe, component: OrreryCard, group: 'loading', usageDescKey: 'devtools.effectPreview.entries.loading.solar_system.usage' },
  { id: 'grand_clock', labelKey: 'devtools.effectPreview.entries.loading.grand_clock.label', icon: Clock, component: GrandClockCard, group: 'loading', usageDescKey: 'devtools.effectPreview.entries.loading.grand_clock.usage' },
];
