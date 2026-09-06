import type {
    GameRuntimeAdapter,
    GameRuntimeCreateRoomSetupContext,
    GameRuntimeLocalSetupResult,
} from '../gameRuntimeAdapter';
import type { MageId } from './domain/ids';
import {
    buildMageWarsMageSetupData,
    buildMageWarsMageSetupSelections,
    MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD,
    MAGE_WARS_SEAT_0_SPELLBOOK_SETUP_FIELD,
    MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD,
    MAGE_WARS_SEAT_1_SPELLBOOK_SETUP_FIELD,
    resolveMageWarsSelectedMageIdForSeat,
    resolveMageWarsSpellbookEntriesForSeat,
} from './roomSetup';
import { MageWarsMageSelectionGate } from './ui/MageSelectionGate';

function buildSetupDataFromSearchParams(searchParams: URLSearchParams): Record<string, unknown> {
    const setupData: Record<string, unknown> = {};
    for (const field of [
        MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD,
        MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD,
        MAGE_WARS_SEAT_0_SPELLBOOK_SETUP_FIELD,
        MAGE_WARS_SEAT_1_SPELLBOOK_SETUP_FIELD,
    ]) {
        const value = searchParams.get(`setup.${field}`);
        if (value !== null) {
            setupData[field] = value;
        }
    }
    if (Object.keys(setupData).length > 0) {
        setupData.setupSelections = { ...setupData };
    }
    return setupData;
}

export function resolveMageWarsLocalSetup(args: {
    searchParams: URLSearchParams;
}): GameRuntimeLocalSetupResult {
    const setupDataFromSearch = buildSetupDataFromSearchParams(args.searchParams);
    const seatMageIds = [
        resolveMageWarsSelectedMageIdForSeat(setupDataFromSearch, 0),
        resolveMageWarsSelectedMageIdForSeat(setupDataFromSearch, 1),
    ] as [MageId, MageId];
    const seatSpellbookEntries = [
        resolveMageWarsSpellbookEntriesForSeat(setupDataFromSearch, 0, seatMageIds[0]),
        resolveMageWarsSpellbookEntriesForSeat(setupDataFromSearch, 1, seatMageIds[1]),
    ] as const;

    return {
        numPlayers: 2,
        setupSelections: buildMageWarsMageSetupSelections(seatMageIds),
        setupData: buildMageWarsMageSetupData(seatMageIds, seatSpellbookEntries),
    };
}


export function resolveMageWarsCreateRoomSetup({
    setupData,
    setupSelections,
}: GameRuntimeCreateRoomSetupContext): GameRuntimeLocalSetupResult {
    const seedSetupData = {
        ...(setupData ?? {}),
        ...(setupSelections ?? {}),
        setupSelections: {
            ...((setupData?.setupSelections && typeof setupData.setupSelections === 'object' && !Array.isArray(setupData.setupSelections))
                ? setupData.setupSelections as Record<string, unknown>
                : {}),
            ...(setupSelections ?? {}),
        },
    };
    const seatMageIds = [
        resolveMageWarsSelectedMageIdForSeat(seedSetupData, 0),
        resolveMageWarsSelectedMageIdForSeat(seedSetupData, 1),
    ] as [MageId, MageId];
    const seatSpellbookEntries = [
        resolveMageWarsSpellbookEntriesForSeat(seedSetupData, 0, seatMageIds[0]),
        resolveMageWarsSpellbookEntriesForSeat(seedSetupData, 1, seatMageIds[1]),
    ] as const;

    return {
        numPlayers: 2,
        setupSelections: buildMageWarsMageSetupSelections(seatMageIds),
        setupData: buildMageWarsMageSetupData(seatMageIds, seatSpellbookEntries),
    };
}

export const mageWarsGameRuntimeAdapter: GameRuntimeAdapter = {
    resolveLocalSetup: resolveMageWarsLocalSetup,
    LocalSetupGate: MageWarsMageSelectionGate,
    resolveCreateRoomSetup: resolveMageWarsCreateRoomSetup,
    CreateRoomSetupGate: MageWarsMageSelectionGate,
};
