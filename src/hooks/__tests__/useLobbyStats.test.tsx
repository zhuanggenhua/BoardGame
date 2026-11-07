// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyMatch } from '../../shared/lobby';

const lobby = vi.hoisted(() => ({ matches: [] as LobbyMatch[], hasSnapshot: false }));
vi.mock('../useLobbyMatchPresence', () => ({
    useLobbyMatchPresence: () => ({ matches: lobby.matches, hasSnapshot: lobby.hasSnapshot }),
}));

import { useLobbyStats } from '../useLobbyStats';

describe('useLobbyStats 在线人数', () => {
    beforeEach(() => {
        lobby.matches = [];
        lobby.hasSnapshot = false;
    });

    it('排除 AI 和断线座位，等待人数只统计公开等待房间', () => {
        lobby.matches = [
            {
                matchID: 'public-waiting',
                gameName: 'tictactoe',
                isLocked: false,
                status: 'waiting',
                players: [
                    { id: 1, isConnected: true },
                    { id: 2, isConnected: true, isAi: true },
                    { id: 3, isConnected: false },
                ],
            },
            {
                matchID: 'private-waiting',
                gameName: 'tictactoe',
                isLocked: true,
                status: 'waiting',
                players: [{ id: 1, isConnected: true }],
            },
            {
                matchID: 'public-playing',
                gameName: 'tictactoe',
                isLocked: false,
                status: 'playing',
                players: [{ id: 1, isConnected: true }],
            },
        ];
        lobby.hasSnapshot = true;

        const { result } = renderHook(() => useLobbyStats());

        expect(result.current.hasSnapshot).toBe(true);
        expect(result.current.playerCountsByGame.tictactoe).toEqual({ online: 3, waiting: 1 });
    });
});
