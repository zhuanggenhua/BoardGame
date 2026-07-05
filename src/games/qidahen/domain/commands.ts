import type { MatchState, ValidationResult } from '../../../engine/types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { QidahenCommand, QidahenCore } from './types';
import { hasUpgradableArmament } from './armamentLowFidelity';
import {
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenEventCharacterTargetSelectionForCore,
    getQidahenEventOpponentHandChoiceSelectionForCore,
    getQidahenDiplomacySelectionForCore,
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenHandLimitDiscardSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenPendingTargetActionForCore,
    getQidahenPostBattleSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './interactionSelectionAccessors';
import {
    computeQidahenSelectedPaymentValue,
    getQidahenHandCardPaymentValue,
    getQidahenSelectedActionPaymentProgress,
    hasRemainingFactionAction,
} from './factionActionWindow';
import { getCurrentFactionId } from './factionTurnAccessors';
import { getQidahenDirectActionIdForHandCard } from './handCardIdentity';
import {
    isQidahenCityRuntimeRegion,
    isQidahenKoreaRuntimeRegionId,
} from './regionConfig';
import { countCompatTroopsByKind } from './troopCompat';

export const QIDAHEN_COMMANDS = {
    CAST_SCENARIO_VOTE: 'CAST_SCENARIO_VOTE',
    SELECT_REGION: 'SELECT_REGION',
    CONFIRM_PREVIEW_ACTION: 'CONFIRM_PREVIEW_ACTION',
    CANCEL_PREVIEW_ACTION: 'CANCEL_PREVIEW_ACTION',
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
    PLAY_TACTIC_CARD: 'PLAY_TACTIC_CARD',
    RESOLVE_POST_BATTLE_DECISION: 'RESOLVE_POST_BATTLE_DECISION',
    RESOLVE_KHAN_EDICT_CHOICE: 'RESOLVE_KHAN_EDICT_CHOICE',
    RESOLVE_DIPLOMACY_CHOICE: 'RESOLVE_DIPLOMACY_CHOICE',
    RESOLVE_MA_SHI_TRADE_CHOICE: 'RESOLVE_MA_SHI_TRADE_CHOICE',
    RESOLVE_DRIVE_TIGER_CONSENT: 'RESOLVE_DRIVE_TIGER_CONSENT',
    RESOLVE_RECRUIT_CHOICE: 'RESOLVE_RECRUIT_CHOICE',
    RESOLVE_FORTIFICATION_MAINTENANCE: 'RESOLVE_FORTIFICATION_MAINTENANCE',
    RESOLVE_EVENT_CHARACTER_TARGET: 'RESOLVE_EVENT_CHARACTER_TARGET',
    RESOLVE_EVENT_OPPONENT_HAND_CHOICE: 'RESOLVE_EVENT_OPPONENT_HAND_CHOICE',
    RESOLVE_SCENARIO_CHARACTER_CHOICE: 'RESOLVE_SCENARIO_CHARACTER_CHOICE',
    RESOLVE_SCENARIO_ARMAMENT_CHOICE: 'RESOLVE_SCENARIO_ARMAMENT_CHOICE',
} as const;

const hasPendingScenarioChoices = (state: MatchState<QidahenCore>): boolean => (
    state.core.scenarioVote != null
    || state.core.pendingScenarioCharacterChoices.length > 0
    || state.core.pendingScenarioArmamentChoices.length > 0
);

const hasPendingScenarioVote = (state: MatchState<QidahenCore>): boolean => (
    state.core.scenarioVote != null
);

const hasBlockingSelection = (state: MatchState<QidahenCore>): boolean => (
    state.sys.interaction?.current != null
    || state.sys.interaction?.isBlocked === true
    || state.core.sunYuanhuaTechSelection != null
    || state.core.gaoDiDispatchSelection != null
);

const wouldRepeatLastFactionAction = (core: QidahenCore, actionId: string): boolean => (
    core.factionActionUsed
    && hasRemainingFactionAction(core)
    && core.lastFactionActionId === actionId
);

const isCurrentSeatCommand = (state: MatchState<QidahenCore>, command: QidahenCommand): boolean => (
    command.playerId === state.core.currentPlayer
);

const isCurrentInteractionSeatCommand = (state: MatchState<QidahenCore>, command: QidahenCommand): boolean => {
    const currentInteractionPlayerId = state.sys.interaction?.current?.playerId;
    return currentInteractionPlayerId != null && command.playerId === currentInteractionPlayerId;
};

const getCurrentInteractionSourceId = (currentInteraction: InteractionDescriptor | undefined): string | null => {
    const sourceId = (currentInteraction?.data as { sourceId?: unknown } | undefined)?.sourceId;
    return typeof sourceId === 'string' ? sourceId : null;
};

const getPendingTargetActionCommandSeat = (state: MatchState<QidahenCore>, currentInteraction: InteractionDescriptor | undefined): string | null => {
    const pendingTargetAction = getQidahenPendingTargetActionForCore(state.core, currentInteraction);
    if (!pendingTargetAction) {
        return null;
    }
    return state.core.factions[pendingTargetAction.attackerFactionId]?.playerId ?? null;
};

const getPostBattleDecisionCommandSeat = (state: MatchState<QidahenCore>, currentInteraction: InteractionDescriptor | undefined): string | null => {
    const selection = getQidahenPostBattleSelectionForCore(state.core, currentInteraction);
    if (!selection) {
        return null;
    }
    return state.core.factions[selection.attackerFactionId]?.playerId ?? null;
};

const isPendingTargetActionSeatCommand = (
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
    currentInteraction: InteractionDescriptor | undefined,
): boolean => getPendingTargetActionCommandSeat(state, currentInteraction) === command.playerId;

const isPostBattleDecisionSeatCommand = (
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
    currentInteraction: InteractionDescriptor | undefined,
): boolean => getPostBattleDecisionCommandSeat(state, currentInteraction) === command.playerId;

const isScenarioChoiceSeatCommand = (
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
    factionId: string,
): boolean => {
    const faction = state.core.factions[factionId as keyof QidahenCore['factions']];
    return faction?.playerId === command.playerId;
};

const isValidQidahenDirectHandActionSource = (
    core: QidahenCore,
    actionId: string,
    sourceHandCardId: string | null | undefined,
): boolean => {
    if (!sourceHandCardId) {
        return true;
    }
    const currentFactionId = getCurrentFactionId(core);
    const sourceCard = core.handCards.find((card) => card.id === sourceHandCardId);
    return !!sourceCard
        && sourceCard.faction === currentFactionId
        && sourceCard.status !== 'disabled'
        && getQidahenDirectActionIdForHandCard(sourceCard) === actionId;
};

const requiresQidahenDirectHandActionSource = (actionId: string): boolean => (
    actionId === 'upgrade-armament'
    || actionId === 'play-event-card'
);

const isQidahenPendingActionEligibleForCavalryPlunder = (
    core: QidahenCore,
    pendingTargetAction: NonNullable<QidahenCore['pendingTargetAction']>,
): boolean => {
    if (
        pendingTargetAction.actionId !== 'raid'
        && pendingTargetAction.actionId !== 'wheel-dispatch'
        && pendingTargetAction.actionId !== 'drive-tiger'
    ) {
        return false;
    }
    if (
        !pendingTargetAction.sourceRegionId
        || isQidahenCityRuntimeRegion(pendingTargetAction.targetRuntimeRegionId)
        || isQidahenKoreaRuntimeRegionId(pendingTargetAction.targetRuntimeRegionId)
    ) {
        return false;
    }
    if (pendingTargetAction.movementProfileId === 'infantry' || pendingTargetAction.movementProfileId === 'dispatch-infantry') {
        return false;
    }
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pendingTargetAction.targetRuntimeRegionId);
    if (!targetRegion || targetRegion.population <= 0) {
        return false;
    }
    const sourceRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pendingTargetAction.sourceRegionId);
    if (!sourceRegion) {
        return false;
    }
    const cavalryCount = countCompatTroopsByKind(sourceRegion.specialTroops, 'cavalry');
    return Math.min(cavalryCount, pendingTargetAction.committedTroops) > 0;
};

const isQidahenTacticCardPlayableForPendingBattle = (
    core: QidahenCore,
    card: Pick<QidahenCore['handCards'][number], 'cardDefId' | 'rulesSummary'>,
    pendingTargetAction: NonNullable<QidahenCore['pendingTargetAction']>,
    side: 'attacker' | 'defender',
): boolean => {
    const rulesSummary = card.rulesSummary ?? '';
    if (side === 'defender') {
        return (
            pendingTargetAction.battleMode === 'city'
            && card.cardDefId === 'qidahen-atlas05-1635-steadfast-defense'
        )
            || card.cardDefId === 'qidahen-atlas05-1602-bayara'
            || (
                pendingTargetAction.battleMode === 'field'
                && pendingTargetAction.defenderFactionId === 'ming'
                && card.cardDefId === 'qidahen-atlas05-1640-jirinai-infantry'
            )
            || (
                pendingTargetAction.battleMode === 'field'
                && card.cardDefId === 'qidahen-atlas05-1636-cheval-de-frise'
            );
    }
    if (card.cardDefId === 'qidahen-atlas05-1612-raid-grain') {
        return isQidahenPendingActionEligibleForCavalryPlunder(core, pendingTargetAction);
    }
    if (
        rulesSummary.includes('敌人增援时')
        || rulesSummary.includes('取消对手宣告的附兵劫掠')
        || rulesSummary.includes('扎营过程中')
        || rulesSummary.includes('野战骑兵阶段使用')
        || rulesSummary.includes('附兵部队视为步兵部队')
        || rulesSummary.includes('再移动最多 2 个没有参战的部队进入战斗')
    ) {
        return false;
    }
    if (
        rulesSummary.includes('提前在炮兵阶段')
        && !(
            pendingTargetAction.battleMode === 'field'
            && card.cardDefId === 'qidahen-atlas05-1650-wuzhen-chaoha-special'
        )
    ) {
        return false;
    }
    if (rulesSummary.includes('只能于守城时使用')) {
        return false;
    }
    if (
        pendingTargetAction.battleMode === 'city'
        && (
            rulesSummary.includes('不能在攻城、守城时使用')
            || rulesSummary.includes('只能于野战时使用')
            || rulesSummary.includes('野战时才能使用')
            || rulesSummary.includes('野战步兵阶段使用')
            || rulesSummary.includes('野战骑兵阶段')
        )
    ) {
        return false;
    }
    return true;
};

export function validate(
    state: MatchState<QidahenCore>,
    command: QidahenCommand,
): ValidationResult {
    if (command.type.startsWith('SYS_')) {
        return { valid: true };
    }
    const currentInteraction = state.sys.interaction?.current;
    switch (command.type) {
        case QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE:
            if (!hasPendingScenarioVote(state)) {
                return { valid: false, error: 'unknownAction' };
            }
            if (!state.core.playerIds.includes(command.playerId)) {
                return { valid: false, error: 'unknownAction' };
            }
            if (command.payload.scenarioId == null) {
                return { valid: true };
            }
            return state.core.scenarioVote.options.some((option) => option.scenarioId === command.payload.scenarioId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.SELECT_REGION:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command) && !isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return state.core.regions.some((region) => region.id === command.payload.regionId)
                ? { valid: true }
                : { valid: false, error: 'unknownRegion' };
        case QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            if (hasBlockingSelection(state) || !hasRemainingFactionAction(state.core)) {
                return { valid: false, error: 'actionAlreadyUsed' };
            }
            if (wouldRepeatLastFactionAction(state.core, command.payload.actionId)) {
                return { valid: false, error: 'sameActionConsecutivelyNotAllowed' };
            }
            if (requiresQidahenDirectHandActionSource(command.payload.actionId) && !command.payload.sourceHandCardId) {
                return { valid: false, error: 'unknownPaymentCard' };
            }
            if (!isValidQidahenDirectHandActionSource(
                state.core,
                command.payload.actionId,
                command.payload.sourceHandCardId,
            )) {
                return { valid: false, error: 'unknownPaymentCard' };
            }
            return command.payload.actionId.length > 0
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.CANCEL_PREVIEW_ACTION:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            if (hasBlockingSelection(state) || !hasRemainingFactionAction(state.core)) {
                return { valid: false, error: 'actionAlreadyUsed' };
            }
            return state.core.confirmedActionId != null
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE:
            if (hasPendingScenarioChoices(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            if (hasBlockingSelection(state) || state.core.wheelActionUsed) {
                return { valid: false, error: 'wheelAlreadyUsed' };
            }
            return state.core.wheelMoveChoices.some((choice) => choice.id === command.payload.moveId)
                ? { valid: true }
                : { valid: false, error: 'unknownWheelMove' };
        case QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE:
            if (hasPendingScenarioChoices(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            if (hasBlockingSelection(state) || state.core.wheelActionUsed) {
                return { valid: false, error: 'wheelAlreadyUsed' };
            }
            return state.core.wheelMoveChoices.some((choice) => choice.id === command.payload.moveId)
                ? { valid: true }
                : { valid: false, error: 'unknownWheelMove' };
        case QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD:
            if (hasPendingScenarioChoices(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
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
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenHandLimitDiscardSelectionForCore(state.core, currentInteraction)
                ?.candidateCardIds.includes(command.payload.cardId)
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        case QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return state.core.sunYuanhuaTechSelection?.candidateCardIds.includes(command.payload.cardId)
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        case QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return state.core.gaoDiDispatchSelection?.candidateCardIds.includes(command.payload.cardId)
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        case QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            {
                const selection = getQidahenHandLimitDiscardSelectionForCore(state.core, currentInteraction);
                return !!selection
                    && selection.selectedCardIds.length >= selection.requiredDiscardCount
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
            }
        case QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
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
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
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
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenInternalDispatchSelectionForCore(state.core, currentInteraction)
                ?.candidates.some((candidate) => candidate.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION:
            if (hasPendingScenarioChoices(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            if (hasBlockingSelection(state) || !hasRemainingFactionAction(state.core)) {
                return { valid: false, error: 'actionAlreadyUsed' };
            }
            if (state.core.confirmedActionId == null) {
                return { valid: false, error: 'unknownAction' };
            }
            if (wouldRepeatLastFactionAction(state.core, state.core.confirmedActionId)) {
                return { valid: false, error: 'sameActionConsecutivelyNotAllowed' };
            }
            if (
                state.core.confirmedActionId === 'upgrade-armament'
                && !hasUpgradableArmament(state.core, getCurrentFactionId(state.core))
            ) {
                return { valid: false, error: 'noUpgradableArmament' };
            }
            return (getQidahenSelectedActionPaymentProgress(state.core, state.core.confirmedActionId)
                ?? computeQidahenSelectedPaymentValue(state.core.handCards, state.core.selectedPaymentCardIds)) >= state.core.payment.required
                && state.core.payment.required > 0
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        case QIDAHEN_COMMANDS.EXECUTE_ACTION: {
            if (hasPendingScenarioChoices(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
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
            return payableCards.reduce((total, card) => total + getQidahenHandCardPaymentValue(card), 0) >= action.cost
                ? { valid: true }
                : { valid: false, error: 'paymentIncomplete' };
        }
        case QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isPendingTargetActionSeatCommand(state, command, currentInteraction)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenPendingTargetActionForCore(state.core, currentInteraction)
                ? { valid: true }
                : { valid: false, error: 'noPendingAction' };
        case QIDAHEN_COMMANDS.PLAY_TACTIC_CARD: {
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            const pendingTargetAction = getQidahenPendingTargetActionForCore(state.core, currentInteraction);
            if (!pendingTargetAction) {
                return { valid: false, error: 'noPendingAction' };
            }
            const attackerPlayerId = state.core.factions[pendingTargetAction.attackerFactionId]?.playerId;
            if (attackerPlayerId !== command.playerId) {
                const defenderPlayerId = pendingTargetAction.defenderFactionId !== 'neutral'
                    ? state.core.factions[pendingTargetAction.defenderFactionId]?.playerId
                    : null;
                if (defenderPlayerId !== command.playerId) {
                    return { valid: false, error: 'notCurrentPlayer' };
                }
                return state.core.handCards.some((card) => (
                    card.id === command.payload.cardId
                    && card.faction === pendingTargetAction.defenderFactionId
                    && card.cardKind === 'tactic'
                    && card.status !== 'disabled'
                    && isQidahenTacticCardPlayableForPendingBattle(state.core, card, pendingTargetAction, 'defender')
                ))
                    ? { valid: true }
                    : { valid: false, error: 'unknownPaymentCard' };
            }
            return state.core.handCards.some((card) => (
                card.id === command.payload.cardId
                && card.faction === pendingTargetAction.attackerFactionId
                && card.cardKind === 'tactic'
                && card.status !== 'disabled'
                && isQidahenTacticCardPlayableForPendingBattle(state.core, card, pendingTargetAction, 'attacker')
            ))
                ? { valid: true }
                : { valid: false, error: 'unknownPaymentCard' };
        }
        case QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isPostBattleDecisionSeatCommand(state, command, currentInteraction)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenPostBattleSelectionForCore(state.core, currentInteraction)
                ?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownPostBattleChoice' };
        case QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenKhanEdictSelectionForCore(state.core, currentInteraction)
                ?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenDiplomacySelectionForCore(state.core, currentInteraction)
                ?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenMaShiTradeSelectionForCore(state.core, currentInteraction)
                ?.choices.some((choice) => choice.troopCount === command.payload.troopCount)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenDriveTigerConsentSelectionForCore(state.core, currentInteraction)
                ?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenRecruitSelectionForCore(state.core, currentInteraction)
                ?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (getCurrentInteractionSourceId(currentInteraction) != null && !isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            if (
                command.payload.attritionPriority != null
                && command.payload.attritionPriority !== 'highest-level'
                && command.payload.attritionPriority !== 'lowest-level'
            ) {
                return { valid: false, error: 'unknownAction' };
            }
            return getQidahenFortificationMaintenanceSelectionForCore(state.core, currentInteraction)
                ?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_EVENT_CHARACTER_TARGET:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenEventCharacterTargetSelectionForCore(
                state.core,
                getCurrentInteractionSourceId(currentInteraction) != null
                    && currentInteraction?.data != null
                    ? currentInteraction
                    : null,
            )
                ?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE:
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            if (!isCurrentInteractionSeatCommand(state, command)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            return getQidahenEventOpponentHandChoiceSelectionForCore(
                state.core,
                getCurrentInteractionSourceId(currentInteraction) != null
                    && currentInteraction?.data != null
                    ? currentInteraction
                    : null,
            )
                ?.choices.some((choice) => choice.id === command.payload.choiceId)
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        case QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE: {
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            const group = state.core.pendingScenarioCharacterChoices.find((choice) => choice.id === command.payload.groupId);
            if (!group) {
                return { valid: false, error: 'unknownAction' };
            }
            if (!isScenarioChoiceSeatCommand(state, command, group.factionId)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            const selectedIds = Array.from(new Set(command.payload.characterIds));
            if (selectedIds.length !== group.count) {
                return { valid: false, error: 'paymentIncomplete' };
            }
            return selectedIds.every((characterId) => group.characterIds.includes(characterId))
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        }
        case QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE: {
            if (hasPendingScenarioVote(state)) {
                return { valid: false, error: 'pendingScenarioChoices' };
            }
            const group = state.core.pendingScenarioArmamentChoices.find((choice) => choice.id === command.payload.groupId);
            if (!group) {
                return { valid: false, error: 'unknownAction' };
            }
            if (!isScenarioChoiceSeatCommand(state, command, group.factionId)) {
                return { valid: false, error: 'notCurrentPlayer' };
            }
            const selectedIds = Array.from(new Set(command.payload.armamentIds));
            if (selectedIds.length !== group.count) {
                return { valid: false, error: 'paymentIncomplete' };
            }
            return selectedIds.every((armamentId) => group.armamentIds.includes(armamentId))
                ? { valid: true }
                : { valid: false, error: 'unknownAction' };
        }
        default:
            return { valid: false, error: 'unknownCommand' };
    }
}
