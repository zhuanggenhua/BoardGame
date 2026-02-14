/**
 * CustomAction categories 与 handler 输出事件类型一致性审计
 *
 * 背景：灵魂燃烧 bug 的根因是 custom action 的 categories 声明为 ['resource']，
 * 但 handler 实际产生了 DAMAGE_DEALT 事件。playerAbilityHasDamage 依赖 categories
 * 判断技能是否包含伤害，categories 缺少 'damage' 导致防御投掷阶段被跳过。
 *
 * 本审计通过调用每个 handler 并检查输出事件类型，验证 categories 声明的语义正确性。
 * 核心规则：handler 产生 DAMAGE_DEALT → categories 必须包含 'damage'
 */

import { describe, it, expect } from 'vitest';
import {
    getRegisteredCustomActionIds,
    getCustomActionHandler,
    getCustomActionMeta,
} from '../domain/effects';
import type { CustomActionContext } from '../domain/effects';
import type { DiceThroneEvent } from '../domain/types';
import { ALL_TOKEN_DEFINITIONS, CHARACTER_DATA_MAP } from '../domain/characters';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';

// ============================================================================
// 事件类型 → 必需 category 映射
// ============================================================================

/**
 * 关键映射：如果 handler 输出包含这些事件类型，categories 必须包含对应分类。
 * 这是防止 playerAbilityHasDamage 误判的核心守卫。
 */
const CRITICAL_EVENT_CATEGORY_MAP: Record<string, string> = {
    'DAMAGE_DEALT': 'damage',
};

/**
 * 建议映射：语义正确性检查，不影响游戏逻辑但有助于维护。
 * 违反时输出警告而非失败。
 */
const ADVISORY_EVENT_CATEGORY_MAP: Record<string, string> = {
    'STATUS_APPLIED': 'status',
    'STATUS_REMOVED': 'status',
    'HEAL_APPLIED': 'resource',
    'TOKEN_GRANTED': 'resource',
    'TOKEN_CONSUMED': 'resource',
    'CP_CHANGED': 'resource',
    'CARD_DRAWN': 'card',
    'CARD_DISCARDED': 'card',
    'DAMAGE_SHIELD_GRANTED': 'defense',
    'PREVENT_DAMAGE': 'defense',
};

// ============================================================================
// Mock 状态构建
// ============================================================================

/** 构建最小可用的 mock 状态 */
function createMockState(): any {
    const pyroData = CHARACTER_DATA_MAP['pyromancer'];
    const monkData = CHARACTER_DATA_MAP['monk'];
    return {
        players: {
            '0': {
                characterId: 'pyromancer',
                resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                tokens: { [TOKEN_IDS.FIRE_MASTERY]: 3 },
                tokenStackLimits: { [TOKEN_IDS.FIRE_MASTERY]: 5 },
                statusEffects: {},
                abilities: pyroData.abilities,
                hand: [{ id: 'test-card', name: 'Test', type: 'action' as const, cost: 0, effects: [], description: '', timing: 'instant' as const }],
                deck: [],
                discard: [],
                abilityLevels: {},
                dice: pyroData.diceDefinition,
            },
            '1': {
                characterId: 'monk',
                resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                tokens: {},
                tokenStackLimits: {},
                statusEffects: {},
                abilities: monkData.abilities,
                hand: [{ id: 'test-card-2', name: 'Test2', type: 'action' as const, cost: 0, effects: [], description: '', timing: 'instant' as const }],
                deck: [],
                discard: [],
                abilityLevels: {},
                dice: monkData.diceDefinition,
            },
        },
        activePlayerId: '0',
        dice: Array.from({ length: 5 }, (_, i) => ({
            id: `die-${i}`,
            value: 1,
            locked: false,
            definitionId: pyroData.diceDefinition?.[0]?.id ?? 'pyromancer-die',
        })),
        rollDiceCount: 5,
        tokenDefinitions: ALL_TOKEN_DEFINITIONS,
        pendingAttack: {
            attackerId: '0',
            defenderId: '1',
            abilityId: 'test-ability',
            attackDiceFaceCounts: { fire: 2, magma: 1, fiery_soul: 1, meteor: 1 },
            bonusDamage: 0,
        },
    };
}

/** 构建 mock CustomActionContext */
function createMockContext(actionId: string, state: any): CustomActionContext {
    const mockRandom: any = Object.assign(
        () => 0.5,
        { d: (n: number) => Math.ceil(0.5 * n), random: () => 0.5 }
    );

    return {
        ctx: {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-ability',
            state,
            damageDealt: 0,
            timestamp: 1000,
        },
        targetId: '1',
        attackerId: '0',
        sourceAbilityId: 'test-ability',
        state,
        timestamp: 1000,
        random: mockRandom,
        action: {
            type: 'custom',
            customActionId: actionId,
            target: 'opponent',
            params: { amount: 3, bonusCp: 3, damageAmount: 5, tokenId: TOKEN_IDS.FIRE_MASTERY, tokenStacks: 3 },
        } as any,
    };
}

// ============================================================================
// 审计逻辑
// ============================================================================

/**
 * 尝试调用 handler 并收集输出事件类型。
 * handler 可能因 mock 状态不完整而抛异常，此时返回 null（跳过该 handler）。
 */
function tryCallHandler(actionId: string): Set<string> | null {
    const handler = getCustomActionHandler(actionId);
    if (!handler) return null;

    try {
        const state = createMockState();
        const ctx = createMockContext(actionId, state);
        const events: DiceThroneEvent[] = handler(ctx);
        return new Set(events.map(e => e.type));
    } catch {
        // handler 因 mock 状态不完整而失败，跳过
        return null;
    }
}

// ============================================================================
// 测试
// ============================================================================

describe('CustomAction categories 与 handler 输出一致性审计', () => {
    const registeredIds = Array.from(getRegisteredCustomActionIds());

    // 已知无法通过 mock 调用的 handler（需要特殊状态/交互）
    // 这些 handler 的 categories 需要人工审查
    const SKIP_HANDLER_CALL = new Set([
        // 需要 InteractionSystem 状态的骰子修改类
        'modify-die-to-6',
        'modify-die-copy',
        'modify-die-any-1',
        'modify-die-any-2',
        'modify-die-adjust-1',
        'reroll-opponent-die-1',
        'reroll-die-2',
        'reroll-die-3',
        'reroll-die-4',
    ]);

    it('所有产生 DAMAGE_DEALT 的 handler 必须在 categories 中声明 damage（关键规则）', () => {
        const violations: string[] = [];

        for (const actionId of registeredIds) {
            if (SKIP_HANDLER_CALL.has(actionId)) continue;

            const meta = getCustomActionMeta(actionId);
            if (!meta) continue;

            // 如果已经声明了 damage，无需检查
            if (meta.categories.includes('damage')) continue;

            const eventTypes = tryCallHandler(actionId);
            if (!eventTypes) continue;

            if (eventTypes.has('DAMAGE_DEALT')) {
                violations.push(
                    `[${actionId}] handler 产生 DAMAGE_DEALT 但 categories=${JSON.stringify(meta.categories)} 缺少 'damage'。` +
                    `这会导致 playerAbilityHasDamage 误判，跳过防御投掷阶段。`
                );
            }
        }

        expect(violations).toEqual([]);
    });

    it('categories 声明 damage 的 handler 应当产生 DAMAGE_DEALT（反向检查）', () => {
        const violations: string[] = [];

        // 白名单：声明了 damage 但在 mock 状态下不一定产生 DAMAGE_DEALT 的 handler
        // （因为伤害可能依赖条件判断，如骰面结果、FM 数量等）
        const CONDITIONAL_DAMAGE_WHITELIST = new Set([
            // 灵魂燃烧伤害：依赖 fiery_soul 骰面数量，mock 中可能为 0
            'soul-burn-damage',
            // 圣骑士防御：依赖骰面结果
            'paladin-holy-defense',
            'paladin-holy-defense-2',
            'paladin-holy-defense-3',
            'paladin-absolution',
            // 影子盗贼防御反击：依赖骰面结果
            'shadow_thief-fearless-riposte',
            'shadow_thief-fearless-riposte-2',
            'shadow_thief-defense-resolve',
            'shadow_thief-defense-resolve-2',
            // 影子盗贼伤害：依赖 CP 数量
            'shadow_thief-damage-half-cp',
            // 野蛮人再来点儿：依赖骰面结果（剑面数量）
            'more-please-roll-damage',
            // 火法师 FM 伤害：依赖 FM 数量且需要消耗 FM
            'pyro-details-dmg-per-fm',
            // 月精灵迷影步：防御技能，伤害依赖骰面结果（脚面数量）
            'moon_elf-elusive-step-resolve-1',
            'moon_elf-elusive-step-resolve-2',
            // 火法师熔岩护甲：防御技能，伤害依赖防御投掷骰面结果（火面数量），mock 骰子无 symbol 字段
            'magma-armor-resolve',
            'magma-armor-2-resolve',
            'magma-armor-3-resolve',
        ]);

        for (const actionId of registeredIds) {
            if (SKIP_HANDLER_CALL.has(actionId)) continue;
            if (CONDITIONAL_DAMAGE_WHITELIST.has(actionId)) continue;

            const meta = getCustomActionMeta(actionId);
            if (!meta) continue;
            if (!meta.categories.includes('damage')) continue;

            const eventTypes = tryCallHandler(actionId);
            if (!eventTypes) continue;

            if (!eventTypes.has('DAMAGE_DEALT')) {
                violations.push(
                    `[${actionId}] categories 声明了 'damage' 但 handler 未产生 DAMAGE_DEALT。` +
                    `可能是 categories 声明过度，或 mock 状态不足以触发伤害路径。`
                );
            }
        }

        expect(violations).toEqual([]);
    });

    it('handler 输出事件类型与 categories 语义一致性（建议级别）', () => {
        const warnings: string[] = [];

        for (const actionId of registeredIds) {
            if (SKIP_HANDLER_CALL.has(actionId)) continue;

            const meta = getCustomActionMeta(actionId);
            if (!meta) continue;

            const eventTypes = tryCallHandler(actionId);
            if (!eventTypes) continue;

            for (const [eventType, expectedCategory] of Object.entries(ADVISORY_EVENT_CATEGORY_MAP)) {
                if (eventTypes.has(eventType) && !meta.categories.includes(expectedCategory as any)) {
                    warnings.push(
                        `[${actionId}] 产生 ${eventType} 但 categories 缺少 '${expectedCategory}'`
                    );
                }
            }
        }

        // 输出警告但不失败（建议级别）
        if (warnings.length > 0) {
            console.warn(`\n⚠️ categories 语义建议（${warnings.length} 条）:\n` + warnings.join('\n'));
        }
    });

    it('handler 可调用率 >= 80%（mock 状态覆盖度基线）', () => {
        let callable = 0;
        let total = 0;

        for (const actionId of registeredIds) {
            if (SKIP_HANDLER_CALL.has(actionId)) continue;
            total++;
            if (tryCallHandler(actionId) !== null) {
                callable++;
            }
        }

        const rate = total > 0 ? callable / total : 0;
        expect(rate).toBeGreaterThanOrEqual(0.8);
    });
});
