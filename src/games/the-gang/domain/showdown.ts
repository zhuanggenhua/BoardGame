import { compareHandStrength, evaluateBestTexasHoldemHand } from './poker';
import type { HeistRecord, ShowdownPlayerResult, TheGangCore } from './types';

export function buildShowdownResults(core: TheGangCore): ShowdownPlayerResult[] {
    return core.playerIds.map((playerId) => {
        const evaluated = evaluateBestTexasHoldemHand([
            ...core.players[playerId].pocketCards,
            ...core.communityCards,
        ]);
        return {
            playerId,
            chip: core.currentRoundChips[playerId],
            strength: evaluated.strength,
            pocketCards: [...core.players[playerId].pocketCards],
            bestCards: evaluated.cards,
        };
    });
}

export function isChipOrderCorrect(results: ShowdownPlayerResult[]): boolean {
    for (const left of results) {
        for (const right of results) {
            if (left.playerId === right.playerId) continue;
            const chipDelta = left.chip - right.chip;
            const strengthDelta = compareHandStrength(left.strength, right.strength);
            if (chipDelta < 0 && strengthDelta > 0) return false;
            if (chipDelta > 0 && strengthDelta < 0) return false;
        }
    }
    return true;
}

export function createHeistRecord(core: TheGangCore): HeistRecord {
    const results = buildShowdownResults(core);
    return {
        heistNumber: core.heistNumber,
        outcome: isChipOrderCorrect(results) ? 'success' : 'failure',
        results: [...results].sort((a, b) => a.chip - b.chip),
    };
}
