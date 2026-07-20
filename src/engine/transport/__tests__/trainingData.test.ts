import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildTrainingDecisionSample, type TrainingDecisionSample } from '../trainingData';
import {
    JsonlTrainingDataRecorder,
    createTrainingDataRecorderFromEnv,
} from '../../../../server/trainingDataRecorder';

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const createSample = (
    matchId: string,
    commandType: string,
    capturedAt: number,
    gameOver?: unknown,
): TrainingDecisionSample => buildTrainingDecisionSample({
    rulesVersion: 'test-rules-v1',
    gameId: 'tictactoe',
    matchId,
    playerId: '0',
    seatControllerType: 'human',
    stateIdBefore: 1,
    stateIdAfter: 2,
    commandType,
    payload: { cellId: 4 },
    preState: { core: { cells: Array(9).fill(null) }, sys: {} },
    postState: { core: { cells: [null, null, null, null, '0', null, null, null, null] }, sys: {} },
    capturedAt,
    gameOver,
});

const listFiles = async (dirPath: string): Promise<string[]> => {
    let entries;
    try {
        entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
        return [];
    }
    const files: string[] = [];
    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFiles(entryPath));
        } else if (entry.isFile()) {
            files.push(entryPath);
        }
    }
    return files;
};

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
                                options: [{
                                    id: 'yes',
                                    label: '是',
                                    value: { play: true },
                                    displayMode: 'button',
                                    _ai: friendlyBuffHint,
                                }],
                            },
                        },
                    },
                },
            },
            postState: { core: { currentPlayer: '0' }, sys: { interaction: { current: null } } },
            legalActions: [{
                actionId: 'respond:yes',
                kind: 'interaction',
                label: '响应 yes',
                commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'yes' } }],
                aiHints: [friendlyBuffHint],
            }],
            capturedAt: 123456789,
        });

        expect(sample).toMatchObject({
            schemaVersion: 1,
            gameId: 'smashup',
            matchId: 'match-1',
            seatControllerType: 'human',
            interactionBefore: {
                id: 'i-1',
                sourceId: 'robot_hoverbot',
            },
            interactionAfter: null,
        });
    });

    it('未完成对局只能进入 pending，不得出现正式文件', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);
        const recorder = new JsonlTrainingDataRecorder({ baseDir });

        await recorder.stageDecisionSample(createSample('match-pending', 'CLICK_CELL', Date.now()));

        expect(await listFiles(path.join(baseDir, 'pending'))).toHaveLength(1);
        expect(await listFiles(path.join(baseDir, 'completed'))).toHaveLength(0);
    });

    it('完整合格对局应一次提交全部决策样本', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);
        const recorder = new JsonlTrainingDataRecorder({ baseDir });
        const completedAt = Date.UTC(2026, 2, 25, 12, 0, 0);

        await recorder.stageDecisionSample(createSample('match-complete', 'CLICK_CELL', completedAt - 1000));
        const result = await recorder.commitCompletedMatch({
            schemaVersion: 1,
            gameId: 'tictactoe',
            matchId: 'match-complete',
            completedAt,
            durationMs: 600_000,
            finalSample: createSample('match-complete', 'CLICK_CELL', completedAt, { winner: '0' }),
        });

        expect(result.status).toBe('committed');
        expect(await listFiles(path.join(baseDir, 'pending'))).toHaveLength(0);
        const completedFiles = await listFiles(path.join(baseDir, 'completed'));
        expect(completedFiles).toHaveLength(1);
        const lines = (await readFile(completedFiles[0], 'utf8')).trim().split('\n');
        expect(lines).toHaveLength(2);
        expect(lines.map((line) => JSON.parse(line).matchId)).toEqual([
            'match-complete',
            'match-complete',
        ]);
    });

    it('每游戏达到容量上限后应整局拒收且保留既有文件', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);
        const maxBytesPerGame = 512;
        const completedDir = path.join(baseDir, 'completed', 'v1', 'tictactoe', '2026-03-01');
        const completedFile = path.join(completedDir, 'existing.jsonl');
        await mkdir(completedDir, { recursive: true });
        await writeFile(completedFile, 'x'.repeat(maxBytesPerGame), 'utf8');
        const recorder = new JsonlTrainingDataRecorder({ baseDir, maxBytesPerGame });
        await recorder.stageDecisionSample(createSample('match-cap', 'CLICK_CELL', Date.now()));

        const result = await recorder.commitCompletedMatch({
            schemaVersion: 1,
            gameId: 'tictactoe',
            matchId: 'match-cap',
            completedAt: Date.now(),
            durationMs: 600_000,
        });

        expect(result.status).toBe('capacity-reached');
        expect((await readFile(completedFile, 'utf8')).length).toBe(maxBytesPerGame);
        expect(await listFiles(path.join(baseDir, 'completed'))).toHaveLength(1);
        expect(await listFiles(path.join(baseDir, 'pending'))).toHaveLength(0);
    });

    it('旧 raw 未筛选数据不得占用正式 completed 的 300MiB 配额', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);
        const rawDir = path.join(baseDir, 'raw', 'v1', 'tictactoe');
        await mkdir(rawDir, { recursive: true });
        await writeFile(path.join(rawDir, '2026-03-01.jsonl'), 'x'.repeat(1024), 'utf8');
        const sample = createSample('match-after-legacy', 'CLICK_CELL', Date.now());
        const sampleBytes = Buffer.byteLength(`${JSON.stringify(sample)}\n`, 'utf8');
        const recorder = new JsonlTrainingDataRecorder({
            baseDir,
            maxBytesPerGame: sampleBytes + 32,
        });

        await recorder.stageDecisionSample(sample);
        const result = await recorder.commitCompletedMatch({
            schemaVersion: 1,
            gameId: 'tictactoe',
            matchId: 'match-after-legacy',
            completedAt: Date.now(),
            durationMs: 600_000,
        });

        expect(result.status).toBe('committed');
        expect(await listFiles(path.join(baseDir, 'completed'))).toHaveLength(1);
        const legacyFiles = [
            ...await listFiles(path.join(baseDir, 'raw')),
            ...await listFiles(path.join(baseDir, 'archive')),
        ];
        expect(legacyFiles).toHaveLength(1);
    });

    it('超过 24 小时的未完成 pending 应被清理且不产生正式文件', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);
        const now = new Date('2026-03-26T08:00:00.000Z');
        const recorder = new JsonlTrainingDataRecorder({
            baseDir,
            pendingRetentionHours: 24,
            now: () => now,
        });
        await recorder.stageDecisionSample(createSample('match-abandoned', 'CLICK_CELL', now.getTime()));
        const [pendingFile] = await listFiles(path.join(baseDir, 'pending'));
        const expiredAt = new Date(now.getTime() - 25 * 60 * 60 * 1000);
        await utimes(pendingFile, expiredAt, expiredAt);

        const summary = await recorder.cleanupExpiredPendingFiles();

        expect(summary.removedFiles).toBe(1);
        expect(summary.removedBytes).toBeGreaterThan(0);
        expect(await listFiles(path.join(baseDir, 'pending'))).toHaveLength(0);
        expect(await listFiles(path.join(baseDir, 'completed'))).toHaveLength(0);
    });

    it('并发提交同一游戏时容量检查必须串行', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);
        const sampleA = createSample('match-a', 'CLICK_CELL', Date.now());
        const sampleBytes = Buffer.byteLength(`${JSON.stringify(sampleA)}\n`, 'utf8');
        const recorder = new JsonlTrainingDataRecorder({
            baseDir,
            maxBytesPerGame: sampleBytes + 32,
        });
        await Promise.all([
            recorder.stageDecisionSample(sampleA),
            recorder.stageDecisionSample(createSample('match-b', 'CLICK_CELL', Date.now())),
        ]);

        const results = await Promise.all([
            recorder.commitCompletedMatch({
                schemaVersion: 1,
                gameId: 'tictactoe',
                matchId: 'match-a',
                completedAt: Date.now(),
                durationMs: 600_000,
            }),
            recorder.commitCompletedMatch({
                schemaVersion: 1,
                gameId: 'tictactoe',
                matchId: 'match-b',
                completedAt: Date.now(),
                durationMs: 600_000,
            }),
        ]);

        expect(results.map((result) => result.status).sort()).toEqual([
            'capacity-reached',
            'committed',
        ]);
        expect(await listFiles(path.join(baseDir, 'completed'))).toHaveLength(1);
    });

    it('recorder 应继续归档既有 raw 日志', async () => {
        const baseDir = await mkdtemp(path.join(os.tmpdir(), 'bg-training-data-'));
        tempDirs.push(baseDir);
        const rawDir = path.join(baseDir, 'raw', 'v1', 'dicethrone');
        await mkdir(rawDir, { recursive: true });
        await writeFile(path.join(rawDir, '2026-03-10.jsonl'), '{"matchId":"match-old"}\n', 'utf8');
        const recorder = new JsonlTrainingDataRecorder({
            baseDir,
            retentionDays: 7,
            now: () => new Date('2026-03-26T08:00:00.000Z'),
        });

        await recorder.archiveExpiredRawFiles();

        const archivedPath = path.join(baseDir, 'archive', 'v1', 'dicethrone', '2026-03-10.jsonl');
        expect(JSON.parse((await readFile(archivedPath, 'utf8')).trim())).toMatchObject({
            matchId: 'match-old',
        });
    });

    it('env helper 默认仅 production 开启，显式开关可覆盖', () => {
        expect(createTrainingDataRecorderFromEnv({})).toBeUndefined();
        expect(createTrainingDataRecorderFromEnv({ NODE_ENV: 'development' })).toBeUndefined();
        expect(createTrainingDataRecorderFromEnv({ NODE_ENV: 'production' }))
            .toBeInstanceOf(JsonlTrainingDataRecorder);
        expect(createTrainingDataRecorderFromEnv({
            NODE_ENV: 'development',
            ENABLE_TRAINING_DATA_CAPTURE: 'true',
        })).toBeInstanceOf(JsonlTrainingDataRecorder);
        expect(createTrainingDataRecorderFromEnv({
            NODE_ENV: 'production',
            ENABLE_TRAINING_DATA_CAPTURE: 'false',
        })).toBeUndefined();
    });

    it('生产 compose 必须把训练目录挂载到 game-server 独立持久化卷', async () => {
        const compose = await readFile(path.join(process.cwd(), 'docker-compose.prod.yml'), 'utf8');
        expect(compose).toContain('ENABLE_TRAINING_DATA_CAPTURE: "false"');
        expect(compose).toContain('TRAINING_DATA_DIR: /data/training-data');
        expect(compose).toContain('TRAINING_DATA_MIN_COMPLETED_MATCH_DURATION_MS: ${TRAINING_DATA_MIN_COMPLETED_MATCH_DURATION_MS:-600000}');
        expect(compose).toContain('TRAINING_DATA_PENDING_RETENTION_HOURS: ${TRAINING_DATA_PENDING_RETENTION_HOURS:-24}');
        expect(compose).toContain('- training_data:/data/training-data');
        expect(compose).toMatch(/\r?\n {2}training_data:\r?\n {4}driver: local/);
    });
});
