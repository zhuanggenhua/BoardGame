/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { useUndo } from '../../../contexts/UndoContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { ToastViewport } from '../../../components/system/ToastViewport';
import Board from '../Board';
import { TheGangDomain, buildShowdownResults } from '../domain';
import { THE_GANG_COMMANDS, type PlayingCard, type ShowdownPlayerResult, type TheGangCore } from '../domain/types';
import { THE_GANG_AUDIO_CONFIG } from '../audio.config';
import { THE_GANG_MANIFEST } from '../manifest';

const useGameAudioMock = vi.fn();

vi.mock('../../../lib/audio/useGameAudio', () => ({
    useGameAudio: (...args: unknown[]) => useGameAudioMock(...args),
}));

const stateOf = (core: TheGangCore): MatchState<TheGangCore> => ({
    core,
    sys: {} as MatchState<TheGangCore>['sys'],
});

const strengthOrder = (left: ShowdownPlayerResult, right: ShowdownPlayerResult) => {
    const categoryDelta = left.strength.category - right.strength.category;
    if (categoryDelta !== 0) return categoryDelta;

    for (let index = 0; index < Math.max(left.strength.ranks.length, right.strength.ranks.length); index += 1) {
        const rankDelta = (left.strength.ranks[index] ?? 0) - (right.strength.ranks[index] ?? 0);
        if (rankDelta !== 0) return rankDelta;
    }

    return 0;
};

const finalRoundChipsFor = (core: TheGangCore) => [...buildShowdownResults(core)]
    .sort(strengthOrder)
    .reduce<Record<string, number>>((chips, result, index) => ({
        ...chips,
        [result.handSlot ? `${result.playerId}:${result.handSlot}` : result.playerId]: index + 1,
    }), {});

const fixedRandom = { random: () => 0 };

const standardCard = (rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard => ({
    rank,
    suit,
    kind: 'standard',
});
const renderWithToast = (ui: React.ReactElement) => render(
    <ToastProvider>
        {ui}
        <ToastViewport />
    </ToastProvider>,
);

function UndoProbe() {
    const undo = useUndo();
    return (
        <output data-testid="undo-provider-state">
            {undo ? `${undo.playerID ?? 'none'}:${undo.isLocalMode ? 'local' : 'online'}` : 'missing'}
        </output>
    );
}

function HarnessBoard() {
    const [core, setCore] = React.useState(() => TheGangDomain.setup(['0', '1', '2'], fixedRandom));
    const [playerID, setPlayerID] = React.useState('0');

    const dispatch = React.useCallback((type: string, payload: unknown) => {
        setCore((currentCore) => {
            const command = {
                type,
                playerId: playerID,
                payload,
                timestamp: Date.now(),
            } as never;
            const currentState = stateOf(currentCore);
            const validation = TheGangDomain.validate(currentState, command);
            if (!validation.valid) {
                return currentCore;
            }
            return TheGangDomain.execute(currentState, command, fixedRandom)
                .reduce((nextCore, event) => TheGangDomain.reduce(nextCore, event), currentCore);
        });
    }, [playerID]);

    return (
        <ToastProvider>
            <div aria-label="测试座位切换">
                {['0', '1', '2'].map((id) => (
                    <button key={id} type="button" onClick={() => setPlayerID(id)}>
                        切到玩家 {Number(id) + 1}
                    </button>
                ))}
            </div>
            <Board
                G={stateOf(core)}
                dispatch={dispatch as never}
                playerID={playerID}
                matchData={[
                    { id: 0, name: '玩家 1', isConnected: true, isOwner: true },
                    { id: 1, name: '玩家 2', isConnected: true },
                    { id: 2, name: '玩家 3', isConnected: true },
                ]}
                isConnected
            />
            <ToastViewport />
            <UndoProbe />
        </ToastProvider>
    );
}

const reduceCommand = (
    core: TheGangCore,
    command: Parameters<typeof TheGangDomain.execute>[1],
) => TheGangDomain.execute(stateOf(core), command, fixedRandom)
    .reduce((nextCore, event) => TheGangDomain.reduce(nextCore, event), core);

const startHeistCore = (core: TheGangCore, playerId = '0', timestamp = 1) => reduceCommand(core, {
    type: THE_GANG_COMMANDS.START_HEIST,
    playerId,
    payload: {},
    timestamp,
} as Parameters<typeof TheGangDomain.execute>[1]);

const confirmProgressForAllPlayers = (
    core: TheGangCore,
    type: typeof THE_GANG_COMMANDS.END_ROUND | typeof THE_GANG_COMMANDS.REVEAL_SHOWDOWN | typeof THE_GANG_COMMANDS.START_NEXT_HEIST,
    timestamp: number,
) => {
    let nextCore = core;
    for (const [index, playerId] of nextCore.playerIds.entries()) {
        nextCore = reduceCommand(nextCore, {
            type,
            playerId,
            payload: {},
            timestamp: timestamp + index,
        } as Parameters<typeof TheGangDomain.execute>[1]);
    }
    return nextCore;
};

const buildCoreReadyForShowdown = () => {
    let core = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
    core = startHeistCore(core);

    for (const round of [1, 2, 3]) {
        for (const [index, playerId] of core.playerIds.entries()) {
            core = reduceCommand(core, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: round * 10 + index,
            } as Parameters<typeof TheGangDomain.execute>[1]);
        }

        core = confirmProgressForAllPlayers(core, THE_GANG_COMMANDS.END_ROUND, round * 100);
    }

    const finalRoundChips = finalRoundChipsFor(core);
    for (const playerId of core.playerIds) {
        core = reduceCommand(core, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId,
            payload: { chip: finalRoundChips[playerId] },
            timestamp: 400 + Number(playerId),
        } as Parameters<typeof TheGangDomain.execute>[1]);
    }

    return core;
};

const defaultMatchData = [
    { id: 0, name: '玩家 1', isConnected: true, isOwner: true },
    { id: 1, name: 'AI 2 号位', isConnected: true },
    { id: 2, name: 'AI 3 号位', isConnected: true },
];

const matchDataForPlayerCount = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: index,
    name: index === 0 ? '玩家 1' : `AI ${index + 1} 号位`,
    isConnected: true,
    ...(index === 0 ? { isOwner: true } : {}),
}));

const renderBoardForCore = (core: TheGangCore) => renderWithToast(
    <Board
        G={stateOf(core)}
        dispatch={vi.fn() as never}
        playerID="0"
        matchData={defaultMatchData}
        isConnected
    />,
);

const expectBggTableAnchors = () => {
    const layoutRoot = document.querySelector('[data-layout-contract]');
    expect(layoutRoot).toHaveAttribute('data-layout-contract', 'bgg-electronic');
    expect(layoutRoot).toHaveAttribute('data-layout-source', 'BGG electronic DOM/CSS');
    expect(screen.getByTestId('the-gang-layout-contract')).toBeInTheDocument();
    expect(document.querySelector('[data-bgg-zone="top-zone"]')).toBeInTheDocument();
    expect(document.querySelector('[data-bgg-zone="middle-zone"]')).toBeInTheDocument();
    expect(document.querySelector('[data-bgg-zone="bottom-zone"]')).toBeInTheDocument();
    expect(document.querySelector('[data-bgg-zone="token-pile"]')).toBeInTheDocument();
    expect(document.querySelector('[data-bgg-zone="card-river"]')).toBeInTheDocument();
    expect(document.querySelector('[data-bgg-zone="vaults-alarms-zone"]')).toBeInTheDocument();
    expect(document.querySelector('[data-bgg-zone="hand-groupzone"]')).toBeInTheDocument();
    expect(document.querySelector('[data-bgg-zone="player-tokens"]')).toBeInTheDocument();
    expect(
        document.querySelector('[data-bgg-zone="player-current-token"], [data-bgg-zone="player-token"], [data-bgg-zone="hand-chips"]'),
    ).toBeInTheDocument();
};

const buildFourPlayerTwoHandFinalRoundCore = () => {
    let core = TheGangDomain.setup(['0', '1', '2', '3'], fixedRandom);
    core = reduceCommand(core, {
        type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
        playerId: '0',
        payload: {
            config: {
                gameMode: 'texas-holdem',
                twoHand: true,
                challenges: {},
            },
        },
        timestamp: 1,
    } as Parameters<typeof TheGangDomain.execute>[1]);
    core = startHeistCore(core, '0', 2);
    return {
        ...core,
        round: 4,
        phase: 'chip-selection',
        communityCards: [
            standardCard('2', 'clubs'),
            standardCard('7', 'diamonds'),
            standardCard('9', 'hearts'),
            standardCard('J', 'clubs'),
            standardCard('K', 'diamonds'),
        ],
        currentRoundChips: {
            '0:top': 1,
            '0:bottom': 2,
            '1:top': 3,
            '1:bottom': 4,
            '2:top': 5,
            '2:bottom': 6,
            '3:top': 7,
            '3:bottom': 8,
        },
        currentRoundExitChipOwners: [],
    } satisfies TheGangCore;
};

describe('The Gang Board 运行入口', () => {
    test('初始抢劫必须由房主点击开始才派发正式开始命令', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

        renderWithToast(
                <Board
                G={stateOf(initial)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        expect(screen.getByTestId('the-gang-start-heist')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-redeal-heist')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'board.nextRound' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('the-gang-start-heist'));

        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.START_HEIST, {
            __internalPlayerId: '0',
        });
    });

    test('开始抢劫前房主可以点击重新发牌，开始后按钮消失', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

        const { unmount } = renderWithToast(
            <Board
                G={stateOf(initial)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('the-gang-redeal-heist'));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.REDEAL_HEIST, {
            __internalPlayerId: '0',
        });

        unmount();
        renderWithToast(
                <Board
                G={stateOf(startHeistCore(initial))}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        expect(screen.queryByTestId('the-gang-redeal-heist')).not.toBeInTheDocument();
    });

    test('非房主点击开始抢劫会 toast 提示且不派发命令', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

        renderWithToast(
                <Board
                G={stateOf(initial)}
                dispatch={dispatch as never}
                playerID="1"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('the-gang-start-heist'));

        expect(dispatch).not.toHaveBeenCalled();
        expect(screen.getByText(/只有房主可以开始抢劫|board\.toastHostOnlyStart/u)).toBeInTheDocument();
    });

    test('非房主点击重新发牌会 toast 提示且不派发命令', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

        renderWithToast(
                <Board
                G={stateOf(initial)}
                dispatch={dispatch as never}
                playerID="1"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        fireEvent.click(screen.getByTestId('the-gang-redeal-heist'));

        expect(dispatch).not.toHaveBeenCalled();
        expect(screen.getByText(/只有房主可以重新发牌|board\.toastHostOnlyRedeal/u)).toBeInTheDocument();
    });

    test('开始前点击筹码会 toast 提示且不派发拿筹码命令', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

        renderWithToast(
                <Board
                G={stateOf(initial)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        const firstChipButton = document.querySelector('[data-bgg-zone="token-pile"] button');
        expect(firstChipButton).toBeInTheDocument();
        fireEvent.click(firstChipButton!);

        expect(dispatch).not.toHaveBeenCalledWith(THE_GANG_COMMANDS.TAKE_CHIP, expect.anything());
        expect(screen.getByText(/房主开始抢劫后才能拿筹码|board\.toastStartBeforeChip/u)).toBeInTheDocument();
    });

    test('接入 The Gang 音效和 BGM 运行时配置', () => {
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

        renderBoardForCore(initial);

        expect(useGameAudioMock).toHaveBeenCalledWith(expect.objectContaining({
            config: THE_GANG_AUDIO_CONFIG,
            gameId: THE_GANG_MANIFEST.id,
            G: initial,
            ctx: { isGameOver: false },
        }));
    });

    test('两副手牌在本地手牌区显示为上下两排', () => {
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const twoHandCore: TheGangCore = {
            ...initial,
            rules: {
                ...initial.rules,
                config: {
                    ...initial.rules.config,
                    twoHand: true,
                },
            },
            communityCards: [
                standardCard('A', 'diamonds'),
                standardCard('A', 'clubs'),
                standardCard('2', 'hearts'),
            ],
            players: {
                ...initial.players,
                '0': {
                    ...initial.players['0'],
                    pocketCards: [standardCard('A', 'spades'), standardCard('K', 'hearts')],
                    secondaryPocketCards: [standardCard('Q', 'diamonds'), standardCard('J', 'clubs')],
                },
                '1': {
                    ...initial.players['1'],
                    pocketCards: [standardCard('7', 'spades'), standardCard('6', 'spades')],
                    secondaryPocketCards: [standardCard('5', 'spades'), standardCard('9', 'hearts')],
                },
                '2': {
                    ...initial.players['2'],
                    pocketCards: [standardCard('7', 'diamonds'), standardCard('J', 'hearts')],
                    secondaryPocketCards: [standardCard('8', 'spades'), standardCard('5', 'clubs')],
                },
            },
        };

        renderBoardForCore(twoHandCore);

        expect(screen.getByTestId('the-gang-local-hand-top')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-local-hand-bottom')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-local-hand-top').querySelectorAll('img')).toHaveLength(2);
        expect(screen.getByTestId('the-gang-local-hand-bottom').querySelectorAll('img')).toHaveLength(2);
        expect(screen.getAllByText('board.topHand').length).toBeGreaterThan(0);
        expect(screen.getAllByText('board.bottomHand').length).toBeGreaterThan(0);
        expect(screen.getByTestId('the-gang-local-hand-top-rank')).toHaveAttribute('data-rank-label', '三条');
        expect(screen.getByTestId('the-gang-local-hand-bottom-rank')).toHaveAttribute('data-rank-label', '一对');
        expect(screen.getByTestId('the-gang-local-hand-top-rank')).toHaveTextContent('三条');
        expect(screen.getByTestId('the-gang-local-hand-bottom-rank')).toHaveTextContent('一对');
        expect(screen.getByTestId('the-gang-local-hand-top-rank')).not.toHaveTextContent('board.topHand');
        expect(screen.getByTestId('the-gang-local-hand-bottom-rank')).not.toHaveTextContent('board.bottomHand');
    });

    test('单副手牌也在本地手牌区显示当前牌型提示', () => {
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const singleHandCore: TheGangCore = {
            ...initial,
            communityCards: [
                standardCard('A', 'diamonds'),
                standardCard('A', 'clubs'),
                standardCard('2', 'hearts'),
            ],
            players: {
                ...initial.players,
                '0': {
                    ...initial.players['0'],
                    pocketCards: [standardCard('A', 'spades'), standardCard('K', 'hearts')],
                    secondaryPocketCards: [],
                },
            },
        };

        renderBoardForCore(singleHandCore);

        expect(screen.getByTestId('the-gang-local-hand-top')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-local-hand-top').querySelectorAll('img')).toHaveLength(2);
        expect(screen.getByTestId('the-gang-local-hand-top-rank')).toHaveAttribute('data-rank-label', '三条');
        expect(screen.getByTestId('the-gang-local-hand-top-rank')).toHaveTextContent('board.singleHand');
        expect(screen.getByTestId('the-gang-local-hand-top-rank')).toHaveTextContent('三条');
        expect(screen.queryByTestId('the-gang-local-hand-bottom-rank')).not.toBeInTheDocument();
    });

    test('单副手牌自己的当前筹码挂在一副手牌上方', () => {
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const withLocalChip = reduceCommand(startHeistCore(initial), {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 2,
        } as Parameters<typeof TheGangDomain.execute>[1]);

        renderBoardForCore(withLocalChip);

        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveLength(2);
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).not.toHaveTextContent('玩家 1');
        expect(screen.queryByTestId('the-gang-player-chip-strip-0')).not.toBeInTheDocument();
        expect(screen.getByTestId('the-gang-local-hand-top-chip-rail').querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(1);
    });

    test('手牌调换阶段点击上下真实手牌后才能确认，也可以跳过', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const handSwapCore: TheGangCore = {
            ...initial,
            heistStarted: true,
            phase: 'hand-swap',
            rules: {
                ...initial.rules,
                config: {
                    ...initial.rules.config,
                    twoHand: true,
                },
            },
            currentRoundChips: {
                '0:top': 1,
                '0:bottom': 2,
                '1:top': 3,
                '1:bottom': 4,
                '2:top': 5,
                '2:bottom': 6,
            },
            players: {
                ...initial.players,
                '0': {
                    ...initial.players['0'],
                    pocketCards: [standardCard('A', 'spades'), standardCard('K', 'hearts')],
                    secondaryPocketCards: [standardCard('Q', 'diamonds'), standardCard('J', 'clubs')],
                },
                '1': {
                    ...initial.players['1'],
                    pocketCards: [standardCard('7', 'spades'), standardCard('6', 'spades')],
                    secondaryPocketCards: [standardCard('5', 'spades'), standardCard('9', 'hearts')],
                },
                '2': {
                    ...initial.players['2'],
                    pocketCards: [standardCard('7', 'diamonds'), standardCard('J', 'hearts')],
                    secondaryPocketCards: [standardCard('8', 'spades'), standardCard('5', 'clubs')],
                },
            },
        };

        const { unmount } = renderWithToast(
                <Board
                G={stateOf(handSwapCore)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        expect(screen.getByTestId('the-gang-hand-swap-stage')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-hand-swap-strip')).toHaveTextContent('board.handSwapSelectedCount');
        expect(screen.getByTestId('the-gang-confirm-hand-swap')).toBeDisabled();
        expect(screen.getByRole('img', { name: 'A♠' })).toBeInTheDocument();
        expect(screen.queryByTestId('the-gang-opponent-hand-1-rows')).not.toBeInTheDocument();
        expect(screen.queryByTestId('the-gang-opponent-hand-2-rows')).not.toBeInTheDocument();
        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] img[alt="board.cardBackAlt"]')).toHaveLength(0);
        expect(document.querySelectorAll('[data-bgg-zone="token-pile-current-chip"]')).toHaveLength(0);
        expect(document.querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(4);
        expect(document.querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(2);
        expect(screen.getByTestId('the-gang-local-hand-top-chip-rail')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-local-hand-bottom-chip-rail')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-player-chip-row-1-top')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-player-chip-row-1-bottom')).toBeInTheDocument();
        for (const exposedCard of ['7♠', '6♠', '5♠', '9♥', '7♦', 'J♥', '8♠', '5♣']) {
            expect(screen.queryByRole('img', { name: exposedCard })).not.toBeInTheDocument();
        }

        fireEvent.click(screen.getByTestId('the-gang-local-hand-top-card-0'));
        fireEvent.click(screen.getByTestId('the-gang-local-hand-bottom-card-1'));

        expect(screen.getByTestId('the-gang-local-hand-top-card-0')).toHaveAttribute('data-selected', 'true');
        expect(screen.getByTestId('the-gang-local-hand-bottom-card-1')).toHaveAttribute('data-selected', 'true');
        expect(screen.getByTestId('the-gang-confirm-hand-swap')).not.toBeDisabled();

        fireEvent.click(screen.getByTestId('the-gang-confirm-hand-swap'));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.CONFIRM_HAND_SWAP, {
            __internalPlayerId: '0',
            topIndex: 0,
            bottomIndex: 1,
        });
        unmount();

        dispatch.mockClear();
        renderWithToast(
                <Board
                G={stateOf(handSwapCore)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );
        fireEvent.click(screen.getByTestId('the-gang-skip-hand-swap'));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.CONFIRM_HAND_SWAP, {
            __internalPlayerId: '0',
        });
    });

    test('四人两副手牌第四轮未拿够撤离筹码时不能摊牌，撤离按钮按当前手牌派发命令', () => {
        const dispatch = vi.fn();
        const finalRoundCore = buildFourPlayerTwoHandFinalRoundCore();
        const matchData = matchDataForPlayerCount(4);

        const { unmount } = renderWithToast(
                <Board
                G={stateOf(finalRoundCore)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={matchData}
                isConnected
            />,
        );

        expect(screen.getByTestId('the-gang-exit-chip-row')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-exit-chip-button-1')).not.toBeDisabled();
        expect(screen.getByTestId('the-gang-exit-chip-button-2')).not.toBeDisabled();
        expect(document.querySelectorAll('[data-bgg-zone="exit-chip-token"] img')).toHaveLength(2);
        expect(screen.getByTestId('the-gang-exit-chip-button-1')).not.toHaveTextContent('撤离');
        expect(screen.getByTestId('the-gang-exit-chip-button-2')).not.toHaveTextContent('撤离');
        expect(screen.queryByTestId('the-gang-player-chip-strip-0')).not.toBeInTheDocument();
        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveLength(3);
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).not.toHaveTextContent('玩家 1');
        expect(screen.getByTestId('the-gang-local-hand-top-chip-rail').querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(1);
        expect(screen.getByTestId('the-gang-local-hand-bottom-chip-rail').querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(1);
        expect(screen.getByTestId('the-gang-player-chip-row-1-top').querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(1);
        expect(screen.getByTestId('the-gang-player-chip-row-1-bottom').querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(6);
        expect(document.querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(2);
        expect(screen.getByRole('button', { name: /board\.revealShowdown|摊牌/u })).toBeDisabled();

        fireEvent.click(screen.getByTestId('the-gang-exit-chip-button-1'));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.TAKE_EXIT_CHIP, {
            __internalPlayerId: '0',
            handSlot: 'top',
        });

        unmount();
        renderWithToast(
                <Board
                G={stateOf({
                    ...finalRoundCore,
                    currentRoundExitChipOwners: ['0:top', '1:bottom'],
                })}
                dispatch={dispatch as never}
                playerID="0"
                matchData={matchData}
                isConnected
            />,
        );

        expect(screen.queryByTestId('the-gang-exit-chip-row')).not.toBeInTheDocument();
        expect(screen.queryByTestId('the-gang-exit-chip-button-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('the-gang-exit-chip-button-2')).not.toBeInTheDocument();
        expect(screen.getByTestId('the-gang-local-hand-top-chip-rail').querySelectorAll('[data-testid="the-gang-exit-chip-badge"]')).toHaveLength(1);
        expect(screen.getByTestId('the-gang-player-chip-row-1-bottom').querySelectorAll('[data-testid="the-gang-exit-chip-badge"]')).toHaveLength(1);
        expect(screen.getByTestId('the-gang-local-hand-top-chip-rail').querySelectorAll('[data-bgg-zone="exit-chip-badge-token"] img')).toHaveLength(1);
        expect(screen.getByTestId('the-gang-player-chip-row-1-bottom').querySelectorAll('[data-bgg-zone="exit-chip-badge-token"] img')).toHaveLength(1);
        expect(screen.getByRole('button', { name: /board\.revealShowdown|摊牌/u })).not.toBeDisabled();
    });

    test('真实 Board 可以完成四轮抢劫并显示摊牌结果', () => {
        const readyForShowdown = buildCoreReadyForShowdown();
        const { unmount } = renderBoardForCore(readyForShowdown);

        expect(document.querySelector('[data-game-ui="the-gang"]')).toBeInTheDocument();
        expectBggTableAnchors();
        expect(readyForShowdown.communityCards).toHaveLength(5);
        expect(readyForShowdown.roundHistory).toHaveLength(3);
        expect(Object.keys(readyForShowdown.currentRoundChips)).toHaveLength(3);
        expect(document.querySelectorAll('[data-bgg-zone="card-river"] img')).toHaveLength(5);
        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveLength(2);
        expect(document.querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(2);
        expect(document.querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-bgg-zone="token-empty-slot"]')).toHaveLength(0);
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).not.toHaveTextContent('玩家 1');
        expect(document.querySelector('[data-bgg-zone="hand-groupzone"]')).not.toHaveTextContent('玩家 1');
        expect(screen.queryByTestId('the-gang-current-hand-rank')).not.toBeInTheDocument();
        expect(screen.queryByTestId('the-gang-hand-rank-nameplate-toggle')).not.toBeInTheDocument();
        expect(screen.getByTestId('the-gang-utility-dock')).toBeInTheDocument();
        expect(document.querySelector('[data-tutorial-id="the-gang-hand-rank-reference"]')).toBeInTheDocument();
        expect(screen.getAllByText('AI 2 号位').length).toBeGreaterThan(0);
        expect(screen.getAllByText('AI 3 号位').length).toBeGreaterThan(0);

        unmount();

        const pendingReveal = reduceCommand(readyForShowdown, {
            type: THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
            playerId: '0',
            payload: {},
            timestamp: 500,
        } as Parameters<typeof TheGangDomain.execute>[1]);
        expect(pendingReveal.lastShowdown).toBeUndefined();
        expect(pendingReveal.pendingProgress).toEqual({ kind: 'reveal-showdown', approvals: ['0'] });

        const revealed = confirmProgressForAllPlayers(pendingReveal, THE_GANG_COMMANDS.REVEAL_SHOWDOWN, 510);
        renderBoardForCore(revealed);

        expect(document.querySelector('[data-bgg-zone="reveal-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-tutorial-id="the-gang-showdown-result"]')).toBeInTheDocument();
        expect(document.querySelector('[data-tutorial-id="the-gang-showdown-community-cards"]')).toBeInTheDocument();
        expect(document.querySelector('[data-tutorial-id="the-gang-showdown-hole-cards"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="safe-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="reveal-players"]')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-bgg-zone="reveal-community-cards"] img')).toHaveLength(5);
        expect(document.querySelectorAll('[data-bgg-zone="reveal-pocket-cards"]')).toHaveLength(3);
        expect(document.querySelectorAll('[data-bgg-zone="reveal-pocket-cards"] img')).toHaveLength(6);
        expect(screen.getAllByText('AI 2 号位').length).toBeGreaterThan(0);
        expect(screen.getAllByText('AI 3 号位').length).toBeGreaterThan(0);
        expect(revealed.lastShowdown?.outcome).toBe('success');
        expect(screen.getByRole('button', { name: 'board.nextHeist' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '摊牌' })).not.toBeInTheDocument();
    });

    test('选筹阶段显示玩家名但不显示无意义切座，也不在顶部重复底牌', () => {
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const { unmount } = renderBoardForCore(initial);

        expect(document.querySelector('[data-tutorial-id="the-gang-player-list"]')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveLength(2);
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).not.toHaveTextContent('玩家 1');
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).toHaveTextContent('AI 2 号位');
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).toHaveTextContent('AI 3 号位');
        expect(document.querySelector('[data-testid="the-gang-hotseat-switcher"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-testid="the-gang-showdown-hotseat-switcher"]')).not.toBeInTheDocument();
        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="opponent-cards"] img')).toHaveLength(0);
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).not.toHaveTextContent('2♣');
        expect(screen.queryByTestId('the-gang-current-hand-rank')).not.toBeInTheDocument();
        expect(screen.queryByTestId('the-gang-hand-rank-nameplate-toggle')).not.toBeInTheDocument();
        expect(document.querySelector('[data-tutorial-id="the-gang-hand-rank-reference"]')).toBeInTheDocument();

        unmount();

        const started = startHeistCore(initial);
        const withOpponentChip = reduceCommand(started, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 2 },
            timestamp: 2,
        } as Parameters<typeof TheGangDomain.execute>[1]);
        renderBoardForCore(withOpponentChip);

        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveLength(2);
        expect(document.querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(1);
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).not.toHaveTextContent('玩家 1');
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).toHaveTextContent('AI 2 号位');
    });

    test('选筹阶段可以直接点击对手当前轮筹码拿走', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const started = startHeistCore(initial);
        const withOpponentChip = reduceCommand(started, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 2 },
            timestamp: 2,
        } as Parameters<typeof TheGangDomain.execute>[1]);

        renderWithToast(
                <Board
                G={stateOf(withOpponentChip)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        screen.getByTestId('the-gang-take-player-chip-1-single').click();

        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.TAKE_CHIP, {
            __internalPlayerId: '0',
            chip: 2,
        });
    });

    test('真实 Board 会把撤回状态提供给通用 HUD 上下文', () => {
        render(<HarnessBoard />);

        expect(screen.getByTestId('undo-provider-state')).toHaveTextContent('0:local');
    });

    test('扩展设置面板复用牌桌折叠入口并派发规则配置命令', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

        renderWithToast(
                <Board
                G={stateOf(initial)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        expect(screen.getByTestId('the-gang-rules-config')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'board.rulesConfig' }));
        expect(screen.getByTestId('the-gang-rules-modal')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: '快速通道' })).toHaveAttribute('src', expect.stringContaining('/assets/i18n/zh-CN/the-gang/rule-assets/challenges/compressed/quick-access.webp'));
        expect(screen.getByRole('img', { name: '万能钥匙' })).toHaveAttribute('src', expect.stringContaining('/assets/i18n/zh-CN/the-gang/rule-assets/challenges/compressed/master-key.webp'));
        expect(screen.getByTestId('the-gang-rule-toggle-omaha')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-rule-toggle-twoHand')).toBeInTheDocument();
        expect(screen.queryByTestId('the-gang-rule-toggle-handSwap')).not.toBeInTheDocument();
        expect(screen.getByTestId('the-gang-rule-toggle-automode')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-rule-toggle-antiTroll')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-exit-mode-mastermind')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('the-gang-rule-toggle-omaha'));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.SET_RULES_CONFIG, {
            __internalPlayerId: '0',
            config: {
                gameMode: 'texas-holdem',
                exitChipMode: 'default',
                omaha: true,
                twoHand: false,
                handSwap: false,
                automode: false,
                antiTroll: false,
                challenges: {},
                lockedHandRanks: [],
            },
        });

        fireEvent.click(screen.getByTestId('the-gang-exit-mode-mastermind'));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.SET_RULES_CONFIG, {
            __internalPlayerId: '0',
            config: {
                gameMode: 'texas-holdem',
                exitChipMode: 'mastermind',
                omaha: false,
                twoHand: false,
                handSwap: false,
                automode: false,
                antiTroll: false,
                challenges: {},
                lockedHandRanks: [],
            },
        });

        fireEvent.click(screen.getByTestId('the-gang-mode-seven-card-stud'));

        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.SET_RULES_CONFIG, {
            __internalPlayerId: '0',
            config: {
                gameMode: 'seven-card-stud',
                exitChipMode: 'default',
                omaha: false,
                twoHand: false,
                handSwap: false,
                automode: false,
                antiTroll: false,
                challenges: {},
                lockedHandRanks: [],
            },
        });
    });

    test('扩展设置权限跟随房主标记而不是固定 0 号位', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

        renderWithToast(
                <Board
                G={stateOf(initial)}
                dispatch={dispatch as never}
                playerID="1"
                matchData={[
                    { id: 0, name: '玩家 1', isConnected: true },
                    { id: 1, name: '玩家 2', isConnected: true, isOwner: true },
                    { id: 2, name: '玩家 3', isConnected: true },
                ]}
                isConnected
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'board.rulesConfig' }));
        fireEvent.click(screen.getByTestId('the-gang-rule-toggle-omaha'));

        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.SET_RULES_CONFIG, expect.objectContaining({
            __internalPlayerId: '1',
            config: expect.objectContaining({ omaha: true }),
        }));
    });

    test('房主开局后改规则会先提示重新开始', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const lockedCore = startHeistCore(initial);
        const originalConfirm = window.confirm;
        const confirmSpy = vi.fn()
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);
        Object.defineProperty(window, 'confirm', {
            configurable: true,
            value: confirmSpy,
        });

        try {
            renderWithToast(
                <Board
                    G={stateOf(lockedCore)}
                    dispatch={dispatch as never}
                    playerID="0"
                    matchData={defaultMatchData}
                    isConnected
                />,
            );

            fireEvent.click(screen.getByRole('button', { name: 'board.rulesConfig' }));

            expect(screen.getByText('board.rulesDialogRestartHostHint')).toBeInTheDocument();
            expect(screen.getByText('board.rulesRestartNotice')).toBeInTheDocument();
            expect(screen.getByTestId('the-gang-rule-toggle-omaha')).toHaveAttribute('aria-disabled', 'false');

            fireEvent.click(screen.getByTestId('the-gang-rule-toggle-omaha'));
            expect(confirmSpy).toHaveBeenCalledWith('board.confirmRulesRestart');
            expect(dispatch).not.toHaveBeenCalledWith(THE_GANG_COMMANDS.SET_RULES_CONFIG, expect.anything());

            fireEvent.click(screen.getByTestId('the-gang-rule-toggle-omaha'));
            expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.SET_RULES_CONFIG, expect.objectContaining({
                __internalPlayerId: '0',
                config: expect.objectContaining({ omaha: true }),
            }));
        } finally {
            if (originalConfirm) {
                Object.defineProperty(window, 'confirm', {
                    configurable: true,
                    value: originalConfirm,
                });
            } else {
                delete (window as Window & { confirm?: Window['confirm'] }).confirm;
            }
        }
    });

    test('工具面板可以发放工具牌并通过已实现工具派发使用命令', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const localToolCore: TheGangCore = {
            ...initial,
            players: {
                ...initial.players,
                '0': {
                    ...initial.players['0'],
                    toolCards: ['burner-phone', 'flashlight', 'night-vision-goggles', 'airpods'],
                    specialistCards: ['mastermind'],
                },
            },
        };

        const { unmount } = renderWithToast(
                <Board
                G={stateOf(initial)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        expect(screen.getByTestId('the-gang-tools-panel')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'board.toolPanelSummary' }));
        expect(screen.getByTestId('the-gang-tools-deal-status')).toHaveTextContent('board.toolsReadyToDealStatus');
        fireEvent.click(screen.getByRole('button', { name: 'board.dealTools' }));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.DEAL_TOOLS, {
            __internalPlayerId: '0',
        });
        fireEvent.click(screen.getByRole('button', { name: 'board.resetTools' }));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.RESET_TOOLS, {
            __internalPlayerId: '0',
        });
        fireEvent.click(screen.getByRole('button', { name: 'board.resetSpecialists' }));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.RESET_SPECIALISTS, {
            __internalPlayerId: '0',
        });
        unmount();

        renderWithToast(
            <Board
                G={stateOf(localToolCore)}
                dispatch={dispatch as never}
                playerID="0"
                matchData={defaultMatchData}
                isConnected
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'board.toolPanelSummary' }));
        expect(screen.getByTestId('the-gang-tool-card-grid')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-specialist-card-grid')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: '一次性手机' })).toHaveAttribute('src', expect.stringContaining('/assets/i18n/zh-CN/the-gang/rule-assets/tools/compressed/burner-phone.webp'));
        expect(screen.getByRole('img', { name: '手电筒' })).toHaveAttribute('src', expect.stringContaining('/assets/i18n/zh-CN/the-gang/rule-assets/tools/compressed/flashlight.webp'));
        expect(screen.getByRole('img', { name: 'Mastermind' })).toHaveAttribute('src', expect.stringContaining('/assets/i18n/zh-CN/the-gang/rule-assets/specialists/compressed/mastermind.webp'));
        expect(screen.getByText('board.toolDrawOnlyBadge')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /一次性手机/ }));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.USE_TOOL, {
            __internalPlayerId: '0',
            tool: 'burner-phone',
        });
        fireEvent.click(screen.getByRole('button', { name: /手电筒/ }));
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.USE_TOOL, {
            __internalPlayerId: '0',
            tool: 'flashlight',
        });

        fireEvent.click(screen.getByRole('button', { name: /夜视眼镜/ }));
        const nightVisionPicker = screen.getByTestId('the-gang-night-vision-picker');
        expect(nightVisionPicker).toBeInTheDocument();
        const nightVisionCardButtons = within(nightVisionPicker).getAllByRole('button', { name: 'board.chooseNightVisionCard' });
        fireEvent.click(nightVisionCardButtons[1]);
        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.USE_TOOL, {
            __internalPlayerId: '0',
            tool: 'night-vision-goggles',
            cardIndex: 1,
        });
    });
});
