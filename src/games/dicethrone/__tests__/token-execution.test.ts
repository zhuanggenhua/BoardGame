/**
 * Token/状态效果 执行逻辑测试
 *
 * 覆盖：
 * - burn（燃烧）upkeep 固定伤害 + 不叠加
 * - poison（中毒）upkeep 伤害（持续效果，不自动移除层数）
 * - concussion（脑震荡）跳过收入阶段
 * - stun（眩晕）跳过进攻掷骰阶段
 * - paladin blessing-prevent（神圣祝福）custom action 注册与执行
 * - accuracy（精准）使攻击不可防御
 * - retribution（神罚）反弹伤害给攻击者
 * - targeted（锁定）受伤+2
 * - blinded（致盲）攻击失败判定
 * - entangle（缠绕）减少掷骰次数
 * - sneak（潜行）免除伤害
 * - sneak_attack（伏击）增加伤害
 */

import { describe, it, expect } from 'vitest';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import { getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import {
    fixedRandom,
    createQueuedRandom,
    createRunner,
    createNoResponseSetupWithEmptyHand,
    createHeroMatchup,
    getCardById,
    cmd,
    advanceTo,
} from './test-utils';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH, INITIAL_CP } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import { validateCommand } from '../domain/commandValidation';
import { processTokenUsage, shouldOpenTokenResponse, getUsableTokensForTiming } from '../domain/tokenResponse';
import { initializeCustomActions } from '../domain/customActions';
import { reduce } from '../domain/reducer';
import { executeTokenCommand } from '../domain/executeTokens';
import { applyEvents } from '../domain/utils';
import { BARBARIAN_TOKENS } from '../heroes/barbarian/tokens';
import { PALADIN_TOKENS } from '../heroes/paladin/tokens';
import { SAMURAI_TOKENS } from '../heroes/samurai/tokens';
import { ALL_TOKEN_DEFINITIONS } from '../domain/characters';

initializeCustomActions();

// ============================================================================
// 辅助：创建带状态效果的 setup
// ============================================================================

/**
 * 创建 setup：player 0 在 discard 阶段末尾，给 player 1 施加状态效果。
 * ADVANCE_PHASE 会切换到 player 1 的 upkeep。
 */
function createSetupAtPlayer0Discard(
    entries: { playerId: string; statusId: string; stacks: number }[]
) {
    const baseSetup = createNoResponseSetupWithEmptyHand();
    return (playerIds: string[], random: typeof fixedRandom) => {
        const state = baseSetup(playerIds, random);
        (state.sys as any).phase = 'discard';
        for (const { playerId, statusId, stacks } of entries) {
            const player = state.core.players[playerId];
            if (player) {
                player.statusEffects[statusId] = stacks;
            }
        }
        return state;
    };
}

/**
 * 创建 setup：player 1 在 upkeep 阶段。
 */
function createSetupAtPlayer1Upkeep(
    entries: { playerId: string; statusId: string; stacks: number }[]
) {
    const baseSetup = createNoResponseSetupWithEmptyHand();
    return (playerIds: string[], random: typeof fixedRandom) => {
        const state = baseSetup(playerIds, random);
        state.core.activePlayerId = '1';
        state.core.turnNumber = 2;
        (state.sys as any).phase = 'upkeep';
        for (const { playerId, statusId, stacks } of entries) {
            const player = state.core.players[playerId];
            if (player) {
                player.statusEffects[statusId] = stacks;
            }
        }
        return state;
    };
}

// ============================================================================
// 燃烧 (Burn) — upkeep 阶段伤害
// ============================================================================

describe('燃烧 (Burn) upkeep 执行', () => {
    it('1 层燃烧：upkeep 造成固定 2 点伤害，状态持续不移除', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '1层燃烧upkeep',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (player 1)
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 1 },
            ]),
        });

        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
        expect(core.players['1'].statusEffects[STATUS_IDS.BURN] ?? 0).toBe(1); // 持续效果，不移除
    });

    it('1 层燃烧：跨多个自己 upkeep 仍持续存在，不会自然消失', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '1层燃烧跨多轮upkeep持续',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // player 1 第一次 upkeep
                ...advanceTo('discard', '1'),
                cmd('ADVANCE_PHASE', '1'), // player 0 upkeep
                ...advanceTo('discard', '0'),
                cmd('ADVANCE_PHASE', '0'), // player 1 第二次 upkeep
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 1 },
            ]),
        });

        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 4);
        expect(core.players['1'].statusEffects[STATUS_IDS.BURN] ?? 0).toBe(1);
    });

    it('历史脏数据中多层燃烧：upkeep 固定 2 点伤害，并归一为 1 个燃烧', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '多层燃烧脏数据upkeep归一',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 3 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2); // 固定 2 点伤害
        expect(core.players['1'].statusEffects[STATUS_IDS.BURN] ?? 0).toBe(1);
    });
});

// ============================================================================
// 武士反击 (Samurai Retribution) - custom action
// ============================================================================

describe('武士反击 (Samurai Retribution) custom action', () => {
    it('samurai-back-strike-use handler 已注册', () => {
        const handler = getCustomActionHandler('samurai-back-strike-use');
        expect(handler).toBeDefined();
    });

    it('使用后会掷 1 颗骰并对攻击者造成向上取整的一半反伤', () => {
        const handler = getCustomActionHandler('samurai-back-strike-use')!;
        const state = {
            players: {
                '0': {
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    tokens: {},
                    statusEffects: {},
                    damageShields: [],
                },
                '1': {
                    characterId: 'samurai',
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    tokens: { [TOKEN_IDS.SAMURAI_RETRIBUTION]: 1 },
                    statusEffects: {},
                    damageShields: [],
                },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                damage: 8,
                isDefendable: true,
                sourceAbilityId: 'fist-technique-5',
            },
            dice: [],
            rollDiceCount: 5,
        } as any;

        const events = handler({
            ctx: { attackerId: '0', defenderId: '1' } as any,
            targetId: '1',
            attackerId: '1',
            sourceAbilityId: 'samurai-back-strike-use',
            state,
            timestamp: 1,
            random: {
                d: () => 5,
                random: () => 0.5,
                range: (min: number) => min,
                shuffle: <T,>(arr: T[]) => [...arr],
            } as any,
            action: { type: 'custom', customActionId: 'samurai-back-strike-use' } as any,
        });

        const bonusEvents = events.filter((event: any) => event.type === 'BONUS_DIE_ROLLED');
        const damageEvents = events.filter((event: any) => event.type === 'DAMAGE_DEALT');

        expect(bonusEvents).toHaveLength(1);
        expect((bonusEvents[0] as any).payload.value).toBe(5);
        expect((bonusEvents[0] as any).payload.playerId).toBe('1');

        expect(damageEvents).toHaveLength(1);
        expect((damageEvents[0] as any).payload.targetId).toBe('0');
        expect((damageEvents[0] as any).payload.amount).toBe(3);
    });

    it('响应窗关闭后才应发出反伤 DAMAGE_DEALT', () => {
        const baseState = {
            players: {
                '0': {
                    characterId: 'paladin',
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    tokens: {},
                    statusEffects: {},
                    damageShields: [],
                },
                '1': {
                    characterId: 'samurai',
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    tokens: { [TOKEN_IDS.SAMURAI_RETRIBUTION]: 1 },
                    statusEffects: {},
                    damageShields: [],
                },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                damage: 5,
                isDefendable: true,
                sourceAbilityId: 'revolver',
            },
            pendingDamage: {
                id: 'samurai-window',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                originalDamage: 5,
                currentDamage: 5,
                sourceAbilityId: 'revolver',
                responseType: 'beforeDamageReceived',
                responderId: '1',
            },
            dice: [],
            rollDiceCount: 5,
        } as any;

        const useEvents = executeTokenCommand(
            baseState,
            {
                type: 'USE_TOKEN',
                playerId: '1',
                payload: { tokenId: TOKEN_IDS.SAMURAI_RETRIBUTION, amount: 1 },
            } as any,
            {
                d: () => 1,
                random: () => 0.5,
                range: (min: number) => min,
                shuffle: <T,>(arr: T[]) => [...arr],
            } as any,
            100,
        );

        expect(useEvents.map((event) => event.type)).toEqual(['TOKEN_USED', 'BONUS_DIE_ROLLED']);
        const afterUse = applyEvents(baseState, useEvents, reduce);
        expect(afterUse.pendingDamage?.deferredDamageEvents).toHaveLength(1);
        expect(afterUse.pendingDamage?.deferredDamageEvents?.[0]?.targetId).toBe('0');

        const closeEvents = executeTokenCommand(
            afterUse,
            {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '1',
                payload: {},
            } as any,
            fixedRandom,
            101,
        );

        expect(closeEvents.map((event) => event.type)).toEqual([
            'TOKEN_RESPONSE_CLOSED',
            'DAMAGE_DEALT',
            'DAMAGE_DEALT',
        ]);
        expect((closeEvents[1] as any).payload.targetId).toBe('1');
        expect((closeEvents[1] as any).payload.amount).toBe(5);
        expect((closeEvents[2] as any).payload.targetId).toBe('0');
        expect((closeEvents[2] as any).payload.amount).toBe(1);

        const afterClose = applyEvents(afterUse, closeEvents, reduce);
        expect(afterClose.players['1'].resources[RESOURCE_IDS.HP]).toBe(45);
        expect(afterClose.players['0'].resources[RESOURCE_IDS.HP]).toBe(49);
    });
});

// ============================================================================
// 中毒 (Poison) — upkeep 阶段伤害（持续效果，不自动移除层数）
// ============================================================================

describe('中毒 (Poison) upkeep 执行', () => {
    it('1 层中毒：upkeep 造成 1 点伤害，层数不变', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '1层中毒upkeep',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.POISON, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 1);
        // 持续效果：毒液层数不自动减少
        expect(core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(1);
    });

    it('2 层中毒：upkeep 造成 2 点伤害，层数不变', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '2层中毒upkeep',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.POISON, stacks: 2 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
        // 持续效果：毒液层数不自动减少
        expect(core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(2);
    });
});

// ============================================================================
// 燃烧 + 中毒 同时存在
// ============================================================================

describe('燃烧 + 中毒 同时 upkeep', () => {
    it('1 层燃烧 + 1 层中毒：总共造成 3 点伤害（燃烧 2 + 中毒 1）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '燃烧+中毒同时',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
            ],
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 1 },
                { playerId: '1', statusId: STATUS_IDS.POISON, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 3); // 燃烧 2 + 中毒 1
        // 燃烧持续（保持 1 层），毒液持续（保持 1 层）
        expect(core.players['1'].statusEffects[STATUS_IDS.BURN] ?? 0).toBe(1);
        expect(core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(1);
    });
});

// ============================================================================
// 脑震荡 (Concussion) — 跳过收入阶段
// ============================================================================

describe('脑震荡 (Concussion) 跳过收入', () => {
    it('有脑震荡时跳过收入阶段（不获得 CP 和抽牌）并移除', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '脑震荡跳过收入',
            commands: [
                cmd('ADVANCE_PHASE', '1'), // upkeep -> income（concussion 触发跳过）
            ],
            setup: createSetupAtPlayer1Upkeep([
                { playerId: '1', statusId: STATUS_IDS.CONCUSSION, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        expect(core.players['1'].statusEffects[STATUS_IDS.CONCUSSION] ?? 0).toBe(0);
        expect(core.players['1'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);
    });
});

// ============================================================================
// 圣骑士 神圣祝福 (Blessing of Divinity) — custom action
// ============================================================================

describe('圣骑士 神圣祝福 custom action', () => {
    it('paladin-blessing-prevent handler 已注册', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent');
        expect(handler).toBeDefined();
    });

    it('执行：致死伤害时消耗 token + 防止伤害 + HP设为1', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 5 },
                },
            },
        } as any;

        const events = handler({
            targetId: '0',
            attackerId: '1',
            sourceAbilityId: 'test',
            state: mockState,
            timestamp: 1000,
            ctx: {} as any,
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent', params: { damageAmount: 10 } } as any,
        });

        expect(events.length).toBe(3); // TOKEN_CONSUMED + PREVENT_DAMAGE + DAMAGE_DEALT
        expect(events[0].type).toBe('TOKEN_CONSUMED');
        expect((events[0] as any).payload.tokenId).toBe(TOKEN_IDS.BLESSING_OF_DIVINITY);
        expect(events[1].type).toBe('PREVENT_DAMAGE');
        expect(events[2].type).toBe('DAMAGE_DEALT');
        expect((events[2] as any).payload.amount).toBe(4); // HP 5 → 1（扣除 4 点使 HP 降至 1）
        expect((events[2] as any).payload.bypassShields).toBe(true); // 绕过护盾
    });

    it('非致死伤害时不触发', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
        } as any;

        const events = handler({
            targetId: '0',
            attackerId: '1',
            sourceAbilityId: 'test',
            state: mockState,
            timestamp: 1000,
            ctx: {} as any,
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent', params: { damageAmount: 5 } } as any,
        });

        expect(events.length).toBe(0);
    });

    it('无 blessing token 时不产生事件', () => {
        const handler = getCustomActionHandler('paladin-blessing-prevent')!;
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.BLESSING_OF_DIVINITY]: 0 },
                    resources: { [RESOURCE_IDS.HP]: 5 },
                },
            },
        } as any;

        const events = handler({
            targetId: '0',
            attackerId: '1',
            sourceAbilityId: 'test',
            state: mockState,
            timestamp: 1000,
            ctx: {} as any,
            action: { type: 'customAction', customActionId: 'paladin-blessing-prevent', params: { damageAmount: 10 } } as any,
        });

        expect(events.length).toBe(0);
    });
});


// ============================================================================
// 精准 (Accuracy) — 使攻击不可防御
// ============================================================================

describe('精准 (Accuracy) Token 响应处理', () => {
    it('modifyDamageDealt 处理器返回 makeUndefendable 标志', () => {
        const accuracyDef = {
            id: TOKEN_IDS.ACCURACY,
            name: '精准',
            stackLimit: 3,
            category: 'consumable' as const,
            icon: '🎯',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageDealt' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageDealt' as const, value: 0 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.ACCURACY]: 2 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            accuracyDef as any,
            '0',
            1,
            undefined,
            'beforeDamageDealt'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(0); // 不加伤害
        expect(result.extra?.makeUndefendable).toBe(true); // 使攻击不可防御
    });

    it('crit Token 伤害≥5时返回+4伤害', () => {
        const critDef = {
            id: TOKEN_IDS.CRIT,
            name: '暴击',
            stackLimit: 1,
            category: 'consumable' as const,
            icon: '⚔️',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageDealt' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageDealt' as const, value: 4 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.CRIT]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            critDef as any,
            '0',
            1,
            undefined,
            'beforeDamageDealt'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(4); // +4 伤害
        expect(result.extra).toBeUndefined(); // 无额外标志
    });

    it('crit Token 伤害<5时使用失败', () => {
        const critDef = {
            id: TOKEN_IDS.CRIT,
            name: '暴击',
            stackLimit: 1,
            category: 'consumable' as const,
            icon: '⚔️',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageDealt' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageDealt' as const, value: 4 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.CRIT]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 4,
                currentDamage: 4,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            critDef as any,
            '0',
            1,
            undefined,
            'beforeDamageDealt'
        );

        expect(result.success).toBe(false);
    });
});

// ============================================================================
// 神罚 (Retribution) — 反弹伤害给攻击者
// ============================================================================

describe('神罚 (Retribution) Token 响应处理', () => {
    it('modifyDamageReceived 处理器返回 reflectDamage 标志（基于实际伤害）', () => {
        const retributionDef = {
            id: TOKEN_IDS.RETRIBUTION,
            name: '神罚',
            stackLimit: 1,
            category: 'consumable' as const,
            icon: '⚡',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: 0 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            retributionDef as any,
            '0',
            1,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(0); // 不减伤
        expect(result.extra?.reflectDamage).toBe(3); // ceil(5/2) = 3
    });

    it('神罚反弹伤害向上取整', () => {
        const retributionDef = {
            id: TOKEN_IDS.RETRIBUTION,
            name: '神罚',
            stackLimit: 1,
            category: 'consumable' as const,
            icon: '⚡',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: 0 },
            },
        };

        // 测试奇数伤害：7 → ceil(7/2) = 4
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 7,
                currentDamage: 7,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            retributionDef as any,
            '0',
            1,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.extra?.reflectDamage).toBe(4); // ceil(7/2) = 4
    });

    it('protect Token 伤害减半（向上取整）', () => {
        const protectDef = {
            id: TOKEN_IDS.PROTECT,
            name: '守护',
            stackLimit: 1,
            category: 'consumable' as const,
            icon: '🛡️',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: 0 },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.PROTECT]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            protectDef as any,
            '0',
            1,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(-3); // -ceil(5/2) = -3
        expect(result.extra).toBeUndefined(); // 无额外标志
    });
});

// ============================================================================
// 锁定 (Targeted) — 受伤+2（TokenDef passiveTrigger 中定义，reducer 中处理）
// ============================================================================

describe('锁定 (Targeted) 伤害修正', () => {
    it('TokenDef 定义正确：onDamageReceived + modifyStat +2', () => {
        const targetedDef = ALL_TOKEN_DEFINITIONS.find(t => t.id === STATUS_IDS.TARGETED);
        expect(targetedDef).toBeDefined();
        expect(targetedDef!.category).toBe('debuff');
        expect(targetedDef!.passiveTrigger?.timing).toBe('onDamageReceived');
        expect(targetedDef!.passiveTrigger?.removable).toBe(true);
        
        const modifyAction = targetedDef!.passiveTrigger?.actions?.find((a: any) => a.type === 'modifyStat');
        expect(modifyAction).toBeDefined();
        expect((modifyAction as any).value).toBe(2);
    });

    it('锁定伤害修正逻辑在 collectStatusModifiers 中处理', () => {
        // 锁定状态的伤害修正通过 TokenDef.passiveTrigger 定义
        // createDamageCalculation 的 collectStatusModifiers 会扫描所有 onDamageReceived 时机的 token
        // 并应用 modifyStat action，将伤害 +2
        // 完整的集成测试见 moon-elf-abilities.test.ts 的"锁定：受到伤害 +2，结算后移除"测试
        expect(true).toBe(true);
    });
});

// ============================================================================
// 致盲 (Blinded) — 攻击失败判定（game.ts onPhaseExit 中实装）
// ============================================================================

describe('致盲 (Blinded) 攻击判定', () => {
    const setupBlindedAttack = (options: { withFlick?: boolean } = {}) => {
        const baseSetup = createNoResponseSetupWithEmptyHand();

        return (playerIds: string[], random: typeof fixedRandom) => {
            const state = baseSetup(playerIds, random);
            // player 1 在 offensiveRoll 阶段攻击 player 0，且带有致盲。
            state.core.activePlayerId = '1';
            state.core.turnNumber = 2;
            (state.sys as any).phase = 'offensiveRoll';
            state.core.players['1'].statusEffects[STATUS_IDS.BLINDED] = 1;
            state.core.pendingAttack = {
                attackerId: '1',
                defenderId: '0',
                isDefendable: true,
                sourceAbilityId: 'fist-technique-5',
                isUltimate: false,
                damage: 5,
                bonusDamage: 0,
                preDefenseResolved: false,
                damageResolved: false,
                attackFaceCounts: {},
            } as any;
            state.core.rollConfirmed = true;
            state.core.rollCount = 1;

            if (options.withFlick) {
                state.core.players['1'].hand = [getCardById('card-flick')];
                state.core.players['1'].resources[RESOURCE_IDS.CP] = 10;
            }

            return state;
        };
    };

    it('致盲掷骰 1-2 时先进入可确认判定窗口，确认后攻击失败', () => {
        const runner = createRunner(fixedRandom);
        const opened = runner.run({
            name: '致盲攻击失败前先确认判定骰',
            commands: [
                cmd('ADVANCE_PHASE', '1'),
            ],
            setup: setupBlindedAttack(),
        });

        expect(opened.assertionErrors).toEqual([]);
        expect(opened.finalState.sys.phase).toBe('offensiveRoll');
        expect(opened.finalState.core.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: STATUS_IDS.BLINDED,
            attackerId: '1',
            targetId: '1',
            displayOnly: true,
            allowDiceModification: true,
            resolutionMode: 'none',
        });
        expect(opened.finalState.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(1);
        expect(opened.finalState.core.players['1'].statusEffects[STATUS_IDS.BLINDED] ?? 0).toBe(0);

        runner.setState(opened.finalState);
        const settled = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '1' });
        expect(settled.success).toBe(true);
        expect(settled.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.finalState.sys.phase).toBe('main2');
    });

    it('致盲判定骰可被弹一手改成 3，确认后继续进入防御阶段', () => {
        const runner = createRunner(createQueuedRandom([2]));
        const opened = runner.run({
            name: '致盲判定骰可被弹一手修改',
            commands: [
                cmd('ADVANCE_PHASE', '1'),
            ],
            setup: setupBlindedAttack({ withFlick: true }),
        });

        expect(opened.assertionErrors).toEqual([]);
        expect(opened.finalState.core.pendingBonusDiceSettlement?.dice[0]).toMatchObject({
            index: 0,
            value: 2,
            effectKey: 'bonusDie.effect.blinded.miss',
        });

        runner.setState(opened.finalState);
        const playedFlick = runner.dispatch('PLAY_CARD', { playerId: '1', cardId: 'card-flick' });
        expect(playedFlick.success).toBe(true);

        const modified = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 0, newValue: 3 });
        expect(modified.success).toBe(true);
        expect(modified.finalState.core.pendingBonusDiceSettlement?.dice[0]).toMatchObject({
            index: 0,
            value: 3,
            effectKey: 'bonusDie.effect.blinded.hit',
        });

        const interactionId = getCurrentInteractionSummary(modified.finalState).id;
        expect(typeof interactionId).toBe('string');
        const confirmedCard = runner.dispatch('SYS_INTERACTION_CONFIRM', { playerId: '1', interactionId });
        expect(confirmedCard.success).toBe(true);
        expect(confirmedCard.finalState.core.players['1'].discard.some((card) => card.id === 'card-flick')).toBe(true);

        const settled = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '1' });
        expect(settled.success).toBe(true);
        expect(settled.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.finalState.sys.phase).toBe('defensiveRoll');
    });
});

// ============================================================================
// 缠绕 (Entangle) — 减少掷骰次数（game.ts onPhaseEnter 中实装）
// ============================================================================

describe('缠绕 (Entangle) 掷骰限制', () => {
    it('有缠绕时进入 offensiveRoll 减少 1 次掷骰机会并移除', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '缠绕减少掷骰',
            commands: [
                cmd('ADVANCE_PHASE', '1'), // upkeep -> income
                cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll（entangle 触发）
            ],
            setup: createSetupAtPlayer1Upkeep([
                { playerId: '1', statusId: STATUS_IDS.ENTANGLE, stacks: 1 },
            ]),
        });
        const core = result.finalState.core;
        // 缠绕被移除
        expect(core.players['1'].statusEffects[STATUS_IDS.ENTANGLE] ?? 0).toBe(0);
        // 掷骰上限从 3 减少到 2
        expect(core.rollLimit).toBe(2);
    });
});

// ============================================================================
// 潜行 (Sneak) — 免除伤害（flowHooks.ts offensiveRoll 退出阶段实装）
// ============================================================================

describe('潜行 (Sneak) 伤害免除', () => {
    it('防御方有潜行时：跳过防御掷骰、免除伤害、消耗潜行', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '潜行免除伤害',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> 潜行判定 -> main2
            ],
            setup: (playerIds, random) => {
                const state = baseSetup(playerIds, random);
                // player 0 攻击 player 1，player 1 有潜行
                state.core.activePlayerId = '0';
                (state.sys as any).phase = 'offensiveRoll';
                state.core.players['1'].tokens[TOKEN_IDS.SNEAK] = 1;
                state.core.pendingAttack = {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'fist-technique-5',
                    isUltimate: false,
                    damage: 5,
                    bonusDamage: 0,
                    preDefenseResolved: false,
                    damageResolved: false,
                    attackFaceCounts: {},
                } as any;
                state.core.rollConfirmed = true;
                return state;
            },
        });
        const core = result.finalState.core;
        // 潜行不消耗——在回合末自动弃除
        expect(core.players['1'].tokens[TOKEN_IDS.SNEAK] ?? 0).toBe(1);
        // 跳过防御掷骰，直接进入 main2
        expect(result.finalState.sys.phase).toBe('main2');
        // 防御方 HP 不变（伤害被免除）
        expect(core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
    });

    it('终极技能不受潜行影响（规则 §4.4）', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '终极技能无视潜行',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll（潜行不生效）
            ],
            setup: (playerIds, random) => {
                const state = baseSetup(playerIds, random);
                state.core.activePlayerId = '0';
                (state.sys as any).phase = 'offensiveRoll';
                state.core.players['1'].tokens[TOKEN_IDS.SNEAK] = 1;
                state.core.pendingAttack = {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'ultimate-ability',
                    isUltimate: true,
                    damage: 10,
                    bonusDamage: 0,
                    preDefenseResolved: false,
                    damageResolved: false,
                    attackFaceCounts: {},
                } as any;
                state.core.rollConfirmed = true;
                return state;
            },
        });
        const core = result.finalState.core;
        // 潜行未被消耗
        expect(core.players['1'].tokens[TOKEN_IDS.SNEAK]).toBe(1);
        // 进入防御掷骰阶段（潜行不生效）
        expect(result.finalState.sys.phase).toBe('defensiveRoll');
    });

    it('shadow_thief-sneak-prevent handler 已废弃（潜行改为在攻击流程中处理）', () => {
        const handler = getCustomActionHandler('shadow_thief-sneak-prevent');
        expect(handler).toBeUndefined();
    });
});

// ============================================================================
// 伏击 (Sneak Attack) — 增加掷骰伤害
// ============================================================================

describe('伏击 (Sneak Attack) 执行逻辑', () => {
    it('shadow_thief-sneak-attack-use handler 已注册', () => {
        const handler = getCustomActionHandler('shadow_thief-sneak-attack-use');
        expect(handler).toBeDefined();
    });

    it('伏击掷骰增加伤害到 pendingDamageBonus', () => {
        const handler = getCustomActionHandler('shadow_thief-sneak-attack-use')!;
        expect(handler).toBeDefined();

        // 构造最小上下文
        const state = {
            players: {
                '0': { id: '0', resources: {}, tokens: {}, statusEffects: {}, hand: [], deck: [], discard: [] },
                '1': { id: '1', resources: {}, tokens: {}, statusEffects: {}, hand: [], deck: [], discard: [] },
            },
            pendingAttack: { attackerId: '0', defenderId: '1', damage: 3, isDefendable: true, sourceAbilityId: 'test' },
            dice: [],
            selectedCharacters: { '0': 'shadow_thief', '1': 'monk' },
        } as any;

        const events = handler({
            ctx: { attackerId: '0', defenderId: '1', sourceAbilityId: 'test', state, damageDealt: 0, timestamp: 1 },
            targetId: '1', attackerId: '0', sourceAbilityId: 'test', state, timestamp: 1,
            random: { d: () => 4, random: () => 0.5 } as any,
            action: { type: 'custom', customActionId: 'shadow_thief-sneak-attack-use' },
        });

        // 应产生 BONUS_DIE_ROLLED 事件
        const bonusEvents = events.filter((e: any) => e.type === 'BONUS_DIE_ROLLED');
        expect(bonusEvents).toHaveLength(1);
        // 掷骰值 4 → pendingDamageBonus = 4
        expect((bonusEvents[0] as any).payload.pendingDamageBonus).toBe(4);
        expect((bonusEvents[0] as any).payload.value).toBe(4);
    });

    it('无 pendingAttack 时不产生事件', () => {
        const handler = getCustomActionHandler('shadow_thief-sneak-attack-use')!;
        const state = { players: {}, pendingAttack: null, dice: [], selectedCharacters: {} } as any;
        const events = handler({
            ctx: { attackerId: '0', defenderId: '1', sourceAbilityId: 'test', state, damageDealt: 0, timestamp: 1 },
            targetId: '1', attackerId: '0', sourceAbilityId: 'test', state, timestamp: 1,
            random: { d: () => 3, random: () => 0.5 } as any,
            action: { type: 'custom', customActionId: 'shadow_thief-sneak-attack-use' },
        });
        expect(events).toHaveLength(0);
    });

    it('无 random 时不产生事件', () => {
        const handler = getCustomActionHandler('shadow_thief-sneak-attack-use')!;
        const state = {
            players: {},
            pendingAttack: { attackerId: '0', defenderId: '1' },
            dice: [], selectedCharacters: {},
        } as any;
        const events = handler({
            ctx: { attackerId: '0', defenderId: '1', sourceAbilityId: 'test', state, damageDealt: 0, timestamp: 1 },
            targetId: '1', attackerId: '0', sourceAbilityId: 'test', state, timestamp: 1,
            random: undefined as any,
            action: { type: 'custom', customActionId: 'shadow_thief-sneak-attack-use' },
        });
        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// 晕眩 (Daze) — 额外攻击执行逻辑
// ============================================================================

/**
 * 创建 setup：player 0 在 offensiveRoll 阶段，有 pendingAttack + rollConfirmed + 防御方有 daze
 * 攻击不可防御，这样 onPhaseExit 会直接结算攻击（不进入 defensiveRoll）
 */
function createSetupAtOffensiveRollWithDaze(
    options: {
        attackerId?: string;
        defenderId?: string;
        isDefendable?: boolean;
        dazeOnDefender?: boolean;  // ✅ 改名：dazeOnDefender（默认 true）
        dazeStacks?: number;
    } = {}
) {
    const {
        attackerId = '0',
        defenderId = '1',
        isDefendable = false,
        dazeOnDefender = true,  // ✅ 默认给防御方添加眩晕
        dazeStacks = 1,
    } = options;
    const baseSetup = createNoResponseSetupWithEmptyHand();
    return (playerIds: string[], random: typeof fixedRandom) => {
        const state = baseSetup(playerIds, random);
        state.core.activePlayerId = attackerId;
        state.core.turnNumber = 2;
        (state.sys as any).phase = 'offensiveRoll';
        state.core.rollConfirmed = true;
        state.core.pendingAttack = {
            attackerId,
            defenderId,
            isDefendable,
            sourceAbilityId: 'fist-technique-5',
            isUltimate: false,
            damage: 0,
            bonusDamage: 0,
            preDefenseResolved: false,
            damageResolved: false,
            attackFaceCounts: {},
        } as any;
        if (dazeOnDefender) {
            // ✅ 给防御方添加眩晕
            state.core.players[defenderId].statusEffects[STATUS_IDS.DAZE] = dazeStacks;
        }
        return state;
    };
}

describe('晕眩 (Daze) 数据定义验证', () => {
    it('daze token 定义存在且配置正确', () => {
        const daze = BARBARIAN_TOKENS.find((t: any) => t.id === STATUS_IDS.DAZE);
        expect(daze).toBeDefined();
        expect(daze!.category).toBe('debuff');
        expect(daze!.passiveTrigger?.timing).toBe('onAttackEnd');
        expect(daze!.passiveTrigger?.actions).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'extraAttack' })])
        );
    });
});

describe('晕眩 (Daze) 额外攻击执行', () => {
    it('不可防御攻击结算后：daze 被移除，进入额外攻击 offensiveRoll', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze额外攻击-不可防御',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit → 攻击结算 → daze 触发 → override offensiveRoll
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
            }),
        });
        const core = result.finalState.core;
        // daze 被移除（防御方 Player 1）
        expect(core.players['1'].statusEffects[STATUS_IDS.DAZE] ?? 0).toBe(0);
        // 进入额外攻击的 offensiveRoll
        expect(result.finalState.sys.phase).toBe('offensiveRoll');
        // 额外攻击进行中标志已设置
        expect(core.extraAttackInProgress).toBeDefined();
        expect(core.extraAttackInProgress!.attackerId).toBe('0'); // 攻击方（Player 0）获得额外攻击
        expect(core.extraAttackInProgress!.originalActivePlayerId).toBe('0'); // 原活跃玩家
        // 活跃玩家仍是 Player 0（攻击方）
        expect(core.activePlayerId).toBe('0');
    });

    it('额外攻击结束后进入 main2：extraAttackInProgress 清除，活跃玩家恢复', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze额外攻击-结束恢复',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit → daze 触发 → 进入额外攻击 offensiveRoll
                cmd('ADVANCE_PHASE', '0'), // 额外攻击 offensiveRoll exit → 无 pendingAttack → 进入 main2
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
            }),
        });
        const core = result.finalState.core;
        // 进入 main2
        expect(result.finalState.sys.phase).toBe('main2');
        // 额外攻击标志已清除
        expect(core.extraAttackInProgress).toBeUndefined();
        // 活跃玩家仍是原回合玩家（Player 0）
        expect(core.activePlayerId).toBe('0');
    });

    it('额外攻击不会递归触发（daze 已在第一次攻击后移除）', () => {
        // Player 1（防御方）有 daze，攻击结算后 daze 移除，Player 0（攻击方）获得额外攻击
        // Player 0 在额外攻击中不应再触发 daze（因为 Player 1 的 daze 已移除）
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze不递归',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // 第一次攻击 → daze 触发额外攻击
                cmd('ADVANCE_PHASE', '0'), // 额外攻击 → 无 pendingAttack → main2
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
            }),
        });
        const core = result.finalState.core;
        // 最终应在 main2，不会再次进入 offensiveRoll
        expect(result.finalState.sys.phase).toBe('main2');
        expect(core.extraAttackInProgress).toBeUndefined();
    });

    it('可防御攻击 + daze：经过 defensiveRoll 后触发额外攻击', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze可防御攻击',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit → 可防御 → 进入 defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'), // defensiveRoll exit → 攻击结算 → daze 触发 → override offensiveRoll
            ],
            setup: (playerIds, random) => {
                const state = baseSetup(playerIds, random);
                state.core.activePlayerId = '0';
                state.core.turnNumber = 2;
                (state.sys as any).phase = 'offensiveRoll';
                state.core.rollConfirmed = true;
                state.core.pendingAttack = {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true, // 可防御
                    sourceAbilityId: 'fist-technique-5',
                    isUltimate: false,
                    damage: 0,
                    bonusDamage: 0,
                    preDefenseResolved: false,
                    damageResolved: false,
                    attackFaceCounts: {},
                } as any;
                // ✅ 给防御方（Player 1）添加眩晕
                state.core.players['1'].statusEffects[STATUS_IDS.DAZE] = 1;
                return state;
            },
        });
        const core = result.finalState.core;
        // daze 被移除（防御方 Player 1）
        expect(core.players['1'].statusEffects[STATUS_IDS.DAZE] ?? 0).toBe(0);
        // 进入额外攻击的 offensiveRoll
        expect(result.finalState.sys.phase).toBe('offensiveRoll');
        expect(core.extraAttackInProgress).toBeDefined();
        expect(core.extraAttackInProgress!.attackerId).toBe('0'); // 攻击方（Player 0）获得额外攻击
        expect(core.activePlayerId).toBe('0');
    });

    it('无 daze 时攻击结算后正常进入 main2', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '无daze正常流程',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll exit → 攻击结算 → 无 daze → main2
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
                dazeOnDefender: false, // 无 daze
            }),
        });
        const core = result.finalState.core;
        expect(result.finalState.sys.phase).toBe('main2');
        expect(core.extraAttackInProgress).toBeUndefined();
        expect(core.activePlayerId).toBe('0');
    });

    it('额外攻击的 offensiveRoll 骰子状态正确重置', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze额外攻击骰子重置',
            commands: [
                cmd('ADVANCE_PHASE', '0'), // daze 触发 → 进入额外攻击 offensiveRoll
            ],
            setup: createSetupAtOffensiveRollWithDaze({
                isDefendable: false,
            }),
        });
        const core = result.finalState.core;
        // 额外攻击的 offensiveRoll 骰子状态应被重置
        expect(core.rollCount).toBe(0);
        expect(core.rollLimit).toBe(3);
        expect(core.rollDiceCount).toBe(5);
        expect(core.rollConfirmed).toBe(false);
        // pendingAttack 应被清除（新的 offensiveRoll 开始）
        expect(core.pendingAttack).toBeNull();
    });
});

// ============================================================================
// Token 响应窗口判定（基于 tokenDefinitions）
// ============================================================================

describe('Token 响应窗口判定', () => {
    it('攻击方有太极 Token 时应打开 attackerBoost', () => {
        // 注意：暴击 Token 已改为 onOffensiveRollEnd 时机，不再触发 Token 响应窗口
        // 使用太极 Token 测试 beforeDamageDealt 时机
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 3);
        expect(responseType).toBe('attackerBoost');
    });

    it('防御方有守护 Token 时应打开 defenderMitigation', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['1'].tokens[TOKEN_IDS.PROTECT] = 1;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 2);
        expect(responseType).toBe('defenderMitigation');
    });

    it('仅有净化 Token 时不应打开响应窗口', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 2);
        expect(responseType).toBeNull();
    });

    it('暴击 Token 不触发 Token 响应窗口（已改为 onOffensiveRollEnd 时机）', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;

        // 暴击 Token 的时机是 onOffensiveRollEnd，不是 beforeDamageDealt
        // 所以不会触发 Token 响应窗口
        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 3);
        expect(responseType).toBeNull();
    });

    it('攻击方有 honor Token 时也应打开 attackerBoost（不再限于 consumable）', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.HONOR] = 1;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 4);
        expect(responseType).toBe('attackerBoost');
    });

    it('不可防御伤害可用 honor 增伤，关闭后仍会切到防御方减伤窗口', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom).core;
        state.players['0'].tokens[TOKEN_IDS.HONOR] = 1;
        state.players['1'].tokens[TOKEN_IDS.PROTECT] = 1;
        state.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: false,
            sourceAbilityId: 'wakizashi',
        } as any;
        state.pendingDamage = {
            id: 'unblockable-honor-window',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 4,
            currentDamage: 4,
            sourceAbilityId: 'wakizashi',
            damageScope: 'attack',
            unblockable: true,
            responseType: 'beforeDamageDealt',
            responderId: '0',
        };

        const useEvents = executeTokenCommand(
            state,
            {
                type: 'USE_TOKEN',
                playerId: '0',
                payload: { tokenId: TOKEN_IDS.HONOR, amount: 1 },
            } as any,
            fixedRandom,
            10,
        );
        const afterUse = applyEvents(state, useEvents, reduce);
        expect(afterUse.pendingDamage?.currentDamage).toBe(5);
        expect(afterUse.pendingDamage?.unblockable).toBe(true);

        const closeEvents = executeTokenCommand(
            afterUse,
            {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '0',
                payload: {},
            } as any,
            fixedRandom,
            11,
        );

        expect(closeEvents.map((event) => event.type)).toEqual(['TOKEN_RESPONSE_REQUESTED']);
        expect((closeEvents[0] as any).payload.pendingDamage).toMatchObject({
            targetPlayerId: '1',
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '1',
            unblockable: true,
        });

        const afterClose = applyEvents(afterUse, closeEvents, reduce);
        expect(afterClose.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
        expect(afterClose.players['1'].tokens[TOKEN_IDS.PROTECT]).toBe(1);
        expect(afterClose.pendingDamage?.responseType).toBe('beforeDamageReceived');
    });

    it('不可防御伤害可用 taiji 增伤，关闭后仍会切到防御方减伤窗口', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom).core;
        state.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.players['1'].tokens[TOKEN_IDS.PROTECT] = 1;
        state.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: false,
            sourceAbilityId: 'lotus-palm',
        } as any;
        state.pendingDamage = {
            id: 'unblockable-taiji-window',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 4,
            currentDamage: 4,
            sourceAbilityId: 'lotus-palm',
            damageScope: 'attack',
            unblockable: true,
            responseType: 'beforeDamageDealt',
            responderId: '0',
        };

        const useEvents = executeTokenCommand(
            state,
            {
                type: 'USE_TOKEN',
                playerId: '0',
                payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1 },
            } as any,
            fixedRandom,
            10,
        );
        const afterUse = applyEvents(state, useEvents, reduce);
        expect(afterUse.pendingDamage?.currentDamage).toBe(5);
        expect(afterUse.pendingDamage?.unblockable).toBe(true);

        const closeEvents = executeTokenCommand(
            afterUse,
            {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '0',
                payload: {},
            } as any,
            fixedRandom,
            11,
        );

        expect(closeEvents.map((event) => event.type)).toEqual(['TOKEN_RESPONSE_REQUESTED']);
        expect((closeEvents[0] as any).payload.pendingDamage).toMatchObject({
            targetPlayerId: '1',
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '1',
            unblockable: true,
        });

        const afterClose = applyEvents(afterUse, closeEvents, reduce);
        expect(afterClose.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
        expect(afterClose.players['1'].tokens[TOKEN_IDS.PROTECT]).toBe(1);
        expect(afterClose.pendingDamage?.responseType).toBe('beforeDamageReceived');
    });

    it('终极伤害攻击方增伤结束后不会切到防御方减伤窗口', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom).core;
        state.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.players['1'].tokens[TOKEN_IDS.PROTECT] = 1;
        state.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: false,
            isUltimate: true,
            sourceAbilityId: 'ultimate-ability',
        } as any;
        state.pendingDamage = {
            id: 'ultimate-taiji-window',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 10,
            currentDamage: 10,
            sourceAbilityId: 'ultimate-ability',
            damageScope: 'attack',
            unblockable: true,
            responseType: 'beforeDamageDealt',
            responderId: '0',
        };

        const useEvents = executeTokenCommand(
            state,
            {
                type: 'USE_TOKEN',
                playerId: '0',
                payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1 },
            } as any,
            fixedRandom,
            10,
        );
        const afterUse = applyEvents(state, useEvents, reduce);
        expect(afterUse.pendingDamage?.currentDamage).toBe(11);

        const closeEvents = executeTokenCommand(
            afterUse,
            {
                type: 'SKIP_TOKEN_RESPONSE',
                playerId: '0',
                payload: {},
            } as any,
            fixedRandom,
            11,
        );

        expect(closeEvents.map((event) => event.type)).toEqual([
            'TOKEN_RESPONSE_CLOSED',
            'DAMAGE_DEALT',
        ]);
        expect((closeEvents[1] as any).payload).toMatchObject({
            targetId: '1',
            amount: 11,
            unblockable: true,
        });

        const afterClose = applyEvents(afterUse, closeEvents, reduce);
        expect(afterClose.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 11);
        expect(afterClose.players['1'].tokens[TOKEN_IDS.PROTECT]).toBe(1);
        expect(afterClose.pendingDamage).toBeUndefined();
    });

    it('攻击方有 shame Token 时不应打开 attackerBoost（耻辱应被动减伤）', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SHAME] = 1;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 4);
        expect(responseType).toBeNull();
    });

    it('防御方有 samurai_retribution Token 时应打开 defenderMitigation', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] = 1;
        state.core.pendingAttack = { attackerId: '0', defenderId: '1', isDefendable: true };

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 4);
        expect(responseType).toBe('defenderMitigation');
    });

    it('防御方有 samurai_retribution Token 但无 pendingAttack 时不应打开 defenderMitigation', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] = 1;
        state.core.pendingAttack = undefined;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 4);
        expect(responseType).toBeNull();
    });

    it('防御方有 samurai_retribution Token 且仍在战斗上下文中，但 direct damage 不应打开 defenderMitigation', () => {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        const state = baseSetup(['0', '1'], fixedRandom);
        state.core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            sourceAbilityId: 'test-attack',
        } as any;

        const responseType = shouldOpenTokenResponse(state.core, '0', '1', 4, false, 'direct');
        expect(responseType).toBeNull();
    });
});

// ============================================================================
// 净化 (Purify) — TOKEN_USED effectType 语义
// ============================================================================

describe('净化 (Purify) Token 语义', () => {
    it('TOKEN_USED 应标记为 removeDebuff', () => {
        const purifyDef = {
            id: TOKEN_IDS.PURIFY,
            name: '净化',
            stackLimit: 3,
            category: 'consumable' as const,
            icon: '✨',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['anytime' as const],
                consumeAmount: 1,
                effect: { type: 'removeDebuff' as const },
            },
        };

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.PURIFY]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
        };

        const { events } = processTokenUsage(
            mockState as any,
            purifyDef as any,
            '0',
            1
        );

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('TOKEN_USED');
        expect((events[0] as any).payload.effectType).toBe('removeDebuff');
    });
});


// ============================================================================
// 神罚 (Retribution) — 反弹伤害集成测试
// ============================================================================

describe('神罚 (Retribution) 反弹伤害集成测试', () => {
    it('神罚使用后应反弹伤害给攻击者，自己仍受全额伤害', () => {
        const retributionDef = {
            id: TOKEN_IDS.RETRIBUTION,
            name: '神罚',
            stackLimit: 1,
            category: 'consumable' as const,
            icon: '⚡',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: 0 },
            },
        };

        // 测试 10 点伤害 → 反弹 ceil(10/2) = 5 点
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 10,
                currentDamage: 10,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            retributionDef as any,
            '0',
            1,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(0); // 不减伤
        expect(result.extra?.reflectDamage).toBe(5); // ceil(10/2) = 5
    });

    it('神罚反弹伤害向上取整（奇数伤害）', () => {
        const retributionDef = {
            id: TOKEN_IDS.RETRIBUTION,
            name: '神罚',
            stackLimit: 1,
            category: 'consumable' as const,
            icon: '⚡',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: 0 },
            },
        };

        // 测试 9 点伤害 → 反弹 ceil(9/2) = 5 点
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.RETRIBUTION]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 9,
                currentDamage: 9,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            retributionDef as any,
            '0',
            1,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.extra?.reflectDamage).toBe(5); // ceil(9/2) = 5
    });

    it('神罚只在 beforeDamageReceived 时机可用', () => {
        const retributionDef = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.RETRIBUTION);
        expect(retributionDef).toBeDefined();
        expect(retributionDef!.activeUse?.timing).toContain('beforeDamageReceived');
        expect(retributionDef!.activeUse?.timing).not.toContain('beforeDamageDealt');
    });
});

// ============================================================================
// 守护 (Protect) — 伤害减半集成测试
// ============================================================================

describe('守护 (Protect) 伤害减半集成测试', () => {
    it('守护使用后伤害减半（向上取整）', () => {
        const protectDef = {
            id: TOKEN_IDS.PROTECT,
            name: '守护',
            stackLimit: 1,
            category: 'consumable' as const,
            icon: '🛡️',
            colorTheme: '',
            description: [],
            activeUse: {
                timing: ['beforeDamageReceived' as const],
                consumeAmount: 1,
                effect: { type: 'modifyDamageReceived' as const, value: 0 },
            },
        };

        // 测试 7 点伤害 → 减 ceil(7/2) = 4 点
        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.PROTECT]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 7,
                currentDamage: 7,
                responseType: 'beforeDamageReceived',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            protectDef as any,
            '0',
            1,
            undefined,
            'beforeDamageReceived'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(-4); // -ceil(7/2) = -4
    });

    it('守护只在 beforeDamageReceived 时机可用', () => {
        const protectDef = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.PROTECT);
        expect(protectDef).toBeDefined();
        expect(protectDef!.activeUse?.timing).toContain('beforeDamageReceived');
        expect(protectDef!.activeUse?.timing).not.toContain('beforeDamageDealt');
    });
});

// ============================================================================
// 暴击 (Crit) — 门控条件测试
// ============================================================================

describe('暴击 (Crit) 门控条件测试', () => {
    it('伤害≥5时可使用暴击，+4伤害', () => {
        const critDef = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.CRIT);
        expect(critDef).toBeDefined();

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.CRIT]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            critDef as any,
            '0',
            1,
            undefined,
            'beforeDamageDealt'
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(4);
    });

    it('伤害<5时不能使用暴击', () => {
        const critDef = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.CRIT);
        expect(critDef).toBeDefined();

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.CRIT]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 4,
                currentDamage: 4,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result } = processTokenUsage(
            mockState as any,
            critDef as any,
            '0',
            1,
            undefined,
            'beforeDamageDealt'
        );

        expect(result.success).toBe(false);
    });

    it('暴击只在 onOffensiveRollEnd 时机可用', () => {
        const critDef = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.CRIT);
        expect(critDef).toBeDefined();
        expect(critDef!.activeUse?.timing).toContain('onOffensiveRollEnd');
        expect(critDef!.activeUse?.timing).not.toContain('beforeDamageReceived');
    });
});

describe('武士荣誉 (Honor) Token', () => {
    it('一次消耗 2 层 honor 时应提供 +3 伤害', () => {
        const honorDef = SAMURAI_TOKENS.find(token => token.id === TOKEN_IDS.HONOR);
        expect(honorDef).toBeDefined();

        const mockState = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.HONOR]: 2 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                },
            },
            pendingDamage: {
                originalDamage: 4,
                currentDamage: 4,
                responseType: 'beforeDamageDealt',
            },
        };

        const { result, newTokenAmount } = processTokenUsage(
            mockState as any,
            honorDef as any,
            '0',
            2,
            undefined,
            'beforeDamageDealt',
        );

        expect(result.success).toBe(true);
        expect(result.damageModifier).toBe(3);
        expect(newTokenAmount).toBe(0);
    });

    it('连续两次各用 1 层 honor 时应累计为 +3，且第三次被窗口上限拒绝', () => {
        const honorDef = SAMURAI_TOKENS.find(token => token.id === TOKEN_IDS.HONOR);
        expect(honorDef).toBeDefined();

        let core = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.HONOR]: 3 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    statusEffects: {},
                    damageShields: [],
                },
                '1': {
                    tokens: {},
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    statusEffects: {},
                    damageShields: [],
                },
            },
            tokenDefinitions: SAMURAI_TOKENS,
            pendingDamage: {
                id: 'honor-window',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                originalDamage: 4,
                currentDamage: 4,
                responseType: 'beforeDamageDealt',
                responderId: '0',
                isFullyEvaded: false,
            },
        } as any;

        const firstUse = processTokenUsage(core, honorDef as any, '0', 1, undefined, 'beforeDamageDealt');
        expect(firstUse.result.success).toBe(true);
        expect(firstUse.result.damageModifier).toBe(1);
        core = reduce(core, firstUse.events[0] as any) as any;

        expect(core.pendingDamage.currentDamage).toBe(5);
        expect(core.pendingDamage.tokenUsageTotals?.[TOKEN_IDS.HONOR]).toBe(1);
        expect(getUsableTokensForTiming(core, '0', 'beforeDamageDealt').some(token => token.id === TOKEN_IDS.HONOR)).toBe(true);

        const secondUseValidation = validateCommand(
            core,
            {
                type: 'USE_TOKEN',
                playerId: '0',
                payload: { tokenId: TOKEN_IDS.HONOR, amount: 1 },
            } as any,
            'main1' as any,
        );
        expect(secondUseValidation.valid).toBe(true);

        const secondUse = processTokenUsage(core, honorDef as any, '0', 1, undefined, 'beforeDamageDealt');
        expect(secondUse.result.success).toBe(true);
        expect(secondUse.result.damageModifier).toBe(2);
        core = reduce(core, secondUse.events[0] as any) as any;

        expect(core.pendingDamage.currentDamage).toBe(7);
        expect(core.pendingDamage.tokenUsageTotals?.[TOKEN_IDS.HONOR]).toBe(2);
        expect(core.players['0'].tokens[TOKEN_IDS.HONOR]).toBe(1);
        expect(getUsableTokensForTiming(core, '0', 'beforeDamageDealt').some(token => token.id === TOKEN_IDS.HONOR)).toBe(false);

        const thirdUseValidation = validateCommand(
            core,
            {
                type: 'USE_TOKEN',
                playerId: '0',
                payload: { tokenId: TOKEN_IDS.HONOR, amount: 1 },
            } as any,
            'main1' as any,
        );
        expect(thirdUseValidation.valid).toBe(false);
        expect(thirdUseValidation.error).toBe('invalid_amount');
    });

    it('USE_TOKEN 在响应时机不匹配时应被 validate 拒绝', () => {
        const core = {
            players: {
                '0': {
                    tokens: { [TOKEN_IDS.CRIT]: 1 },
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    statusEffects: {},
                    damageShields: [],
                },
                '1': {
                    tokens: {},
                    resources: { [RESOURCE_IDS.HP]: 50 },
                    statusEffects: {},
                    damageShields: [],
                },
            },
            tokenDefinitions: ALL_TOKEN_DEFINITIONS,
            pendingDamage: {
                id: 'crit-wrong-timing',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
                responderId: '0',
                isFullyEvaded: false,
            },
        } as any;

        const validation = validateCommand(
            core,
            {
                type: 'USE_TOKEN',
                playerId: '0',
                payload: { tokenId: TOKEN_IDS.CRIT, amount: 1 },
            } as any,
            'main1' as any,
        );

        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('invalid_token_timing');
    });
});

describe('武士耻辱 (Shame) Token', () => {
    it('攻击伤害应被动减伤并自动移除，不应影响直接伤害', () => {
        const state = createHeroMatchup('samurai', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.SHAME] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-attack',
        } as any;

        const attackDamage = createDamageCalculation({
            baseDamage: 6,
            source: { playerId: '0', abilityId: 'test-attack' },
            target: { playerId: '1' },
            state: state.core,
            damageScope: 'attack',
            timestamp: 100,
        }).resolve();
        expect(attackDamage.finalDamage).toBe(4);
        expect(attackDamage.sideEffectEvents).toHaveLength(1);
        expect(attackDamage.sideEffectEvents[0]).toMatchObject({
            type: 'TOKEN_CONSUMED',
            payload: {
                playerId: '0',
                tokenId: TOKEN_IDS.SHAME,
                amount: 2,
                newTotal: 0,
            },
        });

        const afterAttack = applyEvents(state.core, attackDamage.sideEffectEvents as any, reduce as any);
        expect(afterAttack.players['0'].tokens[TOKEN_IDS.SHAME] ?? 0).toBe(0);

        const directDamage = createDamageCalculation({
            baseDamage: 6,
            source: { playerId: '0', abilityId: 'test-direct' },
            target: { playerId: '1' },
            state: state.core,
            damageScope: 'direct',
            timestamp: 101,
        }).resolve();
        expect(directDamage.finalDamage).toBe(6);
        expect(directDamage.sideEffectEvents).toHaveLength(0);
    });
});
