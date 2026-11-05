import {
    qidahenAtlas05OrdinaryHandPreview,
} from '../ui/cardAtlas';
import { resolveQidahenAtlas05OrdinaryHandCardIdentity } from './handCardIdentity';
import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES } from './ordinaryHandCardIdentities';
import { isQidahenSpecialCard } from './specialCards';
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

export const getQidahenOrdinaryDeckSequence = (
    factionId: QidahenFactionId,
    specialCardsEnabled = false,
): number[] => QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION[factionId]
    .filter(index => specialCardsEnabled || !isQidahenSpecialCard(factionId, index));

/** TTS牌堆已不含场外初始军备；先过滤特典，再从同一实体序列发起始手牌。 */
export const buildInitialCardPiles = (
    factions: QidahenCore['factions'],
    specialCardsEnabled = false,
    shuffle: (cards: QidahenHandCard[], factionId: QidahenFactionId) => QidahenHandCard[] = cards => cards,
    deal = true,
): Pick<QidahenCore, 'factions' | 'handCards' | 'activeEventCards'> => {
    const nextFactions = { ...factions };
    const handCards: QidahenHandCard[] = [];
    let initialHandSerial = 0;
    const activeEventCards: QidahenCore['activeEventCards'] = [];
    for (const factionId of factionOrder) {
        const initialAtlasIndex = { ming: 26, mongol: 19, jin: 3 }[factionId];
        const cards = [...getQidahenOrdinaryDeckSequence(factionId, specialCardsEnabled), initialAtlasIndex].map((atlasIndex, index): QidahenHandCard => ({
            ...buildAtlas05OrdinaryHandCard(atlasIndex),
            id: `deck-${factionId}-${index + 1}`,
            faction: factionId,
            accent: factionId,
            status: 'payable',
        }));
        const developedCards: QidahenHandCard[] = [];
        const armaments = factions[factionId].armaments.map(armament => {
            const sources: string[] = [];
            for (let level = 0; level < armament.level; level += 1) {
                const bannerCardSlot = { 'manzhou-banners': 6, 'mongol-banners': 7, 'han-banners': 5 }[armament.id as 'manzhou-banners' | 'mongol-banners' | 'han-banners'];
                let index = cards.length - 1;
                while (index >= 0 && (bannerCardSlot == null
                    ? cards[index].armamentId !== armament.id
                    : cards[index].cardDefId !== `qidahen-atlas05-160${bannerCardSlot}-establish-${armament.id}`)) index -= 1;
                if (index < 0) throw new Error(`Missing initial armament entity: ${factionId}/${armament.id}`);
                const [card] = cards.splice(index, 1);
                if (card.cardKind === 'event') {
                    activeEventCards.push({ id: `active-event-${card.id}`, cardDefId: card.cardDefId!, label: card.label, ownerFactionId: factionId, rulesSummary: card.rulesSummary ?? null, sourceCard: card });
                } else developedCards.push(card);
                sources.push(card.cardDefId!);
            }
            return { ...armament, sourceCardDefIds: sources };
        });
        const shuffledCards = shuffle(cards, factionId);
        const handCount = deal ? factions[factionId].handCount : 0;
        handCards.push(...shuffledCards.splice(0, handCount).map(card => ({ ...card, id: `hand-${++initialHandSerial}` })));
        const drawPile = shuffledCards;
        nextFactions[factionId] = { ...factions[factionId], handCount, armaments, developedCards, drawPile, discardPile: [], drawPileCount: drawPile.length, discardPileCount: 0 };
    }
    return { factions: nextFactions, handCards, activeEventCards };
};

export const buildInitialHandCards = (factions: QidahenCore['factions'], specialCardsEnabled = false): QidahenHandCard[] => (
    buildInitialCardPiles(factions, specialCardsEnabled).handCards
);

export const getFactionDrawPileCount = (state: QidahenCore, factionId: QidahenFactionId): number => (
    state.factions[factionId].drawPile.length + state.factions[factionId].discardPile.length
);

/** 空牌堆按原顺序翻回弃牌堆，不洗牌、不按计数重新生成卡牌。 */
export const drawFromFactionPile = (
    factions: QidahenCore['factions'],
    sourceFactionId: QidahenFactionId,
    requestedCards: number,
    discardGain = 0,
): { factions: QidahenCore['factions']; drawnCards: number; cards: QidahenHandCard[] } => {
    const source = factions[sourceFactionId];
    let drawPile = [...source.drawPile];
    let discardPile = [...source.discardPile];
    const cards: QidahenHandCard[] = [];
    for (let index = 0; index < requestedCards; index += 1) {
        if (drawPile.length === 0) {
            drawPile = discardPile;
            discardPile = [];
        }
        const card = drawPile.shift();
        if (!card) break;
        cards.push(card);
    }
    // 劫掠抽出的末尾牌直接入弃牌，不作为手牌再造一次。
    const discarded = cards.splice(Math.max(0, cards.length - discardGain), discardGain);
    discardPile.push(...discarded);
    return {
        drawnCards: cards.length + discarded.length,
        cards,
        factions: {
            ...factions,
            [sourceFactionId]: { ...source, drawPile, discardPile, drawPileCount: drawPile.length, discardPileCount: discardPile.length },
        },
    };
};

export const appendDrawnHandCards = (
    handCards: QidahenHandCard[], cards: QidahenHandCard[], ownerFactionId: QidahenFactionId,
): QidahenHandCard[] => [...handCards, ...cards.map(card => ({ ...card, faction: ownerFactionId, status: 'payable' as const }))];

/** 所有实际弃牌沿用同一实体，依弃牌顺序进入所属势力弃牌堆。 */
export const discardQidahenHandCards = (
    state: QidahenCore, cardIds: readonly string[],
): Pick<QidahenCore, 'factions' | 'handCards' | 'drawPileCount' | 'discardPileCount' | 'koreaDiscardPile' | 'koreaDiscardCount'> => {
    const selected = new Set(cardIds);
    const factions = { ...state.factions };
    for (const factionId of factionOrder) {
        const removed = cardIds.flatMap(id => {
            const card = state.handCards.find(candidate => candidate.id === id && candidate.faction === factionId);
            return card ? [card] : [];
        });
        if (removed.length === 0) continue;
        const faction = factions[factionId];
        const discardPile = [...faction.discardPile, ...removed.filter(card => card.originDeck !== 'korea')];
        factions[factionId] = { ...faction, handCount: faction.handCount - removed.length, discardPile, discardPileCount: discardPile.length };
    }
    const koreaDiscardPile = [...state.koreaDiscardPile, ...cardIds.flatMap(id => {
        const card = state.handCards.find(candidate => candidate.id === id && candidate.originDeck === 'korea');
        if (!card) return [];
        const { faction: _owner, status: _status, ...deckCard } = card;
        return [deckCard];
    })];
    return {
        factions,
        koreaDiscardPile,
        koreaDiscardCount: koreaDiscardPile.length,
        handCards: state.handCards.filter(card => !selected.has(card.id)),
        drawPileCount: factions.ming.drawPileCount,
        discardPileCount: factions.ming.discardPileCount,
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
