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

    it('非教程 AI 命令即使带 __tutorialPlayerId，也不应把它当成通用执行者覆盖', () => {
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

    it('非教程 AI 命令只有 __tutorialPlayerId 时，应回退到本地现有执行者真相', () => {
        const result = buildLocalDispatchCommand({
            commandType: 'ROLL_DICE',
            payload: {
                keepIds: [0, 1],
                __tutorialPlayerId: '1',
            },
            state: createState(),
            localPregameControlledPlayerId: '0',
        });

        expect(result.resolvedPlayerId).toBe('0');
        expect(result.command.playerId).toBe('0');
        expect(result.command.payload).toEqual({
            keepIds: [0, 1],
        });
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

    it('教程 AI 命令带 __internalPlayerId 时，仍应优先按 tutorialOverrideId 执行', () => {
        const result = buildLocalDispatchCommand({
            commandType: 'SELECT_CHARACTER',
            payload: {
                characterId: 'monk',
                __internalPlayerId: '0',
                __tutorialPlayerId: '1',
                __tutorialAiCommand: true,
            },
            state: createState(),
            localPregameControlledPlayerId: '0',
        });

        expect(result.resolvedPlayerId).toBe('1');
        expect(result.command.playerId).toBe('1');
        expect(result.tutorialOverrideId).toBe('1');
        expect(result.command.payload).toEqual({
            characterId: 'monk',
            _noSnapshot: true,
        });
    });
});
