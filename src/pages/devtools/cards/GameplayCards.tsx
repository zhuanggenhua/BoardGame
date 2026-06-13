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
import { AbilityTriggeredRenderer } from '../../../games/smashup/ui/fxSetup';
import { initSmashUpCardAtlases } from '../../../games/smashup/ui/cardAtlas';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { FxEvent } from '../../../engine/fx';
import type { CardPreviewRef } from '../../../core';
import {
  type PreviewCardProps, type EffectEntryMeta,
  EffectCard, TriggerButton, ToggleChip,
  useEffectTrigger,
} from './shared';

const BREAKPOINT_LABEL_KEY = 'devtools.effectPreview.gameplay.shared.breakpoint';

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

/** 预设的触发器场景（含卡图引用和中文名，不依赖 i18n） */
const TRIGGER_SCENES = [
  {
    defId: 'trickster_leprechaun',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.trickster_leprechaun.label',
    descKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.trickster_leprechaun.description',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards4', index: 24 },
  },
  {
    defId: 'trickster_flame_trap',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.trickster_flame_trap.label',
    descKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.trickster_flame_trap.description',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards4', index: 31 },
  },
  {
    defId: 'ninja_assassination',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.ninja_assassination.label',
    descKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.ninja_assassination.description',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards1', index: 18 },
  },
  {
    defId: 'bear_cavalry_high_ground',
    labelKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.bear_cavalry_high_ground.label',
    descKey: 'devtools.effectPreview.gameplay.ability_triggered.scenes.bear_cavalry_high_ground.description',
    previewRef: { type: 'atlas' as const, atlasId: 'smashup:cards3', index: 22 },
  },
] as const;

/** 模拟基地场景中的随从卡槽 */
const FakeMinionSlot: React.FC<{
  label: string;
  power: number;
  color: string;
}> = ({ label, power, color }) => (
  <div className={`w-10 h-14 rounded border ${color} flex flex-col items-center justify-center text-[8px] shrink-0`}>
    <span className="font-bold text-white/90">{label}</span>
    <span className="text-amber-300 font-black text-[10px]">{power}</span>
  </div>
);

export const AbilityTriggeredCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  const { t } = useTranslation('lobby');
  const [activeKey, setActiveKey] = useState(0);
  const [presetIdx, setPresetIdx] = useState(0);
  const { stats, startMeasure } = useEffectTrigger(2000);
  const atlasInitRef = useRef(false);

  // 加载 game-smashup i18n 命名空间（AbilityTriggeredRenderer 内部依赖）
  useTranslation('game-smashup');

  // 初始化 SmashUp 卡牌图集（仅一次）
  useEffect(() => {
    if (!atlasInitRef.current) {
      atlasInitRef.current = true;
      initSmashUpCardAtlases();
    }
  }, []);

  const trigger = useCallback((idx?: number) => {
    if (idx !== undefined) setPresetIdx(idx);
    setActiveKey(0);
    requestAnimationFrame(() => {
      setActiveKey(k => k + 1);
      startMeasure();
    });
  }, [startMeasure]);

  const scene = TRIGGER_SCENES[presetIdx];

  // 构造 mock FxEvent
  const mockEvent: FxEvent = {
    id: `preview-${activeKey}`,
    cue: 'fx.ability-triggered',
    space: 'screen',
    params: {
      sourceDefId: scene.defId,
      position: undefined,
    },
  };

  return (
    <EffectCard
      title={t('devtools.effectPreview.gameplay.ability_triggered.title')}
      icon={Zap}
      iconColor={iconColor}
      desc={t('devtools.effectPreview.gameplay.ability_triggered.description')}
      stats={stats}
      buttons={<>
        {TRIGGER_SCENES.map((s, i) => (
          <TriggerButton
            key={s.defId}
            label={t(s.labelKey)}
            onClick={() => trigger(i)}
            color={i === presetIdx ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-600 hover:bg-slate-500'}
          />
        ))}
      </>}
    >
      <div className="absolute inset-0 flex items-center justify-center gap-4 p-3">
        {/* 左侧：触发源卡牌（带卡图） */}
        <div className="relative flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative w-24 h-[134px] rounded-lg overflow-hidden border-2 border-amber-500/60 shadow-lg bg-slate-800">
            <CardPreview
              previewRef={scene.previewRef as CardPreviewRef}
              locale="zh-CN"
              className="w-full h-full"
              title={t(scene.labelKey)}
            />
            {/* 触发标记 */}
            <AnimatePresence>
              {activeKey > 0 && (
                <motion.div
                  className="absolute top-1 right-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow flex items-center gap-0.5"
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 8 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                >
                  <Zap size={10} fill="currentColor" strokeWidth={1.5} />
                  {t('devtools.effectPreview.gameplay.ability_triggered.preview.trigger_badge')}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span className="text-[10px] text-amber-300 font-bold">{t(scene.labelKey)}</span>
          <span className="text-[8px] text-slate-500 text-center max-w-[100px]">{t(scene.descKey)}</span>
        </div>

        {/* 右侧：模拟基地场景 */}
        <div className="relative flex flex-col items-center gap-1.5">
          {/* 基地标题 */}
          <div className="text-[9px] text-slate-500 font-bold">{t('devtools.effectPreview.gameplay.ability_triggered.preview.base_title')}</div>
          {/* 随从区 */}
          <div className="flex gap-1.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <FakeMinionSlot label={t('devtools.effectPreview.gameplay.ability_triggered.preview.minions.brownie')} power={4} color="border-emerald-600/50 bg-emerald-900/30" />
            <FakeMinionSlot label={t('devtools.effectPreview.gameplay.ability_triggered.preview.minions.gnome')} power={3} color="border-blue-600/50 bg-blue-900/30" />
            <FakeMinionSlot label={t('devtools.effectPreview.gameplay.ability_triggered.preview.minions.imp')} power={2} color="border-purple-600/50 bg-purple-900/30" />
          </div>
          <span className="text-[8px] text-slate-600">{t('devtools.effectPreview.gameplay.ability_triggered.preview.minions_hint')}</span>
        </div>

        {/* ⚡ 触发动画浮层 */}
        {activeKey > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <AbilityTriggeredRenderer
              key={activeKey}
              event={mockEvent}
              getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
              onComplete={() => setActiveKey(0)}
              onImpact={() => {}}
            />
          </div>
        )}

        {/* 空闲提示 */}
        {activeKey === 0 && (
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <span className="text-[9px] text-slate-600">{t('devtools.effectPreview.gameplay.ability_triggered.preview.idle_hint')}</span>
          </div>
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
