import type { GameRuntimeAdapter } from '../gameRuntimeAdapter';
import { DiceThronePageBackground } from './ui/DiceThronePageBackground';

export const diceThroneGameRuntimeAdapter: GameRuntimeAdapter = {
    PageProvider: DiceThronePageBackground,
    hudFabLayout: {
        position: 'top-right',
        storageKey: 'game_hud_fab_position:dicethrone:v1',
        resolveInitialOffset: () => ({ top: -48 }),
    },
    seatSwap: {
        mode: 'request',
        requestCommandType: 'REQUEST_SEAT_SWAP',
        respondCommandType: 'RESPOND_SEAT_SWAP',
        cancelCommandType: 'CANCEL_SEAT_SWAP',
    },
};
