/**
 * 大杀四方 - 野生保护区 (wildlife_preserve) 保护测试
 *
 * 验证 'action' 类型保护在交互解决路径中生效：
 * - 对手打出行动卡时，受保护目标不应进入可选列表
 * - 若所有目标都被保护，则不应创建空交互，也不应产生 MINION_DESTROYED
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
import { startDuel } from '../domain/duel';
import { filterProtectedAffectEvents } from '../domain/reducer';
import { runCommand } from './testRunner';
import { findInteractionOption, makeMinion, makePlayer, makeState, makeMatchState, makeCard, resolveInteractionChain } from './helpers';
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

describe('wildlife_preserve: 统一 affect 保护过滤', () => {
    function makeProtectedState() {
        const base = makeBase('test_base', {
            minions: [makeMinion('target_m', 'test_minion', '0', 3, { powerModifier: 0 })],
            ongoingActions: [makeOngoing('wp1', 'dino_wildlife_preserve', '0')],
        });
        return makeState({ bases: [base] });
    }

    it('会拦住对手行动牌导致的回手', () => {
        const state = makeProtectedState();
        const filtered = filterProtectedAffectEvents([{
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'target_m',
                minionDefId: 'test_minion',
                fromBaseIndex: 0,
                toPlayerId: '0',
                reason: 'pirate_shanghai',
                sourcePlayerId: '1',
                sourceCardUid: 'opp-action-1',
                sourceDefId: 'pirate_shanghai',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as any], state, '1');

        expect(filtered).toEqual([]);
    });

    it.each([
        ['牌库底', SU_EVENTS.CARD_TO_DECK_BOTTOM],
        ['牌库顶', SU_EVENTS.CARD_TO_DECK_TOP],
    ])('会拦住对手行动牌导致的洗回%s', (_label, eventType) => {
        const state = makeProtectedState();
        const filtered = filterProtectedAffectEvents([{
            type: eventType,
            payload: {
                cardUid: 'target_m',
                defId: 'test_minion',
                ownerId: '0',
                reason: 'pirate_full_sail',
                sourcePlayerId: '1',
                sourceCardUid: 'opp-action-2',
                sourceDefId: 'pirate_full_sail',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as any], state, '1');

        expect(filtered).toEqual([]);
    });

    it('会拦住对手行动牌导致的控制权变化', () => {
        const state = makeProtectedState();
        const filtered = filterProtectedAffectEvents([{
            type: SU_EVENTS.MINION_CONTROL_CHANGED,
            payload: {
                minionUid: 'target_m',
                minionDefId: 'test_minion',
                baseIndex: 0,
                ownerId: '0',
                fromControllerId: '0',
                toControllerId: '1',
                reason: 'ghost_make_contact',
                sourcePlayerId: '1',
                sourceCardUid: 'opp-action-3',
                sourceDefId: 'ghost_make_contact',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as any], state, '1');

        expect(filtered).toEqual([]);
    });

    it('会拦住对手行动牌导致的压制', () => {
        const state = makeProtectedState();
        const filtered = filterProtectedAffectEvents([{
            type: SU_EVENTS.CARD_SUPPRESSED,
            payload: {
                cardUid: 'target_m',
                baseIndex: 0,
                suppressorPlayerId: '1',
                cardType: 'minion',
                reason: 'wizard_mass_enchantment',
                sourcePlayerId: '1',
                sourceCardUid: 'opp-action-4',
                sourceDefId: 'wizard_mass_enchantment',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as any], state, '1');

        expect(filtered).toEqual([]);
    });
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
 * 1. P1 打出 ninja_seeing_stars（行动卡）
 * 2. 目标筛选阶段即过滤受 wildlife_preserve 保护的随从
 * 3. 因为没有合法目标，不创建交互，也不会产生 MINION_DESTROYED
     */
    it('对手行动卡的目标若全部受 wildlife_preserve 保护，则不创建空交互也不消灭随从', () => {
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

        // 不应创建空交互
        const interaction = playResult.finalState.sys.interaction?.current;
        expect(interaction).toBeUndefined();

        // 验证随从未被消灭
        const finalBase = playResult.finalState.core.bases[0];
        const targetMinion = finalBase.minions.find(m => m.uid === 'target_m');
        expect(targetMinion).toBeDefined(); // 随从仍在场上

        // 验证没有 MINION_DESTROYED 事件
        const destroyEvents = playResult.events.filter(
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

    it('wildlife_preserve 不应阻止枪手决斗消灭失败的敌方随从', () => {
        const base = makeBase('test_base', {
            minions: [
                makeMinion('gun-1', 'cowboys_gunfighter', '0', 3, { powerModifier: 4 }),
                makeMinion('enemy-1', 'alien_collector', '1', 2, { powerModifier: 1 }),
            ],
            ongoingActions: [makeOngoing('wp1', 'dino_wildlife_preserve', '1')],
        });
        const started = startDuel(makeMatchState(makeState({
            bases: [base],
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.WIZARDS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.ALIENS],
                }),
            },
        })), {
            sourceId: 'cowboys_gunfighter',
            sourcePlayerId: '0',
            challengerMinionUid: 'gun-1',
            challengedMinionUid: 'enemy-1',
            outcome: 'destroy_loser',
            destroyReason: 'cowboys_gunfighter',
        }, 1000);

        const resolved = resolveInteractionChain(started, (prompt) => {
            const skip = findInteractionOption(prompt, option => option?.value?.skip === true);
            if (!skip) {
                throw new Error(`未找到可跳过的决斗选项: ${prompt?.data?.sourceId ?? 'unknown'}`);
            }
            return { optionId: skip.id };
        });

        const destroyEvents = resolved.events.filter(
            event => event.type === SU_EVENTS.MINION_DESTROYED && (event as any).payload?.minionUid === 'enemy-1',
        );
        expect(destroyEvents).toHaveLength(1);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'enemy-1')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'gun-1')).toBe(true);
    });
});
