/**
 * 召唤师战争 — FX 注册表配置
 *
 * 职责：
 * 1. 定义游戏专属的 cue 常量
 * 2. 将底层动画组件包装为 FxRenderer
 * 3. 创建并注册 FxRegistry 单例
 *
 * 渲染器（Renderer）是轻量适配层，负责：
 * - 从 FxEvent 中提取 ctx/params
 * - 计算格坐标 → 容器定位
 * - 委托底层动画组件（SummonEffect、VortexEffect 等）
 */

import React, { useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  FxRegistry,
  createFxPathBox,
  createFxScaledCellBox,
  resolveFxQuality,
  type FxRendererProps,
  type FeedbackPack,
  type FxQuality,
} from '../../../engine/fx';
import { SummonHybridEffect } from '../../../components/common/animations/SummonHybridEffect';
import { VortexShaderEffect } from '../../../components/common/animations/VortexShaderEffect';
import { ConeBlast } from '../../../components/common/animations/ConeBlast';
import { DamageFlash } from '../../../components/common/animations/DamageFlash';
import { ImpactContainer } from '../../../components/common/animations/ImpactContainer';

// ============================================================================
// Cue 常量
// ============================================================================

/** 召唤师战争 FX Cue 常量 */
export const SW_FX = {
  /** 召唤光柱 */
  SUMMON: 'fx.summon',
  /** 充能旋涡 */
  CHARGE_VORTEX: 'fx.charge.vortex',
  /** 攻击气浪 */
  COMBAT_SHOCKWAVE: 'fx.combat.shockwave',
  /** 受伤闪光 */
  COMBAT_DAMAGE: 'fx.combat.damage',
} as const;

// ============================================================================
// 通用布局常量
// ============================================================================

/** 卡牌宽高比（与 CardSprite 一致） */
const CARD_ASPECT_RATIO = 1044 / 729;
/** 卡牌在格子内的宽度比例（与 UnitCell 的 w-[85%] 一致） */
const CARD_WIDTH_RATIO = 0.85;
const CARD_PADDING_TOP = `${100 / CARD_ASPECT_RATIO}%`;

// ============================================================================
// 通用容器工具
// ============================================================================

// ============================================================================
// 稳定回调 hook（避免父组件重新渲染导致动画重播）
// ============================================================================

function useStableComplete(onComplete: () => void): () => void {
  const ref = useRef(onComplete);
  useLayoutEffect(() => {
    ref.current = onComplete;
  }, [onComplete]);
  return useCallback(() => ref.current(), []);
}

function resolveEventQuality(event: FxRendererProps['event'], fallback: FxQuality = 'full'): FxQuality {
  return resolveFxQuality(event.params?.quality, resolveFxQuality(event.ctx.quality, fallback));
}

// ============================================================================
// 渲染器：召唤光柱
// ============================================================================

/**
 * params:
 * - color?: 'blue' | 'gold' (默认根据 intensity 自动选择)
 */
const SummonRenderer: React.FC<FxRendererProps> = ({ event, getCellPosition, onComplete, onImpact }) => {
  // Hooks 必须在所有条件分支之前调用
  const stableComplete = useStableComplete(onComplete);

  const cell = event.ctx.cell;
  if (!cell) { stableComplete(); return null; }

  const pos = getCellPosition(cell.row, cell.col);
  // 召唤光柱统一蓝色，与传送门视觉一致
  const color = (event.params?.color as 'blue' | 'gold') ?? 'blue';
  const quality = resolveEventQuality(event);

  const scale = 7.5;
  const box = createFxScaledCellBox(pos, scale);

  return React.createElement('div', {
    className: 'absolute pointer-events-none z-30',
    style: box,
  },
    React.createElement(SummonHybridEffect, {
      active: true,
      intensity: event.ctx.intensity ?? 'normal',
      color,
      originY: 0.5,
      quality,
      onImpact,
      onComplete: stableComplete,
    }),
  );
};

// ============================================================================
// 渲染器：充能旋涡
// ============================================================================

const ChargeVortexRenderer: React.FC<FxRendererProps> = ({ event, getCellPosition, onComplete, onImpact: _onImpact }) => {
  // Hooks 必须在所有条件分支之前调用
  const stableComplete = useStableComplete(onComplete);

  const cell = event.ctx.cell;
  if (!cell) { stableComplete(); return null; }

  const pos = getCellPosition(cell.row, cell.col);
  const quality = resolveEventQuality(event);

  const scale = 4;
  const box = createFxScaledCellBox(pos, scale);

  return React.createElement('div', {
    className: 'absolute pointer-events-none z-30',
    style: box,
  },
    React.createElement(VortexShaderEffect, {
      active: true,
      intensity: event.ctx.intensity ?? 'normal',
      quality,
      onComplete: stableComplete,
    }),
  );
};

// ============================================================================
// 渲染器：攻击气浪（远程）/ 近战受击
// ============================================================================

/**
 * params:
 * - attackType: 'melee' | 'ranged'
 * - source: { row, col }        — 攻击来源坐标
 * - damageAmount?: number
 */
const ShockwaveRenderer: React.FC<FxRendererProps> = ({ event, getCellPosition, onComplete, onImpact }) => {
  // Hooks 必须在所有条件分支之前调用
  const stableComplete = useStableComplete(onComplete);
  // 近战 impact：渲染即 impact（碰撞瞬间触发音效+震动）
  const impactFiredRef = useRef(false);
  // 远程 impact：气浪到达目标时触发音效+震动，然后通知完成
  const handleRangedComplete = useCallback(() => {
    onImpact();
    stableComplete();
  }, [onImpact, stableComplete]);
  useEffect(() => {
    if (!impactFiredRef.current && event.params?.attackType !== 'ranged') {
      impactFiredRef.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cell = event.ctx.cell;
  const source = event.params?.source as { row: number; col: number } | undefined;
  if (!cell || !source) { stableComplete(); return null; }

  const isRanged = event.params?.attackType === 'ranged';

  if (!isRanged) {
    // 近战：目标位置播放受击反馈
    const tgtPos = getCellPosition(cell.row, cell.col);
    const dmg = (event.params?.damageAmount as number) ?? (event.ctx.intensity === 'strong' ? 3 : 1);

    // EffectCellContainer 逻辑内联
    const w = tgtPos.width;
    const h = tgtPos.height;
    return React.createElement('div', {
      className: 'absolute pointer-events-none flex items-center justify-center z-30',
      style: { left: `${tgtPos.left}%`, top: `${tgtPos.top}%`, width: `${w}%`, height: `${h}%`, overflow: 'visible' },
    },
      React.createElement('div', {
        className: 'relative',
        style: {
          width: `${CARD_WIDTH_RATIO * 100}%`,
          height: 0,
          paddingTop: CARD_PADDING_TOP,
          aspectRatio: `${CARD_ASPECT_RATIO}`,
          maxHeight: '100%',
        },
      },
        React.createElement(ImpactContainer, {
          isActive: true,
          damage: dmg,
          effects: { shake: true, hitStop: false },
          className: 'absolute inset-0',
          style: { overflow: 'visible' },
          onComplete: stableComplete,
          children: React.createElement(DamageFlash, {
            active: true,
            damage: dmg,
            intensity: event.ctx.intensity ?? 'normal',
          }),
        }),
      ),
    );
  }

  // 远程：旋风锥形气浪从源飞向目标
  const srcPos = getCellPosition(source.row, source.col);
  const tgtPos = getCellPosition(cell.row, cell.col);

  const pathBox = createFxPathBox(srcPos, tgtPos);

  return React.createElement('div', {
    className: 'absolute pointer-events-none z-30',
    style: pathBox.style,
  },
    React.createElement(ConeBlast, {
      start: pathBox.start,
      end: pathBox.end,
      intensity: event.ctx.intensity ?? 'normal',
      quality: resolveEventQuality(event),
      onComplete: handleRangedComplete,
    }),
  );
};

// ============================================================================
// 渲染器：受伤闪光
// ============================================================================

/**
 * params:
 * - damageAmount?: number
 */
const DamageRenderer: React.FC<FxRendererProps> = ({ event, getCellPosition, onComplete, onImpact }) => {
  // Hooks 必须在所有条件分支之前调用
  const stableComplete = useStableComplete(onComplete);
  // 受伤 impact：渲染即 impact（伤害闪光出现瞬间触发音效+震动）
  const impactFiredRef = useRef(false);
  useEffect(() => {
    if (!impactFiredRef.current) {
      impactFiredRef.current = true;
      onImpact();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cell = event.ctx.cell;
  if (!cell) { stableComplete(); return null; }

  const pos = getCellPosition(cell.row, cell.col);
  const isStrong = event.ctx.intensity === 'strong';
  const dmg = (event.params?.damageAmount as number) ?? (isStrong ? 3 : 1);
  const quality = resolveEventQuality(event);
  const reduced = event.params?.reduced === true || quality === 'reduced';

  return React.createElement('div', {
    className: 'absolute pointer-events-none flex items-center justify-center z-30',
    style: { left: `${pos.left}%`, top: `${pos.top}%`, width: `${pos.width}%`, height: `${pos.height}%`, overflow: 'visible' },
  },
    React.createElement('div', {
      className: 'relative',
      style: {
        width: `${CARD_WIDTH_RATIO * 100}%`,
        height: 0,
        paddingTop: CARD_PADDING_TOP,
        aspectRatio: `${CARD_ASPECT_RATIO}`,
        maxHeight: '100%',
      },
    },
      React.createElement(ImpactContainer, {
        isActive: true,
        damage: dmg,
        effects: { shake: !reduced, hitStop: false },
        shakeDuration: reduced ? 180 : undefined,
        className: 'absolute inset-0',
        style: { overflow: 'visible' },
        onComplete: stableComplete,
        children: React.createElement(DamageFlash, {
          active: true,
          damage: dmg,
          intensity: event.ctx.intensity ?? 'normal',
          quality,
          showSlash: !reduced,
          showRedPulse: true,
          showNumber: true,
        }),
      }),
    ),
  );
};

// ============================================================================
// 反馈包常量
// ============================================================================

/** 召唤音效 key（来自通用音频注册表） */
const SUMMON_SOUND_KEY = 'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_06_krst';

// 攻击音效（用于预览模式的 fallback）
const MELEE_ATTACK_FALLBACK_KEY = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
const _RANGED_ATTACK_FALLBACK_KEY = 'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_shoot_1';

/** 召唤光柱反馈：爆发瞬间播放音效 + 震动（强度跟随 event.ctx.intensity 动态覆盖） */
const SUMMON_FEEDBACK: FeedbackPack = {
  sound: {
    key: SUMMON_SOUND_KEY,
    timing: 'on-impact',
  },
  shake: { intensity: 'normal', type: 'impact', timing: 'on-impact' },
};

/** 攻击气浪反馈：冲击瞬间播放音效（从 FX params.soundKey 读取，fallback 到近战音效）+ 震动 */
const COMBAT_SHOCKWAVE_FEEDBACK: FeedbackPack = {
  sound: { 
    timing: 'on-impact', 
    source: 'params',
    key: MELEE_ATTACK_FALLBACK_KEY, // params.soundKey 不存在时的 fallback
  },
  shake: { intensity: 'normal', type: 'hit', timing: 'on-impact' },
};

/** 受伤闪光反馈：冲击瞬间播放音效（从 FX params.soundKey 读取）+ 震动 */
const COMBAT_DAMAGE_FEEDBACK: FeedbackPack = {
  sound: { timing: 'on-impact', source: 'params' },
  shake: { intensity: 'normal', type: 'hit', timing: 'on-impact' },
};

// ============================================================================
// 注册表工厂
// ============================================================================

/** 创建召唤师战争 FX 注册表（模块级单例） */
function createRegistry(): FxRegistry {
  const registry = new FxRegistry();

  // 召唤光柱：震动强度跟随 event.ctx.intensity 动态覆盖（normal/strong）
  registry.register(SW_FX.SUMMON, SummonRenderer, {
    timeoutMs: 4000,
    maxConcurrent: 1,
    debounceMs: 80,
    budget: {
      areaPolicy: 'cell',
      estimatedCost: 'high',
      maxDpr: 1.25,
      reducedMaxDpr: 1,
    },
  }, SUMMON_FEEDBACK);

  registry.register(SW_FX.CHARGE_VORTEX, ChargeVortexRenderer, {
    timeoutMs: 3000,
    maxConcurrent: 2,
    debounceMs: 60,
    budget: {
      areaPolicy: 'cell',
      estimatedCost: 'high',
      maxDpr: 1.25,
      reducedMaxDpr: 1,
    },
  });

  registry.register(SW_FX.COMBAT_SHOCKWAVE, ShockwaveRenderer, {
    timeoutMs: 3000,
    maxConcurrent: 2,
    debounceMs: 80,
    budget: {
      areaPolicy: 'path',
      estimatedCost: 'high',
      maxDpr: 1.5,
      reducedMaxDpr: 1,
    },
  }, COMBAT_SHOCKWAVE_FEEDBACK);

  registry.register(SW_FX.COMBAT_DAMAGE, DamageRenderer, {
    timeoutMs: 3000,
    maxConcurrent: 4,
    debounceMs: 20,
    budget: {
      areaPolicy: 'cell',
      estimatedCost: 'medium',
      maxDpr: 1.25,
      reducedMaxDpr: 1,
    },
  }, COMBAT_DAMAGE_FEEDBACK);

  return registry;
}

/** 模块级单例 — 整个应用生命周期共享 */
export const summonerWarsFxRegistry = createRegistry();
