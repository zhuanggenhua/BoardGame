/**
 * 序列特效预览卡片
 *
 * 演示 FxBus.pushSequence() 的有序特效编排能力。
 * 内嵌独立的 FxBus + FxLayer 实例，参数模式与 useAnimationEffects 完全一致。
 */

import React, { useCallback, useRef, useState } from 'react';
import { ListOrdered } from 'lucide-react';
import { useFxBus, FxLayer } from '../../../engine/fx';
import { diceThroneFxRegistry, DT_FX } from '../../../games/dicethrone/ui/fxSetup';
import { AudioManager } from '../../../lib/audio/AudioManager';
import { TOKEN_META } from '../../../games/dicethrone/domain/statusEffects';
import { TOKEN_IDS } from '../../../games/dicethrone/domain/ids';
import type { FxSequenceStep } from '../../../engine/fx';
import {
  type PreviewCardProps, type EffectEntryMeta,
  EffectCard, TriggerButton,
} from './shared';

// 从真实 meta 获取图标和颜色（无 sprite atlas 环境下 fallback 到 emoji）
const FM_META = TOKEN_META[TOKEN_IDS.FIRE_MASTERY] || { icon: '🔥', color: 'from-orange-500 to-red-600' };
const PROTECT_META = TOKEN_META[TOKEN_IDS.PROTECT] || { icon: '🛡️', color: 'from-amber-500 to-yellow-600' };

// ============================================================================
// 序列特效预览
// ============================================================================

export const SequenceCard: React.FC<PreviewCardProps> = ({ iconColor }) => {
  /** buff 区 DOM 引用（模拟游戏中的 refs.selfBuff / refs.opponentBuff） */
  const buffRef = useRef<HTMLDivElement>(null);
  /** HP 区 DOM 引用（模拟游戏中的 refs.opponentHp） */
  const hpRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stepLog, setStepLog] = useState<string[]>([]);

  const fxBus = useFxBus(diceThroneFxRegistry, {
    playSound: (key) => {
      try { AudioManager.play(key); } catch { /* 预览环境音频可能未初始化 */ }
    },
  });

  const getCenter = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const getCellPosition = useCallback(() => ({ left: 0, top: 0, width: 100, height: 100 }), []);

  /**
   * 序列：Token 移除 → 延迟 → 伤害飞行数字
   * 参数模式与 useAnimationEffects 中 token 移除 + DAMAGE_DEALT 一致
   */
  const fireTokenThenDamage = useCallback(() => {
    setStepLog(['▶ Token 移除 → 伤害']);
    const steps: FxSequenceStep[] = [
      {
        // 与 useAnimationEffects token 移除动画一致：原地消散
        cue: DT_FX.TOKEN,
        ctx: {},
        params: {
          content: FM_META.icon ?? '🔥',
          color: 'from-slate-400 to-slate-600',
          startPos: getCenter(buffRef),
          isRemove: true,
        },
        delayAfter: 200,
      },
      {
        // 与 useAnimationEffects DAMAGE_DEALT 一致：从 buff 区飞向 HP 区
        cue: DT_FX.DAMAGE,
        ctx: {},
        params: {
          damage: 4,
          startPos: getCenter(buffRef),
          endPos: getCenter(hpRef),
        },
      },
    ];
    fxBus.pushSequence(steps);
  }, [fxBus, getCenter]);

  /**
   * 序列：治疗 → 状态获得 → 伤害（三步）
   */
  const fireTripleSequence = useCallback(() => {
    setStepLog(['▶ 治疗 → 状态 → 伤害']);
    const steps: FxSequenceStep[] = [
      {
        cue: DT_FX.HEAL,
        ctx: {},
        params: {
          amount: 3,
          startPos: getCenter(buffRef),
          endPos: getCenter(hpRef),
        },
        delayAfter: 150,
      },
      {
        // 状态获得：飞向 buff 区（使用真实的守护 token）
        cue: DT_FX.TOKEN,
        ctx: {},
        params: {
          content: PROTECT_META.icon ?? '🛡️',
          color: PROTECT_META.color ?? 'from-amber-500 to-yellow-600',
          startPos: getCenter(hpRef),
          endPos: getCenter(buffRef),
        },
        delayAfter: 150,
      },
      {
        cue: DT_FX.DAMAGE,
        ctx: {},
        params: {
          damage: 8,
          startPos: getCenter(buffRef),
          endPos: getCenter(hpRef),
        },
      },
    ];
    fxBus.pushSequence(steps);
  }, [fxBus, getCenter]);

  /** 并行对比：同时 push，无序列 */
  const fireParallel = useCallback(() => {
    setStepLog(['▶ 并行（无序列）']);
    fxBus.push(DT_FX.TOKEN, {}, {
      content: FM_META.icon ?? '🔥',
      color: 'from-slate-400 to-slate-600',
      startPos: getCenter(buffRef),
      isRemove: true,
    });
    fxBus.push(DT_FX.DAMAGE, {}, {
      damage: 4,
      startPos: getCenter(buffRef),
      endPos: getCenter(hpRef),
    });
  }, [fxBus, getCenter]);

  return (
    <EffectCard
      title="序列特效 (pushSequence)"
      icon={ListOrdered}
      iconColor={iconColor}
      desc="有序编排 vs 并行播放对比"
      buttons={<>
        <TriggerButton label="Token→伤害（序列）" onClick={fireTokenThenDamage} color="bg-orange-700 hover:bg-orange-600" />
        <TriggerButton label="治疗→状态→伤害" onClick={fireTripleSequence} color="bg-indigo-700 hover:bg-indigo-600" />
        <TriggerButton label="并行对比" onClick={fireParallel} color="bg-slate-600 hover:bg-slate-500" />
      </>}
    >
      <div ref={containerRef} className="absolute inset-0">
        {/* 模拟游戏布局：左侧 Buff 区、右侧 HP 区 */}
        <div
          ref={buffRef}
          className="absolute left-[30%] top-[45%] -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-600/30 flex items-center gap-1.5 text-xs text-slate-400"
        >
          {FM_META.icon}×3 {PROTECT_META.icon}×1
        </div>
        <div className="absolute left-[30%] top-[62%] -translate-x-1/2 text-[9px] text-slate-600">Buff 区</div>

        <div
          ref={hpRef}
          className="absolute left-[70%] top-[45%] -translate-x-1/2 -translate-y-1/2 w-12 h-8 rounded-lg bg-red-900/30 border border-red-500/30 flex items-center justify-center text-xs text-red-400"
        >
          ❤️ 42
        </div>
        <div className="absolute left-[70%] top-[62%] -translate-x-1/2 text-[9px] text-slate-600">HP 区</div>

        {/* 步骤日志 */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-0.5 pointer-events-none">
          {stepLog.map((line, i) => (
            <span key={i} className="text-[10px] text-slate-500 font-mono">{line}</span>
          ))}
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
  {
    id: 'sequence',
    label: '序列特效',
    icon: ListOrdered,
    component: SequenceCard,
    group: 'ui',
    usageDesc: 'FxBus.pushSequence 有序编排预览',
  },
];
