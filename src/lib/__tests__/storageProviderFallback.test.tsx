/* @vitest-environment happy-dom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DebugProvider, useDebug } from '../../contexts/DebugContext';

const originalWindowLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
const originalGlobalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function replaceLocalStorage(storage: Storage | null) {
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => storage,
    });
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get: () => storage,
    });
}

function restoreLocalStorage() {
    if (originalWindowLocalStorageDescriptor) {
        Object.defineProperty(window, 'localStorage', originalWindowLocalStorageDescriptor);
    }
    if (originalGlobalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalGlobalLocalStorageDescriptor);
    }
}

const PlayerProbe = () => {
    const { playerID } = useDebug();
    return <div data-testid="debug-player-id">{playerID}</div>;
};

describe('storage provider fallback', () => {
    afterEach(() => {
        cleanup();
        restoreLocalStorage();
    });

    it('localStorage 为空时调试玩家上下文仍使用默认玩家', () => {
        replaceLocalStorage(null);

        render(
            <DebugProvider>
                <PlayerProbe />
            </DebugProvider>,
        );

        expect(screen.getByTestId('debug-player-id')).toHaveTextContent('0');
    });
});
