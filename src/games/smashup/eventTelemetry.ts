import type { GameEvent } from '../../engine/types';
import type { GameEventTelemetryRecord } from '../../engine/transport/engineConfig';
import { SU_EVENTS, type BaseScoredEvent, type VpAwardedEvent } from './domain/types';

export function formatSmashUpEventTelemetry(event: GameEvent): GameEventTelemetryRecord | null {
    if (event.type === SU_EVENTS.BASE_SCORED) {
        const payload = (event as BaseScoredEvent).payload;
        return {
            eventType: 'base_scored',
            baseDefId: payload.baseDefId,
            rankings: payload.rankings,
            timestamp: event.timestamp,
        };
    }

    if (event.type === SU_EVENTS.VP_AWARDED) {
        const payload = (event as VpAwardedEvent).payload;
        return {
            eventType: 'vp_awarded',
            playerId: payload.playerId,
            amount: payload.amount,
            reason: payload.reason,
            timestamp: event.timestamp,
        };
    }

    return null;
}
