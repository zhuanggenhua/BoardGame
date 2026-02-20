/**
 * 大杀四方 — FX 注册表配置
 *
 * 职责：
 * 1. 定义游戏专属的 cue 常量
 * 2. 将底层动画组件包装为 FxRenderer
 * 3. 创建并注册 FxRegistry 单例
 *
 * SmashUp 特效全部使用 screen 空间定位（无棋盘格），
 * 通过 event.params 传入屏幕坐标或 DOM 位置信息。
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FxRegistry, type FxRendererProps, type FeedbackPack } from '../../../engine/fx';
import { getCardDef, resolveCardName, resolveCardText } from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { UI_Z_INDEX } from '../../../core';
import { Zap } from 'lucide-react';
import i18next from 'i18next';

// ============================================================================
// Cue 常量
// ============================================================================

/** 大杀四方 FX Cue 常量 */
export const SU_FX = {
  /** 力量变化浮字 */
  POWER_CHANGE: 'fx.power-change',
  /** 行动卡打出展示 */
  ACTION_SHOW: 'fx.action-show',
  /** 基地记分 VP 飞行 */
  BASE_SCORED: 'fx.base-scored',
  /** 持续效果/触发器激活 */
  ABILITY_TRIGGERED: 'fx.ability-triggered',
} as const;

// ============================================================================
// 稳定回调 hook
// ============================================================================

function useStableComplete(onComplete: () => void): () => void {
  const ref = useRef(onComplete);
  useEffect(() => { ref.current = onComplete; }, [onComplete]);
  return useCallback(() => ref.current(), []);
}

// ============================================================================
// 渲染器：力量变化浮字
// ============================================================================

/**
 * params:
 * - delta: number — 力量变化值
 * - position: { left: number; top: number } — 屏幕像素坐标
 */
const PowerChangeRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const delta = event.params?.delta as number | undefined;
  const position = event.params?.position as { left: number; top: number } | undefined;

  // 立即触发 impact（即时反馈）
  const impactFired = useRef(false);
  useEffect(() => {
    if (!impactFired.current) {
      impactFired.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(stableComplete, 900);
    return () => clearTimeout(timer);
  }, [stableComplete]);

  if (!delta || !position) { stableComplete(); return null; }

  return React.createElement(motion.div, {
    initial: { opacity: 1, y: 0, scale: 0.8, rotate: -5 },
    animate: { opacity: 0, y: -40, scale: 1.2, rotate: 5 },
    transition: { duration: 0.8, ease: 'easeOut' },
    className: 'fixed pointer-events-none select-none',
    style: { left: position.left, top: position.top, zIndex: UI_Z_INDEX.overlayRaised, fontFamily: "'Caveat', 'Comic Sans MS', cursive" },
  },
    React.createElement('span', {
      className: `text-[1.8vw] font-black drop-shadow-md ${delta > 0 ? 'text-green-400' : 'text-red-400'}`,
    }, delta > 0 ? `+${delta}` : `${delta}`),
  );
};

// ============================================================================
// 渲染器：行动卡展示浮层
// ============================================================================

/**
 * params:
 * - defId: string — 卡牌定义 ID
 */
const ActionShowRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const defId = event.params?.defId as string | undefined;

  const impactFired = useRef(false);
  useEffect(() => {
    if (!impactFired.current) {
      impactFired.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(stableComplete, 800);
    return () => clearTimeout(timer);
  }, [stableComplete]);

  if (!defId) { stableComplete(); return null; }

  const t = i18next.getFixedT(null, 'game-smashup');
  const def = getCardDef(defId);
  const resolvedName = resolveCardName(def, t) || defId;
  const resolvedText = resolveCardText(def, t);

  return React.createElement(motion.div, {
    className: 'fixed inset-0 flex items-center justify-center pointer-events-none',
    style: { zIndex: UI_Z_INDEX.overlayRaised },
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  },
    // 半透明背景
    React.createElement(motion.div, { className: 'absolute inset-0 bg-black/30' }),
    // 卡牌
    React.createElement(motion.div, {
      className: 'relative w-[18vw] aspect-[0.714] bg-white rounded-lg shadow-2xl border-2 border-slate-300 overflow-hidden',
      initial: { scale: 0.3, y: 200, rotate: -10 },
      animate: { scale: 1, y: 0, rotate: 2 },
      exit: { scale: 0.2, y: -100, x: 300, rotate: 15, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } },
      transition: { type: 'spring', stiffness: 400, damping: 25 },
    },
      React.createElement(CardPreview, {
        previewRef: def?.previewRef,
        className: 'w-full h-full object-cover',
        title: resolvedName,
      }),
      !def?.previewRef && React.createElement('div', {
        className: 'absolute inset-0 flex flex-col items-center justify-center p-4 bg-[#f3f0e8]',
      },
        React.createElement('div', { className: 'text-[1.2vw] font-black uppercase text-slate-800 mb-2' }, resolvedName),
        React.createElement('div', { className: 'text-[0.7vw] text-slate-600 text-center font-mono' }, resolvedText),
      ),
      // "PLAYED!" 标签
      React.createElement(motion.div, {
        className: 'absolute top-2 right-2 bg-red-500 text-white text-[0.7vw] font-black px-2 py-0.5 rounded shadow-md',
        initial: { scale: 0, rotate: -20 },
        animate: { scale: 1, rotate: 12 },
        transition: { delay: 0.15, type: 'spring', stiffness: 500 },
        style: { transformOrigin: 'center' },
      }, t('ui.played')),
    ),
  );
};

// ============================================================================
// 渲染器：基地记分 VP 飞行
// ============================================================================

/**
 * params:
 * - rankings: Array<{ playerId: string; power: number; vp: number }>
 */
const BaseScoredRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const rankings = event.params?.rankings as Array<{ playerId: string; power: number; vp: number }> | undefined;

  const impactFired = useRef(false);
  useEffect(() => {
    if (!impactFired.current) {
      impactFired.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(stableComplete, 2500);
    return () => clearTimeout(timer);
  }, [stableComplete]);

  if (!rankings || rankings.length === 0) { stableComplete(); return null; }

  const t = i18next.getFixedT(null, 'game-smashup');
  const validRankings = rankings.filter(r => r.vp > 0);
  if (validRankings.length === 0) { stableComplete(); return null; }

  // 使用 motion.div 作为根元素（与其他渲染器一致），确保 AnimatePresence 能正确追踪
  return React.createElement(motion.div, {
    className: 'fixed inset-0 pointer-events-none',
    style: { zIndex: UI_Z_INDEX.overlayRaised },
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
    ...validRankings.map((r, i) => {
      const startY = 30 + i * 20;
      return React.createElement(motion.div, {
        key: `${event.id}-${r.playerId}`,
        className: 'absolute pointer-events-none select-none',
        style: { left: '50%', top: `${startY}%` },
        initial: { opacity: 1, scale: 1.5, x: '-50%' },
        animate: { opacity: 0, scale: 0.8, y: -80, x: '-50%' },
        transition: { duration: 2, ease: 'easeOut', delay: i * 0.3 },
      },
        React.createElement('div', {
          className: 'flex items-center gap-2 bg-yellow-400/90 text-slate-900 px-3 py-1.5 rounded-full shadow-xl border-2 border-yellow-600',
        },
          React.createElement('span', { className: 'text-[1.5vw] font-black' }, t('ui.vp_award', { vp: r.vp })),
          React.createElement('span', { className: 'text-[0.8vw] font-bold opacity-70' }, t('ui.player_short', { id: r.playerId })),
        ),
      );
    }),
  );
};

// ============================================================================
// 渲染器：持续效果/触发器激活
// ============================================================================

/**
 * params:
 * - sourceDefId: string — 触发源卡牌 defId
 * - position: { left: number; top: number } | undefined — 屏幕坐标（可选）
 */
/** 持续效果/触发器激活渲染器（导出供特效预览使用） */
export const AbilityTriggeredRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const sourceDefId = event.params?.sourceDefId as string | undefined;
  const position = event.params?.position as { left: number; top: number } | undefined;

  const impactFired = useRef(false);
  useEffect(() => {
    if (!impactFired.current) {
      impactFired.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(stableComplete, 1600);
    return () => clearTimeout(timer);
  }, [stableComplete]);

  if (!sourceDefId) { stableComplete(); return null; }

  const t = i18next.getFixedT(null, 'game-smashup');
  const def = getCardDef(sourceDefId);
  const resolvedName = resolveCardName(def, t) || sourceDefId;

  // 默认位置：屏幕中上方
  const pos = position ?? { left: window.innerWidth / 2, top: window.innerHeight * 0.25 };

  return React.createElement(motion.div, {
    className: 'fixed pointer-events-none select-none flex flex-col items-center gap-1',
    style: {
      left: pos.left,
      top: pos.top,
      transform: 'translate(-50%, -50%)',
      zIndex: UI_Z_INDEX.overlayRaised,
    },
    initial: { opacity: 0, scale: 0.3, y: 10 },
    animate: { opacity: [0, 1, 1, 0], scale: [0.3, 1.1, 1, 0.8], y: [10, 0, 0, -40] },
    transition: { duration: 1.5, times: [0, 0.15, 0.6, 1], ease: 'easeOut' },
  },
    // 闪光脉冲背景
    React.createElement(motion.div, {
      className: 'absolute rounded-full',
      style: {
        background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0) 70%)',
        width: '12vw',
        height: '12vw',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      },
      initial: { scale: 0.3, opacity: 0 },
      animate: { scale: [0.3, 1.8, 0], opacity: [0, 0.7, 0] },
      transition: { duration: 1.0, ease: 'easeOut' },
    }),
    // 触发图标（SVG）
    React.createElement(motion.div, {
      className: 'drop-shadow-lg text-amber-400',
      style: { width: '2.5vw', height: '2.5vw' },
      initial: { scale: 0, rotate: -30 },
      animate: { scale: [0, 1.4, 1], rotate: [-30, 10, 0] },
      transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
    }, React.createElement(Zap, { className: 'w-full h-full', fill: 'currentColor', strokeWidth: 1.5 })),
    // 卡牌名 + "触发！"标签
    React.createElement(motion.div, {
      className: 'bg-amber-900/90 text-amber-100 px-3 py-1.5 rounded-md shadow-lg border border-amber-600/50 whitespace-nowrap flex items-center gap-2',
      style: { fontFamily: "'Caveat', 'Comic Sans MS', cursive" },
      initial: { opacity: 0, y: 8, scale: 0.8 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { delay: 0.12, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
    },
      React.createElement('span', {
        className: 'text-[1.1vw] font-black tracking-wide',
      }, resolvedName),
      React.createElement('span', {
        className: 'text-[0.7vw] font-bold text-amber-400 bg-amber-800/60 px-1.5 py-0.5 rounded',
      }, t('ui.triggered')),
    ),
  );
};

// ============================================================================
// 音效 key 常量
// ============================================================================

const POWER_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const ACTION_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const TALENT_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001';

// ============================================================================
// 反馈包
// ============================================================================

/** 力量变化：即时播放音效 */
const POWER_CHANGE_FEEDBACK: FeedbackPack = {
  sound: { key: POWER_GAIN_KEY, timing: 'immediate' },
};

/** 行动卡展示：即时播放音效 */
const ACTION_SHOW_FEEDBACK: FeedbackPack = {
  sound: { key: ACTION_PLAY_KEY, timing: 'immediate' },
};

/** 基地记分：impact 时播放得分音效 */
const BASE_SCORED_FEEDBACK: FeedbackPack = {
  sound: { key: 'ui.general.mini_games_sound_effects_and_music_pack.success.sfx_success_point_medium', timing: 'on-impact' },
};

/** 触发器激活：即时播放音效 */
const ABILITY_TRIGGERED_FEEDBACK: FeedbackPack = {
  sound: { key: TALENT_KEY, timing: 'immediate' },
};

// ============================================================================
// 注册表工厂
// ============================================================================

/** 创建大杀四方 FX 注册表（模块级单例） */
function createRegistry(): FxRegistry {
  const registry = new FxRegistry();

  registry.register(SU_FX.POWER_CHANGE, PowerChangeRenderer, {
    timeoutMs: 2000,
  }, POWER_CHANGE_FEEDBACK);

  registry.register(SU_FX.ACTION_SHOW, ActionShowRenderer, {
    timeoutMs: 2000,
    maxConcurrent: 1,
  }, ACTION_SHOW_FEEDBACK);

  registry.register(SU_FX.BASE_SCORED, BaseScoredRenderer, {
    timeoutMs: 4000,
  }, BASE_SCORED_FEEDBACK);

  registry.register(SU_FX.ABILITY_TRIGGERED, AbilityTriggeredRenderer, {
    timeoutMs: 2500,
    maxConcurrent: 1,
  }, ABILITY_TRIGGERED_FEEDBACK);

  return registry;
}

/** 模块级单例 — 整个应用生命周期共享 */
export const smashUpFxRegistry = createRegistry();
