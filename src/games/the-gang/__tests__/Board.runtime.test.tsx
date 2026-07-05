/* @vitest-environment happy-dom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { useUndo } from '../../../contexts/UndoContext';
import Board from '../Board';
import { TheGangDomain, buildShowdownResults } from '../domain';
import { THE_GANG_COMMANDS, type ShowdownPlayerResult, type TheGangCore } from '../domain/types';

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
        <>
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
                    { id: 0, name: '玩家 1', isConnected: true },
                    { id: 1, name: '玩家 2', isConnected: true },
                    { id: 2, name: '玩家 3', isConnected: true },
                ]}
                isConnected
            />
            <UndoProbe />
        </>
    );
}

const reduceCommand = (
    core: TheGangCore,
    command: Parameters<typeof TheGangDomain.execute>[1],
) => TheGangDomain.execute(stateOf(core), command, fixedRandom)
    .reduce((nextCore, event) => TheGangDomain.reduce(nextCore, event), core);

const buildCoreReadyForShowdown = () => {
    let core = TheGangDomain.setup(['0', '1', '2'], fixedRandom);

    for (const round of [1, 2, 3]) {
        for (const [index, playerId] of core.playerIds.entries()) {
            core = reduceCommand(core, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: round * 10 + index,
            } as Parameters<typeof TheGangDomain.execute>[1]);
        }

        core = reduceCommand(core, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: round * 100,
        } as Parameters<typeof TheGangDomain.execute>[1]);
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

const renderBoardForCore = (core: TheGangCore) => render(
    <Board
        G={stateOf(core)}
        dispatch={vi.fn() as never}
        playerID="0"
        matchData={[
            { id: 0, name: '玩家 1', isConnected: true },
            { id: 1, name: '玩家 2', isConnected: true },
            { id: 2, name: '玩家 3', isConnected: true },
        ]}
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
    test('真实 Board 可以完成四轮抢劫并显示摊牌结果', () => {
        const readyForShowdown = buildCoreReadyForShowdown();
        const { unmount } = renderBoardForCore(readyForShowdown);

        expect(document.querySelector('[data-game-ui="the-gang"]')).toBeInTheDocument();
        expectBggTableAnchors();
        expect(readyForShowdown.communityCards).toHaveLength(5);
        expect(readyForShowdown.roundHistory).toHaveLength(3);
        expect(Object.keys(readyForShowdown.currentRoundChips)).toHaveLength(3);
        expect(document.querySelectorAll('[data-bgg-zone="card-river"] img')).toHaveLength(5);
        expect(document.querySelectorAll('[data-bgg-zone="player-current-token"]')).toHaveLength(3);
        expect(document.querySelectorAll('[data-bgg-zone="hand-current-chip"]')).toHaveLength(1);

        unmount();

        const revealed = reduceCommand(readyForShowdown, {
            type: THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
            playerId: '0',
            payload: {},
            timestamp: 500,
        } as Parameters<typeof TheGangDomain.execute>[1]);
        renderBoardForCore(revealed);

        expect(document.querySelector('[data-bgg-zone="reveal-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="safe-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="reveal-players"]')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'board.nextHeist' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '摊牌' })).not.toBeInTheDocument();
    });

    test('真实 Board 会把撤回状态提供给通用 HUD 上下文', () => {
        render(<HarnessBoard />);

        expect(screen.getByTestId('undo-provider-state')).toHaveTextContent('0:local');
    });
});
