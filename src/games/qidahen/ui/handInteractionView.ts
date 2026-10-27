import type { QidahenActionChoice, QidahenCore, QidahenHandLimitDiscardSelection } from '../domain/types';
import { getActionChoiceById } from '../domain/factionActionWindow';
import { getCurrentFactionId } from '../domain/factionTurnAccessors';
import { getExplicitRaidTargetAction } from '../domain/pendingTargetActionBuilder';
import { isQidahenWheelDispatchPaymentPending, QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED } from '../domain/wheelDispatchPayment';
import { isQidahenWheelRecruitTrainPaymentPending } from '../domain/wheelRecruitTrain';

type PaymentCards = {
    selectedCardLabels: string[];
    selectedCount: number;
    canConfirm: boolean;
};

export type QidahenHandInteractionView =
    | (PaymentCards & { kind: 'wheel-dispatch' })
    | (PaymentCards & { kind: 'wheel-recruit-train'; extraTraining: boolean })
    | (PaymentCards & {
        kind: 'action';
        action: Pick<QidahenActionChoice, 'id' | 'label' | 'cost'>;
        raidTarget: { targetRegionName: string; resolutionHint: string } | null;
    })
    | {
        kind: 'hand-limit';
        selection: Pick<QidahenHandLimitDiscardSelection, 'factionName' | 'handCount' | 'handLimit' | 'requiredDiscardCount'>;
        selectedCount: number;
        canConfirm: boolean;
    }
    | {
        kind: 'sun-yuanhua';
        title: string;
        requiredCardCount: number;
        selectedCount: number;
        canConfirm: boolean;
    };

/** 只投影当前手牌决策，不保存副本，也不支付或推进游戏状态。 */
export const resolveQidahenHandInteraction = (
    core: QidahenCore,
    actionPaymentPreviewVisible: boolean,
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null,
    selectedHandLimitCardIds: readonly string[],
): QidahenHandInteractionView | null => {
    const selectedCount = core.selectedPaymentCardIds.length;
    const selectedCardLabels = core.selectedPaymentCardIds.map((cardId) => (
        core.handCards.find((card) => card.id === cardId)?.label ?? cardId
    ));

    if (isQidahenWheelDispatchPaymentPending(core)) {
        return {
            kind: 'wheel-dispatch', selectedCardLabels, selectedCount,
            canConfirm: selectedCount >= QIDAHEN_WHEEL_DISPATCH_PAYMENT_REQUIRED,
        };
    }
    if (isQidahenWheelRecruitTrainPaymentPending(core)) {
        return {
            kind: 'wheel-recruit-train', selectedCardLabels, selectedCount,
            extraTraining: core.wheelRecruitTrainProgress?.paymentPurpose === 'extra',
            canConfirm: selectedCount === 1,
        };
    }

    const action = actionPaymentPreviewVisible && core.selectedActionId
        ? [getActionChoiceById(core.selectedActionId), ...core.actionChoices]
            .find((choice) => choice?.id === core.selectedActionId && choice.cost > 0)
        : null;
    if (action) {
        const raidTarget = action.id === 'raid'
            ? getExplicitRaidTargetAction(core, getCurrentFactionId(core))
            : null;
        return {
            kind: 'action', action: { id: action.id, label: action.label, cost: action.cost },
            selectedCardLabels, selectedCount,
            raidTarget: raidTarget ? { targetRegionName: raidTarget.targetRegionName, resolutionHint: raidTarget.resolutionHint } : null,
            canConfirm: selectedCount >= action.cost && (action.id !== 'raid' || raidTarget != null),
        };
    }
    if (handLimitDiscardSelection) {
        return {
            kind: 'hand-limit',
            selection: {
                factionName: handLimitDiscardSelection.factionName,
                handCount: handLimitDiscardSelection.handCount,
                handLimit: handLimitDiscardSelection.handLimit,
                requiredDiscardCount: handLimitDiscardSelection.requiredDiscardCount,
            },
            selectedCount: selectedHandLimitCardIds.length,
            canConfirm: selectedHandLimitCardIds.length >= handLimitDiscardSelection.requiredDiscardCount,
        };
    }
    const tech = core.sunYuanhuaTechSelection;
    if (tech) {
        return {
            kind: 'sun-yuanhua', title: tech.title, requiredCardCount: tech.requiredCardCount,
            selectedCount: tech.selectedCardIds.length,
            canConfirm: tech.selectedCardIds.length >= tech.requiredCardCount,
        };
    }
    return null;
};
