import type { GameManifestEntry } from './manifest.types';
import type { PublicSetupSummary } from '../shared/lobby';
import {
    buildFantasyRealmsPublicRoomSummary,
    getFantasyRealmsAllowedPlayerCounts,
} from './fantasyrealms/roomSetup';
import { buildQidahenPublicRoomSummary } from './qidahen/roomSetup';
import { buildSmashUpPublicRoomSummary } from './smashup/roomSetup';

type SetupDataRecord = Record<string, unknown> | undefined;
type PlayerOptionsResolver = (setupData?: SetupDataRecord) => readonly number[] | undefined;
type PublicSetupSummaryBuilder = (setupData?: SetupDataRecord) => PublicSetupSummary;

const PLAYER_OPTIONS_RESOLVERS: Record<string, PlayerOptionsResolver | undefined> = {
    fantasyrealms: getFantasyRealmsAllowedPlayerCounts,
};

const PUBLIC_SETUP_SUMMARY_BUILDERS: Record<string, PublicSetupSummaryBuilder | undefined> = {
    fantasyrealms: buildFantasyRealmsPublicRoomSummary,
    qidahen: buildQidahenPublicRoomSummary,
    smashup: buildSmashUpPublicRoomSummary,
};

function normalizeGameId(gameId?: string): string {
    return (gameId ?? '').trim().toLowerCase();
}

export function resolveAllowedPlayerCountsForGame(args: {
    gameId?: string;
    gameManifest?: Pick<GameManifestEntry, 'id' | 'playerOptions'>;
    setupData?: SetupDataRecord;
    fallbackPlayerOptions?: readonly number[];
}): number[] {
    const normalizedGameId = normalizeGameId(args.gameId ?? args.gameManifest?.id);
    const resolved = PLAYER_OPTIONS_RESOLVERS[normalizedGameId]?.(args.setupData);
    if (resolved && resolved.length > 0) {
        return [...resolved];
    }

    if (args.fallbackPlayerOptions && args.fallbackPlayerOptions.length > 0) {
        return [...args.fallbackPlayerOptions];
    }

    const manifestPlayerOptions = args.gameManifest?.playerOptions;
    if (manifestPlayerOptions && manifestPlayerOptions.length > 0) {
        return [...manifestPlayerOptions];
    }

    return [2];
}

export function buildGamePublicRoomSummary(
    gameId: string,
    setupData?: SetupDataRecord,
): PublicSetupSummary {
    return PUBLIC_SETUP_SUMMARY_BUILDERS[normalizeGameId(gameId)]?.(setupData);
}
