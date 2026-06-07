/**
 * 打击类特效预览卡片
 */

import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

const getSlashLabel = (t: (key: string) => string, name: string) => t(`devtools.effectPreview.impact.shared.labels.${name}`);
const getRiftLabel = (t: (key: string) => string, name: string) => t(`devtools.effectPreview.impact.shared.labels.${name}`);

// ============================================================================
// 震动 + 钝帧
// ============================================================================

export const ShakeHitStopCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { t } = useTranslation('lobby');
  const { isShaking, triggerShake } = useShake(500);
  const [lightActive, setLightActive] = useState(false);
  const [heavyActive, setHeavyActive] = useState(false);
  const [critActive, setCritActive] = useState(false);

  const triggerImpact = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(false);
    requestAnimationFrame(() => setter(true));
  }, []);

  return (
    <EffectCard title={t('devtools.effectPreview.impact.shake_hit_stop.title')} icon={Bomb} iconColor={iconColor} desc={t('devtools.effectPreview.impact.shake_hit_stop.description')}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.impact.shake_hit_stop.buttons.shake_only')} onClick={triggerShake} />
        <TriggerButton label={t('devtools.effectPreview.impact.shake_hit_stop.buttons.light')} onClick={() => triggerImpact(setLightActive)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label={t('devtools.effectPreview.impact.shake_hit_stop.buttons.heavy')} onClick={() => triggerImpact(setHeavyActive)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label={t('devtools.effectPreview.impact.shake_hit_stop.buttons.critical')} onClick={() => triggerImpact(setCritActive)} color="bg-rose-700 hover:bg-rose-600" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center gap-2 p-1">
        <ShakeContainer isShaking={isShaking} className="relative w-36 h-24 rounded flex items-center justify-center border border-slate-600/50">
          {useRealCards ? <CardSprite className="absolute inset-0 rounded" /> : <div className="absolute inset-0 bg-slate-700 rounded" />}
          <span className="relative text-[10px] text-slate-300 z-10">{t('devtools.effectPreview.impact.shake_hit_stop.preview.shake_only')}</span>
        </ShakeContainer>
        <div className="flex gap-1">
          <ImpactContainer isActive={lightActive} damage={1} effects={{ shake: true, hitStop: true }} hitStopConfig={HIT_STOP_PRESETS.light} onComplete={() => setLightActive(false)} className="relative w-16 h-12 rounded flex items-center justify-center border border-red-700/40">
            {useRealCards ? <CardSprite className="absolute inset-0 rounded opacity-60" /> : <div className="absolute inset-0 bg-red-900/50 rounded" />}
            <span className="relative text-[10px] text-red-300 z-10">{t('devtools.effectPreview.impact.shake_hit_stop.preview.light')}</span>
          </ImpactContainer>
          <ImpactContainer isActive={heavyActive} damage={5} effects={{ shake: true, hitStop: true }} hitStopConfig={HIT_STOP_PRESETS.heavy} onComplete={() => setHeavyActive(false)} className="relative w-16 h-12 rounded flex items-center justify-center border border-red-700/40">
            {useRealCards ? <CardSprite className="absolute inset-0 rounded opacity-60" /> : <div className="absolute inset-0 bg-red-900/50 rounded" />}
            <span className="relative text-[10px] text-red-300 z-10">{t('devtools.effectPreview.impact.shake_hit_stop.preview.heavy')}</span>
          </ImpactContainer>
          <ImpactContainer isActive={critActive} damage={10} effects={{ shake: true, hitStop: true }} hitStopConfig={HIT_STOP_PRESETS.critical} onComplete={() => setCritActive(false)} className="relative w-16 h-12 rounded flex items-center justify-center border border-red-700/40">
            {useRealCards ? <CardSprite className="absolute inset-0 rounded opacity-60" /> : <div className="absolute inset-0 bg-red-900/50 rounded" />}
            <span className="relative text-[10px] text-red-300 z-10">{t('devtools.effectPreview.impact.shake_hit_stop.preview.critical')}</span>
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
  const { t } = useTranslation('lobby');
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
    <EffectCard title={t('devtools.effectPreview.impact.slash.title')} icon={Swords} iconColor={iconColor} desc={t('devtools.effectPreview.impact.slash.description')} stats={stats}
      buttons={<>
        {Object.keys(SLASH_PRESETS).map(name => (
          <TriggerButton key={name} label={getSlashLabel(t, name)} onClick={() => fire(name)} color="bg-orange-700 hover:bg-orange-600" />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {useRealCards ? (
          <div className="relative w-36 h-24 rounded border border-slate-600/50">
            <CardSprite className="absolute inset-0 rounded" />
          </div>
        ) : (
          <span className="text-[10px] text-slate-600">{t('devtools.effectPreview.impact.slash.preview')}</span>
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
  const { t } = useTranslation('lobby');
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
    <EffectCard title={t('devtools.effectPreview.impact.rift.title')} icon={Aperture} iconColor={iconColor} desc={t('devtools.effectPreview.impact.rift.description')} stats={stats}
      buttons={<>
        {Object.keys(RIFT_PRESETS).map(name => (
          <TriggerButton key={name} label={getRiftLabel(t, name)} onClick={() => fire(name)} color="bg-violet-700 hover:bg-violet-600" />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {useRealCards ? (
          <div className="relative w-36 h-24 rounded border border-slate-600/50">
            <CardSprite className="absolute inset-0 rounded" />
          </div>
        ) : (
          <span className="text-[10px] text-slate-600">{t('devtools.effectPreview.impact.rift.preview')}</span>
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
  const { t } = useTranslation('lobby');
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
    <EffectCard title={t('devtools.effectPreview.impact.combo.title')} icon={Hammer} iconColor={iconColor} desc={t('devtools.effectPreview.impact.combo.description')} stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.impact.combo.buttons.light')} onClick={() => trigger(2)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label={t('devtools.effectPreview.impact.combo.buttons.normal')} onClick={() => trigger(5)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label={t('devtools.effectPreview.impact.combo.buttons.heavy')} onClick={() => trigger(8)} color="bg-rose-700 hover:bg-rose-600" />
        <TriggerButton label={t('devtools.effectPreview.impact.combo.buttons.critical')} onClick={() => trigger(12)} color="bg-rose-700 hover:bg-rose-600" />
        <div className="flex flex-wrap gap-1">
          <ToggleChip label={t('devtools.effectPreview.impact.combo.toggles.shake')} active={useShakeEff} onClick={() => setUseShakeEff(v => !v)} />
          <ToggleChip label={t('devtools.effectPreview.impact.combo.toggles.hit_stop')} active={useHitStopEff} onClick={() => setUseHitStopEff(v => !v)} />
          <ToggleChip label={t('devtools.effectPreview.impact.combo.toggles.arc_slash')} active={slashType === 'arc'} onClick={() => setSlashType(v => v === 'arc' ? 'none' : 'arc')} />
          <ToggleChip label={t('devtools.effectPreview.impact.combo.toggles.rift')} active={slashType === 'rift'} onClick={() => setSlashType(v => v === 'rift' ? 'none' : 'rift')} />
          <ToggleChip label={t('devtools.effectPreview.impact.combo.toggles.white_flash')} active={useWhiteFlash} onClick={() => setUseWhiteFlash(v => !v)} />
          <ToggleChip label={t('devtools.effectPreview.impact.combo.toggles.red_pulse')} active={useRedPulse} onClick={() => setUseRedPulse(v => !v)} />
          <ToggleChip label={t('devtools.effectPreview.impact.combo.toggles.number')} active={showDmgNumber} onClick={() => setShowDmgNumber(v => !v)} />
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
  const { t } = useTranslation('lobby');
  const [damage, setDamage] = useState(3);
  const [intensity, setIntensity] = useState<'normal' | 'strong'>('normal');
  const { active, fire, reset, stats } = useEffectTrigger(1000);

  const trigger = useCallback((dmg: number, int: 'normal' | 'strong') => {
    setDamage(dmg);
    setIntensity(int);
    fire();
  }, [fire]);

  return (
    <EffectCard title={t('devtools.effectPreview.impact.damage_flash.title')} icon={Droplets} iconColor={iconColor} desc={t('devtools.effectPreview.impact.damage_flash.description')} stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.impact.damage_flash.buttons.light')} onClick={() => trigger(1, 'normal')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label={t('devtools.effectPreview.impact.damage_flash.buttons.medium')} onClick={() => trigger(3, 'normal')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label={t('devtools.effectPreview.impact.damage_flash.buttons.heavy')} onClick={() => trigger(5, 'strong')} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label={t('devtools.effectPreview.impact.damage_flash.buttons.fatal')} onClick={() => trigger(10, 'strong')} color="bg-red-700 hover:bg-red-600" />
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
  { id: 'shake', labelKey: 'devtools.effectPreview.entries.impact.shake.label', icon: Bomb, component: ShakeHitStopCard, group: 'impact', usageDescKey: 'devtools.effectPreview.entries.impact.shake.usage' },
  { id: 'slash', labelKey: 'devtools.effectPreview.entries.impact.slash.label', icon: Swords, component: SlashCard, group: 'impact', usageDescKey: 'devtools.effectPreview.entries.impact.slash.usage' },
  { id: 'rift', labelKey: 'devtools.effectPreview.entries.impact.rift.label', icon: Aperture, component: RiftSlashCard, group: 'impact', usageDescKey: 'devtools.effectPreview.entries.impact.rift.usage' },
  { id: 'impactCombo', labelKey: 'devtools.effectPreview.entries.impact.impactCombo.label', icon: Hammer, component: ImpactCard, group: 'impact', usageDescKey: 'devtools.effectPreview.entries.impact.impactCombo.usage' },
  { id: 'dmgflash', labelKey: 'devtools.effectPreview.entries.impact.dmgflash.label', icon: Droplets, component: DamageFlashCard, group: 'impact', usageDescKey: 'devtools.effectPreview.entries.impact.dmgflash.usage' },
];
