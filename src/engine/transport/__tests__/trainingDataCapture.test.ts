import { describe, expect, it } from 'vitest';
import type {
    TrainingCompletedMatch,
    TrainingDataRecorder,
    TrainingDecisionSample,
    TrainingMatchCommitResult,
} from '../trainingData';
import { TrainingDataCapture } from '../trainingDataCapture';
import { createInitialSystemState } from '../../pipeline';

class MockTrainingDataRecorder implements TrainingDataRecorder {
    readonly pending = new Map<string, TrainingDecisionSample[]>();
    readonly completedMatches: TrainingDecisionSample[][] = [];
    readonly discarded: Array<Pick<TrainingCompletedMatch, 'schemaVersion' | 'gameId' | 'matchId'>> = [];

    stageDecisionSample(sample: TrainingDecisionSample): void {
        const samples = this.pending.get(sample.matchId) ?? [];
        samples.push(sample);
        this.pending.set(sample.matchId, samples);
    }

    commitCompletedMatch(match: TrainingCompletedMatch): TrainingMatchCommitResult {
        const samples = this.pending.get(match.matchId) ?? [];
        if (match.finalSample) samples.push(match.finalSample);
        this.pending.delete(match.matchId);
        this.completedMatches.push(samples);
        return {
            status: 'committed',
            committedBytes: 1,
            gameBytes: 1,
            maxBytes: 300 * 1024 * 1024,
        };
    }

    discardPendingMatch(match: Pick<TrainingCompletedMatch, 'schemaVersion' | 'gameId' | 'matchId'>): void {
        this.pending.delete(match.matchId);
        this.discarded.push(match);
    }
}

class FailingTrainingDataRecorder implements TrainingDataRecorder {
    stageDecisionSample(): Promise<void> {
        return Promise.reject(new Error('disk-full'));
    }

    commitCompletedMatch(): Promise<TrainingMatchCommitResult> {
        return Promise.reject(new Error('disk-full'));
    }

    discardPendingMatch(): Promise<void> {
        return Promise.reject(new Error('disk-full'));
    }
}

const nextTick = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

const createState = (currentPlayer = '0') => ({
    core: { currentPlayer },
    sys: createInitialSystemState(['0', '1'], []),
});

const createMatch = (overrides?: {
    matchID?: string;
    gameId?: string;
    createdAt?: number;
    setupData?: unknown;
}) => ({
    matchID: overrides?.matchID ?? 'match-1',
    gameId: overrides?.gameId ?? 'test-game',
    metadata: {
        createdAt: overrides?.createdAt ?? 1_000,
        setupData: overrides?.setupData,
    },
});

describe('TrainingDataCapture', () => {
    it('默认只采集 human seat 的未完成命令样本', () => {
        const recorder = new MockTrainingDataRecorder();
        const capture = new TrainingDataCapture({
            recorder,
            defaultMinCompletedMatchDurationMs: 1,
            rulesVersion: 'rules-v1',
            gameManifests: {},
            now: () => 2_000,
        });

        capture.recordDecisionSample({
            match: createMatch({
                setupData: {
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                    },
                },
            }),
            playerID: '0',
            commandType: 'HUMAN_CMD',
            payload: { ok: true },
            stateIdBefore: 1,
            stateIdAfter: 2,
            preState: createState('0'),
            postState: createState('1'),
        });
        capture.recordDecisionSample({
            match: createMatch({
                setupData: {
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                    },
                },
            }),
            playerID: '1',
            commandType: 'AI_CMD',
            payload: { auto: true },
            stateIdBefore: 2,
            stateIdAfter: 3,
            preState: createState('1'),
            postState: createState('0'),
        });

        expect(recorder.pending.get('match-1')).toHaveLength(1);
        expect(recorder.pending.get('match-1')?.[0]).toMatchObject({
            rulesVersion: 'rules-v1',
            playerId: '0',
            seatControllerType: 'human',
            command: { type: 'HUMAN_CMD' },
        });
    });

    it('manifest 声明 all-seats 时采集 AI seat 样本', () => {
        const recorder = new MockTrainingDataRecorder();
        const capture = new TrainingDataCapture({
            recorder,
            defaultMinCompletedMatchDurationMs: null,
            rulesVersion: null,
            gameManifests: {
                'test-game': {
                    ai: {
                        capture: true,
                        capturePolicy: 'all-seats',
                        trainingMinCompletedDurationMs: 1,
                    },
                },
            },
            now: () => 2_000,
        });

        capture.recordDecisionSample({
            match: createMatch({
                setupData: {
                    seatControllers: {
                        '1': { type: 'local-ai' },
                    },
                },
            }),
            playerID: '1',
            commandType: 'AI_CMD',
            payload: { auto: true },
            stateIdBefore: 1,
            stateIdAfter: 2,
            preState: createState('1'),
            postState: createState('0'),
        });

        expect(recorder.pending.get('match-1')).toHaveLength(1);
        expect(recorder.pending.get('match-1')?.[0]).toMatchObject({
            playerId: '1',
            seatControllerType: 'local-ai',
            command: { type: 'AI_CMD' },
        });
    });

    it('完成对局达到时长门槛时提交 pending 样本和最终样本', () => {
        const recorder = new MockTrainingDataRecorder();
        const capture = new TrainingDataCapture({
            recorder,
            defaultMinCompletedMatchDurationMs: 500,
            rulesVersion: null,
            gameManifests: {},
            now: () => 2_000,
        });

        capture.recordDecisionSample({
            match: createMatch({ createdAt: 1_000 }),
            playerID: '0',
            commandType: 'FIRST_CMD',
            payload: {},
            stateIdBefore: 1,
            stateIdAfter: 2,
            preState: createState(),
            postState: createState(),
        });
        capture.recordDecisionSample({
            match: createMatch({ createdAt: 1_000 }),
            playerID: '0',
            commandType: 'FINAL_CMD',
            payload: {},
            stateIdBefore: 2,
            stateIdAfter: 3,
            preState: createState(),
            postState: createState(),
            gameOver: { winner: '0' },
        });

        expect(recorder.pending.has('match-1')).toBe(false);
        expect(recorder.completedMatches).toHaveLength(1);
        expect(recorder.completedMatches[0].map((sample) => sample.command.type))
            .toEqual(['FIRST_CMD', 'FINAL_CMD']);
    });

    it('完成对局低于时长门槛时丢弃 pending 样本', () => {
        const recorder = new MockTrainingDataRecorder();
        const capture = new TrainingDataCapture({
            recorder,
            defaultMinCompletedMatchDurationMs: 5_000,
            rulesVersion: null,
            gameManifests: {},
            now: () => 2_000,
        });

        capture.recordDecisionSample({
            match: createMatch({ createdAt: 1_000 }),
            playerID: '0',
            commandType: 'FINAL_CMD',
            payload: {},
            stateIdBefore: 1,
            stateIdAfter: 2,
            preState: createState(),
            postState: createState(),
            gameOver: { winner: '0' },
        });

        expect(recorder.completedMatches).toHaveLength(0);
        expect(recorder.discarded).toEqual([{
            schemaVersion: 1,
            gameId: 'test-game',
            matchId: 'match-1',
        }]);
    });

    it('recorder 失败只记录告警，不抛出到命令执行链', async () => {
        const warnings: Array<{ message: string; payload: Record<string, unknown> }> = [];
        const capture = new TrainingDataCapture({
            recorder: new FailingTrainingDataRecorder(),
            defaultMinCompletedMatchDurationMs: 1,
            rulesVersion: null,
            gameManifests: {},
            now: () => 2_000,
            logWarning: (message, payload) => warnings.push({ message, payload }),
        });

        expect(() => {
            capture.recordDecisionSample({
                match: createMatch({ createdAt: 1_000 }),
                playerID: '0',
                commandType: 'FINAL_CMD',
                payload: {},
                stateIdBefore: 1,
                stateIdAfter: 2,
                preState: createState(),
                postState: createState(),
                gameOver: { winner: '0' },
            });
        }).not.toThrow();
        await nextTick();

        expect(warnings).toEqual([{
            message: '[GameTransport] training data capture failed',
            payload: expect.objectContaining({
                operation: 'commit',
                matchID: 'match-1',
                gameId: 'test-game',
                error: 'disk-full',
            }) as Record<string, unknown>,
        }]);
    });
});
