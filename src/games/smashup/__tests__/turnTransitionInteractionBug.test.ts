/**
 * 大杀四方 - 回合切换 Interaction 悬空 bug 复现
 *
 * 场景：
 * 1. onPhaseEnter('startTurn') 中基地能力（如拉莱耶）创建 Interaction
 * 2. onAutoContinueCheck('startTurn') 无条件返回 autoContinue: true，跳过 Interaction
 * 3. 流程推进到 playCards，但当前 prompt 仍存在
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
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptSourceId,
    getSimpleChoicePrompt,
    respondToPrompt,
} from './helpers';

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
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
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

function expectSuccessfulResult<T extends { success: boolean; error?: string }>(
    result: T,
    message: string,
): asserts result is T & { success: true } {
    expect(result.success, result.error ? `${message}: ${result.error}` : message).toBe(true);
    if (!result.success) {
        throw new Error(result.error ? `${message}: ${result.error}` : message);
    }
}

function expectAllStepsSucceeded(result: { steps: Array<{ success: boolean; step: number; commandType: string; error?: string }> }) {
    for (const step of result.steps) {
        expect(step.success, `Step ${step.step} (${step.commandType}) 失败: ${step.error}`).toBe(true);
    }
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
        expectAllStepsSucceeded(result1);

        const state1 = result1.finalState;

        // 验证：流程应停在 startTurn，有 Interaction
        expect(state1.sys.phase).toBe('startTurn');
        expect(state1.core.currentPlayerIndex).toBe(1);
        const rlyehPrompt = getSimpleChoicePrompt(state1, 'base_rlyeh');
        expect(rlyehPrompt.id).toBe('base_rlyeh_0');
        expect(getPromptSourceId(rlyehPrompt)).toBe('base_rlyeh');

        // 第二步：P1 响应 Interaction
        const result2 = respondToPrompt(state1, 'skip', '1');
        expectSuccessfulResult(result2, '响应拉莱耶 prompt 失败');

        const finalState = result2.finalState;
        const phase = finalState.sys.phase;
        const currentPlayerIndex = finalState.core.currentPlayerIndex;

        // 响应后应该推进到 playCards(P1)
        expect(phase).toBe('playCards');
        expect(currentPlayerIndex).toBe(1);
        expectNoPrompt(finalState);
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
                    { defId: 'base_tar_pits', minions: [makeMinion('reserve_p1', '1', 2)], ongoingActions: [] },
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

    it('托尔图加达标 → 计分 → afterScoring Interaction → 流程应暂停等待亚军选择并在响应后恢复', () => {
        const runner = createRunner(createTortugaScoringSetup());

        // P0 推进到 scoreBases → 托尔图加达标
        const result = runner.run({
            name: '托尔图加计分 Interaction',
            commands: [
                // playCards → scoreBases（托尔图加达标，Me First! 因无 special 卡自动关闭）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P0 PASS Me First!；随后应直接停在托尔图加的 afterScoring prompt
                { type: 'RESPONSE_PASS', playerId: '0', payload: undefined },
            ] as any[],
        });
        expectAllStepsSucceeded(result);

        const finalState = result.finalState;
        const phase = finalState.sys.phase;
        const prompt = getSimpleChoicePrompt(finalState, 'base_tortuga');

        // 检查计分事件是否产生
        const allEvents = result.steps.flatMap(s => s.events);
        const hasBaseScored = allEvents.includes(SU_EVENTS.BASE_SCORED);
        expect(hasBaseScored).toBe(true);
        expect(phase).toBe('scoreBases');
        expect(finalState.core.currentPlayerIndex).toBe(0);
        expect((finalState.sys as any).flowHalted).toBe(true);
        expect(getPromptSourceId(prompt)).toBe('base_tortuga');
        expect(prompt.playerId).toBe('1');

        const moveReserveMinion = getPromptOption(
            prompt,
            option => option.value?.minionUid === 'reserve_p1' && option.value?.fromBaseIndex === 1,
            '托尔图加应提供其他基地的亚军随从',
        );

        const resolvePrompt = respondToPrompt(finalState, moveReserveMinion.id, '1');
        expectSuccessfulResult(resolvePrompt, '响应托尔图加 prompt 失败');

        const resolvedState = resolvePrompt.finalState;
        expect(resolvedState.sys.phase).toBe('playCards');
        expect(resolvedState.core.currentPlayerIndex).toBe(1);
        expectNoPrompt(resolvedState);
        expect(resolvedState.core.bases[0].defId).toBe('base_castle_blood');
        expect(resolvedState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['reserve_p1']);
        expect(resolvedState.core.bases[1].minions).toHaveLength(0);
    });
});
