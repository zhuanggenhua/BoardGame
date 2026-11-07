import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialOverlay } from '../TutorialOverlay';

const tutorial = vi.hoisted(() => vi.fn());
const viewport = vi.hoisted(() => ({ width: 1280, height: 720, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } }));
vi.mock('../../../contexts/TutorialContext', () => ({ useTutorial: tutorial }));
vi.mock('../../../hooks/ui/useRuntimeViewport', () => ({ useRuntimeViewport: () => viewport }));
vi.mock('../../../lib/audio/AudioManager', () => ({ AudioManager: { preloadKeys: vi.fn() } }));
vi.mock('../../../lib/audio/useGameAudio', () => ({ playSound: vi.fn() }));
vi.mock('../../../core', () => ({ HudPortal: ({ children }: { children: React.ReactNode }) => children, UI_Z_INDEX: { tutorial: 2300 } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('TutorialOverlay 真实几何变化后的定位', () => {
    afterEach(() => { cleanup(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('同一步骤静止时保持位置，保护对象、目标与正文尺寸变化后继续避让', () => {
        let clock = 0;
        let nextFrame: FrameRequestCallback | undefined;
        vi.spyOn(performance, 'now').mockImplementation(() => clock);
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
        let target = new DOMRect(500, 250, 80, 80);
        let guard = new DOMRect(5, 5, 5, 5);
        let readingAnchor = new DOMRect(850, 250, 80, 20);
        let header = new DOMRect();
        let parent = new DOMRect();
        let tooltipHeight = 120;
        document.body.innerHTML = '<button data-testid="layout-target">目标</button><div data-layout-guard></div>';
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
            if (this.getAttribute('data-testid') === 'layout-target') return target;
            if (this.getAttribute('data-testid') === 'reading-anchor') return readingAnchor;
            if (this.getAttribute('data-layout-guard') === 'header') return header;
            if (this.getAttribute('data-layout-guard') === 'parent') return parent;
            if (this.hasAttribute('data-layout-guard')) return guard;
            if (this.querySelector('[data-testid="tutorial-overlay-card"]')) return new DOMRect(0, 0, 320, tooltipHeight);
            return new DOMRect();
        });
        const step = { id: 'layout', content: '当前规则', highlightTarget: 'layout-target', position: 'right', tooltipMaxWidth: 320, avoidOverlapSelectors: ['[data-layout-guard]'] };
        const context = { isActive: true, currentStep: step, nextStep: vi.fn(), previousStep: vi.fn(), isLastStep: false, tutorial: { active: true, stepIndex: 0, steps: [step] } };
        tutorial.mockReturnValue(context);
        const view = render(<TutorialOverlay />);
        const tick = () => act(() => { clock += 101; nextFrame?.(clock); });
        const box = () => {
            const style = screen.getByTestId('tutorial-overlay-card').parentElement!.style;
            return { x: Number.parseFloat(style.left), y: Number.parseFloat(style.top) };
        };
        tick(); const initial = box();
        expect(initial).toEqual({ x: 592, y: 230 });
        tick(); tick(); expect(box()).toEqual(initial);

        guard = new DOMRect(initial.x, initial.y, 320, tooltipHeight);
        tick(); const avoided = box();
        expect(avoided).not.toEqual(initial);
        expect(avoided.x + 320 <= guard.left || avoided.x >= guard.right || avoided.y + tooltipHeight <= guard.top || avoided.y >= guard.bottom).toBe(true);

        guard = new DOMRect(5, 5, 5, 5);
        target = new DOMRect(700, 350, 80, 80);
        tick(); expect(box()).toEqual({ x: 792, y: 330 });
        tooltipHeight = 220;
        tick(); expect(box()).toEqual({ x: 792, y: 280 });

        // 同几何但步骤配置变化也必须重新定位，不能复用上个effect的结果。
        const leftStep = { ...step, id: 'next-layout', position: 'left' };
        tutorial.mockReturnValue({ ...context, currentStep: leftStep, tutorial: { active: true, stepIndex: 0, steps: [leftStep] } });
        view.rerender(<TutorialOverlay />); tick();
        expect(box()).toEqual({ x: 368, y: 280 });

        // 镜头/高亮仍是场景范围，说明贴近实际阅读对象；锚点移动也使缓存失效。
        document.body.insertAdjacentHTML('beforeend', '<span data-testid="reading-anchor">地区名</span>');
        target = new DOMRect(100, 100, 1000, 500);
        tooltipHeight = 120;
        tutorial.mockReturnValue({ ...context, currentStep: { ...step, id: 'separate-reading-anchor', tooltipAnchorTarget: 'reading-anchor' } });
        view.rerender(<TutorialOverlay />); tick();
        expect(box()).toEqual({ x: 942, y: 200 });
        const ring = screen.getByTestId('tutorial-highlight-ring');
        expect(Number.parseFloat(ring.style.left)).toBeLessThanOrEqual(target.left);
        expect(Number.parseFloat(ring.style.width)).toBeGreaterThanOrEqual(target.width);
        readingAnchor = new DOMRect(750, 350, 80, 20);
        tick(); expect(box()).toEqual({ x: 842, y: 300 });

        // 锚点异步挂载/卸载都以真实DOM为准，不能缓存旧位置。
        const readingElement = screen.getByTestId('reading-anchor');
        readingElement.remove(); target = new DOMRect(500, 250, 80, 80);
        tick(); expect(box()).toEqual({ x: 592, y: 230 });
        document.body.append(readingElement); tick();
        expect(box()).toEqual({ x: 842, y: 300 });
        expect(screen.getByTestId('tutorial-overlay-card').parentElement!.style.getPropertyValue('--tutorial-arrow-top')).toBe('52px');
        readingAnchor = new DOMRect(750, 0, 80, 20); tick();
        expect(box().y).toBe(8);
        expect(screen.getByTestId('tutorial-overlay-card').parentElement!.style.getPropertyValue('--tutorial-arrow-top')).toBe('12px');

        // 同层顶部栏需要避让，但先枚举的底部手牌不能把说明推到对象远处。
        guard = new DOMRect(450, 677, 320, 100);
        header = new DOMRect(400, 15, 700, 42);
        target = new DOMRect(100, 10, 310, 310);
        tooltipHeight = 238;
        document.body.insertAdjacentHTML('beforeend', '<div data-layout-guard="header"></div>');
        tutorial.mockReturnValue({ ...context, currentStep: { ...step, id: 'same-layer-guards' } });
        view.rerender(<TutorialOverlay />); tick();
        expect(box()).toEqual({ x: 422, y: 65 });

        // 操作子对象在受保护父对象内，必要时选择近处自由位置而非远端同侧空隙。
        parent = target;
        target = new DOMRect(250, 100, 145, 210);
        document.body.insertAdjacentHTML('beforeend', '<div data-layout-guard="parent"></div>');
        tick();
        const attached = box();
        const dx = Math.max(0, attached.x - target.right, target.left - attached.x - 320);
        const dy = Math.max(0, attached.y - target.bottom, target.top - attached.y - tooltipHeight);
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(28);
        expect(screen.queryByTestId('tutorial-anchor-arrow')).toBeNull();

        // 显式指认对象时，避让后的短箭头仍朝向实际对象，默认布局与位置保持原语义。
        tutorial.mockReturnValue({ ...context, currentStep: { ...step, id: 'direct-anchor', tooltipAnchorTarget: 'layout-target', tooltipArrow: 'anchor' } });
        view.rerender(<TutorialOverlay />); tick();
        expect(box()).toEqual(attached);
        const points = screen.getByTestId('tutorial-anchor-arrow').querySelector('polygon')!.getAttribute('points')!
            .split(/[ ,]+/).map(Number);
        expect(points).toHaveLength(6);
        const tipX = attached.x + points[4], tipY = attached.y + points[5];
        const tipDx = Math.max(0, target.left - tipX, tipX - target.right);
        const tipDy = Math.max(0, target.top - tipY, tipY - target.bottom);
        expect(Math.hypot(tipDx, tipDy)).toBeCloseTo(Math.max(3, Math.hypot(dx, dy) - 18), 2);
    });
});
