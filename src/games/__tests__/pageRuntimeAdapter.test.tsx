import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GamePageRuntimeProvider } from '../pageRuntimeAdapter';
import { dismissGamePageTransientUi } from '../pageRuntimeTransientUi';
import { smashUpGameRuntimeAdapter } from '../smashup/runtimeAdapter';
import { useSmashUpOverlay } from '../smashup/ui/SmashUpOverlayContext';

let smashupImplementationLoaded = true;
let delayedImplementationLoaded = false;
let readyListener: ((gameId: string) => void) | null = null;

function DelayedRuntimeProvider({ children }: { children: React.ReactNode }) {
    return <div data-testid="delayed-runtime-provider">{children}</div>;
}

vi.mock('../registry', () => ({
    getGameImplementation: (gameId: string) => (
        gameId === 'smashup' && smashupImplementationLoaded
            ? { runtimeAdapter: smashUpGameRuntimeAdapter }
            : gameId === 'delayed-game' && delayedImplementationLoaded
                ? { runtimeAdapter: { PageProvider: DelayedRuntimeProvider } }
                : null
    ),
    subscribeGameImplementationReady: (listener: (gameId: string) => void) => {
        readyListener = listener;
        return () => {
            if (readyListener === listener) {
                readyListener = null;
            }
        };
    },
}));

function SmashUpOverlayProbe() {
    const { overlayEnabled, interactionMode } = useSmashUpOverlay();
    return <div>{`${String(overlayEnabled)}:${interactionMode}`}</div>;
}

describe('pageRuntimeAdapter', () => {
    it('运行时后加载完成时，页面 provider 会切到游戏 runtime provider', async () => {
        delayedImplementationLoaded = false;

        render(
            <GamePageRuntimeProvider gameId="delayed-game">
                <div>payload</div>
            </GamePageRuntimeProvider>,
        );

        expect(screen.queryByTestId('delayed-runtime-provider')).not.toBeInTheDocument();

        await act(async () => {
            delayedImplementationLoaded = true;
            readyListener?.('delayed-game');
        });

        expect(screen.getByTestId('delayed-runtime-provider')).toBeInTheDocument();
        expect(screen.getByText('payload')).toBeInTheDocument();
    });

    it('smashup 通过 runtime adapter 挂上页面 overlay provider', () => {
        smashupImplementationLoaded = true;
        render(
            <GamePageRuntimeProvider gameId="smashup">
                <SmashUpOverlayProbe />
            </GamePageRuntimeProvider>,
        );

        expect(screen.getByText('true:click')).toBeInTheDocument();
    });

    it('smashup 强制关闭瞬态 UI 继续派发对应事件', () => {
        smashupImplementationLoaded = true;
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        expect(dismissGamePageTransientUi('smashup')).toBe(true);
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
        expect((dispatchSpy.mock.calls[0]?.[0] as CustomEvent).type).toBe('smashup:force-dismiss-popup');

        dispatchSpy.mockRestore();
    });

    it('未注册 runtime adapter 的游戏不派发页面瞬态 UI 事件', () => {
        smashupImplementationLoaded = true;
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        expect(dismissGamePageTransientUi('splendor')).toBe(false);
        expect(dispatchSpy).not.toHaveBeenCalled();

        dispatchSpy.mockRestore();
    });
});
