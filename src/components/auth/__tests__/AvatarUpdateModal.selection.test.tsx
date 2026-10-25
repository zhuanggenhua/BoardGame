// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarUpdateModal } from '../AvatarUpdateModal';

const auth = vi.hoisted(() => ({ user: { username: '测试玩家', avatar: '/assets/avatars/old.webp' as string | undefined }, updateAvatar: vi.fn(), uploadAvatar: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../common/overlays/ModalBase', () => ({ ModalBase: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('react-easy-crop', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => {
    const labels: Record<string, string> = {
        'avatar.source.default': '默认', 'avatar.source.preset': '预设', 'avatar.source.upload': '自行上传',
        'avatar.useDefault': '使用默认头像', 'avatar.usePreset': '使用所选头像', 'avatar.presets.dice': '骰子',
        'avatar.button.save': '保存', 'avatar.button.cancel': '取消', 'avatar.presets.planet': '星球',
    };
    return labels[key] ?? key;
} }) }));
beforeEach(() => { vi.clearAllMocks(); auth.user.avatar = '/assets/avatars/old.webp'; auth.updateAvatar.mockResolvedValue({}); });
afterEach(cleanup);

describe('统一头像选择', () => {
    it.each([undefined, '', '/avatars/default.svg'])('当前默认头像为%s时没有重复提交操作', avatar => {
        auth.user.avatar = avatar;
        render(<AvatarUpdateModal isOpen onClose={() => {}} />);
        expect(screen.getByRole('img', { name: '默认', exact: true })).toBeTruthy();
        expect(screen.queryByRole('button', { name: '使用默认头像', exact: true })).toBeNull();
        expect(screen.queryByRole('button', { name: '保存', exact: true })).toBeNull();
        expect(auth.updateAvatar).not.toHaveBeenCalled();
    });
    it('从已上传头像切换默认，保存系统默认资源并关闭', async () => {
        const close = vi.fn(); render(<AvatarUpdateModal isOpen onClose={close} />);
        fireEvent.click(screen.getByRole('button', { name: '默认', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: '保存', exact: true }));
        await waitFor(() => expect(auth.updateAvatar).toHaveBeenCalledWith('/avatars/default.svg'));
        await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
        expect(auth.uploadAvatar).not.toHaveBeenCalled();
    });
    it('选中预设后仍需确认，使用既有头像更新入口保存', async () => {
        const close = vi.fn(); render(<AvatarUpdateModal isOpen onClose={close} />);
        fireEvent.click(screen.getByRole('button', { name: '预设', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: '骰子', exact: true }));
        expect(auth.updateAvatar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '保存', exact: true }));
        await waitFor(() => expect(auth.updateAvatar).toHaveBeenCalledWith(expect.stringMatching(/^\/avatars\/.+\.svg$/)));
        await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    });
    it('上传类型校验失败仍留在选择界面，不调用服务端', () => {
        const { container } = render(<AvatarUpdateModal isOpen onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: '自行上传', exact: true }));
        fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['bad'], 'bad.txt', { type: 'text/plain' })] } });
        expect(screen.getByText('avatar.error.invalidType')).toBeTruthy();
        expect(auth.uploadAvatar).not.toHaveBeenCalled();
    });
    it('保存失败展示错误并保留重试入口，成功后才关闭', async () => {
        const close = vi.fn(); auth.updateAvatar.mockRejectedValueOnce(new Error('保存失败'));
        render(<AvatarUpdateModal isOpen onClose={close} />);
        fireEvent.click(screen.getByRole('button', { name: '默认', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: '保存', exact: true }));
        await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('保存失败'));
        expect(close).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '保存', exact: true }));
        await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    });
    it('选回当前头像后移除保存，取消不产生服务端请求', () => {
        auth.user.avatar = '/avatars/dice.svg';
        const close = vi.fn(); render(<AvatarUpdateModal isOpen onClose={close} />);
        expect(screen.queryByRole('button', { name: '保存', exact: true })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '星球', exact: true }));
        expect(screen.getByRole('button', { name: '保存', exact: true })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '骰子', exact: true }));
        expect(screen.queryByRole('button', { name: '保存', exact: true })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }));
        expect(auth.updateAvatar).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledTimes(1);
    });
});
