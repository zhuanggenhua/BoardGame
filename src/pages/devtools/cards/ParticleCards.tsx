/**
 * 粒子类特效预览卡片
 */

import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Skull, Trophy, Wand2, Zap, RotateCw } from 'lucide-react';
import { BurstParticles, BURST_PRESETS } from '../../../components/common/animations/BurstParticles';
import { VictoryParticles } from '../../../components/common/animations/VictoryParticles';
import { SummonEffect } from '../../../components/common/animations/SummonEffect';
import { VortexShaderEffect } from '../../../components/common/animations/VortexShaderEffect';
import { ShatterEffect } from '../../../components/common/animations/ShatterEffect';
import { useScreenShake } from '../../../games/summonerwars/ui/BoardEffects';
import { getOptimizedImageUrls, getLocalizedAssetPath } from '../../../core/AssetLoader';
import { getSpriteAtlasStyle, CARDS_ATLAS } from '../../../games/summonerwars/ui/cardAtlas';
import { useFxBus, FxLayer } from '../../../engine/fx';
import { summonerWarsFxRegistry, SW_FX } from '../../../games/summonerwars/ui/fxSetup';
import { playSound } from '../../../lib/audio/useGameAudio';
import {
  type PreviewCardProps, type EffectEntryMeta,
  EffectCard, TriggerButton, CardSprite,
  useEffectTrigger, usePerfCounter,
} from './shared';

// ============================================================================
// 标签映射
// ============================================================================

const getBurstLabel = (t: (key: string) => string, name: string) => t(`devtools.effectPreview.particle.shared.labels.${name}`);

// ============================================================================
// 爆发粒子
// ============================================================================

export const BurstCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { t } = useTranslation('lobby');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const timerRef = useRef<number>(0);
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((preset: string) => {
    setActivePreset(null);
    window.clearTimeout(timerRef.current);
    requestAnimationFrame(() => setActivePreset(preset));
    timerRef.current = window.setTimeout(() => setActivePreset(null), 2000);
    const stop = startMeasure();
    setTimeout(stop, 1500);
  }, [startMeasure]);

  return (
    <EffectCard title={t('devtools.effectPreview.particle.burst.title')} icon={Sparkles} iconColor={iconColor} desc={t('devtools.effectPreview.particle.burst.description')} stats={stats}
      buttons={<>
        {Object.keys(BURST_PRESETS).map(name => (
          <TriggerButton key={name} label={getBurstLabel(t, name)} onClick={() => trigger(name)} color="bg-purple-700 hover:bg-purple-600" />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {useRealCards ? (
          <div className="relative w-44 h-32 rounded border border-slate-600/50">
            <CardSprite className="absolute inset-0 rounded" />
          </div>
        ) : (
          <span className="text-[10px] text-slate-600">{t('devtools.effectPreview.particle.burst.preview')}</span>
        )}
      </div>
      {activePreset && (
        <BurstParticles
          active preset={activePreset as keyof typeof BURST_PRESETS}
          color={
            activePreset.includes('summon') ? ['#a78bfa', '#c084fc', '#e9d5ff'] :
              activePreset === 'sparks' ? ['#fbbf24', '#f59e0b', '#fef3c7', '#fff'] :
                activePreset === 'magicDust' ? ['#34d399', '#6ee7b7', '#a7f3d0', '#fff'] :
                  activePreset === 'smoke' ? ['#94a3b8', '#64748b', '#475569', '#cbd5e1'] :
                    undefined
          }
          onComplete={() => setActivePreset(null)}
        />
      )}
    </EffectCard>
  );
};

// ============================================================================
// 碎裂消散
// ============================================================================

export const ShatterCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const [hidden, setHidden] = useState(false);
  const [intensity, setIntensity] = useState<'normal' | 'strong'>('normal');
  const { active, fire, reset, stats } = useEffectTrigger(2000);

  const trigger = useCallback((int: 'normal' | 'strong') => {
    setIntensity(int);
    setHidden(false);
    fire();
  }, [fire]);

  const spriteUrls = getOptimizedImageUrls(getLocalizedAssetPath('summonerwars/hero/Frost/cards', 'zh-CN'));
  const spriteStyle = getSpriteAtlasStyle(0, CARDS_ATLAS);

  return (
    <EffectCard title={t('devtools.effectPreview.particle.shatter.title')} icon={Skull} iconColor={iconColor} desc={t('devtools.effectPreview.particle.shatter.description')} stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.particle.shatter.buttons.normal')} onClick={() => trigger('normal')} color="bg-slate-600 hover:bg-slate-500" />
        <TriggerButton label={t('devtools.effectPreview.particle.shatter.buttons.strong')} onClick={() => trigger('strong')} color="bg-red-700 hover:bg-red-600" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-44 h-32 rounded overflow-visible">
          <div
            data-shatter-target
            className="absolute inset-0 rounded border border-slate-600/50"
            style={{
              backgroundImage: `url(${spriteUrls.webp})`,
              backgroundRepeat: 'no-repeat',
              ...spriteStyle,
              visibility: hidden ? 'hidden' : 'visible',
            }}
          />
          {active && (
            <ShatterEffect
              active
              intensity={intensity}
              onStart={() => setHidden(true)}
              onComplete={() => { reset(); setHidden(false); }}
            />
          )}
        </div>
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 胜利彩带
// ============================================================================

export const VictoryCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const [active, setActive] = useState(false);
  const timerRef = useRef<number>(0);
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback(() => {
    setActive(false);
    window.clearTimeout(timerRef.current);
    requestAnimationFrame(() => setActive(true));
    timerRef.current = window.setTimeout(() => setActive(false), 3500);
    const stop = startMeasure();
    setTimeout(stop, 3500);
  }, [startMeasure]);

  return (
    <EffectCard title={t('devtools.effectPreview.particle.victory.title')} icon={Trophy} iconColor={iconColor} desc={t('devtools.effectPreview.particle.victory.description')} stats={stats}
      buttons={<TriggerButton label={t('devtools.effectPreview.particle.victory.buttons.trigger')} onClick={trigger} color="bg-yellow-600 hover:bg-yellow-500" />}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-slate-600">{t('devtools.effectPreview.particle.victory.preview')}</span>
      </div>
      <VictoryParticles active={active} />
    </EffectCard>
  );
};

// ============================================================================
// 召唤特效
// ============================================================================

export const SummonCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { t } = useTranslation('lobby');
  const [isStrong, setIsStrong] = useState(false);
  const { active, fire, reset, stats } = useEffectTrigger(2000);

  const trigger = useCallback((strong: boolean) => {
    setIsStrong(strong);
    fire();
  }, [fire]);

  return (
    <EffectCard title={t('devtools.effectPreview.particle.summon.title')} icon={Wand2} iconColor={iconColor} desc={t('devtools.effectPreview.particle.summon.description')} stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.particle.summon.buttons.normal')} onClick={() => trigger(false)} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.summon.buttons.strong')} onClick={() => trigger(true)} color="bg-yellow-600 hover:bg-yellow-500" />
      </>}
    >
      <div className="absolute inset-0">
        {useRealCards && (
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/3 w-44 h-32 rounded border border-slate-600/30">
            <CardSprite className="absolute inset-0 rounded" />
          </div>
        )}
        {active && (
          <SummonEffect active intensity={isStrong ? 'strong' : 'normal'} color={isStrong ? 'gold' : 'blue'} onComplete={reset} />
        )}
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 召唤混合特效（使用 FX 系统预览完整反馈）
// ============================================================================

export const SummonShaderCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const { stats, startMeasure } = usePerfCounter();
  const stopRef = useRef<(() => void) | null>(null);
  
  // 使用 FX 系统（完整反馈：视觉+音效+震动）
  const { shakeTargetRef, triggerShake } = useScreenShake();
  const fxBus = useFxBus(summonerWarsFxRegistry, {
    playSound,
    triggerShake,
  });

  // 模拟格子定位（预览页面固定位置）
  // 返回格子的左上角坐标和尺寸（百分比）
  const getCellPosition = useCallback(() => ({
    left: 40,  // 格子左边缘（居中 - 宽度/2）
    top: 40,   // 格子上边缘（居中 - 高度/2）
    width: 20,
    height: 20,
  }), []);

  const trigger = useCallback((strong: boolean, clr: 'blue' | 'gold') => {
    stopRef.current?.();
    
    // 通过 FX 系统触发（自动播放音效+震动）
    const intensity = strong ? 'strong' : 'normal';
    fxBus.push(SW_FX.SUMMON, { 
      cell: { row: 0, col: 0 }, 
      intensity 
    }, { 
      color: clr 
    });
    
    stopRef.current = startMeasure();
    setTimeout(() => {
      stopRef.current?.();
      stopRef.current = null;
    }, 2000);
  }, [fxBus, startMeasure]);

  return (
    <EffectCard 
      title={t('devtools.effectPreview.particle.summon_shader.title')}
      icon={Zap} 
      iconColor={iconColor} 
      desc={t('devtools.effectPreview.particle.summon_shader.description')}
      stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.particle.summon_shader.buttons.blue')} onClick={() => trigger(false, 'blue')} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.summon_shader.buttons.blue_strong')} onClick={() => trigger(true, 'blue')} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.summon_shader.buttons.gold')} onClick={() => trigger(false, 'gold')} color="bg-yellow-600 hover:bg-yellow-500" />
        <TriggerButton label={t('devtools.effectPreview.particle.summon_shader.buttons.gold_strong')} onClick={() => trigger(true, 'gold')} color="bg-yellow-600 hover:bg-yellow-500" />
      </>}
    >
      {/* 震动容器 */}
      <div ref={shakeTargetRef} className="absolute inset-0 overflow-hidden rounded-lg">
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/3 w-44 h-32 rounded border border-slate-600/30">
          <CardSprite className="absolute inset-0 rounded" />
        </div>
        {/* FX 渲染层 */}
        <FxLayer bus={fxBus} getCellPosition={getCellPosition} />
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 充能旋涡（WebGL Shader）
// ============================================================================

export const VortexCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { t } = useTranslation('lobby');
  const [active, setActive] = useState(false);
  const [isStrong, setIsStrong] = useState(false);
  const [colorTheme, setColorTheme] = useState<'blue' | 'purple' | 'green'>('blue');
  const { stats, startMeasure } = usePerfCounter();
  const stopRef = useRef<(() => void) | null>(null);

  const trigger = useCallback((strong: boolean, clr: 'blue' | 'purple' | 'green') => {
    setIsStrong(strong);
    setColorTheme(clr);
    setActive(false);
    stopRef.current?.();
    requestAnimationFrame(() => {
      setActive(true);
      stopRef.current = startMeasure();
    });
  }, [startMeasure]);

  const handleComplete = useCallback(() => {
    setActive(false);
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  return (
    <EffectCard title={t('devtools.effectPreview.particle.vortex.title')} icon={RotateCw} iconColor={iconColor} desc={t('devtools.effectPreview.particle.vortex.description')} stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.particle.vortex.buttons.blue')} onClick={() => trigger(false, 'blue')} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.vortex.buttons.blue_strong')} onClick={() => trigger(true, 'blue')} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.vortex.buttons.purple')} onClick={() => trigger(false, 'purple')} color="bg-purple-700 hover:bg-purple-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.vortex.buttons.green')} onClick={() => trigger(false, 'green')} color="bg-emerald-700 hover:bg-emerald-600" />
      </>}
    >
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        {useRealCards && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-32 rounded border border-slate-600/30">
            <CardSprite className="absolute inset-0 rounded" />
          </div>
        )}
        {active && (
          <VortexShaderEffect
            active
            intensity={isStrong ? 'strong' : 'normal'}
            color={colorTheme}
            onComplete={handleComplete}
          />
        )}
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 攻击气浪（使用 FX 系统预览完整反馈）
// ============================================================================

export const CombatShockwaveCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const { stats, startMeasure } = usePerfCounter();
  const stopRef = useRef<(() => void) | null>(null);
  
  // 使用 FX 系统（完整反馈：视觉+音效+震动）
  const { shakeTargetRef, triggerShake } = useScreenShake();
  const fxBus = useFxBus(summonerWarsFxRegistry, {
    playSound,
    triggerShake,
  });

  // 模拟格子定位（返回格子的左上角坐标和尺寸）
  const getCellPosition = useCallback(() => ({
    left: 40,  // 格子左边缘（居中 - 宽度/2）
    top: 40,   // 格子上边缘（居中 - 高度/2）
    width: 20,
    height: 20,
  }), []);

  const trigger = useCallback((attackType: 'melee' | 'ranged', strong: boolean) => {
    stopRef.current?.();
    
    const intensity = strong ? 'strong' : 'normal';
    // 通过 FX 系统触发（自动播放音效+震动）
    // 预览模式：音效使用 fallbackKey（近战音效）
    fxBus.push(SW_FX.COMBAT_SHOCKWAVE, { 
      cell: { row: 0, col: 0 }, 
      intensity 
    }, { 
      attackType,
      source: { row: 0, col: 0 },
      // 预览模式不需要 eventId，FX 系统会自动使用 fallbackKey
    });
    
    stopRef.current = startMeasure();
    setTimeout(() => {
      stopRef.current?.();
      stopRef.current = null;
    }, 1500);
  }, [fxBus, startMeasure]);

  return (
    <EffectCard 
      title={t('devtools.effectPreview.particle.combat_shockwave.title')}
      icon={Zap} 
      iconColor={iconColor} 
      desc={t('devtools.effectPreview.particle.combat_shockwave.description')}
      stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.particle.combat_shockwave.buttons.melee')} onClick={() => trigger('melee', false)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.combat_shockwave.buttons.melee_strong')} onClick={() => trigger('melee', true)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.combat_shockwave.buttons.ranged')} onClick={() => trigger('ranged', false)} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label={t('devtools.effectPreview.particle.combat_shockwave.buttons.ranged_strong')} onClick={() => trigger('ranged', true)} color="bg-blue-700 hover:bg-blue-600" />
      </>}
    >
      <div ref={shakeTargetRef} className="absolute inset-0 overflow-hidden rounded-lg">
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/3 w-44 h-32 rounded border border-slate-600/30">
          <CardSprite className="absolute inset-0 rounded" />
        </div>
        <FxLayer bus={fxBus} getCellPosition={getCellPosition} />
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 自动注册元数据
// ============================================================================

export const meta: EffectEntryMeta[] = [
  { id: 'burst', labelKey: 'devtools.effectPreview.entries.particle.burst.label', icon: Sparkles, component: BurstCard, group: 'particle', usageDescKey: 'devtools.effectPreview.entries.particle.burst.usage' },
  { id: 'shatter', labelKey: 'devtools.effectPreview.entries.particle.shatter.label', icon: Skull, component: ShatterCard, group: 'particle', usageDescKey: 'devtools.effectPreview.entries.particle.shatter.usage' },
  { id: 'victory', labelKey: 'devtools.effectPreview.entries.particle.victory.label', icon: Trophy, component: VictoryCard, group: 'particle', usageDescKey: 'devtools.effectPreview.entries.particle.victory.usage' },
  { id: 'summon', labelKey: 'devtools.effectPreview.entries.particle.summon.label', icon: Wand2, component: SummonCard, group: 'particle', usageDescKey: 'devtools.effectPreview.entries.particle.summon.usage' },
  { id: 'summonShader', labelKey: 'devtools.effectPreview.entries.particle.summonShader.label', icon: Zap, component: SummonShaderCard, group: 'particle', usageDescKey: 'devtools.effectPreview.entries.particle.summonShader.usage' },
  { id: 'vortex', labelKey: 'devtools.effectPreview.entries.particle.vortex.label', icon: RotateCw, component: VortexCard, group: 'particle', usageDescKey: 'devtools.effectPreview.entries.particle.vortex.usage' },
  { id: 'combatShockwave', labelKey: 'devtools.effectPreview.entries.particle.combatShockwave.label', icon: Zap, component: CombatShockwaveCard, group: 'particle', usageDescKey: 'devtools.effectPreview.entries.particle.combatShockwave.usage' },
];
