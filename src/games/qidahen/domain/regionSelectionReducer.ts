import { getCurrentFactionId } from './factionTurnAccessors';
import { type QidahenMovementProfileId } from './movement';
import { resolveQidahenPrimaryRuntimeRegionId } from './regionConfig';
import {
    buildDriveTigerDispatchSelectionFromRegionSemantics,
    buildGaoDiDispatchSelectionFromRegionSemantics,
    buildKhanEdictDispatchSelection,
    buildWheelDispatchSelectionFromRegionSemantics,
    getPreferredDispatchSourceRegionIdForSemantics,
    getQidahenWheelDispatchSelectionRegionSemantics,
    getQidahenCurrentWheelDispatchSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
} from './dispatchSelectionBuilders';
import {
    buildDiplomacySelectionFromRegionSemantics,
    buildKhanEdictSelectionFromRegionSemantics,
    buildMaShiTradeSelectionFromRegionSemantics,
    buildQidahenDiplomacyProgress,
    buildRecruitSelectionFromRegionSemantics,
    getQidahenCurrentDiplomacySelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './selectionBuilders';
import {
    resolveQidahenGaoDiDispatchChoice,
    resolveQidahenInternalDispatchInteractionChoice,
    resolveQidahenWheelDispatchInteractionChoice,
} from './actionWindowDispatch';
import { applyQidahenCharacterActionWindowEffectsWithFocus } from './characterActionWindow';
import {
    buildQidahenRegionFocusState,
    getQidahenExplicitRegionSelectionSemantics,
    keepQidahenDecisionRegionWithExplicitFocus,
} from './regionFocusSemantics';
import { updateQidahenTurnLabel } from './turnLabelState';
import type { QidahenCore } from './types';
import { getQidahenRuntimeRegionIdsForPrintedRegionId } from '../ui/mapGraph';

const getQidahenSelectedRegionMatchIds = (selectedRegionId: string): Set<string> => (
    new Set([
        selectedRegionId,
        resolveQidahenPrimaryRuntimeRegionId(selectedRegionId),
        ...getQidahenRuntimeRegionIdsForPrintedRegionId(selectedRegionId),
    ])
);

const doesQidahenSelectedRegionMatchTarget = (
    selectedRegionId: string,
    targetRegionId: string,
): boolean => {
    const selectedRegionMatchIds = getQidahenSelectedRegionMatchIds(selectedRegionId);
    const targetRegionMatchIds = getQidahenSelectedRegionMatchIds(targetRegionId);
    for (const candidateRegionId of targetRegionMatchIds) {
        if (selectedRegionMatchIds.has(candidateRegionId)) {
            return true;
        }
    }
    return false;
};

interface QidahenRegionSelectedDependencies {
    applyCharacterActionWindowEffectsWithFocus: (
        state: QidahenCore,
    ) => { state: QidahenCore; forcedSelectedRegionId: string | null };
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
    resolveQidahenWheelDispatchInteractionChoice: (
        state: QidahenCore,
        choiceId: string,
        timestamp: number,
        interactionSelection?: ReturnType<typeof getQidahenCurrentWheelDispatchSelectionForCore>,
    ) => QidahenCore;
    resolveQidahenGaoDiDispatchChoice: (
        state: QidahenCore,
        choiceId: string,
        timestamp: number,
        interactionSelection?: QidahenCore['gaoDiDispatchSelection'],
    ) => QidahenCore;
    resolveQidahenInternalDispatchInteractionChoice: (
        state: QidahenCore,
        choiceId: string,
        timestamp: number,
        interactionSelection?: ReturnType<typeof getQidahenInternalDispatchSelectionForCore>,
    ) => QidahenCore;
}

export const reduceQidahenRegionSelected = (
    state: QidahenCore,
    regionId: string,
    timestamp: number,
    diplomacySelectionCarry: ReturnType<typeof getQidahenCurrentDiplomacySelectionForCore> = null,
    internalDispatchSelectionCarry: ReturnType<typeof getQidahenInternalDispatchSelectionForCore> = null,
    wheelDispatchSelectionCarry: ReturnType<typeof getQidahenCurrentWheelDispatchSelectionForCore> = null,
    dependencies: QidahenRegionSelectedDependencies = {
        applyCharacterActionWindowEffectsWithFocus: applyQidahenCharacterActionWindowEffectsWithFocus,
        updateTurnLabel: updateQidahenTurnLabel,
        resolveQidahenWheelDispatchInteractionChoice,
        resolveQidahenGaoDiDispatchChoice,
        resolveQidahenInternalDispatchInteractionChoice,
    },
): QidahenCore => {
    const actionWindowEffect = state.turnPhase === 'action-window'
        ? dependencies.applyCharacterActionWindowEffectsWithFocus(state)
        : { state, forcedSelectedRegionId: null };
    const selectedRegionId = regionId;
    const explicitRegionId = regionId;
    const nextState = {
        ...actionWindowEffect.state,
        explicitRegionId,
        regionFocusState: buildQidahenRegionFocusState(
            actionWindowEffect.state.regionFocusState.defaultFocusRegionId,
            {
                lockedSourceRegionId: actionWindowEffect.state.regionFocusState.lockedSourceRegionId,
                currentTargetRegionId: explicitRegionId,
                displayAnchorRegionId: explicitRegionId,
            },
        ),
    };
    const selectedRegionSemantics = getQidahenExplicitRegionSelectionSemantics(
        { ...nextState, explicitRegionId },
        selectedRegionId,
    );
    const recruitSelection = getQidahenRecruitSelectionForCore(nextState);
    if (recruitSelection) {
        const rebuiltRecruitSelection = buildRecruitSelectionFromRegionSemantics(
            nextState,
            selectedRegionSemantics,
            getCurrentFactionId(nextState),
        );
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId,
            turnPhase: rebuiltRecruitSelection ? 'recruit-choice' : 'action-window',
            recruitSelection: rebuiltRecruitSelection,
        });
    }
    if (nextState.gaoDiDispatchSelection) {
        const chosenTargetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
        const chosenTarget = nextState.gaoDiDispatchSelection.selectedCardId
            ? nextState.gaoDiDispatchSelection.candidates.find((candidate) => (
                doesQidahenSelectedRegionMatchTarget(selectedRegionId, candidate.targetRegionId)
                || candidate.targetRegionId === chosenTargetRuntimeRegionId
            )) ?? null
            : null;
        if (chosenTarget) {
            return dependencies.resolveQidahenGaoDiDispatchChoice(
                nextState,
                chosenTarget.id,
                timestamp,
                nextState.gaoDiDispatchSelection,
            );
        }
        if (nextState.gaoDiDispatchSelection.selectedCardId) {
            return dependencies.updateTurnLabel({
                ...nextState,
                selectedRegionId: nextState.selectedRegionId,
                explicitRegionId,
                turnPhase: 'gao-di-dispatch-choice',
                gaoDiDispatchSelection: nextState.gaoDiDispatchSelection,
            });
        }
        const rebuiltGaoDiDispatchSelection = buildGaoDiDispatchSelectionFromRegionSemantics(
            nextState,
            selectedRegionSemantics,
        );
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId,
            turnPhase: rebuiltGaoDiDispatchSelection ? 'gao-di-dispatch-choice' : 'action-window',
            gaoDiDispatchSelection: rebuiltGaoDiDispatchSelection,
        });
    }
    const internalDispatchSelection = internalDispatchSelectionCarry
        ?? getQidahenInternalDispatchSelectionForCore(nextState);
    if (internalDispatchSelection) {
        const chosenTargetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
        const chosenTarget = internalDispatchSelection.candidates.find((candidate) => (
            doesQidahenSelectedRegionMatchTarget(selectedRegionId, candidate.targetRegionId)
            || candidate.targetRegionId === chosenTargetRuntimeRegionId
        )) ?? null;
        if (chosenTarget) {
            return dependencies.resolveQidahenInternalDispatchInteractionChoice(
                nextState,
                chosenTarget.id,
                timestamp,
                internalDispatchSelection,
            );
        }
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId,
            turnPhase: 'internal-dispatch-choice',
        });
    }
    const maShiTradeSelection = getQidahenMaShiTradeSelectionForCore(nextState);
    if (maShiTradeSelection) {
        const rebuiltMaShiTradeSelection = buildMaShiTradeSelectionFromRegionSemantics(
            nextState,
            selectedRegionSemantics,
        );
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId,
            turnPhase: rebuiltMaShiTradeSelection ? 'ma-shi-trade-choice' : 'action-window',
            maShiTradeSelection: rebuiltMaShiTradeSelection,
        });
    }
    const khanEdictSelection = getQidahenKhanEdictSelectionForCore(nextState);
    if (khanEdictSelection) {
        const rebuiltKhanEdictSelection = buildKhanEdictSelectionFromRegionSemantics(
            nextState,
            getCurrentFactionId(nextState),
            selectedRegionSemantics,
            khanEdictSelection.preferredSourceRegionId,
        );
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId,
            turnPhase: rebuiltKhanEdictSelection ? 'khan-edict-choice' : 'action-window',
            khanEdictSelection: rebuiltKhanEdictSelection,
        });
    }
    const diplomacySelection = diplomacySelectionCarry ?? getQidahenCurrentDiplomacySelectionForCore(nextState);
    if (diplomacySelection) {
        const rebuiltDiplomacySelection = buildDiplomacySelectionFromRegionSemantics(
            nextState,
            getCurrentFactionId(nextState),
            selectedRegionSemantics,
            diplomacySelection.source,
            diplomacySelection.sourceRegionId,
            diplomacySelection.preferredSourceRegionId,
            {
                remainingTargetCount: diplomacySelection.remainingTargetCount,
                resolvedSteps: diplomacySelection.resolvedSteps,
            },
        );
        const carryRequiresDiplomacyProgressHost = !!diplomacySelectionCarry
            && (
                diplomacySelectionCarry.resolvedSteps.length > 0
                || diplomacySelectionCarry.remainingTargetCount < diplomacySelectionCarry.maxTargetCount
                || rebuiltDiplomacySelection?.targetRegionId != null
            );
        const rebuiltDiplomacyProgress = nextState.diplomacyProgress
            ?? (carryRequiresDiplomacyProgressHost
                ? buildQidahenDiplomacyProgress(diplomacySelectionCarry)
                : null);
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId,
            turnPhase: rebuiltDiplomacySelection ? 'diplomacy-choice' : 'action-window',
            diplomacyProgress: rebuiltDiplomacySelection ? rebuiltDiplomacyProgress : null,
        });
    }
    if (nextState.handLimitDiscardSelection) {
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId: nextState.explicitRegionId ?? explicitRegionId,
            turnPhase: 'hand-limit-discard',
        });
    }
    if (nextState.sunYuanhuaTechSelection) {
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId: nextState.explicitRegionId ?? explicitRegionId,
            turnPhase: 'sun-yuanhua-tech-choice',
        });
    }
    if (nextState.turnPhase === 'season-resolution') {
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId: nextState.explicitRegionId ?? explicitRegionId,
            turnPhase: nextState.turnPhase,
        });
    }
    if (nextState.pendingTargetAction) {
        return dependencies.updateTurnLabel({
            ...nextState,
            ...keepQidahenDecisionRegionWithExplicitFocus(
                nextState,
                nextState.pendingTargetAction.targetRuntimeRegionId,
                explicitRegionId,
            ),
            explicitRegionId,
            turnPhase: 'resolve-pending',
        });
    }
    const wheelDispatchSelection = wheelDispatchSelectionCarry ?? getQidahenCurrentWheelDispatchSelectionForCore(nextState);
    if (
        nextState.turnPhase === 'drive-tiger-consent'
        && wheelDispatchSelection?.sourceActionId === 'drive-tiger'
    ) {
        return dependencies.updateTurnLabel({
            ...nextState,
            ...keepQidahenDecisionRegionWithExplicitFocus(
                nextState,
                wheelDispatchSelection.sourceRegionId,
                explicitRegionId,
            ),
            turnPhase: 'drive-tiger-consent',
        });
    }
    if (nextState.postBattleSelection) {
        return dependencies.updateTurnLabel({
            ...nextState,
            ...keepQidahenDecisionRegionWithExplicitFocus(
                nextState,
                nextState.postBattleSelection.targetRuntimeRegionId,
                explicitRegionId,
            ),
            explicitRegionId,
            turnPhase: 'post-battle-decision',
        });
    }
    if (!wheelDispatchSelection) {
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: actionWindowEffect.forcedSelectedRegionId ?? selectedRegionId,
            explicitRegionId,
        });
    }

    const chosenTargetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const chosenTarget = wheelDispatchSelection.candidates.find((candidate) => (
        doesQidahenSelectedRegionMatchTarget(selectedRegionId, candidate.targetRuntimeRegionId)
        || doesQidahenSelectedRegionMatchTarget(selectedRegionId, candidate.targetRegionId)
        || candidate.targetRuntimeRegionId === chosenTargetRuntimeRegionId
    ));
    if (chosenTarget) {
        return dependencies.resolveQidahenWheelDispatchInteractionChoice(
            nextState,
            chosenTarget.targetRuntimeRegionId,
            timestamp,
            wheelDispatchSelection,
        );
    }

    const attackerFactionId = wheelDispatchSelection.attackerFactionId;
    const movementProfileId = wheelDispatchSelection.movementProfileId as QidahenMovementProfileId;
    const selectionSourceActionId = wheelDispatchSelection.sourceActionId ?? 'wheel-dispatch';
    const rebuiltSelection = selectionSourceActionId === 'khan-edict'
        ? buildKhanEdictDispatchSelection(
            nextState,
            attackerFactionId,
            getQidahenWheelDispatchSelectionRegionSemantics(
                nextState,
                selectedRegionId,
                wheelDispatchSelection.preferredSourceRegionId,
            ),
        )
        : selectionSourceActionId === 'drive-tiger'
            ? buildDriveTigerDispatchSelectionFromRegionSemantics(
                nextState,
                getCurrentFactionId(nextState),
                selectedRegionSemantics,
                wheelDispatchSelection.preferredSourceRegionId,
            )
            : (() => {
                const dispatchRegionSemantics = getQidahenWheelDispatchSelectionRegionSemantics(
                    nextState,
                    selectedRegionId,
                    wheelDispatchSelection.preferredSourceRegionId,
                );
                const preferredSourceRegionId = getPreferredDispatchSourceRegionIdForSemantics(
                    nextState,
                    attackerFactionId,
                    movementProfileId,
                    dispatchRegionSemantics,
                );
                return buildWheelDispatchSelectionFromRegionSemantics(
                    nextState,
                    attackerFactionId,
                    movementProfileId,
                    {
                        ...dispatchRegionSemantics,
                        preferredSourceRegionId,
                    },
                    selectionSourceActionId,
                );
            })();
    if (rebuiltSelection) {
        const shouldKeepRebuiltWheelDispatchSelectionOffHost = nextState.wheelDispatchProgress == null
            && (
                selectionSourceActionId === 'wheel-dispatch'
                || selectionSourceActionId === 'drive-tiger'
            );
        return dependencies.updateTurnLabel({
            ...nextState,
            selectedRegionId: nextState.selectedRegionId,
            explicitRegionId,
            turnPhase: 'dispatch-targeting',
            wheelDispatchProgress: shouldKeepRebuiltWheelDispatchSelectionOffHost ? null : rebuiltSelection,
            pendingTargetAction: null,
        });
    }

    return dependencies.updateTurnLabel({
        ...nextState,
        selectedRegionId,
        explicitRegionId,
    });
};
