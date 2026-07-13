import React from 'react';
import { SummonerWarsCombatEffectPreferenceContext } from './combatEffectPreferenceContext';

export function useSummonerWarsCombatEffectPreference() {
    return React.useContext(SummonerWarsCombatEffectPreferenceContext);
}
