import {
    isManualSetupSelectionEnabledForSeat,
    withManualSetupSelectionAliases,
    type AiSeatController,
    type ManualSetupSeatControllerLike,
} from '../ai';
import type { MatchState } from '../types';
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

export function extractStateSeatControllers(
    state: MatchState<unknown> | undefined,
): Record<string, SetupSeatController> | undefined {
    const core = state?.core;
    if (!core || typeof core !== 'object' || Array.isArray(core)) {
        return undefined;
    }

    const rawSeatControllers = (core as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return undefined;
    }

    return rawSeatControllers as Record<string, SetupSeatController>;
}

function isOnlineAiExplicitlyDisabled(setupData: unknown): boolean {
    return Boolean(
        setupData
        && typeof setupData === 'object'
        && !Array.isArray(setupData)
        && (setupData as { enableAi?: unknown }).enableAi === false,
    );
}

function shouldTrustOnlineAiSeatControllersForWatchdog(setupData: unknown): boolean {
    if (isOnlineAiExplicitlyDisabled(setupData)) {
        return false;
    }

    const rawSeatControllers = extractSetupSeatControllers(setupData);
    if (!rawSeatControllers) {
        return false;
    }

    return Object.values(rawSeatControllers).some(
        (controller) => controller?.type === 'local-ai' || controller?.type === 'remote-ai',
    );
}

export function extractTrustedSetupSeatControllers(
    setupData: unknown,
): Record<string, SetupSeatController> | undefined {
    return shouldTrustOnlineAiSeatControllersForWatchdog(setupData)
        ? extractSetupSeatControllers(setupData)
        : undefined;
}

export function resolveRawOnlineAiWatchdogSeatControllers(args: {
    state?: MatchState<unknown>;
    setupData: unknown;
}): Record<string, SetupSeatController> | undefined {
    if (isOnlineAiExplicitlyDisabled(args.setupData)) {
        return undefined;
    }

    const setupSeatControllers = shouldTrustOnlineAiSeatControllersForWatchdog(args.setupData)
        ? extractSetupSeatControllers(args.setupData)
        : undefined;
    const stateSeatControllers = extractStateSeatControllers(args.state);
    if (!setupSeatControllers && !stateSeatControllers) {
        return undefined;
    }

    return {
        ...(setupSeatControllers ?? {}),
        ...(stateSeatControllers ?? {}),
    };
}

export function normalizeOnlineAiWatchdogSeatControllerType(
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

function buildOnlineAiWatchdogSeatController(args: {
    gameId: string;
    controller: SetupSeatController;
    gameManifests: GameManifestIndex;
}): OnlineAiWatchdogSeatController {
    const { gameId, controller, gameManifests } = args;
    const normalizedType = normalizeOnlineAiWatchdogSeatControllerType(
        gameId,
        controller,
        gameManifests,
    );

    if (normalizedType === 'human' || !controller) {
        return { type: 'human' };
    }

    const manualSetupAliases = isManualSetupSelectionEnabledForSeat(controller)
        ? withManualSetupSelectionAliases({})
        : {};
    const policyId = typeof controller.policyId === 'string' && controller.policyId.trim()
        ? controller.policyId.trim()
        : undefined;
    const fallbackPolicyId = typeof controller.fallbackPolicyId === 'string' && controller.fallbackPolicyId.trim()
        ? controller.fallbackPolicyId.trim()
        : undefined;
    const minimumActionDelayMs = typeof (controller as { minimumActionDelayMs?: unknown }).minimumActionDelayMs === 'number'
        ? (controller as { minimumActionDelayMs: number }).minimumActionDelayMs
        : undefined;

    if (normalizedType === 'local-ai') {
        return {
            type: 'local-ai',
            ...(policyId ? { policyId } : {}),
            ...(fallbackPolicyId ? { fallbackPolicyId } : {}),
            ...(minimumActionDelayMs !== undefined ? { minimumActionDelayMs } : {}),
            ...manualSetupAliases,
        };
    }

    const providerId = typeof (controller as { providerId?: unknown }).providerId === 'string'
        && (controller as { providerId: string }).providerId.trim()
        ? (controller as { providerId: string }).providerId.trim()
        : 'astrbot';

    return {
        type: 'remote-ai',
        providerId,
        ...(fallbackPolicyId ? { fallbackPolicyId } : {}),
        ...(minimumActionDelayMs !== undefined ? { minimumActionDelayMs } : {}),
        ...manualSetupAliases,
    };
}

export function resolveOnlineAiWatchdogSeatControllers(args: {
    gameId: string;
    playerIds: string[];
    setupData: unknown;
    state?: MatchState<unknown>;
    gameManifests: GameManifestIndex;
}): {
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    hasAiSeat: boolean;
} {
    const rawSeatControllers = resolveRawOnlineAiWatchdogSeatControllers({
        state: args.state,
        setupData: args.setupData,
    });

    const seatControllers = Object.fromEntries(
        args.playerIds.map((playerId) => {
            return [
                playerId,
                buildOnlineAiWatchdogSeatController({
                    gameId: args.gameId,
                    controller: rawSeatControllers?.[playerId],
                    gameManifests: args.gameManifests,
                }),
            ];
        }),
    ) as Record<string, OnlineAiWatchdogSeatController>;

    const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
    return { seatControllers, hasAiSeat };
}
