/**
 * DiceThrone 攻击结算（事件驱动）
 * 仅生成事件，不直接修改状态
 */

import type { RandomFn } from '../../../engine/types';
import type {
    DiceThroneCore,
    DiceThroneEvent,
    AttackResolvedEvent,
    AttackPreDefenseResolvedEvent,
} from './types';
import { resolveEffectsToEvents, type EffectContext } from './effects';
import { getPlayerAbilityEffects } from './abilityLookup';

const createPreDefenseResolvedEvent = (
    attackerId: string,
    defenderId: string,
    sourceAbilityId: string | undefined,
    timestamp: number
): AttackPreDefenseResolvedEvent => ({
    type: 'ATTACK_PRE_DEFENSE_RESOLVED',
    payload: {
        attackerId,
        defenderId,
        sourceAbilityId,
    },
    sourceCommandType: 'ABILITY_EFFECT',
    timestamp,
});

export const resolveOffensivePreDefenseEffects = (
    state: DiceThroneCore,
    timestamp: number = 0
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending || pending.preDefenseResolved) return [];

    const { attackerId, defenderId, sourceAbilityId } = pending;
    if (!sourceAbilityId) {
        return [createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId, timestamp)];
    }

    const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
    const ctx: EffectContext = {
        attackerId,
        defenderId,
        sourceAbilityId,
        state,
        damageDealt: 0,
        timestamp,
    };

    const events: DiceThroneEvent[] = [];
    // preDefense 效果现在统一通过效果系统处理（包括 choice 效果）
    events.push(...resolveEffectsToEvents(effects, 'preDefense', ctx));

    events.push(createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId, timestamp));
    return events;
};

export const resolveAttack = (
    state: DiceThroneCore,
    random: RandomFn,
    options?: { includePreDefense?: boolean; skipTokenResponse?: boolean },
    timestamp: number = 0
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) {
        return [];
    }

    const events: DiceThroneEvent[] = [];
    if (options?.includePreDefense) {
        const preDefenseEvents = resolveOffensivePreDefenseEffects(state, timestamp);
        events.push(...preDefenseEvents);

        const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
        if (hasChoice) return events;
    }

    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
    const bonusDamage = pending.bonusDamage ?? 0;

    // 收集防御方事件（用于后续同时结算）
    const defenseEvents: DiceThroneEvent[] = [];
    if (defenseAbilityId) {
        const defenseEffects = getPlayerAbilityEffects(state, defenderId, defenseAbilityId);
        // 防御技能的上下文：防御者是 "attacker"，原攻击者是 "defender"
        // isDefensiveContext=true：防御反击伤害不是"攻击"（规则 §7.2），不触发 Token 响应窗口
        const defenseCtx: EffectContext = {
            attackerId: defenderId,  // 防御者（使用防御技能的人）
            defenderId: attackerId,  // 原攻击者（被防御技能影响的人）
            sourceAbilityId: defenseAbilityId,
            state,
            damageDealt: 0,
            timestamp,
            isDefensiveContext: true,
        };

        defenseEvents.push(...resolveEffectsToEvents(defenseEffects, 'withDamage', defenseCtx, { random }));
        defenseEvents.push(...resolveEffectsToEvents(defenseEffects, 'postDamage', defenseCtx, { random }));
    }
    events.push(...defenseEvents);

    // 收集攻击方事件
    const attackEvents: DiceThroneEvent[] = [];
    let totalDamage = 0;
    if (sourceAbilityId) {
        const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
        const attackCtx: EffectContext = {
            attackerId,
            defenderId,
            sourceAbilityId,
            state,
            damageDealt: 0,
            timestamp,
        };

        // withDamage 时机的效果（包括 rollDie 和 damage）统一通过效果系统处理
        // 注意：resolveEffectsToEvents 遇到 TOKEN_RESPONSE_REQUESTED 会自动 break，
        // 不会执行后续的 rollDie 等效果（避免消耗 random 值）
        const withDamageEvents = resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
            bonusDamage,
            bonusDamageOnce: true,
            random,
        });
        
        // 如果有 Token 响应请求或需要用户交互的奖励骰重掷请求，提前返回（不生成 ATTACK_RESOLVED）
        // - TOKEN_RESPONSE_REQUESTED：伤害被挂起等待玩家 Token 响应
        // - BONUS_DICE_REROLL_REQUESTED（非 displayOnly）：骰子还未结算，需要用户交互（如重掷）
        // 注意：displayOnly 的 BONUS_DICE_REROLL_REQUESTED 仅用于 UI 展示多骰结果，不阻止结算
        const hasTokenResponse = withDamageEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
        const hasInteractiveBonusDiceReroll = withDamageEvents.some(e =>
            e.type === 'BONUS_DICE_REROLL_REQUESTED'
            && !(e as any).payload?.settlement?.displayOnly
        );
        if (hasTokenResponse || hasInteractiveBonusDiceReroll) {
            attackEvents.push(...withDamageEvents);
            events.push(...attackEvents);
            return events;
        }
        
        // 没有挂起的响应/结算，正常推入所有事件
        attackEvents.push(...withDamageEvents);
        attackEvents.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random }));
        totalDamage = attackCtx.damageDealt;
    }
    events.push(...attackEvents);

    const resolvedEvent: AttackResolvedEvent = {
        type: 'ATTACK_RESOLVED',
        payload: {
            attackerId,
            defenderId,
            sourceAbilityId,
            defenseAbilityId,
            totalDamage,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
    events.push(resolvedEvent);

    return events;
};

/**
 * Token 响应后的攻击结算：执行 withDamage 中被截断的非伤害效果 + postDamage 效果
 * 
 * 背景：resolveEffectsToEvents 遇到 TOKEN_RESPONSE_REQUESTED 会自动 break，
 * 不执行后续效果（如 rollDie），避免消耗 random 值。
 * 此函数在 Token 响应完成后重新执行 withDamage（跳过已结算的 damage）+ postDamage。
 */
export const resolvePostDamageEffects = (
    state: DiceThroneCore,
    random: RandomFn,
    timestamp: number = 0
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) {
        return [];
    }

    const events: DiceThroneEvent[] = [];
    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
    
    // 使用 Token 响应后记录的最终伤害值（用于 onHit 条件判断）
    const damageDealt = pending.resolvedDamage ?? pending.damage ?? 0;

    // 执行攻击技能的 withDamage 剩余效果（跳过 damage）+ postDamage 效果
    if (sourceAbilityId) {
        const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
        const attackCtx: EffectContext = {
            attackerId,
            defenderId,
            sourceAbilityId,
            state,
            damageDealt, // 使用实际造成的伤害值
            timestamp,
        };

        // 重新执行 withDamage 效果，但跳过 damage 类型（伤害已通过 Token 响应结算）
        // 这样 rollDie、grantToken 等被截断的效果能正确执行
        events.push(...resolveEffectsToEvents(effects, 'withDamage', attackCtx, { random, skipDamage: true }));
        events.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random }));
    }

    // 生成 ATTACK_RESOLVED 事件
    const resolvedEvent: AttackResolvedEvent = {
        type: 'ATTACK_RESOLVED',
        payload: {
            attackerId,
            defenderId,
            sourceAbilityId,
            defenseAbilityId,
            totalDamage: damageDealt,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    };
    events.push(resolvedEvent);

    return events;
};
