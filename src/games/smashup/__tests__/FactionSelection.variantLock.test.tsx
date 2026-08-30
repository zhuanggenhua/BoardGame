import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SmashUpCore } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { FactionSelection } from '../ui/FactionSelection';
import { getVisibleFactionVariantGroups, isFactionImplementationInProgress } from '../ui/factionMeta';

vi.mock('framer-motion', () => {
    const createMotionComponent = (tag: keyof JSX.IntrinsicElements) => {
        const Component = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
            ({ children, whileHover: _whileHover, whileTap: _whileTap, layoutId: _layoutId, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.PropsWithChildren<any>, ref) =>
                React.createElement(tag, { ...props, ref }, children),
        );
        Component.displayName = `MockMotion(${tag})`;
        return Component;
    };

    return {
        motion: new Proxy({}, {
            get: (_target, key) => createMotionComponent(String(key) as keyof JSX.IntrinsicElements),
        }),
        AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const defaultValue = typeof options?.defaultValue === 'string'
                ? options.defaultValue
                : key;
            return defaultValue
                .replace(/\{\{player\}\}/g, String(options?.player ?? ''))
                .replace(/\{\{id\}\}/g, String(options?.id ?? ''))
                .replace(/\{\{count\}\}/g, String(options?.count ?? ''));
        },
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ className }: { className?: string }) => (
        <div className={className} data-testid="mock-card-preview" />
    ),
}));

function buildCore(): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['aliens', 'dinosaurs'],
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['robots_pod', 'pirates'],
            },
        },
        seatOrder: ['0', '1'],
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        teamMode: undefined,
        bases: [],
        titans: [],
        enabledExpansions: ['titans', 'diy'],
        baseDeck: [],
        baseDiscard: [],
        triggerQueue: undefined,
        turnNumber: 1,
        nextUid: 1,
        gameResult: undefined,
        factionSelection: {
            takenFactions: ['robots_pod'],
            playerSelections: {
                '0': [],
                '1': ['robots_pod'],
            },
            completedPlayers: [],
        },
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
    };
}

function renderSelection(dispatch = vi.fn(), core: SmashUpCore = buildCore()) {
    render(
        <MemoryRouter>
            <FactionSelection
                core={core}
                dispatch={dispatch}
                playerID="0"
                playerNames={{ '0': '我', '1': 'AI' }}
                playerOrder={['0', '1']}
                getPlayerOrderLabel={(playerId) => `P${Number(playerId) + 1}`}
            />
        </MemoryRouter>,
    );
    return dispatch;
}

function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: height,
    });
    act(() => {
        window.dispatchEvent(new Event('resize'));
    });
}

function searchFaction(value: string) {
    fireEvent.change(screen.getByTestId('faction-search-input'), { target: { value } });
}

describe('FactionSelection POD/旧版派系统一占用', () => {
    afterEach(() => {
        vi.clearAllMocks();
        setViewport(1024, 768);
    });

    it('别人选择 robots_pod 后，robots 组应直接显示为已占用', () => {
        renderSelection();

        expect(screen.getByText('AI 已占领')).toBeInTheDocument();
    });

    it('随机派系卡固定排在第一个，点击后直接提交随机选择命令', () => {
        const dispatch = renderSelection();
        const firstOption = document.querySelector('[data-testid^="faction-option-"]');

        expect(firstOption).toHaveAttribute('data-testid', 'faction-option-random');
        expect(screen.getByTestId('faction-option-random')).toHaveAttribute('aria-label', 'ui.random_faction_name');

        fireEvent.click(screen.getByTestId('faction-option-random'));

        expect(dispatch).toHaveBeenCalledWith('su:select_random_faction', {});
        expect(screen.queryByTestId('faction-detail-panel')).not.toBeInTheDocument();
    });

    it('搜索派系时隐藏随机派系卡，避免它绕过当前搜索结果', () => {
        renderSelection();

        searchFaction('pirates');

        expect(screen.queryByTestId('faction-option-random')).not.toBeInTheDocument();
        expect(screen.getByTestId('faction-option-pirates')).toBeInTheDocument();
    });

    it('别人选择 robots_pod 后，打开 robots 详情不应再出现确认选择按钮', () => {
        renderSelection();

        fireEvent.click(screen.getByTestId('faction-option-robots'));

        expect(screen.queryByTestId('faction-confirm-button')).not.toBeInTheDocument();
        expect(screen.getByText('ui.taken_by_other')).toBeInTheDocument();
    });

    it('只有已占用列表残留但玩家真实未选时，不应把 robots 组锁成别人已占用', () => {
        const core = buildCore();
        core.factionSelection!.takenFactions = ['robots_pod'];
        core.factionSelection!.playerSelections = {
            '0': [],
            '1': [],
        };

        renderSelection(vi.fn(), core);

        expect(screen.queryByText('AI 已占领')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('faction-option-robots'));

        expect(screen.getByTestId('faction-confirm-button')).toBeInTheDocument();
        expect(screen.queryByText('ui.taken_by_other')).not.toBeInTheDocument();
    });

    it('玩家状态条应固定在底部覆盖层，避免挤压候选卡面', () => {
        renderSelection();

        const rail = screen.getByTestId('faction-selection-player-rail');
        const currentPlayerCard = screen.getByTestId('faction-selection-player-card-0');

        expect(String(rail.className)).toContain('absolute');
        expect(String(rail.className)).toContain('bottom-0');
        expect(String(currentPlayerCard.className)).not.toContain('scale-110');
    });

    it('玩家状态条遇到已写入但未接入选择页的派系时，不应显示问号', () => {
        const core = buildCore();
        core.factionSelection!.takenFactions = [SMASHUP_FACTION_IDS.ITTY_CRITTERS];
        core.factionSelection!.playerSelections = {
            '0': [],
            '1': [SMASHUP_FACTION_IDS.ITTY_CRITTERS],
        };

        renderSelection(vi.fn(), core);

        const aiPlayerCard = screen.getByTestId('faction-selection-player-card-1');
        expect(aiPlayerCard.textContent).not.toContain('?');
    });

    it('超紧凑横屏仍应显示玩家状态条，并默认保留已锁定派系上下文', () => {
        setViewport(800, 450);
        renderSelection();

        expect(screen.getByTestId('faction-selection-player-rail')).toBeInTheDocument();
        expect(String(screen.getByTestId('faction-selection-player-card-0').className)).toContain('w-[128px]');
        expect(screen.getByTestId('faction-option-robots')).toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-available')).not.toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-all')).not.toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-taken')).not.toBeInTheDocument();
    });

    it('移动横屏候选派系卡框应有显式高度，兼容旧 WebView', () => {
        setViewport(800, 400);
        renderSelection();

        const option = screen.getByTestId('faction-option-robots');
        const frame = option.querySelector<HTMLElement>('.aspect-\\[0\\.727\\]');

        expect(frame?.style.width).toBe('136px');
        expect(frame?.style.height).toBe(`${136 / 0.727}px`);
    });

    it('桌面高密度候选池应提供搜索入口，但不提供状态过滤按钮', () => {
        setViewport(1440, 900);
        renderSelection();

        const searchToolbar = screen.getByTestId('faction-filter-toolbar');
        const searchLeadingIcon = screen.getByTestId('faction-search-leading-icon');

        expect(String(searchToolbar.className)).toContain('sticky');
        expect(String(searchLeadingIcon.className)).toContain('inset-y-0');
        expect(String(searchLeadingIcon.className)).toContain('items-center');
        expect(searchLeadingIcon.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 20 20');
        expect(screen.getByTestId('faction-search-input')).toBeInTheDocument();
        expect(screen.getByTestId('faction-option-robots')).toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-available')).not.toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-all')).not.toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-taken')).not.toBeInTheDocument();
    });

    it('双人宽屏旧布局也不应关闭搜索，且不提供状态过滤按钮', () => {
        setViewport(1600, 900);
        renderSelection();

        expect(screen.getByTestId('faction-filter-toolbar')).toBeInTheDocument();
        expect(screen.getByTestId('faction-search-input')).toBeInTheDocument();
        expect(String(screen.getByTestId('faction-selection-player-card-0').className)).not.toContain('w-[102px]');
        expect(String(screen.getByTestId('faction-selection-player-card-0').className)).not.toContain('w-[112px]');
        expect(screen.getByTestId('faction-option-robots')).toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-available')).not.toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-all')).not.toBeInTheDocument();
        expect(screen.queryByTestId('faction-filter-taken')).not.toBeInTheDocument();

        const searchInput = screen.getByTestId('faction-search-input');
        fireEvent.change(searchInput, { target: { value: 'pirates' } });

        expect(screen.getByTestId('faction-option-pirates')).toBeInTheDocument();
        expect(screen.queryByTestId('faction-option-ninjas')).not.toBeInTheDocument();
    });

    it('搜索应按派系 id 或名称过滤候选列表', () => {
        setViewport(800, 450);
        renderSelection();

        const searchInput = screen.getByTestId('faction-search-input');
        fireEvent.change(searchInput, { target: { value: 'pirates' } });

        expect(screen.getByTestId('faction-option-pirates')).toBeInTheDocument();
        expect(screen.queryByTestId('faction-option-ninjas')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('faction-search-clear'));

        expect(screen.getByTestId('faction-option-ninjas')).toBeInTheDocument();
    });

    it('DIY 角标只出现在真实 DIY 派系候选卡上', () => {
        renderSelection();

        searchFaction('huluwawa');
        expect(screen.getByTestId('faction-diy-badge-huluwawa')).toHaveTextContent('DIY');

        searchFaction('paladins');
        expect(screen.queryByTestId('faction-diy-badge-paladins')).not.toBeInTheDocument();

        searchFaction('round_table_knights');
        expect(screen.queryByTestId('faction-diy-badge-round_table_knights')).not.toBeInTheDocument();

        searchFaction('goblins');
        expect(screen.queryByTestId('faction-diy-badge-goblins')).not.toBeInTheDocument();

        searchFaction('diy_killers');
        expect(screen.queryByTestId('faction-diy-badge-diy_killers')).not.toBeInTheDocument();

        searchFaction('diy_clowns');
        expect(screen.queryByTestId('faction-diy-badge-diy_clowns')).not.toBeInTheDocument();
    });

    it('默认列表应保留上下文，并将实施中派系统一排到末尾', () => {
        renderSelection();

        const orderedIds = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid^="faction-option-"]'),
        ).map((node) => node.dataset.testid?.replace('faction-option-', '') ?? '');
        expect(orderedIds[0]).toBe('random');
        const orderedFactionIds = orderedIds.filter((id) => id !== 'random');
        const originalOrderedIds = getVisibleFactionVariantGroups('zh-CN').map((group) => group.groupId);
        const inProgressIds = originalOrderedIds.filter((groupId) => isFactionImplementationInProgress(groupId));
        const expectedOrderedIds = [
            ...originalOrderedIds.filter((groupId) => !isFactionImplementationInProgress(groupId)),
            ...inProgressIds,
        ];

        expect(inProgressIds).toEqual(expect.arrayContaining([
            SMASHUP_FACTION_IDS.ANANSI_TALES,
            SMASHUP_FACTION_IDS.GRIMMS_FAIRY_TALES,
            SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES,
            SMASHUP_FACTION_IDS.ANCIENT_INCAS,
        ]));
        expect(inProgressIds).not.toEqual(expect.arrayContaining([
            SMASHUP_FACTION_IDS.KUNG_FU_FIGHTERS,
            SMASHUP_FACTION_IDS.VIGILANTES,
            SMASHUP_FACTION_IDS.TRUCKERS,
            SMASHUP_FACTION_IDS.DISCO_DANCERS,
        ]));
        const virtualWindow = screen.getByTestId('faction-virtual-window');
        expect(Number(virtualWindow.dataset.totalFactions)).toBe(expectedOrderedIds.length);
        expect(Number(virtualWindow.dataset.totalOptions)).toBe(expectedOrderedIds.length + 1);
        expect(Number(virtualWindow.dataset.renderedFactions)).toBeLessThan(expectedOrderedIds.length);
        expect(orderedFactionIds).toEqual(expectedOrderedIds.slice(0, orderedFactionIds.length));
        expect(screen.getByTestId('faction-option-robots')).toBeInTheDocument();
    });

    it('关闭 diy 扩展后不显示 DIY 派系', () => {
        const core = buildCore();
        core.enabledExpansions = ['titans'];

        renderSelection(vi.fn(), core);

        expect(screen.queryByTestId('faction-option-huluwawa')).not.toBeInTheDocument();
        searchFaction('paladins');
        expect(screen.getByTestId('faction-option-paladins')).toBeInTheDocument();
        expect(getVisibleFactionVariantGroups('zh-CN', ['titans']).map(group => group.groupId))
            .not.toContain(SMASHUP_FACTION_IDS.HULUWAWA);
        expect(getVisibleFactionVariantGroups('zh-CN', ['titans']).map(group => group.groupId))
            .toContain(SMASHUP_FACTION_IDS.PALADINS);
    });

    it('带特有机制的派系详情应显示机制规则，普通派系不显示', () => {
        renderSelection();

        fireEvent.click(screen.getByTestId('faction-option-cowboys'));

        expect(screen.getByTestId('faction-mechanic-rules')).toBeInTheDocument();
        expect(screen.getByTestId('faction-mechanic-rule')).toBeInTheDocument();
        expect(screen.getByText('mechanics.duel.title')).toBeInTheDocument();
        expect(screen.queryByText('mechanics.bury.title')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('faction-detail-close'));
        fireEvent.click(screen.getByTestId('faction-option-aliens'));

        expect(screen.queryByTestId('faction-mechanic-rules')).not.toBeInTheDocument();
    });
});
