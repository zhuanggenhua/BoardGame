export const DEFAULT_SMASHUP_EXPANSIONS = ['titans', 'diy'] as const;
export const SMASHUP_DECK_QUERY_SETUP_VALUE = 'deckQuery' as const;
const SMASHUP_PUBLIC_EXPANSIONS = new Set<string>(DEFAULT_SMASHUP_EXPANSIONS);
const SMASHUP_PUBLIC_ROOM_TAGS = new Set<string>([...DEFAULT_SMASHUP_EXPANSIONS, SMASHUP_DECK_QUERY_SETUP_VALUE]);

export interface SmashUpPublicRoomSummary {
    enabledExpansions: string[];
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
    const topLevelExpansions = setupData?.expansions;
    if (Array.isArray(topLevelExpansions)) {
        return topLevelExpansions.filter(
            (value): value is string => typeof value === 'string' && SMASHUP_PUBLIC_EXPANSIONS.has(value),
        );
    }

    const selectedExpansions = readSetupSelectionValue(setupData, 'expansions');
    if (Array.isArray(selectedExpansions)) {
        return selectedExpansions.filter(
            (value): value is string => typeof value === 'string' && SMASHUP_PUBLIC_EXPANSIONS.has(value),
        );
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

function readSmashUpPublicRoomTags(setupData?: Record<string, unknown>): string[] {
    const topLevelExpansions = setupData?.expansions;
    if (Array.isArray(topLevelExpansions)) {
        return topLevelExpansions.filter(
            (value): value is string => typeof value === 'string' && SMASHUP_PUBLIC_ROOM_TAGS.has(value),
        );
    }

    const selectedExpansions = readSetupSelectionValue(setupData, 'expansions');
    if (Array.isArray(selectedExpansions)) {
        return selectedExpansions.filter(
            (value): value is string => typeof value === 'string' && SMASHUP_PUBLIC_ROOM_TAGS.has(value),
        );
    }

    return [...DEFAULT_SMASHUP_EXPANSIONS, SMASHUP_DECK_QUERY_SETUP_VALUE];
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
