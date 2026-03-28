import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalErrorBoundary } from '../GlobalErrorBoundary';
import { ViewportDebugProbe } from '../ViewportDebugProbe';

// Mock Dependencies
vi.mock('react', async () => {
    const actual = await vi.importActual<any>('react');
    return {
        ...actual,
        Component: class extends actual.Component<any, any> {
            constructor(props: any) {
                super(props);
                this.state = {};
            }
            setState(state: any) {
                this.state = { ...this.state, ...state };
            }
        },
    };
});

describe('GlobalErrorBoundary', () => {
    it('Should be a React Component class', () => {
        expect(GlobalErrorBoundary).toBeDefined();
        // Since it's a class component
        expect(GlobalErrorBoundary.prototype).toBeDefined();
        // Check if it has the required lifecycle method
        expect(typeof GlobalErrorBoundary.getDerivedStateFromError).toBe('function');
    });

    it('getDerivedStateFromError should update state to hasError: true', () => {
        const error = new Error('Test Error');
        const state = GlobalErrorBoundary.getDerivedStateFromError(error);
        expect(state).toEqual({ hasError: true, error, errorInfo: null });
    });
});

describe('ViewportDebugProbe', () => {
    it('未带调试参数时不渲染', () => {
        render(
            <MemoryRouter initialEntries={['/play/dicethrone/local']}>
                <ViewportDebugProbe />
            </MemoryRouter>,
        );

        expect(screen.queryByTestId('viewport-debug-probe')).toBeNull();
    });

    it('带调试参数时渲染诊断浮层', () => {
        render(
            <MemoryRouter initialEntries={['/play/dicethrone/local?bgViewportDebug=1']}>
                <ViewportDebugProbe />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('viewport-debug-probe')).toBeInTheDocument();
        expect(screen.getByText('真机视口诊断')).toBeInTheDocument();
    });
});
