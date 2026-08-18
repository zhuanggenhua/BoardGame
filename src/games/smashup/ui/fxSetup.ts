/**
 * 大杀四方 — FX 注册表配置
 *
 * 职责：
 * 1. 定义游戏专属的 cue 常量
 * 2. 将底层动画组件包装为 FxRenderer
 * 3. 创建并注册 FxRegistry 单例
 *
 * SmashUp 没有棋盘格。新链路优先消费 table-local anchor snapshot；
 * 迁移期保留旧 screen 坐标作为显式兜底。
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FxRegistry,
  scheduleFxFrameCallback,
  type FeedbackPack,
  type FxAnchorSnapshot,
  type FxRendererProps,
} from '../../../engine/fx';
import { getCardDef, resolveCardName, resolveCardText } from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { UI_Z_INDEX } from '../../../core';
import i18next from 'i18next';
import { PLAYER_CONFIG } from './playerConfig';
import { SmashUpAbilityTriggeredEffect } from './AbilityTriggeredEffect';

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

const BASE_SCORED_TOTAL_DURATION_MS = 3000;
const BASE_SCORED_ITEM_DELAY_S = 0.12;

// ============================================================================
// 稳定回调 hook
// ============================================================================

function useStableComplete(onComplete: () => void): () => void {
  const ref = useRef(onComplete);
  useEffect(() => { ref.current = onComplete; }, [onComplete]);
  return useCallback(() => ref.current(), []);
}

function readFxAnchorSnapshot(value: unknown): FxAnchorSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<FxAnchorSnapshot>;
  if (
    typeof candidate.surfaceId !== 'string'
    || typeof candidate.anchorId !== 'string'
    || !candidate.box
    || typeof candidate.box.left !== 'number'
    || typeof candidate.box.top !== 'number'
    || typeof candidate.box.width !== 'number'
    || typeof candidate.box.height !== 'number'
  ) {
    return null;
  }
  return candidate as FxAnchorSnapshot;
}

// ============================================================================
// 渲染器：力量变化浮字
// ============================================================================

/**
 * params:
 * - delta: number — 力量变化值
 * - targetSnapshot: FxAnchorSnapshot — table-local 基地锚点快照（优先）
 * - position: { left: number; top: number } — 屏幕像素坐标（旧兜底）
 */
const PowerChangeRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const delta = event.params?.delta as number | undefined;
  const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
  const position = event.params?.position as { left: number; top: number } | undefined;
  const shouldRender = !!delta && (!!targetSnapshot || !!position);

  // 立即触发 impact（即时反馈）
  const impactFired = useRef(false);
  useEffect(() => {
    if (!impactFired.current) {
      impactFired.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shouldRender) return;
    const cancel = scheduleFxFrameCallback(900, stableComplete);
    return cancel;
  }, [shouldRender, stableComplete]);

  useEffect(() => {
    if (!shouldRender) {
      stableComplete();
    }
  }, [shouldRender, stableComplete]);

  if (!shouldRender) return null;

  const style = targetSnapshot
    ? {
        left: `${targetSnapshot.box.left + targetSnapshot.box.width + 0.7}%`,
        top: `${Math.max(0, targetSnapshot.box.top - 1.2)}%`,
        zIndex: UI_Z_INDEX.overlayRaised,
        fontFamily: "'Caveat', 'Comic Sans MS', cursive",
      }
    : {
        left: position?.left,
        top: position?.top,
        zIndex: UI_Z_INDEX.overlayRaised,
        fontFamily: "'Caveat', 'Comic Sans MS', cursive",
      };

  return React.createElement(motion.div as React.ElementType, {
    'data-target-anchor-id': targetSnapshot?.anchorId ?? '',
    'data-surface-id': targetSnapshot?.surfaceId ?? '',
    initial: { opacity: 1, y: 0, scale: 0.8, rotate: -5 },
    animate: { opacity: 0, y: -40, scale: 1.2, rotate: 5 },
    transition: { duration: 0.8, ease: 'easeOut' },
    className: `${targetSnapshot ? 'absolute' : 'fixed'} pointer-events-none select-none`,
    style,
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
  const shouldRender = !!defId;

  const impactFired = useRef(false);
  useEffect(() => {
    if (!impactFired.current) {
      impactFired.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shouldRender) return;
    const cancel = scheduleFxFrameCallback(800, stableComplete);
    return cancel;
  }, [shouldRender, stableComplete]);

  useEffect(() => {
    if (!shouldRender) {
      stableComplete();
    }
  }, [shouldRender, stableComplete]);

  if (!shouldRender) return null;

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
    React.createElement(motion.div as React.ElementType, {
      'data-testid': 'smashup-action-fx-card',
      'data-card-def-id': defId,
      className: 'relative bg-white rounded-lg shadow-2xl border-2 border-slate-300 overflow-hidden',
      style: {
        width: '18vw',
        height: 'calc(18vw / 0.714)',
        aspectRatio: '0.714 / 1',
      },
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
 * - rankings: Array<{ playerId: string; power: number; vp: number; playerName?: string }>
 * - targetSnapshot: FxAnchorSnapshot — table-local 基地锚点快照（可选）
 */
const BaseScoredRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const rankings = event.params?.rankings as Array<{ playerId: string; power: number; vp: number; playerName?: string }> | undefined;
  const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
  const validRankings = (rankings ?? []).filter(r => r.vp > 0);
  const shouldRender = validRankings.length > 0;
  const lastItemDelayMs = Math.max(0, validRankings.length - 1) * BASE_SCORED_ITEM_DELAY_S * 1000;
  const perItemDurationS = Math.max(2.2, (BASE_SCORED_TOTAL_DURATION_MS - lastItemDelayMs) / 1000);

  const impactFired = useRef(false);
  useEffect(() => {
    if (!impactFired.current) {
      impactFired.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shouldRender) return;
    const cancel = scheduleFxFrameCallback(BASE_SCORED_TOTAL_DURATION_MS, stableComplete);
    return cancel;
  }, [shouldRender, stableComplete]);

  useEffect(() => {
    if (!shouldRender) {
      stableComplete();
    }
  }, [shouldRender, stableComplete]);

  if (!shouldRender) return null;

  const t = i18next.getFixedT(null, 'game-smashup');

  // 使用 motion.div 作为根元素（与其他渲染器一致），确保 AnimatePresence 能正确追踪
  return React.createElement(motion.div as React.ElementType, {
    'data-target-anchor-id': targetSnapshot?.anchorId ?? '',
    'data-surface-id': targetSnapshot?.surfaceId ?? '',
    className: `${targetSnapshot ? 'absolute' : 'fixed'} inset-0 pointer-events-none`,
    style: { zIndex: UI_Z_INDEX.overlayRaised },
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
    ...validRankings.map((r, i) => {
      const playerIndex = Number.parseInt(r.playerId, 10);
      const playerNumber = Number.isFinite(playerIndex) ? playerIndex + 1 : r.playerId;
      const playerLabel = r.playerName || t('ui.player_short', { id: playerNumber });
      const conf = PLAYER_CONFIG[(Number.isFinite(playerIndex) ? playerIndex : 0) % PLAYER_CONFIG.length];
      const offsetY = (i - (validRankings.length - 1) / 2) * 68;
      const feedbackStyle = targetSnapshot
        ? { left: `${targetSnapshot.center.xPct}%`, top: `calc(${targetSnapshot.center.yPct}% + ${offsetY}px)` }
        : { left: '50%', top: `calc(50% + ${offsetY}px)` };
      return React.createElement(motion.div as React.ElementType, {
        key: `${event.id}-${r.playerId}`,
        'data-testid': `su-vp-gain-feedback-${r.playerId}`,
        'data-target-anchor-id': targetSnapshot?.anchorId ?? '',
        className: 'absolute pointer-events-none select-none',
        style: feedbackStyle,
        initial: { opacity: 0, scale: 0.92, x: '-50%', y: 28 },
        animate: {
          opacity: [0, 1, 1, 0],
          scale: [0.92, 1.08, 1, 0.98],
          y: [28, 0, -10, -36],
          x: '-50%',
        },
        transition: {
          duration: perItemDurationS,
          ease: 'easeOut',
          times: [0, 0.16, 0.74, 1],
          delay: i * BASE_SCORED_ITEM_DELAY_S,
        },
      },
        React.createElement('div', {
          className: 'flex min-w-[190px] max-w-[min(76vw,380px)] items-center gap-3 rounded-full border-2 border-yellow-700 bg-yellow-300/95 px-4 py-2 text-slate-950 shadow-2xl',
        },
          React.createElement('span', {
            className: `flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white text-sm font-black text-white shadow-md ${conf.bg}`,
          }, playerNumber),
          React.createElement('span', { className: 'min-w-0 flex-1 truncate text-base font-black' }, t('ui.vp_award_notice', {
            player: playerLabel,
            vp: r.vp,
          })),
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
 * - sourcePosition / targetPosition: { left: number; top: number } | undefined
 * - targetDefId: string | undefined — 被影响的目标卡牌 defId（可选）
 * - sourcePreviewRef / targetPreviewRef — 预览页或事件携带的权威卡图（可选）
 * - sourceLabel / targetLabel / effectLabel — 短标签（可选，仅作辅助）
 * - highlightTone: 'info' | 'danger' | 'buff' | 'score' | undefined
 */
/** 持续效果/触发器激活渲染器（导出供特效预览使用） */
export const AbilityTriggeredRenderer: React.FC<FxRendererProps> = (props) =>
  React.createElement(SmashUpAbilityTriggeredEffect, props);

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
    timeoutMs: 5000,
  }, BASE_SCORED_FEEDBACK);

  registry.register(SU_FX.ABILITY_TRIGGERED, AbilityTriggeredRenderer, {
    timeoutMs: 5000,
    maxConcurrent: 1,
    budget: {
      quality: 'reduced',
      areaPolicy: 'screen',
      estimatedCost: 'high',
      maxDpr: 1.25,
      reducedMaxDpr: 1,
    },
  }, ABILITY_TRIGGERED_FEEDBACK);

  return registry;
}

/** 模块级单例 — 整个应用生命周期共享 */
export const smashUpFxRegistry = createRegistry();
