import { describe, expect, it } from 'vitest';
import type { Server as IOServer } from 'socket.io';
import type { MatchState } from '../src/engine/types';
import type { BetrayalCore } from '../src/games/betrayal/game';
import { applyPatches, type Operation } from '../src/engine/transport/patch';
import { broadcastProjectedMatchState, type TransportStateProjectionMatch } from '../src/engine/transport/stateProjection';
import { TransportStateSynchronizer } from '../src/engine/transport/transportStateSynchronizer';
import { createSyntheticMatch } from './transportCapture';

type DeckKind = 'event' | 'item' | 'omen';
type WireCall = { event: string; value: unknown };
const deckKinds: DeckKind[] = ['event', 'item', 'omen'];
const viewers = ['0', '1', null] as const;
function deck(core: BetrayalCore, kind: DeckKind) {
    return kind === 'event' ? core.eventOrder : core.possessionOrderByKind[kind];
}
function injectMarker(match: TransportStateProjectionMatch, kind: DeckKind, marker: string) {
    const cards = deck(match.state.core as BetrayalCore, kind);
    expect(cards.length).toBeGreaterThan(0);
    cards[0].name = marker;
}
function captureSync(match: TransportStateProjectionMatch, playerID: string | null) {
    const calls: WireCall[] = [];
    new TransportStateSynchronizer({} as IOServer).syncSocket({
        match, playerID,
        socket: { emit: (event, ...args) => calls.push({ event, value: args[1] }) },
    });
    expect(calls.map(call => call.event)).toEqual(['state:sync']);
    return calls[0].value as MatchState<BetrayalCore>;
}
function captureBroadcast(match: TransportStateProjectionMatch, playerID: string | null) {
    match.connections = playerID === null ? new Map() : new Map([[playerID, new Set(['socket'])]]);
    match.spectatorSockets = playerID === null ? new Set(['socket']) : new Set();
    const calls: WireCall[] = [];
    const io = { of: () => ({ to: () => ({ emit: (event: string, _id: string, value: unknown) => calls.push({ event, value }) }) }) } as unknown as IOServer;
    broadcastProjectedMatchState({ io, match });
    expect(calls).toHaveLength(1);
    return calls[0];
}
function assertHidden(view: MatchState<BetrayalCore>, authority: BetrayalCore, marker: string) {
    expect(JSON.stringify(view), 'Undisclosed deck marker reached a client view').not.toContain(marker);
    expect(view.core.eventOrder).toEqual([]);
    expect(view.core.possessionOrderByKind).toEqual({ item: [], omen: [] });
    expect(view.core.deckCounts).toEqual(authority.deckCounts);
}

describe('Betrayal undisclosed event/item/omen orders at real transport boundaries', () => {
    for (const playerID of viewers) {
        describe(playerID === null ? 'spectator' : `player ${playerID}`, () => {
            it.each(deckKinds)('state:sync hides %s and preserves authority', (kind) => {
                const match = createSyntheticMatch();
                const marker = `SYNC_SECRET_${kind}`;
                injectMarker(match, kind, marker);
                const before = JSON.stringify(match.state);
                const projected = captureSync(match, playerID);
                expect(JSON.stringify(match.state)).toBe(before);
                assertHidden(projected, match.state.core as BetrayalCore, marker);
            });
            it.each(deckKinds)('state:update hides %s and preserves authority', (kind) => {
                const match = createSyntheticMatch();
                const marker = `UPDATE_SECRET_${kind}`;
                injectMarker(match, kind, marker);
                const before = JSON.stringify(match.state);
                const call = captureBroadcast(match, playerID);
                expect(call.event).toBe('state:update');
                expect(JSON.stringify(match.state)).toBe(before);
                assertHidden(call.value as MatchState<BetrayalCore>, match.state.core as BetrayalCore, marker);
            });
            it.each(deckKinds)('state:patch hides newly changed %s and preserves authority', (kind) => {
                const match = createSyntheticMatch();
                const baseline = captureSync(match, playerID);
                const marker = `PATCH_SECRET_${kind}`;
                injectMarker(match, kind, marker);
                // Public mutation forces a real patch even if secret-only changes
                // correctly yield no operation. Only the socket sink is mocked.
                (match.state.core as BetrayalCore).turnNumber += 1;
                match.stateID += 1;
                const before = JSON.stringify(match.state);
                const call = captureBroadcast(match, playerID);
                expect(call.event).toBe('state:patch');
                expect(JSON.stringify(match.state)).toBe(before);
                expect(JSON.stringify(call.value), 'Secret marker reached JSON Patch').not.toContain(marker);
                const applied = applyPatches(baseline, call.value as Operation[]);
                expect(applied.success).toBe(true);
                assertHidden(applied.state as MatchState<BetrayalCore>, match.state.core as BetrayalCore, marker);
                expect((applied.state as MatchState<BetrayalCore>).core.turnNumber).toBe((match.state.core as BetrayalCore).turnNumber);
            });
        });
    }
});
