// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FabMenu } from '../FabMenu';
vi.mock('../../../hooks/ui/useRuntimeViewport', () => ({ useRuntimeViewport: () => ({ width: 390, height: 844, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } }) }));
const items = [{ id: 'help', label: '帮助', icon: <span>?</span> }];
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
it('默认位置不变，临时底部占位消失后恢复默认位置', async () => {
  const { rerender } = render(<FabMenu items={items} />);
  await waitFor(() => expect(screen.getByTestId('fab-menu').style.top).toBe('740px'));
  rerender(<FabMenu items={items} bottomClearance={146} />);
  await waitFor(() => expect(screen.getByTestId('fab-menu').style.top).toBe('594px'));
  rerender(<FabMenu items={items} />);
  await waitFor(() => expect(screen.getByTestId('fab-menu').style.top).toBe('740px'));
});
it('临时避让不覆盖用户保存的位置，解除后恢复原保存位置', async () => {
  const saved = JSON.stringify({ leftPercent: 0.8, topPercent: 740 / 844 });
  localStorage.setItem('hud_fab_position', saved);
  const { rerender } = render(<FabMenu items={items} bottomClearance={146} />);
  await waitFor(() => expect(screen.getByTestId('fab-menu').style.top).toBe('642px'));
  expect(localStorage.getItem('hud_fab_position')).toBe(saved);
  rerender(<FabMenu items={items} />);
  await waitFor(() => expect(screen.getByTestId('fab-menu').style.top).toBe('740px'));
  expect(localStorage.getItem('hud_fab_position')).toBe(saved);
});

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
