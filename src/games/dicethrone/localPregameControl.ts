import type { LocalPregameControlResolver } from '../../engine/transport/followCurrentTurnPlayer';

type DiceThroneSetupLikeState = {
    core?: {
        hostPlayerId?: string | number;
        hostStarted?: boolean;
        selectedCharacters?: Record<string, string | undefined>;
        readyPlayers?: Record<string, boolean | undefined>;
    };
    sys?: {
        phase?: string;
        flow?: {
            phase?: string;
        };
    };
};

export const resolveDiceThroneLocalPregameControlledPlayerId: LocalPregameControlResolver = (args) => {
    const aiSeatIds = Object.entries(args.seatControllers)
        .filter(([, controller]) => controller?.type && controller.type !== 'human')
        .map(([playerId]) => playerId)
        .sort((left, right) => Number(left) - Number(right));

    if (aiSeatIds.length === 0) {
        return null;
    }

    const state = args.state as DiceThroneSetupLikeState | null | undefined;
    const phase = state?.sys?.phase ?? state?.sys?.flow?.phase;
    if (phase !== 'setup') {
        return null;
    }

    const core = state?.core;
    if (!core || core.hostStarted) {
        return null;
    }

    const hostPlayerId = core.hostPlayerId !== undefined && core.hostPlayerId !== null
        ? String(core.hostPlayerId)
        : (args.localPlayerId ?? '0');

    const hasSelectedCharacter = (playerId: string) => {
        const characterId = core.selectedCharacters?.[playerId];
        return typeof characterId === 'string' && characterId !== 'unselected';
    };

    if (!hasSelectedCharacter(hostPlayerId)) {
        return hostPlayerId;
    }

    for (const playerId of aiSeatIds) {
        if (!hasSelectedCharacter(playerId)) {
            return playerId;
        }

        if (playerId !== hostPlayerId && core.readyPlayers?.[playerId] !== true) {
            return playerId;
        }
    }

    return hostPlayerId;
};
