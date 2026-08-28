import type { PlayerId } from '../../engine/types';
import type { GameManifestEntry } from '../../shared/gameManifest.types';
import type { GameSetupSelections } from '../../shared/gameSetupOptions';
import {
    getFormalStartingMageIdFromConfig,
    getPresetSpellbookEntriesFromConfig,
} from './data/configPackage';
import { MAGE_IDS, type MageId } from './domain/ids';
import { getMageWarsSpellbookCopyLimitForCard } from './domain/spellbookBuilder';
import {
    cloneMageWarsSpellbookEntries,
    getMageWarsSpellbookCardCount,
    type MageWarsPlayerSpellbookEntry,
} from './domain/spellbook';

export const MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD = 'mageWarsSeat0MageId';
export const MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD = 'mageWarsSeat1MageId';
export const MAGE_WARS_SEAT_0_SPELLBOOK_SETUP_FIELD = 'mageWarsSeat0SpellbookEntries';
export const MAGE_WARS_SEAT_1_SPELLBOOK_SETUP_FIELD = 'mageWarsSeat1SpellbookEntries';

export const MAGE_WARS_SEAT_MAGE_SETUP_FIELDS = [
    MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD,
    MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD,
] as const;

export type MageWarsSeatMageSetupField = (typeof MAGE_WARS_SEAT_MAGE_SETUP_FIELDS)[number];

export const MAGE_WARS_SEAT_SPELLBOOK_SETUP_FIELDS = [
    MAGE_WARS_SEAT_0_SPELLBOOK_SETUP_FIELD,
    MAGE_WARS_SEAT_1_SPELLBOOK_SETUP_FIELD,
] as const;

export type MageWarsSeatSpellbookSetupField = (typeof MAGE_WARS_SEAT_SPELLBOOK_SETUP_FIELDS)[number];
export type MageWarsSpellbookSetupEntry = MageWarsPlayerSpellbookEntry;

const MAGE_WARS_SELECTABLE_MAGE_IDS = [
    MAGE_IDS.BEASTMASTER_APPRENTICE,
    MAGE_IDS.PRIESTESS_APPRENTICE,
    MAGE_IDS.WARLOCK_APPRENTICE,
    MAGE_IDS.WIZARD_APPRENTICE,
] as const satisfies readonly MageId[];

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    return value as Record<string, unknown>;
}

function getSeatMageField(seatIndex: number): MageWarsSeatMageSetupField | undefined {
    return MAGE_WARS_SEAT_MAGE_SETUP_FIELDS[seatIndex];
}

function getSeatSpellbookField(seatIndex: number): MageWarsSeatSpellbookSetupField | undefined {
    return MAGE_WARS_SEAT_SPELLBOOK_SETUP_FIELDS[seatIndex];
}

function readSpellbookSetupValue(
    setupData: unknown,
    field: MageWarsSeatSpellbookSetupField,
): unknown {
    const setupRecord = asRecord(setupData);
    const setupSelections = asRecord(setupRecord?.setupSelections);
    return setupRecord?.[field] ?? setupSelections?.[field];
}

function parseJsonSpellbookEntries(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

export function getMageWarsSpellbookCopyLimit(spellCardId: number): number {
    return getMageWarsSpellbookCopyLimitForCard(spellCardId);
}

export function normalizeMageWarsSpellbookEntries(
    rawValue: unknown,
): MageWarsSpellbookSetupEntry[] | undefined {
    const value = typeof rawValue === 'string' ? parseJsonSpellbookEntries(rawValue) : rawValue;
    if (!Array.isArray(value)) {
        return undefined;
    }

    const counts = new Map<number, number>();
    for (const rawEntry of value) {
        const entry = asRecord(rawEntry);
        const spellCardId = entry?.spellCardId;
        const count = entry?.count;
        if (!Number.isInteger(spellCardId) || !Number.isInteger(count) || count <= 0) {
            continue;
        }
        const limit = getMageWarsSpellbookCopyLimit(spellCardId);
        if (limit <= 0) {
            continue;
        }
        counts.set(spellCardId, Math.min(limit, (counts.get(spellCardId) ?? 0) + count));
    }

    if (counts.size === 0) {
        return undefined;
    }

    return [...counts.entries()]
        .sort(([left], [right]) => left - right)
        .map(([spellCardId, count]) => ({ spellCardId, count }));
}

export function getMageWarsDefaultSpellbookEntries(
    mageId: MageId,
): MageWarsSpellbookSetupEntry[] {
    return cloneMageWarsSpellbookEntries(getPresetSpellbookEntriesFromConfig(mageId));
}

export function getMageWarsSelectableMageIds(): readonly MageId[] {
    return MAGE_WARS_SELECTABLE_MAGE_IDS;
}

export function isMageWarsSelectableMageId(value: unknown): value is MageId {
    return typeof value === 'string'
        && (MAGE_WARS_SELECTABLE_MAGE_IDS as readonly string[]).includes(value);
}

export function buildMageWarsSetupOptions(): NonNullable<GameManifestEntry['setupOptions']> {
    const options = MAGE_WARS_SELECTABLE_MAGE_IDS.map((mageId) => ({
        value: mageId,
        labelKey: `mages.${mageId}`,
    }));

    return {
        [MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD]: {
            type: 'select',
            labelKey: 'setup.seat0Mage.label',
            options,
            default: getFormalStartingMageIdFromConfig(0),
        },
        [MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD]: {
            type: 'select',
            labelKey: 'setup.seat1Mage.label',
            options,
            default: getFormalStartingMageIdFromConfig(1),
        },
    };
}

export function buildMageWarsMageSetupSelections(
    seatMageIds: readonly [MageId, MageId],
): GameSetupSelections {
    return {
        [MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD]: seatMageIds[0],
        [MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD]: seatMageIds[1],
    };
}

export function buildMageWarsMageSetupData(
    seatMageIds: readonly [MageId, MageId],
    seatSpellbookEntries?: readonly [
        readonly MageWarsSpellbookSetupEntry[],
        readonly MageWarsSpellbookSetupEntry[],
    ],
): Record<string, unknown> {
    const setupSelections = buildMageWarsMageSetupSelections(seatMageIds);
    const spellbookEntries = seatSpellbookEntries ?? [
        getMageWarsDefaultSpellbookEntries(seatMageIds[0]),
        getMageWarsDefaultSpellbookEntries(seatMageIds[1]),
    ];
    return {
        ...setupSelections,
        [MAGE_WARS_SEAT_0_SPELLBOOK_SETUP_FIELD]: cloneMageWarsSpellbookEntries(spellbookEntries[0]),
        [MAGE_WARS_SEAT_1_SPELLBOOK_SETUP_FIELD]: cloneMageWarsSpellbookEntries(spellbookEntries[1]),
        setupSelections,
    };
}

export function resolveMageWarsSelectedMageIdForSeat(
    setupData: unknown,
    seatIndex: number,
): MageId {
    const field = getSeatMageField(seatIndex);
    const fallback = getFormalStartingMageIdFromConfig(seatIndex);
    if (!field) return fallback;

    const setupRecord = asRecord(setupData);
    const setupSelections = asRecord(setupRecord?.setupSelections);
    const rawValue = setupSelections?.[field] ?? setupRecord?.[field];

    return isMageWarsSelectableMageId(rawValue) ? rawValue : fallback;
}

export function resolveMageWarsSpellbookEntriesForSeat(
    setupData: unknown,
    seatIndex: number,
    mageId: MageId = resolveMageWarsSelectedMageIdForSeat(setupData, seatIndex),
): MageWarsSpellbookSetupEntry[] {
    const field = getSeatSpellbookField(seatIndex);
    if (!field) return getMageWarsDefaultSpellbookEntries(mageId);

    const entries = normalizeMageWarsSpellbookEntries(readSpellbookSetupValue(setupData, field));
    return entries ?? getMageWarsDefaultSpellbookEntries(mageId);
}

export function resolveMageWarsSpellbookCardCountForSeat(
    setupData: unknown,
    seatIndex: number,
): number {
    const mageId = resolveMageWarsSelectedMageIdForSeat(setupData, seatIndex);
    return getMageWarsSpellbookCardCount(resolveMageWarsSpellbookEntriesForSeat(setupData, seatIndex, mageId));
}

export function resolveMageWarsSelectedMageIdsForPlayers(
    setupData: unknown,
    playerIds: readonly PlayerId[],
): Record<PlayerId, MageId> {
    return Object.fromEntries(
        playerIds.map((playerId, seatIndex) => [
            playerId,
            resolveMageWarsSelectedMageIdForSeat(setupData, seatIndex),
        ]),
    );
}
