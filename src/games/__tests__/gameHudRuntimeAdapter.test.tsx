import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../engine/types';
import { diceThroneGameRuntimeAdapter } from '../dicethrone/runtimeAdapter';
import { smashUpGameRuntimeAdapter } from '../smashup/runtimeAdapter';
import {
    GameHudRuntimeSettingsSection,
    shouldSuppressGameHudFab,
    tryHandleGameHudForceDismiss,
} from '../gameHudRuntimeAdapter';

vi.mock('../registry', () => ({
    getGameImplementation: (gameId: string) => (
        gameId === 'smashup'
            ? { runtimeAdapter: smashUpGameRuntimeAdapter }
            : gameId === 'dicethrone'
                ? { runtimeAdapter: diceThroneGameRuntimeAdapter }
                : null
    ),
}));

describe('gameHudRuntimeAdapter', () => {
    it('任何游戏都不应压制共享 HUD 的 FAB 菜单', () => {
        expect(shouldSuppressGameHudFab({
            gameId: 'splendor',
            mode: 'online',
            state: null,
            playerId: '0',
        })).toBe(false);
        const state = {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
            },
            sys: {
                responseWindow: {
                    current: {
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
                resolution: {
                    frames: [
                        {
                            id: 'frame-1',
                            step: 'await_response',
                            metadata: {
                                smashupReactionSession: {
                                    responseWindowType: 'meFirst',
                                    activePlayerId: '0',
                                    currentPlayerId: '0',
                                    phase: 'await_response',
                                },
                            },
                        },
                    ],
                    activeFrameId: 'frame-1',
                },
            },
        } as unknown as MatchState<unknown>;

        expect(shouldSuppressGameHudFab({
            gameId: 'smashup',
            mode: 'online',
            state,
            playerId: '0',
        })).toBe(false);
    });

    it('只有 smashup 才渲染 HUD 运行时设置区块', () => {
        const t = (key: string) => key;

        const { rerender } = render(<>{GameHudRuntimeSettingsSection({ gameId: 'splendor', t })}</>);
        expect(screen.queryByText('hud.smashup.title')).toBeNull();

        rerender(<>{GameHudRuntimeSettingsSection({ gameId: 'smashup', t })}</>);
        expect(screen.getByText('hud.smashup.title')).toBeInTheDocument();
        expect(screen.getByText('hud.smashup.overlay')).toBeInTheDocument();
    });

    it('dicethrone 奖励骰不得由 HUD force dismiss 代替骰盘普通确认', () => {
        const dispatch = vi.fn();
        const state = {
            core: {
                pendingBonusDiceSettlement: {
                    attackerId: '0',
                },
            },
        } as unknown as MatchState<unknown>;

        expect(tryHandleGameHudForceDismiss({
            gameId: 'dicethrone',
            state,
            playerId: '0',
            dispatch,
        })).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('dicethrone bonus-dice 不属于当前玩家时，不应吞掉共享 HUD force dismiss', () => {
        const dispatch = vi.fn();
        const state = {
            core: {
                pendingBonusDiceSettlement: {
                    attackerId: '1',
                },
            },
        } as unknown as MatchState<unknown>;

        expect(tryHandleGameHudForceDismiss({
            gameId: 'dicethrone',
            state,
            playerId: '0',
            dispatch,
        })).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });
});
