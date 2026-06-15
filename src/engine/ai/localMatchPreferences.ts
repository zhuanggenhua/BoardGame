import type { GameManifestEntry } from '../../shared/gameManifest.types';
import {
    getDefaultSetupSelections,
    normalizeSetupSelections,
    type GameSetupSelections,
} from '../../shared/gameSetupOptions';
import {
    DEFAULT_AI_MINIMUM_ACTION_DELAY_MS,
    getDefaultSeatController,
    normalizeAiMinimumActionDelayMs,
    normalizeSeatController,
    resolveLocalMatchPlayerCount,
} from './seatControllers';
import type { AiSeatController } from './types';

const STORAGE_PREFIX = 'local_ai_match_preferences:';

export interface LocalMatchPreferences {
    numPlayers: number;
    minimumActionDelayMs: number;
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
        minimumActionDelayMs: DEFAULT_AI_MINIMUM_ACTION_DELAY_MS,
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
        const rawControllerRecord = rawController && typeof rawController === 'object' && !Array.isArray(rawController)
            ? rawController as Record<string, unknown>
            : null;
        if (rawControllerRecord && typeof rawControllerRecord.type === 'string') {
            seatControllers[playerId] = normalizeSeatController(rawControllerRecord as AiSeatController, gameManifest.ai);
            continue;
        }
        seatControllers[playerId] = getDefaultSeatController(index, numPlayers, gameManifest.ai);
    }

    const rawSetupSelections = raw?.setupSelections && typeof raw.setupSelections === 'object' && !Array.isArray(raw.setupSelections)
        ? raw.setupSelections as Record<string, unknown>
        : {};
    const setupSelections = normalizeSetupSelections(
        gameManifest,
        rawSetupSelections,
    );
    const minimumActionDelayMs = normalizeAiMinimumActionDelayMs(
        typeof raw?.minimumActionDelayMs === 'number'
            ? raw.minimumActionDelayMs
            : undefined,
    ) ?? defaults.minimumActionDelayMs;

    return {
        ...defaults,
        numPlayers,
        minimumActionDelayMs,
        seatControllers,
        setupSelections,
    };
}

export function readLocalMatchPreferences(gameManifest: GameManifestEntry): LocalMatchPreferences {
    return readStoredLocalMatchPreferences(gameManifest)
        ?? createDefaultLocalMatchPreferences(gameManifest);
}

export function stripAiSeatsFromLocalMatchPreferences(preferences: LocalMatchPreferences): LocalMatchPreferences {
    return {
        ...preferences,
        seatControllers: Object.fromEntries(
            Array.from({ length: preferences.numPlayers }, (_, index) => [String(index), { type: 'human' } as AiSeatController]),
        ),
    };
}

export function writeLocalMatchPreferences(gameManifest: GameManifestEntry, preferences: LocalMatchPreferences): void {
    const normalized = normalizeLocalMatchPreferences(gameManifest, preferences as unknown as Record<string, unknown>);
    localStorage.setItem(STORAGE_PREFIX + gameManifest.id, JSON.stringify(normalized));
}
