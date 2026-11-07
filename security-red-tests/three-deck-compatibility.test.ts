import { describe, expect, it } from 'vitest';
import { executePipeline } from '../src/engine/pipeline';
import type { MatchState } from '../src/engine/types';
import { buildAiDecisionContext, resolveOnlineAiDecisionView, type AiSeatController } from '../src/engine/ai';
import { tryExecuteOnlineAiImmediateAction } from '../src/engine/transport/onlineAiExecutor';
import { applyMatchPlayerView } from '../src/engine/transport/stateProjection';
import { BetrayalDomain, betrayalAiRuntime, engineConfig, type BetrayalCore } from '../src/games/betrayal/game';
import { BETRAYAL_COMMANDS } from '../src/games/betrayal/commands';
import { BETRAYAL_AI_ACTION_KINDS } from '../src/games/betrayal/ai';
import type { BetrayalCommand } from '../src/games/betrayal/commandTypes';
import { resolveRoomPlacementPreview, resolveRoomTileAdjustmentOptions, resolveNextRoomDiscoveryDeckKind, hasAvailableDiscoveryDeckCard } from '../src/games/betrayal/roomDiscoveryModel';
import { createInitialPreviewState } from '../src/games/betrayal/previewStateModel';
import { applyBetrayalCommand, BETRAYAL_FIXED_RANDOM, createBetrayalCommand, createStartedFirstScenarioCore } from '../src/games/betrayal/testing/firstScenarioTestUtils';
import { activateTestExplorer, setNextDiscoverySymbolRoomsForAllFloors, triggerUponReflectionHaunt } from '../src/games/betrayal/__tests__/helpers/firstScenarioRuntimeHarness';
import { createSyntheticMatch } from './transportCapture';

function createExplorationCore(kind: 'event' | 'item' | 'omen') {
    let core = createStartedFirstScenarioCore();
    setNextDiscoverySymbolRoomsForAllFloors(core, kind);
    core.deckCounts.event = core.eventOrder.length;
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
    return core;
}
function matchOf(core: BetrayalCore) {
    const match = createSyntheticMatch();
    match.state = { ...match.state, core };
    return { ...match, gameId: 'betrayal', unloaded: false };
}
function viewOf(core: BetrayalCore): MatchState<BetrayalCore> {
    return applyMatchPlayerView(matchOf(core), '0') as MatchState<BetrayalCore>;
}
function assertMasked(core: BetrayalCore) {
    expect(core.eventOrder).toEqual([]);
    expect(core.possessionOrderByKind).toEqual({ item: [], omen: [] });
}

describe('Betrayal three-deck masking compatibility', () => {
    it.each(['event', 'item', 'omen'] as const)('%s room preview and AI validation use only the committed reveal, not hidden decks', (kind) => {
        let core = createExplorationCore(kind);
        const hiddenView = viewOf(core);
        expect(resolveRoomPlacementPreview(hiddenView.core)).toBeNull();
        const beforeActions = betrayalAiRuntime.buildLegalActions({ playerId: '0', state: hiddenView });
        expect(beforeActions.flatMap(action => action.commands).some(command => command.type === BETRAYAL_COMMANDS.REVEAL_ROOM)).toBe(true);
        const door = resolveRoomPlacementPreview(core)!.slotId;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.REVEAL_ROOM, '0', { roomId: door });
        const view = viewOf(core);
        assertMasked(view.core);
        const before = JSON.stringify(core);
        const authorityPreview = resolveRoomPlacementPreview(core);
        expect(authorityPreview).not.toBeNull();
        expect(authorityPreview?.deckKind).toBe(kind);
        expect(resolveRoomPlacementPreview(view.core)).toEqual(authorityPreview);
        for (const useHolySymbol of [false, true]) {
            expect(resolveRoomPlacementPreview(view.core, { useHolySymbol })).toEqual(resolveRoomPlacementPreview(core, { useHolySymbol }));
            expect(resolveNextRoomDiscoveryDeckKind(view.core, { useHolySymbol })).toEqual(resolveNextRoomDiscoveryDeckKind(core, { useHolySymbol }));
            for (const orientationTurns of [0, 1, 2, 3] as const) {
                expect(resolveRoomTileAdjustmentOptions(view.core, { useHolySymbol, orientationTurns })).toEqual(resolveRoomTileAdjustmentOptions(core, { useHolySymbol, orientationTurns }));
            }
        }
        const command = createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
        expect(BetrayalDomain.validate(view, command)).toEqual({ valid: true });
        const actions = betrayalAiRuntime.buildLegalActions({ playerId: '0', state: view });
        expect(actions).toEqual(betrayalAiRuntime.buildLegalActions({ playerId: '0', state: matchOf(core).state }));
        expect(actions.some(action => action.kind === BETRAYAL_AI_ACTION_KINDS.EXPLORE_ROOM)).toBe(true);
        // This helper is an authority precondition, not a client legality helper.
        expect(hasAvailableDiscoveryDeckCard(core, kind)).toBe(true);
        expect(hasAvailableDiscoveryDeckCard(view.core, kind)).toBe(false);
        expect(JSON.stringify(core)).toBe(before);
    });

    it.each(['event', 'item', 'omen'] as const)('online AI immediate executor explores %s with masked decision state and authority execution', async (kind) => {
        const match = matchOf(createExplorationCore(kind));
        const beforeCore = structuredClone(match.state.core as BetrayalCore);
        const seatControllers: Record<string, AiSeatController> = {
            '0': { type: 'local-ai', minimumActionDelayMs: 0 },
            '1': { type: 'human' }, '2': { type: 'human' },
        };
        let projectedCalls = 0;
        const applyPlayerView = (playerId: string) => {
            projectedCalls += 1;
            const view = applyMatchPlayerView(match, playerId) as MatchState<BetrayalCore>;
            assertMasked(view.core);
            return view;
        };
        const decision = resolveOnlineAiDecisionView({ runtime: betrayalAiRuntime, sharedState: match.state, privateOverlay: applyPlayerView('0'), playerId: '0' });
        expect(decision.canDecide).toBe(true);
        assertMasked((decision.visibleState as MatchState<BetrayalCore>).core);
        const context = buildAiDecisionContext({ gameId: 'betrayal', matchId: match.matchID, playerId: '0', visibleState: decision.visibleState, rulesVersion: null, decisionBudgetMs: 250, source: 'online', seatController: seatControllers['0'] });
        expect(context.legalActions.some(action => action.kind === BETRAYAL_AI_ACTION_KINDS.EXPLORE_ROOM)).toBe(true);
        const executeNext = () => tryExecuteOnlineAiImmediateAction({
            match, seatControllers,
            executor: {
                applyPlayerView,
                getSeatControllers: () => seatControllers,
                executeCommandSequence: async (playerId, commands) => {
                    const executedCommandTypes: string[] = [];
                    for (const command of commands) {
                        const outcome = executePipeline(
                            { domain: engineConfig.domain, systems: engineConfig.systems },
                            match.state as MatchState<BetrayalCore>,
                            { ...command, playerId, timestamp: 100 } as BetrayalCommand,
                            BETRAYAL_FIXED_RANDOM,
                            beforeCore.playerIds,
                        );
                        expect(outcome.success, outcome.error).toBe(true);
                        match.state = outcome.state;
                        match.stateID += 1;
                        executedCommandTypes.push(command.type);
                    }
                    return { success: true, executedCommandTypes, stateChanged: true };
                },
                clearRecoveryState: () => {}, broadcastState: () => {}, emitTrace: () => {},
            },
        });
        const revealResult = await executeNext();
        expect(revealResult.applied).toBe(true);
        expect(revealResult.executedCommandTypes).toEqual([BETRAYAL_COMMANDS.REVEAL_ROOM]);
        expect((match.state.core as BetrayalCore).pendingRoomPlacement).toBeTruthy();
        const result = await executeNext();
        expect(projectedCalls).toBeGreaterThan(1);
        expect(result.applied).toBe(true);
        expect(result.executedCommandTypes).toContain(BETRAYAL_COMMANDS.EXPLORE_ROOM);
        const after = match.state.core as BetrayalCore;
        expect(after.rooms.filter(room => room.state === 'discovered').length).toBeGreaterThan(beforeCore.rooms.filter(room => room.state === 'discovered').length);
        if (kind !== 'event') {
            expect(after.currentExplorer.inventory.some(card => card.name === beforeCore.possessionOrderByKind[kind][0].name)).toBe(true);
            // The official item fixture is the Vault: its printed reward is two items.
            const drawnCount = kind === 'item' ? 2 : 1;
            expect(after.possessionOrderByKind[kind]).toEqual(beforeCore.possessionOrderByKind[kind].slice(drawnCount));
            expect(after.deckCounts[kind]).toBe(beforeCore.deckCounts[kind] - drawnCount);
            expect(after.currentExplorer.inventory.map(card => card.name)).toEqual(expect.arrayContaining(beforeCore.possessionOrderByKind[kind].slice(0, drawnCount).map(card => card.name)));
        } else {
            expect(after.latestDiscovery?.title).toContain(beforeCore.eventOrder[0].name);
        }
    });

    it('ordinary USE_POSSESSION validates, clones, and previews with masked arrays without changing authority', () => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer.inventory = [{ id: 'map', name: '地图', kind: 'item' }];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['map'];
        const before = JSON.stringify(core);
        const view = viewOf(core);
        assertMasked(view.core);
        const command = createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'map', targetRoomId: 'hallway' });
        expect(BetrayalDomain.validate(view, command)).toEqual({ valid: true });
        const actions = betrayalAiRuntime.buildLegalActions({ playerId: '0', state: view });
        // A valid card is not necessarily selected by the policy (the map has
        // no strategic benefit in this fixture). Masking must not change that.
        expect(actions).toEqual(betrayalAiRuntime.buildLegalActions({ playerId: '0', state: matchOf(core).state }));
        const events = BetrayalDomain.execute(view, command, BETRAYAL_FIXED_RANDOM);
        const next = events.reduce((state, event) => BetrayalDomain.reduce(state, event), view.core);
        expect(next.currentExplorer.roomId).toBe('hallway');
        expect(next.currentExplorer.inventory).toEqual([]);
        assertMasked(next);
        expect(() => createInitialPreviewState(next)).not.toThrow();
        expect(JSON.stringify(core)).toBe(before);
    });

    it('documents mirror hint boundary: authority still works but masked deck cannot validate choice without a candidate contract', () => {
        const core = triggerUponReflectionHaunt();
        activateTestExplorer(core, '0');
        core.eventOrder = [
            { name: '阴影扑面', description: '阴影扑向你。', effect: { mode: 'none' } },
            { name: '远处低语', description: '远处有人低语。', effect: { mode: 'none' } },
        ];
        core.deckCounts.event = 2;
        const command = createBetrayalCommand(BETRAYAL_COMMANDS.GIVE_MIRROR_HINT, '0', { eventName: '远处低语', targetPlayerId: '1' });
        const view = viewOf(core);
        assertMasked(view.core);
        expect(BetrayalDomain.validate({ core, sys: {} as never }, command)).toEqual({ valid: true });
        expect(BetrayalDomain.validate(view, command)).toMatchObject({ valid: false, error: '事件牌堆没有可用于镜中提示的事件牌。' });
        const next = applyBetrayalCommand(core, BETRAYAL_COMMANDS.GIVE_MIRROR_HINT, '0', command.payload as { eventName: string; targetPlayerId: string });
        expect(next.eventOrder.map(event => event.name)).toEqual(['阴影扑面']);
        expect(next.deckCounts.event).toBe(1);
        expect(next.scenarioRuntime.uponReflection?.hintedEvents).toEqual([expect.objectContaining({ eventName: '远处低语', targetPlayerId: '1' })]);
        expect(next.currentExplorer.traits).toEqual(core.currentExplorer.traits);
        expect(core.eventOrder.map(event => event.name)).toEqual(['阴影扑面', '远处低语']);
        const noLongerAvailable = createBetrayalCommand(BETRAYAL_COMMANDS.GIVE_MIRROR_HINT, '0', { eventName: '不存在的事件', targetPlayerId: '1' });
        expect(BetrayalDomain.validate({ core, sys: {} as never }, noLongerAvailable).valid).toBe(false);
        expect(BetrayalDomain.validate({ core: next, sys: {} as never }, command).valid).toBe(false);
        const otherPlayer = createBetrayalCommand(BETRAYAL_COMMANDS.GIVE_MIRROR_HINT, '1', { eventName: '阴影扑面', targetPlayerId: '0' });
        expect(BetrayalDomain.validate({ core, sys: {} as never }, otherPlayer).valid).toBe(false);
        expect(betrayalAiRuntime.buildLegalActions({ playerId: '0', state: view }).flatMap(action => action.commands).some(entry => entry.type === BETRAYAL_COMMANDS.GIVE_MIRROR_HINT)).toBe(false);
    });
});
