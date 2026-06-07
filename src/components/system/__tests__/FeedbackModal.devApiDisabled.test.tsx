import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { FeedbackModal } from '../FeedbackModal';
import { AuthProvider } from '../../../contexts/AuthContext';
import { ToastProvider } from '../../../contexts/ToastContext';

vi.mock('../../../config/server', () => ({
    AUTH_API_URL: '/auth',
    FEEDBACK_API_URL: '/feedback',
    IS_DEV_API_DISABLED: true,
}));

global.fetch = vi.fn();

const mockOnClose = vi.fn();

const TestWrapper = ({ children }: { children: ReactNode }) => (
    <BrowserRouter>
        <AuthProvider>
            <ToastProvider>
                {children}
            </ToastProvider>
        </AuthProvider>
    </BrowserRouter>
);

describe('FeedbackModal dev:lite API disabled mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    it('API 被禁用时显示明确提示并阻止提交请求', () => {
        render(
            <TestWrapper>
                <FeedbackModal onClose={mockOnClose} />
            </TestWrapper>
        );

        fireEvent.change(screen.getByPlaceholderText(/描述/i), { target: { value: 'dev lite 反馈' } });

        const submitButton = screen.getByRole('button', { name: /提交/i });
        expect(screen.getByTestId('feedback-api-disabled-banner')).toBeInTheDocument();
        expect(submitButton).toBeDisabled();

        fireEvent.click(submitButton);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
    });
});
