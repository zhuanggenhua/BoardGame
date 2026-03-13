import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from '../common/overlays/ConfirmModal';
import { getDeveloperGameScopeLabel } from '../../lib/developerGameAccess';
import { UserRoleModal } from '../../pages/admin/components/UserRoleModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => {
            if (key === 'button.confirm') return 'confirm';
            if (key === 'button.cancel') return 'cancel';
            return options?.defaultValue ?? key;
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
    it('renders title, description, and default button text', () => {
        const html = renderToStaticMarkup(
            <ConfirmModal
                title="leave match"
                description="match in progress"
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );

        expect(html).toContain('leave match');
        expect(html).toContain('match in progress');
        expect(html).toContain('confirm');
        expect(html).toContain('cancel');
    });

    it('supports custom button text and hiding cancel button', () => {
        const html = renderToStaticMarkup(
            <ConfirmModal
                title="leave"
                description="confirm leave"
                confirmText="ok"
                cancelText="later"
                showCancel={false}
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );

        expect(html).toContain('leave');
        expect(html).toContain('confirm leave');
        expect(html).toContain('ok');
        expect(html).not.toContain('later');
    });

    it('disables actions and blocks repeated confirm while pending', async () => {
        let resolveConfirm: (() => void) | null = null;
        const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
            resolveConfirm = resolve;
        }));

        render(
            <ConfirmModal
                title="destroy room"
                description="confirm destroy room"
                onConfirm={onConfirm}
                onCancel={() => {}}
            />
        );

        const confirmButton = screen.getByRole('button', { name: 'confirm' });
        const cancelButton = screen.getByRole('button', { name: 'cancel' });

        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(confirmButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();

        resolveConfirm?.();

        await waitFor(() => {
            expect(confirmButton).not.toBeDisabled();
            expect(cancelButton).not.toBeDisabled();
        });
    });
});

describe('developerGameAccess', () => {
    it('空开发者范围不再返回未分配标签', () => {
        expect(getDeveloperGameScopeLabel(undefined)).toBeNull();
        expect(getDeveloperGameScopeLabel([])).toBeNull();
        expect(getDeveloperGameScopeLabel(['smashup', 'dicethrone', 'smashup'])).toBe('2 个游戏');
    });
});

describe('UserRoleModal', () => {
    it('使用限高加内部滚动的紧凑布局', () => {
        const html = renderToStaticMarkup(
            <UserRoleModal
                target={{
                    id: 'user-1',
                    username: '测试用户',
                    email: 'user@example.com',
                    role: 'developer',
                }}
                roleDraft="developer"
                developerGameIdsDraft={[]}
                gameOptions={[
                    { id: 'smashup', titleKey: 'games.smashup' },
                    { id: 'dicethrone', titleKey: 'games.dicethrone' },
                ]}
                saving={false}
                saveDisabled={false}
                roleLocked={false}
                onClose={() => {}}
                onSave={() => {}}
                onRoleChange={() => {}}
                onToggleGame={() => {}}
            />
        );

        expect(html).toContain('max-h-[calc(100vh-2rem)]');
        expect(html).toContain('flex-1 min-h-0 overflow-y-auto');
        expect(html).toContain('可多选。开发者只能管理这里勾选游戏的更新日志。');
        expect(html).not.toContain('主管理角色，拥有完整后台权限');
    });
});
