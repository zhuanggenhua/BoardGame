import type {
    BetrayalCore,
    BetrayalInventoryCard,
} from './game';
import {
    BETRAYAL_DISCOVERY_POOLS,
    type BetrayalDeckKind,
} from './scenarioConfig';
import { resolveInventoryEffectId } from './possessionEffects';

type BetrayalPossessionDeckKind = Exclude<BetrayalDeckKind, 'event'>;

export const DRAW_POOL: Record<BetrayalPossessionDeckKind, BetrayalInventoryCard[]> = {
    item: BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => ({ ...card })),
    omen: BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => ({ ...card })),
};

export function cloneInventoryCard(card: BetrayalInventoryCard): BetrayalInventoryCard {
    return { ...card };
}

export function clonePossessionOrderByKind(
    order: Record<BetrayalPossessionDeckKind, BetrayalInventoryCard[]>,
): Record<BetrayalPossessionDeckKind, BetrayalInventoryCard[]> {
    return {
        item: order.item.map(cloneInventoryCard),
        omen: order.omen.map(cloneInventoryCard),
    };
}

function findPossessionDeckIndex(
    core: BetrayalCore,
    kind: BetrayalPossessionDeckKind,
    cardId: string,
): number {
    const effectId = resolveInventoryEffectId(cardId);
    return core.possessionOrderByKind[kind].findIndex(
        (card) => resolveInventoryEffectId(card.id) === effectId,
    );
}

export function removePossessionCardFromDeck(
    core: BetrayalCore,
    kind: BetrayalPossessionDeckKind,
    cardId: string,
): void {
    const deck = [...core.possessionOrderByKind[kind]];
    const index = findPossessionDeckIndex(core, kind, cardId);
    if (index >= 0) {
        deck.splice(index, 1);
        core.possessionOrderByKind = {
            ...core.possessionOrderByKind,
            [kind]: deck,
        };
    }
    core.deckCounts[kind] = Math.max(0, core.deckCounts[kind] - 1);
}

export function buryPossessionCardToBottom(
    core: BetrayalCore,
    kind: BetrayalPossessionDeckKind,
    cardId: string,
): void {
    const deck = [...core.possessionOrderByKind[kind]];
    const index = findPossessionDeckIndex(core, kind, cardId);
    if (index < 0) {
        return;
    }
    const [card] = deck.splice(index, 1);
    if (card) {
        deck.push(card);
    }
    core.possessionOrderByKind = {
        ...core.possessionOrderByKind,
        [kind]: deck,
    };
}

export function restorePossessionCardToTop(
    core: BetrayalCore,
    kind: BetrayalPossessionDeckKind,
    card: BetrayalInventoryCard,
): void {
    const effectId = resolveInventoryEffectId(card.id);
    if (core.possessionOrderByKind[kind].some(
        (deckCard) => resolveInventoryEffectId(deckCard.id) === effectId,
    )) {
        core.deckCounts[kind] += 1;
        return;
    }
    core.possessionOrderByKind = {
        ...core.possessionOrderByKind,
        [kind]: [{ id: effectId, name: card.name, kind }, ...core.possessionOrderByKind[kind]],
    };
    core.deckCounts[kind] += 1;
}

export function restorePossessionCardToBottom(
    core: BetrayalCore,
    kind: BetrayalPossessionDeckKind,
    card: BetrayalInventoryCard,
): void {
    const effectId = resolveInventoryEffectId(card.id);
    if (core.possessionOrderByKind[kind].some(
        (deckCard) => resolveInventoryEffectId(deckCard.id) === effectId,
    )) {
        return;
    }
    core.possessionOrderByKind = {
        ...core.possessionOrderByKind,
        [kind]: [...core.possessionOrderByKind[kind], { ...card, id: effectId, kind }],
    };
    core.deckCounts[kind] += 1;
}
