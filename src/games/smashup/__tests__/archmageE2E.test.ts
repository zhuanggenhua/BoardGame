/**
 * 大法师 (Archmage) 完整 E2E 测试
 *
 * 验证大法师的持续能力："你可以在你的每个回合打出一个额外战术"
 * 根据官方 FAQ：打出当回合也能获得额外行动
 * "You get the extra action on each of your turns, including the one when Archmage is played."
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { createSmashUpEventSystem } from '../domain/systems';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_EVENTS, SU_COMMANDS } from '../domain/types';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { initAllAbilities } from '../abilities';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { makeMinion, makePlayer, makeState, makeBase, makeCard } from './helpers';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createCustomRunner(customState: MatchState<SmashUpCore>) {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: PLAYER_IDS,
        setup: () => customState,
        silent: true,
    });
}

function makeFullMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    const sys = createInitialSystemState(PLAYER_IDS, systems);
    return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
}

describe('大法师 E2E: 回合开始额外行动', () => {
    it('P0 控制大法师，P0 回合开始时 actionLimit 应为 2', () => {
        // 构造：P0 控制大法师在基地上，当前是 P1 的回合
        // 当 P1 结束回合后，P0 的回合开始，大法师应触发给 P0 额外行动
        const archmage = makeMinion('am-1', 'wizard_archmage', '0', 4, { powerModifier: 0 });

        const core = makeState({
            currentPlayerIndex: 1, // P1 的回合
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [archmage]),
            ],
        });

        const fullState = makeFullMatchState(core);
        // 设置为 P1 的 playCards 阶段
        const stateWithP1Turn: MatchState<SmashUpCore> = {
            ...fullState,
            sys: { ...fullState.sys, phase: 'playCards' },
        };

        const runner = createCustomRunner(stateWithP1Turn);

        // P1 推进阶段 → 自动链条：playCards → scoreBases → draw → endTurn → startTurn(P0) → playCards(P0)
        const result = runner.run({
            name: '大法师 E2E - P1 结束回合后 P0 开始',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: undefined },
            ] as any[],
        });

        // 验证：现在是 P0 的 playCards 阶段
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(0);

        // 关键验证：P0 的 actionLimit 应该是 2（基础 1 + 大法师 1）
        const p0 = result.finalState.core.players['0'];
        expect(p0.actionLimit).toBe(2);

        // 验证事件链中包含 LIMIT_MODIFIED
        const allEvents = result.steps.flatMap(s => s.events ?? []);
        const limitModifiedEvents = allEvents.filter(e => e === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitModifiedEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('P1 控制大法师，P0 回合开始时 actionLimit 应为 1（不触发）', () => {
        // 构造：P1 控制大法师，当前是 P1 的回合
        // 当 P1 结束回合后，P0 的回合开始，大法师不应触发（因为控制者是 P1）
        const archmage = makeMinion('am-1', 'wizard_archmage', '1', 4, { powerModifier: 0 });

        const core = makeState({
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [archmage]),
            ],
        });

        const fullState = makeFullMatchState(core);
        const stateWithP1Turn: MatchState<SmashUpCore> = {
            ...fullState,
            sys: { ...fullState.sys, phase: 'playCards' },
        };

        const runner = createCustomRunner(stateWithP1Turn);

        const result = runner.run({
            name: '大法师 E2E - P1 控制，P0 回合不触发',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(0);

        // P0 的 actionLimit 应该是 1（基础值，大法师不触发）
        const p0 = result.finalState.core.players['0'];
        expect(p0.actionLimit).toBe(1);
    });

    it('P0 控制大法师，P1 回合开始时 actionLimit 应为 1（不触发）', () => {
        // 构造：P0 控制大法师，当前是 P0 的回合
        // 当 P0 结束回合后，P1 的回合开始，大法师不应触发（因为不是控制者的回合）
        const archmage = makeMinion('am-1', 'wizard_archmage', '0', 4, { powerModifier: 0 });

        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [archmage]),
            ],
        });

        const fullState = makeFullMatchState(core);
        const stateWithP0Turn: MatchState<SmashUpCore> = {
            ...fullState,
            sys: { ...fullState.sys, phase: 'playCards' },
        };

        const runner = createCustomRunner(stateWithP0Turn);

        const result = runner.run({
            name: '大法师 E2E - P0 控制，P1 回合不触发',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);

        // P1 的 actionLimit 应该是 1（基础值，大法师不触发）
        const p1 = result.finalState.core.players['1'];
        expect(p1.actionLimit).toBe(1);
    });
});

describe('大法师 E2E: 打出当回合额外行动', () => {
    it('打出大法师当回合立即获得额外行动（官方 FAQ）', () => {
        // 构造：P0 手牌有大法师，当前是 P0 的回合
        // P0 打出大法师后，应立即获得额外行动
        const archmageCard = makeCard('am-card', 'wizard_archmage', 'minion', '0');

        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', { hand: [archmageCard] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', []),
            ],
        });

        const fullState = makeFullMatchState(core);

        const runner = createCustomRunner(fullState);

        // P0 打出大法师
        const result = runner.run({
            name: '大法师 E2E - 打出当回合获得额外行动',
            commands: [
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'am-card', baseIndex: 0 } },
            ] as any[],
        });

        expect(result.steps[0]?.success).toBe(true);

        // 关键验证：P0 的 actionLimit 应该是 2（基础 1 + 大法师打出时 1）
        const p0 = result.finalState.core.players['0'];
        expect(p0.actionLimit).toBe(2);

        // 验证事件链中包含 LIMIT_MODIFIED
        const allEvents = result.steps.flatMap(s => s.events ?? []);
        const limitModifiedEvents = allEvents.filter(e => e === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitModifiedEvents.length).toBeGreaterThanOrEqual(1);
    });
});
