import { describe, expect, it } from 'vitest';
import { resolveOnlineAiCurrentPlayerId } from '../onlineAiRecovery';
import { createEngineConfig, createOnlineAiRecoveryState } from './helpers/serverTestHarness';

describe('resolveOnlineAiCurrentPlayerId（恢复操作者扩展点）', () => {
    it('默认返回通用当前回合玩家', () => {
        const state = createOnlineAiRecoveryState({
            activePlayerId: '1',
        }).G as any;

        expect(resolveOnlineAiCurrentPlayerId(state)).toBe('1');
    });

    it('游戏可通过 onlineAiRecovery.resolveCurrentPlayerId 声明当前恢复操作者', () => {
        const state = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'testDecisionPhase',
        }).G as any;

        state.core.decisionOwnerId = '0';

        expect(resolveOnlineAiCurrentPlayerId(state, {
            engineConfig: {
                ...createEngineConfig(),
                gameId: 'test-game',
                onlineAiRecovery: {
                    resolveCurrentPlayerId: ({ state: inputState, fallbackPlayerId }) => {
                        const ownerId = (inputState.core as { decisionOwnerId?: unknown }).decisionOwnerId;
                        return typeof ownerId === 'string' ? ownerId : fallbackPlayerId;
                    },
                },
            },
            gameId: 'test-game',
        })).toBe('0');
    });
});
