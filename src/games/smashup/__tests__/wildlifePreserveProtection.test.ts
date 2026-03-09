/**
 * 大杀四方 - 野生保护区 (wildlife_preserve) 保护测试
 *
 * 验证 'action' 类型保护在交互解决路径中生效：
 * - 对手打出行动卡 → 创建交互选择目标 → 交互解决 → afterEvents 产生 MINION_DESTROYED
 * - afterEvents 中的保护过滤应阻止消灭
 *
 * 这是 wildlife_preserve 的核心 bug 修复验证：
 * 修复前，保护过滤只在 execute() 后处理中执行，交互解决路径绕过了保护。
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry, isMinionProtected } from '../domain/ongoingEffects';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { runCommand } from './testRunner';
import { makeMinion, makePlayer, makeState, makeMatchState, makeCard } from './helpers';
import type { BaseInPlay, OngoingActionOnBase } from '../domain/types';
import { SU_EVENTS, SU_COMMANDS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

// ============================================================================
// 初始化
// ============================================================================

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeBase(defId: string, overrides?: Partial<BaseInPlay>): BaseInPlay {
    return { defId, minions: [], ongoingActions: [], ...overrides };
}

function makeOngoing(uid: string, defId: string, ownerId: string): OngoingActionOnBase {
    return { uid, defId, ownerId };
}

// ============================================================================
// 野生保护区：'action' 保护检查（单元测试）
// ============================================================================

describe('wildlife_preserve: action 保护检查', () => {
    it('对手随从在有 wildlife_preserve 的基地上受 action 保护', () => {
        const base = makeBase('test_base', {
            minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })],
            ongoingActions: [makeOngoing('wp1', 'dino_wildlife_preserve', '0')],
        });
        const state = makeState({ bases: [base] });
        const minion = base.minions[0];
        // 对手（玩家1）的效果应被 action 保护阻止
        expect(isMinionProtected(state, minion, 0, '1', 'action')).toBe(true);
    });

    it('己方效果不受 wildlife_preserve 保护', () => {
        const base = makeBase('test_base', {
            minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })],
            ongoingActions: [makeOngoing('wp1', 'dino_wildlife_preserve', '0')],
        });
        const state = makeState({ bases: [base] });
        const minion = base.minions[0];
        // 己方（玩家0）的效果不受保护
        expect(isMinionProtected(state, minion, 0, '0', 'action')).toBe(false);
    });

    it('wildlife_preserve 不在场时不提供保护', () => {
        const base = makeBase('test_base', {
            minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })],
        });
        const state = makeState({ bases: [base] });
        const minion = base.minions[0];
        expect(isMinionProtected(state, minion, 0, '1', 'action')).toBe(false);
    });

    it('wildlife_preserve 只保护拥有者的随从', () => {
        const base = makeBase('test_base', {
            minions: [
                makeMinion('m0', 'test_minion', '0', 3),
                makeMinion('m1', 'test_minion', '1', 3),
            ],
            ongoingActions: [makeOngoing('wp1', 'dino_wildlife_preserve', '0')],
        });
        const state = makeState({ bases: [base] });
        // 玩家0的随从受保护（对手玩家1的效果）
        expect(isMinionProtected(state, base.minions[0], 0, '1', 'action')).toBe(true);
        // 玩家1的随从不受保护（wildlife_preserve 的 ownerId 是 '0'，不保护 '1' 的随从）
        expect(isMinionProtected(state, base.minions[1], 0, '0', 'action')).toBe(false);
    });

    it('POD 版 wildlife_preserve_pod 也提供同样的 action 保护', () => {
        const base = makeBase('test_base', {
            minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })],
            ongoingActions: [makeOngoing('wp1', 'dino_wildlife_preserve_pod', '0')],
        });
        const state = makeState({ bases: [base] });
        const minion = base.minions[0];

        expect(isMinionProtected(state, minion, 0, '1', 'action')).toBe(true);
        expect(isMinionProtected(state, minion, 0, '0', 'action')).toBe(false);
    });
});

// ============================================================================
// 野生保护区：交互解决路径保护（集成测试）
// ============================================================================

describe('wildlife_preserve: 交互解决路径中阻止行动卡效果', () => {
    /**
     * 核心场景：对手打出行动卡（手里剑）消灭随从 → 交互解决 → afterEvents 应阻止消灭
     *
     * 流程：
     * 1. P1 打出 ninja_seeing_stars（行动卡）→ execute 创建交互
     * 2. SYS_INTERACTION_RESPOND → SimpleChoiceSystem 解决 → SYS_INTERACTION_RESOLVED
     * 3. SmashUpEventSystem.afterEvents 调用 handler → 产生 MINION_DESTROYED
     * 4. afterEvents 中的 processDestroyTriggers 应检测到 'action' 保护 → 过滤掉 MINION_DESTROYED
     */
    it('对手行动卡通过交互消灭随从时，wildlife_preserve 阻止消灭', () => {
        // 构造状态：基地上有 P0 的随从 + wildlife_preserve
        const base = makeBase('test_base', {
            minions: [makeMinion('target_m', 'test_minion_weak', '0', 2, { powerModifier: 0 })],
            ongoingActions: [makeOngoing('wp1', 'dino_wildlife_preserve', '0')],
        });
        const core = makeState({
            bases: [base],
            currentPlayerIndex: 1, // P1 的回合
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.NINJAS, SMASHUP_FACTION_IDS.ALIENS],
                    hand: [makeCard('action1', 'ninja_seeing_stars', 'action', '1')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
            },
        });
        const ms = makeMatchState(core);

        // Step 1: P1 打出手里剑（行动卡）
        const playResult = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'action1' },
            timestamp: 1000,
        });
        expect(playResult.success).toBe(true);

        // 应创建交互（选择目标随从）
        const interaction = playResult.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect((interaction!.data as any).sourceId).toBe('ninja_seeing_stars');

        // Step 2: P1 选择 P0 的随从作为目标
        const respondResult = runCommand(playResult.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '1',
            payload: { optionId: 'minion-0' },
            timestamp: 1001,
        });
        expect(respondResult.success).toBe(true);

        // Step 3: 验证随从未被消灭（wildlife_preserve 保护生效）
        const finalBase = respondResult.finalState.core.bases[0];
        const targetMinion = finalBase.minions.find(m => m.uid === 'target_m');
        expect(targetMinion).toBeDefined(); // 随从仍在场上

        // 验证没有 MINION_DESTROYED 事件（被过滤掉了）
        const destroyEvents = respondResult.events.filter(
            e => e.type === SU_EVENTS.MINION_DESTROYED
        );
        expect(destroyEvents).toHaveLength(0);
    });

    it('无 wildlife_preserve 时，行动卡正常消灭随从', () => {
        // 对照组：没有 wildlife_preserve 时消灭应正常生效
        const base = makeBase('test_base', {
            minions: [makeMinion('target_m', 'test_minion_weak', '0', 2, { powerModifier: 0 })],
            // 无 ongoingActions
        });
        const core = makeState({
            bases: [base],
            currentPlayerIndex: 1, // P1 的回合
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.NINJAS, SMASHUP_FACTION_IDS.ALIENS],
                    hand: [makeCard('action1', 'ninja_seeing_stars', 'action', '1')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
            },
        });
        const ms = makeMatchState(core);

        // P1 打出手里剑
        const playResult = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'action1' },
            timestamp: 1000,
        });
        expect(playResult.success).toBe(true);
        const interaction = playResult.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();

        // P1 选择目标
        const respondResult = runCommand(playResult.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '1',
            payload: { optionId: 'minion-0' },
            timestamp: 1001,
        });
        expect(respondResult.success).toBe(true);

        // 随从应被消灭
        const finalBase = respondResult.finalState.core.bases[0];
        const targetMinion = finalBase.minions.find(m => m.uid === 'target_m');
        expect(targetMinion).toBeUndefined(); // 随从已被消灭
    });
});
