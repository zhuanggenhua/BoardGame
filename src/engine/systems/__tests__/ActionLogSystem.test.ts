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
        interaction: { queue: [] },
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
                timestamp: command.timestamp ?? 0,
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
            timestamp: 1,
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

    it('后续事件轮次不会重新生成命令级日志，但仍可记录新事件日志', () => {
        const system = createActionLogSystem({
            maxEntries: 5,
            commandAllowlist: ['CONFIRM_ROLL'],
            formatEntry: ({ command, events, afterEventsRound }): ActionLogEntry[] => {
                const entries: ActionLogEntry[] = [];
                if (afterEventsRound === 0) {
                    entries.push({
                        id: `${command.type}-${command.playerId}-${command.timestamp}`,
                        timestamp: command.timestamp ?? 0,
                        actorId: command.playerId,
                        kind: command.type,
                        segments: [{ type: 'text', text: '确认投掷' }],
                    });
                }
                for (const event of events) {
                    if (event.type !== 'PHASE_CHANGED') continue;
                    entries.push({
                        id: `${event.type}-${event.timestamp}`,
                        timestamp: event.timestamp,
                        actorId: command.playerId,
                        kind: event.type,
                        segments: [{ type: 'text', text: '阶段推进' }],
                    });
                }
                return entries;
            },
        });

        const command: Command = {
            type: 'CONFIRM_ROLL',
            playerId: '0',
            payload: {},
            timestamp: 10,
        };

        const first = system.afterEvents?.({
            state: createStateWithoutActionLog(),
            command,
            events: [{ type: 'ROLL_CONFIRMED', payload: { playerId: '0' }, timestamp: 10 }],
            random: mockRandom,
            playerIds: ['0', '1'],
            afterEventsRound: 0,
        });

        expect(first?.state?.sys.actionLog.entries).toHaveLength(1);

        const second = system.afterEvents?.({
            state: first!.state!,
            command,
            events: [{ type: 'PHASE_CHANGED', payload: { from: 'offensiveRoll', to: 'defensiveRoll' }, timestamp: 11 }],
            random: mockRandom,
            playerIds: ['0', '1'],
            afterEventsRound: 1,
        });

        expect(second?.state?.sys.actionLog.entries).toHaveLength(2);
        expect(second?.state?.sys.actionLog.entries.map(entry => entry.kind)).toEqual([
            'CONFIRM_ROLL',
            'PHASE_CHANGED',
        ]);
    });

    it('同一稳定日志 id 在后续事件轮次不会重复写入', () => {
        const system = createActionLogSystem({
            maxEntries: 5,
            commandAllowlist: ['RESERVE_OPEN_CARD'],
            formatEntry: ({ command }): ActionLogEntry => ({
                id: `${command.type}-${command.playerId}-${command.timestamp}`,
                timestamp: command.timestamp ?? 0,
                actorId: command.playerId,
                kind: command.type,
                segments: [{ type: 'text', text: '保留公开牌' }],
            }),
        });
        const command: Command = {
            type: 'RESERVE_OPEN_CARD',
            playerId: '0',
            payload: { cardId: 'card-1' },
            timestamp: 42,
        };

        const first = system.afterEvents?.({
            state: createStateWithoutActionLog(),
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
            afterEventsRound: 0,
        });
        const second = system.afterEvents?.({
            state: first!.state!,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
            afterEventsRound: 1,
        });

        expect(second?.state?.sys.actionLog.entries).toHaveLength(1);
        expect(second?.state?.sys.actionLog.entries[0]?.id).toBe('RESERVE_OPEN_CARD-0-42');
    });
});
