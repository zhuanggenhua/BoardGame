import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackModal } from '../FeedbackModal';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
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
});
