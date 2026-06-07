/**
 * UI 类特效预览卡片
 */

import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Sun, Waves } from 'lucide-react';
import { FloatingTextLayer, useFloatingText } from '../../../components/common/animations/FloatingText';
import { PulseGlow } from '../../../components/common/animations/PulseGlow';
import { AbilityReadyIndicator } from '../../../games/summonerwars/ui/AbilityReadyIndicator';
import {
  type PreviewCardProps, type EffectEntryMeta,
  EffectCard, TriggerButton, CardSprite,
  usePerfCounter,
} from './shared';

// ============================================================================
// 飘字
// ============================================================================

export const FloatingTextCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const { texts, pushText, removeText } = useFloatingText();
  const containerRef = useRef<HTMLDivElement>(null);
  const { stats, startMeasure } = usePerfCounter();

  const trigger = useCallback((type: 'damage' | 'heal', value: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pushText({ type, content: type === 'damage' ? `-${value}` : `+${value}`, position: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, intensity: value });
    const stop = startMeasure();
    setTimeout(stop, 900);
  }, [pushText, startMeasure]);

  return (
    <EffectCard
      title={t('devtools.effectPreview.ui.floating.title')}
      icon={MessageCircle}
      iconColor={iconColor}
      desc={t('devtools.effectPreview.ui.floating.description')}
      stats={stats}
      buttons={<>
        <TriggerButton label="-1" onClick={() => trigger('damage', 1)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="-5" onClick={() => trigger('damage', 5)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="-10" onClick={() => trigger('damage', 10)} color="bg-red-700 hover:bg-red-600" />
        <TriggerButton label="+3" onClick={() => trigger('heal', 3)} color="bg-emerald-700 hover:bg-emerald-600" />
        <TriggerButton label="+8" onClick={() => trigger('heal', 8)} color="bg-emerald-700 hover:bg-emerald-600" />
      </>}
    >
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] text-slate-600">{t('devtools.effectPreview.ui.floating.preview')}</span>
      </div>
      <FloatingTextLayer texts={texts} onComplete={removeText} />
    </EffectCard>
  );
};

// ============================================================================
// 脉冲发光
// ============================================================================

export const PulseGlowCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const [isGlowing, setIsGlowing] = React.useState(false);
  const [loop, setLoop] = React.useState(false);
  const [effect, setEffect] = React.useState<'glow' | 'ripple'>('glow');

  const triggerOnce = useCallback(() => {
    setLoop(false);
    setIsGlowing(false);
    requestAnimationFrame(() => setIsGlowing(true));
    setTimeout(() => setIsGlowing(false), 1200);
  }, []);

  return (
    <EffectCard
      title={t('devtools.effectPreview.ui.pulse_glow.title')}
      icon={Sun}
      iconColor={iconColor}
      desc={t('devtools.effectPreview.ui.pulse_glow.description')}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.ui.pulse_glow.buttons.glow')} onClick={() => { setEffect('glow'); triggerOnce(); }} color="bg-amber-700 hover:bg-amber-600" />
        <TriggerButton label={t('devtools.effectPreview.ui.pulse_glow.buttons.glow_loop')} onClick={() => { setEffect('glow'); setLoop(true); setIsGlowing(true); }} color="bg-amber-700 hover:bg-amber-600" />
        <TriggerButton label={t('devtools.effectPreview.ui.pulse_glow.buttons.ripple')} onClick={() => { setEffect('ripple'); triggerOnce(); }} color="bg-teal-700 hover:bg-teal-600" />
        <TriggerButton label={t('devtools.effectPreview.ui.pulse_glow.buttons.stop')} onClick={() => { setIsGlowing(false); setLoop(false); }} color="bg-slate-600 hover:bg-slate-500" />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <PulseGlow isGlowing={isGlowing} glowColor="rgba(251, 191, 36, 0.6)" loop={loop} effect={effect}
          className="w-14 h-14 rounded-xl bg-amber-900/40 border border-amber-600/50 flex items-center justify-center"
        >
          <span className="text-lg">⚡</span>
        </PulseGlow>
      </div>
    </EffectCard>
  );
};


// ============================================================================
// 技能就绪波纹
// ============================================================================

export const AbilityReadyCard: React.FC<PreviewCardProps> = ({ useRealCards, iconColor }) => {
  const { t } = useTranslation('lobby');
  const [visible, setVisible] = useState(true);
  const [showGreenRing, setShowGreenRing] = useState(true);

  return (
    <EffectCard
      title={t('devtools.effectPreview.ui.ability_ready.title')}
      icon={Waves}
      iconColor={iconColor}
      desc={t('devtools.effectPreview.ui.ability_ready.description')}
      buttons={<>
        <TriggerButton
          label={visible
            ? t('devtools.effectPreview.ui.ability_ready.buttons.hide_ripple')
            : t('devtools.effectPreview.ui.ability_ready.buttons.show_ripple')}
          onClick={() => setVisible(v => !v)}
          color="bg-cyan-700 hover:bg-cyan-600"
        />
        <TriggerButton
          label={showGreenRing
            ? t('devtools.effectPreview.ui.ability_ready.buttons.hide_ring')
            : t('devtools.effectPreview.ui.ability_ready.buttons.show_ring')}
          onClick={() => setShowGreenRing(v => !v)}
          color="bg-green-700 hover:bg-green-600"
        />
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* 只设宽度，高度由 aspect-ratio 自动撑开（与棋盘一致） */}
        <div className={`relative w-28 rounded-lg ${showGreenRing ? 'ring-2 ring-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : ''}`} style={{ aspectRatio: '1044 / 729' }}>
          {useRealCards ? (
            <CardSprite className="w-full h-full rounded-lg" />
          ) : (
            <div className="w-full h-full rounded-lg bg-slate-700/60 border border-slate-600/40 flex items-center justify-center">
              <span className="text-[10px] text-slate-500">{t('devtools.effectPreview.ui.ability_ready.preview')}</span>
            </div>
          )}
          {visible && <AbilityReadyIndicator />}
        </div>
      </div>
    </EffectCard>
  );
};

// ============================================================================
// 自动注册元数据
// ============================================================================

export const meta: EffectEntryMeta[] = [
  {
    id: 'floating',
    labelKey: 'devtools.effectPreview.entries.ui.floating.label',
    icon: MessageCircle,
    component: FloatingTextCard,
    group: 'ui',
    usageDescKey: 'devtools.effectPreview.entries.ui.floating.usage',
  },
  {
    id: 'pulseglow',
    labelKey: 'devtools.effectPreview.entries.ui.pulseglow.label',
    icon: Sun,
    component: PulseGlowCard,
    group: 'ui',
    usageDescKey: 'devtools.effectPreview.entries.ui.pulseglow.usage',
  },
  {
    id: 'abilityready',
    labelKey: 'devtools.effectPreview.entries.ui.abilityready.label',
    icon: Waves,
    component: AbilityReadyCard,
    group: 'ui',
    usageDescKey: 'devtools.effectPreview.entries.ui.abilityready.usage',
  },
];
