// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeStyleSettings } from '../HomeStyleSettings';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
    }),
}));

describe('HomeStyleSettings', () => {
    it('lets any homepage visitor choose the classic style from the settings control', () => {
        const onSelectStyle = vi.fn();
        render(<HomeStyleSettings currentStyle="modern" onSelectStyle={onSelectStyle} visualStyle="modern" />);

        fireEvent.click(screen.getByRole('button', { name: 'Home settings' }));
        const stylePicker = screen.getByRole('radiogroup', { name: 'Home style' });
        expect(screen.getByRole('radio', { name: 'Modern' }).getAttribute('aria-checked')).toBe('true');

        fireEvent.click(screen.getByRole('radio', { name: 'Classic' }));

        expect(onSelectStyle).toHaveBeenCalledWith('classic');
        expect(screen.queryByRole('radiogroup', { name: 'Home style' })).toBeNull();
        expect(stylePicker.isConnected).toBe(false);
    });

    it('lets a visitor return to the modern style from the same control', () => {
        const onSelectStyle = vi.fn();
        render(<HomeStyleSettings currentStyle="classic" onSelectStyle={onSelectStyle} visualStyle="classic" />);

        fireEvent.click(screen.getByRole('button', { name: 'Home settings' }));
        expect(screen.getByRole('radio', { name: 'Classic' }).getAttribute('aria-checked')).toBe('true');
        fireEvent.click(screen.getByRole('radio', { name: 'Modern' }));

        expect(onSelectStyle).toHaveBeenCalledWith('modern');
    });
});
