import type { GameSetupSelections } from '../../shared/gameSetupOptions';
import { applyQidahenPregameChoiceDefaults } from './roomSetup';
import type { QidahenCore } from './domain/types';
import { buildInitialCardPiles } from './domain/handCardState';
import { buildInitialQidahenChronology, buildQidahenActualYearCardSlots } from './domain/chronologyCards';
import { buildInitialQidahenKoreaPile } from './domain/koreaCardState';

type QidahenTutorialSetupData = {
    numPlayers: number;
    setupSelections: GameSetupSelections;
    setupData: Record<string, unknown>;
};

const NATURAL_OPENING_CONTRACT = {
    entryKind: 'natural-opening', startingPoint: 'formal-opening', formalEntryPhase: 'action-window',
    currentActorFaction: 'mongol', precedingAtoms: ['setup-complete'], firstRealDecision: 'choose-wheel-move',
    injectedDifferences: [], scope: 'mainline',
} as const;

/** 固定一次合法初始牌序；首张教学卡前的对手回合仍由正式命令执行。 */
function createTutorialOpening(initial: QidahenCore): QidahenCore {
    if (initial.turnPhase !== 'action-window' || initial.currentPlayer !== initial.factions.mongol.playerId) {
        throw new Error('Annual tutorial must start at the formal Mongol opening');
    }
    const piles = buildInitialCardPiles(initial.factions, initial.specialCardsEnabled);
    const chronology = buildInitialQidahenChronology(initial.scenarioId, initial.regions, cards => [1306, ...cards.filter(id => id !== 1306)]);
    const koreaDrawPile = buildInitialQidahenKoreaPile();
    return { ...initial, ...piles, chronology, yearCards: buildQidahenActualYearCardSlots(chronology),
        koreaDrawPile, koreaDeckCount: koreaDrawPile.length, koreaDiscardPile: [], koreaDiscardCount: 0,
        drawPileCount: piles.factions.ming.drawPileCount, discardPileCount: piles.factions.ming.discardPileCount,
        explicitRegionId: null };
}

export function buildQidahenTutorialSetupData(tutorialId?: string, _allowQaScenario = false): QidahenTutorialSetupData | null {
    if (tutorialId !== 'basic-opening' && tutorialId !== 'qidahen-basic') return null;
    const setupSelections = applyQidahenPregameChoiceDefaults({ scenario: 'post-sarhu-1619' });
    return { numPlayers: 3, setupSelections, setupData: { setupSelections, ...setupSelections,
        qidahenTutorialContract: NATURAL_OPENING_CONTRACT, qidahenTutorialCoreTransform: createTutorialOpening } };
}

export const QIDAHEN_TUTORIAL_SETUP_CONTRACTS = Object.freeze({
    'basic-opening': NATURAL_OPENING_CONTRACT, 'qidahen-basic': NATURAL_OPENING_CONTRACT,
});
