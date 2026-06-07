import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import { buildLocalDispatchCommand } from '../localDispatchCommand';

type TestCore = { activePlayerId: string };

const createState = (): MatchState<TestCore> => ({
    core: { activePlayerId: '0' },
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        interaction: { queue: [] },
        log: { entries: [], maxEntries: 0 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: {
            current: {
                responderQueue: ['0'],
                currentResponderIndex: 0,
            },
        },
        turnNumber: 1,
        phase: 'defensiveRoll',
    },
});

describe('buildLocalDispatchCommand', () => {
    it('测试承载层显式指定 playerId 时，应优先使用 __internalPlayerId', () => {
        const result = buildLocalDispatchCommand({
            commandType: 'ROLL_DICE',
            payload: {
                keepIds: [0, 1],
                __internalPlayerId: '1',
            },
            state: createState(),
            localPregameControlledPlayerId: '0',
        });

        expect(result.resolvedPlayerId).toBe('1');
        expect(result.command.playerId).toBe('1');
        expect(result.command.payload).toEqual({
            keepIds: [0, 1],
        });
    });

    it('内部 override 与教程 override 同时存在时，应优先使用内部 override', () => {
        const result = buildLocalDispatchCommand({
            commandType: 'ROLL_DICE',
            payload: {
                __internalPlayerId: '1',
                __tutorialPlayerId: '0',
            },
            state: createState(),
            localPregameControlledPlayerId: '0',
        });

        expect(result.resolvedPlayerId).toBe('1');
        expect(result.command.playerId).toBe('1');
        expect(result.command.payload).toEqual({});
    });

    it('教程 AI 命令应自动附带 _noSnapshot，避免占用撤回次数', () => {
        const result = buildLocalDispatchCommand({
            commandType: 'ROLL_DICE',
            payload: {
                keepIds: [0, 1],
                __tutorialPlayerId: '1',
                __tutorialAiCommand: true,
            },
            state: createState(),
            localPregameControlledPlayerId: '0',
        });

        expect(result.resolvedPlayerId).toBe('1');
        expect(result.command.playerId).toBe('1');
        expect(result.command.payload).toEqual({
            keepIds: [0, 1],
            _noSnapshot: true,
        });
    });
});
