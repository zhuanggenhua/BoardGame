import {
    qidahenJinHandPreview,
    qidahenMingHandPreview,
    qidahenMongolHandPreview,
} from '../ui/cardAtlas';
import type { QidahenCore, QidahenFactionId, QidahenHandCard } from './types';

const QIDAHEN_FACTION_HAND_PREVIEW_COUNT = 16;

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const factionHandPreviewById: Record<QidahenFactionId, (index: number) => QidahenHandCard['previewRef']> = {
    ming: qidahenMingHandPreview,
    mongol: qidahenMongolHandPreview,
    jin: qidahenJinHandPreview,
};

export const buildInitialHandCards = (
    factions: QidahenCore['factions'],
): QidahenCore['handCards'] => {
    let nextId = 1;
    return factionOrder.flatMap((factionId) => {
        const previewForFaction = factionHandPreviewById[factionId];
        const visibleCardCount = factionId === 'ming'
            ? factions[factionId].handCount + 1
            : factions[factionId].handCount;
        return Array.from({ length: visibleCardCount }, (_, index) => {
            const cardId = `hand-${nextId}`;
            nextId += 1;
            return {
                id: cardId,
                label: `${factions[factionId].name} 手牌 ${index + 1}`,
                faction: factionId,
                previewRef: previewForFaction(index % QIDAHEN_FACTION_HAND_PREVIEW_COUNT),
                accent: factionId,
                status: index < factions[factionId].handCount ? 'payable' as const : 'idle' as const,
                cardKind: 'unknown' as const,
                armamentId: null,
                cardDefId: null,
            };
        });
    });
};

export const buildDrawnHandCards = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    drawCards: number,
): QidahenCore['handCards'] => {
    if (drawCards <= 0) {
        return state.handCards;
    }
    const currentMaxIndex = state.handCards.reduce((max, card) => {
        const match = /hand-(\d+)/.exec(card.id);
        const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    const factionCardCount = state.handCards.filter((card) => card.faction === factionId).length;
    const previewBase = (state.factions[factionId].discardPileCount ?? 0) + factionCardCount;
    const previewForFaction = factionHandPreviewById[factionId];
    const nextCards = Array.from({ length: drawCards }, (_, index) => ({
        id: `hand-${currentMaxIndex + index + 1}`,
        label: `${state.factions[factionId].name} 手牌 ${factionCardCount + index + 1}`,
        faction: factionId,
        previewRef: previewForFaction((previewBase + index) % QIDAHEN_FACTION_HAND_PREVIEW_COUNT),
        accent: factionId,
        status: 'payable' as const,
        cardKind: 'unknown' as const,
        armamentId: null,
        cardDefId: null,
    }));
    return [...state.handCards, ...nextCards];
};

export const getFactionDrawPileCount = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): number => Math.max(0, state.factions[factionId].drawPileCount ?? state.drawPileCount);

export const drawFromFactionPile = (
    factions: QidahenCore['factions'],
    sourceFactionId: QidahenFactionId,
    requestedCards: number,
    discardGain = 0,
): { factions: QidahenCore['factions']; drawnCards: number } => {
    const sourceFaction = factions[sourceFactionId];
    const availableCards = Math.max(0, sourceFaction.drawPileCount ?? 0);
    const drawnCards = Math.max(0, Math.min(requestedCards, availableCards));
    if (drawnCards <= 0 && discardGain <= 0) {
        return { factions, drawnCards };
    }
    return {
        drawnCards,
        factions: {
            ...factions,
            [sourceFactionId]: {
                ...sourceFaction,
                drawPileCount: availableCards - drawnCards,
                discardPileCount: Math.max(0, sourceFaction.discardPileCount ?? 0) + Math.max(0, discardGain),
            },
        },
    };
};

export const addFactionHandCards = (
    factions: QidahenCore['factions'],
    factionId: QidahenFactionId,
    handGain: number,
): QidahenCore['factions'] => {
    if (handGain <= 0) {
        return factions;
    }
    return {
        ...factions,
        [factionId]: {
            ...factions[factionId],
            handCount: factions[factionId].handCount + handGain,
        },
    };
};

export const drawKoreaCardsForFaction = (
    factions: QidahenCore['factions'],
    koreaDeckCount: number,
    factionId: QidahenFactionId,
    requestedCards: number,
): { factions: QidahenCore['factions']; koreaDeckCount: number; drawnCards: number } => {
    const drawnCards = Math.max(0, Math.min(requestedCards, koreaDeckCount));
    return {
        factions: addFactionHandCards(factions, factionId, drawnCards),
        koreaDeckCount: Math.max(0, koreaDeckCount - drawnCards),
        drawnCards,
    };
};
