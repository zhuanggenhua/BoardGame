import './client';
import './qidahen-board.css';
import React from 'react';
import type { Props } from './ui/boardTypes';
import { useQidahenBoardModel } from './ui/useQidahenBoardModel';
import { MapSceneLayer, StaticMapScene, MapViewportControls } from './ui/MapSceneLayer';
import { resolveQidahenPrimaryRuntimeRegionId } from './domain/regionConfig';
import { UndoProvider } from '../../contexts/UndoContext';
import { QidahenBoardShell } from './QidahenBoardShell';
import { QIDAHEN_BOARD_LAYOUT, QIDAHEN_STAGE_BG, QIDAHEN_PIXI_MAP_PILOT_ENABLED } from './ui/boardLayout';
import { QidahenFactionSelectionScreen } from './ui/QidahenFactionSelectionScreen';
import { QidahenInMatchSetupOverlay } from './ui/InMatchSetupOverlay';
import { PlayerFloat } from './ui/PlayerFloat';
import { QidahenOperationBanner } from './ui/QidahenOperationBanner';
import { WheelPanel } from './ui/WheelPanel';
import { KoreaZone } from './ui/KoreaZone';
import { ChronologyZone } from './ui/ChronologyZone';
import { ActionsZone } from './ui/ActionsZone';
import { HandInteractionTray } from './ui/HandInteractionTray';
import { QidahenInspectPanel } from './ui/QidahenInspectPanel';
import { HandZone } from './ui/HandZone';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import { QidahenCardMagnifyOverlay } from './ui/CardSurfaces';

export { useQidahenBoardModel } from './ui/useQidahenBoardModel';

export const QidahenBoard: React.FC<Props> = (props) => {
const { displayCore, viewerFactionId, directMapRegionSelectionActive, actionPaymentPreviewVisible, handLimitDiscardSelection, core, wheelDispatchPaymentPending, wheelDispatchSelection, grantPardonSelection, grantPardonMapChoices, internalDispatchSelection, pendingTargetAction, pendingCommittedTroops, setPendingCommittedTroops, togglePincerAdvanceTroop, resolveInstigateDefection, resolveWuzhenChaoha, tutorialStep, tutorialMapFocusCandidateRegionId, compactMapRegionTip, mapViewport, setMapViewport, locale, selectRegion, topLevelMapSelectionGuide, getTopLevelGuideRegionPoint, draftGaoDiChoiceId, draftInternalDispatchChoiceId, activateTopLevelGuideTarget, scenarioVotePending, factionSelectionPending, G, dispatch, playerID, isGameOver, isMultiplayer, playerNamesById, castScenarioVote, selectFaction, debugPanel, scenarioChoicesPending, resolveScenarioCharacterChoice, resolveScenarioArmamentChoice, setMagnifyTarget, setDetailInspectTarget, operationPrompt, setupStagePending, recruitSelection, maShiTradeSelection, khanEdictSelection, diplomacySelection, fortificationMaintenanceSelection, postBattleSelection, wheelStageEmphasized, tutorialPrimaryWheelMoveId, selectWheelMove, executeWheelMove, primaryStageMode, isTutorialActive, tutorialInfoStepActive, tutorialShowsSeasonSummary, driveTigerConsentSelection, executeAction, resolveRecruitChoice, resolveGrantPardonChoice, resolveGaoDiDispatch, resolveInternalDispatch, setDraftInternalDispatchChoiceId, resolveMaShiTradeChoice, resolveKhanEdictChoice, resolveDiplomacyChoice, resolveDriveTigerConsent, resolveFortificationMaintenance, upkeepAttritionPriority, setUpkeepAttritionPriority, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, setPendingAttackerCasualtyPriority, setPendingDefenderCasualtyPriority, resolvePendingAction, resolvePincerAdvance, cancelPincerAdvance, resolveInfantryCavalryCombined, cancelInstigateDefection, setWuzhenChaohaArtilleryTechCount, cancelWuzhenChaoha, resolvePostBattleDecision, selectedHandLimitCardIds, resolveHandLimitDiscard, confirmSelectedAction, cancelActionPaymentPreview, resolveSunYuanhuaTech, confirmWheelDispatchPayment, detailInspectTarget, mapTargetSelectionActive, togglePaymentCard, toggleHandLimitDiscardCard, selectSunYuanhuaTechCard, selectGaoDiDispatchCard, playTacticCard, playBattleResponseEventCard, previewActionFromHandCard, endgameProps, magnifyTarget } = useQidahenBoardModel(props);


    const boardScene = (
        <>
            <MapSceneLayer
                core={displayCore}
                perspectiveFactionId={viewerFactionId}
                mapHitTestingDisabled={!directMapRegionSelectionActive && (
                    actionPaymentPreviewVisible
                    || handLimitDiscardSelection != null
                    || core.sunYuanhuaTechSelection != null
                    || core.gaoDiDispatchSelection != null
                )}
                wheelDispatchSelection={wheelDispatchPaymentPending ? null : wheelDispatchSelection}
                grantPardonSelection={grantPardonSelection}
                grantPardonMapChoices={grantPardonMapChoices}
                internalDispatchSelection={internalDispatchSelection}
                pendingTargetAction={pendingTargetAction}
                pendingCommittedTroops={pendingCommittedTroops}
                onSelectPendingCommittedTroops={setPendingCommittedTroops}
                onTogglePincerAdvanceTroop={togglePincerAdvanceTroop}
                onResolveInstigateDefection={resolveInstigateDefection}
                onResolveWuzhenChaoha={resolveWuzhenChaoha}
                tutorialStepId={tutorialStep?.id ?? null}
                tutorialHighlightsResultFeedback={tutorialStep?.highlightTarget === 'qidahen-map-result-feedback'}
                tutorialGuideTargetRegionId={tutorialMapFocusCandidateRegionId}
                compactRegionTip={compactMapRegionTip}
                viewport={mapViewport}
                onViewportChange={setMapViewport}
                locale={locale}
                onSelectRegion={selectRegion}
            />
            {topLevelMapSelectionGuide && tutorialStep?.id === 'choose-grant-pardon-target' ? (
                <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
                    {topLevelMapSelectionGuide.candidates.map((candidate) => {
                        const targetPoint = getTopLevelGuideRegionPoint(candidate.targetRegionId);
                        if (!targetPoint) {
                            return null;
                        }
                        return (
                            <div
                                key={`top-level-guide-anchor-${candidate.id}`}
                                data-testid={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}
                                data-tutorial-id={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}
                                data-choice-id={candidate.resolutionChoiceId}
                                data-action={candidate.action}
                                data-grant-pardon-map-choice={candidate.action === 'grant-pardon' ? candidate.resolutionChoiceId : undefined}
                                style={{
                                    position: 'absolute',
                                    left: targetPoint.x - 1,
                                    top: targetPoint.y - 1,
                                    width: 2,
                                    height: 2,
                                    opacity: 0,
                                }}
                            />
                        );
                    })}
                </div>
            ) : null}
            {topLevelMapSelectionGuide && tutorialStep?.id !== 'choose-grant-pardon-target' ? (
                <div className="pointer-events-none absolute inset-0 z-40">
                    {topLevelMapSelectionGuide.candidates.map((candidate) => {
                        const targetPoint = getTopLevelGuideRegionPoint(candidate.targetRegionId);
                        if (!targetPoint) {
                            return null;
                        }
                        return (
                            <button
                                key={`top-level-guide-hit-${candidate.id}`}
                                type="button"
                                data-testid={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}
                                data-choice-id={candidate.resolutionChoiceId}
                                data-action={candidate.action}
                                data-grant-pardon-map-choice={candidate.action === 'grant-pardon' ? candidate.resolutionChoiceId : undefined}
                                aria-label={`${topLevelMapSelectionGuide.title}：${candidate.targetRegionName}`}
                                aria-pressed={candidate.action === 'gao-di'
                                    ? draftGaoDiChoiceId === candidate.resolutionChoiceId
                                    : candidate.action === 'internal-dispatch'
                                        ? draftInternalDispatchChoiceId === candidate.resolutionChoiceId
                                        : displayCore.explicitRegionId != null
                                            && resolveQidahenPrimaryRuntimeRegionId(displayCore.explicitRegionId) === resolveQidahenPrimaryRuntimeRegionId(candidate.targetRegionId)}
                                className="qidahen-map-guide-hit-target pointer-events-auto absolute cursor-pointer border-0 bg-transparent p-0"
                                style={{
                                    left: targetPoint.x - 34,
                                    top: targetPoint.y - 34,
                                    width: 68,
                                    height: 68,
                                    background: 'transparent',
                                    boxShadow: 'none',
                                }}
                                onClick={() => activateTopLevelGuideTarget(candidate)}
                            />
                        );
                    })}
                </div>
            ) : null}
        </>
    );


    if (scenarioVotePending || factionSelectionPending) {
        return (
            <UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
                <QidahenBoardShell
                    layout={QIDAHEN_BOARD_LAYOUT}
                    backgroundColor={QIDAHEN_STAGE_BG}
                    scene={<StaticMapScene locale={locale} />}
                    hud={(
                        <>
                            <QidahenFactionSelectionScreen
                                core={core}
                                playerID={playerID}
                                playerNamesById={playerNamesById}
                                locale={locale}
                                onCastScenarioVote={castScenarioVote}
                                onSelectFaction={selectFaction}
                            />
                            {debugPanel}
                        </>
                    )}
                />
            </UndoProvider>
        );
    }


    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
            <QidahenBoardShell
                layout={QIDAHEN_BOARD_LAYOUT}
                backgroundColor={QIDAHEN_STAGE_BG}
                scene={boardScene}
                sceneOverlay={QIDAHEN_PIXI_MAP_PILOT_ENABLED ? (
                    <MapViewportControls viewport={mapViewport} onViewportChange={setMapViewport} />
                ) : null}
                hud={(
                    <>
            {!scenarioVotePending && scenarioChoicesPending ? (
                <QidahenInMatchSetupOverlay
                    core={core}
                    viewerFactionId={viewerFactionId}
                    playerID={playerID}
                    onResolveScenarioCharacterChoice={resolveScenarioCharacterChoice}
                    onResolveScenarioArmamentChoice={resolveScenarioArmamentChoice}
                    onMagnifyCard={setMagnifyTarget}
                />
            ) : null}
            <PlayerFloat
                core={core}
                onInspectFaction={(factionId) => setDetailInspectTarget({ kind: 'faction', factionId })}
            />
            {operationPrompt ? (
                <QidahenOperationBanner title={operationPrompt.title} />
            ) : null}
            <WheelPanel
                selectedId={core.actionWheelPosition}
                selectedMoveId={core.selectedWheelMoveId}
                moveChoices={core.wheelMoveChoices}
                moveSummary={core.wheelMoveSummary}
                disabled={setupStagePending || core.wheelActionUsed || recruitSelection != null || core.sunYuanhuaTechSelection != null || core.gaoDiDispatchSelection != null || internalDispatchSelection != null || maShiTradeSelection != null || khanEdictSelection != null || diplomacySelection != null || fortificationMaintenanceSelection != null || handLimitDiscardSelection != null || pendingTargetAction != null || postBattleSelection != null}
                emphasized={wheelStageEmphasized}
                primaryMoveId={tutorialPrimaryWheelMoveId}
                directExecuteOnClick
                onSelectMove={selectWheelMove}
                onExecuteMove={executeWheelMove}
            />
            <KoreaZone core={core} locale={locale} />
            <ChronologyZone cards={core.yearCards} locale={locale} onMagnify={setMagnifyTarget} />
            <ActionsZone
                core={displayCore}
                primaryStageMode={primaryStageMode}
                isTutorialActive={isTutorialActive}
                tutorialInfoStepActive={tutorialInfoStepActive}
                tutorialHighlightsSeasonSummary={tutorialShowsSeasonSummary}
                actionPaymentPreviewVisible={actionPaymentPreviewVisible}
                handLimitDiscardSelection={handLimitDiscardSelection}
                internalDispatchSelection={internalDispatchSelection}
                recruitSelection={recruitSelection}
                grantPardonSelection={grantPardonSelection}
                maShiTradeSelection={maShiTradeSelection}
                khanEdictSelection={khanEdictSelection}
                diplomacySelection={diplomacySelection}
                driveTigerConsentSelection={driveTigerConsentSelection}
                fortificationMaintenanceSelection={fortificationMaintenanceSelection}
                pendingTargetAction={pendingTargetAction}
                postBattleSelection={postBattleSelection}
                onExecuteAction={executeAction}
                onSelectRegion={selectRegion}
                onResolveRecruitChoice={resolveRecruitChoice}
                onResolveGrantPardonChoice={resolveGrantPardonChoice}
                selectedGaoDiChoiceId={draftGaoDiChoiceId}
                onResolveGaoDiDispatch={resolveGaoDiDispatch}
                selectedInternalDispatchChoiceId={draftInternalDispatchChoiceId}
                onResolveInternalDispatch={resolveInternalDispatch}
                onClearInternalDispatchChoice={() => setDraftInternalDispatchChoiceId(null)}
                onResolveMaShiTradeChoice={resolveMaShiTradeChoice}
                onResolveKhanEdictChoice={resolveKhanEdictChoice}
                onResolveDiplomacyChoice={resolveDiplomacyChoice}
                onResolveDriveTigerConsent={resolveDriveTigerConsent}
                onResolveFortificationMaintenance={resolveFortificationMaintenance}
                upkeepAttritionPriority={upkeepAttritionPriority}
                onSelectUpkeepAttritionPriority={setUpkeepAttritionPriority}
                pendingCommittedTroops={pendingCommittedTroops}
                onSelectPendingCommittedTroops={setPendingCommittedTroops}
                pendingAttackerCasualtyPriority={pendingAttackerCasualtyPriority}
                pendingDefenderCasualtyPriority={pendingDefenderCasualtyPriority}
                onSelectPendingAttackerCasualtyPriority={setPendingAttackerCasualtyPriority}
                onSelectPendingDefenderCasualtyPriority={setPendingDefenderCasualtyPriority}
                onResolvePendingAction={resolvePendingAction}
                onResolvePincerAdvance={resolvePincerAdvance}
                onCancelPincerAdvance={cancelPincerAdvance}
                onResolveInfantryCavalryCombined={resolveInfantryCavalryCombined}
                onCancelInstigateDefection={cancelInstigateDefection}
                onSetWuzhenChaohaArtilleryTechCount={setWuzhenChaohaArtilleryTechCount}
                onCancelWuzhenChaoha={cancelWuzhenChaoha}
                onResolvePostBattleDecision={resolvePostBattleDecision}
                wheelDispatchSelection={wheelDispatchSelection}
            />
            <HandInteractionTray
                core={core}
                actionPaymentPreviewVisible={actionPaymentPreviewVisible}
                handLimitDiscardSelection={handLimitDiscardSelection}
                selectedHandLimitCardIds={selectedHandLimitCardIds}
                onResolveHandLimitDiscard={resolveHandLimitDiscard}
                onConfirmSelectedAction={confirmSelectedAction}
                onCancelSelectedActionPreview={cancelActionPaymentPreview}
                onResolveSunYuanhuaTech={resolveSunYuanhuaTech}
                onConfirmWheelDispatchPayment={confirmWheelDispatchPayment}
            />
            {detailInspectTarget ? (
                <QidahenInspectPanel
                    core={core}
                    target={detailInspectTarget}
                    locale={locale}
                    onClose={() => setDetailInspectTarget(null)}
                />
            ) : null}
            <HandZone
                core={core}
                pendingTargetAction={pendingTargetAction}
                viewerFactionId={viewerFactionId}
                playerID={playerID}
                locale={locale}
                mapTargetSelectionActive={mapTargetSelectionActive}
                actionPaymentPreviewVisible={actionPaymentPreviewVisible}
                selectedPaymentCardIds={core.selectedPaymentCardIds}
                handLimitDiscardSelection={handLimitDiscardSelection}
                selectedHandLimitCardIds={selectedHandLimitCardIds}
                onTogglePaymentCard={togglePaymentCard}
                onToggleHandLimitDiscardCard={toggleHandLimitDiscardCard}
                onSelectSunYuanhuaTechCard={selectSunYuanhuaTechCard}
                onSelectGaoDiDispatchCard={selectGaoDiDispatchCard}
                onPlayTacticCard={playTacticCard}
                onPlayBattleResponseEventCard={playBattleResponseEventCard}
                onPreviewActionFromHandCard={previewActionFromHandCard}
                onMagnifyCard={setMagnifyTarget}
            />
            <EndgameOverlay {...endgameProps} />
            <QidahenCardMagnifyOverlay target={magnifyTarget} locale={locale} onClose={() => setMagnifyTarget(null)} />
            {debugPanel}
                    </>
                )}
            />
        </UndoProvider>
    );
};

export default QidahenBoard;
