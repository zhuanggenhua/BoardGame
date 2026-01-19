import React, { createContext, useContext, useState, useEffect } from 'react';

interface DebugContextType {
    playerID: string | null;
    setPlayerID: (id: string | null) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [playerID, setPlayerID] = useState<string | null>(() => {
        // Persist debug player selection
        return localStorage.getItem('debug_playerID') || '0';
    });

    useEffect(() => {
        if (playerID) {
            localStorage.setItem('debug_playerID', playerID);
        } else {
            localStorage.removeItem('debug_playerID');
        }
    }, [playerID]);

    return (
        <DebugContext.Provider value={{ playerID, setPlayerID }}>
            {children}
        </DebugContext.Provider>
    );
};

export const useDebug = () => {
    const context = useContext(DebugContext);
    if (!context) {
        throw new Error('useDebug must be used within a DebugProvider');
    }
    return context;
};
