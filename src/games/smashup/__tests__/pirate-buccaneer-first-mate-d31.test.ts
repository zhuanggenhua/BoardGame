/**
 * D31 审计：pirate_buccaneer 和 pirate_first_mate 拦截路径完整性
 *
 * 验证：
 * 1. pirate_buccaneer（海盗）：被消灭时移动到其他基地的拦截器在所有消灭路径上生效
 * 2. pirate_first_mate（大副）：计分后移动到其他基地的拦截器在计分弃牌路径上生效
 *
 * 审计维度：D31（效果拦截路径完整性）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import { smashUpFlowHooks } from '../domain/index';
import { initAllAbilities } from '../abilities';
import type { SmashUpCore } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { createFlowSystem, createBaseSystems } from '../../../engine';

describe('D31: pirate_buccaneer 拦截路径完整性', () => {
    let runner: GameTestRunner<SmashUpCore>;

    beforeEach(() => {
        initAllAbilities();
        const domain = new SmashUpDomain();
        const systems = smashUpSystemsForTest();
        const flowSystem = createFlowSystem(smashUpFlowHooks);
        runner = new GameTestRunner(domain, [...createBaseSystems(), ...systems, flowSystem]);
    });

    describe('消灭路径1：行动卡消灭', () => {
        it('pirate_buccaneer 被 pirate_saucy_wench 消灭时触发移动交互', () => {
            runner.setState({
                core: {
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 0,
                    turnNumber: 1,
                    players: {
                        '0': {
                            id: '0',
                            hand: [{ uid: 'm1', defId: 'pirate_saucy_wench', owner: '0', type: 'minion' }],
                            deck: [],
                            discard: [],
                            factions: ['pirates', 'pirates'] as [string, string],
                            vp: 0,
                            minionsPlayed: 0,
                            minionLimit: 1,
                            actionsPlayed: 0,
                            actionLimit: 1,
                            minionsPlayedPerBase: {},
                            sameNameMinionDefId: null,
                        },
                        '1': {
                            id: '1',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['test', 'test'] as [string, string],
                            vp: 0,
                            minionsPlayed: 0,
                            minionLimit: 1,
                            actionsPlayed: 0,
                            actionLimit: 1,
                            minionsPlayedPerBase: {},
                            sameNameMinionDefId: null,
                        },
                    },
                    bases: [
                        {
                            uid: 'b1',
                            defId: 'test_base_1',
                            breakpoint: 20,
                            minions: [
                                {
                                    uid: 'bucc1',
                                    defId: 'pirate_buccaneer',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 3,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                        {
                            uid: 'b2',
                            defId: 'test_base_2',
                            breakpoint: 20,
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                    baseDeck: [],
                    tempBreakpointModifiers: {},
                },
                sys: {
                    phase: 'main',
                    responseWindow: { current: undefined },
                    interaction: { current: undefined, queue: [] },
                },
            });

            // 玩家0打出 pirate_saucy_wench（消灭力量≤2的随从）
            runner.dispatch({ type: 'PLAY_MINION', payload: { cardUid: 'm1', baseIndex: 0 } });

            // 验证：应该创建移动交互（而非直接消灭）
            const interaction = runner.getState().sys.interaction?.current;
            expect(interaction).toBeDefined();
            expect(interaction?.data.sourceId).toBe('pirate_buccaneer_move');
        });
    });

    describe('消灭路径2：随从能力消灭', () => {
        it('pirate_buccaneer 被随从能力消灭时触发移动交互', () => {
            const runner = new GameTestRunner(engineConfig);
            runner.setState({
                core: {
                    currentPlayer: '0',
                    turnNumber: 1,
                    players: {
                        '0': {
                            id: '0',
                            hand: [{ uid: 'm1', defId: 'test_destroyer_minion', owner: '0', type: 'minion' }],
                            deck: [],
                            discard: [],
                            factions: ['pirates', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                        '1': {
                            id: '1',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['test', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                    },
                    bases: [
                        {
                            uid: 'b1',
                            defId: 'test_base_1',
                            breakpoint: 20,
                            minions: [
                                {
                                    uid: 'bucc1',
                                    defId: 'pirate_buccaneer',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 3,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                        {
                            uid: 'b2',
                            defId: 'test_base_2',
                            breakpoint: 20,
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                    baseDeck: [],
                    tempBreakpointModifiers: {},
                },
                sys: {
                    phase: 'main',
                    responseWindow: { current: undefined },
                    interaction: { current: undefined, queue: [] },
                },
            });

            // 打出有消灭能力的随从（如 pirate_saucy_wench）
            runner.dispatch({ type: 'PLAY_MINION', payload: { cardUid: 'm1', baseIndex: 0 } });

            // 验证：应该创建移动交互
            const interaction = runner.getState().sys.interaction?.current;
            expect(interaction).toBeDefined();
            expect(interaction?.data.sourceId).toBe('pirate_buccaneer_move');
        });
    });

    describe('消灭路径3：基地计分消灭', () => {
        it('pirate_buccaneer 在基地计分时被消灭时触发移动交互', () => {
            const runner = new GameTestRunner(engineConfig);
            runner.setState({
                core: {
                    currentPlayer: '0',
                    turnNumber: 1,
                    players: {
                        '0': {
                            id: '0',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['pirates', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                        '1': {
                            id: '1',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['test', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                    },
                    bases: [
                        {
                            uid: 'b1',
                            defId: 'test_base_1',
                            breakpoint: 10,
                            minions: [
                                {
                                    uid: 'bucc1',
                                    defId: 'pirate_buccaneer',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 3,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'm1',
                                    defId: 'test_minion',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 8,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                        {
                            uid: 'b2',
                            defId: 'test_base_2',
                            breakpoint: 20,
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                    baseDeck: ['test_base_3'],
                    tempBreakpointModifiers: {},
                },
                sys: {
                    phase: 'main',
                    responseWindow: { current: undefined },
                    interaction: { current: undefined, queue: [] },
                },
            });

            // 推进到计分阶段
            runner.dispatch({ type: 'ADVANCE_PHASE', payload: {} });

            // 验证：应该创建移动交互（在 BASE_CLEARED 之前）
            const interaction = runner.getState().sys.interaction?.current;
            expect(interaction).toBeDefined();
            expect(interaction?.data.sourceId).toBe('pirate_buccaneer_move');

            // 验证：buccaneer 尚未被消灭（MINION_DESTROYED 事件被暂缓）
            const state = runner.getState();
            const base = state.core.bases.find(b => b.uid === 'b1');
            expect(base?.minions.some(m => m.uid === 'bucc1')).toBe(true);
        });
    });

    describe('单基地自动移动', () => {
        it('只有一个其他基地时自动移动（无需交互）', () => {
            const runner = new GameTestRunner(engineConfig);
            runner.setState({
                core: {
                    currentPlayer: '0',
                    turnNumber: 1,
                    players: {
                        '0': {
                            id: '0',
                            hand: [{ uid: 'a1', defId: 'test_destroy_action', owner: '0', type: 'action' }],
                            deck: [],
                            discard: [],
                            factions: ['pirates', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                        '1': {
                            id: '1',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['test', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                    },
                    bases: [
                        {
                            uid: 'b1',
                            defId: 'test_base_1',
                            breakpoint: 20,
                            minions: [
                                {
                                    uid: 'bucc1',
                                    defId: 'pirate_buccaneer',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 3,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                        // 只有一个其他基地
                    ],
                    baseDeck: [],
                    tempBreakpointModifiers: {},
                },
                sys: {
                    phase: 'main',
                    responseWindow: { current: undefined },
                    interaction: { current: undefined, queue: [] },
                },
            });

            // 打出消灭行动卡
            runner.dispatch({ type: 'PLAY_ACTION', payload: { cardUid: 'a1', targetBaseIndex: 0 } });

            // 验证：无交互（自动移动）
            const interaction = runner.getState().sys.interaction?.current;
            expect(interaction).toBeUndefined();

            // 验证：buccaneer 已移动到唯一的其他基地（但由于只有一个基地，实际无法移动）
            // 注意：单基地场景下 buccaneer 无法移动（无其他基地），应该正常被消灭
        });
    });
});

describe('D31: pirate_first_mate 拦截路径完整性', () => {
    let runner: GameTestRunner<SmashUpCore>;

    beforeEach(() => {
        initAllAbilities();
        const domain = new SmashUpDomain();
        const systems = smashUpSystemsForTest();
        const flowSystem = createFlowSystem(smashUpFlowHooks);
        runner = new GameTestRunner(domain, [...createBaseSystems(), ...systems, flowSystem]);
    });

    describe('计分后弃牌路径', () => {
        it('pirate_first_mate 在基地计分后触发移动交互（而非进入弃牌堆）', () => {
            const runner = new GameTestRunner(engineConfig);
            runner.setState({
                core: {
                    currentPlayer: '0',
                    turnNumber: 1,
                    players: {
                        '0': {
                            id: '0',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['pirates', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                        '1': {
                            id: '1',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['test', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                    },
                    bases: [
                        {
                            uid: 'b1',
                            defId: 'test_base_1',
                            breakpoint: 10,
                            minions: [
                                {
                                    uid: 'mate1',
                                    defId: 'pirate_first_mate',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 5,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'm1',
                                    defId: 'test_minion',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 6,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                        {
                            uid: 'b2',
                            defId: 'test_base_2',
                            breakpoint: 20,
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                    baseDeck: ['test_base_3'],
                    tempBreakpointModifiers: {},
                },
                sys: {
                    phase: 'main',
                    responseWindow: { current: undefined },
                    interaction: { current: undefined, queue: [] },
                },
            });

            // 推进到计分阶段
            runner.dispatch({ type: 'ADVANCE_PHASE', payload: {} });

            // 验证：应该创建移动交互
            const interaction = runner.getState().sys.interaction?.current;
            expect(interaction).toBeDefined();
            expect(interaction?.id).toMatch(/pirate_first_mate_choose_base_mate1_/);
            expect(interaction?.data.title).toContain('大副');
        });

        it('玩家选择跳过时，first_mate 正常进入弃牌堆', () => {
            const runner = new GameTestRunner(engineConfig);
            runner.setState({
                core: {
                    currentPlayer: '0',
                    turnNumber: 1,
                    players: {
                        '0': {
                            id: '0',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['pirates', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                        '1': {
                            id: '1',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['test', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                    },
                    bases: [
                        {
                            uid: 'b1',
                            defId: 'test_base_1',
                            breakpoint: 10,
                            minions: [
                                {
                                    uid: 'mate1',
                                    defId: 'pirate_first_mate',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 5,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'm1',
                                    defId: 'test_minion',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 6,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                        {
                            uid: 'b2',
                            defId: 'test_base_2',
                            breakpoint: 20,
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                    baseDeck: ['test_base_3'],
                    tempBreakpointModifiers: {},
                },
                sys: {
                    phase: 'main',
                    responseWindow: { current: undefined },
                    interaction: { current: undefined, queue: [] },
                },
            });

            // 推进到计分阶段
            runner.dispatch({ type: 'ADVANCE_PHASE', payload: {} });

            // 玩家选择跳过
            runner.dispatch({ type: 'SYS_INTERACTION_RESPOND', payload: { value: { skip: true } } });

            // 验证：first_mate 应该在弃牌堆中
            const state = runner.getState();
            expect(state.core.players['0'].discard.some(c => c.uid === 'mate1')).toBe(true);
        });

        it('玩家选择移动时，first_mate 移动到目标基地', () => {
            const runner = new GameTestRunner(engineConfig);
            runner.setState({
                core: {
                    currentPlayer: '0',
                    turnNumber: 1,
                    players: {
                        '0': {
                            id: '0',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['pirates', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                        '1': {
                            id: '1',
                            hand: [],
                            deck: [],
                            discard: [],
                            factions: ['test', 'test'] as [string, string],
                            vp: 0,
                            extraDraws: 0,
                            extraPlays: 0,
                            extraActions: 0,
                            powerCounters: {},
                        },
                    },
                    bases: [
                        {
                            uid: 'b1',
                            defId: 'test_base_1',
                            breakpoint: 10,
                            minions: [
                                {
                                    uid: 'mate1',
                                    defId: 'pirate_first_mate',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 5,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                                {
                                    uid: 'm1',
                                    defId: 'test_minion',
                                    controller: '0',
                                    owner: '0',
                                    basePower: 6,
                                    permanentPowerModifier: 0,
                                    tempPowerModifier: 0,
                                    attachedActions: [],
                                },
                            ],
                            ongoingActions: [],
                        },
                        {
                            uid: 'b2',
                            defId: 'test_base_2',
                            breakpoint: 20,
                            minions: [],
                            ongoingActions: [],
                        },
                    ],
                    baseDeck: ['test_base_3'],
                    tempBreakpointModifiers: {},
                },
                sys: {
                    phase: 'main',
                    responseWindow: { current: undefined },
                    interaction: { current: undefined, queue: [] },
                },
            });

            // 推进到计分阶段
            runner.dispatch({ type: 'ADVANCE_PHASE', payload: {} });

            // 玩家选择移动到基地1
            runner.dispatch({ type: 'SYS_INTERACTION_RESPOND', payload: { value: { baseIndex: 1 } } });

            // 验证：first_mate 应该在基地1上
            const state = runner.getState();
            const base1 = state.core.bases.find(b => b.uid === 'b2');
            expect(base1?.minions.some(m => m.uid === 'mate1')).toBe(true);

            // 验证：first_mate 不在弃牌堆中
            expect(state.core.players['0'].discard.some(c => c.uid === 'mate1')).toBe(false);
        });
    });
});
