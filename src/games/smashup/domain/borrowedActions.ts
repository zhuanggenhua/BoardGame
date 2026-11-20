import type { PlayerId } from '../../../engine/types';
import { createCardObjectRefFromInstance, createCardTransferEvent } from './objectProvenance';
import { SU_EVENTS, type SmashUpCore, type SmashUpEvent } from './types';

export function buildBorrowedActionReturnEvents(core: SmashUpCore, borrowerId: PlayerId, now: number): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (const loan of core.borrowedActions ?? []) {
        if (loan.borrowerId !== borrowerId || loan.turnNumber !== core.turnNumber) continue;
        const { cardUid, defId, ownerId, reason } = loan;
        if (core.players[ownerId]?.hand.some(card => card.uid === cardUid)) continue;
        const inPlay = core.bases.some(base =>
            base.ongoingActions.some(card => card.uid === cardUid)
            || base.buriedCards?.some(card => card.uid === cardUid)
            || base.minions.some(minion => minion.uid === cardUid || minion.attachedActions.some(card => card.uid === cardUid)),
        );
        const source = Object.entries(core.players).find(([, player]) =>
            player.hand.some(card => card.uid === cardUid)
            || player.deck.some(card => card.uid === cardUid)
            || player.discard.some(card => card.uid === cardUid),
        );
        const stored = !inPlay && !source ? Object.values(core.players)
            .flatMap(player => player.storedCards ?? []).find(card => card.uid === cardUid) : undefined;
        if (!inPlay && !source && !stored) continue;
        if (stored) {
            const fromPlayerId = stored.storedByPlayerId;
            events.push(
                { type: SU_EVENTS.STORED_CARD_RELEASED, payload: { playerId: fromPlayerId, cardUid, reason }, timestamp: now },
                createCardTransferEvent({ card: createCardObjectRefFromInstance(stored), fromPlayerId, toPlayerId: ownerId, reason, timestamp: now }),
            );
            continue;
        }
        events.push({
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: { cardUid, defId, fromPlayerId: source?.[0] ?? borrowerId, toPlayerId: ownerId, reason },
            timestamp: now,
        });
    }
    return events;
}
