import type { GameManifestEntry } from './manifest.types';
import type { PublicSetupSummary } from '../shared/lobby';
import type { GameSetupSelections } from '../shared/gameSetupOptions';
import {
    FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE,
    FANTASY_REALMS_EXPANSION_SETUP_FIELD,
    FANTASY_REALMS_DUEL_SETUP_VALUE,
    FANTASY_REALMS_VARIANT_SETUP_FIELD,
    buildFantasyRealmsPublicRoomSummary,
    getFantasyRealmsAllowedPlayerCounts,
} from './fantasyrealms/roomSetup';
import { buildBetrayalPublicRoomSummary } from './betrayal/roomSetup';
import { buildQidahenPublicRoomSummary } from './qidahen/roomSetup';
import { buildSmashUpPublicRoomSummary } from './smashup/roomSetup';

type SetupDataRecord = Record<string, unknown> | undefined;
type PlayerOptionsResolver = (setupData?: SetupDataRecord) => readonly number[] | undefined;
type PublicSetupSummaryBuilder = (setupData?: SetupDataRecord) => PublicSetupSummary;
type CreateRoomSetupDefaultsResolver = (args: {
    numPlayers: number;
    setupSelections: GameSetupSelections;
}) => GameSetupSelections;
type SetupDefaultsResolver = CreateRoomSetupDefaultsResolver;

const PLAYER_OPTIONS_RESOLVERS: Record<string, PlayerOptionsResolver | undefined> = {
    fantasyrealms: getFantasyRealmsAllowedPlayerCounts,
};

const PUBLIC_SETUP_SUMMARY_BUILDERS: Record<string, PublicSetupSummaryBuilder | undefined> = {
    betrayal: buildBetrayalPublicRoomSummary,
    fantasyrealms: buildFantasyRealmsPublicRoomSummary,
    qidahen: buildQidahenPublicRoomSummary,
    smashup: buildSmashUpPublicRoomSummary,
};

const CREATE_ROOM_SETUP_DEFAULTS_RESOLVERS: Record<string, CreateRoomSetupDefaultsResolver | undefined> = {
    fantasyrealms: ({ numPlayers, setupSelections }) => {
        const nextSelections: GameSetupSelections = {
            ...setupSelections,
            [FANTASY_REALMS_EXPANSION_SETUP_FIELD]: FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE,
        };
        if (numPlayers !== 2) {
            return nextSelections;
        }
        if (nextSelections[FANTASY_REALMS_VARIANT_SETUP_FIELD] === FANTASY_REALMS_DUEL_SETUP_VALUE) {
            return nextSelections;
        }
        return {
            ...nextSelections,
            [FANTASY_REALMS_VARIANT_SETUP_FIELD]: FANTASY_REALMS_DUEL_SETUP_VALUE,
        };
    },
};

const SETUP_DEFAULTS_RESOLVERS: Record<string, SetupDefaultsResolver | undefined> = {
    fantasyrealms: ({ numPlayers, setupSelections }) => {
        const nextSelections: GameSetupSelections = {
            ...setupSelections,
        };
        if (nextSelections[FANTASY_REALMS_EXPANSION_SETUP_FIELD] === undefined) {
            nextSelections[FANTASY_REALMS_EXPANSION_SETUP_FIELD] = FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE;
        }
        if (numPlayers !== 2 || nextSelections[FANTASY_REALMS_VARIANT_SETUP_FIELD] === FANTASY_REALMS_DUEL_SETUP_VALUE) {
            return nextSelections;
        }
        return {
            ...nextSelections,
            [FANTASY_REALMS_VARIANT_SETUP_FIELD]: FANTASY_REALMS_DUEL_SETUP_VALUE,
        };
    },
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

export function applyCreateRoomSetupDefaultsForGame(args: {
    gameId?: string;
    gameManifest?: Pick<GameManifestEntry, 'id'>;
    numPlayers: number;
    setupSelections: GameSetupSelections;
}): GameSetupSelections {
    const normalizedGameId = normalizeGameId(args.gameId ?? args.gameManifest?.id);
    const resolver = CREATE_ROOM_SETUP_DEFAULTS_RESOLVERS[normalizedGameId];
    if (!resolver) {
        return args.setupSelections;
    }
    return resolver({
        numPlayers: args.numPlayers,
        setupSelections: args.setupSelections,
    });
}

export function applySetupDefaultsForGame(args: {
    gameId?: string;
    gameManifest?: Pick<GameManifestEntry, 'id'>;
    numPlayers: number;
    setupSelections: GameSetupSelections;
}): GameSetupSelections {
    const normalizedGameId = normalizeGameId(args.gameId ?? args.gameManifest?.id);
    const resolver = SETUP_DEFAULTS_RESOLVERS[normalizedGameId];
    if (!resolver) {
        return args.setupSelections;
    }
    return resolver({
        numPlayers: args.numPlayers,
        setupSelections: args.setupSelections,
    });
}
