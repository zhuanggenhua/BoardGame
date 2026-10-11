import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UI_Z_INDEX } from '../../core';
import { InfoTooltip } from '../common/overlays/InfoTooltip';
import { ModalBase } from '../common/overlays/ModalBase';

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const MotionDiv = ({ children, ...rest }: { children?: React.ReactNode }) => (
        React.createElement('div', rest, children)
    );

    return {
        motion: { div: MotionDiv },
        AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
            React.createElement(React.Fragment, null, children)
        ),
    };
});

describe('InfoTooltip layer context', () => {
    it('在 ModalBase 内默认继承 modal tooltip 层级', () => {
        render(
            <ModalBase>
                <div className="relative">
                    <InfoTooltip
                        title="标题"
                        content={['说明']}
                        isVisible
                    />
                </div>
            </ModalBase>
        );

        const tooltipTitle = screen.getByText('标题');
        const tooltipLayer = tooltipTitle.closest('[data-testid="info-tooltip"]');

        expect(tooltipLayer).not.toBeNull();
        expect(tooltipLayer).toHaveStyle({ zIndex: String(UI_Z_INDEX.modalTooltip) });
        expect(tooltipLayer).toHaveClass('fixed');
        expect(tooltipLayer).toHaveClass('transition-opacity', 'duration-200', 'ease-out');
        expect(tooltipLayer).not.toHaveClass('animate-in');
        expect(tooltipLayer).not.toHaveClass('slide-in-from-left-[0.5vw]');
    });

    it('靠近右侧边界时会把提示翻到左侧并限制在视口内', () => {
        const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        const originalInnerWidth = window.innerWidth;
        const originalInnerHeight = window.innerHeight;

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
        HTMLElement.prototype.getBoundingClientRect = function () {
            if (this.classList.contains('tooltip-anchor')) {
                return {
                    x: 900,
                    y: 700,
                    top: 700,
                    right: 980,
                    bottom: 740,
                    left: 900,
                    width: 80,
                    height: 40,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            if (this.getAttribute('data-testid') === 'info-tooltip') {
                return {
                    x: 0,
                    y: 0,
                    top: 0,
                    right: 240,
                    bottom: 120,
                    left: 0,
                    width: 240,
                    height: 120,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            return originalGetBoundingClientRect.call(this);
        };

        try {
            render(
                <div className="tooltip-anchor">
                    <InfoTooltip
                        title="标题"
                        content={['说明']}
                        isVisible
                        position="right"
                    />
                </div>,
            );

            const tooltip = screen.getByTestId('info-tooltip');
            expect(tooltip).toHaveAttribute('data-tooltip-placement', 'left');
            expect(tooltip).toHaveStyle({
                left: '650px',
                top: '636px',
            });
        } finally {
            HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
            Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
        }
    });

    it('无标题时不渲染空标题栏', () => {
        render(
            <div className="tooltip-anchor">
                <InfoTooltip
                    title={null}
                    content={['说明']}
                    isVisible
                />
            </div>,
        );

        const tooltip = screen.getByTestId('info-tooltip');
        expect(screen.getByText('说明')).toBeVisible();
        expect(tooltip.querySelector('[data-testid="info-tooltip-title"]')).toBeNull();
    });
});
