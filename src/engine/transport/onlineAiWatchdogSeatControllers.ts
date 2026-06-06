import {
    isManualSetupSelectionEnabledForSeat,
    type AiSeatController,
    type ManualSetupSeatControllerLike,
} from '../ai';
import type { GameManifestEntry } from '../../shared/gameManifest.types';

type SetupSeatController = {
    policyId?: string;
    fallbackPolicyId?: string;
} & ManualSetupSeatControllerLike | undefined;

export type GameManifestIndex = Record<string, Pick<GameManifestEntry, 'ai'> | undefined>;

export type OnlineAiWatchdogSeatController = AiSeatController;

export function extractSetupSeatControllers(
    setupData: unknown,
): Record<string, SetupSeatController> | undefined {
    if (!setupData || typeof setupData !== 'object' || Array.isArray(setupData)) {
        return undefined;
    }

    const rawSeatControllers = (setupData as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return undefined;
    }

    return rawSeatControllers as Record<string, SetupSeatController>;
}

function shouldTrustOnlineAiSeatControllersForWatchdog(setupData: unknown): boolean {
    const rawSeatControllers = extractSetupSeatControllers(setupData);
    if (!rawSeatControllers) {
        return false;
    }

    return Object.values(rawSeatControllers).some(
        (controller) => controller?.type === 'local-ai' || controller?.type === 'remote-ai',
    );
}

function normalizeOnlineAiWatchdogSeatControllerType(
    gameId: string,
    controller: SetupSeatController,
    gameManifests: GameManifestIndex,
): 'human' | 'local-ai' | 'remote-ai' {
    const manifestAi = gameManifests[gameId]?.ai;
    if (controller?.type === 'local-ai') {
        return manifestAi?.localAi === false ? 'human' : 'local-ai';
    }
    if (controller?.type === 'remote-ai') {
        return manifestAi?.remoteAi === false ? 'human' : 'remote-ai';
    }
    return 'human';
}

export function resolveOnlineAiWatchdogSeatControllers(args: {
    gameId: string;
    playerIds: string[];
    setupData: unknown;
    gameManifests: GameManifestIndex;
}): {
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    hasAiSeat: boolean;
} {
    const rawSeatControllers = shouldTrustOnlineAiSeatControllersForWatchdog(args.setupData)
        ? extractSetupSeatControllers(args.setupData)
        : undefined;

    const seatControllers = Object.fromEntries(
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
                        ...(controller as { policyId?: string; fallbackPolicyId?: string }),
                        type: normalizedType,
                        ...(isManualSetupSelectionEnabledForSeat(controller)
                            ? {
                                manualSetupSelection: true,
                                manualFactionSelection: true,
                            }
                            : {}),
                    },
            ];
        }),
    ) as Record<string, OnlineAiWatchdogSeatController>;

    const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
    return { seatControllers, hasAiSeat };
}
