import type { GameManifestEntry } from '../../games/manifest.types';
import {
    getDefaultSetupSelections,
    normalizeSetupSelections,
    type GameSetupSelections,
} from '../../games/setupOptions';
import {
    getDefaultSeatController,
    normalizeSeatController,
    resolveLocalMatchPlayerCount,
} from './seatControllers';
import type { AiSeatController } from './types';

const STORAGE_PREFIX = 'local_ai_match_preferences:';

export interface LocalMatchPreferences {
    numPlayers: number;
    seatControllers: Record<string, AiSeatController>;
    setupSelections: GameSetupSelections;
}

export function readStoredLocalMatchPreferences(
    gameManifest: GameManifestEntry,
): LocalMatchPreferences | null {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + gameManifest.id);
        if (!raw) {
            return null;
        }
        return normalizeLocalMatchPreferences(
            gameManifest,
            JSON.parse(raw) as Record<string, unknown>,
        );
    } catch {
        return null;
    }
}

export function createDefaultLocalMatchPreferences(gameManifest: GameManifestEntry): LocalMatchPreferences {
    const playerOptions = gameManifest.playerOptions?.length ? gameManifest.playerOptions : [2];
    const numPlayers = resolveLocalMatchPlayerCount(null, playerOptions);
    const seatControllers: Record<string, AiSeatController> = {};

    for (let index = 0; index < numPlayers; index += 1) {
        seatControllers[String(index)] = getDefaultSeatController(index, numPlayers, gameManifest.ai);
    }

    return {
        numPlayers,
        seatControllers,
        setupSelections: getDefaultSetupSelections(gameManifest),
    };
}

export function normalizeLocalMatchPreferences(
    gameManifest: GameManifestEntry,
    raw: Record<string, unknown> | null | undefined,
): LocalMatchPreferences {
    const defaults = createDefaultLocalMatchPreferences(gameManifest);
    const numPlayers = resolveLocalMatchPlayerCount(
        typeof raw?.numPlayers === 'number' || typeof raw?.numPlayers === 'string'
            ? String(raw.numPlayers)
            : null,
        gameManifest.playerOptions,
    );

    const seatControllers: Record<string, AiSeatController> = {};
    const rawControllers = raw?.seatControllers && typeof raw.seatControllers === 'object' && !Array.isArray(raw.seatControllers)
        ? raw.seatControllers as Record<string, unknown>
        : {};

    for (let index = 0; index < numPlayers; index += 1) {
        const playerId = String(index);
        const rawController = rawControllers[playerId];
        if (rawController && typeof rawController === 'object' && !Array.isArray(rawController) && typeof rawController.type === 'string') {
            seatControllers[playerId] = normalizeSeatController(rawController as AiSeatController, gameManifest.ai);
            continue;
        }
        seatControllers[playerId] = getDefaultSeatController(index, numPlayers, gameManifest.ai);
    }

    const setupSelections = normalizeSetupSelections(
        gameManifest,
        raw?.setupSelections && typeof raw.setupSelections === 'object' && !Array.isArray(raw.setupSelections)
            ? raw.setupSelections as Record<string, unknown>
            : {},
    );

    return {
        ...defaults,
        numPlayers,
        seatControllers,
        setupSelections,
    };
}

export function readLocalMatchPreferences(gameManifest: GameManifestEntry): LocalMatchPreferences {
    return readStoredLocalMatchPreferences(gameManifest)
        ?? createDefaultLocalMatchPreferences(gameManifest);
}

export function writeLocalMatchPreferences(gameManifest: GameManifestEntry, preferences: LocalMatchPreferences): void {
    const normalized = normalizeLocalMatchPreferences(gameManifest, preferences as unknown as Record<string, unknown>);
    localStorage.setItem(STORAGE_PREFIX + gameManifest.id, JSON.stringify(normalized));
}
