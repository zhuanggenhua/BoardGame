import type { GameRuntimeAdapter, GameRuntimeLocalSetupResult } from '../gameRuntimeAdapter';
import type { MageId } from './domain/ids';
import {
    buildMageWarsMageSetupData,
    buildMageWarsMageSetupSelections,
    MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD,
    MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD,
    resolveMageWarsSelectedMageIdForSeat,
} from './roomSetup';
import { MageWarsMageSelectionGate } from './ui/MageSelectionGate';

function buildSetupDataFromSearchParams(searchParams: URLSearchParams): Record<string, unknown> {
    const setupData: Record<string, unknown> = {};
    for (const field of [MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD, MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD]) {
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

    return {
        numPlayers: 2,
        setupSelections: buildMageWarsMageSetupSelections(seatMageIds),
        setupData: buildMageWarsMageSetupData(seatMageIds),
    };
}

export const mageWarsGameRuntimeAdapter: GameRuntimeAdapter = {
    resolveLocalSetup: resolveMageWarsLocalSetup,
    LocalSetupGate: MageWarsMageSelectionGate,
};
