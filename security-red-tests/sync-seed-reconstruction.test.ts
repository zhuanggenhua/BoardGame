import { describe, expect, it } from 'vitest';
import { createMatchSetupState } from '../src/engine/transport/matchSetupStateFactory';
import type { BetrayalCore } from '../src/games/betrayal/game';
import { captureFreshSync, createSyntheticMatch, SYNTHETIC_PLAYER_IDS } from './transportCapture';

const hiddenSequenceFields = [
    'eventOrder',
    'possessionOrderByKind',
    'roomDiscoveryDeck',
    'roomDiscoveryOrderByFloor',
    'drawOrder',
] as const;

describe('Betrayal ordinary-player sync: secret random-state reconstruction', () => {
    it('does not provide a seed that reconstructs the complete synthetic hidden sequences', () => {
        const match = createSyntheticMatch();
        const authority = match.state.core as BetrayalCore;
        const captured = captureFreshSync(match);
        expect(Object.values(authority.deckCounts).every((count) => count > 0)).toBe(true);
        expect(captured.state.core.deckCounts).toEqual(authority.deckCounts);

        // No seed is safe for this attack. If a seed is intentionally public,
        // it must not regenerate the authority's secret decks.
        const receivedSeed = captured.randomMeta?.seed;
        if (typeof receivedSeed !== 'string' || receivedSeed.length === 0) return;
        const recovered = createMatchSetupState({
            matchID: match.matchID,
            engineConfig: match.engineConfig,
            playerIds: SYNTHETIC_PLAYER_IDS,
            seed: receivedSeed,
        }).state.core as BetrayalCore;
        for (const field of hiddenSequenceFields) {
            const reconstructedExactly = JSON.stringify(recovered[field]) === JSON.stringify(authority[field]);
            // Only booleans are reported, never seed values or card sequences.
            expect.soft(reconstructedExactly, `Sync seed reconstructed ${field}.`).toBe(false);
        }
    });
});
