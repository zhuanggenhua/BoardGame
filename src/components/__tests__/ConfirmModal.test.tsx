import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmModal } from '../common/overlays/ConfirmModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'button.confirm') return '确认';
            if (key === 'button.cancel') return '取消';
            return key;
        },
    }),
}));

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

describe('ConfirmModal', () => {
    it('渲染标题、描述与默认按钮文案', () => {
        const html = renderToStaticMarkup(
            <ConfirmModal
                title="退出当前对局"
                description="你正在进行对局"
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );

        expect(html).toContain('退出当前对局');
        expect(html).toContain('你正在进行对局');
        expect(html).toContain('确认');
        expect(html).toContain('取消');
    });

    it('支持自定义按钮文案并隐藏取消按钮', () => {
        const html = renderToStaticMarkup(
            <ConfirmModal
                title="离开"
                description="确认离开"
                confirmText="好的"
                cancelText="算了"
                showCancel={false}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );

        expect(html).toContain('离开');
        expect(html).toContain('确认离开');
        expect(html).toContain('好的');
        expect(html).not.toContain('算了');
    });
});
