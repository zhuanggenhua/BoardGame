import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoResponseToggle } from '../AutoResponseToggle';
import { getBonusDiceResponseEnabled } from '../responsePreferences';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('AutoResponseToggle', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('默认开启总响应，但奖励骰响应默认关闭', async () => {
        const onToggle = vi.fn();
        const onBonusDiceToggle = vi.fn();

        render(
            <AutoResponseToggle
                onToggle={onToggle}
                onBonusDiceToggle={onBonusDiceToggle}
            />,
        );

        expect(screen.getByTestId('auto-response-toggle')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('bonus-dice-response-toggle')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('bonus-dice-response-toggle')).not.toBeDisabled();

        await waitFor(() => {
            expect(onToggle).toHaveBeenLastCalledWith(true);
            expect(onBonusDiceToggle).toHaveBeenLastCalledWith(false);
        });
        expect(getBonusDiceResponseEnabled(true)).toBe(false);
    });

    it('总响应开启时，可以单独开启奖励骰响应', async () => {
        const onBonusDiceToggle = vi.fn();

        render(<AutoResponseToggle onBonusDiceToggle={onBonusDiceToggle} />);
        fireEvent.click(screen.getByTestId('bonus-dice-response-toggle'));

        await waitFor(() => {
            expect(screen.getByTestId('bonus-dice-response-toggle')).toHaveAttribute('aria-pressed', 'true');
            expect(onBonusDiceToggle).toHaveBeenLastCalledWith(true);
        });
        expect(window.localStorage.getItem('dicethrone:bonusDiceResponse')).toBe('true');
    });

    it('关闭总响应时，会关闭并禁用奖励骰响应', async () => {
        window.localStorage.setItem('dicethrone:autoResponse', 'true');
        window.localStorage.setItem('dicethrone:bonusDiceResponse', 'true');
        const onToggle = vi.fn();
        const onBonusDiceToggle = vi.fn();

        render(
            <AutoResponseToggle
                onToggle={onToggle}
                onBonusDiceToggle={onBonusDiceToggle}
            />,
        );

        expect(screen.getByTestId('bonus-dice-response-toggle')).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByTestId('auto-response-toggle'));

        await waitFor(() => {
            expect(screen.getByTestId('auto-response-toggle')).toHaveAttribute('aria-pressed', 'false');
            expect(screen.getByTestId('bonus-dice-response-toggle')).toHaveAttribute('aria-pressed', 'false');
            expect(screen.getByTestId('bonus-dice-response-toggle')).toBeDisabled();
            expect(onToggle).toHaveBeenLastCalledWith(false);
            expect(onBonusDiceToggle).toHaveBeenLastCalledWith(false);
        });
        expect(getBonusDiceResponseEnabled(false)).toBe(false);
        expect(window.localStorage.getItem('dicethrone:bonusDiceResponse')).toBe('false');
    });
});
