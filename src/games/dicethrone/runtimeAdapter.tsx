import type { MatchState } from '../../engine/types';
import type { GameRuntimeAdapter } from '../gameRuntimeAdapter';
import { DiceThroneDisplayPreferenceProvider } from './ui/DiceDisplayPreferenceProvider';
import { DiceDisplaySettingsSection } from './ui/DiceDisplaySettingsSection';

export const diceThroneGameRuntimeAdapter: GameRuntimeAdapter = {
    PageProvider: DiceThroneDisplayPreferenceProvider,
    forceDismissHud: ({ state, playerId, dispatch }) => {
        const pendingBonusDiceSettlement = (state as MatchState<{
            pendingBonusDiceSettlement?: { attackerId?: string | number };
        }> | null | undefined)?.core?.pendingBonusDiceSettlement;
        if (
            !pendingBonusDiceSettlement
            || playerId == null
            || String(pendingBonusDiceSettlement.attackerId) !== String(playerId)
        ) {
            return false;
        }

        dispatch('SKIP_BONUS_DICE_REROLL', {});
        return true;
    },
    HudSettingsSection: DiceDisplaySettingsSection,
    seatSwap: {
        mode: 'request',
        requestCommandType: 'REQUEST_SEAT_SWAP',
        respondCommandType: 'RESPOND_SEAT_SWAP',
        cancelCommandType: 'CANCEL_SEAT_SWAP',
    },
};
