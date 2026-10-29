// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeStyleSettings } from '../HomeStyleSettings';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }) }));
describe('浮球内首页风格选择', () => {
    it('大厅设置继续走浮球原浮窗，不单独开抽屉', () => {
        const source = readFileSync(resolve('src/components/system/GlobalHUD.tsx'), 'utf8');
        const settingsBlock = source.slice(source.indexOf("id: 'settings'"), source.indexOf("id: 'display-theme'"));
        expect(settingsBlock).toContain('HomeStyleSettings');
        expect(settingsBlock).not.toContain("mobilePanelVariant: 'sheet'");
    });
    it('只提供风格选项，不创建独立首页设置触发器', () => {
        const select = vi.fn();
        render(<HomeStyleSettings currentStyle="modern" onSelectStyle={select} />);
        expect(screen.getAllByRole('radio')).toHaveLength(2);
        expect(screen.getByTestId('home-style-modern').getAttribute('aria-checked')).toBe('true');
        expect(screen.queryByRole('button', { name: 'Home settings' })).toBeNull();
        fireEvent.click(screen.getByTestId('home-style-classic'));
        expect(select).toHaveBeenCalledWith('classic');
    });
    it('方向键和首尾键继续通过同一风格回调切换', () => {
        const select = vi.fn();
        render(<HomeStyleSettings currentStyle="classic" onSelectStyle={select} />);
        fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowUp' });
        expect(select).toHaveBeenLastCalledWith('modern');
        fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'End' });
        expect(select).toHaveBeenLastCalledWith('classic');
    });
});
