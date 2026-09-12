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
    'hud.operationGuide.eyebrow': '新手帮助',
    'hud.operationGuide.surface.web': '网页端从右上角打开本指南。',
    'hud.operationGuide.surface.app': 'App 端从右上角打开本指南。',
    'hud.operationGuide.visual.realScreenshotsTitle': '真实界面截图',
    'hud.operationGuide.visual.webFabImageAlt': '网页端悬浮球标注截图',
    'hud.operationGuide.visual.appFabImageAlt': 'App 端悬浮球标注截图',
    'hud.operationGuide.visual.longPressImageAlt': '移动端长按放大标注截图',
    'hud.operationGuide.visual.dragCallout': '主球：可拖动',
    'hud.operationGuide.visual.expandCallout': '展开后点小球',
    'hud.operationGuide.visual.longPressTitle': '移动端长按放大',
    'hud.operationGuide.visual.longPressDescription': '长按查看大图。',
    'hud.operationGuide.common.title': '常见操作',
    'hud.operationGuide.common.fabMenu': '悬浮球就是页面边缘的小圆球。',
    'hud.operationGuide.common.mobileLongPress': '移动端长按可放大查看。',
    'hud.operationGuide.common.desktopInspect': '网页端点击对象查看详情。',
    'hud.operationGuide.common.boardZoom': '棋盘可缩放或拖拽。',
    'hud.operationGuide.common.closeLayer': '右上角关闭。',
    'hud.operationGuide.fab.title': '悬浮球功能说明',
    'hud.operationGuide.fab.webTitle': '网页端悬浮球',
    'hud.operationGuide.fab.appTitle': 'App 端悬浮球',
    'hud.operationGuide.fab.gameTitle': '局内悬浮球',
    'hud.operationGuide.fab.settings': '调整声音、首页样式或当前游戏运行设置。',
    'hud.operationGuide.fab.displayTheme': '切换日间或夜间显示。',
    'hud.operationGuide.fab.fullscreen': '进入或退出全屏。',
    'hud.operationGuide.fab.downloadApp': '从网页端下载 App 安装包。',
    'hud.operationGuide.fab.checkUpdate': '在 App 端检查可用更新。',
    'hud.operationGuide.fab.about': '查看项目介绍。',
    'hud.operationGuide.fab.feedback': '提交问题或建议。',
    'hud.operationGuide.fab.social': '打开好友和私聊入口。',
    'hud.operationGuide.fab.chat': '打开局内聊天。',
    'hud.operationGuide.fab.emotes': '发送表情。',
    'hud.operationGuide.fab.actionLog': '查看行为日志。',
    'hud.operationGuide.fab.undo': '查看或申请撤回。',
    'hud.operationGuide.fab.forceActions': '应急推进入口。',
    'hud.operationGuide.fab.seatSwap': '请求或处理换位。',
    'hud.operationGuide.fab.exit': '离开对局或返回大厅。',
    'hud.operationGuide.fab.custom': '专属辅助入口。',
    'hud.operationGuide.fabLabels.settings': '设置',
    'hud.operationGuide.fabLabels.displayTheme': '日夜模式',
    'hud.operationGuide.fabLabels.fullscreen': '全屏',
    'hud.operationGuide.fabLabels.downloadApp': '下载应用',
    'hud.operationGuide.fabLabels.checkUpdate': '检查更新',
    'hud.operationGuide.fabLabels.about': '关于',
    'hud.operationGuide.fabLabels.feedback': '反馈',
    'hud.operationGuide.fabLabels.social': '好友',
    'hud.operationGuide.fabLabels.chat': '聊天',
    'hud.operationGuide.fabLabels.emotes': '表情',
    'hud.operationGuide.fabLabels.actionLog': '行为日志',
    'hud.operationGuide.fabLabels.undo': '撤回',
    'hud.operationGuide.fabLabels.forceActions': '应急推进',
    'hud.operationGuide.fabLabels.seatSwap': '换位',
    'hud.operationGuide.fabLabels.exit': '离开',
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
        expect(screen.getByTestId('operation-guide-annotated-screenshot')).toBeInTheDocument();
        expect(screen.getByTestId('operation-guide-callout-main-fab')).toBeInTheDocument();
        expect(screen.getByTestId('operation-guide-callout-satellite-buttons')).toBeInTheDocument();
        expect(screen.getByTestId('operation-guide-callout-long-press')).toBeInTheDocument();
        expect(screen.getByTestId('operation-guide-real-screenshot-home-fab')).toHaveAttribute(
            'src',
            '/images/operation-guide/home-web-fab-annotated.png',
        );
        expect(screen.getByTestId('operation-guide-real-screenshot-long-press')).toHaveAttribute(
            'src',
            '/images/operation-guide/mobile-long-press-annotated.png',
        );
        expect(screen.queryByTestId('operation-guide-fab-item-operation-guide')).toBeNull();
        expect(screen.getByTestId('operation-guide-fab-item-download-app')).toBeInTheDocument();
        expect(screen.getByTestId('operation-guide-fab-item-action-log')).toBeInTheDocument();
    });

    it('App 端图解弹窗列出检查更新入口，而不是网页下载入口', () => {
        render(<OperationGuideButton surface="app" dataTestId="operation-guide-test-entry" />);

        fireEvent.click(screen.getByTestId('operation-guide-test-entry'));
        render(<>{capturedModalEntry?.render({ close: vi.fn(), closeOnBackdrop: true })}</>);

        expect(screen.getByTestId('operation-guide-real-screenshot-home-fab')).toHaveAttribute(
            'src',
            '/images/operation-guide/home-app-fab-annotated.png',
        );
        expect(screen.getByTestId('operation-guide-fab-item-check-update')).toBeInTheDocument();
        expect(screen.queryByTestId('operation-guide-fab-item-download-app')).toBeNull();
    });
});
