import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildTrainingDecisionSample } from '../trainingData';
import {
    JsonlTrainingDataRecorder,
    createTrainingDataRecorderFromEnv,
} from '../../../../server/trainingDataRecorder';

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('trainingData', () => {
    it('应从前后状态中提取交互与响应窗口快照', () => {
        const friendlyBuffHint = {
            relationToActor: 'self',
            effectIntent: 'buff',
            targetKind: 'minion',
        } as const;

        const sample = buildTrainingDecisionSample({
            rulesVersion: 'test-rules-v1',
            gameId: 'smashup',
            matchId: 'match-1',
            playerId: '0',
            seatControllerType: 'human',
            stateIdBefore: 12,
            stateIdAfter: 13,
            commandType: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'yes' },
            preState: {
                core: { currentPlayer: '0' },
                sys: {
                    interaction: {
                        current: {
                            id: 'i-1',
                            kind: 'simple-choice',
                            sourceId: 'robot_hoverbot',
                            playerId: '0',
                            data: {
                                options: [
                                    {
                                        id: 'yes',
                                        label: '是',
                                        value: { play: true },
                                        displayMode: 'button',
                                        _ai: friendlyBuffHint,
                                    },
                                    { id: 'no', label: '否', value: { play: false }, disabled: true },
                                ],
                            },
                        },
                    },
                    responseWindow: {
                        current: {
                            windowType: 'meFirst',
                            currentResponderIndex: 1,
                            responderQueue: ['0', '1'],
                            allowedCommands: ['su:play_action'],
                        },
                    },
                },
            },
            postState: {
                core: { currentPlayer: '0' },
                sys: {
                    interaction: { current: null },
                    responseWindow: { current: null },
                },
            },
            legalActions: [
                {
                    actionId: 'respond:yes',
                    kind: 'interaction',
                    label: '响应 yes',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'yes' } }],
                    aiHints: [friendlyBuffHint],
                },
            ],
            capturedAt: 123456789,
        });

        expect(sample).toMatchObject({
            schemaVersion: 1,
            source: 'online',
            capturedAt: 123456789,
            rulesVersion: 'test-rules-v1',
            gameId: 'smashup',
            matchId: 'match-1',
            playerId: '0',
            seatControllerType: 'human',
            stateIdBefore: 12,
            stateIdAfter: 13,
            command: {
                type: 'SYS_INTERACTION_RESPOND',
                payload: { optionId: 'yes' },
            },
            interactionBefore: {
                id: 'i-1',
                kind: 'simple-choice',
                sourceId: 'robot_hoverbot',
                playerId: '0',
                options: [
                    {
                        id: 'yes',
                        label: '是',
                        value: { play: true },
                        displayMode: 'button',
                        _ai: friendlyBuffHint,
                    },
                    { id: 'no', label: '否', value: { play: false }, disabled: true },
                ],
            },
            interactionAfter: null,
            responseWindowBefore: {
                windowType: 'meFirst',
                currentResponderIndex: 1,
                responderQueue: ['0', '1'],
                allowedCommands: ['su:play_action'],
            },
            responseWindowAfter: null,
            legalActions: [
                {
                    actionId: 'respond:yes',
                    kind: 'interaction',
                    label: '响应 yes',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'yes' } }],
                    aiHints: [friendlyBuffHint],
                },
            ],
        });
    });

    it('JSONL recorder 应将样本按版本、游戏和日期落盘', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);

        const recorder = new JsonlTrainingDataRecorder({ baseDir });
        const sample = buildTrainingDecisionSample({
            rulesVersion: 'test-rules-v1',
            gameId: 'tictactoe',
            matchId: 'match-jsonl-1',
            playerId: '0',
            seatControllerType: 'human',
            stateIdBefore: 1,
            stateIdAfter: 2,
            commandType: 'CLICK_CELL',
            payload: { cellId: 4 },
            preState: { core: { cells: Array(9).fill(null) }, sys: {} },
            postState: { core: { cells: [null, null, null, null, '0', null, null, null, null] }, sys: {} },
            capturedAt: Date.UTC(2026, 2, 25, 12, 0, 0),
        });

        await recorder.recordDecisionSample(sample);

        const filePath = path.join(baseDir, 'raw', 'v1', 'tictactoe', '2026-03-25.jsonl');
        const content = await readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');

        expect(lines).toHaveLength(1);
        expect(JSON.parse(lines[0])).toMatchObject({
            gameId: 'tictactoe',
            matchId: 'match-jsonl-1',
            seatControllerType: 'human',
            command: {
                type: 'CLICK_CELL',
                payload: { cellId: 4 },
            },
        });
    });

    it('recorder 应按保留策略将过期 raw 日志归档到 archive 目录', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);

        const recorder = new JsonlTrainingDataRecorder({
            baseDir,
            retentionDays: 7,
            now: () => new Date('2026-03-26T08:00:00.000Z'),
        });

        const oldSample = buildTrainingDecisionSample({
            rulesVersion: 'test-rules-v1',
            gameId: 'dicethrone',
            matchId: 'match-old',
            playerId: '0',
            seatControllerType: 'human',
            stateIdBefore: 1,
            stateIdAfter: 2,
            commandType: 'PLAY_CARD',
            payload: { cardId: 'upgrade-1' },
            preState: { core: {}, sys: {} },
            postState: { core: {}, sys: {} },
            capturedAt: Date.UTC(2026, 2, 10, 9, 0, 0),
        });
        const recentSample = buildTrainingDecisionSample({
            rulesVersion: 'test-rules-v1',
            gameId: 'dicethrone',
            matchId: 'match-recent',
            playerId: '0',
            seatControllerType: 'human',
            stateIdBefore: 2,
            stateIdAfter: 3,
            commandType: 'ADVANCE_PHASE',
            payload: null,
            preState: { core: {}, sys: {} },
            postState: { core: {}, sys: {} },
            capturedAt: Date.UTC(2026, 2, 24, 9, 0, 0),
        });

        await recorder.recordDecisionSample(oldSample);
        await recorder.recordDecisionSample(recentSample);

        const archivedPath = path.join(baseDir, 'archive', 'v1', 'dicethrone', '2026-03-10.jsonl');
        const recentPath = path.join(baseDir, 'raw', 'v1', 'dicethrone', '2026-03-24.jsonl');
        const archivedContent = await readFile(archivedPath, 'utf8');
        const recentContent = await readFile(recentPath, 'utf8');

        expect(JSON.parse(archivedContent.trim())).toMatchObject({
            matchId: 'match-old',
        });
        expect(JSON.parse(recentContent.trim())).toMatchObject({
            matchId: 'match-recent',
        });
    });

    it('env helper 默认仅 production 开启，显式开关可覆盖', () => {
        expect(createTrainingDataRecorderFromEnv({})).toBeUndefined();
        expect(createTrainingDataRecorderFromEnv({
            NODE_ENV: 'development',
        })).toBeUndefined();
        expect(createTrainingDataRecorderFromEnv({
            NODE_ENV: 'production',
        })).toBeInstanceOf(JsonlTrainingDataRecorder);
        expect(createTrainingDataRecorderFromEnv({
            NODE_ENV: 'development',
            ENABLE_TRAINING_DATA_CAPTURE: 'true',
        })).toBeInstanceOf(JsonlTrainingDataRecorder);
        expect(createTrainingDataRecorderFromEnv({
            NODE_ENV: 'production',
            TRAINING_DATA_DIR: 'custom-root',
            TRAINING_DATA_RETENTION_DAYS: '14',
        })).toBeInstanceOf(JsonlTrainingDataRecorder);
        expect(createTrainingDataRecorderFromEnv({
            NODE_ENV: 'production',
            ENABLE_TRAINING_DATA_CAPTURE: 'false',
        })).toBeUndefined();
    });
});
