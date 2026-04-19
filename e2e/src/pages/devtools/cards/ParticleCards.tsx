/**
 * 粒子类特效预览卡片
 */

import React, { useState, useCallback, useRef } from 'react';
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

const BURST_LABELS: Record<string, string> = {
  explosion: '爆炸', explosionStrong: '强力爆炸', summonGlow: '召唤光',
  summonGlowStrong: '强力召唤', smoke: '烟尘', sparks: '火花', magicDust: '魔法尘',
};

// ============================================================================
// 爆发粒子
// ============================================================================

export const BurstCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
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
    <EffectCard title="爆发粒子" icon={Sparkles} iconColor={iconColor} desc="Canvas 2D 粒子引擎" stats={stats}
      buttons={<>
        {Object.keys(BURST_PRESETS).map(name => (
          <TriggerButton key={name} label={BURST_LABELS[name] ?? name} onClick={() => trigger(name)} color="bg-purple-700 hover:bg-purple-600" />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {useRealCards ? (
          <div className="relative w-44 h-32 rounded border border-slate-600/50">
            <CardSprite className="absolute inset-0 rounded" />
          </div>
        ) : (
          <span className="text-[10px] text-slate-600">爆发区域</span>
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
    <EffectCard title="碎裂消散" icon={Skull} iconColor={iconColor} desc="卡图四分五裂飞散 + 重力下坠（单位死亡/卡牌销毁）" stats={stats}
      buttons={<>
        <TriggerButton label="普通死亡" onClick={() => trigger('normal')} color="bg-slate-600 hover:bg-slate-500" />
        <TriggerButton label="强力击杀" onClick={() => trigger('strong')} color="bg-red-700 hover:bg-red-600" />
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
    <EffectCard title="胜利彩带" icon={Trophy} iconColor={iconColor} desc="底部喷射彩色粒子" stats={stats}
      buttons={<TriggerButton label="触发" onClick={trigger} color="bg-yellow-600 hover:bg-yellow-500" />}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-slate-600">🎉</span>
      </div>
      <VictoryParticles active={active} />
    </EffectCard>
  );
};

// ============================================================================
// 召唤特效
// ============================================================================

export const SummonCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const [isStrong, setIsStrong] = useState(false);
  const { active, fire, reset, stats } = useEffectTrigger(2000);

  const trigger = useCallback((strong: boolean) => {
    setIsStrong(strong);
    fire();
  }, [fire]);

  return (
    <EffectCard title="召唤特效" icon={Wand2} iconColor={iconColor} desc="Canvas 2D 多阶段" stats={stats}
      buttons={<>
        <TriggerButton label="普通（蓝）" onClick={() => trigger(false)} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label="强力（金）" onClick={() => trigger(true)} color="bg-yellow-600 hover:bg-yellow-500" />
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
  const { stats, startMeasure } = usePerfCounter();
  const stopRef = useRef<(() => void) | null>(null);
  
  // 使用 FX 系统（完整反馈：视觉+音效+震动）
  const { shakeStyle, triggerShake } = useScreenShake();
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
      title="召唤混合特效（FX 系统）" 
      icon={Zap} 
      iconColor={iconColor} 
      desc="Shader + Canvas 2D 粒子 + 音效 + 震动（完整反馈预览）" 
      stats={stats}
      buttons={<>
        <TriggerButton label="蓝" onClick={() => trigger(false, 'blue')} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label="蓝强" onClick={() => trigger(true, 'blue')} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label="金" onClick={() => trigger(false, 'gold')} color="bg-yellow-600 hover:bg-yellow-500" />
        <TriggerButton label="金强" onClick={() => trigger(true, 'gold')} color="bg-yellow-600 hover:bg-yellow-500" />
      </>}
    >
      {/* 震动容器 */}
      <div className="absolute inset-0 overflow-hidden rounded-lg" style={shakeStyle}>
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
    <EffectCard title="充能旋涡" icon={RotateCw} iconColor={iconColor} desc="WebGL Shader" stats={stats}
      buttons={<>
        <TriggerButton label="蓝" onClick={() => trigger(false, 'blue')} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label="蓝强" onClick={() => trigger(true, 'blue')} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label="紫" onClick={() => trigger(false, 'purple')} color="bg-purple-700 hover:bg-purple-600" />
        <TriggerButton label="绿" onClick={() => trigger(false, 'green')} color="bg-emerald-700 hover:bg-emerald-600" />
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
  const { stats, startMeasure } = usePerfCounter();
  const stopRef = useRef<(() => void) | null>(null);
  
  // 使用 FX 系统（完整反馈：视觉+音效+震动）
  const { shakeStyle, triggerShake } = useScreenShake();
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
      title="攻击气浪（FX 系统）" 
      icon={Zap} 
      iconColor={iconColor} 
      desc="受击反馈 + 震动（完整反馈预览）" 
      stats={stats}
      buttons={<>
        <TriggerButton label="近战" onClick={() => trigger('melee', false)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="近战强" onClick={() => trigger('melee', true)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="远程" onClick={() => trigger('ranged', false)} color="bg-blue-700 hover:bg-blue-600" />
        <TriggerButton label="远程强" onClick={() => trigger('ranged', true)} color="bg-blue-700 hover:bg-blue-600" />
      </>}
    >
      <div className="absolute inset-0 overflow-hidden rounded-lg" style={shakeStyle}>
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
  { id: 'burst', label: '爆发粒子', icon: Sparkles, component: BurstCard, group: 'particle', usageDesc: '召唤师战争·单位被消灭' },
  { id: 'shatter', label: '碎裂消散', icon: Skull, component: ShatterCard, group: 'particle', usageDesc: '召唤师战争·单位/建筑死亡碎裂' },
  { id: 'victory', label: '胜利彩带', icon: Trophy, component: VictoryCard, group: 'particle', usageDesc: '通用·对局胜利结算' },
  { id: 'summon', label: '召唤特效', icon: Wand2, component: SummonCard, group: 'particle', usageDesc: '召唤师战争·召唤单位入场' },
  { id: 'summonShader', label: '召唤混合特效', icon: Zap, component: SummonShaderCard, group: 'particle', usageDesc: '召唤师战争·召唤单位入场（Shader + 粒子混合版）' },
  { id: 'vortex', label: '充能旋涡', icon: RotateCw, component: VortexCard, group: 'particle', usageDesc: '召唤师战争·单位充能' },
  { id: 'combatShockwave', label: '攻击气浪', icon: Zap, component: CombatShockwaveCard, group: 'particle', usageDesc: '召唤师战争·攻击受击反馈（FX 系统完整反馈）' },
];
