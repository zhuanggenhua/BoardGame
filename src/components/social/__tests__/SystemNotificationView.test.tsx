import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { SystemNotificationView } from '../SystemNotificationView';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const dict: Record<string, string> = {
                'notification.title': '系统通知',
                'notification.empty': '暂无通知',
                'notification.pinnedBadge': '置顶',
                'common:loading': '加载中',
            };
            return dict[key] ?? key;
        },
    }),
}));

describe('SystemNotificationView', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('会为置顶系统通知渲染特殊徽记并标记置顶态', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                notifications: [
                    {
                        _id: 'notice-pinned',
                        title: '维护公告',
                        content: '今晚 22:00 维护',
                        createdAt: '2026-05-24T00:00:00.000Z',
                        pinned: true,
                    },
                    {
                        _id: 'notice-normal',
                        title: '普通公告',
                        content: '普通内容',
                        createdAt: '2026-05-23T00:00:00.000Z',
                        pinned: false,
                    },
                ],
            }),
        } as Response);

        render(<SystemNotificationView />);

        await waitFor(() => {
            expect(screen.getByText('维护公告')).toBeInTheDocument();
        });

        expect(screen.getByTestId('system-notification-pinned-badge-notice-pinned')).toHaveTextContent('置顶');
        expect(screen.getByTestId('system-notification-card-notice-pinned')).toHaveAttribute('data-pinned', 'true');
        expect(screen.getByTestId('system-notification-card-notice-normal')).toHaveAttribute('data-pinned', 'false');
    });
});
