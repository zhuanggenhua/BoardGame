import type { MatchState, PlayerId } from '../../../engine/types';
import type { OngoingDetachedEvent, SmashUpCore } from './types';
import { SU_EVENTS } from './types';

export interface LiveOngoingCardLocation {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    baseIndex: number;
    targetType: 'base' | 'minion';
    targetMinionUid?: string;
    talentUsed?: boolean;
    metadata?: Record<string, unknown>;
}

export function findLiveOngoingCardLocation(
    state: SmashUpCore | MatchState<SmashUpCore>,
    cardUid: string,
): LiveOngoingCardLocation | undefined {
    const core = 'core' in state ? state.core : state;

    for (const [baseIndex, base] of core.bases.entries()) {
        const ongoingAction = base.ongoingActions.find((action) => action.uid === cardUid);
        if (ongoingAction) {
            return {
                cardUid: ongoingAction.uid,
                defId: ongoingAction.defId,
                ownerId: ongoingAction.ownerId,
                baseIndex,
                targetType: 'base',
                talentUsed: ongoingAction.talentUsed,
                metadata: ongoingAction.metadata,
            };
        }

        for (const minion of base.minions) {
            const attachedAction = minion.attachedActions.find((action) => action.uid === cardUid);
            if (!attachedAction) continue;
            return {
                cardUid: attachedAction.uid,
                defId: attachedAction.defId,
                ownerId: attachedAction.ownerId,
                baseIndex,
                targetType: 'minion',
                targetMinionUid: minion.uid,
                talentUsed: attachedAction.talentUsed,
                metadata: attachedAction.metadata,
            };
        }
    }

    return undefined;
}

export function buildOngoingDetachedEvent(params: {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    reason: string;
    now?: number;
    clydeReturnToHand?: boolean;
    destination?: 'discard' | 'hand';
    sourcePlayerId?: PlayerId;
    sourceCardUid?: string;
    sourceDefId?: string;
    sourceControllerId?: PlayerId;
    sourceBaseIndex?: number;
}): OngoingDetachedEvent {
    return {
        type: SU_EVENTS.ONGOING_DETACHED,
        payload: {
            cardUid: params.cardUid,
            defId: params.defId,
            ownerId: params.ownerId,
            reason: params.reason,
            ...(params.clydeReturnToHand !== undefined ? { clydeReturnToHand: params.clydeReturnToHand } : {}),
            ...(params.destination !== undefined ? { destination: params.destination } : {}),
            ...(params.sourcePlayerId !== undefined ? { sourcePlayerId: params.sourcePlayerId } : {}),
            ...(params.sourceCardUid !== undefined ? { sourceCardUid: params.sourceCardUid } : {}),
            ...(params.sourceDefId !== undefined ? { sourceDefId: params.sourceDefId } : {}),
            ...(params.sourceControllerId !== undefined ? { sourceControllerId: params.sourceControllerId } : {}),
            ...(params.sourceBaseIndex !== undefined ? { sourceBaseIndex: params.sourceBaseIndex } : {}),
        },
        timestamp: params.now,
    };
}

export function buildValidatedOngoingDetachEvents(
    state: SmashUpCore | MatchState<SmashUpCore>,
    params: {
        cardUid: string;
        defId?: string;
        ownerId?: PlayerId;
        reason: string;
        now: number;
        expectedLocation?: 'base' | 'minion' | 'any';
        clydeReturnToHand?: boolean;
        destination?: 'discard' | 'hand';
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): OngoingDetachedEvent[] {
    const location = findLiveOngoingCardLocation(state, params.cardUid);
    if (!location) return [];
    if (
        params.expectedLocation
        && params.expectedLocation !== 'any'
        && location.targetType !== params.expectedLocation
    ) {
        return [];
    }

    return [buildOngoingDetachedEvent({
        cardUid: location.cardUid,
        defId: location.defId ?? params.defId ?? '',
        ownerId: location.ownerId ?? params.ownerId,
        reason: params.reason,
        now: params.now,
        clydeReturnToHand: params.clydeReturnToHand,
        destination: params.destination,
        sourcePlayerId: params.sourcePlayerId,
        sourceCardUid: params.sourceCardUid,
        sourceDefId: params.sourceDefId,
        sourceControllerId: params.sourceControllerId,
        sourceBaseIndex: params.sourceBaseIndex,
    })];
}
