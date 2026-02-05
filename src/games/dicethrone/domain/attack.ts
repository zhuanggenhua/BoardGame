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

const now = () => Date.now();

const createPreDefenseResolvedEvent = (
    attackerId: string,
    defenderId: string,
    sourceAbilityId?: string
): AttackPreDefenseResolvedEvent => ({
    type: 'ATTACK_PRE_DEFENSE_RESOLVED',
    payload: {
        attackerId,
        defenderId,
        sourceAbilityId,
    },
    sourceCommandType: 'ABILITY_EFFECT',
    timestamp: now(),
});

export const resolveOffensivePreDefenseEffects = (state: DiceThroneCore): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending || pending.preDefenseResolved) return [];

    const { attackerId, defenderId, sourceAbilityId } = pending;
    if (!sourceAbilityId) {
        return [createPreDefenseResolvedEvent(attackerId, defenderId)];
    }

    const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
    const ctx: EffectContext = {
        attackerId,
        defenderId,
        sourceAbilityId,
        state,
        damageDealt: 0,
    };

    const events: DiceThroneEvent[] = [];
    // preDefense 效果现在统一通过效果系统处理（包括 choice 效果）
    events.push(...resolveEffectsToEvents(effects, 'preDefense', ctx));

    events.push(createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId));
    return events;
};

export const resolveAttack = (
    state: DiceThroneCore,
    random: RandomFn,
    options?: { includePreDefense?: boolean; skipTokenResponse?: boolean }
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) {
        return [];
    }

    const events: DiceThroneEvent[] = [];
    if (options?.includePreDefense) {
        const preDefenseEvents = resolveOffensivePreDefenseEffects(state);
        events.push(...preDefenseEvents);

        const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
        if (hasChoice) return events;
    }

    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
    const bonusDamage = pending.bonusDamage ?? 0;

    if (defenseAbilityId) {
        const defenseEffects = getPlayerAbilityEffects(state, defenderId, defenseAbilityId);
        // 防御技能的上下文：防御者是 "attacker"，原攻击者是 "defender"
        const defenseCtx: EffectContext = {
            attackerId: defenderId,  // 防御者（使用防御技能的人）
            defenderId: attackerId,  // 原攻击者（被防御技能影响的人）
            sourceAbilityId: defenseAbilityId,
            state,
            damageDealt: 0,
        };

        events.push(...resolveEffectsToEvents(defenseEffects, 'withDamage', defenseCtx, { random }));
        events.push(...resolveEffectsToEvents(defenseEffects, 'postDamage', defenseCtx, { random }));
    }

    let totalDamage = 0;
    if (sourceAbilityId) {
        const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
        const attackCtx: EffectContext = {
            attackerId,
            defenderId,
            sourceAbilityId,
            state,
            damageDealt: 0,
        };

        // withDamage 时机的效果（包括 rollDie 和 damage）统一通过效果系统处理
        events.push(...resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
            bonusDamage,
            bonusDamageOnce: true,
            random,
        }));
        
        // 如果有 Token 响应请求，提前返回，不生成 ATTACK_RESOLVED 事件
        // 等待 Token 响应完成后再继续攻击结算
        const hasTokenResponse = events.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
        if (hasTokenResponse) {
            return events;
        }
        
        events.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random }));
        totalDamage = attackCtx.damageDealt;
    }

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
        timestamp: now(),
    };
    events.push(resolvedEvent);

    return events;
};

/**
 * 仅执行 postDamage 效果（用于 Token 响应后的攻击结算）
 * 当伤害已通过 Token 响应结算时，只需要执行 postDamage 效果（如击倒）
 */
export const resolvePostDamageEffects = (
    state: DiceThroneCore,
    random: RandomFn
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) {
        return [];
    }

    const events: DiceThroneEvent[] = [];
    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
    
    // 使用 Token 响应后记录的最终伤害值（用于 onHit 条件判断）
    // 如果没有记录，则使用原始伤害值
    const damageDealt = pending.resolvedDamage ?? pending.damage ?? 0;

    // 执行攻击技能的 postDamage 效果
    if (sourceAbilityId) {
        const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
        const attackCtx: EffectContext = {
            attackerId,
            defenderId,
            sourceAbilityId,
            state,
            damageDealt, // 使用实际造成的伤害值
        };

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
            totalDamage: damageDealt, // 使用实际造成的伤害值
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: now(),
    };
    events.push(resolvedEvent);

    return events;
};
