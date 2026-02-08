
import { describe, it, expect, vi } from 'vitest';
import { GlobalErrorBoundary } from '../GlobalErrorBoundary';

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
