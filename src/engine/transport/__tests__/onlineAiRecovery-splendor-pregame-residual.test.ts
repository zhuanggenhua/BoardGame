import { describe, expect, it } from 'vitest';

import { resolveForceEndTurnForStalledAi } from '../onlineAiRecovery';
import type { MatchState } from '../../types';
import type { AiSeatController } from '../../ai';

describe('onlineAiRecovery - splendor pregame residual watchdog', () => {
    it('Splendor turn0 / unknown-phase 残态不得触发 active-turn legal-action watchdog', () => {
        const sharedState: MatchState<unknown> = {
            core: {
                currentPlayer: '1',
            },
            sys: {
                gameover: undefined,
                phase: '',
                turnNumber: 0,
                interaction: {
                    current: null,
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        };

        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'human' },
            '1': { type: 'local-ai', policyId: 'baseline' },
        };

        const result = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers,
            seatStates: {},
            engineConfig: {
                gameId: 'splendor',
                onlineAiRecovery: {
                    disableFallbackAdvancePhase: true,
                    shouldSuppressActiveTurnCandidate: ({ state, phase, turnNumber }) => {
                        const core = state.core as { hostStarted?: unknown } | undefined;
                        return core?.hostStarted !== true && (!phase || turnNumber === 0);
                    },
                },
            },
        });

        expect(result).toBeNull();
    });
});
