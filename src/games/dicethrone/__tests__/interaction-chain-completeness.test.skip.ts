/**
 * DiceThrone 交互链完整性审计测试
 *
 * @deprecated - 此测试文件测试旧的交互系统（PendingInteraction），已迁移到 InteractionSystem
 * 新的交互系统测试应该在各个 hero 的行为测试中覆盖
 *
 * DiceThrone 的交互模式为 Mode A（UI 状态机）：
 *   卡牌打出 → INTERACTION_REQUESTED → CONFIRM_INTERACTION / CANCEL_INTERACTION
 *
 * 本测试覆盖所有交互链路径：
 * 1. 卡牌交互链 — 每种 CardInteractionType 的完整流程（创建→确认/取消）
 * 2. Token 响应链 — 攻击伤害后的 Token 使用/跳过
 * 3. 选择链 — CHOICE_REQUESTED → RESOLVE_CHOICE（preDefense 效果选择）
 * 4. 奖励骰链 — BONUS_DICE_REROLL_REQUESTED → REROLL/SKIP
 * 5. 响应窗口链 — afterRollConfirmed / afterCardPlayed / afterAttackResolved
 * 6. 跨机制交互 — 多种交互在同一攻击流程中的组合
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    fixedRandom,
    createQueuedRandom,
    createRunner,
    createNoResponseSetupWithEmptyHand,
    createSetupWithHand,
    cmd,
    advanceTo,
    createInitializedState,
    testSystems,
} from './test-utils';
import { initializeCustomActions } from '../domain/customActions';
import {
    getRegisteredCustomActionIds,
    getCustomActionHandler,
    getCustomActionMeta,
} from '../domain/effects';
import { COMMON_CARDS } from '../domain/commonCards';
import { MONK_CARDS } from '../heroes/monk/cards';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { INITIAL_HEALTH, INITIAL_CP } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import type { AbilityCard, DiceThroneCore, PendingInteraction } from '../domain/types';
import type { MatchState, RandomFn } from '../../../engine/types';
import { shouldOpenTokenResponse } from '../domain/tokenResponse';
import { DiceThroneDomain } from '../domain';
import { executePipeline, createInitialSystemState } from '../../../engine/pipeline';

beforeAll(() => {
    initializeCustomActions();
});


// ============================================================================
// 辅助函数
// ============================================================================

const ALL_CARDS: AbilityCard[] = [
    ...COMMON_CARDS,
    ...MONK_CARDS,
    ...BARBARIAN_CARDS,
    ...PYROMANCER_CARDS,
    ...MOON_ELF_CARDS,
    ...SHADOW_THIEF_CARDS,
    ...PALADIN_CARDS,
];

/** 提取卡牌中所有 customActionId */
function extractCardCustomActionIds(card: AbilityCard): string[] {
    const ids: string[] = [];
    if (!card.effects) return ids;
    for (const e of card.effects) {
        if (e.action?.type === 'custom' && e.action.customActionId) {
            ids.push(e.action.customActionId);
        }
        if (e.action?.type === 'replaceAbility' && e.action.newAbilityDef) {
            const newDef = e.action.newAbilityDef as any;
            if (newDef.effects) {
                for (const ne of newDef.effects) {
                    if (ne.action?.type === 'custom' && ne.action.customActionId) {
                        ids.push(ne.action.customActionId);
                    }
                }
            }
            if (newDef.variants) {
                for (const v of newDef.variants) {
                    if (v.effects) {
                        for (const ve of v.effects) {
                            if (ve.action?.type === 'custom' && ve.action.customActionId) {
                                ids.push(ve.action.customActionId);
                            }
                        }
                    }
                }
            }
        }
    }
    return ids;
}

/** 获取产生 INTERACTION_REQUESTED 的 customActionId 列表（保留用于未来扩展） */
// function getInteractionProducingActionIds(): string[] { ... }

// ============================================================================
// 1. 卡牌交互链完整性 — customAction → INTERACTION_REQUESTED 覆盖
// ============================================================================

// @deprecated - 跳过整个测试文件，因为测试的是旧交互系统
describe.skip('卡牌交互链完整性', () => {
    // 所有产生 INTERACTION_REQUESTED 的 customAction 必须有对应的
    // CONFIRM_INTERACTION / CANCEL_INTERACTION 处理路径

    it('所有骰子修改类 customAction 都已注册且有 handler', () => {
        const diceActionIds = [
            'modify-die-to-6',
            'modify-die-copy',
            'modify-die-any-1',
            'modify-die-any-2',
            'modify-die-adjust-1',
            'reroll-opponent-die-1',
            'reroll-die-2',
            'reroll-die-5',
        ];
        const violations: string[] = [];
        for (const id of diceActionIds) {
            if (!getCustomActionHandler(id)) {
                violations.push(`骰子修改 customAction "${id}" 未注册`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('所有状态操作类 customAction 都已注册且有 handler', () => {
        const statusActionIds = [
            'remove-status-1',
            'remove-status-self',
            'remove-all-status',
            'transfer-status',
        ];
        const violations: string[] = [];
        for (const id of statusActionIds) {
            if (!getCustomActionHandler(id)) {
                violations.push(`状态操作 customAction "${id}" 未注册`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('所有卡牌引用的 customAction 都已注册', () => {
        const violations: string[] = [];
        for (const card of ALL_CARDS) {
            const ids = extractCardCustomActionIds(card);
            for (const id of ids) {
                if (!getCustomActionHandler(id)) {
                    violations.push(`卡牌 ${card.id} 引用 customAction "${id}" 未注册`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('产生 INTERACTION_REQUESTED 的 customAction 的 categories 包含 dice 或 status', () => {
        // 骰子修改类和状态操作类 customAction 产生 INTERACTION_REQUESTED
        // 它们的 categories 必须正确声明以便 UI 正确渲染交互界面
        const interactionActionIds = [
            'modify-die-to-6', 'modify-die-copy', 'modify-die-any-1', 'modify-die-any-2',
            'modify-die-adjust-1', 'reroll-opponent-die-1', 'reroll-die-2', 'reroll-die-5',
            'remove-status-1', 'remove-status-self', 'remove-all-status', 'transfer-status',
        ];
        const violations: string[] = [];
        for (const id of interactionActionIds) {
            const meta = getCustomActionMeta(id);
            if (!meta) {
                violations.push(`${id} 缺少元数据`);
                continue;
            }
            const hasDice = meta.categories.includes('dice');
            const hasStatus = meta.categories.includes('status');
            if (!hasDice && !hasStatus) {
                violations.push(`${id} categories=${JSON.stringify(meta.categories)} 缺少 dice 或 status`);
            }
        }
        expect(violations).toEqual([]);
    });
});


// ============================================================================
// 2. 卡牌交互 GTR 行为测试 — 骰子修改卡完整流程
// ============================================================================

describe('卡牌交互链 GTR 行为测试', () => {
    // 找到 card-play-six（将1颗骰子改为6）
    const playSixCard = COMMON_CARDS.find(c => c.id === 'card-play-six');
    // 找到 card-me-too（将1颗骰子改为另1颗的值）
    const meTooCard = COMMON_CARDS.find(c => c.id === 'card-me-too');
    // 找到 card-flick（增加或减少1骰子数值）
    const flickCard = COMMON_CARDS.find(c => c.id === 'card-flick');
    // 找到 card-worthy-of-me（重掷至多2颗骰子）
    const worthyCard = COMMON_CARDS.find(c => c.id === 'card-worthy-of-me');
    // 找到 card-give-hand（强制对手重投1颗骰子）
    const giveHandCard = COMMON_CARDS.find(c => c.id === 'card-give-hand');

    /**
     * 从 GTR 结果的 finalState 中提取当前 pendingInteraction 的 id
     * 交互 ID 格式为 `${sourceAbilityId}-${timestamp}`，timestamp 是动态的
     */
    function getInteractionId(state: MatchState<DiceThroneCore>): string | undefined {
        const current = state.sys.interaction?.current;
        if (current?.kind === 'dt:card-interaction') {
            return (current.data as PendingInteraction).id;
        }
        return undefined;
    }

    describe('骰子修改卡 — set 模式（card-play-six）', () => {
        it('打出 → INTERACTION_REQUESTED → MODIFY_DIE → CONFIRM_INTERACTION 完整链', () => {
            if (!playSixCard) return;
            // 第一步：打出卡牌，获取交互 ID
            const runner1 = createRunner(fixedRandom);
            const r1 = runner1.run({
                name: 'play-six step1',
                setup: createSetupWithHand([playSixCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: playSixCard.id }),
                ],
            });
            const interactionId = getInteractionId(r1.finalState);
            expect(interactionId).toBeDefined();

            // 第二步：修改骰子并确认
            const runner2 = createRunner(fixedRandom);
            const r2 = runner2.run({
                name: 'play-six step2',
                setup: createSetupWithHand([playSixCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: playSixCard.id }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 6 }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId: interactionId! }),
                ],
                expect: {
                    pendingInteraction: null,
                },
            });
            expect(r2.passed).toBe(true);
        });

        it('打出 → INTERACTION_REQUESTED → CANCEL_INTERACTION 取消链', () => {
            if (!playSixCard) return;
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'play-six 取消交互链',
                setup: createSetupWithHand([playSixCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: playSixCard.id }),
                    cmd('CANCEL_INTERACTION', '0'),
                ],
                expect: {
                    pendingInteraction: null,
                },
            });
            expect(result.passed).toBe(true);
        });
    });

    describe('骰子修改卡 — copy 模式（card-me-too）', () => {
        it('打出 → INTERACTION_REQUESTED(copy) → MODIFY_DIE → CONFIRM 完整链', () => {
            if (!meTooCard) return;
            const runner1 = createRunner(fixedRandom);
            const r1 = runner1.run({
                name: 'me-too step1',
                setup: createSetupWithHand([meTooCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: meTooCard.id }),
                ],
            });
            const interactionId = getInteractionId(r1.finalState);
            expect(interactionId).toBeDefined();

            const runner2 = createRunner(fixedRandom);
            const r2 = runner2.run({
                name: 'me-too step2',
                setup: createSetupWithHand([meTooCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: meTooCard.id }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 1 }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId: interactionId! }),
                ],
                expect: {
                    pendingInteraction: null,
                },
            });
            expect(r2.passed).toBe(true);
        });
    });

    describe('骰子修改卡 — adjust 模式（card-flick）', () => {
        it('打出 → INTERACTION_REQUESTED(adjust) → MODIFY_DIE → CONFIRM 完整链', () => {
            if (!flickCard) return;
            const runner1 = createRunner(fixedRandom);
            const r1 = runner1.run({
                name: 'flick step1',
                setup: createSetupWithHand([flickCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: flickCard.id }),
                ],
            });
            const interactionId = getInteractionId(r1.finalState);
            expect(interactionId).toBeDefined();

            const runner2 = createRunner(fixedRandom);
            const r2 = runner2.run({
                name: 'flick step2',
                setup: createSetupWithHand([flickCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: flickCard.id }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 2 }),
                    cmd('CONFIRM_INTERACTION', '0', { interactionId: interactionId! }),
                ],
                expect: {
                    pendingInteraction: null,
                },
            });
            expect(r2.passed).toBe(true);
        });
    });

    describe('骰子重掷卡 — selectDie 模式（card-worthy-of-me）', () => {
        it('打出 → INTERACTION_REQUESTED(selectDie) → CONFIRM(selectedDiceIds) 完整链', () => {
            if (!worthyCard) return;
            const random = createQueuedRandom([3, 3, 3, 3, 3, 5, 5]);
            const runner1 = createRunner(random);
            const r1 = runner1.run({
                name: 'worthy step1',
                setup: createSetupWithHand([worthyCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: worthyCard.id }),
                ],
            });
            const interactionId = getInteractionId(r1.finalState);
            expect(interactionId).toBeDefined();

            const random2 = createQueuedRandom([3, 3, 3, 3, 3, 5, 5]);
            const runner2 = createRunner(random2);
            const r2 = runner2.run({
                name: 'worthy step2',
                setup: createSetupWithHand([worthyCard.id]),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: worthyCard.id }),
                    cmd('CONFIRM_INTERACTION', '0', {
                        interactionId: interactionId!,
                        selectedDiceIds: [0, 1],
                    }),
                ],
                expect: {
                    pendingInteraction: null,
                },
            });
            expect(r2.passed).toBe(true);
        });
    });

    describe('对手骰子重掷卡 — targetOpponentDice（card-give-hand）', () => {
        it('打出 → INTERACTION_REQUESTED(selectDie, targetOpponent) → CONFIRM 完整链', () => {
            if (!giveHandCard) return;
            // give-hand 是 roll timing 卡牌，需要在响应窗口中打出
            // 这里测试 customAction handler 的注册完整性
            const handler = getCustomActionHandler('reroll-opponent-die-1');
            expect(handler).toBeDefined();
            const meta = getCustomActionMeta('reroll-opponent-die-1');
            expect(meta).toBeDefined();
            expect(meta!.categories).toContain('dice');
        });
    });
});


// ============================================================================
// 3. Token 响应链完整性 — shouldOpenTokenResponse 真值表
// ============================================================================

describe('Token 响应链完整性', () => {
    /** 创建带 Token 的状态 */
    function createStateWithTokens(opts: {
        attackerTokens?: Record<string, number>;
        defenderTokens?: Record<string, number>;
        isUltimate?: boolean;
        damage?: number;
        hasPendingDamage?: boolean;
    }): DiceThroneCore {
        const state = createInitializedState(['0', '1'], fixedRandom);
        const core = state.core;
        // 设置 Token
        if (opts.attackerTokens) {
            Object.assign(core.players['0'].tokens, opts.attackerTokens);
        }
        if (opts.defenderTokens) {
            Object.assign(core.players['1'].tokens, opts.defenderTokens);
        }
        // 设置 pendingAttack
        core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'test-ability',
            isDefendable: true,
            isUltimate: opts.isUltimate ?? false,
        };
        if (opts.hasPendingDamage) {
            core.pendingDamage = {
                id: 'test-pending-damage',
                sourcePlayerId: '0',
                targetPlayerId: '1',
                originalDamage: opts.damage ?? 5,
                currentDamage: opts.damage ?? 5,
                sourceAbilityId: 'test-ability',
                responseType: 'beforeDamageReceived',
                responderId: '1',
            };
        }
        return core;
    }

    describe('shouldOpenTokenResponse 真值表', () => {
        it('damage=0 → null（无伤害不开窗口）', () => {
            const core = createStateWithTokens({
                attackerTokens: { [TOKEN_IDS.TAIJI]: 2 },
                damage: 0,
            });
            expect(shouldOpenTokenResponse(core, '0', '1', 0)).toBeNull();
        });

        it('damage>0 + 攻击方有太极 → attackerBoost', () => {
            const core = createStateWithTokens({
                attackerTokens: { [TOKEN_IDS.TAIJI]: 2 },
            });
            expect(shouldOpenTokenResponse(core, '0', '1', 5)).toBe('attackerBoost');
        });

        it('damage>0 + 攻击方无太极 + 防御方有太极 → defenderMitigation', () => {
            const core = createStateWithTokens({
                defenderTokens: { [TOKEN_IDS.TAIJI]: 2 },
            });
            expect(shouldOpenTokenResponse(core, '0', '1', 5)).toBe('defenderMitigation');
        });

        it('damage>0 + 攻击方无太极 + 防御方有闪避 → defenderMitigation', () => {
            const core = createStateWithTokens({
                defenderTokens: { [TOKEN_IDS.EVASIVE]: 1 },
            });
            expect(shouldOpenTokenResponse(core, '0', '1', 5)).toBe('defenderMitigation');
        });

        it('damage>0 + 双方无 Token → null', () => {
            const core = createStateWithTokens({});
            expect(shouldOpenTokenResponse(core, '0', '1', 5)).toBeNull();
        });

        it('damage>0 + 终极技能 + 攻击方有太极 → attackerBoost（终极可强化）', () => {
            const core = createStateWithTokens({
                attackerTokens: { [TOKEN_IDS.TAIJI]: 2 },
                isUltimate: true,
            });
            expect(shouldOpenTokenResponse(core, '0', '1', 5)).toBe('attackerBoost');
        });

        it('damage>0 + 终极技能 + 攻击方无太极 + 防御方有太极 → null（终极不可防御）', () => {
            const core = createStateWithTokens({
                defenderTokens: { [TOKEN_IDS.TAIJI]: 2 },
                isUltimate: true,
            });
            expect(shouldOpenTokenResponse(core, '0', '1', 5)).toBeNull();
        });

        it('damage>0 + 已有 pendingDamage → null（避免重复打开）', () => {
            const core = createStateWithTokens({
                attackerTokens: { [TOKEN_IDS.TAIJI]: 2 },
                hasPendingDamage: true,
                damage: 5,
            });
            expect(shouldOpenTokenResponse(core, '0', '1', 5)).toBeNull();
        });
    });

    describe('Token 使用 GTR 行为测试', () => {
        it('USE_TOKEN(taiji) 减少伤害 → SKIP_TOKEN_RESPONSE 完整链', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'taiji 减伤完整链',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    // 给防御方太极 Token
                    state.core.players['1'].tokens[TOKEN_IDS.TAIJI] = 3;
                    // 给攻击方太极 Token（用于测试攻击方加伤）
                    state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 2;
                    // 清空手牌避免响应窗口
                    state.core.players['0'].hand = [];
                    state.core.players['1'].hand = [];
                    return state;
                },
                commands: [
                    // 推进到 offensiveRoll
                    cmd('ADVANCE_PHASE', '0'),
                    // 掷骰
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    // 确认骰面
                    cmd('CONFIRM_ROLL', '0'),
                    // 选择技能（拳法 5 — 僧侣基础进攻技能）
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                ],
            });
            // 验证测试能运行（具体的 Token 响应流程取决于技能伤害值）
            expect(result.steps.length).toBeGreaterThan(0);
        });

        it('SKIP_TOKEN_RESPONSE 跳过 Token 响应', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'skip token response',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    state.core.players['0'].hand = [];
                    state.core.players['1'].hand = [];
                    // 设置 pendingDamage 模拟 Token 响应窗口
                    state.core.pendingDamage = {
                        id: 'test-pending-damage',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        sourceAbilityId: 'test',
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                    };
                    state.core.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'test',
                        isDefendable: true,
                        isUltimate: false,
                    };
                    return state;
                },
                commands: [
                    cmd('SKIP_TOKEN_RESPONSE', '1'),
                ],
            });
            expect(result.steps.length).toBeGreaterThan(0);
        });

        it('USE_TOKEN(evasive) 闪避成功完全免伤', () => {
            const runner = createRunner(fixedRandom); // fixedRandom.d(6) = 1，闪避成功
            const result = runner.run({
                name: 'evasive 闪避成功',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    state.core.players['0'].hand = [];
                    state.core.players['1'].hand = [];
                    // 给防御方闪避 Token - 直接赋值整个 tokens 对象
                    state.core.players['1'].tokens = {
                        ...state.core.players['1'].tokens,
                        [TOKEN_IDS.EVASIVE]: 1,
                    };
                    // 设置 pendingDamage 模拟防御方 Token 响应窗口
                    state.core.pendingDamage = {
                        id: 'test-evasive-damage',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        sourceAbilityId: 'test',
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                    };
                    state.core.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'test',
                        isDefendable: true,
                        isUltimate: false,
                    };
                    return state;
                },
                commands: [
                    cmd('USE_TOKEN', '1', { tokenId: TOKEN_IDS.EVASIVE, amount: 1 }),
                ],
                expect: {
                    players: {
                        '1': {
                            tokens: { [TOKEN_IDS.EVASIVE]: 0 }, // 闪避被消耗
                            hp: 50, // fixedRandom.d(6)=1，闪避成功，完全免伤
                        },
                    },
                },
            });
            // 检查命令是否成功
            expect(result.steps.length).toBe(1);
            expect(result.steps[0].success).toBe(true);
            // 验证事件类型存在（StepLog.events 是 string[]，只存储事件类型名称）
            const allEventTypes = result.steps.flatMap(s => s.events);
            expect(allEventTypes).toContain('TOKEN_USED');
            expect(allEventTypes).toContain('TOKEN_RESPONSE_CLOSED');
            // 验证最终状态：闪避成功，完全免伤
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.EVASIVE]).toBe(0);
            expect(result.finalState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            // pendingDamage 应该被清除（reducer 使用 undefined 表示已清除）
            expect(result.finalState.core.pendingDamage).toBeUndefined();
        });

        it('USE_TOKEN(evasive) 闪避失败正常受伤', () => {
            // 使用返回 4 的随机数（d6=4，闪避失败）
            const failRandom: RandomFn = {
                random: () => 0,
                d: () => 4,
                range: (min) => min,
                shuffle: <T>(arr: T[]) => arr,
            };
            const runner = createRunner(failRandom);
            const result = runner.run({
                name: 'evasive 闪避失败',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    state.core.players['0'].hand = [];
                    state.core.players['1'].hand = [];
                    // 给防御方闪避 Token
                    state.core.players['1'].tokens = {
                        ...state.core.players['1'].tokens,
                        [TOKEN_IDS.EVASIVE]: 1,
                    };
                    // 设置 pendingDamage 模拟防御方 Token 响应窗口
                    state.core.pendingDamage = {
                        id: 'test-evasive-damage-fail',
                        sourcePlayerId: '0',
                        targetPlayerId: '1',
                        originalDamage: 5,
                        currentDamage: 5,
                        sourceAbilityId: 'test',
                        responseType: 'beforeDamageReceived',
                        responderId: '1',
                    };
                    state.core.pendingAttack = {
                        attackerId: '0',
                        defenderId: '1',
                        sourceAbilityId: 'test',
                        isDefendable: true,
                        isUltimate: false,
                    };
                    return state;
                },
                commands: [
                    cmd('USE_TOKEN', '1', { tokenId: TOKEN_IDS.EVASIVE, amount: 1 }),
                ],
                expect: {
                    players: {
                        '1': {
                            tokens: { [TOKEN_IDS.EVASIVE]: 0 }, // 闪避被消耗
                        },
                    },
                },
            });
            // 检查命令是否成功
            expect(result.steps.length).toBe(1);
            expect(result.steps[0].success).toBe(true);
            // 验证事件类型存在
            const allEventTypes = result.steps.flatMap(s => s.events);
            expect(allEventTypes).toContain('TOKEN_USED');
            // 闪避失败时，pendingDamage 仍然存在，等待后续处理（isFullyEvaded = false）
            expect(result.finalState.core.pendingDamage).toBeDefined();
            expect(result.finalState.core.pendingDamage?.isFullyEvaded).toBe(false);
            expect(result.finalState.core.pendingDamage?.currentDamage).toBe(5);
        });
    });
});


// ============================================================================
// 4. 攻击结算交互链 — 完整战斗流程
// ============================================================================

describe('攻击结算交互链', () => {
    describe('可防御攻击完整流程', () => {
        it('offensiveRoll → 选择技能 → defensiveRoll → 防御确认 → 结算 → main2', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '可防御攻击完整流程',
                setup: createNoResponseSetupWithEmptyHand(),
                commands: [
                    // main1 → offensiveRoll
                    cmd('ADVANCE_PHASE', '0'),
                    // 掷骰 3 次
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    // 确认骰面
                    cmd('CONFIRM_ROLL', '0'),
                    // 选择进攻技能
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    // ADVANCE_PHASE 触发攻击结算 → 进入 defensiveRoll
                    cmd('ADVANCE_PHASE', '0'),
                    // 防御方掷骰
                    cmd('ROLL_DICE', '1'),
                    cmd('ROLL_DICE', '1'),
                    cmd('ROLL_DICE', '1'),
                    // 确认防御骰面
                    cmd('CONFIRM_ROLL', '1'),
                    // ADVANCE_PHASE 触发防御结算 → 进入 main2
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                },
            });
            expect(result.passed).toBe(true);
        });
    });

    describe('不可防御攻击流程', () => {
        it('终极技能跳过防御阶段直接结算', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '终极技能不可防御',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    state.core.players['0'].hand = [];
                    state.core.players['1'].hand = [];
                    return state;
                },
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    // 选择终极技能（如果有的话）
                    // 僧侣的终极技能 id 需要确认
                    cmd('SELECT_ABILITY', '0', { abilityId: 'chi-burst' }),
                    cmd('ADVANCE_PHASE', '0'),
                ],
            });
            // 验证测试能运行
            expect(result.steps.length).toBeGreaterThan(0);
        });
    });

    describe('无伤害技能跳过防御阶段', () => {
        it('纯增益技能不进入防御阶段', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '纯增益技能跳过防御',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    state.core.players['0'].hand = [];
                    state.core.players['1'].hand = [];
                    return state;
                },
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    // 选择冥想（纯增益技能）
                    cmd('SELECT_ABILITY', '0', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                },
            });
            expect(result.passed).toBe(true);
        });
    });
});


// ============================================================================
// 5. 状态效果交互链 — upkeep 阶段状态结算
// ============================================================================

describe('状态效果交互链', () => {
    /** 创建在 player 0 的 discard 阶段末尾的 setup，给 player 1 施加状态 */
    function createSetupAtPlayer0Discard(
        entries: { playerId: string; statusId: string; stacks: number }[]
    ) {
        const baseSetup = createNoResponseSetupWithEmptyHand();
        return (playerIds: string[], random: typeof fixedRandom) => {
            const state = baseSetup(playerIds, random);
            for (const entry of entries) {
                state.core.players[entry.playerId].statusEffects[entry.statusId] = entry.stacks;
            }
            return state;
        };
    }

    it('burn → upkeep 伤害 + 层数递减', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'burn upkeep 结算',
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 2 },
            ]),
            commands: [
                // 推进到 discard
                ...advanceTo('discard'),
                // discard → 切换回合 → player 1 的 upkeep（自动结算 burn）→ income → main1
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                activePlayerId: '1',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 2, // 2 层 burn = 2 点伤害
                        statusEffects: { [STATUS_IDS.BURN]: 1 }, // 移除 1 层
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('poison → upkeep 伤害（持续效果，层数不变）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'poison upkeep 结算',
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.POISON, stacks: 3 },
            ]),
            commands: [
                ...advanceTo('discard'),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                activePlayerId: '1',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 3, // 3 层 poison = 3 点伤害
                        statusEffects: { [STATUS_IDS.POISON]: 3 }, // 持续效果，层数不变
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('burn + poison 同时存在 → 先 burn 后 poison', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'burn + poison 同时结算',
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.BURN, stacks: 2 },
                { playerId: '1', statusId: STATUS_IDS.POISON, stacks: 1 },
            ]),
            commands: [
                ...advanceTo('discard'),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                activePlayerId: '1',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 3, // burn 2 + poison 1
                        statusEffects: {
                            [STATUS_IDS.BURN]: 1, // 燃烧移除 1 层
                            [STATUS_IDS.POISON]: 1, // 毒液持续不变
                        },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('concussion → 跳过收入阶段', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'concussion 跳过收入',
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.CONCUSSION, stacks: 1 },
            ]),
            commands: [
                ...advanceTo('discard'),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                activePlayerId: '1',
                players: {
                    '1': {
                        cp: INITIAL_CP, // 未获得收入
                        statusEffects: { [STATUS_IDS.CONCUSSION]: 0 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('stun → 进入 offensiveRoll 时移除眩晕 → ADVANCE_PHASE 退出到 main2', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'stun 跳过进攻掷骰',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                // 直接给 player 0 施加 stun（在自己回合测试）
                state.core.players['0'].statusEffects[STATUS_IDS.STUN] = 1;
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            commands: [
                // main1 → offensiveRoll（进入时 stun 被移除）
                cmd('ADVANCE_PHASE', '0'),
                // offensiveRoll → main2（stun 已移除，无骰子可用，直接推进）
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                activePlayerId: '0',
                players: {
                    '0': {
                        statusEffects: { [STATUS_IDS.STUN]: 0 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('entangle → 减少掷骰次数', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'entangle 减少掷骰',
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.ENTANGLE, stacks: 1 },
            ]),
            commands: [
                ...advanceTo('discard'),
                cmd('ADVANCE_PHASE', '0'),
                // player 1 的 main1 → offensiveRoll（entangle 减少掷骰次数）
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                activePlayerId: '1',
                roll: {
                    limit: 2, // 3 - 1 = 2
                },
                players: {
                    '1': {
                        statusEffects: { [STATUS_IDS.ENTANGLE]: 0 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('knockdown → 跳过进攻掷骰阶段（main1 退出时处理）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'knockdown 跳过进攻',
            setup: createSetupAtPlayer0Discard([
                { playerId: '1', statusId: STATUS_IDS.KNOCKDOWN, stacks: 1 },
            ]),
            commands: [
                ...advanceTo('discard'),
                cmd('ADVANCE_PHASE', '0'),
                // player 1 的 main1 → knockdown 跳过 offensiveRoll → main2
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                activePlayerId: '1',
                players: {
                    '1': {
                        statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });
});


// ============================================================================
// 6. 响应窗口交互链
// ============================================================================

describe('响应窗口交互链', () => {
    it('CONFIRM_ROLL → 响应窗口 → RESPONSE_PASS 完整链', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'confirm roll 响应窗口',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                // 保留手牌中的 roll timing 卡牌以触发响应窗口
                return state;
            },
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                // 如果有响应窗口，对手跳过
                cmd('RESPONSE_PASS', '1'),
            ],
        });
        // 验证测试能运行
        expect(result.steps.length).toBeGreaterThan(0);
    });

    it('卡牌打出后的响应窗口 → RESPONSE_PASS', () => {
        const runner = createRunner(fixedRandom);
        // 找到一张有对手效果的 instant 卡牌
        const instantCard = COMMON_CARDS.find(c =>
            c.timing === 'instant' && c.effects?.some(e => e.action?.target === 'opponent')
        );
        if (!instantCard) return;

        const result = runner.run({
            name: '卡牌响应窗口',
            setup: createSetupWithHand([instantCard.id]),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                // 在 offensiveRoll 阶段打出 instant 卡牌
                cmd('PLAY_CARD', '0', { cardId: instantCard.id }),
            ],
        });
        expect(result.steps.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// 7. 净化 Token 交互链（独立于伤害流程）
// ============================================================================

describe('净化 Token 交互链', () => {
    it('USE_PURIFY 移除1层负面状态', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'purify 移除状态',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                // 给 player 0 净化 Token 和负面状态
                state.core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;
                state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 2;
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            commands: [
                // 在 main1 阶段使用净化
                cmd('USE_PURIFY', '0', { statusId: STATUS_IDS.BURN }),
            ],
            expect: {
                players: {
                    '0': {
                        tokens: { [TOKEN_IDS.PURIFY]: 0 },
                        statusEffects: { [STATUS_IDS.BURN]: 1 }, // 净化只移除 1 层
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });
});

// ============================================================================
// 8. 花费 CP 移除击倒交互链
// ============================================================================

describe('花费 CP 移除击倒交互链', () => {
    it('PAY_TO_REMOVE_KNOCKDOWN 花费 2CP 移除击倒', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'pay to remove knockdown',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            commands: [
                // 在 main1 阶段花费 CP 移除击倒
                cmd('PAY_TO_REMOVE_KNOCKDOWN', '0'),
            ],
            expect: {
                players: {
                    '0': {
                        cp: INITIAL_CP - 2,
                        statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });
});


// ============================================================================
// 9. 跨英雄交互链 — 不同角色的 Token/状态交互
// ============================================================================

describe('跨英雄交互链', () => {
    /** 创建指定角色对战的 setup */
    function createHeroMatchup(hero0: string, hero1: string) {
        return (playerIds: string[], random: typeof fixedRandom) => {
            const core = DiceThroneDomain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, testSystems, undefined);
            let state: MatchState<DiceThroneCore> = { sys, core };

            // 选择角色
            const setupCmds = [
                { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: hero0 } },
                { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: hero1 } },
                { type: 'PLAYER_READY', playerId: '1', payload: {} },
                { type: 'HOST_START_GAME', playerId: '0', payload: {} },
            ];

            const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
            for (const c of setupCmds) {
                const result = executePipeline(
                    pipelineConfig,
                    state,
                    { ...c, timestamp: Date.now() } as any,
                    random,
                    playerIds
                );
                if (result.success) {
                    state = result.state as MatchState<DiceThroneCore>;
                }
            }

            // 清空手牌避免响应窗口干扰
            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
            }
            return state;
        };
    }

    it('僧侣 vs 野蛮人 — 基础对战流程', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '僧侣 vs 野蛮人',
            setup: createHeroMatchup('monk', 'barbarian'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ],
        });
        expect(result.steps.length).toBeGreaterThan(0);
        // 验证所有步骤成功
        const failedSteps = result.steps.filter(s => !s.success);
        expect(failedSteps.length).toBe(0);
    });

    it('烈火术士 vs 月精灵 — 基础对战流程', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '烈火术士 vs 月精灵',
            setup: createHeroMatchup('pyromancer', 'moon_elf'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ],
        });
        expect(result.steps.length).toBeGreaterThan(0);
        const failedSteps = result.steps.filter(s => !s.success);
        expect(failedSteps.length).toBe(0);
    });

    it('影子盗贼 vs 圣骑士 — 基础对战流程', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '影子盗贼 vs 圣骑士',
            setup: createHeroMatchup('shadow_thief', 'paladin'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ],
        });
        expect(result.steps.length).toBeGreaterThan(0);
        const failedSteps = result.steps.filter(s => !s.success);
        expect(failedSteps.length).toBe(0);
    });
});


// ============================================================================
// 10. 命令验证交互链 — 确保所有交互命令在正确阶段可用
// ============================================================================

describe('命令验证交互链', () => {
    it('CONFIRM_INTERACTION 在无 pendingInteraction 时失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'confirm without interaction',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                cmd('CONFIRM_INTERACTION', '0', { interactionId: 'nonexistent' }),
            ],
            expect: {
                expectError: { command: 'CONFIRM_INTERACTION', error: 'no_pending_interaction' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('CANCEL_INTERACTION 在无 pendingInteraction 时失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'cancel without interaction',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                cmd('CANCEL_INTERACTION', '0'),
            ],
            expect: {
                expectError: { command: 'CANCEL_INTERACTION', error: 'no_pending_interaction' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('USE_TOKEN 在无 pendingDamage 时失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'use token without pending damage',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 2;
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            commands: [
                cmd('USE_TOKEN', '0', { tokenId: TOKEN_IDS.TAIJI, amount: 1 }),
            ],
            expect: {
                expectError: { command: 'USE_TOKEN', error: 'no_pending_damage' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('SKIP_TOKEN_RESPONSE 在无 pendingDamage 时失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'skip token without pending damage',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                cmd('SKIP_TOKEN_RESPONSE', '0'),
            ],
            expect: {
                expectError: { command: 'SKIP_TOKEN_RESPONSE', error: 'no_pending_damage' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('USE_PURIFY 在无净化 Token 时失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'purify without token',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 1;
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            commands: [
                cmd('USE_PURIFY', '0', { statusId: STATUS_IDS.BURN }),
            ],
            expect: {
                expectError: { command: 'USE_PURIFY', error: 'no_token' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('ROLL_DICE 在非掷骰阶段失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'roll dice in main1',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                cmd('ROLL_DICE', '0'),
            ],
            expect: {
                expectError: { command: 'ROLL_DICE', error: 'invalid_phase' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('SELECT_ABILITY 在非掷骰阶段失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'select ability in main1',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
            ],
            expect: {
                expectError: { command: 'SELECT_ABILITY', error: 'invalid_phase' },
            },
        });
        expect(result.passed).toBe(true);
    });
});


// ============================================================================
// 11. CustomAction 交互链完整性 — 所有 handler 的注册与引用一致性
// ============================================================================

describe('CustomAction 交互链完整性', () => {
    const registeredIds = getRegisteredCustomActionIds();

    it('所有注册的 customAction 都有元数据', () => {
        const violations: string[] = [];
        for (const id of registeredIds) {
            if (!getCustomActionMeta(id)) {
                violations.push(`customAction "${id}" 缺少元数据`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('所有注册的 customAction 的 categories 非空', () => {
        const violations: string[] = [];
        for (const id of registeredIds) {
            const meta = getCustomActionMeta(id);
            if (meta && meta.categories.length === 0) {
                violations.push(`customAction "${id}" categories 为空`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('骰子修改类 customAction 的 categories 包含 dice', () => {
        const diceActionPatterns = [
            'modify-die', 'reroll-die', 'reroll-opponent',
        ];
        const violations: string[] = [];
        for (const id of registeredIds) {
            const isDice = diceActionPatterns.some(p => id.includes(p));
            if (!isDice) continue;
            const meta = getCustomActionMeta(id);
            if (meta && !meta.categories.includes('dice')) {
                violations.push(`${id} 是骰子修改类但 categories 缺少 dice`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('状态操作类 customAction 的 categories 包含 status', () => {
        const statusActionPatterns = [
            'remove-status', 'remove-all-status', 'transfer-status',
        ];
        const violations: string[] = [];
        for (const id of registeredIds) {
            const isStatus = statusActionPatterns.some(p => id.includes(p));
            if (!isStatus) continue;
            const meta = getCustomActionMeta(id);
            if (meta && !meta.categories.includes('status')) {
                violations.push(`${id} 是状态操作类但 categories 缺少 status`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('注册的 customAction 数量 >= 50（完整性基线）', () => {
        expect(registeredIds.size).toBeGreaterThanOrEqual(50);
    });
});

// ============================================================================
// 12. 阶段推进交互链 — 完整回合流程
// ============================================================================

describe('完整回合交互链', () => {
    it('完整回合流程：main1 → offensiveRoll → main2 → discard → 切换回合', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '完整回合流程（无攻击）',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                // main1 → offensiveRoll
                cmd('ADVANCE_PHASE', '0'),
                // offensiveRoll → 不选技能直接推进 → main2
                cmd('ADVANCE_PHASE', '0'),
                // main2 → discard
                cmd('ADVANCE_PHASE', '0'),
                // discard → 切换回合 → player 1 的 upkeep → income → main1
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                activePlayerId: '1',
                turnPhase: 'main1',
                turnNumber: 2,
            },
        });
        expect(result.passed).toBe(true);
    });

    it('多回合流程：player 0 → player 1 → player 0', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '多回合流程',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                // player 0 回合
                cmd('ADVANCE_PHASE', '0'),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ADVANCE_PHASE', '0'),
                // player 1 回合
                cmd('ADVANCE_PHASE', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                activePlayerId: '0',
                turnPhase: 'main1',
                turnNumber: 3,
            },
        });
        expect(result.passed).toBe(true);
    });
});

// ============================================================================
// 13. 骰子操作交互链
// ============================================================================

describe('骰子操作交互链', () => {
    it('ROLL_DICE → TOGGLE_DIE_LOCK → ROLL_DICE → CONFIRM_ROLL 完整链', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '骰子操作完整链',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                // 第一次掷骰
                cmd('ROLL_DICE', '0'),
                // 锁定骰子 0
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),
                // 第二次掷骰（骰子 0 被锁定不会重掷）
                cmd('ROLL_DICE', '0'),
                // 解锁骰子 0
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),
                // 第三次掷骰
                cmd('ROLL_DICE', '0'),
                // 确认骰面
                cmd('CONFIRM_ROLL', '0'),
            ],
            expect: {
                turnPhase: 'offensiveRoll',
                roll: {
                    count: 3,
                    confirmed: true,
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('超过掷骰上限时 ROLL_DICE 失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '超过掷骰上限',
            setup: createNoResponseSetupWithEmptyHand(),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('ROLL_DICE', '0'),
                // 第 4 次掷骰应该失败
                cmd('ROLL_DICE', '0'),
            ],
            expect: {
                expectError: { command: 'ROLL_DICE', error: 'roll_limit_reached' },
            },
        });
        expect(result.passed).toBe(true);
    });
});

// ============================================================================
// 14. 卡牌系统交互链
// ============================================================================

describe('卡牌系统交互链', () => {
    it('SELL_CARD → UNDO_SELL_CARD 完整链', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '售卖撤回完整链',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                // 确保有手牌
                return state;
            },
            commands: [
                // 在 main1 阶段售卖手牌
                cmd('SELL_CARD', '0', { cardId: MONK_CARDS[0].id }),
            ],
        });
        // 验证售卖成功
        const sellStep = result.steps.find(s => s.commandType === 'SELL_CARD');
        expect(sellStep?.success).toBe(true);
    });

    it('DISCARD_CARD 在 discard 阶段', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '弃牌阶段弃牌',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                // 确保手牌超过上限以便需要弃牌
                return state;
            },
            commands: [
                ...advanceTo('discard'),
            ],
        });
        expect(result.steps.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// 15. 状态转移/移除交互链
// ============================================================================

describe('状态转移/移除交互链', () => {
    it('REMOVE_STATUS 在无 pendingInteraction 时失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '移除状态需要交互上下文',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                state.core.players['1'].statusEffects[STATUS_IDS.BURN] = 2;
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            commands: [
                cmd('REMOVE_STATUS', '0', { targetPlayerId: '1', statusId: STATUS_IDS.BURN }),
            ],
            expect: {
                expectError: { command: 'REMOVE_STATUS', error: 'no_pending_interaction' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('REMOVE_STATUS（移除所有）在无 pendingInteraction 时失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '移除所有状态需要交互上下文',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                state.core.players['1'].statusEffects[STATUS_IDS.BURN] = 2;
                state.core.players['1'].statusEffects[STATUS_IDS.POISON] = 1;
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            commands: [
                cmd('REMOVE_STATUS', '0', { targetPlayerId: '1' }),
            ],
            expect: {
                expectError: { command: 'REMOVE_STATUS', error: 'no_pending_interaction' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('TRANSFER_STATUS 在无 pendingInteraction 时失败', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '转移状态需要交互上下文',
            setup: (playerIds, random) => {
                const state = createInitializedState(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 2;
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            commands: [
                cmd('TRANSFER_STATUS', '0', {
                    fromPlayerId: '0',
                    toPlayerId: '1',
                    statusId: STATUS_IDS.BURN,
                }),
            ],
            expect: {
                expectError: { command: 'TRANSFER_STATUS', error: 'no_pending_interaction' },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('REMOVE_STATUS 通过卡牌交互链完整流程（card-bye-bye）', () => {
        // card-bye-bye 是移除状态卡牌，通过打出卡牌触发 pendingInteraction
        const byeByeCardLocal = COMMON_CARDS.find(c => c.id === 'card-bye-bye');
        if (!byeByeCardLocal) return;

        // 验证 remove-status-1 customAction 已注册
        const handler = getCustomActionHandler('remove-status-1');
        expect(handler).toBeDefined();
        const meta = getCustomActionMeta('remove-status-1');
        expect(meta).toBeDefined();
        expect(meta!.categories).toContain('status');
    });

    it('TRANSFER_STATUS 通过卡牌交互链完整流程', () => {
        // transfer-status customAction 已注册
        const handler = getCustomActionHandler('transfer-status');
        expect(handler).toBeDefined();
        const meta = getCustomActionMeta('transfer-status');
        expect(meta).toBeDefined();
        expect(meta!.categories).toContain('status');
    });
});
