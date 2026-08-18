import type { PlayerId, ResponseWindowState } from '../../../engine/types';
import type { DiceThroneCore, TurnPhase } from './types';
import {
    areTeammates,
    getActiveDice,
    getPendingBonusSettlementDice,
    isTeamMode,
    shouldOpenAfterRollConfirmedForBonusSettlement,
} from './rules';
import { isCurrentBonusRollSettlement } from './rollContext';

export const isDirectDiceInterferenceActor = (
    core: DiceThroneCore,
    currentWindow: ResponseWindowState['current'] | undefined,
    playerId: PlayerId,
): boolean => {
    if (!currentWindow || currentWindow.windowType !== 'afterRollConfirmed') {
        return false;
    }
    if (!isTeamMode(core)) {
        return false;
    }

    const currentResponderId = currentWindow.responderQueue[currentWindow.currentResponderIndex];
    if (!currentResponderId || currentResponderId === playerId) {
        return false;
    }

    return areTeammates(core, currentResponderId, playerId);
};

export const buildAfterRollConfirmedSignature = (core: DiceThroneCore, phase?: TurnPhase): string => {
    const pendingBonusSettlement = core.pendingBonusDiceSettlement;
    const pendingBonusDice = isCurrentBonusRollSettlement(core)
        && shouldOpenAfterRollConfirmedForBonusSettlement(pendingBonusSettlement)
        ? getPendingBonusSettlementDice(pendingBonusSettlement)
        : [];
    const dice = getActiveDice(core, phase);
    const turnNumber = typeof core.turnNumber === 'number' ? core.turnNumber : '';
    const activePlayerId = typeof core.activePlayerId === 'string' ? core.activePlayerId : '';

    if (pendingBonusSettlement && pendingBonusDice.length > 0) {
        return pendingBonusDice
            .map((die) => {
                const face = typeof die.face === 'string' ? die.face : '';
                return `bonus:${die.index}:${die.value}:${face}`;
            })
            .join('|')
            .concat(`|settlement:${pendingBonusSettlement.id}`)
            .concat(`|source:${pendingBonusSettlement.sourceAbilityId}`)
            .concat(`|attacker:${pendingBonusSettlement.attackerId}`)
            .concat(`|turn:${turnNumber}|player:${activePlayerId}`);
    }

    const pendingAttack = core.pendingAttack;
    const attackSignature = pendingAttack?.sourceAbilityId
        ? `|attack:${pendingAttack.sourceAbilityId}`
        : '';
    const defenseSignature = pendingAttack?.defenseAbilityId
        ? `|defense:${pendingAttack.defenseAbilityId}`
        : '';

    return dice
        .map((die) => {
            const symbol = typeof die.symbol === 'string' ? die.symbol : '';
            return `${die.id}:${die.value}:${symbol}`;
        })
        .join('|')
        .concat(`|turn:${turnNumber}|player:${activePlayerId}`)
        .concat(attackSignature)
        .concat(defenseSignature);
};

export const hasAfterRollConfirmedWindowBeenHandled = (
    core: DiceThroneCore,
    rollSignature?: string,
): boolean => {
    const sequence = core.rollConfirmedSequence ?? 0;
    const isBonusDiceSignature = rollSignature?.startsWith('bonus:') === true;
    if (!isBonusDiceSignature && sequence > 0 && core.afterRollResponseWindowSequence === sequence) {
        if (rollSignature && typeof core.afterRollResponseWindowSignature === 'string') {
            return core.afterRollResponseWindowSignature === rollSignature;
        }
        return true;
    }
    if (rollSignature && typeof core.afterRollResponseWindowSignature === 'string') {
        return core.afterRollResponseWindowSignature === rollSignature;
    }
    return false;
};

export const hasAfterCardPlayedWindowBeenHandled = (
    core: DiceThroneCore,
): boolean => {
    const sequence = core.cardPlayedSequence ?? 0;
    return sequence > 0 && core.afterCardResponseWindowSequence === sequence;
};
