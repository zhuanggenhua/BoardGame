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
    it('横屏多人候选的侧向空间不足时，说明避让全部候选、标题和操作', () => {
        const rect = (left: number, top: number, width: number, height: number) => ({
            x: left, y: top, left, top, width, height, right: left + width, bottom: top + height,
            toJSON: () => ({}),
        }) as DOMRect;
        const protectedRects = [rect(198, 105, 200, 139), rect(414, 105, 200, 139),
            rect(22, 25, 768, 45), rect(350, 283, 110, 50)];
        const width = Object.getOwnPropertyDescriptor(window, 'innerWidth')!;
        const height = Object.getOwnPropertyDescriptor(window, 'innerHeight')!;
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 812 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 375 });
        const geometry = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
            if (this.dataset.testid === 'info-tooltip') return rect(0, 0, 320, 68);
            if (this.classList.contains('tooltip-anchor')) return rect(264, 175, 57, 57);
            if (this.classList.contains('candidate-group')) return rect(198, 105, 416, 139);
            if (this.dataset.protected !== undefined) return protectedRects[Number(this.dataset.protected)];
            return rect(0, 0, 0, 0);
        });
        try {
            render(<div className="candidate-group">
                {protectedRects.map((_, index) => <div key={index} data-protected={index} />)}
                <div className="tooltip-anchor"><InfoTooltip title="致盲" content={['规则说明']} isVisible
                    placementBoundarySelector=".candidate-group" avoidSelector="[data-protected]" /></div>
            </div>);
            const tooltip = screen.getByTestId('info-tooltip');
            const left = parseFloat(tooltip.style.left), top = parseFloat(tooltip.style.top);
            expect(left).toBeGreaterThanOrEqual(12);
            expect(top).toBeGreaterThanOrEqual(12);
            expect(left + 320).toBeLessThanOrEqual(800);
            expect(top + 68).toBeLessThanOrEqual(363);
            for (const target of protectedRects) expect(left + 320 <= target.left || left >= target.right
                || top + 68 <= target.top || top >= target.bottom).toBe(true);
        } finally {
            geometry.mockRestore();
            Object.defineProperty(window, 'innerWidth', width);
            Object.defineProperty(window, 'innerHeight', height);
        }
    });

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
        expect(tooltipLayer?.parentElement).toBe(document.body);
        expect(tooltipLayer).toHaveStyle({ zIndex: String(UI_Z_INDEX.modalTooltip) });
        expect(tooltipLayer).toHaveClass('fixed');
        expect(tooltipLayer).toHaveClass('transition-opacity', 'duration-200', 'ease-out');
        expect(tooltipLayer).not.toHaveClass('animate-in');
        expect(tooltipLayer).not.toHaveClass('slide-in-from-left-[0.5vw]');
        expect(screen.getByTestId('info-tooltip-title')).toHaveStyle({ fontSize: 'clamp(12px, 0.9vw, 18px)' });
        expect(screen.getByTestId('info-tooltip-content-line')).toHaveStyle({ fontSize: 'clamp(11px, 0.7vw, 14px)' });
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

    it('请求向上展开时将提示放在锚点上方且箭头对准锚点', () => {
        const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        const originalInnerWidth = window.innerWidth;
        const originalInnerHeight = window.innerHeight;

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
        HTMLElement.prototype.getBoundingClientRect = function () {
            if (this.classList.contains('tooltip-anchor')) {
                return {
                    x: 40,
                    y: 520,
                    top: 520,
                    right: 80,
                    bottom: 560,
                    left: 40,
                    width: 40,
                    height: 40,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            if (this.getAttribute('data-testid') === 'info-tooltip') {
                return {
                    x: 0,
                    y: 0,
                    top: 0,
                    right: 340,
                    bottom: 100,
                    left: 0,
                    width: 340,
                    height: 100,
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
                        position="top"
                    />
                </div>,
            );

            const tooltip = screen.getByTestId('info-tooltip');
            expect(tooltip).toHaveAttribute('data-tooltip-placement', 'top');
            expect(tooltip).toHaveStyle({ left: '12px', top: '410px' });
            expect(tooltip.querySelector('[data-tooltip-arrow="true"]')).toHaveStyle({
                left: '48px',
                transform: 'translateX(-50%) rotate(45deg)',
            });
        } finally {
            HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
            Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
        }
    });

    it('锚点上方空间不足时向下展开', () => {
        const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
        const originalInnerWidth = window.innerWidth;
        const originalInnerHeight = window.innerHeight;

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 812 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 375 });
        HTMLElement.prototype.getBoundingClientRect = function () {
            if (this.classList.contains('tooltip-anchor')) {
                return {
                    x: 40,
                    y: 20,
                    top: 20,
                    right: 80,
                    bottom: 60,
                    left: 40,
                    width: 40,
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
                    bottom: 100,
                    left: 0,
                    width: 240,
                    height: 100,
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
                        position="top"
                    />
                </div>,
            );

            const tooltip = screen.getByTestId('info-tooltip');
            expect(tooltip).toHaveAttribute('data-tooltip-placement', 'bottom');
            expect(tooltip).toHaveStyle({ left: '12px', top: '70px' });
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
