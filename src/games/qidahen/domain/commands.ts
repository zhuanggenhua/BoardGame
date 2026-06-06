import type { MatchState, ValidationResult } from '../../../engine/types';
import type { QidahenCommand, QidahenCore, QidahenFactionId } from './types';

const QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL = 2;

export const QIDAHEN_COMMANDS = {
    SELECT_REGION: 'SELECT_REGION',
    CONFIRM_PREVIEW_ACTION: 'CONFIRM_PREVIEW_ACTION',
    SELECT_WHEEL_MOVE: 'SELECT_WHEEL_MOVE',
    EXECUTE_WHEEL_MOVE: 'EXECUTE_WHEEL_MOVE',
    SELECT_PAYMENT_CARD: 'SELECT_PAYMENT_CARD',
    SELECT_HAND_LIMIT_DISCARD_CARD: 'SELECT_HAND_LIMIT_DISCARD_CARD',
    SELECT_SUN_YUANHUA_TECH_CARD: 'SELECT_SUN_YUANHUA_TECH_CARD',
    SELECT_GAO_DI_DISPATCH_CARD: 'SELECT_GAO_DI_DISPATCH_CARD',
    RESOLVE_HAND_LIMIT_DISCARD: 'RESOLVE_HAND_LIMIT_DISCARD',
    RESOLVE_SUN_YUANHUA_TECH: 'RESOLVE_SUN_YUANHUA_TECH',
    RESOLVE_GAO_DI_DISPATCH: 'RESOLVE_GAO_DI_DISPATCH',
    RESOLVE_INTERNAL_DISPATCH: 'RESOLVE_INTERNAL_DISPATCH',
    EXECUTE_SELECTED_ACTION: 'EXECUTE_SELECTED_ACTION',
    EXECUTE_ACTION: 'EXECUTE_ACTION',
    RESOLVE_PENDING_ACTION: 'RESOLVE_PENDING_ACTION',
    RESOLVE_POST_BATTLE_DECISION: 'RESOLVE_POST_BATTLE_DECISION',
    RESOLVE_KHAN_EDICT_CHOICE: 'RESOLVE_KHAN_EDICT_CHOICE',
    RESOLVE_DIPLOMACY_CHOICE: 'RESOLVE_DIPLOMACY_CHOICE',
    RESOLVE_MA_SHI_TRADE_CHOICE: 'RESOLVE_MA_SHI_TRADE_CHOICE',
    RESOLVE_DRIVE_TIGER_CONSENT: 'RESOLVE_DRIVE_TIGER_CONSENT',
    RESOLVE_RECRUIT_CHOICE: 'RESOLVE_RECRUIT_CHOICE',
    RESOLVE_FORTIFICATION_MAINTENANCE: 'RESOLVE_FORTIFICATION_MAINTENANCE',
} as const;

const hasBlockingSelection = (state: MatchState<QidahenCore>): boolean => (
    state.core.pendingTargetAction != null
    || state.core.postBattleSelection != null
    || state.core.khanEdictSelection != null
    || state.core.diplomacySelection != null
    || state.core.maShiTradeSelection != null
    || state.core.driveTigerConsentSelection != null
    || state.core.recruitSelection != null
    || state.core.fortificationMaintenanceSelection != null
    || state.core.handLimitDiscardSelection != null
    || state.core.sunYuanhuaTechSelection != null
    || state.core.gaoDiDispatchSelection != null
    || state.core.internalDispatchSelection != null
);

const getCurrentFactionId = (core: QidahenCore): QidahenFactionId => (
    (Object.values(core.factions).find((faction) => faction.playerId === core.currentPlayer)?.id ?? 'ming') as QidahenFactionId
);

const hasActiveCharacter = (
    core: QidahenCore,
    factionId: QidahenFactionId,
    characterId: string,
): boolean => core.factions[factionId].characters.some((character) => character.id === characterId && character.inPlay);

const hasRemainingFactionAction = (core: QidahenCore): boolean => {
    if (!core.factionActionUsed) {
        return true;
    }
    const currentFactionId = getCurrentFactionId(core);
    return currentFactionId === 'jin'
        && hasActiveCharacter(core, 'jin', 'jin-huangtaiji')
        && core.bonusFactionActionAvailable
        && !core.bonusFactionActionUsed;
};

const wouldRepeatLastFactionAction = (core: QidahenCore, actionId: string): boolean => (
    core.factionActionUsed
    && hasRemainingFactionAction(core)
    && core.lastFactionActionId === actionId
);

const hasUpgradableArmament = (core: QidahenCore, factionId: QidahenFactionId): boolean => (
    core.factions[factionId].armaments.some((armament) => armament.level < QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL)
);

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
            if (hasBlockingSelection(state) || !hasRemainingFactionAction(state.core)) {
                return { valid: false, error: 'actionAlreadyUsed' };
            }
            if (wouldRepeatLastFactionAction(state.core, command.payload.actionId)) {
                return { valid: false, error: 'sameActionConsecutivelyNotAllowed' };
            }
            return command.payload.actionId.length > 0
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE:
            if (hasBlockingSelection(state) || state.core.wheelActionUsed) {
                return { valid: false, error: 'wheelAlreadyUsed' };
            }
            return state.core.wheelMoveChoices.some((choice) => choice.id === command.payload.moveId)
                ? { valid: true }
                : { valid: false, error: 'unknownWheelMove' };
        case QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE:
            if (hasBlockingSelection(state) || state.core.wheelActionUsed) {
                return { valid: false, error: 'wheelAlreadyUsed' };
            }
            return state.core.wheelMoveChoices.some((choice) => choice.id === command.payload.moveId)
                ? { valid: true }
                : { valid: false, error: 'unknownWheelMove' };
        case QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD:
            if (hasBlockingSelection(state) || !hasRemainingFactionAction(state.core)) {
                return { valid: false, error: 'actionAlreadyUsed' };
            }
            return state.core.handCards.some((card) => (
                card.id === command.payload.cardId
                && card.faction === getCurrentFactionId(state.core)
                && card.status !== 'disabled'
            ))
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        case QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD:
            return state.core.handLimitDiscardSelection?.candidateCardIds.includes(command.payload.cardId)
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        case QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD:
            return state.core.sunYuanhuaTechSelection?.candidateCardIds.includes(command.payload.cardId)
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        case QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD:
            return state.core.gaoDiDispatchSelection?.candidateCardIds.includes(command.payload.cardId)
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        case QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD:
            return state.core.handLimitDiscardSelection
                && state.core.handLimitDiscardSelection.selectedCardIds.length >= state.core.handLimitDiscardSelection.requiredDiscardCount
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        case QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH:
            if (!state.core.sunYuanhuaTechSelection) {
                return { valid: false, error: 'unknownAction' };
            }
            if (command.payload.choiceId === 'skip') {
                return { valid: true };
            }
            return state.core.sunYuanhuaTechSelection.selectedCardIds.length >= state.core.sunYuanhuaTechSelection.requiredCardCount
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        case QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH:
            if (!state.core.gaoDiDispatchSelection) {
                return { valid: false, error: 'unknownAction' };
            }
            if (command.payload.choiceId === 'skip') {
                return { valid: true };
            }
            return state.core.gaoDiDispatchSelection.selectedCardId != null
                && state.core.gaoDiDispatchSelection.candidates.some((candidate) => candidate.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        case QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH:
            return state.core.internalDispatchSelection?.candidates.some((candidate) => candidate.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION:
            if (hasBlockingSelection(state) || !hasRemainingFactionAction(state.core)) {
                return { valid: false, error: 'actionAlreadyUsed' };
            }
            if (wouldRepeatLastFactionAction(state.core, state.core.selectedActionId)) {
                return { valid: false, error: 'sameActionConsecutivelyNotAllowed' };
            }
            if (
                state.core.selectedActionId === 'upgrade-armament'
                && !hasUpgradableArmament(state.core, getCurrentFactionId(state.core))
            ) {
                return { valid: false, error: 'noUpgradableArmament' };
            }
            return state.core.selectedPaymentCardIds.length >= state.core.payment.required && state.core.payment.required > 0
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        case QIDAHEN_COMMANDS.EXECUTE_ACTION: {
            if (hasBlockingSelection(state) || !hasRemainingFactionAction(state.core)) {
                return { valid: false, error: 'actionAlreadyUsed' };
            }
            const action = state.core.actionChoices.find((choice) => choice.id === command.payload.actionId);
            if (!action) {
                return { valid: false, error: 'unknownAction' };
            }
            if (wouldRepeatLastFactionAction(state.core, command.payload.actionId)) {
                return { valid: false, error: 'sameActionConsecutivelyNotAllowed' };
            }
            const currentFactionId = getCurrentFactionId(state.core);
            if (action.id === 'upgrade-armament' && !hasUpgradableArmament(state.core, currentFactionId)) {
                return { valid: false, error: 'noUpgradableArmament' };
            }
            const payableCards = state.core.handCards.filter((card) => card.faction === currentFactionId && card.status !== 'disabled');
            return payableCards.length >= action.cost
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        }
        case QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION:
            return state.core.pendingTargetAction
                ? { valid: true }
                : { valid: false, error: 'noPendingAction' };
        case QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION:
            return state.core.postBattleSelection?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownPostBattleChoice' };
        case QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE:
            return state.core.khanEdictSelection?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE:
            return state.core.diplomacySelection?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE:
            return state.core.maShiTradeSelection?.choices.some((choice) => choice.troopCount === command.payload.troopCount)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT:
            return state.core.driveTigerConsentSelection?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE:
            return state.core.recruitSelection?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE:
            if (
                command.payload.attritionPriority != null
                && command.payload.attritionPriority !== 'highest-level'
                && command.payload.attritionPriority !== 'lowest-level'
            ) {
                return { valid: false, error: 'unknownAction' };
            }
            return state.core.fortificationMaintenanceSelection?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        default:
            return { valid: false, error: 'unknownCommand' };
    }
}
