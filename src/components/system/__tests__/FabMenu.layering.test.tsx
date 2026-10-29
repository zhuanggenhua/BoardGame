// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FabMenu } from '../FabMenu';
import { UI_Z_INDEX } from '../../../core';
vi.mock('../../../hooks/ui/useRuntimeViewport', () => ({ useRuntimeViewport: () => ({ width: 390, height: 844, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } }) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it('移动设置抽屉遮罩盖过源菜单，关闭后保留原锚点', async () => {
  render(<FabMenu items={[
    { id: 'settings', label: '设置', icon: <span>设置</span>, mobilePanelVariant: 'sheet', content: <div>音频设置内容</div> },
    { id: 'help', label: '帮助', icon: <span>?</span> },
  ]} />);
  const anchor = await screen.findByTestId('fab-menu');
  const button = screen.getByRole('button', { name: '设置' });
  fireEvent.click(button);
  expect(anchor.style.visibility).not.toBe('hidden');
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('dialog', { name: '设置' })).toBeTruthy());
  const backdrop = screen.getByTestId('fab-sheet-backdrop-settings');
  const sheet = screen.getByRole('dialog', { name: '设置' });
  expect(Number(backdrop.style.zIndex)).toBeGreaterThan(Number(anchor.style.zIndex));
  expect(Number(sheet.style.zIndex)).toBeGreaterThan(Number(backdrop.style.zIndex));
  expect(anchor.style.visibility).not.toBe('hidden');
  expect(screen.getByRole('dialog', { name: '设置' }).closest('[data-testid="fab-menu"]')).toBeNull();
  fireEvent.click(screen.getByTestId('fab-sheet-backdrop-settings'));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '设置' })).toBeNull());
  expect(anchor.style.visibility).not.toBe('hidden');
});

it('board-shell 悬浮菜单通过视口 HUD portal 避开终局遮罩并从截图中排除', async () => {
  render(
    <div data-game-page="true">
      <FabMenu
        hudPlacement="in-shell"
        zIndex={2400}
        items={[
          { id: 'settings', label: '设置', icon: <span>设置</span> },
          { id: 'feedback', label: '反馈', icon: <span>反馈</span> },
        ]}
      />
    </div>,
  );

  const portal = await screen.findByTestId('fab-menu-shell-portal');
  const menu = screen.getByTestId('fab-menu');
  expect(portal.parentElement).toBe(document.body);
  expect(Number(portal.style.zIndex)).toBeGreaterThan(UI_Z_INDEX.overlayRaised);
  expect(Number(portal.style.zIndex)).toBeLessThan(UI_Z_INDEX.modalRoot);
  expect(portal.style.pointerEvents).toBe('none');
  expect(menu.style.zIndex).toBe('2402');
  expect(menu.style.pointerEvents).toBe('auto');
  expect(menu).toHaveAttribute('data-feedback-exclude', 'true');
});

it('点击即时动作后收起悬浮菜单，避免遮挡随后打开的弹窗', async () => {
  const onClick = vi.fn();
  render(<FabMenu items={[
    { id: 'menu', label: '菜单', icon: <span>菜单</span> },
    { id: 'feedback', label: '反馈', icon: <span>反馈</span>, onClick },
  ]} />);

  const menu = await screen.findByTestId('fab-menu');
  fireEvent.click(screen.getByRole('button', { name: '菜单' }));
  const feedbackButton = screen.getByRole('button', { name: '反馈' });
  fireEvent.click(feedbackButton);

  expect(onClick).toHaveBeenCalledOnce();
  await waitFor(() => expect(feedbackButton).not.toBeVisible());
  expect(menu).toBeVisible();
});
