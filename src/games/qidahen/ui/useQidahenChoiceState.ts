import React from 'react';
import type { Props, QidahenMagnifyTarget, QidahenPrimaryStageMode } from './boardTypes';
import { useQidahenRuntime } from './useQidahenRuntime';
import {
    getQidahenHandLimitDiscardSelectionFromInteraction,
    getQidahenRecruitSelectionFromInteraction,
    getQidahenGrantPardonSelectionFromInteraction,
    getQidahenDiplomacySelectionFromInteraction,
    getQidahenWheelDispatchSelectionFromInteraction,
    getQidahenInternalDispatchSelectionFromInteraction,
    getQidahenMaShiTradeSelectionFromInteraction,
    getQidahenKhanEdictSelectionFromInteraction,
    getQidahenDriveTigerConsentSelectionFromInteraction,
    getQidahenFortificationMaintenanceSelectionFromInteraction,
    getQidahenPendingTargetActionFromInteraction,
    getQidahenPostBattleSelectionFromInteraction,
    getQidahenWheelDispatchSelectionForCore,
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenPendingTargetActionForCore,
    getQidahenPostBattleSelectionForCore,
    type QidahenCasualtyPriority,
} from '../domain';
import {
    getQidahenHandLimitDiscardSelectionForCore,
    getQidahenRecruitSelectionForCore,
    getQidahenGrantPardonSelectionForCore,
    getQidahenDiplomacySelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
} from '../domain/interactionSelectionAccessors';
import {
    getQidahenRecruitSelectionForCore as getCoreQidahenRecruitSelectionForCore,
    getQidahenMaShiTradeSelectionForCore as getCoreQidahenMaShiTradeSelectionForCore,
} from '../domain/selectionBuilders';
import { isQidahenWheelDispatchPaymentPending } from '../domain/wheelDispatchPayment';
import { isQidahenGaoDiTargetSelectionActive } from './boardReadModel';
import { resolveQidahenOperationPrompt } from './operationPrompt';
import type { QidahenInspectTarget } from './QidahenInspectPanel';
import { type QidahenMapViewport, DEFAULT_QIDAHEN_MAP_VIEWPORT } from './mapViewport';

export function useQidahenChoiceState({ core, G, tutorialStep }: Props & ReturnType<typeof useQidahenRuntime>) {
    const scenarioVotePending = core.scenarioVote != null;

    const factionSelectionPending = core.factionSelection != null;

    const scenarioChoicesPending =
        core.pendingScenarioCharacterChoices.length > 0 || core.pendingScenarioArmamentChoices.length > 0;

    const setupStagePending = scenarioVotePending || factionSelectionPending || scenarioChoicesPending;

    const activeInteraction = G.sys.interaction?.current;

    const handLimitDiscardSelectionFromInteraction =
        getQidahenHandLimitDiscardSelectionFromInteraction(activeInteraction);

    const recruitSelectionFromInteraction = getQidahenRecruitSelectionFromInteraction(activeInteraction);

    const grantPardonSelectionFromInteraction = getQidahenGrantPardonSelectionFromInteraction(activeInteraction);

    const diplomacySelectionFromInteraction = getQidahenDiplomacySelectionFromInteraction(activeInteraction);

    const wheelDispatchSelectionFromInteraction = getQidahenWheelDispatchSelectionFromInteraction(activeInteraction);

    const internalDispatchSelectionFromInteraction =
        getQidahenInternalDispatchSelectionFromInteraction(activeInteraction);

    const maShiTradeSelectionFromInteraction = getQidahenMaShiTradeSelectionFromInteraction(activeInteraction);

    const khanEdictSelectionFromInteraction = getQidahenKhanEdictSelectionFromInteraction(activeInteraction);

    const driveTigerConsentSelectionFromInteraction =
        getQidahenDriveTigerConsentSelectionFromInteraction(activeInteraction);

    const fortificationMaintenanceSelectionFromInteraction =
        getQidahenFortificationMaintenanceSelectionFromInteraction(activeInteraction);

    const pendingTargetActionFromInteraction = getQidahenPendingTargetActionFromInteraction(activeInteraction);

    const postBattleSelectionFromInteraction = getQidahenPostBattleSelectionFromInteraction(activeInteraction);

    const handLimitDiscardSelection = getQidahenHandLimitDiscardSelectionForCore(core, activeInteraction);

    const recruitSelectionFromCore = getCoreQidahenRecruitSelectionForCore(core);

    const recruitSelectionFromMirror = getQidahenRecruitSelectionForCore(core, activeInteraction);

    const recruitSelection =
        core.explicitRegionId && recruitSelectionFromCore ? recruitSelectionFromCore : recruitSelectionFromMirror;

    const grantPardonSelection = getQidahenGrantPardonSelectionForCore(core, activeInteraction);

    const grantPardonMapChoices = React.useMemo(
        () => grantPardonSelection?.choices ?? [],
        [grantPardonSelection?.choices],
    );

    const diplomacySelection = getQidahenDiplomacySelectionForCore(core, activeInteraction);

    const wheelDispatchSelection = getQidahenWheelDispatchSelectionForCore(core, activeInteraction);

    const internalDispatchSelection = getQidahenInternalDispatchSelectionForCore(core, activeInteraction);

    const maShiTradeSelectionFromCore = getCoreQidahenMaShiTradeSelectionForCore(core);

    const maShiTradeSelectionFromMirror = getQidahenMaShiTradeSelectionForCore(core, activeInteraction);

    const maShiTradeSelection =
        core.explicitRegionId && maShiTradeSelectionFromCore
            ? maShiTradeSelectionFromCore
            : maShiTradeSelectionFromMirror;

    const khanEdictSelection = getQidahenKhanEdictSelectionForCore(core, activeInteraction);

    const driveTigerConsentSelection = getQidahenDriveTigerConsentSelectionForCore(core, activeInteraction);

    const fortificationMaintenanceSelection = getQidahenFortificationMaintenanceSelectionForCore(
        core,
        activeInteraction,
    );

    const pendingTargetAction = getQidahenPendingTargetActionForCore(core, activeInteraction);

    const postBattleSelection = getQidahenPostBattleSelectionForCore(core, activeInteraction);

    const [draftGaoDiChoiceId, setDraftGaoDiChoiceId] = React.useState<string | null>(null);

    const [draftInternalDispatchChoiceId, setDraftInternalDispatchChoiceId] = React.useState<string | null>(null);

    const draftGaoDiCandidate =
        core.gaoDiDispatchSelection?.candidates.find((candidate) => candidate.id === draftGaoDiChoiceId) ?? null;

    const draftInternalDispatchCandidate =
        internalDispatchSelection?.candidates.find((candidate) => candidate.id === draftInternalDispatchChoiceId) ??
        null;

    const draftMapCandidate = draftGaoDiCandidate ?? draftInternalDispatchCandidate;

    const draftMapSelectionActive = core.gaoDiDispatchSelection != null || internalDispatchSelection != null;

    const displayCore = React.useMemo(
        () => ({
            ...core,
            ...(draftMapSelectionActive
                ? {
                      ...(draftMapCandidate ? { selectedRegionId: draftMapCandidate.targetRegionId } : {}),
                      explicitRegionId: draftMapCandidate?.targetRegionId ?? null,
                  }
                : {}),
            internalDispatchSelection,
            grantPardonSelection,
            maShiTradeSelection,
            khanEdictSelection,
            driveTigerConsentSelection,
            pendingTargetAction,
        }),
        [
            core,
            draftMapCandidate,
            draftMapSelectionActive,
            driveTigerConsentSelection,
            grantPardonSelection,
            internalDispatchSelection,
            khanEdictSelection,
            maShiTradeSelection,
            pendingTargetAction,
        ],
    );

    const [pendingCommittedTroops, setPendingCommittedTroops] = React.useState<number | undefined>(
        pendingTargetAction?.committedTroops,
    );

    const [pendingAttackerCasualtyPriority, setPendingAttackerCasualtyPriority] =
        React.useState<QidahenCasualtyPriority>('highest-level');

    const [pendingDefenderCasualtyPriority, setPendingDefenderCasualtyPriority] =
        React.useState<QidahenCasualtyPriority>('highest-level');

    const [upkeepAttritionPriority, setUpkeepAttritionPriority] =
        React.useState<QidahenCasualtyPriority>('lowest-level');

    const wheelDispatchPaymentPending = isQidahenWheelDispatchPaymentPending(core);

    const actionPaymentPreviewVisible =
        wheelDispatchPaymentPending ||
        (core.turnPhase === 'action-window' &&
            !core.factionActionUsed &&
            core.confirmedActionId != null &&
            core.payment.required > 0);

    const gaoDiDiscardPending =
        core.gaoDiDispatchSelection != null && !isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);

    const handInteractionTrayVisible =
        actionPaymentPreviewVisible || handLimitDiscardSelection != null || core.sunYuanhuaTechSelection != null;

    const operationPrompt = resolveQidahenOperationPrompt({
        handInteractionTrayVisible,
        gaoDiDiscardPending,
    });

    const [detailInspectTarget, setDetailInspectTarget] = React.useState<QidahenInspectTarget | null>(null);

    const [mapViewport, setMapViewport] = React.useState<QidahenMapViewport>(DEFAULT_QIDAHEN_MAP_VIEWPORT);

    const mapViewportBeforeAutoFocusRef = React.useRef<QidahenMapViewport | null>(null);

    const activeAutoFocusKeyRef = React.useRef<string | null>(null);

    const [magnifyTarget, setMagnifyTarget] = React.useState<QidahenMagnifyTarget | null>(null);

    const [selectedHandLimitCardIds, setSelectedHandLimitCardIds] = React.useState<string[]>(
        handLimitDiscardSelection?.selectedCardIds ?? [],
    );

    const gaoDiSelectionKey = core.gaoDiDispatchSelection
        ? `${core.gaoDiDispatchSelection.sourceRegionId}:${core.gaoDiDispatchSelection.selectedCardId ?? ''}`
        : null;

    const internalDispatchSelectionKey = internalDispatchSelection
        ? `${internalDispatchSelection.sourceRegionId}:${internalDispatchSelection.candidates.map((candidate) => candidate.id).join('|')}`
        : null;

    const factionStageSelectionActive =
        core.gaoDiDispatchSelection != null ||
        internalDispatchSelection != null ||
        recruitSelection != null ||
        grantPardonSelection != null ||
        maShiTradeSelection != null ||
        khanEdictSelection != null ||
        diplomacySelection != null ||
        driveTigerConsentSelection != null ||
        fortificationMaintenanceSelection != null ||
        handLimitDiscardSelection != null;

    const wheelStageSelectionActive =
        wheelDispatchSelection != null || pendingTargetAction != null || postBattleSelection != null;

    const factionStageAvailable =
        !setupStagePending && !core.factionActionUsed && !factionStageSelectionActive && !wheelStageSelectionActive;

    const wheelStageAvailable =
        !setupStagePending &&
        !core.wheelActionUsed &&
        !factionStageSelectionActive &&
        !wheelStageSelectionActive &&
        core.wheelMoveChoices.length > 0;

    const wheelStageEmphasized = wheelStageAvailable && tutorialStep?.id !== 'welcome';

    const tutorialPrimaryWheelMoveId = tutorialStep?.highlightTarget?.startsWith('qidahen-wheel-move-')
        ? tutorialStep.highlightTarget.slice('qidahen-wheel-move-'.length)
        : tutorialStep?.id === 'wheel-move'
          ? 'move-1-free'
          : null;

    const tutorialInfoStepActive = tutorialStep?.infoStep === true;

    const tutorialShowsSeasonSummary = tutorialStep?.highlightTarget === 'qidahen-season-summary';

    const tutorialPrefersWheelStage = tutorialStep?.id === 'wheel-first' || tutorialStep?.id === 'wheel-move';

    const primaryStageMode: QidahenPrimaryStageMode | null = wheelStageSelectionActive
        ? 'wheel'
        : factionStageSelectionActive
          ? 'faction'
          : tutorialPrefersWheelStage && wheelStageAvailable
            ? 'wheel'
            : factionStageAvailable
              ? 'faction'
              : wheelStageAvailable
                ? 'wheel'
                : null;

    const activeHandLimitInteractionId = handLimitDiscardSelectionFromInteraction
        ? (activeInteraction?.id ?? null)
        : null;

    const activeRecruitInteractionId = recruitSelectionFromInteraction ? (activeInteraction?.id ?? null) : null;

    const activeGrantPardonInteractionId = grantPardonSelectionFromInteraction ? (activeInteraction?.id ?? null) : null;

    const activeDiplomacyInteractionId = diplomacySelectionFromInteraction ? (activeInteraction?.id ?? null) : null;

    const activeWheelDispatchInteractionId = wheelDispatchSelectionFromInteraction
        ? (activeInteraction?.id ?? null)
        : null;

    const activeInternalDispatchInteractionId = internalDispatchSelectionFromInteraction
        ? (activeInteraction?.id ?? null)
        : null;

    const activeMaShiTradeInteractionId = maShiTradeSelectionFromInteraction ? (activeInteraction?.id ?? null) : null;

    const activeKhanEdictInteractionId = khanEdictSelectionFromInteraction ? (activeInteraction?.id ?? null) : null;

    const activeDriveTigerConsentInteractionId = driveTigerConsentSelectionFromInteraction
        ? (activeInteraction?.id ?? null)
        : null;

    const activeFortificationMaintenanceInteractionId = fortificationMaintenanceSelectionFromInteraction
        ? (activeInteraction?.id ?? null)
        : null;

    const activePendingTargetInteractionId = pendingTargetActionFromInteraction
        ? (activeInteraction?.id ?? null)
        : null;

    const activePostBattleInteractionId = postBattleSelectionFromInteraction ? (activeInteraction?.id ?? null) : null;

    React.useEffect(() => {
        setPendingCommittedTroops(pendingTargetAction?.committedTroops);
        setPendingAttackerCasualtyPriority('highest-level');
        setPendingDefenderCasualtyPriority('highest-level');
    }, [
        pendingTargetAction?.actionId,
        pendingTargetAction?.sourceRegionId,
        pendingTargetAction?.targetRuntimeRegionId,
        pendingTargetAction?.committedTroops,
    ]);

    React.useEffect(() => {
        setSelectedHandLimitCardIds(handLimitDiscardSelection?.selectedCardIds ?? []);
    }, [activeHandLimitInteractionId, handLimitDiscardSelection]);

    React.useEffect(() => {
        setDraftGaoDiChoiceId(null);
    }, [gaoDiSelectionKey]);

    React.useEffect(() => {
        setDraftInternalDispatchChoiceId(null);
    }, [internalDispatchSelectionKey]);
    return {
        scenarioVotePending,
        factionSelectionPending,
        scenarioChoicesPending,
        setupStagePending,
        handLimitDiscardSelection,
        recruitSelection,
        grantPardonSelection,
        grantPardonMapChoices,
        diplomacySelection,
        wheelDispatchSelection,
        internalDispatchSelection,
        maShiTradeSelection,
        khanEdictSelection,
        driveTigerConsentSelection,
        fortificationMaintenanceSelection,
        pendingTargetAction,
        postBattleSelection,
        draftGaoDiChoiceId,
        setDraftGaoDiChoiceId,
        draftInternalDispatchChoiceId,
        setDraftInternalDispatchChoiceId,
        displayCore,
        pendingCommittedTroops,
        setPendingCommittedTroops,
        pendingAttackerCasualtyPriority,
        setPendingAttackerCasualtyPriority,
        pendingDefenderCasualtyPriority,
        setPendingDefenderCasualtyPriority,
        upkeepAttritionPriority,
        setUpkeepAttritionPriority,
        wheelDispatchPaymentPending,
        actionPaymentPreviewVisible,
        operationPrompt,
        detailInspectTarget,
        setDetailInspectTarget,
        mapViewport,
        setMapViewport,
        mapViewportBeforeAutoFocusRef,
        activeAutoFocusKeyRef,
        magnifyTarget,
        setMagnifyTarget,
        selectedHandLimitCardIds,
        setSelectedHandLimitCardIds,
        factionStageAvailable,
        wheelStageEmphasized,
        tutorialPrimaryWheelMoveId,
        tutorialInfoStepActive,
        tutorialShowsSeasonSummary,
        primaryStageMode,
        activeHandLimitInteractionId,
        activeRecruitInteractionId,
        activeGrantPardonInteractionId,
        activeDiplomacyInteractionId,
        activeWheelDispatchInteractionId,
        activeInternalDispatchInteractionId,
        activeMaShiTradeInteractionId,
        activeKhanEdictInteractionId,
        activeDriveTigerConsentInteractionId,
        activeFortificationMaintenanceInteractionId,
        activePendingTargetInteractionId,
        activePostBattleInteractionId,
    };
}
