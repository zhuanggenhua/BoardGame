import type { LocalPregameControlResolver } from '../../engine/transport/followCurrentTurnPlayer';

type SmashUpPregameStateLike = {
    core?: {
        turnOrder?: Array<string | number>;
        currentPlayerIndex?: number;
    };
    sys?: {
        phase?: string;
    };
};

export const resolveSmashUpLocalPregameControlledPlayerId: LocalPregameControlResolver = (args) => {
    const manualAiSeatIds = Object.entries(args.seatControllers)
        .filter(([, controller]) => controller?.type && controller.type !== 'human' && controller.manualFactionSelection === true)
        .map(([playerId]) => playerId);

    if (manualAiSeatIds.length === 0) {
        return null;
    }

    const state = args.state as SmashUpPregameStateLike | null | undefined;
    if (state?.sys?.phase !== 'factionSelect') {
        return null;
    }

    const turnOrder = Array.isArray(state?.core?.turnOrder)
        ? state.core.turnOrder.map((playerId) => String(playerId))
        : [];
    const currentPlayerIndex = typeof state?.core?.currentPlayerIndex === 'number'
        ? state.core.currentPlayerIndex
        : -1;
    const currentPlayerId = currentPlayerIndex >= 0
        ? turnOrder[currentPlayerIndex] ?? null
        : null;

    return currentPlayerId ?? args.localPlayerId ?? null;
};
