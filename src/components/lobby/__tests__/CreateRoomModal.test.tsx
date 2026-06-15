/* @vitest-environment happy-dom */
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateRoomModal } from '../CreateRoomModal';
import { PasswordEntryModal } from '../../common/overlays/PasswordEntryModal';
import type { GameManifestEntry } from '../../../games/manifest.types';
import type { LocalMatchPreferences } from '../../../engine/ai';
import { QIDAHEN_MANIFEST } from '../../../games/qidahen/manifest';

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
            if (key === 'createRoom.playerCountUnit') return `${options?.count}人`;
            if (key === 'createRoom.occupiedSeats') return 'AI 占位';
            if (key === 'createRoom.occupiedSeatsHint') return '选择 AI 座位';
            if (key === 'createRoom.ownerSeatUnit') return `seat-${options?.seat}-owner`;
            if (key === 'createRoom.occupiedSeatUnit') return `seat-${options?.seat}`;
            if (key === 'createRoom.aiManualFactionSelection') return '玩家选择 AI 派系';
            if (key === 'setup.scenario.label') return '开局剧本';
            if (key === 'setup.scenario.postSarhu1619') return '剧本一：萨尔浒战后（1619）';
            if (key === 'setup.scenario.shanhaiguan1622') return '剧本二：山海关之议（1622）';
            if (key === 'setup.scenario.dingmaoRebellion1627') return '二人剧本：丁卯胡乱（1627）';
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
        expect(screen.getByRole('checkbox', { name: /玩家选择 AI 派系/i })).not.toBeChecked();
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

    it('勾选手动选派系后会写入 AI 座位配置', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest,
            initialPreferences: null,
        }));

        fireEvent.click(screen.getByRole('button', { name: /加入 AI/i }));
        fireEvent.click(screen.getByRole('checkbox', { name: /玩家选择 AI 派系/i }));
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            enableAi: true,
            seatControllers: expect.objectContaining({
                '1': {
                    type: 'local-ai',
                    difficulty: 'normal',
                    manualSetupSelection: true,
                    manualFactionSelection: true,
                },
            }),
        }));
    });

    it('initialPreferences 只提供 manualSetupSelection 时，也应正确回显手动前置选择开关', () => {
        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            gameManifest,
            initialPreferences: {
                numPlayers: 2,
                setupSelections: {},
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', difficulty: 'normal', manualSetupSelection: true },
                },
            },
        }));

        expect(screen.getByRole('checkbox', { name: /玩家选择 AI 派系/i })).toBeChecked();
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

    it('四人房开启 AI 时会保留显式真人空座，不把第三座补成 AI', () => {
        const onConfirm = vi.fn();
        const fourPlayerManifest: GameManifestEntry = {
            ...gameManifest,
            playerOptions: [2, 4],
        };

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: fourPlayerManifest,
            initialPreferences: null,
        }));

        fireEvent.click(screen.getByRole('button', { name: '4人' }));
        fireEvent.click(screen.getByRole('button', { name: /加入 AI/i }));
        fireEvent.click(screen.getByRole('button', { name: 'seat-4' }));
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            enableAi: true,
            numPlayers: 4,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal' },
                '2': { type: 'human' },
                '3': { type: 'local-ai', difficulty: 'normal' },
            },
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

    it('七大恨建房页不再提供剧本预选，而是只提示局内完成剧本介绍、投票与前置项', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: QIDAHEN_MANIFEST,
            initialPreferences: null,
        }));

        expect(screen.getByTestId('qidahen-pregame-choice-fields')).toBeInTheDocument();
        expect(screen.getByTestId('qidahen-pregame-choice-inline-note')).toBeInTheDocument();
        expect(screen.queryByText('开局剧本')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            setupSelections: {
                qidahenInMatchScenarioVote: 'enabled',
            },
        }));
    });

    it('七大恨默认人数会按 bestPlayers 落到三人房，并带局内剧本投票模式提交', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: QIDAHEN_MANIFEST,
            initialPreferences: null,
        }));

        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            numPlayers: 3,
            setupSelections: expect.objectContaining({
                qidahenInMatchScenarioVote: 'enabled',
            }),
        }));
    });

    it('七大恨仍允许手动切到二人房，但不再依赖建房页先选二人剧本', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: QIDAHEN_MANIFEST,
            initialPreferences: null,
        }));

        fireEvent.click(screen.getByRole('button', { name: '2人' }));
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            numPlayers: 2,
            setupSelections: expect.objectContaining({
                qidahenInMatchScenarioVote: 'enabled',
            }),
        }));
    });
});
