import type { EventStreamEntry, PlayerId } from '../../../engine/types';
import {
    MAGE_WARS_EVENTS,
    type MageWarsBasicAttackDefeatAvailableEvent,
    type MageWarsMageDefeatedEvent,
} from '../domain/events';

export function getMageWarsTutorialOutcomeKey(
    winner: PlayerId,
    learner: PlayerId,
    entries: readonly EventStreamEntry[],
) {
    if (winner !== learner) return 'tutorial.outcome.defeat';

    const defeat = [...entries].reverse().find(({ event }) => event.type === MAGE_WARS_EVENTS.MAGE_DEFEATED)
        ?.event as MageWarsMageDefeatedEvent | undefined;
    const wonWithMageAttack = defeat?.payload.winnerId === winner && entries.some(({ event }) => {
        if (event.type !== MAGE_WARS_EVENTS.MAGE_BASIC_ATTACK_DEFEAT_AVAILABLE || event.timestamp !== defeat.timestamp) {
            return false;
        }
        const { sourcePlayerId, targetPlayerId } = (event as MageWarsBasicAttackDefeatAvailableEvent).payload;
        return sourcePlayerId === winner && targetPlayerId === defeat.payload.defeatedPlayerId;
    });

    return wonWithMageAttack ? 'tutorial.outcome.mageAttackVictory' : 'tutorial.outcome.victory';
}
