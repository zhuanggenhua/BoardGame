import type { PlayerId } from '../../../engine/types';
import type { DiceThroneCore } from './types';
import { STATUS_IDS } from './ids';
import { isMoveAllowed } from './rules';

export type StunLikeStatusActionBlockOptions = {
    requireActivePlayer?: boolean;
};

export const getActionBlockedByStunLikeStatus = (
    state: DiceThroneCore,
    playerId: PlayerId,
    options: StunLikeStatusActionBlockOptions = {},
): string | null => {
    const requireActivePlayer = options.requireActivePlayer ?? true;
    if (requireActivePlayer && !isMoveAllowed(playerId, state.activePlayerId)) {
        return null;
    }

    const player = state.players[playerId];
    if (!player) {
        return null;
    }

    const dazeStacks = player.statusEffects[STATUS_IDS.DAZE] ?? 0;
    if (dazeStacks > 0) {
        return 'player_is_dazed';
    }

    const stunStacks = player.statusEffects[STATUS_IDS.STUN] ?? 0;
    if (stunStacks > 0) {
        return 'player_is_stunned';
    }

    return null;
};
