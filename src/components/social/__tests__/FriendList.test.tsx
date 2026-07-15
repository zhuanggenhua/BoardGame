import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendList } from '../FriendList';

let mockSocial: any;

vi.mock('../../../contexts/SocialContext', () => ({
    useSocial: () => mockSocial,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('FriendList request actions', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    beforeEach(() => {
        mockSocial = {
            friends: [],
            requests: [
                {
                    id: 'req-1',
                    fromUser: { id: 'user-1', username: '张三' },
                },
            ],
            conversations: [],
            acceptFriendRequest: vi.fn().mockRejectedValue(new Error('好友请求不存在')),
            rejectFriendRequest: vi.fn().mockRejectedValue(new Error('好友请求不存在')),
            searchUsers: vi.fn().mockResolvedValue([]),
            sendFriendRequest: vi.fn().mockResolvedValue(undefined),
        };
        consoleErrorSpy.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('接受按钮遇到已失效的好友请求时，不会冒成全局未处理异常', async () => {
        const unhandled = vi.fn((event: PromiseRejectionEvent) => event.preventDefault?.());
        window.addEventListener('unhandledrejection', unhandled);

        render(<FriendList onSelectFriend={vi.fn()} />);
        fireEvent.click(screen.getByTitle('social:tabs.requests'));
        fireEvent.click(screen.getByRole('button', { name: /common:accept/i }));

        await waitFor(() => expect(mockSocial.acceptFriendRequest).toHaveBeenCalledWith('req-1'));
        await Promise.resolve();

        expect(unhandled).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('[FriendList] Failed to accept friend request:', expect.any(Error));

        window.removeEventListener('unhandledrejection', unhandled);
    });

    it('拒绝按钮遇到已失效的好友请求时，不会冒成全局未处理异常', async () => {
        const unhandled = vi.fn((event: PromiseRejectionEvent) => event.preventDefault?.());
        window.addEventListener('unhandledrejection', unhandled);

        render(<FriendList onSelectFriend={vi.fn()} />);
        fireEvent.click(screen.getByTitle('social:tabs.requests'));
        fireEvent.click(screen.getByRole('button', { name: /common:reject/i }));

        await waitFor(() => expect(mockSocial.rejectFriendRequest).toHaveBeenCalledWith('req-1'));
        await Promise.resolve();

        expect(unhandled).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('[FriendList] Failed to reject friend request:', expect.any(Error));

        window.removeEventListener('unhandledrejection', unhandled);
    });

    it('发送好友请求遇到已发送提示时，不会冒成全局未处理异常，并显示已发送', async () => {
        const unhandled = vi.fn((event: PromiseRejectionEvent) => event.preventDefault?.());
        window.addEventListener('unhandledrejection', unhandled);
        mockSocial.searchUsers = vi.fn().mockResolvedValue([
            { id: 'user-2', username: '李四', status: 'none' },
        ]);
        mockSocial.sendFriendRequest = vi.fn().mockRejectedValue(new Error('好友请求已发送'));

        render(<FriendList onSelectFriend={vi.fn()} />);
        fireEvent.click(screen.getByTitle('social:tabs.add'));
        const searchInput = screen.getByPlaceholderText('social:search.placeholder');
        fireEvent.change(searchInput, {
            target: { value: '李四' },
        });
        fireEvent.submit(searchInput.closest('form')!);

        await screen.findByText('李四');
        fireEvent.click(screen.getByTitle('social:actions.addFriend'));

        await waitFor(() => expect(mockSocial.sendFriendRequest).toHaveBeenCalledWith('user-2'));
        await screen.findByText('social:status.sent');
        await Promise.resolve();

        expect(unhandled).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('[FriendList] Failed to send friend request:', expect.any(Error));

        window.removeEventListener('unhandledrejection', unhandled);
    });
});
