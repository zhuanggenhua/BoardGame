/**
 * 打击类特效预览卡片
 */

import React, { useState, useCallback, useRef } from 'react';
import { Bomb, Swords, Aperture, Hammer, Droplets } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShakeContainer, useShake } from '../../../components/common/animations/ShakeContainer';
import { HIT_STOP_PRESETS } from '../../../components/common/animations/HitStopContainer';
import { SlashEffect, useSlashEffect, SLASH_PRESETS, getSlashPresetByDamage } from '../../../components/common/animations/SlashEffect';
import { ImpactContainer } from '../../../components/common/animations/ImpactContainer';
import { DamageFlash } from '../../../components/common/animations/DamageFlash';
import { RiftSlash, useRiftSlash, RIFT_PRESETS } from '../../../components/common/animations/RiftSlash';
import {
  type PreviewCardProps, type EffectEntryMeta,
  EffectCard, TriggerButton, CardSprite, ToggleChip,
  usePerfCounter, useEffectTrigger,
} from './shared';

// ============================================================================
// 标签映射
// ============================================================================

const SLASH_LABELS: Record<string, string> = {
  light: '轻击', normal: '普通', heavy: '重击', critical: '暴击', ice: '冰霜', holy: '神圣',
};

const RIFT_LABELS: Record<string, string> = {
  light: '轻击', normal: '普通', heavy: '重击', critical: '暴击', ice: '冰霜', holy: '神圣', void: '虚空',
};

// ============================================================================
// 震动 + 钝帧
// ============================================================================

export const ShakeHitStopCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { isShaking, triggerShake } = useShake(500);
  const [lightActive, setLightActive] = useState(false);
  const [heavyActive, setHeavyActive] = useState(false);
  const [critActive, setCritActive] = useState(false);

  const triggerImpact = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(false);
    requestAnimationFrame(() => setter(true));
  }, []);

  return (
    <EffectCard title="震动 + 钝帧" icon={Bomb} iconColor={iconColor} desc="震动 + 帧冻结（rAF 暂停，冻在当前偏移）"
      buttons={<>
        <TriggerButton label="纯震动" onClick={triggerShake} />
        <TriggerButton label="震动+钝帧·轻" onClick={() => triggerImpact(setLightActive)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="震动+钝帧·重" onClick={() => triggerImpact(setHeavyActive)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="震动+钝帧·暴击" onClick={() => triggerImpact(setCritActive)} color="bg-rose-700 hover:bg-rose-600" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center gap-2 p-1">
        <ShakeContainer isShaking={isShaking} className="relative w-36 h-24 rounded flex items-center justify-center border border-slate-600/50">
          {useRealCards ? <CardSprite className="absolute inset-0 rounded" /> : <div className="absolute inset-0 bg-slate-700 rounded" />}
          <span className="relative text-[10px] text-slate-300 z-10">纯震动</span>
        </ShakeContainer>
        <div className="flex gap-1">
          <ImpactContainer isActive={lightActive} damage={1} effects={{ shake: true, hitStop: true }} hitStopConfig={HIT_STOP_PRESETS.light} onComplete={() => setLightActive(false)} className="relative w-16 h-12 rounded flex items-center justify-center border border-red-700/40">
            {useRealCards ? <CardSprite className="absolute inset-0 rounded opacity-60" /> : <div className="absolute inset-0 bg-red-900/50 rounded" />}
            <span className="relative text-[10px] text-red-300 z-10">轻</span>
          </ImpactContainer>
          <ImpactContainer isActive={heavyActive} damage={5} effects={{ shake: true, hitStop: true }} hitStopConfig={HIT_STOP_PRESETS.heavy} onComplete={() => setHeavyActive(false)} className="relative w-16 h-12 rounded flex items-center justify-center border border-red-700/40">
            {useRealCards ? <CardSprite className="absolute inset-0 rounded opacity-60" /> : <div className="absolute inset-0 bg-red-900/50 rounded" />}
            <span className="relative text-[10px] text-red-300 z-10">重</span>
          </ImpactContainer>
          <ImpactContainer isActive={critActive} damage={10} effects={{ shake: true, hitStop: true }} hitStopConfig={HIT_STOP_PRESETS.critical} onComplete={() => setCritActive(false)} className="relative w-16 h-12 rounded flex items-center justify-center border border-red-700/40">
            {useRealCards ? <CardSprite className="absolute inset-0 rounded opacity-60" /> : <div className="absolute inset-0 bg-red-900/50 rounded" />}
            <span className="relative text-[10px] text-red-300 z-10">暴击</span>
          </ImpactContainer>
        </div>
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 弧形刀光
// ============================================================================

export const SlashCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { isActive, triggerSlash } = useSlashEffect();
  const [currentPreset, setCurrentPreset] = useState('normal');
  const { stats, startMeasure } = usePerfCounter();

  const fire = useCallback((name: string) => {
    setCurrentPreset(name);
    triggerSlash(SLASH_PRESETS[name as keyof typeof SLASH_PRESETS]);
    const stop = startMeasure();
    setTimeout(stop, 600);
  }, [triggerSlash, startMeasure]);

  return (
    <EffectCard title="弧形刀光" icon={Swords} iconColor={iconColor} desc="Canvas 弧形刀光 + 火花" stats={stats}
      buttons={<>
        {Object.keys(SLASH_PRESETS).map(name => (
          <TriggerButton key={name} label={SLASH_LABELS[name] ?? name} onClick={() => fire(name)} color="bg-orange-700 hover:bg-orange-600" />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {useRealCards ? (
          <div className="relative w-36 h-24 rounded border border-slate-600/50">
            <CardSprite className="absolute inset-0 rounded" />
          </div>
        ) : (
          <span className="text-[10px] text-slate-600">受击区域</span>
        )}
      </div>
      <SlashEffect isActive={isActive} {...(SLASH_PRESETS[currentPreset as keyof typeof SLASH_PRESETS] ?? SLASH_PRESETS.normal)} />
    </EffectCard>
  );
};

// ============================================================================
// 次元裂隙
// ============================================================================

export const RiftSlashCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { isActive, triggerRift } = useRiftSlash();
  const [currentPreset, setCurrentPreset] = useState('normal');
  const { stats, startMeasure } = usePerfCounter();

  const fire = useCallback((name: string) => {
    setCurrentPreset(name);
    triggerRift(RIFT_PRESETS[name as keyof typeof RIFT_PRESETS]);
    const stop = startMeasure();
    setTimeout(stop, 600);
  }, [triggerRift, startMeasure]);

  return (
    <EffectCard title="次元裂隙" icon={Aperture} iconColor={iconColor} desc="Canvas 直线斜切 + 火花" stats={stats}
      buttons={<>
        {Object.keys(RIFT_PRESETS).map(name => (
          <TriggerButton key={name} label={RIFT_LABELS[name] ?? name} onClick={() => fire(name)} color="bg-violet-700 hover:bg-violet-600" />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {useRealCards ? (
          <div className="relative w-36 h-24 rounded border border-slate-600/50">
            <CardSprite className="absolute inset-0 rounded" />
          </div>
        ) : (
          <span className="text-[10px] text-slate-600">受击区域</span>
        )}
      </div>
      <RiftSlash isActive={isActive} {...(RIFT_PRESETS[currentPreset as keyof typeof RIFT_PRESETS] ?? RIFT_PRESETS.normal)} />
    </EffectCard>
  );
};

// ============================================================================
// 打击感组合（可自选）
// ============================================================================

export const ImpactCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const [damage, setDamage] = useState(5);
  const { stats, startMeasure } = usePerfCounter();
  const [useShakeEff, setUseShakeEff] = useState(true);
  const [useHitStopEff, setUseHitStopEff] = useState(false);
  const [slashType, setSlashType] = useState<'arc' | 'rift' | 'none'>('rift');
  const [useWhiteFlash, setUseWhiteFlash] = useState(false);
  const [useRedPulse, setUseRedPulse] = useState(true);
  const [showDmgNumber, setShowDmgNumber] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<number>(0);
  const { isActive: slashActive, triggerSlash } = useSlashEffect();

  const trigger = useCallback((dmg: number) => {
    setDamage(dmg);
    setIsActive(false);
    window.clearTimeout(timerRef.current);
    requestAnimationFrame(() => {
      setIsActive(true);
      if (slashType === 'arc') triggerSlash(getSlashPresetByDamage(dmg));
    });
    const stop = startMeasure();
    setTimeout(stop, 800);
  }, [startMeasure, slashType, triggerSlash]);

  const isStrong = damage >= 6;

  return (
    <EffectCard title="打击感组合" icon={Hammer} iconColor={iconColor} desc="震动+钝帧+DamageFlash" stats={stats}
      buttons={<>
        <TriggerButton label="轻击 (2)" onClick={() => trigger(2)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="普通 (5)" onClick={() => trigger(5)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="重击 (8)" onClick={() => trigger(8)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label="暴击 (12)" onClick={() => trigger(12)} color="bg-rose-700 hover:bg-rose-600" />
        <div className="flex flex-wrap gap-1">
          <ToggleChip label="震动" active={useShakeEff} onClick={() => setUseShakeEff(v => !v)} />
          <ToggleChip label="钝帧" active={useHitStopEff} onClick={() => setUseHitStopEff(v => !v)} />
          <ToggleChip label="弧刀" active={slashType === 'arc'} onClick={() => setSlashType(v => v === 'arc' ? 'none' : 'arc')} />
          <ToggleChip label="裂隙" active={slashType === 'rift'} onClick={() => setSlashType(v => v === 'rift' ? 'none' : 'rift')} />
          <ToggleChip label="白闪" active={useWhiteFlash} onClick={() => setUseWhiteFlash(v => !v)} />
          <ToggleChip label="红脉冲" active={useRedPulse} onClick={() => setUseRedPulse(v => !v)} />
          <ToggleChip label="数字" active={showDmgNumber} onClick={() => setShowDmgNumber(v => !v)} />
        </div>
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center" style={{ overflow: 'visible' }}>
        <ImpactContainer
          isActive={isActive} damage={damage}
          effects={{ shake: useShakeEff, hitStop: useHitStopEff }}
          hitStopConfig={useHitStopEff ? { duration: 300 } : undefined}
          onComplete={() => setIsActive(false)}
          className="relative w-36 h-24 rounded flex items-center justify-center border border-slate-600/50"
          style={{ overflow: 'visible' }}
        >
          {useRealCards ? <CardSprite className="absolute inset-0 rounded" /> : <div className="absolute inset-0 bg-slate-700 rounded" />}
          <span className="relative text-xs text-slate-400 z-10">{damage}</span>
          {isActive && (
            <DamageFlash active damage={damage} intensity={isStrong ? 'strong' : 'normal'} showSlash={slashType === 'rift'} showRedPulse={useRedPulse} showNumber={showDmgNumber} />
          )}
          {slashType === 'arc' && <SlashEffect isActive={slashActive} {...getSlashPresetByDamage(damage)} />}
          {useWhiteFlash && isActive && (
            <motion.div className="absolute inset-0 rounded bg-white/50 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0] }} transition={{ duration: 0.08 }} />
          )}
        </ImpactContainer>
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 受伤反馈
// ============================================================================

export const DamageFlashCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const [damage, setDamage] = useState(3);
  const [intensity, setIntensity] = useState<'normal' | 'strong'>('normal');
  const { active, fire, reset, stats } = useEffectTrigger(1000);

  const trigger = useCallback((dmg: number, int: 'normal' | 'strong') => {
    setDamage(dmg);
    setIntensity(int);
    fire();
  }, [fire]);

  return (
    <EffectCard title="受伤反馈" icon={Droplets} iconColor={iconColor} desc="ImpactContainer(震动) + DamageFlash(斜切+红脉冲+数字)" stats={stats}
      buttons={<>
        <TriggerButton label="轻伤 (1)" onClick={() => trigger(1, 'normal')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="中伤 (3)" onClick={() => trigger(3, 'normal')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="重伤 (5)" onClick={() => trigger(5, 'strong')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="致命 (10)" onClick={() => trigger(10, 'strong')} color="bg-red-700 hover:bg-red-600" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center" style={{ overflow: 'visible' }}>
        <ImpactContainer
          isActive={active} damage={damage}
          effects={{ shake: true, hitStop: false }}
          onComplete={reset}
          className="relative w-36 h-24 rounded flex items-center justify-center border border-slate-600/50"
          style={{ overflow: 'visible' }}
        >
          {useRealCards ? <CardSprite className="absolute inset-0 rounded" /> : <div className="absolute inset-0 bg-slate-700 rounded" />}
          {active && <DamageFlash active damage={damage} intensity={intensity} />}
        </ImpactContainer>
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 自动注册元数据
// ============================================================================

export const meta: EffectEntryMeta[] = [
  { id: 'shake', label: '震动+钝帧', icon: Bomb, component: ShakeHitStopCard, group: 'impact', usageDesc: '骰铸王座·受击震动 / 召唤师战争·棋格受击' },
  { id: 'slash', label: '弧形刀光', icon: Swords, component: SlashCard, group: 'impact', usageDesc: '暂未接入业务' },
  { id: 'rift', label: '次元裂隙', icon: Aperture, component: RiftSlashCard, group: 'impact', usageDesc: '受伤反馈·斜切视觉（DamageFlash 内部）' },
  { id: 'impactCombo', label: '打击感组合', icon: Hammer, component: ImpactCard, group: 'impact', usageDesc: '测试台·自由组合各效果' },
  { id: 'dmgflash', label: '受伤反馈', icon: Droplets, component: DamageFlashCard, group: 'impact', usageDesc: '召唤师战争·伤害反馈覆盖层' },
];
