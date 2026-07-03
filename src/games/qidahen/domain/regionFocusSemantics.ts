import type {
    QidahenCore,
    QidahenRegionFocusState,
} from './types';

export interface QidahenExplicitRegionSelectionSemantics {
    defaultFocusRegionId: string;
    lockedFocusRegionId: string;
    lockedSourceRegionId: string | null;
    targetRegionId: string;
    currentTargetRegionId: string;
    displayAnchorRegionId: string;
}

type QidahenRegionFocusHost = Pick<QidahenCore, 'explicitRegionId' | 'regionFocusState' | 'selectedRegionId'>;

export const buildQidahenRegionFocusState = (
    defaultFocusRegionId: string,
    overrides: Partial<Omit<QidahenRegionFocusState, 'defaultFocusRegionId'>> = {},
): QidahenRegionFocusState => ({
    defaultFocusRegionId,
    lockedSourceRegionId: overrides.lockedSourceRegionId ?? null,
    currentTargetRegionId: overrides.currentTargetRegionId ?? null,
    displayAnchorRegionId: overrides.displayAnchorRegionId ?? defaultFocusRegionId,
});

export const withQidahenRegionFocusState = (
    state: QidahenCore,
    defaultFocusRegionId: string,
    overrides: Partial<Omit<QidahenRegionFocusState, 'defaultFocusRegionId'>> = {},
): Pick<QidahenCore, 'explicitRegionId' | 'regionFocusState' | 'selectedRegionId'> => ({
    selectedRegionId: defaultFocusRegionId,
    explicitRegionId: overrides.currentTargetRegionId ?? null,
    regionFocusState: buildQidahenRegionFocusState(defaultFocusRegionId, overrides),
});

export const getQidahenInteractionFocusRegionId = (
    state: QidahenRegionFocusHost,
    selectedRegionId: string,
): string => (
    selectedRegionId !== state.selectedRegionId
        ? selectedRegionId
        : state.explicitRegionId ?? selectedRegionId
);

export const getQidahenExplicitRegionSelectionSemantics = (
    state: QidahenRegionFocusHost,
    selectedRegionId: string,
): QidahenExplicitRegionSelectionSemantics => {
    const targetRegionId = getQidahenInteractionFocusRegionId(state, selectedRegionId);
    const displayAnchorRegionId = state.explicitRegionId || selectedRegionId !== state.selectedRegionId
        ? targetRegionId
        : state.regionFocusState.displayAnchorRegionId ?? targetRegionId;
    return {
        defaultFocusRegionId: state.regionFocusState.defaultFocusRegionId,
        lockedFocusRegionId: state.selectedRegionId,
        lockedSourceRegionId: state.regionFocusState.lockedSourceRegionId,
        targetRegionId,
        currentTargetRegionId: targetRegionId,
        displayAnchorRegionId,
    };
};

export const getQidahenLockedRegionSelectionSemantics = (
    state: Pick<QidahenCore, 'regionFocusState' | 'selectedRegionId'>,
    regionId: string = state.selectedRegionId,
): QidahenExplicitRegionSelectionSemantics => ({
    defaultFocusRegionId: state.regionFocusState.defaultFocusRegionId,
    lockedFocusRegionId: state.selectedRegionId,
    lockedSourceRegionId: regionId,
    targetRegionId: regionId,
    currentTargetRegionId: regionId,
    displayAnchorRegionId: regionId,
});

export const keepQidahenDecisionRegionWithExplicitFocus = (
    nextState: QidahenCore,
    decisionRegionId: string | null | undefined,
    explicitRegionId: string,
): Pick<QidahenCore, 'explicitRegionId' | 'regionFocusState' | 'selectedRegionId'> => ({
    selectedRegionId: decisionRegionId ?? nextState.selectedRegionId,
    explicitRegionId,
    regionFocusState: buildQidahenRegionFocusState(
        nextState.regionFocusState.defaultFocusRegionId,
        {
            lockedSourceRegionId: nextState.regionFocusState.lockedSourceRegionId,
            currentTargetRegionId: decisionRegionId ?? nextState.regionFocusState.currentTargetRegionId,
            displayAnchorRegionId: explicitRegionId,
        },
    ),
});
