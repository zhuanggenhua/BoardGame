import type { Server, State } from 'boardgame.io';
import type { MatchState } from '../engine/types';

export type InteractionAdjudicationResult = {
    shouldCancel: boolean;
    reason?:
        | 'missing_state'
        | 'missing_metadata'
        | 'game_over'
        | 'player_not_found'
        | 'player_connected'
        | 'no_pending_interaction'
        | 'interaction_owner_mismatch'
        | 'no_pending_interaction_lock'
        | 'interaction_lock_mismatch';
    interactionId?: string;
};

export type InteractionAdjudicationContext = {
    state?: State;
    metadata?: Server.MatchData;
    playerId: string;
};

type InteractionCoreState = {
    pendingInteraction?: { id: string; playerId: string };
};

export const shouldForceCancelInteraction = ({
    state,
    metadata,
    playerId,
}: InteractionAdjudicationContext): InteractionAdjudicationResult => {
    if (!state?.G) {
        return { shouldCancel: false, reason: 'missing_state' };
    }
    if (state.ctx?.gameover) {
        return { shouldCancel: false, reason: 'game_over' };
    }
    if (!metadata?.players) {
        return { shouldCancel: false, reason: 'missing_metadata' };
    }

    const players = metadata.players as Record<string, { isConnected?: boolean }>;
    const playerMeta = players[playerId];
    if (!playerMeta) {
        return { shouldCancel: false, reason: 'player_not_found' };
    }
    if (playerMeta.isConnected !== false) {
        return { shouldCancel: false, reason: 'player_connected' };
    }

    const matchState = state.G as MatchState<InteractionCoreState>;
    const pendingInteraction = matchState.core.pendingInteraction;
    if (!pendingInteraction) {
        return { shouldCancel: false, reason: 'no_pending_interaction' };
    }
    if (pendingInteraction.playerId !== playerId) {
        return { shouldCancel: false, reason: 'interaction_owner_mismatch' };
    }

    const pendingInteractionId = matchState.sys?.responseWindow?.current?.pendingInteractionId;
    if (!pendingInteractionId) {
        return { shouldCancel: false, reason: 'no_pending_interaction_lock' };
    }
    if (pendingInteractionId !== pendingInteraction.id) {
        return { shouldCancel: false, reason: 'interaction_lock_mismatch' };
    }

    return {
        shouldCancel: true,
        interactionId: pendingInteraction.id,
    };
};
