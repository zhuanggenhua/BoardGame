import { describe, expect, it, vi } from 'vitest';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../../../e2e/helpers/common';

describe('e2e common frontend guards', () => {
    it('treats stale chunk style console errors as fatal frontend errors', async () => {
        const listeners: Record<string, Array<(payload: any) => void>> = {};
        const page = {
            on: vi.fn((event: string, handler: (payload: any) => void) => {
                listeners[event] ??= [];
                listeners[event].push(handler);
            }),
            isClosed: vi.fn(() => false),
            evaluate: vi.fn(async () => null),
        } as any;

        const diagnostics = attachPageDiagnostics(page);
        listeners.console?.forEach((handler) => handler({
            type: () => 'error',
            text: () => 'Failed to fetch dynamically imported module: http://127.0.0.1:4273/src/games/dicethrone/Board.tsx?t=123',
            location: () => ({ url: 'http://127.0.0.1:4273/play/dicethrone/tutorial', lineNumber: 0, columnNumber: 0 }),
            args: () => [],
        }));
        await Promise.resolve();

        await expect(assertNoFatalFrontendErrors([
            { label: 'page-0', diagnostics },
        ])).rejects.toThrow(/Failed to fetch dynamically imported module/i);
    });

    it('treats vite error overlay as fatal even without console error', async () => {
        const page = {
            on: vi.fn(),
            isClosed: vi.fn(() => false),
            evaluate: vi.fn(async () => 'Internal server error: src/components/lobby/CreateRoomModal.tsx: Unexpected token (1340:22)'),
        } as any;

        const diagnostics = attachPageDiagnostics(page);

        await expect(assertNoFatalFrontendErrors([
            { label: 'page-0', diagnostics },
        ])).rejects.toThrow(/vite-error-overlay/i);
    });
});
