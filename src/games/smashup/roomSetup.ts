export const DEFAULT_SMASHUP_EXPANSIONS = ['titans', 'diy'] as const;

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
        return topLevelExpansions.filter((value): value is string => typeof value === 'string');
    }

    const selectedExpansions = readSetupSelectionValue(setupData, 'expansions');
    if (Array.isArray(selectedExpansions)) {
        return selectedExpansions.filter((value): value is string => typeof value === 'string');
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
    return selectedValue === 'on';
}

export function buildSmashUpPublicRoomSummary(
    setupData?: Record<string, unknown>,
): SmashUpPublicRoomSummary | undefined {
    const enabledExpansions = readSmashUpEnabledExpansions(setupData);
    if (enabledExpansions.length === 0) {
        return undefined;
    }

    return {
        enabledExpansions,
    };
}
