import React from 'react';

export type DiceDisplayPreferenceContextValue = {
    boardDice3dEnabled: boolean;
    toggleBoardDice3d: () => void;
};

export const DiceDisplayPreferenceContext = React.createContext<DiceDisplayPreferenceContextValue>({
    boardDice3dEnabled: false,
    toggleBoardDice3d: () => undefined,
});
