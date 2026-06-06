/* @vitest-environment happy-dom */
import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import Board from '../Board';
import type { FantasyRealmsCore } from '../domain';
import zhCNLocale from '../../../../public/locales/zh-CN/game-fantasyrealms.json';
import {
    EMPTY_FOCUS_INSIGHT,
    FANTASY_REALMS_DISCARD_END_THRESHOLD,
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
        focusInsight: { ...EMPTY_FOCUS_INSIGHT, tips: [...EMPTY_FOCUS_INSIGHT.tips] },
        ...overrides,
    };
}

function renderBoard(core: FantasyRealmsCore = makeCore()) {
    return render(
        <Board
            G={{ core, sys: {} } as MatchState<Record<string, unknown>>}
            dispatch={() => {}}
            playerID="0"
            matchData={[{ id: 0, name: '测试玩家', isConnected: true }]}
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
    it('堆叠布局视口会切到顶部行动面板，并避免重复渲染回合区', () => {
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1024,
        });

        try {
            const { container } = renderBoard();

            expect(container.querySelector('.fr-stacked-turn-panel')).not.toBeNull();
            expect(screen.getAllByText('回合')).toHaveLength(1);
            expect(screen.getByRole('button', { name: '从牌库摸 2 张并弃 1 张' })).toBeInTheDocument();
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

    it('堆叠布局视口会把牌库面板切到紧凑高度', () => {
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1024,
        });

        try {
            const { container } = renderBoard();
            expect(container.querySelector('.fr-stack--deck-compact')).not.toBeNull();
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

    it('堆叠布局会把焦点牌与分数提到手牌上方，并把辅助信息压到次级区', () => {
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
            const { container } = renderBoard(makeCore({
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

            const stackedLayout = screen.getByTestId('fantasyrealms-stacked-layout');
            const stackedInsightGrid = screen.getByTestId('fantasyrealms-stacked-insight-grid');
            const stackedSupportGrid = screen.getByTestId('fantasyrealms-stacked-support-grid');
            const directChildren = Array.from(stackedLayout.children);

            expect(directChildren[0]).toHaveTextContent('公开弃牌堆');
            expect(directChildren[1]).toBe(stackedInsightGrid);
            expect(directChildren[2]).toHaveTextContent('测试玩家的手牌');
            expect(directChildren[3]).toBe(stackedSupportGrid);
            expect(within(stackedInsightGrid).getAllByText('当前焦点').length).toBeGreaterThanOrEqual(1);
            expect(within(stackedInsightGrid).getByText('当前总分')).toBeInTheDocument();
            expect(within(stackedSupportGrid).getByText('结束进度')).toBeInTheDocument();
            expect(within(stackedSupportGrid).getByText('牌库')).toBeInTheDocument();
            expect(container.querySelector('.fr-score-summary--dense')).not.toBeNull();
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

    it('低高度横屏会把手牌提到首屏，并把弃牌与焦点压成后续区块', () => {
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

            const stackedLayout = screen.getByTestId('fantasyrealms-stacked-layout');
            const directChildren = Array.from(stackedLayout.children);
            const stackedInsightGrid = screen.getByTestId('fantasyrealms-stacked-insight-grid');
            const stackedSupportGrid = screen.getByTestId('fantasyrealms-stacked-support-grid');

            expect(stackedLayout.className).toContain('fr-stacked-layout--compact-landscape');
            expect(directChildren[0]).toHaveTextContent('测试玩家的手牌');
            expect(directChildren[1]).toBe(stackedInsightGrid);
            expect(directChildren[2]).toBe(stackedSupportGrid);
            expect(directChildren[3]).toHaveTextContent('牌库');
            expect(within(stackedInsightGrid).getByText('公开弃牌堆')).toBeInTheDocument();
            expect(within(stackedInsightGrid).getAllByText('当前焦点').length).toBeGreaterThanOrEqual(1);
            expect(within(stackedSupportGrid).getByText('当前总分')).toBeInTheDocument();
            expect(within(stackedSupportGrid).getByText('结束进度')).toBeInTheDocument();
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
            renderBoard();

            expect(screen.queryByRole('heading', { name: '幻想国度' })).not.toBeInTheDocument();
            expect(screen.queryByText('已连接')).not.toBeInTheDocument();
            expect(screen.queryByText('公开弃牌堆')).not.toBeInTheDocument();
            expect(screen.queryByText('测试玩家的手牌')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-river')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-handband')).toBeInTheDocument();
        });
    });

    it('桌面端使用麻将桌式构图而不是三栏等权布局', () => {
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
            const river = screen.getByTestId('fantasyrealms-live-river');
            const handband = screen.getByTestId('fantasyrealms-live-handband');
            const handRow = screen.getByTestId('fantasyrealms-hand-row');
            const discardRow = screen.getByTestId('fantasyrealms-discard-row');
            const discardCards = within(discardRow).getAllByTestId('fantasyrealms-card');
            const handCards = within(handRow).getAllByTestId('fantasyrealms-card');

            expect(liveTable.className).toContain('fr-live-table');
            expect(topbar).toBeInTheDocument();
            expect(river).toBeInTheDocument();
            expect(handband).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-table-dock')).not.toBeInTheDocument();
            expect(handRow.className).toContain('fr-card-row--table-band');
            expect(discardRow.className).toContain('fr-discard-row--live-river');
            expect(discardCards[0]!.closest('button')?.className).toContain('fr-card-button--live-river');
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

    it('弃牌堆公开展示全部明牌，手牌区仍保留 7 槽', () => {
        renderBoard();

        const discardRow = screen.getByTestId('fantasyrealms-discard-row');
        const handRow = screen.getByTestId('fantasyrealms-hand-row');

        expect(within(discardRow).getAllByTestId('fantasyrealms-card')).toHaveLength(3);
        expect(handRow).toHaveAttribute('data-slot-count', String(FANTASY_REALMS_HAND_CARD_SLOTS));
        expect(within(handRow).getAllByTestId('fantasyrealms-card')).toHaveLength(4);
        expect(within(handRow).getAllByTestId('fantasyrealms-card-slot-empty')).toHaveLength(3);
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

            expect(screen.queryByText('当前总分')).not.toBeInTheDocument();
            expect(screen.queryByText('公开弃牌堆')).not.toBeInTheDocument();
            expect(screen.queryByText(/的手牌$/)).not.toBeInTheDocument();
            expect(screen.queryByText('官方总分')).not.toBeInTheDocument();
            expect(screen.getByText(`3/${FANTASY_REALMS_DISCARD_END_THRESHOLD}`)).toBeInTheDocument();
            expect(screen.queryByText('有效基础分')).not.toBeInTheDocument();
            expect(screen.queryByText(/当前已按双人变体与官方计分实时结算/)).not.toBeInTheDocument();
            expect(screen.queryByText('当前焦点')).not.toBeInTheDocument();
            expect(screen.queryByText('结束进度')).not.toBeInTheDocument();
        });
    });

    it('桌面端开局阶段只保留极短动作标签，不再展示阶段说明或面板标题', () => {
        withViewport(1440, 1024, () => {
            renderBoard();

            expect(screen.getByRole('button', { name: '摸2弃1' })).toBeInTheDocument();
            expect(screen.queryByText('牌库')).not.toBeInTheDocument();
            expect(screen.queryByText('回合')).not.toBeInTheDocument();
            expect(screen.queryByText('现在是抓牌阶段。公开弃牌堆可直接拿取，拿完后再回到手牌区完成弃牌。')).not.toBeInTheDocument();
            expect(screen.queryByText('当前可直接拿 1 张公开弃牌。')).not.toBeInTheDocument();
            const discardButtons = screen.getAllByRole('button', { name: /拿取弃牌/ });
            expect(discardButtons[0]).toHaveAttribute('data-action-state', 'take');
        });
    });

    it('桌面 live 的空态不再用描述性文字解释', () => {
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1440,
        });

        try {
            renderBoard(makeCore({
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

            expect(screen.getByRole('button', { name: '摸2弃1' })).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-discard-empty')).toHaveTextContent('');
            expect(screen.queryByTestId('fantasyrealms-hand-empty-note')).not.toBeInTheDocument();
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

            expect(screen.getByRole('button', { name: '弃1' })).toBeDisabled();
            expect(screen.getByTestId('fantasyrealms-discard-empty')).toHaveTextContent('');
            const handButtons = screen.getAllByRole('button', { name: /弃置手牌/ });
            expect(handButtons[0]).toHaveAttribute('data-action-state', 'discard');
            expect(screen.queryAllByRole('button', { name: /查看弃牌/ })).toHaveLength(0);
        });
    });

    it('堆叠布局下公开弃牌焦点会给出基于当前手牌的真实拿牌推演', () => {
        const focusCard = PUBLIC_CARDS[0]!;
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                focusCardId: focusCard.id,
            }));

            const focusPanel = screen.getAllByText('当前焦点')[0]!.closest('section');
            expect(focusPanel).not.toBeNull();
            expect(screen.getAllByText(focusCard.name).length).toBeGreaterThan(0);
            expect(within(focusPanel as HTMLElement).getByText(/^[+-]\d+$/)).toBeInTheDocument();
            expect(screen.getByText(new RegExp(`若现在拿走 ${focusCard.name}`))).toBeInTheDocument();
        });
    });

    it('堆叠布局下手牌焦点会给出当前弃掉它后的真实总分推演', () => {
        const focusCard = HAND_CARDS[0]!;
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                stage: 'discard',
                focusCardId: focusCard.id,
                discardPile: [],
            }));

            const focusPanel = screen.getAllByText('当前焦点')[0]!.closest('section');
            expect(focusPanel).not.toBeNull();
            expect(screen.getAllByText(focusCard.name).length).toBeGreaterThan(0);
            expect(within(focusPanel as HTMLElement).getByText(/^[+-]\d+$/)).toBeInTheDocument();
            expect(screen.getByText(new RegExp(`若现在弃掉 ${focusCard.name}`))).toBeInTheDocument();
        });
    });

    it('多人基础版的桌面 live 也只保留短动作和阈值数字', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
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

            expect(screen.getByRole('button', { name: '摸1' })).toBeInTheDocument();
            expect(screen.getByText('0/10')).toBeInTheDocument();
            expect(screen.queryByText('当前总分')).not.toBeInTheDocument();
            expect(screen.queryByText(/当前为 3 人基础版/)).not.toBeInTheDocument();
        });
    });

    it('5 人及以上的桌面 live 分数区会收成座位式信息条而不是厚面板', () => {
        withViewport(1440, 1024, () => {
            const { container } = renderBoard(makeCore({
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

            expect(container.querySelector('.fr-live-score-strip')).not.toBeNull();
            expect(container.querySelector('.fr-live-score-band')).not.toBeNull();
            expect(container.querySelector('.fr-live-score-seat')).toBeNull();
            expect(container.querySelector('.fr-panel--score-rail')).toBeNull();
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
            expect(screen.getAllByText('玩家2').length).toBeGreaterThanOrEqual(1);
            expect(screen.queryByText('玩家3')).not.toBeInTheDocument();
            expect(screen.queryByText('??')).not.toBeInTheDocument();
            expect(screen.getAllByText('第 1 名').length).toBeGreaterThanOrEqual(1);
            expect(screen.queryByText('官方总分')).not.toBeInTheDocument();
            expect(screen.queryByText('终局揭示')).not.toBeInTheDocument();
            expect(screen.queryByText('当前行动')).not.toBeInTheDocument();
            expect(screen.queryByText('手牌 6 张')).not.toBeInTheDocument();
            expect(screen.queryByText('手牌 5 张')).not.toBeInTheDocument();
        });
    });

    it('堆叠布局下等待他人行动时不会泄露其他玩家的隐藏手牌焦点，并会提示多人局隐藏信息规则', () => {
        const hiddenOpponentCard = HAND_CARDS[5]!;
        const publicDiscardCard = PUBLIC_CARDS[0]!;
        withViewport(1024, 768, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1', '2'],
                currentPlayer: '1',
                discardPile: [{ ...publicDiscardCard }],
                focusCardId: hiddenOpponentCard.id,
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

            expect(screen.getByText('你当前正在等待。这里仍可查看自己的手牌与公开弃牌，其他玩家的隐藏手牌不会在此展开。')).toBeInTheDocument();
            expect(screen.getByText('多人局进行中：这里只公开你的官方总分，其他玩家分数会在终局统一揭示。')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '等待当前玩家操作' })).toBeDisabled();
            expect(screen.getAllByText('当前焦点').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('焦点暂不可见')).toBeInTheDocument();
            expect(screen.getByText('--')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: `查看弃牌 ${publicDiscardCard.name}` })).toBeInTheDocument();
            expect(screen.queryByText(hiddenOpponentCard.name)).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-focus-preview')).toHaveAttribute('data-card-renderer', 'back');
            expect(screen.getByTestId('fantasyrealms-focus-preview').getAttribute('style')).toContain('fantasyrealms-base-card-back');
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

            expect(screen.getAllByText('胜者').length).toBeGreaterThanOrEqual(1);
            expect(screen.queryByText('当前行动')).not.toBeInTheDocument();
            expect(screen.getByText('终局复盘')).toBeInTheDocument();
            expect(screen.queryByText('第 3 回合 · 玩家1')).not.toBeInTheDocument();
            expect(screen.getByText('最终排名')).toBeInTheDocument();
            expect(screen.getByText('当前焦点')).toBeInTheDocument();
            expect(screen.queryByText('终局已揭示全部官方总分与最终排名')).not.toBeInTheDocument();
            expect(screen.queryByText('终局复盘中：这张牌已经按最终牌桌完成计分。现在更适合结合公开弃牌、最终排名和你自己的整手牌，回看它对总分的真实贡献。')).not.toBeInTheDocument();
            expect(screen.queryByText('如果只是补点数但会制造冲突，宁可继续等待更合拍的公开弃牌。')).not.toBeInTheDocument();
            const standings = screen.getByLabelText('最终排名');
            expect(standings).toBeInTheDocument();
            expect(within(standings).getByText('第 1 名')).toBeInTheDocument();
            expect(within(standings).getByText('第二玩家')).toBeInTheDocument();
            expect(within(standings).getByText('55')).toBeInTheDocument();
        });
    });
});
