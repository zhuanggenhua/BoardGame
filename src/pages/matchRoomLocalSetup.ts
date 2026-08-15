import {
    buildLocalMatchSetupData,
    resolveLocalMatchPlayerCount,
    resolveSetupSelectionsFromSearchParams,
} from '../engine/ai/seatControllers';
import type { GameRuntimeLocalSetupResult } from '../games/gameRuntimeAdapter';
import type { GameManifestEntry } from '../shared/gameManifest.types';
import type { GameSetupSelections } from '../shared/gameSetupOptions';
import {
    applySetupDefaultsForGame,
    hasPlayerCountConstrainedSetupSelection,
    resolveAllowedPlayerCountsForGame,
} from '../shared/roomSetup';

export interface ManifestLocalSetupResolution {
    numPlayers: number;
    setupSelections: GameSetupSelections;
    setupData: Record<string, unknown>;
    playerOptions: number[];
}

function getExplicitSetupFieldKeys(searchParams: URLSearchParams): Set<string> {
    const fieldKeys = new Set<string>();
    for (const key of searchParams.keys()) {
        if (key.startsWith('setup.')) {
            fieldKeys.add(key.slice('setup.'.length));
        }
    }
    return fieldKeys;
}

export function resolveManifestLocalSetup(args: {
    gameManifest?: Pick<GameManifestEntry, 'id' | 'setupOptions' | 'playerOptions' | 'bestPlayers'>;
    searchParams: URLSearchParams;
    requestedPlayers: string | null;
}): ManifestLocalSetupResolution {
    const parsedSelections = resolveSetupSelectionsFromSearchParams({
        gameManifest: args.gameManifest,
        searchParams: args.searchParams,
    });
    const setupScopedPlayerOptions = resolveAllowedPlayerCountsForGame({
        gameManifest: args.gameManifest,
        setupData: parsedSelections,
    });
    const fallbackPlayerCount = args.gameManifest?.bestPlayers?.find((count) => setupScopedPlayerOptions.includes(count))
        ?? setupScopedPlayerOptions[0]
        ?? args.gameManifest?.playerOptions?.[0]
        ?? 2;
    const requestedPlayerCount = Number(args.requestedPlayers);
    const explicitSetupFieldKeys = getExplicitSetupFieldKeys(args.searchParams);
    const explicitSetupConstrainsPlayers = hasPlayerCountConstrainedSetupSelection({
        gameManifest: args.gameManifest,
        setupSelections: parsedSelections,
        fieldKeys: explicitSetupFieldKeys,
    });
    const playerCountForSetupDefaults = explicitSetupConstrainsPlayers
        ? resolveLocalMatchPlayerCount(args.requestedPlayers, setupScopedPlayerOptions)
        : Number.isInteger(requestedPlayerCount)
            ? requestedPlayerCount
            : fallbackPlayerCount;
    const setupSelectionsForPlayerOptions = applySetupDefaultsForGame({
        gameManifest: args.gameManifest,
        numPlayers: playerCountForSetupDefaults,
        setupSelections: parsedSelections,
    });
    const playerOptions = resolveAllowedPlayerCountsForGame({
        gameManifest: args.gameManifest,
        setupData: setupSelectionsForPlayerOptions,
    });
    const numPlayers = resolveLocalMatchPlayerCount(args.requestedPlayers, playerOptions);
    const setupSelections = applySetupDefaultsForGame({
        gameManifest: args.gameManifest,
        numPlayers,
        setupSelections: setupSelectionsForPlayerOptions,
    });

    return {
        numPlayers,
        setupSelections,
        setupData: buildLocalMatchSetupData(setupSelections),
        playerOptions,
    };
}

export function resolveRuntimeLocalSetupData(
    setup: GameRuntimeLocalSetupResult | null | undefined,
): Record<string, unknown> | undefined {
    if (!setup) {
        return undefined;
    }

    if (setup.setupData) {
        return setup.setupData;
    }

    return setup.setupSelections
        ? buildLocalMatchSetupData(setup.setupSelections)
        : undefined;
}
