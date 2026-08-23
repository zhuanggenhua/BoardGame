/* @vitest-environment happy-dom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileEvidenceCaptureAgent } from '../MobileEvidenceCaptureAgent';

vi.mock('../../../lib/logger', () => ({
    createScopedLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('MobileEvidenceCaptureAgent', () => {
    afterEach(() => {
        cleanup();
        window.history.replaceState(null, '', '/');
    });

    it('没有取证参数时不应依赖 Router 上下文，避免开发取证组件打挂页面', () => {
        window.history.replaceState(null, '', '/play/fantasyrealms?foo=bar');

        expect(() => {
            render(<MobileEvidenceCaptureAgent scenarioHandlers={{}} />);
        }).not.toThrow();
    });
});
