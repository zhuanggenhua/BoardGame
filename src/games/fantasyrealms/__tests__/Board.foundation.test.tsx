/* @vitest-environment happy-dom */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import Board from '../Board';
import type { FantasyRealmsCore } from '../domain';
import zhCNLocale from '../../../../public/locales/zh-CN/game-fantasyrealms.json';
import {
    FANTASY_REALMS_DUEL_DISCARD_END_THRESHOLD,
    FANTASY_REALMS_HAND_CARD_SLOTS,
    HAND_CARDS,
    PUBLIC_CARDS,
} from '../foundation';

type TranslationTree = Record<string, string | TranslationTree>;

function resolveTranslation(tree: TranslationTree, key: string): string | undefined {
    return key.split('.').reduce<string | TranslationTree | undefined>((value, segment) => {
        if (!value || typeof value === 'string') {
            return undefined;
        }
        return value[segment];
    }, tree) as string | undefined;
}

function interpolate(template: string, options?: Record<string, unknown>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => String(options?.[token] ?? ''));
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const resolved = resolveTranslation(zhCNLocale as TranslationTree, key);
            return typeof resolved === 'string' ? interpolate(resolved, options) : key;
        },
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

function makeCore(overrides: Partial<FantasyRealmsCore> = {}): FantasyRealmsCore {
    return {
        playerIds: ['0', '1'],
        currentPlayer: '0',
        turn: 3,
        stage: 'draw',
        drawPile: [],
        discardPile: PUBLIC_CARDS.slice(0, 3).map((card) => ({ ...card })),
        players: {
            '0': {
                id: '0',
                name: '玩家1',
                hand: HAND_CARDS.slice(0, 4).map((card) => ({ ...card })),
                score: 29,
                scoreBreakdown: [
                    { label: '有效基础分', value: 14 },
                    { label: '总加分', value: 15 },
                    { label: '总减分', value: 0 },
                ],
            },
            '1': {
                id: '1',
                name: '玩家2',
                hand: HAND_CARDS.slice(0, 2).map((card) => ({ ...card })),
                score: 17,
                scoreBreakdown: [
                    { label: '有效基础分', value: 17 },
                    { label: '总加分', value: 0 },
                    { label: '总减分', value: 0 },
                ],
            },
        },
        focusCardId: PUBLIC_CARDS[0]!.id,
        ...overrides,
    };
}

function renderBoard(
    core: FantasyRealmsCore = makeCore(),
    options?: {
        dispatch?: ReturnType<typeof vi.fn>;
        playerID?: string | null;
        matchData?: Array<{ id: number | string; name: string; isConnected?: boolean }>;
    },
) {
    return render(
        <Board
            G={{ core, sys: {} } as MatchState<Record<string, unknown>>}
            dispatch={options?.dispatch ?? (() => {})}
            playerID={options && 'playerID' in options ? options.playerID ?? undefined : '0'}
            matchData={options?.matchData ?? [{ id: 0, name: '测试玩家', isConnected: true }]}
            isConnected
        />,
    );
}

function withViewport(width: number, height: number, run: () => void) {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
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

    try {
        run();
    } finally {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: originalInnerWidth,
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            writable: true,
            value: originalInnerHeight,
        });
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
    }
}

describe('FantasyRealms Board foundation', () => {
    it('紧凑横屏布局会收掉回合区重复动作按钮，并避免重复渲染回合区', () => {
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1024,
        });

        try {
            renderBoard();

            expect(screen.getByTestId('fantasyrealms-compact-layout')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-table')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-topbar')).toBeInTheDocument();
            expect(screen.getAllByRole('button', { name: /拿取弃牌/ })).toHaveLength(3);
        } finally {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                writable: true,
                value: originalInnerWidth,
            });
            act(() => {
                window.dispatchEvent(new Event('resize'));
            });
        }
    });

    it('紧凑横屏布局不再切到另一套牌库面板，而是继续复用 live 牌桌对象', () => {
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1024,
        });

        try {
            renderBoard();
            expect(screen.getByTestId('fantasyrealms-compact-layout')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-deck')).toBeInTheDocument();
            expect(screen.queryByText('牌库')).not.toBeInTheDocument();
        } finally {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                writable: true,
                value: originalInnerWidth,
            });
            act(() => {
                window.dispatchEvent(new Event('resize'));
            });
        }
    });

    it('竖屏视口不会误进紧凑横屏牌桌分支', () => {
        withViewport(768, 1024, () => {
            renderBoard();

            expect(screen.queryByTestId('fantasyrealms-compact-layout')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-table')).toBeInTheDocument();
        });
    });

    it('紧凑横屏布局会保留同一张牌桌主壳，只把焦点压到次级区', () => {
        const originalInnerWidth = window.innerWidth;
        const originalInnerHeight = window.innerHeight;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1024,
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            writable: true,
            value: 768,
        });

        try {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2', '3', '4', '5'],
                discardPile: [],
                focusCardId: null,
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 42,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 30 },
                            { label: '总加分', value: 12 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 35,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 25 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 33,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 22 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '3': {
                        id: '3',
                        name: '玩家4',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 31,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 20 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '4': {
                        id: '4',
                        name: '玩家5',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 29,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 18 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '5': {
                        id: '5',
                        name: '玩家6',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 27,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 17 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            const compactLayout = screen.getByTestId('fantasyrealms-compact-layout');
            const liveTable = screen.getByTestId('fantasyrealms-live-table');
            const directChildren = Array.from(compactLayout.children);

            expect(directChildren[0]).toBe(liveTable);
            expect(directChildren).toHaveLength(1);
            expect(screen.getByTestId('fantasyrealms-live-topbar')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-center-row')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-compact-focus-rail')).not.toBeInTheDocument();
            expect(screen.queryByText('当前焦点')).not.toBeInTheDocument();
        } finally {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                writable: true,
                value: originalInnerWidth,
            });
            Object.defineProperty(window, 'innerHeight', {
                configurable: true,
                writable: true,
                value: originalInnerHeight,
            });
            act(() => {
                window.dispatchEvent(new Event('resize'));
            });
        }
    });

    it('低高度横屏仍保留同一张牌桌主壳，只在外层使用紧凑横屏包装', () => {
        const originalInnerWidth = window.innerWidth;
        const originalInnerHeight = window.innerHeight;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 844,
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            writable: true,
            value: 390,
        });

        try {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2', '3'],
                discardPile: [],
                focusCardId: null,
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 42,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 30 },
                            { label: '总加分', value: 12 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 35,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 25 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 33,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 22 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '3': {
                        id: '3',
                        name: '玩家4',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 31,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 20 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            const compactLayout = screen.getByTestId('fantasyrealms-compact-layout');
            const directChildren = Array.from(compactLayout.children);
            const liveTable = screen.getByTestId('fantasyrealms-live-table');

            expect(compactLayout.className).toContain('fr-compact-layout--tight-landscape');
            expect(directChildren[0]).toBe(liveTable);
            expect(directChildren).toHaveLength(1);
            expect(screen.getByTestId('fantasyrealms-live-topbar')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-center-row')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-compact-focus-rail')).not.toBeInTheDocument();
            expect(screen.queryByText('当前焦点')).not.toBeInTheDocument();
        } finally {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                writable: true,
                value: originalInnerWidth,
            });
            Object.defineProperty(window, 'innerHeight', {
                configurable: true,
                writable: true,
                value: originalInnerHeight,
            });
            act(() => {
                window.dispatchEvent(new Event('resize'));
            });
        }
    });

    it('首屏使用牌桌对象，不重复显示标题或连接态', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                drawPile: HAND_CARDS.slice(4, 6).map((card) => ({ ...card })),
            }));

            expect(screen.queryByRole('heading', { name: '幻想国度' })).not.toBeInTheDocument();
            expect(screen.queryByText('已连接')).not.toBeInTheDocument();
            expect(screen.queryByText('公开弃牌堆')).not.toBeInTheDocument();
            expect(screen.queryByText('测试玩家的手牌')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-center-row')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toBeInTheDocument();
        });
    });

    it('桌面端使用 current 中央承接构图，而不是旧三栏分屏', () => {
        const originalInnerWidth = window.innerWidth;
        const originalInnerHeight = window.innerHeight;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1920,
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            writable: true,
            value: 1080,
        });

        try {
            renderBoard();

            const liveTable = screen.getByTestId('fantasyrealms-live-table');
            const topbar = screen.getByTestId('fantasyrealms-live-topbar');
            const centerRow = screen.getByTestId('fantasyrealms-live-center-row');
            const handZone = screen.getByTestId('fantasyrealms-live-hand-zone');
            const handRow = screen.getByTestId('fantasyrealms-hand-row');
            const discardRow = screen.getByTestId('fantasyrealms-discard-row');
            const discardCards = within(discardRow).getAllByTestId('fantasyrealms-card');
            const handCards = within(handRow).getAllByTestId('fantasyrealms-card');

            expect(liveTable.className).toContain('fr-live-table');
            expect(topbar).toBeInTheDocument();
            expect(centerRow).toBeInTheDocument();
            expect(handZone).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-table-dock')).not.toBeInTheDocument();
            expect(handRow.className).toContain('fr-card-row--live-hand-zone');
            expect(discardRow.className).toContain('fr-discard-row--live-center');
            expect(discardCards[0]!.closest('button')?.className).toContain('fr-card-button--live-center');
            expect(handCards[0]!.closest('button')?.className).toContain('fr-card-button--live-hand');
        } finally {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                writable: true,
                value: originalInnerWidth,
            });
            Object.defineProperty(window, 'innerHeight', {
                configurable: true,
                writable: true,
                value: originalInnerHeight,
            });
            act(() => {
                window.dispatchEvent(new Event('resize'));
            });
        }
    });

    it('桌面 live 顶部保留左上牌库、居中状态轴和右上分数窄带三段锚点', () => {
        withViewport(1920, 1080, () => {
            renderBoard();

            const topbar = screen.getByTestId('fantasyrealms-live-topbar');
            const deckPanel = screen.getByTestId('fantasyrealms-live-deck');
            const statusStrip = screen.getByTestId('fantasyrealms-live-status-strip');
            const scoreStrip = screen.getByTestId('fantasyrealms-live-score-strip');
            const scoreBand = screen.getByTestId('fantasyrealms-live-score-band');

            expect(topbar).toContainElement(deckPanel);
            expect(topbar).toContainElement(statusStrip);
            expect(topbar).toContainElement(scoreStrip);
            expect(scoreStrip).toContainElement(scoreBand);
            expect(within(statusStrip).getByText('你的回合')).toBeInTheDocument();
            expect(within(statusStrip).getByLabelText('结束进度')).toHaveTextContent(/^\d+\/\d+$/);
            expect(within(statusStrip).queryByText('摸牌')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-action-zone')).toHaveAttribute('data-anchor', 'right-lower-dock');
            expect(screen.getByTestId('fantasyrealms-live-action-button')).toHaveTextContent('选择一张牌获取');
            expect(screen.getByTestId('fantasyrealms-live-action-button')).toBeDisabled();
            expect(screen.queryByText('公开弃牌堆')).not.toBeInTheDocument();
        });
    });

    it('桌面 live 等待态只保留当前玩家名，不再额外挂一个等待 chip', () => {
        withViewport(1920, 1080, () => {
            renderBoard(makeCore({
                currentPlayer: '1',
            }), {
                playerID: '0',
                matchData: [
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '第二玩家', isConnected: true },
                ],
            });

            const statusStrip = screen.getByTestId('fantasyrealms-live-status-strip');
            expect(within(statusStrip).getByText('第二玩家')).toBeInTheDocument();
            expect(within(statusStrip).queryByText('等待')).not.toBeInTheDocument();
            expect(within(statusStrip).queryByText('摸牌')).not.toBeInTheDocument();
            expect(within(statusStrip).queryByText('弃牌')).not.toBeInTheDocument();
        });
    });

    it('桌面 live 的手牌区按真实手牌数居中展示，不再渲染左侧空槽', () => {
        withViewport(1920, 1080, () => {
            renderBoard();

            const discardRow = screen.getByTestId('fantasyrealms-discard-row');
            const handRow = screen.getByTestId('fantasyrealms-hand-row');

            expect(within(discardRow).getAllByTestId('fantasyrealms-card')).toHaveLength(3);
            expect(handRow).toHaveAttribute('data-slot-count', String(FANTASY_REALMS_HAND_CARD_SLOTS));
            expect(handRow).toHaveAttribute('data-visible-count', '4');
            expect(within(handRow).getAllByTestId('fantasyrealms-card')).toHaveLength(4);
            expect(within(handRow).queryAllByTestId('fantasyrealms-card-slot-empty')).toHaveLength(0);
            expect(within(handRow).getAllByRole('button')[0]).toHaveStyle({ gridColumn: '2' });
        });
    });

    it('多人拿弃牌进入弃牌阶段时，手牌区会显示第 8 张临时手牌', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2'],
                currentPlayer: '0',
                stage: 'discard',
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.concat(PUBLIC_CARDS[0]!).map((card) => ({ ...card })),
                        score: 42,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 30 },
                            { label: '总加分', value: 12 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.slice(0, 6).map((card) => ({ ...card })),
                        score: 35,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 25 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.slice(1, 6).map((card) => ({ ...card })),
                        score: 33,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 22 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            const handRow = screen.getByTestId('fantasyrealms-hand-row');
            expect(handRow).toHaveAttribute('data-slot-count', '8');
            expect(handRow).toHaveAttribute('data-visible-count', '8');
            expect(within(handRow).getAllByTestId('fantasyrealms-card')).toHaveLength(8);
            expect(within(handRow).queryAllByTestId('fantasyrealms-card-slot-empty')).toHaveLength(0);
        });
    });

    it('桌面 live 只剩 1 张手牌时会回到中线，而不是挂在左下角', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                discardPile: PUBLIC_CARDS.slice(0, 1).map((card) => ({ ...card })),
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: [HAND_CARDS[0]!].map((card) => ({ ...card })),
                        score: 7,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 7 },
                            { label: '总加分', value: 0 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.slice(1, 5).map((card) => ({ ...card })),
                        score: 11,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 11 },
                            { label: '总加分', value: 0 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            const handRow = screen.getByTestId('fantasyrealms-hand-row');
            const onlyHandButton = within(handRow).getAllByRole('button')[0]!;
            expect(handRow).toHaveAttribute('data-visible-count', '1');
            expect(onlyHandButton).toHaveStyle({ gridColumn: '4' });
        });
    });

    it('手牌与焦点区使用正式 atlas 卡图而不是程序文字卡', () => {
        renderBoard();

        const handRow = screen.getByTestId('fantasyrealms-hand-row');
        const handCards = within(handRow).getAllByTestId('fantasyrealms-card');
        const focusPreview = screen.getByTestId('fantasyrealms-focus-preview');

        expect(handCards[0]).toHaveAttribute('data-card-renderer', 'atlas');
        expect(handCards[0]).toHaveAttribute('data-atlas-card-id', HAND_CARDS[0]!.id);
        expect(handCards[0].style.backgroundSize).toBe('1000% 700%');
        expect(handCards[0].style.backgroundPosition).toBe('77.778% 33.333%');
        expect(handCards[0].getAttribute('style')).toContain('fantasyrealms-base-cards-atlas');

        expect(focusPreview).toHaveAttribute('data-card-renderer', 'atlas');
        expect(focusPreview).toHaveAttribute('data-atlas-card-id', PUBLIC_CARDS[0]!.id);
        expect(focusPreview.getAttribute('style')).toContain('fantasyrealms-base-cards-atlas');
    });

    it('桌面 live 页只保留最小动作与数值，不再显示描述性标题和说明', () => {
        withViewport(1440, 1024, () => {
            renderBoard();

            expect(screen.getByText('当前总分')).toBeInTheDocument();
            expect(screen.queryByText('公开弃牌堆')).not.toBeInTheDocument();
            expect(screen.queryByText(/的手牌$/)).not.toBeInTheDocument();
            expect(screen.queryByText('官方总分')).not.toBeInTheDocument();
            expect(screen.getByText(`3/${FANTASY_REALMS_DUEL_DISCARD_END_THRESHOLD}`)).toBeInTheDocument();
            expect(screen.queryByText('有效基础分')).not.toBeInTheDocument();
            expect(screen.queryByText(/当前已按双人变体与官方计分实时结算/)).not.toBeInTheDocument();
            expect(screen.queryByText('当前焦点')).not.toBeInTheDocument();
            expect(screen.queryByText('结束进度')).not.toBeInTheDocument();
            expect(screen.queryByText(/第 \d+ 名/)).not.toBeInTheDocument();
        });
    });

    it('桌面端开局阶段只保留极短动作标签，不再展示阶段说明或面板标题', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                drawPile: HAND_CARDS.slice(4, 6).map((card) => ({ ...card })),
            }));

            expect(screen.getByTestId('fantasyrealms-live-action-button')).toHaveTextContent('选择一张牌获取');
            expect(screen.getByTestId('fantasyrealms-live-action-button')).toBeDisabled();
            expect(screen.getByTestId('fantasyrealms-live-deck')).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-deck-cue')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-action-zone')).toHaveAttribute('data-anchor', 'right-lower-dock');
            expect(screen.queryByText('牌库')).not.toBeInTheDocument();
            expect(screen.queryByText('回合')).not.toBeInTheDocument();
            const discardButtons = screen.getAllByRole('button', { name: /拿取弃牌/ });
            expect(discardButtons[0]).toHaveAttribute('data-action-state', 'take');
        });
    });

    it('紧凑横屏布局回合区只保留短状态，不再常驻整句步骤说明', () => {
        withViewport(1024, 768, () => {
            renderBoard();

            expect(screen.getByText('R3')).toBeInTheDocument();
            expect(screen.getByText('你的回合')).toBeInTheDocument();
        });
    });

    it('紧凑横屏布局的空弃牌区与空手牌区只保留短计数和短空态，不再叠解释正文', () => {
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                discardPile: [],
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: [],
                        score: 0,
                        scoreBreakdown: [],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: [],
                        score: 0,
                        scoreBreakdown: [],
                    },
                } as any,
            }));

            expect(screen.getByText(`0/${FANTASY_REALMS_DUEL_DISCARD_END_THRESHOLD}`)).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-discard-empty')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-hand-row')).toHaveAttribute('data-visible-count', '0');
            expect(screen.queryByRole('button', { name: /查看手牌|弃置手牌/ })).not.toBeInTheDocument();
        });
    });

    it('双人开局空手时，桌面 live 仍保留 7 槽占位并明确提示先摸 2 张', () => {
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1440,
        });

        try {
            renderBoard(makeCore({
                drawPile: HAND_CARDS.slice(4, 6).map((card) => ({ ...card })),
                discardPile: [],
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: [],
                        score: 0,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 0 },
                            { label: '总加分', value: 0 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: [],
                        score: 0,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 0 },
                            { label: '总加分', value: 0 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            expect(screen.getByTestId('fantasyrealms-live-action-button')).toHaveTextContent('摸 2 张');
            expect(screen.getByTestId('fantasyrealms-live-deck')).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-deck-cue')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-discard-empty')).toHaveTextContent('');
            expect(screen.getByTestId('fantasyrealms-live-action-zone')).toHaveAttribute('data-anchor', 'right-lower-dock');
            expect(screen.queryByTestId('fantasyrealms-hand-empty-note')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-hand-row')).toHaveAttribute('data-slot-count', '7');
            expect(screen.getAllByTestId('fantasyrealms-card-slot-empty')).toHaveLength(7);
        } finally {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                writable: true,
                value: originalInnerWidth,
            });
            act(() => {
                window.dispatchEvent(new Event('resize'));
            });
        }
    });

    it('进入弃牌阶段后桌面 live 只保留短动作标签与手牌主操作带', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                stage: 'discard',
                focusCardId: HAND_CARDS[1]!.id,
                discardPile: [],
            }));

            expect(screen.getByTestId('fantasyrealms-live-action-button')).toHaveTextContent('弃牌');
            expect(screen.getByTestId('fantasyrealms-discard-empty')).toHaveTextContent('');
            expect(screen.queryByTestId('fantasyrealms-live-guidance-note')).not.toBeInTheDocument();
            const handButtons = screen.getAllByRole('button', { name: /弃置手牌/ });
            expect(handButtons[0]).toHaveAttribute('data-action-state', 'discard');
            expect(screen.queryAllByRole('button', { name: /查看弃牌/ })).toHaveLength(0);
        });
    });

    it('桌面 live 抓牌阶段会先选中公开牌，再由手牌区确认按钮确认拿取', () => {
        withViewport(1440, 1024, () => {
            const dispatch = vi.fn();
            renderBoard(makeCore({
                drawPile: HAND_CARDS.slice(0, 2).map((card) => ({ ...card })),
            }), { dispatch });

            const discardButton = screen.getAllByRole('button', { name: /拿取弃牌/ })[0]!;
            expect(screen.getByTestId('fantasyrealms-live-action-button')).toHaveTextContent('选择一张牌获取');
            expect(screen.getByTestId('fantasyrealms-live-action-button')).toBeDisabled();
            expect(screen.queryByTestId('fantasyrealms-live-deck-cue')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-guidance-note')).not.toBeInTheDocument();

            fireEvent.click(discardButton);

            const actionButton = screen.getAllByTestId('fantasyrealms-live-action-button')[0]!;
            const actionZone = screen.getByTestId('fantasyrealms-live-action-zone');
            expect(actionZone).toBeInTheDocument();
            expect(actionZone).toHaveAttribute('data-anchor', 'right-lower-dock');
            expect(actionButton).toHaveTextContent('确认选择');
            expect(screen.queryByTestId('fantasyrealms-live-guidance-note')).not.toBeInTheDocument();
            expect(dispatch).toHaveBeenNthCalledWith(1, 'SET_FOCUS_CARD', { cardId: PUBLIC_CARDS[2]!.id });

            fireEvent.click(actionButton);

            expect(dispatch).toHaveBeenNthCalledWith(2, 'TAKE_FROM_DISCARD', { cardId: PUBLIC_CARDS[2]!.id });
        });
    });

    it('桌面 live 弃牌阶段会先选中手牌，再由手牌区确认按钮确认弃置', () => {
        withViewport(1440, 1024, () => {
            const dispatch = vi.fn();
            renderBoard(makeCore({
                stage: 'discard',
                discardPile: [],
            }), { dispatch });

            const handButton = screen.getAllByRole('button', { name: /弃置手牌/ })[1]!;
            expect(screen.getByTestId('fantasyrealms-live-action-button')).toHaveTextContent('弃牌');

            fireEvent.click(handButton);

            const actionButton = screen.getByTestId('fantasyrealms-live-action-button');
            const actionZone = screen.getByTestId('fantasyrealms-live-action-zone');
            expect(actionZone).toBeInTheDocument();
            expect(actionZone).toHaveAttribute('data-anchor', 'right-lower-dock');
            expect(actionButton).toHaveTextContent('确认弃置');
            expect(actionButton).toBeEnabled();
            expect(screen.queryByTestId('fantasyrealms-live-guidance-note')).not.toBeInTheDocument();
            expect(dispatch).toHaveBeenNthCalledWith(1, 'SET_FOCUS_CARD', { cardId: HAND_CARDS[1]!.id });

            fireEvent.click(actionButton);

            expect(dispatch).toHaveBeenNthCalledWith(2, 'DISCARD_CARD', { cardId: HAND_CARDS[1]!.id });
        });
    });

    it('紧凑横屏布局下公开弃牌焦点只保留牌名与分值，不再常驻拿牌说明正文', () => {
        const focusCard = PUBLIC_CARDS[0]!;
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                focusCardId: focusCard.id,
            }));

            const focusPanel = screen.getAllByText('当前焦点')[0]!.closest('section');
            expect(focusPanel).not.toBeNull();
            expect(screen.getAllByText(focusCard.displayNameZh).length).toBeGreaterThan(0);
            expect(within(focusPanel as HTMLElement).getByText(/^[+-]\d+$/)).toBeInTheDocument();
            expect(screen.queryByText(new RegExp(`若现在拿走 ${focusCard.displayNameZh}`))).not.toBeInTheDocument();
        });
    });

    it('紧凑横屏布局下手牌焦点只保留牌名与分值，不再常驻弃牌说明正文', () => {
        const focusCard = HAND_CARDS[0]!;
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                stage: 'discard',
                focusCardId: focusCard.id,
                discardPile: [],
            }));

            const focusPanel = screen.getAllByText('当前焦点')[0]!.closest('section');
            expect(focusPanel).not.toBeNull();
            expect(screen.getAllByText(focusCard.displayNameZh).length).toBeGreaterThan(0);
            expect(within(focusPanel as HTMLElement).getByText(/^[+-]\d+$/)).toBeInTheDocument();
            expect(screen.queryByText(new RegExp(`若现在弃掉 ${focusCard.displayNameZh}`))).not.toBeInTheDocument();
        });
    });

    it('多人基础版的桌面 live 也只保留短动作和阈值数字', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                drawPile: HAND_CARDS.slice(4, 6).map((card) => ({ ...card })),
                playerIds: ['0', '1', '2'],
                discardPile: [],
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 42,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 30 },
                            { label: '总加分', value: 12 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 35,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 25 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 33,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 22 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            expect(screen.getByTestId('fantasyrealms-live-action-button')).toHaveTextContent('摸牌');
            expect(screen.getByTestId('fantasyrealms-live-deck')).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-deck-cue')).not.toBeInTheDocument();
            expect(screen.getByText('0/10')).toBeInTheDocument();
            expect(screen.getByText('当前总分')).toBeInTheDocument();
            expect(screen.queryByText(/当前为 3 人基础版/)).not.toBeInTheDocument();
            expect(screen.queryByText(/第 \d+ 名/)).not.toBeInTheDocument();
        });
    });

    it('5 人及以上的桌面 live 分数区会收成座位式信息条而不是厚面板', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2', '3', '4', '5'],
                discardPile: [],
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 42,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 30 },
                            { label: '总加分', value: 12 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 35,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 25 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 33,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 22 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '3': {
                        id: '3',
                        name: '玩家4',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 31,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 20 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '4': {
                        id: '4',
                        name: '玩家5',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 29,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 18 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '5': {
                        id: '5',
                        name: '玩家6',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 27,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 17 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            expect(screen.getByTestId('fantasyrealms-live-score-strip')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-score-band')).toBeInTheDocument();
        });
    });

    it('多人局只公开当前观察者分数，其余玩家保留终局揭示状态', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2'],
                currentPlayer: '1',
                discardPile: [],
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 42,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 30 },
                            { label: '总加分', value: 12 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.slice(0, 6).map((card) => ({ ...card })),
                        score: 35,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 25 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.slice(0, 5).map((card) => ({ ...card })),
                        score: 33,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 22 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            expect(screen.getByLabelText('玩家分数总览')).toBeInTheDocument();
            expect(screen.getAllByText('玩家2')).toHaveLength(1);
            expect(screen.queryByText('玩家3')).not.toBeInTheDocument();
            expect(screen.queryByText('??')).not.toBeInTheDocument();
            expect(screen.queryByText('官方总分')).not.toBeInTheDocument();
            expect(screen.queryByText('终局揭示')).not.toBeInTheDocument();
            expect(screen.queryByText('手牌 6 张')).not.toBeInTheDocument();
            expect(screen.queryByText('手牌 5 张')).not.toBeInTheDocument();
            expect(screen.queryByText(/第 \d+ 名/)).not.toBeInTheDocument();
        });
    });

    it('多人局进行中只公开当前观察者总分，不公开实时排名', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2'],
                currentPlayer: '1',
                discardPile: [],
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.map((card) => ({ ...card })),
                        score: 42,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 30 },
                            { label: '总加分', value: 12 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.slice(0, 6).map((card) => ({ ...card })),
                        score: 0,
                        scoreBreakdown: [],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.slice(0, 5).map((card) => ({ ...card })),
                        score: 0,
                        scoreBreakdown: [],
                    },
                } as any,
            }));

            const liveScoreStrip = screen.getByTestId('fantasyrealms-live-score-strip');
            expect(within(liveScoreStrip).getByText('42')).toBeInTheDocument();
            expect(within(liveScoreStrip).queryByText('官方总分')).toBeNull();
            expect(within(liveScoreStrip).queryByText('终局揭示')).toBeNull();
            expect(within(liveScoreStrip).queryByText('第 2 名')).toBeNull();
            expect(screen.queryByText('玩家3')).not.toBeInTheDocument();
        });
    });

    it('紧凑横屏布局下等待他人行动时不会泄露其他玩家的隐藏手牌焦点，并会提示多人局隐藏信息规则', () => {
        const hiddenOpponentCard = HAND_CARDS[5]!;
        const publicDiscardCard = PUBLIC_CARDS[0]!;
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2'],
                currentPlayer: '1',
                hiddenFocusCard: true,
                discardPile: [{ ...publicDiscardCard }],
                focusCardId: null,
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.slice(0, 4).map((card) => ({ ...card })),
                        score: 29,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 14 },
                            { label: '总加分', value: 15 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.slice(4, 7).map((card) => ({ ...card })),
                        score: 35,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 25 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.slice(1, 6).map((card) => ({ ...card })),
                        score: 33,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 22 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }));

            expect(screen.getAllByText('当前焦点')).toHaveLength(1);
            expect(screen.getByText('焦点暂不可见')).toBeInTheDocument();
            expect(screen.getByText('--')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: `查看弃牌 ${publicDiscardCard.displayNameZh}` })).toBeInTheDocument();
            expect(screen.queryByText(hiddenOpponentCard.displayNameZh)).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'back');
            expect(screen.getByTestId('fantasyrealms-focus-preview').getAttribute('style')).toContain('fantasyrealms-base-card-back');
        });
    });

    it('经过 playerView 遮蔽后，hiddenFocusCard 仍会让焦点预览保持牌背', () => {
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2'],
                currentPlayer: '1',
                hiddenFocusCard: true,
                focusCardId: null,
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.slice(0, 4).map((card) => ({ ...card })),
                        score: 29,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 14 },
                            { label: '总加分', value: 15 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: [
                            {
                                ...HAND_CARDS[4]!,
                                id: '__fantasyrealms_hidden_hand__:1:0',
                                name: 'Hidden Card',
                                displayNameZh: '隐藏卡牌',
                                text: '',
                                textZh: '',
                                score: 0,
                            },
                        ],
                        score: 35,
                        scoreBreakdown: [],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: [
                            {
                                ...HAND_CARDS[5]!,
                                id: '__fantasyrealms_hidden_hand__:2:0',
                                name: 'Hidden Card',
                                displayNameZh: '隐藏卡牌',
                                text: '',
                                textZh: '',
                                score: 0,
                            },
                        ],
                        score: 33,
                        scoreBreakdown: [],
                    },
                } as any,
            }));

            expect(screen.getByText('焦点暂不可见')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'back');
        });
    });

    it('旁观视角不会借用当前玩家身份，不会泄露任何手牌或实时总分', () => {
        const hiddenOpponentCard = HAND_CARDS[5]!;
        const publicDiscardCard = PUBLIC_CARDS[0]!;
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2'],
                currentPlayer: '1',
                hiddenFocusCard: true,
                discardPile: [{ ...publicDiscardCard }],
                focusCardId: null,
                players: {
                    '0': {
                        id: '0',
                        name: '玩家1',
                        hand: HAND_CARDS.slice(0, 4).map((card) => ({ ...card })),
                        score: 29,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 14 },
                            { label: '总加分', value: 15 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '1': {
                        id: '1',
                        name: '玩家2',
                        hand: HAND_CARDS.slice(4, 7).map((card) => ({ ...card })),
                        score: 35,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 25 },
                            { label: '总加分', value: 10 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                    '2': {
                        id: '2',
                        name: '玩家3',
                        hand: HAND_CARDS.slice(1, 6).map((card) => ({ ...card })),
                        score: 33,
                        scoreBreakdown: [
                            { label: '有效基础分', value: 22 },
                            { label: '总加分', value: 11 },
                            { label: '总减分', value: 0 },
                        ],
                    },
                } as any,
            }), {
                playerID: undefined,
                matchData: [
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '第二玩家', isConnected: true },
                    { id: 2, name: '第三玩家', isConnected: true },
                ],
            });

            expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /查看手牌/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /弃置手牌/ })).not.toBeInTheDocument();
            expect(screen.queryByText(hiddenOpponentCard.displayNameZh)).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'back');

            const scoreTable = screen.getByLabelText('玩家分数总览');
            expect(within(scoreTable).getAllByText('终局揭示').length).toBeGreaterThanOrEqual(1);
            expect(within(scoreTable).getAllByText('??').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('终局时会展示正式胜者文案与最终排名', () => {
        withViewport(1440, 1024, () => {
            render(
                <Board
                    G={{
                        core: makeCore({
                            playerIds: ['0', '1', '2'],
                            players: {
                                '0': {
                                    id: '0',
                                    name: '玩家1',
                                    hand: HAND_CARDS.map((card) => ({ ...card })),
                                    score: 42,
                                    scoreBreakdown: [
                                        { label: '有效基础分', value: 30 },
                                        { label: '总加分', value: 12 },
                                        { label: '总减分', value: 0 },
                                    ],
                                },
                                '1': {
                                    id: '1',
                                    name: '玩家2',
                                    hand: HAND_CARDS.slice(0, 6).map((card) => ({ ...card })),
                                    score: 35,
                                    scoreBreakdown: [
                                        { label: '有效基础分', value: 25 },
                                        { label: '总加分', value: 10 },
                                        { label: '总减分', value: 0 },
                                    ],
                                },
                                '2': {
                                    id: '2',
                                    name: '玩家3',
                                    hand: HAND_CARDS.slice(0, 5).map((card) => ({ ...card })),
                                    score: 33,
                                    scoreBreakdown: [
                                        { label: '有效基础分', value: 22 },
                                        { label: '总加分', value: 11 },
                                        { label: '总减分', value: 0 },
                                    ],
                                },
                            } as any,
                        }),
                        sys: {
                            gameover: {
                                winner: '1',
                                scores: {
                                    '0': 42,
                                    '1': 55,
                                    '2': 33,
                                },
                            },
                        },
                    } as MatchState<Record<string, unknown>>}
                    dispatch={() => {}}
                    playerID="0"
                    matchData={[
                        { id: 0, name: '测试玩家', isConnected: true },
                        { id: 1, name: '第二玩家', isConnected: true },
                        { id: 2, name: '第三玩家', isConnected: true },
                    ]}
                    isConnected
                />,
            );

            expect(screen.getByTestId('fantasyrealms-live-table')).toHaveClass('fr-live-table--gameover');
            expect(screen.getByTestId('fantasyrealms-live-endgame')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-topbar')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-score-strip')).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-table-layout')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-endgame-rank-1')).toHaveAttribute('data-rank-tone', 'gold');
            expect(screen.getByTestId('fantasyrealms-endgame-rank-1')).toContainElement(screen.getByLabelText('胜者'));
            expect(screen.getByTestId('fantasyrealms-endgame-rank-1').querySelector('.fr-live-endgame-rank-order')).toContainElement(screen.getByLabelText('胜者'));
            expect(screen.getByTestId('fantasyrealms-endgame-rank-1')).toHaveTextContent('第二玩家');
            expect(screen.getByTestId('fantasyrealms-endgame-rank-1').querySelector('[data-score-animation="count-up"][data-target-score="55"]')).not.toBeNull();
            expect(screen.queryByText('当前总分')).not.toBeInTheDocument();
            expect(screen.queryByText('第 3 回合 · 玩家1')).not.toBeInTheDocument();
            expect(screen.getAllByText('最终排名')).toHaveLength(1);
            const standings = screen.getByLabelText('最终排名');
            expect(standings).toBeInTheDocument();
            expect(within(standings).getByText('第 1 名')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-endgame-rank-1')).toHaveAttribute('data-rank-tone', 'gold');
            expect(screen.getByTestId('fantasyrealms-endgame-rank-0')).toHaveAttribute('data-rank-tone', 'silver');
            expect(screen.getByTestId('fantasyrealms-endgame-rank-2')).toHaveAttribute('data-rank-tone', 'bronze');
            expect(standings.querySelector('[data-score-animation="count-up"][data-target-score="55"]')).not.toBeNull();
            expect(screen.getByTestId('fantasyrealms-endgame-reviewed-player')).toHaveTextContent('测试玩家的终局手牌');
        });
    });

    it('终局时可从结算排名切换查看其他玩家手牌', () => {
        withViewport(1024, 768, () => {
            render(
                <Board
                    G={{
                        core: makeCore({
                            playerIds: ['0', '1', '2'],
                            players: {
                                '0': {
                                    id: '0',
                                    name: '玩家1',
                                    hand: HAND_CARDS.map((card) => ({ ...card })),
                                    score: 42,
                                    scoreBreakdown: [],
                                },
                                '1': {
                                    id: '1',
                                    name: '玩家2',
                                    hand: HAND_CARDS.slice(0, 6).map((card) => ({ ...card })),
                                    score: 55,
                                    scoreBreakdown: [],
                                },
                                '2': {
                                    id: '2',
                                    name: '玩家3',
                                    hand: HAND_CARDS.slice(0, 5).map((card) => ({ ...card })),
                                    score: 31,
                                    scoreBreakdown: [],
                                },
                            } as any,
                        }),
                        sys: {
                            gameover: {
                                winner: '1',
                                scores: { '0': 42, '1': 55, '2': 31 },
                                winners: ['1'],
                            },
                        },
                    } as any}
                    dispatch={() => {}}
                    playerID="0"
                    matchData={[
                        { id: 0, name: '测试玩家', isConnected: true },
                        { id: 1, name: '第二玩家', isConnected: true },
                        { id: 2, name: '第三玩家', isConnected: true },
                    ]}
                    isConnected
                />,
            );

            const reviewedPlayer = screen.getByTestId('fantasyrealms-endgame-reviewed-player');
            const handRow = screen.getByTestId('fantasyrealms-hand-row');
            const secondPlayerRank = screen.getByTestId('fantasyrealms-endgame-rank-1');

            expect(reviewedPlayer).toHaveTextContent('测试玩家的终局手牌');
            expect(handRow).toHaveAttribute('data-visible-count', String(HAND_CARDS.length));
            expect(secondPlayerRank).toHaveAttribute('aria-pressed', 'false');

            act(() => {
                fireEvent.click(secondPlayerRank);
            });

            expect(secondPlayerRank).toHaveAttribute('aria-pressed', 'true');
            expect(reviewedPlayer).toHaveTextContent('第二玩家的终局手牌');
            expect(handRow).toHaveAttribute('data-visible-count', '6');
        });
    });
});

