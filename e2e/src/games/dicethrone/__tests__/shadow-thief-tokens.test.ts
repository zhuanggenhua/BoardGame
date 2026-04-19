/**
 * 暗影刺客 Token/状态效果 测试
 *
 * 覆盖范围：
 * 1. Token 定义完整性（sneak、sneak_attack、poison）
 * 2. 初始状态验证
 * 3. Sneak 定义（不再通过 passiveTrigger，而是在攻击流程中处理）
 * 4. Sneak Attack activeUse 定义（beforeDamageDealt）
 * 5. Poison 被动触发定义（onTurnStart）
 *
 * 注意：
 * - Sneak 不再通过 onDamageReceived 被动触发，而是在 flowHooks.ts 的 offensiveRoll 阶段退出时主动检查
 * - Sneak Attack 的实际执行在 custom action 中
 * - Poison onTurnStart 伤害在 flowHooks.ts onPhaseEnter 中实现
 */

import { describe, it, expect } from 'vitest';
import { SHADOW_THIEF_TOKENS, SHADOW_THIEF_INITIAL_TOKENS } from '../heroes/shadow_thief/tokens';
import { TOKEN_IDS, STATUS_IDS } from '../domain/ids';

// ============================================================================
// 1. Token 定义完整性
// ============================================================================

describe('暗影刺客 Token 定义', () => {
    it('应包含 Sneak（潜行）— buff, stackLimit=1, 不再有 passiveTrigger', () => {
        const sneak = SHADOW_THIEF_TOKENS.find(t => t.id === TOKEN_IDS.SNEAK);
        expect(sneak).toBeDefined();
        expect(sneak!.category).toBe('buff');
        expect(sneak!.stackLimit).toBe(1);
        // 潜行不再通过 passiveTrigger 触发，而是在攻击流程中（flowHooks.ts offensiveRoll 退出时）主动检查
        expect(sneak!.passiveTrigger).toBeUndefined();
    });

    it('应包含 Sneak Attack（伏击）— consumable, beforeDamageDealt', () => {
        const sa = SHADOW_THIEF_TOKENS.find(t => t.id === TOKEN_IDS.SNEAK_ATTACK);
        expect(sa).toBeDefined();
        expect(sa!.category).toBe('consumable');
        expect(sa!.stackLimit).toBe(1);
        expect(sa!.activeUse).toBeDefined();
        expect(sa!.activeUse!.timing).toContain('beforeDamageDealt');
        expect(sa!.activeUse!.consumeAmount).toBe(1);
        expect(sa!.activeUse!.effect.type).toBe('modifyDamageDealt');
    });

    it('应包含 Poison（中毒）— debuff, onTurnStart, stackLimit=3', () => {
        const poison = SHADOW_THIEF_TOKENS.find(t => t.id === STATUS_IDS.POISON);
        expect(poison).toBeDefined();
        expect(poison!.category).toBe('debuff');
        expect(poison!.stackLimit).toBe(3);
        expect(poison!.passiveTrigger).toBeDefined();
        expect(poison!.passiveTrigger!.timing).toBe('onTurnStart');
        expect(poison!.passiveTrigger!.removable).toBe(true);
    });

    it('Token 数量应为 3', () => {
        expect(SHADOW_THIEF_TOKENS).toHaveLength(3);
    });
});

// ============================================================================
// 2. 初始状态验证
// ============================================================================

describe('暗影刺客初始 Token 状态', () => {
    it('Sneak、Sneak Attack 和 Poison 初始值为 0', () => {
        expect(SHADOW_THIEF_INITIAL_TOKENS[TOKEN_IDS.SNEAK]).toBe(0);
        expect(SHADOW_THIEF_INITIAL_TOKENS[TOKEN_IDS.SNEAK_ATTACK]).toBe(0);
        expect(SHADOW_THIEF_INITIAL_TOKENS[STATUS_IDS.POISON]).toBe(0);
    });

    it('初始状态键数量为 3（包含 Poison）', () => {
        expect(Object.keys(SHADOW_THIEF_INITIAL_TOKENS)).toHaveLength(3);
    });
});

// ============================================================================
// 3. Sneak 定义验证（不再有 passiveTrigger）
// ============================================================================

describe('暗影刺客 Sneak 定义', () => {
    it('Sneak 不再有 passiveTrigger（改为在攻击流程中处理）', () => {
        const sneak = SHADOW_THIEF_TOKENS.find(t => t.id === TOKEN_IDS.SNEAK)!;
        expect(sneak.passiveTrigger).toBeUndefined();
    });

    it('Sneak 是 buff 类型', () => {
        const sneak = SHADOW_THIEF_TOKENS.find(t => t.id === TOKEN_IDS.SNEAK)!;
        expect(sneak.category).toBe('buff');
    });

    it('Sneak 最大叠加 1 层', () => {
        const sneak = SHADOW_THIEF_TOKENS.find(t => t.id === TOKEN_IDS.SNEAK)!;
        expect(sneak.stackLimit).toBe(1);
    });
});

// ============================================================================
// 4. Sneak Attack activeUse 定义验证
// ============================================================================

describe('暗影刺客 Sneak Attack activeUse', () => {
    it('使用时机包含 beforeDamageDealt', () => {
        const sa = SHADOW_THIEF_TOKENS.find(t => t.id === TOKEN_IDS.SNEAK_ATTACK)!;
        expect(sa.activeUse!.timing).toContain('beforeDamageDealt');
    });

    it('每次消耗 1 层', () => {
        const sa = SHADOW_THIEF_TOKENS.find(t => t.id === TOKEN_IDS.SNEAK_ATTACK)!;
        expect(sa.activeUse!.consumeAmount).toBe(1);
    });

    it('效果类型为 modifyDamageDealt（实际逻辑在 custom action 中）', () => {
        const sa = SHADOW_THIEF_TOKENS.find(t => t.id === TOKEN_IDS.SNEAK_ATTACK)!;
        expect(sa.activeUse!.effect.type).toBe('modifyDamageDealt');
        // value=0 因为实际伤害由 shadow_thief-sneak-attack-use custom action 掷骰决定
        expect(sa.activeUse!.effect.value).toBe(0);
        expect(sa.activeUse!.customActionId).toBe('shadow_thief-sneak-attack-use');
    });
});

// ============================================================================
// 5. Poison 被动触发定义验证
// ============================================================================

describe('暗影刺客 Poison 被动触发', () => {
    it('Poison 触发时机为 onTurnStart', () => {
        const poison = SHADOW_THIEF_TOKENS.find(t => t.id === STATUS_IDS.POISON)!;
        expect(poison.passiveTrigger!.timing).toBe('onTurnStart');
    });

    it('Poison 可通过 CP 移除（removable=true）', () => {
        const poison = SHADOW_THIEF_TOKENS.find(t => t.id === STATUS_IDS.POISON)!;
        expect(poison.passiveTrigger!.removable).toBe(true);
    });

    it('Poison 最大叠加 3 层', () => {
        const poison = SHADOW_THIEF_TOKENS.find(t => t.id === STATUS_IDS.POISON)!;
        expect(poison.stackLimit).toBe(3);
    });
});
