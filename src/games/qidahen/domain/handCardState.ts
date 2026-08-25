import {
    qidahenAtlas05OrdinaryHandPreview,
} from '../ui/cardAtlas';
import { resolveQidahenAtlas05OrdinaryHandCardIdentity } from './handCardIdentity';
import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES } from './ordinaryHandCardIdentities';
import type { QidahenCore, QidahenFactionId, QidahenHandCard } from './types';

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

export const QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION: Record<QidahenFactionId, number[]> = {
    // TTS deckKey 16, ObjectStates[8]：位于大明玩家区，作为大明普通手牌牌堆顺序。
    ming: [
        31, 44, 43, 26, 37, 26, 27, 41, 46, 43, 27, 43, 43, 26, 44, 26, 43, 36, 42, 39, 45,
        43, 32, 43, 38, 45, 43, 33, 28, 26, 43, 38, 26, 41, 26, 34, 26, 43, 29, 36, 28, 35,
    ],
    // TTS deckKey 16, ObjectStates[17]：位于蒙古玩家区，作为蒙古普通手牌牌堆顺序。
    mongol: [
        19, 22, 12, 24, 18, 13, 19, 25, 18, 24, 16, 15, 11, 15, 23, 18, 14, 24, 21, 17, 24, 24,
    ],
    // TTS deckKey 16, ObjectStates[9]：位于后金玩家区，作为后金普通手牌牌堆顺序。
    jin: [
        20, 2, 40, 20, 7, 50, 1, 8, 3, 6, 40, 0, 5, 30, 4, 3, 10, 9, 3, 60,
    ],
};

const buildAtlas05OrdinaryHandCard = (
    atlasIndex: number,
): Pick<QidahenHandCard, 'label' | 'previewRef' | 'cardKind' | 'armamentId' | 'cardDefId' | 'rulesSummary' | 'previewKind' | 'previewIdentityId'> => {
    const identity = resolveQidahenAtlas05OrdinaryHandCardIdentity(atlasIndex);
    const displayIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find((card) => (
        card.atlasIndex === atlasIndex
    ));
    if (!identity || !displayIdentity) {
        throw new Error(`Missing confirmed qidahen atlas05 ordinary hand card identity: atlasIndex=${atlasIndex}`);
    }
    return {
        label: displayIdentity.displayName,
        previewRef: qidahenAtlas05OrdinaryHandPreview(displayIdentity.atlasIndex),
        ...identity,
    };
};

const getFactionAtlas05DeckIndex = (
    factionId: QidahenFactionId,
    sequenceIndex: number,
): number => {
    const deckSequence = QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION[factionId];
    return deckSequence[sequenceIndex % deckSequence.length] ?? sequenceIndex;
};

export const buildInitialHandCards = (
    factions: QidahenCore['factions'],
): QidahenCore['handCards'] => {
    let nextId = 1;
    return factionOrder.flatMap((factionId) => {
        const visibleCardCount = factionId === 'ming'
            ? factions[factionId].handCount + 1
            : factions[factionId].handCount;
        return Array.from({ length: visibleCardCount }, (_, index) => {
            const cardId = `hand-${nextId}`;
            nextId += 1;
            const ordinaryHandCard = buildAtlas05OrdinaryHandCard(getFactionAtlas05DeckIndex(factionId, index));
            return {
                ...ordinaryHandCard,
                id: cardId,
                faction: factionId,
                accent: factionId,
                status: index < factions[factionId].handCount ? 'payable' as const : 'idle' as const,
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
    const nextCards = Array.from({ length: drawCards }, (_, index) => {
        const ordinaryHandCard = buildAtlas05OrdinaryHandCard(getFactionAtlas05DeckIndex(factionId, previewBase + index));
        return {
            ...ordinaryHandCard,
            id: `hand-${currentMaxIndex + index + 1}`,
            faction: factionId,
            accent: factionId,
            status: 'payable' as const,
        };
    });
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
