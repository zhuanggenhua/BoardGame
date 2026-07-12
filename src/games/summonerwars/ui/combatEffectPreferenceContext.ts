import React from 'react';

export type SummonerWarsCombatEffectPreferenceContextValue = {
    reducedCombatEffects: boolean;
    toggleReducedCombatEffects: () => void;
};

export const SummonerWarsCombatEffectPreferenceContext = React.createContext<SummonerWarsCombatEffectPreferenceContextValue>({
    reducedCombatEffects: false,
    toggleReducedCombatEffects: () => undefined,
});
