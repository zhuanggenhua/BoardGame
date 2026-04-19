/**
 * 攻击结算同时结算测试（reducer 层）
 *
 * 规则 §3.6 Step 6: "将所有伤害、免除（减伤）和/或回复效果加总，结算结果"
 *
 * 实现方式：
 * - HEAL_APPLIED 在 pendingAttack 期间跳过 HP 上限（允许临时超上限）
 * - ATTACK_RESOLVED 时将 HP 钳制回上限（60 = 初始值 50 + 10）
 * - 事件保持原始数值，动画正常播放
 *
 * 覆盖：
 * 1. 满血时防御治疗 + 攻击伤害 → 净伤害 = 伤害 - 治疗
 * 2. 非满血时防御治疗 + 攻击伤害 → 同时结算
 * 3. 治疗量 >= 伤害量 → 净治疗（HP 不超上限 60）
 * 4. 无心骰面时 HEAL_APPLIED(amount=0) 仍正常处理
 * 5. 非攻击结算期间的治疗仍受 HP 上限限制
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import { applyEvents } from '../domain/utils';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH, MAX_HEALTH } from '../domain/types';
import type { DiceThroneCore, DiceThroneEvent, HealAppliedEvent, DamageDealtEvent, AttackResolvedEvent } from '../domain/types';
import { createInitializedState, fixedRandom } from './test-utils';

// 注册野蛮人 custom actions（模块副作用）
import '../domain/effects';

/**
 * 构造一个带 pendingAttack 的基础状态
 */
function createAttackState(defenderHp: number): DiceThroneCore {
    const matchState = createInitializedState(['0', '1'], fixedRandom);
    const core = matchState.core;

    core.players['1'].resources[RESOURCE_IDS.HP] = defenderHp;
    core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        isDefendable: true,
        sourceAbilityId: 'test-attack',
        defenseAbilityId: 'thick-skin',
        attackDiceFaceCounts: {},
    };

    return core;
}

/** 构造治疗事件 */
function healEvent(targetId: string, amount: number, ts = 1): HealAppliedEvent {
    return {
        type: 'HEAL_APPLIED',
        payload: { targetId, amount, sourceAbilityId: 'thick-skin' },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ts,
    } as HealAppliedEvent;
}

/** 构造伤害事件 */
function damageEvent(targetId: string, amount: number, ts = 2): DamageDealtEvent {
    return {
        type: 'DAMAGE_DEALT',
        payload: { targetId, amount, actualDamage: amount, sourceAbilityId: 'test-attack' },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ts,
    } as DamageDealtEvent;
}

/** 构造攻击结算事件 */
function resolvedEvent(ts = 3): AttackResolvedEvent {
    return {
        type: 'ATTACK_RESOLVED',
        payload: {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-attack',
            defenseAbilityId: 'thick-skin',
            totalDamage: 0,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ts,
    } as AttackResolvedEvent;
}

describe('攻击结算同时结算（reducer 层）', () => {
    it('满血时：治疗不被 HP 上限浪费，净伤害 = 攻击伤害 - 治疗量', () => {
        // 防御者满血(50)，厚皮治疗2，攻击伤害8
        // 旧逻辑（错误）：先治疗 min(50+2, 50)=50，再扣血 50-8=42
        // 新逻辑（正确）：治疗后临时 52，扣血 52-8=44，结算钳制 min(44,50)=44
        const state = createAttackState(INITIAL_HEALTH);
        const events: DiceThroneEvent[] = [
            healEvent('1', 2),
            damageEvent('1', 8),
            resolvedEvent(),
        ];

        const finalState = applyEvents(state, events, reduce);
        expect(finalState.players['1'].resources[RESOURCE_IDS.HP]).toBe(44); // 50 - (8-2) = 44
    });

    it('非满血时：治疗和伤害同时结算', () => {
        // 防御者 HP=40，厚皮治疗2，攻击伤害8
        // 治疗后 42，扣血 42-8=34
        const state = createAttackState(40);
        const events: DiceThroneEvent[] = [
            healEvent('1', 2),
            damageEvent('1', 8),
            resolvedEvent(),
        ];

        const finalState = applyEvents(state, events, reduce);
        expect(finalState.players['1'].resources[RESOURCE_IDS.HP]).toBe(34);
    });

    it('治疗量 >= 伤害量时：净治疗生效，HP 不超上限', () => {
        // 防御者 HP=48，厚皮治疗3，攻击伤害2
        // 治疗后临时 51，扣血 51-2=49，结算钳制 min(49,50)=49
        const state = createAttackState(48);
        const events: DiceThroneEvent[] = [
            healEvent('1', 3),
            damageEvent('1', 2),
            resolvedEvent(),
        ];

        const finalState = applyEvents(state, events, reduce);
        expect(finalState.players['1'].resources[RESOURCE_IDS.HP]).toBe(49); // 48 + (3-2) = 49
    });

    it('满血时治疗量 > 伤害量：HP 不超上限', () => {
        // 防御者满血(50)，厚皮治疗3，攻击伤害2
        // 治疗后临时 53，扣血 53-2=51，结算钳制 min(51,60)=51
        const state = createAttackState(INITIAL_HEALTH);
        const events: DiceThroneEvent[] = [
            healEvent('1', 3),
            damageEvent('1', 2),
            resolvedEvent(),
        ];

        const finalState = applyEvents(state, events, reduce);
        expect(finalState.players['1'].resources[RESOURCE_IDS.HP]).toBe(51); // 钳制到上限 60，实际 51
    });

    it('无心骰面时 HEAL_APPLIED(amount=0) 正常处理', () => {
        // 防御者满血，治疗0，攻击伤害8
        const state = createAttackState(INITIAL_HEALTH);
        const events: DiceThroneEvent[] = [
            healEvent('1', 0),
            damageEvent('1', 8),
            resolvedEvent(),
        ];

        const finalState = applyEvents(state, events, reduce);
        expect(finalState.players['1'].resources[RESOURCE_IDS.HP]).toBe(42); // 50 - 8 = 42
    });

    it('非攻击结算期间的治疗仍受 HP 上限限制', () => {
        // 没有 pendingAttack 时，满血治疗不应超上限 60
        const matchState = createInitializedState(['0', '1'], fixedRandom);
        const state = matchState.core;
        state.players['1'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH;
        state.pendingAttack = null; // 确保没有攻击结算

        const events: DiceThroneEvent[] = [
            healEvent('1', 5),
        ];

        const finalState = applyEvents(state, events, reduce);
        expect(finalState.players['1'].resources[RESOURCE_IDS.HP]).toBe(55); // 50 + 5 = 55，未超上限 60
    });

    it('事件保持原始数值（动画可正常播放）', () => {
        // 验证事件的 amount 不被修改
        const state = createAttackState(INITIAL_HEALTH);
        const heal = healEvent('1', 2);
        const damage = damageEvent('1', 8);

        // 应用治疗事件后，HP 临时超上限
        const afterHeal = reduce(state, heal);
        expect(afterHeal.players['1'].resources[RESOURCE_IDS.HP]).toBe(52); // 临时超上限

        // 应用伤害事件后
        const afterDamage = reduce(afterHeal, damage);
        expect(afterDamage.players['1'].resources[RESOURCE_IDS.HP]).toBe(44); // 52 - 8 = 44

        // 攻击结算后钳制
        const afterResolved = reduce(afterDamage, resolvedEvent());
        expect(afterResolved.players['1'].resources[RESOURCE_IDS.HP]).toBe(44); // 44 < 50，无需钳制
        expect(afterResolved.pendingAttack).toBeNull();
    });
});
