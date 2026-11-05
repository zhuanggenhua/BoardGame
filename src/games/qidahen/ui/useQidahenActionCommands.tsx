import React from 'react';
import type { Props } from './boardTypes';
import { useQidahenRuntime } from './useQidahenRuntime';
import { useQidahenChoiceState } from './useQidahenChoiceState';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import type { QidahenScenarioId, QidahenFactionId, QidahenHandCard, QidahenCasualtyPriority, QidahenRecruitChoice, QidahenGrantPardonChoice, QidahenCore } from '../domain';
import { getQidahenDirectActionIdForHandCard } from '../domain/handCardIdentity';
import type { QidahenPendingTargetChoiceValue } from '../domain/interactionContracts';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { GameDebugPanel } from '../../../components/game/framework/widgets/GameDebugPanel';
import { QIDAHEN_MANIFEST } from '../manifest';
import { QidahenDebugConfig } from '../debug-config';
import { isQidahenDefeatInDetailOrderSelectionActive } from '../domain/defeatInDetail';
import { isQidahenGaoDiTargetSelectionActive } from './boardReadModel';
import { resolveQidahenPrimaryRuntimeRegionId } from '../domain/regionConfig';

export function useQidahenActionCommands({
    isTutorialCommandAllowed,
    dispatch,
    core,
    actionPaymentPreviewVisible,
    factionStageAvailable,
    activePendingTargetInteractionId,
    pendingTargetAction,
    runtimeDispatch,
    activeRecruitInteractionId,
    recruitSelection,
    activeGrantPardonInteractionId,
    grantPardonSelection,
    internalDispatchSelection,
    activeInternalDispatchInteractionId,
    activeKhanEdictInteractionId,
    khanEdictSelection,
    activeDiplomacyInteractionId,
    diplomacySelection,
    activeMaShiTradeInteractionId,
    maShiTradeSelection,
    activeDriveTigerConsentInteractionId,
    driveTigerConsentSelection,
    fortificationMaintenanceSelection,
    activeFortificationMaintenanceInteractionId,
    handLimitDiscardSelection,
    setSelectedHandLimitCardIds,
    activeHandLimitInteractionId,
    selectedHandLimitCardIds,
    activePostBattleInteractionId,
    postBattleSelection,
    activeWheelDispatchInteractionId,
    wheelDispatchSelection,
    pendingCommittedTroops,
    setupStagePending,
    wheelDispatchPaymentPending,
    G,
    playerID,
    setDraftGaoDiChoiceId,
    setDraftInternalDispatchChoiceId,
    grantPardonMapChoices,
}: Props & ReturnType<typeof useQidahenRuntime> & ReturnType<typeof useQidahenChoiceState>) {
    const selectWheelMove = React.useCallback(
        (moveId: string) => {
            if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE)) {
                return;
            }
            dispatch(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, { moveId });
        },
        [dispatch, isTutorialCommandAllowed],
    );

    const executeWheelMove = React.useCallback(
        (moveId: string) => {
            if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE)) {
                return;
            }
            dispatch(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE, { moveId });
        },
        [dispatch, isTutorialCommandAllowed],
    );

    const castScenarioVote = React.useCallback(
        (scenarioId: QidahenScenarioId | null) => {
            dispatch(QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE, { scenarioId });
        },
        [dispatch],
    );

    const selectFaction = React.useCallback(
        (factionId: QidahenFactionId) => {
            dispatch(QIDAHEN_COMMANDS.SELECT_FACTION, { factionId });
        },
        [dispatch],
    );

    const previewAction = React.useCallback(
        (actionId: string, sourceHandCardId?: string) => {
            if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION)) {
                return;
            }
            dispatch(QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION, {
                actionId,
                ...(sourceHandCardId ? { sourceHandCardId } : {}),
            });
        },
        [dispatch, isTutorialCommandAllowed],
    );

    const cancelActionPaymentPreview = React.useCallback(() => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.CANCEL_PREVIEW_ACTION)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.CANCEL_PREVIEW_ACTION, {});
    }, [dispatch, isTutorialCommandAllowed]);

    const confirmSelectedAction = React.useCallback(() => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION, {});
    }, [dispatch, isTutorialCommandAllowed]);

    const executeAction = React.useCallback(
        (actionId: string) => {
            const action = core.actionChoices.find((choice) => choice.id === actionId);
            if (!action) {
                return;
            }
            if (action.cost > 0) {
                if (actionPaymentPreviewVisible && core.selectedActionId === actionId) {
                    return;
                }
                previewAction(actionId);
                return;
            }
            if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_ACTION)) {
                return;
            }
            dispatch(QIDAHEN_COMMANDS.EXECUTE_ACTION, { actionId });
        },
        [
            actionPaymentPreviewVisible,
            core.actionChoices,
            core.selectedActionId,
            dispatch,
            isTutorialCommandAllowed,
            previewAction,
        ],
    );

    const togglePaymentCard = React.useCallback(
        (cardId: string) => {
            if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD)) {
                return;
            }
            dispatch(QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, { cardId });
        },
        [dispatch, isTutorialCommandAllowed],
    );

    const confirmWheelDispatchPayment = React.useCallback(() => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.CONFIRM_WHEEL_DISPATCH_PAYMENT)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.CONFIRM_WHEEL_DISPATCH_PAYMENT, {});
    }, [dispatch, isTutorialCommandAllowed]);

    const playTacticCard = React.useCallback(
        (cardId: string) => {
            if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.PLAY_TACTIC_CARD)) {
                return;
            }
            dispatch(QIDAHEN_COMMANDS.PLAY_TACTIC_CARD, { cardId });
        },
        [dispatch, isTutorialCommandAllowed],
    );

    const playBattleResponseEventCard = React.useCallback(
        (cardId: string) => {
            if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD)) {
                return;
            }
            dispatch(QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD, { cardId });
        },
        [dispatch, isTutorialCommandAllowed],
    );

    const togglePincerAdvanceTroop = React.useCallback(
        (choiceId: string) => {
            dispatch(QIDAHEN_COMMANDS.TOGGLE_PINCER_ADVANCE_TROOP, { choiceId });
        },
        [dispatch],
    );

    const resolvePincerAdvance = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_PINCER_ADVANCE, {});
    }, [dispatch]);

    const cancelPincerAdvance = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.CANCEL_PINCER_ADVANCE, {});
    }, [dispatch]);

    const resolveInfantryCavalryCombined = React.useCallback(
        (mode: 'withdraw-cavalry' | 'joint-attack') => {
            dispatch(QIDAHEN_COMMANDS.RESOLVE_INFANTRY_CAVALRY_COMBINED, { mode });
        },
        [dispatch],
    );

    const resolveInstigateDefection = React.useCallback(
        (choiceId: string) => {
            dispatch(QIDAHEN_COMMANDS.RESOLVE_INSTIGATE_DEFECTION, { choiceId });
        },
        [dispatch],
    );

    const cancelInstigateDefection = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.CANCEL_INSTIGATE_DEFECTION, {});
    }, [dispatch]);

    const setWuzhenChaohaArtilleryTechCount = React.useCallback(
        (count: number) => {
            dispatch(QIDAHEN_COMMANDS.SET_WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT, { count });
        },
        [dispatch],
    );

    const resolveWuzhenChaoha = React.useCallback(
        (choiceId: string) => {
            dispatch(QIDAHEN_COMMANDS.RESOLVE_WUZHEN_CHAOHA, { choiceId });
        },
        [dispatch],
    );

    const cancelWuzhenChaoha = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.CANCEL_WUZHEN_CHAOHA, {});
    }, [dispatch]);

    const previewActionFromHandCard = React.useCallback(
        (card: QidahenHandCard) => {
            const actionId = getQidahenDirectActionIdForHandCard(card);
            if (!actionId || !factionStageAvailable || actionPaymentPreviewVisible || card.status === 'disabled') {
                return;
            }
            previewAction(actionId, card.id);
        },
        [actionPaymentPreviewVisible, factionStageAvailable, previewAction],
    );

    const resolvePendingAction = React.useCallback(
        (
            choiceValue: QidahenPendingTargetChoiceValue,
            attackerCasualtyPriority?: QidahenCasualtyPriority,
            defenderCasualtyPriority?: QidahenCasualtyPriority,
            committedTroops?: number,
        ) => {
            const { choiceId, ...choicePayload } = choiceValue;
            const interactionMergedValue = {
                ...(committedTroops != null ? { committedTroops } : {}),
                ...(attackerCasualtyPriority ? { attackerCasualtyPriority } : {}),
                ...(defenderCasualtyPriority ? { defenderCasualtyPriority } : {}),
            };
            const legacyPayload = {
                ...choicePayload,
                ...interactionMergedValue,
            };
            if (activePendingTargetInteractionId && pendingTargetAction) {
                runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                    interactionId: activePendingTargetInteractionId,
                    optionId: choiceId,
                    ...(Object.keys(interactionMergedValue).length > 0 ? { mergedValue: interactionMergedValue } : {}),
                });
                return;
            }
            dispatch(
                QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
                Object.keys(legacyPayload).length > 0 ? legacyPayload : {},
            );
        },
        [activePendingTargetInteractionId, dispatch, pendingTargetAction, runtimeDispatch],
    );

    const resolveRecruitChoice = React.useCallback(
        (choiceId: QidahenRecruitChoice['id']) => {
            if (!activeRecruitInteractionId || !recruitSelection) {
                return;
            }
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activeRecruitInteractionId,
                optionId: choiceId,
                mergedValue: { qidahenRecruitSelection: recruitSelection },
            });
        },
        [activeRecruitInteractionId, recruitSelection, runtimeDispatch],
    );

    const resolveGrantPardonChoice = React.useCallback(
        (choiceId: QidahenGrantPardonChoice['id']) => {
            if (!activeGrantPardonInteractionId || !grantPardonSelection) {
                return;
            }
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activeGrantPardonInteractionId,
                optionId: choiceId,
                mergedValue: { qidahenGrantPardonSelection: grantPardonSelection },
            });
        },
        [activeGrantPardonInteractionId, grantPardonSelection, runtimeDispatch],
    );

    const selectGaoDiDispatchCard = React.useCallback(
        (cardId: string) => {
            dispatch(QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD, { cardId });
        },
        [dispatch],
    );

    const selectSunYuanhuaTechCard = React.useCallback(
        (cardId: string) => {
            dispatch(QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD, { cardId });
        },
        [dispatch],
    );

    const resolveGaoDiDispatch = React.useCallback(
        (choiceId: string) => {
            dispatch(QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH, { choiceId });
        },
        [dispatch],
    );

    const resolveSunYuanhuaTech = React.useCallback(
        (choiceId: 'confirm' | 'skip') => {
            dispatch(QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH, { choiceId });
        },
        [dispatch],
    );

    const resolveInternalDispatch = React.useCallback(
        (choiceId: string) => {
            if (!internalDispatchSelection) {
                return;
            }
            if (activeInternalDispatchInteractionId) {
                runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                    interactionId: activeInternalDispatchInteractionId,
                    optionId: choiceId,
                    mergedValue: { qidahenInternalDispatchSelection: internalDispatchSelection },
                });
            }
        },
        [activeInternalDispatchInteractionId, internalDispatchSelection, runtimeDispatch],
    );

    const resolveKhanEdictChoice = React.useCallback(
        (choiceId: 'recruit-train' | 'hire-dispatch') => {
            if (!activeKhanEdictInteractionId || !khanEdictSelection) {
                return;
            }
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activeKhanEdictInteractionId,
                optionId: choiceId,
                mergedValue: { qidahenKhanEdictSelection: khanEdictSelection },
            });
        },
        [activeKhanEdictInteractionId, khanEdictSelection, runtimeDispatch],
    );

    const resolveDiplomacyChoice = React.useCallback(
        (choiceId: 'hire-only' | 'place-friendly' | 'flip-vassal' | 'remove-marker') => {
            if (!activeDiplomacyInteractionId || !diplomacySelection) {
                return;
            }
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activeDiplomacyInteractionId,
                optionId: choiceId,
                mergedValue: { qidahenDiplomacySelection: diplomacySelection },
            });
        },
        [activeDiplomacyInteractionId, diplomacySelection, runtimeDispatch],
    );

    const resolveMaShiTradeChoice = React.useCallback(
        (troopCount: 1 | 2 | 3) => {
            if (!activeMaShiTradeInteractionId || !maShiTradeSelection) {
                return;
            }
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activeMaShiTradeInteractionId,
                optionId: String(troopCount),
                mergedValue: { qidahenMaShiTradeSelection: maShiTradeSelection },
            });
        },
        [activeMaShiTradeInteractionId, maShiTradeSelection, runtimeDispatch],
    );

    const resolveDriveTigerConsent = React.useCallback(
        (choiceId: 'accept' | 'decline') => {
            if (!activeDriveTigerConsentInteractionId || !driveTigerConsentSelection) {
                return;
            }
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activeDriveTigerConsentInteractionId,
                optionId: choiceId,
                mergedValue: { qidahenDriveTigerConsentSelection: driveTigerConsentSelection },
            });
        },
        [activeDriveTigerConsentInteractionId, driveTigerConsentSelection, runtimeDispatch],
    );

    const resolveFortificationMaintenance = React.useCallback(
        (choiceId: 'auto-pay' | 'skip-all', attritionPriority: QidahenCasualtyPriority) => {
            if (!fortificationMaintenanceSelection) {
                return;
            }
            if (activeFortificationMaintenanceInteractionId) {
                runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                    interactionId: activeFortificationMaintenanceInteractionId,
                    optionId: choiceId,
                    mergedValue: { attritionPriority },
                });
                return;
            }
            dispatch(QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE, {
                choiceId,
                attritionPriority,
            });
        },
        [activeFortificationMaintenanceInteractionId, dispatch, fortificationMaintenanceSelection, runtimeDispatch],
    );

    const toggleHandLimitDiscardCard = React.useCallback(
        (cardId: string) => {
            if (!handLimitDiscardSelection || !handLimitDiscardSelection.candidateCardIds.includes(cardId)) {
                return;
            }
            setSelectedHandLimitCardIds((currentSelectedCardIds) => {
                if (currentSelectedCardIds.includes(cardId)) {
                    return currentSelectedCardIds.filter((selectedCardId) => selectedCardId !== cardId);
                }
                if (currentSelectedCardIds.length >= handLimitDiscardSelection.requiredDiscardCount) {
                    return currentSelectedCardIds;
                }
                return [...currentSelectedCardIds, cardId];
            });
        },
        [handLimitDiscardSelection],
    );

    const resolveHandLimitDiscard = React.useCallback(() => {
        if (activeHandLimitInteractionId && handLimitDiscardSelection) {
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activeHandLimitInteractionId,
                optionIds: selectedHandLimitCardIds,
            });
            return;
        }
        dispatch(QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD, {});
    }, [activeHandLimitInteractionId, dispatch, handLimitDiscardSelection, runtimeDispatch, selectedHandLimitCardIds]);

    const resolvePostBattleDecision = React.useCallback(
        (choiceId: string) => {
            if (!activePostBattleInteractionId || !postBattleSelection) {
                return;
            }
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activePostBattleInteractionId,
                optionId: choiceId,
            });
        },
        [activePostBattleInteractionId, postBattleSelection, runtimeDispatch],
    );

    const resolveWheelDispatchChoice = React.useCallback(
        (choiceId: string) => {
            if (!activeWheelDispatchInteractionId || !wheelDispatchSelection) {
                return;
            }
            runtimeDispatch(INTERACTION_COMMANDS.RESPOND, {
                interactionId: activeWheelDispatchInteractionId,
                optionId: choiceId,
                mergedValue: {
                    qidahenWheelDispatchSelection: wheelDispatchSelection,
                    ...(pendingCommittedTroops != null ? { committedTroops: pendingCommittedTroops } : {}),
                },
            });
        },
        [activeWheelDispatchInteractionId, pendingCommittedTroops, runtimeDispatch, wheelDispatchSelection],
    );

    const resolveScenarioCharacterChoice = React.useCallback(
        (groupId: string, characterIds: string[]) => {
            dispatch(QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE, { groupId, characterIds });
        },
        [dispatch],
    );

    const resolveScenarioArmamentChoice = React.useCallback(
        (groupId: string, armamentIds: QidahenCore['pendingScenarioArmamentChoices'][number]['armamentIds']) => {
            dispatch(QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE, { groupId, armamentIds });
        },
        [dispatch],
    );

    const compactMapRegionTip =
        setupStagePending ||
        actionPaymentPreviewVisible ||
        handLimitDiscardSelection != null ||
        core.sunYuanhuaTechSelection != null ||
        core.gaoDiDispatchSelection != null ||
        internalDispatchSelection != null ||
        recruitSelection != null ||
        grantPardonSelection != null ||
        maShiTradeSelection != null ||
        khanEdictSelection != null ||
        diplomacySelection != null ||
        driveTigerConsentSelection != null ||
        fortificationMaintenanceSelection != null ||
        (wheelDispatchSelection != null && !wheelDispatchPaymentPending) ||
        pendingTargetAction != null ||
        postBattleSelection != null;

    const debugPanel = (
        <GameDebugPanel
            G={G}
            dispatch={dispatch}
            playerID={playerID}
            aiSupport={QIDAHEN_MANIFEST.ai}
            playerOptions={QIDAHEN_MANIFEST.playerOptions}
        >
            <QidahenDebugConfig G={G} />
        </GameDebugPanel>
    );

    const defeatInDetailOrderSelectionActive = isQidahenDefeatInDetailOrderSelectionActive(pendingTargetAction);

    const actionPaymentMapRegionSelectionActive = actionPaymentPreviewVisible && core.confirmedActionId === 'raid';

    const gaoDiMapRegionSelectionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);

    const directMapRegionSelectionActive = actionPaymentMapRegionSelectionActive || gaoDiMapRegionSelectionActive;

    const mapRegionSelectionDecisionActive =
        gaoDiMapRegionSelectionActive ||
        actionPaymentMapRegionSelectionActive ||
        defeatInDetailOrderSelectionActive ||
        internalDispatchSelection != null ||
        recruitSelection != null ||
        grantPardonSelection != null ||
        maShiTradeSelection != null ||
        khanEdictSelection != null ||
        diplomacySelection != null ||
        (wheelDispatchSelection != null && !wheelDispatchPaymentPending);

    const selectRegion = React.useCallback(
        (regionId: string, tokenId?: string) => {
            if (
                setupStagePending ||
                (pendingTargetAction != null && !defeatInDetailOrderSelectionActive) ||
                postBattleSelection != null ||
                driveTigerConsentSelection != null ||
                fortificationMaintenanceSelection != null ||
                handLimitDiscardSelection != null ||
                core.sunYuanhuaTechSelection != null
            ) {
                return;
            }
            if (!mapRegionSelectionDecisionActive) {
                return;
            }
            if (isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection)) {
                const runtimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionId);
                const candidate = core.gaoDiDispatchSelection?.candidates.find(
                    (item) => item.targetRegionId === regionId || item.targetRegionId === runtimeRegionId,
                );
                if (candidate) {
                    setDraftGaoDiChoiceId(candidate.id);
                }
                return;
            }
            if (internalDispatchSelection) {
                const runtimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionId);
                const candidate = internalDispatchSelection.candidates.find(
                    (item) => item.targetRegionId === regionId || item.targetRegionId === runtimeRegionId,
                );
                if (candidate) {
                    setDraftInternalDispatchChoiceId(candidate.id);
                }
                return;
            }
            if (grantPardonSelection != null) {
                if (grantPardonSelection.targetRegionId == null) {
                    if (
                        grantPardonMapChoices.some((item) => item.targetRegionId === regionId) &&
                        isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_REGION)
                    ) {
                        dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId });
                    }
                    return;
                }
                if (grantPardonSelection.opponentFactionId != null && tokenId != null) {
                    const choice = grantPardonMapChoices.find(
                        (item) =>
                            item.sourceRegionId === regionId &&
                            item.sourceTokenId === tokenId &&
                            item.sourceFactionId === grantPardonSelection.opponentFactionId &&
                            item.targetRegionId === grantPardonSelection.targetRegionId,
                    );
                    if (choice && isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_REGION)) {
                        dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId, tokenId });
                    }
                }
                return;
            }
            if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_REGION)) {
                return;
            }
            dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId });
        },
        [
            setupStagePending,
            pendingTargetAction,
            defeatInDetailOrderSelectionActive,
            postBattleSelection,
            driveTigerConsentSelection,
            fortificationMaintenanceSelection,
            handLimitDiscardSelection,
            core.sunYuanhuaTechSelection,
            core.gaoDiDispatchSelection,
            internalDispatchSelection,
            mapRegionSelectionDecisionActive,
            grantPardonSelection,
            grantPardonMapChoices,
            isTutorialCommandAllowed,
            dispatch,
            setDraftGaoDiChoiceId,
            setDraftInternalDispatchChoiceId,
        ],
    );

    const activateTopLevelGuideTarget = React.useCallback(
        (candidate: {
            action: 'wheel-dispatch' | 'gao-di' | 'internal-dispatch' | 'grant-pardon' | 'select-region';
            resolutionChoiceId: string;
            targetRegionId: string;
        }) => {
            if (candidate.action === 'wheel-dispatch') {
                resolveWheelDispatchChoice(candidate.resolutionChoiceId);
                return;
            }
            if (candidate.action === 'gao-di') {
                setDraftGaoDiChoiceId(candidate.resolutionChoiceId);
                return;
            }
            if (candidate.action === 'internal-dispatch') {
                setDraftInternalDispatchChoiceId(candidate.resolutionChoiceId);
                return;
            }
            if (candidate.action === 'grant-pardon') {
                resolveGrantPardonChoice(candidate.resolutionChoiceId);
                return;
            }
            selectRegion(candidate.targetRegionId);
        },
        [
            resolveWheelDispatchChoice,
            resolveGrantPardonChoice,
            selectRegion,
            setDraftGaoDiChoiceId,
            setDraftInternalDispatchChoiceId,
        ],
    );
    return {
        selectWheelMove,
        executeWheelMove,
        castScenarioVote,
        selectFaction,
        cancelActionPaymentPreview,
        confirmSelectedAction,
        executeAction,
        togglePaymentCard,
        confirmWheelDispatchPayment,
        playTacticCard,
        playBattleResponseEventCard,
        togglePincerAdvanceTroop,
        resolvePincerAdvance,
        cancelPincerAdvance,
        resolveInfantryCavalryCombined,
        resolveInstigateDefection,
        cancelInstigateDefection,
        setWuzhenChaohaArtilleryTechCount,
        resolveWuzhenChaoha,
        cancelWuzhenChaoha,
        previewActionFromHandCard,
        resolvePendingAction,
        resolveRecruitChoice,
        resolveGrantPardonChoice,
        selectGaoDiDispatchCard,
        selectSunYuanhuaTechCard,
        resolveGaoDiDispatch,
        resolveSunYuanhuaTech,
        resolveInternalDispatch,
        resolveKhanEdictChoice,
        resolveDiplomacyChoice,
        resolveMaShiTradeChoice,
        resolveDriveTigerConsent,
        resolveFortificationMaintenance,
        toggleHandLimitDiscardCard,
        resolveHandLimitDiscard,
        resolvePostBattleDecision,
        resolveScenarioCharacterChoice,
        resolveScenarioArmamentChoice,
        compactMapRegionTip,
        debugPanel,
        defeatInDetailOrderSelectionActive,
        directMapRegionSelectionActive,
        selectRegion,
        activateTopLevelGuideTarget,
    };
}
