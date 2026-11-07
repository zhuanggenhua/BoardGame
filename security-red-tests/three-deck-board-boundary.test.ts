/* @vitest-environment happy-dom */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { MatchState } from '../src/engine/types';
import type { PixiMapSceneHostProps } from '../src/engine/mapRenderer';
import { applyMatchPlayerView } from '../src/engine/transport/stateProjection';
import { TutorialProvider } from '../src/contexts/TutorialContext';
import { GameModeProvider, type GameMode } from '../src/contexts/GameModeContext';
import { ToastProvider } from '../src/contexts/ToastContext';
import Board from '../src/games/betrayal/Board';
import { BetrayalDomain, type BetrayalCore } from '../src/games/betrayal/game';
import { BETRAYAL_COMMANDS } from '../src/games/betrayal/commands';
import { applyBetrayalCommand, createBetrayalCommand, createStartedFirstScenarioCore } from '../src/games/betrayal/testing/firstScenarioTestUtils';
import { createSyntheticMatch } from './transportCapture';
import gameLocale from '../public/locales/zh-CN/game-betrayal.json';
import commonLocale from '../public/locales/zh-CN/common.json';

// Real Board and domain. Only rendering/media and translation boundaries are
// replaced, following the existing Board.foundation component-test contract.
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const [namespace, plainKey] = key.includes(':') ? key.split(':', 2) : ['game-betrayal', key];
            const tree = namespace === 'common' ? commonLocale : gameLocale;
            const value = plainKey.split('.').reduce<unknown>((node, part) => node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined, tree);
            return typeof value === 'string' ? value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => String(options?.[token] ?? '')) : key;
        },
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
vi.mock('../src/components/common/media/OptimizedImage', () => ({
    OptimizedImage: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', { ...rest, alt, 'data-src': src }),
}));
vi.mock('../src/games/betrayal/useBetrayalAmbience', () => ({ useBetrayalAmbience: vi.fn() }));
vi.mock('../src/lib/audio/useGameAudio', () => ({ playSound: vi.fn(), useGameAudio: vi.fn() }));
vi.mock('../src/games/betrayal/discoveryMistSurface', () => ({ BetrayalDiscoveryMist: () => null }));
vi.mock('../src/games/betrayal/roomLightingSurface', () => ({ BetrayalRoomLighting: () => null }));
vi.mock('../src/games/betrayal/explorerLightSurface', () => ({ BetrayalExplorerLight: () => null }));
vi.mock('../src/engine/mapRenderer', async () => {
    const ReactActual = await vi.importActual<typeof import('react')>('react');
    return {
        PixiMapSceneHost: (props: PixiMapSceneHostProps) => {
            const current = ReactActual.useRef(props);
            ReactActual.useLayoutEffect(() => { current.current = props; }, [props]);
            ReactActual.useEffect(() => { current.current.onResourceStateChange?.({ status: 'ready', resourceUrl: props.backgroundUrl ?? '' }); }, [props.backgroundUrl]);
            ReactActual.useEffect(() => { current.current.onDisplayViewportChange?.(props.viewport); }, [props.viewport.zoom, props.viewport.panX, props.viewport.panY]);
            return ReactActual.createElement('div', { 'data-testid': 'test-map-renderer' });
        },
    };
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function preparedCore() {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    core.currentExplorer.inventory = [{ id: 'omen-book', name: '书本', kind: 'omen' }];
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.turnStartInventoryCardIds = ['omen-book'];
    return core;
}

function stateFor(core: BetrayalCore, mode: GameMode): MatchState<BetrayalCore> {
    const match = createSyntheticMatch();
    match.state = { ...match.state, core };
    return (mode === 'online' ? applyMatchPlayerView(match, '0') : match.state) as MatchState<BetrayalCore>;
}

function boardTree(state: MatchState<unknown>, mode: GameMode, dispatch: (type: string, payload: unknown) => void) {
    return React.createElement(ToastProvider, null,
        React.createElement(TutorialProvider, null,
            React.createElement(GameModeProvider, { mode, children:
                React.createElement(Board, {
                    G: state as MatchState<BetrayalCore>, dispatch,
                    playerID: '0', isConnected: true, isMultiplayer: mode === 'online',
                    matchData: [0, 1, 2].map(id => ({ id, name: `Test ${id}`, isConnected: true })),
                }),
            }),
        ),
    );
}

describe('USE_POSSESSION Board authority boundary', () => {
    it.each(['online', 'local'] as const)('%s: real clicks dispatch once; only local mode retains domain preview', (mode) => {
        const authority = preparedCore();
        const before = JSON.stringify(authority);
        const state = stateFor(authority, mode) as MatchState<BetrayalCore>;
        expect(state.core.eventOrder.length === 0).toBe(mode === 'online');
        expect(state.core.possessionOrderByKind.item.length === 0).toBe(mode === 'online');
        const dispatch = vi.fn();
        const rendered = render(boardTree(state, mode, dispatch));
        fireEvent.click(screen.getByTestId('betrayal-inventory-omen-book'));
        expect(screen.getByTestId('betrayal-action-use')).toBeEnabled();

        // Pass-through spies observe the actual domain, never substitute it.
        // Dispatch is a network sink here, so any domain call before the
        // authoritative response can only be a Board-local preview.
        const execute = vi.spyOn(BetrayalDomain, 'execute');
        const reduce = vi.spyOn(BetrayalDomain, 'reduce');
        fireEvent.click(screen.getByTestId('betrayal-action-use'));
        expect(dispatch).toHaveBeenCalledExactlyOnceWith(BETRAYAL_COMMANDS.USE_POSSESSION, { cardId: 'omen-book' });
        if (mode === 'online') {
            expect(execute).not.toHaveBeenCalled();
            expect(reduce).not.toHaveBeenCalled();
            expect(screen.queryByTestId('betrayal-use-status')?.textContent ?? '').not.toContain('本回合已用');
            expect(screen.getByTestId('betrayal-action-use')).toBeEnabled();
        } else {
            expect(execute).toHaveBeenCalledOnce();
            expect(reduce).toHaveBeenCalled();
            const previewInput = execute.mock.calls[0][0] as MatchState<BetrayalCore>;
            expect(previewInput.core.eventOrder).toEqual(authority.eventOrder);
            expect(previewInput.core.possessionOrderByKind).toEqual(authority.possessionOrderByKind);
        }
        expect(JSON.stringify(authority)).toBe(before);
        execute.mockRestore();
        reduce.mockRestore();

        // Simulate the server/local authority response via the real domain,
        // then give it to the real Board. This is not a live socket E2E.
        const committed = applyBetrayalCommand(authority, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' });
        expect(committed.nextNonCombatTraitReplacement?.playerId).toBe('0');
        expect(committed.usedCardIdsThisTurn).toContain('omen-book');
        expect(committed.eventOrder).toEqual(authority.eventOrder);
        expect(committed.possessionOrderByKind).toEqual(authority.possessionOrderByKind);
        rendered.rerender(boardTree(stateFor(committed, mode), mode, dispatch));
        expect(screen.getByTestId('betrayal-room-latest-feedback')).toHaveTextContent('书本');
        // The click may remember intent, but this success text must wait for
        // authoritative usedCardIdsThisTurn. No second card click is needed.
        expect(screen.getByTestId('betrayal-use-status')).toHaveTextContent('本回合已用');
        fireEvent.click(screen.getByTestId('betrayal-inventory-omen-book'));
        expect(screen.getByTestId('betrayal-action-use')).toBeDisabled();
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it.each(['no-confirmation', 'server-rejected'] as const)('online %s does not turn remembered intent into a successful use', (outcome) => {
        const authority = preparedCore();
        const state = stateFor(authority, 'online');
        const before = JSON.stringify(authority);
        // A legitimate stale-client rejection: the server has advanced the
        // turn before receiving this old client's card-use command.
        const serverAhead = outcome === 'server-rejected'
            ? applyBetrayalCommand(authority, BETRAYAL_COMMANDS.END_TURN, '0', {})
            : null;
        const dispatch = vi.fn();
        const rendered = render(boardTree(state, 'online', dispatch));
        fireEvent.click(screen.getByTestId('betrayal-inventory-omen-book'));
        expect(screen.getByTestId('betrayal-action-use')).toBeEnabled();
        const execute = vi.spyOn(BetrayalDomain, 'execute');
        const reduce = vi.spyOn(BetrayalDomain, 'reduce');
        fireEvent.click(screen.getByTestId('betrayal-action-use'));
        expect(dispatch).toHaveBeenCalledExactlyOnceWith(BETRAYAL_COMMANDS.USE_POSSESSION, { cardId: 'omen-book' });
        expect(screen.queryByTestId('betrayal-use-status')?.textContent ?? '').not.toContain('本回合已用');

        if (serverAhead) {
            const command = createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' });
            const validation = BetrayalDomain.validate({ core: serverAhead, sys: state.sys }, command);
            expect(validation).toMatchObject({ valid: false, error: '还没有轮到该玩家。' });
            expect(serverAhead.usedCardIdsThisTurn).not.toContain('omen-book');
            rendered.rerender(boardTree(stateFor(serverAhead, 'online'), 'online', dispatch));
        } else {
            // Repeated renders/syncs without a committed use are not an ACK.
            for (let repeat = 0; repeat < 2; repeat += 1) {
                rendered.rerender(boardTree(stateFor(structuredClone(authority), 'online'), 'online', dispatch));
                expect(screen.queryByTestId('betrayal-use-status')?.textContent ?? '').not.toContain('本回合已用');
            }
            expect(screen.getByTestId('betrayal-action-use')).toBeEnabled();
        }
        expect(execute).not.toHaveBeenCalled();
        expect(reduce).not.toHaveBeenCalled();
        expect(screen.queryByTestId('betrayal-use-status')?.textContent ?? '').not.toContain('本回合已用');
        expect(authority.usedCardIdsThisTurn).not.toContain('omen-book');
        expect(authority.nextNonCombatTraitReplacement).toBeNull();
        expect(JSON.stringify(authority)).toBe(before);
        expect(dispatch).toHaveBeenCalledTimes(1);
    });
});
