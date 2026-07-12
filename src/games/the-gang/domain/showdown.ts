import { compareHandStrength, evaluateBestTheGangHand } from './poker';
import type { HeistRecord, ShowdownPlayerResult, TheGangCore } from './types';

export function buildShowdownResults(core: TheGangCore): ShowdownPlayerResult[] {
    return core.playerIds.map((playerId) => {
        const playerCommunity = core.players[playerId].communityCards ?? core.communityCards;
        const handCards = [
            ...core.players[playerId].pocketCards,
            ...core.players[playerId].nightVisionCards,
        ];
        const boardCards = [
            ...playerCommunity,
            ...core.players[playerId].flashlightCards,
        ];
        const evaluated = evaluateBestTheGangHand(handCards, boardCards, {
            rulesConfig: core.rules.config,
            blankedRank: core.rules.blankedRank,
        });
        return {
            playerId,
            chip: core.currentRoundChips[playerId],
            strength: evaluated.strength,
            pocketCards: handCards,
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
