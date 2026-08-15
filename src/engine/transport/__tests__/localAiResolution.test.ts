import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import type { AiSeatController } from '../../ai/types';
import { resolveLocalAiActionWithRecovery } from '../localAiResolution';
import { resolveNextAiAction } from '../../ai/localRunner';

vi.mock('../../ai/localRunner', () => ({
    resolveNextAiAction: vi.fn(),
}));

const mockedResolveNextAiAction = vi.mocked(resolveNextAiAction);

function createState(currentPlayer: string): MatchState<unknown> {
    return {
        core: {
            currentPlayer,
        },
        sys: {},
    } as MatchState<unknown>;
}

function createConfig() {
    return {
        gameId: 'test-local-ai-game',
    } as any;
}

describe('resolveLocalAiActionWithRecovery', () => {
    beforeEach(() => {
        mockedResolveNextAiAction.mockReset();
    });

    it('当前行动的本地 AI 明确设为 0 秒时，会把 0 透传给决策预算', async () => {
        mockedResolveNextAiAction.mockResolvedValue({
            playerId: '1',
            action: {
                actionId: 'draw',
                kind: 'draw-deck',
                label: '摸牌',
                commands: [],
            },
            attemptKey: 'attempt-1',
        } as any);

        await resolveLocalAiActionWithRecovery({
            config: createConfig(),
            state: createState('1'),
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', minimumActionDelayMs: 0 },
            } satisfies Record<string, AiSeatController>,
            activePhaseElapsedMs: 0,
            stallRecoveryGraceMs: 1000,
        });

        expect(mockedResolveNextAiAction).toHaveBeenCalledWith(expect.objectContaining({
            decisionBudgetMs: 0,
        }));
    });

    it('非 0 秒配置不会强行改写默认决策预算', async () => {
        mockedResolveNextAiAction.mockResolvedValue({
            playerId: '1',
            action: {
                actionId: 'draw',
                kind: 'draw-deck',
                label: '摸牌',
                commands: [],
            },
            attemptKey: 'attempt-2',
        } as any);

        await resolveLocalAiActionWithRecovery({
            config: createConfig(),
            state: createState('1'),
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', minimumActionDelayMs: 500 },
            } satisfies Record<string, AiSeatController>,
            activePhaseElapsedMs: 0,
            stallRecoveryGraceMs: 1000,
        });

        expect(mockedResolveNextAiAction).toHaveBeenCalledWith(expect.objectContaining({
            decisionBudgetMs: undefined,
        }));
    });
});
