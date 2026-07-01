import {
    buildPaymentState,
    getActionChoicesForFaction,
    getDefaultActionIdForFaction,
} from './factionActionWindow';
import { buildQidahenWheelMoveSummary } from './wheelMoves';
import type {
    QidahenCore,
    QidahenFactionId,
} from './types';

interface QidahenActionWindowEntryStateOptions {
    selectedRegionId: string;
    selectedWheelMoveId?: string;
}

export const buildQidahenActionWindowEntryState = (
    factionId: QidahenFactionId,
    options: QidahenActionWindowEntryStateOptions,
): Pick<
QidahenCore,
| 'turnPhase'
| 'wheelActionUsed'
| 'factionActionUsed'
| 'bonusFactionActionAvailable'
| 'bonusFactionActionUsed'
| 'lastFactionActionId'
| 'selectedWheelMoveId'
| 'wheelMoveSummary'
| 'selectedRegionId'
| 'explicitRegionId'
| 'selectedActionId'
| 'confirmedActionId'
| 'selectedPaymentCardIds'
| 'recruitSelection'
| 'maShiTradeSelection'
| 'khanEdictSelection'
| 'diplomacyProgress'
| 'handLimitDiscardSelection'
| 'sunYuanhuaTechSelection'
| 'gaoDiDispatchSelection'
| 'wheelDispatchProgress'
| 'pendingTargetAction'
| 'postBattleSelection'
| 'lastCharacterActionWindowTriggerKey'
| 'actionChoices'
| 'payment'
> => {
    const selectedWheelMoveId = options.selectedWheelMoveId ?? 'move-1-free';
    const selectedActionId = getDefaultActionIdForFaction(factionId);
    return {
        turnPhase: 'action-window',
        wheelActionUsed: false,
        factionActionUsed: false,
        bonusFactionActionAvailable: false,
        bonusFactionActionUsed: false,
        lastFactionActionId: null,
        selectedWheelMoveId,
        wheelMoveSummary: buildQidahenWheelMoveSummary(selectedWheelMoveId),
        selectedRegionId: options.selectedRegionId,
        explicitRegionId: null,
        selectedActionId,
        confirmedActionId: null,
        selectedPaymentCardIds: [],
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        handLimitDiscardSelection: null,
        sunYuanhuaTechSelection: null,
        gaoDiDispatchSelection: null,
        wheelDispatchProgress: null,
        pendingTargetAction: null,
        postBattleSelection: null,
        lastCharacterActionWindowTriggerKey: null,
        actionChoices: getActionChoicesForFaction(factionId),
        payment: buildPaymentState(selectedActionId, 0),
    };
};
