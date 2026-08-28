import type { PlayerId } from '../../../engine/types';
import {
    getDiceThroneCharacterNameKey,
    type DiceThroneCore,
} from './core-types';

type DiceThronePlayerDisplayState = Pick<DiceThroneCore, 'players' | 'selectedCharacters'>;

function formatSeatFallback(playerId: PlayerId): string {
    const seatNumber = Number.parseInt(String(playerId), 10) + 1;
    return Number.isFinite(seatNumber) ? `P${seatNumber}` : String(playerId);
}

export function getDiceThronePlayerChoiceLabel(
    state: DiceThronePlayerDisplayState,
    playerId: PlayerId,
): string {
    const characterId = state.players[playerId]?.characterId ?? state.selectedCharacters[playerId];
    return getDiceThroneCharacterNameKey(characterId) ?? formatSeatFallback(playerId);
}

export function getDiceThronePlayerChoiceListLabel(
    state: DiceThronePlayerDisplayState,
    playerIds: PlayerId[],
): string {
    if (playerIds.length === 0) return 'none';
    return playerIds.map(playerId => getDiceThronePlayerChoiceLabel(state, playerId)).join(', ');
}
