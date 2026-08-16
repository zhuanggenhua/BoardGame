import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PC_WEB_MASCOT_Z_INDEX, PcWebMascot } from '../PcWebMascot';
import { ToastProvider } from '../../../contexts/ToastContext';
import { UI_Z_INDEX } from '../../../core';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => ({
            'mascot.container_label': '看板娘',
            'mascot.button_label': '打开看板娘提示',
            'mascot.image_alt': '看板娘',
            'mascot.community_welcome': '欢迎进群交流：',
            'mascot.force_end_phase_tip': '遇到卡死时，悬浮球可以强制结束阶段。',
            'mascot.switch_view_tip': '点击对手分数/头像可以切换视角，可以看弃牌堆。',
        }[key] ?? key),
    }),
}));

vi.mock('../../../lib/mobile/androidRuntime', () => ({
    isAndroidShellBuildMode: () => false,
    isNativeAndroidRuntime: () => false,
}));

vi.mock('../../common/media/OptimizedImage', () => ({
    OptimizedImage: ({ src, alt, className }: { src: string; alt?: string; className?: string }) => (
        <img src={src} alt={alt} className={className} />
    ),
}));

function renderMascot() {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <ToastProvider>
                <PcWebMascot />
            </ToastProvider>
        </MemoryRouter>,
    );
}

describe('PcWebMascot', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('显示在悬浮球之下、实施中状态斜幅之上', () => {
        renderMascot();

        const mascot = screen.getByTestId('pc-web-mascot');

        expect(mascot).toHaveStyle({ zIndex: String(PC_WEB_MASCOT_Z_INDEX) });
        expect(PC_WEB_MASCOT_Z_INDEX).toBeLessThan(UI_Z_INDEX.hud);
        expect(PC_WEB_MASCOT_Z_INDEX).toBeGreaterThan(40);
    });

    it('点击已打开的看板娘会切到下一条对话', () => {
        renderMascot();

        const button = screen.getByTestId('pc-web-mascot-button');
        fireEvent.click(button);
        expect(screen.getByTestId('pc-web-mascot-tip')).toHaveTextContent('欢迎进群交流：');

        fireEvent.click(button);
        expect(screen.getByTestId('pc-web-mascot-tip')).toHaveTextContent('遇到卡死时，悬浮球可以强制结束阶段。');

        fireEvent.click(button);
        expect(screen.getByTestId('pc-web-mascot-tip')).toHaveTextContent('点击对手分数/头像可以切换视角，可以看弃牌堆。');
    });

    it('打开后会自动轮播对话', () => {
        renderMascot();

        fireEvent.click(screen.getByTestId('pc-web-mascot-button'));
        expect(screen.getByTestId('pc-web-mascot-tip')).toHaveTextContent('欢迎进群交流：');

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.getByTestId('pc-web-mascot-tip')).toHaveTextContent('遇到卡死时，悬浮球可以强制结束阶段。');
    });
});
