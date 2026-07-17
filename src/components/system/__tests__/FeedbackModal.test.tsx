import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackModal } from '../FeedbackModal';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
import * as AuthContextModule from '../../../contexts/AuthContext';
import { ToastProvider } from '../../../contexts/ToastContext';

// Mock fetch
global.fetch = vi.fn();

const mockOnClose = vi.fn();

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
        <AuthProvider>
            <ToastProvider>
                {children}
            </ToastProvider>
        </AuthProvider>
    </BrowserRouter>
);

describe('FeedbackModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true })
        });
    });

    it('应该正常渲染反馈弹窗', () => {
        render(
            <TestWrapper>
                <FeedbackModal onClose={mockOnClose} />
            </TestWrapper>
        );

        // 使用更具体的选择器，避免匹配多个元素
        expect(screen.getByRole('heading', { name: /反馈/ })).toBeInTheDocument();
    });

    it('应该在有 actionLogText 时显示"附带操作日志"选项', () => {
        const actionLog = '玩家 0 打出了卡牌';
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    actionLogText={actionLog}
                />
            </TestWrapper>
        );

        expect(screen.getByLabelText(/附带操作日志/i)).toBeInTheDocument();
    });

    it('应该在有 stateSnapshot 时显示"附带状态快照"选项', () => {
        const snapshot = JSON.stringify({ gameId: 'test', core: {} });
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    stateSnapshot={snapshot}
                />
            </TestWrapper>
        );

        expect(screen.getByLabelText(/附带状态快照/i)).toBeInTheDocument();
    });

    it('应该默认勾选"附带操作日志"', () => {
        const actionLog = '玩家 0 打出了卡牌';
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    actionLogText={actionLog}
                />
            </TestWrapper>
        );

        const checkbox = screen.getByLabelText(/附带操作日志/i) as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('应该默认勾选"附带状态快照"', () => {
        const snapshot = JSON.stringify({ gameId: 'test', core: {} });
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    stateSnapshot={snapshot}
                />
            </TestWrapper>
        );

        const checkbox = screen.getByLabelText(/附带状态快照/i) as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('应该允许取消勾选"附带操作日志"', () => {
        const actionLog = '玩家 0 打出了卡牌';
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    actionLogText={actionLog}
                />
            </TestWrapper>
        );

        const checkbox = screen.getByLabelText(/附带操作日志/i) as HTMLInputElement;
        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
    });

    it('应该允许取消勾选"附带状态快照"', () => {
        const snapshot = JSON.stringify({ gameId: 'test', core: {} });
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    stateSnapshot={snapshot}
                />
            </TestWrapper>
        );

        const checkbox = screen.getByLabelText(/附带状态快照/i) as HTMLInputElement;
        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
    });

    it('应该在提交时包含勾选的 actionLog', async () => {
        const actionLog = '玩家 0 打出了卡牌';
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    actionLogText={actionLog}
                />
            </TestWrapper>
        );

        const textarea = screen.getByPlaceholderText(/描述/i);
        fireEvent.change(textarea, { target: { value: '测试反馈' } });

        const submitButton = screen.getByRole('button', { name: /提交/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining(actionLog)
                })
            );
        });
    });

    it('应该在取消勾选后不包含 actionLog', async () => {
        const actionLog = '玩家 0 打出了卡牌';
        const snapshot = JSON.stringify({ gameId: 'test', core: {} });
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    actionLogText={actionLog}
                    stateSnapshot={snapshot}
                />
            </TestWrapper>
        );

        const checkbox = screen.getByLabelText(/附带操作日志/i);
        fireEvent.click(checkbox); // 取消勾选

        const textarea = screen.getByPlaceholderText(/描述/i);
        fireEvent.change(textarea, { target: { value: '测试反馈' } });

        const submitButton = screen.getByRole('button', { name: /提交/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            const callArgs = (global.fetch as any).mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.actionLog).toBeUndefined();
            expect(body.stateSnapshot).toBe(snapshot);
        });
    });

    it('应该在提交时包含勾选的 stateSnapshot', async () => {
        const snapshot = JSON.stringify({ gameId: 'test', core: {} });
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    stateSnapshot={snapshot}
                />
            </TestWrapper>
        );

        const textarea = screen.getByPlaceholderText(/描述/i);
        fireEvent.change(textarea, { target: { value: '测试反馈' } });

        const submitButton = screen.getByRole('button', { name: /提交/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            const callArgs = (global.fetch as any).mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.stateSnapshot).toBe(snapshot);
        });
    });

    it('应该在取消勾选后不包含 stateSnapshot', async () => {
        const snapshot = JSON.stringify({ gameId: 'test', core: {} });
        const actionLog = '玩家 0 打出了卡牌';
        render(
            <TestWrapper>
                <FeedbackModal 
                    onClose={mockOnClose} 
                    stateSnapshot={snapshot}
                    actionLogText={actionLog}
                />
            </TestWrapper>
        );

        const checkbox = screen.getByLabelText(/附带状态快照/i);
        fireEvent.click(checkbox); // 取消勾选

        const textarea = screen.getByPlaceholderText(/描述/i);
        fireEvent.change(textarea, { target: { value: '测试反馈' } });

        const submitButton = screen.getByRole('button', { name: /提交/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            const callArgs = (global.fetch as any).mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.stateSnapshot).toBeUndefined();
            expect(body.actionLog).toBe(actionLog);
        });
    });

    it('bug 类型在没有任何调试附件时仍可提交', async () => {
        const snapshot = JSON.stringify({ gameId: 'test', core: {} });
        const actionLog = '玩家 0 打出了卡牌';
        render(
            <TestWrapper>
                <FeedbackModal
                    onClose={mockOnClose}
                    actionLogText={actionLog}
                    stateSnapshot={snapshot}
                />
            </TestWrapper>
        );

        fireEvent.click(screen.getByLabelText(/附带操作日志/i));
        fireEvent.click(screen.getByLabelText(/附带状态快照/i));

        const textarea = screen.getByPlaceholderText(/描述/i);
        fireEvent.change(textarea, { target: { value: '测试反馈' } });

        const submitButton = screen.getByRole('button', { name: /提交/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            const callArgs = (global.fetch as any).mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.type).toBe('bug');
            expect(body.actionLog).toBeUndefined();
            expect(body.stateSnapshot).toBeUndefined();
        });
    });

    it('关闭后重新打开应保留未提交的反馈草稿', () => {
        const actionLog = '玩家 0 打出了卡牌';
        const snapshot = JSON.stringify({ gameId: 'test', core: {} });
        const firstRender = render(
            <TestWrapper>
                <FeedbackModal
                    onClose={mockOnClose}
                    actionLogText={actionLog}
                    stateSnapshot={snapshot}
                />
            </TestWrapper>
        );

        fireEvent.change(screen.getByPlaceholderText(/描述/i), { target: { value: '误关前的草稿内容' } });
        fireEvent.change(screen.getByPlaceholderText(/邮箱或 QQ/i), { target: { value: 'draft@example.com' } });
        fireEvent.click(screen.getByLabelText(/附带操作日志/i));

        firstRender.unmount();

        render(
            <TestWrapper>
                <FeedbackModal
                    onClose={mockOnClose}
                    actionLogText={actionLog}
                    stateSnapshot={snapshot}
                />
            </TestWrapper>
        );

        expect(screen.getByPlaceholderText(/描述/i)).toHaveValue('误关前的草稿内容');
        expect(screen.getByPlaceholderText(/邮箱或 QQ/i)).toHaveValue('draft@example.com');
        expect((screen.getByLabelText(/附带操作日志/i) as HTMLInputElement).checked).toBe(false);
        expect((screen.getByLabelText(/附带状态快照/i) as HTMLInputElement).checked).toBe(true);
    });

    it('提交成功后应清空已保存的反馈草稿', async () => {
        const firstRender = render(
            <TestWrapper>
                <FeedbackModal onClose={mockOnClose} />
            </TestWrapper>
        );

        fireEvent.change(screen.getByPlaceholderText(/描述/i), { target: { value: '提交后应被清空的草稿' } });
        fireEvent.click(screen.getByRole('button', { name: /提交/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        firstRender.unmount();

        render(
            <TestWrapper>
                <FeedbackModal onClose={mockOnClose} />
            </TestWrapper>
        );

        expect(screen.getByPlaceholderText(/描述/i)).toHaveValue('');
    });

    it('登录态失效时应匿名重试提交', async () => {
        const addFeedbackPoints = vi.fn();
        const useAuthSpy = vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            user: {
                id: 'stale-user',
                username: 'stale-user',
                role: 'user',
                banned: false,
                feedbackPoints: 0,
            },
            token: 'stale-token',
            addFeedbackPoints,
        } as unknown as ReturnType<typeof AuthContextModule.useAuth>);

        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ message: '登录凭证无效' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ rewardPoints: 0 }),
            });

        try {
            render(
                <BrowserRouter>
                    <ToastProvider>
                        <FeedbackModal onClose={mockOnClose} />
                    </ToastProvider>
                </BrowserRouter>
            );

            fireEvent.change(screen.getByPlaceholderText(/描述/i), { target: { value: '失效登录态下的反馈' } });
            fireEvent.click(screen.getByRole('button', { name: /提交/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });

            const firstCall = (global.fetch as any).mock.calls[0][1];
            const retryCall = (global.fetch as any).mock.calls[1][1];
            expect(firstCall.headers.Authorization).toBe('Bearer stale-token');
            expect(retryCall.headers.Authorization).toBeUndefined();
            expect(addFeedbackPoints).not.toHaveBeenCalled();
            expect(mockOnClose).toHaveBeenCalled();
        } finally {
            useAuthSpy.mockRestore();
        }
    });
});
