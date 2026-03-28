import type { PlayerId, ResponseWindowState } from '../../../engine/types';
import type { DiceThroneCore } from './types';
import { areTeammates, isTeamMode } from './rules';

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
