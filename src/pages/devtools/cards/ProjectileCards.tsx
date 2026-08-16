/**
 * 投射类特效预览卡片
 */

import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, Swords, Wind } from 'lucide-react';
import {
  FlyingEffectsLayer,
  useFlyingEffects,
  type FlyingEffectData,
} from '../../../components/common/animations/FlyingEffect';
import { ConeBlast } from '../../../components/common/animations/ConeBlast';
import { BoardProjectileAttackPreset } from '../../../components/common/animations/BoardFxPresets';
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
// 棋盘投射攻击 preset（通用组件入口）
// ============================================================================

export const BoardProjectileAttackPresetCard: React.FC<PreviewCardProps> = ({ useRealCards = true, iconColor }) => {
  const { t } = useTranslation('lobby');
  const [intensity, setIntensity] = React.useState<'normal' | 'strong'>('normal');
  const { active, fire, reset, stats } = useEffectTrigger(4500);

  const getCellPosition = useCallback((row: number, col: number) => ({
    left: col === 0 ? 16 : 68,
    top: 40 + row * 0,
    width: 16,
    height: 20,
  }), []);

  const trigger = useCallback((nextIntensity: 'normal' | 'strong') => {
    setIntensity(nextIntensity);
    fire();
  }, [fire]);

  return (
    <EffectCard
      title={t('devtools.effectPreview.projectile.board_attack_preset.title')}
      icon={Swords}
      iconColor={iconColor}
      desc={t('devtools.effectPreview.projectile.board_attack_preset.description')}
      stats={stats}
      buttons={<>
        <TriggerButton label={t('devtools.effectPreview.projectile.board_attack_preset.buttons.normal')} onClick={() => trigger('normal')} color="bg-cyan-700 hover:bg-cyan-600" />
        <TriggerButton label={t('devtools.effectPreview.projectile.board_attack_preset.buttons.strong')} onClick={() => trigger('strong')} color="bg-rose-700 hover:bg-rose-600" />
      </>}
    >
      <div className="absolute inset-0 overflow-visible rounded-lg">
        {useRealCards ? (
          <>
            <div className="absolute left-[16%] top-[40%] h-[20%] w-[16%] rounded border border-cyan-400/40">
              <CardSprite className="absolute inset-0 rounded opacity-85" />
            </div>
            <div className="absolute left-[68%] top-[40%] h-[20%] w-[16%] rounded border border-rose-400/40">
              <CardSprite className="absolute inset-0 rounded opacity-85" />
            </div>
          </>
        ) : (
          <>
            <div className="absolute left-[24%] top-1/2 -translate-y-1/2 rounded-full border border-cyan-400/50 bg-cyan-500/20 px-2 py-1 text-[10px] text-cyan-200">
              {t('devtools.effectPreview.projectile.board_attack_preset.preview.source')}
            </div>
            <div className="absolute left-[76%] top-1/2 -translate-y-1/2 rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-1 text-[10px] text-rose-200">
              {t('devtools.effectPreview.projectile.board_attack_preset.preview.target')}
            </div>
          </>
        )}
        {active && (
          <BoardProjectileAttackPreset
            source={{ row: 0, col: 0 }}
            target={{ row: 0, col: 1 }}
            getCellPosition={getCellPosition}
            damage={intensity === 'strong' ? 6 : 3}
            intensity={intensity}
            hostTestId="fx-preview-board-projectile-attack"
            travelTestId="fx-preview-board-projectile-attack-travel"
            damageHostTestId="fx-preview-board-projectile-attack-damage-host"
            impactBurstTestId="fx-preview-board-projectile-attack-impact-burst"
            damageNumberTestId="fx-preview-board-projectile-attack-damage-number"
            onComplete={reset}
          />
        )}
      </div>
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
  {
    id: 'boardProjectileAttackPreset',
    labelKey: 'devtools.effectPreview.entries.projectile.boardProjectileAttackPreset.label',
    icon: Swords,
    component: BoardProjectileAttackPresetCard,
    group: 'projectile',
    usageDescKey: 'devtools.effectPreview.entries.projectile.boardProjectileAttackPreset.usage',
  },
];
