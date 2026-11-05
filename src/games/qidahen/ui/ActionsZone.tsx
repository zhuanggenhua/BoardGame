import React from 'react';
import { type ActionsZoneProps, useQidahenActionsModel } from './useQidahenActionsModel';
import {
    ACTIONS_DOCK_LEFT,
    ACTIONS_DOCK_TOP,
    ACTIONS_DOCK_WIDTH,
    ACTIONS_DOCK_HEIGHT,
    UI_STYLE,
    UI_SURFACE,
} from './boardLayout';
import {
    isQidahenGaoDiTargetSelectionActive,
    getQidahenFriendlyPendingTargetTitle,
    getPendingCommittedTroopOptions,
    hasStructuredCasualtyChoice,
    getPendingTargetChoiceTestId,
    getPendingTargetChoiceMinWidth,
    getQidahenFriendlyPendingChoiceLabel,
    getQidahenFriendlyPostBattleTitle,
} from './boardReadModel';
import { isQidahenWheelDispatchPaymentPending } from '../domain/wheelDispatchPayment';
import { normalizeQidahenBattleRollSummary, QidahenBattleRollDiceSummary } from './BattleRollSummary';
import { ActionButton } from './ActionButton';
import { QIDAHEN_COMMANDS } from '../domain/commands';

export { type ActionsZoneProps, useQidahenActionsModel } from './useQidahenActionsModel';

export const ActionsZone: React.FC<ActionsZoneProps> = (props) => {
    const {
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
    } = useQidahenActionsModel(props);

    return (
        <div
            className="pointer-events-auto absolute z-40 flex flex-col items-end"
            data-testid="qidahen-actions-zone"
            data-tutorial-id="qidahen-actions-zone"
            data-ui-anchor="right-middle"
            style={{
                left: `calc(${ACTIONS_DOCK_LEFT}px + var(--qidahen-mobile-edge-pull, 0px))`,
                top: ACTIONS_DOCK_TOP,
                width: suppressPassiveActionContext ? ACTIONS_DOCK_WIDTH + 12 : ACTIONS_DOCK_WIDTH,
                height: ACTIONS_DOCK_HEIGHT,
            }}
        >
            <div ref={actionSlotRef} className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="qidahen-action-slot">
                {core.victoryStatus ? (
                    <div
                        className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[12px] font-black leading-5"
                        data-testid="qidahen-victory-status"
                        style={{
                            borderColor: UI_STYLE.cinnabar,
                            background: UI_SURFACE.mapPanelSelected,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>
                            {t('board.actions.victoryAchieved', {
                                winnerName: core.victoryStatus.winnerName,
                                condition:
                                    core.victoryStatus.condition === 'hegemony'
                                        ? t('board.actions.victory.hegemony', { defaultValue: '霸权胜利' })
                                        : core.victoryStatus.condition === 'military'
                                          ? t('board.actions.victory.military', { defaultValue: '军事胜利' })
                                          : t('board.actions.victory.prestige', { defaultValue: '威望胜利' }),
                                defaultValue: '{{winnerName}} 已达成{{condition}}',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {core.victoryStatus.detail}
                        </div>
                    </div>
                ) : null}
                {showFortificationStrip ? (
                    <div
                        className="mb-3 flex flex-wrap items-center justify-end gap-2"
                        data-testid="qidahen-fortification-strip"
                    >
                        {core.fortifications.map((fortification) => (
                            <div
                                key={fortification.id}
                                className="border-[2px] px-2 py-1 text-[11px] font-black leading-4"
                                title={fortification.ruleNote}
                                data-testid={`qidahen-fortification-${fortification.id}`}
                                style={{
                                    borderColor: UI_STYLE.mapInk,
                                    background: fortification.ruined
                                        ? UI_SURFACE.mapPanelSelected
                                        : UI_SURFACE.mapPanel,
                                    color: fortification.ruined ? '#f6d5a8' : UI_STYLE.mapIvory,
                                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                                    borderRadius: 3,
                                }}
                            >
                                {t('board.actions.fortificationStatus', {
                                    label: fortification.label,
                                    status: fortification.ruined
                                        ? t('board.actions.fortification.ruined', { defaultValue: '破败' })
                                        : t('board.actions.fortification.intact', { defaultValue: '完整' }),
                                    defaultValue: '{{label}} · {{status}}',
                                })}
                            </div>
                        ))}
                    </div>
                ) : null}
                {!hideWheelRecruitTrainSummary &&
                (!isTutorialActive || tutorialHighlightsSeasonSummary) &&
                (!suppressPassiveActionContext || tutorialHighlightsSeasonSummary) &&
                (!tutorialInfoStepActive || tutorialHighlightsSeasonSummary) &&
                core.lastSeasonSummary ? (
                    <div
                        className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[12px] font-black leading-5"
                        data-testid="qidahen-season-summary"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapOpenPanel,
                            color: UI_STYLE.ink,
                            boxShadow: UI_SURFACE.mapOpenPanelShadow,
                            borderRadius: 3,
                        }}
                    >
                        <div>{core.lastSeasonSummary.title}</div>
                        <div className="mt-1 space-y-1 text-[11px]" style={{ color: UI_STYLE.bronze }}>
                            {seasonSummaryLines.map((line) => (
                                <div key={line}>{line}</div>
                            ))}
                        </div>
                    </div>
                ) : null}
                {fortificationMaintenanceSelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-fortification-maintenance-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanelSelected,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{fortificationMaintenanceSelection.title}</div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {fortificationMaintenanceSelection.summary}
                        </div>
                        <div
                            className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]"
                            data-testid="qidahen-upkeep-attrition-priority"
                        >
                            <span className="mr-1" style={{ color: '#f3d1a5' }}>
                                {t('board.actions.attritionLabel', { defaultValue: '兵力耗损' })}
                            </span>
                            {[
                                {
                                    id: 'lowest-level' as const,
                                    label: t('board.actions.casualtyPriority.lowestFirst', {
                                        defaultValue: '低级先损',
                                    }),
                                },
                                {
                                    id: 'highest-level' as const,
                                    label: t('board.actions.casualtyPriority.highestFirst', {
                                        defaultValue: '高级先损',
                                    }),
                                },
                            ].map((option) => {
                                const selected = option.id === upkeepAttritionPriority;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        data-testid={`qidahen-upkeep-attrition-${option.id}`}
                                        className="inline-flex h-[28px] min-w-[54px] items-center justify-center border-[2px] px-2 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onSelectUpkeepAttritionPriority(option.id)}
                                        style={{
                                            borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                            background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                            color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                            boxShadow: selected ? UI_SURFACE.mapPanelShadow : UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                            {fortificationMaintenanceSelection.choices.map((choice) => (
                                <button
                                    key={choice.id}
                                    type="button"
                                    data-testid={`qidahen-fortification-maintenance-choice-${choice.id}`}
                                    className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() =>
                                        onResolveFortificationMaintenance(choice.id, upkeepAttritionPriority)
                                    }
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_SURFACE.paper,
                                        color: UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    <span className="min-w-0">
                                        <span className="block text-[13px]">{choice.label}</span>
                                        <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                            {choice.detail}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
                {core.gaoDiDispatchSelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-gao-di-dispatch-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanel,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{core.gaoDiDispatchSelection.title}</div>
                        {isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection) ? (
                            <div className="mt-2 border-t pt-2" style={{ borderColor: 'rgba(210,183,117,0.28)' }}>
                                <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                                    {t('board.actions.gaoDi.summary', {
                                        sourceRegionName: core.gaoDiDispatchSelection.displayAnchorRegionName,
                                        maxTroops: core.gaoDiDispatchSelection.maxTroops,
                                        maxPopulation: core.gaoDiDispatchSelection.maxPopulation,
                                        defaultValue:
                                            '选择调度目标 · 最多调 {{maxTroops}} 个部队或 {{maxPopulation}} 人口',
                                    })}
                                </div>
                                <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                                    {core.gaoDiDispatchSelection.summary}
                                </div>
                                <div
                                    className="text-[12px]"
                                    data-testid="qidahen-gao-di-dispatch-target"
                                    style={{ color: selectedGaoDiCandidate ? UI_STYLE.mapIvory : UI_STYLE.mapGold }}
                                >
                                    {selectedGaoDiCandidate
                                        ? t('board.actions.gaoDi.currentTarget', {
                                              targetRegionName: selectedGaoDiCandidate.targetRegionName,
                                              defaultValue: '当前目标：{{targetRegionName}}',
                                          })
                                        : t('board.actions.gaoDi.selectMapTarget', {
                                              defaultValue: '在地图上选择目标地区',
                                          })}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        data-testid="qidahen-gao-di-dispatch-confirm"
                                        disabled={!selectedGaoDiCandidate}
                                        className="inline-flex min-h-[44px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-45"
                                        onClick={() => {
                                            if (selectedGaoDiCandidate) {
                                                onResolveGaoDiDispatch(selectedGaoDiCandidate.id);
                                            }
                                        }}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_STYLE.cinnabar,
                                            color: UI_STYLE.mapIvory,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {t('board.actions.gaoDi.confirmDispatch', { defaultValue: '确认调度' })}
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="qidahen-gao-di-dispatch-skip"
                                        className="inline-flex min-h-[44px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onResolveGaoDiDispatch('skip')}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {t('board.actions.gaoDi.skip', { defaultValue: '跳过调度' })}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                data-testid="qidahen-gao-di-dispatch-skip"
                                className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveGaoDiDispatch('skip')}
                                style={{
                                    borderColor: UI_STYLE.mapInk,
                                    background: UI_SURFACE.paper,
                                    color: UI_STYLE.ink,
                                    boxShadow: UI_SURFACE.hardShadow,
                                    borderRadius: 3,
                                }}
                            >
                                {t('board.actions.gaoDi.skip', { defaultValue: '跳过高第调度' })}
                            </button>
                        )}
                    </div>
                ) : null}
                {internalDispatchSelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-internal-dispatch-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanel,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{internalDispatchSelection.title}</div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.actions.internalDispatch.summary', {
                                sourceRegionName: internalDispatchSelection.displayAnchorRegionName,
                                maxTroops: internalDispatchSelection.maxTroops,
                                defaultValue: '选择调度目标 · 最多调 {{maxTroops}} 个部队',
                            })}
                        </div>
                        <div className="mt-2 border-t pt-2" style={{ borderColor: 'rgba(210,183,117,0.28)' }}>
                            <div
                                className="text-[12px]"
                                data-testid="qidahen-internal-dispatch-target"
                                aria-live="polite"
                                style={{
                                    color: selectedInternalDispatchCandidate ? UI_STYLE.mapIvory : UI_STYLE.mapGold,
                                }}
                            >
                                {selectedInternalDispatchCandidate
                                    ? t('board.actions.internalDispatch.currentTarget', {
                                          targetRegionName: selectedInternalDispatchCandidate.targetRegionName,
                                          defaultValue: '当前目标：{{targetRegionName}}',
                                      })
                                    : t('board.actions.internalDispatch.selectMapTarget', {
                                          defaultValue: '在地图上选择目标地区',
                                      })}
                            </div>
                            {selectedInternalDispatchCandidate ? (
                                <div
                                    className="mt-1 text-[11px] font-bold"
                                    data-testid="qidahen-internal-dispatch-consequence"
                                    style={{ color: UI_STYLE.mapGold }}
                                >
                                    {selectedInternalDispatchCandidate.resolutionHint}
                                </div>
                            ) : null}
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    data-testid="qidahen-internal-dispatch-confirm"
                                    disabled={!selectedInternalDispatchCandidate}
                                    className="inline-flex min-h-[44px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-45"
                                    onClick={() => {
                                        if (selectedInternalDispatchCandidate) {
                                            onResolveInternalDispatch(selectedInternalDispatchCandidate.id);
                                        }
                                    }}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_STYLE.cinnabar,
                                        color: UI_STYLE.mapIvory,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {t('board.actions.internalDispatch.confirmDispatch', { defaultValue: '确认调度' })}
                                </button>
                                <button
                                    type="button"
                                    data-testid="qidahen-internal-dispatch-cancel"
                                    disabled={!selectedInternalDispatchCandidate}
                                    className="inline-flex min-h-[44px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-45"
                                    onClick={onClearInternalDispatchChoice}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_SURFACE.paper,
                                        color: UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {t('board.actions.internalDispatch.cancelSelection', { defaultValue: '取消选择' })}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
                {recruitSelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-recruit-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanel,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{t('board.actions.recruit.title', { defaultValue: '征召军队' })}</div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.actions.recruit.summary', {
                                targetRegionName:
                                    recruitSelection.displayAnchorRegionName ??
                                    t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                                defaultValue: '选择建军方式',
                            })}
                        </div>
                        {recruitRegionExplicitlySelected ? (
                            <div className="mt-2 flex flex-col gap-2">
                                {recruitSelection.choices.map((choice) => (
                                    <button
                                        key={choice.id}
                                        type="button"
                                        data-testid={`qidahen-recruit-choice-${choice.id}`}
                                        className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onResolveRecruitChoice(choice.id)}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-[13px]">{choice.label}</span>
                                            <span
                                                className="mt-1 block text-[11px]"
                                                style={{ color: UI_STYLE.mutedInk }}
                                            >
                                                {choice.detail}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div
                                className="mt-2 border-[2px] px-2 py-2 text-[12px]"
                                data-testid="qidahen-recruit-map-first-hint"
                                style={{
                                    borderColor: UI_STYLE.mapGold,
                                    background: 'rgba(255, 241, 205, 0.08)',
                                    color: UI_STYLE.mapIvory,
                                    borderRadius: 3,
                                }}
                            >
                                {t('board.actions.recruit.mapFirstHint', {
                                    defaultValue: '先点击地图上的建军地区，再选择建军方式。',
                                })}
                            </div>
                        )}
                    </div>
                ) : null}
                {grantPardonSelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-grant-pardon-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanel,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                            opacity: 1,
                        }}
                    >
                        <div>{grantPardonSelection.title}</div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {grantPardonSelection.targetRegionId == null
                                ? t('board.actions.grantPardon.targetRegionHint', {
                                      factionName: grantPardonExecutorFactionName,
                                      defaultValue: '点击地图上高亮的{{factionName}}控制区作为接收区。',
                                  })
                                : grantPardonNeedsOpponent
                                  ? t('board.actions.grantPardon.opponentHint', {
                                        defaultValue:
                                            '同一接收区对应多个对手；执行方先选择其中一方，随后由该玩家选择部队。',
                                    })
                                  : t('board.actions.grantPardon.troopHint', {
                                        factionName: tCommon(
                                            `qidahenBoard.factions.${grantPardonSelection.opponentFactionId}`,
                                            { defaultValue: grantPardonSelection.choices[0]?.sourceFactionName ?? '' },
                                        ),
                                        regionName:
                                            grantPardonSelection.displayAnchorRegionName ??
                                            grantPardonSelection.targetRegionId,
                                        defaultValue:
                                            '请{{factionName}}玩家点击地图上高亮的具体部队；点击后直接转入{{regionName}}。',
                                    })}
                        </div>
                        {grantPardonSelection.targetRegionId != null &&
                        grantPardonSelection.opponentFactionId != null ? (
                            <div
                                className="mt-2 border-[2px] px-2 py-1 text-[11px]"
                                data-testid="qidahen-grant-pardon-derived-opponent"
                                style={{
                                    borderColor: UI_STYLE.mapGold,
                                    background: 'rgba(255, 241, 205, 0.08)',
                                    color: UI_STYLE.mapIvory,
                                    borderRadius: 3,
                                }}
                            >
                                {t('board.actions.grantPardon.derivedOpponentLabel', {
                                    factionName: tCommon(
                                        `qidahenBoard.factions.${grantPardonSelection.opponentFactionId}`,
                                        {
                                            defaultValue: grantPardonSelection.choices[0]?.sourceFactionName ?? '',
                                        },
                                    ),
                                    defaultValue: '接收区已自动锁定对手：{{factionName}}',
                                })}
                            </div>
                        ) : null}
                        {grantPardonNeedsOpponent ? (
                            <div
                                className="mt-2 flex flex-col gap-2"
                                data-testid="qidahen-grant-pardon-opponent-options"
                            >
                                {grantPardonOpponentChoices.map((choice) => (
                                    <button
                                        key={choice.sourceFactionId}
                                        type="button"
                                        data-testid={`qidahen-grant-pardon-opponent-${choice.sourceFactionId}`}
                                        className="inline-flex min-h-[44px] items-center justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onResolveGrantPardonChoice(`opponent:${choice.sourceFactionId}`)}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {tCommon(`qidahenBoard.factions.${choice.sourceFactionId}`, {
                                            defaultValue: choice.sourceFactionName,
                                        })}
                                    </button>
                                ))}
                            </div>
                        ) : grantPardonHasMapTargets ? null : (
                            <div className="mt-2 flex flex-col gap-2">
                                <div
                                    className="text-[10px] font-black uppercase tracking-[0.08em]"
                                    style={{ color: UI_STYLE.mapGold }}
                                >
                                    {t('board.actions.grantPardon.fallbackListLabel', { defaultValue: '备用选择' })}
                                </div>
                                {grantPardonSelection.choices.map((choice) => (
                                    <button
                                        key={choice.id}
                                        type="button"
                                        data-testid={`qidahen-grant-pardon-choice-${choice.id}`}
                                        className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onResolveGrantPardonChoice(choice.id)}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-[13px]">{choice.label}</span>
                                            <span
                                                className="mt-1 block text-[11px]"
                                                style={{ color: UI_STYLE.mutedInk }}
                                            >
                                                {choice.detail}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}
                {maShiTradeSelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-ma-shi-trade-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanel,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{t('board.actions.maShiTrade.title', { defaultValue: '马市贸易' })}</div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.actions.maShiTrade.summary', {
                                targetRegionName:
                                    maShiTradeSelection.displayAnchorRegionName ??
                                    t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                                defaultValue: '选择建军数量',
                            })}
                        </div>
                        {maShiTradeRegionExplicitlySelected ? (
                            <div className="mt-2 flex flex-col gap-2">
                                {maShiTradeSelection.choices.map((choice) => (
                                    <button
                                        key={choice.troopCount}
                                        type="button"
                                        data-testid={`qidahen-ma-shi-trade-choice-${choice.troopCount}`}
                                        className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onResolveMaShiTradeChoice(choice.troopCount)}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-[13px]">{choice.label}</span>
                                            <span
                                                className="mt-1 block text-[11px]"
                                                style={{ color: UI_STYLE.mutedInk }}
                                            >
                                                {choice.detail}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div
                                className="mt-2 border-[2px] px-2 py-2 text-[12px]"
                                data-testid="qidahen-ma-shi-trade-map-first-hint"
                                style={{
                                    borderColor: UI_STYLE.mapGold,
                                    background: 'rgba(255, 241, 205, 0.08)',
                                    color: UI_STYLE.mapIvory,
                                    borderRadius: 3,
                                }}
                            >
                                {t('board.actions.maShiTrade.mapFirstHint', {
                                    defaultValue: '先点击地图上的建军地区，再选择建军数量。',
                                })}
                            </div>
                        )}
                    </div>
                ) : null}
                {khanEdictSelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-khan-edict-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanel,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{t('board.actions.khanEdict.title', { defaultValue: '大汗令箭' })}</div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.actions.khanEdict.summary', {
                                sourceRegionName:
                                    khanEdictSelection.displayAnchorRegionName ??
                                    t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                                defaultValue: '选择执行效果',
                            })}
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                            {khanEdictSelection.choices.map((choice) => (
                                <button
                                    key={choice.id}
                                    type="button"
                                    data-testid={`qidahen-khan-edict-choice-${choice.id}`}
                                    className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onResolveKhanEdictChoice(choice.id)}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_SURFACE.paper,
                                        color: UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    <span className="min-w-0">
                                        <span className="block text-[13px]">{choice.label}</span>
                                        <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                            {choice.detail}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
                {diplomacySelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-diplomacy-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanel,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{diplomacySelection.title}</div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.actions.diplomacy.sourceSummary', {
                                sourceRegionName:
                                    diplomacySelection.displayAnchorRegionName ??
                                    t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                                hireRegionName:
                                    diplomacySelection.hireRegionName ??
                                    t('board.actions.diplomacy.currentControlRegion', { defaultValue: '当前控制区' }),
                                defaultValue: '处理外交与雇佣',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.actions.diplomacy.resolvedSummary', {
                                resolved: diplomacySelection.resolvedSteps.length,
                                total: diplomacySelection.maxTargetCount,
                                remaining: diplomacySelection.remainingTargetCount,
                                defaultValue: '已执行 {{resolved}}/{{total}} 次外交 · 还可继续 {{remaining}} 次',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.actions.diplomacy.targetSummary', {
                                targetHint: diplomacySelection.targetHint,
                                defaultValue: '在地图上点击外交目标；下方地区按钮仅作备用 · {{targetHint}}',
                            })}
                        </div>
                        {diplomacySelection.resolvedSteps.length > 0 ? (
                            <div
                                className="mt-2 border-[2px] px-2 py-2 text-[11px] leading-4"
                                data-testid="qidahen-diplomacy-history"
                                style={{
                                    borderColor: 'rgba(232,200,133,0.26)',
                                    background: 'rgba(17,11,7,0.22)',
                                    borderRadius: 3,
                                }}
                            >
                                {diplomacySelection.resolvedSteps.map((step) => (
                                    <div key={`${step.index}-${step.targetRegionId}`} className="mt-1 first:mt-0">
                                        {t('board.actions.diplomacy.stepSummary', {
                                            index: step.index,
                                            summary: step.summary,
                                            defaultValue: '外交 {{index}} · {{summary}}',
                                        })}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <div className="sr-only">
                            {diplomacySelection.candidateTargetRegionIds.map((regionId) => {
                                const region = core.regions.find(
                                    (item) => item.id === regionId && !item.isLogicalRegion,
                                );
                                if (!region) return null;
                                return (
                                    <button
                                        key={regionId}
                                        type="button"
                                        data-testid={`qidahen-diplomacy-target-${regionId}`}
                                        className="border-[2px] px-2 py-1 text-[11px] font-black"
                                        onClick={() => onSelectRegion(regionId)}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background:
                                                diplomacySelection.targetRegionId === regionId
                                                    ? UI_SURFACE.mapPanelSelected
                                                    : UI_SURFACE.paper,
                                            color:
                                                diplomacySelection.targetRegionId === regionId
                                                    ? UI_STYLE.mapIvory
                                                    : UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {region.name}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                            {diplomacySelection.choices.map((choice) => (
                                <button
                                    key={choice.id}
                                    type="button"
                                    data-testid={`qidahen-diplomacy-choice-${choice.id}`}
                                    className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onResolveDiplomacyChoice(choice.id)}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_SURFACE.paper,
                                        color: UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    <span className="min-w-0">
                                        <span className="block text-[13px]">{choice.label}</span>
                                        <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                            {choice.detail}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
                {driveTigerConsentSelection ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-drive-tiger-consent-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanelSelected,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{t('board.actions.driveTiger.title', { defaultValue: '驱虎吞狼' })}</div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.actions.driveTiger.summary', {
                                targetFactionName: driveTigerConsentSelection.targetFactionName,
                                defaultValue:
                                    '先问 {{targetFactionName}} 愿不愿听大明指挥；同意后抽 6 张牌，再由其出兵进攻。',
                            })}
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                            {driveTigerConsentSelection.choices.map((choice) => (
                                <button
                                    key={choice.id}
                                    type="button"
                                    data-testid={`qidahen-drive-tiger-consent-choice-${choice.id}`}
                                    className="border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onResolveDriveTigerConsent(choice.id)}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_SURFACE.paper,
                                        color: UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    <span className="block">
                                        {choice.label}
                                        <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                            {choice.detail}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
                {wheelDispatchSelection && !isQidahenWheelDispatchPaymentPending(core) ? (
                    <div
                        className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                        data-testid="qidahen-wheel-dispatch-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanel,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>{wheelDispatchSelection.restriction}</div>
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.actions.wheelDispatch.summary', {
                                sourceRegionName: wheelDispatchSelection.displayAnchorRegionName,
                                count: wheelDispatchSelection.candidates.length,
                                defaultValue: '进攻目标',
                            })}
                        </div>
                    </div>
                ) : null}
                {pendingTargetAction ? (
                    <div
                        className="mt-3 border-[3px] px-3 py-2 text-[14px] font-black leading-6"
                        data-testid="qidahen-raid-intent"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanelSelected,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>
                            {getQidahenFriendlyPendingTargetTitle(pendingTargetAction)}
                            <span className="sr-only">
                                {t('board.actions.pendingTarget.header', {
                                    title: pendingTargetAction.title,
                                    targetRegionName: pendingTargetAction.targetRegionName,
                                    defenderLabel: pendingTargetAction.defenderLabel,
                                    defaultValue: '{{title}} · {{targetRegionName}} · 守方 {{defenderLabel}}',
                                })}
                            </span>
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {pendingTargetAction.resolutionHint}
                            {pendingTargetAction.defenderPayCost != null
                                ? t('board.actions.pendingTarget.defenderPayCost', {
                                      cost: pendingTargetAction.defenderPayCost,
                                      defaultValue: ' · 守方需付 {{cost}}',
                                  })
                                : ''}
                        </div>
                        {pendingTargetAction.actionId === 'raid' ||
                        pendingTargetAction.actionId === 'wheel-dispatch' ||
                        pendingTargetAction.actionId === 'drive-tiger' ? (
                            <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                                {t('board.actions.pendingTarget.stats', {
                                    sourceAvailableTroops: pendingTargetAction.sourceAvailableTroops,
                                    committedTroops: pendingTargetAction.committedTroops,
                                    attackPressure: pendingTargetAction.attackPressure,
                                    defaultValue: '本次出兵 {{committedTroops}}',
                                })}
                                {pendingTargetAction.boundaryUnitCap
                                    ? t('board.actions.pendingTarget.boundaryUnitCap', {
                                          count: pendingTargetAction.boundaryUnitCap,
                                          defaultValue: ' · 边界上限 {{count}}',
                                      })
                                    : ''}
                            </div>
                        ) : null}
                        {!core.pincerAdvanceSelection &&
                        !core.instigateDefectionSelection &&
                        !core.wuzhenChaohaSelection &&
                        getPendingCommittedTroopOptions(pendingTargetAction).length > 1 ? (
                            <div className="mt-2 text-[11px]" data-testid="qidahen-pending-committed-troops">
                                <span className="mr-1" style={{ color: '#f3d1a5' }}>
                                    {t('board.actions.pendingTarget.actualCommittedTroopsMapFirst', {
                                        defaultValue: '实际出兵：点击地图上的源地区兵牌切换数量',
                                    })}
                                </span>
                                <span className="sr-only">
                                    {getPendingCommittedTroopOptions(pendingTargetAction).map((committedTroops) => (
                                        <button
                                            key={committedTroops}
                                            type="button"
                                            data-testid={`qidahen-pending-committed-${committedTroops}`}
                                            onClick={() => onSelectPendingCommittedTroops(committedTroops)}
                                        >
                                            {committedTroops}
                                        </button>
                                    ))}
                                </span>
                            </div>
                        ) : null}
                        {!core.pincerAdvanceSelection &&
                        !core.instigateDefectionSelection &&
                        !core.wuzhenChaohaSelection &&
                        hasStructuredCasualtyChoice(core, pendingTargetAction) ? (
                            <div
                                className="mt-2 space-y-1.5 text-[11px]"
                                data-testid="qidahen-pending-casualty-priority"
                            >
                                {[
                                    {
                                        id: 'attacker' as const,
                                        label: t('board.actions.pendingTarget.attackerCasualtyLabel', {
                                            defaultValue: '攻方承伤',
                                        }),
                                        selected: pendingAttackerCasualtyPriority,
                                        onSelect: onSelectPendingAttackerCasualtyPriority,
                                    },
                                    {
                                        id: 'defender' as const,
                                        label: t('board.actions.pendingTarget.defenderCasualtyLabel', {
                                            defaultValue: '守方承伤',
                                        }),
                                        selected: pendingDefenderCasualtyPriority,
                                        onSelect: onSelectPendingDefenderCasualtyPriority,
                                    },
                                ].map((group) => (
                                    <div
                                        key={group.id}
                                        className="flex flex-wrap items-center gap-1.5"
                                        data-testid={`qidahen-${group.id}-casualty-priority`}
                                    >
                                        <span className="mr-1" style={{ color: '#f3d1a5' }}>
                                            {group.label}
                                        </span>
                                        {[
                                            {
                                                id: 'highest-level' as const,
                                                label: t('board.actions.casualtyPriority.highestFirst', {
                                                    defaultValue: '高级先损',
                                                }),
                                            },
                                            {
                                                id: 'lowest-level' as const,
                                                label: t('board.actions.casualtyPriority.lowestFirst', {
                                                    defaultValue: '低级先损',
                                                }),
                                            },
                                        ].map((option) => {
                                            const selected = option.id === group.selected;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    data-testid={`qidahen-${group.id}-casualty-${option.id}`}
                                                    data-tutorial-id={`qidahen-${group.id}-casualty-${option.id}`}
                                                    className="inline-flex h-[28px] min-w-[54px] items-center justify-center border-[2px] px-2 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                                    onClick={() => group.onSelect(option.id)}
                                                    style={{
                                                        borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                                        background: selected
                                                            ? UI_SURFACE.mapPanelSelected
                                                            : UI_SURFACE.paper,
                                                        color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                                        boxShadow: selected
                                                            ? UI_SURFACE.mapPanelShadow
                                                            : UI_SURFACE.hardShadow,
                                                        borderRadius: 3,
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {core.wuzhenChaohaSelection ? (
                            <div className="mt-2" data-testid="qidahen-wuzhen-chaoha-selection">
                                <div className="mb-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                                    {t('board.actions.wuzhenChaoha.hint', {
                                        defaultValue: '点击绿色步兵牌，指定其提前在炮兵阶段攻击。',
                                    })}
                                </div>
                                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span style={{ color: '#f3d1a5' }}>
                                        {t('board.actions.wuzhenChaoha.artilleryTechLabel', {
                                            defaultValue: '销毁《火炮技术》：',
                                        })}
                                    </span>
                                    {Array.from(
                                        { length: core.wuzhenChaohaSelection.maxDestroyedArtilleryTechCount + 1 },
                                        (_, count) => count,
                                    ).map((count) => {
                                        const selected =
                                            count === core.wuzhenChaohaSelection?.destroyedArtilleryTechCount;
                                        return (
                                            <button
                                                key={count}
                                                type="button"
                                                data-testid={`qidahen-wuzhen-chaoha-artillery-tech-${count}`}
                                                className="inline-flex h-[28px] min-w-[34px] items-center justify-center border-[2px] px-2 text-[11px] font-black"
                                                onClick={() => onSetWuzhenChaohaArtilleryTechCount(count)}
                                                style={{
                                                    borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                                    background: selected
                                                        ? UI_SURFACE.mapPanelSelected
                                                        : UI_SURFACE.paper,
                                                    color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                                    boxShadow: selected
                                                        ? UI_SURFACE.mapPanelShadow
                                                        : UI_SURFACE.hardShadow,
                                                    borderRadius: 3,
                                                }}
                                            >
                                                {t('board.actions.wuzhenChaoha.artilleryTechCount', {
                                                    count,
                                                    defaultValue: '{{count}} 张',
                                                })}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    data-testid="qidahen-wuzhen-chaoha-cancel"
                                    className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black"
                                    onClick={onCancelWuzhenChaoha}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_SURFACE.paper,
                                        color: UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {t('board.actions.cancel', { defaultValue: '取消' })}
                                </button>
                            </div>
                        ) : core.instigateDefectionSelection ? (
                            <div className="mt-2" data-testid="qidahen-instigate-defection-selection">
                                <div className="mb-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                                    {t('board.actions.instigateDefection.hint', {
                                        defaultValue: '点击绿色兵牌选择要策反的敌方次级部队。',
                                    })}
                                </div>
                                <button
                                    type="button"
                                    data-testid="qidahen-instigate-defection-cancel"
                                    className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={onCancelInstigateDefection}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_SURFACE.paper,
                                        color: UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {t('board.actions.cancel', { defaultValue: '取消' })}
                                </button>
                            </div>
                        ) : core.pincerAdvanceSelection ? (
                            <div className="mt-2" data-testid="qidahen-pincer-advance-selection">
                                <div className="mb-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                                    {t('board.actions.pincerAdvance.hint', {
                                        selected: core.pincerAdvanceSelection.selectedChoiceIds.length,
                                        max: core.pincerAdvanceSelection.maxTroops,
                                        defaultValue: '点击绿色兵牌选择增援，已选 {{selected}}/{{max}}',
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        data-testid="qidahen-pincer-advance-confirm"
                                        disabled={core.pincerAdvanceSelection.selectedChoiceIds.length === 0}
                                        className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={onResolvePincerAdvance}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {t('board.actions.pincerAdvance.confirm', { defaultValue: '确认增援' })}
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="qidahen-pincer-advance-cancel"
                                        className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={onCancelPincerAdvance}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {t('board.actions.cancel', { defaultValue: '取消' })}
                                    </button>
                                </div>
                            </div>
                        ) : core.infantryCavalryCombinedSelection ? (
                            <div className="mt-2" data-testid="qidahen-infantry-cavalry-combined-selection">
                                <div className="mb-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                                    {t('board.actions.infantryCavalryCombined.hint', {
                                        defaultValue: '步骑联合：选择骑兵撤离，或让骑兵转入步兵阶段共同攻击。',
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        data-testid="qidahen-infantry-cavalry-combined-withdraw"
                                        className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onResolveInfantryCavalryCombined('withdraw-cavalry')}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {t('board.actions.infantryCavalryCombined.withdraw', {
                                            defaultValue: '骑兵撤离',
                                        })}
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="qidahen-infantry-cavalry-combined-joint-attack"
                                        className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onResolveInfantryCavalryCombined('joint-attack')}
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: UI_SURFACE.paper,
                                            color: UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {t('board.actions.infantryCavalryCombined.jointAttack', {
                                            defaultValue: '步骑联合攻击',
                                        })}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {pendingTargetChoiceOptions.map((choice) => {
                                    const consequence =
                                        choice.id === 'rear-guard'
                                            ? '撤退时最多损失 1 个幸存部队'
                                            : choice.id === 'rout'
                                              ? '撤退时损失全部幸存部队'
                                              : choice.id.startsWith('cavalry-evasion:')
                                                ? '骑兵退出本次战斗并撤往所选地区'
                                                : choice.id.startsWith('cavalry-plunder-')
                                                  ? '骑兵改为劫掠，不进入常规交战'
                                                  : choice.id === 'defender-hold-city'
                                                    ? '守军收入城内，直接进入城战'
                                                    : choice.id === 'defender-sortie'
                                                      ? '守军出城进行野战'
                                                      : null;
                                    return (
                                        <button
                                            key={choice.id}
                                            type="button"
                                            data-testid={getPendingTargetChoiceTestId(choice.id)}
                                            data-tutorial-id={getPendingTargetChoiceTestId(choice.id)}
                                            className="inline-flex min-h-[52px] flex-col items-start justify-center border-[3px] px-3 py-1.5 text-left text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                            onClick={() =>
                                                onResolvePendingAction(
                                                    choice.value,
                                                    pendingAttackerCasualtyPriority,
                                                    pendingDefenderCasualtyPriority,
                                                    pendingCommittedTroops,
                                                )
                                            }
                                            style={{
                                                minWidth: getPendingTargetChoiceMinWidth(choice.id),
                                                borderColor: UI_STYLE.mapInk,
                                                background: UI_SURFACE.paper,
                                                color: UI_STYLE.ink,
                                                boxShadow: UI_SURFACE.hardShadow,
                                                borderRadius: 3,
                                            }}
                                        >
                                            <span>{getQidahenFriendlyPendingChoiceLabel(choice)}</span>
                                            {consequence ? (
                                                <span
                                                    className="mt-0.5 text-[10px]"
                                                    style={{ color: UI_STYLE.mutedInk }}
                                                >
                                                    {consequence}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : null}
                {postBattleSelection ? (
                    <div
                        className="mt-3 border-[3px] px-3 py-2 text-[14px] font-black leading-6"
                        data-testid="qidahen-post-battle-selection"
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.mapPanelSelected,
                            color: UI_STYLE.mapIvory,
                            boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                            borderRadius: 3,
                        }}
                    >
                        <div>
                            {getQidahenFriendlyPostBattleTitle(postBattleSelection)} ·{' '}
                            {postBattleSelection.targetRegionName}
                            <span className="sr-only">{postBattleSelection.title}</span>
                        </div>
                        {postBattleSelection.battleRollSummary ? (
                            <div
                                className="mt-1 text-[11px]"
                                style={{ color: '#ffe5b3' }}
                                data-testid="qidahen-post-battle-roll-summary"
                            >
                                {normalizeQidahenBattleRollSummary(postBattleSelection.battleRollSummary)}
                            </div>
                        ) : null}
                        {postBattleSelection.battleRolls && postBattleMode == null ? (
                            <QidahenBattleRollDiceSummary battleRolls={postBattleSelection.battleRolls} />
                        ) : null}
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.actions.postBattle.summary', {
                                summary: postBattleSelection.summary,
                                survivingTroops: postBattleSelection.survivingTroops,
                                defaultValue: '{{summary}} · 幸存 {{survivingTroops}}',
                            })}
                        </div>
                        {postBattleMode == null ? (
                            <div
                                className="mt-3 grid grid-cols-3 gap-2"
                                data-testid="qidahen-post-battle-mode-selection"
                            >
                                {(['occupy', 'besiege', 'withdraw'] as const).map((mode) => {
                                    const choiceCount = postBattleSelection.choices.filter(
                                        (choice) => choice.mode === mode,
                                    ).length;
                                    if (choiceCount === 0) {
                                        return null;
                                    }
                                    const label =
                                        mode === 'occupy'
                                            ? t('board.actions.postBattle.modeOccupy', { defaultValue: '占领' })
                                            : mode === 'besiege'
                                              ? t('board.actions.postBattle.modeBesiege', { defaultValue: '围城' })
                                              : t('board.actions.postBattle.modeWithdraw', { defaultValue: '撤回' });
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            data-testid={`qidahen-post-battle-mode-${mode}`}
                                            data-tutorial-id={
                                                mode === 'besiege' ? 'qidahen-post-battle-choice-entry' : undefined
                                            }
                                            className="min-h-[52px] border-[3px] px-3 py-2 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                            onClick={() => setPostBattleMode(mode)}
                                            style={{
                                                borderColor: UI_STYLE.mapInk,
                                                background: UI_SURFACE.paper,
                                                color: UI_STYLE.ink,
                                                boxShadow: UI_SURFACE.hardShadow,
                                                borderRadius: 3,
                                            }}
                                        >
                                            <span className="block">{label}</span>
                                            <span
                                                className="mt-1 block text-[10px]"
                                                style={{ color: UI_STYLE.mutedInk }}
                                            >
                                                {t('board.actions.postBattle.choiceCount', {
                                                    count: choiceCount,
                                                    defaultValue: '{{count}} 种结果',
                                                })}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mt-3" data-testid={`qidahen-post-battle-mode-options-${postBattleMode}`}>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="text-[12px]" style={{ color: UI_STYLE.mapGold }}>
                                        {postBattleMode === 'occupy'
                                            ? t('board.actions.postBattle.occupyTitle', { defaultValue: '占领方式' })
                                            : postBattleMode === 'besiege'
                                              ? t('board.actions.postBattle.besiegeTitle', { defaultValue: '围城方式' })
                                              : t('board.actions.postBattle.withdrawTitle', {
                                                    defaultValue: '撤回路线',
                                                })}
                                    </div>
                                    <button
                                        type="button"
                                        className="min-h-[44px] border-[2px] px-3 text-[12px] font-black"
                                        onClick={() => {
                                            setPostBattleMode(null);
                                            setDraftPostBattleChoiceId(null);
                                        }}
                                        style={{
                                            borderColor: UI_STYLE.mapGold,
                                            color: UI_STYLE.mapIvory,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {t('board.actions.postBattle.back', { defaultValue: '返回' })}
                                    </button>
                                </div>
                                <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
                                    {postBattleModeChoices.map((choice) => {
                                        const selected = choice.id === draftPostBattleChoiceId;
                                        return (
                                            <button
                                                key={choice.id}
                                                type="button"
                                                aria-pressed={selected}
                                                data-testid={`qidahen-post-battle-choice-${choice.id}`}
                                                data-tutorial-id={
                                                    choice.id === 'besiege'
                                                        ? 'qidahen-post-battle-choice-entry'
                                                        : undefined
                                                }
                                                className="inline-flex min-h-[52px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                                onClick={() => setDraftPostBattleChoiceId(choice.id)}
                                                style={{
                                                    borderColor: selected ? UI_STYLE.cinnabar : UI_STYLE.mapInk,
                                                    background: selected ? UI_SURFACE.paperPressed : UI_SURFACE.paper,
                                                    color: UI_STYLE.ink,
                                                    boxShadow: UI_SURFACE.hardShadow,
                                                    borderRadius: 3,
                                                }}
                                            >
                                                <span className="min-w-0">
                                                    <span className="block text-[13px]">{choice.label}</span>
                                                    <span
                                                        className="mt-1 block text-[11px]"
                                                        style={{ color: UI_STYLE.mutedInk }}
                                                    >
                                                        {choice.detail}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    data-testid="qidahen-post-battle-confirm"
                                    disabled={!draftPostBattleChoice}
                                    className="mt-3 min-h-[44px] w-full border-[3px] px-4 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                                    onClick={() => {
                                        if (draftPostBattleChoice) {
                                            onResolvePostBattleDecision(draftPostBattleChoice.id);
                                        }
                                    }}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: UI_STYLE.cinnabar,
                                        color: UI_STYLE.mapIvory,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {t('board.actions.postBattle.confirm', { defaultValue: '确认战后处理' })}
                                </button>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
            {showActionRail ? (
                <div className="mt-3 shrink-0">
                    <div className="flex flex-col items-end gap-2" data-testid="qidahen-action-rail">
                        {visibleActionChoices.map((action) => (
                            <ActionButton
                                key={action.id}
                                action={action}
                                focused={core.selectedActionId === action.id}
                                engaged={engagedActionId === action.id}
                                disabled={
                                    pendingScenarioChoices ||
                                    core.factionActionUsed ||
                                    !(
                                        isTutorialCommandAllowed?.(
                                            action.cost > 0
                                                ? QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION
                                                : QIDAHEN_COMMANDS.EXECUTE_ACTION,
                                        ) ?? true
                                    )
                                }
                                onClick={() => onExecuteAction(action.id)}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
