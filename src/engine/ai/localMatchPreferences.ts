import type { GameManifestEntry } from '../../shared/gameManifest.types';
import {
    getDefaultSetupSelections,
    isMultiSelectField,
    normalizeSetupSelections,
    type GameSetupSelections,
} from '../../shared/gameSetupOptions';
import {
    getDefaultSeatController,
    normalizeSeatController,
    resolveLocalMatchPlayerCount,
} from './seatControllers';
import type { AiSeatController } from './types';

const STORAGE_PREFIX = 'local_ai_match_preferences:';
const LOCAL_MATCH_PREFERENCES_SCHEMA_VERSION = 2;

export interface LocalMatchPreferences {
    schemaVersion?: number;
    numPlayers: number;
    seatControllers: Record<string, AiSeatController>;
    setupSelections: GameSetupSelections;
}

function migrateLegacySetupSelections(
    gameManifest: GameManifestEntry,
    rawSetupSelections: Record<string, unknown>,
    schemaVersion: number | null,
): Record<string, unknown> {
    if (schemaVersion !== null || gameManifest.id !== 'smashup') {
        return rawSetupSelections;
    }

    const expansionsField = gameManifest.setupOptions?.expansions;
    if (!expansionsField || !isMultiSelectField(expansionsField)) {
        return rawSetupSelections;
    }

    const defaultValues = expansionsField.default ?? expansionsField.options.map((option) => option.value);
    if (!defaultValues.includes('diy')) {
        return rawSetupSelections;
    }

    const rawExpansions = rawSetupSelections.expansions;
    if (!Array.isArray(rawExpansions) || rawExpansions.includes('diy')) {
        return rawSetupSelections;
    }

    const allowedValues = new Set(expansionsField.options.map((option) => option.value));
    const migratedExpansions = rawExpansions.filter(
        (value): value is string => typeof value === 'string' && allowedValues.has(value),
    );
    if (migratedExpansions.includes('diy')) {
        return rawSetupSelections;
    }

    return {
        ...rawSetupSelections,
        expansions: [...migratedExpansions, 'diy'],
    };
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
        schemaVersion: LOCAL_MATCH_PREFERENCES_SCHEMA_VERSION,
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
    const schemaVersion = typeof raw?.schemaVersion === 'number'
        ? raw.schemaVersion
        : null;
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

    const rawSetupSelections = raw?.setupSelections && typeof raw.setupSelections === 'object' && !Array.isArray(raw.setupSelections)
        ? raw.setupSelections as Record<string, unknown>
        : {};
    const setupSelections = normalizeSetupSelections(
        gameManifest,
        migrateLegacySetupSelections(gameManifest, rawSetupSelections, schemaVersion),
    );

    return {
        ...defaults,
        schemaVersion: LOCAL_MATCH_PREFERENCES_SCHEMA_VERSION,
        numPlayers,
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
