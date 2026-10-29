import type { GameRuntimeAdapter } from '../gameRuntimeAdapter';

export const fateDominationGameRuntimeAdapter: GameRuntimeAdapter = {
    resolveLocalSetup: ({ tutorialMode }) => tutorialMode
        ? { numPlayers: 3, setupData: { turnOrder: ['1', '0', '2'] } }
        : null,
};
