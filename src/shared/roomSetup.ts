import type {
    GameManifestEntry,
    GameSetupSelectField,
    GameSetupSelectOption,
} from './gameManifest.types';
import {
    isSelectField,
    normalizeSetupSelections,
    type GameSetupSelections,
} from './gameSetupOptions';

type SetupDataRecord = Record<string, unknown> | undefined;

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    return value as Record<string, unknown>;
}

function getManifestPlayerOptions(args: {
    gameManifest?: Pick<GameManifestEntry, 'playerOptions'>;
    fallbackPlayerOptions?: readonly number[];
}): number[] {
    if (args.fallbackPlayerOptions && args.fallbackPlayerOptions.length > 0) {
        return [...args.fallbackPlayerOptions];
    }

    const manifestPlayerOptions = args.gameManifest?.playerOptions;
    if (manifestPlayerOptions && manifestPlayerOptions.length > 0) {
        return [...manifestPlayerOptions];
    }

    return [2];
}

function getSelectFieldOptions(field: GameSetupSelectField): GameSetupSelectOption[] {
    const options = [...(field.options ?? [])];
    const seenValues = new Set(options.map((option) => option.value));

    for (const playerCountOptions of Object.values(field.optionsByPlayerCount ?? {})) {
        if (!Array.isArray(playerCountOptions)) {
            continue;
        }
        for (const option of playerCountOptions) {
            if (seenValues.has(option.value)) {
                continue;
            }
            seenValues.add(option.value);
            options.push(option);
        }
    }

    return options;
}

function readSetupSelections(args: {
    gameManifest?: Pick<GameManifestEntry, 'setupOptions'>;
    setupData?: SetupDataRecord;
}): GameSetupSelections {
    const setupData = asRecord(args.setupData);
    const rawSelections = asRecord(setupData?.setupSelections) ?? setupData;
    return normalizeSetupSelections(args.gameManifest, rawSelections);
}

function intersectPlayerOptions(left: readonly number[], right: readonly number[]): number[] {
    const rightSet = new Set(right);
    return left.filter((count) => rightSet.has(count));
}

function getPlayerCountsForSelectedOption(
    field: GameSetupSelectField,
    selectedValue: string,
): number[] | undefined {
    const selectedOption = getSelectFieldOptions(field).find((option) => option.value === selectedValue);
    if (selectedOption?.playerOptions?.length) {
        return [...selectedOption.playerOptions];
    }

    const countsFromOptionsByPlayerCount = Object.entries(field.optionsByPlayerCount ?? {})
        .filter(([, options]) => options?.some((option) => option.value === selectedValue))
        .map(([count]) => Number(count))
        .filter((count) => Number.isInteger(count));

    return countsFromOptionsByPlayerCount.length > 0 ? countsFromOptionsByPlayerCount : undefined;
}

function isOptionCompatibleWithPlayerCount(
    field: GameSetupSelectField,
    option: GameSetupSelectOption | undefined,
    numPlayers: number,
): boolean {
    if (!option) {
        return false;
    }
    const allowedCounts = getPlayerCountsForSelectedOption(field, option.value);
    return !allowedCounts || allowedCounts.includes(numPlayers);
}

function resolveCompatibleSelectValue(args: {
    field: GameSetupSelectField;
    currentValue: string | undefined;
    numPlayers: number;
    createRoomMode: boolean;
}): string {
    const options = getSelectFieldOptions(args.field);
    const currentValue = args.createRoomMode && args.field.createRoomDefault !== undefined
        ? undefined
        : args.currentValue;
    const currentOption = options.find((option) => option.value === currentValue);
    if (isOptionCompatibleWithPlayerCount(args.field, currentOption, args.numPlayers)) {
        return currentOption.value;
    }

    const preferredDefault = args.createRoomMode
        ? args.field.createRoomDefault ?? args.field.default
        : args.field.default;
    const defaultOption = options.find((option) => option.value === preferredDefault);
    if (isOptionCompatibleWithPlayerCount(args.field, defaultOption, args.numPlayers)) {
        return defaultOption.value;
    }

    const compatibleOption = options.find((option) => (
        isOptionCompatibleWithPlayerCount(args.field, option, args.numPlayers)
    ));
    if (compatibleOption) {
        return compatibleOption.value;
    }

    return currentOption?.value ?? defaultOption?.value ?? options[0]?.value ?? '';
}

export function resolveAllowedPlayerCountsForGame(args: {
    gameId?: string;
    gameManifest?: Pick<GameManifestEntry, 'id' | 'playerOptions' | 'setupOptions'>;
    setupData?: SetupDataRecord;
    fallbackPlayerOptions?: readonly number[];
}): number[] {
    const baseOptions = getManifestPlayerOptions({
        gameManifest: args.gameManifest,
        fallbackPlayerOptions: args.fallbackPlayerOptions,
    });
    let resolvedOptions = baseOptions;
    const setupSelections = readSetupSelections({
        gameManifest: args.gameManifest,
        setupData: args.setupData,
    });

    for (const [fieldKey, field] of Object.entries(args.gameManifest?.setupOptions ?? {})) {
        if (!isSelectField(field)) {
            continue;
        }
        const selectedValue = setupSelections[fieldKey];
        if (typeof selectedValue !== 'string') {
            continue;
        }
        const optionPlayerCounts = getPlayerCountsForSelectedOption(field, selectedValue);
        if (!optionPlayerCounts || optionPlayerCounts.length === 0) {
            continue;
        }
        const nextOptions = intersectPlayerOptions(resolvedOptions, optionPlayerCounts);
        if (nextOptions.length > 0) {
            resolvedOptions = nextOptions;
        }
    }

    return resolvedOptions.length > 0 ? resolvedOptions : baseOptions;
}

export function hasPlayerCountConstrainedSetupSelection(args: {
    gameManifest?: Pick<GameManifestEntry, 'setupOptions'>;
    setupSelections: GameSetupSelections;
    fieldKeys?: ReadonlySet<string>;
}): boolean {
    for (const [fieldKey, field] of Object.entries(args.gameManifest?.setupOptions ?? {})) {
        if (args.fieldKeys && !args.fieldKeys.has(fieldKey)) {
            continue;
        }
        if (!isSelectField(field)) {
            continue;
        }
        const selectedValue = args.setupSelections[fieldKey];
        if (typeof selectedValue !== 'string') {
            continue;
        }
        const optionPlayerCounts = getPlayerCountsForSelectedOption(field, selectedValue);
        if (optionPlayerCounts && optionPlayerCounts.length > 0) {
            return true;
        }
    }

    return false;
}

function applySetupDefaults(args: {
    gameManifest?: Pick<GameManifestEntry, 'id' | 'setupOptions'>;
    numPlayers: number;
    setupSelections: GameSetupSelections;
    createRoomMode: boolean;
}): GameSetupSelections {
    const normalized = normalizeSetupSelections(args.gameManifest, args.setupSelections);
    const nextSelections: GameSetupSelections = { ...normalized };

    for (const [fieldKey, field] of Object.entries(args.gameManifest?.setupOptions ?? {})) {
        if (!isSelectField(field)) {
            continue;
        }
        const currentValue = typeof nextSelections[fieldKey] === 'string'
            ? nextSelections[fieldKey]
            : undefined;
        nextSelections[fieldKey] = resolveCompatibleSelectValue({
            field,
            currentValue,
            numPlayers: args.numPlayers,
            createRoomMode: args.createRoomMode,
        });
    }

    return nextSelections;
}

export function applyCreateRoomSetupDefaultsForGame(args: {
    gameId?: string;
    gameManifest?: Pick<GameManifestEntry, 'id' | 'setupOptions'>;
    numPlayers: number;
    setupSelections: GameSetupSelections;
}): GameSetupSelections {
    return applySetupDefaults({
        gameManifest: args.gameManifest,
        numPlayers: args.numPlayers,
        setupSelections: args.setupSelections,
        createRoomMode: true,
    });
}

export function applySetupDefaultsForGame(args: {
    gameId?: string;
    gameManifest?: Pick<GameManifestEntry, 'id' | 'setupOptions'>;
    numPlayers: number;
    setupSelections: GameSetupSelections;
}): GameSetupSelections {
    return applySetupDefaults({
        gameManifest: args.gameManifest,
        numPlayers: args.numPlayers,
        setupSelections: args.setupSelections,
        createRoomMode: false,
    });
}
