import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GamePageRuntimeProvider, dismissGamePageTransientUi } from '../pageRuntimeAdapter';
import { smashUpGameRuntimeAdapter } from '../smashup/runtimeAdapter';
import { useSmashUpOverlay } from '../smashup/ui/SmashUpOverlayContext';

vi.mock('../registry', () => ({
    getGameImplementation: (gameId: string) => (
        gameId === 'smashup'
            ? { runtimeAdapter: smashUpGameRuntimeAdapter }
            : null
    ),
}));

function SmashUpOverlayProbe() {
    const { overlayEnabled, interactionMode } = useSmashUpOverlay();
    return <div>{`${String(overlayEnabled)}:${interactionMode}`}</div>;
}

describe('pageRuntimeAdapter', () => {
    it('smashup 通过 runtime adapter 挂上页面 overlay provider', () => {
        render(
            <GamePageRuntimeProvider gameId="smashup">
                <SmashUpOverlayProbe />
            </GamePageRuntimeProvider>,
        );

        expect(screen.getByText('true:click')).toBeInTheDocument();
    });

    it('smashup 强制关闭瞬态 UI 继续派发对应事件', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        expect(dismissGamePageTransientUi('smashup')).toBe(true);
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
        expect((dispatchSpy.mock.calls[0]?.[0] as CustomEvent).type).toBe('smashup:force-dismiss-popup');

        dispatchSpy.mockRestore();
    });

    it('未注册 runtime adapter 的游戏不派发页面瞬态 UI 事件', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        expect(dismissGamePageTransientUi('splendor')).toBe(false);
        expect(dispatchSpy).not.toHaveBeenCalled();

        dispatchSpy.mockRestore();
    });
});
