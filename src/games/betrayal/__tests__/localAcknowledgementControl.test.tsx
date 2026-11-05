import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import type { LocalRuntimeControlResolver } from '../../../engine/transport/followCurrentTurnPlayer';
import { useLocalProviderViewModel } from '../../../engine/transport/useLocalProviderViewModel';
import { createStartedFirstScenarioCore } from '../testing/firstScenarioTestUtils';
import { BETRAYAL_COMMANDS } from '../commands';
import { engineConfig, type BetrayalCore, type BetrayalPendingCardResolutionState } from '../game';

const makeState = (): MatchState<BetrayalCore> => {
    const core = createStartedFirstScenarioCore();
    core.currentPlayer = '1';
    core.activePlayerId = '1';
    core.seatControllers = { '0': { type: 'human' }, '1': { type: 'local-ai' }, '2': { type: 'local-ai' } };
    return { core, sys: createInitialSystemState(core.playerIds, engineConfig.systems, 'local-ack') };
};
const resolver = (args: Parameters<LocalRuntimeControlResolver>[0]) =>
    (engineConfig as { resolveLocalRuntimeControlledPlayerId?: LocalRuntimeControlResolver })
        .resolveLocalRuntimeControlledPlayerId?.(args) ?? args.fallbackPlayerId;
const resolve = (state: MatchState<BetrayalCore>) => resolver({ state, fallbackPlayerId: '1' });
const card = (): BetrayalPendingCardResolutionState => ({
    id: 'omen-result', playerId: '1', requiredPlayerIds: ['0', '1', '2'], acknowledgedPlayerIds: ['1', '2'],
    deckKind: 'omen', cardId: 'statue', cardName: '雕像', discoveryTitle: '雕像', stepKind: 'drawn-card', text: '', index: 0, total: 1,
});
const eventRoll = () => ({ rollId: 'robot-result', playerId: '1', sourceTitle: '小机器人',
    effect: { mode: 'none' as const, recommendedAction: 'endTurn' as const }, requiredPlayerIds: ['0'], acknowledgedPlayerIds: [] as string[] });

describe('local human acknowledgement handoff', () => {
    it('offers the missing human card acknowledgement without acknowledging on their behalf', () => {
        const state = makeState(); state.core.pendingCardResolutionQueue = [card()];
        expect(resolve(state)).toBe('0');
        expect(state.core.pendingCardResolutionQueue[0].acknowledgedPlayerIds).toEqual(['1', '2']);
        state.core.pendingCardResolutionQueue[0].acknowledgedPlayerIds!.push('0');
        expect(resolve(state)).toBe('1');
    });
    it('prioritizes a shared event result over its actor-only card queue', () => {
        const state = makeState(); state.core.pendingEventRollResolution = eventRoll();
        state.core.pendingCardResolutionQueue = [{ ...card(), requiredPlayerIds: ['1'], acknowledgedPlayerIds: [] }];
        expect(resolve(state)).toBe('0');
        state.core.pendingEventRollResolution.acknowledgedPlayerIds = ['0'];
        expect(resolve(state)).toBe('1');
    });
    it.each([{ requiresAcknowledgement: false }, { requiresPlayerAdvance: true }])('keeps actor-controlled event advancement: %j', flags => {
        const state = makeState(); state.core.pendingEventRollResolution = { ...eventRoll(), ...flags };
        expect(resolve(state)).toBe('1');
    });
    it('keeps the search operator until their own sequence has been acknowledged', () => {
        const state = makeState(); const pending = { ...card(), acknowledgedPlayerIds: ['2'], processCards: [{ cardName: '砍刀', deckKind: 'item' as const, outcome: 'gained' as const, text: '' }] };
        state.core.pendingCardResolutionQueue = [pending];
        expect(resolve(state)).toBe('1');
        expect(resolver({ state, fallbackPlayerId: '0' })).toBe('0');
        pending.acknowledgedPlayerIds.push('1');
        expect(resolve(state)).toBe('0');
    });
    it('routes the visible human confirmation through the normal local dispatch identity', () => {
        const state = makeState(); state.core.pendingCardResolutionQueue = [card()];
        const dispatch = vi.fn();
        const { result } = renderHook(() => useLocalProviderViewModel({ state, dispatch, reset: vi.fn(), playerIds: state.core.playerIds,
            seatControllers: state.core.seatControllers!, localPregameControlledPlayerId: null, followCurrentTurnPlayer: true,
            resolveLocalRuntimeControlledPlayerId: resolver }));
        expect(result.current.playerId).toBe('0');
        expect(dispatch).not.toHaveBeenCalled();
        act(() => result.current.dispatch(BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, { resolutionId: 'omen-result' }));
        expect(dispatch).toHaveBeenCalledWith(BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, { resolutionId: 'omen-result', __internalPlayerId: '0' });
    });
    it('accepts the routed human command and releases the completed acknowledgement queue', () => {
        const state = makeState(); state.core.pendingCardResolutionQueue = [card()];
        const result = executePipeline({ domain: engineConfig.domain, systems: engineConfig.systems }, state,
            { type: BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, playerId: resolve(state)!, payload: { resolutionId: 'omen-result' }, timestamp: 1 },
            createSeededRandom('local-ack-submit'), state.core.playerIds);
        expect(result.success, JSON.stringify(result)).toBe(true);
        expect(result.state.core.pendingCardResolutionQueue).toHaveLength(0);
        expect(state.core.currentPlayer).toBe('1');
    });

});
