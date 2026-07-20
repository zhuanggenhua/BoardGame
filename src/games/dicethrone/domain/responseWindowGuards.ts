import type { PlayerId, ResponseWindowState } from '../../../engine/types';
import type { DiceThroneCore } from './types';
import {
    areTeammates,
    getPendingBonusSettlementDice,
    isTeamMode,
    shouldOpenAfterRollConfirmedForBonusSettlement,
} from './rules';

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

export const buildAfterRollConfirmedSignature = (core: DiceThroneCore): string => {
    const pendingBonusSettlement = core.pendingBonusDiceSettlement;
    const pendingBonusDice = shouldOpenAfterRollConfirmedForBonusSettlement(pendingBonusSettlement)
        ? getPendingBonusSettlementDice(pendingBonusSettlement)
        : [];
    const dice = core.dice ?? [];
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

    return dice
        .map((die) => {
            const symbol = typeof die.symbol === 'string' ? die.symbol : '';
            return `${die.id}:${die.value}:${symbol}`;
        })
        .join('|')
        .concat(`|turn:${turnNumber}|player:${activePlayerId}`);
};

export const hasAfterRollConfirmedWindowBeenHandled = (
    core: DiceThroneCore,
    rollSignature?: string,
): boolean => {
    const sequence = core.rollConfirmedSequence ?? 0;
    const isBonusDiceSignature = rollSignature?.startsWith('bonus:') === true;
    if (!isBonusDiceSignature && sequence > 0 && core.afterRollResponseWindowSequence === sequence) {
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
