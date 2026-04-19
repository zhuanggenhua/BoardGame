import type { GameManifestEntry } from '../games/manifest.types';
import { normalizeSeatController, type AiSeatController } from '../engine/ai';
import type { MatchInfo } from '../services/matchApi';

export type OnlineAiSeatState = {
    seatControllers: Record<string, AiSeatController>;
    seatCredentials: Record<string, string>;
};

type LoadOnlineAiSeatStateArgs = {
    gameConfig: GameManifestEntry;
    matchInfo: MatchInfo;
    storedAiSeatCredentials: Record<string, string>;
    claimMissingSeatCredential?: (playerId: string) => Promise<string>;
    onClaimError?: (playerId: string, error: unknown) => void;
};

const toPlainRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
);

function collectSeatIds(matchInfo: MatchInfo, rawSeatControllers: Record<string, unknown>): string[] {
    const seatIds = new Set<string>();

    for (const player of matchInfo.players) {
        if (typeof player?.id === 'number' && Number.isInteger(player.id) && player.id >= 0) {
            seatIds.add(String(player.id));
        }
    }

    for (const rawSeatId of Object.keys(rawSeatControllers)) {
        const parsed = Number(rawSeatId);
        if (Number.isInteger(parsed) && parsed >= 0) {
            seatIds.add(String(parsed));
        }
    }

    return Array.from(seatIds).sort((left, right) => Number(left) - Number(right));
}

function shouldTrustOnlineAiSeatControllers(args: {
    setupData: Record<string, unknown>;
    storedAiSeatCredentials: Record<string, string>;
}): boolean {
    if (args.setupData.enableAi === true) {
        return true;
    }

    if (args.setupData.enableAi === false) {
        return false;
    }

    return Object.keys(args.storedAiSeatCredentials).length > 0;
}

export const isAiSeatController = (controller: AiSeatController | undefined): boolean => (
    Boolean(controller) && controller.type !== 'human'
);

export const haveAiSeatCredentialsChanged = (
    prev: Record<string, string>,
    next: Record<string, string>,
): boolean => {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) {
        return true;
    }
    return nextKeys.some((key) => prev[key] !== next[key]);
};

export async function loadOnlineAiSeatState({
    gameConfig,
    matchInfo,
    storedAiSeatCredentials,
    claimMissingSeatCredential,
    onClaimError,
}: LoadOnlineAiSeatStateArgs): Promise<OnlineAiSeatState> {
    const setupData = toPlainRecord(matchInfo.setupData);
    const rawSeatControllers = toPlainRecord(setupData.seatControllers);
    const trustSeatControllers = shouldTrustOnlineAiSeatControllers({
        setupData,
        storedAiSeatCredentials,
    });
    const seatControllers: Record<string, AiSeatController> = {};
    const seatIds = collectSeatIds(matchInfo, rawSeatControllers);
    for (const playerId of seatIds) {
        const rawController = rawSeatControllers[playerId];
        seatControllers[playerId] = (
            trustSeatControllers
            && rawController
            && typeof rawController === 'object'
            && !Array.isArray(rawController)
            && typeof rawController.type === 'string'
        )
            ? normalizeSeatController(rawController as AiSeatController, gameConfig.ai)
            : { type: 'human' };
    }

    const seatCredentials: Record<string, string> = trustSeatControllers
        ? { ...storedAiSeatCredentials }
        : {};
    if (claimMissingSeatCredential) {
        for (const playerId of seatIds) {
            if (!isAiSeatController(seatControllers[playerId]) || seatCredentials[playerId]) {
                continue;
            }
            try {
                const credentials = await claimMissingSeatCredential(playerId);
                if (credentials) {
                    seatCredentials[playerId] = credentials;
                }
            } catch (error) {
                onClaimError?.(playerId, error);
            }
        }
    }

    return {
        seatControllers,
        seatCredentials,
    };
}
