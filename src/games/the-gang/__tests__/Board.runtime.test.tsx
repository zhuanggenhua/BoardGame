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
import { THE_GANG_COMMANDS, type ShowdownPlayerResult, type TheGangCore } from '../domain/types';
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
        [result.playerId]: index + 1,
    }), {});

const fixedRandom = { random: () => 0 };

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
    expect(document.querySelector('[data-bgg-zone="hand-chips"]')).toBeInTheDocument();
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
        expect(screen.queryByRole('button', { name: 'board.nextRound' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('the-gang-start-heist'));

        expect(dispatch).toHaveBeenCalledWith(THE_GANG_COMMANDS.START_HEIST, {
            __internalPlayerId: '0',
        });
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

    test('真实 Board 可以完成四轮抢劫并显示摊牌结果', () => {
        const readyForShowdown = buildCoreReadyForShowdown();
        const { unmount } = renderBoardForCore(readyForShowdown);

        expect(document.querySelector('[data-game-ui="the-gang"]')).toBeInTheDocument();
        expectBggTableAnchors();
        expect(readyForShowdown.communityCards).toHaveLength(5);
        expect(readyForShowdown.roundHistory).toHaveLength(3);
        expect(Object.keys(readyForShowdown.currentRoundChips)).toHaveLength(3);
        expect(document.querySelectorAll('[data-bgg-zone="card-river"] img')).toHaveLength(5);
        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveLength(3);
        expect(document.querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(3);
        expect(document.querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-bgg-zone="token-empty-slot"]')).toHaveLength(0);
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).toHaveTextContent('玩家 1');
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
        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveLength(3);
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).toHaveTextContent('玩家 1');
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

        expect(document.querySelectorAll('[data-bgg-zone="top-zone"] [data-bgg-zone="plboard"]')).toHaveLength(3);
        expect(document.querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(1);
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

        screen.getByTestId('the-gang-take-player-chip-1').click();

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

    test('房主开局后规则设置会明确显示锁定而不是权限失效', () => {
        const dispatch = vi.fn();
        const initial = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
        const lockedCore = startHeistCore(initial);

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

        expect(screen.getByText('board.rulesDialogLockedHostHint')).toBeInTheDocument();
        expect(screen.getByText('board.rulesLocked')).toBeInTheDocument();
        expect(screen.getByTestId('the-gang-rule-toggle-omaha')).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(screen.getByTestId('the-gang-rule-toggle-omaha'));
        expect(dispatch).not.toHaveBeenCalledWith(THE_GANG_COMMANDS.SET_RULES_CONFIG, expect.anything());
        expect(screen.getByText(/扩展设置不能再修改|board\.toastRulesLocked/u)).toBeInTheDocument();
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
