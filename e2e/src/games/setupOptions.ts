import type {
    GameManifestEntry,
    GameSetupField,
    GameSetupMultiSelectField,
    GameSetupSelectOption,
    GameSetupSelectField,
} from './manifest.types';

export type GameSetupValue = string | string[];
export type GameSetupSelections = Record<string, GameSetupValue>;

export function isSelectField(field: GameSetupField): field is GameSetupSelectField {
    return field.type === 'select';
}

export function isMultiSelectField(field: GameSetupField): field is GameSetupMultiSelectField {
    return field.type === 'multi-select';
}

function getSelectFieldOptions(field: GameSetupSelectField): GameSetupSelectOption[] {
    if (Array.isArray(field.options) && field.options.length > 0) {
        return field.options;
    }

    const optionsByPlayerCount = field.optionsByPlayerCount;
    if (!optionsByPlayerCount) {
        return [];
    }

    const sortedPlayerCounts = Object.keys(optionsByPlayerCount)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);

    for (const playerCount of sortedPlayerCounts) {
        const options = optionsByPlayerCount[playerCount];
        if (Array.isArray(options) && options.length > 0) {
            return options;
        }
    }

    return [];
}

function getSelectAllowedValues(field: GameSetupSelectField): Set<string> {
    const values = new Set<string>();

    for (const option of getSelectFieldOptions(field)) {
        values.add(option.value);
    }

    const optionsByPlayerCount = field.optionsByPlayerCount;
    if (optionsByPlayerCount) {
        for (const options of Object.values(optionsByPlayerCount)) {
            if (!Array.isArray(options)) {
                continue;
            }
            for (const option of options) {
                values.add(option.value);
            }
        }
    }

    return values;
}

export function getDefaultSetupSelections(
    gameManifest: Pick<GameManifestEntry, 'setupOptions'> | undefined,
): GameSetupSelections {
    const selections: GameSetupSelections = {};
    const fields = gameManifest?.setupOptions ?? {};

    for (const [fieldKey, field] of Object.entries(fields)) {
        if (isMultiSelectField(field)) {
            selections[fieldKey] = [...(field.default ?? field.options.map((option) => option.value))];
            continue;
        }
        const options = getSelectFieldOptions(field);
        selections[fieldKey] = field.default ?? options[0]?.value ?? '';
    }

    return selections;
}

export function normalizeSetupSelections(
    gameManifest: Pick<GameManifestEntry, 'setupOptions'> | undefined,
    rawSelections?: Record<string, unknown> | null,
): GameSetupSelections {
    const defaults = getDefaultSetupSelections(gameManifest);
    const fields = gameManifest?.setupOptions ?? {};

    if (!rawSelections) {
        return defaults;
    }

    const normalized: GameSetupSelections = { ...defaults };

    for (const [fieldKey, field] of Object.entries(fields)) {
        const rawValue = rawSelections[fieldKey];

        if (isMultiSelectField(field)) {
            const allowedValues = new Set(field.options.map((option) => option.value));
            if (!Array.isArray(rawValue)) {
                continue;
            }
            normalized[fieldKey] = rawValue.filter(
                (value): value is string => typeof value === 'string' && allowedValues.has(value),
            );
            continue;
        }

        const allowedValues = getSelectAllowedValues(field);
        if (typeof rawValue === 'string' && allowedValues.has(rawValue)) {
            normalized[fieldKey] = rawValue;
        }
    }

    return normalized;
}
