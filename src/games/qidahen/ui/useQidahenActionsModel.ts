import React from 'react';
import type { QidahenCore, QidahenHandLimitDiscardSelection, QidahenInternalDispatchSelection, QidahenGrantPardonSelection, QidahenDiplomacySelection, QidahenDriveTigerConsentSelection, QidahenFortificationMaintenanceSelection, QidahenWheelDispatchSelection, QidahenRecruitChoice, QidahenGrantPardonChoice, QidahenCasualtyPriority } from '../domain';
import type { QidahenPrimaryStageMode } from './boardTypes';
import type { QidahenPendingTargetChoiceValue } from '../domain/interactionContracts';
import { useTranslation } from 'react-i18next';
import { buildPendingTargetChoiceOptions } from '../domain/pendingTargetChoiceOptions';
import { getQidahenForegroundActionChoice, getQidahenDirectHandActionIdsForFaction } from './boardReadModel';
import { getCurrentFactionId } from '../domain/factionTurnAccessors';
import { resolveQidahenPrimaryRuntimeRegionId } from '../domain/regionConfig';

export type ActionsZoneProps = {
    core: QidahenCore;
    primaryStageMode: QidahenPrimaryStageMode | null;
    isTutorialActive: boolean;
    tutorialInfoStepActive: boolean;
    tutorialHighlightsSeasonSummary: boolean;
    actionPaymentPreviewVisible: boolean;
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null;
    internalDispatchSelection: QidahenInternalDispatchSelection | null;
    recruitSelection: QidahenCore['recruitSelection'];
    grantPardonSelection: QidahenGrantPardonSelection | null;
    maShiTradeSelection: QidahenCore['maShiTradeSelection'];
    khanEdictSelection: QidahenCore['khanEdictSelection'];
    diplomacySelection: QidahenDiplomacySelection | null;
    driveTigerConsentSelection: QidahenDriveTigerConsentSelection | null;
    fortificationMaintenanceSelection: QidahenFortificationMaintenanceSelection | null;
    wheelDispatchSelection: QidahenWheelDispatchSelection | null;
    pendingTargetAction: QidahenCore['pendingTargetAction'];
    postBattleSelection: QidahenCore['postBattleSelection'];
    onExecuteAction: (actionId: string) => void;
    onSelectRegion: (regionId: string) => void;
    onResolveRecruitChoice: (choiceId: QidahenRecruitChoice['id']) => void;
    onResolveGrantPardonChoice: (choiceId: QidahenGrantPardonChoice['id']) => void;
    selectedGaoDiChoiceId: string | null;
    onResolveGaoDiDispatch: (choiceId: string) => void;
    selectedInternalDispatchChoiceId: string | null;
    onResolveInternalDispatch: (choiceId: string) => void;
    onClearInternalDispatchChoice: () => void;
    onResolveMaShiTradeChoice: (troopCount: 1 | 2 | 3) => void;
    onResolveKhanEdictChoice: (choiceId: 'recruit-train' | 'hire-dispatch') => void;
    onResolveDiplomacyChoice: (choiceId: 'hire-only' | 'place-friendly' | 'flip-vassal' | 'remove-marker') => void;
    onResolveDriveTigerConsent: (choiceId: 'accept' | 'decline') => void;
    onResolveFortificationMaintenance: (
        choiceId: 'auto-pay' | 'skip-all',
        attritionPriority: QidahenCasualtyPriority,
    ) => void;
    upkeepAttritionPriority: QidahenCasualtyPriority;
    onSelectUpkeepAttritionPriority: (priority: QidahenCasualtyPriority) => void;
    pendingCommittedTroops?: number;
    onSelectPendingCommittedTroops: (committedTroops: number) => void;
    pendingAttackerCasualtyPriority: QidahenCasualtyPriority;
    pendingDefenderCasualtyPriority: QidahenCasualtyPriority;
    onSelectPendingAttackerCasualtyPriority: (priority: QidahenCasualtyPriority) => void;
    onSelectPendingDefenderCasualtyPriority: (priority: QidahenCasualtyPriority) => void;
    onResolvePendingAction: (
        choiceValue: QidahenPendingTargetChoiceValue,
        attackerCasualtyPriority?: QidahenCasualtyPriority,
        defenderCasualtyPriority?: QidahenCasualtyPriority,
        committedTroops?: number,
    ) => void;
    onResolvePincerAdvance: () => void;
    onCancelPincerAdvance: () => void;
    onResolveInfantryCavalryCombined: (mode: 'withdraw-cavalry' | 'joint-attack') => void;
    onCancelInstigateDefection: () => void;
    onSetWuzhenChaohaArtilleryTechCount: (count: number) => void;
    onCancelWuzhenChaoha: () => void;
    onResolvePostBattleDecision: (choiceId: string) => void;
    isTutorialCommandAllowed?: (commandType: string) => boolean;
};

export function useQidahenActionsModel({
    core,
    primaryStageMode,
    isTutorialActive,
    tutorialInfoStepActive,
    tutorialHighlightsSeasonSummary,
    actionPaymentPreviewVisible,
    handLimitDiscardSelection,
    internalDispatchSelection,
    recruitSelection,
    grantPardonSelection,
    maShiTradeSelection,
    khanEdictSelection,
    diplomacySelection,
    driveTigerConsentSelection,
    fortificationMaintenanceSelection,
    wheelDispatchSelection,
    pendingTargetAction,
    postBattleSelection,
    onExecuteAction,
    onSelectRegion,
    onResolveRecruitChoice,
    onResolveGrantPardonChoice,
    selectedGaoDiChoiceId,
    onResolveGaoDiDispatch,
    selectedInternalDispatchChoiceId,
    onResolveInternalDispatch,
    onClearInternalDispatchChoice,
    onResolveMaShiTradeChoice,
    onResolveKhanEdictChoice,
    onResolveDiplomacyChoice,
    onResolveDriveTigerConsent,
    onResolveFortificationMaintenance,
    upkeepAttritionPriority,
    onSelectUpkeepAttritionPriority,
    pendingCommittedTroops,
    onSelectPendingCommittedTroops,
    pendingAttackerCasualtyPriority,
    pendingDefenderCasualtyPriority,
    onSelectPendingAttackerCasualtyPriority,
    onSelectPendingDefenderCasualtyPriority,
    onResolvePendingAction,
    onResolvePincerAdvance,
    onCancelPincerAdvance,
    onResolveInfantryCavalryCombined,
    onCancelInstigateDefection,
    onSetWuzhenChaohaArtilleryTechCount,
    onCancelWuzhenChaoha,
    onResolvePostBattleDecision,
    isTutorialCommandAllowed,
}: ActionsZoneProps) {
    const { t } = useTranslation('game-qidahen');
    const { t: tCommon } = useTranslation('common');
    const actionSlotRef = React.useRef<HTMLDivElement>(null);
    const grantPardonExecutorFactionId = grantPardonSelection?.executorFactionId ?? 'ming';
    const grantPardonExecutorFactionName = grantPardonSelection
        ? tCommon(`qidahenBoard.factions.${grantPardonExecutorFactionId}`, {
              defaultValue: core.factions[grantPardonExecutorFactionId].name,
          })
        : '';
    const grantPardonNeedsOpponent =
        grantPardonSelection?.targetRegionId != null && grantPardonSelection.opponentFactionId == null;
    const grantPardonHasMapTargets = Boolean(grantPardonSelection?.choices.length) && !grantPardonNeedsOpponent;
    const grantPardonOpponentChoices = grantPardonSelection
        ? Array.from(new Map(grantPardonSelection.choices.map((choice) => [choice.sourceFactionId, choice])).values())
        : [];
    const pendingTargetChoiceOptions = pendingTargetAction
        ? buildPendingTargetChoiceOptions(core, pendingTargetAction)
        : [];
    const pendingScenarioChoices =
        core.scenarioVote != null ||
        core.pendingScenarioCharacterChoices.length > 0 ||
        core.pendingScenarioArmamentChoices.length > 0;
    const selectedAction = getQidahenForegroundActionChoice(core, {
        actionPaymentPreviewVisible,
        recruitSelection,
        grantPardonSelection,
        maShiTradeSelection,
        khanEdictSelection,
        driveTigerConsentSelection,
    });
    const selectedGaoDiCandidate =
        core.gaoDiDispatchSelection?.candidates.find((candidate) => candidate.id === selectedGaoDiChoiceId) ?? null;
    const selectedInternalDispatchCandidate =
        internalDispatchSelection?.candidates.find((candidate) => candidate.id === selectedInternalDispatchChoiceId) ??
        null;
    const postBattleSelectionKey = postBattleSelection
        ? `${postBattleSelection.actionId}:${postBattleSelection.targetRuntimeRegionId}`
        : null;
    const [postBattleMode, setPostBattleMode] = React.useState<
        NonNullable<QidahenCore['postBattleSelection']>['choices'][number]['mode'] | null
    >(null);
    const [draftPostBattleChoiceId, setDraftPostBattleChoiceId] = React.useState<string | null>(null);
    const postBattleModeChoices = postBattleMode
        ? (postBattleSelection?.choices.filter((choice) => choice.mode === postBattleMode) ?? [])
        : [];
    const draftPostBattleChoice =
        postBattleSelection?.choices.find((choice) => choice.id === draftPostBattleChoiceId) ?? null;

    React.useEffect(() => {
        setPostBattleMode(null);
        setDraftPostBattleChoiceId(null);
    }, [postBattleSelectionKey]);
    const factionStageActiveSelection =
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
    const wheelStageActiveSelection =
        wheelDispatchSelection != null || pendingTargetAction != null || postBattleSelection != null;
    const engagedActionId = core.confirmedActionId;
    const wheelMoveChoiceSurfaceActive =
        !pendingScenarioChoices &&
        !tutorialInfoStepActive &&
        primaryStageMode === 'wheel' &&
        !core.wheelActionUsed &&
        !factionStageActiveSelection &&
        !wheelStageActiveSelection &&
        core.wheelMoveChoices.length > 0;
    const suppressPassiveActionContext =
        actionPaymentPreviewVisible ||
        wheelMoveChoiceSurfaceActive ||
        factionStageActiveSelection ||
        wheelStageActiveSelection ||
        wheelDispatchSelection != null ||
        pendingTargetAction != null ||
        postBattleSelection != null;
    const showFortificationStrip = !suppressPassiveActionContext && core.turnPhase !== 'action-window';
    const showActionRail = !pendingScenarioChoices && !suppressPassiveActionContext && primaryStageMode === 'faction';
    const directHandActionIds = getQidahenDirectHandActionIdsForFaction(core, getCurrentFactionId(core));
    const visibleActionChoices = core.actionChoices.filter((action) => !directHandActionIds.has(action.id));
    const seasonSummaryLines = tutorialHighlightsSeasonSummary
        ? (core.lastSeasonSummary?.lines ?? [])
        : (core.lastSeasonSummary?.lines.slice(0, 5) ?? []);
    const hideWheelRecruitTrainSummary = isTutorialActive && core.lastSeasonSummary?.title === '轮盘征兵/训练';
    const explicitSelectedRuntimeRegionId = core.explicitRegionId
        ? resolveQidahenPrimaryRuntimeRegionId(core.explicitRegionId)
        : null;
    const recruitRegionExplicitlySelected =
        recruitSelection != null && explicitSelectedRuntimeRegionId === recruitSelection.targetRegionId;
    const maShiTradeRegionExplicitlySelected =
        maShiTradeSelection != null && explicitSelectedRuntimeRegionId === maShiTradeSelection.targetRegionId;
    const actionSurfaceKey = handLimitDiscardSelection
        ? 'hand-limit-discard'
        : internalDispatchSelection
          ? 'internal-dispatch'
          : recruitSelection
            ? 'recruit'
            : grantPardonSelection
              ? 'grant-pardon'
              : maShiTradeSelection
                ? 'ma-shi-trade'
                : khanEdictSelection
                  ? 'khan-edict'
                  : diplomacySelection
                    ? 'diplomacy'
                    : driveTigerConsentSelection
                      ? 'drive-tiger-consent'
                      : fortificationMaintenanceSelection
                        ? 'fortification-maintenance'
                        : wheelDispatchSelection
                          ? 'wheel-dispatch'
                          : pendingTargetAction
                            ? `pending:${pendingTargetAction.actionId}`
                            : postBattleSelection
                              ? `post-battle:${postBattleSelection.actionId}`
                              : primaryStageMode
                                ? `primary-stage:${primaryStageMode}`
                                : selectedAction
                                  ? `action-rail:${selectedAction.id}`
                                  : 'action-rail:none';

    React.useEffect(() => {
        if (actionSlotRef.current) {
            actionSlotRef.current.scrollTop = 0;
        }
    }, [actionSurfaceKey]);
    return {
        suppressPassiveActionContext,
        actionSlotRef,
        core,
        t,
        showFortificationStrip,
        hideWheelRecruitTrainSummary,
        isTutorialActive,
        tutorialHighlightsSeasonSummary,
        tutorialInfoStepActive,
        seasonSummaryLines,
        fortificationMaintenanceSelection,
        upkeepAttritionPriority,
        onSelectUpkeepAttritionPriority,
        onResolveFortificationMaintenance,
        selectedGaoDiCandidate,
        onResolveGaoDiDispatch,
        internalDispatchSelection,
        selectedInternalDispatchCandidate,
        onResolveInternalDispatch,
        onClearInternalDispatchChoice,
        recruitSelection,
        recruitRegionExplicitlySelected,
        onResolveRecruitChoice,
        grantPardonSelection,
        grantPardonExecutorFactionName,
        grantPardonNeedsOpponent,
        tCommon,
        grantPardonOpponentChoices,
        onResolveGrantPardonChoice,
        grantPardonHasMapTargets,
        maShiTradeSelection,
        maShiTradeRegionExplicitlySelected,
        onResolveMaShiTradeChoice,
        khanEdictSelection,
        onResolveKhanEdictChoice,
        diplomacySelection,
        onSelectRegion,
        onResolveDiplomacyChoice,
        driveTigerConsentSelection,
        onResolveDriveTigerConsent,
        wheelDispatchSelection,
        pendingTargetAction,
        onSelectPendingCommittedTroops,
        pendingAttackerCasualtyPriority,
        onSelectPendingAttackerCasualtyPriority,
        pendingDefenderCasualtyPriority,
        onSelectPendingDefenderCasualtyPriority,
        onSetWuzhenChaohaArtilleryTechCount,
        onCancelWuzhenChaoha,
        onCancelInstigateDefection,
        onResolvePincerAdvance,
        onCancelPincerAdvance,
        onResolveInfantryCavalryCombined,
        pendingTargetChoiceOptions,
        onResolvePendingAction,
        pendingCommittedTroops,
        postBattleSelection,
        postBattleMode,
        setPostBattleMode,
        setDraftPostBattleChoiceId,
        postBattleModeChoices,
        draftPostBattleChoiceId,
        draftPostBattleChoice,
        onResolvePostBattleDecision,
        showActionRail,
        visibleActionChoices,
        engagedActionId,
        pendingScenarioChoices,
        isTutorialCommandAllowed,
        onExecuteAction,
    };
}
