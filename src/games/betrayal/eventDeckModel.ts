import { BETRAYAL_INITIAL_DECK_COUNTS } from './deckModel';
import type { BetrayalCore } from './game';
import {
    BETRAYAL_DISCOVERY_POOLS,
    isBetrayalEventRuntimeSupported,
    type BetrayalDeckKind,
    type BetrayalEventSeed,
} from './scenarioConfig';
import { cloneUseEffect } from './possessionEffects';

type EventTemplate = BetrayalEventSeed;

export const EVENT_POOL: EventTemplate[] = BETRAYAL_DISCOVERY_POOLS.events
    .filter(isBetrayalEventRuntimeSupported)
    .map((event) => ({
        ...event,
        effect: event.effect ? { ...event.effect } : undefined,
        roll: event.roll
            ? {
                ...event.roll,
                branches: event.roll.branches.map((branch) => ({
                    ...branch,
                    effect: { ...branch.effect },
                })),
            }
            : undefined,
    }));

export function cloneEventTemplate(event: EventTemplate): EventTemplate {
    return {
        ...event,
        effect: event.effect ? cloneUseEffect(event.effect) : undefined,
        roll: event.roll
            ? {
                ...event.roll,
                branches: event.roll.branches.map((branch) => ({
                    ...branch,
                    effect: cloneUseEffect(branch.effect),
                })),
            }
            : undefined,
    };
}

export function countDrawnCards(core: BetrayalCore, kind: BetrayalDeckKind): number {
    return Math.max(0, BETRAYAL_INITIAL_DECK_COUNTS[kind] - core.deckCounts[kind]);
}

export function resolveEvent(core: BetrayalCore): EventTemplate {
    return cloneEventTemplate(core.eventOrder[0]!);
}

export function buryEventCardToBottom(core: BetrayalCore, eventName: string): void {
    if (core.eventOrder.length <= 1) {
        return;
    }
    const deck = core.eventOrder.map(cloneEventTemplate);
    const index = Math.max(0, deck.findIndex((eventCard) => eventCard.name === eventName));
    const [eventCard] = deck.splice(index, 1);
    if (eventCard) {
        deck.push(eventCard);
    }
    core.eventOrder = deck;
}

export function removeEventCardForUponReflectionHint(core: BetrayalCore, eventName: string): void {
    const index = core.eventOrder.findIndex((eventCard) => eventCard.name === eventName);
    if (index < 0) {
        return;
    }
    const deck = core.eventOrder.map(cloneEventTemplate);
    deck.splice(index, 1);
    core.eventOrder = deck;
    core.deckCounts.event = Math.max(0, core.deckCounts.event - 1);
}
