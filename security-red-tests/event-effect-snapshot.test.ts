import { describe, expect, it } from 'vitest';
import { BetrayalDomain, type BetrayalCore } from '../src/games/betrayal/game';
import { applyEventEffect } from '../src/games/betrayal/eventEffectResolutionModel';
import { setTestTraitTrack } from '../src/games/betrayal/__tests__/helpers/firstScenarioRuntimeHarness';
import { formatBetrayalActionEntry } from '../src/games/betrayal/actionLog';
import { resolveBetrayalActivityPresentation } from '../src/games/betrayal/activityPresentation';
import { BETRAYAL_COMMANDS } from '../src/games/betrayal/commands';
import type { BetrayalEvent } from '../src/games/betrayal/events';
import {
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createStartedFirstScenarioCore,
} from '../src/games/betrayal/testing/firstScenarioTestUtils';
import { captureFreshBroadcast, createSyntheticMatch } from './transportCapture';

function createSnapshotCore(): BetrayalCore {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3, 4, 5], 2, 2);
    const snapshot = applyEventEffect(core, { mode: 'trait', trait: 'knowledge', amount: 1 });
    if (!snapshot) throw new Error('Expected the real effect resolver to produce a rollback snapshot.');
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.recentRoll = {
        id: 'snapshot-test-roll', kind: 'eventDiceRoll', playerId: '0',
        sourceTitle: 'Snapshot boundary test', dice: [0], passiveBonus: 0,
        latestLabel: 'Gain knowledge', consumedRabbitFootCardIds: [],
        branchThresholds: [{ min: 0, label: 'Gain knowledge', effect: { mode: 'trait', trait: 'knowledge', amount: 1 } }],
        eventEffectSnapshot: snapshot,
    };
    core.latestDiscovery = {
        kind: 'event', title: 'Snapshot boundary test', detail: 'Resolved public trait change',
        summary: 'Resolved', tone: 'accent',
    };
    core.activityLog = [];
    return core;
}

function broadcast(core: BetrayalCore): BetrayalCore {
    const match = createSyntheticMatch();
    match.state = { ...match.state, core };
    const before = JSON.stringify(core);
    const projected = captureFreshBroadcast(match).state.core;
    expect(JSON.stringify(core) === before, 'Broadcast must preserve authoritative state.').toBe(true);
    return projected;
}

function maskSnapshotOrdersForCompatibilityProbe(core: BetrayalCore): BetrayalCore {
    // This is a test-only simulation of the narrow proposed projection, not a
    // product fix and not evidence that production already hides the orders.
    const copy = structuredClone(core);
    copy.recentRoll!.eventEffectSnapshot!.possessionOrderByKindBeforeEffect = { item: [], omen: [] };
    return copy;
}

describe('Betrayal event-effect rollback snapshot boundary', () => {
    it.each(['item', 'omen'] as const)('does not broadcast the undisclosed %s snapshot order', (kind) => {
        const core = createSnapshotCore();
        const snapshot = core.recentRoll!.eventEffectSnapshot!;
        const marker = `snapshot-only-secret-${kind}`;
        snapshot.possessionOrderByKindBeforeEffect[kind][0].name = marker;
        expect(JSON.stringify(core.possessionOrderByKind).includes(marker)).toBe(false);
        const projected = broadcast(core);
        expect(JSON.stringify(projected).includes(marker), 'Rollback deck identity reached ordinary-player state:update.').toBe(false);
    });

    it('preserves visible traits and rolled damage after hiding only snapshot orders', () => {
        const core = createSnapshotCore();
        core.recentRoll!.eventEffectSnapshot!.rolledDamageResults = [{
            damageKind: 'mental', rolls: [1, 2], total: 3, appliedAmount: 3,
        }];
        const projected = maskSnapshotOrdersForCompatibilityProbe(broadcast(core));
        const visibleSnapshot = projected.recentRoll!.eventEffectSnapshot!;
        expect(visibleSnapshot.traitsBeforeEffect).toEqual(core.recentRoll!.eventEffectSnapshot!.traitsBeforeEffect);
        expect(visibleSnapshot.rolledDamageResults).toEqual([{ damageKind: 'mental', rolls: [1, 2], total: 3, appliedAmount: 3 }]);
        expect(resolveBetrayalActivityPresentation({ core: projected, text: () => '' }).visibleBoardResultFeedback).toMatchObject({
            kind: 'traitChange', targetPlayerId: '0', deltaText: '+1 知识',
        });
        const damageLog = formatBetrayalActionEntry({
            command: createBetrayalCommand(BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, '0', {}),
            state: { ...createSyntheticMatch().state, core: projected }, events: [],
        });
        expect(Array.isArray(damageLog) && damageLog.length).toBe(1);
        expect(JSON.stringify(damageLog)).toContain('eventRolledMentalDamageResult');
    });

    it('can reproject and run ordinary USE_POSSESSION preview with empty snapshot orders', () => {
        const core = createSnapshotCore();
        core.currentExplorer.inventory = [{ id: 'map', name: '地图', kind: 'item' }];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['map'];
        const projected = maskSnapshotOrdersForCompatibilityProbe(broadcast(core));
        const secondView = BetrayalDomain.playerView!(projected, '0') as BetrayalCore;
        expect(secondView.recentRoll!.eventEffectSnapshot!.possessionOrderByKindBeforeEffect).toEqual({ item: [], omen: [] });
        const command = createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'map', targetRoomId: 'hallway' });
        const state = { core: secondView, sys: {} as never };
        expect(BetrayalDomain.validate(state, command)).toEqual({ valid: true });
        const events = BetrayalDomain.execute(state, command, BETRAYAL_FIXED_RANDOM);
        expect(events.map((event) => event.type)).toContain('POSSESSION_USED');
        const result = events.reduce((next, event) => BetrayalDomain.reduce(next, event), secondView);
        expect(result.currentExplorer.roomId).toBe('hallway');
        expect(result.currentExplorer.inventory.some((card) => card.id === 'map')).toBe(false);
        expect(result.recentRoll!.eventEffectSnapshot!.possessionOrderByKindBeforeEffect).toEqual({ item: [], omen: [] });
    });

    it('retains authoritative snapshot orders for the RABBIT_FOOT_USED rollback reducer', () => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.currentExplorer.inventory = [{ id: 'rope', name: '兔脚', kind: 'item' }];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        const beforeOrders = structuredClone(core.possessionOrderByKind);
        const beforeCounts = { ...core.deckCounts };
        const beforeInventory = structuredClone(core.currentExplorer.inventory);
        const previousEffect = { mode: 'drawPossession' as const, kind: 'item' as const };
        const snapshot = applyEventEffect(core, previousEffect)!;
        expect(core.possessionOrderByKind.item.length).toBe(beforeOrders.item.length - 1);
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.recentRoll = {
            id: 'rollback-test-roll', kind: 'eventDiceRoll', playerId: '0',
            sourceTitle: 'Snapshot rollback test', dice: [0], passiveBonus: 0,
            latestLabel: 'Draw item', consumedRabbitFootCardIds: [], eventEffectSnapshot: snapshot,
            branchThresholds: [
                { min: 2, label: 'No effect', effect: { mode: 'none' } },
                { min: 0, label: 'Draw item', effect: previousEffect },
            ],
        };
        // The current command validator allows event rerolls only before
        // finalization. This independently protects the existing replay/reducer
        // rollback branch; it does not claim a legal post-finalization UI path.
        broadcast(core);
        const event: BetrayalEvent = {
            type: 'RABBIT_FOOT_USED', timestamp: 101,
            payload: { playerId: '0', cardId: 'rope', cardName: '兔脚', dieIndex: 0, newPip: 2, logText: 'Synthetic reroll' },
        };
        const result = BetrayalDomain.reduce(core, event);
        expect(result.possessionOrderByKind).toEqual(beforeOrders);
        expect(result.deckCounts).toEqual(beforeCounts);
        expect(result.currentExplorer.inventory).toEqual(beforeInventory);
        expect(result.recentRoll?.dice).toEqual([2]);
    });
});
