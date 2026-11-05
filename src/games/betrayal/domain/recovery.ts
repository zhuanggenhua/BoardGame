import type { MatchState } from '../../../engine/types';
import type { BetrayalCore } from './types';
import { BETRAYAL_COMMANDS } from '../commands';
import {
    resolvePendingEventRollResolutionRequiredPlayerIds,
    resolvePendingEventRollResolutionAcknowledgedPlayerIds,
    resolvePendingTurnEndRoll,
} from '../acknowledgementReadModel';

export const resolveBetrayalPendingCardResolutionRecovery = (args: { state: MatchState<unknown>; phase: string }) => {
    const core = args.state.core as Partial<Pick<BetrayalCore, 'pendingCardResolutionQueue'>> | undefined;
    const pendingResolution = core?.pendingCardResolutionQueue?.[0];
    if (!pendingResolution) {
        return null;
    }

    const requiredPlayerIds = pendingResolution.requiredPlayerIds?.length
        ? pendingResolution.requiredPlayerIds
        : [pendingResolution.playerId];
    const acknowledgedPlayerIds = new Set(pendingResolution.acknowledgedPlayerIds ?? []);
    const playerId = requiredPlayerIds.find((candidate) => !acknowledgedPlayerIds.has(candidate));
    if (!playerId) {
        return null;
    }

    const resolutionId = pendingResolution.id;
    return {
        playerId,
        fingerprintHint: `card-resolution:${playerId}:${args.phase}:${resolutionId}:${requiredPlayerIds.join(',')}:${[...acknowledgedPlayerIds].join(',')}`,
        attemptSuffix: `card-resolution:${playerId}:${resolutionId}`,
        command: {
            type: BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION,
            payload: { resolutionId },
        },
    };
};

export const resolveBetrayalPendingEventRollResolutionRecovery = (args: {
    state: MatchState<unknown>;
    phase: string;
}) => {
    const core = args.state.core as
        Partial<Pick<BetrayalCore, 'pendingEventRollResolution' | 'playerIds' | 'seatControllers'>> | undefined;
    const pendingResolution = core?.pendingEventRollResolution;
    if (!pendingResolution) {
        return null;
    }
    if (pendingResolution.requiresAcknowledgement === false) {
        return null;
    }

    const requiredPlayerIds = resolvePendingEventRollResolutionRequiredPlayerIds(
        {
            playerIds: core?.playerIds ?? [],
            seatControllers: core?.seatControllers,
        },
        pendingResolution,
    );
    const acknowledgedPlayerIds = new Set(resolvePendingEventRollResolutionAcknowledgedPlayerIds(pendingResolution));
    const playerId = requiredPlayerIds.find((candidate) => !acknowledgedPlayerIds.has(candidate));
    if (!playerId) {
        return null;
    }

    return {
        playerId,
        fingerprintHint: `event-roll-resolution:${playerId}:${args.phase}:${pendingResolution.rollId}:${requiredPlayerIds.join(',')}:${[...acknowledgedPlayerIds].join(',')}`,
        attemptSuffix: `event-roll-resolution:${playerId}:${pendingResolution.rollId}`,
        command: {
            type: BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
            payload: { rollId: pendingResolution.rollId },
        },
    };
};

export const resolveBetrayalPendingTurnEndRollRecovery = (args: { state: MatchState<unknown>; phase: string }) => {
    const core = args.state.core as Partial<Pick<BetrayalCore, 'currentPlayer' | 'recentRoll'>> | undefined;
    if (!core?.currentPlayer || !core.recentRoll) {
        return null;
    }

    const pendingRoll = resolvePendingTurnEndRoll(core as Pick<BetrayalCore, 'currentPlayer' | 'recentRoll'>);
    if (!pendingRoll) {
        return null;
    }

    const nextPlayerId =
        pendingRoll.roomEndTurn?.nextPlayerId ?? pendingRoll.deathPrevention?.nextPlayerId ?? 'unknown-next-player';
    const fingerprintHint = `turn-end-roll:${pendingRoll.playerId}:${args.phase}:${pendingRoll.id}:${nextPlayerId}`;

    return {
        playerId: pendingRoll.playerId,
        fingerprintHint,
        attemptSuffix: fingerprintHint,
        command: {
            type: BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL,
            payload: {},
        },
    };
};

export const resolveBetrayalPendingEventRollStartRecovery = (args: { state: MatchState<unknown>; phase: string }) => {
    const core = args.state.core as Partial<Pick<BetrayalCore, 'pendingEventRollStart'>> | undefined;
    const pending = core?.pendingEventRollStart;
    if (!pending) {
        return null;
    }

    return {
        playerId: pending.playerId,
        fingerprintHint: `event-roll-start:${pending.playerId}:${args.phase}:${pending.roomId}:${pending.sourceTitle}`,
        attemptSuffix: `event-roll-start:${pending.playerId}:${pending.sourceTitle}`,
        command: {
            type: BETRAYAL_COMMANDS.ROLL_EVENT,
            payload: { sourceTitle: pending.sourceTitle },
        },
    };
};

export const resolveBetrayalSeatLegalOnlyRecovery = (args: { state: MatchState<unknown>; phase: string }) =>
    resolveBetrayalPendingTurnEndRollRecovery(args) ??
    resolveBetrayalPendingEventRollStartRecovery(args) ??
    resolveBetrayalPendingEventRollResolutionRecovery(args) ??
    resolveBetrayalPendingCardResolutionRecovery(args);

export const shouldSuppressBetrayalActiveTurnRecovery = (args: { state: MatchState<unknown> }) => {
    const core = args.state.core as
        | Partial<
              Pick<BetrayalCore, 'pendingCardResolutionQueue' | 'pendingEventRollResolution' | 'pendingEventRollStart'>
          >
        | undefined;
    return Boolean(
        core?.pendingCardResolutionQueue?.length || core?.pendingEventRollStart || core?.pendingEventRollResolution,
    );
};
