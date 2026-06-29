import React from 'react';
import { DiceDisplayPreferenceContext } from './diceDisplayPreferenceContext';

export function useDiceThroneDisplayPreference() {
    return React.useContext(DiceDisplayPreferenceContext);
}
