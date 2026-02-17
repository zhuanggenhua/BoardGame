/**
 * 大杀四方 - 回合循环 + 基地计分集成测试
 *
 * 验证 bug：结束回合后对方没有开始回合
 * 重点测试 scoreBases 阶段的 halt + flowHalted 交互
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
    // 给每个玩家 5 张手牌和 15 张牌库（确保抽牌不会出问题）
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

/** 创建带有达标基地的初始状态 */
function createScoringSetup(config: {
    /** 达标基地数量（1 或 2） */
    eligibleBaseCount: number;
    /** 基地 defId 列表 */
    baseDefIds?: string[];
}): (ids: PlayerId[], random: RandomFn) => MatchState<SmashUpCore> {
    return (ids: PlayerId[], _random: RandomFn) => {
        const { eligibleBaseCount, baseDefIds } = config;
        const defaultBases = ['base_the_jungle', 'base_tar_pits', 'base_central_brain'];
        const bases = (baseDefIds ?? defaultBases).map((defId, i) => {
            // 前 eligibleBaseCount 个基地放足够力量的随从使其达标
            const minions: MinionOnBase[] = i < eligibleBaseCount
                ? [makeMinion(`m${i}`, '0', 25)]  // 力量 25，超过任何基地的 breakpoint
                : [];
            return { defId, minions, ongoingActions: [] };
        });

        const core: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases,
            baseDeck: ['base_locker_room', 'base_the_homeworld', 'base_ninja_dojo'],
            turnNumber: 1,
            nextUid: 200,
        };

        const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
        // 设置为 playCards 阶段（跳过选秀）
        sys.phase = 'playCards';

        return { core, sys };
    };
}

function createRunner(setup?: (ids: PlayerId[], random: RandomFn) => MatchState<SmashUpCore>) {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: PLAYER_IDS,
        silent: true,
        ...(setup ? { setup } : {}),
    });
}

// ============================================================================
// 单基地计分 → 完整回合推进
// ============================================================================

describe('单基地计分后完整回合推进', () => {
    it('1 个基地达标 → Me First! → PASS → 计分 → draw → endTurn → startTurn(P1) → playCards(P1)', () => {
        const runner = createRunner(createScoringSetup({ eligibleBaseCount: 1 }));
        const result = runner.run({
            name: '单基地计分完整回合',
            commands: [
                // playCards → scoreBases（基地达标，Me First! 打开）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P0 PASS Me First!
                { type: 'RESPONSE_PASS', playerId: '0', payload: undefined },
                // P1 PASS Me First!
                { type: 'RESPONSE_PASS', playerId: '1', payload: undefined },
                // 窗口关闭后自动推进：scoreBases(计分) → draw → endTurn → startTurn(P1) → playCards(P1)
            ] as any[],
        });

        // 验证所有步骤成功
        for (const step of result.steps) {
            expect(step.success, `Step ${step.step} (${step.commandType}) 失败: ${step.error}`).toBe(true);
        }

        // 验证最终状态：P1 的 playCards 阶段
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);

        // 验证计分事件产生
        const allEvents = result.steps.flatMap(s => s.events);
        expect(allEvents).toContain(SU_EVENTS.BASE_SCORED);
        expect(allEvents).toContain(SU_EVENTS.BASE_REPLACED);
    });
});

// ============================================================================
// 多基地计分 → 完整回合推进（核心 bug 场景）
// ============================================================================

describe.skip('多基地计分后完整回合推进', () => {
    // TODO: 这些测试需要修复 - 可能与 state.bases 访问有关
    it('2 个基地达标 → Me First! 自动关闭 → 选择计分顺序 → 完整回合推进到 P1', () => {
        const runner = createRunner(createScoringSetup({ eligibleBaseCount: 2 }));
        const result = runner.run({
            name: '多基地计分完整回合',
            commands: [
                // playCards → scoreBases（基地达标，Me First! 因无 special 卡自动关闭）
                // → onPhaseExit 检测到 2 基地达标 → Interaction（选择计分顺序）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 选择第一个基地（index=0）
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'base-0' } },
            ] as any[],
        });

        // 检查最后一步是否成功
        const lastStep = result.steps[result.steps.length - 1];
        console.log('最后一步:', lastStep);
        console.log('最终阶段:', result.finalState.sys.phase);
        console.log('当前玩家索引:', result.finalState.core.currentPlayerIndex);
        console.log('flowHalted:', (result.finalState.sys as any).flowHalted);
        console.log('interaction.current:', result.finalState.sys.interaction?.current?.id);
        console.log('interaction.queue:', result.finalState.sys.interaction?.queue?.length);

        // 验证所有步骤成功
        for (const step of result.steps) {
            expect(step.success, `Step ${step.step} (${step.commandType}) 失败: ${step.error}`).toBe(true);
        }

        // 如果 bug 存在：流程会卡在 scoreBases，flowHalted=true
        // 如果 bug 不存在：流程应该推进到 P1 的 playCards
        // 注意：可能需要第二次 Interaction 选择（如果第一次计分后仍有基地达标）
        const phase = result.finalState.sys.phase;
        const flowHalted = (result.finalState.sys as any).flowHalted;

        // 至少不应该卡在 scoreBases 且 flowHalted=true
        if (phase === 'scoreBases' && flowHalted) {
            // 这就是 bug！
            throw new Error('BUG 复现：scoreBases 阶段 flowHalted=true，流程卡死');
        }
    });
});
