/* @vitest-environment happy-dom */
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateRoomModal } from '../CreateRoomModal';
import { PasswordEntryModal } from '../../common/overlays/PasswordEntryModal';
import type { GameManifestEntry } from '../../../games/manifest.types';
import type { LocalMatchPreferences } from '../../../engine/ai';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === 'createRoom.enabled') return 'Enabled';
            if (key === 'createRoom.disabled') return 'Disabled';
            if (key === 'createRoom.enableRoomAi') return '加入 AI';
            if (key === 'ai.difficulty') return '难度';
            if (key === 'ai.difficulties.easy') return '简单';
            if (key === 'ai.difficulties.normal') return '普通';
            if (key === 'ai.difficulties.hard') return '困难';
            if (key === 'ai.difficulties.expert') return '专家';
            if (key === 'actions.cancel') return '取消';
            if (key === 'createRoom.confirm') return '确认';
            if (key === 'button.processing') return '处理中';
            if (key === 'createRoom.title') return '创建房间';
            if (key === 'createRoom.roomName') return '房间名';
            if (key === 'createRoom.roomNameHint') return '可选';
            if (key === 'createRoom.roomNamePlaceholder') return '请输入';
            if (key === 'createRoom.password') return '密码';
            if (key === 'createRoom.passwordHint') return '可选';
            if (key === 'createRoom.passwordPlaceholder') return '请输入';
            if (key === 'createRoom.retention') return '保留时长';
            if (key === 'createRoom.retentionHint') return '可选';
            if (key.startsWith('createRoom.retentionOptions.')) return key;
            if (key === 'createRoom.occupiedSeats') return 'AI 占位';
            if (key === 'createRoom.occupiedSeatsHint') return '选择 AI 座位';
            if (key === 'createRoom.ownerSeatUnit') return `seat-${options?.seat}-owner`;
            if (key === 'createRoom.occupiedSeatUnit') return `seat-${options?.seat}`;
            return key;
        },
    }),
}));

const gameManifest: GameManifestEntry = {
    id: 'dicethrone',
    type: 'game',
    enabled: true,
    titleKey: 'games.dicethrone.title',
    descriptionKey: 'games.dicethrone.description',
    category: 'dice',
    playersKey: 'games.dicethrone.players',
    icon: '🎲',
    allowLocalMode: true,
    playerOptions: [2],
    ai: {
        capture: true,
        localAi: true,
        remoteAi: true,
    },
};

describe('CreateRoomModal AI default state', () => {
    it('没有保存偏好时，创建房间 AI 默认关闭', () => {
        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            gameManifest,
            initialPreferences: null,
        }));

        expect(screen.getByText('Disabled')).toBeInTheDocument();
        expect(screen.queryByText('AI 占位')).toBeNull();
    });

    it('有已保存 AI 偏好时，打开弹窗会恢复为开启', () => {
        const initialPreferences: LocalMatchPreferences = {
            numPlayers: 2,
            setupSelections: {},
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        };

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            gameManifest,
            initialPreferences,
        }));

        expect(screen.getByText('Enabled')).toBeInTheDocument();
        expect(screen.getByText('AI 占位')).toBeInTheDocument();
    });

    it('首次打开默认关闭时，手动点击后仍可开启 AI', () => {
        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            gameManifest,
            initialPreferences: null,
        }));

        fireEvent.click(screen.getByRole('button', { name: /加入 AI/i }));

        expect(screen.getByText('Enabled')).toBeInTheDocument();
        expect(screen.getByText('AI 占位')).toBeInTheDocument();
    });

    it('房间密码支持右侧眼睛按钮切换显隐', () => {
        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            gameManifest,
            initialPreferences: null,
        }));

        const roomNameInput = screen.getByTestId('create-room-name-input');
        const passwordInput = screen.getByTestId('create-room-password-input');
        const passwordToggle = screen.getByTestId('create-room-password-toggle');

        expect(roomNameInput).toHaveAttribute('name', 'roomName');
        expect(roomNameInput).toHaveAttribute('autocomplete', 'off');
        expect(passwordInput).toHaveAttribute('name', 'roomPassword');
        expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
        expect(passwordInput).toHaveAttribute('type', 'password');
        fireEvent.click(passwordToggle);
        expect(passwordInput).toHaveAttribute('type', 'text');
    });

    it('开启 AI 后默认使用普通难度提交本地 AI 座位', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest,
            initialPreferences: null,
        }));

        fireEvent.click(screen.getByRole('button', { name: /加入 AI/i }));
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            enableAi: true,
            seatControllers: expect.objectContaining({
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal' },
            }),
        }));
    });

    it('切换难度后会同步到本地 AI 座位', () => {
        const onConfirm = vi.fn();
        const initialPreferences: LocalMatchPreferences = {
            numPlayers: 2,
            setupSelections: {},
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal' },
            },
        };

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest,
            initialPreferences,
        }));

        fireEvent.click(screen.getByRole('button', { name: '困难' }));
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            seatControllers: expect.objectContaining({
                '1': { type: 'local-ai', difficulty: 'hard' },
            }),
        }));
    });

    it('加入私密房间密码弹窗使用独立字段语义，避免浏览器误填登录密码', () => {
        render(createElement(PasswordEntryModal, {
            open: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
        }));

        const passwordInput = screen.getByTestId('room-password-input');

        expect(passwordInput).toHaveAttribute('name', 'roomPassword');
        expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
    });
});
