import type { MatchMetadata, StoredMatchState } from '../engine/transport/storage';
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
    state?: StoredMatchState;
    metadata?: MatchMetadata;
    playerId: string;
};

type InteractionCoreState = {
    pendingInteraction?: { id: string; playerId: string };
    gameover?: unknown;
};

type InteractionRuntimeState = {
    core?: InteractionCoreState;
    sys?: {
        interaction?: {
            current?: { id: string; playerId: string };
        };
        responseWindow?: {
            current?: {
                pendingInteractionId?: string;
            };
        };
    };
};

export const shouldForceCancelInteraction = ({
    state,
    metadata,
    playerId,
}: InteractionAdjudicationContext): InteractionAdjudicationResult => {
    if (!state?.G) {
        return { shouldCancel: false, reason: 'missing_state' };
    }

    const runtimeState = state.G as MatchState<InteractionCoreState> & InteractionRuntimeState;

    // 从 sys.gameover 或 metadata.gameover 检查游戏是否结束
    if (runtimeState.sys?.gameover || metadata?.gameover) {
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

    const pendingInteraction = runtimeState.sys?.interaction?.current
        ?? runtimeState.core?.pendingInteraction;
    if (!pendingInteraction) {
        return { shouldCancel: false, reason: 'no_pending_interaction' };
    }
    if (pendingInteraction.playerId !== playerId) {
        return { shouldCancel: false, reason: 'interaction_owner_mismatch' };
    }

    const responseWindowCurrent = runtimeState.sys?.responseWindow?.current;
    if (responseWindowCurrent) {
        const pendingInteractionId = responseWindowCurrent.pendingInteractionId;
        if (!pendingInteractionId) {
            return { shouldCancel: false, reason: 'no_pending_interaction_lock' };
        }
        if (pendingInteractionId !== pendingInteraction.id) {
            return { shouldCancel: false, reason: 'interaction_lock_mismatch' };
        }
    }

    return {
        shouldCancel: true,
        interactionId: pendingInteraction.id,
    };
};
