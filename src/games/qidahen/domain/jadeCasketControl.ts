import type { QidahenCore, QidahenFactionId } from './types';

export const QIDAHEN_JADE_CASKET_UNEARTHED_CARD_DEF_ID = 'qidahen-atlas05-1625-jade-casket-unearthed';
export const QIDAHEN_GUIHUA_RUNTIME_REGION_ID = 'city-region-20';
export const QIDAHEN_ORDOS_RUNTIME_REGION_ID = 'city-region-26';

const CONTROL_REGION_IDS = [
    QIDAHEN_GUIHUA_RUNTIME_REGION_ID,
    QIDAHEN_ORDOS_RUNTIME_REGION_ID,
] as const;

const getRegionController = (
    state: QidahenCore,
    regionId: string,
): QidahenFactionId | 'neutral' | null => (
    state.regions.find((region) => !region.isLogicalRegion && region.id === regionId)?.controller ?? null
);

export const getQidahenGuihuaController = (
    state: QidahenCore,
): QidahenFactionId | 'neutral' | null => (
    getRegionController(state, QIDAHEN_GUIHUA_RUNTIME_REGION_ID)
);

export const syncQidahenJadeCasketControlAfterRegionChange = (
    previousState: QidahenCore,
    nextState: QidahenCore,
): QidahenCore => {
    const previousOwner = previousState.activeEventCards.find((card) => (
        card.cardDefId === QIDAHEN_JADE_CASKET_UNEARTHED_CARD_DEF_ID
    ))?.ownerFactionId ?? null;
    let transferTarget: QidahenFactionId | null = null;
    if (previousOwner) {
        const transfer = CONTROL_REGION_IDS
            .map((regionId) => ({
                previousController: getRegionController(previousState, regionId),
                nextController: getRegionController(nextState, regionId),
            }))
            .find(({ previousController, nextController }) => (
                previousController === previousOwner
                && nextController !== previousController
                && nextController != null
                && nextController !== 'neutral'
            ));
        if (transfer?.nextController && transfer.nextController !== 'neutral') {
            transferTarget = transfer.nextController;
        }
    }
    const guihuaPrestigeMarkerController = getQidahenGuihuaController(nextState);
    const activeEventCards = transferTarget
        ? nextState.activeEventCards.map((card) => (
            card.cardDefId === QIDAHEN_JADE_CASKET_UNEARTHED_CARD_DEF_ID
                ? {
                    ...card,
                    id: `active-event-${card.cardDefId}-${transferTarget}`,
                    ownerFactionId: transferTarget,
                }
                : card
        ))
        : nextState.activeEventCards;

    if (
        activeEventCards === nextState.activeEventCards
        && guihuaPrestigeMarkerController === nextState.guihuaPrestigeMarkerController
    ) {
        return nextState;
    }
    return {
        ...nextState,
        activeEventCards,
        guihuaPrestigeMarkerController,
    };
};
