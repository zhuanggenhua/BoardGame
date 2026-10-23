// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserMenu } from '../UserMenu';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'layout-user', username: '布局测试用户', role: 'user', feedbackPoints: 0 }, token: null }), isBackofficeRole: () => false }));
vi.mock('../../../contexts/ModalStackContext', () => ({ useModalStack: () => ({ openModal: vi.fn(), closeModal: vi.fn() }) }));
vi.mock('../../../contexts/SocialContext', () => ({ useSocial: () => ({ requests: [], unreadTotal: 0, ensureRealtimeConnection: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../MatchHistoryModal', () => ({ MatchHistoryModal: () => null }));
vi.mock('../FriendsChatModal', () => ({ FriendsChatModal: () => null }));
vi.mock('../../auth/AccountSettingsModal', () => ({ AccountSettingsModal: () => null }));
vi.mock('../../settings/CursorSettingsModal', () => ({ CursorSettingsModal: () => null }));
vi.mock('../MyFeedbackModal', () => ({ MyFeedbackModal: () => null }));

beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ notifications: [] }) }))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('平台账户入口有独立头像和可访问名称，紧凑样式不丢失个人页入口', async () => {
  const profile = vi.fn();
  const { container } = render(<MemoryRouter><UserMenu variant="platform" onLogout={() => {}} onProfile={profile} /></MemoryRouter>);
  await act(async () => {});
  const trigger = screen.getByRole('button', { name: '布局测试用户' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('.platform-account-avatar')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'social:menu.notifications' })).toBeTruthy();
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByTestId('user-menu-profile'));
  expect(profile).toHaveBeenCalledOnce();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
it('非平台调用保留原有触发样式，不被首页适配替换', async () => {
  const { container } = render(<MemoryRouter><UserMenu onLogout={() => {}} /></MemoryRouter>);
  await act(async () => {});
  expect(container.querySelector('.user-menu--platform')).toBeNull();
  expect(screen.getByTestId('user-menu-trigger')).toBeTruthy();
});
