export const SMASHUP_DECK_QUERY_SETUP_VALUE = 'deckQuery' as const;
export const SMASHUP_VICTORY_20_SETUP_VALUE = 'victory20' as const;
export const DEFAULT_SMASHUP_VICTORY_TARGET = 15;
export const SMASHUP_VICTORY_20_TARGET = 20;
export const DEFAULT_SMASHUP_EXPANSIONS = ['titans', 'diy'] as const;
const SMASHUP_PUBLIC_EXPANSION_ORDER = ['titans', 'diy'] as const;
const DEFAULT_SMASHUP_PUBLIC_ROOM_TAGS = ['titans', SMASHUP_DECK_QUERY_SETUP_VALUE, 'diy'] as const;
const SMASHUP_PUBLIC_ROOM_TAG_ORDER = ['titans', SMASHUP_DECK_QUERY_SETUP_VALUE, SMASHUP_VICTORY_20_SETUP_VALUE, 'diy'] as const;
const DEFAULT_SMASHUP_TEAM_MODE = 'ffa' as const;

export interface SmashUpPublicRoomSummary {
    enabledExpansions: string[];
}

export interface SmashUpRuntimeSetupConfig {
    enabledExpansions: string[];
    deckQueryEnabled: boolean;
    victoryTarget: number;
    teamMode: 'ffa' | '2v2';
}

function normalizeExpansionOrder(
    values: unknown,
    allowedOrder: readonly string[],
): string[] | undefined {
    if (!Array.isArray(values)) {
        return undefined;
    }

    const selected = new Set(
        values.filter((value): value is string => typeof value === 'string'),
    );
    return allowedOrder.filter((value) => selected.has(value));
}

function readSetupSelectionValue(
    setupData: Record<string, unknown> | undefined,
    fieldKey: string,
): unknown {
    const setupSelections = setupData?.setupSelections;
    if (!setupSelections || typeof setupSelections !== 'object' || Array.isArray(setupSelections)) {
        return undefined;
    }
    return (setupSelections as Record<string, unknown>)[fieldKey];
}

export function readSmashUpEnabledExpansions(setupData?: Record<string, unknown>): string[] {
    const topLevelExpansions = normalizeExpansionOrder(setupData?.expansions, SMASHUP_PUBLIC_EXPANSION_ORDER);
    if (topLevelExpansions) {
        return topLevelExpansions;
    }

    const selectedExpansions = normalizeExpansionOrder(
        readSetupSelectionValue(setupData, 'expansions'),
        SMASHUP_PUBLIC_EXPANSION_ORDER,
    );
    if (selectedExpansions) {
        return selectedExpansions;
    }

    return [...DEFAULT_SMASHUP_EXPANSIONS];
}

export function readSmashUpDeckQueryEnabled(setupData?: Record<string, unknown>): boolean {
    if (setupData?.deckQuery === 'on') {
        return true;
    }
    if (setupData?.deckQuery === 'off') {
        return false;
    }

    const selectedValue = readSetupSelectionValue(setupData, 'deckQuery');
    if (selectedValue === 'on') {
        return true;
    }

    const topLevelExpansions = setupData?.expansions;
    if (Array.isArray(topLevelExpansions)) {
        return topLevelExpansions.includes(SMASHUP_DECK_QUERY_SETUP_VALUE);
    }

    const selectedExpansions = readSetupSelectionValue(setupData, 'expansions');
    if (Array.isArray(selectedExpansions)) {
        return selectedExpansions.includes(SMASHUP_DECK_QUERY_SETUP_VALUE);
    }

    return true;
}

export function readSmashUpVictoryTarget(setupData?: Record<string, unknown>): number {
    if (
        setupData?.victoryTarget === SMASHUP_VICTORY_20_TARGET
        || setupData?.victoryTarget === String(SMASHUP_VICTORY_20_TARGET)
        || setupData?.victoryTarget === SMASHUP_VICTORY_20_SETUP_VALUE
    ) {
        return SMASHUP_VICTORY_20_TARGET;
    }

    const selectedVictoryTarget = readSetupSelectionValue(setupData, 'victoryTarget');
    if (
        selectedVictoryTarget === SMASHUP_VICTORY_20_TARGET
        || selectedVictoryTarget === String(SMASHUP_VICTORY_20_TARGET)
        || selectedVictoryTarget === SMASHUP_VICTORY_20_SETUP_VALUE
    ) {
        return SMASHUP_VICTORY_20_TARGET;
    }

    const topLevelExpansions = setupData?.expansions;
    if (Array.isArray(topLevelExpansions) && topLevelExpansions.includes(SMASHUP_VICTORY_20_SETUP_VALUE)) {
        return SMASHUP_VICTORY_20_TARGET;
    }

    const selectedExpansions = readSetupSelectionValue(setupData, 'expansions');
    if (Array.isArray(selectedExpansions) && selectedExpansions.includes(SMASHUP_VICTORY_20_SETUP_VALUE)) {
        return SMASHUP_VICTORY_20_TARGET;
    }

    return DEFAULT_SMASHUP_VICTORY_TARGET;
}

export function readSmashUpTeamMode(
    setupData?: Record<string, unknown>,
    playerCount = 0,
): 'ffa' | '2v2' {
    if (playerCount !== 4) {
        return DEFAULT_SMASHUP_TEAM_MODE;
    }

    if (setupData?.teamMode === '2v2') {
        return '2v2';
    }

    const selectedValue = readSetupSelectionValue(setupData, 'teamMode');
    if (selectedValue === '2v2') {
        return '2v2';
    }

    return DEFAULT_SMASHUP_TEAM_MODE;
}

export function readSmashUpRuntimeSetupConfig(
    setupData?: Record<string, unknown>,
    options?: { playerCount?: number },
): SmashUpRuntimeSetupConfig {
    return {
        enabledExpansions: readSmashUpEnabledExpansions(setupData),
        deckQueryEnabled: readSmashUpDeckQueryEnabled(setupData),
        victoryTarget: readSmashUpVictoryTarget(setupData),
        teamMode: readSmashUpTeamMode(setupData, options?.playerCount ?? 0),
    };
}

function readSmashUpPublicRoomTags(setupData?: Record<string, unknown>): string[] {
    const topLevelExpansions = normalizeExpansionOrder(setupData?.expansions, SMASHUP_PUBLIC_ROOM_TAG_ORDER);
    if (topLevelExpansions) {
        return topLevelExpansions;
    }

    const selectedExpansions = normalizeExpansionOrder(
        readSetupSelectionValue(setupData, 'expansions'),
        SMASHUP_PUBLIC_ROOM_TAG_ORDER,
    );
    if (selectedExpansions) {
        return selectedExpansions;
    }

    return [...DEFAULT_SMASHUP_PUBLIC_ROOM_TAGS];
}

export function buildSmashUpPublicRoomSummary(
    setupData?: Record<string, unknown>,
): SmashUpPublicRoomSummary | undefined {
    const enabledExpansions = readSmashUpPublicRoomTags(setupData);
    if (enabledExpansions.length === 0) {
        return undefined;
    }

    return {
        enabledExpansions,
    };
}
