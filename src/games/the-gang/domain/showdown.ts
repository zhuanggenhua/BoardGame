import { getChipForHandSlot } from './chips';
import { compareHandStrength, evaluateBestTheGangHand } from './poker';
import type { HeistRecord, ShowdownPlayerResult, TheGangCore, TheGangHandSlot } from './types';

const resultKey = (result: ShowdownPlayerResult): string => (
    result.handSlot ? `${result.playerId}:${result.handSlot}` : result.playerId
);

const buildResultForHand = (
    core: TheGangCore,
    playerId: string,
    handSlot: TheGangHandSlot,
): ShowdownPlayerResult => {
    const player = core.players[playerId];
    const playerCommunity = player.communityCards ?? core.communityCards;
    const boardCards = [
        ...playerCommunity,
        ...player.flashlightCards,
    ];
    const pocketCards = handSlot === 'top'
        ? [...player.pocketCards, ...player.nightVisionCards]
        : [...(player.secondaryPocketCards ?? [])];
    const evaluated = evaluateBestTheGangHand(pocketCards, boardCards, {
        rulesConfig: core.rules.config,
        blankedRank: core.rules.blankedRank,
    });

    return {
        playerId,
        handSlot: core.rules.config.twoHand ? handSlot : undefined,
        chip: getChipForHandSlot(core, playerId, handSlot) ?? 0,
        strength: evaluated.strength,
        pocketCards,
        bestCards: evaluated.cards,
        winningHandSlot: core.rules.config.twoHand ? handSlot : undefined,
    };
};

export function buildShowdownResults(core: TheGangCore): ShowdownPlayerResult[] {
    return core.playerIds.flatMap((playerId) => (
        core.rules.config.twoHand
            ? [
                buildResultForHand(core, playerId, 'top'),
                buildResultForHand(core, playerId, 'bottom'),
            ]
            : [buildResultForHand(core, playerId, 'top')]
    ));
}

export function isChipOrderCorrect(results: ShowdownPlayerResult[]): boolean {
    for (const left of results) {
        for (const right of results) {
            if (resultKey(left) === resultKey(right)) continue;
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
