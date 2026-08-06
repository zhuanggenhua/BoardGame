import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthModal } from '../AuthModal';

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        login: vi.fn(),
        register: vi.fn(),
        sendRegisterCode: vi.fn(),
        sendResetCode: vi.fn(),
        resetPassword: vi.fn(),
    }),
}));

const STORAGE_KEY = 'auth_modal_remembered_fields_v1';

describe('AuthModal register remembered fields', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                account: 'wrong@example.com',
                username: 'wrong-name',
                email: 'wrong@example.com',
                resetEmail: 'wrong@example.com',
            }),
        );
    });

    it('注册信息被用户清空后不应被旧缓存重新补回', async () => {
        render(
            <AuthModal
                isOpen
                embedded
                initialMode="register"
                onClose={() => undefined}
            />,
        );

        const emailInput = screen.getByTestId('auth-register-email-input') as HTMLInputElement;
        const usernameInput = screen.getByTestId('auth-register-username-input') as HTMLInputElement;

        await waitFor(() => {
            expect(emailInput.value).toBe('wrong@example.com');
            expect(usernameInput.value).toBe('wrong-name');
        });

        fireEvent.change(emailInput, { target: { value: '' } });
        fireEvent.change(usernameInput, { target: { value: '' } });

        await waitFor(() => {
            expect(emailInput.value).toBe('');
            expect(usernameInput.value).toBe('');
        });

        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(
            expect.objectContaining({
                email: '',
                username: '',
            }),
        );
    });
});
