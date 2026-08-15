import type { GameManifestEntry } from '../manifest.types';
import type { PublicSetupSummary } from '../../shared/lobby';

export const FANTASY_REALMS_VARIANT_SETUP_FIELD = 'variant' as const;
export const FANTASY_REALMS_EXPANSION_SETUP_FIELD = 'expansion' as const;
export const FANTASY_REALMS_CURSED_HOARD_SUITS_SETUP_VALUE = 'cursed-hoard-suits' as const;
export const FANTASY_REALMS_STANDARD_SETUP_VALUE = 'standard' as const;
export const FANTASY_REALMS_DUEL_SETUP_VALUE = 'duel' as const;
export const FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE = 'base' as const;

export type FantasyRealmsVariantMode =
    | typeof FANTASY_REALMS_STANDARD_SETUP_VALUE
    | typeof FANTASY_REALMS_DUEL_SETUP_VALUE;

export type FantasyRealmsExpansionMode =
    | typeof FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE
    | typeof FANTASY_REALMS_CURSED_HOARD_SUITS_SETUP_VALUE;

export interface FantasyRealmsRuntimeSetupConfig {
    variant: FantasyRealmsVariantMode;
    expansion: FantasyRealmsExpansionMode;
    cursedHoardSuitsEnabled: boolean;
}

const FANTASY_REALMS_STANDARD_PLAYER_OPTIONS = [3, 4, 5, 6] as const;
const FANTASY_REALMS_DUEL_PLAYER_OPTIONS = [2] as const;

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    return value as Record<string, unknown>;
}

function readSetupSelectionValue(
    setupData: Record<string, unknown> | undefined,
    fieldKey: string,
): unknown {
    const setupSelections = asRecord(setupData?.setupSelections);
    return setupSelections?.[fieldKey];
}

function normalizeVariant(value: unknown): FantasyRealmsVariantMode | undefined {
    if (value === FANTASY_REALMS_STANDARD_SETUP_VALUE || value === FANTASY_REALMS_DUEL_SETUP_VALUE) {
        return value;
    }
    return undefined;
}

function normalizeExpansion(value: unknown): FantasyRealmsExpansionMode | undefined {
    if (value === FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE || value === FANTASY_REALMS_CURSED_HOARD_SUITS_SETUP_VALUE) {
        return value;
    }
    return undefined;
}

export function readFantasyRealmsVariantMode(
    setupData?: Record<string, unknown>,
    options?: { playerCount?: number; allowLegacyTwoPlayerFallback?: boolean },
): FantasyRealmsVariantMode {
    const topLevelVariant = normalizeVariant(setupData?.[FANTASY_REALMS_VARIANT_SETUP_FIELD]);
    if (topLevelVariant) {
        return topLevelVariant;
    }

    const nestedVariant = normalizeVariant(
        readSetupSelectionValue(setupData, FANTASY_REALMS_VARIANT_SETUP_FIELD),
    );
    if (nestedVariant) {
        return nestedVariant;
    }

    if (options?.allowLegacyTwoPlayerFallback && options.playerCount === 2) {
        return FANTASY_REALMS_DUEL_SETUP_VALUE;
    }

    return FANTASY_REALMS_STANDARD_SETUP_VALUE;
}

export function readFantasyRealmsExpansionMode(
    setupData?: Record<string, unknown>,
): FantasyRealmsExpansionMode {
    const topLevelExpansion = normalizeExpansion(setupData?.[FANTASY_REALMS_EXPANSION_SETUP_FIELD]);
    if (topLevelExpansion) {
        return topLevelExpansion;
    }

    const nestedExpansion = normalizeExpansion(
        readSetupSelectionValue(setupData, FANTASY_REALMS_EXPANSION_SETUP_FIELD),
    );
    if (nestedExpansion) {
        return nestedExpansion;
    }

    return FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE;
}

export function readFantasyRealmsRuntimeSetupConfig(
    setupData?: Record<string, unknown>,
    options?: { playerCount?: number; allowLegacyTwoPlayerFallback?: boolean },
): FantasyRealmsRuntimeSetupConfig {
    const variant = readFantasyRealmsVariantMode(setupData, options);
    const expansion = readFantasyRealmsExpansionMode(setupData);
    return {
        variant,
        expansion,
        cursedHoardSuitsEnabled: expansion === FANTASY_REALMS_CURSED_HOARD_SUITS_SETUP_VALUE,
    };
}

export function getFantasyRealmsAllowedPlayerCounts(
    setupData?: Record<string, unknown>,
): readonly number[] {
    const variant = readFantasyRealmsVariantMode(setupData);
    if (variant === FANTASY_REALMS_DUEL_SETUP_VALUE) {
        return [2];
    }
    return FANTASY_REALMS_STANDARD_PLAYER_OPTIONS;
}

export function buildFantasyRealmsPublicRoomSummary(
    setupData?: Record<string, unknown>,
): PublicSetupSummary {
    const runtimeSetup = readFantasyRealmsRuntimeSetupConfig(setupData);
    if (!runtimeSetup.cursedHoardSuitsEnabled) {
        return undefined;
    }

    return {
        enabledExpansions: [FANTASY_REALMS_CURSED_HOARD_SUITS_SETUP_VALUE],
    };
}

export function buildFantasyRealmsSetupOptions(): NonNullable<GameManifestEntry['setupOptions']> {
    return {
        [FANTASY_REALMS_VARIANT_SETUP_FIELD]: {
            type: 'select',
            labelKey: 'setup.variant.label',
            options: [
                {
                    value: FANTASY_REALMS_STANDARD_SETUP_VALUE,
                    labelKey: 'setup.variant.standard',
                    playerOptions: [...FANTASY_REALMS_STANDARD_PLAYER_OPTIONS],
                },
                {
                    value: FANTASY_REALMS_DUEL_SETUP_VALUE,
                    labelKey: 'setup.variant.duel',
                    playerOptions: [...FANTASY_REALMS_DUEL_PLAYER_OPTIONS],
                },
            ],
            default: FANTASY_REALMS_STANDARD_SETUP_VALUE,
        },
        [FANTASY_REALMS_EXPANSION_SETUP_FIELD]: {
            type: 'select',
            labelKey: 'setup.expansion.label',
            presentation: 'segmented',
            options: [
                { value: FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE, labelKey: 'setup.expansion.base' },
                { value: FANTASY_REALMS_CURSED_HOARD_SUITS_SETUP_VALUE, labelKey: 'setup.expansion.cursedHoardSuits' },
            ],
            default: FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE,
            createRoomDefault: FANTASY_REALMS_BASE_EXPANSION_SETUP_VALUE,
        },
    };
}
