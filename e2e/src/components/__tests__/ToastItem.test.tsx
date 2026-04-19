import { fireEvent, render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../../contexts/ToastContext';
import { ToastItem } from '../common/feedback/ToastItem';
import { SocketCompatibilityToastListener } from '../system/SocketCompatibilityToastListener';

const lobbyReconnectMock = vi.fn();
const socialReconnectMock = vi.fn();
const setSocketCompatibilityModeEnabledMock = vi.fn();
const canToggleSocketCompatibilityModeMock = vi.fn(() => true);
const isSocketCompatibilityModeEnabledMock = vi.fn(() => false);
let lastStatusHandler: ((status: { connected: boolean; lastError?: string }) => void) | null = null;

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../services/lobbySocket', () => ({
    lobbySocket: {
        subscribeStatus: (handler: (status: { connected: boolean; lastError?: string }) => void) => {
            lastStatusHandler = handler;
            return () => {
                lastStatusHandler = null;
            };
        },
        reconnectWithCurrentSettings: (...args: unknown[]) => lobbyReconnectMock(...args),
    },
}));

vi.mock('../../services/socialSocket', () => ({
    socialSocket: {
        reconnectWithCurrentSettings: (...args: unknown[]) => socialReconnectMock(...args),
    },
}));

vi.mock('../../services/socketConnectionConfig', () => ({
    canToggleSocketCompatibilityMode: () => canToggleSocketCompatibilityModeMock(),
    isSocketCompatibilityModeEnabled: () => isSocketCompatibilityModeEnabledMock(),
    setSocketCompatibilityModeEnabled: (enabled: boolean) => setSocketCompatibilityModeEnabledMock(enabled),
}));

const ToastHarness = ({
    actionSpy,
    dismissOnClick = true,
}: {
    actionSpy: () => void;
    dismissOnClick?: boolean;
}) => {
    const toast = useToast();

    return (
        <>
            <button
                type="button"
                onClick={() => toast.info('Message body', 'Toast title', {
                    ttlMs: Infinity,
                    actions: [{
                        label: 'Enable compatibility',
                        variant: 'primary',
                        dismissOnClick,
                        onClick: actionSpy,
                    }],
                })}
            >
                show toast
            </button>
            <div>
                {toast.toasts.map((item) => (
                    <ToastItem key={item.id} toast={item} />
                ))}
            </div>
        </>
    );
};

const ToastViewport = () => {
    const toast = useToast();
    return (
        <div>
            {toast.toasts.map((item) => (
                <ToastItem key={item.id} toast={item} />
            ))}
        </div>
    );
};

describe('SocketCompatibilityToastListener', () => {
    beforeEach(() => {
        lobbyReconnectMock.mockReset();
        socialReconnectMock.mockReset();
        setSocketCompatibilityModeEnabledMock.mockReset();
        canToggleSocketCompatibilityModeMock.mockReset();
        canToggleSocketCompatibilityModeMock.mockReturnValue(true);
        isSocketCompatibilityModeEnabledMock.mockReset();
        isSocketCompatibilityModeEnabledMock.mockReturnValue(false);
        lastStatusHandler = null;
    });

    it('shows an opt-in prompt before enabling compatibility mode', () => {
        render(
            <ToastProvider>
                <SocketCompatibilityToastListener />
                <ToastViewport />
            </ToastProvider>
        );

        act(() => {
            lastStatusHandler?.({ connected: false, lastError: 'websocket transport timeout' });
        });

        expect(setSocketCompatibilityModeEnabledMock).not.toHaveBeenCalled();
        expect(lobbyReconnectMock).not.toHaveBeenCalled();
        expect(socialReconnectMock).not.toHaveBeenCalled();
        expect(screen.getByText('socketCompatibility.title')).toBeInTheDocument();
        expect(screen.getByText('socketCompatibility.description')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'socketCompatibility.enable' }));

        expect(setSocketCompatibilityModeEnabledMock).toHaveBeenCalledWith(true);
        expect(lobbyReconnectMock).toHaveBeenCalledTimes(1);
        expect(socialReconnectMock).toHaveBeenCalledTimes(1);
        expect(screen.getByText('socketCompatibility.enabledTitle')).toBeInTheDocument();
    });

    it('ignores unrelated connection errors', () => {
        render(
            <ToastProvider>
                <SocketCompatibilityToastListener />
                <ToastViewport />
            </ToastProvider>
        );

        act(() => {
            lastStatusHandler?.({ connected: false, lastError: 'authentication failed' });
        });

        expect(setSocketCompatibilityModeEnabledMock).not.toHaveBeenCalled();
        expect(lobbyReconnectMock).not.toHaveBeenCalled();
        expect(socialReconnectMock).not.toHaveBeenCalled();
        expect(screen.queryByText('socketCompatibility.title')).not.toBeInTheDocument();
    });

    it('disables the compatibility prompt when the environment already allows polling fallback', () => {
        canToggleSocketCompatibilityModeMock.mockReturnValue(false);

        render(
            <ToastProvider>
                <SocketCompatibilityToastListener />
                <ToastViewport />
            </ToastProvider>
        );

        act(() => {
            lastStatusHandler?.({ connected: false, lastError: 'websocket transport timeout' });
        });

        expect(setSocketCompatibilityModeEnabledMock).not.toHaveBeenCalled();
        expect(lobbyReconnectMock).not.toHaveBeenCalled();
        expect(socialReconnectMock).not.toHaveBeenCalled();
        expect(screen.queryByText('socketCompatibility.title')).not.toBeInTheDocument();
    });
});

describe('ToastItem actions', () => {
    it('executes the action and dismisses the toast by default', () => {
        const actionSpy = vi.fn();

        render(
            <ToastProvider>
                <ToastHarness actionSpy={actionSpy} />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'show toast' }));
        fireEvent.click(screen.getByRole('button', { name: 'Enable compatibility' }));

        expect(actionSpy).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Toast title')).not.toBeInTheDocument();
    });

    it('keeps the toast visible when dismissOnClick is false', () => {
        const actionSpy = vi.fn();

        render(
            <ToastProvider>
                <ToastHarness actionSpy={actionSpy} dismissOnClick={false} />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'show toast' }));
        fireEvent.click(screen.getByRole('button', { name: 'Enable compatibility' }));

        expect(actionSpy).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Toast title')).toBeInTheDocument();
    });
});
