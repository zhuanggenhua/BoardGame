import React from 'react';
import type { QidahenCore, QidahenHandLimitDiscardSelection } from '../domain';
import { useTranslation } from 'react-i18next';
import {
    isQidahenWheelDispatchPaymentPending,
    QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED,
} from '../domain/wheelDispatchPayment';
import { getActionChoiceById } from '../domain/factionActionWindow';
import { buildPendingTargetAction } from '../domain/pendingTargetActionBuilder';
import { getCurrentFactionId } from '../domain/factionTurnAccessors';
import { HAND_INTERACTION_TRAY_BOTTOM, HAND_INTERACTION_TRAY_WIDTH, UI_STYLE, UI_SURFACE } from './boardLayout';

export const HandInteractionTray: React.FC<{
    core: QidahenCore;
    actionPaymentPreviewVisible: boolean;
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null;
    selectedHandLimitCardIds: string[];
    confirmTutorialLocked?: boolean;
    cancelTutorialLocked?: boolean;
    onResolveHandLimitDiscard: () => void;
    onConfirmSelectedAction: () => void;
    onCancelSelectedActionPreview: () => void;
    onResolveSunYuanhuaTech: (decision: 'confirm' | 'skip') => void;
    onConfirmWheelDispatchPayment: () => void;
}> = ({
    core,
    actionPaymentPreviewVisible,
    handLimitDiscardSelection,
    selectedHandLimitCardIds,
    confirmTutorialLocked = false,
    cancelTutorialLocked = false,
    onResolveHandLimitDiscard,
    onConfirmSelectedAction,
    onCancelSelectedActionPreview,
    onResolveSunYuanhuaTech,
    onConfirmWheelDispatchPayment,
}) => {
    const { t } = useTranslation('game-qidahen');
    const wheelDispatchPaymentPending = isQidahenWheelDispatchPaymentPending(core);
    const selectedAction =
        !wheelDispatchPaymentPending && actionPaymentPreviewVisible && core.selectedActionId
            ? ([getActionChoiceById(core.selectedActionId), ...core.actionChoices].find(
                  (action) => action?.id === core.selectedActionId && action.cost > 0,
              ) ?? null)
            : null;
    const sunYuanhuaSelection = core.sunYuanhuaTechSelection;
    const selectedPaymentRegionId = core.explicitRegionId ?? core.selectedRegionId;
    const selectedPaymentRegion = core.regions.find((region) => region.id === selectedPaymentRegionId);
    const raidPaymentPreview =
        selectedAction?.id === 'raid' && selectedPaymentRegion
            ? buildPendingTargetAction(
                  core,
                  getCurrentFactionId(core),
                  'raid',
                  selectedPaymentRegion,
                  selectedPaymentRegionId,
              )
            : null;

    if (wheelDispatchPaymentPending) {
        return (
            <div
                className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
                data-testid="qidahen-hand-interaction-tray"
                style={{ bottom: HAND_INTERACTION_TRAY_BOTTOM }}
            >
                <div
                    className="pointer-events-auto flex items-center justify-between gap-4 border-[3px] px-4 py-3"
                    data-testid="qidahen-wheel-dispatch-payment-panel"
                    data-ui-anchor="bottom-hand"
                    style={{
                        width: HAND_INTERACTION_TRAY_WIDTH,
                        borderColor: UI_STYLE.oldGold,
                        background: UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black leading-5">
                            {t('board.handInteraction.wheelDispatchPaymentTitle', { defaultValue: '进攻调度 · 弃牌' })}
                        </div>
                        <div
                            className="mt-1 text-[11px]"
                            data-testid="qidahen-wheel-dispatch-payment-status"
                            style={{ color: UI_STYLE.mapGold }}
                        >
                            {t('board.handInteraction.wheelDispatchPaymentStatus', {
                                required: QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED,
                                selected: core.selectedPaymentCardIds.length,
                                defaultValue: '需弃 {{required}} 张 · 已选 {{selected}} 张',
                            })}
                        </div>
                        {core.selectedPaymentCardIds.length > 0 ? (
                            <div
                                className="mt-1 text-[11px] font-black"
                                data-testid="qidahen-wheel-dispatch-payment-selected-cards"
                                style={{ color: '#fff0b0' }}
                            >
                                {t('board.handInteraction.actionPaymentSelectedCards', {
                                    cards: core.selectedPaymentCardIds
                                        .map(
                                            (cardId) =>
                                                core.handCards.find((card) => card.id === cardId)?.label ?? cardId,
                                        )
                                        .join('、'),
                                    defaultValue: '已选：{{cards}}',
                                })}
                            </div>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        data-testid="qidahen-wheel-dispatch-payment-confirm"
                        disabled={
                            confirmTutorialLocked ||
                            core.selectedPaymentCardIds.length < QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED
                        }
                        className="inline-flex min-h-[44px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                        onClick={onConfirmWheelDispatchPayment}
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.paper,
                            color: UI_STYLE.ink,
                            boxShadow: UI_SURFACE.hardShadow,
                            borderRadius: 3,
                        }}
                    >
                        {t('board.handInteraction.confirmDiscard', { defaultValue: '确认弃牌' })}
                    </button>
                </div>
            </div>
        );
    }

    if (!selectedAction && !handLimitDiscardSelection && !sunYuanhuaSelection) {
        return null;
    }

    if (selectedAction) {
        return (
            <div
                className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
                data-testid="qidahen-hand-interaction-tray"
                style={{ bottom: HAND_INTERACTION_TRAY_BOTTOM }}
            >
                <div
                    className="pointer-events-auto flex items-center justify-between gap-4 border-[3px] px-4 py-3"
                    data-testid="qidahen-action-payment-panel"
                    data-ui-anchor="bottom-hand"
                    style={{
                        width: HAND_INTERACTION_TRAY_WIDTH,
                        borderColor: UI_STYLE.oldGold,
                        background: UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black leading-5">{selectedAction.label}</div>
                        <div
                            className="mt-1 text-[11px]"
                            data-testid="qidahen-action-payment-status"
                            style={{ color: UI_STYLE.mapGold }}
                        >
                            {selectedAction.id === 'upgrade-armament'
                                ? t('board.handInteraction.armamentPaymentStatus', {
                                      cost: selectedAction.cost,
                                      selected: core.selectedPaymentCardIds.length,
                                      defaultValue: '已选 {{selected}} / 2 · 含 1 张军备牌 + 弃 1 张手牌',
                                  })
                                : t('board.handInteraction.actionPaymentStatus', {
                                      cost: selectedAction.cost,
                                      selected: core.selectedPaymentCardIds.length,
                                      defaultValue: '需弃 {{cost}} 张 · 已选 {{selected}} 张',
                                  })}
                        </div>
                        {core.selectedPaymentCardIds.length > 0 ? (
                            <div
                                className="mt-1 text-[11px] font-black"
                                data-testid="qidahen-action-payment-selected-cards"
                                style={{ color: '#fff0b0' }}
                            >
                                {t('board.handInteraction.actionPaymentSelectedCards', {
                                    cards: core.selectedPaymentCardIds
                                        .map(
                                            (cardId) =>
                                                core.handCards.find((card) => card.id === cardId)?.label ?? cardId,
                                        )
                                        .join('、'),
                                    defaultValue: '已选：{{cards}}',
                                })}
                            </div>
                        ) : null}
                        {selectedAction.id === 'raid' ? (
                            <div
                                className="mt-1 text-[11px]"
                                data-testid="qidahen-action-payment-hint"
                                style={{ color: '#f3d1a5' }}
                            >
                                {raidPaymentPreview
                                    ? t('board.handInteraction.raidPaymentTarget', {
                                          targetRegionName: raidPaymentPreview.targetRegionName,
                                          resolutionHint: raidPaymentPreview.resolutionHint,
                                          defaultValue: '目标：{{targetRegionName}} · {{resolutionHint}}',
                                      })
                                    : t('board.handInteraction.raidPaymentInvalidTarget', {
                                          defaultValue: '当前地区不能发动突袭，请在地图上选择高亮的合法目标',
                                      })}
                            </div>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            data-testid="qidahen-action-payment-confirm"
                            disabled={
                                confirmTutorialLocked ||
                                core.selectedPaymentCardIds.length < selectedAction.cost ||
                                (selectedAction.id === 'raid' && !raidPaymentPreview)
                            }
                            className="inline-flex min-h-[44px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                            onClick={onConfirmSelectedAction}
                            style={{
                                borderColor: UI_STYLE.mapInk,
                                background: UI_SURFACE.paper,
                                color: UI_STYLE.ink,
                                boxShadow: UI_SURFACE.hardShadow,
                                borderRadius: 3,
                            }}
                        >
                            {selectedAction.id === 'upgrade-armament'
                                ? t('board.handInteraction.confirmUseArmament', { defaultValue: '使用并升级' })
                                : t('board.handInteraction.confirmExecute', { defaultValue: '确认执行' })}
                        </button>
                        <button
                            type="button"
                            data-testid="qidahen-action-payment-cancel"
                            disabled={cancelTutorialLocked}
                            className="inline-flex min-h-[44px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={onCancelSelectedActionPreview}
                            style={{
                                borderColor: UI_STYLE.mapInk,
                                background: UI_SURFACE.paper,
                                color: UI_STYLE.ink,
                                boxShadow: UI_SURFACE.hardShadow,
                                borderRadius: 3,
                            }}
                        >
                            {t('board.handInteraction.cancelAction', { defaultValue: '取消本次行动' })}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (handLimitDiscardSelection) {
        return (
            <div
                className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
                data-testid="qidahen-hand-interaction-tray"
                style={{ bottom: HAND_INTERACTION_TRAY_BOTTOM }}
            >
                <div
                    className="pointer-events-auto flex items-center justify-between gap-4 border-[3px] px-4 py-3"
                    data-testid="qidahen-hand-limit-discard-selection"
                    data-ui-anchor="bottom-hand"
                    style={{
                        width: HAND_INTERACTION_TRAY_WIDTH,
                        borderColor: UI_STYLE.mapInk,
                        background: UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black leading-5">
                            {t('board.handInteraction.handLimitTitle', {
                                factionName: handLimitDiscardSelection.factionName,
                                defaultValue: '{{factionName}} · 检查手牌上限',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.handInteraction.handLimitStatus', {
                                handCount: handLimitDiscardSelection.handCount,
                                handLimit: handLimitDiscardSelection.handLimit,
                                requiredDiscardCount: handLimitDiscardSelection.requiredDiscardCount,
                                selected: selectedHandLimitCardIds.length,
                                defaultValue:
                                    '手牌 {{handCount}}/{{handLimit}} · 需弃 {{requiredDiscardCount}} · 已择 {{selected}}',
                            })}
                        </div>
                    </div>
                    <button
                        type="button"
                        data-testid="qidahen-resolve-hand-limit-discard"
                        disabled={selectedHandLimitCardIds.length < handLimitDiscardSelection.requiredDiscardCount}
                        className="inline-flex min-h-[40px] min-w-[152px] shrink-0 items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                        onClick={onResolveHandLimitDiscard}
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.paper,
                            color: UI_STYLE.ink,
                            boxShadow: UI_SURFACE.hardShadow,
                            borderRadius: 3,
                        }}
                    >
                        {t('board.handInteraction.confirmDiscard', { defaultValue: '确认弃牌' })}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
            data-testid="qidahen-hand-interaction-tray"
            style={{ bottom: HAND_INTERACTION_TRAY_BOTTOM }}
        >
            <div
                className="pointer-events-auto flex items-center justify-between gap-4 border-[3px] px-4 py-3"
                data-testid="qidahen-sun-yuanhua-tech-selection"
                data-ui-anchor="bottom-hand"
                style={{
                    width: HAND_INTERACTION_TRAY_WIDTH,
                    borderColor: UI_STYLE.mapInk,
                    background: UI_SURFACE.mapPanelSelected,
                    color: UI_STYLE.mapIvory,
                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                    borderRadius: 3,
                }}
            >
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-black leading-5">{sunYuanhuaSelection!.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {t('board.handInteraction.sunYuanhuaStatus', {
                            requiredCardCount: sunYuanhuaSelection!.requiredCardCount,
                            selected: sunYuanhuaSelection!.selectedCardIds.length,
                            defaultValue: '需弃 {{requiredCardCount}} 张 · 已择 {{selected}}',
                        })}
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        data-testid="qidahen-sun-yuanhua-tech-confirm"
                        disabled={sunYuanhuaSelection!.selectedCardIds.length < sunYuanhuaSelection!.requiredCardCount}
                        className="inline-flex min-h-[40px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                        onClick={() => onResolveSunYuanhuaTech('confirm')}
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.paper,
                            color: UI_STYLE.ink,
                            boxShadow: UI_SURFACE.hardShadow,
                            borderRadius: 3,
                        }}
                    >
                        {t('board.handInteraction.confirmSunYuanhua', { defaultValue: '确认打科技' })}
                    </button>
                    <button
                        type="button"
                        data-testid="qidahen-sun-yuanhua-tech-skip"
                        className="inline-flex min-h-[40px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                        onClick={() => onResolveSunYuanhuaTech('skip')}
                        style={{
                            borderColor: UI_STYLE.mapInk,
                            background: UI_SURFACE.paper,
                            color: UI_STYLE.ink,
                            boxShadow: UI_SURFACE.hardShadow,
                            borderRadius: 3,
                        }}
                    >
                        {t('board.handInteraction.skipSunYuanhua', { defaultValue: '跳过孙元化科技' })}
                    </button>
                </div>
            </div>
        </div>
    );
};
