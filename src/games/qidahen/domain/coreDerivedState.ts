import { syncQidahenMapTokensFromRegions } from './mapTokens';
import {
    getQidahenCurrentWheelDispatchSelectionForCore,
} from './dispatchSelectionBuilders';
import {
    syncRegionsPieceIds,
    syncPiecesFromRegions,
    syncRegionsSpecialTroopsFromPieces,
} from './troopCompat';
import type { QidahenCore } from './types';

export const syncQidahenCurrentCoreSelections = (
    state: QidahenCore,
): QidahenCore => {
    const wheelDispatchSelection = getQidahenCurrentWheelDispatchSelectionForCore(state);
    const shouldKeepWheelDispatchSelectionOffHost = state.wheelDispatchProgress == null
        && (
            (
                state.turnPhase === 'dispatch-targeting'
                && (
                    wheelDispatchSelection?.sourceActionId === 'wheel-dispatch'
                    || wheelDispatchSelection?.sourceActionId === 'drive-tiger'
                )
            )
            || (
                state.turnPhase === 'drive-tiger-consent'
                && wheelDispatchSelection?.sourceActionId === 'drive-tiger'
            )
        );
    return {
        ...state,
        wheelDispatchProgress: shouldKeepWheelDispatchSelectionOffHost ? null : wheelDispatchSelection,
    };
};

export const syncQidahenCorePieceCollections = (
    state: QidahenCore,
): QidahenCore => {
    const syncedPieceIdState = syncRegionsPieceIds(state.regions, state.nextPieceSerial);
    const pieces = syncPiecesFromRegions(syncedPieceIdState.regions);
    const regions = syncRegionsSpecialTroopsFromPieces(syncedPieceIdState.regions, pieces);
    return {
        ...state,
        regions,
        nextPieceSerial: syncedPieceIdState.nextPieceSerial,
        pieces,
        mapTokens: syncQidahenMapTokensFromRegions(regions, pieces),
    };
};
