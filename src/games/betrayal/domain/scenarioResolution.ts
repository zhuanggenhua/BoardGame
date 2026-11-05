import type { BetrayalCore, BetrayalExplorerSummary, BetrayalInventoryCard, BetrayalRoomNode, BetrayalUponReflectionSecretCombination, EventTemplate, BetrayalEndgameResult } from './types';
import { resolveMummyTraitorVictoryResult } from '../hauntVictoryModel';
import { reduceEvent } from './reducer';
import { nowEvent } from './execute';
import { EVENTS } from '../events';
import type { BetrayalCommandMap } from '../commandTypes';
import { BETRAYAL_COMMANDS } from '../commands';
import { resolveInventoryEffectId } from '../possessionEffects';
import { cloneEventTemplate } from '../eventDeckModel';

export function completeMummyTraitorVictoryIfNeeded(core: BetrayalCore, timestamp: number): BetrayalCore | null {
    const result = resolveMummyTraitorVictoryResult(core);
    if (!result) {
        return null;
    }
    return reduceEvent(
        core,
        nowEvent(
            EVENTS.SCENARIO_COMPLETED,
            {
                result,
            },
            timestamp,
        ),
    );
}

export function resolveUponReflectionOmenSelection(
    actor: BetrayalExplorerSummary,
    payload: BetrayalCommandMap[typeof BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE],
): BetrayalInventoryCard | null {
    const requestedId = payload.omenId ? resolveInventoryEffectId(payload.omenId) : null;
    const requestedName = payload.omenName?.trim();
    const omenCards = actor.inventory.filter((card) => card.kind === 'omen');
    return (
        omenCards.find(
            (card) =>
                (requestedId && resolveInventoryEffectId(card.id) === requestedId) ||
                (payload.omenId && card.id === payload.omenId) ||
                (requestedName && card.name === requestedName),
        ) ?? null
    );
}

export function roomMatchesUponReflectionSecret(
    room: BetrayalRoomNode | null | undefined,
    secret: BetrayalUponReflectionSecretCombination,
): boolean {
    if (!room) {
        return false;
    }
    return (
        room.id === secret.roomId ||
        room.name === secret.roomName ||
        (secret.roomVisualId ? room.visualId === secret.roomVisualId : false)
    );
}

export function resolveUponReflectionHintEvent(
    core: BetrayalCore,
    eventName: string | undefined,
): EventTemplate | null {
    const requestedEventName = eventName?.trim();
    if (!requestedEventName) {
        return null;
    }
    const eventCard = core.eventOrder.find((candidate) => candidate.name === requestedEventName);
    return eventCard ? cloneEventTemplate(eventCard) : null;
}

export function hasUsedMirrorHintThisTurn(core: BetrayalCore, revealerPlayerId: string): boolean {
    return (
        core.usedCardIdsThisTurn.includes('give-mirror-hint') ||
        Boolean(
            core.scenarioRuntime.uponReflection?.hintedEvents.some(
                (hintedEvent) =>
                    hintedEvent.revealerPlayerId === revealerPlayerId && hintedEvent.turnNumber === core.turnNumber,
            ),
        )
    );
}

export function reduceScenarioCompletionStateResolution(
    resolution: { core: BetrayalCore; scenarioCompletedResult?: BetrayalEndgameResult },
    timestamp: number,
): BetrayalCore {
    if (!resolution.scenarioCompletedResult) {
        return resolution.core;
    }
    return reduceEvent(
        resolution.core,
        nowEvent(
            EVENTS.SCENARIO_COMPLETED,
            {
                result: resolution.scenarioCompletedResult,
            },
            timestamp,
        ),
    );
}
