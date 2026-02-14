/**
 * DiceThrone — FX 注册表配置
 *
 * 职责：
 * 1. 定义游戏专属的 cue 常量
 * 2. 将飞行动画包装为 FxRenderer
 * 3. 创建并注册 FxRegistry 单例
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FxRegistry, type FxRendererProps, type FeedbackPack } from '../../../engine/fx';
import { FlyingEffectsLayer, type FlyingEffectData } from '../../../components/common/animations/FlyingEffect';
import { UI_Z_INDEX } from '../../../core';

// ============================================================================
// Cue 常量
// ============================================================================

/** DiceThrone FX Cue 常量 */
export const DT_FX = {
  /** 伤害飞行数字（战斗伤害，带震动+裂隙闪光） */
  DAMAGE: 'fx.damage',
  /** 持续伤害飞行数字（灼烧/中毒等 DoT，只有飞行数字+轻微音效，无震动） */
  DOT_DAMAGE: 'fx.dot-damage',
  /** 治疗飞行数字 */
  HEAL: 'fx.heal',
  /** 状态效果飞行图标 */
  STATUS: 'fx.status',
  /** Token 飞行图标 */
  TOKEN: 'fx.token',
} as const;

// ============================================================================
// 音效配置（来自通用音频注册表）
// ============================================================================

/** 重击阈值（伤害 >= 此值使用重击音效） */
const HEAVY_HIT_THRESHOLD = 8;

const IMPACT_SFX = {
  HEAVY_HIT: 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst',
  LIGHT_HIT: 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst',
  SELF_HIT: 'combat.general.mini_games_sound_effects_and_music_pack.body_hit.sfx_body_hit_generic_small_1',
  HEAL: 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a',
  STATUS_GAIN: 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a',
  STATUS_REMOVE: 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a',
  TOKEN_GAIN: 'status.general.player_status_sound_fx_pack_vol.action_and_interaction.ready_a',
  TOKEN_REMOVE: 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a',
} as const;

/** 状态效果冲击音效解析（获得/移除） */
export function resolveStatusImpactKey(isRemove: boolean): string {
  return isRemove ? IMPACT_SFX.STATUS_REMOVE : IMPACT_SFX.STATUS_GAIN;
}

/** Token 冲击音效解析（获得/移除） */
export function resolveTokenImpactKey(isRemove: boolean): string {
  return isRemove ? IMPACT_SFX.TOKEN_REMOVE : IMPACT_SFX.TOKEN_GAIN;
}

// ============================================================================
// 稳定回调 hook（避免父组件重新渲染导致动画重播）
// ============================================================================

function useStableComplete(onComplete: () => void): () => void {
  const ref = useRef(onComplete);

  useEffect(() => {
    ref.current = onComplete;
  }, [onComplete]);

  return useCallback(() => ref.current(), []);
}

function renderSingleFlyingEffect(
  effect: Omit<FlyingEffectData, 'id'>,
  onComplete: () => void
): React.ReactElement {
  return React.createElement(FlyingEffectsLayer, {
    effects: [{ id: '__single_fx__', ...effect }],
    onEffectComplete: () => onComplete(),
  });
}

// ============================================================================
// 渲染器：伤害飞行数字
// ============================================================================

/**
 * params:
 * - damage: number — 伤害值
 * - startPos: { x: number; y: number } — 起始位置（像素）
 * - endPos: { x: number; y: number } — 结束位置（像素）
 * - soundKey?: string — 动态音效 key（从 params 读取）
 */
const DamageRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);

  const damage = event.params?.damage as number | undefined;
  const startPos = event.params?.startPos as { x: number; y: number } | undefined;
  const endPos = event.params?.endPos as { x: number; y: number } | undefined;

  if (!damage || !startPos || !endPos) {
    stableComplete();
    return null;
  }

  return renderSingleFlyingEffect({
    type: 'damage',
    content: `-${damage}`,
    startPos,
    endPos,
    intensity: damage,
    onImpact,
  }, stableComplete);
};

// ============================================================================
// 渲染器：治疗飞行数字
// ============================================================================

/**
 * params:
 * - amount: number — 治疗量
 * - startPos: { x: number; y: number } — 起始位置（像素）
 * - endPos: { x: number; y: number } — 结束位置（像素）
 */
const HealRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);

  const amount = event.params?.amount as number | undefined;
  const startPos = event.params?.startPos as { x: number; y: number } | undefined;
  const endPos = event.params?.endPos as { x: number; y: number } | undefined;

  if (!amount || !startPos || !endPos) {
    stableComplete();
    return null;
  }

  return renderSingleFlyingEffect({
    type: 'heal',
    content: `+${amount}`,
    startPos,
    endPos,
    intensity: amount,
    onImpact,
  }, stableComplete);
};

// ============================================================================
// 渲染器：原地消散（buff/token 移除时使用）
// ============================================================================

/**
 * 原地消散动画 — 商业级 buff 移除效果
 *
 * 视觉：图标原地闪光 → 缩小 + 淡出 + 轻微上浮
 * 参考：Hearthstone buff 移除、Slay the Spire 状态消失
 */
const DissipateEffect: React.FC<{
  content: React.ReactNode;
  position: { x: number; y: number };
  onImpact: () => void;
  onComplete: () => void;
}> = ({ content, position, onImpact, onComplete }) => {
  const impactFired = useRef(false);

  return createPortal(
    React.createElement(motion.div, {
      initial: { opacity: 1, scale: 1.1, y: 0 },
      animate: { opacity: [1, 1, 0], scale: [1.1, 1.3, 0.3], y: [0, -4, -16] },
      transition: { duration: 0.5, ease: 'easeOut', times: [0, 0.25, 1] },
      onUpdate: (latest: { opacity?: number }) => {
        // 在闪光峰值（scale 最大时）触发 onImpact
        if (!impactFired.current && typeof latest.opacity === 'number' && latest.opacity < 0.95) {
          impactFired.current = true;
          onImpact();
        }
      },
      onAnimationComplete: onComplete,
      style: {
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: UI_Z_INDEX.effect,
        pointerEvents: 'none' as const,
        filter: 'brightness(1.5)',
      },
      className: 'text-[1.8vw]',
    }, content),
    document.body,
  );
};

// ============================================================================
// 渲染器：状态效果飞行图标
// ============================================================================

/**
 * params:
 * - content: React.ReactNode — 图标内容
 * - color?: string — 渐变色
 * - startPos: { x: number; y: number } — 起始位置（像素）
 * - endPos: { x: number; y: number } — 结束位置（像素，获得时必填）
 * - isRemove?: boolean — 是否为移除动画（原地消散）
 */
const StatusRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);

  const content = event.params?.content as React.ReactNode | undefined;
  const color = event.params?.color as string | undefined;
  const startPos = event.params?.startPos as { x: number; y: number } | undefined;
  const endPos = event.params?.endPos as { x: number; y: number } | undefined;
  const isRemove = event.params?.isRemove as boolean | undefined;

  if (!content || !startPos) {
    stableComplete();
    return null;
  }

  // 移除：原地消散（闪光 → 缩小淡出）
  if (isRemove) {
    return React.createElement(DissipateEffect, {
      content,
      position: startPos,
      onImpact,
      onComplete: stableComplete,
    });
  }

  // 获得：飞行动画
  if (!endPos) {
    stableComplete();
    return null;
  }

  return renderSingleFlyingEffect({
    type: 'buff',
    content,
    color,
    startPos,
    endPos,
    onImpact,
  }, stableComplete);
};

// ============================================================================
// 渲染器：Token 飞行图标
// ============================================================================

/**
 * params:
 * - content: React.ReactNode — 图标内容
 * - color?: string — 渐变色
 * - startPos: { x: number; y: number } — 起始位置（像素）
 * - endPos: { x: number; y: number } — 结束位置（像素，获得时必填）
 * - isRemove?: boolean — 是否为移除动画（原地消散）
 */
const TokenRenderer: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);

  const content = event.params?.content as React.ReactNode | undefined;
  const color = event.params?.color as string | undefined;
  const startPos = event.params?.startPos as { x: number; y: number } | undefined;
  const endPos = event.params?.endPos as { x: number; y: number } | undefined;
  const isRemove = event.params?.isRemove as boolean | undefined;

  if (!content || !startPos) {
    stableComplete();
    return null;
  }

  // 移除：原地消散
  if (isRemove) {
    return React.createElement(DissipateEffect, {
      content,
      position: startPos,
      onImpact,
      onComplete: stableComplete,
    });
  }

  // 获得：飞行动画
  if (!endPos) {
    stableComplete();
    return null;
  }

  return renderSingleFlyingEffect({
    type: 'buff',
    content,
    color,
    startPos,
    endPos,
    onImpact,
  }, stableComplete);
};

// ============================================================================
// 反馈包常量
// ============================================================================

/** 伤害反馈：冲击瞬间播放音效（从 params.soundKey 读取）+ 震动 */
const DAMAGE_FEEDBACK: FeedbackPack = {
  sound: {
    source: 'params', // 从 event.params.soundKey 读取（动态选择重击/轻击/自伤）
    timing: 'on-impact',
  },
  shake: { intensity: 'normal', type: 'hit', timing: 'on-impact' },
};

/** 持续伤害反馈：只有轻微音效，无震动（灼烧/中毒等 DoT） */
const DOT_DAMAGE_FEEDBACK: FeedbackPack = {
  sound: {
    key: IMPACT_SFX.SELF_HIT,
    timing: 'on-impact',
  },
  // 无 shake — 持续伤害不应有震动
};

/** 治疗反馈：冲击瞬间播放音效 */
const HEAL_FEEDBACK: FeedbackPack = {
  sound: {
    key: IMPACT_SFX.HEAL,
    timing: 'on-impact',
  },
};

/** 状态效果获得反馈：冲击瞬间播放音效 */
const STATUS_GAIN_FEEDBACK: FeedbackPack = {
  sound: {
    source: 'params',
    key: IMPACT_SFX.STATUS_GAIN,
    timing: 'on-impact',
  },
};

/** Token 获得反馈：冲击瞬间播放音效 */
const TOKEN_GAIN_FEEDBACK: FeedbackPack = {
  sound: {
    source: 'params',
    key: IMPACT_SFX.TOKEN_GAIN,
    timing: 'on-impact',
  },
};

// ============================================================================
// 注册表工厂
// ============================================================================

/** 创建 DiceThrone FX 注册表（模块级单例） */
function createRegistry(): FxRegistry {
  const registry = new FxRegistry();

  registry.register(DT_FX.DAMAGE, DamageRenderer, {
    timeoutMs: 2000,
  }, DAMAGE_FEEDBACK);

  registry.register(DT_FX.DOT_DAMAGE, DamageRenderer, {
    timeoutMs: 2000,
  }, DOT_DAMAGE_FEEDBACK);

  registry.register(DT_FX.HEAL, HealRenderer, {
    timeoutMs: 2000,
  }, HEAL_FEEDBACK);

  // 状态效果：根据 params.isRemove 动态选择反馈
  registry.register(DT_FX.STATUS, StatusRenderer, {
    timeoutMs: 2000,
  }, STATUS_GAIN_FEEDBACK); // 默认为获得，移除时在 push 时覆盖

  registry.register(DT_FX.TOKEN, TokenRenderer, {
    timeoutMs: 2000,
  }, TOKEN_GAIN_FEEDBACK); // 默认为获得，移除时在 push 时覆盖

  return registry;
}

/** 模块级单例 — 整个应用生命周期共享 */
export const diceThroneFxRegistry = createRegistry();

/**
 * 根据伤害值和目标解析命中音效 key
 * 
 * @param damage 伤害值
 * @param targetId 目标玩家 ID
 * @param currentPlayerId 当前玩家 ID
 * @returns 音效 key
 */
export function resolveDamageImpactKey(
  damage: number,
  targetId: string | undefined,
  currentPlayerId: string | undefined
): string {
  const isOpponent = targetId !== currentPlayerId;
  if (isOpponent) {
    return damage >= HEAVY_HIT_THRESHOLD ? IMPACT_SFX.HEAVY_HIT : IMPACT_SFX.LIGHT_HIT;
  }
  return IMPACT_SFX.SELF_HIT;
}
