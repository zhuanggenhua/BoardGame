import type { PlayerId } from '../../../engine/types';
import type { QidahenCore, QidahenFactionId } from './types';

const QIDAHEN_FACTION_ORDER: readonly QidahenFactionId[] = ['ming', 'mongol', 'jin'];

export const getFactionIdByPlayerId = (
    state: QidahenCore,
    playerId: PlayerId,
): QidahenFactionId => (
    QIDAHEN_FACTION_ORDER.find((factionId) => state.factions[factionId].playerId === playerId) ?? 'ming'
);

export const getCurrentFactionId = (
    state: QidahenCore,
): QidahenFactionId => (
    getFactionIdByPlayerId(state, state.currentPlayer)
);
