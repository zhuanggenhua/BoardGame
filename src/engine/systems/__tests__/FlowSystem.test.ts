/**
 * FlowSystem 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
    createFlowSystem,
    getCurrentPhase,
    setPhase,
    FLOW_COMMANDS,
    FLOW_EVENTS,
    type FlowHooks,
} from '../FlowSystem';
import type { MatchState, Command, RandomFn } from '../../types';
import { DEFAULT_TUTORIAL_STATE } from '../../types';

// 模拟 RandomFn
const mockRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: (arr) => [...arr],
};

interface TestCore {
    value: number;
}

const createTestState = (
    phase: string,
    sysOverrides?: Partial<MatchState<TestCore>['sys']>,
): MatchState<TestCore> => ({
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        interaction: { queue: [] },
        log: { entries: [], maxEntries: 1000 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: { current: undefined },
        tutorial: { ...DEFAULT_TUTORIAL_STATE },
        turnNumber: 1,
        phase,
        ...sysOverrides,
    },
    core: { value: 0 },
});

describe('FlowSystem', () => {
    const buildHooks = (partial?: Partial<FlowHooks<TestCore>>): FlowHooks<TestCore> => ({
        initialPhase: 'phase1',
        getNextPhase: () => 'phase2',
        ...partial,
    });

    it('setup 使用 hooks.initialPhase 初始化 sys.phase', () => {
        const system = createFlowSystem<TestCore>({ hooks: buildHooks({ initialPhase: 'init' }) });
        const result = system.setup?.(['0', '1']);
        expect(result).toEqual({ phase: 'init' });
    });

    it('canAdvance 返回错误时阻止推进', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                canAdvance: () => ({ ok: false, error: 'blocked' }),
            }),
        });

        const state = createTestState('phase1');
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('blocked');
    });

    it('正常推进：更新 sys.phase 并发出 SYS_PHASE_CHANGED', () => {
        const system = createFlowSystem<TestCore>({ hooks: buildHooks() });

        const state = createTestState('phase1');
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.state?.sys.phase).toBe('phase2');
        // 成功推进后 flowHalted 清除
        expect(result?.state?.sys.flowHalted).toBe(false);
        expect(result?.events).toContainEqual(
            expect.objectContaining({
                type: FLOW_EVENTS.PHASE_CHANGED,
                payload: expect.objectContaining({ from: 'phase1', to: 'phase2' }),
            })
        );
    });

    it('onPhaseExit halt：不切换阶段', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onPhaseExit: () => ({ halt: true, events: [] }),
            }),
        });

        const state = createTestState('phase1');
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.state?.sys.phase).toBe('phase1');
        // halt 时设置 flowHalted 标记，供 onAutoContinueCheck 判断
        expect(result?.state?.sys.flowHalted).toBe(true);
    });

    it('onPhaseExit overrideNextPhase：覆盖下一阶段', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onPhaseExit: () => ({ overrideNextPhase: 'phase3' }),
            }),
        });

        const state = createTestState('phase1');
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state?.sys.phase).toBe('phase3');
    });

    it('onPhaseExit 返回 updatedState 且不 halt 时，应保留 updatedState 再推进阶段', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onPhaseExit: ({ state }) => ({
                    updatedState: {
                        ...state,
                        core: { value: 42 },
                        sys: {
                            ...state.sys,
                            turnNumber: 7,
                        },
                    },
                }),
            }),
        });

        const state = createTestState('phase1');
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state?.core.value).toBe(42);
        expect(result?.state?.sys.turnNumber).toBe(7);
        expect(result?.state?.sys.phase).toBe('phase2');
        expect(result?.state?.sys.flowHalted).toBe(false);
    });

    it('onPhaseEnter 返回 updatedState 时，应保留其状态并覆盖 phase', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onPhaseEnter: ({ state }) => ({
                    updatedState: {
                        ...state,
                        core: { value: 99 },
                        sys: {
                            ...state.sys,
                            turnNumber: 8,
                            phase: 'stale-phase',
                        },
                    },
                }),
            }),
        });

        const state = createTestState('phase1');
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state?.core.value).toBe(99);
        expect(result?.state?.sys.turnNumber).toBe(8);
        expect(result?.state?.sys.phase).toBe('phase2');
        expect(result?.state?.sys.flowHalted).toBe(false);
    });

    it('onPhaseEnter 返回的事件会包含在结果中', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onPhaseEnter: () => [
                    { type: 'SOME_DOMAIN_EVENT', payload: {}, timestamp: 1 },
                ],
            }),
        });

        const state = createTestState('phase1');
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.events?.some((e) => e.type === 'SOME_DOMAIN_EVENT')).toBe(true);
    });

    it('存在被阻塞的 resolution frame 时，阻止阶段推进', () => {
        const system = createFlowSystem<TestCore>({ hooks: buildHooks() });
        const state = createTestState('phase1', {
            resolution: {
                activeFrameId: 'frame-1',
                frames: [{
                    id: 'frame-1',
                    kind: 'test:scoring-frame',
                    ownerGame: 'test-game',
                    ordering: 'explicit',
                    status: 'blocked',
                    phase: 'phase1',
                    phaseGate: 'block-advance-when-blocked',
                    blockedBy: { type: 'interaction', id: 'interaction-1', reason: 'simple-choice' },
                }],
            },
        });
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('resolution_blocked');
    });

    it('active blocking frame 的 phase 与 sys.phase 不一致时，仍应阻止阶段推进', () => {
        const system = createFlowSystem<TestCore>({ hooks: buildHooks() });
        const state = createTestState('phase2', {
            resolution: {
                activeFrameId: 'frame-1',
                frames: [{
                    id: 'frame-1',
                    kind: 'test:reaction-after-scoring',
                    ownerGame: 'test-game',
                    ordering: 'explicit',
                    status: 'blocked',
                    phase: 'phase1',
                    phaseGate: 'block-advance-when-blocked',
                    blockedBy: { type: 'interaction', id: 'interaction-1', reason: 'simple-choice' },
                }],
            },
        });
        const command: Command = { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('resolution_blocked');
    });

    it('存在被阻塞的 resolution frame 时，不触发 autoContinue', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onAutoContinueCheck: () => ({ autoContinue: true, playerId: '0' }),
            }),
        });
        const state = createTestState('phase1', {
            resolution: {
                activeFrameId: 'frame-1',
                frames: [{
                    id: 'frame-1',
                    kind: 'test:scoring-frame',
                    ownerGame: 'test-game',
                    ordering: 'explicit',
                    status: 'blocked',
                    phase: 'phase1',
                    phaseGate: 'block-advance-when-blocked',
                    blockedBy: { type: 'post-reduce', reason: 'awaiting-post-reduce' },
                }],
            },
        });

        const result = system.afterEvents?.({
            state,
            command: { type: 'noop', playerId: '0', payload: {} },
            events: [{ type: 'DOMAIN_EVENT', payload: {}, timestamp: 1 }],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result).toBeUndefined();
    });

    it('当前 afterEvents 轮已有待落地事件时，不触发 autoContinue', () => {
        let autoContinueChecked = false;
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onAutoContinueCheck: () => {
                    autoContinueChecked = true;
                    return { autoContinue: true, playerId: '0' };
                },
            }),
        });
        const state = createTestState('phase1');

        const result = system.afterEvents?.({
            state,
            command: { type: 'noop', playerId: '0', payload: {} },
            events: [{ type: 'DOMAIN_EVENT', payload: {}, timestamp: 1 }],
            random: mockRandom,
            playerIds: ['0', '1'],
            pendingAfterEventsToReduceCount: 1,
        });

        expect(result).toBeUndefined();
        expect(autoContinueChecked).toBe(false);
    });

    it('当前 afterEvents 轮没有待落地事件时，保留原 autoContinue 行为', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onAutoContinueCheck: () => ({ autoContinue: true, playerId: '0' }),
            }),
        });
        const state = createTestState('phase1');

        const result = system.afterEvents?.({
            state,
            command: { type: 'noop', playerId: '0', payload: {} },
            events: [{ type: 'DOMAIN_EVENT', payload: {}, timestamp: 1 }],
            random: mockRandom,
            playerIds: ['0', '1'],
            pendingAfterEventsToReduceCount: 0,
        });

        expect(result?.state?.sys.phase).toBe('phase2');
        expect(result?.events).toContainEqual(
            expect.objectContaining({
                type: FLOW_EVENTS.PHASE_CHANGED,
                payload: expect.objectContaining({ from: 'phase1', to: 'phase2' }),
            }),
        );
    });

    it('getCurrentPhase / setPhase 辅助函数', () => {
        const state = createTestState('main1');
        expect(getCurrentPhase(state)).toBe('main1');
        const newState = setPhase(state, 'main2');
        expect(newState.sys.phase).toBe('main2');
        expect(state.sys.phase).toBe('main1');
    });
});
