import React from 'react';
import { useTranslation } from 'react-i18next';
import { QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED } from '../domain/wheelDispatchPayment';
import type { QidahenHandInteractionView } from './handInteractionView';
import { UI_STYLE, UI_SURFACE } from './qidahenTheme';
import { QidahenHoverTip } from './QidahenHoverTip';

interface Props {
    interaction: QidahenHandInteractionView | null;
    bottom: number;
    onResolveHandLimitDiscard: () => void;
    onConfirmSelectedAction: () => void;
    onCancelSelectedActionPreview: () => void;
    onResolveSunYuanhuaTech: (decision: 'confirm' | 'skip') => void;
    onConfirmWheelDispatchPayment: () => void;
    onConfirmWheelRecruitTrainPayment: () => void;
}

const BUTTON_CLASS = 'inline-flex min-h-[44px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0';

/** 所有手牌确认共用同一个托盘；规则判定由只读投影和原命令入口负责。 */
export const QidahenHandInteractionTray: React.FC<Props> = ({ interaction, bottom, ...actions }) => {
    const { t } = useTranslation('game-qidahen');
    const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);
    if (!interaction) return null;

    let title: string;
    let status: string;
    let statusTestId: string | undefined;
    let selectedCardsTestId: string | undefined;
    let panelTestId: string;
    let confirmTestId: string;
    let confirmLabel = t('board.handInteraction.confirmDiscard', { defaultValue: '确认弃牌' });
    let onConfirm: () => void;
    let secondary: { testId: string; label: string; onClick: () => void } | undefined;

    switch (interaction.kind) {
        case 'wheel-dispatch':
            panelTestId = 'qidahen-wheel-dispatch-payment-panel';
            statusTestId = 'qidahen-wheel-dispatch-payment-status';
            selectedCardsTestId = 'qidahen-wheel-dispatch-payment-selected-cards';
            confirmTestId = 'qidahen-wheel-dispatch-payment-confirm';
            title = t('board.handInteraction.wheelDispatchPaymentTitle', { defaultValue: '进攻调度 · 弃牌' });
            status = t('board.handInteraction.wheelDispatchPaymentStatus', {
                required: QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED, selected: interaction.selectedCount,
                defaultValue: '需弃 {{required}} 张 · 已选 {{selected}} 张',
            });
            onConfirm = actions.onConfirmWheelDispatchPayment;
            break;
        case 'wheel-recruit-train':
            panelTestId = 'qidahen-wheel-recruit-train-payment-panel';
            statusTestId = 'qidahen-wheel-recruit-train-payment-status';
            selectedCardsTestId = 'qidahen-wheel-recruit-train-selected-card';
            confirmTestId = 'qidahen-wheel-recruit-train-payment-confirm';
            title = interaction.extraTraining
                ? t('board.wheelRecruitTrain.extraPaymentTitle', { defaultValue: '额外训练 · 弃牌' })
                : t('board.wheelRecruitTrain.paymentTitle', { defaultValue: '征兵训练 · 弃牌' });
            status = interaction.extraTraining
                ? t('board.wheelRecruitTrain.extraPaymentStatus', { defaultValue: '额外弃 1 张手牌，增加 1 次训练。' })
                : t('board.wheelRecruitTrain.paymentStatus', { defaultValue: '弃 1 张手牌，最多进行 4 次征兵或训练。' });
            onConfirm = actions.onConfirmWheelRecruitTrainPayment;
            break;
        case 'action':
            panelTestId = 'qidahen-action-payment-panel';
            statusTestId = 'qidahen-action-payment-status';
            selectedCardsTestId = 'qidahen-action-payment-selected-cards';
            confirmTestId = 'qidahen-action-payment-confirm';
            title = interaction.action.label;
            status = interaction.action.id === 'upgrade-armament'
                ? t('board.handInteraction.armamentPaymentStatus', {
                    cost: interaction.action.cost, selected: interaction.selectedCount,
                    defaultValue: '已选 {{selected}} / 2 · 含 1 张军备牌 + 弃 1 张手牌',
                })
                : t('board.handInteraction.actionPaymentStatus', {
                    cost: interaction.action.cost, selected: interaction.selectedCount,
                    defaultValue: '需弃 {{cost}} 张 · 已选 {{selected}} 张',
                });
            confirmLabel = interaction.action.id === 'upgrade-armament'
                ? t('board.handInteraction.confirmUseArmament', { defaultValue: '使用并升级' })
                : t('board.handInteraction.confirmExecute', { defaultValue: '确认执行' });
            onConfirm = actions.onConfirmSelectedAction;
            secondary = {
                testId: 'qidahen-action-payment-cancel',
                label: t('board.handInteraction.cancelAction', { defaultValue: '取消本次行动' }),
                onClick: actions.onCancelSelectedActionPreview,
            };
            break;
        case 'hand-limit':
            panelTestId = 'qidahen-hand-limit-discard-selection';
            confirmTestId = 'qidahen-resolve-hand-limit-discard';
            title = t('board.handInteraction.handLimitTitle', {
                factionName: interaction.selection.factionName, defaultValue: '{{factionName}} · 检查手牌上限',
            });
            status = t('board.handInteraction.handLimitStatus', {
                ...interaction.selection, selected: interaction.selectedCount,
                defaultValue: '手牌 {{handCount}}/{{handLimit}} · 需弃 {{requiredDiscardCount}} · 已择 {{selected}}',
            });
            onConfirm = actions.onResolveHandLimitDiscard;
            break;
        case 'sun-yuanhua':
            panelTestId = 'qidahen-sun-yuanhua-tech-selection';
            confirmTestId = 'qidahen-sun-yuanhua-tech-confirm';
            title = interaction.title;
            status = t('board.handInteraction.sunYuanhuaStatus', {
                requiredCardCount: interaction.requiredCardCount, selected: interaction.selectedCount,
                defaultValue: '需弃 {{requiredCardCount}} 张 · 已择 {{selected}}',
            });
            confirmLabel = t('board.handInteraction.confirmSunYuanhua', { defaultValue: '确认打科技' });
            onConfirm = () => actions.onResolveSunYuanhuaTech('confirm');
            secondary = {
                testId: 'qidahen-sun-yuanhua-tech-skip',
                label: t('board.handInteraction.skipSunYuanhua', { defaultValue: '跳过孙元化科技' }),
                onClick: () => actions.onResolveSunYuanhuaTech('skip'),
            };
            break;
    }

    const payment = 'selectedCardLabels' in interaction;
    return (
        <>
        <div ref={setAnchor} aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-0" style={{ bottom }} />
        <QidahenHoverTip
            open anchor={anchor} placement="above" variant="panel" width={860} gap={0}
            testId="qidahen-hand-interaction-tray"
            data-hand-interaction-kind={interaction.kind}
            data-hand-interaction-action={interaction.kind === 'action' ? interaction.action.id : undefined}
        >
            <div
                className="pointer-events-auto flex items-center justify-between gap-4 border-[3px] px-4 py-3"
                data-testid={panelTestId}
                data-tutorial-id={interaction.kind === 'wheel-recruit-train' ? panelTestId : undefined}
                data-ui-anchor="bottom-hand"
                style={{
                    width: '100%',
                    borderColor: payment ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                    background: UI_SURFACE.mapPanelSelected,
                    color: UI_STYLE.mapIvory,
                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                    borderRadius: 3,
                }}
            >
                <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-black leading-5">{title}</div>
                    <div className="mt-1 text-[14px]" data-testid={statusTestId} style={{ color: payment ? UI_STYLE.mapGold : '#f3d1a5' }}>
                        {status}
                    </div>
                    {payment && interaction.selectedCardLabels.length > 0 ? (
                        <div className="mt-1 text-[14px] font-black" data-testid={selectedCardsTestId} style={{ color: '#fff0b0' }}>
                            {t('board.handInteraction.actionPaymentSelectedCards', {
                                cards: interaction.selectedCardLabels.join('、'), defaultValue: '已选：{{cards}}',
                            })}
                        </div>
                    ) : null}
                    {interaction.kind === 'action' && interaction.action.id === 'raid' ? (
                        <div className="mt-1 text-[14px]" data-testid="qidahen-action-payment-hint" style={{ color: '#f3d1a5' }}>
                            {interaction.raidTarget
                                ? t('board.handInteraction.raidPaymentTarget', {
                                    ...interaction.raidTarget, defaultValue: '目标：{{targetRegionName}} · {{resolutionHint}}',
                                })
                                : t('board.handInteraction.raidPaymentInvalidTarget', {
                                    defaultValue: '在地图上选择目标地区',
                                })}
                        </div>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        data-testid={confirmTestId}
                        disabled={!interaction.canConfirm}
                        className={BUTTON_CLASS}
                        onClick={onConfirm}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        {confirmLabel}
                    </button>
                    {secondary ? (
                        <button
                            type="button"
                            data-testid={secondary.testId}
                            className={BUTTON_CLASS}
                            onClick={secondary.onClick}
                            style={{ borderColor: UI_STYLE.mapGold, background: 'transparent', color: UI_STYLE.mapIvory, borderRadius: 3 }}
                        >
                            {secondary.label}
                        </button>
                    ) : null}
                </div>
            </div>
        </QidahenHoverTip>
        </>
    );
};
