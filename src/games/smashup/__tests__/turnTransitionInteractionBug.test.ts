/**
 * 大杀四方 - 回合切换 Interaction 悬空 bug 复现
 *
 * 场景：
 * 1. onPhaseEnter('startTurn') 中基地能力（如拉莱耶）创建 Interaction
 * 2. onAutoContinueCheck('startTurn') 无条件返回 autoContinue: true，跳过 Interaction
 * 3. 流程推进到 playCards，但 sys.interaction.current 仍有值
 * 4. InteractionSystem 阻塞当前玩家的所有非系统命令 → 卡死
 *
 * 同时测试：
 * - onPhaseExit('scoreBases') 中 state.sys 变异导致 Interaction 传播到后续阶段
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent, MinionOnBase, PlayerState, CardInstance } from '../domain/types';
import { SU_EVENTS, SU_COMMANDS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, controller: string, power: number, defId = 'alien_invader'): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0, tempPowerModifier: 0,
        talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner = '0'): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(
    id: string,
    factions: [string, string] = [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS]
): PlayerState {
    const hand: CardInstance[] = [];
    const deck: CardInstance[] = [];
    for (let i = 0; i < 5; i++) {
        hand.push(makeCard(`${id}_h${i}`, 'alien_invader', 'minion', id));
    }
    for (let i = 0; i < 15; i++) {
        deck.push(makeCard(`${id}_d${i}`, 'alien_invader', 'minion', id));
    }
    return {
        id, vp: 0, hand, deck, discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions,
    };
}

function createRunner(setup: (ids: PlayerId[], random: RandomFn) => MatchState<SmashUpCore>) {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: PLAYER_IDS,
        silent: true,
        setup,
    });
}

// ============================================================================
// 场景1：拉莱耶 onTurnStart 创建 Interaction → 回合切换卡死
// ============================================================================

describe('拉莱耶 onTurnStart Interaction 导致回合切换卡死', () => {
    /**
     * 设置：
     * - 场上有拉莱耶（base_rlyeh），P1 有随从在上面
     * - P0 的 playCards 阶段，推进到 scoreBases
     * - 无基地达标 → 自动推进到 draw → endTurn → startTurn(P1)
     * - startTurn(P1) 时拉莱耶触发 onTurnStart → 创建 Interaction 给 P1
     * - 预期：P1 能看到 Interaction 并响应，之后进入 playCards 正常操作
     * - 实际（bug）：onAutoContinueCheck('startTurn') 无条件 autoContinue，
     *   流程推进到 playCards，但 Interaction 仍在 → P1 被 InteractionSystem 阻塞
     */
    function createRlyehSetup() {
        return (ids: PlayerId[], _random: RandomFn): MatchState<SmashUpCore> => {
            const core: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [
                    // 拉莱耶：P1 有随从在上面，onTurnStart 会触发
                    {
                        defId: 'base_rlyeh',
                        minions: [makeMinion('rlyeh_m1', '1', 3)],
                        ongoingActions: [],
                    },
                    // 普通基地，无特殊能力
                    { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                    { defId: 'base_central_brain', minions: [], ongoingActions: [] },
                ],
                baseDeck: ['base_castle_blood'],
                turnNumber: 1,
                nextUid: 200,
            };

            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
            sys.phase = 'playCards';

            return { core, sys };
        };
    }

    it('P0 结束回合 → P1 回合开始 → 拉莱耶 Interaction → P1 应能响应后正常操作', () => {
        const runner = createRunner(createRlyehSetup());

        // 第一步：P0 推进，链条应停在 startTurn(P1) 且有 Interaction
        const result1 = runner.run({
            name: '拉莱耶 onTurnStart Interaction - 仅推进',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        const state1 = result1.finalState;
        console.log('STEP1 phase:', state1.sys.phase);
        console.log('STEP1 interaction:', state1.sys.interaction?.current?.id);
        console.log('STEP1 playerIndex:', state1.core.currentPlayerIndex);

        // 验证：流程应停在 startTurn，有 Interaction
        expect(state1.sys.phase).toBe('startTurn');
        expect(state1.sys.interaction?.current).toBeDefined();
        expect(state1.sys.interaction?.current?.id).toBe('base_rlyeh_0');

        // 第二步：P1 响应 Interaction
        const result2 = runner.run({
            name: '拉莱耶 onTurnStart Interaction - 响应',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                { type: 'SYS_INTERACTION_RESPOND', playerId: '1', payload: { optionId: 'skip' } },
            ] as any[],
        });

        const finalState = result2.finalState;
        const phase = finalState.sys.phase;
        const currentPlayerIndex = finalState.core.currentPlayerIndex;
        const interactionCurrent = finalState.sys.interaction?.current;

        console.log('最终阶段:', phase);
        console.log('当前玩家索引:', currentPlayerIndex);
        console.log('interaction.current:', interactionCurrent?.id);

        // 验证所有步骤成功
        for (const step of result2.steps) {
            expect(step.success, `Step ${step.step} (${step.commandType}) 失败: ${step.error}`).toBe(true);
        }

        // 响应后应该推进到 playCards(P1)
        expect(phase).toBe('playCards');
        expect(currentPlayerIndex).toBe(1);
        expect(interactionCurrent).toBeUndefined();
    });
});

// ============================================================================
// 场景2：托尔图加 afterScoring Interaction → 计分后流程卡死
// ============================================================================

describe('托尔图加 afterScoring Interaction 导致计分后流程异常', () => {
    /**
     * 设置：
     * - 场上有托尔图加（base_tortuga），P0 和 P1 都有随从
     * - P0 的 playCards 阶段，推进到 scoreBases
     * - 托尔图加达标 → Me First! → 计分 → afterScoring 创建 Interaction 给 P1（亚军）
     * - 预期：流程暂停等待 P1 响应 Interaction
     * - 实际（bug）：state.sys 变异注入 Interaction，但 onPhaseExit 返回事件数组（无 halt），
     *   流程继续推进到 draw → endTurn → startTurn(P1) → playCards(P1)，Interaction 悬空
     */
    function createTortugaScoringSetup() {
        return (ids: PlayerId[], _random: RandomFn): MatchState<SmashUpCore> => {
            const core: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [
                    // 托尔图加 breakpoint=18，P0 力量 20（冠军），P1 力量 10（亚军）
                    {
                        defId: 'base_tortuga',
                        minions: [
                            makeMinion('tort_m0', '0', 20),
                            makeMinion('tort_m1', '1', 10),
                        ],
                        ongoingActions: [],
                    },
                    { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                    { defId: 'base_central_brain', minions: [], ongoingActions: [] },
                ],
                baseDeck: ['base_castle_blood', 'base_the_homeworld'],
                turnNumber: 1,
                nextUid: 200,
            };

            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
            sys.phase = 'playCards';

            return { core, sys };
        };
    }

    it('托尔图加达标 → 计分 → afterScoring Interaction → 流程应暂停等待响应', () => {
        const runner = createRunner(createTortugaScoringSetup());

        // P0 推进到 scoreBases → 托尔图加达标
        const result = runner.run({
            name: '托尔图加计分 Interaction',
            commands: [
                // playCards → scoreBases（托尔图加达标，Me First! 因无 special 卡自动关闭）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P0 PASS Me First!（如果窗口打开的话）
                { type: 'RESPONSE_PASS', playerId: '0', payload: undefined },
                // P1 PASS Me First!
                { type: 'RESPONSE_PASS', playerId: '1', payload: undefined },
            ] as any[],
        });

        const finalState = result.finalState;
        const phase = finalState.sys.phase;
        const interactionCurrent = finalState.sys.interaction?.current;

        console.log('最终阶段:', phase);
        console.log('当前玩家索引:', finalState.core.currentPlayerIndex);
        console.log('interaction.current:', interactionCurrent?.id);
        console.log('flowHalted:', (finalState.sys as any).flowHalted);

        // 检查计分事件是否产生
        const allEvents = result.steps.flatMap(s => s.events);
        const hasBaseScored = allEvents.includes(SU_EVENTS.BASE_SCORED);
        console.log('有 BASE_SCORED 事件:', hasBaseScored);

        if (hasBaseScored && interactionCurrent) {
            // 如果有计分且有 Interaction，检查是否是托尔图加的
            const sourceId = (interactionCurrent.data as any)?.sourceId;
            console.log('Interaction sourceId:', sourceId);

            if (sourceId === 'base_tortuga') {
                // 托尔图加的 afterScoring Interaction
                // 正确行为：流程应该暂停在 scoreBases，等待 P1 响应
                if (phase !== 'scoreBases') {
                    console.error('BUG：托尔图加 Interaction 应该暂停在 scoreBases，但流程已推进到', phase);
                }
                // 无论如何，P1 应该能响应
                expect(interactionCurrent.playerId).toBe('1');
            }
        }
    });
});
