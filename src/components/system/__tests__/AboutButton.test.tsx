// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AboutButton } from '../AboutButton';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../AboutModal', () => ({
    AboutModal: ({ id, onClose }: { id: string; onClose: () => void }) =>
        <div id={id} role="region" aria-label="关于内容"><span>代码仓库和QQ群</span><button onClick={onClose}>关闭</button></div>,
}));

describe('首页关于入口', () => {
    it('悬浮显示内容，点击后固定，点击外部关闭', async () => {
        const { container } = render(<AboutButton />);
        const trigger = screen.getByRole('button', { name: 'hud.actions.about' });
        fireEvent.mouseEnter(container.querySelector('.about-entry')!);
        expect(await screen.findByRole('region', { name: '关于内容' })).toHaveTextContent('代码仓库和QQ群');
        fireEvent.click(trigger);
        fireEvent.mouseLeave(container.querySelector('.about-entry')!);
        expect(screen.getByRole('region', { name: '关于内容' })).toBeTruthy();
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('region', { name: '关于内容' })).toBeNull();
    });

    it('无需悬浮即可点击打开并用关闭按钮收起', async () => {
        render(<AboutButton />);
        fireEvent.click(screen.getByRole('button', { name: 'hud.actions.about' }));
        expect(await screen.findByRole('region', { name: '关于内容' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '关闭' }));
        expect(screen.queryByRole('region', { name: '关于内容' })).toBeNull();
    });
});
