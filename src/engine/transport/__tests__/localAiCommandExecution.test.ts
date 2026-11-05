import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState } from '../../pipeline';
import { TRANSPORT_BATCH_COMMAND } from '../../batchDispatchCommand';
import { executeLocalAiCommandBatch } from '../localAiCommandExecution';
import type { LocalAiCommandEffect } from '../localAiCommandEffects';

describe('local AI action submission', () => {
    it('consumes committed per-command diagnostics without resubmitting commands', async () => {
        const state = { core: {}, sys: createInitialSystemState(['0', '1'], []) };
        const commandEffectsByToken: Record<string, LocalAiCommandEffect> = {};
        const dispatch = vi.fn((_, payload: unknown) => {
            for (const command of (payload as { commands: Array<{ payload: { __aiTraceToken: string } }> }).commands) {
                commandEffectsByToken[command.payload.__aiTraceToken] = { hasStateDelta: true, markerProgressed: true };
            }
        });
        const result = await executeLocalAiCommandBatch({
            gameId: 'test-game', seed: 'seed-1', playerId: '1', source: 'local-ai',
            actionKind: 'test-action', actionVisibility: 'visible', attemptKey: 'attempt',
            commands: [{ type: 'FIRST_OK' }, { type: 'SECOND_OK' }],
            dispatch, getState: () => state, commandEffectsByToken,
        });
        expect(result).toEqual({ hasAnyCommandEffect: true, rolledBack: false });
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(commandEffectsByToken).toEqual({});
    });

    it('submits one business batch and reports the failing command without dispatching progress again', async () => {
        const state = { core: {}, sys: createInitialSystemState(['0', '1'], []) };
        const commandEffectsByToken: Record<string, LocalAiCommandEffect> = {};
        const dispatch = vi.fn((type: string, payload: unknown) => {
            expect(type).toBe(TRANSPORT_BATCH_COMMAND);
            const commands = (payload as { commands: Array<{ type: string; payload: { __aiTraceToken: string; __tutorialPlayerId: string } }> }).commands;
            expect(commands.map((command) => command.type)).toEqual(['FIRST_OK', 'SECOND_FAILS']);
            for (const command of commands) {
                expect(command.payload.__tutorialPlayerId).toBe('1');
                commandEffectsByToken[command.payload.__aiTraceToken] = {
                    hasStateDelta: false, markerProgressed: false, rejected: true,
                    failureReason: command.type === 'SECOND_FAILS' ? 'domain_rejected' : 'batch_cancelled',
                };
            }
        });
        const result = await executeLocalAiCommandBatch({
            gameId: 'test-game', seed: 'seed-1', playerId: '1', source: 'local-ai',
            actionKind: 'test-action', actionVisibility: 'visible', attemptKey: 'attempt',
            commands: [{ type: 'FIRST_OK' }, { type: 'SECOND_FAILS' }],
            dispatch, getState: () => state, commandEffectsByToken,
        });
        expect(result).toEqual({
            hasAnyCommandEffect: false, rolledBack: true,
            failedCommandType: 'SECOND_FAILS', failureReason: 'domain_rejected',
        });
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(commandEffectsByToken).toEqual({});
    });
});
