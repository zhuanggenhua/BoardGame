import type { GameRuntimeAdapter } from '../gameRuntimeAdapter';
import { DiceThronePageBackground } from './ui/DiceThronePageBackground';

export const diceThroneGameRuntimeAdapter: GameRuntimeAdapter = {
    PageProvider: DiceThronePageBackground,
    seatSwap: {
        mode: 'request',
        requestCommandType: 'REQUEST_SEAT_SWAP',
        respondCommandType: 'RESPOND_SEAT_SWAP',
        cancelCommandType: 'CANCEL_SEAT_SWAP',
    },
};
