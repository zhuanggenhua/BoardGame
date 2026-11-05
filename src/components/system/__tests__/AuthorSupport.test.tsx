/* @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthorSupportButton } from '../AuthorSupport';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../lib/publicFileUrl', () => ({ versionedPublicFileUrl: (path: string) => path }));
afterEach(cleanup);
describe('支持作者入口', () => {
    it('悬浮展开正式二维码，离开收起；点击固定后离开保持', () => {
        render(<AuthorSupportButton />);
        const button = screen.getByRole('button', { name: '支持作者' });
        expect(screen.queryByRole('img')).toBeNull();
        fireEvent.mouseEnter(button.parentElement!);
        expect(screen.getAllByRole('img').map(image => image.getAttribute('src'))).toEqual(['/logos/weixin.jpg', '/logos/zhifubao.jpg']);
        fireEvent.mouseLeave(button.parentElement!);
        expect(button).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(button);
        fireEvent.mouseLeave(button.parentElement!);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getAllByRole('img')).toHaveLength(2);
        fireEvent.pointerDown(document.body);
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });
    it('键盘聚焦和触控点击可展开，关闭与退出键收起', () => {
        render(<AuthorSupportButton />);
        const button = screen.getByRole('button', { name: '支持作者' });
        fireEvent.focus(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        fireEvent.keyDown(button, { key: 'Escape' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(button);
        fireEvent.blur(button, { relatedTarget: document.body });
        expect(button).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(screen.getByRole('button', { name: '关闭赞助说明' }));
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });
    it('桌面与抽屉实例各自维护展开状态，不读取隐藏实例代替可见实例', () => {
        render(<><div hidden><AuthorSupportButton /></div><AuthorSupportButton /></>);
        const visible = screen.getByRole('button', { name: '支持作者' });
        const all = screen.getAllByRole('button', { name: '支持作者', hidden: true });
        fireEvent.click(visible);
        expect(visible).toHaveAttribute('aria-expanded', 'true');
        expect(all[0]).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById(visible.getAttribute('aria-controls')!)).not.toBeNull();
        fireEvent.keyDown(visible, { key: 'Escape' });
        expect(visible).toHaveAttribute('aria-expanded', 'false');
    });

});
