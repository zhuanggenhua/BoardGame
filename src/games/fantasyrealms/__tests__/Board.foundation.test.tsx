/* @vitest-environment happy-dom */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { playSound } from '../../../lib/audio/useGameAudio';
import Board from '../Board';
import { ENDGAME_SCORE_STEP_KEY } from '../audio.config';
import { FANTASY_REALMS_AUDIO_EVENT_KEYS } from '../domain/events';
import type { FantasyRealmsCore } from '../domain';
import zhCNLocale from '../../../../public/locales/zh-CN/game-fantasyrealms.json';
import {
    FANTASY_REALMS_DUEL_DISCARD_END_THRESHOLD,
    FANTASY_REALMS_HAND_CARD_SLOTS,
    HAND_CARDS,
    PUBLIC_CARDS,
} from '../foundation';

type TranslationTree = Record<string, string | TranslationTree>;
const TEST_ENDGAME_SCORE_STEP_DELAY_MS = 180;
const TEST_ENDGAME_SCORE_STEP_MS = 460;

afterEach(() => {
    delete (window as Window & {
        __FR_OPENING_DEAL_SOUND_GUARD__?: unknown;
        __FR_LIVE_MOTION_LAST_SNAPSHOT__?: unknown;
    }).__FR_OPENING_DEAL_SOUND_GUARD__;
    delete (window as Window & {
        __FR_OPENING_DEAL_SOUND_GUARD__?: unknown;
        __FR_LIVE_MOTION_LAST_SNAPSHOT__?: unknown;
    }).__FR_LIVE_MOTION_LAST_SNAPSHOT__;
});

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

vi.mock('../../../lib/audio/useGameAudio', () => ({
    playSound: vi.fn(),
    useGameAudio: vi.fn(),
}));

// 默认样例是“已有公开弃牌的中盘态”，不是开局。
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

function makeDuelOpeningCore(overrides: Partial<FantasyRealmsCore> = {}): FantasyRealmsCore {
    return makeCore({
        currentPlayer: '0',
        turn: 1,
        stage: 'draw',
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
        } as FantasyRealmsCore['players'],
        ...overrides,
    });
}

function makeStandardOpeningCore(overrides: Partial<FantasyRealmsCore> = {}): FantasyRealmsCore {
    return makeCore({
        playerIds: ['0', '1', '2'],
        currentPlayer: '0',
        turn: 1,
        stage: 'draw',
        discardPile: [],
        players: {
            '0': {
                id: '0',
                name: '玩家1',
                hand: HAND_CARDS.slice(0, 7).map((card) => ({ ...card })),
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
                hand: HAND_CARDS.slice(0, 7).map((card, index) => ({ ...card, id: `${card.id}-p2-${index}` })),
                score: 0,
                scoreBreakdown: [
                    { label: '有效基础分', value: 0 },
                    { label: '总加分', value: 0 },
                    { label: '总减分', value: 0 },
                ],
            },
            '2': {
                id: '2',
                name: '玩家3',
                hand: HAND_CARDS.slice(0, 7).map((card, index) => ({ ...card, id: `${card.id}-p3-${index}` })),
                score: 0,
                scoreBreakdown: [
                    { label: '有效基础分', value: 0 },
                    { label: '总加分', value: 0 },
                    { label: '总减分', value: 0 },
                ],
            },
        } as FantasyRealmsCore['players'],
        ...overrides,
    });
}

function renderBoard(
    core: FantasyRealmsCore = makeCore(),
    options?: {
        dispatch?: ReturnType<typeof vi.fn>;
        playerID?: string | null;
        matchData?: Array<{ id: number | string; name: string; isConnected?: boolean }>;
        strictMode?: boolean;
    },
) {
    const board = (
        <Board
            G={{ core, sys: {} } as MatchState<Record<string, unknown>>}
            dispatch={options?.dispatch ?? (() => {})}
            playerID={options && 'playerID' in options ? options.playerID ?? undefined : '0'}
            matchData={options?.matchData ?? [{ id: 0, name: '测试玩家', isConnected: true }]}
            isConnected
        />
    );
    return render(
        options?.strictMode ? <React.StrictMode>{board}</React.StrictMode> : board,
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

async function withViewportAsync(width: number, height: number, run: () => Promise<void>) {
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
        await run();
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
    it('标准局开局已有起手牌时，会播放一次发牌动画态', async () => {
        vi.mocked(playSound).mockClear();
        await withViewportAsync(1680, 1200, async () => {
            renderBoard(makeStandardOpeningCore(), {
                matchData: [
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '第二玩家', isConnected: true },
                    { id: 2, name: '第三玩家', isConnected: true },
                ],
            });

            await waitFor(() => {
                expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toHaveAttribute('data-motion', 'opening-deal');
            });
        });
        expect(document.querySelectorAll('.fr-card-button--motion-hand-opening').length).toBe(7);
        expect(vi.mocked(playSound)).toHaveBeenCalledWith(FANTASY_REALMS_AUDIO_EVENT_KEYS.CARD_DRAW_KEY);
        expect(vi.mocked(playSound)).toHaveBeenCalledTimes(1);
    });

    it('StrictMode 重挂时，标准局开局发牌音只播放一次', async () => {
        vi.mocked(playSound).mockClear();
        await withViewportAsync(1680, 1200, async () => {
            renderBoard(makeStandardOpeningCore(), {
                strictMode: true,
                matchData: [
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '第二玩家', isConnected: true },
                    { id: 2, name: '第三玩家', isConnected: true },
                ],
            });

            await waitFor(() => {
                expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toHaveAttribute('data-motion', 'opening-deal');
            });
        });

        expect(vi.mocked(playSound)).toHaveBeenCalledWith(FANTASY_REALMS_AUDIO_EVENT_KEYS.CARD_DRAW_KEY);
        expect(vi.mocked(playSound)).toHaveBeenCalledTimes(1);
    });

    it('减少动态时，标准局开局不会播放发牌动画态', async () => {
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: true,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })) as typeof window.matchMedia;

        try {
            await withViewportAsync(1680, 1200, async () => {
                renderBoard(makeStandardOpeningCore(), {
                    matchData: [
                        { id: 0, name: '测试玩家', isConnected: true },
                        { id: 1, name: '第二玩家', isConnected: true },
                        { id: 2, name: '第三玩家', isConnected: true },
                    ],
                });
                await waitFor(() => {
                    expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toHaveAttribute('data-motion', 'idle');
                });
            });
            expect(document.querySelector('.fr-card-button--motion-hand-opening')).toBeNull();
        } finally {
            window.matchMedia = originalMatchMedia;
        }
    });

    it('进入弃牌阶段后会立即收掉入手动画态，避免手牌仍在动时阻塞当前操作', async () => {
        const baseCore = makeCore({
            currentPlayer: '0',
            stage: 'draw',
            discardPile: [],
            players: {
                '0': {
                    id: '0',
                    name: '玩家1',
                    hand: HAND_CARDS.slice(0, 4).map((card) => ({ ...card })),
                    score: 0,
                    scoreBreakdown: [],
                },
                '1': {
                    id: '1',
                    name: '玩家2',
                    hand: HAND_CARDS.slice(4, 6).map((card, index) => ({ ...card, id: `${card.id}-p2-${index}` })),
                    score: 0,
                    scoreBreakdown: [],
                },
            } as FantasyRealmsCore['players'],
        });
        const drawnCard = { ...HAND_CARDS[4]!, id: `${HAND_CARDS[4]!.id}-drawn` };
        const { rerender } = renderBoard(baseCore, {
            matchData: [
                { id: 0, name: '测试玩家', isConnected: true },
                { id: 1, name: '第二玩家', isConnected: true },
            ],
        });

        rerender(
            <Board
                G={{
                    core: {
                        ...baseCore,
                        stage: 'discard',
                        players: {
                            ...baseCore.players,
                            '0': {
                                ...baseCore.players['0']!,
                                hand: [...baseCore.players['0']!.hand, drawnCard],
                            },
                        },
                    },
                    sys: {},
                } as MatchState<Record<string, unknown>>}
                dispatch={() => {}}
                playerID="0"
                matchData={[
                    { id: 0, name: '测试玩家', isConnected: true },
                    { id: 1, name: '第二玩家', isConnected: true },
                ]}
                isConnected
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toHaveAttribute('data-selection-state', 'discard');
            expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toHaveAttribute('data-motion', 'idle');
        });
    });

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
            expect(screen.queryByTestId('fantasyrealms-live-action-zone')).not.toBeInTheDocument();
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

    it('矮横屏紧凑布局会让位给手牌区，不再常驻当前焦点面板', () => {
        withViewport(844, 390, () => {
            renderBoard(makeCore({
                stage: 'discard',
                focusCardId: HAND_CARDS[0]!.id,
            }));

            expect(screen.getByTestId('fantasyrealms-compact-layout')).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-compact-focus-rail')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-hand-zone')).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-action-zone')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-status-banner')).not.toBeInTheDocument();
        });
    });

    it('粗指针环境不会常驻渲染放大镜按钮，改由长按预览承接', () => {
        const originalForcedCoarsePointer = (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__;
        (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;

        try {
            withViewport(844, 390, () => {
                renderBoard(makeCore({
                    stage: 'discard',
                }));

                expect(screen.queryAllByTestId(/fantasyrealms-card-magnify-button-/)).toHaveLength(0);
            });
        } finally {
            (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = originalForcedCoarsePointer;
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
            expect(screen.queryByTestId('fantasyrealms-live-action-zone')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-action-draw')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-status-banner')).not.toBeInTheDocument();
            expect(screen.queryByText('公开弃牌堆')).not.toBeInTheDocument();
            expect(screen.getAllByRole('button', { name: /拿取弃牌/ })).toHaveLength(3);
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

    it('桌面 live 的手牌区按基础 7 槽预算居中展示，仅临时第 8 张才扩到 8 槽', () => {
        withViewport(1920, 1080, () => {
            renderBoard();

            const discardRow = screen.getByTestId('fantasyrealms-discard-row');
            const handRow = screen.getByTestId('fantasyrealms-hand-row');

            expect(within(discardRow).getAllByTestId('fantasyrealms-card')).toHaveLength(3);
            expect(handRow).toHaveAttribute('data-slot-count', String(FANTASY_REALMS_HAND_CARD_SLOTS));
            expect(handRow).toHaveAttribute('data-visible-count', '4');
            expect(handRow).toHaveAttribute('data-hand-density', 'default');
            expect(handRow.style.gridTemplateColumns).toBe('repeat(7, minmax(0, var(--fr-live-hand-track-width)))');
            expect(handRow.style.getPropertyValue('--fr-live-hand-track-width')).toBe('calc((100% - 98px) / 8)');
            expect(within(handRow).getAllByTestId('fantasyrealms-card')).toHaveLength(4);
            expect(within(handRow).queryAllByTestId('fantasyrealms-card-slot-empty')).toHaveLength(0);
            expect(within(handRow).getAllByRole('button')[0]).toHaveStyle({ gridColumn: '2' });
        });
    });

    it('多人拿弃牌进入弃牌阶段时，第 8 张临时手牌不触发密度压缩', () => {
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
            expect(handRow).toHaveAttribute('data-hand-density', 'default');
            expect(handRow.style.gridTemplateColumns).toBe('repeat(8, minmax(0, var(--fr-live-hand-track-width)))');
            expect(handRow.style.getPropertyValue('--fr-live-hand-track-width')).toBe('calc((100% - 98px) / 8)');
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

    it('双人真实开局空弃牌时自动从牌库摸牌，不停在显式摸牌入口', async () => {
        const dispatch = vi.fn();
        withViewport(1440, 1024, () => {
            renderBoard(makeDuelOpeningCore({
                drawPile: HAND_CARDS.slice(4, 6).map((card) => ({ ...card })),
            }), { dispatch });

            expect(screen.getByTestId('fantasyrealms-live-deck')).toHaveAttribute('data-action-state', 'resource');
            expect(screen.queryByTestId('fantasyrealms-live-status-banner')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-deck-cue')).not.toBeInTheDocument();
            expect(screen.queryByText('牌库')).not.toBeInTheDocument();
            expect(screen.queryByText('回合')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-action-zone')).not.toBeInTheDocument();
        });
        await waitFor(() => {
            expect(dispatch).toHaveBeenCalledWith('DRAW_FROM_DECK', {});
        });
    });

    it('紧凑横屏布局回合区只保留短状态，不再常驻整句步骤说明', () => {
        withViewport(1024, 768, () => {
            renderBoard();

            expect(screen.getByText('第3轮')).toBeInTheDocument();
            expect(screen.getByText('你的回合')).toBeInTheDocument();
        });
    });

    it('二人局等待对手行动时不会误显示第三位玩家，回合标记保持明确', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                playerIds: ['0', '1'],
                currentPlayer: '1',
                turn: 3,
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
                } as any,
            }), {
                playerID: '0',
                matchData: [
                    { id: 0, name: '玩家1', isConnected: true },
                    { id: 1, name: '玩家2', isConnected: true },
                ],
            });

            expect(screen.getByText('第3轮')).toBeInTheDocument();
            expect(screen.getByText('玩家2')).toBeInTheDocument();
            expect(screen.queryByText('玩家3')).not.toBeInTheDocument();
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

    it('双人开局空手时，桌面 live 预留基础 7 槽占位并自动发牌', async () => {
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1440,
        });

        try {
            const dispatch = vi.fn();
            renderBoard(makeDuelOpeningCore({
                drawPile: HAND_CARDS.slice(4, 6).map((card) => ({ ...card })),
            }), { dispatch });

            expect(screen.getByTestId('fantasyrealms-live-deck')).toHaveAttribute('data-action-state', 'resource');
            expect(screen.queryByTestId('fantasyrealms-live-status-banner')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-deck-cue')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-discard-empty')).toHaveTextContent('');
            expect(screen.queryByTestId('fantasyrealms-hand-empty-note')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-hand-row')).toHaveAttribute('data-slot-count', '7');
            expect(screen.getByTestId('fantasyrealms-hand-row')).toHaveAttribute('data-hand-density', 'default');
            expect(screen.getAllByTestId('fantasyrealms-card-slot-empty')).toHaveLength(7);
            await waitFor(() => {
                expect(dispatch).toHaveBeenCalledWith('DRAW_FROM_DECK', {});
            });
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

    it('进入弃牌阶段后桌面 live 不再显示横幅，并由手牌直接承接弃牌', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                stage: 'discard',
                focusCardId: HAND_CARDS[1]!.id,
                discardPile: [],
            }));

            expect(screen.queryByTestId('fantasyrealms-live-action-zone')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-status-banner')).not.toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-discard-empty')).toHaveTextContent('');
            expect(screen.queryByTestId('fantasyrealms-live-guidance-note')).not.toBeInTheDocument();
            const handButtons = screen.getAllByRole('button', { name: /弃置手牌/ });
            expect(handButtons[0]).toHaveAttribute('data-action-state', 'discard');
            expect(screen.queryAllByRole('button', { name: /查看弃牌/ })).toHaveLength(0);
        });
    });

    it('进入弃牌阶段后点击手牌会直接提交弃牌动作', () => {
        withViewport(1440, 1024, () => {
            const dispatch = vi.fn();
            renderBoard(makeCore({
                stage: 'discard',
                discardPile: [],
            }), { dispatch });

            const handButton = screen.getAllByRole('button', { name: /弃置手牌/ })[1]!;

            fireEvent.click(handButton);

            expect(dispatch).toHaveBeenCalledTimes(2);
            expect(dispatch).toHaveBeenNthCalledWith(1, 'SET_FOCUS_CARD', { cardId: HAND_CARDS[1]!.id });
            expect(handButton).toHaveAttribute('data-action-state', 'discard');
            expect(screen.queryByTestId('fantasyrealms-live-status-banner')).not.toBeInTheDocument();
            expect(dispatch).toHaveBeenNthCalledWith(2, 'DISCARD_CARD', { cardId: HAND_CARDS[1]!.id });
        });
    });

    it('桌面 live 中盘抓牌阶段只保留摸牌按钮，中央牌直接承接拿牌', () => {
        withViewport(1440, 1024, () => {
            const dispatch = vi.fn();
            renderBoard(makeCore({
                drawPile: HAND_CARDS.slice(0, 2).map((card) => ({ ...card })),
            }), { dispatch });

            const actionZone = screen.getByTestId('fantasyrealms-live-action-zone');
            expect(within(actionZone).getAllByRole('button')).toHaveLength(1);
            expect(within(actionZone).getByRole('button', { name: '摸牌（或拿中央牌）' })).toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-status-banner')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-deck-cue')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-guidance-note')).not.toBeInTheDocument();

            const discardButton = screen.getAllByRole('button', { name: /拿取弃牌/ })[0]!;
            fireEvent.click(discardButton);

            expect(dispatch).toHaveBeenNthCalledWith(1, 'SET_FOCUS_CARD', { cardId: PUBLIC_CARDS[2]!.id });
            expect(dispatch).toHaveBeenNthCalledWith(2, 'TAKE_FROM_DISCARD', { cardId: PUBLIC_CARDS[2]!.id });
        });
    });

    it('中央牌区进入两排后保持固定交错槽位，下排从左往右填充且不随牌数重新居中', () => {
        withViewport(1440, 1024, () => {
            renderBoard(makeCore({
                discardPile: HAND_CARDS.slice(0, 6)
                    .concat(PUBLIC_CARDS.slice(0, 3))
                    .map((card) => ({ ...card })),
            }));

            const discardButtons = screen.getAllByRole('button', { name: /拿取弃牌/ });

            expect(discardButtons).toHaveLength(9);
            expect(discardButtons[0]).toHaveStyle({ left: 'calc(50% + -570px)', top: '8px', zIndex: '1' });
            expect(discardButtons[4]).toHaveStyle({ left: 'calc(50% + 470px)', top: '8px', zIndex: '1' });
            expect(discardButtons[5]).toHaveStyle({ left: 'calc(50% + -440px)', top: '210px', zIndex: '2' });
            expect(discardButtons[8]).toHaveStyle({ left: 'calc(50% + 340px)', top: '210px', zIndex: '2' });
        });
    });

    it('桌面端可通过显式放大镜按钮打开弃牌大图预览', () => {
        withViewport(1440, 1024, () => {
            renderBoard();

            const magnifyOverlay = screen.getByTestId('fantasyrealms-magnify-overlay');
            const magnifyButton = screen.getByTestId(`fantasyrealms-card-magnify-button-discard-${PUBLIC_CARDS[2]!.id}`);

            expect(magnifyOverlay).toHaveStyle({ opacity: '0' });

            act(() => {
                fireEvent.click(magnifyButton);
            });

            expect(magnifyOverlay).toHaveStyle({ opacity: '1' });
            expect(within(magnifyOverlay).getByTestId('fantasyrealms-card')).toHaveAttribute('data-atlas-card-id', PUBLIC_CARDS[2]!.id);
        });
    });

    it('粗指针环境长按手牌会打开大图预览', () => {
        vi.useFakeTimers();
        const originalForcedCoarsePointer = (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__;
        (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;

        try {
            withViewport(390, 844, () => {
                renderBoard(makeCore({
                    stage: 'discard',
                    discardPile: [],
                }));

                expect(screen.queryAllByTestId(/fantasyrealms-card-magnify-button-/)).toHaveLength(0);
                const handButton = screen.getAllByRole('button', { name: /弃置手牌/ })[0]!;
                fireEvent.pointerDown(handButton, { pointerType: 'touch', clientX: 24, clientY: 32 });
                act(() => {
                    vi.advanceTimersByTime(520);
                });

                expect(screen.getByTestId('fantasyrealms-magnify-overlay')).toHaveStyle({ opacity: '1' });
            });
        } finally {
            (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = originalForcedCoarsePointer;
            vi.useRealTimers();
        }
    });

    it('粗指针环境点击手牌采用先聚焦后二次弃牌', () => {
        const originalForcedCoarsePointer = (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__;
        (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;

        try {
            withViewport(390, 844, () => {
                const dispatch = vi.fn();
                const baseCore = makeCore({
                    stage: 'discard',
                    discardPile: [],
                });
                const { rerender } = renderBoard(baseCore, { dispatch });
                const firstHandButton = screen.getAllByRole('button', { name: /弃置手牌/ })[0]!;

                fireEvent.click(firstHandButton);

                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenNthCalledWith(1, 'SET_FOCUS_CARD', { cardId: HAND_CARDS[0]!.id });
                expect(dispatch).not.toHaveBeenCalledWith('DISCARD_CARD', expect.anything());

                rerender(
                    <Board
                        G={{ core: { ...baseCore, focusCardId: HAND_CARDS[0]!.id }, sys: {} } as MatchState<Record<string, unknown>>}
                        dispatch={dispatch}
                        playerID="0"
                        matchData={[{ id: 0, name: '测试玩家', isConnected: true }]}
                        isConnected
                    />,
                );

                fireEvent.click(screen.getAllByRole('button', { name: /弃置手牌/ })[0]!);

                expect(dispatch).toHaveBeenCalledTimes(3);
                expect(dispatch).toHaveBeenNthCalledWith(2, 'SET_FOCUS_CARD', { cardId: HAND_CARDS[0]!.id });
                expect(dispatch).toHaveBeenNthCalledWith(3, 'DISCARD_CARD', { cardId: HAND_CARDS[0]!.id });
            });
        } finally {
            (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = originalForcedCoarsePointer;
        }
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

    it('多人基础版无公开弃牌时也自动从牌库摸牌，并只保留短状态和阈值数字', async () => {
        const dispatch = vi.fn();
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
            }), { dispatch });

            expect(screen.getByTestId('fantasyrealms-live-deck')).toHaveAttribute('data-action-state', 'resource');
            expect(screen.queryByTestId('fantasyrealms-live-action-zone')).not.toBeInTheDocument();
            expect(screen.queryByTestId('fantasyrealms-live-deck-cue')).not.toBeInTheDocument();
            expect(screen.getByText('0/10')).toBeInTheDocument();
            expect(screen.getByText('当前总分')).toBeInTheDocument();
            expect(screen.queryByText(/当前为 3 人基础版/)).not.toBeInTheDocument();
            expect(screen.queryByText(/第 \d+ 名/)).not.toBeInTheDocument();
        });
        await waitFor(() => {
            expect(dispatch).toHaveBeenCalledWith('DRAW_FROM_DECK', {});
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
            expect(within(scoreTable).queryByText('终局揭示')).toBeNull();
            expect(within(scoreTable).getByText('??')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-live-score-total')).toHaveAttribute('data-score-current', '??');
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
            expect(screen.getByTestId('fantasyrealms-endgame-rank-1').querySelector('[data-score-role="final-score"]')).not.toBeNull();
            expect(screen.queryByText('当前总分')).not.toBeInTheDocument();
            expect(screen.queryByText('第 3 回合 · 玩家1')).not.toBeInTheDocument();
            expect(screen.getAllByText('最终排名')).toHaveLength(1);
            const standings = screen.getByLabelText('最终排名');
            expect(standings).toBeInTheDocument();
            expect(within(standings).getByText('第 1 名')).toBeInTheDocument();
            expect(screen.getByTestId('fantasyrealms-endgame-rank-1')).toHaveAttribute('data-rank-tone', 'gold');
            expect(screen.getByTestId('fantasyrealms-endgame-rank-0')).toHaveAttribute('data-rank-tone', 'silver');
            expect(screen.getByTestId('fantasyrealms-endgame-rank-2')).toHaveAttribute('data-rank-tone', 'bronze');
            expect(standings.querySelector('[data-score-role="final-score"]')).not.toBeNull();
            expect(screen.getByTestId('fantasyrealms-live-score-total')).toHaveAttribute('data-score-animation', 'settlement-sequence');
            expect(screen.getByTestId('fantasyrealms-live-score-total')).toHaveAttribute('data-score-target', '42');
            expect(screen.getByTestId('fantasyrealms-endgame-reviewed-player')).toHaveTextContent('测试玩家的终局手牌');
        });
    });

    it('终局逐张计分时会按卡牌 step 播放一次结算音效', async () => {
        vi.mocked(playSound).mockClear();
        const originalMatchMedia = window.matchMedia;
        vi.useFakeTimers();
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })) as typeof window.matchMedia;

        try {
            await withViewportAsync(1440, 1024, async () => {
                const { rerender } = render(
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

                act(() => {
                    vi.advanceTimersByTime(TEST_ENDGAME_SCORE_STEP_DELAY_MS + 1);
                });

                expect(screen.queryByTestId('fantasyrealms-live-score-step')).not.toBeInTheDocument();
                expect(vi.mocked(playSound)).toHaveBeenCalledWith(ENDGAME_SCORE_STEP_KEY);

                act(() => {
                    vi.advanceTimersByTime(TEST_ENDGAME_SCORE_STEP_MS);
                });

                expect(vi.mocked(playSound).mock.calls.length).toBeGreaterThanOrEqual(2);

                act(() => {
                    vi.runAllTimers();
                });

                expect(screen.getByTestId('fantasyrealms-live-score-total')).toHaveAttribute('data-score-current', '42');
                expect(screen.getByTestId('fantasyrealms-live-score-total')).toHaveAttribute('data-score-running', 'false');

                const soundCallCountAfterSettle = vi.mocked(playSound).mock.calls.length;
                rerender(
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
                act(() => {
                    vi.advanceTimersByTime(TEST_ENDGAME_SCORE_STEP_DELAY_MS + TEST_ENDGAME_SCORE_STEP_MS * 2);
                });
                expect(vi.mocked(playSound).mock.calls.length).toBe(soundCallCountAfterSettle);
            });
        } finally {
            window.matchMedia = originalMatchMedia;
            vi.useRealTimers();
        }
    });

    it('终局计分完成后，桌面悬浮手牌会在原跳字位置显示该牌分值', async () => {
        const originalMatchMedia = window.matchMedia;
        vi.useFakeTimers();
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })) as typeof window.matchMedia;

        try {
            await withViewportAsync(1440, 1024, async () => {
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

                act(() => {
                    vi.runAllTimers();
                });
                expect(screen.getByTestId('fantasyrealms-live-score-total')).toHaveAttribute('data-score-running', 'false');

                const handRow = screen.getByTestId('fantasyrealms-hand-row');
                const firstHandButton = within(handRow).getAllByRole('button')[0]!;
                fireEvent.mouseEnter(firstHandButton);

                expect(screen.getByTestId('fantasyrealms-endgame-card-delta')).toHaveTextContent(/[+-]\d+/);

                fireEvent.mouseLeave(firstHandButton);
                expect(screen.queryByTestId('fantasyrealms-endgame-card-delta')).not.toBeInTheDocument();
            });
        } finally {
            window.matchMedia = originalMatchMedia;
            vi.useRealTimers();
        }
    });

    it('终局计分完成后，粗指针环境会在已选中手牌上显示该牌分值', () => {
        const originalForcedCoarsePointer = (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__;
        (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = true;
        const originalMatchMedia = window.matchMedia;
        vi.useFakeTimers();
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })) as typeof window.matchMedia;

        try {
            withViewport(390, 844, () => {
                render(
                    <Board
                        G={{
                            core: makeCore({
                                focusCardId: HAND_CARDS[0]!.id,
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

                act(() => {
                    vi.runAllTimers();
                });

                expect(screen.getByTestId('fantasyrealms-live-score-total')).toHaveAttribute('data-score-running', 'false');
                expect(screen.getByTestId('fantasyrealms-endgame-card-delta')).toHaveTextContent(/[+-]\d+/);
            });
        } finally {
            (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__ = originalForcedCoarsePointer;
            window.matchMedia = originalMatchMedia;
            vi.useRealTimers();
        }
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

    it('终局切去查看其他玩家时，不会继续播放对方的逐张计分音', () => {
        vi.useFakeTimers();
        vi.mocked(playSound).mockClear();
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })) as typeof window.matchMedia;

        try {
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
            });

            act(() => {
                vi.advanceTimersByTime(200);
            });

            const callCountAfterSelfStep = vi.mocked(playSound).mock.calls.length;
            expect(callCountAfterSelfStep).toBeGreaterThanOrEqual(1);

            act(() => {
                fireEvent.click(screen.getByTestId('fantasyrealms-endgame-rank-1'));
            });

            act(() => {
                vi.advanceTimersByTime(700);
            });

            expect(vi.mocked(playSound).mock.calls.length).toBe(callCountAfterSelfStep);
        } finally {
            window.matchMedia = originalMatchMedia;
            vi.useRealTimers();
        }
    });
});

