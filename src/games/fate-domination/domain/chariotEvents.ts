import type { RandomFn } from '../../../engine/types';
import { drawFateCards } from './cardDraw';
import type { EventCardDefinition, FateDominationCore } from './types';

/** A pending replacement contains authoritative draw facts, not a second event deck. */
export interface FateChariotDraw {
    locationId: 'miyama' | 'shinto';
    discarded: EventCardDefinition;
    offered: [EventCardDefinition, EventCardDefinition];
    deck: EventCardDefinition[];
    discard: EventCardDefinition[];
}

/** Targets are public positions; hidden deck identities never enter the query. */
export function fateChariotTargets(core: FateDominationCore, playerId: string): string[] {
    const location = core.players[playerId]?.locationId;
    if (location !== 'miyama' && location !== 'shinto') return [];
    const remaining = core.publicView ? core.eventDeckCount + core.eventDiscardCount : core.eventDeck.length + core.eventDiscard.length;
    if (remaining + 1 < 2) return [];
    return core.currentEvents[location].map(card => card.id);
}

/** Discard the selected event before drawing, so an exhausted deck may recycle it. */
export function prepareFateChariotDraw(core: FateDominationCore, playerId: string, targetId: string, random: RandomFn): FateChariotDraw | undefined {
    const locationId = core.players[playerId]?.locationId;
    if (locationId !== 'miyama' && locationId !== 'shinto') return undefined;
    const matches = core.currentEvents[locationId].filter(card => card.id === targetId);
    if (matches.length !== 1) return undefined;
    const discarded = matches[0];
    if (core.eventDeck.length + core.eventDiscard.length + 1 < 2) return undefined;
    const draw = drawFateCards(core.eventDeck, [...core.eventDiscard, discarded], 2, random);
    if (draw.drawn.length !== 2) return undefined;
    return { locationId, discarded, offered: [draw.drawn[0], draw.drawn[1]], deck: draw.deck, discard: draw.discard };
}

/** Choosing one event returns the other to the remaining deck before shuffling. */
export function finishFateChariotDraw(draw: FateChariotDraw, chosenId: string, random: RandomFn) {
    const chosenIndex = draw.offered.findIndex(card => card.id === chosenId);
    if (chosenIndex < 0 || draw.offered.filter(card => card.id === chosenId).length !== 1) return undefined;
    return {
        selected: draw.offered[chosenIndex],
        deck: random.shuffle([...draw.deck, draw.offered[1 - chosenIndex]]),
        discard: draw.discard,
    };
}
