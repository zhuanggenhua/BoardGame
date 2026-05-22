import type { CardPreviewRef } from '../../../core/types';
import type { Command, GameEvent, PlayerId } from '../../../engine/types';

export type QidahenFactionId = 'ming' | 'mongol' | 'jin';

export interface QidahenFactionState {
    id: QidahenFactionId;
    playerId: PlayerId;
    name: string;
    colorClass: string;
    vp: number;
    troops: number;
    grain: number;
    landTax: number;
    handLimit: number;
    handCount: number;
    actionDiamonds: number;
}

export interface QidahenRegionSummary {
    id: string;
    name: string;
    controller: QidahenFactionId | 'neutral';
    x: number;
    y: number;
    troops: number;
    population: number;
    controlLabel: string;
    note: string;
}

export interface QidahenActionChoice {
    id: string;
    label: string;
    cost: number;
    detail: string;
}

export interface QidahenWheelMoveChoice {
    id: string;
    label: string;
    steps: number;
    drawText: string;
}

export interface QidahenPendingTargetAction {
    actionId: 'raid' | 'marriage-subjugation';
    title: string;
    targetRegionId: string;
    targetRegionName: string;
    defenderFactionId: QidahenFactionId | 'neutral';
    defenderLabel: string;
    restriction: string;
}

export interface QidahenYearCardSlot {
    id: string;
    label: string;
    previewRef: CardPreviewRef;
}

export interface QidahenPaymentState {
    required: number;
    selected: number;
    prompt: string;
}

export interface QidahenHandCard {
    id: string;
    label: string;
    previewRef: CardPreviewRef;
    accent: QidahenFactionId | 'neutral';
    status: 'idle' | 'selected' | 'payable' | 'disabled';
}

export interface QidahenMapToken {
    id: string;
    x: number;
    y: number;
    type: 'army' | 'population' | 'control';
    faction: QidahenFactionId | 'neutral';
    imageSrc?: string;
    size?: number;
    value?: number;
}

export interface QidahenRouteLine {
    id: string;
    tone: 'red' | 'blue';
    points: Array<{
        x: number;
        y: number;
    }>;
}

export interface QidahenLogEntry {
    id: string;
    faction: QidahenFactionId;
    text: string;
}

export interface QidahenCore {
    playerIds: PlayerId[];
    currentPlayer: PlayerId;
    currentYear: string;
    turnLabel: string;
    actionWheelPosition: string;
    selectedWheelMoveId: string;
    wheelMoveChoices: QidahenWheelMoveChoice[];
    wheelMoveSummary: string;
    selectedRegionId: string;
    selectedActionId: string;
    selectedPaymentCardIds: string[];
    pendingTargetAction: QidahenPendingTargetAction | null;
    factions: Record<QidahenFactionId, QidahenFactionState>;
    regions: QidahenRegionSummary[];
    actionChoices: QidahenActionChoice[];
    yearCards: QidahenYearCardSlot[];
    payment: QidahenPaymentState;
    koreaDeckCount: number;
    koreaDiscardCount: number;
    koreaDiscardPreviewRef: CardPreviewRef;
    drawPileCount: number;
    discardPileCount: number;
    handCards: QidahenHandCard[];
    mapTokens: QidahenMapToken[];
    routeLines: QidahenRouteLine[];
    actionLog: QidahenLogEntry[];
}

export interface SelectRegionCommand extends Command<'SELECT_REGION'> {
    payload: {
        regionId: string;
    };
}

export interface ConfirmPreviewActionCommand extends Command<'CONFIRM_PREVIEW_ACTION'> {
    payload: {
        actionId: string;
    };
}

export interface SelectWheelMoveCommand extends Command<'SELECT_WHEEL_MOVE'> {
    payload: {
        moveId: string;
    };
}

export interface ExecuteWheelMoveCommand extends Command<'EXECUTE_WHEEL_MOVE'> {
    payload: {
        moveId: string;
    };
}

export interface SelectPaymentCardCommand extends Command<'SELECT_PAYMENT_CARD'> {
    payload: {
        cardId: string;
    };
}

export interface ExecuteSelectedActionCommand extends Command<'EXECUTE_SELECTED_ACTION'> {
    payload: Record<string, never>;
}

export interface ExecuteActionCommand extends Command<'EXECUTE_ACTION'> {
    payload: {
        actionId: string;
    };
}

export type QidahenCommand =
    | SelectRegionCommand
    | ConfirmPreviewActionCommand
    | SelectWheelMoveCommand
    | ExecuteWheelMoveCommand
    | SelectPaymentCardCommand
    | ExecuteSelectedActionCommand
    | ExecuteActionCommand;

export interface RegionSelectedEvent extends GameEvent<'REGION_SELECTED'> {
    payload: {
        regionId: string;
        playerId: PlayerId;
    };
}

export interface PreviewActionConfirmedEvent extends GameEvent<'PREVIEW_ACTION_CONFIRMED'> {
    payload: {
        actionId: string;
        playerId: PlayerId;
    };
}

export interface WheelMoveSelectedEvent extends GameEvent<'WHEEL_MOVE_SELECTED'> {
    payload: {
        moveId: string;
        playerId: PlayerId;
    };
}

export interface WheelMoveExecutedEvent extends GameEvent<'WHEEL_MOVE_EXECUTED'> {
    payload: {
        moveId: string;
        playerId: PlayerId;
    };
}

export interface PaymentCardSelectedEvent extends GameEvent<'PAYMENT_CARD_SELECTED'> {
    payload: {
        cardId: string;
        playerId: PlayerId;
    };
}

export interface SelectedActionExecutedEvent extends GameEvent<'SELECTED_ACTION_EXECUTED'> {
    payload: {
        actionId: string;
        cardIds: string[];
        playerId: PlayerId;
    };
}

export type QidahenEvent =
    | RegionSelectedEvent
    | PreviewActionConfirmedEvent
    | WheelMoveSelectedEvent
    | WheelMoveExecutedEvent
    | PaymentCardSelectedEvent
    | SelectedActionExecutedEvent;

export interface QidahenCommandMap extends Record<string, unknown> {
    SELECT_REGION: SelectRegionCommand['payload'];
    CONFIRM_PREVIEW_ACTION: ConfirmPreviewActionCommand['payload'];
    SELECT_WHEEL_MOVE: SelectWheelMoveCommand['payload'];
    EXECUTE_WHEEL_MOVE: ExecuteWheelMoveCommand['payload'];
    SELECT_PAYMENT_CARD: SelectPaymentCardCommand['payload'];
    EXECUTE_SELECTED_ACTION: ExecuteSelectedActionCommand['payload'];
    EXECUTE_ACTION: ExecuteActionCommand['payload'];
}
