import type { PlayerId } from '../../../engine/types';
import type { DiceThroneCore } from './types';
import { STATUS_IDS } from './ids';

/** 玩家覆盖优先；0 表示无限堆叠。 */
export const getTokenStackLimit = (state: DiceThroneCore, playerId: PlayerId, tokenId: string): number => {
    const player = state.players[playerId];
    if (tokenId === STATUS_IDS.CURSED_COIN) return player?.characterId === 'cursed_pirate' ? 5 : 3;
    const override = player?.tokenStackLimits?.[tokenId];
    if (typeof override === 'number') return override === 0 ? Infinity : override;
    const base = (state.tokenDefinitions ?? []).find(token => token.id === tokenId)?.stackLimit;
    return base === 0 ? Infinity : base ?? 99;
};
