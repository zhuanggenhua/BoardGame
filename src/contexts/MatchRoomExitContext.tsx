import React, { createContext, useContext } from 'react';

export interface MatchRoomExitContextValue {
    /** Exit the current match and navigate back to the lobby (implementation provided by MatchRoom). */
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
