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

    // 关键：首帧同步写入，避免教程/本地在首轮命令前读取到未初始化的模式值。
    if (typeof window !== 'undefined') {
        const holder = window as Window & { __BG_GAME_MODE__?: GameMode; __BG_IS_SPECTATOR__?: boolean };
        holder.__BG_GAME_MODE__ = mode;
        holder.__BG_IS_SPECTATOR__ = isSpectator;
    }

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const holder = window as Window & { __BG_GAME_MODE__?: GameMode; __BG_IS_SPECTATOR__?: boolean };
        holder.__BG_GAME_MODE__ = mode;
        holder.__BG_IS_SPECTATOR__ = isSpectator;
        // 日志已移除：GameMode 每次渲染都打印过于频繁
        return () => {
            if (holder.__BG_GAME_MODE__ === mode) {
                holder.__BG_GAME_MODE__ = undefined;
            }
            // 卸载此 Provider 实例时总是清理 spectator 标记。
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
