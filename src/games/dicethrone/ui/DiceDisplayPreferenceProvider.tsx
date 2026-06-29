import React from 'react';
import { DiceDisplayPreferenceContext } from './diceDisplayPreferenceContext';

const DICE_DISPLAY_3D_KEY = 'dicethrone:boardDice3dEnabled';

function readBoardDice3dPreference(): boolean {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return false;
    }
    try {
        return window.localStorage.getItem(DICE_DISPLAY_3D_KEY) === 'true';
    } catch {
        return false;
    }
}

function writeBoardDice3dPreference(enabled: boolean): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(DICE_DISPLAY_3D_KEY, String(enabled));
    } catch {
        // 忽略隐私模式或存储不可用
    }
}

export function DiceThroneDisplayPreferenceProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [boardDice3dEnabled, setBoardDice3dEnabled] = React.useState<boolean>(() => readBoardDice3dPreference());

    const toggleBoardDice3d = React.useCallback(() => {
        setBoardDice3dEnabled((prev) => {
            const next = !prev;
            writeBoardDice3dPreference(next);
            return next;
        });
    }, []);

    return (
        <DiceDisplayPreferenceContext.Provider
            value={{
                boardDice3dEnabled,
                toggleBoardDice3d,
            }}
        >
            {children}
        </DiceDisplayPreferenceContext.Provider>
    );
}
