/* @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MatchState } from '../../engine/types';
import type { GameClientContextValue } from '../../engine/transport/reactContext';
import { GameClientContext } from '../../engine/transport/reactContext';
import { useGameClient } from '../../engine/transport/react';
import type { GameEngineConfig } from '../../engine/transport/server';
import { OnlineManualSetupSelectionBridge } from '../onlineManualSetupSelectionBridge';

const buildSetupState = (): MatchState<unknown> => ({
    core: {
        hostStarted: false,
        selectedFactions: {
            '0': 'unselected',
            '1': 'unselected',
        },
        selectedCharacters: {
            '0': 'unselected',
            '1': 'unselected',
        },
        readyPlayers: {
            '0': false,
            '1': false,
        },
    },
    sys: {
        phase: 'setup',
    },
} as MatchState<unknown>);

const seatControllers = {
    '0': { type: 'human' },
    '1': { type: 'local-ai', manualFactionSelection: true },
} as const;

const Probe = () => {
    const { state, playerId, dispatch } = useGameClient();
    const core = (state?.core ?? {}) as {
        selectedFactions?: Record<string, string>;
        selectedCharacters?: Record<string, string>;
    };

    return (
        <div>
            <div data-testid="player-id">{playerId ?? 'none'}</div>
            <div data-testid="host-start-control">{playerId === '0' ? 'visible' : 'hidden'}</div>
            <div data-testid="ai-faction">{core.selectedFactions?.['1'] ?? 'missing'}</div>
            <div data-testid="ai2-faction">{core.selectedFactions?.['2'] ?? 'missing'}</div>
            <div data-testid="ai-character">{core.selectedCharacters?.['1'] ?? 'missing'}</div>
            <button
                type="button"
                data-testid="select-faction"
                onClick={() => dispatch('sw:select_faction', { factionId: 'trickster' })}
            >
                select faction
            </button>
            <button
                type="button"
                data-testid="select-second-faction"
                onClick={() => dispatch('sw:select_faction', { factionId: 'necromancer' })}
            >
                select second faction
            </button>
            <button
                type="button"
                data-testid="select-character"
                onClick={() => dispatch('SELECT_CHARACTER', { characterId: 'gunslinger' })}
            >
                select character
            </button>
            <button
                type="button"
                data-testid="ready-sw"
                onClick={() => dispatch('sw:player_ready', {})}
            >
                ready sw
            </button>
            <button
                type="button"
                data-testid="ready-dt"
                onClick={() => dispatch('PLAYER_READY', {})}
            >
                ready dt
            </button>
        </div>
    );
};

function renderBridge(args?: {
    state?: MatchState<unknown>;
    seatControllers?: GameClientContextValue['seatControllers'];
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
    requestManualSetupSelection?: GameClientContextValue['requestManualSetupSelection'];
    dispatchManualSetupCommand?: (playerId: string, type: string, payload: unknown) => boolean;
}) {
    const requestManualSetupSelection = args?.requestManualSetupSelection ?? vi.fn(() => true);
    const dispatch = vi.fn();
    const activeSeatControllers = args?.seatControllers ?? seatControllers;
    const buildContextValue = (state: MatchState<unknown>): GameClientContextValue => ({
        state,
        dispatch,
        requestManualSetupSelection,
        playerId: '0',
        matchPlayers: [],
        seatControllers: activeSeatControllers,
        isConnected: true,
        isMultiplayer: true,
    });
    const renderTree = (state: MatchState<unknown>) => (
        <GameClientContext.Provider value={buildContextValue(state)}>
            <OnlineManualSetupSelectionBridge
                seatControllers={activeSeatControllers ?? {}}
                dispatchManualSetupCommand={args?.dispatchManualSetupCommand ?? null}
                engineConfig={args?.engineConfig ?? null}
            >
                <Probe />
            </OnlineManualSetupSelectionBridge>
        </GameClientContext.Provider>
    );

    const renderResult = render(renderTree(args?.state ?? buildSetupState()));

    return {
        dispatch,
        requestManualSetupSelection,
        rerenderWithState: (state: MatchState<unknown>) => renderResult.rerender(renderTree(state)),
    };
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('OnlineManualSetupSelectionBridge', () => {
    it('SummonerWars 前置阵营由真人房主页面代选时，应保留房主身份并立即请求 AI 座位选择', () => {
        const requestManualSetupSelection = vi.fn(() => true);
        renderBridge({ requestManualSetupSelection });

        expect(screen.getByTestId('player-id').textContent).toBe('0');
        expect(screen.getByTestId('host-start-control').textContent).toBe('visible');
        expect(screen.getByTestId('ai-faction').textContent).toBe('unselected');

        fireEvent.click(screen.getByTestId('select-faction'));

        expect(requestManualSetupSelection).toHaveBeenCalledTimes(1);
        expect(requestManualSetupSelection.mock.calls[0]?.[0]).toEqual({
            targetPlayerId: '1',
            actionKind: 'setup-select-faction',
            selectionId: 'trickster',
        });
        expect(screen.getByTestId('ai-faction').textContent).toBe('trickster');
    });

    it('DiceThrone 前置角色由真人房主页面代选时，应走同一套通用手动准备请求', () => {
        const requestManualSetupSelection = vi.fn(() => true);
        renderBridge({ requestManualSetupSelection });

        expect(screen.getByTestId('player-id').textContent).toBe('0');
        expect(screen.getByTestId('host-start-control').textContent).toBe('visible');

        fireEvent.click(screen.getByTestId('select-character'));

        expect(requestManualSetupSelection).toHaveBeenCalledTimes(1);
        expect(requestManualSetupSelection.mock.calls[0]?.[0]).toEqual({
            targetPlayerId: '1',
            actionKind: 'setup-select-character',
            selectionId: 'gunslinger',
        });
        expect(screen.getByTestId('ai-character').textContent).toBe('gunslinger');
    });

    it('未勾选玩家代选时，不应拦截真人选派系或请求服务端替 AI 选择', () => {
        const requestManualSetupSelection = vi.fn(() => true);
        const { dispatch } = renderBridge({
            requestManualSetupSelection,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        });

        expect(screen.getByTestId('player-id').textContent).toBe('0');
        expect(screen.getByTestId('host-start-control').textContent).toBe('visible');

        fireEvent.click(screen.getByTestId('select-faction'));

        expect(requestManualSetupSelection).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith('sw:select_faction', { factionId: 'trickster' });
        expect(screen.getByTestId('ai-faction').textContent).toBe('unselected');
    });

    it('旧 AI 草稿被 shared state 确认后，不应吞掉下一名 AI 的第一次候选点击', () => {
        const initialState = buildSetupState();
        const initialCore = initialState.core as {
            selectedFactions: Record<string, string>;
            selectedCharacters: Record<string, string>;
            readyPlayers: Record<string, boolean>;
        };
        initialCore.selectedFactions['2'] = 'unselected';
        initialCore.selectedCharacters['2'] = 'unselected';
        initialCore.readyPlayers['2'] = false;

        const confirmedFirstAiState = buildSetupState();
        const confirmedCore = confirmedFirstAiState.core as {
            selectedFactions: Record<string, string>;
            selectedCharacters: Record<string, string>;
            readyPlayers: Record<string, boolean>;
        };
        confirmedCore.selectedFactions['1'] = 'trickster';
        confirmedCore.selectedFactions['2'] = 'unselected';
        confirmedCore.selectedCharacters['2'] = 'unselected';
        confirmedCore.readyPlayers['1'] = true;
        confirmedCore.readyPlayers['2'] = false;

        const requestManualSetupSelection = vi.fn(() => true);
        const { rerenderWithState } = renderBridge({
            state: initialState,
            requestManualSetupSelection,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
                '2': { type: 'local-ai', manualFactionSelection: true },
            },
        });

        fireEvent.click(screen.getByTestId('select-faction'));
        expect(screen.getByTestId('ai-faction').textContent).toBe('trickster');

        rerenderWithState(confirmedFirstAiState);
        expect(screen.getByTestId('player-id').textContent).toBe('0');
        expect(screen.getByTestId('host-start-control').textContent).toBe('visible');

        fireEvent.click(screen.getByTestId('select-second-faction'));

        expect(requestManualSetupSelection).toHaveBeenLastCalledWith({
            targetPlayerId: '2',
            actionKind: 'setup-select-faction',
            selectionId: 'necromancer',
        }, expect.any(Function));
        expect(screen.getByTestId('ai2-faction').textContent).toBe('necromancer');
    });

    it('SmashUp 已有确认按钮的 select-faction 仍由确认动作立即提交', () => {
        const requestManualSetupSelection = vi.fn(() => true);
        renderBridge({
            requestManualSetupSelection,
            engineConfig: {
                gameId: 'smashup',
                onlineAiRecovery: {
                    resolveManualSetupSelectionActionKindFromCommand: ({ payload }) => (
                        typeof (payload as { factionId?: unknown } | undefined)?.factionId === 'string'
                            ? 'select-faction'
                            : undefined
                    ),
                },
            },
        });

        fireEvent.click(screen.getByTestId('select-faction'));

        expect(requestManualSetupSelection).toHaveBeenCalledTimes(1);
        expect(requestManualSetupSelection.mock.calls[0]?.[0]).toEqual({
            targetPlayerId: '1',
            actionKind: 'select-faction',
            selectionId: 'trickster',
        });
    });
});
