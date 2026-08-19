import { describe, expect, it, vi } from 'vitest';
import { isOnlineAiRecoveryStillOwnedByAi } from '../onlineAiRecoveryOwnership';
import type { MatchState } from '../../types';

const aiControllers = {
    '0': { type: 'human' as const },
    '1': { type: 'local-ai' as const },
    '2': { type: 'local-ai' as const },
};

const createState = (sys: Record<string, unknown>): MatchState<unknown> => ({
    core: {},
    sys,
}) as unknown as MatchState<unknown>;

describe('onlineAiRecoveryOwnership', () => {
    it('human seat 不应继续拥有 AI recovery 后续命令', () => {
        const resolveSeatState = vi.fn();
        const result = isOnlineAiRecoveryStillOwnedByAi({
            playerId: '0',
            sharedState: createState({ phase: 'main' }),
            seatControllers: aiControllers,
            resolveSeatState,
            resolveCurrentPlayerId: () => '0',
        });

        expect(result).toBe(false);
        expect(resolveSeatState).not.toHaveBeenCalled();
    });

    it('公开 interaction 属于同一 AI seat 时应继续执行后续 recovery 命令', () => {
        const result = isOnlineAiRecoveryStillOwnedByAi({
            playerId: '1',
            sharedState: createState({
                interaction: {
                    current: { playerId: '1' },
                    isBlocked: true,
                },
            }),
            seatControllers: aiControllers,
            resolveSeatState: vi.fn(),
            resolveCurrentPlayerId: () => '0',
        });

        expect(result).toBe(true);
    });

    it('隐藏 interaction 只通过 AI seat playerView 判断归属', () => {
        const resolveSeatState = vi.fn(() => createState({
            interaction: {
                current: { playerId: '1' },
            },
        }));

        const result = isOnlineAiRecoveryStillOwnedByAi({
            playerId: '1',
            sharedState: createState({
                interaction: {
                    current: null,
                    isBlocked: true,
                },
            }),
            seatControllers: aiControllers,
            resolveSeatState,
            resolveCurrentPlayerId: () => '0',
        });

        expect(result).toBe(true);
        expect(resolveSeatState).toHaveBeenCalledWith('1');
    });

    it('response window 当前响应者是 AI 时应继续，当前响应者是 human 时应停止', () => {
        const aiResponderState = createState({
            responseWindow: {
                current: {
                    responderQueue: ['0', '1'],
                    currentResponderIndex: 1,
                },
            },
        });
        const humanResponderState = createState({
            responseWindow: {
                current: {
                    responderQueue: ['0', '1'],
                    currentResponderIndex: 0,
                },
            },
        });

        expect(isOnlineAiRecoveryStillOwnedByAi({
            playerId: '1',
            sharedState: aiResponderState,
            seatControllers: aiControllers,
            resolveSeatState: vi.fn(),
            resolveCurrentPlayerId: () => '0',
        })).toBe(true);

        expect(isOnlineAiRecoveryStillOwnedByAi({
            playerId: '1',
            sharedState: humanResponderState,
            seatControllers: aiControllers,
            resolveSeatState: vi.fn(),
            resolveCurrentPlayerId: () => '1',
        })).toBe(false);
    });

    it('没有 interaction 或 response window 时回到当前 AI 玩家判断', () => {
        expect(isOnlineAiRecoveryStillOwnedByAi({
            playerId: '1',
            sharedState: createState({ phase: 'main' }),
            seatControllers: aiControllers,
            resolveSeatState: vi.fn(),
            resolveCurrentPlayerId: () => '1',
        })).toBe(true);

        expect(isOnlineAiRecoveryStillOwnedByAi({
            playerId: '1',
            sharedState: createState({ phase: 'main' }),
            seatControllers: aiControllers,
            resolveSeatState: vi.fn(),
            resolveCurrentPlayerId: () => '0',
        })).toBe(false);
    });
});
