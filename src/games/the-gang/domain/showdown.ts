import { compareHandStrength, evaluateBestTheGangHand } from './poker';
import type { HeistRecord, ShowdownPlayerResult, TheGangCore } from './types';

export function buildShowdownResults(core: TheGangCore): ShowdownPlayerResult[] {
    return core.playerIds.map((playerId) => {
        const player = core.players[playerId];
        const playerCommunity = player.communityCards ?? core.communityCards;
        const handCards = [
            ...player.pocketCards,
            ...player.nightVisionCards,
        ];
        const secondaryHandCards = player.secondaryPocketCards ?? [];
        const boardCards = [
            ...playerCommunity,
            ...player.flashlightCards,
        ];
        const evaluated = evaluateBestTheGangHand(handCards, boardCards, {
            rulesConfig: core.rules.config,
            blankedRank: core.rules.blankedRank,
        });
        const secondaryEvaluated = secondaryHandCards.length > 0
            ? evaluateBestTheGangHand(secondaryHandCards, boardCards, {
                rulesConfig: core.rules.config,
                blankedRank: core.rules.blankedRank,
            })
            : undefined;
        const secondaryWins = secondaryEvaluated
            ? compareHandStrength(secondaryEvaluated.strength, evaluated.strength) > 0
            : false;
        const winningEvaluation = secondaryWins && secondaryEvaluated ? secondaryEvaluated : evaluated;

        return {
            playerId,
            chip: core.currentRoundChips[playerId],
            strength: winningEvaluation.strength,
            pocketCards: handCards,
            secondaryPocketCards: secondaryHandCards.length > 0 ? secondaryHandCards : undefined,
            bestCards: winningEvaluation.cards,
            winningHandSlot: secondaryHandCards.length > 0 ? (secondaryWins ? 'bottom' : 'top') : undefined,
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
