/**
 * 加载动画预览卡片
 */

import React, { useState } from 'react';
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
          label={active ? '停止' : '启动'}
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

export const ArcaneQualifiedCard: React.FC<PreviewCardProps> = (props) => <LoadingVariantCard title="Qualified Arcane" icon={CircleCheckBig} desc="【过审】复合叠加版本（粒子流）" component={LoadingArcaneAether} {...props} />;
export const ArcaneGrandmasterCard: React.FC<PreviewCardProps> = (props) => <LoadingVariantCard title="Arcane Grandmaster" icon={Star} desc="【候补】在过审版基础上大幅加强" component={LoadingArcaneGrandmaster} {...props} />;
export const MagicCardsCard: React.FC<PreviewCardProps> = (props) => <LoadingVariantCard title="Magic Cards" icon={WandSparkles} desc="【候补】魔术师天女散花式飞牌" component={LoadingMagicTrickCards} {...props} />;
export const OrreryCard: React.FC<PreviewCardProps> = (props) => <LoadingVariantCard title="Solar System Pro" icon={Globe} desc="写实：太阳系模拟（八大行星）" component={LoadingCelestialOrrery} {...props} />;
export const GrandClockCard: React.FC<PreviewCardProps> = (props) => <LoadingVariantCard title="Grandmaster Clock" icon={Clock} desc="极致机械感：精密咬合齿轮组" component={LoadingSteampunkClock} {...props} />;

// ============================================================================
// 自动注册元数据
// ============================================================================

export const meta: EffectEntryMeta[] = [
  { id: 'arcane_qualified', label: '过审法阵', icon: CircleCheckBig, component: ArcaneQualifiedCard, group: 'loading' },
  { id: 'arcane_grandmaster', label: '究极法阵', icon: Star, component: ArcaneGrandmasterCard, group: 'loading' },
  { id: 'magic_cards', label: '魔术飞牌', icon: WandSparkles, component: MagicCardsCard, group: 'loading' },
  { id: 'solar_system', label: '太阳系 Pro', icon: Globe, component: OrreryCard, group: 'loading' },
  { id: 'grand_clock', label: '机械神域', icon: Clock, component: GrandClockCard, group: 'loading' },
];
