import type { PlayerId } from '../../engine/types';
import type { GameManifestEntry } from '../../shared/gameManifest.types';
import type { GameSetupSelections } from '../../shared/gameSetupOptions';
import {
    getFormalStartingMageIdFromConfig,
} from './data/configPackage';
import { MAGE_IDS, type MageId } from './domain/ids';

export const MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD = 'mageWarsSeat0MageId';
export const MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD = 'mageWarsSeat1MageId';

export const MAGE_WARS_SEAT_MAGE_SETUP_FIELDS = [
    MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD,
    MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD,
] as const;

export type MageWarsSeatMageSetupField = (typeof MAGE_WARS_SEAT_MAGE_SETUP_FIELDS)[number];

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
): Record<string, unknown> {
    const setupSelections = buildMageWarsMageSetupSelections(seatMageIds);
    return {
        ...setupSelections,
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
