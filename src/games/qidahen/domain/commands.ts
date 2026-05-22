import type { MatchState, ValidationResult } from '../../../engine/types';
import type { QidahenCommand, QidahenCore } from './types';

export const QIDAHEN_COMMANDS = {
    SELECT_REGION: 'SELECT_REGION',
    CONFIRM_PREVIEW_ACTION: 'CONFIRM_PREVIEW_ACTION',
    SELECT_WHEEL_MOVE: 'SELECT_WHEEL_MOVE',
    EXECUTE_WHEEL_MOVE: 'EXECUTE_WHEEL_MOVE',
    SELECT_PAYMENT_CARD: 'SELECT_PAYMENT_CARD',
    EXECUTE_SELECTED_ACTION: 'EXECUTE_SELECTED_ACTION',
    EXECUTE_ACTION: 'EXECUTE_ACTION',
} as const;

export function validate(
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
): ValidationResult {
    switch (command.type) {
        case QIDAHEN_COMMANDS.SELECT_REGION:
            return state.core.regions.some((region) => region.id === command.payload.regionId)
                ? { valid: true }
                : { valid: false, error: 'unknownRegion' };
        case QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION:
            return command.payload.actionId.length > 0
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE:
        case QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE:
            return state.core.wheelMoveChoices.some((choice) => choice.id === command.payload.moveId)
                ? { valid: true }
                : { valid: false, error: 'unknownWheelMove' };
        case QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD:
            return state.core.handCards.some((card) => card.id === command.payload.cardId && card.status !== 'disabled')
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        case QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION:
            return state.core.selectedPaymentCardIds.length >= state.core.payment.required && state.core.payment.required > 0
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        case QIDAHEN_COMMANDS.EXECUTE_ACTION: {
            const action = state.core.actionChoices.find((choice) => choice.id === command.payload.actionId);
            if (!action) {
                return { valid: false, error: 'unknownAction' };
            }
            const payableCards = state.core.handCards.filter((card) => card.status !== 'disabled');
            return payableCards.length >= action.cost
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        }
        default:
            return { valid: false, error: 'unknownCommand' };
    }
}
