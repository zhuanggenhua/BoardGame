import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField } from '../PasswordField';

describe('PasswordField', () => {
    it('应只让输入框挂在 mobile text entry proxy host 下，切换按钮保持在 host 外侧可点击', () => {
        render(<PasswordField data-testid="password-input" toggleButtonTestId="password-toggle" />);

        const input = screen.getByTestId('password-input');
        const toggle = screen.getByTestId('password-toggle');

        expect(input.closest('[data-mobile-text-entry-proxy-host="true"]')).not.toBeNull();
        expect(toggle.closest('[data-mobile-text-entry-proxy-host="true"]')).toBeNull();
        expect(input).toHaveAttribute('type', 'password');

        fireEvent.click(toggle);

        expect(input).toHaveAttribute('type', 'text');
    });
});
