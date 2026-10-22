import type { LocalRuntimeControlResolver } from '../../engine/transport/followCurrentTurnPlayer';
import type { BetrayalCore } from './game';
import {
    resolvePendingCardResolutionAcknowledgedPlayerIds,
    resolvePendingCardResolutionRequiredPlayerIds,
    resolvePendingEventRollResolutionAcknowledgedPlayerIds,
    resolvePendingEventRollResolutionRequiredPlayerIds,
} from './acknowledgementReadModel';

/** Local hot-seat acknowledgements use their human owner, without changing the turn actor. */
export const resolveBetrayalLocalRuntimeControlledPlayerId: LocalRuntimeControlResolver = ({ state, fallbackPlayerId }) => {
    const core = state.core as BetrayalCore;
    if (core.pendingEventChoice || core.pendingEventRollStart) return fallbackPlayerId;
    const missingHuman = (required: readonly string[], acknowledged: readonly string[]) => required.find(playerId =>
        !acknowledged.includes(playerId)
        && (!core.seatControllers?.[playerId] || core.seatControllers[playerId].type === 'human'));

    const roll = core.pendingEventRollResolution;
    if (roll) {
        if (roll.requiresAcknowledgement === false || roll.requiresPlayerAdvance) return fallbackPlayerId;
        return missingHuman(
            resolvePendingEventRollResolutionRequiredPlayerIds(core, roll),
            resolvePendingEventRollResolutionAcknowledgedPlayerIds(roll),
        ) ?? fallbackPlayerId;
    }
    const card = core.pendingCardResolutionQueue?.[0];
    if (!card) return fallbackPlayerId;
    const acknowledged = resolvePendingCardResolutionAcknowledgedPlayerIds(card);
    // Do not take over an unfinished search; preserve the existing local operator.
    if (card.processCards?.length && !acknowledged.includes(card.playerId)) return fallbackPlayerId;
    return missingHuman(resolvePendingCardResolutionRequiredPlayerIds(card), acknowledged) ?? fallbackPlayerId;
};
