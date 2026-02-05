/**
 * ActionLogSystem 单元测试
 */

import { describe, it, expect } from 'vitest';
import { createActionLogSystem } from '../ActionLogSystem';
import type { ActionLogEntry, Command, MatchState, RandomFn } from '../../types';
import { DEFAULT_TUTORIAL_STATE } from '../../types';

const mockRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: (arr) => [...arr],
};

const createStateWithoutActionLog = (): MatchState<unknown> => {
    const sys = {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        prompt: { queue: [] },
        log: { entries: [], maxEntries: 1000 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        rematch: { votes: {}, ready: false },
        responseWindow: { current: undefined },
        tutorial: { ...DEFAULT_TUTORIAL_STATE },
        turnNumber: 1,
        phase: 'main1',
    } as unknown as MatchState<unknown>['sys'];

    return {
        sys,
        core: {},
    };
};

describe('ActionLogSystem', () => {
    it('缺失 actionLog 时可容错写入', () => {
        const system = createActionLogSystem({
            maxEntries: 2,
            commandAllowlist: ['ADVANCE_PHASE'],
            formatEntry: ({ command }): ActionLogEntry => ({
                id: `${command.type}-${command.playerId}`,
                timestamp: command.timestamp ?? Date.now(),
                actorId: command.playerId,
                kind: command.type,
                segments: [{ type: 'text', text: '推进阶段' }],
            }),
        });

        const state = createStateWithoutActionLog();
        const command: Command = {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: {},
            timestamp: Date.now(),
        };

        const result = system.afterEvents?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.state?.sys.actionLog.entries).toHaveLength(1);
        expect(result?.state?.sys.actionLog.maxEntries).toBe(2);
    });
});
