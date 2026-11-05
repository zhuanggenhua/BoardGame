/* @vitest-environment happy-dom */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OperationGuideButton } from '../OperationGuidePanel';

type CapturedModalEntry = {
    id?: string;
    closeOnBackdrop?: boolean;
    closeOnEsc?: boolean;
    lockScroll?: boolean;
    render: (api: { close: () => void; closeOnBackdrop: boolean }) => ReactNode;
};

let capturedModalEntry: CapturedModalEntry | null = null;
const mockOpenModal = vi.fn((entry: CapturedModalEntry) => {
    capturedModalEntry = entry;
    return entry.id ?? 'operation-guide-modal';
});
const mockCloseModal = vi.fn();

const translations: Record<string, string> = {
    'hud.actions.operationGuide': '操作指南',
    'hud.actions.close': '关闭',
    'hud.operationGuide.title': '操作指南',
    'hud.operationGuide.visual.webFabImageAlt': '网页端悬浮球标注截图',
    'hud.operationGuide.visual.appFabImageAlt': 'App 端悬浮球标注截图',
    'hud.operationGuide.visual.gameFabImageAlt': '局内悬浮球标注截图',
    'hud.operationGuide.visual.opponentPublicInfoImageAlt': '对手公开信息标注截图',
    'hud.operationGuide.visual.longPressImageAlt': '移动端长按放大标注截图',
    'hud.operationGuide.visual.zoomDialogLabel': '操作指南截图放大查看',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => translations[key] ?? options?.defaultValue ?? key,
    }),
}));

vi.mock('../../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        openModal: mockOpenModal,
        closeModal: mockCloseModal,
    }),
}));

describe('OperationGuideButton', () => {
    beforeEach(() => {
        capturedModalEntry = null;
        mockOpenModal.mockClear();
        mockCloseModal.mockClear();
    });

    it('放大图按退出键只收起最上层，保留指南和阅读位置', () => {
        render(<OperationGuideButton surface="web" dataTestId="guide-escape-entry"/>);
        fireEvent.click(screen.getByTestId('guide-escape-entry'));
        const close=vi.fn();
        render(<>{capturedModalEntry?.render({close,closeOnBackdrop:true})}</>);
        const windowKey=vi.fn();window.addEventListener('keydown',windowKey);
        fireEvent.click(screen.getByTestId('operation-guide-real-screenshot-long-press-zoom-trigger'));
        fireEvent.keyDown(screen.getByTestId('operation-guide-image-viewer'),{key:'Escape'});
        expect(screen.queryByTestId('operation-guide-image-viewer')).toBeNull();
        expect(screen.getByTestId('operation-guide-modal')).toBeInTheDocument();
        expect(close).not.toHaveBeenCalled();expect(windowKey).not.toHaveBeenCalled();
        window.removeEventListener('keydown',windowKey);
    });
    it('关闭放大后恢复原缩略图焦点', () => {
        render(<OperationGuideButton surface="web" dataTestId="guide-restore-entry"/>);
        fireEvent.click(screen.getByTestId('guide-restore-entry'));
        render(<>{capturedModalEntry?.render({close:vi.fn(),closeOnBackdrop:true})}</>);
        const trigger = screen.getByTestId('operation-guide-real-screenshot-long-press-zoom-trigger');
        trigger.focus();
        fireEvent.click(trigger);
        fireEvent.click(screen.getByTestId('operation-guide-image-viewer-close'));
        expect(document.activeElement).toBe(trigger);
        expect(trigger.closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'false');
    });
    it('窄屏放大支持查看原始尺寸，再次打开恢复适应屏幕', () => {
        render(<OperationGuideButton surface="web" dataTestId="guide-size-entry"/>);
        fireEvent.click(screen.getByTestId('guide-size-entry'));
        render(<>{capturedModalEntry?.render({close:vi.fn(),closeOnBackdrop:true})}</>);
        const trigger=screen.getByTestId('operation-guide-real-screenshot-long-press-zoom-trigger');
        fireEvent.click(trigger);
        fireEvent.click(screen.getByTestId('operation-guide-image-viewer-size'));
        expect(screen.getByTestId('operation-guide-image-viewer-image').style.maxWidth).toBe('none');
        fireEvent.click(screen.getByTestId('operation-guide-image-viewer-close'));
        fireEvent.click(trigger);
        expect(screen.getByTestId('operation-guide-image-viewer-image').style.maxWidth).not.toBe('none');
    });
    it('放大层反向切换焦点不能落回底层指南', () => {
        render(<OperationGuideButton surface="web" dataTestId="guide-focus-entry"/>);
        fireEvent.click(screen.getByTestId('guide-focus-entry'));
        render(<>{capturedModalEntry?.render({close:vi.fn(),closeOnBackdrop:true})}</>);
        fireEvent.click(screen.getByTestId('operation-guide-real-screenshot-long-press-zoom-trigger'));
        const first=screen.getByTestId('operation-guide-image-viewer-size');first.focus();
        fireEvent.keyDown(first,{key:'Tab',shiftKey:true});
        expect(screen.getByTestId('operation-guide-image-viewer').contains(document.activeElement)).toBe(true);
        expect(document.activeElement).not.toBe(first);
    });
    it('平台首页弹窗显式使用平台主题且仍保留截图放大流程', () => {
        render(<OperationGuideButton surface="web" visualStyle="platform" dataTestId="platform-guide-entry" />);
        fireEvent.click(screen.getByTestId('platform-guide-entry'));
        render(<>{capturedModalEntry?.render({close:vi.fn(),closeOnBackdrop:true})}</>);
        expect(screen.getByTestId('operation-guide-modal')).toHaveAttribute('data-visual-style','platform');
        fireEvent.click(screen.getByTestId('operation-guide-real-screenshot-long-press-zoom-trigger'));
        expect(screen.getByTestId('operation-guide-image-viewer')).toBeInTheDocument();
    });

    it('从右上角按钮打开居中图解弹窗，并且不把操作指南列为悬浮球功能', () => {
        render(<OperationGuideButton surface="web" dataTestId="operation-guide-test-entry" />);

        fireEvent.click(screen.getByTestId('operation-guide-test-entry'));

        expect(mockOpenModal).toHaveBeenCalledWith(expect.objectContaining({
            id: 'operation-guide-modal',
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
        }));
        expect(capturedModalEntry).not.toBeNull();

        render(<>{capturedModalEntry?.render({ close: vi.fn(), closeOnBackdrop: true })}</>);

        expect(screen.getByTestId('operation-guide-modal')).toBeInTheDocument();
        expect(screen.queryByText('先看这三件事')).toBeNull();
        expect(screen.queryByText('点击放大查看')).toBeNull();
        expect(screen.queryByText('新手帮助')).toBeNull();
        expect(screen.queryByTestId('operation-guide-priority-list')).toBeNull();
        expect(screen.queryByTestId('operation-guide-fab-list')).toBeNull();
        expect(screen.queryAllByTestId(/^operation-guide-fab-item-/)).toHaveLength(0);
        expect(screen.getByTestId('operation-guide-annotated-screenshot')).toBeInTheDocument();
        expect(screen.queryByTestId('operation-guide-callout-main-fab')).toBeNull();
        expect(screen.queryByTestId('operation-guide-callout-satellite-buttons')).toBeNull();
        expect(screen.queryByTestId('operation-guide-callout-long-press')).toBeNull();
        expect(screen.getByTestId('operation-guide-real-screenshot-home-fab')).toHaveAttribute(
            'src',
            '/images/operation-guide/home-web-fab-annotated.png',
        );
        expect(screen.getByTestId('operation-guide-real-screenshot-long-press')).toHaveAttribute(
            'src',
            '/images/operation-guide/mobile-long-press-annotated.png',
        );
        expect(screen.getByTestId('operation-guide-real-screenshot-opponent-public-info')).toHaveAttribute(
            'src',
            '/images/operation-guide/opponent-public-info-annotated.png',
        );
        expect(screen.getByTestId('operation-guide-real-screenshot-game-fab')).toHaveAttribute(
            'src',
            '/images/operation-guide/game-fab-annotated.png',
        );

        fireEvent.click(screen.getByTestId('operation-guide-real-screenshot-long-press-zoom-trigger'));
        expect(screen.getByTestId('operation-guide-image-viewer')).toBeInTheDocument();
        expect(screen.queryByText('移动端长按放大标注截图')).toBeNull();
        expect(screen.getByTestId('operation-guide-image-viewer-image')).toHaveAttribute(
            'src',
            '/images/operation-guide/mobile-long-press-annotated.png',
        );
        fireEvent.click(screen.getByTestId('operation-guide-image-viewer-close'));
        expect(screen.queryByTestId('operation-guide-image-viewer')).toBeNull();

        fireEvent.click(screen.getByTestId('operation-guide-real-screenshot-opponent-public-info-zoom-trigger'));
        expect(screen.getByTestId('operation-guide-image-viewer-image')).toHaveAttribute(
            'src',
            '/images/operation-guide/opponent-public-info-annotated.png',
        );
        fireEvent.click(screen.getByTestId('operation-guide-image-viewer-close'));

        fireEvent.click(screen.getByTestId('operation-guide-real-screenshot-home-fab-zoom-trigger'));
        expect(screen.getByTestId('operation-guide-image-viewer-image')).toHaveAttribute(
            'src',
            '/images/operation-guide/home-web-fab-annotated.png',
        );
        fireEvent.click(screen.getByTestId('operation-guide-image-viewer-close'));

        fireEvent.click(screen.getByTestId('operation-guide-real-screenshot-game-fab-zoom-trigger'));
        expect(screen.getByTestId('operation-guide-image-viewer-image')).toHaveAttribute(
            'src',
            '/images/operation-guide/game-fab-annotated.png',
        );
        fireEvent.click(screen.getByTestId('operation-guide-image-viewer-close'));
        expect(screen.getByTestId('operation-guide-modal')).toBeInTheDocument();
    });

    it('App 端图解弹窗只切换真实截图，不额外生成悬浮球说明列表', () => {
        render(<OperationGuideButton surface="app" dataTestId="operation-guide-test-entry" />);

        fireEvent.click(screen.getByTestId('operation-guide-test-entry'));
        render(<>{capturedModalEntry?.render({ close: vi.fn(), closeOnBackdrop: true })}</>);

        expect(screen.getByTestId('operation-guide-real-screenshot-home-fab')).toHaveAttribute(
            'src',
            '/images/operation-guide/home-app-fab-annotated.png',
        );
        expect(screen.getByTestId('operation-guide-real-screenshot-game-fab')).toHaveAttribute(
            'src',
            '/images/operation-guide/game-fab-annotated.png',
        );
        expect(screen.getByTestId('operation-guide-real-screenshot-opponent-public-info')).toHaveAttribute(
            'src',
            '/images/operation-guide/opponent-public-info-annotated.png',
        );
        expect(screen.queryByTestId('operation-guide-fab-list')).toBeNull();
        expect(screen.queryAllByTestId(/^operation-guide-fab-item-/)).toHaveLength(0);
        expect(screen.queryByTestId('operation-guide-fab-item-download-app')).toBeNull();
    });
});
it('指南图片在解码前按真实原图尺寸预留空间，避免懒加载导致布局跳动', () => {
 render(<OperationGuideButton surface="web" dataTestId="guide-dimensions-entry"/>);
 fireEvent.click(screen.getByTestId('guide-dimensions-entry'));
 render(<>{capturedModalEntry?.render({close:vi.fn(),closeOnBackdrop:true})}</>);
 const longPress=screen.getByTestId('operation-guide-real-screenshot-long-press');
 expect(longPress.getAttribute('width')).toBe('812');expect(longPress.getAttribute('height')).toBe('375');
 const opponent=screen.getByTestId('operation-guide-real-screenshot-opponent-public-info');
 expect(opponent.getAttribute('width')).toBe('1920');expect(opponent.getAttribute('height')).toBe('1080');
});
it('新版首页指南不继续展示旧版首页截图，局内指南仍保留原教学图', () => {
 render(<OperationGuideButton surface="web" visualStyle="platform" dataTestId="guide-platform-copy-entry"/>);
 fireEvent.click(screen.getByTestId('guide-platform-copy-entry'));
 render(<>{capturedModalEntry?.render({close:vi.fn(),closeOnBackdrop:true})}</>);
 expect(screen.queryByTestId('operation-guide-real-screenshot-home-fab')).toBeNull();
 expect(screen.getByTestId('operation-guide-real-screenshot-opponent-public-info')).toBeTruthy();
 expect(document.querySelector('.platform-guide-intro')).not.toBeNull();
});
