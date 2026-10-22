// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlatformAudioSettings } from '../PlatformAudioSettings';
vi.mock('../../../hooks/ui/useMobileViewport', () => ({ useMobileViewport: () => true }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key === 'hud.actions.close' ? '关闭' : key }) }));
vi.mock('../../../contexts/AudioContext', () => ({ AudioProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../game/framework/widgets/AudioControlSection', () => ({ AudioControlSection: () => <><input aria-label="音乐音量" type="range"/><button>静音</button></> }));
afterEach(cleanup);
it('手机设置获得焦点、约束Tab并通过Escape关闭，卸载后回到触发器', async () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const close = vi.fn(); const { unmount } = render(<PlatformAudioSettings isDark={false} onClose={close}/>);
    const dismiss = screen.getByRole('button', { name: '关闭' }); expect(document.activeElement).toBe(dismiss);
    await waitFor(() => expect(screen.getByLabelText('音乐音量')).toBeTruthy());
    fireEvent.keyDown(dismiss, { key: 'Tab' }); expect(document.activeElement).toBe(screen.getByLabelText('音乐音量'));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(dismiss);
    fireEvent.keyDown(dismiss, { key: 'Escape' }); expect(close).toHaveBeenCalledOnce();
    unmount(); expect(document.activeElement).toBe(trigger); trigger.remove();
});
it('显式关闭与最新回调一致', () => {
    const oldClose = vi.fn(), newClose = vi.fn(); const { rerender } = render(<PlatformAudioSettings isDark={false} onClose={oldClose}/>);
    rerender(<PlatformAudioSettings isDark={false} onClose={newClose}/>);
    fireEvent.click(screen.getByRole('button', { name: '关闭' })); expect(newClose).toHaveBeenCalledOnce(); expect(oldClose).not.toHaveBeenCalled();
});
