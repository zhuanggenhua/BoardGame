import type { GameRuntimeAdapter } from '../gameRuntimeAdapter';

export const summonerWarsGameRuntimeAdapter: GameRuntimeAdapter = {
    seatSwap: {
        mode: 'instant',
        requestCommandType: 'sw:swap_seat',
        respondCommandType: null,
        cancelCommandType: null,
    },
};
