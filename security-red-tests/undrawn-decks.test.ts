import { describe, expect, it } from 'vitest';
import type { BetrayalCore } from '../src/games/betrayal/game';
import {
    captureFreshBroadcast,
    createSyntheticMatch,
    SYNTHETIC_CREDENTIAL,
} from './transportCapture';

type MarkerCase = {
    field: string;
    mark: (core: BetrayalCore, marker: string) => void;
};

const markerCases: MarkerCase[] = [
    { field: 'eventOrder', mark: (core, marker) => { core.eventOrder[0].name = marker; } },
    { field: 'possessionOrderByKind.item', mark: (core, marker) => { core.possessionOrderByKind.item[0].name = marker; } },
    { field: 'possessionOrderByKind.omen', mark: (core, marker) => { core.possessionOrderByKind.omen[0].name = marker; } },
    { field: 'roomDiscoveryDeck', mark: (core, marker) => { core.roomDiscoveryDeck[0].room.name = marker; } },
    { field: 'roomDiscoveryOrderByFloor', mark: (core, marker) => { core.roomDiscoveryOrderByFloor.ground[0].name = marker; } },
];

describe('Betrayal ordinary-player broadcast: undisclosed decks', () => {
    it.each(markerCases)('$field does not expose an undisclosed identity in a complete state:update', ({ field, mark }) => {
        const match = createSyntheticMatch();
        const core = match.state.core as BetrayalCore;
        const marker = `synthetic-undisclosed-${field}`;
        mark(core, marker);
        const before = JSON.stringify(match.state);
        const captured = captureFreshBroadcast(match);

        expect(captured.state.core.deckCounts).toEqual(core.deckCounts);
        expect(JSON.stringify(match.state) === before, 'Projection must not mutate authority.').toBe(true);
        // Boolean assertion prevents failure output from printing the state or marker value.
        expect(JSON.stringify(captured.state).includes(marker), `${field} identity reached the ordinary player.`).toBe(false);
    });

    it('drawOrder does not expose the complete server-only draw sequence', () => {
        const match = createSyntheticMatch();
        const core = match.state.core as BetrayalCore;
        expect(core.drawOrder.length).toBeGreaterThan(1);
        const captured = captureFreshBroadcast(match);
        const received = captured.state.core.drawOrder;
        const sameCompleteSequence = Array.isArray(received)
            && JSON.stringify(received) === JSON.stringify(core.drawOrder);
        expect(sameCompleteSequence, 'Complete server draw sequence reached the ordinary player.').toBe(false);
    });

    it('keeps public deck counts while excluding seat credentials and preserving authority', () => {
        const match = createSyntheticMatch();
        const core = match.state.core as BetrayalCore;
        const before = JSON.stringify(match.state);
        const captured = captureFreshBroadcast(match);
        expect(Object.values(core.deckCounts).every((count) => count > 0)).toBe(true);
        expect(captured.state.core.deckCounts).toEqual(core.deckCounts);
        expect(JSON.stringify(captured).includes(SYNTHETIC_CREDENTIAL)).toBe(false);
        expect(JSON.stringify(match.state) === before).toBe(true);
    });
});
