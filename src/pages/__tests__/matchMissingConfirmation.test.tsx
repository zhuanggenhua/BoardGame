/* @vitest-environment happy-dom */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveMissingMatchConfirmationSignal, useMissingMatchConfirmation } from '../matchMissingConfirmation';

describe('useMissingMatchConfirmation', () => {
    it('单次 transport match_not_found 只有在 REST 也确认 not_found 后才触发 caller 清理', async () => {
        const onConfirmedMissingMatch = vi.fn();

        const { result, rerender } = renderHook((props: {
            onlineTransportError: string | null;
            matchStatusErrorKind: 'not_found' | 'transient_unreachable' | null;
        }) => useMissingMatchConfirmation({
            gameId: 'smashup',
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: props.onlineTransportError,
            matchStatusErrorKind: props.matchStatusErrorKind,
            onConfirmedMissingMatch,
        }), {
            initialProps: {
                onlineTransportError: 'match_not_found',
                matchStatusErrorKind: null,
            },
        });

        expect(result.current).toBeNull();
        expect(onConfirmedMissingMatch).not.toHaveBeenCalled();

        rerender({
            onlineTransportError: 'match_not_found',
            matchStatusErrorKind: 'transient_unreachable',
        });
        expect(result.current).toBeNull();
        expect(onConfirmedMissingMatch).not.toHaveBeenCalled();

        rerender({
            onlineTransportError: 'match_not_found',
            matchStatusErrorKind: 'not_found',
        });

        await waitFor(() => {
            expect(onConfirmedMissingMatch).toHaveBeenCalledWith('transport_not_found');
        });
        expect(result.current).toBe('transport_not_found');
        expect(onConfirmedMissingMatch).toHaveBeenCalledTimes(1);

        rerender({
            onlineTransportError: 'match_not_found',
            matchStatusErrorKind: 'not_found',
        });
        expect(onConfirmedMissingMatch).toHaveBeenCalledTimes(1);
    });

    it('即使缺房信号成立，缺少 gameId 时也不应触发 caller 清理', async () => {
        const onConfirmedMissingMatch = vi.fn();

        const { result } = renderHook(() => useMissingMatchConfirmation({
            gameId: null,
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: 'match_not_found',
            matchStatusErrorKind: 'not_found',
            onConfirmedMissingMatch,
        }));

        expect(result.current).toBe('transport_not_found');
        await waitFor(() => {
            expect(onConfirmedMissingMatch).not.toHaveBeenCalled();
        });
    });
});

describe('resolveMissingMatchConfirmationSignal', () => {
    it('只有 transport match_not_found 与 REST not_found 同时成立时才确认缺房', () => {
        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: 'match_not_found',
            matchStatusErrorKind: 'not_found',
        })).toBe('transport_not_found');

        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: 'match_not_found',
            matchStatusErrorKind: 'transient_unreachable',
        })).toBeNull();
    });
});
