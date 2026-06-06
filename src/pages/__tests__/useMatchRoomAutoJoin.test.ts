/* @vitest-environment happy-dom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchStatusModule from '../../hooks/match/useMatchStatus';
import { useMatchRoomAutoJoin } from '../useMatchRoomAutoJoin';

describe('useMatchRoomAutoJoin', () => {
    const baseArgs = {
        shouldAutoJoin: true,
        gameId: 'smashup',
        matchId: 'match-1',
        isTutorialRoute: false,
        guestId: 'guest-1',
        guestPlayerName: 'Guest 1',
        userId: undefined as string | undefined,
        roomFullText: '房间已满',
        joinRoomFailedText: '加入失败',
        onLocalStateChanged: vi.fn(),
    };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('已有本地凭据时直接短路，不发起 rejoin', async () => {
        const onLocalStateChanged = vi.fn();
        const readSpy = vi.spyOn(matchStatusModule, 'readStoredMatchCredentials').mockReturnValue({
            matchID: 'match-1',
            playerID: '0',
            credentials: 'cred-1',
            updatedAt: Date.now(),
        });
        const rejoinSpy = vi.spyOn(matchStatusModule, 'rejoinMatch').mockResolvedValue({ success: true });

        const { result } = renderHook(() => useMatchRoomAutoJoin({
            ...baseArgs,
            onLocalStateChanged,
        }));

        await waitFor(() => {
            expect(onLocalStateChanged).toHaveBeenCalledTimes(1);
        });

        expect(readSpy).toHaveBeenCalledWith('match-1');
        expect(rejoinSpy).not.toHaveBeenCalled();
        expect(result.current.isAutoJoining).toBe(false);
        expect(result.current.autoJoinError).toBeNull();
        expect(result.current.autoJoinGraceActive).toBe(false);
    });

    it('加入成功后进入宽限期，并在超时后结束', async () => {
        vi.useFakeTimers();
        const onLocalStateChanged = vi.fn();
        vi.spyOn(matchStatusModule, 'readStoredMatchCredentials').mockReturnValue(null);
        const rejoinSpy = vi.spyOn(matchStatusModule, 'rejoinMatch').mockResolvedValue({ success: true });

        const { result } = renderHook(() => useMatchRoomAutoJoin({
            ...baseArgs,
            onLocalStateChanged,
        }));

        await act(async () => {
            await Promise.resolve();
        });

        expect(rejoinSpy).toHaveBeenCalledTimes(1);
        expect(onLocalStateChanged).toHaveBeenCalledTimes(1);
        expect(result.current.isAutoJoining).toBe(false);
        expect(result.current.autoJoinGraceActive).toBe(true);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(result.current.autoJoinGraceActive).toBe(false);
        expect(result.current.autoJoinError).toBeNull();
    });

    it('房间已满时立即结束并暴露错误文案', async () => {
        vi.spyOn(matchStatusModule, 'readStoredMatchCredentials').mockReturnValue(null);
        const rejoinSpy = vi.spyOn(matchStatusModule, 'rejoinMatch').mockResolvedValue({
            success: false,
            error: 'room_full',
        });

        const { result } = renderHook(() => useMatchRoomAutoJoin(baseArgs));

        await waitFor(() => {
            expect(rejoinSpy).toHaveBeenCalledTimes(1);
            expect(result.current.isAutoJoining).toBe(false);
            expect(result.current.autoJoinError).toBe('房间已满');
        });

        expect(result.current.autoJoinGraceActive).toBe(false);
    });

    it('连续重试失败后暴露通用失败文案', async () => {
        vi.useFakeTimers();
        vi.spyOn(matchStatusModule, 'readStoredMatchCredentials').mockReturnValue(null);
        const rejoinSpy = vi.spyOn(matchStatusModule, 'rejoinMatch').mockResolvedValue({
            success: false,
            error: 'network_error',
        });

        const { result } = renderHook(() => useMatchRoomAutoJoin(baseArgs));

        await act(async () => {
            await Promise.resolve();
        });

        expect(rejoinSpy).toHaveBeenCalledTimes(1);
        expect(result.current.isAutoJoining).toBe(true);

        for (let attempt = 0; attempt < 4; attempt++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(500);
            });
        }

        await act(async () => {
            await Promise.resolve();
        });

        expect(rejoinSpy).toHaveBeenCalledTimes(5);
        expect(result.current.isAutoJoining).toBe(false);
        expect(result.current.autoJoinError).toBe('加入失败');

        expect(result.current.autoJoinGraceActive).toBe(false);
    });
});
