/* @vitest-environment happy-dom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
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

const chooseFinalRoundChips = () => {
    const finalCore = TheGangDomain.setup(['0', '1', '2'], fixedRandom);
    let core = finalCore;

    for (const round of [1, 2, 3]) {
        for (const [index, playerId] of core.playerIds.entries()) {
            const state = stateOf(core);
            core = TheGangDomain.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: round * 10 + index,
            }, fixedRandom).reduce((nextCore, event) => TheGangDomain.reduce(nextCore, event), core);
        }

        const state = stateOf(core);
        core = TheGangDomain.execute(state, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: round * 100,
        }, fixedRandom).reduce((nextCore, event) => TheGangDomain.reduce(nextCore, event), core);
    }

    return finalRoundChipsFor(core);
};

describe('The Gang Board 运行入口', () => {
    test('真实 Board 可以完成四轮抢劫并显示摊牌结果', () => {
        render(<HarnessBoard />);

        expect(screen.getByText('纸牌帮')).toBeInTheDocument();
        expect(screen.getByText('抢劫 1')).toBeInTheDocument();
        expect(screen.getByText('第 1 轮 · 白筹码')).toBeInTheDocument();
        expect(screen.getByLabelText('公共牌牌槽')).toBeInTheDocument();
        expect(screen.getByLabelText('金库 0/3，警报 0/3')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '下一轮' })).toBeDisabled();

        const layoutRoot = screen.getByText('纸牌帮').closest('[data-layout-contract]');
        expect(layoutRoot).toHaveAttribute('data-layout-contract', 'bgg-electronic');
        expect(layoutRoot).toHaveAttribute('data-layout-source', 'BGG electronic DOM/CSS');
        expect(screen.getByTestId('the-gang-layout-contract')).toHaveTextContent('BGG 电子版结构');
        expect(document.querySelector('[data-bgg-zone="top-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="middle-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="bottom-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="token-pile"]')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-bgg-zone="token-slot"]')).toHaveLength(4);
        expect(document.querySelector('[data-bgg-zone="card-river"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="vaults-alarms-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="hand-groupzone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="player-tokens"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="hand-chips"]')).toBeInTheDocument();

        for (const round of [1, 2, 3]) {
            const chipLabel = ['白筹码', '黄筹码', '橙筹码'][round - 1];
            fireEvent.click(screen.getByRole('button', { name: '切到玩家 1' }));
            fireEvent.click(screen.getByRole('button', { name: `${chipLabel} 1 星` }));
            fireEvent.click(screen.getByRole('button', { name: '切到玩家 2' }));
            fireEvent.click(screen.getByRole('button', { name: `${chipLabel} 2 星` }));
            fireEvent.click(screen.getByRole('button', { name: '切到玩家 3' }));
            fireEvent.click(screen.getByRole('button', { name: `${chipLabel} 3 星` }));
            expect(screen.getByRole('button', { name: '下一轮' })).toBeEnabled();
            fireEvent.click(screen.getByRole('button', { name: '下一轮' }));
            expect(screen.getByText(`第 ${round + 1} 轮 · ${['', '', '黄筹码', '橙筹码', '红筹码'][round + 1]}`)).toBeInTheDocument();
        }

        const finalRoundChips = chooseFinalRoundChips();
        fireEvent.click(screen.getByRole('button', { name: '切到玩家 1' }));
        fireEvent.click(screen.getByRole('button', { name: `红筹码 ${finalRoundChips['0']} 星` }));
        fireEvent.click(screen.getByRole('button', { name: '切到玩家 2' }));
        fireEvent.click(screen.getByRole('button', { name: `红筹码 ${finalRoundChips['1']} 星` }));
        fireEvent.click(screen.getByRole('button', { name: '切到玩家 3' }));
        fireEvent.click(screen.getByRole('button', { name: `红筹码 ${finalRoundChips['2']} 星` }));

        expect(screen.getByRole('button', { name: '摊牌' })).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: '摊牌' }));

        expect(screen.getByLabelText('摊牌结算')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="reveal-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="reveal-final"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="safe-zone"]')).toBeInTheDocument();
        expect(document.querySelector('[data-bgg-zone="reveal-players"]')).toBeInTheDocument();
        expect(screen.getByText('抢劫成功')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '下一次抢劫' })).toBeInTheDocument();
        expect(screen.getAllByLabelText('成功 1').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByLabelText('失败 0').length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByRole('button', { name: '摊牌' })).not.toBeInTheDocument();
    });

    test('真实 Board 会把撤回状态提供给通用 HUD 上下文', () => {
        render(<HarnessBoard />);

        expect(screen.getByTestId('undo-provider-state')).toHaveTextContent('0:local');
    });
});
