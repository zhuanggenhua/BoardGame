import type { PlayerId } from './types';

/** 在线旁观者在 playerView 中使用的统一身份标记。 */
export const SPECTATOR_PLAYER_ID = '__spectator__' as const;

export function isSpectatorPlayerId(playerId: PlayerId | null | undefined): boolean {
    return playerId === SPECTATOR_PLAYER_ID;
}
