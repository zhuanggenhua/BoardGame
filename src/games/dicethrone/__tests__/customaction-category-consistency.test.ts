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
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';

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
const ADVISORY_EVENT_CATEGORY_MAP: Record<string, string | string[]> = {
    'STATUS_APPLIED': 'status',
    'STATUS_REMOVED': 'status',
    'HEAL_APPLIED': 'resource',
    // 现状：部分 handler 仍将 token 视为 resource（历史兼容），也有 handler 显式标记为 token。
    // 建议级检查接受二者其一，避免制造噪音。
    'TOKEN_GRANTED': ['token', 'resource'],
    'TOKEN_CONSUMED': ['token', 'resource'],
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
function createMockState(actionId: string): any {
    const isSamuraiDefense = actionId === 'samurai-stand-tall' || actionId === 'samurai-stand-tall-2';
    const isNinjaDefense = actionId === 'ninja-blink' || actionId === 'ninja-blink-2';

    const p0CharId = isSamuraiDefense ? 'samurai' : isNinjaDefense ? 'ninja' : 'pyromancer';
    const p1CharId = 'monk';

    const p0Data = CHARACTER_DATA_MAP[p0CharId];
    const p1Data = CHARACTER_DATA_MAP[p1CharId];

    const baseState = {
        players: {
            '0': {
                characterId: p0CharId,
                resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                tokens: isSamuraiDefense || isNinjaDefense ? {} : { [TOKEN_IDS.FIRE_MASTERY]: 3 },
                tokenStackLimits: isSamuraiDefense || isNinjaDefense ? {} : { [TOKEN_IDS.FIRE_MASTERY]: 5 },
                statusEffects: {},
                abilities: p0Data.abilities,
                hand: [{ id: 'test-card', name: 'Test', type: 'action' as const, cost: 0, effects: [], description: '', timing: 'instant' as const }],
                deck: [],
                discard: [],
                abilityLevels: {},
                dice: p0Data.diceDefinition,
            },
            '1': {
                characterId: p1CharId,
                resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                tokens: {},
                tokenStackLimits: {},
                statusEffects: {},
                abilities: p1Data.abilities,
                hand: [{ id: 'test-card-2', name: 'Test2', type: 'action' as const, cost: 0, effects: [], description: '', timing: 'instant' as const }],
                deck: [],
                discard: [],
                abilityLevels: {},
                dice: p1Data.diceDefinition,
            },
        },
        activePlayerId: '0',
        rollDiceCount: 5,
        tokenDefinitions: ALL_TOKEN_DEFINITIONS,
        pendingAttack: {
            attackerId: isSamuraiDefense || isNinjaDefense ? '1' : '0',
            defenderId: isSamuraiDefense || isNinjaDefense ? '0' : '1',
            abilityId: 'test-ability',
            attackDiceFaceCounts: { fire: 2, magma: 1, fiery_soul: 1, meteor: 1 },
            bonusDamage: 0,
        },
    };

    if (isSamuraiDefense) {
        // Stand Tall 反伤依赖 getFaceCounts(getActiveDice(state)) 的 die.symbol
        // 这里显式构造至少 1 个 katana，以确保能产生 DAMAGE_DEALT（用于 categories 反向检查）
        return {
            ...baseState,
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'katana', definitionId: p0Data.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-1', value: 2, locked: false, symbol: 'katana', definitionId: p0Data.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-2', value: 4, locked: false, symbol: 'helm', definitionId: p0Data.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-3', value: 6, locked: false, symbol: 'rising_sun', definitionId: p0Data.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-4', value: 1, locked: false, symbol: 'katana', definitionId: p0Data.diceDefinition?.[0]?.id ?? 'samurai-die' },
            ],
        };
    }

    if (isNinjaDefense) {
        return {
            ...baseState,
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'katana', definitionId: p0Data.diceDefinition?.[0]?.id ?? 'ninja-die' },
                { id: 'die-1', value: 4, locked: false, symbol: 'shuriken', definitionId: p0Data.diceDefinition?.[0]?.id ?? 'ninja-die' },
                { id: 'die-2', value: 6, locked: false, symbol: 'mask', definitionId: p0Data.diceDefinition?.[0]?.id ?? 'ninja-die' },
            ],
        };
    }

    return {
        ...baseState,
        dice: Array.from({ length: 5 }, (_, i) => ({
            id: `die-${i}`,
            value: 1,
            locked: false,
            definitionId: p0Data.diceDefinition?.[0]?.id ?? 'pyromancer-die',
        })),
    };
}

/** 构建 mock CustomActionContext */
function createMockContext(actionId: string, state: any): CustomActionContext {
    const mockRandom: any = Object.assign(
        () => 0.5,
        { d: (n: number) => Math.ceil(0.5 * n), random: () => 0.5 }
    );

    const isSamuraiDefense = actionId === 'samurai-stand-tall' || actionId === 'samurai-stand-tall-2';
    const isNinjaDefense = actionId === 'ninja-blink' || actionId === 'ninja-blink-2';

    return {
        ctx: {
            // defensiveRoll 会把“当前执行防御技的玩家”放到 ctx.attackerId，
            // Stand Tall 内部会从 ctx.defenderId 取回原始进攻方
            attackerId: isSamuraiDefense || isNinjaDefense ? '0' : '0',
            defenderId: isSamuraiDefense || isNinjaDefense ? '1' : '1',
            sourceAbilityId: 'test-ability',
            state,
            damageDealt: 0,
            timestamp: 1000,
        },
        targetId: isSamuraiDefense || isNinjaDefense ? '0' : '1',
        attackerId: isSamuraiDefense || isNinjaDefense ? '0' : '0',
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
        const state = createMockState(actionId);
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

            for (const [eventType, requiredCategory] of Object.entries(CRITICAL_EVENT_CATEGORY_MAP)) {
                if (eventTypes.has(eventType) && !meta.categories.includes(requiredCategory as any)) {
                    violations.push(
                        `[${actionId}] handler 产生 ${eventType} 但 categories=${JSON.stringify(meta.categories)} 缺少 '${requiredCategory}'。` +
                        `这会导致依赖 categories 的门控（如 playerAbilityHasDamage）发生误判。`
                    );
                }
            }
        }

        expect(violations).toEqual([]);
    });

    it('gunslinger-revolver-2-four-kind 仅在四个相同数字时触发', () => {
        const handler = getCustomActionHandler('gunslinger-revolver-2-four-kind');
        expect(handler).toBeDefined();

        const gunslingerData = CHARACTER_DATA_MAP.gunslinger;
        const monkData = CHARACTER_DATA_MAP.monk;
        const state = {
            players: {
                '0': {
                    characterId: 'gunslinger',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: gunslingerData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: gunslingerData.diceDefinition,
                },
                '1': {
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: monkData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: monkData.diceDefinition,
                },
            },
            activePlayerId: '0',
            rollDiceCount: 5,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                abilityId: 'revolver',
                bonusDamage: 0,
            },
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'bullet', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
                { id: 'die-1', value: 1, locked: false, symbol: 'bullet', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
                { id: 'die-2', value: 1, locked: false, symbol: 'bullet', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
                { id: 'die-3', value: 1, locked: false, symbol: 'bullet', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
                { id: 'die-4', value: 5, locked: false, symbol: 'dash', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
            ],
        };

        const ctx = createMockContext('gunslinger-revolver-2-four-kind', state);
        const events = handler!(ctx);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'STATUS_APPLIED',
            payload: {
                targetId: '1',
                statusId: 'knockdown',
                stacks: 1,
            },
        });
    });

    it('gunslinger-revolver-2-four-kind 在同符号但不足四个相同数字时不应触发', () => {
        const handler = getCustomActionHandler('gunslinger-revolver-2-four-kind');
        expect(handler).toBeDefined();

        const gunslingerData = CHARACTER_DATA_MAP.gunslinger;
        const monkData = CHARACTER_DATA_MAP.monk;
        const state = {
            players: {
                '0': {
                    characterId: 'gunslinger',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: gunslingerData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: gunslingerData.diceDefinition,
                },
                '1': {
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: monkData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: monkData.diceDefinition,
                },
            },
            activePlayerId: '0',
            rollDiceCount: 5,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                abilityId: 'revolver',
                bonusDamage: 0,
            },
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'bullet', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
                { id: 'die-1', value: 2, locked: false, symbol: 'bullet', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
                { id: 'die-2', value: 3, locked: false, symbol: 'bullet', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
                { id: 'die-3', value: 1, locked: false, symbol: 'bullet', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
                { id: 'die-4', value: 5, locked: false, symbol: 'dash', definitionId: gunslingerData.diceDefinition?.[0]?.id ?? 'gunslinger-die' },
            ],
        };

        const ctx = createMockContext('gunslinger-revolver-2-four-kind', state);
        expect(handler!(ctx)).toEqual([]);
    });

    it('samurai-katana-slice-threshold-4 仅在四个相同数字时触发', () => {
        const handler = getCustomActionHandler('samurai-katana-slice-threshold-4');
        expect(handler).toBeDefined();

        const samuraiData = CHARACTER_DATA_MAP.samurai;
        const monkData = CHARACTER_DATA_MAP.monk;
        const state = {
            players: {
                '0': {
                    characterId: 'samurai',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: samuraiData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: samuraiData.diceDefinition,
                },
                '1': {
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: monkData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: monkData.diceDefinition,
                },
            },
            activePlayerId: '0',
            rollDiceCount: 5,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                abilityId: 'katana-slice',
                bonusDamage: 0,
            },
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'katana', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-1', value: 1, locked: false, symbol: 'katana', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-2', value: 1, locked: false, symbol: 'katana', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-3', value: 1, locked: false, symbol: 'katana', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-4', value: 6, locked: false, symbol: 'rising_sun', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
            ],
        };

        const ctx = createMockContext('samurai-katana-slice-threshold-4', state);
        const events = handler!(ctx);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: '1',
                tokenId: 'shame',
                amount: 1,
            },
        });
    });

    it('samurai-katana-slice-threshold-3 仅在三个相同数字时触发', () => {
        const handler = getCustomActionHandler('samurai-katana-slice-threshold-3');
        expect(handler).toBeDefined();

        const samuraiData = CHARACTER_DATA_MAP.samurai;
        const monkData = CHARACTER_DATA_MAP.monk;
        const state = {
            players: {
                '0': {
                    characterId: 'samurai',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: samuraiData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: samuraiData.diceDefinition,
                },
                '1': {
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: monkData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: monkData.diceDefinition,
                },
            },
            activePlayerId: '0',
            rollDiceCount: 5,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                abilityId: 'katana-slice',
                bonusDamage: 0,
            },
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'katana', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-1', value: 1, locked: false, symbol: 'katana', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-2', value: 1, locked: false, symbol: 'katana', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-3', value: 4, locked: false, symbol: 'helm', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
                { id: 'die-4', value: 6, locked: false, symbol: 'rising_sun', definitionId: samuraiData.diceDefinition?.[0]?.id ?? 'samurai-die' },
            ],
        };

        const ctx = createMockContext('samurai-katana-slice-threshold-3', state);
        const events = handler!(ctx);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: '1',
                tokenId: 'shame',
                amount: 1,
            },
        });
    });

    it('monk-fist-technique-3-knockdown-if-four-kind 仅在四个相同数字时触发', () => {
        const handler = getCustomActionHandler('monk-fist-technique-3-knockdown-if-four-kind');
        expect(handler).toBeDefined();

        const monkData = CHARACTER_DATA_MAP.monk;
        const barbarianData = CHARACTER_DATA_MAP.barbarian;
        const state = {
            players: {
                '0': {
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: monkData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: monkData.diceDefinition,
                },
                '1': {
                    characterId: 'barbarian',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: barbarianData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: barbarianData.diceDefinition,
                },
            },
            activePlayerId: '0',
            rollDiceCount: 5,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                abilityId: 'fist-technique',
                bonusDamage: 0,
            },
            dice: [
                { id: 'die-0', value: 2, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
                { id: 'die-1', value: 2, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
                { id: 'die-2', value: 2, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
                { id: 'die-3', value: 2, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
                { id: 'die-4', value: 5, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
            ],
        };

        const ctx = createMockContext('monk-fist-technique-3-knockdown-if-four-kind', state);
        const events = handler!(ctx);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'STATUS_APPLIED',
            payload: {
                targetId: '1',
                statusId: 'knockdown',
                stacks: 1,
            },
        });

        const nonTriggerState = {
            ...state,
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
                { id: 'die-1', value: 1, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
                { id: 'die-2', value: 2, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
                { id: 'die-3', value: 3, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
                { id: 'die-4', value: 4, locked: false, symbol: 'fist', definitionId: monkData.diceDefinition?.[0]?.id ?? 'monk-die' },
            ],
        };
        const nonTriggerCtx = createMockContext('monk-fist-technique-3-knockdown-if-four-kind', nonTriggerState);
        expect(handler!(nonTriggerCtx)).toEqual([]);
    });

    it('barbarian-slap-unblockable-if-four-kind 仅在四个相同数字时触发不可防御', () => {
        const handler = getCustomActionHandler('barbarian-slap-unblockable-if-four-kind');
        expect(handler).toBeDefined();

        const barbarianData = CHARACTER_DATA_MAP.barbarian;
        const monkData = CHARACTER_DATA_MAP.monk;
        const state = {
            players: {
                '0': {
                    characterId: 'barbarian',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: barbarianData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: barbarianData.diceDefinition,
                },
                '1': {
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: monkData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: monkData.diceDefinition,
                },
            },
            activePlayerId: '0',
            rollDiceCount: 5,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                abilityId: 'slap',
                bonusDamage: 0,
                isDefendable: true,
            },
            dice: [
                { id: 'die-0', value: 3, locked: false, symbol: 'sword', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-1', value: 3, locked: false, symbol: 'sword', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-2', value: 3, locked: false, symbol: 'sword', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-3', value: 3, locked: false, symbol: 'sword', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-4', value: 5, locked: false, symbol: 'strength', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
            ],
        };

        const ctx = createMockContext('barbarian-slap-unblockable-if-four-kind', state);
        const events = handler!(ctx);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'ATTACK_MADE_UNDEFENDABLE',
            payload: { attackerId: '0' },
        });

        const nonTriggerState = {
            ...state,
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'sword', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-1', value: 1, locked: false, symbol: 'sword', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-2', value: 2, locked: false, symbol: 'sword', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-3', value: 3, locked: false, symbol: 'sword', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-4', value: 4, locked: false, symbol: 'strength', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
            ],
        };
        const nonTriggerCtx = createMockContext('barbarian-slap-unblockable-if-four-kind', nonTriggerState);
        expect(handler!(nonTriggerCtx)).toEqual([]);
    });

    it('barbarian-steadfast-remove-status-if-three-kind 仅在攻击骰三个相同且自身有可移除状态时请求移除自身状态', () => {
        const handler = getCustomActionHandler('barbarian-steadfast-remove-status-if-three-kind');
        expect(handler).toBeDefined();

        const barbarianData = CHARACTER_DATA_MAP.barbarian;
        const monkData = CHARACTER_DATA_MAP.monk;
        const state = {
            players: {
                '0': {
                    characterId: 'barbarian',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: { concussion: 1 },
                    abilities: barbarianData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: barbarianData.diceDefinition,
                },
                '1': {
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    tokens: {},
                    tokenStackLimits: {},
                    statusEffects: {},
                    abilities: monkData.abilities,
                    hand: [],
                    deck: [],
                    discard: [],
                    abilityLevels: {},
                    dice: monkData.diceDefinition,
                },
            },
            activePlayerId: '0',
            rollDiceCount: 5,
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                abilityId: 'steadfast',
                bonusDamage: 0,
                isDefendable: true,
                attackDiceValues: [2, 2, 2, 4, 5],
            },
            dice: [
                { id: 'die-0', value: 1, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-1', value: 2, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-2', value: 3, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-3', value: 4, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-4', value: 5, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
            ],
        };

        const ctx = createMockContext('barbarian-steadfast-remove-status-if-three-kind', state);
        const events = handler!(ctx);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'INTERACTION_REQUESTED',
            payload: {
                interaction: {
                    playerId: '0',
                    sourceCardId: 'test-ability',
                    type: 'selectStatus',
                    targetPlayerIds: ['0'],
                },
            },
        });

        const noRemovableStatusState = {
            ...state,
            players: {
                ...state.players,
                '0': {
                    ...state.players['0'],
                    statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 },
                    tokens: {
                        [STATUS_IDS.CONCUSSION]: 0,
                        [STATUS_IDS.DAZE]: 0,
                    },
                },
            },
        };
        const noRemovableStatusCtx = createMockContext(
            'barbarian-steadfast-remove-status-if-three-kind',
            noRemovableStatusState,
        );
        expect(handler!(noRemovableStatusCtx)).toEqual([]);

        const nonTriggerState = {
            ...state,
            pendingAttack: {
                ...state.pendingAttack,
                attackDiceValues: [1, 1, 2, 3, 4],
            },
            dice: [
                { id: 'die-0', value: 6, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-1', value: 6, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-2', value: 6, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-3', value: 4, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
                { id: 'die-4', value: 5, locked: false, symbol: 'heart', definitionId: barbarianData.diceDefinition?.[0]?.id ?? 'barbarian-die' },
            ],
        };
        const nonTriggerCtx = createMockContext('barbarian-steadfast-remove-status-if-three-kind', nonTriggerState);
        expect(handler!(nonTriggerCtx)).toEqual([]);
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
            // 火法师火之高兴：投掷1骰，只有火焰面才加伤（通过 pendingAttack.bonusDamage 间接传递）
            'pyro-get-fired-up-roll',
            // 月精灵迷影步：防御技能，伤害依赖骰面结果（每2个弓面造成1点反伤）
            'moon_elf-elusive-step-resolve-1',
            'moon_elf-elusive-step-resolve-2',
            // 火法师熔岩护甲：防御技能，伤害依赖防御投掷骰面结果（火面数量），mock 骰子无 symbol 字段
            'magma-armor-resolve',
            'magma-armor-2-resolve',
            'magma-armor-3-resolve',
            // 火法师炎爆术：投掷额外骰子，伤害依赖骰面结果（fire 面才造成伤害），
            // mock 中骰子定义未注册导致 getPlayerDieFace 返回 null，骰面无法解析
            'pyro-blast-2-roll',
            // 火法师炎爆术 III：有 FM 时走 reroll 分支（BONUS_DICE_REROLL_REQUESTED），不直接产生 DAMAGE_DEALT
            'pyro-blast-3-roll',
            // 武僧雷霆万钧：伤害由奖励骰结算链路落地，基础 mock 只会创建待结算骰面
            'thunder-strike-roll-damage',
            'thunder-strike-2-roll-damage',
            // 圣骑士神圣祝福防御：只有致死伤害 + 有 Blessing token 时才触发，产生 DAMAGE_DEALT（将 HP 设为 1）
            'paladin-blessing-prevent',
            // 神枪手决斗：当前 handler 只发起比较/选项交互，实际伤害在 choice-resolved handler 中落地
            'gunslinger-duel-resolve',
            // 通用加攻与部分工匠 / 忍者动作会把伤害挂到当前攻击、机器人分支或后续结算路径，不在基础 mock 中直接落 DAMAGE_DEALT
            'common-add-attack-bonus',
            'artificer-activate-bots',
            'artificer-nanobot-detonate',
            'artificer-wrench-strike-branch',
            'artificer-tinker-2-defense',
            // 忍者忍术：handler 追加 BONUS_DAMAGE_ADDED 到当前攻击，不直接产生 DAMAGE_DEALT
            'ninja-ninjutsu-use',
            // 树人复仇藤蔓/野性生长 II：伤害依赖树灵数量与多骰结算路径，mock 状态未必直接落出 DAMAGE_DEALT
            'treant-vengeful-vines-2-pain',
            'treant-wild-growth-2-main',
            // 忍者多骰/多目标结算：伤害落在 bonus settlement / choice-resolved 链路，mock 状态不稳定
            'ninja-going-forward',
            'ninja-going-forward-2',
            'ninja-death-blossom',
            'ninja-death-blossom-2',
            'ninja-smoke-screen-kuji-kiri',
            // 战术家/咒缚海盗：伤害取决于防御骰、奖励骰或目标身上的诅咒金币层数
            'zhanshujia-war-monger-roll',
            'zhanshujia-war-monger-2-roll',
            'zhanshujia-war-monger-attack-damage',
            'zhanshujia-countermeasures-defense',
            // 咒缚海盗：choice request / bonus damage / 防御骰面分支不会在基础 mock 下稳定直接产出 DAMAGE_DEALT
            'cursed-pirate-curse-card-choice',
            'cursed-pirate-damage-by-cursed-coins',
            'cursed-pirate-flay-roll',
            'cursed-pirate-human-verdict-command',
            'cursed-pirate-human-defense',
            'cursed-pirate-still-wet-behind-ears-defense',
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
                if (!eventTypes.has(eventType)) continue;

                const expected = Array.isArray(expectedCategory) ? expectedCategory : [expectedCategory];
                const ok = expected.some((cat) => meta.categories.includes(cat as any));
                if (!ok) {
                    warnings.push(
                        `[${actionId}] 产生 ${eventType} 但 categories 缺少 '${expected.join("' 或 '")}'`
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
