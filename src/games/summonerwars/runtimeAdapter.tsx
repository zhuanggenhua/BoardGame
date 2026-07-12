import type { GameRuntimeAdapter } from '../gameRuntimeAdapter';
import { SummonerWarsCombatEffectPreferenceProvider } from './ui/CombatEffectPreferenceProvider';
import { SummonerWarsCombatEffectSettingsSection } from './ui/CombatEffectSettingsSection';

export const summonerWarsGameRuntimeAdapter: GameRuntimeAdapter = {
    PageProvider: SummonerWarsCombatEffectPreferenceProvider,
    HudSettingsSection: SummonerWarsCombatEffectSettingsSection,
    seatSwap: {
        mode: 'instant',
        requestCommandType: 'sw:swap_seat',
        respondCommandType: null,
        cancelCommandType: null,
    },
};
