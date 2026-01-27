import React, { createContext, useContext, useEffect } from 'react';

export type GameMode = 'local' | 'online' | 'tutorial';

export interface GameModeState {
    mode: GameMode;
    isMultiplayer: boolean;
    isSpectator?: boolean;
}

const GameModeContext = createContext<GameModeState | undefined>(undefined);

export const GameModeProvider: React.FC<{ mode: GameMode; isSpectator?: boolean; children: React.ReactNode }> = ({ mode, isSpectator = false, children }) => {
    const isMultiplayer = mode === 'online';

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const holder = window as Window & { __BG_GAME_MODE__?: GameMode; __BG_IS_SPECTATOR__?: boolean };
        holder.__BG_GAME_MODE__ = mode;
        holder.__BG_IS_SPECTATOR__ = isSpectator;
        if (import.meta.env.DEV) {
            console.info('[GameMode]', { mode, isMultiplayer, isSpectator });
        }
        return () => {
            if (holder.__BG_GAME_MODE__ === mode) {
                holder.__BG_GAME_MODE__ = undefined;
            }
            // Always clear spectator flag when unmounting this provider instance.
            holder.__BG_IS_SPECTATOR__ = undefined;
        };
    }, [mode, isSpectator, isMultiplayer]);

    return (
        <GameModeContext.Provider value={{ mode, isMultiplayer, isSpectator }}>
            {children}
        </GameModeContext.Provider>
    );
};

export const useGameMode = () => useContext(GameModeContext);
