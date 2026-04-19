import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ConnectionLoadingScreen } from '../ConnectionLoadingScreen';

const navigateMock = vi.fn();
const mobileViewportMock = vi.fn(() => false);
const coarsePointerMock = vi.fn(() => false);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock('../../../hooks/ui/useMobileViewport', () => ({
    useMobileViewport: () => mobileViewportMock(),
}));

vi.mock('../../../hooks/ui/useCoarsePointer', () => ({
    useCoarsePointer: () => coarsePointerMock(),
}));

describe('ConnectionLoadingScreen', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        navigateMock.mockReset();
        mobileViewportMock.mockReturnValue(false);
        coarsePointerMock.mockReturnValue(false);
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('desktop 15 秒后显示重试按钮', () => {
        render(
            <MemoryRouter>
                <ConnectionLoadingScreen gameId="dicethrone" />
            </MemoryRouter>,
        );

        expect(screen.queryByText('matchRoom.connectionTimeout.retry')).toBeNull();

        act(() => {
            vi.advanceTimersByTime(14_999);
        });
        expect(screen.queryByText('matchRoom.connectionTimeout.retry')).toBeNull();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(screen.getByText('matchRoom.connectionTimeout.retry')).toBeInTheDocument();
        expect(screen.getByText('matchRoom.connectionTimeout.backToLobby')).toBeInTheDocument();
    });

    it('mobile 15 秒时仍保持 loading，不提前显示重试按钮', () => {
        mobileViewportMock.mockReturnValue(true);

        render(
            <MemoryRouter>
                <ConnectionLoadingScreen gameId="dicethrone" />
            </MemoryRouter>,
        );

        act(() => {
            vi.advanceTimersByTime(15_000);
        });
        expect(screen.queryByText('matchRoom.connectionTimeout.retry')).toBeNull();
    });

    it('mobile 45 秒后才显示重试按钮', () => {
        mobileViewportMock.mockReturnValue(true);

        render(
            <MemoryRouter>
                <ConnectionLoadingScreen gameId="dicethrone" />
            </MemoryRouter>,
        );

        act(() => {
            vi.advanceTimersByTime(44_999);
        });
        expect(screen.queryByText('matchRoom.connectionTimeout.retry')).toBeNull();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(screen.getByText('matchRoom.connectionTimeout.retry')).toBeInTheDocument();
    });

    it('suppressTimeout=true 时即使久等也不显示重试按钮', () => {
        render(
            <MemoryRouter>
                <ConnectionLoadingScreen gameId="dicethrone" suppressTimeout />
            </MemoryRouter>,
        );

        act(() => {
            vi.advanceTimersByTime(120_000);
        });

        expect(screen.queryByText('matchRoom.connectionTimeout.retry')).toBeNull();
    });

    it('未超时时显示传入的进度文本', () => {
        render(
            <MemoryRouter>
                <ConnectionLoadingScreen gameId="dicethrone" progressText="3/4" />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('loading-screen-progress')).toHaveTextContent('3/4');
    });

    it('activityKey 变化时会按真实进度重置超时', () => {
        const Wrapper = () => {
            const [activityKey, setActivityKey] = useState('10');
            return (
                <>
                    <button onClick={() => setActivityKey('40')}>advance</button>
                    <ConnectionLoadingScreen gameId="dicethrone" activityKey={activityKey} />
                </>
            );
        };

        render(
            <MemoryRouter>
                <Wrapper />
            </MemoryRouter>,
        );

        act(() => {
            vi.advanceTimersByTime(14_000);
        });
        expect(screen.queryByText('matchRoom.connectionTimeout.retry')).toBeNull();

        act(() => {
            screen.getByText('advance').click();
        });

        act(() => {
            vi.advanceTimersByTime(1_500);
        });
        expect(screen.queryByText('matchRoom.connectionTimeout.retry')).toBeNull();

        act(() => {
            vi.advanceTimersByTime(13_500);
        });
        expect(screen.getByText('matchRoom.connectionTimeout.retry')).toBeInTheDocument();
    });
});
