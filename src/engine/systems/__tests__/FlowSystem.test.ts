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

const createTestState = (phase: string): MatchState<TestCore> => ({
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        prompt: { queue: [] },
        log: { entries: [], maxEntries: 1000 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: { current: undefined },
        tutorial: { ...DEFAULT_TUTORIAL_STATE },
        turnNumber: 1,
        phase,
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

    it('onPhaseEnter 返回的事件会包含在结果中', () => {
        const system = createFlowSystem<TestCore>({
            hooks: buildHooks({
                onPhaseEnter: () => [
                    { type: 'SOME_DOMAIN_EVENT', payload: {}, timestamp: Date.now() },
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

    it('getCurrentPhase / setPhase 辅助函数', () => {
        const state = createTestState('main1');
        expect(getCurrentPhase(state)).toBe('main1');
        const newState = setPhase(state, 'main2');
        expect(newState.sys.phase).toBe('main2');
        expect(state.sys.phase).toBe('main1');
    });
});
