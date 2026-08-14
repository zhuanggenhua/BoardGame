import type { GameRuntimeAdapter } from '../gameRuntimeAdapter';

export const diceThroneGameRuntimeAdapter: GameRuntimeAdapter = {
    seatSwap: {
        mode: 'request',
        requestCommandType: 'REQUEST_SEAT_SWAP',
        respondCommandType: 'RESPOND_SEAT_SWAP',
        cancelCommandType: 'CANCEL_SEAT_SWAP',
    },
};
