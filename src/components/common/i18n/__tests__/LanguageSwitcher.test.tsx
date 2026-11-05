// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../lib/i18n';
import { LanguageSwitcher } from '../LanguageSwitcher';

describe('平台语言切换', () => {
    it('平台入口显示当前语种，下拉沿用新粗野选项而不是羊皮纸', () => {
        render(<I18nextProvider i18n={i18n}><LanguageSwitcher visualStyle="platform" /></I18nextProvider>);
        const trigger = screen.getByRole('button', { name: '语言' });
        expect(trigger.textContent).toContain('中文');
        expect(trigger.querySelector('svg')).toBeTruthy();
        expect(trigger.querySelector('.underline-center')).toBeNull();
        fireEvent.click(trigger);
        const menu = document.querySelector('.platform-language-menu');
        expect(menu).toBeTruthy();
        expect(menu?.querySelector('.underline-center')).toBeNull();
        expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '中文' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', { name: '中文' }).textContent).toContain('✓');
    });

    it('经典入口仍显示语言标签', () => {
        render(<I18nextProvider i18n={i18n}><LanguageSwitcher /></I18nextProvider>);
        expect(screen.getByRole('button', { name: '语言' }).textContent).toContain('语言');
    });
});
