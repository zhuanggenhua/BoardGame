import React from 'react';
import { SummonerWarsCombatEffectPreferenceContext } from './combatEffectPreferenceContext';

const REDUCED_COMBAT_EFFECTS_KEY = 'summonerwars:reducedCombatEffects';

function readReducedCombatEffectsPreference(): boolean {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return false;
    }
    try {
        return window.localStorage.getItem(REDUCED_COMBAT_EFFECTS_KEY) === 'true';
    } catch {
        return false;
    }
}

function writeReducedCombatEffectsPreference(enabled: boolean): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(REDUCED_COMBAT_EFFECTS_KEY, String(enabled));
    } catch {
        // 忽略隐私模式或存储不可用
    }
}

export function SummonerWarsCombatEffectPreferenceProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [reducedCombatEffects, setReducedCombatEffects] = React.useState<boolean>(() => (
        readReducedCombatEffectsPreference()
    ));

    const toggleReducedCombatEffects = React.useCallback(() => {
        setReducedCombatEffects((prev) => {
            const next = !prev;
            writeReducedCombatEffectsPreference(next);
            return next;
        });
    }, []);

    return (
        <SummonerWarsCombatEffectPreferenceContext.Provider
            value={{
                reducedCombatEffects,
                toggleReducedCombatEffects,
            }}
        >
            {children}
        </SummonerWarsCombatEffectPreferenceContext.Provider>
    );
}
