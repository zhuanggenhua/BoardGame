// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CursorSettingsModal } from '../CursorSettingsModal';

const registry = vi.hoisted(() => ({ ready: false, saved: 'default', complete: undefined as undefined | (() => void) }));
const theme = { id: 'test-theme', gameId: 'test-game', label: '测试游戏光标', variantLabel: '标准',
    previewSvgs: { default: '<svg xmlns="http://www.w3.org/2000/svg" />' } };
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../common/overlays/ModalBase', () => ({ ModalBase: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../../config/games.config', () => ({ getAllGames: () => [{ id: 'test-game', cursorTheme: 'test-theme' }] }));
vi.mock('../../../core/cursor/CursorPreferenceContext', () => ({ useCursorPreference: () => ({
    preference: { cursorTheme: registry.saved, gameVariants: {}, highContrast: false, overrideScope: 'home' }, updatePreference: vi.fn(),
}) }));
vi.mock('../../../core/cursor/ensureCursorRegistryLoaded', () => ({
    isCursorRegistryLoaded: () => registry.ready,
    ensureCursorRegistryLoaded: () => new Promise<void>(resolve => { registry.complete = () => { registry.ready = true; resolve(); }; }),
}));
vi.mock('../../../core/cursor/themes', () => ({
    getDefaultThemePerGame: () => registry.ready ? [theme] : [],
    getCursorTheme: (id: string) => registry.ready && id === theme.id ? theme : undefined,
    getThemesByGameId: () => registry.ready ? [theme] : [],
}));
beforeEach(() => { registry.ready = false; registry.complete = undefined; });
afterEach(cleanup);

describe('首次打开光标设置时的延迟注册', () => {
    it.each(['default', 'test-theme'])('注册完成后显示主题，并恢复已保存的选择：%s', async saved => {
        registry.saved = saved;
        render(<CursorSettingsModal isOpen onClose={() => {}} />);
        expect(screen.queryByRole('button', { name: /测试游戏光标/ })).toBeNull();
        await act(async () => { registry.complete!(); });
        const game = screen.getByRole('button', { name: /测试游戏光标/ });
        expect(game).toBeTruthy();
        const variants = screen.getByRole('button', { name: 'cursor.change' });
        if (saved === 'test-theme') expect((variants as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(game);
        expect((variants as HTMLButtonElement).disabled).toBe(false);
    });
});
