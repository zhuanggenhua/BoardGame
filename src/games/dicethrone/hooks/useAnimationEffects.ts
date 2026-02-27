/**
 * useAnimationEffects Hook
 * 
 * 基于事件流驱动 FX 特效（伤害/治疗/状态/Token）。
 * 使用 FX 引擎（useFxBus + FeedbackPack）自动处理音效和震动。
 * 
 * 事件流消费遵循 EventStreamSystem 模式 A（过滤式消费），
 * 单一游标统一处理所有事件类型，避免游标推进遗漏导致重复触发。
 * 
 * ## 护盾动画优化（2026-02-16）
 * 
 * 问题：当防御技能授予大额护盾（如暗影守护 999 护盾）完全吸收伤害时，
 * UI 仍会播放伤害飞行动画，导致 HP 数字先跳变再恢复的视觉问题。
 * 
 * 根因：DAMAGE_DEALT 事件的 actualDamage 字段在事件创建时计算（不考虑护盾），
 * reducer 消耗护盾后 HP 不变，但 UI 层读取 actualDamage 播放动画。
 * 
 * 解决方案：在事件消费阶段扫描 DAMAGE_SHIELD_GRANTED 事件，识别大额护盾
 * （value >= 100），标记被保护的目标，跳过这些目标的伤害动画。
 * 
 * 限制：使用阈值启发式（>= 100），适用于"完全免疫"类护盾（如暗影守护 999）。
 * 不支持部分护盾吸收的精确动画（如护盾 3 吸收 8 伤害中的 3，仍播放 5 伤害动画）。
 * 若未来需要精确支持，需在 reducer 中计算 netDamage 并写回事件或侧信道。
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { EventStreamEntry } from '../../../engine/types';
import type { DamageDealtEvent, HealAppliedEvent, HeroState } from '../domain/types';
import type { AttackResolvedEvent, CpChangedEvent } from '../domain/events';
import type { PlayerId } from '../../../engine/types';
import type { StatusAtlases } from '../ui/statusEffects';
import { getStatusEffectIconNode } from '../ui/statusEffects';
import { STATUS_EFFECT_META, TOKEN_META } from '../domain/statusEffects';
import { getElementCenter } from '../../../components/common/animations/FlyingEffect';
import type { FxBus, FxParams } from '../../../engine/fx';
import {
    DT_FX,
    resolveDamageImpactKey,
    resolveStatusImpactKey,
    resolveTokenImpactKey,
    resolveCpImpactKey,
} from '../ui/fxSetup';
import type { AbilityDef } from '../domain/combat';
import { useVisualStateBuffer } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import type { UseVisualStateBufferReturn } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import { RESOURCE_IDS } from '../domain/resources';
import { useEventStreamCursor } from '../../../engine/hooks';

/** 单步描述：cue + params + HP 冻结信息 */
interface AnimStep {
    cue: string;
    params: FxParams;
    bufferKey: string;
    frozenHp: number;
    /** 伤害值（用于受击反馈强度计算），治疗步骤为 0 */
    damage: number;
}

const FULL_IMMUNITY_SHIELD_THRESHOLD = 100;

export interface DamageAnimationContext {
    shieldedTargets: Set<string>;
    percentShields: Map<string, number>;
    resolvedDamageByTarget: Map<string, number>;
}

/**
 * 解析本批次事件中的护盾与攻击结算上下文，供动画层计算净伤害。
 */
export function collectDamageAnimationContext(newEntries: EventStreamEntry[]): DamageAnimationContext {
    const shieldedTargets = new Set<string>();
    const percentShields = new Map<string, number>();
    const resolvedDamageByTarget = new Map<string, number>();

    for (const entry of newEntries) {
        const event = entry.event as { type: string; payload?: Record<string, unknown> };
        if (event.type !== 'DAMAGE_SHIELD_GRANTED') continue;

        const targetId = typeof event.payload?.targetId === 'string' ? event.payload.targetId : undefined;
        if (!targetId) continue;

        const shieldValue = typeof event.payload?.value === 'number' ? event.payload.value : 0;
        const reductionPercent = typeof event.payload?.reductionPercent === 'number'
            ? event.payload.reductionPercent
            : undefined;

        if (shieldValue >= FULL_IMMUNITY_SHIELD_THRESHOLD) {
            shieldedTargets.add(targetId);
        }
        if (reductionPercent != null && reductionPercent > 0) {
            percentShields.set(targetId, reductionPercent);
        }
    }

    // ATTACK_RESOLVED.totalDamage 是该次攻击对防御方的权威净伤害。
    // 当批次内只有 1 条对防御方的 DAMAGE_DEALT 时，可用其覆盖动画数值，
    // 兼容跨命令护盾（shield 在上一命令授予）导致 DAMAGE_DEALT 仍携带原始伤害的场景。

    const resolvedEvents = newEntries
        .map(entry => entry.event)
        .filter((event): event is AttackResolvedEvent => event.type === 'ATTACK_RESOLVED');

    if (resolvedEvents.length === 1) {
        const resolved = resolvedEvents[0];
        const defenderId = resolved.payload.defenderId;
        const defenderDamageEventCount = newEntries.filter(entry => {
            if (entry.event.type !== 'DAMAGE_DEALT') return false;
            const damageEvent = entry.event as DamageDealtEvent;
            return damageEvent.payload.targetId === defenderId;
        }).length;

        if (defenderDamageEventCount === 1 && Number.isFinite(resolved.payload.totalDamage)) {
            resolvedDamageByTarget.set(defenderId, Math.max(0, resolved.payload.totalDamage));
        }
    }

    return { shieldedTargets, percentShields, resolvedDamageByTarget };
}

/**
 * 计算伤害动画应展示的净伤害。
 */
export function resolveAnimationDamage(
    rawDamage: number,
    targetId: string,
    percentShields?: Map<string, number>,
    resolvedDamageByTarget?: Map<string, number>,
): number {
    const reductionPercent = percentShields?.get(targetId);
    const shieldAbsorbed = reductionPercent != null
        ? Math.ceil(rawDamage * reductionPercent / 100)
        : 0;
    const dealtFromSameBatchShield = rawDamage - shieldAbsorbed;
    const resolvedDamage = resolvedDamageByTarget?.get(targetId);

    return resolvedDamage != null
        ? Math.max(0, resolvedDamage)
        : dealtFromSameBatchShield;
}

/**
 * 动画效果配置
 */
export interface AnimationEffectsConfig {
    /** FX Bus（用于推送特效） */
    fxBus: FxBus;
    /** 玩家状态（包含自己和对手） */
    players: {
        player: HeroState;
        opponent?: HeroState;
    };
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 对手 ID */
    opponentId: PlayerId;
    /** DOM 引用 */
    refs: {
        opponentHp: React.RefObject<HTMLDivElement | null>;
        selfHp: React.RefObject<HTMLDivElement | null>;
        opponentCp: React.RefObject<HTMLDivElement | null>;
        selfCp: React.RefObject<HTMLDivElement | null>;
        opponentBuff: React.RefObject<HTMLDivElement | null>;
        selfBuff: React.RefObject<HTMLDivElement | null>;
        /** 对手悬浮窗容器（对手效果的 fallback 起点） */
        opponentHeader: React.RefObject<HTMLDivElement | null>;
    };
    /** 获取效果起始位置的函数（基于 lastEffectSourceByPlayerId 查找） */
    getEffectStartPos: (targetId?: string) => { x: number; y: number };
    /** 获取技能槽位置的函数（直接从 abilityId 查 DOM，找不到返回屏幕中心） */
    getAbilityStartPos: (abilityId?: string) => { x: number; y: number };
    /** 当前语言 */
    locale?: string;
    /** 状态图标图集配置 */
    statusIconAtlas?: StatusAtlases | null;
    /** 事件流所有条目（统一消费伤害/治疗等事件） */
    eventStreamEntries?: EventStreamEntry[];
}

/**
 * 管理动画效果的 Hook
 * 
 * 事件流消费采用模式 A（过滤式），单一游标统一处理 DAMAGE_DEALT / HEAL_APPLIED。
 * 状态效果和 Token 变化仍基于 prev/current 快照对比。
 * 
 * 返回 damageBuffer（视觉状态缓冲）和 fxImpactMap（FX ID → buffer key 映射），
 * 供 Board 层在 FxLayer onEffectImpact 时释放对应 HP 冻结。
 */
export function useAnimationEffects(config: AnimationEffectsConfig): {
    /** 视觉状态缓冲：HP 在飞行动画到达前保持冻结 */
    damageBuffer: UseVisualStateBufferReturn;
    /** FX 事件 ID → { bufferKey, damage } 映射，供 onEffectImpact 释放 + 触发受击反馈 */
    fxImpactMapRef: React.RefObject<Map<string, { bufferKey: string; damage: number }>>;
    /** 推进动画队列：Board 层在 onEffectComplete 中调用，播放下一步 */
    advanceQueue: (completedFxId: string) => void;
} {
    const {
        fxBus,
        players: { player, opponent },
        currentPlayerId,
        opponentId,
        refs,
        getEffectStartPos,
        getAbilityStartPos,
        locale,
        statusIconAtlas,
        eventStreamEntries = [],
    } = config;

    // ========================================================================
    // 事件流消费：通用游标（自动处理首次挂载跳过 + Undo 重置）
    // ========================================================================
    const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });

    // 视觉状态缓冲：HP 在飞行动画到达前保持冻结
    const damageBuffer = useVisualStateBuffer();
    // FX 事件 ID → { bufferKey, damage } 映射（飞行动画到达时释放对应 key + 触发受击反馈）
    const fxImpactMapRef = useRef(new Map<string, { bufferKey: string; damage: number }>());

    /**
     * 从玩家技能列表中查找技能的 sfxKey（支持变体 ID）
     * 用于在伤害动画 onImpact 时播放技能专属音效，替代通用打击音
     */
    const findAbilitySfxKey = useCallback((abilityId: string | undefined): string | undefined => {
        if (!abilityId) return undefined;
        const allAbilities: AbilityDef[] = [
            ...(player?.abilities ?? []),
            ...(opponent?.abilities ?? []),
        ];
        for (const ability of allAbilities) {
            // 先检查变体 ID
            if (ability.variants?.length) {
                const variant = ability.variants.find(v => v.id === abilityId);
                if (variant) {
                    return variant.sfxKey ?? ability.sfxKey;
                }
            }
            if (ability.id === abilityId) {
                return ability.sfxKey;
            }
        }
        return undefined;
    }, [player?.abilities, opponent?.abilities]);

    /**
     * 构建单个伤害事件的 FX 参数
     * 返回 null 表示该事件不需要动画（无效目标/护盾完全抵消等）
     * 
     * @param dmgEvent 伤害事件
     * @param shieldedTargets 本批次中被大额护盾完全保护的目标集合（护盾值 >= FULL_IMMUNITY_SHIELD_THRESHOLD）
     * @param percentShields 本批次中百分比护盾信息（targetId → reductionPercent）
     */
    const buildDamageStep = useCallback((
        dmgEvent: DamageDealtEvent,
        shieldedTargets?: Set<string>,
        percentShields?: Map<string, number>,
        resolvedDamageByTarget?: Map<string, number>,
    ): AnimStep | null => {
        const rawDamage = dmgEvent.payload.actualDamage ?? 0;
        if (rawDamage <= 0) return null;

        const targetId = dmgEvent.payload.targetId;

        // 如果目标在本批次中被大额护盾保护（如暗影守护 999 护盾），跳过伤害动画。
        // 这避免了"先播放伤害动画，HP 数字跳变，然后又恢复"的视觉问题。
        if (shieldedTargets?.has(targetId)) return null;

        const damage = resolveAnimationDamage(rawDamage, targetId, percentShields, resolvedDamageByTarget);
        if (damage <= 0) return null;

        const sourceId = dmgEvent.payload.sourceAbilityId ?? '';
        const isDot = sourceId.startsWith('upkeep-');
        const cue = isDot ? DT_FX.DOT_DAMAGE : DT_FX.DAMAGE;
        // 技能专属音效优先（如和尚拳术/雷霆万钧各有独立音效），
        // 找不到时回退到通用打击音（按伤害量区分轻/重击）
        const abilitySfx = isDot ? undefined : findAbilitySfxKey(sourceId || undefined);
        const soundKey = abilitySfx ?? (isDot ? undefined : resolveDamageImpactKey(damage, targetId, currentPlayerId));
        const targetPlayer = targetId === opponentId ? opponent : player;
        const bufferKey = `hp-${targetId}`;

        if (!targetPlayer) return null;

        // 计算冻结快照值（core 当前 HP + 伤害 = 攻击前 HP）
        const coreHp = targetPlayer.resources[RESOURCE_IDS.HP] ?? 0;
        const frozenHp = coreHp + damage;

        const isOpponent = targetId === opponentId;

        // 伤害飞行起点规则：
        // - 我的技能打对手（targetId === opponentId）→ 从我的技能槽飞出
        // - 对手的技能打我（targetId === currentPlayerId）→ 从对手悬浮窗飞出
        const startPos = isOpponent
            ? getAbilityStartPos(sourceId || undefined)   // 我打对手：从我的技能槽飞出
            : getElementCenter(refs.opponentHeader.current); // 对手打我：从对手悬浮窗飞出

        const endPos = getElementCenter(isOpponent ? refs.opponentHp.current : refs.selfHp.current);

        return {
            cue,
            params: { damage, startPos, endPos, ...(soundKey && { soundKey }) },
            bufferKey,
            frozenHp,
            damage,
        };
    }, [currentPlayerId, opponentId, opponent, player, getAbilityStartPos, findAbilitySfxKey, refs.opponentHeader, refs.opponentHp, refs.selfHp]);

    /**
     * 构建单个治疗事件的 FX 参数
     * 
     * 治疗起点：从触发治疗的技能槽位置飞出（sourceAbilityId），
     * 找不到技能槽时 fallback 到对手悬浮窗（说明是对手的技能）。
     * 不使用 getEffectStartPos（它查的是"对目标造成效果的来源"，
     * 治疗自己时会错误地指向对手的技能）。
     * 
     * 注意：即使 amount=0 也生成动画（barbarian thick-skin 在无心面时治疗0，
     * 但仍需播放防御技能反馈），只是不冻结 HP。
     */
    const buildHealStep = useCallback((healEvent: HealAppliedEvent): AnimStep | null => {
        const { targetId, amount, sourceAbilityId } = healEvent.payload;
        // 移除 amount <= 0 过滤，允许 0 治疗量的动画（用于技能反馈）
        // if (amount <= 0) return null;

        const targetPlayer = targetId === opponentId ? opponent : player;
        const bufferKey = `hp-${targetId}`;

        if (!targetPlayer) return null;

        // 计算冻结快照值（core 当前 HP - 治疗量 = 治疗前 HP）
        const coreHp = targetPlayer.resources[RESOURCE_IDS.HP] ?? 0;
        const frozenHp = coreHp - amount;

        const isOpponent = targetId === opponentId;
        // 治疗起点：直接从 sourceAbilityId 查技能槽位置，找不到则从对手悬浮窗飞出
        const startPos = getAbilityStartPos(sourceAbilityId);
        const endPos = getElementCenter(isOpponent ? refs.opponentHp.current : refs.selfHp.current);

        return {
            cue: DT_FX.HEAL,
            params: { amount, startPos, endPos },
            bufferKey,
            frozenHp,
            damage: 0,
        };
    }, [opponentId, opponent, player, getAbilityStartPos, refs.opponentHp, refs.selfHp]);

    /**
     * 构建单个 CP 变化事件的 FX 参数
     * 
     * CP 获得（delta > 0）：从触发技能的来源位置飞到自己的 CP 条（金色 buff 飞行数字）
     * CP 被偷（delta < 0 且来源是技能效果）：从被偷者 CP 条飞向技能来源位置（红色 damage 飞行数字）
     * CP 花费（delta < 0 且来源是打牌等）：不播放动画
     */
    const buildCpStep = useCallback((cpEvent: CpChangedEvent): AnimStep | null => {
        const { playerId, delta } = cpEvent.payload;

        if (delta > 0) {
            // CP 获得：只有技能/卡牌/被动触发的 CP 获得才播放动画
            // 正常阶段推进（income 阶段 +1 CP）不播放动画
            if (cpEvent.sourceCommandType !== 'ABILITY_EFFECT' && cpEvent.sourceCommandType !== 'PASSIVE_TRIGGER') {
                return null;
            }
            const isOpponent = playerId === opponentId;
            const soundKey = resolveCpImpactKey(delta);
            const startPos = getEffectStartPos(isOpponent ? opponentId : currentPlayerId);
            const endPos = getElementCenter(isOpponent ? refs.opponentCp.current : refs.selfCp.current);

            return {
                cue: DT_FX.CP_CHANGE,
                params: { delta, startPos, endPos, soundKey },
                bufferKey: '',
                frozenHp: -1,
                damage: 0,
            };
        }

        // CP 减少：只有技能效果触发的扣减（偷窃/扒取）才播放动画，日常花费不需要
        if (delta < 0 && cpEvent.sourceCommandType === 'ABILITY_EFFECT') {
            const isOpponent = playerId === opponentId;
            const soundKey = resolveCpImpactKey(delta);
            // 被偷：从被偷者的 CP 条飞向对方（技能来源位置）
            const startPos = getElementCenter(isOpponent ? refs.opponentCp.current : refs.selfCp.current);
            const endPos = getEffectStartPos(isOpponent ? currentPlayerId : opponentId);

            return {
                cue: DT_FX.CP_CHANGE,
                params: { delta, startPos, endPos, soundKey },
                bufferKey: '',
                frozenHp: -1,
                damage: 0,
            };
        }

        return null;
    }, [opponentId, currentPlayerId, getEffectStartPos, refs.opponentCp, refs.selfCp]);

    /**
     * 统一消费事件流：伤害 + 治疗 + CP 变化
     * 
     * 在 useLayoutEffect 中一次性完成：消费事件 → freezeSync → commitSync → push FX。
     * useLayoutEffect 在 DOM 更新后、浏览器绘制前同步执行，保证 HP 冻结无间隙帧。
     * 
     * 注意：不能在 render 阶段调用 consumeNew()，因为 React 18 StrictMode 会双重调用
     * render 函数，导致游标被提前推进、FX 系统完全不触发。详见下方 useLayoutEffect 注释。
     */
    // 待播放步骤队列（FIFO）
    const pendingStepsRef = useRef<AnimStep[]>([]);
    // 当前正在播放的 fxId（用于 advanceQueue 匹配）
    const activeFxIdRef = useRef<string | null>(null);

    /** 推入队列中的下一步，返回是否成功 */
    const pushNextStep = useCallback(() => {
        const next = pendingStepsRef.current.shift();
        if (!next) {
            activeFxIdRef.current = null;
            return;
        }
        const fxId = fxBus.push(next.cue, {}, next.params);
        if (fxId) {
            fxImpactMapRef.current.set(fxId, { bufferKey: next.bufferKey, damage: next.damage });
            activeFxIdRef.current = fxId;
        } else {
            // cue 未注册或被跳过，继续推进
            pushNextStep();
        }
    }, [fxBus]);

    /**
     * Board 层在 onEffectComplete 中调用：当前步骤动画完成后推进下一步。
     * 只在 completedFxId 匹配当前活跃步骤时才推进（避免状态/Token 特效误触发）。
     */
    const advanceQueue = useCallback((completedFxId: string) => {
        if (completedFxId === activeFxIdRef.current && pendingStepsRef.current.length > 0) {
            pushNextStep();
        }
    }, [pushNextStep]);

    // ── 统一在 useLayoutEffect 中消费事件 + freezeSync + push FX ──
    // 
    // 【根因修复】之前 consumeNew() 在 render 阶段直接调用，但 React 18 StrictMode
    // 会在开发模式下双重调用 render 函数。consumeNew() 内部通过 ref（lastSeenIdRef）
    // 推进游标，ref 的修改不会被 React 回滚，导致：
    //   1. 第一次 render（StrictMode 额外调用）：consumeNew() 消费了新事件，推进游标
    //   2. React 丢弃第一次 render 的结果（包括 pendingPushRef 的赋值）
    //   3. 第二次 render（真正的 render）：游标已推进，consumeNew() 返回空数组
    //   4. FX 系统完全不触发 → 无伤害飞行动画、无受击音效、无技能音效
    //
    // 修复：将 consumeNew() 移到 useLayoutEffect 中。useLayoutEffect 在 commit 阶段
    // 同步执行（DOM 更新后、浏览器绘制前），StrictMode 不会双重调用 effect。
    // freezeSync 也在此处执行，保证在绘制前完成 HP 冻结，消除间隙帧。
    useLayoutEffect(() => {
        const { entries: newEntries } = consumeNew();
        if (newEntries.length === 0) return;

        const damageSteps: AnimStep[] = [];
        const healSteps: AnimStep[] = [];
        const cpSteps: AnimStep[] = [];

        const {
            shieldedTargets,
            percentShields,
            resolvedDamageByTarget,
        } = collectDamageAnimationContext(newEntries);

        for (const entry of newEntries) {
            const event = entry.event as { type: string; payload: Record<string, unknown> };
            if (event.type === 'DAMAGE_DEALT') {
                const step = buildDamageStep(
                    event as unknown as DamageDealtEvent,
                    shieldedTargets,
                    percentShields,
                    resolvedDamageByTarget,
                );
                if (step) damageSteps.push(step);
            } else if (event.type === 'HEAL_APPLIED') {
                const step = buildHealStep(event as unknown as HealAppliedEvent);
                if (step) healSteps.push(step);
            } else if (event.type === 'CP_CHANGED') {
                const step = buildCpStep(event as unknown as CpChangedEvent);
                if (step) cpSteps.push(step);
            }
        }

        const allSteps = [...damageSteps, ...healSteps, ...cpSteps];
        if (allSteps.length === 0) return;

        // 同步冻结 HP（useLayoutEffect 在绘制前执行，无间隙帧）— 跳过 CP 步骤（无需冻结）
        for (const step of allSteps) {
            if (!step.bufferKey) continue;
            const currentFrozen = damageBuffer.get(step.bufferKey, -1);
            if (currentFrozen === -1) {
                damageBuffer.freezeSync(step.bufferKey, step.frozenHp);
            }
        }
        // 将 freezeSync 写入的 ref 同步到 React state
        damageBuffer.commitSync();

        // 第一步立即 push，剩余入队
        const [first, ...rest] = allSteps;
        pendingStepsRef.current.push(...rest);

        const fxId = fxBus.push(first.cue, {}, first.params);
        if (fxId) {
            fxImpactMapRef.current.set(fxId, { bufferKey: first.bufferKey, damage: first.damage });
            activeFxIdRef.current = fxId;
        } else {
            pushNextStep();
        }
    }, [
        eventStreamEntries,
        consumeNew,
        fxBus,
        pushNextStep,
        damageBuffer,
        buildDamageStep,
        buildHealStep,
        buildCpStep,
    ]);

    // ========================================================================
    // 状态效果 / Token 变化：基于 prev/current 快照对比
    // ========================================================================

    // 追踪上一次的状态效果
    const prevOpponentStatusRef = useRef<Record<string, number>>({ ...(opponent?.statusEffects || {}) });
    const prevPlayerStatusRef = useRef<Record<string, number>>({ ...(player?.statusEffects || {}) });
    // 追踪上一次的 Token
    const prevOpponentTokensRef = useRef<Record<string, number>>({ ...(opponent?.tokens || {}) });
    const prevPlayerTokensRef = useRef<Record<string, number>>({ ...(player?.tokens || {}) });

    /**
     * 监听对手状态效果变化（增益/减益/移除动画）
     */
    useEffect(() => {
        if (!opponent) return;

        const prevStatus = prevOpponentStatusRef.current;
        const currentStatus = opponent.statusEffects || {};

        Object.entries(currentStatus).forEach(([effectId, stacks]) => {
            const prevStacks = prevStatus[effectId] ?? 0;
            if (stacks > prevStacks) {
                const info = STATUS_EFFECT_META[effectId] || { color: 'from-slate-500 to-slate-600' };
                fxBus.push(DT_FX.STATUS, {}, {
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: info.color,
                    startPos: getEffectStartPos(opponentId),
                    endPos: getElementCenter(refs.opponentBuff.current),
                    soundKey: resolveStatusImpactKey(false),
                });
            }
        });

        Object.entries(prevStatus).forEach(([effectId, prevStacks]) => {
            const currentStacks = currentStatus[effectId] ?? 0;
            if (prevStacks > 0 && currentStacks < prevStacks) {
                const info = STATUS_EFFECT_META[effectId] || { color: 'from-slate-500 to-slate-600' };
                fxBus.push(DT_FX.STATUS, {}, {
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: 'from-slate-400 to-slate-600',
                    startPos: getElementCenter(refs.opponentBuff.current),
                    isRemove: true,
                    soundKey: resolveStatusImpactKey(true),
                });
            }
        });

        prevOpponentStatusRef.current = { ...currentStatus };
    }, [opponent?.statusEffects, opponent, getEffectStartPos, opponentId, locale, statusIconAtlas, refs.opponentBuff, fxBus]);

    /**
     * 监听玩家状态效果变化（增益/减益/移除动画）
     */
    useEffect(() => {
        const prevStatus = prevPlayerStatusRef.current;
        const currentStatus = player.statusEffects || {};

        Object.entries(currentStatus).forEach(([effectId, stacks]) => {
            const prevStacks = prevStatus[effectId] ?? 0;
            if (stacks > prevStacks) {
                const info = STATUS_EFFECT_META[effectId] || { color: 'from-slate-500 to-slate-600' };
                fxBus.push(DT_FX.STATUS, {}, {
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: info.color,
                    startPos: getEffectStartPos(currentPlayerId),
                    endPos: getElementCenter(refs.selfBuff.current),
                    soundKey: resolveStatusImpactKey(false),
                });
            }
        });

        Object.entries(prevStatus).forEach(([effectId, prevStacks]) => {
            const currentStacks = currentStatus[effectId] ?? 0;
            if (prevStacks > 0 && currentStacks < prevStacks) {
                const info = STATUS_EFFECT_META[effectId] || { color: 'from-slate-500 to-slate-600' };
                fxBus.push(DT_FX.STATUS, {}, {
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: 'from-slate-400 to-slate-600',
                    startPos: getElementCenter(refs.selfBuff.current),
                    isRemove: true,
                    soundKey: resolveStatusImpactKey(true),
                });
            }
        });

        prevPlayerStatusRef.current = { ...currentStatus };
    }, [player.statusEffects, getEffectStartPos, currentPlayerId, locale, statusIconAtlas, refs.selfBuff, fxBus]);

    /**
     * 监听对手 Token 变化（获得/消耗动画）
     */
    useEffect(() => {
        if (!opponent) return;

        const prevTokens = prevOpponentTokensRef.current;
        const currentTokens = opponent.tokens || {};

        Object.entries(currentTokens).forEach(([tokenId, stacks]) => {
            const prevStacks = prevTokens[tokenId] ?? 0;
            if (stacks > prevStacks) {
                const info = TOKEN_META[tokenId] || { color: 'from-slate-500 to-slate-600' };
                fxBus.push(DT_FX.TOKEN, {}, {
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: info.color,
                    startPos: getEffectStartPos(opponentId),
                    endPos: getElementCenter(refs.opponentBuff.current),
                    soundKey: resolveTokenImpactKey(false),
                });
            }
        });

        Object.entries(prevTokens).forEach(([tokenId, prevStacks]) => {
            const currentStacks = currentTokens[tokenId] ?? 0;
            if (prevStacks > 0 && currentStacks < prevStacks) {
                const info = TOKEN_META[tokenId] || { color: 'from-slate-500 to-slate-600' };
                fxBus.push(DT_FX.TOKEN, {}, {
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: 'from-slate-400 to-slate-600',
                    startPos: getElementCenter(refs.opponentBuff.current),
                    isRemove: true,
                    soundKey: resolveTokenImpactKey(true),
                });
            }
        });

        prevOpponentTokensRef.current = { ...currentTokens };
    }, [opponent?.tokens, opponent, getEffectStartPos, opponentId, locale, statusIconAtlas, refs.opponentBuff, fxBus]);

    /**
     * 监听玩家 Token 变化（获得/消耗动画）
     */
    useEffect(() => {
        const prevTokens = prevPlayerTokensRef.current;
        const currentTokens = player.tokens || {};

        Object.entries(currentTokens).forEach(([tokenId, stacks]) => {
            const prevStacks = prevTokens[tokenId] ?? 0;
            if (stacks > prevStacks) {
                const info = TOKEN_META[tokenId] || { color: 'from-slate-500 to-slate-600' };
                fxBus.push(DT_FX.TOKEN, {}, {
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: info.color,
                    startPos: getEffectStartPos(currentPlayerId),
                    endPos: getElementCenter(refs.selfBuff.current),
                    soundKey: resolveTokenImpactKey(false),
                });
            }
        });

        Object.entries(prevTokens).forEach(([tokenId, prevStacks]) => {
            const currentStacks = currentTokens[tokenId] ?? 0;
            if (prevStacks > 0 && currentStacks < prevStacks) {
                const info = TOKEN_META[tokenId] || { color: 'from-slate-500 to-slate-600' };
                fxBus.push(DT_FX.TOKEN, {}, {
                    content: getStatusEffectIconNode(info, locale, 'fly', statusIconAtlas),
                    color: 'from-slate-400 to-slate-600',
                    startPos: getElementCenter(refs.selfBuff.current),
                    isRemove: true,
                    soundKey: resolveTokenImpactKey(true),
                });
            }
        });

        prevPlayerTokensRef.current = { ...currentTokens };
    }, [player.tokens, getEffectStartPos, currentPlayerId, locale, statusIconAtlas, refs.selfBuff, fxBus]);

    return { damageBuffer, fxImpactMapRef, advanceQueue };
}
