import { describe, expect, it, vi } from 'vitest';
import {
    runAuthoritativeCommandSuccessEffects,
    type AuthoritativeCommandSuccessEffectsMatch,
} from '../authoritativeCommandSuccessEffects';

function createMatch(): AuthoritativeCommandSuccessEffectsMatch {
    return {
        matchID: 'match-effects',
        gameId: 'test-game',
        metadata: {
            gameName: 'Test Game',
            players: {
                '0': { name: 'P0' },
                '1': { name: 'P1' },
            },
            createdAt: 100,
            updatedAt: 100,
            setupData: { seatControllers: { '0': 'human', '1': 'local-ai' } },
        },
    };
}

describe('runAuthoritativeCommandSuccessEffects', () => {
    it('记录训练样本、上报恢复反馈，并在未抑制时广播状态', async () => {
        const match = createMatch();
        const recordDecisionSample = vi.fn();
        const reportOnlineAiRecoveryFeedback = vi.fn(async () => undefined);
        const broadcastState = vi.fn();
        const preState = { visible: 'before' };
        const postState = { visible: 'after' };
        const feedback = { incidentKind: 'unsatisfiable-interaction-auto-skipped' };

        await runAuthoritativeCommandSuccessEffects({
            match,
            playerID: '1',
            commandType: 'SYS_INTERACTION_CANCEL',
            payload: { reason: 'empty-options' },
            stateIdBefore: 4,
            stateIdAfter: 5,
            preTrainingState: preState,
            buildPostTrainingState: () => postState,
            gameOver: undefined,
            unsatisfiableInteractionFeedback: feedback,
            trainingDataCapture: { recordDecisionSample },
            reportOnlineAiRecoveryFeedback,
            broadcastState,
            clearOnlineAiCircuitBreaker: vi.fn(),
            persistMetadata: vi.fn(),
        });

        expect(recordDecisionSample).toHaveBeenCalledWith({
            match: {
                matchID: 'match-effects',
                gameId: 'test-game',
                metadata: match.metadata,
            },
            playerID: '1',
            commandType: 'SYS_INTERACTION_CANCEL',
            payload: { reason: 'empty-options' },
            stateIdBefore: 4,
            stateIdAfter: 5,
            preState,
            postState,
            gameOver: undefined,
        });
        expect(reportOnlineAiRecoveryFeedback).toHaveBeenCalledWith(feedback);
        expect(broadcastState).toHaveBeenCalledTimes(1);
    });

    it('batch 中间命令可抑制广播，但仍记录训练样本', async () => {
        const match = createMatch();
        const recordDecisionSample = vi.fn();
        const broadcastState = vi.fn();

        await runAuthoritativeCommandSuccessEffects({
            match,
            playerID: '0',
            commandType: 'PLAY_CARD',
            payload: {},
            stateIdBefore: 7,
            stateIdAfter: 8,
            preTrainingState: { id: 'before' },
            buildPostTrainingState: () => ({ id: 'after' }),
            gameOver: null,
            suppressBroadcast: true,
            trainingDataCapture: { recordDecisionSample },
            reportOnlineAiRecoveryFeedback: vi.fn(),
            broadcastState,
            clearOnlineAiCircuitBreaker: vi.fn(),
            persistMetadata: vi.fn(),
        });

        expect(recordDecisionSample).toHaveBeenCalledTimes(1);
        expect(broadcastState).not.toHaveBeenCalled();
    });

    it('首次 gameover 时更新 metadata、清理在线 AI circuit 并触发 gameover 回调', async () => {
        const match = createMatch();
        const gameOver = { winner: '0' };
        const clearOnlineAiCircuitBreaker = vi.fn();
        const persistMetadata = vi.fn(async () => undefined);
        const onGameOver = vi.fn();

        await runAuthoritativeCommandSuccessEffects({
            match,
            playerID: '0',
            commandType: 'FINAL_ATTACK',
            payload: {},
            stateIdBefore: 10,
            stateIdAfter: 11,
            preTrainingState: {},
            buildPostTrainingState: () => ({}),
            gameOver,
            trainingDataCapture: { recordDecisionSample: vi.fn() },
            reportOnlineAiRecoveryFeedback: vi.fn(),
            broadcastState: vi.fn(),
            clearOnlineAiCircuitBreaker,
            persistMetadata,
            onGameOver,
        });

        expect(match.metadata.gameover).toBe(gameOver);
        expect(clearOnlineAiCircuitBreaker).toHaveBeenCalledTimes(1);
        expect(persistMetadata).toHaveBeenCalledTimes(1);
        expect(onGameOver).toHaveBeenCalledWith('match-effects', 'test-game', gameOver);
    });

    it('已有 gameover metadata 时不重复持久化或重复触发回调', async () => {
        const match = createMatch();
        match.metadata.gameover = { winner: '0' };

        const persistMetadata = vi.fn(async () => undefined);
        const onGameOver = vi.fn();

        await runAuthoritativeCommandSuccessEffects({
            match,
            playerID: '0',
            commandType: 'NOOP_AFTER_GAMEOVER',
            payload: {},
            stateIdBefore: 12,
            stateIdAfter: 13,
            preTrainingState: {},
            buildPostTrainingState: () => ({}),
            gameOver: { winner: '1' },
            trainingDataCapture: { recordDecisionSample: vi.fn() },
            reportOnlineAiRecoveryFeedback: vi.fn(),
            broadcastState: vi.fn(),
            clearOnlineAiCircuitBreaker: vi.fn(),
            persistMetadata,
            onGameOver,
        });

        expect(match.metadata.gameover).toEqual({ winner: '0' });
        expect(persistMetadata).not.toHaveBeenCalled();
        expect(onGameOver).not.toHaveBeenCalled();
    });
});
