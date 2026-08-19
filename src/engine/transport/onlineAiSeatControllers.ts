import type { GameManifestEntry } from '../../shared/gameManifest.types';
import type { AiSeatController } from '../ai';
import type { MatchState } from '../types';

export type OnlineAiSeatControllerType = 'human' | 'local-ai' | 'remote-ai';
export type RawOnlineAiSeatController = { type?: unknown } | undefined;
export type RawOnlineAiSeatControllers = Record<string, RawOnlineAiSeatController>;
export type GameManifestAiIndex = Record<string, Pick<GameManifestEntry, 'ai'> | undefined>;

export const isOnlineAiExplicitlyDisabled = (setupData: unknown): boolean => (
    Boolean(
        setupData
        && typeof setupData === 'object'
        && !Array.isArray(setupData)
        && (setupData as { enableAi?: unknown }).enableAi === false,
    )
);

export const extractSetupSeatControllers = (setupData: unknown): RawOnlineAiSeatControllers | undefined => {
    if (!setupData || typeof setupData !== 'object' || Array.isArray(setupData)) {
        return undefined;
    }

    const rawSeatControllers = (setupData as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return undefined;
    }

    return rawSeatControllers as RawOnlineAiSeatControllers;
};

export const extractTrustedSetupSeatControllers = (
    setupData: unknown,
): RawOnlineAiSeatControllers | undefined => (
    isOnlineAiExplicitlyDisabled(setupData) ? undefined : extractSetupSeatControllers(setupData)
);

const extractStateSeatControllers = (
    state: MatchState<unknown> | undefined,
): RawOnlineAiSeatControllers | undefined => {
    const core = state?.core;
    if (!core || typeof core !== 'object' || Array.isArray(core)) {
        return undefined;
    }

    const rawSeatControllers = (core as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return undefined;
    }

    return rawSeatControllers as RawOnlineAiSeatControllers;
};

export const shouldTrustOnlineAiSeatControllersForWatchdog = (setupData: unknown): boolean => {
    if (isOnlineAiExplicitlyDisabled(setupData)) {
        return false;
    }

    if (!setupData || typeof setupData !== 'object' || Array.isArray(setupData)) {
        return false;
    }

    const rawSeatControllers = (setupData as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return false;
    }

    return Object.values(rawSeatControllers as RawOnlineAiSeatControllers).some(
        (controller) => controller?.type === 'local-ai' || controller?.type === 'remote-ai',
    );
};

export const resolveRawOnlineAiWatchdogSeatControllers = (
    state: MatchState<unknown> | undefined,
    setupData: unknown,
): RawOnlineAiSeatControllers | undefined => {
    if (isOnlineAiExplicitlyDisabled(setupData)) {
        return undefined;
    }

    const setupSeatControllers = shouldTrustOnlineAiSeatControllersForWatchdog(setupData)
        ? extractSetupSeatControllers(setupData)
        : undefined;
    const stateSeatControllers = extractStateSeatControllers(state);
    if (!setupSeatControllers && !stateSeatControllers) {
        return undefined;
    }

    return {
        ...(setupSeatControllers ?? {}),
        ...(stateSeatControllers ?? {}),
    };
};

export const normalizeOnlineAiWatchdogSeatControllerType = (
    gameId: string,
    controller: RawOnlineAiSeatController,
    gameManifests: GameManifestAiIndex,
): OnlineAiSeatControllerType => {
    const manifestAi = gameManifests[gameId]?.ai;
    if (controller?.type === 'local-ai') {
        return manifestAi?.localAi === false ? 'human' : 'local-ai';
    }
    if (controller?.type === 'remote-ai') {
        return manifestAi?.remoteAi === false ? 'human' : 'remote-ai';
    }
    return 'human';
};

export function resolveSeatControllerTypeForTraining(
    seatControllers: RawOnlineAiSeatControllers | undefined,
    playerId: string,
): OnlineAiSeatControllerType {
    const type = seatControllers?.[playerId]?.type;
    return type === 'local-ai' || type === 'remote-ai' ? type : 'human';
}

export function buildOnlineAiWatchdogSeatControllers(args: {
    state: MatchState<unknown>;
    setupData: unknown;
    gameId: string;
    playerIds: string[];
    gameManifests: GameManifestAiIndex;
}): Record<string, AiSeatController> {
    const rawSeatControllers = resolveRawOnlineAiWatchdogSeatControllers(args.state, args.setupData);
    return Object.fromEntries(
        args.playerIds.map((playerId) => {
            const controller = rawSeatControllers?.[playerId];
            const normalizedType = normalizeOnlineAiWatchdogSeatControllerType(
                args.gameId,
                controller,
                args.gameManifests,
            );
            return [
                playerId,
                normalizedType === 'human'
                    ? { type: 'human' as const }
                    : {
                        ...(controller as Omit<AiSeatController, 'type'>),
                        type: normalizedType,
                    },
            ];
        }),
    ) as Record<string, AiSeatController>;
}
