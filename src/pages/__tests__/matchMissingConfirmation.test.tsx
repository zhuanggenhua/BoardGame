/* @vitest-environment happy-dom */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveMissingMatchConfirmationSignal, useMissingMatchConfirmation } from '../matchMissingConfirmation';

describe('useMissingMatchConfirmation', () => {
    it('transport match_not_found 一旦成立就触发 caller 清理，不再等待 REST 二次确认', async () => {
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

        expect(result.current).toBe('transport_not_found');
        await waitFor(() => {
            expect(onConfirmedMissingMatch).toHaveBeenCalledWith('transport_not_found');
        });
        expect(onConfirmedMissingMatch).toHaveBeenCalledTimes(1);

        rerender({
            onlineTransportError: 'match_not_found',
            matchStatusErrorKind: 'transient_unreachable',
        });
        expect(result.current).toBe('transport_not_found');
        expect(onConfirmedMissingMatch).toHaveBeenCalledTimes(1);

        rerender({
            onlineTransportError: 'match_not_found',
            matchStatusErrorKind: 'not_found',
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
    it('只要 transport match_not_found 成立就确认缺房，REST 错误类型不再参与判定', () => {
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
        })).toBe('transport_not_found');
    });
});
