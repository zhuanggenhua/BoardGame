import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoResponseToggle } from '../AutoResponseToggle';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('AutoResponseToggle', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('默认开启总响应，且不再显示奖励骰专属响应开关', async () => {
        const onToggle = vi.fn();

        render(
            <AutoResponseToggle
                onToggle={onToggle}
            />,
        );

        expect(screen.getByTestId('auto-response-toggle')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByTestId('bonus-dice-response-toggle')).toBeNull();

        await waitFor(() => {
            expect(onToggle).toHaveBeenLastCalledWith(true);
        });
    });

    it('关闭总响应时，只切换普通响应偏好，不写奖励骰响应偏好', async () => {
        window.localStorage.setItem('dicethrone:autoResponse', 'true');
        window.localStorage.setItem('dicethrone:bonusDiceResponse', 'true');
        const onToggle = vi.fn();

        render(
            <AutoResponseToggle
                onToggle={onToggle}
            />,
        );

        fireEvent.click(screen.getByTestId('auto-response-toggle'));

        await waitFor(() => {
            expect(screen.getByTestId('auto-response-toggle')).toHaveAttribute('aria-pressed', 'false');
            expect(onToggle).toHaveBeenLastCalledWith(false);
        });
        expect(window.localStorage.getItem('dicethrone:bonusDiceResponse')).toBe('true');
    });
});
