/* @vitest-environment happy-dom */
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateRoomModal } from '../CreateRoomModal';
import { PasswordEntryModal } from '../../common/overlays/PasswordEntryModal';
import type { GameManifestEntry } from '../../../games/manifest.types';
import type { LocalMatchPreferences } from '../../../engine/ai';
import { FANTASY_REALMS_MANIFEST } from '../../../games/fantasyrealms/manifest';
import { QIDAHEN_MANIFEST } from '../../../games/qidahen/manifest';
import { THE_GANG_MANIFEST } from '../../../games/the-gang/manifest';

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
            if (key === 'createRoom.aiThinkingTime') return 'AI 思考时长';
            if (key === 'createRoom.aiThinkingTimeHint') return '按游戏单独记住';
            if (key === 'createRoom.aiThinkingTimeSeconds') return `${options?.count} 秒`;
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
    it('纸牌帮没有保存偏好时默认按四人创建房间', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: THE_GANG_MANIFEST,
            initialPreferences: null,
        }));

        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            numPlayers: 4,
        }));
    });

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
            minimumActionDelayMs: 1000,
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

    it('首次打开默认关闭时，手动点击后会开启 AI 并显示占位设置', () => {
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
                '1': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 1000 },
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
                    minimumActionDelayMs: 1000,
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
                minimumActionDelayMs: 1000,
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
            minimumActionDelayMs: 1000,
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
                '1': { type: 'local-ai', difficulty: 'hard', minimumActionDelayMs: 1000 },
            }),
        }));
    });

    it('会按当前游戏恢复并提交 AI 思考时长', () => {
        const onConfirm = vi.fn();
        const initialPreferences: LocalMatchPreferences = {
            numPlayers: 2,
            minimumActionDelayMs: 3000,
            setupSelections: {},
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'human' },
            },
        };

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest,
            initialPreferences,
        }));

        fireEvent.click(screen.getByRole('button', { name: /加入 AI/i }));
        const select = screen.getByTestId('create-room-ai-thinking-time-select');
        expect(select).toHaveValue('3000');

        fireEvent.change(select, { target: { value: '0' } });
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            minimumActionDelayMs: 0,
            seatControllers: expect.objectContaining({
                '1': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 0 },
            }),
        }));
    });

    it('四人房开启 AI 时会默认把除房主外的座位全部设为 AI，占位可再手动取消', () => {
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
        fireEvent.click(screen.getByRole('button', { name: 'seat-3' }));
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            enableAi: true,
            numPlayers: 4,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 1000 },
                '2': { type: 'human' },
                '3': { type: 'local-ai', difficulty: 'normal', minimumActionDelayMs: 1000 },
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

    it('幻想国度切到二人变体后，应把人数按钮立即收敛到 2 人并按该 setup 提交', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: FANTASY_REALMS_MANIFEST,
            initialPreferences: null,
        }));

        const variantSelect = screen.getByTestId('setup-option-select-variant');

        expect(screen.queryByRole('button', { name: '2人' })).toBeNull();
        expect(screen.getByRole('button', { name: '3人' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '6人' })).toBeInTheDocument();

        fireEvent.change(variantSelect, { target: { value: 'duel' } });

        expect(screen.queryByRole('button', { name: '2人' })).toBeNull();
        expect(screen.queryByRole('button', { name: '3人' })).toBeNull();
        expect(screen.queryByRole('button', { name: '4人' })).toBeNull();
        expect(screen.queryByRole('button', { name: '5人' })).toBeNull();
        expect(screen.queryByRole('button', { name: '6人' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            numPlayers: 2,
            setupSelections: expect.objectContaining({
                variant: 'duel',
                expansion: 'base',
            }),
        }));
    });

    it('幻想国度标准局建房不应再提供 2 人按钮', () => {
        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            gameManifest: FANTASY_REALMS_MANIFEST,
            initialPreferences: null,
        }));

        expect(screen.queryByRole('button', { name: '2人' })).toBeNull();
        expect(screen.getByRole('button', { name: '3人' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '4人' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '5人' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '6人' })).toBeInTheDocument();
    });

    it('幻想国度重新打开建房弹窗时，扩展应默认回到基础卡组，而不是记住上次扩展', () => {
        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            gameManifest: FANTASY_REALMS_MANIFEST,
            initialPreferences: {
                numPlayers: 3,
                minimumActionDelayMs: 1000,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'human' },
                    '2': { type: 'human' },
                },
                setupSelections: {
                    variant: 'standard',
                    expansion: 'cursed-hoard-suits',
                },
            },
        }));

        expect(screen.getByTestId('setup-option-select-expansion-base')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('setup-option-select-expansion-cursed-hoard-suits')).toHaveAttribute('aria-pressed', 'false');
    });

    it('幻想国度从二人变体切回标准版后，应重新放开更高人数选项', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: FANTASY_REALMS_MANIFEST,
            initialPreferences: null,
        }));

        const variantSelect = screen.getByTestId('setup-option-select-variant');

        fireEvent.change(variantSelect, { target: { value: 'duel' } });
        expect(screen.queryByRole('button', { name: '6人' })).toBeNull();

        fireEvent.change(variantSelect, { target: { value: 'standard' } });
        expect(screen.queryByRole('button', { name: '2人' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '6人' }));
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            numPlayers: 6,
            setupSelections: expect.objectContaining({
                variant: 'standard',
                expansion: 'base',
            }),
        }));
    });

    it('幻想国度可选扩展会通过建房 setupSelections 提交出去', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: FANTASY_REALMS_MANIFEST,
            initialPreferences: null,
        }));

        expect(screen.queryByTestId('setup-option-select-expansion')).toBeNull();
        fireEvent.click(screen.getByTestId('setup-option-select-expansion-cursed-hoard-suits'));
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            setupSelections: expect.objectContaining({
                variant: 'standard',
                expansion: 'cursed-hoard-suits',
            }),
        }));
    });

    it('幻想国度扩展入口使用 tag 切片，而不是下拉框', () => {
        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            gameManifest: FANTASY_REALMS_MANIFEST,
            initialPreferences: null,
        }));

        expect(screen.queryByTestId('setup-option-select-expansion')).toBeNull();
        expect(screen.getByTestId('setup-option-select-expansion-base')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('setup-option-select-expansion-cursed-hoard-suits')).toHaveAttribute('aria-pressed', 'false');
    });

    it('七大恨建房页只保留人数与 AI 配置，剧本投票与前置项进入棋盘后完成', () => {
        const onConfirm = vi.fn();

        render(createElement(CreateRoomModal, {
            isOpen: true,
            onClose: vi.fn(),
            onConfirm,
            gameManifest: QIDAHEN_MANIFEST,
            initialPreferences: null,
        }));

        expect(screen.queryByTestId('qidahen-pregame-choice-fields')).toBeNull();
        expect(screen.queryByTestId('qidahen-pregame-choice-inline-note')).toBeNull();
        expect(screen.queryByText('开局剧本')).toBeNull();
        expect(screen.queryByTestId('setup-option-select-scenario')).toBeNull();
        expect(screen.queryByTestId('setup-option-select-shanhaiguan-1622')).toBeNull();
        expect(screen.queryByTestId('setup-option-select-post-sarhu-1619')).toBeNull();
        expect(screen.getByText('加入 AI')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '确认' }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            setupSelections: {
                qidahenInMatchScenarioVote: 'enabled',
            },
        }));
    });

    it('七大恨默认人数会按 bestPlayers 落到三人房，并带局内剧本选择模式提交', () => {
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
