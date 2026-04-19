import React, { createContext, useContext } from 'react';

export interface MatchRoomExitContextValue {
    /** 退出当前对局并返回大厅（实现由 MatchRoom 提供） */
    exitToLobby: () => void | Promise<void>;
}

const MatchRoomExitContext = createContext<MatchRoomExitContextValue | null>(null);

export interface MatchRoomExitProviderProps {
    value: MatchRoomExitContextValue;
    children: React.ReactNode;
}

export function MatchRoomExitProvider({ value, children }: MatchRoomExitProviderProps): React.ReactElement {
    return (
        <MatchRoomExitContext.Provider value={value}>
            {children}
        </MatchRoomExitContext.Provider>
    );
}

export function useMatchRoomExit(): MatchRoomExitContextValue | null {
    return useContext(MatchRoomExitContext);
}
